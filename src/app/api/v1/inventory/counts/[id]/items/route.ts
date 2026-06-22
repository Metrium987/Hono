import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");
    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    const { data: count } = await auth.supabase
      .from("inventory_count")
      .select("id, status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!count) return NextResponse.json({ error: "Count not found" }, { status: 404 });
    if (!["draft", "in_progress"].includes(count.status)) {
      return NextResponse.json({ error: "Cannot add items to a completed or approved count" }, { status: 409 });
    }

    const rows = items.map((item: { product_id: string; system_qty?: number; counted_qty?: number; notes?: string }) => ({
      team_id: teamId,
      count_id: id,
      product_id: item.product_id,
      system_qty: item.system_qty ?? 0,
      counted_qty: item.counted_qty ?? null,
      difference: item.counted_qty != null ? item.counted_qty - (item.system_qty ?? 0) : null,
      notes: item.notes ?? null,
    }));

    const { data, error } = await auth.supabase
      .from("inventory_count_item")
      .upsert(rows, { onConflict: "count_id, product_id" })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await auth.supabase
      .from("inventory_count")
      .update({ status: "in_progress" })
      .eq("id", id)
      .eq("status", "draft");

    return NextResponse.json({ data });
  });
}
