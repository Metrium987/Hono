"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

type Request = {
  id: string;
  table_name: string;
  record_id: string;
  reason: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; variant: "secondary" | "success" | "destructive" }> = {
  pending: { label: "En attente", icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  approved: { label: "Approuvée", icon: <CheckCircle2 className="h-3 w-3" />, variant: "success" },
  rejected: { label: "Refusée", icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
};

const TABLE_LABELS: Record<string, string> = {
  customers: "Client",
  invoices: "Facture",
  quotes: "Devis",
  orders: "Commande",
  products: "Produit",
};

export function DeleteRequestsClient({ initialData, teamId }: { initialData: Request[]; teamId: string }) {
  const [data, setData] = useState<Request[]>(initialData);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function review(id: string, status: "approved" | "rejected") {
    setLoading(id + status);
    try {
      const res = await fetch(`/api/v1/delete-requests/${id}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, review_notes: reviewNotes[id] ?? null }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Erreur"); return; }
      setData(prev => prev.map(r => r.id === id ? { ...r, status, reviewed_at: new Date().toISOString() } : r));
      toast.success(status === "approved" ? "Suppression approuvée" : "Demande refusée");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  const pending = data.filter(r => r.status === "pending");
  const processed = data.filter(r => r.status !== "pending");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Demandes de suppression</h1>
        <p className="text-sm text-muted-foreground">Mode éducatif — {pending.length} en attente</p>
      </div>

      {pending.length === 0 && processed.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Aucune demande de suppression.</CardContent></Card>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">En attente</h2>
          {pending.map(req => (
            <Card key={req.id} className="border-amber-200 bg-amber-50/20 dark:bg-amber-950/10">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{TABLE_LABELS[req.table_name] ?? req.table_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{req.record_id}</p>
                    {req.reason && <p className="text-sm mt-1 text-muted-foreground">Raison : {req.reason}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(req.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> En attente
                  </Badge>
                </div>
                <Textarea
                  placeholder="Notes (optionnel)"
                  rows={2}
                  value={reviewNotes[req.id] ?? ""}
                  onChange={e => setReviewNotes(p => ({ ...p, [req.id]: e.target.value }))}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive"
                    disabled={loading === req.id + "approved"}
                    onClick={() => review(req.id, "approved")}>
                    {loading === req.id + "approved" ? "…" : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approuver</>}
                  </Button>
                  <Button size="sm" variant="outline"
                    disabled={loading === req.id + "rejected"}
                    onClick={() => review(req.id, "rejected")}>
                    {loading === req.id + "rejected" ? "…" : <><XCircle className="mr-1.5 h-3.5 w-3.5" />Refuser</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Traitées</h2>
          {processed.map(req => {
            const s = STATUS_LABELS[req.status] ?? STATUS_LABELS.pending;
            return (
              <Card key={req.id} className="opacity-70">
                <CardContent className="pt-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{TABLE_LABELS[req.table_name] ?? req.table_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{req.record_id}</p>
                    {req.review_notes && <p className="text-xs text-muted-foreground mt-1">{req.review_notes}</p>}
                  </div>
                  <Badge variant={s.variant} className="shrink-0 flex items-center gap-1">
                    {s.icon} {s.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
