import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "orders", "read");

    const { data, error } = await auth.supabase
      .from("delivery_notes")
      .select("*, order:order_id(id, order_number, customer_id), items:delivery_note_items(*, product:product_id(id, name, sku))")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data });
  });
}
