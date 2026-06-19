import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortalSession } from "@/lib/portal/session";

export default async function PortalOrderDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const session = await getPortalSession();
  if (!session) redirect("./auth");

  const { id } = await props.params;

  const [ot, pt] = await Promise.all([
    getTranslations("order_status"),
    getTranslations("portal"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: order } = await supabase
    .from("orders")
    .select(`*, items:order_items(*)`)
    .eq("id", id)
    .eq("customer_id", session.customerId)
    .single();

  if (!order) notFound();

  const items: Array<Record<string, unknown>> = Array.isArray(order.items) ? order.items : [];

  function getStatusBadge(s: string) {
    const variants: Record<string, "default" | "success" | "warning" | "secondary"> = {
      pending: "warning",
      processing: "default",
      completed: "success",
      cancelled: "secondary",
    };
    return <Badge variant={variants[s] ?? "default"}>{ot(s)}</Badge>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="./.."
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {pt("order_back")}
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {pt("order_from_date", { date: new Date(order.created_at).toLocaleDateString("fr-FR") })}
        </h1>
        {getStatusBadge(order.status)}
      </div>

      {/* Items table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{pt("order_items_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left pb-3 font-medium">{pt("order_item_description")}</th>
                <th className="text-right pb-3 font-medium">{pt("order_item_quantity")}</th>
                <th className="text-right pb-3 font-medium">{pt("order_item_unit_price")}</th>
                <th className="text-right pb-3 font-medium">{pt("order_item_special_request")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id as string} className="border-b last:border-0">
                  <td className="py-3">{item.description as string}</td>
                  <td className="text-right py-3">{item.quantity as string}</td>
                  <td className="text-right py-3">
                    {item.unit_price_ht
                      ? `${(item.unit_price_ht as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`
                      : "—"}
                  </td>
                  <td className="text-right py-3 text-muted-foreground">
                    {(item.special_request as string) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{order.notes as string}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
