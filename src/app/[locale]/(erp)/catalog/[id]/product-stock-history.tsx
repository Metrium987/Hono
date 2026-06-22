"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Package2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type LedgerEntry = {
  id: string;
  transaction_type: string;
  quantity_change: number;
  running_balance: number;
  unit_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
};

type PriceEntry = {
  id: string;
  old_price: number;
  new_price: number;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
};

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: "Achat",
  sale: "Vente",
  adjustment: "Ajustement",
  return_in: "Retour entrant",
  return_out: "Retour sortant",
  transfer_in: "Transfert entrant",
  transfer_out: "Transfert sortant",
  count_adjustment: "Inventaire",
  container_receipt: "Réception container",
};

const MOVEMENT_VARIANTS: Record<string, "success" | "destructive" | "secondary" | "default"> = {
  purchase: "success",
  container_receipt: "success",
  return_in: "success",
  transfer_in: "success",
  sale: "destructive",
  return_out: "destructive",
  transfer_out: "destructive",
  adjustment: "secondary",
  count_adjustment: "secondary",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ProductStockHistory({ productId, teamId }: { productId: string; teamId: string }) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [loadingL, setLoadingL] = useState(true);
  const [loadingP, setLoadingP] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/inventory/ledger?team_id=${teamId}&product_id=${productId}&limit=20`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setLedger(j.data); })
      .finally(() => setLoadingL(false));

    fetch(`/api/v1/pricing/history/${productId}?team_id=${teamId}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setPrices(j.data); })
      .finally(() => setLoadingP(false));
  }, [productId, teamId]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Mouvements de stock */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Mouvements de stock</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingL ? (
            <p className="text-xs text-muted-foreground p-4">Chargement…</p>
          ) : ledger.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">Aucun mouvement enregistré.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-right p-2 font-medium">Qté</th>
                  <th className="text-right p-2 font-medium">Solde</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground">{fmt(e.created_at)}</td>
                    <td className="p-2">
                      <Badge variant={MOVEMENT_VARIANTS[e.transaction_type] ?? "secondary"} className="text-xs">
                        {MOVEMENT_LABELS[e.transaction_type] ?? e.transaction_type}
                      </Badge>
                    </td>
                    <td className={`p-2 text-right font-mono font-medium ${e.quantity_change >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {e.quantity_change >= 0 ? "+" : ""}{e.quantity_change}
                    </td>
                    <td className="p-2 text-right font-mono">{e.running_balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Historique des prix */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Historique des prix</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingP ? (
            <p className="text-xs text-muted-foreground p-4">Chargement…</p>
          ) : prices.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">Aucun changement de prix.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-right p-2 font-medium">Ancien</th>
                  <th className="text-right p-2 font-medium">Nouveau</th>
                  <th className="text-left p-2 font-medium">Motif</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground">{fmt(p.created_at)}</td>
                    <td className="p-2 text-right font-mono text-muted-foreground line-through">
                      {Number(p.old_price).toLocaleString("fr-FR")} F
                    </td>
                    <td className="p-2 text-right font-mono font-medium">
                      {Number(p.new_price).toLocaleString("fr-FR")} F
                    </td>
                    <td className="p-2 text-muted-foreground truncate max-w-[100px]">{p.change_reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
