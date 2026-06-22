"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Warehouse, Plus, Pencil, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type WarehouseRow = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  showroom: "Showroom",
  warehouse: "Entrepôt",
  external: "Externe",
  transit: "Transit",
  reserved: "Réservé",
  defective: "Défectueux",
};

type Props = { teamId: string; initialWarehouses: WarehouseRow[] };

export function WarehousesClient({ teamId, initialWarehouses }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>(initialWarehouses);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<WarehouseRow | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("warehouse");
  const [location, setLocation] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditWarehouse(null);
    setName(""); setType("warehouse"); setLocation(""); setIsActive(true); setError(null);
    setDialogOpen(true);
  }

  function openEdit(w: WarehouseRow) {
    setEditWarehouse(w);
    setName(w.name); setType(w.type); setLocation(w.location ?? ""); setIsActive(w.is_active); setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Le nom est obligatoire"); return; }
    setSaving(true); setError(null);
    try {
      if (editWarehouse) {
        const res = await fetch(`/api/v1/warehouses/${editWarehouse.id}?team_id=${teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), type, location: location.trim() || null, is_active: isActive }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erreur"); return; }
        setWarehouses((prev) => prev.map((w) => w.id === editWarehouse.id ? json.data : w));
      } else {
        const res = await fetch(`/api/v1/warehouses?team_id=${teamId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), type, location: location.trim() || null, is_active: isActive }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erreur"); return; }
        setWarehouses((prev) => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Warehouse className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Entrepôts</h1>
            <p className="text-sm text-muted-foreground">{warehouses.length} entrepôt(s)</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nouvel entrepôt
        </Button>
      </div>

      {warehouses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Warehouse className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucun entrepôt</p>
          <p className="text-sm mt-1">Créez vos entrepôts pour gérer le stock par emplacement.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nom</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Lieu</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {warehouses.map((w) => (
                <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[w.type] ?? w.type}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{w.location ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={w.is_active ? "success" : "secondary"} className="text-[10px]">
                      {w.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link href={`/${locale}/warehouses/${w.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(w)}>
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
            <DialogTitle>{editWarehouse ? "Modifier l'entrepôt" : "Nouvel entrepôt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Entrepôt Central Papeete" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Localisation</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Adresse ou description" />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="wh-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="wh-active">Actif</Label>
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
