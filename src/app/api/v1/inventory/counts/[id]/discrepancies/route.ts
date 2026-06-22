import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "read");

    const { data, error } = await auth.supabase
      .from("inventory_discrepancy")
      .select("*, product:product_id(id, name, sku)")
      .eq("count_id", id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}
