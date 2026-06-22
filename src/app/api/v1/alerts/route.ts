import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "governance", "read");
    const alertType = params.get("alert_type");
    const severity = params.get("severity");
    const isDismissed = params.get("is_dismissed");

    let query = auth.supabase
      .from("system_alerts")
      .select("id, alert_type, severity, title, message, is_dismissed, dismissed_by, dismissed_at, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (alertType) query = query.eq("alert_type", alertType);
    if (severity) query = query.eq("severity", severity);
    if (isDismissed !== null) {
      query = query.eq("is_dismissed", isDismissed !== "false");
    } else {
      query = query.eq("is_dismissed", false);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}
