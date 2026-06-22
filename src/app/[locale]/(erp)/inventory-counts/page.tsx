"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type CountRow = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  warehouse: { id: string; name: string; type: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", in_progress: "En cours", completed: "Terminé", approved: "Approuvé",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  draft: "secondary", in_progress: "default", completed: "success", approved: "success",
};

export default function InventoryCountsPage() {
  const { locale } = useParams<{ locale: string }>();
  const perm = useClientPermission("inventory", "read");
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/inventory/counts?team_id=${perm.teamId}`);
        const json = await res.json();
        setCounts(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="inventory" />;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventaires</h1>
            <p className="text-sm text-muted-foreground">{counts.length} inventaire(s)</p>
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href={`/${locale}/warehouses`}><Plus className="mr-1.5 h-4 w-4" /> Depuis un entrepôt</Link>
        </Button>
      </div>

      {counts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucun inventaire</p>
          <p className="text-sm mt-1">Lancez un inventaire depuis la fiche d&apos;un entrepôt.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Entrepôt</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {counts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 font-medium">{c.warehouse?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[c.status] ?? "secondary"} className="text-[10px]">
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${locale}/inventory-counts/${c.id}`}>Ouvrir</Link>
                    </Button>
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
