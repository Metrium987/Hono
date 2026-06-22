import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "settings", "read");
    const isActive = params.get("is_active");

    let query = auth.supabase
      .from("pricing_rules")
      .select("id, name, rule_type, conditions, adjustments, priority, is_active, valid_from, valid_until, created_by, created_at")
      .eq("team_id", teamId)
      .order("priority", { ascending: false });

    if (isActive !== null) query = query.eq("is_active", isActive !== "false");

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();
    const { name, rule_type, conditions, adjustments, priority, is_active, valid_from, valid_until } = body;

    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!rule_type) return NextResponse.json({ error: "rule_type is required" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("pricing_rules")
      .insert({
        team_id: teamId,
        name: name.trim(),
        rule_type,
        conditions: conditions ?? {},
        adjustments: adjustments ?? {},
        priority: priority ?? 0,
        is_active: is_active ?? true,
        valid_from: valid_from ?? null,
        valid_until: valid_until ?? null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
