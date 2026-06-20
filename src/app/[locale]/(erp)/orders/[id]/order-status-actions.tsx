"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OrderStatus = "pending" | "processing" | "completed" | "cancelled";

type Transition = {
  to: OrderStatus;
  labelKey: "action_start" | "action_complete" | "action_cancel";
  variant: "default" | "destructive" | "outline";
};

const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  pending: [
    { to: "processing", labelKey: "action_start", variant: "default" },
    { to: "cancelled", labelKey: "action_cancel", variant: "destructive" },
  ],
  processing: [
    { to: "completed", labelKey: "action_complete", variant: "default" },
    { to: "cancelled", labelKey: "action_cancel", variant: "destructive" },
  ],
  completed: [],
  cancelled: [],
};

const STATUS_VARIANTS: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "default",
  completed: "default",
  cancelled: "destructive",
};

type Props = {
  orderId: string;
  teamId: string;
  initialStatus: OrderStatus;
};

export function OrderStatusActions({ orderId, teamId, initialStatus }: Props) {
  const router = useRouter();
  const t = useTranslations("order_detail");
  const tStatus = useTranslations("order_status");

  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [loading, setLoading] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transitions = TRANSITIONS[status];

  async function changeStatus(newStatus: OrderStatus) {
    setLoading(newStatus);
    setError(null);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erreur");
        return;
      }
      setStatus(newStatus);
      router.refresh();
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("status_section")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Badge variant={STATUS_VARIANTS[status]} className="text-sm px-3 py-1">
          {tStatus(status)}
        </Badge>

        {transitions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {transitions.map((tr) => (
              <Button
                key={tr.to}
                variant={tr.variant}
                size="sm"
                disabled={loading !== null}
                onClick={() => changeStatus(tr.to)}
              >
                {loading === tr.to && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {t(tr.labelKey)}
              </Button>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
