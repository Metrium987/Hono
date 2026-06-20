import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "read");
    const { data, error } = await auth.supabase
      .from("promotions")
      .select(`*, product_count:promotion_products(count)`)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const { name, description, discount_type, discount_value, applies_to, category_id, starts_at, ends_at, is_active, product_ids } = body;

    if (!name || !discount_type || !discount_value) {
      return NextResponse.json({ error: "name, discount_type, discount_value requis" }, { status: 400 });
    }

    const { data: promo, error } = await auth.supabase
      .from("promotions")
      .insert({
        team_id: teamId,
        name,
        description: description ?? null,
        discount_type,
        discount_value: parseFloat(String(discount_value)),
        applies_to: applies_to ?? "selected_products",
        category_id: category_id ?? null,
        starts_at: starts_at ?? new Date().toISOString(),
        ends_at: ends_at ?? null,
        is_active: is_active ?? true,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Assign products if selected_products
    if (applies_to === "selected_products" && Array.isArray(product_ids) && product_ids.length > 0) {
      await auth.supabase.from("promotion_products").insert(
        product_ids.map((pid: string) => ({ promotion_id: promo.id, product_id: pid }))
      );
    }

    return NextResponse.json({ data: promo }, { status: 201 });
  });
}
