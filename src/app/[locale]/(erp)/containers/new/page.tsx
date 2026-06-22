"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Vendor = { id: string; name: string };

export default function NewContainerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [containerRef, setContainerRef] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("in_transit");
  const [notes, setNotes] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const perm = useClientPermission("inventory", "write");

  useEffect(() => {
    async function loadVendors() {
      if (!perm.teamId) return;
      try {
        const res = await fetch(`/api/v1/vendors?team_id=${perm.teamId}&limit=200`);
        const json = await res.json();
        setVendors(json.data ?? []);
      } catch { /* ignore */ }
    }
    loadVendors();
  }, [perm.teamId]);

  if (!perm.allowed && !perm.loading) {
    return <ClientForbiddenPage module="inventory" action="write" />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          container_ref: containerRef.trim() || undefined,
          vendor_id: vendorId || undefined,
          status,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la création");
        return;
      }

      router.push("../containers");
      router.refresh();
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="../containers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> Retour aux containers
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nouveau container</h1>
        <p className="text-sm text-muted-foreground mt-1">Créez un container pour suivre un achat fournisseur.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ref">Référence container</Label>
              <Input id="ref" value={containerRef} onChange={(e) => setContainerRef(e.target.value)} placeholder="ex: MSC-2026-001" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Fournisseur</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_transit">En transit</SelectItem>
                  <SelectItem value="arrived">Arrivé</SelectItem>
                  <SelectItem value="cleared">Dédouané</SelectItem>
                  <SelectItem value="closed">Clôturé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..." rows={3} />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création...</> : "Créer le container"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
