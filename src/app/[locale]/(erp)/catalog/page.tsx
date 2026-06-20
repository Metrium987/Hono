import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductsListClient, type ProductRow } from "./products-list-client";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ProductsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const t = await getTranslations("products_page");
  const common = await getTranslations("common");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  const { data: products, count } = await supabase
    .from("products")
    .select("id, type, unit_price_ht, currency_id, current_stock, track_stock, is_active, category:category_id(name), translation:product_translations(name)", { count: "exact" })
    .eq("team_id", teamId)
    .eq("product_translations.locale", "fr")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  type RawProduct = {
    id: string; type: string; unit_price_ht: number; currency_id: string;
    current_stock: number; track_stock: boolean; is_active: boolean;
    category: { name: string }[] | null;
    translation: { name: string }[] | null;
  };

  const productRows: ProductRow[] = ((products ?? []) as RawProduct[]).map((p) => ({
    id: p.id,
    name: Array.isArray(p.translation) ? p.translation[0]?.name ?? "-" : "-",
    type: p.type,
    unit_price_ht: p.unit_price_ht,
    current_stock: p.current_stock,
    track_stock: p.track_stock,
    is_active: p.is_active,
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
      </div>
      <ProductsListClient products={productRows} currentPage={page} totalPages={totalPages} baseUrl="." />
    </div>
  );
}
