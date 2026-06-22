import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "read");
    const { data, error } = await auth.supabase
      .from("commission_rules")
      .select("id, user_id, rate, applies_from, applies_to, created_at")
      .eq("team_id", teamId)
      .order("applies_from", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();
    const { user_id, rate, applies_from, applies_to } = body;
    if (!user_id || rate === undefined) {
      return NextResponse.json({ error: "user_id et rate requis" }, { status: 400 });
    }
    const { data, error } = await auth.supabase
      .from("commission_rules")
      .insert({
        team_id: teamId,
        user_id,
        rate: parseFloat(String(rate)),
        applies_from: applies_from ?? new Date().toISOString(),
        applies_to: applies_to ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  });
}
