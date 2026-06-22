import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");

    const { data: container, error: contErr } = await auth.supabase
      .from("containers")
      .select("id, status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (contErr || !container) return NextResponse.json({ error: "Container not found" }, { status: 404 });
    if (container.status === "closed") return NextResponse.json({ error: "Already closed" }, { status: 409 });

    const { data: items } = await auth.supabase
      .from("container_items")
      .select("product_id, quantity_received")
      .eq("container_id", id)
      .eq("is_matched", true)
      .gt("quantity_received", 0);

    if (items && items.length > 0) {
      const ledgerEntries = await Promise.all(
        items.map(async (item) => {
          const { data: current } = await auth.supabase
            .from("products")
            .select("current_stock")
            .eq("id", item.product_id)
            .eq("team_id", teamId)
            .single();

          const newBalance = (current?.current_stock ?? 0) + item.quantity_received;

          await auth.supabase
            .from("products")
            .update({ current_stock: newBalance })
            .eq("id", item.product_id)
            .eq("team_id", teamId);

          return {
            team_id: teamId,
            product_id: item.product_id,
            transaction_type: "purchase",
            quantity_change: item.quantity_received,
            running_balance: newBalance,
            description: `Réception container ${id}`,
            created_by: auth.userId,
          };
        })
      );

      await auth.supabase.from("inventory_ledger").insert(ledgerEntries);
    }

    const { data, error } = await auth.supabase
      .from("containers")
      .update({
        status: "closed",
        closed_by: auth.userId,
        closed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data, stock_movements: items?.length ?? 0 });
  });
}
