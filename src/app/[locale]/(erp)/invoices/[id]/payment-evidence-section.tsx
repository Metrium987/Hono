"use client";

import { useState, useEffect } from "react";
import { Paperclip, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Evidence = {
  id: string;
  payment_id: string;
  file_name: string;
  file_url: string;
  evidence_type: string | null;
  uploaded_at: string;
};

type Payment = { id: string; amount: number; payment_date: string };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PaymentEvidenceSection({
  invoiceId,
  teamId,
  payments,
}: {
  invoiceId: string;
  teamId: string;
  payments: Payment[];
}) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!payments.length) { setLoading(false); return; }
    Promise.all(
      payments.map((p) =>
        fetch(`/api/v1/invoices/${invoiceId}/payments/${p.id}/evidence?team_id=${teamId}`)
          .then((r) => r.json())
          .then((j) => (Array.isArray(j.data) ? j.data : []))
          .catch(() => [])
      )
    )
      .then((results) => setEvidence(results.flat()))
      .finally(() => setLoading(false));
  }, [invoiceId, teamId, payments]);

  if (!loading && evidence.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Pièces justificatives</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground p-4">Chargement…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">Fichier</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-3 font-medium truncate max-w-[200px]">{e.file_name}</td>
                  <td className="p-3">
                    {e.evidence_type && (
                      <Badge variant="secondary" className="text-xs">{e.evidence_type}</Badge>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{fmt(e.uploaded_at)}</td>
                  <td className="p-3">
                    <a
                      href={e.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Voir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
