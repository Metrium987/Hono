import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

// GET /api/v1/expenses/[id] — Get a single expense
export async function GET(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "expenses", "read");
    const { id } = await props.params;

    const { data, error } = await auth.supabase
      .from("expenses")
      .select(`
        *,
        category:category_id(id, name),
        vendor:vendor_id(id, name),
        currency:currency_id(code, symbol)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  });
}

// PATCH /api/v1/expenses/[id] — Update an expense
export async function PATCH(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "expenses", "write");
    const { id } = await props.params;
    const body = await request.json();

    const allowedFields = ["category_id", "vendor_id", "vendor_name", "description", "amount", "currency_id", "expense_date", "receipt_url", "notes"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("expenses")
      .update(updates)
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/expenses/[id] — Delete an expense
export async function DELETE(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "expenses", "write");
    const { id } = await props.params;

    const { error } = await auth.supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
