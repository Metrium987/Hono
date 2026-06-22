"use client";

import { useState } from "react";
import { Layers, Plus, Pencil, Trash2, Loader2, AlertCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
};

type Props = {
  teamId: string;
  initialBrands: Brand[];
};

export function BrandsClient({ teamId, initialBrands }: Props) {
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditBrand(null);
    setName("");
    setLogoUrl("");
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditBrand(brand);
    setName(brand.name);
    setLogoUrl(brand.logo_url ?? "");
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Le nom est obligatoire"); return; }
    setSaving(true);
    setError(null);

    try {
      if (editBrand) {
        const res = await fetch(`/api/v1/brands/${editBrand.id}?team_id=${teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), logo_url: logoUrl.trim() || null }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erreur"); return; }
        setBrands((prev) => prev.map((b) => b.id === editBrand.id ? json.data : b));
      } else {
        const res = await fetch(`/api/v1/brands?team_id=${teamId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), logo_url: logoUrl.trim() || null }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erreur"); return; }
        setBrands((prev) => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/brands/${deleteTarget.id}?team_id=${teamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBrands((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Marques</h1>
            <p className="text-sm text-muted-foreground">{brands.length} marque(s)</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nouvelle marque
        </Button>
      </div>

      {brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Layers className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucune marque</p>
          <p className="text-sm mt-1">Créez votre première marque pour l&apos;associer à vos produits.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nom</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Slug</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Logo</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {brands.map((brand) => (
                <tr key={brand.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{brand.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{brand.slug}</td>
                  <td className="px-4 py-3">
                    {brand.logo_url ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(brand)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(brand)}>
                        <Trash2 className="h-3.5 w-3.5" />
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
            <DialogTitle>{editBrand ? "Modifier la marque" : "Nouvelle marque"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Nom *</Label>
              <Input
                id="brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Coca-Cola"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-logo">URL du logo</Label>
              <Input
                id="brand-logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">Optionnel — URL publique du logo de la marque.</p>
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la marque ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            La marque <strong>{deleteTarget?.name}</strong> sera dissociée de tous les produits liés.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
