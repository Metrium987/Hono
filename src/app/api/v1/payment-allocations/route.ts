import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "finance", "read");
    const paymentId = params.get("payment_id");
    const receivableId = params.get("receivable_id");

    let query = auth.supabase
      .from("payment_allocations")
      .select("*, payment:payment_id(id, amount, payment_method), receivable:receivable_id(id, balance, customer_id)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (paymentId) query = query.eq("payment_id", paymentId);
    if (receivableId) query = query.eq("receivable_id", receivableId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "write");
    const body = await request.json();
    const { payment_id, receivable_id, amount } = body;

    if (!payment_id) return NextResponse.json({ error: "payment_id is required" }, { status: 400 });
    if (!receivable_id) return NextResponse.json({ error: "receivable_id is required" }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: "amount must be positive" }, { status: 400 });

    const [paymentRes, arRes] = await Promise.all([
      auth.supabase.from("invoice_payments").select("id").eq("id", payment_id).eq("team_id", teamId).single(),
      auth.supabase.from("account_receivables").select("id, balance").eq("id", receivable_id).eq("team_id", teamId).single(),
    ]);

    if (!paymentRes.data) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    if (!arRes.data) return NextResponse.json({ error: "Receivable not found" }, { status: 404 });
    if (amount > arRes.data.balance) {
      return NextResponse.json({ error: `Amount ${amount} exceeds receivable balance ${arRes.data.balance}` }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("payment_allocations")
      .insert({ team_id: teamId, payment_id, receivable_id, amount })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const newBalance = Number(arRes.data.balance) - amount;
    const newStatus = newBalance <= 0 ? "settled" : "partial";
    await auth.supabase
      .from("account_receivables")
      .update({ balance: Math.max(0, newBalance), paid_amount: Number(arRes.data.balance) - newBalance, status: newStatus })
      .eq("id", receivable_id);

    return NextResponse.json({ data }, { status: 201 });
  });
}
