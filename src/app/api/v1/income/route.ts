import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

const CreateIncomeSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(1000),
  amount: z.number().positive(),
  currency_id: z.string().uuid(),
  income_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customer_id: z.string().uuid().optional().nullable(),
  receipt_url: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

// GET /api/v1/income â€” List income for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "income", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const categoryId = params.get("category_id");
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");

    let query = auth.supabase
      .from("income")
      .select(`
        *,
        category:category_id(id, name),
        currency:currency_id(code, symbol),
        customer:customer_id(id, company_name, contact_name)
      `, { count: "exact" })
      .eq("team_id", teamId);

    if (categoryId) query = query.eq("category_id", categoryId);
    if (dateFrom) query = query.gte("income_date", dateFrom);
    if (dateTo) query = query.lte("income_date", dateTo);

    const { data, error, count } = await query
      .order("income_date", { ascending: false })
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

// POST /api/v1/income â€” Create income
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "income", "write");
    const parsed = CreateIncomeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { category_id, description, amount, currency_id, income_date, customer_id, receipt_url, notes } = parsed.data;

    const { data, error } = await auth.supabase
      .from("income")
      .insert({
        team_id: teamId,
        category_id: category_id ?? null,
        description,
        amount,
        currency_id,
        income_date,
        customer_id: customer_id ?? null,
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

