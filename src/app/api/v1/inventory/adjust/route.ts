import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// POST /api/v1/inventory/adjust — Manual stock adjustment
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const { product_id, quantity_change, reason } = body;

    if (!product_id) {
      return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    if (quantity_change === undefined || quantity_change === null || quantity_change === 0) {
      return NextResponse.json({ error: "quantity_change must be a non-zero number" }, { status: 400 });
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: "reason is required for audit trail" }, { status: 400 });
    }

    // Verify product exists and belongs to team
    const { data: product, error: prodError } = await auth.supabase
      .from("products")
      .select("id, current_stock, track_stock, name")
      .eq("id", product_id)
      .eq("team_id", teamId)
      .single();

    if (prodError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.track_stock) {
      return NextResponse.json({ error: "Stock tracking is not enabled for this product" }, { status: 400 });
    }

    const qtyChange = parseFloat(quantity_change);
    const currentStock = product.current_stock || 0;
    const newBalance = Math.max(0, currentStock + qtyChange);

    // Update product stock
    const { error: updateError } = await auth.supabase
      .from("products")
      .update({ current_stock: newBalance, updated_at: new Date().toISOString() })
      .eq("id", product_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Record immutable ledger entry
    const { data: ledger, error: ledgerError } = await auth.supabase
      .from("inventory_ledger")
      .insert({
        team_id: teamId,
        product_id,
        transaction_type: "manual_adjustment",
        quantity_change: qtyChange,
        running_balance: newBalance,
        reference_type: "manual_adjustment",
        description: `Manual adjustment: ${reason} (from ${currentStock} to ${newBalance})`,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (ledgerError) {
      console.error("Failed to record ledger entry:", ledgerError);
      await auth.supabase
        .from("products")
        .update({ current_stock: currentStock })
        .eq("id", product_id);
      return NextResponse.json({ error: "Failed to record ledger entry" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        product_id,
        product_name: product.name,
        previous_stock: currentStock,
        adjustment: qtyChange,
        new_stock: newBalance,
        reason,
        ledger_id: ledger?.id ?? null,
      },
    }, { status: 201 });
  });
}
