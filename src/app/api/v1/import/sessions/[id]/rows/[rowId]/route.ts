import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  const { id, rowId } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const { resolved_category_id, resolved_brand_id, resolved_product_id, action, status } = body;

    const updates: Record<string, unknown> = {};
    if (resolved_category_id !== undefined) updates.resolved_category_id = resolved_category_id;
    if (resolved_brand_id !== undefined) updates.resolved_brand_id = resolved_brand_id;
    if (resolved_product_id !== undefined) updates.resolved_product_id = resolved_product_id;
    if (action !== undefined) updates.action = action;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("import_session_rows")
      .update(updates)
      .eq("id", rowId)
      .eq("import_session_id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Row not found" }, { status: 404 });

    return NextResponse.json({ data });
  });
}
