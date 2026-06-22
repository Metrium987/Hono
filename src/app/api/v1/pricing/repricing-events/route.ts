import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "read");

    const { data, error } = await auth.supabase
      .from("repricing_events")
      .select("*, currency:currency_id(id, code, symbol)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();
    const { trigger, currency_id, old_exchange_rate, new_exchange_rate, notes } = body;

    if (!trigger) return NextResponse.json({ error: "trigger is required" }, { status: 400 });

    const variation_pct = old_exchange_rate && new_exchange_rate && old_exchange_rate > 0
      ? ((new_exchange_rate - old_exchange_rate) / old_exchange_rate) * 100
      : null;

    const { data, error } = await auth.supabase
      .from("repricing_events")
      .insert({
        team_id: teamId,
        trigger,
        currency_id: currency_id ?? null,
        old_exchange_rate: old_exchange_rate ?? null,
        new_exchange_rate: new_exchange_rate ?? null,
        variation_pct,
        notes: notes?.trim() ?? null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
