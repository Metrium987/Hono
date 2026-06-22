import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/delete-requests — Liste (admin/owner)
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "read");
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "pending";

    const { data, error } = await auth.supabase
      .from("delete_requests")
      .select("*, requester:requested_by(id), reviewer:reviewed_by(id)")
      .eq("team_id", teamId)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}

// POST /api/v1/delete-requests — Créer une demande de suppression
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    const body = await request.json();
    const { table_name, record_id, reason } = body;

    if (!table_name || !record_id) {
      return NextResponse.json({ error: "table_name et record_id requis" }, { status: 400 });
    }

    const ALLOWED_TABLES = ["customers", "invoices", "quotes", "orders", "products"];
    if (!ALLOWED_TABLES.includes(table_name)) {
      return NextResponse.json({ error: "Table non autorisée" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("delete_requests")
      .insert({
        team_id: teamId,
        requested_by: auth.userId,
        table_name,
        record_id,
        reason: reason ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  });
}
