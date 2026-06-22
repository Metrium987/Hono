import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { render } from "@react-email/components";
import React from "react";
import { PaymentConfirmationEmail } from "@/lib/email/payment-confirmation-email";
import { resend, DEFAULT_FROM as FROM } from "@/lib/email/resend";

// GET /api/v1/invoices/[id]/payments — List payments for an invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");
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

    const { data, error } = await auth.supabase
      .from("invoice_payments")
      .select(`
        *,
        payment_method:payment_method_id(name, display_name)
      `)
      .eq("invoice_id", id)
      .is("deleted_at", null)
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
      .select("id, total_ttc, paid_amount, status, team_id, assigned_to")
      .eq("id", id)
      .eq("team_id", teamId)
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

    // Auto-create commission if payment completes the invoice and a commercial is assigned
    const newPaidTotal = parseFloat(String(invoice.paid_amount || 0)) + parseFloat(String(amount));
    const wasAlreadyPaid = ["paid"].includes(invoice.status);
    const isNowPaid = newPaidTotal >= parseFloat(String(invoice.total_ttc));
    if (!wasAlreadyPaid && isNowPaid && invoice.assigned_to) {
      const now = new Date().toISOString();
      const { data: rule } = await auth.supabase
        .from("commission_rules")
        .select("rate")
        .eq("team_id", teamId)
        .eq("user_id", invoice.assigned_to)
        .lte("applies_from", now)
        .or(`applies_to.is.null,applies_to.gte.${now.replace(/[^0-9T:\-.]/g, "")}`)
        .order("applies_from", { ascending: false })
        .limit(1)
        .single();
      if (rule) {
        const commAmount = Math.round(parseFloat(String(invoice.total_ttc)) * rule.rate / 100 * 100) / 100;
        await auth.supabase.from("invoice_commissions").upsert({
          team_id: teamId,
          invoice_id: id,
          user_id: invoice.assigned_to,
          amount: commAmount,
          rate: rule.rate,
          status: "pending",
          created_at: now,
        }, { onConflict: "invoice_id" });
      }
    }

    // Send payment confirmation email if invoice is now fully paid
    if (!wasAlreadyPaid && isNowPaid && resend) {
      try {
        const { data: fullInvoice } = await auth.supabase
          .from("invoices")
          .select("invoice_number, total_ttc, customer:customer_id(contact_name, company_name, email), team:team_id(name, email, phone), currency:currency_id(symbol, code)")
          .eq("id", id)
          .single();

        type CustomerShape = { contact_name?: string; company_name?: string; email?: string };
        type TeamShape = { name?: string; email?: string; phone?: string };
        type CurrencyShape = { symbol?: string; code?: string };
        const rawCustomer: unknown = fullInvoice?.customer;
        const rawTeam: unknown = fullInvoice?.team;
        const rawCurrency: unknown = fullInvoice?.currency;
        const customer = Array.isArray(rawCustomer) ? (rawCustomer[0] as CustomerShape) : (rawCustomer as CustomerShape | null ?? null);
        const team = Array.isArray(rawTeam) ? (rawTeam[0] as TeamShape) : (rawTeam as TeamShape | null ?? null);
        const currency = Array.isArray(rawCurrency) ? (rawCurrency[0] as CurrencyShape) : (rawCurrency as CurrencyShape | null ?? null);

        if (customer?.email && fullInvoice) {
          const html = await render(React.createElement(PaymentConfirmationEmail, {
            data: {
              invoiceNumber: fullInvoice.invoice_number,
              amountPaid: parseFloat(String(amount)),
              paymentDate: payment_date ?? new Date().toLocaleDateString("fr-FR"),
              currency: currency?.symbol ?? currency?.code ?? "F",
              customerName: customer.company_name || customer.contact_name || "",
              teamName: team?.name ?? "",
              teamEmail: team?.email ?? null,
              teamPhone: team?.phone ?? null,
              isFullyPaid: true,
            },
          }));

          await resend.emails.send({
            from: `${team?.name ?? "Hono"} <${FROM}>`,
            to: [customer.email],
            subject: `Paiement reçu — Facture ${fullInvoice.invoice_number} soldée`,
            html,
          });
        }
      } catch {
        // Non-critical — don't fail the payment if email errors
      }
    }

    return NextResponse.json({ data: payment }, { status: 201 });
  });
}
