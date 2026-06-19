import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { pdf } from "@react-pdf/renderer";
import { InvoicePdfDocument, type InvoicePdfData } from "@/lib/pdf/invoice-pdf";

// GET /api/v1/invoices/[id]/pdf — Download invoice as PDF
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");
    const { id } = await params;

    // Fetch invoice with all related data
    const { data: invoice, error: invError } = await auth.supabase
      .from("invoices")
      .select(`
        *,
        team:team_id!inner(
          name, email, phone,
          address_line1, address_line2, city, island, postal_code,
          n_tahiti, rcs_number, is_franchise_en_base, logo_url,
          invoice_prefix, late_fee_fixed,
          bank_name, bank_rib, bank_iban, bank_bic
        ),
        customer:customer_id(
          company_name, contact_name, email, phone,
          address_line1, address_line2, city, island, postal_code,
          n_tahiti, is_b2b
        ),
        items:invoice_items(
          id, description, quantity, unit_price_ht, line_total_ht, tax_rate_id,
          tax_rates:tax_rate_id(name, rate)
        ),
        currency:currency_id(code, symbol, symbol_position)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (invError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Type assertion after validation
    const pdfData: InvoicePdfData = invoice as unknown as InvoicePdfData;

    // Validate required relationships loaded
    if (!pdfData.team || !pdfData.customer || !pdfData.currency) {
      return NextResponse.json(
        { error: "Invoice data is incomplete — missing team, customer, or currency" },
        { status: 500 }
      );
    }

    try {
      // Render PDF to a stream
      const pdfStream = await pdf(
        <InvoicePdfDocument data={pdfData} />
      ).toBlob();

      const filename = `facture-${pdfData.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

      return new NextResponse(pdfStream, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfStream.size.toString(),
        },
      });
    } catch (renderError) {
      console.error("PDF generation error:", renderError);
      return NextResponse.json(
        { error: "Failed to generate PDF" },
        { status: 500 }
      );
    }
  });
}
