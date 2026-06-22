import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

// GET /api/v1/income/[id] — Get a single income entry
export async function GET(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "income", "read");
    const { id } = await props.params;

    const { data, error } = await auth.supabase
      .from("income")
      .select(`
        *,
        category:category_id(id, name),
        currency:currency_id(code, symbol),
        customer:customer_id(id, company_name, contact_name)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  });
}

// PATCH /api/v1/income/[id] — Update income
export async function PATCH(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "income", "write");
    const { id } = await props.params;
    const body = await request.json();

    const allowedFields = ["category_id", "description", "amount", "currency_id", "income_date", "customer_id", "receipt_url", "notes"];
    const updates: Record<string, string | number | boolean | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("income")
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

// DELETE /api/v1/income/[id] — Delete income
export async function DELETE(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "income", "write");
    const { id } = await props.params;

    const { error } = await auth.supabase
      .from("income")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
