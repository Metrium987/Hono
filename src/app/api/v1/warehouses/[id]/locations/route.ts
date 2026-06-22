import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "read");
    const isActive = new URL(request.url).searchParams.get("is_active");

    let query = auth.supabase
      .from("warehouse_locations")
      .select("id, warehouse_id, code, description, is_active, created_at")
      .eq("warehouse_id", id)
      .eq("team_id", teamId)
      .order("code", { ascending: true });

    if (isActive !== null) query = query.eq("is_active", isActive !== "false");

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");
    const body = await request.json();
    const { code, description, is_active } = body;

    if (!code?.trim()) return NextResponse.json({ error: "code is required" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("warehouse_locations")
      .insert({
        team_id: teamId,
        warehouse_id: id,
        code: code.trim().toUpperCase(),
        description: description?.trim() ?? null,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
