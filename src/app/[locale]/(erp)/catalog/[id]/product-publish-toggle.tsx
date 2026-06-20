"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type Props = {
  productId: string;
  teamId: string;
  initialPublished: boolean;
};

export function ProductPublishToggle({ productId, teamId, initialPublished }: Props) {
  const [published, setPublished] = useState(initialPublished);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(value: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/products/${productId}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: value }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erreur");
        return;
      }
      setPublished(value);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch id="publish-toggle" checked={published} onCheckedChange={toggle} disabled={loading} />
      )}
      <Label htmlFor="publish-toggle" className="cursor-pointer">
        {published ? "Publié sur la boutique" : "Brouillon (non visible)"}
      </Label>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
