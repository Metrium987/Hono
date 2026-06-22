"use client";

import { useState, useEffect, FormEvent } from "react";
import { TrendingUp, Plus, Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type ExchangeRate = {
  id: string;
  currency_id: string | null;
  rate_type: "official" | "market" | "custom";
  rate: number;
  source: string | null;
  notes: string | null;
  created_at: string;
  currency: { id: string; code: string; symbol: string } | null;
};

type Currency = { id: string; code: string; symbol: string };

const RATE_TYPE_LABELS: Record<string, string> = {
  official: "Officiel (IEOM)",
  market: "Marché constaté",
  custom: "Personnalisé",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExchangeRatesPage() {
  const perm = useClientPermission("settings", "read");
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [currencyId, setCurrencyId] = useState("");
  const [rateType, setRateType] = useState<"official" | "market" | "custom">("official");
  const [rate, setRate] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const [ratesRes, currRes] = await Promise.all([
          fetch(`/api/v1/settings/exchange-rates?team_id=${perm.teamId}&limit=100`),
          fetch(`/api/v1/currencies?team_id=${perm.teamId}`),
        ]);
        const ratesBody = await ratesRes.json();
        const currBody = await currRes.json();
        setRates(ratesBody.data ?? []);
        setCurrencies((currBody.data ?? []).filter((c: Currency & { is_active: boolean }) => c.is_active));
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!rate.trim() || isNaN(Number(rate)) || Number(rate) <= 0) {
      setError("Le taux doit être un nombre positif");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/settings/exchange-rates?team_id=${perm.teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency_id: currencyId || null,
          rate_type: rateType,
          rate: Number(rate),
          source: source || null,
          notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      setRates((prev) => [{ ...json.data, currency: currencies.find((c) => c.id === json.data.currency_id) ?? null }, ...prev]);
      setDialogOpen(false);
      setRate("");
      setSource("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) {
    return <ClientForbiddenPage module="settings" />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="../settings"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Taux de change</h1>
            <p className="text-sm text-muted-foreground">Historique des taux — {rates.length} entrée(s)</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setDialogOpen(true); setError(""); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouveau taux
        </Button>
      </div>

      {rates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucun taux enregistré</p>
          <p className="text-sm mt-1">Saisissez les taux de change pour suivre les conversions au fil du temps.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Devise</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Taux</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rates.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{r.currency ? `${r.currency.code} ${r.currency.symbol}` : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{RATE_TYPE_LABELS[r.rate_type] ?? r.rate_type}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.rate.toFixed(6)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer un taux de change</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une devise" /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.symbol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type de taux</Label>
              <Select value={rateType} onValueChange={(v) => setRateType(v as typeof rateType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="official">Officiel (IEOM)</SelectItem>
                  <SelectItem value="market">Marché constaté</SelectItem>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taux *</Label>
              <Input
                type="number"
                step="0.000001"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="Ex: 119.332000"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="IEOM, BCI, manuel..." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes optionnelles..." />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : "Enregistrer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
