import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "finance", "read");

    const { data, error } = await auth.supabase
      .from("account_receivables")
      .select("*, customer:customer_id(id, name), invoice:invoice_id(id, number), installments:ar_installments(*)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data });
  });
}
