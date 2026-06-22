"use client";

import { useState, useEffect } from "react";
import { Store, Loader2, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Closure = {
  id: string;
  closure_date: string;
  status: string;
  total_sales: number;
  total_cash: number;
  total_digital: number;
  expected_total: number;
  actual_total: number;
  discrepancy: number;
  notes: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  open: "En cours", closed: "Clôturé", reviewed: "Vérifié",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  open: "secondary", closed: "default", reviewed: "success",
};

export default function CashClosuresPage() {
  const perm = useClientPermission("finance", "read");
  const [items, setItems] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [closureDate, setClosureDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalSales, setTotalSales] = useState("");
  const [totalCash, setTotalCash] = useState("");
  const [totalDigital, setTotalDigital] = useState("");
  const [actualTotal, setActualTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/cash-closures?team_id=${perm.teamId}`);
        const json = await res.json();
        setItems(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  async function handleCreate() {
    if (!closureDate) { setError("La date est requise"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/cash-closures?team_id=${perm.teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closure_date: closureDate,
          total_sales: parseFloat(totalSales) || 0,
          total_cash: parseFloat(totalCash) || 0,
          total_digital: parseFloat(totalDigital) || 0,
          actual_total: actualTotal ? parseFloat(actualTotal) : undefined,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      setItems((prev) => [json.data, ...prev]);
      setDialogOpen(false);
      setTotalSales(""); setTotalCash(""); setTotalDigital(""); setActualTotal(""); setNotes("");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(id: string) {
    const res = await fetch(`/api/v1/cash-closures/${id}?team_id=${perm.teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    if (res.ok) {
      const json = await res.json();
      setItems((prev) => prev.map((c) => c.id === id ? json.data : c));
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="finance" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clôture caisse</h1>
            <p className="text-sm text-muted-foreground">{items.length} clôture(s)</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setDialogOpen(true); setError(null); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouvelle clôture
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Store className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucune clôture enregistrée</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Ventes</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Espèces</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Numérique</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Écart</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{new Date(c.closure_date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right">{Number(c.total_sales).toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-3 text-right">{Number(c.total_cash).toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-3 text-right">{Number(c.total_digital).toLocaleString("fr-FR")} F</td>
                  <td className={`px-4 py-3 text-right font-semibold ${Number(c.discrepancy) !== 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                    {Number(c.discrepancy) !== 0 ? (Number(c.discrepancy) > 0 ? "+" : "") + Number(c.discrepancy).toLocaleString("fr-FR") + " F" : (
                      <span className="flex items-center justify-end gap-1"><CheckCircle className="h-3.5 w-3.5" /> 0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[c.status] ?? "secondary"} className="text-[10px]">
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "open" && (
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleClose(c.id)}>
                        Clôturer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle clôture de caisse</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total ventes (F)</Label>
                <Input type="number" value={totalSales} onChange={(e) => setTotalSales(e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="space-y-2">
                <Label>Espèces (F)</Label>
                <Input type="number" value={totalCash} onChange={(e) => setTotalCash(e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="space-y-2">
                <Label>Numérique (F)</Label>
                <Input type="number" value={totalDigital} onChange={(e) => setTotalDigital(e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="space-y-2">
                <Label>Total réel (F)</Label>
                <Input type="number" value={actualTotal} onChange={(e) => setActualTotal(e.target.value)} placeholder="Calculé auto si vide" min="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel..." />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
