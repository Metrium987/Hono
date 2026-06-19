"use client";

import { useState, useEffect, FormEvent } from "react";
import { Plus, Loader2, Trash2, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type PaymentMethod = {
  id: string;
  name: string;
  display_name: string | null;
  is_active: boolean;
  sort_order: number;
};

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState("");

  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // Get team ID from session
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
          const res = await fetch(`/api/v1/settings/payment-methods?team_id=${tid}`);
          const data = await res.json();
          setMethods(data.data ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/settings/payment-methods?team_id=${teamId}`, {
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
        setError(d.error ?? "Erreur");
        return;
      }

      const d = await res.json();
      setMethods([...methods, d.data]);
      setNewName("");
      setNewDisplayName("");
      setDialogOpen(false);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(method: PaymentMethod) {
    try {
      const res = await fetch(`/api/v1/settings/payment-methods?team_id=${teamId}`, {
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
      const res = await fetch(`/api/v1/settings/payment-methods?id=${id}&team_id=${teamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMethods(methods.filter((m) => m.id !== id));
      }
    } catch { /* ignore */ }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moyens de paiement</h1>
          <p className="text-sm text-muted-foreground">
            {methods.length} méthode{methods.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau moyen de paiement</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Identifiant *</Label>
                <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="cash, check, card..." required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display">Nom affiché</Label>
                <Input id="display" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Espèces, Chèque, Carte..." />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création...</> : "Créer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {methods.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">Aucune méthode de paiement</CardContent></Card>
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
                  {method.is_active ? <Badge variant="success" className="text-[10px]">Actif</Badge> : <Badge variant="secondary" className="text-[10px]">Inactif</Badge>}
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
