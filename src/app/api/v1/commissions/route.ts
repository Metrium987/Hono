import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");

    let query = auth.supabase
      .from("invoice_commissions")
      .select(`*, invoice:invoice_id(number, customer:customer_id(contact_name), total_ttc, issue_date)`)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}
