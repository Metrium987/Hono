import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/expenses — List expenses for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "expenses", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const categoryId = params.get("category_id");
    const vendorId = params.get("vendor_id");
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");

    let query = auth.supabase
      .from("expenses")
      .select(`
        *,
        category:category_id(id, name),
        vendor:vendor_id(id, name),
        currency:currency_id(code, symbol)
      `, { count: "exact" })
      .eq("team_id", teamId);

    if (categoryId) query = query.eq("category_id", categoryId);
    if (vendorId) query = query.eq("vendor_id", vendorId);
    if (dateFrom) query = query.gte("expense_date", dateFrom);
    if (dateTo) query = query.lte("expense_date", dateTo);

    const { data, error, count } = await query
      .order("expense_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// POST /api/v1/expenses — Create an expense
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "expenses", "write");
    const body = await request.json();
    const { category_id, vendor_id, vendor_name, description, amount, currency_id, expense_date, receipt_url, notes } = body;

    if (!description || amount === undefined || !currency_id || !expense_date) {
      return NextResponse.json({ error: "description, amount, currency_id, and expense_date are required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("expenses")
      .insert({
        team_id: teamId,
        category_id: category_id ?? null,
        vendor_id: vendor_id ?? null,
        vendor_name: vendor_name ?? null,
        description,
        amount,
        currency_id,
        expense_date,
        receipt_url: receipt_url ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}
