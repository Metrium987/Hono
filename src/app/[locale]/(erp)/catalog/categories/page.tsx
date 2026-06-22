import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CategoriesClient } from "./categories-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export type CategoryRow = {
  id: string;
  slug: string;
  name: string | null;
  is_active: boolean;
  sort_order: number;
  product_count: number;
};

export default async function CategoriesPage() {
  const perm = await checkPagePermission("catalog", "read");
  if (!perm.allowed) return <ForbiddenPage module="catalog" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, slug, name, is_active, sort_order")
    .eq("team_id", teamId)
    .order("sort_order", { ascending: true });

  // Count products per category
  const { data: productCounts } = await supabase
    .from("products")
    .select("category_id")
    .eq("team_id", teamId)
    .eq("is_active", true);

  const countMap: Record<string, number> = {};
  (productCounts ?? []).forEach((p) => {
    if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] ?? 0) + 1;
  });

  const rows: CategoryRow[] = (categories ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    is_active: c.is_active,
    sort_order: c.sort_order,
    product_count: countMap[c.id] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="../catalog"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Retour au catalogue
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Catégories</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} catégorie{rows.length !== 1 ? "s" : ""} — organisez votre vitrine
          </p>
        </div>
      </div>

      <CategoriesClient teamId={teamId} initialCategories={rows} />
    </div>
  );
}
