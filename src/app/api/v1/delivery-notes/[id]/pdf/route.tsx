import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { pdf } from "@react-pdf/renderer";
import { DeliveryNotePdfDocument, type DeliveryNotePdfData } from "@/lib/pdf/delivery-note-pdf";

// GET /api/v1/delivery-notes/[id]/pdf — Download delivery note PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "orders", "read");

    const { data: dn, error } = await auth.supabase
      .from("delivery_notes")
      .select(`
        id, note_number, status, created_at, dispatched_at, delivered_at,
        delivery_address, recipient_name, recipient_id_doc, notes,
        order:order_id(
          order_number,
          customer:customer_id(id, company_name, contact_name, email, phone, address_line1, city, island, n_tahiti, is_b2b)
        ),
        items:delivery_note_items(id, quantity, unit_price, product:product_id(name, sku))
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error || !dn) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    const { data: team, error: teamError } = await auth.supabase
      .from("teams")
      .select("name, email, phone, address_line1, address_line2, city, island, postal_code, n_tahiti, rcs_number")
      .eq("id", teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 500 });
    }

    const order = Array.isArray(dn.order) ? dn.order[0] : dn.order;
    const rawCustomer = order
      ? (Array.isArray((order as { customer?: unknown }).customer)
        ? (order as { customer?: unknown[] }).customer?.[0]
        : (order as { customer?: unknown }).customer)
      : null;

    const customer = rawCustomer
      ? (rawCustomer as {
          company_name: string | null;
          contact_name: string;
          email: string | null;
          phone: string | null;
          address_line1: string | null;
          city: string | null;
          island: string | null;
          n_tahiti: string | null;
          is_b2b: boolean;
        })
      : null;

    const items = Array.isArray(dn.items)
      ? dn.items.map((item) => ({
          id: item.id as string,
          quantity: item.quantity as number,
          unit_price: item.unit_price as number | null,
          product: item.product
            ? (Array.isArray(item.product)
              ? { name: (item.product[0] as { name: string; sku: string | null }).name, sku: (item.product[0] as { name: string; sku: string | null }).sku }
              : { name: (item.product as { name: string; sku: string | null }).name, sku: (item.product as { name: string; sku: string | null }).sku })
            : null,
        }))
      : [];

    const pdfData: DeliveryNotePdfData = {
      id: dn.id as string,
      note_number: dn.note_number as string,
      status: dn.status as string,
      created_at: dn.created_at as string,
      dispatched_at: dn.dispatched_at as string | null,
      delivered_at: dn.delivered_at as string | null,
      delivery_address: dn.delivery_address as string | null,
      recipient_name: dn.recipient_name as string | null,
      recipient_id_doc: dn.recipient_id_doc as string | null,
      notes: dn.notes as string | null,
      order: order ? { order_number: (order as { order_number: string }).order_number } : null,
      items,
      team: {
        name: team.name,
        email: team.email ?? null,
        phone: team.phone ?? null,
        address_line1: team.address_line1 ?? null,
        address_line2: team.address_line2 ?? null,
        city: team.city ?? null,
        island: team.island ?? null,
        postal_code: team.postal_code ?? null,
        n_tahiti: team.n_tahiti ?? null,
        rcs_number: team.rcs_number ?? null,
      },
      customer,
    };

    try {
      const pdfBlob = await pdf(<DeliveryNotePdfDocument data={pdfData} />).toBlob();
      const filename = `bon-livraison-${dn.note_number ?? id.slice(0, 8)}.pdf`;

      return new NextResponse(pdfBlob, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfBlob.size.toString(),
        },
      });
    } catch (renderError) {
      console.error("Delivery note PDF generation error:", renderError);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  });
}
