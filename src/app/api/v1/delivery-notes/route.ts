import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "orders", "read");
    const status = params.get("status");

    let query = auth.supabase
      .from("delivery_notes")
      .select("*, order:order_id(id, order_number), created_by_user:created_by(id, full_name)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "orders", "write");
    const body = await request.json();
    const { order_id, delivery_address, recipient_name, recipient_id_doc, notes, items } = body;

    if (!order_id) return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items is required (non-empty array)" }, { status: 400 });
    }

    const { data: order } = await auth.supabase
      .from("orders")
      .select("id")
      .eq("id", order_id)
      .eq("team_id", teamId)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const { count } = await auth.supabase
      .from("delivery_notes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);

    const noteNumber = `BL-${String((count ?? 0) + 1).padStart(5, "0")}`;

    const { data: dn, error: dnError } = await auth.supabase
      .from("delivery_notes")
      .insert({
        team_id: teamId,
        order_id,
        note_number: noteNumber,
        delivery_address: delivery_address ?? null,
        recipient_name: recipient_name ?? null,
        recipient_id_doc: recipient_id_doc ?? null,
        notes: notes ?? null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (dnError) return NextResponse.json({ error: dnError.message }, { status: 400 });

    const lineItems = items.map((item: { product_id: string; quantity_dispatched: number; notes?: string }) => ({
      team_id: teamId,
      delivery_note_id: dn.id,
      product_id: item.product_id,
      quantity_dispatched: item.quantity_dispatched,
      quantity_delivered: 0,
      notes: item.notes ?? null,
    }));

    const { error: itemError } = await auth.supabase.from("delivery_note_items").insert(lineItems);
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 400 });

    return NextResponse.json({ data: dn }, { status: 201 });
  });
}
