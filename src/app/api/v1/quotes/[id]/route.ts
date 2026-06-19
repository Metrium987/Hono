import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

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

    const updatePayload: Record<string, unknown> = {};
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
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const { data } = await auth.supabase
      .from("quotes")
      .select("*, items:quote_items(*)")
      .eq("id", id)
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
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
