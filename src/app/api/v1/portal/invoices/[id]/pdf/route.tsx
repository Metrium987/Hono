import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getPortalSession } from "@/lib/portal/session";
import { pdf } from "@react-pdf/renderer";
import { InvoicePdfDocument, type InvoicePdfData } from "@/lib/pdf/invoice-pdf";

export const maxDuration = 60;

type Params = Promise<{ id: string }>;

// GET /api/v1/portal/invoices/[id]/pdf — Download invoice PDF from portal
export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select(`
      *,
      team:team_id!inner(
        name, email, phone,
        address_line1, address_line2, city, island, postal_code,          n_tahiti, dicp_id, rcs_number, is_franchise_en_base, logo_url,
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
    .eq("customer_id", session.customerId)
    .is("deleted_at", null)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const pdfData = invoice as unknown as InvoicePdfData;

  if (!pdfData.team || !pdfData.customer || !pdfData.currency) {
    return NextResponse.json(
      { error: "Invoice data is incomplete" },
      { status: 500 }
    );
  }

  const filename = `facture-${pdfData.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

  try {
    const pdfBlob = await pdf(<InvoicePdfDocument data={pdfData} />).toBlob();

    // Record portal view event + update viewed_at (non-blocking)
    try {
      await supabase.from("invoices").update({
        viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", id);

      await supabase.from("invoice_events").insert({
        invoice_id: id,
        event_type: "pdf_downloaded",
        payload: { source: "portal" },
      });
    } catch (logErr) {
      console.error("[portal/pdf] Failed to record download event:", logErr);
    }

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBlob.size.toString(),
      },
    });
  } catch (renderError) {
    console.error("[portal/pdf] Render error:", renderError);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
