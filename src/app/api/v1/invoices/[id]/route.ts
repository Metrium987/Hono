import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/invoices/[id] — Get single invoice with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");
    const { data, error } = await auth.supabase
      .from("invoices")
      .select(`
        *,
        customer:customer_id(*),
        team:team_id(name, n_tahiti, rcs_number, is_franchise_en_base,
          address_line1, address_line2, city, island, postal_code,
          bank_name, bank_rib, bank_iban, bank_bic,
          invoice_prefix, late_fee_fixed),
        currency:currency_id(code, symbol, symbol_position),
        items:invoice_items(*, tax_rates:tax_rate_id(name, rate)),
        payments:invoice_payments(*, payment_method:payment_method_id(name, display_name)),
        events:invoice_events(*, created_by_user:created_by(id, full_name)),
        quote:quote_id(id, quote_number)
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

// PATCH /api/v1/invoices/[id] — Update invoice (not for sent/paid)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    // Check current status first
    const { data: current } = await auth.supabase
      .from("invoices")
      .select("status, team_id")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isFinalized = ["sent", "paid", "overdue", "cancelled"].includes(current.status);
    if (isFinalized) {
      return NextResponse.json({
        error: `Cannot modify a ${current.status} invoice. Create a credit note instead.`,
      }, { status: 409 });
    }

    const body = await request.json();
    const allowedFields = [
      "customer_id", "issue_date", "service_date", "due_date",
      "currency_id", "late_fee_fixed", "legal_vat_mention", "legal_mentions",
      "discount_type", "discount_value", "notes", "message", "status",
    ];

    const updatePayload: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updatePayload[field] = body[field];
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updatePayload.updated_at = new Date().toISOString();

    const { error: updateError } = await auth.supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", id)
      .eq("team_id", teamId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Record event for status changes
    if (body.status && body.status !== current.status) {
      await auth.supabase.from("invoice_events").insert({
        invoice_id: id,
        event_type: "status_changed",
        payload: { from: current.status, to: body.status },
        created_by: auth.userId,
      });
    }

    // Update items if provided
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      await auth.supabase.from("invoice_items").delete().eq("invoice_id", id);

      const itemRows = body.items.map((item: Record<string, unknown>, idx: number) => {
        const qty = parseFloat(item.quantity as string) || 1;
        const unitPrice = parseFloat(item.unit_price_ht as string) || 0;
        return {
          invoice_id: id,
          description: item.description ?? "",
          quantity: qty,
          unit_price_ht: Math.round(unitPrice * 100) / 100,
          tax_rate_id: item.tax_rate_id ?? null,
          line_total_ht: Math.round(qty * unitPrice * 100) / 100,
          sort_order: idx,
        };
      });

      await auth.supabase.from("invoice_items").insert(itemRows);
    }

    // Return updated invoice
    const { data } = await auth.supabase
      .from("invoices")
      .select("*, items:invoice_items(*)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/invoices/[id] — Soft-delete an invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const { data: current } = await auth.supabase
      .from("invoices")
      .select("status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (current.status === "paid") {
      return NextResponse.json({
        error: "Cannot delete a paid invoice. Create a credit note instead.",
      }, { status: 409 });
    }

    // Soft delete
    const { error } = await auth.supabase
      .from("invoices")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await auth.supabase.from("invoice_events").insert({
      invoice_id: id,
      event_type: "status_changed",
      payload: { action: "soft_deleted" },
      created_by: auth.userId,
    });

    return NextResponse.json({ success: true });
  });
}
