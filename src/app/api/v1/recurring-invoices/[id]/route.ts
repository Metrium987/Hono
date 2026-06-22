import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

const patchSchema = z.object({
  is_active: z.boolean().optional(),
  end_date: z.string().datetime().nullable().optional(),
  payment_terms: z.string().max(100).optional(),
  notes: z.string().max(1000).nullable().optional(),
  next_generation_date: z.string().datetime().nullable().optional(),
});

type Params = Promise<{ id: string }>;

// PATCH /api/v1/recurring-invoices/[id]
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const allowed = ["is_active", "end_date", "payment_terms", "notes", "next_generation_date"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in parsed.data) update[key] = (parsed.data as Record<string, unknown>)[key];
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
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .eq("team_id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
