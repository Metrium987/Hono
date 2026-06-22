"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type PnlData = {
  period: { from: string; to: string };
  revenue: { total_invoiced: number; other_income: number; total_revenue: number };
  expenses: { total: number; by_category: Record<string, number> };
  net_income: number;
  metrics: { profit_margin_percent: number; expense_ratio_percent: number };
};

type VatData = {
  period: { from: string; to: string };
  rates: Array<{ rate_id: string; name: string; rate: number; taxable_base: number; vat_amount: number }>;
  total_vat: number;
};

type Customer = { id: string; company_name: string | null; contact_name: string; n_tahiti: string | null };

type ClientStatementData = {
  customer: Customer | null;
  period: { from: string; to: string };
  summary: { total_billed: number; total_paid: number; total_remaining: number };
  invoices: Array<{
    id: string; number: string; status: string; total_ttc: number;
    paid: number; remaining: number; issue_date: string; due_date: string; currency: string;
  }>;
  payments: Array<{ amount: number; payment_date: string; reference: string | null; payment_method: Array<{ display_name: string; name: string }> | null }>;
};

function fmt(amount: number) {
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`;
}

export default function ReportsPage() {
  const perm = useClientPermission("reports", "read");
  const t = useTranslations("reports_page");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState("pnl");
  const [dateFrom, setDateFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState("");

  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [vat, setVat] = useState<VatData | null>(null);
  const [statement, setStatement] = useState<ClientStatementData | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        if (!perm.teamId) return;

        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        const [custRes] = await Promise.all([
          supabase.from("customers").select("id, company_name, contact_name, n_tahiti").eq("team_id", perm.teamId).order("contact_name"),
        ]);
        setCustomers(custRes.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    init();
  }, [perm.teamId]);

  useEffect(() => {
    async function fetchReport() {
      if (!perm.teamId) return;
      setFetching(true);
      try {
        const params = new URLSearchParams({ type: reportType, date_from: dateFrom, date_to: dateTo, team_id: perm.teamId ?? "" });
        if (reportType === "client-statement" && customerId) params.set("customer_id", customerId);

        const res = await fetch(`/api/v1/reports?${params}`);
        const body = await res.json();
        if (!res.ok) return;

        if (reportType === "pnl") setPnl(body.data);
        else if (reportType === "vat") setVat(body.data);
        else if (reportType === "client-statement") setStatement(body.data);
      } catch { /* ignore */ }
      setFetching(false);
    }
    fetchReport();
  }, [perm.teamId, reportType, dateFrom, dateTo, customerId]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  }

  if (perm.loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) {
    return <ClientForbiddenPage module="reports" />;
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <div className="flex gap-1">
                <Button size="sm" variant={reportType === "pnl" ? "default" : "outline"} onClick={() => setReportType("pnl")}>
                  P&amp;L
                </Button>
                <Button size="sm" variant={reportType === "vat" ? "default" : "outline"} onClick={() => setReportType("vat")}>
                  TVA par taux
                </Button>
                <Button size="sm" variant={reportType === "client-statement" ? "default" : "outline"} onClick={() => setReportType("client-statement")}>
                  Relevé client
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">Du</Label>
              <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">Au</Label>
              <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
            </div>
            {reportType === "client-statement" && (
              <div className="space-y-1 min-w-[200px]">
                <Label htmlFor="customer" className="text-xs">Client</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger id="customer" className="h-9"><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name || c.contact_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {fetching && (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      )}

      {/* P&L Report */}
      {!fetching && reportType === "pnl" && pnl && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("period", { from: formatDate(pnl.period.from), to: formatDate(pnl.period.to) })}
          </p>
          <Card>
            <CardHeader><CardTitle>{t("pnl_title")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-green-700 mb-2">{t("revenue_section")}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>{t("invoiced")}</span><span>{fmt(pnl.revenue.total_invoiced)}</span></div>
                    <div className="flex justify-between"><span>{t("other_income")}</span><span>{fmt(pnl.revenue.other_income)}</span></div>
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>{t("total_revenue")}</span>
                      <span className="text-green-700">{fmt(pnl.revenue.total_revenue)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t" />
                <div>
                  <h3 className="font-medium text-sm text-red-700 mb-2">{t("expense_section")}</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(pnl.expenses.by_category).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between"><span>{cat || t("no_category")}</span><span>{fmt(amt)}</span></div>
                    ))}
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>{t("total_expenses")}</span>
                      <span className="text-red-700">{fmt(pnl.expenses.total)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t" />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("net_income")}</span>
                  <span className={pnl.net_income >= 0 ? "text-green-700" : "text-red-700"}>{fmt(pnl.net_income)}</span>
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
        </>
      )}

      {/* VAT by Rate */}
      {!fetching && reportType === "vat" && vat && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("period", { from: formatDate(vat.period.from), to: formatDate(vat.period.to) })}
          </p>
          <Card>
            <CardHeader><CardTitle>{t("vat_title")}</CardTitle></CardHeader>
            <CardContent>
              {vat.rates.length === 0 ? (
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
                      {vat.rates.map((r) => (
                        <tr key={r.name} className="border-b last:border-0">
                          <td className="py-2">{r.name} ({r.rate}%)</td>
                          <td className="text-right py-2">{fmt(r.taxable_base)}</td>
                          <td className="text-right py-2 font-medium">{fmt(r.vat_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between font-bold text-sm border-t pt-2">
                    <span>{t("total_vat")}</span>
                    <span className="text-primary">{fmt(vat.total_vat)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Client Statement */}
      {!fetching && reportType === "client-statement" && statement && (
        <>
          <p className="text-sm text-muted-foreground">
            Période : {formatDate(statement.period.from)} — {formatDate(statement.period.to)}
          </p>
          <Card>
            <CardHeader>
              <CardTitle>
                {statement.customer
                  ? `Relevé client — ${statement.customer.company_name || statement.customer.contact_name}`
                  : "Relevé client"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!customerId ? (
                <p className="text-sm text-muted-foreground">Sélectionnez un client pour voir son relevé.</p>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">{fmt(statement.summary.total_billed)}</p>
                      <p className="text-xs text-muted-foreground">Total facturé</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{fmt(statement.summary.total_paid)}</p>
                      <p className="text-xs text-muted-foreground">Total payé</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-red-700">{fmt(statement.summary.total_remaining)}</p>
                      <p className="text-xs text-muted-foreground">Restant dû</p>
                    </div>
                  </div>

                  {/* Invoices */}
                  <div>
                    <h3 className="font-medium text-sm mb-2">Factures</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left pb-2 font-medium">N°</th>
                          <th className="text-left pb-2 font-medium">Date</th>
                          <th className="text-left pb-2 font-medium">Statut</th>
                          <th className="text-right pb-2 font-medium">Montant</th>
                          <th className="text-right pb-2 font-medium">Payé</th>
                          <th className="text-right pb-2 font-medium">Restant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.invoices.map((inv) => (
                          <tr key={inv.id} className="border-b last:border-0">
                            <td className="py-2">{inv.number}</td>
                            <td className="py-2 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                            <td className="py-2">{inv.status}</td>
                            <td className="text-right py-2">{fmt(inv.total_ttc)}</td>
                            <td className="text-right py-2 text-green-700">{fmt(inv.paid)}</td>
                            <td className="text-right py-2 text-red-700">{fmt(inv.remaining)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Payments */}
                  {statement.payments.length > 0 && (
                    <div>
                      <h3 className="font-medium text-sm mb-2">Paiements</h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left pb-2 font-medium">Date</th>
                            <th className="text-left pb-2 font-medium">Méthode</th>
                            <th className="text-left pb-2 font-medium">Référence</th>
                            <th className="text-right pb-2 font-medium">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statement.payments.map((p, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2">{formatDate(p.payment_date)}</td>
                              <td className="py-2">
                                {(p.payment_method as Array<{ display_name: string; name: string }> | null)?.[0]?.display_name
                                  ?? (p.payment_method as Array<{ display_name: string; name: string }> | null)?.[0]?.name
                                  ?? "—"}
                              </td>
                              <td className="py-2 text-muted-foreground">{p.reference || "—"}</td>
                              <td className="text-right py-2">{fmt(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
