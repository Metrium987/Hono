"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeamId } from "@/hooks/use-team-id";

type Currency = { id: string; code: string; symbol: string };
type TaxRate = { id: string; name: string; rate: number };
type Category = { id: string; name: string };

export default function NewProductPage() {
  const router = useRouter();
  const t = useTranslations("product_form");
  const common = useTranslations("common");

  const teamId = useTeamId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [type, setType] = useState("product");
  const [priceHt, setPriceHt] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [taxRateId, setTaxRateId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [trackStock, setTrackStock] = useState(false);
  const [currentStock, setCurrentStock] = useState("0");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    async function load() {
      const [curRes, taxRes, catRes] = await Promise.all([
        fetch(`/api/v1/currencies?team_id=${teamId}`),
        fetch(`/api/v1/settings/tax-rates?team_id=${teamId}`),
        fetch(`/api/v1/categories?team_id=${teamId}`),
      ]);
      const [curData, taxData, catData] = await Promise.all([
        curRes.json(), taxRes.json(), catRes.json(),
      ]);
      setCurrencies(curData.data ?? []);
      setTaxRates(taxData.data ?? []);
      setCategories(catData.data ?? []);
      if (curData.data?.[0]) setCurrencyId(curData.data[0].id);
    }
    load();
  }, [teamId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !priceHt || !currencyId) {
      setError(t("error_required"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!teamId) return;
      const res = await fetch(`/api/v1/products?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim() || undefined,
          type,
          price_ht: parseFloat(priceHt),
          currency_id: currencyId,
          tax_rate_id: taxRateId || undefined,
          category_id: categoryId || undefined,
          unit: unit.trim() || "pcs",
          track_stock: trackStock,
          current_stock: trackStock ? parseFloat(currentStock) || 0 : 0,
          description: description.trim() || undefined,
          is_published: isPublished,
          is_active: isActive,
          translations: [{ locale: "fr", name: name.trim(), description: description.trim() || undefined }],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? common("unknown_error"));
        return;
      }
      const data = await res.json();
      router.push(`../catalog/${data.data.id}`);
      router.refresh();
    } catch {
      setError(common("connection_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="../catalog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> {t("back_to_catalog")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("title_new")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name_label")} *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Eau Royale 1.5L" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">{t("sku_label")}</Label>
                <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="EAU-ROYALE-1L5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">{t("type_label")}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">{t("type_product")}</SelectItem>
                    <SelectItem value="service">{t("type_service")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t("category_label")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("no_category")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("description_label")}</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Prix & TVA</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_ht">{t("price_ht_label")} *</Label>
                <Input id="price_ht" type="number" min="0" step="1" value={priceHt} onChange={(e) => setPriceHt(e.target.value)} placeholder="0" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t("currency_label")}</Label>
                <Select value={currencyId} onValueChange={setCurrencyId}>
                  <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} ({c.symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_rate">{t("tax_rate_label")}</Label>
                <Select value={taxRateId} onValueChange={setTaxRateId}>
                  <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t("no_tax")}</SelectItem>
                    {taxRates.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name} ({r.rate}%)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">{t("unit_label")}</Label>
                <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Stock</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch id="track_stock" checked={trackStock} onCheckedChange={setTrackStock} />
              <Label htmlFor="track_stock">{t("track_stock_label")}</Label>
            </div>
            {trackStock && (
              <div className="space-y-2">
                <Label htmlFor="current_stock">{t("current_stock_label")}</Label>
                <Input id="current_stock" type="number" min="0" step="1" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Visibilité</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="is_active">{t("is_active_label")}</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="is_published" checked={isPublished} onCheckedChange={setIsPublished} />
              <Label htmlFor="is_published">{t("is_published_label")}</Label>
            </div>
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
            <Link href="../catalog">{common("cancel")}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
