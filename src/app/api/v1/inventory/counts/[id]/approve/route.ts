import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");

    const { data: count, error: countErr } = await auth.supabase
      .from("inventory_count")
      .select("id, status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (countErr || !count) return NextResponse.json({ error: "Count not found" }, { status: 404 });
    if (count.status === "approved") return NextResponse.json({ error: "Already approved" }, { status: 409 });
    if (!["in_progress", "completed"].includes(count.status)) {
      return NextResponse.json({ error: "Count must be in_progress or completed to approve" }, { status: 409 });
    }

    const { data: items, error: itemsErr } = await auth.supabase
      .from("inventory_count_item")
      .select("id, count_id, product_id, system_qty, counted_qty, difference")
      .eq("count_id", id)
      .not("counted_qty", "is", null);

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

    const discrepancies = (items ?? [])
      .filter((item) => item.difference !== 0 && item.difference !== null)
      .map((item) => ({
        team_id: teamId,
        count_id: id,
        product_id: item.product_id,
        system_qty: item.system_qty,
        counted_qty: item.counted_qty,
        difference: item.difference,
      }));

    if (discrepancies.length > 0) {
      const { error: discErr } = await auth.supabase
        .from("inventory_discrepancy")
        .insert(discrepancies);
      if (discErr) return NextResponse.json({ error: discErr.message }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("inventory_count")
      .update({
        status: "approved",
        approved_by: auth.userId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data, discrepancies_created: discrepancies.length });
  });
}
