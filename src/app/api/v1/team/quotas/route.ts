import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "read");

    const { data, error } = await auth.supabase
      .from("team_quotas")
      .select("id, team_id, max_users, max_products, max_customers, max_warehouses, max_storage_mb, max_users_per_role, updated_at")
      .eq("team_id", teamId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const [productsRes, customersRes, warehousesRes, membersRes] = await Promise.all([
      auth.supabase.from("products").select("id", { count: "exact", head: true }).eq("team_id", teamId),
      auth.supabase.from("customers").select("id", { count: "exact", head: true }).eq("team_id", teamId),
      auth.supabase.from("warehouses").select("id", { count: "exact", head: true }).eq("team_id", teamId),
      auth.supabase.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    ]);

    return NextResponse.json({
      data,
      usage: {
        products: productsRes.count ?? 0,
        customers: customersRes.count ?? 0,
        warehouses: warehousesRes.count ?? 0,
        users: membersRes.count ?? 0,
      },
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    if (!auth.isOwner) {
      return NextResponse.json({ error: "Only team owners can modify quotas" }, { status: 403 });
    }

    const body = await request.json();
    const allowed = ["max_users", "max_products", "max_customers", "max_warehouses", "max_storage_mb", "max_users_per_role"] as const;
    const updates: Record<string, unknown> = {};
    for (const field of allowed) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("team_quotas")
      .upsert({ team_id: teamId, ...updates, updated_at: new Date().toISOString() }, { onConflict: "team_id" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  });
}
