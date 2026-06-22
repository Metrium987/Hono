import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

type ItemInput = { description?: string; quantity?: string | number; unit_price_ht?: string | number; tax_rate_id?: string | null; product_id?: string | null; group_id?: string | null; sort_order?: number };

const InvoiceItemSchema = z.object({
  description: z.string().max(1000).optional(),
  quantity: z.union([z.string(), z.number()]),
  unit_price_ht: z.union([z.string(), z.number()]),
  tax_rate_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().optional(),
});

const CreateInvoiceSchema = z.object({
  customer_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency_id: z.string().uuid(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  late_fee_fixed: z.number().min(0).optional().nullable(),
  legal_vat_mention: z.string().max(500).optional().nullable(),
  legal_mentions: z.string().max(2000).optional().nullable(),
  discount_type: z.enum(["percentage", "fixed"]).optional().nullable(),
  discount_value: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  items: z.array(InvoiceItemSchema).min(1),
});

// GET /api/v1/invoices — List invoices for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "invoices", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const status = params.get("status");
    const customerId = params.get("customer_id");
    const rawSearch = params.get("search");
    // Sanitiser les caractères spéciaux PostgREST (virgule, parenthèses, guillemets)
    const search = rawSearch ? rawSearch.replace(/[,()'"]/g, "").trim() : null;

    let query = auth.supabase
      .from("invoices")
      .select(`
        id, invoice_number, status, issue_date, due_date, subtotal_ht, tax_amount, total_ttc, paid_amount, discount_type, discount_value, created_at,
        customer:customer_id(id, company_name, contact_name, n_tahiti),
        currency:currency_id(code, symbol, symbol_position)
      `, { count: "exact" })
      .eq("team_id", teamId)
      .is("deleted_at", null);

    if (status) query = query.eq("status", status);
    if (customerId) query = query.eq("customer_id", customerId);
    if (search) {
      query = query.or(
        `invoice_number.ilike.%${search}%,notes.ilike.%${search}%`
      );
    }

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

// POST /api/v1/invoices — Create an invoice with items
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const rawBody = await request.json();
    const parsed = CreateInvoiceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    const {
      customer_id, issue_date, service_date, due_date,
      currency_id, late_fee_fixed, legal_vat_mention, legal_mentions,
      discount_type, discount_value,
      notes, message, items,
    } = parsed.data;

    // Calculate totals with discount applied proportionally
    // For PF compliance: discount is distributed proportionally across line items
    let subtotal_ht = 0;
    let tax_amount = 0;
    const itemLineTotals: { lineTotal: number; taxRateId: string | null; taxRateValue: number }[] = [];

    // Fetch tax rates in batch
    const taxRateIds = [...new Set(items.filter((i: ItemInput) => i.tax_rate_id).map((i: ItemInput) => i.tax_rate_id))];
    const taxRateMap = new Map<string, number>();
    if (taxRateIds.length > 0) {
      const { data: rates } = await auth.supabase
        .from("tax_rates")
        .select("id, rate")
        .in("id", taxRateIds);
      if (rates) {
        for (const r of rates) {
          taxRateMap.set(r.id, r.rate);
        }
      }
    }

    for (const item of items) {
      const qty = parseFloat(String(item.quantity)) || 1;
      const unitPrice = parseFloat(String(item.unit_price_ht)) || 0;
      const lineTotal = qty * unitPrice;
      subtotal_ht += lineTotal;
      itemLineTotals.push({
        lineTotal,
        taxRateId: item.tax_rate_id ?? null,
        taxRateValue: item.tax_rate_id ? (taxRateMap.get(item.tax_rate_id) ?? 0) : 0,
      });
    }

    // Apply discount proportionally
    let discountAmount = 0;
    if (discount_type === "percentage" && discount_value) {
      discountAmount = subtotal_ht * (parseFloat(String(discount_value)) / 100);
    } else if (discount_type === "fixed" && discount_value) {
      discountAmount = parseFloat(String(discount_value));
    }

    const discountRatio = subtotal_ht > 0 ? (subtotal_ht - discountAmount) / subtotal_ht : 1;

    // Calculate tax on discounted line totals
    for (const lt of itemLineTotals) {
      const discountedLineTotal = lt.lineTotal * discountRatio;
      if (lt.taxRateId && lt.taxRateValue > 0) {
        tax_amount += discountedLineTotal * (lt.taxRateValue / 100);
      }
    }

    const total_ttc = (subtotal_ht - discountAmount) + tax_amount;

    // Generate invoice number
    const { data: numData, error: numError } = await auth.supabase
      .rpc("generate_next_invoice_number", { p_team_id: teamId });

    if (numError || !numData) {
      return NextResponse.json({ error: "Failed to generate invoice number" }, { status: 500 });
    }

    const invoiceNumber = Array.isArray(numData) ? numData[0] : numData;

    // Create invoice
    const { data: invoice, error: invError } = await auth.supabase
      .from("invoices")
      .insert({
        team_id: teamId,
        customer_id,
        invoice_number: invoiceNumber,
        status: "draft",
        issue_date: issue_date ?? new Date().toISOString().split("T")[0],
        service_date: service_date ?? null,
        due_date,
        subtotal_ht: Math.round(subtotal_ht * 100) / 100,
        tax_amount: Math.round(tax_amount * 100) / 100,
        total_ttc: Math.round(total_ttc * 100) / 100,
        currency_id,
        late_fee_fixed: late_fee_fixed ?? null,
        legal_vat_mention: legal_vat_mention ?? null,
        legal_mentions: legal_mentions ?? null,
        discount_type: discount_type ?? null,
        discount_value: discount_value ? parseFloat(String(discount_value)) : null,
        discount_amount: Math.round(discountAmount * 100) / 100,
        notes: notes ?? null,
        message: message ?? null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 400 });
    }

    // Fetch cost prices for products to snapshot on each line (audit-proof)
    const productIds = [...new Set(items.filter((i: ItemInput) => i.product_id).map((i: ItemInput) => i.product_id as string))];
    const costMap = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: prods } = await auth.supabase
        .from("products").select("id, cost_price").in("id", productIds).eq("team_id", teamId);
      for (const p of prods ?? []) {
        if (p.cost_price !== null && p.cost_price !== undefined) costMap.set(p.id, parseFloat(String(p.cost_price)));
      }
    }

    // Create invoice items
    const itemRows = items.map((item: ItemInput, idx: number) => {
      const qty = parseFloat(item.quantity as string) || 1;
      const unitPrice = parseFloat(item.unit_price_ht as string) || 0;
      const lineTotal = qty * unitPrice;
      return {
        invoice_id: invoice.id,
        product_id: item.product_id ?? null,
        group_id: item.group_id ?? null,
        description: item.description ?? "",
        quantity: qty,
        unit_price_ht: Math.round(unitPrice * 100) / 100,
        tax_rate_id: item.tax_rate_id ?? null,
        line_total_ht: Math.round(lineTotal * 100) / 100,
        sort_order: item.sort_order ?? idx,
        cost_price_snapshot: item.product_id ? (costMap.get(item.product_id) ?? null) : null,
      };
    });

    const { error: itemsError } = await auth.supabase
      .from("invoice_items")
      .insert(itemRows);

    if (itemsError) {
      // Soft-delete rollback — hard delete would violate PF 10-year retention mandate
      await auth.supabase
        .from("invoices")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", invoice.id);
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    // Record invoice event
    await auth.supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      event_type: "created",
      payload: { items_count: items.length, total_ttc },
      created_by: auth.userId,
    });

    return NextResponse.json({
      data: {
        ...invoice,
        items: itemRows,
      },
    }, { status: 201 });
  });
}
