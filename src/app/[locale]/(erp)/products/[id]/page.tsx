import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Params = Promise<{ id: string }>;

export default async function ProductDetailPage(props: { params: Params }) {
  const { id } = await props.params;
  const t = await getTranslations("product_detail");
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

  const { data: product, error } = await supabase
    .from("products")
    .select(`
      *, category:category_id(name),
      translations:product_translations(name, description),
      images:product_images(url, alt, position)
    `)
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (error || !product) notFound();

  const name = product.translations?.[0]?.name ?? product.name ?? "—";
  const description = product.translations?.[0]?.description ?? null;
  const activeCurrency = "F";
  const priceTtc = product.tax_rate_id
    ? product.unit_price_ht * (1 + (product.tax_rate_id ? 0.16 : 0))
    : product.unit_price_ht;

  function fmt(amount: number) {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${activeCurrency}`;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../products"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            {product.is_active ? (
              <Badge variant="success">Actif</Badge>
            ) : (
              <Badge variant="secondary">Inactif</Badge>
            )}
          </div>
          {product.sku && <p className="text-sm text-muted-foreground">SKU : {product.sku}</p>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("price_ht")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmt(product.unit_price_ht)}</p>
            <p className="text-sm text-muted-foreground">
              {t("price_ttc")} : {fmt(priceTtc)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("category")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{product.category?.name ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("track_stock")}</CardTitle></CardHeader>
          <CardContent>
            {product.track_stock ? (
              <>
                <p className="text-3xl font-bold">{product.current_stock}</p>
                <p className="text-sm text-muted-foreground">
                  {t("current_stock")}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Non suivi</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Type</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{product.type === "service" ? "Service" : "Produit"}</p>
          </CardContent>
        </Card>
      </div>

      {description && (
        <Card>
          <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{description}</p>
          </CardContent>
        </Card>
      )}

      {product.images && product.images.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("images_title")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {product.images.map((img: { url: string; alt: string | null }, i: number) => (
                <img key={i} src={img.url} alt={img.alt ?? name} className="rounded-md object-cover h-32 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
