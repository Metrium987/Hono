import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "governance", "write");
    const body = await request.json().catch(() => ({}));

    const { data: approval } = await auth.supabase
      .from("approvals")
      .select("id, status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!approval) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (approval.status !== "pending") {
      return NextResponse.json({ error: "Approval is not pending" }, { status: 400 });
    }

    await auth.supabase.from("signatures").insert({
      team_id: teamId,
      approval_id: id,
      signed_by: auth.userId,
      action: "approved",
    });

    const { data, error } = await auth.supabase
      .from("approvals")
      .update({ status: "approved", resolved_by: auth.userId, resolved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  });
}
