import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type ItemInput = { description?: string; quantity?: string | number; unit_price_ht?: string | number; tax_rate_id?: string | null; product_id?: string | null; group_id?: string | null; sort_order?: number };

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
      .select("status, team_id, discount_type, discount_value")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isFinalized = ["sent", "paid", "overdue", "cancelled"].includes(current.status);

    const body = await request.json();

    // assigned_to can be updated on any invoice (attribution can change)
    if (isFinalized && Object.keys(body).some((k) => k !== "assigned_to")) {
      return NextResponse.json({
        error: `Cannot modify a ${current.status} invoice. Create a credit note instead.`,
      }, { status: 409 });
    }

    const allowedFields = [
      "customer_id", "issue_date", "service_date", "due_date",
      "currency_id", "late_fee_fixed", "legal_vat_mention", "legal_mentions",
      "discount_type", "discount_value", "notes", "message", "status", "assigned_to",
    ];

    const updatePayload: Record<string, string | number | boolean | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updatePayload[field] = body[field];
    }

    const isItemsUpdated = body.items && Array.isArray(body.items);
    const isDiscountUpdated = body.discount_type !== undefined || body.discount_value !== undefined;

    if (isItemsUpdated || isDiscountUpdated) {
      let itemsToUse = [];
      if (isItemsUpdated) {
        if (body.items.length === 0) {
          return NextResponse.json({ error: "At least one invoice item is required" }, { status: 400 });
        }
        itemsToUse = body.items;
      } else {
        const { data: dbItems } = await auth.supabase
          .from("invoice_items")
          .select("quantity, unit_price_ht, tax_rate_id, description, product_id, group_id")
          .eq("invoice_id", id);
        itemsToUse = dbItems || [];
      }

      let subtotal_ht = 0;
      let tax_amount = 0;
      const itemLineTotals: { lineTotal: number; taxRateId: string | null; taxRateValue: number }[] = [];

      // Fetch tax rates in batch
      const taxRateIds = [...new Set(itemsToUse.filter((i: any) => i.tax_rate_id).map((i: any) => i.tax_rate_id))];
      const taxRateMap = new Map<string, number>();
      if (taxRateIds.length > 0) {
        const { data: rates } = await auth.supabase
          .from("tax_rates")
          .select("id, rate")
          .in("id", taxRateIds);
        if (rates) {
          for (const r of rates) {
            taxRateMap.set(r.id, r.rate);
          }
        }
      }

      for (const item of itemsToUse) {
        const qty = parseFloat(item.quantity as string) || 1;
        const unitPrice = parseFloat(item.unit_price_ht as string) || 0;
        const lineTotal = qty * unitPrice;
        subtotal_ht += lineTotal;
        itemLineTotals.push({
          lineTotal,
          taxRateId: item.tax_rate_id ?? null,
          taxRateValue: item.tax_rate_id ? (taxRateMap.get(item.tax_rate_id) ?? 0) : 0,
        });
      }

      const discountType = body.discount_type !== undefined ? body.discount_type : current.discount_type;
      const discountValStr = body.discount_value !== undefined ? body.discount_value : current.discount_value;
      const discountValue = discountValStr ? parseFloat(discountValStr as string) : 0;

      let discountAmount = 0;
      if (discountType === "percentage" && discountValue) {
        discountAmount = subtotal_ht * (discountValue / 100);
      } else if (discountType === "fixed" && discountValue) {
        discountAmount = discountValue;
      }

      const discountRatio = subtotal_ht > 0 ? (subtotal_ht - discountAmount) / subtotal_ht : 1;

      for (const lt of itemLineTotals) {
        const discountedLineTotal = lt.lineTotal * discountRatio;
        if (lt.taxRateId && lt.taxRateValue > 0) {
          tax_amount += discountedLineTotal * (lt.taxRateValue / 100);
        }
      }

      const total_ttc = (subtotal_ht - discountAmount) + tax_amount;

      updatePayload.subtotal_ht = Math.round(subtotal_ht * 100) / 100;
      updatePayload.tax_amount = Math.round(tax_amount * 100) / 100;
      updatePayload.total_ttc = Math.round(total_ttc * 100) / 100;
      updatePayload.discount_amount = Math.round(discountAmount * 100) / 100;
    }

    if (Object.keys(updatePayload).length === 0 && !isItemsUpdated) {
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

    // Update items atomically via RPC (delete + insert in one transaction)
    if (isItemsUpdated) {
      const itemRows = body.items.map((item: ItemInput, idx: number) => {
        const qty = parseFloat(item.quantity as string) || 1;
        const unitPrice = parseFloat(item.unit_price_ht as string) || 0;
        return {
          product_id: item.product_id ?? null,
          description: item.description ?? "",
          quantity: qty,
          unit_price_ht: Math.round(unitPrice * 100) / 100,
          tax_rate_id: item.tax_rate_id ?? null,
          line_total_ht: Math.round(qty * unitPrice * 100) / 100,
          sort_order: idx,
        };
      });

      const { error: itemsError } = await auth.supabase.rpc("replace_invoice_items", {
        p_invoice_id: id,
        p_team_id: teamId,
        p_items: itemRows,
      });

      if (itemsError) {
        return NextResponse.json({ error: `Failed to update invoice items: ${itemsError.message}` }, { status: 400 });
      }
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
