import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "read");
    // Verify promo belongs to team
    const { data: promo } = await auth.supabase.from("promotions").select("id").eq("id", id).eq("team_id", teamId).single();
    if (!promo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data } = await auth.supabase.from("promotion_products").select("product_id").eq("promotion_id", id);
    return NextResponse.json({ data: data ?? [] });
  });
}
