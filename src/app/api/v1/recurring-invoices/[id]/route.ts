import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

// PATCH /api/v1/recurring-invoices/[id]
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const allowed = ["is_active", "end_date", "payment_terms", "notes", "next_generation_date"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    const { data, error } = await auth.supabase
      .from("recurring_invoices")
      .update(update)
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/recurring-invoices/[id]
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const { error } = await auth.supabase
      .from("recurring_invoices")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
