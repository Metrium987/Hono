"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

export type PromoRow = {
  id: string;
  name: string;
  description: string | null;
  discount_type: "percent" | "fixed_amount";
  discount_value: number;
  applies_to: string;
  category_id: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  product_count: { count: number }[];
};

export type ProductOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string };

function promoStatus(p: PromoRow): "active" | "scheduled" | "expired" | "inactive" {
  if (!p.is_active) return "inactive";
  const now = Date.now();
  const start = new Date(p.starts_at).getTime();
  const end = p.ends_at ? new Date(p.ends_at).getTime() : null;
  if (start > now) return "scheduled";
  if (end && end < now) return "expired";
  return "active";
}

const STATUS_STYLES = {
  active: "bg-green-100 text-green-700 border-green-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  expired: "bg-muted text-muted-foreground border",
  inactive: "bg-muted text-muted-foreground border",
};

const STATUS_LABELS = { active: "Active", scheduled: "Planifiée", expired: "Expirée", inactive: "Inactive" };

const BLANK = {
  name: "", description: "", discount_type: "percent" as "percent" | "fixed_amount",
  discount_value: "", applies_to: "all_products",
  category_id: "", starts_at: new Date().toISOString().slice(0, 16), ends_at: "", is_active: true,
  product_ids: [] as string[],
};

export function PromotionsClient({
  initialPromos, products, categories, teamId,
}: {
  initialPromos: PromoRow[];
  products: ProductOption[];
  categories: CategoryOption[];
  teamId: string;
}) {
  const [promos, setPromos] = useState(initialPromos);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setForm({ ...BLANK, starts_at: new Date().toISOString().slice(0, 16) });
    setErr(null);
    setOpen(true);
  }

  async function openEdit(p: PromoRow) {
    const { data: ppRes } = await fetch(
      `/api/v1/promotions/${p.id}/products?team_id=${teamId}`
    ).then((r) => r.json()).catch(() => ({ data: [] }));
    const pids: string[] = Array.isArray(ppRes) ? ppRes.map((x: { product_id: string }) => x.product_id) : [];

    setEditing(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      discount_type: p.discount_type,
      discount_value: String(p.discount_value),
      applies_to: p.applies_to,
      category_id: p.category_id ?? "",
      starts_at: p.starts_at.slice(0, 16),
      ends_at: p.ends_at ? p.ends_at.slice(0, 16) : "",
      is_active: p.is_active,
      product_ids: pids,
    });
    setErr(null);
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.discount_value) { setErr("Nom et valeur requis"); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        discount_value: parseFloat(String(form.discount_value)),
        category_id: form.category_id || null,
        ends_at: form.ends_at || null,
        product_ids: form.applies_to === "selected_products" ? form.product_ids : [],
      };
      const url = editing ? `/api/v1/promotions/${editing}?team_id=${teamId}` : `/api/v1/promotions?team_id=${teamId}`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      // Refresh list
      const listRes = await fetch(`/api/v1/promotions?team_id=${teamId}`);
      const listJson = await listRes.json();
      setPromos(listJson.data ?? []);
      setOpen(false);
      toast.success(editing ? "Promotion mise à jour" : "Promotion créée");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
    finally { setSaving(false); }
  }

  async function toggleActive(p: PromoRow) {
    const res = await fetch(`/api/v1/promotions/${p.id}?team_id=${teamId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    if (res.ok) {
      setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
      toast.success(p.is_active ? "Promotion désactivée" : "Promotion activée");
    } else {
      toast.error("Erreur lors de la mise à jour");
    }
  }

  async function deletePromo(id: string) {
    if (!confirm("Supprimer cette promotion ?")) return;
    const res = await fetch(`/api/v1/promotions/${id}?team_id=${teamId}`, { method: "DELETE" });
    if (res.ok) {
      setPromos((prev) => prev.filter((x) => x.id !== id));
      toast.success("Promotion supprimée");
    } else {
      toast.error("Erreur lors de la suppression");
    }
  }

  function toggleProductId(pid: string) {
    setForm((f) => ({
      ...f,
      product_ids: f.product_ids.includes(pid)
        ? f.product_ids.filter((x) => x !== pid)
        : [...f.product_ids, pid],
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> Nouvelle promotion</Button>
      </div>

      {promos.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          Aucune promotion créée — commencez par en créer une !
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => {
            const status = promoStatus(p);
            const count = p.product_count?.[0]?.count ?? 0;
            return (
              <div key={p.id} className="rounded-lg border bg-card p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{p.name}</p>
                    <Badge className={`text-[10px] px-1.5 ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</Badge>
                    <span className="text-sm font-bold text-primary">
                      -{p.discount_type === "percent" ? `${p.discount_value}%` : `${Math.round(p.discount_value).toLocaleString("fr-FR")} F`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.applies_to === "all_products" ? "Tous les produits"
                      : p.applies_to === "category" ? `Catégorie`
                      : <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {count} produit{count !== 1 ? "s" : ""}</span>}
                    {" · "}
                    Début {new Date(p.starts_at).toLocaleDateString("fr-FR")}
                    {p.ends_at && ` → ${new Date(p.ends_at).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePromo(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog create/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la promotion" : "Nouvelle promotion"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom de la promotion *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Soldes été 2026" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type de remise</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v as "percent" | "fixed_amount" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Pourcentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Montant fixe (F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valeur *</Label>
                <div className="relative">
                  <Input type="number" min="0" step="0.01" value={form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                    placeholder={form.discount_type === "percent" ? "10" : "500"} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {form.discount_type === "percent" ? "%" : "F"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>S&apos;applique à</Label>
              <Select value={form.applies_to} onValueChange={(v) => setForm((f) => ({ ...f, applies_to: v, product_ids: [] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_products">Tous les produits</SelectItem>
                  <SelectItem value="selected_products">Produits sélectionnés</SelectItem>
                  <SelectItem value="category">Une catégorie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.applies_to === "category" && (
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.applies_to === "selected_products" && (
              <div className="space-y-2">
                <Label>Produits ({form.product_ids.length} sélectionné{form.product_ids.length !== 1 ? "s" : ""})</Label>
                <div className="max-h-40 overflow-y-auto rounded border divide-y">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer">
                      <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={() => toggleProductId(p.id)} className="h-4 w-4" />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin <span className="text-muted-foreground">(optionnel)</span></Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="promo-active" checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label htmlFor="promo-active">Activer immédiatement</Label>
            </div>

            {err && <p className="text-sm text-destructive">{err}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
