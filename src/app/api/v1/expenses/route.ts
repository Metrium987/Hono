import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

type ExportFormat = "json" | "csv";

const CreateExpenseSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  vendor_name: z.string().max(200).optional().nullable(),
  description: z.string().min(1).max(1000),
  amount: z.number().positive(),
  currency_id: z.string().uuid(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receipt_url: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

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
    const format = (params.get("format") as ExportFormat | null) ?? "json";

    let query = auth.supabase
      .from("expenses")
      .select(`
        *,
        category:category_id(id, name),
        vendor:vendor_id(id, name),
        currency:currency_id(code, symbol)
      `, { count: "exact" })
      .eq("team_id", teamId)
      .is("deleted_at", null);

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

    if (format === "csv") {
      const header = [
        "expense_date",
        "description",
        "vendor_name",
        "category",
        "amount",
        "currency",
      ].join(",");

      const rows = (data ?? [])
        .map((row) => {
          const vendor = Array.isArray(row.vendor) ? row.vendor[0] : (row.vendor as { name?: string } | null);
          const category = Array.isArray(row.category) ? row.category[0] : (row.category as { name?: string } | null);

          const amount = typeof row.amount === "number" ? row.amount.toFixed(2) : String(row.amount ?? 0);
          const description = String(row.description ?? "").replace(/"/g, '""');
          const vendorName = String(vendor?.name ?? row.vendor_name ?? "").replace(/"/g, '""');
          const categoryName = String(category?.name ?? "").replace(/"/g, '""');
          const currency = String((row.currency as { code?: string } | null)?.code ?? row.currency_id ?? "").replace(/"/g, '""');

          return [
            row.expense_date ?? "",
            description,
            vendorName,
            categoryName,
            amount,
            currency,
          ].join(",");
        })
        .filter((row) => row.trim().length > 0);

      const csv = [header, ...rows].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="depenses-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// POST /api/v1/expenses â€” Create an expense
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "expenses", "write");
    const parsed = CreateExpenseSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { category_id, vendor_id, vendor_name, description, amount, currency_id, expense_date, receipt_url, notes } = parsed.data;

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

    // Auto-create approval request if amount exceeds threshold (Phase 6.1)
    // Default threshold: 50 000 F CFP — can be configured per team via team settings
    const APPROVAL_THRESHOLD = 50000;
    if (amount > APPROVAL_THRESHOLD && auth.userId) {
      await auth.supabase.from("approvals").insert({
        team_id: teamId,
        approval_type: "expense_approval",
        status: "pending",
        entity_type: "expense",
        entity_id: data.id,
        requested_by: auth.userId,
        metadata: { amount, description, threshold: APPROVAL_THRESHOLD },
      });
    }

    return NextResponse.json({ data, requires_approval: amount > APPROVAL_THRESHOLD }, { status: 201 });
  });
}

