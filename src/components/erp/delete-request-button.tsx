"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteRequestButton({
  teamId,
  tableName,
  recordId,
  label = "Demander la suppression",
}: {
  teamId: string;
  tableName: string;
  recordId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/delete-requests?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_name: tableName, record_id: recordId, reason }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success("Demande de suppression envoyée à l'administrateur");
      setOpen(false);
      setReason("");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="mr-2 h-4 w-4" />{label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Demander la suppression</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            En mode éducatif, les suppressions nécessitent l&apos;approbation d&apos;un administrateur.
          </p>
          <div className="space-y-2">
            <Label>Raison (optionnel)</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Expliquez pourquoi cette suppression est nécessaire..."
              rows={3}
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={submit} disabled={loading} variant="destructive" className="flex-1">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi…</> : "Envoyer la demande"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
