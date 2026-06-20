"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, GripVertical, AlertCircle } from "lucide-react";
import type { CategoryRow } from "./page";

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type FormState = {
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

const emptyForm: FormState = { name: "", slug: "", sort_order: 0, is_active: true };

export function CategoriesClient({
  teamId,
  initialCategories,
}: {
  teamId: string;
  initialCategories: CategoryRow[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  function openCreate() {
    const nextOrder = categories.length > 0
      ? Math.max(...categories.map((c) => c.sort_order)) + 10
      : 10;
    setForm({ ...emptyForm, sort_order: nextOrder });
    setEditingId(null);
    setError(null);
    setDialog("create");
  }

  function openEdit(cat: CategoryRow) {
    setForm({
      name: cat.name ?? "",
      slug: cat.slug,
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setEditingId(cat.id);
    setError(null);
    setDialog("edit");
  }

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: dialog === "create" ? slugify(name) : f.slug,
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Le nom est obligatoire."); return; }
    if (!form.slug.trim()) { setError("Le slug est obligatoire."); return; }
    setSaving(true);
    setError(null);

    try {
      const isEdit = dialog === "edit" && editingId;
      const url = isEdit
        ? `/api/v1/categories/${editingId}?team_id=${teamId}`
        : `/api/v1/categories?team_id=${teamId}`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug.trim(),
          is_active: form.is_active,
          sort_order: form.sort_order,
          translations: [{ locale: "fr", name: form.name.trim() }],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }

      setDialog(null);
      router.refresh();

      // Optimistic update
      if (isEdit) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? { ...c, name: form.name.trim(), slug: form.slug.trim(), is_active: form.is_active, sort_order: form.sort_order }
              : c
          )
        );
      } else {
        const { data: created } = await res.clone().json().catch(() => ({ data: null }));
        if (created) {
          setCategories((prev) => [
            ...prev,
            {
              id: created.id,
              slug: form.slug.trim(),
              name: form.name.trim(),
              is_active: form.is_active,
              sort_order: form.sort_order,
              product_count: 0,
            },
          ].sort((a, b) => a.sort_order - b.sort_order));
        }
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette catégorie ? Les produits liés n'auront plus de catégorie.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/v1/categories/${id}?team_id=${teamId}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(cat: CategoryRow) {
    const newActive = !cat.is_active;
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_active: newActive } : c))
    );
    await fetch(`/api/v1/categories/${cat.id}?team_id=${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: newActive }),
    });
    router.refresh();
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const updated = [...categories];
    const temp = updated[index].sort_order;
    updated[index].sort_order = updated[index - 1].sort_order;
    updated[index - 1].sort_order = temp;
    const [a, b] = [updated[index], updated[index - 1]];
    updated.sort((x, y) => x.sort_order - y.sort_order);
    setCategories(updated);

    await Promise.all([
      fetch(`/api/v1/categories/${a.id}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
      fetch(`/api/v1/categories/${b.id}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
    ]);
  }

  async function handleMoveDown(index: number) {
    if (index === categories.length - 1) return;
    const updated = [...categories];
    const temp = updated[index].sort_order;
    updated[index].sort_order = updated[index + 1].sort_order;
    updated[index + 1].sort_order = temp;
    const [a, b] = [updated[index], updated[index + 1]];
    updated.sort((x, y) => x.sort_order - y.sort_order);
    setCategories(updated);

    await Promise.all([
      fetch(`/api/v1/categories/${a.id}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
      fetch(`/api/v1/categories/${b.id}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
    ]);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle catégorie
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <p className="text-sm">Aucune catégorie pour le moment.</p>
          <p className="text-xs mt-1">Créez votre première catégorie pour organiser votre catalogue.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Produits</TableHead>
                <TableHead>Ordre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat, idx) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-medium">
                    {cat.name ?? <span className="text-muted-foreground italic">Sans nom</span>}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cat.slug}</code>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{cat.product_count}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === categories.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={cat.is_active}
                      onCheckedChange={() => handleToggleActive(cat)}
                      aria-label="Activer/désactiver"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(cat.id)}
                        disabled={deleting === cat.id}
                      >
                        {deleting === cat.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nom *</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Boissons, Électronique..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug (URL)</Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="boissons"
              />
              <p className="text-xs text-muted-foreground">Utilisé dans l&apos;URL : /produits?cat=<strong>{form.slug || "slug"}</strong></p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-order">Ordre d&apos;affichage</Label>
              <Input
                id="cat-order"
                type="number"
                min="0"
                step="1"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="cat-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="cat-active">Catégorie active (visible sur la vitrine)</Label>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
