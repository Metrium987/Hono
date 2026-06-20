import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.status === "paid") {
      updates.status = "paid";
      updates.paid_at = new Date().toISOString();
    } else if (body.status === "pending") {
      updates.status = "pending";
      updates.paid_at = null;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "Aucune mise à jour" }, { status: 400 });
    const { data, error } = await auth.supabase
      .from("invoice_commissions").update(updates).eq("id", id).eq("team_id", teamId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  });
}
