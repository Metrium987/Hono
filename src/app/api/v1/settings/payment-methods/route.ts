import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/settings/payment-methods — List payment methods for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "payments", "read");
    const { data, error } = await auth.supabase
      .from("payment_methods")
      .select("*")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// POST /api/v1/settings/payment-methods — Create a payment method
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "payments", "write");
    const body = await request.json();
    const { name, display_name, is_active, sort_order } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("payment_methods")
      .insert({
        team_id: teamId,
        name,
        display_name: display_name ?? null,
        is_active: is_active ?? true,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}

// PATCH /api/v1/settings/payment-methods — Batch update (reorder, etc)
export async function PATCH(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "payments", "write");
    const body = await request.json();
    const { id, name, display_name, is_active, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
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

// DELETE /api/v1/settings/payment-methods?id=xxx — Delete a payment method
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "payments", "write");
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

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
