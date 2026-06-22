"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pause, Play, Trash2, RefreshCw, CalendarClock } from "lucide-react";
import { toast } from "sonner";

type RecItem = { description: string; quantity: number; unit_price_ht: number };
type Customer = { id: string; contact_name: string; company_name: string | null };
type Currency = { id: string; code: string; symbol: string };
type TaxRate = { id: string; name: string; rate: number };

type RecurringRow = {
  id: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_generation_date: string;
  last_generated_at: string | null;
  is_active: boolean;
  payment_terms: number;
  notes: string | null;
  customer: { id: string; contact_name: string; company_name: string | null } | null;
  currency: { code: string; symbol: string } | null;
  items: RecItem[];
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

function lineTotal(items: RecItem[]) {
  return items.reduce((s, i) => s + i.quantity * i.unit_price_ht, 0);
}

export function RecurringClient({
  initialData, teamId, currencies, customers, taxRates, freqLabels,
}: {
  initialData: RecurringRow[];
  teamId: string;
  currencies: Currency[];
  customers: Customer[];
  taxRates: TaxRate[];
  freqLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [data, setData] = useState<RecurringRow[]>(initialData);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    customer_id: "",
    currency_id: currencies[0]?.id ?? "",
    frequency: "monthly_date",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    payment_terms: 30,
    notes: "",
    items: [{ description: "", quantity: 1, unit_price_ht: 0, tax_rate_id: "" }],
  });

  function setField(k: string, v: unknown) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function setItem(idx: number, k: string, v: unknown) {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [k]: v };
      return { ...f, items };
    });
  }

  async function create() {
    if (!form.customer_id) { toast.error("Sélectionnez un client"); return; }
    if (!form.items[0].description) { toast.error("Au moins un article requis"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/recurring-invoices?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          end_date: form.end_date || null,
          items: form.items.filter(i => i.description).map(i => ({
            ...i,
            tax_rate_id: i.tax_rate_id || null,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Erreur"); return; }
      toast.success("Facturation récurrente créée");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/v1/recurring-invoices/${id}?team_id=${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    });
    if (res.ok) {
      setData(prev => prev.map(r => r.id === id ? { ...r, is_active: !current } : r));
      toast.success(current ? "Mise en pause" : "Réactivée");
    } else {
      toast.error("Erreur");
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette facturation récurrente ?")) return;
    const res = await fetch(`/api/v1/recurring-invoices/${id}?team_id=${teamId}`, { method: "DELETE" });
    if (res.ok) {
      setData(prev => prev.filter(r => r.id !== id));
      toast.success("Supprimée");
    } else {
      toast.error("Erreur");
    }
  }

  const active = data.filter(r => r.is_active);
  const paused = data.filter(r => !r.is_active);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" /> Factures récurrentes
          </h1>
          <p className="text-sm text-muted-foreground">{active.length} active{active.length !== 1 ? "s" : ""} · {paused.length} en pause</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nouvelle récurrence</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une facturation récurrente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={form.customer_id} onValueChange={v => setField("customer_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name ?? c.contact_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fréquence</Label>
                  <Select value={form.frequency} onValueChange={v => setField("frequency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(freqLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select value={form.currency_id} onValueChange={v => setField("currency_id", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de début *</Label>
                  <Input type="date" value={form.start_date} onChange={e => setField("start_date", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin (optionnel)</Label>
                  <Input type="date" value={form.end_date} onChange={e => setField("end_date", e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Délai de paiement (jours)</Label>
                <Input type="number" min="0" value={form.payment_terms}
                  onChange={e => setField("payment_terms", parseInt(e.target.value) || 30)} className="w-32" />
              </div>

              <div className="space-y-2">
                <Label>Articles *</Label>
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5 space-y-1">
                      <Input placeholder="Description" value={item.description}
                        onChange={e => setItem(idx, "description", e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Input type="number" min="0" step="0.01" placeholder="Qté" value={item.quantity}
                        onChange={e => setItem(idx, "quantity", parseFloat(e.target.value) || 1)} />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Input type="number" min="0" step="1" placeholder="Prix HT" value={item.unit_price_ht}
                        onChange={e => setItem(idx, "unit_price_ht", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2">
                      <Select value={item.tax_rate_id} onValueChange={v => setItem(idx, "tax_rate_id", v)}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="TVA" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">0%</SelectItem>
                          {taxRates.map(r => <SelectItem key={r.id} value={r.id}>{r.rate}%</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => setForm(f => ({ ...f, items: [...f.items, { description: "", quantity: 1, unit_price_ht: 0, tax_rate_id: "" }] }))}>
                  + Ajouter un article
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setField("notes", e.target.value)} placeholder="Notes internes..." />
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={create} disabled={saving} className="flex-1">
                  {saving ? "Création…" : "Créer"}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RefreshCw className="mx-auto h-8 w-8 mb-3 opacity-30" />
            <p>Aucune facturation récurrente configurée.</p>
            <p className="text-sm mt-1">Créez-en une pour automatiser vos factures périodiques.</p>
          </CardContent>
        </Card>
      )}

      {[...active, ...paused].map(rec => {
        const customer = Array.isArray(rec.customer) ? rec.customer[0] : rec.customer;
        const currency = Array.isArray(rec.currency) ? rec.currency[0] : rec.currency;
        const total = lineTotal(rec.items ?? []);
        return (
          <Card key={rec.id} className={!rec.is_active ? "opacity-60" : ""}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="text-base">
                  {customer?.company_name ?? customer?.contact_name ?? "—"}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{freqLabels[rec.frequency] ?? rec.frequency}</Badge>
                  {!rec.is_active && <Badge variant="outline" className="text-amber-600">En pause</Badge>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{total.toLocaleString("fr-FR")} {currency?.symbol ?? "F"}</p>
                <p className="text-xs text-muted-foreground">HT par occurrence</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="space-y-0.5">
                  <p>Prochaine génération : <strong className="text-foreground">{fmtDate(rec.next_generation_date)}</strong></p>
                  {rec.last_generated_at && (
                    <p>Dernière : {fmtDate(rec.last_generated_at)}</p>
                  )}
                  {rec.end_date && <p>Fin : {fmtDate(rec.end_date)}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(rec.id, rec.is_active)}
                    title={rec.is_active ? "Mettre en pause" : "Réactiver"}>
                    {rec.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                    onClick={() => remove(rec.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
