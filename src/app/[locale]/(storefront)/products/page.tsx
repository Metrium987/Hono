import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ProductsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const categorySlug = typeof sp.category === "string" ? sp.category : "";
  const search = typeof sp.q === "string" ? sp.q : "";

  const [t, pp] = await Promise.all([
    getTranslations("storefront"),
    getTranslations("products_page"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Fetch published products and categories
  const [productsRes, categoriesRes] = await Promise.all([
    supabase
      .from("products")
      .select(`
        id, name, description, price_ht, sku, type,
        category:category_id(id, slug),
        currency:currency_id(symbol, code)
      `)
      .eq("is_active", true)
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_categories")
      .select("id, slug")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const categories = categoriesRes.data ?? [];
  const allProducts = productsRes.data ?? [];

  // Apply filters
  let filtered = allProducts;
  if (categorySlug) {
    const cat = categories.find((c) => c.slug === categorySlug);
    if (cat) {
      filtered = filtered.filter(
        (p: Record<string, unknown>) =>
          (Array.isArray(p.category) ? (p.category[0] as Record<string, unknown>)?.slug : (p.category as Record<string, unknown>)?.slug) === categorySlug
      );
    }
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p: Record<string, unknown>) =>
        (p.name as string)?.toLowerCase().includes(q) ||
        (p.description as string)?.toLowerCase().includes(q) ||
        (p.sku as string)?.toLowerCase().includes(q)
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("catalog")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("product_count", { count: filtered.length })}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Sidebar — categories & search */}
        <aside className="space-y-6 lg:col-span-1">
          {/* Search */}
          <form method="GET" className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              placeholder={pp("search_placeholder")}
              defaultValue={search}
              className="pl-9"
            />
          </form>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t("categories")}</h3>
            <nav className="space-y-1">
              <Link
                href="./products"
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  !categorySlug ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {t("all_products")}
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`./products?category=${cat.slug}`}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    categorySlug === cat.slug ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {cat.slug}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Product grid */}
        <div className="lg:col-span-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">{t("no_products_found")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("no_products_hint")}
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="./products">{t("view_all_products")}</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p: Record<string, unknown>) => {
                const currency = Array.isArray(p.currency)
                  ? (p.currency[0] as { symbol?: string; code?: string }) ?? null
                  : (p.currency as { symbol?: string; code?: string }) ?? null;
                const price = p.price_ht as number;
                return (
                  <Link key={p.id as string} href={`./products/${p.id}`}>
                    <Card className="h-full hover:shadow-lg transition-all hover:-translate-y-0.5">
                      <CardHeader>
                        <CardTitle className="text-base">{p.name as string}</CardTitle>
                        {p.sku ? (
                          <p className="text-xs text-muted-foreground">{t("ref_label")} {p.sku as string}</p>
                        ) : null}
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-primary">
                          {price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                          {currency?.symbol ?? currency?.code ?? "F"}
                        </p>
                        {p.description ? (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {p.description as string}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
