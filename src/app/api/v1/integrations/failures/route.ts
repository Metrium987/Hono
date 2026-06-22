import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "integrations", "read");
    const isResolved = params.get("is_resolved");

    let query = auth.supabase
      .from("integration_failures")
      .select("id, source, action, error_message, is_resolved, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (isResolved !== null) {
      query = query.eq("is_resolved", isResolved !== "false");
    } else {
      query = query.eq("is_resolved", false);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}
