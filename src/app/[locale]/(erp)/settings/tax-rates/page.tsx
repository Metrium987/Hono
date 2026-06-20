"use client";

import { useState, useEffect, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2, Trash2, Check, X, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type TaxRate = {
  id: string;
  name: string;
  rate: number;
  description: string | null;
  is_active: boolean;
};

export default function TaxRatesPage() {
  const t = useTranslations("tax_rates_page");
  const common = useTranslations("common");
  const [taxes, setTaxes] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState("");

  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: memberships } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .limit(1);
        const tid = memberships?.[0]?.team_id ?? "";
        setTeamId(tid);

        if (tid) {
          const res = await fetch(`/api/v1/settings/tax-rates?team_id=${tid}`);
          const body = await res.json();
          setTaxes(body.data ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newRate.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/settings/tax-rates?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          rate: parseFloat(newRate),
          description: newDesc.trim() || null,
          is_active: true,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? common("unknown_error"));
        return;
      }

      const d = await res.json();
      setTaxes([...taxes, d.data]);
      setNewName("");
      setNewRate("");
      setNewDesc("");
      setDialogOpen(false);
    } catch {
      setError(common("connection_error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tax: TaxRate) {
    try {
      const res = await fetch(`/api/v1/settings/tax-rates?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tax.id, is_active: !tax.is_active }),
      });
      if (res.ok) {
        setTaxes(taxes.map((t) => t.id === tax.id ? { ...t, is_active: !t.is_active } : t));
      }
    } catch { /* ignore */ }
  }

  async function deleteTax(id: string) {
    try {
      const res = await fetch(`/api/v1/settings/tax-rates?id=${id}&team_id=${teamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTaxes(taxes.filter((t) => t.id !== id));
      }
    } catch { /* ignore */ }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="../settings"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("rates_count", { count: taxes.length })}</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> {t("add_button")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("new_dialog_title")}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("name_label")}</Label>
                <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("new_name_placeholder")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate">{t("rate_label")}</Label>
                <Input id="rate" type="number" step="0.01" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder={t("new_rate_placeholder")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">{t("desc_label")}</Label>
                <Input id="desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t("desc_placeholder")} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {common("creating")}</> : t("save_button")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {taxes.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t("no_tax_rates")}</CardContent></Card>
        ) : (
          taxes.map((tax) => (
            <Card key={tax.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleActive(tax)} className="p-1">
                    {tax.is_active ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <div>
                    <p className="font-medium text-sm">{tax.name} — {tax.rate}%</p>
                    {tax.description && <p className="text-xs text-muted-foreground">{tax.description}</p>}
                  </div>
                  {tax.is_active ? <Badge variant="success" className="text-[10px]">{common("active")}</Badge> : <Badge variant="secondary" className="text-[10px]">{common("inactive")}</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteTax(tax.id)}>
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
