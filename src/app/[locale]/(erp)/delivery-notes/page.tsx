"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type DN = {
  id: string;
  note_number: string;
  status: string;
  delivery_address: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  created_at: string;
  order: { id: string; order_number: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", dispatched: "Expédié", delivered: "Livré", cancelled: "Annulé",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  draft: "secondary", dispatched: "default", delivered: "success", cancelled: "destructive",
};

export default function DeliveryNotesPage() {
  const { locale } = useParams<{ locale: string }>();
  const perm = useClientPermission("orders", "read");
  const [items, setItems] = useState<DN[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/delivery-notes?team_id=${perm.teamId}`);
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
  if (!perm.allowed) return <ClientForbiddenPage module="orders" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bons de livraison</h1>
          <p className="text-sm text-muted-foreground">{items.length} bon(s)</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Layers className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucun bon de livraison</p>
          <p className="text-sm mt-1">Les bons de livraison sont créés depuis les commandes.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">N° BL</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Commande</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Adresse</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((dn) => (
                <tr key={dn.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{dn.note_number}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{dn.order?.order_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{dn.delivery_address ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[dn.status] ?? "secondary"} className="text-[10px]">
                      {STATUS_LABELS[dn.status] ?? dn.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${locale}/delivery-notes/${dn.id}`}>Ouvrir</Link>
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
