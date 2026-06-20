import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductForm } from "../../_components/product-form";

type Params = Promise<{ id: string }>;

export default async function EditProductPage(props: { params: Params }) {
  const { id } = await props.params;
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

  const [{ data: product, error }, { data: currencies }, { data: taxRates }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*, translations:product_translations(*)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single(),
    supabase.from("currencies").select("id, code, symbol").eq("team_id", teamId).order("code"),
    supabase.from("tax_rates").select("id, name, rate").eq("team_id", teamId).eq("is_active", true),
    supabase.from("product_categories").select("id, name").eq("team_id", teamId).order("name"),
  ]);

  if (error || !product) notFound();

  const frTrans = Array.isArray(product.translations)
    ? product.translations.find((t: { locale: string }) => t.locale === "fr")
    : null;

  return (
    <ProductForm
      teamId={teamId}
      productId={id}
      currencies={currencies ?? []}
      taxRates={taxRates ?? []}
      categories={categories ?? []}
      backHref={`../../catalog/${id}`}
      initialData={{
        name: frTrans?.name ?? product.name ?? "",
        sku: product.sku ?? "",
        type: product.type ?? "product",
        price_ht: product.price_ht ?? 0,
        currency_id: product.currency_id ?? "",
        tax_rate_id: product.tax_rate_id ?? "",
        category_id: product.category_id ?? "",
        unit: product.unit ?? "pcs",
        track_stock: product.track_stock ?? false,
        current_stock: product.current_stock ?? 0,
        description: frTrans?.description ?? product.description ?? "",
        short_description: frTrans?.short_description ?? "",
        featured: product.featured ?? false,
        slug: product.slug ?? "",
        meta_title: product.meta_title ?? "",
        meta_description: product.meta_description ?? "",
        is_published: product.is_published ?? false,
        is_active: product.is_active ?? true,
      }}
    />
  );
}
