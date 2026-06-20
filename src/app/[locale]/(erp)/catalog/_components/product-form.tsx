"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const schema = z.object({
  name: z.string().min(1, "Nom obligatoire"),
  sku: z.string().optional(),
  type: z.enum(["product", "service"]),
  price_ht: z.number().min(0),
  cost_price: z.number().min(0).optional(),
  supplier_ref: z.string().optional(),
  currency_id: z.string().min(1, "Devise obligatoire"),
  tax_rate_id: z.string().optional(),
  category_id: z.string().optional(),
  unit: z.string().min(1),
  track_stock: z.boolean(),
  current_stock: z.number().min(0),
  description: z.string().optional(),
  short_description: z.string().optional(),
  featured: z.boolean(),
  slug: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  is_published: z.boolean(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export type Currency = { id: string; code: string; symbol: string };
export type TaxRate = { id: string; name: string; rate: number };
export type Category = { id: string; name: string };

export type ProductFormProps = {
  teamId: string;
  productId?: string;
  currencies: Currency[];
  taxRates: TaxRate[];
  categories: Category[];
  backHref: string;
  initialData?: Partial<FormValues>;
};

export function ProductForm({
  teamId, productId, currencies, taxRates, categories, backHref, initialData,
}: ProductFormProps) {
  const router = useRouter();
  const t = useTranslations("product_form");
  const common = useTranslations("common");

  const isEdit = !!productId;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sku: "",
      type: "product",
      price_ht: 0,
      currency_id: currencies[0]?.id ?? "",
      tax_rate_id: "",
      category_id: "",
      unit: "pcs",
      track_stock: false,
      current_stock: 0,
      description: "",
      short_description: "",
      featured: false,
      slug: "",
      meta_title: "",
      meta_description: "",
      is_published: false,
      is_active: true,
      ...initialData,
    },
  });

  const trackStock = watch("track_stock");
  const watchedName = watch("name");
  const watchedPrice = watch("price_ht");
  const watchedCost = watch("cost_price");
  const marginPct = watchedPrice && watchedCost && watchedPrice > 0
    ? Math.round(((watchedPrice - watchedCost) / watchedPrice) * 100)
    : null;

  function handleNameBlur() {
    const currentSlug = watch("slug");
    if (!currentSlug && watchedName) {
      setValue("slug", slugify(watchedName));
    }
  }

  async function onSubmit(values: FormValues) {
    const url = isEdit
      ? `/api/v1/products/${productId}?team_id=${teamId}`
      : `/api/v1/products?team_id=${teamId}`;
    const method = isEdit ? "PATCH" : "POST";

    const body = {
      name: values.name.trim(),
      sku: values.sku?.trim() || undefined,
      type: values.type,
      price_ht: values.price_ht,
      cost_price: values.cost_price ?? null,
      supplier_ref: values.supplier_ref?.trim() || null,
      currency_id: values.currency_id,
      tax_rate_id: values.tax_rate_id || undefined,
      category_id: values.category_id || undefined,
      unit: values.unit.trim() || "pcs",
      track_stock: values.track_stock,
      current_stock: values.track_stock ? values.current_stock : 0,
      description: values.description?.trim() || undefined,
      featured: values.featured,
      slug: values.slug?.trim() || undefined,
      meta_title: values.meta_title?.trim() || undefined,
      meta_description: values.meta_description?.trim() || undefined,
      is_published: values.is_published,
      is_active: values.is_active,
      translations: [{
        locale: "fr",
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        short_description: values.short_description?.trim() || undefined,
      }],
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError("root", { message: data.error ?? common("unknown_error") });
      return;
    }

    const data = await res.json();
    const id = isEdit ? productId : data.data?.id;
    router.push(`../catalog/${id}`);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> {t("back_to_catalog")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{isEdit ? t("title_edit") : t("title_new")}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Informations générales ── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name_label")} *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Ex: Eau Royale 1.5L"
                onBlur={handleNameBlur}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="short_description">Description courte</Label>
              <Input
                id="short_description"
                {...register("short_description")}
                placeholder="Résumé en une ligne pour la vitrine"
              />
              <p className="text-xs text-muted-foreground">Affichée sur les cartes produit dans le catalogue.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">{t("sku_label")}</Label>
                <Input id="sku" {...register("sku")} placeholder="EAU-ROYALE-1L5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">{t("type_label")}</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">{t("type_product")}</SelectItem>
                        <SelectItem value="service">{t("type_service")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category_id">{t("category_label")}</Label>
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t("no_category")}</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("description_label")}</Label>
              <Textarea id="description" {...register("description")} rows={4} placeholder="Description détaillée du produit..." />
            </div>
          </CardContent>
        </Card>

        {/* ── Prix & TVA ── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Prix & TVA</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_ht">{t("price_ht_label")} *</Label>
                <Input id="price_ht" type="number" min="0" step="1" {...register("price_ht", { valueAsNumber: true })} placeholder="0" />
                {errors.price_ht && <p className="text-xs text-destructive">{errors.price_ht.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency_id">{t("currency_label")}</Label>
                <Controller
                  name="currency_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} {c.symbol}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.currency_id && <p className="text-xs text-destructive">{errors.currency_id.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_rate_id">{t("tax_rate_label")}</Label>
              <Controller
                name="tax_rate_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucune TVA</SelectItem>
                      {taxRates.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.rate}%)</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">{t("unit_label")}</Label>
              <Input id="unit" {...register("unit")} placeholder="pcs" className="w-32" />
            </div>

            {/* ── Pricing confidentiel ── */}
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                🔒 Données confidentielles — non visibles sur la vitrine
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Prix de revient (F CFP)</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    min="0"
                    step="1"
                    {...register("cost_price", { valueAsNumber: true })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier_ref">Réf. fournisseur</Label>
                  <Input id="supplier_ref" {...register("supplier_ref")} placeholder="Ex: REF-2024-001" />
                </div>
              </div>
              {marginPct !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Marge :</span>
                  <span className={`text-sm font-bold ${marginPct >= 40 ? "text-green-600" : marginPct >= 20 ? "text-amber-600" : "text-red-600"}`}>
                    {marginPct}%
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${marginPct >= 40 ? "bg-green-100 text-green-700" : marginPct >= 20 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {marginPct >= 40 ? "Bonne marge" : marginPct >= 20 ? "Marge correcte" : marginPct >= 0 ? "Marge faible" : "Vendu à perte !"}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Stock & Publication ── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Stock & Publication</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Controller
                name="featured"
                control={control}
                render={({ field }) => (
                  <Switch id="featured" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <div>
                <Label htmlFor="featured">Produit mis en avant</Label>
                <p className="text-xs text-muted-foreground">Affiché en priorité sur la page d'accueil de la vitrine.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Controller
                name="track_stock"
                control={control}
                render={({ field }) => (
                  <Switch id="track_stock" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="track_stock">{t("track_stock_label")}</Label>
            </div>

            {trackStock && (
              <div className="space-y-2">
                <Label htmlFor="current_stock">{t("current_stock_label")}</Label>
                <Input id="current_stock" type="number" min="0" step="1" {...register("current_stock", { valueAsNumber: true })} className="w-32" />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Controller
                name="is_published"
                control={control}
                render={({ field }) => (
                  <Switch id="is_published" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="is_published">{t("is_published_label")}</Label>
            </div>

            <div className="flex items-center gap-3">
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="is_active">{t("is_active_label")}</Label>
            </div>
          </CardContent>
        </Card>

        {/* ── SEO ── */}
        <Card>
          <CardHeader><CardTitle className="text-base">SEO & Référencement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                {...register("slug")}
                placeholder="eau-royale-1-5l"
              />
              <p className="text-xs text-muted-foreground">Généré automatiquement depuis le nom. Modifiable librement.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_title">Titre SEO</Label>
              <Input
                id="meta_title"
                {...register("meta_title")}
                placeholder="Eau Royale 1.5L – Hono"
                maxLength={70}
              />
              <p className="text-xs text-muted-foreground">Laissez vide pour utiliser le nom du produit.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_description">Description SEO</Label>
              <Textarea
                id="meta_description"
                {...register("meta_description")}
                rows={2}
                placeholder="Description pour les moteurs de recherche (150-160 caractères)."
                maxLength={160}
              />
            </div>
          </CardContent>
        </Card>

        {errors.root && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {errors.root.message}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{common(isEdit ? "save" : "creating")}</>
              : isEdit ? t("submit_save") : t("submit_create")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>{common("cancel")}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
