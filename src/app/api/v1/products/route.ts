import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { generateEmbedding } from "@/lib/ai/embeddings";

// GET /api/v1/products — List products for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "catalog", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const search = params.get("search");
    const categoryId = params.get("category_id");
    const type = params.get("type");
    const isActive = params.get("is_active");
    const lowStock = params.get("low_stock") === "true";
    const locale = params.get("locale") ?? "fr";

    // Low stock: use RPC directly (handles pagination server-side)
    if (lowStock) {
      const { data, error } = await auth.supabase
        .rpc("get_low_stock_products", {
          p_team_id: teamId,
          p_page: page,
          p_limit: limit,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const totalCount = (data && data.length > 0 ? Number(data[0].total_count) : 0);
      return NextResponse.json({
        data,
        pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) },
      });
    }

    // Normal filtered query
    let query = auth.supabase
      .from("products")
      .select(`
        *,
        category:category_id(id, slug),
        translation:product_translations!inner(*)
      `, { count: "exact" })
      .eq("team_id", teamId)
      .eq("translation.locale", locale);

    if (categoryId) query = query.eq("category_id", categoryId);
    if (type) query = query.eq("type", type);
    if (isActive !== null && isActive !== undefined) {
      query = query.eq("is_active", isActive === "true");
    }
    if (search) {
      // Hybrid search: trigram similarity via RPC
      const { data: searchData, error: searchErr } = await auth.supabase
        .rpc("hybrid_search_products", { p_team_id: teamId, p_query: search, p_limit: limit });
      if (searchErr) return NextResponse.json({ error: searchErr.message }, { status: 500 });
      return NextResponse.json({
        data: searchData ?? [],
        pagination: { page: 1, limit, total: searchData?.length ?? 0, pages: 1 },
      });
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// POST /api/v1/products — Create a product with translations and images
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const {
      category_id, sku, type, name, description,
      price_ht, cost_price, supplier_ref, currency_id, tax_rate_id,
      track_stock, current_stock, low_stock_alert, unit,
      is_active, is_published, featured, slug, meta_title, meta_description,
      translations, images,
    } = body;

    if (!name || price_ht === undefined || !currency_id) {
      return NextResponse.json({
        error: "name, price_ht, and currency_id are required",
      }, { status: 400 });
    }

    // Create product
    const { data: product, error: prodError } = await auth.supabase
      .from("products")
      .insert({
        team_id: teamId,
        category_id: category_id ?? null,
        sku: sku ?? null,
        type: type ?? "product",
        name,
        description: description ?? null,
        price_ht,
        currency_id,
        tax_rate_id: tax_rate_id ?? null,
        track_stock: track_stock ?? false,
        current_stock: current_stock ?? 0,
        low_stock_alert: low_stock_alert ?? null,
        unit: unit ?? "pcs",
        is_active: is_active ?? true,
        is_published: is_published ?? false,
        featured: featured ?? false,
        slug: slug ?? null,
        meta_title: meta_title ?? null,
        meta_description: meta_description ?? null,
        cost_price: cost_price ?? null,
        supplier_ref: supplier_ref ?? null,
      })
      .select()
      .single();

    if (prodError) {
      return NextResponse.json({ error: prodError.message }, { status: 400 });
    }

    // Insert translations, images, and initial ledger entry in parallel
    await Promise.all([
      translations && Array.isArray(translations)
        ? auth.supabase.from("product_translations").insert(
            translations.map((t: { locale: string; name: string; description?: string; short_description?: string }) => ({
              product_id: product.id,
              locale: t.locale,
              name: t.name,
              description: t.description ?? null,
              short_description: t.short_description ?? null,
            }))
          )
        : null,
      images && Array.isArray(images)
        ? auth.supabase.from("product_images").insert(
            images.map((img: { storage_path: string; position?: number; alt_text?: string }, idx: number) => ({
              product_id: product.id,
              storage_path: img.storage_path,
              position: img.position ?? idx,
              alt_text: img.alt_text ?? null,
            }))
          )
        : null,
      track_stock && current_stock && current_stock > 0
        ? auth.supabase.from("inventory_ledger").insert({
            team_id: teamId,
            product_id: product.id,
            transaction_type: "initial_stock",
            quantity_change: current_stock,
            running_balance: current_stock,
            description: "Initial stock on product creation",
            created_by: auth.userId,
          })
        : null,
    ].filter(Boolean));

    // Generate embedding non-blocking
    generateEmbedding(`${name} ${description ?? ""} ${sku ?? ""}`.trim()).then((embedding) => {
      if (embedding) {
        auth.supabase.from("products").update({ embedding }).eq("id", product.id).then(() => {});
      }
    });

    return NextResponse.json({ data: product }, { status: 201 });
  });
}
