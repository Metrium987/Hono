"use client";

import { useState, useEffect, FormEvent } from "react";
import { Bell, Loader2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Bucket = {
  id: string;
  bucket: string;
  label: string | null;
  created_at: string;
  assignees: { user_id: string }[] | null;
};

type RoutingRule = {
  id: string;
  alert_type: string;
  bucket: string;
  is_active: boolean;
  created_at: string;
};

export default function NotificationsSettingsPage() {
  const perm = useClientPermission("governance", "read");
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [routing, setRouting] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBucket, setNewBucket] = useState("");
  const [newBucketLabel, setNewBucketLabel] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const [bRes, rRes] = await Promise.all([
          fetch(`/api/v1/notifications/buckets?team_id=${perm.teamId}`),
          fetch(`/api/v1/notifications/routing?team_id=${perm.teamId}`),
        ]);
        setBuckets((await bRes.json()).data ?? []);
        setRouting((await rRes.json()).data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="governance" />;

  async function handleCreateBucket(e: FormEvent) {
    e.preventDefault();
    if (!newBucket.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/notifications/buckets?team_id=${perm.teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: newBucket.trim(), label: newBucketLabel.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur");
        return;
      }
      const json = await res.json();
      setBuckets((prev) => [...prev, json.data]);
      setNewBucket("");
      setNewBucketLabel("");
    } catch {
      setError("Erreur de connexion");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Configuration des buckets et du routage des notifications</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Buckets de notification</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {buckets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun bucket configuré</p>
          ) : (
            <div className="space-y-2">
              {buckets.map((b) => (
                <div key={b.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{b.label ?? b.bucket}</p>
                    <p className="text-xs text-muted-foreground">{b.bucket} · {b.assignees?.length ?? 0} assigné(s)</p>
                  </div>
                  <Badge variant="secondary">{b.bucket}</Badge>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleCreateBucket} className="flex gap-3 items-end pt-2 border-t">
            <div className="space-y-1 flex-1">
              <Label htmlFor="bucket" className="text-xs">Identifiant technique</Label>
              <Input id="bucket" value={newBucket} onChange={(e) => setNewBucket(e.target.value)} placeholder="ex: invoice_alerts" required />
            </div>
            <div className="space-y-1 flex-1">
              <Label htmlFor="label" className="text-xs">Libellé</Label>
              <Input id="label" value={newBucketLabel} onChange={(e) => setNewBucketLabel(e.target.value)} placeholder="Alertes factures" />
            </div>
            <Button type="submit" disabled={creating || !newBucket.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ajouter
            </Button>
          </form>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Règles de routage</CardTitle></CardHeader>
        <CardContent className="p-0">
          {routing.length === 0 ? (
            <p className="text-center p-6 text-sm text-muted-foreground">Aucune règle de routage</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-3 font-medium">Type d&apos;alerte</th>
                  <th className="text-left p-3 font-medium">Bucket cible</th>
                  <th className="text-center p-3 font-medium">Actif</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {routing.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{r.alert_type}</td>
                    <td className="p-3">{r.bucket}</td>
                    <td className="p-3 text-center">
                      <Badge variant={r.is_active ? "success" : "secondary"}>
                        {r.is_active ? "Oui" : "Non"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
