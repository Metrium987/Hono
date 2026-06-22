"use client";

import { useState, useEffect } from "react";
import { Plug, Plus, Loader2, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Account = {
  id: string;
  platform: string;
  account_name: string;
  platform_user_id: string | null;
  is_active: boolean;
  token_expires_at: string | null;
  created_at: string;
};

export default function IntegrationsSettingsPage() {
  const perm = useClientPermission("marketplace", "read");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [platform, setPlatform] = useState("");
  const [accountName, setAccountName] = useState("");
  const [platformUserId, setPlatformUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/marketplace/accounts?team_id=${perm.teamId}`);
        const json = await res.json();
        setAccounts(json.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  function openCreate() {
    setEditId(null); setPlatform(""); setAccountName(""); setPlatformUserId(""); setError(null);
    setDialogOpen(true);
  }

  function openEdit(acc: Account) {
    setEditId(acc.id); setPlatform(acc.platform); setAccountName(acc.account_name);
    setPlatformUserId(acc.platform_user_id ?? ""); setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!platform.trim()) { setError("La plateforme est requise"); return; }
    if (!accountName.trim()) { setError("Le nom du compte est requis"); return; }
    setSaving(true); setError(null);
    try {
      const body = { platform: platform.trim(), account_name: accountName.trim(), platform_user_id: platformUserId.trim() || null };
      const res = editId
        ? await fetch(`/api/v1/marketplace/accounts/${editId}?team_id=${perm.teamId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_name: accountName.trim() }) })
        : await fetch(`/api/v1/marketplace/accounts?team_id=${perm.teamId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      if (editId) {
        setAccounts((prev) => prev.map((a) => a.id === editId ? { ...a, ...json.data } : a));
      } else {
        setAccounts((prev) => [json.data, ...prev]);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(acc: Account) {
    const res = await fetch(`/api/v1/marketplace/accounts/${acc.id}?team_id=${perm.teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !acc.is_active }),
    });
    if (res.ok) {
      setAccounts((prev) => prev.map((a) => a.id === acc.id ? { ...a, is_active: !a.is_active } : a));
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="marketplace" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plug className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Intégrations marketplace</h1>
            <p className="text-sm text-muted-foreground">{accounts.length} compte(s) connecté(s)</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Connecter un compte
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Plug className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucune plateforme connectée</p>
          <p className="text-sm mt-1">Connectez un compte marketplace pour synchroniser vos annonces.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plateforme</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Compte</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium capitalize">{acc.platform}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {acc.account_name}
                    {acc.platform_user_id && <span className="ml-2 text-xs opacity-60">#{acc.platform_user_id}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={acc.is_active ? "success" : "secondary"} className="text-[10px]">
                      {acc.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Switch checked={acc.is_active} onCheckedChange={() => toggleActive(acc)} className="h-4 w-7" />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(acc)}>
                        <Pencil className="h-3.5 w-3.5" />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier le compte" : "Connecter une plateforme"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plateforme *</Label>
              <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Ex: facebook, shopify, woocommerce..." disabled={!!editId} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Nom du compte *</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Ex: Ma boutique Facebook" />
            </div>
            {!editId && (
              <div className="space-y-2">
                <Label>ID utilisateur plateforme</Label>
                <Input value={platformUserId} onChange={(e) => setPlatformUserId(e.target.value)} placeholder="Optionnel..." />
              </div>
            )}
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
