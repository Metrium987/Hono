"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Send, Clock, FileText, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export type ReminderInvoice = {
  id: string;
  invoice_number: string;
  total_ttc: number;
  due_date: string;
  status: string;
  daysOverdue: number;
  customerName: string;
  customerEmail: string | null;
  lastReminder: { level: number; sent_at: string } | null;
  nextLevel: 1 | 2 | 3 | null;
  nextLabel: string;
  nextDisabled: boolean;
};

const LEVEL_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Rappel amiable", color: "bg-amber-100 text-amber-700 border-amber-200" },
  2: { label: "Relance ferme", color: "bg-orange-100 text-orange-700 border-orange-200" },
  3: { label: "Mise en demeure", color: "bg-red-100 text-red-700 border-red-200" },
};

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
}

export function RemindersClient({ invoices, teamId }: { invoices: ReminderInvoice[]; teamId: string }) {
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, number>>({});

  async function sendReminder(inv: ReminderInvoice) {
    if (!inv.nextLevel) return;
    setSending((s) => ({ ...s, [inv.id]: true }));

    try {
      const res = await fetch(`/api/v1/invoices/${inv.id}/remind?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: inv.nextLevel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur d'envoi");
      setSent((s) => ({ ...s, [inv.id]: inv.nextLevel! }));
      toast.success(`Relance envoyée pour ${inv.invoice_number}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending((s) => ({ ...s, [inv.id]: false }));
    }
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-lg font-medium">Aucune facture en retard</p>
          <p className="text-sm text-muted-foreground mt-1">Tous les paiements sont à jour.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {invoices.map((inv) => {
        const justSent = sent[inv.id];
        const isSending = sending[inv.id];
        const lastLevel = justSent ?? inv.lastReminder?.level ?? null;
        const levelInfo = lastLevel ? LEVEL_LABELS[lastLevel] : null;

        return (
          <Card key={inv.id} className={inv.daysOverdue > 30 ? "border-red-200" : inv.daysOverdue > 15 ? "border-amber-200" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Invoice info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`./invoices/${inv.id}`} className="font-semibold hover:underline text-sm">
                      {inv.invoice_number}
                    </Link>
                    <Badge
                      className={`text-[10px] px-1.5 py-0 ${inv.daysOverdue > 30 ? "bg-red-100 text-red-700 border-red-200" : inv.daysOverdue > 15 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"}`}
                    >
                      J+{inv.daysOverdue}
                    </Badge>
                    {levelInfo && !justSent && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${levelInfo.color}`}>
                        {levelInfo.label} envoyé
                      </Badge>
                    )}
                    {justSent && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">
                        Envoyé
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm mt-1 font-medium">{inv.customerName}</p>
                  {inv.customerEmail && (
                    <p className="text-xs text-muted-foreground">{inv.customerEmail}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-bold">{fmt(inv.total_ttc)}</span>
                    <span className="text-xs text-muted-foreground">Échéance : {new Date(inv.due_date).toLocaleDateString("fr-FR")}</span>
                  </div>
                  {inv.lastReminder && !justSent && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Dernière relance le {new Date(inv.lastReminder.sent_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Link href={`./invoices/${inv.id}`}>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5" /> Voir
                    </Button>
                  </Link>

                  {justSent ? (
                    <Button size="sm" disabled className="h-8 gap-1.5 text-xs bg-green-600">
                      <CheckCircle className="h-3.5 w-3.5" /> Envoyé
                    </Button>
                  ) : inv.nextDisabled ? (
                    <Button size="sm" disabled variant="outline" className="h-8 gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5" /> {inv.nextLabel}
                    </Button>
                  ) : inv.nextLevel ? (
                    <Button
                      size="sm"
                      className={`h-8 gap-1.5 text-xs ${inv.nextLevel === 3 ? "bg-red-700 hover:bg-red-800" : inv.nextLevel === 2 ? "bg-orange-600 hover:bg-orange-700" : ""}`}
                      onClick={() => sendReminder(inv)}
                      disabled={isSending}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isSending ? "Envoi..." : inv.nextLabel}
                    </Button>
                  ) : null}

                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Stats bar for the page header
export function RemindersStats({ invoices }: { invoices: ReminderInvoice[] }) {
  const total = invoices.reduce((s, i) => s + i.total_ttc, 0);
  const urgent = invoices.filter((i) => i.daysOverdue > 30).length;
  const noReminder = invoices.filter((i) => !i.lastReminder).length;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">Total impayé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-600">{fmt(total)}</p>
          <p className="text-xs text-muted-foreground">{invoices.length} facture{invoices.length !== 1 ? "s" : ""}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">Urgentes (30+ jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${urgent > 0 ? "text-red-600" : "text-muted-foreground"}`}>{urgent}</p>
          <p className="text-xs text-muted-foreground">factures critiques</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Sans relance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${noReminder > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{noReminder}</p>
          <p className="text-xs text-muted-foreground">jamais contactées</p>
        </CardContent>
      </Card>
    </div>
  );
}
