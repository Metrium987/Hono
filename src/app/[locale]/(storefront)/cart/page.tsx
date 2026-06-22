"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingCart, ArrowLeft, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart/cart-context";

export default function CartPage() {
  const t = useTranslations("storefront");
  const { items, removeItem, updateQuantity, clearCart, totalItems, subtotalTtc } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 text-center">
        <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground/50 mb-6" />
        <h1 className="text-3xl font-bold tracking-tight mb-3">{t("cart_title")}</h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          {t("cart_empty")}
        </p>
        <Button asChild size="lg">
          <Link href="../products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("see_catalog")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("cart_title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("items_count", { count: totalItems })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground">
          <Trash2 className="mr-2 h-4 w-4" />
          {t("clear_cart")}
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const m = 1 + (item.taxRate ?? 0) / 100;
            const priceTtc = item.priceHt * m;
            const lineTtc = priceTtc * item.quantity;
            return (
            <Card key={item.productId} className="overflow-hidden">
              <CardContent className="p-4 flex gap-4 items-center">
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingCart className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`../products/${item.productId}`}
                    className="font-medium hover:text-primary transition-colors line-clamp-1"
                  >
                    {item.name}
                  </Link>
                  {item.sku && (
                    <p className="text-xs text-muted-foreground">{t("ref_label")} {item.sku}</p>
                  )}
                  <p className="text-sm font-semibold text-primary mt-1">
                    {priceTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F TTC / unité
                  </p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Line total */}
                <div className="text-right min-w-[100px]">
                  <p className="font-semibold">
                    {lineTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F
                  </p>
                  <p className="text-xs text-muted-foreground">TTC</p>
                </div>

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.productId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            );
          })}
        </div>

        {/* Summary sidebar */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">{t("cart_summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{t("total_ttc_estimated")}</span>
                <span className="text-primary">
                  {subtotalTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("ttc_note_long")}
              </p>

              <div className="space-y-3 pt-2">
                <Button className="w-full" asChild>
                  <Link href="./cart/checkout">
                    <FileSignature className="mr-2 h-4 w-4" />
                    {t("request_quote")}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="../products">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("continue_shopping")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
