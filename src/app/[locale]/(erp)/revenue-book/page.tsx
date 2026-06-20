import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { BookOpen } from "lucide-react";
import { RevenueBookClient, type ReceiptRow } from "./revenue-book-client";

export default async function RevenueBookPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non connecté</div>;

  const { data: memberships } = await supabase
    .from("team_members").select("team_id").eq("user_id", user.id).limit(1);
  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>Aucune équipe</div>;

  const [{ data: payments }, { data: incomeRows }] = await Promise.all([
    // Invoice payments — join invoice for HT/TVA/TTC breakdown
    supabase
      .from("invoice_payments")
      .select(`
        id, amount, payment_date,
        invoice:invoice_id(
          invoice_number, subtotal_ht, tax_amount, total_ttc, team_id,
          customer:customer_id(contact_name)
        )
      `)
      .order("payment_date", { ascending: true }),
    // Direct income entries
    supabase
      .from("income")
      .select("id, description, amount, income_date, customer:customer_id(contact_name)")
      .eq("team_id", teamId)
      .order("income_date", { ascending: true }),
  ]);

  const rows: ReceiptRow[] = [];

  // Invoice payments → proportional HT/TVA
  for (const p of payments ?? []) {
    const inv = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice as {
      invoice_number?: string; subtotal_ht?: number; tax_amount?: number;
      total_ttc?: number; team_id?: string; customer?: { contact_name?: string } | { contact_name?: string }[];
    } | null;

    if (!inv || inv.team_id !== teamId) continue;

    const ttc = parseFloat(String(inv.total_ttc || 0));
    const paid = parseFloat(String(p.amount || 0));
    const ratio = ttc > 0 ? paid / ttc : 1;
    const ht = parseFloat(String(inv.subtotal_ht || 0)) * ratio;
    const tva = parseFloat(String(inv.tax_amount || 0)) * ratio;
    const customer = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer as { contact_name?: string } | null;

    rows.push({
      date: p.payment_date,
      nature: `Règlement facture ${inv.invoice_number ?? ""}`,
      ref: inv.invoice_number ?? String(p.id).slice(0, 8),
      client: customer?.contact_name ?? "—",
      ht,
      tva,
      ttc: paid,
      source: "invoice",
    });
  }

  // Direct income → treated as TTC, no TVA breakdown
  for (const r of incomeRows ?? []) {
    const customer = Array.isArray(r.customer) ? r.customer[0] : r.customer as { contact_name?: string } | null;
    const ttc = parseFloat(String(r.amount || 0));
    rows.push({
      date: r.income_date,
      nature: r.description,
      ref: String(r.id).slice(0, 8),
      client: customer?.contact_name ?? r.description,
      ht: ttc,
      tva: 0,
      ttc,
      source: "income",
    });
  }

  // Sort chronologically
  rows.sort((a, b) => a.date.localeCompare(b.date));

  // Build year list for filters
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set<number>(rows.map((r) => new Date(r.date).getFullYear()));
  yearsSet.add(currentYear);
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Livre de recettes</h1>
          <p className="text-sm text-muted-foreground">
            Registre chronologique des encaissements — conforme fiscalité PF auto-entrepreneur
          </p>
        </div>
      </div>

      <RevenueBookClient rows={rows} year={currentYear} years={years} />
    </div>
  );
}
