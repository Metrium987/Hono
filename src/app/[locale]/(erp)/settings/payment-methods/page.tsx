"use client";

import { useState, useEffect, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2, Trash2, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type PaymentMethod = {
  id: string;
  name: string;
  display_name: string | null;
  is_active: boolean;
  sort_order: number;
};

export default function PaymentMethodsPage() {
  const perm = useClientPermission("settings", "write");
  const t = useTranslations("payment_methods_page");
  const common = useTranslations("common");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        if (!perm.teamId) return;

        const res = await fetch(`/api/v1/settings/payment-methods?team_id=${perm.teamId}`);
        const data = await res.json();
        setMethods(data.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/settings/payment-methods?team_id=${perm.teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          display_name: newDisplayName.trim() || null,
          is_active: true,
          sort_order: methods.length,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? common("unknown_error"));
        return;
      }

      const d = await res.json();
      setMethods([...methods, d.data]);
      setNewName("");
      setNewDisplayName("");
      setDialogOpen(false);
    } catch {
      setError(common("connection_error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(method: PaymentMethod) {
    try {
      const res = await fetch(`/api/v1/settings/payment-methods?team_id=${perm.teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: method.id, is_active: !method.is_active }),
      });
      if (res.ok) {
        setMethods(methods.map((m) => m.id === method.id ? { ...m, is_active: !m.is_active } : m));
      }
    } catch { /* ignore */ }
  }

  async function deleteMethod(id: string) {
    try {
      const res = await fetch(`/api/v1/settings/payment-methods?id=${id}&team_id=${perm.teamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMethods(methods.filter((m) => m.id !== id));
      }
    } catch { /* ignore */ }
  }

  if (perm.loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) {
    return <ClientForbiddenPage module="settings" action="write" />;
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("methods_count", { count: methods.length })}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> {t("add_button")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("new_dialog_title")}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("id_label")}</Label>
                <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("id_placeholder")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display">{t("display_name_label")}</Label>
                <Input id="display" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder={t("new_name_placeholder")} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {common("creating")}</> : t("create_button")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {methods.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t("no_methods")}</CardContent></Card>
        ) : (
          methods.map((method) => (
            <Card key={method.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleActive(method)} className="p-1">
                    {method.is_active ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <div>
                    <p className="font-medium text-sm">{method.display_name ?? method.name}</p>
                    <p className="text-xs text-muted-foreground">{method.name}</p>
                  </div>
                  {method.is_active ? <Badge variant="success" className="text-[10px]">{common("active")}</Badge> : <Badge variant="secondary" className="text-[10px]">{common("inactive")}</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMethod(method.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
