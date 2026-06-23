"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GenerateInvoiceButton({ orderId, teamId }: { orderId: string; teamId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/invoice?team_id=${teamId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Erreur lors de la génération");
        return;
      }
      toast.success(`Facture ${json.data.invoice_number} créée`);
      router.push(`../invoices/${json.data.id}`);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
      Générer une facture
    </Button>
  );
}
