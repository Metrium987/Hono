import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

const CreateCashClosureSchema = z.object({
  closure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_sales: z.number().min(0).optional(),
  total_cash: z.number().min(0).optional(),
  total_digital: z.number().min(0).optional(),
  expected_total: z.number().min(0).optional(),
  actual_total: z.number().min(0).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "finance", "read");
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");
    const status = params.get("status");

    let query = auth.supabase
      .from("cash_closures")
      .select("id, closure_date, status, total_sales, total_cash, total_digital, expected_total, actual_total, discrepancy, notes, closed_by, reviewed_by, created_at, updated_at")
      .eq("team_id", teamId)
      .order("closure_date", { ascending: false })
      .limit(60);

    if (dateFrom) query = query.gte("closure_date", dateFrom);
    if (dateTo) query = query.lte("closure_date", dateTo);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "write");
    const parsed = CreateCashClosureSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { closure_date, total_sales, total_cash, total_digital, expected_total, actual_total, notes } = parsed.data;

    const { data: existing } = await auth.supabase
      .from("cash_closures")
      .select("id")
      .eq("team_id", teamId)
      .eq("closure_date", closure_date)
      .single();

    if (existing) {
      return NextResponse.json({ error: "A closure already exists for this date" }, { status: 409 });
    }

    const expectedTotal = expected_total ?? ((total_cash ?? 0) + (total_digital ?? 0));
    const actualTotal = actual_total ?? expectedTotal;
    const discrepancy = actualTotal - expectedTotal;

    const { data, error } = await auth.supabase
      .from("cash_closures")
      .insert({
        team_id: teamId,
        closure_date,
        total_sales: total_sales ?? 0,
        total_cash: total_cash ?? 0,
        total_digital: total_digital ?? 0,
        expected_total: expectedTotal,
        actual_total: actualTotal,
        discrepancy,
        notes: notes?.trim() ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}

