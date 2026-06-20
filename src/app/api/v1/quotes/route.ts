import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type ItemInput = { description?: string; quantity?: string | number; unit_price_ht?: string | number; tax_rate_id?: string | null; product_id?: string | null; group_id?: string | null; sort_order?: number };

// GET /api/v1/quotes — List quotes for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "quotes", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const status = params.get("status");
    const customerId = params.get("customer_id");

    let query = auth.supabase
      .from("quotes")
      .select(`
        *,
        customer:customer_id(id, company_name, contact_name, n_tahiti),
        currency:currency_id(code, symbol, symbol_position)
      `, { count: "exact" })
      .eq("team_id", teamId);

    if (status) query = query.eq("status", status);
    if (customerId) query = query.eq("customer_id", customerId);

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

// POST /api/v1/quotes — Create a quote with items
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "quotes", "write");
    const body = await request.json();
    const {
      customer_id, issue_date, validity_date,
      currency_id, notes, items,
    } = body;

    if (!customer_id || !currency_id) {
      return NextResponse.json({
        error: "customer_id and currency_id are required",
      }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        error: "At least one quote item is required",
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

    // Generate quote number
    const { data: numData, error: numError } = await auth.supabase
      .rpc("generate_next_quote_number", { p_team_id: teamId });

    if (numError || !numData) {
      return NextResponse.json({ error: "Failed to generate quote number" }, { status: 500 });
    }

    const quoteNumber = Array.isArray(numData) ? numData[0] : numData;

    // Create quote
    const { data: quote, error: quoteError } = await auth.supabase
      .from("quotes")
      .insert({
        team_id: teamId,
        customer_id,
        quote_number: quoteNumber,
        status: "draft",
        issue_date: issue_date ?? new Date().toISOString().split("T")[0],
        validity_date: validity_date ?? null,
        subtotal_ht: Math.round(subtotal_ht * 100) / 100,
        tax_amount: Math.round(tax_amount * 100) / 100,
        total_ttc: Math.round(total_ttc * 100) / 100,
        currency_id,
        notes: notes ?? null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (quoteError) {
      return NextResponse.json({ error: quoteError.message }, { status: 400 });
    }

    // Create quote items
    const itemRows = items.map((item: ItemInput, idx: number) => {
      const qty = parseFloat(item.quantity as string) || 1;
      const unitPrice = parseFloat(item.unit_price_ht as string) || 0;
      const lineTotal = qty * unitPrice;
      return {
        quote_id: quote.id,
        product_id: item.product_id ?? null,
        description: item.description ?? "",
        quantity: qty,
        unit_price_ht: Math.round(unitPrice * 100) / 100,
        tax_rate_id: item.tax_rate_id ?? null,
        line_total_ht: Math.round(lineTotal * 100) / 100,
        sort_order: item.sort_order ?? idx,
      };
    });

    const { error: itemsError } = await auth.supabase
      .from("quote_items")
      .insert(itemRows);

    if (itemsError) {
      await auth.supabase.from("quotes").delete().eq("id", quote.id);
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    return NextResponse.json({
      data: { ...quote, items: itemRows },
    }, { status: 201 });
  });
}
