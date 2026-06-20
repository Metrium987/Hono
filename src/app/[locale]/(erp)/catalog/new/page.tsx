import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { ProductForm } from "../_components/product-form";

export default async function NewProductPage() {
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
