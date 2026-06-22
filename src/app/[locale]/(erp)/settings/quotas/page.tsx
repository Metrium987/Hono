"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Quota = {
  max_users: number;
  max_products: number;
  max_customers: number;
  max_warehouses: number;
  max_storage_mb: number;
};

type Usage = {
  products: number;
  customers: number;
  warehouses: number;
  users: number;
};

function QuotaBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{used} / {max}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isDanger ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pct}% utilisé</p>
    </div>
  );
}

export default function QuotasSettingsPage() {
  const perm = useClientPermission("settings", "read");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/team/quotas?team_id=${perm.teamId}`);
        const json = await res.json();
        setQuota(json.data ?? {
          max_users: 1, max_products: 500, max_customers: 50,
          max_warehouses: 1, max_storage_mb: 500,
        });
        setUsage(json.usage ?? null);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="settings" />;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quotas & Limites</h1>
        <p className="text-sm text-muted-foreground mt-1">Utilisation de votre plan actuel.</p>
      </div>

      {quota && usage ? (
        <div className="space-y-6 rounded-lg border p-6">
          <QuotaBar label="Utilisateurs" used={usage.users} max={quota.max_users} />
          <QuotaBar label="Produits" used={usage.products} max={quota.max_products} />
          <QuotaBar label="Clients" used={usage.customers} max={quota.max_customers} />
          <QuotaBar label="Entrepôts" used={usage.warehouses} max={quota.max_warehouses} />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Stockage</span>
              <span className="text-muted-foreground">{quota.max_storage_mb} Mo inclus</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Aucun quota configuré pour cette équipe.
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Contactez l&apos;administrateur pour modifier les limites de votre plan.
      </p>
    </div>
  );
}
