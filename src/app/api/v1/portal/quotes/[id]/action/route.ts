import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/portal/session";
import { resend, DEFAULT_FROM } from "@/lib/email/resend";

// POST /api/v1/portal/quotes/[id]/action — Accept or reject a quote from the customer portal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  if (action !== "accepted" && action !== "rejected") {
    return NextResponse.json({ error: "action doit être 'accepted' ou 'rejected'" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const admin = createAdminClient();

  // Verify the quote belongs to this customer and fetch items + team info
  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .select(`
      id, status, quote_number, team_id, customer_id, currency_id,
      subtotal_ht, tax_amount, total_ttc,
      items:quote_items(id, product_id, description, quantity, unit_price_ht, tax_rate_id, line_total_ht, sort_order)
    `)
    .eq("id", id)
    .eq("customer_id", session.customerId)
    .is("deleted_at", null)
    .single();

  if (quoteErr || !quote) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }

  if (!["sent", "viewed"].includes(quote.status)) {
    return NextResponse.json({
      error: `Ce devis ne peut pas être ${action === "accepted" ? "accepté" : "refusé"} (statut actuel : ${quote.status})`,
    }, { status: 409 });
  }

  const { error: updateErr } = await supabase
    .from("quotes")
    .update({
      status: action,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("customer_id", session.customerId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  let orderId: string | null = null;

  // Auto-create order when client accepts
  if (action === "accepted") {
    try {
      const items = Array.isArray(quote.items) ? quote.items : [];

      const { data: order, error: orderErr } = await admin
        .from("orders")
        .insert({
          team_id: quote.team_id,
          customer_id: quote.customer_id,
          source: "storefront",
          status: "pending",
          quote_id: id,
          notes: `Créé automatiquement depuis le devis ${quote.quote_number} — accepté par le client via le portail`,
        })
        .select("id")
        .single();

      if (!orderErr && order) {
        orderId = order.id;

        if (items.length > 0) {
          await admin.from("order_items").insert(
            items.map((item) => ({
              order_id: order.id,
              product_id: item.product_id ?? null,
              description: item.description,
              quantity: item.quantity,
              unit_price_ht: item.unit_price_ht,
            }))
          );
        }
      }
    } catch {
      // Order creation is best-effort — quote is already accepted
    }

    // Notify staff by email (non-blocking)
    try {
      const { data: ownerRows } = await admin
        .from("team_members")
        .select("user:user_id(email, full_name)")
        .eq("team_id", quote.team_id)
        .eq("is_owner", true)
        .limit(3);

      const owners = (ownerRows ?? []).map((r) => {
        const u = Array.isArray(r.user) ? r.user[0] : r.user;
        return u as { email: string; full_name: string | null } | null;
      }).filter(Boolean);

      const { data: customer } = await admin
        .from("customers")
        .select("contact_name, company_name, email")
        .eq("id", quote.customer_id)
        .single();

      const clientName = customer?.company_name ?? customer?.contact_name ?? "Client";

      if (resend && owners.length > 0) {
        const toEmails = owners.map((o) => o!.email).filter(Boolean);
        await resend.emails.send({
          from: DEFAULT_FROM,
          to: toEmails,
          subject: `✅ Devis ${quote.quote_number} accepté par ${clientName}`,
          html: `
            <p>Bonjour,</p>
            <p>Le client <strong>${clientName}</strong> a accepté le devis <strong>${quote.quote_number}</strong> depuis le portail client.</p>
            ${orderId ? `<p>Une commande a été créée automatiquement (ID: ${orderId.slice(0, 8)}…).</p>` : "<p>Veuillez créer la commande correspondante depuis l'ERP.</p>"}
            <p>Connectez-vous à votre espace pour traiter cette commande.</p>
          `,
        });
      }
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({
    ok: true,
    status: action,
    quote_number: quote.quote_number,
    order_id: orderId,
  });
}
