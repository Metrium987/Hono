import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { pdf } from "@react-pdf/renderer";
import { CreditNotePdfDocument, type CreditNotePdfData } from "@/lib/pdf/credit-note-pdf";

export const maxDuration = 60;

// GET /api/v1/credit-notes/[id]/pdf
// Proxies to Supabase Edge Function when SUPABASE_FUNCTIONS_URL is configured.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "credit_notes", "read");
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

    const pdfData: CreditNotePdfData = cn as CreditNotePdfData;

    if (!pdfData.team || !pdfData.customer || !pdfData.currency) {
      return NextResponse.json({ error: "Credit note data is incomplete" }, { status: 500 });
    }

    const filename = `avoir-${pdfData.credit_note_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (functionsUrl && serviceKey) {
      try {
        const efRes = await fetch(`${functionsUrl}/generate-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ type: "credit_note", data: pdfData }),
        });
        if (efRes.ok && efRes.body) {
          return new NextResponse(efRes.body, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        }
      } catch (proxyErr) {
        console.warn("[credit-note/pdf] Edge Function unavailable, falling back to local:", proxyErr);
      }
    }

    try {
      const pdfBlob = await pdf(<CreditNotePdfDocument data={pdfData} />).toBlob();
      return new NextResponse(pdfBlob, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfBlob.size.toString(),
        },
      });
    } catch (renderError) {
      console.error("[credit-note/pdf] Local render error:", renderError);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  });
}
