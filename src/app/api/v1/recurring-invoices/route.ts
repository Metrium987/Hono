import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/recurring-invoices
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");
    const { data, error } = await auth.supabase
      .from("recurring_invoices")
      .select(`
        *,
        customer:customer_id(id, contact_name, company_name),
        currency:currency_id(code, symbol),
        items:recurring_invoice_items(*, tax_rates:tax_rate_id(name, rate))
      `)
      .eq("team_id", teamId)
      .order("next_generation_date", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}

// POST /api/v1/recurring-invoices
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const { customer_id, currency_id, frequency, interval_count, start_date, end_date, payment_terms, notes, prefix, items } = body;

    if (!customer_id || !frequency || !start_date) {
      return NextResponse.json({ error: "customer_id, frequency et start_date sont requis" }, { status: 400 });
    }

    const { data: rec, error } = await auth.supabase
      .from("recurring_invoices")
      .insert({
        team_id: teamId,
        customer_id,
        currency_id: currency_id ?? null,
        frequency,
        interval_count: interval_count ?? 1,
        start_date,
        end_date: end_date ?? null,
        next_generation_date: start_date,
        payment_terms: payment_terms ?? 30,
        notes: notes ?? null,
        prefix: prefix ?? null,
        is_active: true,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (items && Array.isArray(items) && items.length > 0) {
      await auth.supabase.from("recurring_invoice_items").insert(
        items.map((item: { description: string; quantity?: number; unit_price_ht?: number; tax_rate_id?: string; product_id?: string }, idx: number) => ({
          recurring_invoice_id: rec.id,
          description: item.description,
          quantity: item.quantity ?? 1,
          unit_price_ht: item.unit_price_ht ?? 0,
          tax_rate_id: item.tax_rate_id ?? null,
          product_id: item.product_id ?? null,
          position: idx,
        }))
      );
    }

    return NextResponse.json({ data: rec }, { status: 201 });
  });
}
