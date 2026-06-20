import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// POST /api/v1/quotes/[id]/convert — Convert a quote to an invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "quotes", "write");

    const { data, error } = await auth.supabase.rpc("convert_quote_to_invoice", {
      p_quote_id: id,
      p_team_id: teamId,
    });

    if (error) {
      // Handle Postgres error codes or messages
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      }
      if (error.message.includes("already converted") || error.message.includes("rejected") || error.message.includes("expired")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Return the converted invoice details
    // The RPC returns { invoice_id, invoice_number }
    return NextResponse.json({
      data: {
        id: data.invoice_id,
        invoice_number: data.invoice_number,
        status: "draft",
      },
    }, { status: 201 });
  });
}
