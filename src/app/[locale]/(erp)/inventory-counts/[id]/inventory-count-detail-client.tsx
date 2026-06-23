"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Product = { id: string; name: string; sku: string | null; current_stock: number };
type CountItem = {
  id: string; product_id: string; system_qty: number;
  counted_qty: number | null; difference: number | null; notes: string | null;
  product: Product;
};
export type Count = {
  id: string; status: string; notes: string | null; created_at: string;
  warehouse: { id: string; name: string; type: string } | null;
  items: CountItem[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", in_progress: "En cours", completed: "Terminé", approved: "Approuvé",
};

type Props = { teamId: string; count: Count };

export function InventoryCountDetailClient({ teamId, count: initialCount }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [count, setCount] = useState<Count>(initialCount);
  const [countedQtys, setCountedQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialCount.items.map((i) => [i.product_id, i.counted_qty?.toString() ?? ""])
    )
  );
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditable = ["draft", "in_progress"].includes(count.status);
  const isApprovable = ["in_progress", "completed"].includes(count.status);

  async function handleSaveItems() {
    setSaving(true); setError(null);
    try {
      const items = count.items
        .filter((item) => countedQtys[item.product_id] !== "")
        .map((item) => ({
          product_id: item.product_id,
          system_qty: item.system_qty,
          counted_qty: parseFloat(countedQtys[item.product_id] ?? "0"),
        }));

      const res = await fetch(`/api/v1/inventory/counts/${count.id}/items?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur lors de la sauvegarde"); return; }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/inventory/counts/${count.id}/approve?team_id=${teamId}`, {
        method: "PATCH",
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur lors de l'approbation"); return; }
      setCount((prev) => ({ ...prev, status: "approved" }));
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/inventory-counts`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <ClipboardList className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Inventaire — {count.warehouse?.name ?? "Entrepôt inconnu"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(count.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">{STATUS_LABELS[count.status] ?? count.status}</Badge>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Feuille de comptage</CardTitle>
        </CardHeader>
        <CardContent>
          {count.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun article à compter. Les articles sont chargés depuis l&apos;inventaire produit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Produit</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Stock système</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Stock compté</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {count.items.map((item) => {
                    const counted = countedQtys[item.product_id];
                    const diff = counted !== "" && counted !== undefined
                      ? parseFloat(counted) - item.system_qty
                      : item.difference;
                    return (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{item.product.name}</td>
                        <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{item.product.sku ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{item.system_qty}</td>
                        <td className="px-3 py-2 text-right">
                          {isEditable ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={countedQtys[item.product_id] ?? ""}
                              onChange={(e) => setCountedQtys((prev) => ({ ...prev, [item.product_id]: e.target.value }))}
                              className="w-20 text-right h-7 text-sm"
                            />
                          ) : (
                            <span>{item.counted_qty ?? "—"}</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${diff == null ? "text-muted-foreground" : diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {diff == null ? "—" : diff > 0 ? `+${diff}` : `${diff}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {isEditable && count.items.length > 0 && (
          <Button onClick={handleSaveItems} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sauvegarde...</> : "Sauvegarder les comptages"}
          </Button>
        )}
        {isApprovable && (
          <Button variant="default" onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700">
            {approving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Approbation...</> : <><Check className="mr-1.5 h-4 w-4" />Approuver l&apos;inventaire</>}
          </Button>
        )}
      </div>
    </div>
  );
}
