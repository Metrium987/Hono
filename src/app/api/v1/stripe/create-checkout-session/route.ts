import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type InvoiceWithRelations = {
  id: string;
  invoice_number: string;
  total_ttc: number;
  paid_amount: number;
  status: string;
  team_id: string;
  customer: { email?: string; contact_name: string } | Array<{ email?: string; contact_name: string }> | null;
};

// POST /api/v1/stripe/create-checkout-session — Create Stripe Checkout Session for an invoice
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const { invoice_id, success_url, cancel_url } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
    }

    // Fetch invoice
    const { data: invoice, error: invError } = await auth.supabase
      .from("invoices")
      .select("id, invoice_number, total_ttc, paid_amount, status, team_id, customer:customer_id(email, contact_name)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return NextResponse.json({ error: `Cannot pay a ${invoice.status} invoice` }, { status: 409 });
    }

    const remaining = (parseFloat(invoice.total_ttc) || 0) - (parseFloat(invoice.paid_amount) || 0);
    if (remaining <= 0) {
      return NextResponse.json({ error: "Invoice is already fully paid" }, { status: 409 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    try {
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(stripeKey, { apiVersion: "2023-10-16" });

      const customerEmail = Array.isArray(invoice.customer)
        ? invoice.customer[0]?.email
        : (invoice.customer as { email: string; contact_name: string })?.email;

      const session = await stripeClient.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: customerEmail ?? undefined,
        line_items: [
          {
            price_data: {
              currency: "xpf",
              product_data: {
                name: `Facture ${invoice.invoice_number}`,
              },
              unit_amount: Math.round(remaining), // XPF is zero-decimal
            },
            quantity: 1,
          },
        ],
        metadata: {
          invoice_id: invoice.id,
          team_id: teamId,
        },
        success_url: success_url || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/fr/invoices/${invoice.id}?payment=success`,
        cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/fr/invoices/${invoice.id}?payment=cancelled`,
      });

      return NextResponse.json({ url: session.url, session_id: session.id });
    } catch (err) {
      console.error("Stripe session creation error:", err);
      return NextResponse.json({ error: "Failed to create payment session" }, { status: 500 });
    }
  });
}
