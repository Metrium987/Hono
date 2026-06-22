import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "settings", "read");
    const currencyId = params.get("currency_id");
    const rateType = params.get("rate_type");
    const limit = Math.min(200, Math.max(1, parseInt(params.get("limit") ?? "50")));

    let query = auth.supabase
      .from("exchange_rates")
      .select("*, currency:currency_id(id, code, symbol)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (currencyId) query = query.eq("currency_id", currencyId);
    if (rateType) query = query.eq("rate_type", rateType);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();
    const { currency_id, rate_type, rate, source, notes } = body;

    if (!rate || isNaN(Number(rate)) || Number(rate) <= 0) {
      return NextResponse.json({ error: "rate must be a positive number" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("exchange_rates")
      .insert({
        team_id: teamId,
        currency_id: currency_id ?? null,
        rate_type: rate_type ?? "official",
        rate: Number(rate),
        source: source?.trim() ?? null,
        notes: notes?.trim() ?? null,
        updated_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}
