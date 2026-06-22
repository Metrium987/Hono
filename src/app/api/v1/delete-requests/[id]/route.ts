import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

// PATCH /api/v1/delete-requests/[id] — Approuver ou rejeter (owner/admin)
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();
    const { status, review_notes } = body;

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "status doit être 'approved' ou 'rejected'" }, { status: 400 });
    }

    const { data: req, error: fetchErr } = await auth.supabase
      .from("delete_requests")
      .select("id, team_id, table_name, record_id, requested_by, reason, status, review_notes, reviewed_by, reviewed_at, created_at, updated_at")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (fetchErr || !req) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    if (req.status !== "pending") return NextResponse.json({ error: "Déjà traitée" }, { status: 409 });

    // Si approuvé : soft-delete (deleted_at) sur les tables qui le supportent
    if (status === "approved") {
      const SOFT_DELETE_TABLES = ["invoices", "quotes", "orders"];
      if (SOFT_DELETE_TABLES.includes(req.table_name)) {
        await auth.supabase
          .from(req.table_name)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", req.record_id)
          .eq("team_id", teamId);
      }
    }

    const { data, error } = await auth.supabase
      .from("delete_requests")
      .update({
        status,
        review_notes: review_notes ?? null,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  });
}
