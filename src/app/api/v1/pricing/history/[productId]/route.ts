import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "read");

    const { data, error } = await auth.supabase
      .from("price_history")
      .select("*, currency:currency_id(id, code, symbol)")
      .eq("product_id", productId)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}
