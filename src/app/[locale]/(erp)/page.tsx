import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, FileSignature, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { RevenueChart } from "./_components/revenue-chart";

function formatCurrency(amount: number) {
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} F`;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const t = await getTranslations("dashboard_page");
  const common = await getTranslations("common");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const chartStart = sixMonthsAgo.toISOString().split("T")[0];

  const [{ data: invoices }, { data: quotes }, { data: invoicesRevenue }, { data: expenses }, { data: recentInvoices }, { data: recentQuotes }, { data: chartInvoices }, { data: chartExpenses }] = await Promise.all([
    supabase.from("invoices").select("id, status").eq("team_id", teamId),
    supabase.from("quotes").select("id, status").eq("team_id", teamId),
    supabase.from("invoices").select("total_ttc").eq("team_id", teamId).in("status", ["paid", "partial", "sent"]).gte("issue_date", yearStart).lte("issue_date", today),
    supabase.from("expenses").select("amount").eq("team_id", teamId).gte("expense_date", yearStart).lte("expense_date", today),
    supabase.from("invoices").select("id, invoice_number, total_ttc, status, created_at").eq("team_id", teamId).order("created_at", { ascending: false }).limit(5),
    supabase.from("quotes").select("id, quote_number, total_ttc, status, created_at").eq("team_id", teamId).order("created_at", { ascending: false }).limit(5),
    supabase.from("invoices").select("total_ttc, issue_date").eq("team_id", teamId).in("status", ["paid", "partial", "sent"]).gte("issue_date", chartStart),
    supabase.from("expenses").select("amount, expense_date").eq("team_id", teamId).gte("expense_date", chartStart),
  ]);

  const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const rev = (chartInvoices ?? [])
      .filter((inv) => inv.issue_date?.startsWith(key))
      .reduce((s, inv) => s + parseFloat(String(inv.total_ttc || 0)), 0);
    const exp = (chartExpenses ?? [])
      .filter((e) => e.expense_date?.startsWith(key))
      .reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
    return { month: MONTH_LABELS[m], revenue: Math.round(rev), expenses: Math.round(exp) };
  });

  const invoiceCounts = {
    total: invoices?.length ?? 0,
    draft: invoices?.filter((i) => i.status === "draft").length ?? 0,
    sent: invoices?.filter((i) => i.status === "sent").length ?? 0,
    paid: invoices?.filter((i) => i.status === "paid").length ?? 0,
    overdue: invoices?.filter((i) => i.status === "overdue").length ?? 0,
  };

  const quoteCounts = {
    total: quotes?.length ?? 0,
    draft: quotes?.filter((q) => q.status === "draft").length ?? 0,
    sent: quotes?.filter((q) => q.status === "sent").length ?? 0,
    accepted: quotes?.filter((q) => q.status === "accepted").length ?? 0,
    converted: quotes?.filter((q) => q.status === "converted").length ?? 0,
  };

  const totalRevenue = (invoicesRevenue ?? []).reduce((s, i) => s + parseFloat(String(i.total_ttc || "0")), 0);
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + parseFloat(String(e.amount || "0")), 0);
  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("period_year", { year: new Date().getFullYear() })}</p>
        </div>
        <div className="flex gap-2">
          <Link href="./invoices/new" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <FileText className="h-4 w-4" /> {t("new_invoice")}
          </Link>
          <Link href="./quotes/new" className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">
            <FileSignature className="h-4 w-4" /> {t("new_quote")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("invoices_title")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceCounts.total}</div>
            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
              <span className="text-yellow-600">{invoiceCounts.draft} brouillon</span>
              <span className="text-blue-600">{invoiceCounts.sent} envoyée</span>
              <span className="text-green-600">{invoiceCounts.paid} payée</span>
              <span className="text-red-600">{invoiceCounts.overdue} en retard</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("quotes_title")}</CardTitle>
            <FileSignature className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quoteCounts.total}</div>
            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
              <span className="text-yellow-600">{quoteCounts.draft} brouillon</span>
              <span className="text-blue-600">{quoteCounts.sent} envoyé</span>
              <span className="text-green-600">{quoteCounts.accepted} accepté</span>
              <span className="text-purple-600">{quoteCounts.converted} converti</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("revenue_title")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("total")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("expenses_title")}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("total")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("net_income_title")}</CardTitle>
            <DollarSign className={`h-4 w-4 ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? "text-green-700" : "text-red-700"}`}>
              {formatCurrency(Math.abs(netIncome))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{netIncome >= 0 ? "Bénéfice" : "Perte"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CA & Dépenses — 6 derniers mois</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <RevenueChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("recent_invoices")}</CardTitle>
            <Link href="./invoices" className="text-xs text-primary hover:underline">{t("view_all")}</Link>
          </CardHeader>
          <CardContent>
            {(!recentInvoices || recentInvoices.length === 0) ? (
              <p className="text-sm text-muted-foreground">{t("no_invoices")}</p>
            ) : (
              <div className="space-y-2">
                {recentInvoices.map((inv) => (
                  <Link key={inv.id} href={`./invoices/${inv.id}`} className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors">
                    <div>
                      <p className="text-sm font-medium">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(parseFloat(String(inv.total_ttc || "0")))}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        inv.status === "paid" ? "bg-green-100 text-green-700" :
                        inv.status === "overdue" ? "bg-red-100 text-red-700" :
                        inv.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{inv.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("recent_quotes")}</CardTitle>
            <Link href="./quotes" className="text-xs text-primary hover:underline">{t("view_all")}</Link>
          </CardHeader>
          <CardContent>
            {(!recentQuotes || recentQuotes.length === 0) ? (
              <p className="text-sm text-muted-foreground">{t("no_quotes")}</p>
            ) : (
              <div className="space-y-2">
                {recentQuotes.map((q) => (
                  <Link key={q.id} href={`./quotes/${q.id}`} className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors">
                    <div>
                      <p className="text-sm font-medium">{q.quote_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(parseFloat(String(q.total_ttc || "0")))}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        q.status === "accepted" || q.status === "converted" ? "bg-green-100 text-green-700" :
                        q.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                        q.status === "rejected" || q.status === "expired" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{q.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
