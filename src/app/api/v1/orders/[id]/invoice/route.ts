import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// POST /api/v1/orders/[id]/invoice — Convert an order to a draft invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");

    // Fetch order with items and customer
    const { data: order, error: orderError } = await auth.supabase
      .from("orders")
      .select("id, customer_id, status, items:order_items(id, description, quantity, unit_price_ht, product_id)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "cancelled") {
      return NextResponse.json({ error: "Cannot invoice a cancelled order" }, { status: 409 });
    }

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "Order has no items" }, { status: 400 });
    }

    // Get team default currency
    const { data: currencies } = await auth.supabase
      .from("currencies")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_default", true)
      .limit(1)
      .single();

    if (!currencies) {
      return NextResponse.json({ error: "No default currency configured" }, { status: 400 });
    }

    // Calculate totals (no tax by default — invoice can be edited after)
    const subtotal_ht = items.reduce((sum, item) => {
      const qty = parseFloat(String(item.quantity)) || 1;
      const price = parseFloat(String(item.unit_price_ht ?? 0)) || 0;
      return sum + qty * price;
    }, 0);

    const total_ttc = subtotal_ht;

    // Generate invoice number
    const { data: numData, error: numError } = await auth.supabase
      .rpc("generate_next_invoice_number", { p_team_id: teamId });

    if (numError || !numData) {
      return NextResponse.json({ error: "Failed to generate invoice number" }, { status: 500 });
    }

    const invoiceNumber = Array.isArray(numData) ? numData[0] : numData;

    const today = new Date().toISOString().split("T")[0];
    const due = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    // Create invoice
    const { data: invoice, error: invError } = await auth.supabase
      .from("invoices")
      .insert({
        team_id: teamId,
        customer_id: order.customer_id,
        invoice_number: invoiceNumber,
        status: "draft",
        issue_date: today,
        due_date: due,
        subtotal_ht: Math.round(subtotal_ht * 100) / 100,
        tax_amount: 0,
        total_ttc: Math.round(total_ttc * 100) / 100,
        currency_id: currencies.id,
        notes: `Généré depuis commande ${id.slice(0, 8)}`,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 400 });
    }

    // Create invoice items from order items
    const itemRows = items.map((item, idx) => {
      const qty = parseFloat(String(item.quantity)) || 1;
      const unitPrice = parseFloat(String(item.unit_price_ht ?? 0)) || 0;
      return {
        invoice_id: invoice.id,
        product_id: item.product_id ?? null,
        description: item.description ?? "",
        quantity: qty,
        unit_price_ht: Math.round(unitPrice * 100) / 100,
        tax_rate_id: null,
        line_total_ht: Math.round(qty * unitPrice * 100) / 100,
        sort_order: idx,
      };
    });

    const { error: itemsError } = await auth.supabase
      .from("invoice_items")
      .insert(itemRows);

    if (itemsError) {
      await auth.supabase
        .from("invoices")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", invoice.id);
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    await auth.supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      event_type: "created",
      payload: { source: "order_conversion", order_id: id, items_count: items.length },
      created_by: auth.userId,
    });

    return NextResponse.json({ data: { id: invoice.id, invoice_number: invoiceNumber } }, { status: 201 });
  });
}
