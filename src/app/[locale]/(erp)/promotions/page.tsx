import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { PromotionsClient, type PromoRow, type ProductOption, type CategoryOption } from "./promotions-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function PromotionsPage() {
  const perm = await checkPagePermission("promotions", "read");
  if (!perm.allowed) return <ForbiddenPage module="promotions" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const [{ data: promos }, { data: products }, { data: categories }] = await Promise.all([
    supabase.from("promotions")
      .select("*, product_count:promotion_products(count)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    supabase.from("products")
      .select("id, name")
      .eq("team_id", teamId).eq("is_active", true).order("name"),
    supabase.from("product_categories")
      .select("id, name").eq("team_id", teamId).eq("is_active", true).order("name"),
  ]);

  const productOptions: ProductOption[] = (products ?? []).map((p) => ({ id: p.id, name: p.name ?? p.id }));
  const categoryOptions: CategoryOption[] = (categories ?? []).map((c) => ({ id: c.id, name: c.name ?? c.id }));

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
        <p className="text-sm text-muted-foreground">Remises commerciales appliquées automatiquement sur la vitrine</p>
      </div>
      <PromotionsClient
        initialPromos={(promos ?? []) as PromoRow[]}
        products={productOptions}
        categories={categoryOptions}
        teamId={teamId}
      />
    </div>
  );
}
