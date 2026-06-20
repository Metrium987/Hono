import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

export async function DELETE(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const { error } = await auth.supabase.from("commission_rules").delete().eq("id", id).eq("team_id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
