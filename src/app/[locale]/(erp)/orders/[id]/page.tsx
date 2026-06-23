import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusActions } from "./order-status-actions";
import { GenerateInvoiceButton } from "./generate-invoice-button";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type Params = { id: string };

type OrderItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_ht: number | null;
};

export default async function OrderDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const perm = await checkPagePermission("orders", "read");
  if (!perm.allowed) return <ForbiddenPage module="orders" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("order_status");
  const common = await getTranslations("common");

  const teamId = perm.teamId;

  const [{ data: order, error }, { data: deliveryNotes }] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id, source, status, notes, created_at, updated_at,
        customer:customer_id(*),
        items:order_items(*)
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single(),
    supabase
      .from("delivery_notes")
      .select("id, note_number, status, created_at")
      .eq("order_id", id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
  ]);

  if (error || !order) {
    return <div className="text-center py-12 text-muted-foreground">{common("not_found")}</div>;
  }

  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
  const items: OrderItem[] = Array.isArray(order.items) ? order.items : order.items ?? [];
  const bons = deliveryNotes ?? [];

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatCurrency(amount: number | null) {
    if (amount === null) return "—";
    return `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../orders"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{common("order_detail")}</h1>
          <p className="text-sm text-muted-foreground"><span className="font-mono">{order.id.slice(0, 8)}</span> — {formatDate(order.created_at)}</p>
        </div>
        {order.status !== "cancelled" && (
          <GenerateInvoiceButton orderId={id} teamId={teamId} />
        )}
      </div>

      <OrderStatusActions
        orderId={id}
        teamId={teamId}
        initialStatus={order.status as "pending" | "processing" | "completed" | "cancelled"}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{common("customer_info")}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <span className="font-medium">{common("customer")}:</span>{" "}
              {customer ? (
                <Link
                  href={`../customers/${(customer as { id: string }).id}`}
                  className="hover:text-primary hover:underline transition-colors"
                >
                  {customer.company_name ?? customer.contact_name ?? t("unknown")}
                </Link>
              ) : t("unknown")}
            </p>
            <p><span className="font-medium">Email:</span> {customer?.email ?? "—"}</p>
            <p><span className="font-medium">{common("source")}:</span> {order.source === "storefront" ? common("source_storefront") : common("source_erp")}</p>
            <p><span className="font-medium">{common("status")}:</span> {t(order.status)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{common("notes")}</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{order.notes || "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{common("th_items")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">{common("th_description")}</th>
                <th className="text-right p-3 font-medium">{common("th_quantity")}</th>
                <th className="text-right p-3 font-medium">{common("th_unit_price")}</th>
                <th className="text-right p-3 font-medium">{common("th_total")}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="text-center p-6 text-muted-foreground">{common("no_items")}</td></tr>
              ) : items.map((item) => {
                const total = (item.unit_price_ht ?? 0) * item.quantity;
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-3">{item.description}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.unit_price_ht ?? 0)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Bons de livraison
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`../delivery-notes/new?order_id=${id}`}>+ Créer un BL</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {bons.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Aucun bon de livraison</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-3 font-medium">N° BL</th>
                  <th className="text-left p-3 font-medium">Statut</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {bons.map((bl) => (
                  <tr key={bl.id} className="border-b last:border-0">
                    <td className="p-3 font-mono font-medium">{bl.note_number}</td>
                    <td className="p-3 text-muted-foreground capitalize">{bl.status}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(bl.created_at)}</td>
                    <td className="p-3 text-right">
                      <Link href={`../delivery-notes/${bl.id}`} className="text-xs text-primary hover:underline">
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
