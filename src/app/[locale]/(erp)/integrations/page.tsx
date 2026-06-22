"use client";

import { useState, useEffect } from "react";
import { Plug, Loader2 } from "lucide-react";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Log = {
  id: string;
  source: string;
  level: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
};

type Failure = {
  id: string;
  source: string;
  action: string;
  error_message: string;
  is_resolved: boolean;
  created_at: string;
};

export default function IntegrationsPage() {
  const perm = useClientPermission("integrations", "read");
  const [logs, setLogs] = useState<Log[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const [logRes, failRes] = await Promise.all([
          fetch(`/api/v1/integrations/logs?team_id=${perm.teamId}`),
          fetch(`/api/v1/integrations/failures?team_id=${perm.teamId}`),
        ]);
        setLogs((await logRes.json()).data ?? []);
        setFailures((await failRes.json()).data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="integrations" />;

  const levelVariant: Record<string, "default" | "success" | "destructive" | "warning"> = {
    info: "default", success: "success", error: "destructive", warn: "warning",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intégrations</h1>
          <p className="text-sm text-muted-foreground">
            {logs.length} logs · {failures.length} échec(s) non résolu(s)
          </p>
        </div>
      </div>

      <Tabs defaultValue="failures">
        <TabsList>
          <TabsTrigger value="failures">Échecs ({failures.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="failures" className="mt-4">
          {failures.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Plug className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Aucun échec</p>
              <p className="text-sm mt-1">Toutes les intégrations fonctionnent correctement.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {failures.map((f) => (
                <div key={f.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium text-sm">{f.source}</span>
                      <Badge className="ml-2">{f.action}</Badge>
                    </div>
                    <Badge variant={f.is_resolved ? "success" : "destructive"}>
                      {f.is_resolved ? "Résolu" : "En cours"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 font-mono text-xs">{f.error_message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(f.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Plug className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Aucun log</p>
              <p className="text-sm mt-1">Les logs d&apos;intégration apparaîtront ici.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Niveau</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Message</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Résolu</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 font-medium">{l.source}</td>
                      <td className="px-4 py-3">
                        <Badge variant={levelVariant[l.level] ?? "default"}>{l.level}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{l.message}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={l.is_resolved ? "success" : "secondary"}>
                          {l.is_resolved ? "Oui" : "Non"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
