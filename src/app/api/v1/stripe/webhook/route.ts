import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

// POST /api/v1/stripe/webhook — Handle Stripe webhook events
export async function POST(request: NextRequest) {
  const rateKey = `stripe_webhook:global`;
  const rateResult = await rateLimit(rateKey, RATE_LIMIT_CONFIGS.STRIPE_WEBHOOK);
  if (!rateResult.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  try {
    const stripe = (await import("stripe")).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" });

    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    let event: ReturnType<typeof stripeClient.webhooks.constructEvent>;
    try {
      event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const metadata = session.metadata as Record<string, string> | undefined;
      const invoiceId = metadata?.invoice_id;
      const teamId = metadata?.team_id;
      const amountTotal = (session.amount_total as number) || 0;

      if (!invoiceId || !teamId) {
        console.error("Missing metadata in Stripe session");
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const supabase = createAdminClient();

      // Get the default payment method for Stripe
      const { data: paymentMethod } = await supabase
        .from("payment_methods")
        .select("id")
        .eq("team_id", teamId)
        .eq("name", "stripe")
        .single();

      const paymentMethodId = paymentMethod?.id;

      // Get default currency
      const { data: defaultCurrency } = await supabase
        .from("currencies")
        .select("id")
        .eq("team_id", teamId)
        .eq("is_default", true)
        .single();

      const currencyId = defaultCurrency?.id;

      if (!paymentMethodId || !currencyId) {
        console.error("Stripe payment method or default currency not configured");
        return NextResponse.json({ error: "Configuration missing" }, { status: 500 });
      }

      // Record payment
      const { error: payError } = await supabase
        .from("invoice_payments")
        .insert({
          invoice_id: invoiceId,
          amount: amountTotal,
          currency_id: currencyId,
          payment_method_id: paymentMethodId,
          reference: `stripe_${session.id as string}`,
          payment_date: new Date().toISOString().split("T")[0],
          notes: "Paiement en ligne par carte bancaire",
        });

      if (payError) {
        console.error("Failed to record Stripe payment:", payError);
        return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
      }

      // Record invoice event
      await supabase.from("invoice_events").insert({
        invoice_id: invoiceId,
        event_type: "payment_recorded",
        payload: { source: "stripe", session_id: session.id, amount: amountTotal },
      });

      console.log(`Stripe payment recorded for invoice ${invoiceId}: ${amountTotal} XPF`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
