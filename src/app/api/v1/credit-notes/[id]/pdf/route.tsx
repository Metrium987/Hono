import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { pdf } from "@react-pdf/renderer";
import { CreditNotePdfDocument, type CreditNotePdfData } from "@/lib/pdf/credit-note-pdf";

// GET /api/v1/credit-notes/[id]/pdf — Download credit note as PDF
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(_request, async (auth, teamId) => {
    const { id } = await params;

    const { data: cn, error: cnError } = await auth.supabase
      .from("credit_notes")
      .select(`
        *,
        team:team_id!inner(
          name, email, phone,
          address_line1, address_line2, city, island, postal_code,
          n_tahiti, rcs_number, is_franchise_en_base
        ),
        customer:customer_id(
          company_name, contact_name, email, phone,
          address_line1, address_line2, city, island, postal_code,
          is_b2b, n_tahiti
        ),
        items:credit_note_items(
          id, description, quantity, unit_price_ht, line_total_ht,
          tax_rates:tax_rate_id(name, rate)
        ),
        currency:currency_id(code, symbol, symbol_position),
        invoice:invoice_id(id, invoice_number)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (cnError || !cn) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    const pdfData: CreditNotePdfData = cn as unknown as CreditNotePdfData;

    if (!pdfData.team || !pdfData.customer || !pdfData.currency) {
      return NextResponse.json(
        { error: "Credit note data is incomplete" },
        { status: 500 }
      );
    }

    try {
      const pdfStream = await pdf(<CreditNotePdfDocument data={pdfData} />).toBlob();
      const filename = `avoir-${pdfData.credit_note_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

      return new NextResponse(pdfStream, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfStream.size.toString(),
        },
      });
    } catch (renderError) {
      console.error("Credit note PDF generation error:", renderError);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  });
}
