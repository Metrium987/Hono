import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductImageUpload } from "./product-image-upload";
import { ProductPublishToggle } from "./product-publish-toggle";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type Params = Promise<{ id: string }>;

type ProductImage = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  position: number;
};

export default async function ProductDetailPage(props: { params: Params }) {
  const { id } = await props.params;
  const perm = await checkPagePermission("catalog", "read");
  if (!perm.allowed) return <ForbiddenPage module="catalog" />;

  const t = await getTranslations("product_detail");
  const common = await getTranslations("common");
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const { data: product, error } = await supabase
    .from("products")
    .select(`
      *, category:category_id(name),
      translations:product_translations(name, description),
      images:product_images(id, storage_path, alt_text, position)
    `)
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (error || !product) notFound();

  const name = product.translations?.[0]?.name ?? product.name ?? "—";
  const description = product.translations?.[0]?.description ?? null;
  const activeCurrency = "F";
  const priceHt = product.price_ht ?? product.unit_price_ht ?? 0;

  const images: ProductImage[] = Array.isArray(product.images)
    ? product.images.sort((a: ProductImage, b: ProductImage) => a.position - b.position)
    : [];

  function imgUrl(storagePath: string) {
    return `${SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`;
  }

  function fmt(amount: number) {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${activeCurrency}`;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../catalog"><ArrowLeft className="h-5 w-5" /></Link>
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
        <Button variant="outline" asChild>
          <Link href={`${id}/edit`}><Pencil className="mr-2 h-4 w-4" />{t("edit")}</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <ProductPublishToggle productId={id} teamId={teamId} initialPublished={product.is_published ?? false} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("price_ht")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmt(priceHt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("category")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {Array.isArray(product.category) ? product.category[0]?.name : product.category?.name ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("track_stock")}</CardTitle></CardHeader>
          <CardContent>
            {product.track_stock ? (
              <>
                <p className="text-3xl font-bold">{product.current_stock}</p>
                <p className="text-sm text-muted-foreground">{t("current_stock")}</p>
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

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("images_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={imgUrl(img.storage_path)}
                  alt={img.alt_text ?? name}
                  className="rounded-md object-cover h-32 w-full border"
                />
              ))}
            </div>
          )}
          <ProductImageUpload productId={id} teamId={teamId} />
        </CardContent>
      </Card>
    </div>
  );
}
