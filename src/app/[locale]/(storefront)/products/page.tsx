import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type ProductImage = { storage_path: string; position: number };

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  price_ht: number;
  sku: string | null;
  track_stock: boolean;
  current_stock: number;
  category: { id?: string; slug: string; name: string | null } | Array<{ id?: string; slug: string; name: string | null }> | null;
  currency: { symbol?: string | null; code?: string | null } | Array<{ symbol?: string | null; code?: string | null }> | null;
  tax_rate: { rate: number } | Array<{ rate: number }> | null;
  images: ProductImage[] | null;
};

type CategoryItem = { id: string; slug: string; name: string | null };

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

  // Résoudre le category_id depuis le slug (server-side filtering)
  let categoryId: string | null = null;
  if (categorySlug) {
    const { data: cat } = await supabase
      .from("product_categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();
    categoryId = cat?.id ?? null;
  }

  let productQuery = supabase
    .from("products")
    .select(`
      id, name, description, short_description, price_ht, sku, type,
      track_stock, current_stock,
      category:category_id(id, slug, name),
      currency:currency_id(symbol, code),
      tax_rate:tax_rate_id(rate),
      images:product_images(storage_path, position)
    `)
    .eq("is_active", true)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (categoryId) productQuery = productQuery.eq("category_id", categoryId);
  if (search) productQuery = productQuery.or(`name.ilike.%${search.replace(/[,()'";%_]/g, "")}%,sku.ilike.%${search.replace(/[,()'";%_]/g, "")}%`);

  const [productsRes, categoriesRes] = await Promise.all([
    productQuery,
    supabase
      .from("product_categories")
      .select("id, slug, name")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const categories = (categoriesRes.data ?? []) as CategoryItem[];
  const allProducts = (productsRes.data ?? []) as ProductRow[];

  // Fetch active promotions for storefront (admin client — no user session)
  const DEFAULT_TEAM_ID = process.env.NEXT_PUBLIC_DEFAULT_TEAM_ID;
  type ActivePromo = { id: string; discount_type: string; discount_value: number; applies_to: string; category_id: string | null };
  let activePromos: ActivePromo[] = [];
  let promoProductIds: Record<string, string[]> = {};
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
    activePromos = (promoData ?? []) as ActivePromo[];
    const selectedIds = activePromos.filter((p) => p.applies_to === "selected_products").map((p) => p.id);
    if (selectedIds.length > 0) {
      const { data: ppData } = await admin.from("promotion_products").select("promotion_id, product_id").in("promotion_id", selectedIds);
      for (const row of ppData ?? []) {
        if (!promoProductIds[row.promotion_id]) promoProductIds[row.promotion_id] = [];
        promoProductIds[row.promotion_id].push(row.product_id);
      }
    }
  }

  function getBestPromo(productId: string, categoryId: string | null): ActivePromo | null {
    const applicable = activePromos.filter((promo) => {
      if (promo.applies_to === "all_products") return true;
      if (promo.applies_to === "category") return promo.category_id === categoryId;
      if (promo.applies_to === "selected_products") return (promoProductIds[promo.id] ?? []).includes(productId);
      return false;
    });
    if (!applicable.length) return null;
    // Pick the promo with the highest discount_value (best deal for the customer)
    return applicable.reduce((best, cur) => cur.discount_value > best.discount_value ? cur : best);
  }

  function computePromoPrice(priceHt: number, promo: ActivePromo): number {
    if (promo.discount_type === "percent") return Math.max(0, priceHt * (1 - promo.discount_value / 100));
    return Math.max(0, priceHt - promo.discount_value);
  }

  function promoLabel(promo: ActivePromo): string {
    return promo.discount_type === "percent"
      ? `-${promo.discount_value}%`
      : `-${Math.round(promo.discount_value).toLocaleString("fr-FR")} F`;
  }

  function toTTC(priceHt: number, taxRate: ProductRow["tax_rate"]): number {
    const rate = Array.isArray(taxRate) ? (taxRate[0]?.rate ?? 0) : (taxRate?.rate ?? 0);
    return priceHt * (1 + rate / 100);
  }

  const getSlug = (p: ProductRow): string | undefined => {
    const cat = p.category;
    if (Array.isArray(cat)) return cat[0]?.slug;
    return cat?.slug;
  };

  const filtered = allProducts;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-wrap-balance">{t("catalog")}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t("product_count", { count: filtered.length })}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Sidebar — categories & search */}
        <aside className="space-y-6 lg:col-span-1">
          <form method="GET" className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              placeholder={pp("search_placeholder")}
              defaultValue={search}
              className="pl-9"
            />
          </form>

          <div>
            <h3 className="text-sm font-semibold mb-3">{t("categories")}</h3>
            <nav className="space-y-1">
                <Link
                  href="./products"
                  className={`block rounded-[0.5rem] px-3 py-2 text-sm transition-colors duration-150 ${
                    !categorySlug ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t("all_products")}
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`./products?category=${cat.slug}`}
                    className={`block rounded-[0.5rem] px-3 py-2 text-sm transition-colors duration-150 ${
                      categorySlug === cat.slug ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {cat.name ?? cat.slug}
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
              {filtered.map((p) => {
                const currency = Array.isArray(p.currency) ? p.currency[0] : p.currency;
                const catId = Array.isArray(p.category) ? (p.category[0]?.id ?? null) : (p.category as { id?: string } | null)?.id ?? null;
                const sortedImages = Array.isArray(p.images)
                  ? [...p.images].sort((a, b) => a.position - b.position)
                  : [];
                const firstImage = sortedImages[0];
                const imgSrc = firstImage
                  ? `${STORAGE_BASE}/${firstImage.storage_path}`
                  : null;
                const inStock = !p.track_stock || p.current_stock > 0;
                const bestPromo = getBestPromo(p.id, catId);
                const discountedHt = bestPromo ? computePromoPrice(p.price_ht, bestPromo) : null;
                const priceTTC = toTTC(p.price_ht, p.tax_rate);
                const discountedTTC = discountedHt !== null ? toTTC(discountedHt, p.tax_rate) : null;
                const sym = currency?.symbol ?? currency?.code ?? "F";

                return (
                  <Link key={p.id} href={`./products/${p.id}`}>
                    <div className="group rounded-xl border bg-card overflow-hidden transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)]">
                      <div className="relative">
                        {imgSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgSrc}
                            alt={p.name}
                            className="w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                          {bestPromo ? (
                            <Badge variant="destructive" className="text-[10px] font-bold">{promoLabel(bestPromo)}</Badge>
                          ) : <span />}
                          {!inStock && (
                            <Badge variant="secondary">Rupture</Badge>
                          )}
                        </div>
                      </div>
                      <div className="p-4 space-y-1.5">
                        <h3 className="text-[14px] font-medium leading-snug line-clamp-2">{p.name}</h3>
                        {p.sku && (
                          <p className="text-[11px] text-muted-foreground">{t("ref_label")} {p.sku}</p>
                        )}
                        {discountedTTC !== null ? (
                          <div className="flex items-baseline gap-2">
                            <p className="text-[15px] font-bold text-destructive">
                              {discountedTTC.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} {sym}
                            </p>
                            <p className="text-[12px] text-muted-foreground line-through">
                              {priceTTC.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} {sym}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[15px] font-bold text-primary">
                            {priceTTC.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} {sym}
                          </p>
                        )}
                        {(p.short_description || p.description) && (
                          <p className="text-[12px] text-muted-foreground line-clamp-2">
                            {p.short_description ?? p.description}
                          </p>
                        )}
                      </div>
                    </div>
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
