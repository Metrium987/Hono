import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/crm-requests — List CRM requests (filter: customer_id, status)
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "clients", "read");

    const customerId = params.get("customer_id");
    const status = params.get("status");
    const limit = Math.min(100, parseInt(params.get("limit") ?? "50"));
    const offset = Math.max(0, parseInt(params.get("offset") ?? "0"));

    let query = auth.supabase
      .from("crm_requests")
      .select("*", { count: "exact" })
      .eq("team_id", teamId);

    if (customerId) query = query.eq("customer_id", customerId);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count: count ?? 0 });
  });
}

// POST /api/v1/crm-requests — Create a CRM request
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");

    const body = await request.json();
    const { customer_id, subject, message } = body;

    if (!customer_id || !subject) {
      return NextResponse.json({ error: "customer_id and subject are required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("crm_requests")
      .insert({
        team_id: teamId,
        customer_id,
        subject,
        message: message ?? "",
        status: "open",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}
