import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/invoices/[id]/payments — List payments for an invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");
    const { data, error } = await auth.supabase
      .from("invoice_payments")
      .select(`
        *,
        payment_method:payment_method_id(name, display_name)
      `)
      .eq("invoice_id", id)
      .order("payment_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// POST /api/v1/invoices/[id]/payments — Record a payment on an invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const { amount, currency_id, payment_method_id, reference, payment_date, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
    }
    if (!currency_id) {
      return NextResponse.json({ error: "currency_id is required" }, { status: 400 });
    }
    if (!payment_method_id) {
      return NextResponse.json({ error: "payment_method_id is required" }, { status: 400 });
    }

    // Verify invoice exists and belongs to team
    const { data: invoice, error: invError } = await auth.supabase
      .from("invoices")
      .select("id, total_ttc, paid_amount, status, team_id")
      .eq("id", id)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "cancelled" || invoice.status === "refunded") {
      return NextResponse.json({
        error: `Cannot record payment on a ${invoice.status} invoice`,
      }, { status: 409 });
    }

    // Create payment
    const { data: payment, error: payError } = await auth.supabase
      .from("invoice_payments")
      .insert({
        invoice_id: id,
        amount: Math.round(parseFloat(amount) * 100) / 100,
        currency_id,
        payment_method_id,
        reference: reference ?? null,
        payment_date: payment_date ?? new Date().toISOString().split("T")[0],
        notes: notes ?? null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (payError) {
      return NextResponse.json({ error: payError.message }, { status: 400 });
    }

    // The auto-status trigger handles updating invoice status
    // Record event
    await auth.supabase.from("invoice_events").insert({
      invoice_id: id,
      event_type: "payment_recorded",
      payload: { payment_id: payment.id, amount: payment.amount },
      created_by: auth.userId,
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  });
}
