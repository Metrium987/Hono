import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

const patchSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  discount_type: z.enum(["percent", "fixed"]).optional(),
  discount_value: z.number().min(0).optional(),
  applies_to: z.enum(["all_products", "category", "selected_products"]).optional(),
  category_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional(),
  product_ids: z.array(z.string().uuid()).optional(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const allowed = ["name", "description", "discount_type", "discount_value", "applies_to", "category_id", "starts_at", "ends_at", "is_active"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of allowed) { if (parsed.data[f as keyof typeof parsed.data] !== undefined) updates[f] = parsed.data[f as keyof typeof parsed.data]; }

    const { data, error } = await auth.supabase
      .from("promotions").update(updates).eq("id", id).eq("team_id", teamId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Replace product_ids if provided
    if (body.product_ids !== undefined) {
      await auth.supabase.from("promotion_products").delete().eq("promotion_id", id);
      if (Array.isArray(body.product_ids) && body.product_ids.length > 0) {
        await auth.supabase.from("promotion_products").insert(
          body.product_ids.map((pid: string) => ({ promotion_id: id, product_id: pid }))
        );
      }
    }

    return NextResponse.json({ data });
  });
}

export async function DELETE(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const { error } = await auth.supabase.from("promotions").delete().eq("id", id).eq("team_id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
