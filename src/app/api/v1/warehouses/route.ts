import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "inventory", "read");
    const isActive = params.get("is_active");

    let query = auth.supabase
      .from("warehouses")
      .select("id, name, type, location, is_active, created_at")
      .eq("team_id", teamId)
      .order("name", { ascending: true });

    if (isActive !== null) query = query.eq("is_active", isActive !== "false");

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");
    const body = await request.json();
    const { name, type, location, is_active } = body;

    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });

    const validTypes = ["showroom", "warehouse", "external", "transit", "reserved", "defective"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("warehouses")
      .insert({
        team_id: teamId,
        name: name.trim(),
        type,
        location: location?.trim() ?? null,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
