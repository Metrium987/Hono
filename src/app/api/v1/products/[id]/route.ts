import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { generateEmbedding } from "@/lib/ai/embeddings";

// GET /api/v1/products/[id] — Get single product with translations and images
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "read");
    const { data, error } = await auth.supabase
      .from("products")
      .select(`
        *,
        category:category_id(id, slug),
        translations:product_translations(*),
        images:product_images(*)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .order("position", { foreignTable: "product_images", ascending: true })
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// PATCH /api/v1/products/[id] — Update product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

    // Build update payload
    const updatePayload: Record<string, string | number | boolean | null> = {};
    const updatableFields = [
      "category_id", "sku", "type", "name", "description",
      "price_ht", "cost_price", "supplier_ref", "currency_id", "tax_rate_id",
      "track_stock", "current_stock", "low_stock_alert", "unit",
      "is_active", "is_published", "featured", "slug", "meta_title", "meta_description",
    ] as const;

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      updatePayload.updated_at = new Date().toISOString();

      const { error: updateError } = await auth.supabase
        .from("products")
        .update(updatePayload)
        .eq("id", id)
        .eq("team_id", teamId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

    // Upsert translations
    if (translations && Array.isArray(translations)) {
      for (const t of translations) {
        const { locale, name: tName, description: tDesc, short_description } = t;
        if (!locale) continue;

        const { error: upsertError } = await auth.supabase
          .from("product_translations")
          .upsert({
            product_id: id,
            locale,
            name: tName,
            description: tDesc ?? null,
            short_description: short_description ?? null,
          }, { onConflict: "product_id, locale" });

        if (upsertError) {
          return NextResponse.json({ error: upsertError.message }, { status: 400 });
        }
      }
    }

    // Replace images if provided
    if (images && Array.isArray(images)) {
      await auth.supabase.from("product_images").delete().eq("product_id", id);

      const imageRows = images.map((img: { storage_path: string; position?: number; alt_text?: string }, idx: number) => ({
        product_id: id,
        storage_path: img.storage_path,
        position: img.position ?? idx,
        alt_text: img.alt_text ?? null,
      }));

      await auth.supabase.from("product_images").insert(imageRows);
    }

    // Regenerate embedding non-blocking if searchable fields changed
    if (updatePayload.name !== undefined || updatePayload.description !== undefined) {
      auth.supabase
        .from("products")
        .select("name, description")
        .eq("id", id)
        .single()
        .then(({ data: current }) => {
          if (!current) return;
          const text = [current.name, current.description].filter(Boolean).join(" ");
          generateEmbedding(text).then((embedding) => {
            if (embedding) {
              auth.supabase.from("products").update({ embedding }).eq("id", id).then(() => {});
            }
          });
        });
    }

    // Fetch updated product
    const { data, error: fetchError } = await auth.supabase
      .from("products")
      .select(`*, translations:product_translations(*), images:product_images(*)`)
      .eq("id", id)
      .eq("team_id", teamId)
      .order("position", { foreignTable: "product_images", ascending: true })
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/products/[id] — Delete a product
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const { error } = await auth.supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({
          error: "Cannot delete product with inventory history. Deactivate it instead.",
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
