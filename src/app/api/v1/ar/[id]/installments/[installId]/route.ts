import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; installId: string }> }) {
  const { id, installId } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "write");
    const body = await request.json();
    const { paid_amount } = body;

    const { data: installment } = await auth.supabase
      .from("ar_installments")
      .select("id, amount, receivable_id")
      .eq("id", installId)
      .eq("team_id", teamId)
      .single();

    if (!installment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const actualPaid = paid_amount ?? installment.amount;
    const isFullyPaid = actualPaid >= installment.amount;

    const { data, error } = await auth.supabase
      .from("ar_installments")
      .update({
        paid_amount: actualPaid,
        status: isFullyPaid ? "paid" : "partial",
        paid_at: isFullyPaid ? new Date().toISOString() : null,
      })
      .eq("id", installId)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: allInstallments } = await auth.supabase
      .from("ar_installments")
      .select("paid_amount, amount")
      .eq("receivable_id", installment.receivable_id)
      .eq("team_id", teamId);

    if (allInstallments) {
      const totalPaid = allInstallments.reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0);
      const { data: ar } = await auth.supabase
        .from("account_receivables")
        .select("total_amount")
        .eq("id", installment.receivable_id)
        .single();

      if (ar) {
        const newBalance = Number(ar.total_amount) - totalPaid;
        const newStatus = newBalance <= 0 ? "settled" : totalPaid > 0 ? "partial" : "pending";
        await auth.supabase
          .from("account_receivables")
          .update({ paid_amount: totalPaid, balance: Math.max(0, newBalance), status: newStatus })
          .eq("id", installment.receivable_id);
      }
    }

    return NextResponse.json({ data });
  });
}
