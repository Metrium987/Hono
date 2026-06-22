"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Loader2, AlertCircle, CheckSquare, ArrowLeft, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

type Product = { id: string; name: string; sku: string | null; current_stock: number };
type ContainerItem = {
  id: string;
  original_name: string | null;
  quantity_expected: number;
  quantity_received: number | null;
  unit_cost: number | null;
  is_matched: boolean;
  product_id: string | null;
  product: Product | null;
};
type Container = {
  id: string;
  container_number: string;
  status: string;
  arrival_date: string | null;
  cost_fob: number | null;
  notes: string | null;
  vendor: { id: string; name: string } | null;
  items: ContainerItem[];
  documents: { id: string; document_type: string; file_name: string; file_url: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  created: "Créé", in_transit: "En transit", received: "Reçu", closed: "Clôturé",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  created: "secondary", in_transit: "default", received: "success", closed: "secondary",
};

type Props = {
  container: Container;
  vendors: { id: string; name: string }[];
  teamId: string;
  locale: string;
};

export default function ContainerDetailClient({ container: initial, teamId, locale }: Props) {
  const router = useRouter();
  const [container, setContainer] = useState<Container>(initial);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchItemId, setMatchItemId] = useState<string | null>(null);
  const [matchQtyReceived, setMatchQtyReceived] = useState("");
  const [matchProductId, setMatchProductId] = useState("");
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openMatch(item: ContainerItem) {
    setMatchItemId(item.id);
    setMatchQtyReceived(String(item.quantity_received ?? item.quantity_expected));
    setMatchProductId(item.product_id ?? "");
    setError(null);
    setMatchDialogOpen(true);
  }

  async function handleMatchSave() {
    if (!matchItemId) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/containers/${container.id}/items/${matchItemId}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity_received: parseFloat(matchQtyReceived) || 0,
          product_id: matchProductId.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      setContainer((prev) => ({
        ...prev,
        items: prev.items.map((item) => item.id === matchItemId ? { ...item, ...json.data } : item),
      }));
      setMatchDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!confirm(`Clôturer le container ${container.container_number} ? Cette action est irréversible et mettra à jour les stocks.`)) return;
    setClosing(true); setError(null);
    try {
      const res = await fetch(`/api/v1/containers/${container.id}/close?team_id=${teamId}`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); setClosing(false); return; }
      setContainer((prev) => ({ ...prev, status: "closed" }));
    } finally {
      setClosing(false);
    }
  }

  const matchedCount = container.items.filter((i) => i.is_matched).length;
  const isClosed = container.status === "closed";

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/containers`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Box className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">{container.container_number}</h1>
          <p className="text-sm text-muted-foreground">{container.vendor?.name ?? "Sans fournisseur"}</p>
        </div>
        <Badge variant={STATUS_VARIANTS[container.status] ?? "secondary"} className="ml-2">
          {STATUS_LABELS[container.status] ?? container.status}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs mb-1">Articles</p>
          <p className="font-bold text-xl">{container.items.length}</p>
          <p className="text-xs text-muted-foreground">{matchedCount} matchés</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs mb-1">Coût FOB</p>
          <p className="font-bold text-xl">{container.cost_fob ? `${container.cost_fob.toLocaleString("fr-FR")} F` : "—"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs mb-1">Arrivée prévue</p>
          <p className="font-bold">{container.arrival_date ? new Date(container.arrival_date).toLocaleDateString("fr-FR") : "—"}</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Articles ({container.items.length})</h2>
          {!isClosed && matchedCount > 0 && (
            <Button size="sm" onClick={handleClose} disabled={closing} variant="destructive">
              {closing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Clôture...</> : <><CheckSquare className="mr-1.5 h-4 w-4" />Clôturer et intégrer le stock</>}
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {container.items.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">Aucun article dans ce container.</div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Article</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qté attendue</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qté reçue</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Produit lié</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {container.items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.original_name ?? "Article sans nom"}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{item.quantity_expected}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.quantity_received != null ? (
                        <span className={item.quantity_received < item.quantity_expected ? "text-destructive" : "text-green-600 dark:text-green-400"}>
                          {item.quantity_received}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.product ? (
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs font-medium">{item.product.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Non lié</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isClosed && (
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => openMatch(item)}>
                          {item.is_matched ? "Modifier" : "Matcher"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Matcher l&apos;article</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Quantité reçue</Label>
              <Input type="number" value={matchQtyReceived} onChange={(e) => setMatchQtyReceived(e.target.value)} min="0" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>ID du produit Hono</Label>
              <Input value={matchProductId} onChange={(e) => setMatchProductId(e.target.value)} placeholder="UUID du produit..." />
              <p className="text-xs text-muted-foreground">Copier l&apos;UUID depuis la page produit dans le catalogue.</p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleMatchSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
