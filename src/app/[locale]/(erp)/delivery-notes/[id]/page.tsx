import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type Params = Promise<{ id: string }>;

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", dispatched: "Expédié", delivered: "Livré", cancelled: "Annulé",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  draft: "secondary", dispatched: "default", delivered: "success", cancelled: "destructive",
};

type DNItem = {
  id: string;
  quantity: number;
  unit_price: number | null;
  product: { id: string; name: string; sku: string } | null;
};

type DNOrder = { id: string; order_number: string; customer_id: string } | Array<{ id: string; order_number: string; customer_id: string }> | null;

export default async function DeliveryNoteDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const perm = await checkPagePermission("orders", "read");
  if (!perm.allowed) return <ForbiddenPage module="orders" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: dn, error } = await supabase
    .from("delivery_notes")
    .select("*, order:order_id(id, order_number, customer_id), items:delivery_note_items(*, product:product_id(id, name, sku))")
    .eq("id", id)
    .eq("team_id", perm.teamId)
    .single();

  if (error || !dn) notFound();

  const order = Array.isArray(dn.order) ? dn.order[0] : dn.order;
  const items: DNItem[] = Array.isArray(dn.items) ? dn.items : [];

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatCurrency(amount: number | null) {
    if (amount === null) return "—";
    return `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="../delivery-notes"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{dn.note_number}</h1>
              <Badge variant={STATUS_VARIANTS[dn.status] ?? "secondary"}>
                {STATUS_LABELS[dn.status] ?? dn.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Créé le {formatDate(dn.created_at)}
              {dn.dispatched_at && <> · Expédié le {formatDate(dn.dispatched_at)}</>}
              {dn.delivered_at && <> · Livré le {formatDate(dn.delivered_at)}</>}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/v1/delivery-notes/${id}/pdf?team_id=${perm.teamId}`} download>
            <Download className="h-4 w-4 mr-2" />
            Télécharger PDF
          </a>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Commande associée</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">N° commande :</span>{" "}
              {order ? (
                <Link href={`../orders/${order.id}`} className="hover:text-primary hover:underline transition-colors">
                  {order.order_number}
                </Link>
              ) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Adresse de livraison</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{dn.delivery_address || "Non spécifiée"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Articles</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">Produit</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-right p-3 font-medium">Qté</th>
                <th className="text-right p-3 font-medium">Prix unitaire</th>
                <th className="text-right p-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">Aucun article</td></tr>
              ) : items.map((item) => {
                const total = (item.unit_price ?? 0) * item.quantity;
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{item.product?.name ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{item.product?.sku ?? "—"}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
