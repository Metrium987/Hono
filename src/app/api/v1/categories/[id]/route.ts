import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/categories/[id] — Get single category with translations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "read");
    const { data, error } = await auth.supabase
      .from("product_categories")
      .select(`
        *,
        parent:parent_id(id, slug),
        translations:product_category_translations(*)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
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

// PATCH /api/v1/categories/[id] — Update category and translations
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const { slug, parent_id, is_active, sort_order, translations } = body;

    // Build update payload
    const updatePayload: Record<string, string | number | boolean | null> = {};
    if (slug !== undefined) updatePayload.slug = slug;
    if (parent_id !== undefined) updatePayload.parent_id = parent_id;
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (sort_order !== undefined) updatePayload.sort_order = sort_order;

    // Sync name column from fr translation
    if (translations && Array.isArray(translations)) {
      const frTr = (translations as { locale: string; name: string }[]).find((t) => t.locale === "fr");
      if (frTr?.name !== undefined) updatePayload.name = frTr.name;
    }
    updatePayload.updated_at = new Date().toISOString();

    if (Object.keys(updatePayload).length > 1) {
      const { error: updateError } = await auth.supabase
        .from("product_categories")
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
        const { locale, name, description } = t;
        if (!locale) continue;

        const { error: upsertError } = await auth.supabase
          .from("product_category_translations")
          .upsert({
            category_id: id,
            locale,
            name,
            description: description ?? null,
          }, { onConflict: "category_id, locale" });

        if (upsertError) {
          return NextResponse.json({ error: upsertError.message }, { status: 400 });
        }
      }
    }

    // Fetch updated category
    const { data, error: fetchError } = await auth.supabase
      .from("product_categories")
      .select(`*, translations:product_category_translations(*)`)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/categories/[id] — Delete a category
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const { error } = await auth.supabase
      .from("product_categories")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
