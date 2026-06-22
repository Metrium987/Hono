import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  FileText, FileSignature, TrendingUp, TrendingDown,
  AlertTriangle, Clock, Users, Package, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Minus, Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueChart } from "./_components/revenue-chart";
import { Sparkline } from "./_components/sparkline";

function fmt(amount: number) {
  return `${Math.round(amount).toLocaleString("fr-FR")} F`;
}

function daysDiff(dateStr: string): number {
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const t = await getTranslations("dashboard_page");
  const common = await getTranslations("common");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members").select("team_id").eq("user_id", user.id).limit(1);
  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
  const chartStart = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 5); d.setDate(1);
    return d.toISOString().split("T")[0];
  })();

  const [
    { data: invoiceStats },
    { data: quoteStats },
    { data: currentMonthInv },
    { data: prevMonthInv },
    { data: yearExpenses },
    { data: overdueInvoices },
    { data: paidInvoicesYear },
    { data: stockProducts },
    { data: ordersActive },
    { data: chartInvoices },
    { data: chartExpenses },
  ] = await Promise.all([
    supabase.from("invoices").select("id, status").eq("team_id", teamId),
    supabase.from("quotes").select("id, status, total_ttc").eq("team_id", teamId),
    supabase.from("invoices").select("total_ttc").eq("team_id", teamId).eq("status", "paid").gte("issue_date", monthStart).lte("issue_date", today),
    supabase.from("invoices").select("total_ttc").eq("team_id", teamId).eq("status", "paid").gte("issue_date", prevMonthStart).lte("issue_date", prevMonthEnd),
    supabase.from("expenses").select("amount").eq("team_id", teamId).gte("expense_date", yearStart).lte("expense_date", today),
    supabase.from("invoices")
      .select("id, invoice_number, total_ttc, due_date, status, customer:customer_id(id, contact_name)")
      .eq("team_id", teamId)
      .in("status", ["overdue", "sent"])
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(6),
    supabase.from("invoices")
      .select("customer_id, total_ttc, customer:customer_id(contact_name)")
      .eq("team_id", teamId)
      .eq("status", "paid")
      .gte("issue_date", yearStart),
    supabase.from("products")
      .select("id, name, current_stock, low_stock_alert")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .eq("track_stock", true)
      .order("current_stock", { ascending: true })
      .limit(20),
    supabase.from("orders").select("id, status").eq("team_id", teamId).in("status", ["pending", "confirmed", "processing"]),
    supabase.from("invoices").select("total_ttc, issue_date").eq("team_id", teamId).in("status", ["paid", "partial", "sent"]).gte("issue_date", chartStart),
    supabase.from("expenses").select("amount, expense_date").eq("team_id", teamId).gte("expense_date", chartStart),
  ]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const caCurrentMonth = (currentMonthInv ?? []).reduce((s, i) => s + parseFloat(String(i.total_ttc || 0)), 0);
  const caPrevMonth = (prevMonthInv ?? []).reduce((s, i) => s + parseFloat(String(i.total_ttc || 0)), 0);
  const caEvolution = caPrevMonth > 0 ? ((caCurrentMonth - caPrevMonth) / caPrevMonth) * 100 : null;

  const totalExpenses = (yearExpenses ?? []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
  const caYear = (paidInvoicesYear ?? []).reduce((s, i) => s + parseFloat(String(i.total_ttc || 0)), 0);

  const invCounts = {
    total: invoiceStats?.length ?? 0,
    overdue: invoiceStats?.filter((i) => i.status === "overdue").length ?? 0,
    sent: invoiceStats?.filter((i) => i.status === "sent").length ?? 0,
    paid: invoiceStats?.filter((i) => i.status === "paid").length ?? 0,
  };

  const quotesSent = quoteStats?.filter((q) => q.status === "sent") ?? [];
  const quotesAccepted = quoteStats?.filter((q) => q.status === "accepted" || q.status === "converted").length ?? 0;
  const conversionRate = (quoteStats?.length ?? 0) > 0
    ? Math.round((quotesAccepted / quoteStats!.length) * 100) : 0;
  const pendingQuoteValue = quotesSent.reduce((s, q) => s + parseFloat(String(q.total_ttc || 0)), 0);

  // Top 5 clients
  type ClientAcc = Record<string, { name: string; total: number }>;
  const clientAcc = (paidInvoicesYear ?? []).reduce<ClientAcc>((acc, inv) => {
    const cid = inv.customer_id;
    const name = (Array.isArray(inv.customer) ? inv.customer[0]?.contact_name : (inv.customer as { contact_name?: string } | null)?.contact_name) ?? "Inconnu";
    if (!acc[cid]) acc[cid] = { name, total: 0 };
    acc[cid].total += parseFloat(String(inv.total_ttc || 0));
    return acc;
  }, {});
  const topClients = Object.entries(clientAcc)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5);

  // Stock critique
  const criticalStock = (stockProducts ?? [])
    .filter((p) => p.current_stock <= (p.low_stock_alert ?? 0) || p.current_stock === 0)
    .slice(0, 5);

  // Chart data
  const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rev = (chartInvoices ?? []).filter((x) => x.issue_date?.startsWith(key)).reduce((s, x) => s + parseFloat(String(x.total_ttc || 0)), 0);
    const exp = (chartExpenses ?? []).filter((x) => x.expense_date?.startsWith(key)).reduce((s, x) => s + parseFloat(String(x.amount || 0)), 0);
    return { month: MONTHS[d.getMonth()], revenue: Math.round(rev), expenses: Math.round(exp) };
  });

  const overdueList = (overdueInvoices ?? []).map((inv) => ({
    id: inv.id,
    number: inv.invoice_number,
    amount: parseFloat(String(inv.total_ttc || 0)),
    dueDate: inv.due_date,
    daysLate: daysDiff(inv.due_date),
    clientName: (Array.isArray(inv.customer) ? inv.customer[0]?.contact_name : (inv.customer as { contact_name?: string } | null)?.contact_name) ?? "—",
    status: inv.status,
  }));

  const totalOverdueAmount = overdueList.reduce((s, i) => s + i.amount, 0);
  const ordersCount = ordersActive?.length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex gap-2">
          <Link href="./invoices/new" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <FileText className="h-4 w-4" /> {t("new_invoice")}
          </Link>
          <Link href="./quotes/new" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">
            <FileSignature className="h-4 w-4" /> {t("new_quote")}
          </Link>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CA mois */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CA ce mois</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">{fmt(caCurrentMonth)}</div>
            {caEvolution !== null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${caEvolution >= 0 ? "text-green-600" : "text-red-600"}`}>
                {caEvolution >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(caEvolution).toFixed(1)}% vs mois dernier ({fmt(caPrevMonth)})
              </p>
            )}
            {caEvolution === null && caPrevMonth === 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Minus className="h-3 w-3" /> Pas de données le mois dernier</p>
            )}
            <Sparkline data={chartData.map(d => d.revenue)} />
          </CardContent>
        </Card>

        {/* Impayés */}
        <Card className={invCounts.overdue > 0 ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Impayés en retard</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${invCounts.overdue > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono tabular-nums ${invCounts.overdue > 0 ? "text-red-600" : ""}`}>{fmt(totalOverdueAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {invCounts.overdue} facture{invCounts.overdue !== 1 ? "s" : ""} en retard · {invCounts.sent} en attente
            </p>
          </CardContent>
        </Card>

        {/* Devis en attente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Devis en attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tabular-nums">{quotesSent.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {fmt(pendingQuoteValue)} potentiel · {conversionRate}% de conversion
            </p>
          </CardContent>
        </Card>

        {/* Résultat YTD */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Résultat {now.getFullYear()}</CardTitle>
            {caYear - totalExpenses >= 0
              ? <TrendingUp className="h-4 w-4 text-green-600" />
              : <TrendingDown className="h-4 w-4 text-red-600" />
            }
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono tabular-nums ${caYear - totalExpenses >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(Math.abs(caYear - totalExpenses))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {caYear - totalExpenses >= 0 ? "Bénéfice" : "Déficit"} · {fmt(caYear)} encaissé · {fmt(totalExpenses)} dépensé
            </p>
            <Sparkline
              data={chartData.map(d => d.revenue - d.expenses)}
              color={caYear - totalExpenses >= 0 ? "#22c55e" : "#ef4444"}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Graphe + Impayés urgents ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">CA & Dépenses — 6 derniers mois</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <RevenueChart data={chartData} />
          </CardContent>
        </Card>

        {/* Impayés urgents */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-red-500" />
              Impayés à relancer
            </CardTitle>
            <Link href="./invoices?status=overdue" className="text-xs text-primary hover:underline">Tout voir</Link>
          </CardHeader>
          <CardContent>
            {overdueList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun impayé en retard</p>
            ) : (
              <div className="space-y-2">
                {overdueList.map((inv) => (
                  <Link key={inv.id} href={`./invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inv.clientName}</p>
                      <p className="text-xs text-muted-foreground">{inv.number}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-semibold">{fmt(inv.amount)}</p>
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        J+{inv.daysLate}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Top clients + Stock + Commandes ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top clients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Top clients {now.getFullYear()}
            </CardTitle>
            <Link href="./customers" className="text-xs text-primary hover:underline">Voir tous</Link>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Aucune vente enregistrée</p>
            ) : (
              <div className="space-y-3">
                {topClients.map(([, client], idx) => {
                  const pct = caYear > 0 ? (client.total / caYear) * 100 : 0;
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate max-w-[160px]">{client.name}</span>
                        <span className="text-sm text-muted-foreground shrink-0 ml-2">{fmt(client.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock critique */}
        <Card className={criticalStock.length > 0 ? "border-amber-200 bg-amber-50/20 dark:bg-amber-950/10" : ""}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className={`h-4 w-4 ${criticalStock.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              Stock critique
            </CardTitle>
            <Link href="./catalog" className="text-xs text-primary hover:underline">Catalogue</Link>
          </CardHeader>
          <CardContent>
            {criticalStock.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Tous les stocks sont OK</p>
            ) : (
              <div className="space-y-2">
                {criticalStock.map((p) => (
                  <Link key={p.id} href={`./catalog/${p.id}`}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors">
                    <span className="text-sm truncate max-w-[160px]">{p.name}</span>
                    <Badge
                      className={`text-[10px] shrink-0 ${p.current_stock === 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}
                    >
                      {p.current_stock === 0 ? "Rupture" : `${p.current_stock} restants`}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activité rapide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Activité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="./orders" className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors">
              <span className="text-sm">Commandes en cours</span>
              <Badge variant="secondary" className="font-semibold">{ordersCount}</Badge>
            </Link>
            <Link href="./invoices" className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors">
              <span className="text-sm">Factures envoyées</span>
              <Badge variant="secondary" className="font-semibold">{invCounts.sent}</Badge>
            </Link>
            <Link href="./invoices" className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors">
              <span className="text-sm">Factures payées</span>
              <Badge className="bg-green-100 text-green-700 border-green-200 font-semibold">{invCounts.paid}</Badge>
            </Link>
            <Link href="./quotes" className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors">
              <span className="text-sm">Taux conversion devis</span>
              <Badge variant="secondary" className="font-semibold">{conversionRate}%</Badge>
            </Link>
            <div className="pt-2 border-t">
              <Link href="./expenses" className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors">
                <span className="text-sm text-muted-foreground">Dépenses YTD</span>
                <span className="text-sm font-medium text-red-600">{fmt(totalExpenses)}</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
