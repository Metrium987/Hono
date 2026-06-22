import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "governance", "read");

    const table = params.get("table_name");
    const action = params.get("action");
    const limit = Math.min(parseInt(params.get("limit") ?? "100"), 500);
    const offset = parseInt(params.get("offset") ?? "0");

    let query = auth.supabase
      .from("audit_logs")
      .select("id, action, table_name, record_id, ip_address, created_at, user:user_id(id, full_name)", { count: "exact" })
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (table) query = query.eq("table_name", table);
    if (action) query = query.eq("action", action);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data, count });
  });
}
