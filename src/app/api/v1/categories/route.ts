import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

const TranslationSchema = z.object({
  locale: z.string().min(2).max(5),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});
const CreateCategorySchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  parent_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  translations: z.array(TranslationSchema).min(1),
});

// GET /api/v1/categories â€” List categories for a team
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

// POST /api/v1/categories â€” Create a category with translations
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const parsed = CreateCategorySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { slug, parent_id, is_active, sort_order, translations } = parsed.data;

    const frName = translations.find((t) => t.locale === "fr")?.name ?? null;

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
    const translationRows = translations.map((t) => ({
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

