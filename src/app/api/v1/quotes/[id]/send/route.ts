import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { render } from "@react-email/components";
import React from "react";
import { QuoteEmail, type QuoteEmailData } from "@/lib/email/quote-email";
import { resend, DEFAULT_FROM as FROM } from "@/lib/email/resend";

type QuoteItem = { description?: string; quantity?: string | number; unit_price_ht?: string | number; line_total_ht?: string | number };

// POST /api/v1/quotes/[id]/send — Send quote by email and mark as "sent"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "quotes", "write");

    const { data: quote, error: quoteError } = await auth.supabase
      .from("quotes")
      .select(`
        *,
        team:team_id!inner(name, email, phone, address_line1, city, logo_url),
        customer:customer_id(contact_name, company_name, email),
        items:quote_items(description, quantity, unit_price_ht, line_total_ht),
        currency:currency_id(code, symbol, symbol_position)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const customer = Array.isArray(quote.customer) ? quote.customer[0] : quote.customer as { contact_name?: string; company_name?: string; email?: string } | null;

    if (!customer?.email) {
      return NextResponse.json({ error: "Customer does not have an email address" }, { status: 400 });
    }

    if (["accepted", "converted", "cancelled"].includes(quote.status)) {
      return NextResponse.json({ error: `Cannot send a ${quote.status} quote` }, { status: 409 });
    }

    const customerName = customer.company_name || customer.contact_name || "";
    const currency = quote.currency?.symbol || quote.currency?.code || "F";
    const team = Array.isArray(quote.team) ? quote.team[0] : quote.team as { name: string; email?: string; phone?: string; address_line1?: string; city?: string; logo_url?: string } | null;

    const emailData: QuoteEmailData = {
      quoteNumber: quote.quote_number,
      issueDate: new Date(quote.issue_date).toLocaleDateString("fr-FR"),
      validityDate: new Date(quote.validity_date).toLocaleDateString("fr-FR"),
      totalTtc: parseFloat(String(quote.total_ttc || 0)),
      subtotalHt: parseFloat(String(quote.subtotal_ht || 0)),
      taxAmount: parseFloat(String(quote.tax_amount || 0)),
      currency,
      teamName: team?.name ?? "",
      teamEmail: team?.email ?? null,
      teamPhone: team?.phone ?? null,
      teamAddress: [team?.address_line1, team?.city].filter(Boolean).join(", ") || null,
      teamLogo: team?.logo_url ?? null,
      customerName,
      notes: quote.notes ?? null,
      items: (quote.items ?? []).map((item: QuoteItem) => ({
        description: String(item.description ?? ""),
        quantity: parseFloat(String(item.quantity ?? 1)),
        unitPrice: parseFloat(String(item.unit_price_ht ?? 0)),
        lineTotal: parseFloat(String(item.line_total_ht ?? 0)),
      })),
    };

    const html = await render(React.createElement(QuoteEmail, { data: emailData }));

    let emailSent = false;
    let messageId: string | undefined;

    if (resend) {
      const { data: sendData, error: sendErr } = await resend.emails.send({
        from: `${team?.name ?? "Hono"} <${FROM}>`,
        to: [customer.email],
        subject: `Devis ${quote.quote_number} — ${team?.name ?? ""}`,
        html,
      });
      if (!sendErr) {
        emailSent = true;
        messageId = sendData?.id;
      } else {
        return NextResponse.json({ error: sendErr.message }, { status: 500 });
      }
    } else {
      console.warn(`[quote/send] Dev mode — email not sent (no RESEND_API_KEY). Would send to ${customer.email}`);
      emailSent = true;
    }

    // Mark quote as "sent" + record sent_at
    await auth.supabase
      .from("quotes")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("team_id", teamId);

    // Log in email_outbox for traceability
    await auth.supabase.from("email_outbox").insert({
      team_id: teamId,
      kind: "quote_sent",
      to_email: customer.email,
      subject: `Devis ${quote.quote_number} — ${team?.name ?? ""}`,
      related_type: "quote",
      related_id: id,
      status: emailSent ? "sent" : "failed",
      message_id: messageId ?? null,
      sent_at: emailSent ? new Date().toISOString() : null,
      last_attempted_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, emailSent, messageId, to: customer.email });
  });
}
