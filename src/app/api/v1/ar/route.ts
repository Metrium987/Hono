import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "finance", "read");
    const status = params.get("status");
    const customerId = params.get("customer_id");

    let query = auth.supabase
      .from("account_receivables")
      .select("*, customer:customer_id(id, name), invoice:invoice_id(id, number)")
      .eq("team_id", teamId)
      .order("due_date", { ascending: true });

    if (status) query = query.eq("status", status);
    if (customerId) query = query.eq("customer_id", customerId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "write");
    const body = await request.json();
    const { customer_id, invoice_id, total_amount, due_date, notes } = body;

    if (!customer_id) return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    if (!total_amount || total_amount <= 0) return NextResponse.json({ error: "total_amount must be positive" }, { status: 400 });
    if (!due_date) return NextResponse.json({ error: "due_date is required" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("account_receivables")
      .insert({
        team_id: teamId,
        customer_id,
        invoice_id: invoice_id ?? null,
        total_amount,
        paid_amount: 0,
        balance: total_amount,
        due_date,
        notes: notes?.trim() ?? null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
