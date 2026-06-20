import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type QuoteItem = { product_id?: string | null; description?: string; quantity?: string | number; unit_price_ht?: string | number; tax_rate_id?: string | null; line_total_ht?: string | number; sort_order?: number };

// POST /api/v1/quotes/[id]/convert — Convert a quote to an invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "quotes", "write");
    const body = await request.json();

    // Fetch quote with items
    const { data: quote, error: quoteError } = await auth.supabase
      .from("quotes")
      .select(`*, items:quote_items(*)`)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status === "converted") {
      return NextResponse.json({ error: "Quote already converted to invoice" }, { status: 409 });
    }
    if (quote.status === "rejected" || quote.status === "expired") {
      return NextResponse.json({
        error: `Cannot convert a ${quote.status} quote. Create a new quote instead.`,
      }, { status: 409 });
    }

    // Generate invoice number
    const { data: numData, error: numError } = await auth.supabase
      .rpc("generate_next_invoice_number", { p_team_id: teamId });

    if (numError || !numData) {
      return NextResponse.json({ error: "Failed to generate invoice number" }, { status: 500 });
    }

    const invoiceNumber = Array.isArray(numData) ? numData[0] : numData;

    // Create invoice from quote data
    const { data: invoice, error: invError } = await auth.supabase
      .from("invoices")
      .insert({
        team_id: teamId,
        customer_id: quote.customer_id,
        quote_id: quote.id,
        invoice_number: invoiceNumber,
        status: "draft",
        issue_date: body.issue_date ?? new Date().toISOString().split("T")[0],
        due_date: body.due_date ?? new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        subtotal_ht: quote.subtotal_ht,
        tax_amount: quote.tax_amount,
        total_ttc: quote.total_ttc,
        currency_id: quote.currency_id,
        notes: quote.notes,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 400 });
    }

    // Copy quote items to invoice items
    const itemRows = quote.items.map((item: QuoteItem) => ({
      invoice_id: invoice.id,
      product_id: item.product_id ?? null,
      description: item.description ?? "",
      quantity: item.quantity,
      unit_price_ht: item.unit_price_ht,
      tax_rate_id: item.tax_rate_id ?? null,
      line_total_ht: item.line_total_ht,
      sort_order: item.sort_order ?? 0,
    }));

    const { error: itemsError } = await auth.supabase
      .from("invoice_items")
      .insert(itemRows);

    if (itemsError) {
      await auth.supabase.from("invoices").delete().eq("id", invoice.id);
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    // Mark quote as converted
    await auth.supabase
      .from("quotes")
      .update({
        status: "converted",
        converted_to_invoice_id: invoice.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id)
      .eq("team_id", teamId);

    // Record event
    await auth.supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      event_type: "created",
      payload: { source: "quote_conversion", quote_id: quote.id, quote_number: quote.quote_number },
      created_by: auth.userId,
    });

    return NextResponse.json({
      data: {
        ...invoice,
        items: itemRows,
        source_quote: { id: quote.id, quote_number: quote.quote_number },
      },
    }, { status: 201 });
  });
}
