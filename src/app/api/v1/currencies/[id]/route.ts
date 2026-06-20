import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

// PATCH /api/v1/currencies/[id] — Update a currency
export async function PATCH(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "currencies", "write");
    const { id } = await props.params;
    const body = await request.json();

    const allowedFields = ["code", "name", "symbol", "symbol_position", "is_default", "exchange_rate_to_xpf", "is_active"];
    const updates: Record<string, string | number | boolean | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = field === "code" ? body[field].toUpperCase() : body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("currencies")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/currencies/[id] — Delete a currency
export async function DELETE(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "currencies", "write");
    const { id } = await props.params;

    // Prevent deleting default currency
    const { data: currency } = await auth.supabase
      .from("currencies")
      .select("is_default")
      .eq("id", id)
      .single();

    if (currency?.is_default) {
      return NextResponse.json({
        error: "Cannot delete the default currency. Set another currency as default first.",
      }, { status: 409 });
    }

    const { error } = await auth.supabase
      .from("currencies")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({
          error: "Cannot delete currency that is in use on invoices or products",
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
