import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { pdf } from "@react-pdf/renderer";
import { InvoicePdfDocument, type InvoicePdfData } from "@/lib/pdf/invoice-pdf";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 60;

/**
 * Record a PDF download event and update viewed_at (non-blocking — fire & forget).
 */
async function recordPdfDownload(supabase: SupabaseClient, invoiceId: string) {
  try {
    await supabase.from("invoices").update({
      viewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", invoiceId);

    await supabase.from("invoice_events").insert({
      invoice_id: invoiceId,
      event_type: "pdf_downloaded",
      payload: { source: "erp" },
    });
  } catch (err) {
    // Non-critical — logging failure shouldn't block PDF delivery
    console.error("[invoice/pdf] Failed to record download event:", err);
  }
}

// GET /api/v1/invoices/[id]/pdf
// Proxy to Supabase Edge Function when SUPABASE_FUNCTIONS_URL is set (avoids Vercel Hobby 10s timeout).
// Falls back to local rendering if the env var is absent or the Edge Function fails.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");
    const { id } = await params;

    const { data: invoice, error: invError } = await auth.supabase
      .from("invoices")
      .select(`
        *,
        team:team_id!inner(
          name, email, phone,
          address_line1, address_line2, city, island, postal_code,
          n_tahiti, dicp_id, rcs_number, is_franchise_en_base, logo_url,
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
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const pdfData: InvoicePdfData = invoice as InvoicePdfData;

    if (!pdfData.team || !pdfData.customer || !pdfData.currency) {
      return NextResponse.json(
        { error: "Invoice data is incomplete — missing team, customer, or currency" },
        { status: 500 }
      );
    }

    const filename = `facture-${pdfData.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
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
          body: JSON.stringify({ type: "invoice", data: pdfData }),
        });
        if (efRes.ok && efRes.body) {
          await recordPdfDownload(auth.supabase, id);
          return new NextResponse(efRes.body, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        }
      } catch (proxyErr) {
        console.warn("[invoice/pdf] Edge Function unavailable, falling back to local:", proxyErr);
      }
    }

    try {
      const pdfBlob = await pdf(<InvoicePdfDocument data={pdfData} />).toBlob();
      await recordPdfDownload(auth.supabase, id);
      return new NextResponse(pdfBlob, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfBlob.size.toString(),
        },
      });
    } catch (renderError) {
      console.error("[invoice/pdf] Local render error:", renderError);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  });
}
