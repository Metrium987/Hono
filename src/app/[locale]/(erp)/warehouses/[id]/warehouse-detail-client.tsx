"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Warehouse, Plus, Loader2, AlertCircle, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WarehouseRow = {
  id: string; name: string; type: string; location: string | null; is_active: boolean;
};
type Location = {
  id: string; code: string; description: string | null; is_active: boolean;
};
type CountRow = {
  id: string; status: string; created_at: string; completed_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", in_progress: "En cours", completed: "Terminé", approved: "Approuvé",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  draft: "secondary", in_progress: "default", completed: "success", approved: "success",
};

type Props = {
  teamId: string;
  warehouse: WarehouseRow;
  initialLocations: Location[];
  recentCounts: CountRow[];
};

export function WarehouseDetailClient({ teamId, warehouse, initialLocations, recentCounts }: Props) {
  const { locale } = useParams<{ locale: string }>();
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingCount, setCreatingCount] = useState(false);

  async function handleAddLocation() {
    if (!code.trim()) { setError("Le code est obligatoire"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/warehouses/${warehouse.id}/locations?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), description: description.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      setLocations((prev) => [...prev, json.data].sort((a, b) => a.code.localeCompare(b.code)));
      setDialogOpen(false); setCode(""); setDescription("");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCount() {
    setCreatingCount(true);
    try {
      const res = await fetch(`/api/v1/inventory/counts?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: warehouse.id }),
      });
      const json = await res.json();
      if (res.ok) {
        window.location.href = `/${locale}/inventory-counts/${json.data.id}`;
      }
    } finally {
      setCreatingCount(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/warehouses`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Warehouse className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{warehouse.name}</h1>
          <p className="text-sm text-muted-foreground">{warehouse.type}{warehouse.location ? ` — ${warehouse.location}` : ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Emplacements */}
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Emplacements</CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setDialogOpen(true); setError(null); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter
            </Button>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun emplacement</p>
            ) : (
              <div className="space-y-1">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div>
                      <span className="font-mono text-sm font-medium">{loc.code}</span>
                      {loc.description && <span className="text-xs text-muted-foreground ml-2">{loc.description}</span>}
                    </div>
                    <Badge variant={loc.is_active ? "success" : "secondary"} className="text-[10px]">
                      {loc.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventaires récents */}
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Inventaires récents</CardTitle>
            <Button size="sm" variant="outline" onClick={handleCreateCount} disabled={creatingCount}>
              {creatingCount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><ClipboardList className="mr-1.5 h-3.5 w-3.5" />Nouveau</>}
            </Button>
          </CardHeader>
          <CardContent>
            {recentCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun inventaire</p>
            ) : (
              <div className="space-y-1">
                {recentCounts.map((c) => (
                  <Link key={c.id} href={`/${locale}/inventory-counts/${c.id}`}
                    className="flex items-center justify-between py-1.5 border-b last:border-0 hover:text-primary transition-colors">
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("fr-FR")}
                    </span>
                    <Badge variant={STATUS_VARIANTS[c.status] ?? "secondary"} className="text-[10px]">
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ajouter un emplacement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: A1-01" autoFocus />
              <p className="text-xs text-muted-foreground">Code unique de l&apos;emplacement (allée-rayon-niveau).</p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Allée A, Rayon 1, Niveau 1" />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleAddLocation} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ajout...</> : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
