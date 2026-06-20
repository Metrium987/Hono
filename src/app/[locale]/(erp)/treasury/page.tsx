import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TreasuryChart, type TreasuryMonthData } from "./treasury-chart";

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default async function TreasuryPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non connecté</div>;

  const { data: memberships } = await supabase
    .from("team_members").select("team_id").eq("user_id", user.id).limit(1);
  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>Aucune équipe</div>;

  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  // 12 months window
  const start12 = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split("T")[0];

  const [
    { data: payments },
    { data: incomeRows },
    { data: expenseRows },
    { data: pendingInvoices },
  ] = await Promise.all([
    // Actual cash received from invoice payments
    supabase
      .from("invoice_payments")
      .select("amount, payment_date, invoice:invoice_id(team_id)")
      .gte("payment_date", start12)
      .lte("payment_date", today),
    // Direct income entries
    supabase
      .from("income")
      .select("amount, income_date")
      .eq("team_id", teamId)
      .gte("income_date", start12)
      .lte("income_date", today),
    // Expenses (outflows)
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("team_id", teamId)
      .gte("expense_date", start12)
      .lte("expense_date", today),
    // Sent invoices = forecasted receivables
    supabase
      .from("invoices")
      .select("id, invoice_number, total_ttc, due_date, customer:customer_id(contact_name)")
      .eq("team_id", teamId)
      .eq("status", "sent")
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .limit(20),
  ]);

  // Filter payments to this team only (invoice_payments has no team_id directly)
  const teamPayments = (payments ?? []).filter(
    (p) => (Array.isArray(p.invoice) ? p.invoice[0] : p.invoice as { team_id?: string } | null)?.team_id === teamId
  );

  // Build monthly chart data
  const months12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTHS[d.getMonth()] + " " + d.getFullYear().toString().slice(2),
    };
  });

  let cumulativeSolde = 0;
  const chartData: TreasuryMonthData[] = months12.map(({ key, label }) => {
    const entreesPay = teamPayments
      .filter((p) => p.payment_date?.startsWith(key))
      .reduce((s, p) => s + parseFloat(String(p.amount || 0)), 0);
    const entreesInc = (incomeRows ?? [])
      .filter((r) => r.income_date?.startsWith(key))
      .reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0);
    const entrees = entreesPay + entreesInc;
    const sorties = (expenseRows ?? [])
      .filter((r) => r.expense_date?.startsWith(key))
      .reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0);
    cumulativeSolde += entrees - sorties;
    return { month: label, entrees: Math.round(entrees), sorties: Math.round(sorties), solde: Math.round(cumulativeSolde) };
  });

  // KPI totals (12 months)
  const totalEntrees = teamPayments.reduce((s, p) => s + parseFloat(String(p.amount || 0)), 0)
    + (incomeRows ?? []).reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0);
  const totalSorties = (expenseRows ?? []).reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0);
  const soldeReel = totalEntrees - totalSorties;
  const previsionnel = (pendingInvoices ?? []).reduce((s, i) => s + parseFloat(String(i.total_ttc || 0)), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trésorerie</h1>
        <p className="text-sm text-muted-foreground">Flux de trésorerie sur 12 mois glissants</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entrées 12 mois</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{fmt(totalEntrees)}</p>
            <p className="text-xs text-muted-foreground mt-1">Paiements reçus + recettes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sorties 12 mois</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{fmt(totalSorties)}</p>
            <p className="text-xs text-muted-foreground mt-1">Dépenses décaissées</p>
          </CardContent>
        </Card>

        <Card className={soldeReel >= 0 ? "" : "border-red-200"}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde réel</CardTitle>
            <Wallet className={`h-4 w-4 ${soldeReel >= 0 ? "text-primary" : "text-red-600"}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${soldeReel >= 0 ? "" : "text-red-600"}`}>{fmt(soldeReel)}</p>
            <p className="text-xs text-muted-foreground mt-1">Encaissé − décaissé</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde prévisionnel</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{fmt(soldeReel + previsionnel)}</p>
            <p className="text-xs text-muted-foreground mt-1">+{fmt(previsionnel)} à encaisser</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flux mensuel — 12 mois glissants</CardTitle>
        </CardHeader>
        <CardContent>
          <TreasuryChart data={chartData} />
        </CardContent>
      </Card>

      {/* À encaisser */}
      {(pendingInvoices?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">À encaisser — Factures envoyées</CardTitle>
            <Link href="../invoices?status=sent" className="text-xs text-primary hover:underline">
              Voir toutes
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(pendingInvoices ?? []).map((inv) => {
                const customer = Array.isArray(inv.customer)
                  ? inv.customer[0]
                  : inv.customer as { contact_name?: string } | null;
                const isOverdue = inv.due_date < today;
                return (
                  <Link
                    key={inv.id}
                    href={`../invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{customer?.contact_name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{inv.invoice_number}</span>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-semibold">{fmt(parseFloat(String(inv.total_ttc || 0)))}</p>
                      <p className={`text-xs ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                        Éch. {new Date(inv.due_date).toLocaleDateString("fr-FR")}
                        {isOverdue && " — EN RETARD"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
