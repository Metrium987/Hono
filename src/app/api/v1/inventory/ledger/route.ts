import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/inventory/ledger?product_id=...&limit=...
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "inventory", "read");

    const productId = params.get("product_id");
    const limit = Math.min(parseInt(params.get("limit") ?? "50"), 200);

    let query = auth.supabase
      .from("inventory_ledger")
      .select("id, transaction_type, quantity_change, running_balance, unit_cost, reference_type, reference_id, created_at, product:product_id(id, name, sku), location:location_id(id, code)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (productId) query = query.eq("product_id", productId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}
