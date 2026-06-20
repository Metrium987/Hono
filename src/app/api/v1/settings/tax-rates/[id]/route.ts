import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

// PATCH /api/v1/settings/tax-rates/[id] — Update a tax rate
export async function PATCH(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "taxes", "write");
    const { id } = await props.params;
    const body = await request.json();

    const allowedFields = ["name", "rate", "description", "is_active"];
    const updates: Record<string, string | number | boolean | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("tax_rates")
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

// DELETE /api/v1/settings/tax-rates/[id] — Delete a tax rate
export async function DELETE(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "taxes", "write");
    const { id } = await props.params;

    const { error } = await auth.supabase
      .from("tax_rates")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({
          error: "Cannot delete tax rate that is in use on invoices or products",
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
