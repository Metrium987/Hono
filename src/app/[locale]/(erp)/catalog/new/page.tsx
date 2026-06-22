import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { ProductForm } from "../_components/product-form";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function NewProductPage() {
  const perm = await checkPagePermission("catalog", "write");
  if (!perm.allowed) return <ForbiddenPage module="catalog" action="write" />;

  const common = await getTranslations("common");
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const [{ data: currencies }, { data: taxRates }, { data: categories }] = await Promise.all([
    supabase.from("currencies").select("id, code, symbol").eq("team_id", teamId).order("code"),
    supabase.from("tax_rates").select("id, name, rate").eq("team_id", teamId).eq("is_active", true),
    supabase.from("product_categories").select("id, name").eq("team_id", teamId).order("name"),
  ]);

  return (
    <ProductForm
      teamId={teamId}
      currencies={currencies ?? []}
      taxRates={taxRates ?? []}
      categories={categories ?? []}
      backHref="../catalog"
    />
  );
}
