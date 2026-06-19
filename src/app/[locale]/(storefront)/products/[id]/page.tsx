import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/lib/cart/add-to-cart-button";

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
      category:category_id(slug),
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
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
          {product.images && Array.isArray(product.images) && product.images.length > 0 ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              <img
                src={product.images[0].storage_path}
                alt={product.images[0].alt_text ?? product.name}
                className="w-full h-80 object-cover"
              />
            </div>
          ) : (
            <div className="rounded-xl border bg-muted h-80 flex items-center justify-center">
              <p className="text-muted-foreground">{t("no_image")}</p>
            </div>
          )}
          {product.images && Array.isArray(product.images) && product.images.length > 1 && (
            <div className="flex gap-2 mt-4">
              {product.images.map((img: { storage_path: string; alt_text?: string; position?: number }) => (
                <div key={img.position ?? 0} className="w-20 h-20 rounded-lg border overflow-hidden">
                  <img
                    src={img.storage_path}
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
            {product.category && (
              <Badge variant="secondary" className="mb-2">
                {(Array.isArray(product.category) ? product.category[0]?.slug : product.category?.slug) ?? ""}
              </Badge>
            )}
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.sku && (
              <p className="text-sm text-muted-foreground mt-1">{t("ref_label")} {product.sku}</p>
            )}
          </div>

          {/* Pricing */}
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">{t("price_ht")}</span>
                <span className="text-lg font-semibold">
                  {priceHt.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency.symbol ?? currency.code}
                </span>
              </div>
              {taxRate && (
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-muted-foreground">
                    {t("tax_rate", { rate: taxRate.rate, name: taxRate.name ?? "" })}
                  </span>
                  <span className="text-muted-foreground">
                    + {(priceTtc - priceHt).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency.symbol ?? currency.code}
                  </span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between items-baseline">
                <span className="font-semibold">{t("price_ttc")}</span>
                <span className="text-2xl font-bold text-primary">
                  {priceTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency.symbol ?? currency.code}
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
              imageUrl={
                Array.isArray(product.images) && product.images.length > 0
                  ? product.images[0].storage_path
                  : undefined
              }
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
