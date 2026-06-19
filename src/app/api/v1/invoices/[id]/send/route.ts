import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { sendInvoiceEmail } from "@/lib/email/send-invoice";

// POST /api/v1/invoices/[id]/send — Send invoice email via Resend
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    // Fetch invoice with related data
    const { data: invoice, error: invError } = await auth.supabase
      .from("invoices")
      .select(`
        *,
        team:team_id!inner(name, email, phone, address_line1, city, logo_url),
        customer:customer_id(contact_name, company_name, email, phone),
        items:invoice_items(description, quantity, unit_price_ht, line_total_ht),
        currency:currency_id(code, symbol, symbol_position)
      `)
      .eq("id", id)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.customer?.email) {
      return NextResponse.json({
        error: "Customer does not have an email address",
      }, { status: 400 });
    }

    // Build email data
    const customerName = invoice.customer.company_name || invoice.customer.contact_name;
    const emailData = {
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      issueDate: new Date(invoice.issue_date).toLocaleDateString("fr-FR"),
      dueDate: new Date(invoice.due_date).toLocaleDateString("fr-FR"),
      serviceDate: invoice.service_date
        ? new Date(invoice.service_date).toLocaleDateString("fr-FR")
        : null,
      totalTtc: parseFloat(invoice.total_ttc),
      subtotalHt: parseFloat(invoice.subtotal_ht),
      taxAmount: parseFloat(invoice.tax_amount),
      currency: invoice.currency?.symbol || invoice.currency?.code || "XPF",
      teamName: invoice.team.name,
      teamEmail: invoice.team.email,
      teamPhone: invoice.team.phone,
      teamAddress: [invoice.team.address_line1, invoice.team.city]
        .filter(Boolean)
        .join(", "),
      teamLogo: invoice.team.logo_url,
      customerName,
      customerEmail: invoice.customer.email,
      items: invoice.items.map((item: Record<string, unknown>) => ({
        description: item.description as string,
        quantity: parseFloat(item.quantity as string),
        unitPrice: parseFloat(item.unit_price_ht as string),
        lineTotal: parseFloat(item.line_total_ht as string),
      })),
    };

    // Send the email
    const result = await sendInvoiceEmail(auth.supabase, {
      teamId,
      invoiceId: id,
      invoiceNumber: invoice.invoice_number,
      toEmail: invoice.customer.email,
      teamName: invoice.team.name,
      emailData,
    });

    if (!result.success) {
      return NextResponse.json({
        error: result.error || "Failed to send email",
      }, { status: 500 });
    }

    // Update invoice reminder_sent_at
    await auth.supabase
      .from("invoices")
      .update({ reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);

    // Record invoice event
    await auth.supabase.from("invoice_events").insert({
      invoice_id: id,
      event_type: "email_sent",
      payload: { to: invoice.customer.email, message_id: result.messageId },
      created_by: auth.userId,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      to: invoice.customer.email,
    });
  });
}
