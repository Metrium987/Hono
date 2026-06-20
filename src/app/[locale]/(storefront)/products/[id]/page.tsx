import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/lib/cart/add-to-cart-button";

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`;

function imageUrl(storagePath: string) {
  return `${STORAGE_BASE}/${storagePath}`;
}

type Props = { params: Promise<{ id: string; locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("name, description, meta_title, meta_description, price_ht, currency:currency_id(symbol, code)")
    .eq("id", id)
    .eq("is_active", true)
    .eq("is_published", true)
    .single();

  if (!product) return {};

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://hono.pf").replace(/\/$/, "");
  const currency = Array.isArray(product.currency) ? product.currency[0] : product.currency;
  const title = product.meta_title ?? `${product.name} — Hono`;
  const description = product.meta_description ?? product.description ?? `${product.name} disponible sur Hono PF`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${base}/fr/products/${id}`,
      siteName: "Hono PF",
    },
    other: {
      "product:price:amount": String(product.price_ht),
      "product:price:currency": currency?.code ?? "XPF",
    },
  };
}

export default async function ProductDetailPage(
  props: { params: Promise<{ id: string; locale: string }> }
) {
  const { id } = await props.params;

  const t = await getTranslations("storefront");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: product, error } = await supabase
    .from("products")
    .select(`
      *,
      category:category_id(slug, name),
      currency:currency_id(symbol, code, symbol_position),
      tax_rate:tax_rate_id(name, rate),
      images:product_images(storage_path, alt_text, position)
    `)
    .eq("id", id)
    .eq("is_active", true)
    .eq("is_published", true)
    .order("position", { foreignTable: "product_images", ascending: true })
    .single();

  if (error || !product) {
    notFound();
  }

  const currency = Array.isArray(product.currency)
    ? product.currency[0] ?? { symbol: "F", code: "XPF" }
    : product.currency ?? { symbol: "F", code: "XPF" };
  const taxRate = Array.isArray(product.tax_rate)
    ? product.tax_rate[0]
    : product.tax_rate;
  const priceHt = parseFloat(product.price_ht) || 0;
  const priceTtc = taxRate?.rate ? priceHt * (1 + taxRate.rate / 100) : priceHt;

  const catRaw = Array.isArray(product.category) ? product.category[0] : product.category;
  const catLabel = catRaw?.name ?? catRaw?.slug ?? null;

  const images: { storage_path: string; alt_text?: string; position?: number }[] =
    Array.isArray(product.images) ? product.images : [];

  // Active promotions for this product
  let discountedPriceHt: number | null = null;
  let activePromoLabel: string | null = null;
  const DEFAULT_TEAM_ID = process.env.NEXT_PUBLIC_DEFAULT_TEAM_ID;
  if (DEFAULT_TEAM_ID) {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: promoData } = await admin
      .from("promotions")
      .select("id, discount_type, discount_value, applies_to, category_id")
      .eq("team_id", DEFAULT_TEAM_ID)
      .eq("is_active", true)
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gte.${now}`);

    if (promoData && promoData.length > 0) {
      const selectedPromoIds = promoData.filter((p) => p.applies_to === "selected_products").map((p) => p.id);
      let promoIdsForProduct: Set<string> = new Set();
      if (selectedPromoIds.length > 0) {
        const { data: ppData } = await admin.from("promotion_products").select("promotion_id").eq("product_id", id).in("promotion_id", selectedPromoIds);
        promoIdsForProduct = new Set((ppData ?? []).map((r) => r.promotion_id));
      }
      const applicable = promoData.filter((promo) => {
        if (promo.applies_to === "all_products") return true;
        if (promo.applies_to === "category") return promo.category_id === product.category_id;
        if (promo.applies_to === "selected_products") return promoIdsForProduct.has(promo.id);
        return false;
      });
      if (applicable.length > 0) {
        const best = applicable.reduce((a, b) => b.discount_value > a.discount_value ? b : a);
        discountedPriceHt = best.discount_type === "percent"
          ? Math.max(0, priceHt * (1 - best.discount_value / 100))
          : Math.max(0, priceHt - best.discount_value);
        activePromoLabel = best.discount_type === "percent"
          ? `-${best.discount_value}%`
          : `-${Math.round(best.discount_value).toLocaleString("fr-FR")} F`;
      }
    }
  }
  const discountedPriceTtc = discountedPriceHt !== null && taxRate?.rate
    ? discountedPriceHt * (1 + taxRate.rate / 100)
    : discountedPriceHt;

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://hono.pf").replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    sku: product.sku ?? undefined,
    image: images.length > 0 ? imageUrl(images[0].storage_path) : undefined,
    offers: {
      "@type": "Offer",
      price: priceTtc.toFixed(2),
      priceCurrency: currency?.code ?? "XPF",
      availability:
        product.track_stock && product.current_stock <= 0
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      url: `${base}/fr/products/${id}`,
    },
  };

  const inStock = !product.track_stock || product.current_stock > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link
        href="./.."
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back_catalog")}
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Image gallery */}
        <div>
          {images.length > 0 ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(images[0].storage_path)}
                alt={images[0].alt_text ?? product.name}
                className="w-full h-80 object-cover"
              />
            </div>
          ) : (
            <div className="rounded-xl border bg-muted h-80 flex items-center justify-center">
              <p className="text-muted-foreground">{t("no_image")}</p>
            </div>
          )}
          {images.length > 1 && (
            <div className="flex gap-2 mt-4">
              {images.slice(1).map((img) => (
                <div key={img.position ?? 0} className="w-20 h-20 rounded-lg border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(img.storage_path)}
                    alt={img.alt_text ?? ""}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="space-y-6">
          <div>
            {catLabel && (
              <Badge variant="secondary" className="mb-2">{catLabel}</Badge>
            )}
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.sku && (
              <p className="text-sm text-muted-foreground mt-1">{t("ref_label")} {product.sku}</p>
            )}
            {/* Stock badge */}
            <div className="mt-2">
              {inStock ? (
                <Badge className="bg-green-500/15 text-green-700 border-green-200 hover:bg-green-500/20">
                  En stock
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-500/15 text-red-700 border-red-200 hover:bg-red-500/20">
                  Rupture de stock
                </Badge>
              )}
            </div>
          </div>

          {/* Pricing */}
          <Card className={activePromoLabel ? "border-red-200" : ""}>
            <CardContent className="p-6 space-y-3">
              {activePromoLabel && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-500 text-white">{activePromoLabel}</Badge>
                  <span className="text-xs text-muted-foreground">Promotion en cours</span>
                </div>
              )}
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">{t("price_ht")}</span>
                {discountedPriceHt !== null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-red-600">
                      {discountedPriceHt.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency.symbol ?? currency.code}
                    </span>
                    <span className="text-sm text-muted-foreground line-through">
                      {priceHt.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency.symbol ?? currency.code}
                    </span>
                  </div>
                ) : (
                  <span className="text-lg font-semibold">
                    {priceHt.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency.symbol ?? currency.code}
                  </span>
                )}
              </div>
              {taxRate && (
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-muted-foreground">
                    {t("tax_rate", { rate: taxRate.rate, name: taxRate.name ?? "" })}
                  </span>
                  <span className="text-muted-foreground">
                    + {((discountedPriceTtc ?? priceTtc) - (discountedPriceHt ?? priceHt)).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency.symbol ?? currency.code}
                  </span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between items-baseline">
                <span className="font-semibold">{t("price_ttc")}</span>
                <span className={`text-2xl font-bold ${discountedPriceTtc !== null ? "text-red-600" : "text-primary"}`}>
                  {(discountedPriceTtc ?? priceTtc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency.symbol ?? currency.code}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {product.description && (
            <div>
              <h2 className="text-lg font-semibold mb-2">{t("description")}</h2>
              <p className="text-muted-foreground whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <AddToCartButton
              productId={id}
              name={product.name}
              priceHt={priceHt}
              sku={product.sku ?? undefined}
              imageUrl={images.length > 0 ? imageUrl(images[0].storage_path) : undefined}
              disabled={!inStock}
            />
            <Button variant="outline" asChild>
              <Link href="./..">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("back")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
