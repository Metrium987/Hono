"use client";

import { useState } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type SessionRow = {
  id: string;
  row_index: number;
  status: string;
  action: string | null;
  raw_data: Record<string, unknown>;
  resolved_category_id: string | null;
  resolved_brand_id: string | null;
  errors: Record<string, unknown> | null;
};

export default function CatalogImportPage() {
  const perm = useClientPermission("catalog", "write");
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setError("Format accepté : fichier JSON contenant un tableau de produits [{name, sku, price_ht, currency_id, ...}]");
      return;
    }

    setLoading(true); setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setError("Le fichier doit contenir un tableau JSON de produits");
        return;
      }

      const res = await fetch(`/api/v1/import/sessions?team_id=${perm.teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, rows: parsed }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur lors de l'import"); return; }

      setSessionId(json.data.id);

      const rowsRes = await fetch(`/api/v1/import/sessions/${json.data.id}/rows?team_id=${perm.teamId}`);
      const rowsJson = await rowsRes.json();
      setRows(rowsJson.data ?? []);
      setStep("review");
    } catch (err) {
      setError("Erreur lors de la lecture du fichier : " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  async function handleSetAction(rowId: string, action: "insert" | "update" | "skip") {
    if (!sessionId) return;
    const res = await fetch(`/api/v1/import/sessions/${sessionId}/rows/${rowId}?team_id=${perm.teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const json = await res.json();
      setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, action: json.data.action } : r));
    }
  }

  async function handleCommit() {
    if (!sessionId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/v1/import/sessions/${sessionId}/commit?team_id=${perm.teamId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur lors du commit"); return; }
      setResult(json);
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  if (perm.loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="catalog" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import catalogue</h1>
          <p className="text-sm text-muted-foreground">Importez des produits depuis un fichier JSON</p>
        </div>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sélectionner un fichier</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <div>
                <p className="font-medium">Fichier JSON de produits</p>
                <p className="text-sm text-muted-foreground">Format attendu : tableau [{`{name, sku, price_ht, currency_id, ...}`}]</p>
              </div>
              <label className="cursor-pointer">
                <input type="file" accept=".json" className="hidden" onChange={handleFileChange} disabled={loading} />
                <Button type="button" variant="outline" disabled={loading} asChild>
                  <span>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Chargement...</> : "Parcourir..."}</span>
                </Button>
              </label>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Révision — {rows.length} lignes</CardTitle>
              <Button onClick={handleCommit} disabled={loading || rows.filter(r => r.action).length === 0}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Import...</> : "Valider et importer"}
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Définissez l&apos;action pour chaque ligne avant de valider.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nom</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Prix HT</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground">{row.row_index + 1}</td>
                        <td className="px-3 py-2 font-medium">{String(row.raw_data.name ?? "—")}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{String(row.raw_data.sku ?? "—")}</td>
                        <td className="px-3 py-2 text-right">{row.raw_data.price_ht ? `${row.raw_data.price_ht} F` : "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-center">
                            {(["insert", "update", "skip"] as const).map((action) => (
                              <button key={action} onClick={() => handleSetAction(row.id, action)}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${row.action === action ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                                {action === "insert" ? "Créer" : action === "update" ? "MAJ" : "Ignorer"}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </>
      )}

      {step === "done" && result && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold">Import terminé</h2>
            <div className="flex gap-4 justify-center flex-wrap">
              <Badge variant="success">{result.inserted} créé(s)</Badge>
              <Badge variant="default">{result.updated} mis à jour</Badge>
              <Badge variant="secondary">{result.skipped} ignoré(s)</Badge>
              {result.failed > 0 && <Badge variant="destructive">{result.failed} erreur(s)</Badge>}
            </div>
            <Button onClick={() => { setStep("upload"); setRows([]); setSessionId(null); setResult(null); }} variant="outline">
              Nouvel import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
