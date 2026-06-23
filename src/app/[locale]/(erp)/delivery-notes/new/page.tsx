"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type OrderItem = {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  product: { id: string; name: string; sku: string } | null;
};

type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  items: OrderItem[];
};

type LineItem = {
  product_id: string;
  product_name: string;
  quantity_dispatched: number;
};

function NewDeliveryNoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id") ?? "";

  const perm = useClientPermission("orders", "write");

  const [order, setOrder] = useState<Order | null>(null);
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

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

        if (tid && orderId) {
          const res = await fetch(`/api/v1/orders/${orderId}?team_id=${tid}`);
          if (res.ok) {
            const json = await res.json();
            const ord: Order = json.data;
            setOrder(ord);
            const lineItems: LineItem[] = (ord.items ?? [])
              .filter((item) => item.product_id)
              .map((item) => ({
                product_id: item.product_id!,
                product_name: item.product?.name ?? item.description,
                quantity_dispatched: Number(item.quantity),
              }));
            setItems(lineItems);
          }
        }
      } catch { /* ignore */ }
      setInitialLoading(false);
    }
    load();
  }, [orderId]);

  if (!perm.allowed && !perm.loading) {
    return <ClientForbiddenPage module="orders" action="write" />;
  }

  function updateQty(idx: number, qty: number) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity_dispatched: qty } : it));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) { setError("Ajoutez au moins un article à livrer."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/delivery-notes?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          delivery_address: deliveryAddress.trim() || null,
          recipient_name: recipientName.trim() || null,
          notes: notes.trim() || null,
          items: items.map((it) => ({
            product_id: it.product_id,
            quantity_dispatched: it.quantity_dispatched,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur lors de la création"); return; }
      router.push(`../${json.data.id}`);
      router.refresh();
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href={orderId ? `../orders/${orderId}` : "../delivery-notes"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nouveau bon de livraison</h1>
        {order && (
          <p className="text-sm text-muted-foreground mt-1">
            Commande <span className="font-medium">{order.order_number}</span>
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Informations livraison</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Destinataire</Label>
              <Input id="recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nom du destinataire" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse de livraison</Label>
              <Input id="address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Adresse complète" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instructions particulières…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Articles à expédier</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun article avec produit référencé dans cette commande.</p>
            )}
            {items.map((item, idx) => (
              <div key={item.product_id} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.product_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="sr-only">Quantité</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="w-24"
                    value={item.quantity_dispatched}
                    onChange={(e) => updateQty(idx, parseFloat(e.target.value) || 0)}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
            {items.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                <Plus className="inline h-3 w-3 mr-1" />
                Ajustez les quantités expédiées si différentes de la commande.
              </p>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading || items.length === 0}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création…</> : "Créer le bon de livraison"}
        </Button>
      </form>
    </div>
  );
}

export default function NewDeliveryNotePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <NewDeliveryNoteForm />
    </Suspense>
  );
}
