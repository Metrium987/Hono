import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "governance", "write");
    const body = await request.json();
    const { alert_type, bucket_id } = body;

    if (!alert_type) return NextResponse.json({ error: "alert_type is required" }, { status: 400 });
    if (!bucket_id) return NextResponse.json({ error: "bucket_id is required" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("notification_routing_rules")
      .upsert({ team_id: teamId, alert_type, bucket_id, is_active: true }, { onConflict: "team_id, alert_type" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
