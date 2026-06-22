import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "integrations", "read");
    const source = params.get("source");
    const level = params.get("level");
    const isResolved = params.get("is_resolved");

    let query = auth.supabase
      .from("integration_logs")
      .select("id, source, level, message, details, is_resolved, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (source) query = query.eq("source", source);
    if (level) query = query.eq("level", level);
    if (isResolved !== null) query = query.eq("is_resolved", isResolved !== "false");

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}
