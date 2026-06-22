import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type ItemInput = { description?: string; quantity?: string | number; unit_price_ht?: string | number; product_id?: string | null; special_request?: string | null };

// GET /api/v1/orders — List orders for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "orders", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const status = params.get("status");
    const customerIdStr = params.get("customer_id");
    const source = params.get("source");

    let query = auth.supabase
      .from("orders")
      .select(`
        *,
        customer:customer_id(id, company_name, contact_name, email),
        items:order_items(*)
      `, { count: "exact" })
      .eq("team_id", teamId)
      .is("deleted_at", null);

    if (status) query = query.eq("status", status);
    if (customerIdStr) query = query.eq("customer_id", customerIdStr);
    if (source) query = query.eq("source", source);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// POST /api/v1/orders — Create an order with items
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "orders", "write");
    const body = await request.json();
    const { customer_id, source, notes, items } = body;

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one order item is required" }, { status: 400 });
    }

    // Create order
    const { data: order, error: orderError } = await auth.supabase
      .from("orders")
      .insert({
        team_id: teamId,
        customer_id,
        source: source ?? "erp",
        status: "pending",
        notes: notes ?? null,
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    // Create order items
    const itemRows = items.map((item: ItemInput, idx: number) => ({
      order_id: order.id,
      product_id: item.product_id ?? null,
      description: item.description ?? "",
      quantity: parseFloat(item.quantity as string) || 1,
      unit_price_ht: item.unit_price_ht ? parseFloat(item.unit_price_ht as string) : null,
      special_request: item.special_request ?? null,
    }));

    const { error: itemsError } = await auth.supabase
      .from("order_items")
      .insert(itemRows);

    if (itemsError) {
      await auth.supabase
        .from("orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", order.id);
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    return NextResponse.json({
      data: { ...order, items: itemRows },
    }, { status: 201 });
  });
}
