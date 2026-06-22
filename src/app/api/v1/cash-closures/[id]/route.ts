import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "read");

    const { data, error } = await auth.supabase
      .from("cash_closures")
      .select("id, closure_date, status, total_sales, total_cash, total_digital, expected_total, actual_total, discrepancy, notes, closed_by, reviewed_by, created_at, updated_at")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "write");
    const body = await request.json();
    const { status, actual_total, notes } = body;

    const { data: closure } = await auth.supabase
      .from("cash_closures")
      .select("status, expected_total")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!closure) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (notes !== undefined) updates.notes = notes?.trim() ?? null;

    if (actual_total !== undefined) {
      updates.actual_total = actual_total;
      updates.discrepancy = actual_total - Number(closure.expected_total);
    }

    if (status === "closed") {
      updates.status = "closed";
      updates.closed_by = auth.userId;
    } else if (status === "reviewed") {
      updates.status = "reviewed";
      updates.reviewed_by = auth.userId;
    } else if (status) {
      updates.status = status;
    }

    const { data, error } = await auth.supabase
      .from("cash_closures")
      .update(updates)
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  });
}
