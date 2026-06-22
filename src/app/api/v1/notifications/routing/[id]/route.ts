import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "governance", "write");
    const body = await request.json();

    if (body.is_active === undefined) {
      return NextResponse.json({ error: "is_active is required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("notification_routing_rules")
      .update({ is_active: body.is_active })
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data });
  });
}
