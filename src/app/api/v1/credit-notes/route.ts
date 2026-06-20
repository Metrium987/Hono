import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type ItemInput = { description?: string; quantity?: string | number; unit_price_ht?: string | number; tax_rate_id?: string | null; product_id?: string | null; sort_order?: number };

// GET /api/v1/credit-notes — List credit notes for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "invoices", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const status = params.get("status");
    const invoiceId = params.get("invoice_id");

    let query = auth.supabase
      .from("credit_notes")
      .select(`
        *,
        customer:customer_id(id, company_name, contact_name, n_tahiti),
        invoice:invoice_id(id, invoice_number),
        currency:currency_id(code, symbol, symbol_position)
      `, { count: "exact" })
      .eq("team_id", teamId);

    if (status) query = query.eq("status", status);
    if (invoiceId) query = query.eq("invoice_id", invoiceId);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// POST /api/v1/credit-notes — Create a credit note with items
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const {
      customer_id, invoice_id, issue_date, reason,
      currency_id, items,
    } = body;

    if (!customer_id || !currency_id) {
      return NextResponse.json({
        error: "customer_id and currency_id are required",
      }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        error: "At least one credit note item is required",
      }, { status: 400 });
    }

    // Calculate totals
    let subtotal_ht = 0;
    let tax_amount = 0;

    for (const item of items) {
      const qty = parseFloat(item.quantity) || 1;
      const unitPrice = parseFloat(item.unit_price_ht) || 0;
      subtotal_ht += qty * unitPrice;

      if (item.tax_rate_id) {
        const { data: taxRate } = await auth.supabase
          .from("tax_rates")
          .select("rate")
          .eq("id", item.tax_rate_id)
          .single();

        if (taxRate) {
          tax_amount += (qty * unitPrice) * (taxRate.rate / 100);
        }
      }
    }

    const total_ttc = subtotal_ht + tax_amount;

    // Generate credit note number using sequential pattern via atomic database function
    const { data: creditNoteNumber, error: numError } = await auth.supabase
      .rpc("generate_next_credit_note_number", { p_team_id: teamId });

    if (numError || !creditNoteNumber) {
      return NextResponse.json({ error: "Failed to generate credit note number" }, { status: 500 });
    }

    // Create credit note
    const { data: creditNote, error: cnError } = await auth.supabase
      .from("credit_notes")
      .insert({
        team_id: teamId,
        customer_id,
        invoice_id: invoice_id ?? null,
        credit_note_number: creditNoteNumber,
        status: "draft",
        issue_date: issue_date ?? new Date().toISOString().split("T")[0],
        reason: reason ?? null,
        subtotal_ht: Math.round(subtotal_ht * 100) / 100,
        tax_amount: Math.round(tax_amount * 100) / 100,
        total_ttc: Math.round(total_ttc * 100) / 100,
        currency_id,
      })
      .select()
      .single();

    if (cnError) {
      return NextResponse.json({ error: cnError.message }, { status: 400 });
    }

    // Create credit note items
    const itemRows = items.map((item: ItemInput, idx: number) => {
      const qty = parseFloat(item.quantity as string) || 1;
      const unitPrice = parseFloat(item.unit_price_ht as string) || 0;
      const lineTotal = qty * unitPrice;
      return {
        credit_note_id: creditNote.id,
        product_id: item.product_id ?? null,
        description: item.description ?? "",
        quantity: qty,
        unit_price_ht: Math.round(unitPrice * 100) / 100,
        tax_rate_id: item.tax_rate_id ?? null,
        line_total_ht: Math.round(lineTotal * 100) / 100,
      };
    });

    const { error: itemsError } = await auth.supabase
      .from("credit_note_items")
      .insert(itemRows);

    if (itemsError) {
      await auth.supabase.from("credit_notes").delete().eq("id", creditNote.id);
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    return NextResponse.json({
      data: { ...creditNote, items: itemRows },
    }, { status: 201 });
  });
}
