import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

const CreateInventoryCountSchema = z.object({
  warehouse_id: z.string().uuid(),
  scheduled_at: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "inventory", "read");
    const warehouseId = params.get("warehouse_id");
    const status = params.get("status");

    let query = auth.supabase
      .from("inventory_count")
      .select("*, warehouse:warehouse_id(id, name, type)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (warehouseId) query = query.eq("warehouse_id", warehouseId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");
    const parsed = CreateInventoryCountSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { warehouse_id, scheduled_at, notes } = parsed.data;

    const { data: warehouse } = await auth.supabase
      .from("warehouses")
      .select("id")
      .eq("id", warehouse_id)
      .eq("team_id", teamId)
      .single();

    if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

    const { data, error } = await auth.supabase
      .from("inventory_count")
      .insert({
        team_id: teamId,
        warehouse_id,
        status: "draft",
        scheduled_at: scheduled_at ?? null,
        notes: notes?.trim() ?? null,
        created_by: auth.userId,
      })
      .select("*, warehouse:warehouse_id(id, name, type)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}

