import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId, searchParams) => {
    requirePermission(auth, "catalog", "read");
    const status = searchParams.get("status");

    let query = auth.supabase
      .from("import_session_rows")
      .select("id, row_index, status, action, raw_data, normalized_data, errors, resolved_product_id, resolved_category_id, resolved_brand_id")
      .eq("import_session_id", id)
      .eq("team_id", teamId)
      .order("row_index", { ascending: true });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}
