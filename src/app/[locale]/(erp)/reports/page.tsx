import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReportsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations("reports_page");
  const common = await getTranslations("common");

  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  // Current year period
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  // ---------- P&L data ----------
  const { data: invoiceRevenue } = await supabase
    .from("invoices")
    .select("total_ttc")
    .eq("team_id", teamId)
    .in("status", ["paid", "partial", "sent"])
    .gte("issue_date", yearStart)
    .lte("issue_date", today);

  const totalInvoiced = (invoiceRevenue ?? []).reduce(
    (sum, inv) => sum + parseFloat(String(inv.total_ttc || "0")), 0
  );

  const { data: otherIncome } = await supabase
    .from("income")
    .select("amount")
    .eq("team_id", teamId)
    .gte("income_date", yearStart)
    .lte("income_date", today);

  const totalOtherIncome = (otherIncome ?? []).reduce(
    (sum, inc) => sum + parseFloat(String(inc.amount || "0")), 0
  );

  const { data: expensesRaw } = await supabase
    .from("expenses")
    .select("amount, category:category_id(name)")
    .eq("team_id", teamId)
    .gte("expense_date", yearStart)
    .lte("expense_date", today);

  const totalExpenses = (expensesRaw ?? []).reduce(
    (sum, exp) => sum + parseFloat(String(exp.amount || "0")), 0
  );

  const categoryMap = new Map<string, number>();
  for (const exp of (expensesRaw ?? []) as Array<Record<string, unknown>>) {
    const cat = exp.category as Array<Record<string, unknown>> | null;
    const catName = cat?.[0]?.name as string ?? t("no_category");
    categoryMap.set(catName, (categoryMap.get(catName) ?? 0) + parseFloat(String(exp.amount || "0")));
  }

  const totalRevenue = totalInvoiced + totalOtherIncome;
  const netIncome = totalRevenue - totalExpenses;

  const pnl = {
    revenue: { total_invoiced: totalInvoiced, other_income: totalOtherIncome, total_revenue: totalRevenue },
    expenses: { total: totalExpenses, by_category: Object.fromEntries(categoryMap) },
    net_income: netIncome,
    metrics: {
      profit_margin_percent: totalRevenue > 0 ? Math.round((netIncome / totalRevenue) * 100) : 0,
      expense_ratio_percent: totalRevenue > 0 ? Math.round((totalExpenses / totalRevenue) * 100) : 0,
    },
  };

  // ---------- VAT by Rate data ----------
  const { data: taxRates } = await supabase
    .from("tax_rates")
    .select("id, name, rate")
    .eq("team_id", teamId);

  // Get invoice IDs in the date range first (avoid dot-notation join on invoice_items)
  const { data: vatInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("team_id", teamId)
    .gte("issue_date", yearStart)
    .lte("issue_date", today);

  const vatInvoiceIds = (vatInvoices ?? []).map((inv) => inv.id);

  type VatRate = { rate_id: string; name: string; rate: number; taxable_base: number; vat_amount: number };
  const vatRates: VatRate[] = [];

  if (vatInvoiceIds.length > 0) {
    for (const tr of taxRates ?? []) {
      const { data: items } = await supabase
        .from("invoice_items")
        .select("line_total_ht")
        .eq("tax_rate_id", tr.id)
        .in("invoice_id", vatInvoiceIds);

      const taxableBase = (items ?? []).reduce(
        (sum, item) => sum + parseFloat(String(item.line_total_ht || "0")), 0
      );
      const vatAmount = taxableBase * (parseFloat(tr.rate) / 100);

      if (taxableBase > 0) {
        vatRates.push({
          rate_id: tr.id,
          name: tr.name,
          rate: parseFloat(tr.rate),
          taxable_base: Math.round(taxableBase * 100) / 100,
          vat_amount: Math.round(vatAmount * 100) / 100,
        });
      }
    }
  }

  const totalVat = vatRates.reduce((sum, r) => sum + r.vat_amount, 0);

  // ---------- Formatting ----------
  function formatCurrency(amount: number) {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("period", { from: new Date(yearStart).toLocaleDateString("fr-FR"), to: new Date(today).toLocaleDateString("fr-FR") })}
        </p>
      </div>

      {/* P&L Summary */}
      <Card>
        <CardHeader><CardTitle>{t("pnl_title")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-sm text-green-700 mb-2">{t("revenue_section")}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>{t("invoiced")}</span><span>{formatCurrency(pnl.revenue.total_invoiced)}</span></div>
                <div className="flex justify-between"><span>{t("other_income")}</span><span>{formatCurrency(pnl.revenue.other_income)}</span></div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>{t("total_revenue")}</span>
                  <span className="text-green-700">{formatCurrency(pnl.revenue.total_revenue)}</span>
                </div>
              </div>
            </div>

            <div className="border-t" />

            <div>
              <h3 className="font-medium text-sm text-red-700 mb-2">{t("expense_section")}</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(pnl.expenses.by_category as Record<string, number>).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between"><span>{cat}</span><span>{formatCurrency(amt)}</span></div>
                ))}
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>{t("total_expenses")}</span>
                  <span className="text-red-700">{formatCurrency(pnl.expenses.total)}</span>
                </div>
              </div>
            </div>

            <div className="border-t" />

            <div className="flex justify-between text-lg font-bold">
              <span>{t("net_income")}</span>
              <span className={pnl.net_income >= 0 ? "text-green-700" : "text-red-700"}>
                {formatCurrency(pnl.net_income)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{pnl.metrics.profit_margin_percent}%</p>
                <p className="text-xs text-muted-foreground">{t("profit_margin")}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{pnl.metrics.expense_ratio_percent}%</p>
                <p className="text-xs text-muted-foreground">{t("expense_ratio")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VAT by Rate */}
      <Card>
        <CardHeader><CardTitle>{t("vat_title")}</CardTitle></CardHeader>
        <CardContent>
          {vatRates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_vat")}</p>
          ) : (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left pb-2 font-medium">{t("th_rate")}</th>
                    <th className="text-right pb-2 font-medium">{t("th_base_ht")}</th>
                    <th className="text-right pb-2 font-medium">{t("th_vat")}</th>
                  </tr>
                </thead>
                <tbody>
                  {vatRates.map((r) => (
                    <tr key={r.name} className="border-b last:border-0">
                      <td className="py-2">{r.name}</td>
                      <td className="text-right py-2">{formatCurrency(r.taxable_base)}</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(r.vat_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between font-bold text-sm border-t pt-2">
                <span>{t("total_vat")}</span>
                <span className="text-primary">{formatCurrency(totalVat)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
