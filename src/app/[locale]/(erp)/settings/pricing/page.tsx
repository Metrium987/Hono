"use client";

import { useState, useEffect } from "react";
import { Percent, Plus, Pencil, Trash2, Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type PricingRule = {
  id: string;
  name: string;
  rule_type: string;
  conditions: Record<string, unknown>;
  adjustments: Record<string, unknown>;
  priority: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
};

const RULE_TYPE_LABELS: Record<string, string> = {
  margin: "Marge minimale",
  discount: "Remise",
  markup: "Majoration",
  fixed: "Prix fixe",
  tiered: "Paliers",
  exchange: "Taux de change",
};

export default function PricingSettingsPage() {
  const perm = useClientPermission("settings", "read");
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<PricingRule | null>(null);

  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState("margin");
  const [adjustments, setAdjustments] = useState("{}");
  const [conditions, setConditions] = useState("{}");
  const [priority, setPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/pricing/rules?team_id=${perm.teamId}`);
        const json = await res.json();
        setRules(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  function openCreate() {
    setEditRule(null);
    setName(""); setRuleType("margin"); setAdjustments("{}"); setConditions("{}");
    setPriority("0"); setIsActive(true); setError(null);
    setDialogOpen(true);
  }

  function openEdit(rule: PricingRule) {
    setEditRule(rule);
    setName(rule.name); setRuleType(rule.rule_type);
    setAdjustments(JSON.stringify(rule.adjustments, null, 2));
    setConditions(JSON.stringify(rule.conditions, null, 2));
    setPriority(String(rule.priority)); setIsActive(rule.is_active); setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Le nom est obligatoire"); return; }
    let parsedAdj: Record<string, unknown> = {};
    let parsedCond: Record<string, unknown> = {};
    try { parsedAdj = JSON.parse(adjustments); } catch { setError("Ajustements : JSON invalide"); return; }
    try { parsedCond = JSON.parse(conditions); } catch { setError("Conditions : JSON invalide"); return; }

    setSaving(true); setError(null);
    try {
      const body = { name: name.trim(), rule_type: ruleType, adjustments: parsedAdj, conditions: parsedCond, priority: Number(priority) || 0, is_active: isActive };
      const res = editRule
        ? await fetch(`/api/v1/pricing/rules/${editRule.id}?team_id=${perm.teamId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`/api/v1/pricing/rules?team_id=${perm.teamId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      if (editRule) {
        setRules((prev) => prev.map((r) => r.id === editRule.id ? json.data : r));
      } else {
        setRules((prev) => [json.data, ...prev]);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/v1/pricing/rules/${id}?team_id=${perm.teamId}`, { method: "DELETE" });
      if (res.ok) setRules((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="settings" />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="../settings"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <Percent className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Règles de tarification</h1>
            <p className="text-sm text-muted-foreground">{rules.length} règle(s)</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouvelle règle
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Percent className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucune règle de tarification</p>
          <p className="text-sm mt-1">Créez des règles pour automatiser la mise à jour de vos prix.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nom</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Priorité</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <Badge variant={rule.is_active ? "success" : "secondary"} className="text-[10px]">
                      {rule.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(rule.id)} disabled={deleting === rule.id}>
                        {deleting === rule.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editRule ? "Modifier la règle" : "Nouvelle règle de tarification"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marge minimum 20%" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={ruleType} onValueChange={setRuleType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RULE_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ajustements (JSON)</Label>
              <Textarea value={adjustments} onChange={(e) => setAdjustments(e.target.value)} rows={3} className="font-mono text-xs" placeholder='{"margin_pct": 20}' />
            </div>
            <div className="space-y-2">
              <Label>Conditions (JSON)</Label>
              <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={3} className="font-mono text-xs" placeholder='{"category_id": "..."}' />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="rule-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="rule-active">Règle active</Label>
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
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
