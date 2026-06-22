"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type AuditLog = {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  ip_address: string | null;
  created_at: string;
  user: { id: string; full_name: string } | null;
};

const ACTION_VARIANTS: Record<string, "default" | "success" | "destructive" | "secondary"> = {
  INSERT: "success",
  UPDATE: "default",
  DELETE: "destructive",
};

const PAGE_SIZE = 50;

function formatDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function AuditLogsPage() {
  const perm = useClientPermission("governance", "read");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterTable, setFilterTable] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [tables, setTables] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!perm.teamId) return;
    setLoading(true);
    const params = new URLSearchParams({
      team_id: perm.teamId,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (filterTable !== "all") params.set("table_name", filterTable);
    if (filterAction !== "all") params.set("action", filterAction);

    try {
      const res = await fetch(`/api/v1/audit-logs?${params}`);
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
        setCount(json.count ?? 0);
        if (tables.length === 0 && json.data.length > 0) {
          const unique = [...new Set<string>(json.data.map((l: AuditLog) => l.table_name))].sort();
          setTables(unique);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [perm.teamId, page, filterTable, filterAction, tables.length]);

  useEffect(() => { load(); }, [load]);

  if (perm.loading) return null;
  if (!perm.allowed) return <ClientForbiddenPage module="governance" />;

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Journal d&apos;audit</h1>
            <p className="text-sm text-muted-foreground">{count} entrées au total</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterTable} onValueChange={(v) => { setFilterTable(v); setPage(0); }}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Toutes les tables" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les tables</SelectItem>
              {tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="INSERT">INSERT</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Événements récents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground p-4">Chargement…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Aucune entrée d&apos;audit.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Utilisateur</th>
                    <th className="text-left p-3 font-medium">Action</th>
                    <th className="text-left p-3 font-medium">Table</th>
                    <th className="text-left p-3 font-medium">Enregistrement</th>
                    <th className="text-left p-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="p-3 font-medium">{log.user?.full_name ?? <span className="text-muted-foreground italic">Système</span>}</td>
                      <td className="p-3">
                        <Badge variant={ACTION_VARIANTS[log.action] ?? "secondary"} className="text-xs">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs">{log.table_name}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{log.record_id?.slice(0, 8) ?? "—"}…</td>
                      <td className="p-3 text-xs text-muted-foreground">{log.ip_address ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page + 1} / {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
