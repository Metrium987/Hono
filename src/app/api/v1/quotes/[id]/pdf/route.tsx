import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { pdf } from "@react-pdf/renderer";
import { QuotePdfDocument, type QuotePdfData } from "@/lib/pdf/quote-pdf";

export const maxDuration = 60;

// GET /api/v1/quotes/[id]/pdf — Download quote as PDF
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "quotes", "read");
    const { id } = await params;

    const { data: quote, error: qError } = await auth.supabase
      .from("quotes")
      .select(`
        *,
        team:team_id!inner(
          name, email, phone,
          address_line1, address_line2, city, island, postal_code,
          n_tahiti, rcs_number, is_franchise_en_base, logo_url
        ),
        customer:customer_id(
          company_name, contact_name, email, phone,
          address_line1, address_line2, city, island, postal_code,
          is_b2b, n_tahiti
        ),
        items:quote_items(
          id, description, quantity, unit_price_ht, line_total_ht,
          tax_rates:tax_rate_id(name, rate)
        ),
        currency:currency_id(code, symbol, symbol_position),
        converted_invoice:converted_to_invoice_id(id, invoice_number)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (qError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const pdfData: QuotePdfData = quote as QuotePdfData;

    if (!pdfData.team || !pdfData.customer || !pdfData.currency) {
      return NextResponse.json(
        { error: "Quote data is incomplete" },
        { status: 500 }
      );
    }

    try {
      const pdfStream = await pdf(<QuotePdfDocument data={pdfData} />).toBlob();
      const filename = `devis-${pdfData.quote_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

      return new NextResponse(pdfStream, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfStream.size.toString(),
        },
      });
    } catch (renderError) {
      console.error("Quote PDF generation error:", renderError);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  });
}
