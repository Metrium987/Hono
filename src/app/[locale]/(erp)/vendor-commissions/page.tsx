"use client";

import { useState, useEffect } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";
import { Badge } from "@/components/ui/badge";

type Commission = {
  id: string;
  base_amount: number;
  commission_pct: number;
  commission_amount: number;
  is_paid: boolean;
  notes: string | null;
  created_at: string;
  vendor_id?: string;
  vendor?: { name: string } | null;
  order?: { id: string; order_number: string } | null;
  invoice?: { id: string; number: string } | null;
};

export default function VendorCommissionsPage() {
  const perm = useClientPermission("finance", "read");
  const [items, setItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/vendor-commissions?team_id=${perm.teamId}`);
        const json = await res.json();
        setItems(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="finance" />;

  function formatCurrency(amount: number) {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commissions fournisseurs</h1>
          <p className="text-sm text-muted-foreground">{items.length} commission(s)</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <DollarSign className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucune commission</p>
          <p className="text-sm mt-1">Les commissions sont calculées à partir des commandes fournisseur.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Commande</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Base</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">%</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Commission</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.order?.order_number ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.base_amount)}</td>
                  <td className="px-4 py-3 text-right">{c.commission_pct}%</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(c.commission_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={c.is_paid ? "success" : "secondary"}>
                      {c.is_paid ? "Payée" : "En attente"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
