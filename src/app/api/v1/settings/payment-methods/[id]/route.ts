import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

// PATCH /api/v1/settings/payment-methods/[id] — Update a payment method
export async function PATCH(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "payments", "write");
    const { id } = await props.params;
    const body = await request.json();
    const { name, display_name, is_active, sort_order } = body;

    const updatePayload: Record<string, string | number | boolean | null> = {};
    if (name !== undefined) updatePayload.name = name;
    if (display_name !== undefined) updatePayload.display_name = display_name;
    if (is_active !== undefined) updatePayload.is_active = is_active;
    if (sort_order !== undefined) updatePayload.sort_order = sort_order;

    const { data, error } = await auth.supabase
      .from("payment_methods")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/settings/payment-methods/[id] — Delete a payment method
export async function DELETE(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "payments", "write");
    const { id } = await props.params;

    const { error } = await auth.supabase
      .from("payment_methods")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
