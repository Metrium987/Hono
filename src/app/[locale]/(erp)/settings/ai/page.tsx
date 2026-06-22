"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type PromptConfig = {
  id: string;
  config_key: string;
  system_prompt: string;
  business_context: string | null;
  category_rules: string | null;
  active: boolean;
  updated_at: string;
};

export default function AISettingsPage() {
  const perm = useClientPermission("settings", "read");
  const [configs, setConfigs] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<PromptConfig | null>(null);

  const [configKey, setConfigKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [categoryRules, setCategoryRules] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/ai/configs?team_id=${perm.teamId}&active=false`);
        const json = await res.json();
        setConfigs(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  function openCreate() {
    setEditConfig(null);
    setConfigKey(""); setSystemPrompt(""); setBusinessContext(""); setCategoryRules(""); setIsActive(true); setError(null);
    setDialogOpen(true);
  }

  function openEdit(cfg: PromptConfig) {
    setEditConfig(cfg);
    setConfigKey(cfg.config_key); setSystemPrompt(cfg.system_prompt);
    setBusinessContext(cfg.business_context ?? ""); setCategoryRules(cfg.category_rules ?? "");
    setIsActive(cfg.active); setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!systemPrompt.trim()) { setError("Le prompt système est obligatoire"); return; }
    setSaving(true); setError(null);
    try {
      if (editConfig) {
        const res = await fetch(`/api/v1/ai/configs/${editConfig.id}?team_id=${perm.teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system_prompt: systemPrompt.trim(), business_context: businessContext.trim() || null, category_rules: categoryRules.trim() || null, active: isActive }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erreur"); return; }
        setConfigs((prev) => prev.map((c) => c.id === editConfig.id ? json.data : c));
      } else {
        if (!configKey.trim()) { setError("La clé est obligatoire"); return; }
        const res = await fetch(`/api/v1/ai/configs?team_id=${perm.teamId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config_key: configKey.trim(), system_prompt: systemPrompt.trim(), business_context: businessContext.trim() || null, category_rules: categoryRules.trim() || null, active: isActive }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erreur"); return; }
        setConfigs((prev) => [...prev, json.data]);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="settings" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurations IA</h1>
          <p className="text-sm text-muted-foreground mt-1">Prompts système pour les fonctionnalités IA par module.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouveau prompt
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <p className="font-medium">Aucune configuration IA</p>
          <p className="text-sm mt-1">Ajoutez des prompts système pour personnaliser le comportement de l&apos;IA.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <div key={cfg.id} className="rounded-lg border p-4 space-y-2 hover:bg-muted/20 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{cfg.config_key}</code>
                  <Badge variant={cfg.active ? "success" : "secondary"} className="text-[10px]">
                    {cfg.active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cfg)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{cfg.system_prompt}</p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editConfig ? `Modifier — ${editConfig.config_key}` : "Nouveau prompt IA"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editConfig && (
              <div className="space-y-2">
                <Label>Clé *</Label>
                <Input value={configKey} onChange={(e) => setConfigKey(e.target.value)} placeholder="Ex: container_matching, invoice_summary..." />
              </div>
            )}
            <div className="space-y-2">
              <Label>Prompt système *</Label>
              <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={5} className="font-mono text-xs resize-none" placeholder="Tu es un assistant ERP spécialisé en Polynésie française..." />
            </div>
            <div className="space-y-2">
              <Label>Contexte métier</Label>
              <Textarea value={businessContext} onChange={(e) => setBusinessContext(e.target.value)} rows={3} className="text-xs resize-none" placeholder="Infos sur l'activité de l'équipe (optionnel)..." />
            </div>
            <div className="space-y-2">
              <Label>Règles catégories</Label>
              <Textarea value={categoryRules} onChange={(e) => setCategoryRules(e.target.value)} rows={2} className="text-xs resize-none" placeholder="Règles de classification (optionnel)..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="ai-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="ai-active">Configuration active</Label>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : <><Save className="mr-1.5 h-4 w-4" />Enregistrer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
