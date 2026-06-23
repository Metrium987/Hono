"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PaymentProof = {
  id: string;
  payment_date: string;
  amount: number;
  reference: string | null;
  notes: string | null;
  status: "pending" | "verified" | "rejected";
  created_at: string;
};

type Props = {
  invoiceId: string;
  teamId: string;
};

export function ClientPaymentProofs({ invoiceId, teamId }: Props) {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/invoices/${invoiceId}/payment-proofs?team_id=${teamId}`)
      .then((r) => r.json())
      .then((d) => setProofs(d.data ?? []))
      .catch(() => setProofs([]))
      .finally(() => setLoading(false));
  }, [invoiceId, teamId]);

  async function updateStatus(proofId: string, status: "verified" | "rejected") {
    setUpdating(proofId);
    try {
      await fetch(`/api/v1/invoices/${invoiceId}/payment-proofs/${proofId}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setProofs((prev) => prev.map((p) => (p.id === proofId ? { ...p, status } : p)));
    } finally {
      setUpdating(null);
    }
  }

  if (loading || proofs.length === 0) return null;

  const pendingCount = proofs.filter((p) => p.status === "pending").length;

  return (
    <Card className={pendingCount > 0 ? "border-amber-300 dark:border-amber-600" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {pendingCount > 0 ? (
            <Clock className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          Déclarations de paiement client
          {pendingCount > 0 && (
            <Badge variant="warning" className="ml-1">{pendingCount} en attente</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {proofs.map((proof) => (
          <div key={proof.id} className="flex items-start justify-between gap-4 rounded-lg border p-3 text-sm">
            <div className="space-y-0.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {proof.amount.toLocaleString("fr-FR")} F
                </span>
                <span className="text-muted-foreground">
                  — {new Date(proof.payment_date).toLocaleDateString("fr-FR")}
                </span>
                {proof.reference && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                    {proof.reference}
                  </span>
                )}
              </div>
              {proof.notes && (
                <p className="text-xs text-muted-foreground">{proof.notes}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Déclaré le {new Date(proof.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {proof.status === "pending" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updating === proof.id}
                    onClick={() => updateStatus(proof.id, "verified")}
                    className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={updating === proof.id}
                    onClick={() => updateStatus(proof.id, "rejected")}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Refuser
                  </Button>
                </>
              ) : proof.status === "verified" ? (
                <Badge variant="success">Vérifié</Badge>
              ) : (
                <Badge variant="destructive">Refusé</Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
