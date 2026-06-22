import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "finance", "read");
    const vendorId = params.get("vendor_id");
    const isPaid = params.get("is_paid");

    let query = auth.supabase
      .from("vendor_commissions")
      .select("*, order:order_id(id, order_number), invoice:invoice_id(id, number)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (vendorId) query = query.eq("vendor_id", vendorId);
    if (isPaid !== null) query = query.eq("is_paid", isPaid !== "false");

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "write");
    const body = await request.json();
    const { vendor_id, order_id, invoice_id, base_amount, commission_pct, notes } = body;

    if (!vendor_id) return NextResponse.json({ error: "vendor_id is required" }, { status: 400 });
    if (!base_amount || base_amount <= 0) return NextResponse.json({ error: "base_amount must be positive" }, { status: 400 });
    if (commission_pct == null || commission_pct < 0) return NextResponse.json({ error: "commission_pct must be >= 0" }, { status: 400 });

    const commission_amount = Number(((base_amount * commission_pct) / 100).toFixed(2));

    const { data, error } = await auth.supabase
      .from("vendor_commissions")
      .insert({
        team_id: teamId,
        vendor_id,
        order_id: order_id ?? null,
        invoice_id: invoice_id ?? null,
        base_amount,
        commission_pct,
        commission_amount,
        notes: notes?.trim() ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
