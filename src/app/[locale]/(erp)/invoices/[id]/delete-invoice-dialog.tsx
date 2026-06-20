"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeleteInvoiceDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  teamId: string;
  status: string;
}

export function DeleteInvoiceDialog({ invoiceId, invoiceNumber, teamId, status }: DeleteInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Only draft invoices can be archived
  if (status !== "draft") return null;

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v1/invoices/${invoiceId}?team_id=${teamId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erreur lors de la suppression");
      setLoading(false);
      return;
    }
    setOpen(false);
    router.push("../invoices");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-destructive hover:text-destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        Archiver
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Archiver la facture {invoiceNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Obligation légale — Polynésie française</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                Les factures ne peuvent jamais être définitivement supprimées. Conformément à la réglementation fiscale
                en Polynésie française, elles doivent être conservées pendant <strong>10 ans</strong>.
              </p>
            </div>
            <p className="text-muted-foreground">
              Cette facture brouillon sera <strong>archivée</strong> (masquée de la liste active) mais restera
              accessible dans les archives. Elle ne pourra pas être transmise à un client après archivage.
            </p>
            {error && <p className="text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Archivage…" : "Archiver la facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
