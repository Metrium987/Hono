import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string; paymentId: string }>;

// DELETE /api/v1/invoices/[id]/payments/[paymentId] — Void a recorded payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  const { id, paymentId } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");

    // Verify invoice belongs to team
    const { data: invoice } = await auth.supabase
      .from("invoices")
      .select("id")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Soft-delete the payment (financial audit trail — PF 10-year retention)
    const { data: deleted, error } = await auth.supabase
      .from("invoice_payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("invoice_id", id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !deleted) {
      return NextResponse.json({ error: error?.message ?? "Payment not found" }, { status: 404 });
    }

    // The auto-status trigger handles updating invoice paid_amount and status
    // Record event
    await auth.supabase.from("invoice_events").insert({
      invoice_id: id,
      event_type: "payment_deleted",
      payload: { payment_id: paymentId, amount: deleted.amount },
      created_by: auth.userId,
    });

    return NextResponse.json({ success: true });
  });
}
