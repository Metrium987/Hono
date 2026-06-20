import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/categories — List categories for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "catalog", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const locale = params.get("locale") ?? "fr";

    const { data, error, count } = await auth.supabase
      .from("product_categories")
      .select(`
        *,
        parent:parent_id(id, slug),
        translation:product_category_translations!inner(*)
      `, { count: "exact" })
      .eq("team_id", teamId)
      .eq("translation.locale", locale)
      .order("sort_order", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// POST /api/v1/categories — Create a category with translations
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const { slug, parent_id, is_active, sort_order, translations } = body;

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }
    if (!translations || translations.length === 0) {
      return NextResponse.json({ error: "At least one translation is required (fr)" }, { status: 400 });
    }

    const frName = (translations as { locale: string; name: string }[]).find((t) => t.locale === "fr")?.name ?? null;

    // Create category
    const { data: category, error: catError } = await auth.supabase
      .from("product_categories")
      .insert({
        team_id: teamId,
        slug,
        name: frName,
        parent_id: parent_id ?? null,
        is_active: is_active ?? true,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (catError) {
      return NextResponse.json({ error: catError.message }, { status: 400 });
    }

    // Insert translations
    const translationRows = translations.map((t: { locale: string; name: string; description?: string }) => ({
      category_id: category.id,
      locale: t.locale,
      name: t.name,
      description: t.description ?? null,
    }));

    const { error: transError } = await auth.supabase
      .from("product_category_translations")
      .insert(translationRows);

    if (transError) {
      await auth.supabase.from("product_categories").delete().eq("id", category.id);
      return NextResponse.json({ error: transError.message }, { status: 400 });
    }

    return NextResponse.json({ data: category }, { status: 201 });
  });
}
