"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";

export function SendQuoteButton({
  quoteId,
  teamId,
  customerEmail,
}: {
  quoteId: string;
  teamId: string;
  customerEmail: string;
}) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/v1/quotes/${quoteId}/send?team_id=${teamId}`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success(`Devis envoyé à ${customerEmail}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Échec de l'envoi du devis");
      }
    } catch {
      toast.error("Erreur réseau lors de l'envoi");
    } finally {
      setSending(false);
    }
  }

  return (
    <Button variant="outline" onClick={send} disabled={sending}>
      <Send className="mr-2 h-4 w-4" />
      {sending ? "Envoi..." : "Envoyer par email"}
    </Button>
  );
}
