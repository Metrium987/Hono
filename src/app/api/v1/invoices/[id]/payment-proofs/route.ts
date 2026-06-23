import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/invoices/[id]/payment-proofs — List client-submitted payment proofs for an invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");

    const { data, error } = await auth.supabase
      .from("payment_proofs")
      .select("id, payment_date, amount, reference, notes, status, created_at")
      .eq("invoice_id", id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data: data ?? [] });
  });
}
