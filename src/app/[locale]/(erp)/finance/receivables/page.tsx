"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Banknote, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchCombobox } from "@/components/ui/search-combobox";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type AR = {
  id: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  due_date: string;
  customer: { id: string; name: string } | null;
  invoice: { id: string; number: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", partial: "Partiel", settled: "Soldé", overdue: "Échu",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  pending: "secondary", partial: "default", settled: "success", overdue: "destructive",
};

export default function ReceivablesPage() {
  const { locale } = useParams<{ locale: string }>();
  const perm = useClientPermission("finance", "read");
  const [items, setItems] = useState<AR[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/ar?team_id=${perm.teamId}`);
        const json = await res.json();
        setItems(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  async function handleCreate() {
    if (!customerId.trim()) { setError("L'ID client est requis"); return; }
    if (!totalAmount || parseFloat(totalAmount) <= 0) { setError("Montant invalide"); return; }
    if (!dueDate) { setError("La date d'échéance est requise"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/ar?team_id=${perm.teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId.trim(), invoice_id: invoiceId.trim() || null, total_amount: parseFloat(totalAmount), due_date: dueDate, notes: notes.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      setItems((prev) => [json.data, ...prev]);
      setDialogOpen(false);
      setCustomerId(""); setInvoiceId(""); setTotalAmount(""); setDueDate(""); setNotes("");
    } finally {
      setSaving(false);
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="finance" />;

  const totalBalance = items.reduce((s, i) => s + Number(i.balance), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Banknote className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Créances clients</h1>
            <p className="text-sm text-muted-foreground">{items.length} créance(s) — solde total : {totalBalance.toLocaleString("fr-FR")} F</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setDialogOpen(true); setError(null); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouvelle créance
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Banknote className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucune créance</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Facture</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Solde</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Échéance</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((ar) => (
                <tr key={ar.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{ar.customer?.name ?? ar.customer?.id ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{ar.invoice?.number ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{Number(ar.total_amount).toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(ar.balance).toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-3 text-xs">{new Date(ar.due_date).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[ar.status] ?? "secondary"} className="text-[10px]">
                      {STATUS_LABELS[ar.status] ?? ar.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${locale}/finance/receivables/${ar.id}`}>Détail</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle créance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Client *</Label>
              <SearchCombobox
                value={customerId}
                onChange={setCustomerId}
                onSearch={async (query) => {
                  const res = await fetch(`/api/v1/customers?team_id=${perm.teamId}&search=${encodeURIComponent(query)}&limit=20`);
                  const json = await res.json();
                  return (json.data ?? []).map((c: { id: string; company_name?: string | null; contact_name: string; n_tahiti?: string | null; is_b2b?: boolean }) => ({
                    id: c.id,
                    label: c.company_name || c.contact_name,
                    subtitle: c.is_b2b && c.n_tahiti ? `N° TAHITI: ${c.n_tahiti}` : undefined,
                  }));
                }}
                placeholder="Rechercher un client..."
                searchPlaceholder="Nom, société, N° TAHITI..."
                emptyMessage="Aucun client trouvé"
              />
            </div>
            <div className="space-y-2">
              <Label>Facture (optionnel)</Label>
              <SearchCombobox
                value={invoiceId}
                onChange={setInvoiceId}
                onSearch={async (query) => {
                  const url = `/api/v1/invoices?team_id=${perm.teamId}&search=${encodeURIComponent(query)}${customerId ? `&customer_id=${customerId}` : ""}&limit=20`;
                  const res = await fetch(url);
                  const json = await res.json();
                  return (json.data ?? []).map((inv: { id: string; invoice_number: string; total_ttc: number; status?: string }) => ({
                    id: inv.id,
                    label: `${inv.invoice_number}`,
                    subtitle: `${Number(inv.total_ttc).toLocaleString("fr-FR")} F`,
                  }));
                }}
                placeholder="Rechercher une facture..."
                searchPlaceholder="N° de facture..."
                emptyMessage="Aucune facture trouvée"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Montant total *</Label>
                <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} min="0" step="1" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Échéance *</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel..." />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
