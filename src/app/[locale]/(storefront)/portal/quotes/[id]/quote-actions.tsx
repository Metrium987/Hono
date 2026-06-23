"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function PortalQuoteActions({ quoteId }: { quoteId: string }) {
  const [loading, setLoading] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAction(action: "accepted" | "rejected") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/portal/quotes/${quoteId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          onClick={() => handleAction("accepted")}
          disabled={!!loading}
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          {loading === "accepted" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Accepter
        </Button>
        <Button
          onClick={() => handleAction("rejected")}
          disabled={!!loading}
          variant="outline"
          className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
          size="sm"
        >
          {loading === "rejected" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Refuser
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
