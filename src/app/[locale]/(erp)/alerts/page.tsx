"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Alert = {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  entity_type: string | null;
  is_dismissed: boolean;
  created_at: string;
};

const SEVERITY_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  low: "secondary", medium: "default", high: "destructive", critical: "destructive",
};

export default function AlertsPage() {
  const perm = useClientPermission("governance", "read");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/alerts?team_id=${perm.teamId}`);
        const json = await res.json();
        setAlerts(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  async function handleDismiss(id: string) {
    setDismissing(id);
    try {
      const res = await fetch(`/api/v1/alerts/${id}/dismiss?team_id=${perm.teamId}`, { method: "PATCH" });
      if (res.ok) setAlerts((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDismissing(null);
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="governance" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertes système</h1>
          <p className="text-sm text-muted-foreground">{alerts.length} alerte(s) active(s)</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <CheckSquare className="h-10 w-10 mb-3 opacity-30 text-green-600 dark:text-green-400" />
          <p className="font-medium">Aucune alerte active</p>
          <p className="text-sm mt-1">Tout est en ordre.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/20 transition-colors">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{alert.title}</p>
                  <Badge variant={SEVERITY_VARIANTS[alert.severity] ?? "secondary"} className="text-[10px]">
                    {alert.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{alert.alert_type}</span>
                </div>
                <p className="text-sm text-muted-foreground">{alert.message}</p>
                <p className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => handleDismiss(alert.id)} disabled={dismissing === alert.id}>
                {dismissing === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fermer"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
