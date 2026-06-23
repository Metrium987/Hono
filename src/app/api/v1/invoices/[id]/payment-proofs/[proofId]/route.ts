import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// PATCH /api/v1/invoices/[id]/payment-proofs/[proofId] — Verify or reject a proof
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proofId: string }> }
) {
  const { id, proofId } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");

    const body = await request.json().catch(() => ({}));
    const { status } = body as { status?: string };

    if (status !== "verified" && status !== "rejected") {
      return NextResponse.json({ error: "status doit être 'verified' ou 'rejected'" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("payment_proofs")
      .update({
        status,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", proofId)
      .eq("invoice_id", id)
      .eq("team_id", teamId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, status });
  });
}
