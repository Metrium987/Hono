import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { pdf } from "@react-pdf/renderer";
import { PaymentReceiptPdfDocument, type PaymentReceiptData } from "@/lib/pdf/payment-receipt-pdf";

// GET /api/v1/payments/[id]/receipt — Download payment receipt PDF
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "payments", "read");
    const { id } = await params;

    // Fetch payment with invoice chain for team verification
    const { data: payment, error: payError } = await auth.supabase
      .from("invoice_payments")
      .select(`
        *,
        payment_method:payment_method_id(name, display_name),
        invoice:invoice_id(
          invoice_number, total_ttc, paid_amount, issue_date, due_date,
          customer_id(id, company_name, contact_name, email, n_tahiti, is_b2b),
          team_id!inner(name, email, n_tahiti, rcs_number, address_line1, city),
          currency:currency_id(symbol)
        )
      `)
      .eq("id", id)
      .single();

    if (payError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Verify the payment belongs to the authenticated user's team
    const invoice = Array.isArray(payment.invoice) ? payment.invoice[0] : payment.invoice;
    const invoiceTeamId = invoice?.team_id;
    if (invoiceTeamId !== teamId) {
      return NextResponse.json({ error: "Payment does not belong to your team" }, { status: 403 });
    }

    const currency = Array.isArray(invoice.currency) ? invoice.currency[0] : invoice.currency;
    const customer = Array.isArray(invoice.customer_id) ? invoice.customer_id[0] : invoice.customer_id;
    const team = Array.isArray(invoice.team_id) ? invoice.team_id[0] : invoice.team_id;
    const pm = Array.isArray(payment.payment_method) ? payment.payment_method[0] : payment.payment_method;

    const pdfData: PaymentReceiptData = {
      payment: {
        id: payment.id,
        amount: parseFloat(payment.amount) || 0,
        payment_date: payment.payment_date,
        reference: payment.reference,
        notes: payment.notes,
        created_at: payment.created_at,
      },
      invoice: {
        invoice_number: invoice.invoice_number,
        total_ttc: parseFloat(invoice.total_ttc) || 0,
        paid_amount: parseFloat(invoice.paid_amount) || 0,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
      },
      customer: {
        company_name: customer?.company_name ?? null,
        contact_name: customer?.contact_name ?? "",
        email: customer?.email ?? null,
        n_tahiti: customer?.n_tahiti ?? null,
        is_b2b: customer?.is_b2b ?? false,
      },
      team: {
        name: team?.name ?? "",
        email: team?.email ?? null,
        n_tahiti: team?.n_tahiti ?? null,
        rcs_number: team?.rcs_number ?? null,
        address_line1: team?.address_line1 ?? null,
        city: team?.city ?? null,
      },
      payment_method: pm ? { name: pm.name, display_name: pm.display_name } : null,
      currency_symbol: currency?.symbol ?? "F",
    };

    try {
      const pdfStream = await pdf(<PaymentReceiptPdfDocument data={pdfData} />).toBlob();
      const filename = `recu-paiement-${payment.id.slice(0, 8)}.pdf`;

      return new NextResponse(pdfStream, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfStream.size.toString(),
        },
      });
    } catch (renderError) {
      console.error("Payment receipt PDF generation error:", renderError);
      return NextResponse.json({ error: "Failed to generate receipt" }, { status: 500 });
    }
  });
}
