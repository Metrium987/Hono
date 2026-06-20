"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTeamId } from "@/hooks/use-team-id";

type Customer = { id: string; company_name: string | null; contact_name: string };
type Currency = { id: string; code: string; symbol: string };
type TaxRate = { id: string; name: string; rate: number };
type Item = { description: string; quantity: string; unit_price_ht: string; tax_rate_id: string };

const emptyItem = (): Item => ({ description: "", quantity: "1", unit_price_ht: "", tax_rate_id: "" });

export default function NewCreditNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("credit_note_form");
  const common = useTranslations("common");
  const teamId = useTeamId();

  const invoiceId = searchParams.get("invoice_id");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [linkedInvoiceNumber, setLinkedInvoiceNumber] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  useEffect(() => {
    if (!teamId) return;
    async function load() {
      const [cusRes, curRes, taxRes] = await Promise.all([
        fetch(`/api/v1/customers?limit=200&team_id=${teamId}`),
        fetch(`/api/v1/currencies?team_id=${teamId}`),
        fetch(`/api/v1/settings/tax-rates?team_id=${teamId}`),
      ]);
      const [cusData, curData, taxData] = await Promise.all([
        cusRes.json(), curRes.json(), taxRes.json(),
      ]);
      setCustomers(cusData.data ?? []);
      setCurrencies(curData.data ?? []);
      setTaxRates(taxData.data ?? []);
      if (curData.data?.[0]) setCurrencyId(curData.data[0].id);

      if (invoiceId) {
        const invRes = await fetch(`/api/v1/invoices/${invoiceId}?team_id=${teamId}`);
        const invData = await invRes.json();
        const inv = invData.data;
        if (inv) {
          setLinkedInvoiceNumber(inv.invoice_number);
          setCustomerId(inv.customer_id ?? "");
          const invCurrencyId = Array.isArray(inv.currency) ? inv.currency[0]?.id : inv.currency_id;
          if (invCurrencyId) setCurrencyId(invCurrencyId);
          const invItems = Array.isArray(inv.items) ? inv.items : [];
          if (invItems.length > 0) {
            setItems(invItems.map((item: { description: string; quantity: number; unit_price_ht: number | null; tax_rate_id: string | null }) => ({
              description: item.description ?? "",
              quantity: String(item.quantity ?? 1),
              unit_price_ht: String(item.unit_price_ht ?? ""),
              tax_rate_id: item.tax_rate_id ?? "",
            })));
          }
        }
      }
    }
    load();
  }, [teamId, invoiceId]);

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof Item, value: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function totalHt() {
    return items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price_ht) || 0);
    }, 0);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customerId) { setError(t("error_customer")); return; }
    if (!currencyId) { setError(t("error_currency")); return; }
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) { setError(t("error_items")); return; }
    if (!teamId) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/credit-notes?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          invoice_id: invoiceId ?? null,
          currency_id: currencyId,
          issue_date: issueDate,
          reason: reason.trim() || null,
          items: validItems.map((item) => ({
            description: item.description.trim(),
            quantity: parseFloat(item.quantity) || 1,
            unit_price_ht: item.unit_price_ht ? parseFloat(item.unit_price_ht) : 0,
            tax_rate_id: item.tax_rate_id || null,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? common("unknown_error"));
        return;
      }
      const data = await res.json();
      router.push(`../credit-notes/${data.data.id}`);
      router.refresh();
    } catch {
      setError(common("connection_error"));
    } finally {
      setLoading(false);
    }
  }

  const total = totalHt();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href={invoiceId ? `../invoices/${invoiceId}` : "../credit-notes"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {invoiceId ? t("back_to_invoices") : t("back_to_credit_notes")}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t("title_new")}</h1>
          {linkedInvoiceNumber && (
            <Badge variant="outline">{t("linked_invoice")} : {linkedInvoiceNumber}</Badge>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("customer_label")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder={t("customer_placeholder")} /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name ? `${c.company_name} — ${c.contact_name}` : c.contact_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("issue_date_label")}</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("currency_label")}</Label>
                <Select value={currencyId} onValueChange={setCurrencyId}>
                  <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} ({c.symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("reason_label")}</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("items_title")}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> {t("add_item")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_70px_110px_120px_36px] gap-2 items-end">
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t("item_description_label")}</Label>}
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    placeholder="Description"
                  />
                </div>
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t("item_quantity_label")}</Label>}
                  <Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
                </div>
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t("item_price_label")}</Label>}
                  <Input type="number" min="0" step="1" value={item.unit_price_ht} onChange={(e) => updateItem(idx, "unit_price_ht", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t("item_tax_label")}</Label>}
                  <Select value={item.tax_rate_id} onValueChange={(v) => updateItem(idx, "tax_rate_id", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {taxRates.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.rate}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {total > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <span className="text-sm font-medium">
                  Total HT : {total.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} F
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{common("creating")}</> : t("submit_create")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={invoiceId ? `../invoices/${invoiceId}` : "../credit-notes"}>{common("cancel")}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
