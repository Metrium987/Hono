import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "governance", "read");

    const { data, error } = await auth.supabase
      .from("approvals")
      .select("*, requested_by_user:requested_by(id, full_name), resolved_by_user:resolved_by(id, full_name), signatures(*)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data });
  });
}
