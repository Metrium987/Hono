import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "write");
    const body = await request.json();
    const { amount, due_date, notes } = body;

    if (!amount || amount <= 0) return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
    if (!due_date) return NextResponse.json({ error: "due_date is required" }, { status: 400 });

    const { data: ar } = await auth.supabase
      .from("account_receivables")
      .select("id")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!ar) return NextResponse.json({ error: "Receivable not found" }, { status: 404 });

    const { count } = await auth.supabase
      .from("ar_installments")
      .select("id", { count: "exact", head: true })
      .eq("receivable_id", id);

    const { data, error } = await auth.supabase
      .from("ar_installments")
      .insert({
        team_id: teamId,
        receivable_id: id,
        installment_number: (count ?? 0) + 1,
        amount,
        due_date,
        notes: notes?.trim() ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
