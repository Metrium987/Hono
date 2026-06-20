import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const allowed = ["name", "description", "discount_type", "discount_value", "applies_to", "category_id", "starts_at", "ends_at", "is_active"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of allowed) { if (body[f] !== undefined) updates[f] = body[f]; }

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
