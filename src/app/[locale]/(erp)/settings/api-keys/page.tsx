"use client";

import { useState, useEffect, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2, Trash2, Copy, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type ApiKey = {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export default function ApiKeysPage() {
  const t = useTranslations("api_keys_page");
  const common = useTranslations("common");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expiresIn, setExpiresIn] = useState("365");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: memberships } = await supabase
          .from("team_members")
          .select("team_id, is_owner")
          .eq("user_id", user.id)
          .limit(1);
        const tid = memberships?.[0]?.team_id ?? "";
        setTeamId(tid);

        if (tid) {
          const res = await fetch(`/api/v1/settings/api-keys?team_id=${tid}`);
          const data = await res.json();
          setKeys(data.data ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    setNewKey(null);

    try {
      const res = await fetch(`/api/v1/settings/api-keys?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          expires_in_days: parseInt(expiresIn) || 365,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? common("unknown_error"));
        return;
      }

      const d = await res.json();
      setNewKey(d.data.raw_key);
      setKeys([d.data, ...keys]);
      setName("");
      setDescription("");
    } catch {
      setError(common("connection_error"));
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm(t("revoke_confirm"))) return;
    try {
      const res = await fetch(`/api/v1/settings/api-keys?id=${id}&team_id=${teamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== id));
      }
    } catch { /* ignore */ }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
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
            {t("keys_count", { count: keys.length })}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> {t("new_key_button")}</Button>
          </DialogTrigger>
          <DialogContent className={newKey ? "max-w-lg" : ""}>
            {newKey ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <p className="font-medium">{t("key_created_success")}</p>
                </div>
                <p className="text-sm text-destructive font-medium">
                  {t("key_once_message")}
                </p>
                <div className="flex gap-2">
                  <Input value={newKey} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(newKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button className="w-full" onClick={() => { setDialogOpen(false); setNewKey(null); }}>
                  {t("key_copied_button")}
                </Button>
              </div>
            ) : (
              <>
                <DialogHeader><DialogTitle>{t("new_key_dialog_title")}</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("name_label")}</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name_placeholder")} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc">{t("description_label")}</Label>
                    <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("description_placeholder")} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires">{t("expires_label")}</Label>
                    <Input id="expires" type="number" value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} min="1" max="3650" />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {common("creating")}</> : t("create_button")}
                  </Button>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {keys.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t("no_keys_hint")}</CardContent></Card>
        ) : (
          keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{key.name}</p>
                    <Badge variant="secondary" className="text-[10px] font-mono">{key.key_prefix}...</Badge>
                  </div>
                  {key.description && <p className="text-xs text-muted-foreground">{key.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {t("created_on", { date: new Date(key.created_at).toLocaleDateString("fr-FR") })}
                    {key.expires_at && <> — {t("expires_on", { date: new Date(key.expires_at).toLocaleDateString("fr-FR") })}</>}
                    {key.last_used_at && <> — {t("last_used_on", { date: new Date(key.last_used_at).toLocaleDateString("fr-FR") })}</>}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => revokeKey(key.id)}>
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
