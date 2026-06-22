"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeamId } from "@/hooks/use-team-id";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Customer = { id: string; company_name: string | null; contact_name: string };
type Item = { description: string; quantity: string; unit_price_ht: string };

const emptyItem = (): Item => ({ description: "", quantity: "1", unit_price_ht: "" });

export default function NewOrderPage() {
  const router = useRouter();
  const t = useTranslations("order_form");
  const common = useTranslations("common");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  const perm = useClientPermission("orders", "write");
  const teamId = useTeamId();

  useEffect(() => {
    if (!teamId) return;
    fetch(`/api/v1/customers?limit=200&team_id=${teamId}`)
      .then((r) => r.json())
      .then((d) => setCustomers(d.data ?? []));
  }, [teamId]);

  if (!perm.allowed && !perm.loading) {
    return <ClientForbiddenPage module="orders" action="write" />;
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof Item, value: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function totalHt() {
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price_ht) || 0;
      return sum + qty * price;
    }, 0);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError(t("error_customer"));
      return;
    }
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      setError(t("error_items"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!teamId) return;
      const res = await fetch(`/api/v1/orders?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          source: "erp",
          notes: notes.trim() || null,
          items: validItems.map((item) => ({
            description: item.description.trim(),
            quantity: parseFloat(item.quantity) || 1,
            unit_price_ht: item.unit_price_ht ? parseFloat(item.unit_price_ht) : null,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? common("unknown_error"));
        return;
      }
      const data = await res.json();
      router.push(`../orders/${data.data.id}`);
      router.refresh();
    } catch {
      setError(common("connection_error"));
    } finally {
      setLoading(false);
    }
  }

  const total = totalHt();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="../orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> {t("back_to_orders")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("title_new")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("customer_label")}</CardTitle></CardHeader>
          <CardContent>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder={t("customer_placeholder")} /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name ? `${c.company_name} — ${c.contact_name}` : c.contact_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("items_title")}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> {t("add_item")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_120px_36px] gap-2 items-end">
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t("item_description_label")}</Label>}
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    placeholder="Ex: Eau Royale 1.5L"
                  />
                </div>
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t("item_quantity_label")}</Label>}
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t("item_price_label")}</Label>}
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={item.unit_price_ht}
                    onChange={(e) => updateItem(idx, "unit_price_ht", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {total > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <span className="text-sm font-medium">
                  Total HT : {total.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} F
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("notes_label")}</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{common("creating")}</> : t("submit_create")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="../orders">{common("cancel")}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
