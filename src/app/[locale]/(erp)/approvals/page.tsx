"use client";

import { useState, useEffect } from "react";
import { CheckSquare, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Approval = {
  id: string;
  approval_type: string;
  status: "pending" | "approved" | "rejected" | "expired";
  entity_type: string;
  entity_id: string;
  reason: string | null;
  requested_at: string;
  requested_by_user: { id: string; full_name: string } | null;
  resolved_by_user: { id: string; full_name: string } | null;
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  pending: "default", approved: "success", rejected: "destructive", expired: "secondary",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", approved: "Approuvé", rejected: "Rejeté", expired: "Expiré",
};

export default function ApprovalsPage() {
  const perm = useClientPermission("governance", "read");
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/approvals?team_id=${perm.teamId}`);
        const json = await res.json();
        setApprovals(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActing(id);
    try {
      const res = await fetch(`/api/v1/approvals/${id}/${action}?team_id=${perm.teamId}`, { method: "PATCH" });
      if (res.ok) {
        const json = await res.json();
        setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, ...json.data } : a));
      }
    } finally {
      setActing(null);
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="governance" />;

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex items-center gap-3">
        <CheckSquare className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approbations</h1>
          <p className="text-sm text-muted-foreground">{pending.length} en attente</p>
        </div>
      </div>

      {pending.length === 0 && resolved.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <CheckSquare className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucune demande d&apos;approbation</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">En attente</h2>
              {pending.map((approval) => (
                <div key={approval.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{approval.approval_type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground font-mono">{approval.entity_type}</span>
                    </div>
                    {approval.reason && <p className="text-sm text-muted-foreground">{approval.reason}</p>}
                    <p className="text-xs text-muted-foreground">
                      Par {approval.requested_by_user?.full_name ?? "—"} · {new Date(approval.requested_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="destructive" className="h-8 px-3" onClick={() => handleAction(approval.id, "reject")} disabled={acting === approval.id}>
                      {acting === approval.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" className="h-8 px-3" onClick={() => handleAction(approval.id, "approve")} disabled={acting === approval.id}>
                      {acting === approval.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Historique</h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Demandé par</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resolved.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 capitalize">{a.approval_type.replace(/_/g, " ")}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{a.requested_by_user?.full_name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(a.requested_at).toLocaleDateString("fr-FR")}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={STATUS_VARIANTS[a.status] ?? "secondary"} className="text-[10px]">
                            {STATUS_LABELS[a.status] ?? a.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
