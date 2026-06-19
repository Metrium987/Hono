"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Customer = { id: string; company_name: string | null; contact_name: string; email: string | null };
type Currency = { id: string; code: string; symbol: string; symbol_position: string; is_default: boolean };
type TaxRate = { id: string; name: string; rate: number; is_active: boolean };
type Team = { id: string; invoice_prefix: string; late_fee_fixed: number };

type LineItem = {
  key: string;
  description: string;
  quantity: string;
  unit_price_ht: string;
  tax_rate_id: string;
};

type InvoiceFormProps = {
  customers: Customer[];
  currencies: Currency[];
  taxRates: TaxRate[];
  team: Team;
  teamId: string;
  editId?: string;
  initialData?: {
    customer_id: string;
    issue_date: string;
    service_date: string;
    due_date: string;
    currency_id: string;
    late_fee_fixed: number;
    notes: string;
    message: string;
    items: LineItem[];
  };
};

// Use a Date-based key that's unique per render to avoid React strict-mode double-render issues
function createLineItem(): LineItem {
  return { key: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, description: "", quantity: "1", unit_price_ht: "0", tax_rate_id: "" };
}

export function InvoiceForm({ customers, currencies, taxRates, team, teamId, editId, initialData }: InvoiceFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const common = useTranslations("common");

  const defaultCurrency = currencies.find((c) => c.is_default) ?? currencies[0];

  const [customerId, setCustomerId] = useState(initialData?.customer_id ?? "");
  const [issueDate, setIssueDate] = useState(initialData?.issue_date ?? new Date().toISOString().split("T")[0]);
  const [serviceDate, setServiceDate] = useState(initialData?.service_date ?? "");
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
  const [currencyId, setCurrencyId] = useState(initialData?.currency_id ?? defaultCurrency?.id ?? "");
  const [lateFee, setLateFee] = useState(initialData?.late_fee_fixed?.toString() ?? team.late_fee_fixed.toString());
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [message, setMessage] = useState(initialData?.message ?? "");
  const [items, setItems] = useState<LineItem[]>(initialData?.items ?? [createLineItem(), createLineItem()]);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createLineItem()]);
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const updateItem = useCallback((key: string, field: keyof LineItem, value: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  }, []);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price_ht) || 0;
    return sum + qty * price;
  }, 0);

  const taxTotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price_ht) || 0;
    const lineTotal = qty * price;
    if (item.tax_rate_id) {
      const rate = taxRates.find((r) => r.id === item.tax_rate_id);
      if (rate) return sum + lineTotal * (rate.rate / 100);
    }
    return sum;
  }, 0);

  const total = subtotal + taxTotal;
  const activeCurrency = currencies.find((c) => c.id === currencyId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      customer_id: customerId,
      issue_date: issueDate,
      service_date: serviceDate || null,
      due_date: dueDate,
      currency_id: currencyId,
      late_fee_fixed: parseFloat(lateFee) || null,
      notes: notes || null,
      message: message || null,
      items: items.filter((i) => i.description.trim()).map((i) => ({
        description: i.description,
        quantity: parseFloat(i.quantity) || 1,
        unit_price_ht: parseFloat(i.unit_price_ht) || 0,
        tax_rate_id: i.tax_rate_id || null,
      })),
    };

    try {
      const url = editId
        ? `/api/v1/invoices/${editId}?team_id=${teamId}`
        : `/api/v1/invoices?team_id=${teamId}`;
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? common("unknown_error"));

      router.push(editId ? `../${json.data.id}` : `./${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : common("unknown_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Customer & Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Client &amp; Dates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer">Client</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Sélectionner un client" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name || c.contact_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Select value={currencyId} onValueChange={setCurrencyId}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue_date">Date d&apos;émission</Label>
            <Input id="issue_date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service_date">Date d&apos;opération</Label>
            <Input id="service_date" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Échéance</Label>
            <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="late_fee">Indemnité forfaitaire (F CFP)</Label>
            <Input id="late_fee" type="number" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lignes de facture</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une ligne
          </Button>
        </CardHeader>
        <CardContent>
          {/* Header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-2 px-1 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-right">Quantité</div>
            <div className="col-span-2 text-right">Prix unitaire HT</div>
            <div className="col-span-2">TVA</div>
            <div className="col-span-1" />
          </div>

          {items.map((item) => (
            <div key={item.key} className="grid grid-cols-12 gap-2 mb-2 items-start">
              <div className="col-span-12 sm:col-span-5">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(item.key, "description", e.target.value)}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Qté"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
                  className="text-right"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Prix"
                  value={item.unit_price_ht}
                  onChange={(e) => updateItem(item.key, "unit_price_ht", e.target.value)}
                  className="text-right"
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Select
                  value={item.tax_rate_id}
                  onValueChange={(v) => updateItem(item.key, "tax_rate_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="TVA" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxRates.filter((r) => r.is_active).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.key)}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <Separator className="my-4" />

          {/* Totals */}
          <div className="ml-auto space-y-1 sm:w-64">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total HT</span>
              <span>{subtotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {activeCurrency?.symbol ?? "F"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVA</span>
              <span>{taxTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {activeCurrency?.symbol ?? "F"}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total TTC</span>
              <span className="text-primary">{total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {activeCurrency?.symbol ?? "F"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes &amp; Message</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="message">Message (visible sur la facture)</Label>
            <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message au client..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes internes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes non visibles..." />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editId ? "Enregistrer" : "Créer la facture"}
        </Button>
      </div>
    </form>
  );
}
