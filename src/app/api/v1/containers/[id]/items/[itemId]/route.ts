import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");
    const body = await request.json();
    const { product_id, quantity_received, unit_cost, is_matched, ai_corrected } = body;

    const updates: Record<string, unknown> = {};
    if (product_id !== undefined) { updates.product_id = product_id; updates.is_matched = true; }
    if (quantity_received !== undefined) updates.quantity_received = quantity_received;
    if (unit_cost !== undefined) updates.unit_cost = unit_cost;
    if (is_matched !== undefined) updates.is_matched = is_matched;
    if (ai_corrected !== undefined) updates.ai_corrected = ai_corrected;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("container_items")
      .update(updates)
      .eq("id", itemId)
      .eq("container_id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    return NextResponse.json({ data });
  });
}
