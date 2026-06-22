import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/cron/generate-recurring
// Vercel Cron — quotidien 06h Tahiti (UTC−10 = 16:00 UTC)
// Génère les factures récurrentes dont next_generation_date <= aujourd'hui
export const maxDuration = 60;

function addFrequency(date: Date, frequency: string, intervalCount: number): Date {
  const d = new Date(date);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7 * intervalCount);
      break;
    case "monthly_date":
    case "monthly_weekday":
      d.setMonth(d.getMonth() + intervalCount);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3 * intervalCount);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + intervalCount);
      break;
    case "custom":
      d.setDate(d.getDate() + intervalCount);
      break;
  }
  return d;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split("T")[0];

  const { data: templates, error } = await supabase
    .from("recurring_invoices")
    .select(`
      *,
      items:recurring_invoice_items(*)
    `)
    .eq("is_active", true)
    .lte("next_generation_date", today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .limit(100);

  if (error) {
    console.error("[cron/generate-recurring]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pré-charger tous les tax_rates nécessaires en une seule requête (évite N+1)
  const allItems = (templates ?? []).flatMap((tpl) => tpl.items ?? []);
  const taxRateIds = [...new Set(allItems.map((i) => i.tax_rate_id).filter(Boolean))] as string[];
  const taxRateMap = new Map<string, number>();
  if (taxRateIds.length > 0) {
    const { data: taxRates } = await supabase
      .from("tax_rates")
      .select("id, rate")
      .in("id", taxRateIds);
    for (const tr of taxRates ?? []) {
      taxRateMap.set(tr.id, tr.rate);
    }
  }

  let generated = 0;
  let skipped = 0;

  for (const tpl of templates ?? []) {
    try {
      const { data: numData } = await supabase
        .rpc("generate_next_invoice_number", { p_team_id: tpl.team_id, p_prefix: tpl.prefix ?? "FAC-" });

      const invoiceNumber = numData as string;

      let subtotalHt = 0;
      let taxAmount = 0;
      const items = tpl.items ?? [];

      for (const item of items) {
        const lineHt = parseFloat(String(item.quantity)) * parseFloat(String(item.unit_price_ht));
        subtotalHt += lineHt;
        if (item.tax_rate_id) {
          const rate = taxRateMap.get(item.tax_rate_id) ?? 0;
          taxAmount += lineHt * (rate / 100);
        }
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (tpl.payment_terms ?? 30));

      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          team_id: tpl.team_id,
          customer_id: tpl.customer_id,
          currency_id: tpl.currency_id,
          invoice_number: invoiceNumber,
          status: "draft",
          issue_date: today,
          due_date: dueDate.toISOString().split("T")[0],
          payment_terms: tpl.payment_terms ?? 30,
          subtotal_ht: Math.round(subtotalHt * 100) / 100,
          tax_amount: Math.round(taxAmount * 100) / 100,
          total_ttc: Math.round((subtotalHt + taxAmount) * 100) / 100,
          notes: tpl.notes,
        })
        .select("id")
        .single();

      if (invErr || !invoice) { skipped++; continue; }

      if (items.length > 0) {
        await supabase.from("invoice_items").insert(
          items.map((item: { description: string; quantity: number; unit_price_ht: number; tax_rate_id: string | null; product_id: string | null; position: number }) => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price_ht: item.unit_price_ht,
            line_total_ht: parseFloat(String(item.quantity)) * parseFloat(String(item.unit_price_ht)),
            tax_rate_id: item.tax_rate_id ?? null,
            product_id: item.product_id ?? null,
            position: item.position ?? 0,
          }))
        );
      }

      const nextDate = addFrequency(new Date(tpl.next_generation_date), tpl.frequency, tpl.interval_count ?? 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];
      const shouldDeactivate = tpl.end_date && nextDateStr > tpl.end_date;

      await supabase.from("recurring_invoices").update({
        next_generation_date: nextDateStr,
        last_generated_at: new Date().toISOString(),
        is_active: shouldDeactivate ? false : true,
      }).eq("id", tpl.id);

      generated++;
    } catch (err) {
      console.error("[cron/generate-recurring] erreur pour", tpl.id, err);
      skipped++;
    }
  }

  console.log(`[cron/generate-recurring] ${generated} générées, ${skipped} ignorées`);
  return NextResponse.json({ ok: true, generated, skipped });
}
