import { createAdminClient } from "@/utils/supabase/admin";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CartProvider } from "@/lib/cart/cart-context";
import { StorefrontHeader } from "./(storefront)/storefront-header";
import { StorefrontFooter } from "./(storefront)/storefront-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowRight } from "lucide-react";

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`;
const DEFAULT_TEAM_ID = process.env.NEXT_PUBLIC_DEFAULT_TEAM_ID ?? "";

type ProductItem = {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  price_ht: number;
  track_stock: boolean;
  current_stock: number;
  currency: { symbol?: string | null; code?: string | null } | Array<{ symbol?: string | null; code?: string | null }> | null;
  images: { storage_path: string; position: number }[] | null;
};

export default async function HomePage() {
  const t = await getTranslations("storefront");

  const admin = createAdminClient();

  // Featured products
  const [featuredRes, recentRes, categoryRes] = await Promise.all([
    admin
      .from("products")
      .select("id, name, description, short_description, price_ht, track_stock, current_stock, currency:currency_id(symbol, code), images:product_images(storage_path, position)")
      .eq("team_id", DEFAULT_TEAM_ID)
      .eq("is_active", true)
      .eq("is_published", true)
      .eq("featured", true)
      .order("created_at", { ascending: false })
      .limit(6),
    admin
      .from("products")
      .select("id, name, description, short_description, price_ht, track_stock, current_stock, currency:currency_id(symbol, code), images:product_images(storage_path, position)")
      .eq("team_id", DEFAULT_TEAM_ID)
      .eq("is_active", true)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("product_categories")
      .select("id, slug, name")
      .eq("team_id", DEFAULT_TEAM_ID)
      .eq("is_active", true)
      .order("sort_order")
      .limit(8),
  ]);

  const featured = (featuredRes.data ?? []) as ProductItem[];
  const recent = (recentRes.data ?? []) as ProductItem[];
  const categories = categoryRes.data ?? [];

  // Show featured if available, otherwise show recent
  const heroProducts = featured.length > 0 ? featured : recent;

  function getImageUrl(product: ProductItem): string | null {
    const imgs = Array.isArray(product.images) ? product.images : [];
    if (imgs.length === 0) return null;
    const sorted = [...imgs].sort((a, b) => a.position - b.position);
    return `${STORAGE_BASE}/${sorted[0].storage_path}`;
  }

  function getCurrency(product: ProductItem) {
    return Array.isArray(product.currency) ? product.currency[0] : product.currency;
  }

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <StorefrontHeader />

        <main className="flex-1">
          {/* ── Hero ── */}
          <section className="relative overflow-hidden border-b">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.52_0.13_158/0.1),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,oklch(0.52_0.13_158/0.06),transparent_50%)]" />
            <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <p className="inline-flex items-center rounded-[0.375rem] bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary mb-5">
                  Polynésie Française
                </p>
                <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight leading-[1.15] mb-5 text-balance">
                  Le catalogue en ligne de votre fournisseur local
                </h1>
                <p className="text-base text-muted-foreground mb-8 max-w-lg text-balance">
                  Commandez vos produits en ligne, suivez vos devis et factures depuis votre espace client personnel.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href="./products">
                      Voir le catalogue <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="./login">Espace client</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Categories bar ── */}
          {categories.length > 0 && (
            <section className="border-b">
              <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                  <Link
                    href="./products"
                    className="shrink-0 rounded-[0.5rem] border px-3.5 py-1.5 text-sm font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors duration-150"
                  >
                    Tous les produits
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`./products?category=${cat.slug}`}
                      className="shrink-0 rounded-[0.5rem] border px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors duration-150"
                    >
                      {cat.name ?? cat.slug}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Featured / Recent products ── */}
          {heroProducts.length > 0 && (
            <section className="py-16">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h2 className="text-[1.375rem] font-bold tracking-tight">
                      {featured.length > 0 ? "Produits mis en avant" : "Nouveautés"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {featured.length > 0 ? "Sélection de notre catalogue" : "Nos derniers ajouts"}
                    </p>
                  </div>
                  <Button variant="ghost" asChild className="hidden sm:flex">
                    <Link href="./products">
                      Tout voir <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {heroProducts.map((p) => {
                    const imgSrc = getImageUrl(p);
                    const currency = getCurrency(p);
                    const inStock = !p.track_stock || p.current_stock > 0;
                    return (
                      <Link key={p.id} href={`./products/${p.id}`}>
                        <div className="group rounded-[0.625rem] border bg-card transition-all duration-200 hover:border-primary/30 hover:bg-card/80 overflow-hidden">
                          <div className="relative">
                            {imgSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgSrc}
                                alt={p.name}
                                className="w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="absolute top-2 right-2">
                              {inStock ? (
                                <Badge variant="success">En stock</Badge>
                              ) : (
                                <Badge variant="destructive">Rupture</Badge>
                              )}
                            </div>
                          </div>
                          <div className="p-3.5 space-y-1.5">
                            <h3 className="text-sm font-medium leading-snug line-clamp-2">{p.name}</h3>
                            <p className="text-base font-bold text-primary">
                              {p.price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} {currency?.symbol ?? currency?.code ?? "F"}
                            </p>
                            {(p.short_description || p.description) && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {p.short_description ?? p.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-10 text-center sm:hidden">
                  <Button variant="outline" asChild>
                    <Link href="./products">Voir tous les produits <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* ── CTA band ── */}
          <section className="border-y py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-[1.375rem] font-bold mb-3">Vous êtes déjà client ?</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto text-balance">
                Accédez à vos devis, factures et commandes depuis votre espace personnel sécurisé.
              </p>
              <div className="flex justify-center gap-3">
                <Button asChild>
                  <Link href="./login">Se connecter</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="./contact">Nous contacter</Link>
                </Button>
              </div>
            </div>
          </section>
        </main>

        <StorefrontFooter />
      </div>
    </CartProvider>
  );
}
