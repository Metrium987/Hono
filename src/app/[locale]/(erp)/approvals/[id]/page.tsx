"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Signature = {
  id: string;
  signed_by: string;
  action: string;
  signed_at: string;
  ip_address: string | null;
};

type Approval = {
  id: string;
  approval_type: string;
  entity_type: string;
  entity_id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  reason: string | null;
  metadata: Record<string, unknown> | null;
  requested_at: string;
  resolved_at: string | null;
  expires_at: string | null;
  requested_by_user: { id: string; full_name: string } | null;
  resolved_by_user: { id: string; full_name: string } | null;
  signatures: Signature[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", approved: "Approuvé", rejected: "Rejeté", expired: "Expiré",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  pending: "default", approved: "success", rejected: "destructive", expired: "secondary",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ApprovalDetailPage() {
  const params = useParams<{ id: string }>();
  const perm = useClientPermission("governance", "read");
  const permWrite = useClientPermission("governance", "write");
  const [approval, setApproval] = useState<Approval | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    if (!perm.teamId || !params.id) return;
    fetch(`/api/v1/approvals/${params.id}?team_id=${perm.teamId}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setApproval(j.data); })
      .finally(() => setLoading(false));
  }, [perm.teamId, params.id]);

  async function act(action: "approve" | "reject") {
    if (!perm.teamId || !approval) return;
    setActing(action);
    try {
      const res = await fetch(`/api/v1/approvals/${approval.id}/${action}?team_id=${perm.teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.data) setApproval(j.data);
        else {
          // Re-fetch to get updated state with new signature
          const r2 = await fetch(`/api/v1/approvals/${approval.id}?team_id=${perm.teamId}`);
          const j2 = await r2.json();
          if (j2.data) setApproval(j2.data);
        }
      }
    } finally {
      setActing(null);
    }
  }

  if (perm.loading) return null;
  if (!perm.allowed) return <ClientForbiddenPage module="governance" />;
  if (loading) return <div className="p-8 text-muted-foreground text-sm">Chargement…</div>;
  if (!approval) return <div className="p-8 text-muted-foreground text-sm">Approbation introuvable.</div>;

  const canAct = permWrite.allowed && approval.status === "pending";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../approvals"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">{approval.approval_type}</h1>
            <Badge variant={STATUS_VARIANTS[approval.status] ?? "secondary"}>
              {STATUS_LABELS[approval.status] ?? approval.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {approval.entity_type} · {approval.entity_id.slice(0, 8)}…
          </p>
        </div>
        {canAct && (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => act("reject")} disabled={!!acting}>
              <XCircle className="mr-1.5 h-4 w-4" />
              {acting === "reject" ? "…" : "Rejeter"}
            </Button>
            <Button size="sm" onClick={() => act("approve")} disabled={!!acting}>
              <CheckCircle className="mr-1.5 h-4 w-4" />
              {acting === "approve" ? "…" : "Approuver"}
            </Button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Demandé par</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{approval.requested_by_user?.full_name ?? "—"}</p>
            <p className="text-muted-foreground">{formatDate(approval.requested_at)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Résolution</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {approval.resolved_by_user ? (
              <>
                <p className="font-medium">{approval.resolved_by_user.full_name}</p>
                <p className="text-muted-foreground">{formatDate(approval.resolved_at)}</p>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>En attente de résolution</span>
              </div>
            )}
            {approval.expires_at && (
              <p className="text-xs text-muted-foreground">Expire le {formatDate(approval.expires_at)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {approval.reason && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Motif</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{approval.reason}</p>
          </CardContent>
        </Card>
      )}

      {approval.metadata && Object.keys(approval.metadata).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Métadonnées</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted rounded p-3 overflow-x-auto">
              {JSON.stringify(approval.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Signatures */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Journal des signatures</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {approval.signatures.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Aucune signature enregistrée.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-3 font-medium">Signataire</th>
                  <th className="text-left p-3 font-medium">Action</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {approval.signatures.map((sig) => (
                  <tr key={sig.id} className="border-b last:border-0">
                    <td className="p-3 text-xs font-mono text-muted-foreground">{sig.signed_by.slice(0, 8)}…</td>
                    <td className="p-3">
                      <Badge variant={sig.action === "approved" ? "success" : sig.action === "rejected" ? "destructive" : "secondary"}>
                        {sig.action}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(sig.signed_at)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{sig.ip_address ?? "—"}</td>
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
