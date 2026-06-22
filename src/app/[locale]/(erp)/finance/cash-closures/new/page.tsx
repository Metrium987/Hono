"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

export default function NewCashClosurePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [closureDate, setClosureDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalSales, setTotalSales] = useState("");
  const [totalCash, setTotalCash] = useState("");
  const [totalDigital, setTotalDigital] = useState("");
  const [notes, setNotes] = useState("");

  const perm = useClientPermission("finance", "write");

  if (!perm.allowed && !perm.loading) {
    return <ClientForbiddenPage module="finance" action="write" />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!closureDate) {
      setError("La date de clôture est requise");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/cash-closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closure_date: closureDate,
          total_sales: parseFloat(totalSales) || 0,
          total_cash: parseFloat(totalCash) || 0,
          total_digital: parseFloat(totalDigital) || 0,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la création");
        return;
      }

      router.push("../cash-closures");
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
        <Link href="../cash-closures" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> Retour aux clôtures
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nouvelle clôture de caisse</h1>
        <p className="text-sm text-muted-foreground mt-1">Saisissez les totaux du jour pour générer la clôture.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="closureDate">Date de clôture</Label>
              <Input id="closureDate" type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalSales">Total des ventes (HT)</Label>
              <Input id="totalSales" type="number" step="0.01" min="0" value={totalSales} onChange={(e) => setTotalSales(e.target.value)} placeholder="0" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalCash">Espèces</Label>
                <Input id="totalCash" type="number" step="0.01" min="0" value={totalCash} onChange={(e) => setTotalCash(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalDigital">Digital (CB/virement)</Label>
                <Input id="totalDigital" type="number" step="0.01" min="0" value={totalDigital} onChange={(e) => setTotalDigital(e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes éventuelles..." rows={3} />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création...</> : "Créer la clôture"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
