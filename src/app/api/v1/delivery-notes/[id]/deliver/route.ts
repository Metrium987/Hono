import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "orders", "write");

    const { data: dn } = await auth.supabase
      .from("delivery_notes")
      .select("status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!dn) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (dn.status !== "dispatched") {
      return NextResponse.json({ error: "Only dispatched delivery notes can be marked as delivered" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const items = body.items as { id: string; quantity_delivered: number }[] | undefined;

    if (items?.length) {
      await Promise.all(
        items.map((item) =>
          auth.supabase
            .from("delivery_note_items")
            .update({ quantity_delivered: item.quantity_delivered })
            .eq("id", item.id)
            .eq("team_id", teamId)
        )
      );
    }

    const { data, error } = await auth.supabase
      .from("delivery_notes")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  });
}
