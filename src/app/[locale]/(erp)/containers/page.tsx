"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Box, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type ContainerRow = {
  id: string;
  container_number: string;
  status: "created" | "in_transit" | "received" | "closed";
  arrival_date: string | null;
  cost_fob: number | null;
  created_at: string;
  vendor: { id: string; name: string } | null;
};

type Vendor = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  created: "Créé", in_transit: "En transit", received: "Reçu", closed: "Clôturé",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  created: "secondary", in_transit: "default", received: "success", closed: "secondary",
};

export default function ContainersPage() {
  const { locale } = useParams<{ locale: string }>();
  const perm = useClientPermission("inventory", "read");
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [containerNumber, setContainerNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const [containersRes, vendorsRes] = await Promise.all([
          fetch(`/api/v1/containers?team_id=${perm.teamId}`),
          fetch(`/api/v1/vendors?team_id=${perm.teamId}`),
        ]);
        const cJson = await containersRes.json();
        const vJson = await vendorsRes.json();
        setContainers(cJson.data ?? []);
        setVendors(vJson.data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  async function handleCreate() {
    if (!containerNumber.trim()) { setError("Le numéro de container est obligatoire"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/v1/containers?team_id=${perm.teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          container_number: containerNumber.trim(),
          vendor_id: vendorId || null,
          arrival_date: arrivalDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      setContainers((prev) => [json.data, ...prev]);
      setDialogOpen(false);
      setContainerNumber(""); setVendorId(""); setArrivalDate("");
    } finally {
      setSaving(false);
    }
  }

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="inventory" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Box className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Containers</h1>
            <p className="text-sm text-muted-foreground">{containers.length} container(s)</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setDialogOpen(true); setError(""); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Nouveau container
        </Button>
      </div>

      {containers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Box className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Aucun container</p>
          <p className="text-sm mt-1">Créez un container pour suivre vos achats importés.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">N° Container</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fournisseur</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Arrivée prévue</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {containers.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{c.container_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.vendor?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.arrival_date ? new Date(c.arrival_date).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[c.status] ?? "secondary"} className="text-[10px]">
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${locale}/containers/${c.id}`}>Ouvrir</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouveau container</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>N° Container *</Label>
              <Input value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)}
                placeholder="Ex: MSCU1234567" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date d&apos;arrivée prévue</Label>
              <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
