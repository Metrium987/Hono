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

    const { data: container } = await auth.supabase
      .from("containers")
      .select("id, status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });
    if (container.status === "closed") {
      return NextResponse.json({ error: "Cannot add items to a closed container" }, { status: 409 });
    }

    const rows = items.map((item: {
      product_id?: string;
      quantity_expected: number;
      quantity_received?: number;
      unit_cost?: number;
      original_name?: string;
      translated_name?: string;
      weight_kg?: number;
      sku_hint?: string;
      notes?: string;
    }) => ({
      team_id: teamId,
      container_id: id,
      product_id: item.product_id ?? null,
      quantity_expected: item.quantity_expected,
      quantity_received: item.quantity_received ?? 0,
      unit_cost: item.unit_cost ?? null,
      original_name: item.original_name ?? null,
      translated_name: item.translated_name ?? null,
      weight_kg: item.weight_kg ?? null,
      sku_hint: item.sku_hint ?? null,
      notes: item.notes ?? null,
      is_matched: !!item.product_id,
    }));

    const { data, error } = await auth.supabase
      .from("container_items")
      .insert(rows)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
