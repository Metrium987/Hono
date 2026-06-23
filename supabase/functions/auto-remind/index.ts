// Edge Function auto-remind
// Appelée chaque jour à 08h00 heure Tahiti via pg_cron (cf. migration 00034)
// 1. Marque les factures échues comme "overdue"
// 2. Marque les devis expirés comme "expired"
// 3. Crée des alertes système pour les impayés en retard

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async () => {
  const today = new Date().toISOString().split("T")[0];
  const errors: string[] = [];

  // 1. Marquer les factures envoyées dépassant leur échéance → "overdue"
  const { data: overdueInvoices, error: invErr } = await supabase
    .from("invoices")
    .update({ status: "overdue", updated_at: new Date().toISOString() })
    .in("status", ["sent", "partial"])
    .lt("due_date", today)
    .is("deleted_at", null)
    .select("id, team_id, invoice_number, total_ttc, customer_id");

  if (invErr) errors.push(`invoices overdue: ${invErr.message}`);

  // 2. Créer une alerte système par facture nouvellement overdue
  if (overdueInvoices?.length) {
    const alerts = overdueInvoices.map((inv) => ({
      team_id: inv.team_id,
      alert_type: "ar_overdue",
      severity: "warning",
      title: `Facture impayée : ${inv.invoice_number}`,
      message: `La facture ${inv.invoice_number} est en retard de paiement.`,
      entity_type: "invoice",
      entity_id: inv.id,
      is_dismissed: false,
    }));
    const { error: alertErr } = await supabase.from("system_alerts").insert(alerts);
    if (alertErr) errors.push(`alerts insert: ${alertErr.message}`);
  }

  // 3. Marquer les devis dépassant leur date de validité → "expired"
  const { data: expiredQuotes, error: quoteErr } = await supabase
    .from("quotes")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .in("status", ["draft", "sent"])
    .lt("validity_date", today)
    .is("deleted_at", null)
    .select("id, team_id, quote_number");

  if (quoteErr) errors.push(`quotes expired: ${quoteErr.message}`);

  // 4. Créer des alertes pour les devis expirés
  if (expiredQuotes?.length) {
    const alerts = expiredQuotes.map((q) => ({
      team_id: q.team_id,
      alert_type: "quote_expired",
      severity: "info",
      title: `Devis expiré : ${q.quote_number}`,
      message: `Le devis ${q.quote_number} a dépassé sa date de validité.`,
      entity_type: "quote",
      entity_id: q.id,
      is_dismissed: false,
    }));
    const { error: alertErr } = await supabase.from("system_alerts").insert(alerts);
    if (alertErr) errors.push(`quote alerts: ${alertErr.message}`);
  }

  const summary = {
    date: today,
    invoices_marked_overdue: overdueInvoices?.length ?? 0,
    quotes_marked_expired: expiredQuotes?.length ?? 0,
    errors: errors.length ? errors : undefined,
  };

  console.log("[auto-remind]", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    status: errors.length ? 207 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
