import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/credit-notes/[id] — Get single credit note with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");
    const { data, error } = await auth.supabase
      .from("credit_notes")
      .select(`
        *,
        customer:customer_id(*),
        invoice:invoice_id(id, invoice_number),
        currency:currency_id(code, symbol, symbol_position),
        items:credit_note_items(*, tax_rates:tax_rate_id(name, rate))
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

// PATCH /api/v1/credit-notes/[id] — Update credit note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const allowedFields = [
      "status", "issue_date", "reason", "notes",
    ];

    const updatePayload: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updatePayload[field] = body[field];
    }
    updatePayload.updated_at = new Date().toISOString();

    // Update credit note status FIRST (before any side effects)
    const { error: updateError } = await auth.supabase
      .from("credit_notes")
      .update(updatePayload)
      .eq("id", id)
      .eq("team_id", teamId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // If issuing the credit note, perform side effects (stock restore, invoice adjustment)
    if (body.status === "issued") {
      const { data: cn } = await auth.supabase
        .from("credit_notes")
        .select("*, items:credit_note_items(*), invoice:invoice_id(id, invoice_number)")
        .eq("id", id)
        .eq("team_id", teamId)
        .single();

      if (cn) {
        // 1. Restore stock via inventory ledger for each tracked product
        for (const item of cn.items) {
          if (item.product_id) {
            const { data: product } = await auth.supabase
              .from("products")
              .select("id, current_stock, track_stock")
              .eq("id", item.product_id)
              .eq("team_id", teamId)
              .single();

            if (product && product.track_stock) {
              const newBalance = (product.current_stock || 0) + parseFloat(item.quantity);

              const { error: stockError } = await auth.supabase
                .from("products")
                .update({ current_stock: newBalance })
                .eq("id", product.id)
                .eq("team_id", teamId);

              if (stockError) {
                console.error("Failed to restore stock for product", product.id, stockError);
                continue;
              }

              await auth.supabase
                .from("inventory_ledger")
                .insert({
                  team_id: teamId,
                  product_id: product.id,
                  transaction_type: "credit_note_return",
                  quantity_change: parseFloat(item.quantity),
                  running_balance: newBalance,
                  reference_type: "credit_note",
                  reference_id: cn.id,
                  description: `Credit note ${cn.credit_note_number} — stock return`,
                });
            }
          }
        }

        // 2. If credit note is linked to an invoice, adjust invoice paid_amount and status
        if (cn.invoice) {
          const { data: invoice } = await auth.supabase
            .from("invoices")
            .select("id, paid_amount, total_ttc, status")
            .eq("id", cn.invoice_id)
            .eq("team_id", teamId)
            .single();

          if (invoice && invoice.paid_amount > 0) {
            const newPaidAmount = Math.max(0, invoice.paid_amount - cn.total_ttc);
            const newStatus = newPaidAmount <= 0
              ? (invoice.status === "paid" || invoice.status === "partial" ? "sent" : invoice.status)
              : "partial";

            await auth.supabase
              .from("invoices")
              .update({
                paid_amount: Math.round(newPaidAmount * 100) / 100,
                status: newStatus,
                paid_at: newPaidAmount <= 0 ? null : undefined,
                updated_at: new Date().toISOString(),
              })
              .eq("id", invoice.id)
              .eq("team_id", teamId);

            await auth.supabase.from("invoice_events").insert({
              invoice_id: invoice.id,
              event_type: "payment_deleted",
              payload: { credit_note_id: cn.id, credit_note_number: cn.credit_note_number, amount: cn.total_ttc },
              created_by: auth.userId,
            });
          }
        }
      }
    }

    const { data } = await auth.supabase
      .from("credit_notes")
      .select("*, items:credit_note_items(*)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/credit-notes/[id] — Delete a draft credit note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const { data: cn } = await auth.supabase
      .from("credit_notes")
      .select("status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!cn) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (cn.status !== "draft") {
      return NextResponse.json({
        error: `Cannot delete a ${cn.status} credit note. Cancel it instead.`,
      }, { status: 409 });
    }

    const { error } = await auth.supabase
      .from("credit_notes")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
