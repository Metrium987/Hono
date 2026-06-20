import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

type ItemInput = { description?: string; quantity?: string | number; unit_price_ht?: string | number; product_id?: string | null };

/**
 * POST /api/v1/portal/quote-request
 *
 * Storefront quote request endpoint.
 * Creates a customer (if new) and a draft quote with items.
 * Designed to be called without authentication — storefront users submit their contact info.
 *
 * Body: {
 *   email: string;          // Required — used to find/create customer + portal user
 *   name: string;           // Required — contact name
 *   phone?: string;
 *   company_name?: string;
 *   notes?: string;
 *   items: Array<{
 *     product_id?: string;
 *     description: string;
 *     quantity: number;
 *     unit_price_ht: number;
 *   }>;
 *   team_id?: string;       // Optional — detected from products if omitted
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";
    const rateKey = `public_quote:${ip}`;
    const rateResult = await rateLimit(rateKey, RATE_LIMIT_CONFIGS.PUBLIC_QUOTE);
    if (!rateResult.allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { email, name, phone, company_name, notes, items } = body;

    if (!email || !name) {
      return NextResponse.json({ error: "email and name are required" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Detect team from first product or use env default
    let teamId = body.team_id;
    if (!teamId) {
      const firstProductId = items[0]?.product_id;
      if (firstProductId) {
        const { data: product } = await supabase
          .from("products")
          .select("team_id")
          .eq("id", firstProductId)
          .single();
        teamId = product?.team_id;
      }
    }
    if (!teamId) {
      teamId = process.env.NEXT_PUBLIC_DEFAULT_TEAM_ID;
    }
    if (!teamId) {
      return NextResponse.json({
        error: "Could not determine team. Please contact support.",
      }, { status: 400 });
    }

    // Find or create customer
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, portal_enabled")
      .eq("email", email.toLowerCase().trim())
      .eq("team_id", teamId)
      .single();

    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from("customers")
        .insert({
          team_id: teamId,
          contact_name: name,
          company_name: company_name ?? null,
          email: email.toLowerCase().trim(),
          phone: phone ?? null,
          source: "storefront",
          portal_enabled: true,
          consent_recorded: true,
          consent_recorded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (custError) {
        console.error("Failed to create customer:", custError);
        return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
      }
      customerId = newCustomer.id;

      // Create portal user for future access
      const { error: puError } = await supabase
        .from("portal_users")
        .insert({
          customer_id: customerId,
          email: email.toLowerCase().trim(),
          name,
        })
        .select()
        .single();

      if (puError) {
        console.error("Failed to create portal user:", puError);
        // Roll back the customer we just created. Note: no quote exists yet at
        // this point (the quote is created later at line ~178), so only the
        // customer row needs cleanup. The earlier code referenced an undefined
        // `quote.id` here, which threw ReferenceError and was silently swallowed.
        await supabase.from("customers").delete().eq("id", customerId);
        return NextResponse.json({ error: "Failed to create portal account" }, { status: 500 });
      }
    }

    // Get default currency for the team
    const { data: defaultCurrency } = await supabase
      .from("currencies")
      .select("id")
      .eq("team_id", teamId)
      .eq("is_default", true)
      .single();

    const currencyId = defaultCurrency?.id ?? (await supabase
      .from("currencies")
      .select("id")
      .eq("team_id", teamId)
      .limit(1)
      .single()
    ).data?.id;

    if (!currencyId) {
      return NextResponse.json({ error: "No currency configured for this team" }, { status: 500 });
    }

    // Calculate totals
    let subtotalHt = 0;
    const itemRows = items.map((item: ItemInput) => {
      const qty = parseFloat(item.quantity as string) || 1;
      const unitPrice = parseFloat(item.unit_price_ht as string) || 0;
      const lineTotal = qty * unitPrice;
      subtotalHt += lineTotal;
      return {
        product_id: item.product_id ?? null,
        description: item.description ?? "",
        quantity: qty,
        unit_price_ht: Math.round(unitPrice * 100) / 100,
        line_total_ht: Math.round(lineTotal * 100) / 100,
        sort_order: 0,
      };
    });

    // Generate quote number
    const { data: numData, error: numError } = await supabase
      .rpc("generate_next_quote_number", { p_team_id: teamId });

    if (numError || !numData) {
      return NextResponse.json({ error: "Failed to generate quote number" }, { status: 500 });
    }

    const quoteNumber = Array.isArray(numData) ? numData[0] : numData;

    // Create quote
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        team_id: teamId,
        customer_id: customerId,
        quote_number: quoteNumber,
        status: "draft",
        issue_date: new Date().toISOString().split("T")[0],
        validity_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        subtotal_ht: Math.round(subtotalHt * 100) / 100,
        tax_amount: 0,
        total_ttc: Math.round(subtotalHt * 100) / 100,
        currency_id: currencyId,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (quoteError) {
      console.error("Failed to create quote:", quoteError);
      return NextResponse.json({ error: "Failed to create quote" }, { status: 500 });
    }

    // Create quote items
    const itemsWithQuoteId = itemRows.map((item: { product_id: string | null; description: string; quantity: number; unit_price_ht: number; line_total_ht: number; sort_order: number }) => ({
      ...item,
      quote_id: quote.id,
    }));

    const { error: itemsError } = await supabase
      .from("quote_items")
      .insert(itemsWithQuoteId);

    if (itemsError) {
      await supabase.from("quotes").delete().eq("id", quote.id);
      return NextResponse.json({ error: "Failed to create quote items" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      quote_id: quote.id,
      quote_number: quoteNumber,
      message: "Votre demande de devis a été reçue.",
    }, { status: 201 });
  } catch (err) {
    console.error("Quote request error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
