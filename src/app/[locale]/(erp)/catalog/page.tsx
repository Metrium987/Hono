import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductsListClient, type ProductRow } from "./products-list-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ProductsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const perm = await checkPagePermission("catalog", "read");
  if (!perm.allowed) return <ForbiddenPage module="catalog" />;

  const t = await getTranslations("products_page");
  const common = await getTranslations("common");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const { data: products, count } = await supabase
    .from("products")
    .select("id, type, price_ht, cost_price, current_stock, track_stock, is_active, is_published, category:category_id(name), translation:product_translations(name)", { count: "exact" })
    .eq("team_id", teamId)
    .eq("product_translations.locale", "fr")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  type RawProduct = {
    id: string; type: string; price_ht: number; cost_price: number | null;
    current_stock: number; track_stock: boolean; is_active: boolean; is_published: boolean;
    category: { name: string }[] | null;
    translation: { name: string }[] | null;
  };

  const productRows: ProductRow[] = ((products ?? []) as RawProduct[]).map((p) => ({
    id: p.id,
    name: Array.isArray(p.translation) ? p.translation[0]?.name ?? "-" : "-",
    type: p.type,
    price_ht: p.price_ht,
    cost_price: p.cost_price ?? null,
    current_stock: p.current_stock,
    track_stock: p.track_stock,
    is_active: p.is_active,
    is_published: p.is_published,
    category: Array.isArray(p.category) ? (p.category[0]?.name ?? null) : null,
  }));

  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle", { count: count ?? 0 })}</p>
        </div>
        <Button asChild>
          <Link href="catalog/new"><Plus className="mr-2 h-4 w-4" />{t("new")}</Link>
        </Button>
      </div>
      <ProductsListClient products={productRows} currentPage={page} totalPages={totalPages} baseUrl="." />
    </div>
  );
}
