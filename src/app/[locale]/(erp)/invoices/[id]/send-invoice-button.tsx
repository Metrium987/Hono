"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";

export function SendInvoiceButton({
  invoiceId, teamId, customerEmail,
}: {
  invoiceId: string;
  teamId: string;
  customerEmail: string;
}) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/send?team_id=${teamId}`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success(`Facture envoyée à ${customerEmail}`);
      } else {
        toast.error("Échec de l'envoi de la facture");
      }
    } catch {
      toast.error("Erreur réseau lors de l'envoi");
    } finally {
      setSending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={send} disabled={sending}>
      <Send className="mr-2 h-4 w-4" />
      {sending ? "Envoi..." : "Envoyer par email"}
    </Button>
  );
}
