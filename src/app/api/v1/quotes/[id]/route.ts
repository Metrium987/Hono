import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type ItemInput = { description?: string; quantity?: string | number; unit_price_ht?: string | number; tax_rate_id?: string | null; product_id?: string | null; group_id?: string | null; sort_order?: number };

// GET /api/v1/quotes/[id] — Get single quote with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "quotes", "read");
    const { data, error } = await auth.supabase
      .from("quotes")
      .select(`
        *,
        customer:customer_id(*),
        currency:currency_id(code, symbol, symbol_position),
        items:quote_items(*, tax_rates:tax_rate_id(name, rate)),
        converted_invoice:converted_to_invoice_id(id, invoice_number, status)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// PATCH /api/v1/quotes/[id] — Update quote
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "quotes", "write");
    const body = await request.json();

    const allowedFields = [
      "customer_id", "issue_date", "validity_date",
      "currency_id", "status", "notes",
    ];

    const updatePayload: Record<string, string | number | boolean | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updatePayload[field] = body[field];
    }
    updatePayload.updated_at = new Date().toISOString();

    if (body.status === "accepted") {
      updatePayload.validity_date = updatePayload.validity_date ?? new Date().toISOString().split("T")[0];
    }

    const { error: updateError } = await auth.supabase
      .from("quotes")
      .update(updatePayload)
      .eq("id", id)
      .eq("team_id", teamId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Update items if provided
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      await auth.supabase.from("quote_items").delete().eq("quote_id", id);

      const itemRows = body.items.map((item: ItemInput, idx: number) => {
        const qty = parseFloat(item.quantity as string) || 1;
        const unitPrice = parseFloat(item.unit_price_ht as string) || 0;
        return {
          quote_id: id,
          description: item.description ?? "",
          quantity: qty,
          unit_price_ht: Math.round(unitPrice * 100) / 100,
          tax_rate_id: item.tax_rate_id ?? null,
          line_total_ht: Math.round(qty * unitPrice * 100) / 100,
          sort_order: idx,
        };
      });

      await auth.supabase.from("quote_items").insert(itemRows);
    }

    const { data } = await auth.supabase
      .from("quotes")
      .select("*, items:quote_items(*)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/quotes/[id] — Delete quote
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "quotes", "write");
    const { data: quote } = await auth.supabase
      .from("quotes")
      .select("status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!quote) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (quote.status === "converted") {
      return NextResponse.json({
        error: "Cannot delete a converted quote. Cancel it instead.",
      }, { status: 409 });
    }

    const { error } = await auth.supabase
      .from("quotes")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
