import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkSegmentedControl } from "@/components/ui/segmented-control";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "secondary" | "destructive"> = {
  pending:    "warning",
  processing: "default",
  completed:  "success",
  cancelled:  "secondary",
};

export default async function OrdersPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const perm = await checkPagePermission("orders", "read");
  if (!perm.allowed) return <ForbiddenPage module="orders" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("order_status");
  const common = await getTranslations("common");
  const teamId = perm.teamId;

  // Status counts
  const [
    { count: totalCount },
    { count: pendingCount },
    { count: processingCount },
    { count: completedCount },
    { count: cancelledCount },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("team_id", teamId),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("team_id", teamId).eq("status", "pending"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("team_id", teamId).eq("status", "processing"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("team_id", teamId).eq("status", "completed"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("team_id", teamId).eq("status", "cancelled"),
  ]);

  let query = supabase
    .from("orders")
    .select(
      `id, source, status, notes, created_at,
       customer:customer_id(id, company_name, contact_name),
       items:order_items(id, description, quantity, unit_price_ht)`,
      { count: "exact" }
    )
    .eq("team_id", teamId);

  if (status) query = query.eq("status", status);

  const { data: rawOrders, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const orders = (rawOrders ?? []).map((o) => ({
    id: o.id,
    source: o.source as string,
    status: o.status as string,
    notes: (o.notes as string | null) ?? "",
    created_at: o.created_at as string,
    customer: Array.isArray(o.customer) ? o.customer[0] ?? null : (o.customer as { id: string; company_name: string | null; contact_name: string } | null),
    item_count: Array.isArray(o.items) ? o.items.length : 0,
  }));

  const totalPages = Math.ceil((count ?? 0) / limit);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const filterSegments = [
    { value: "",           label: common("all"),        href: ".",                   count: totalCount ?? 0 },
    { value: "pending",    label: t("pending"),         href: "?status=pending",     count: pendingCount ?? 0 },
    { value: "processing", label: t("processing"),      href: "?status=processing",  count: processingCount ?? 0 },
    { value: "completed",  label: t("completed"),       href: "?status=completed",   count: completedCount ?? 0 },
    { value: "cancelled",  label: t("cancelled"),       href: "?status=cancelled",   count: cancelledCount ?? 0 },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-wrap-balance">
            {common("orders")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {common("total_orders", { count: count ?? 0 })}
          </p>
        </div>
        <Button asChild>
          <Link href="orders/new">
            <Plus className="h-4 w-4" />
            {common("new_order")}
          </Link>
        </Button>
      </div>

      <LinkSegmentedControl
        segments={filterSegments}
        value={status as "" | "pending" | "processing" | "completed" | "cancelled"}
      />

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">{common("th_date")}</th>
                <th className="text-left p-3 font-medium">{common("th_customer")}</th>
                <th className="text-left p-3 font-medium text-center w-20">{common("th_items")}</th>
                <th className="text-left p-3 font-medium">{common("th_source")}</th>
                <th className="text-left p-3 font-medium">{common("th_status")}</th>
                <th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-12 text-muted-foreground">
                    {common("no_orders")}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors group">
                    <td className="p-3 font-mono text-[13px]">
                      <Link href={`./orders/${order.id}`} className="hover:text-primary transition-colors">
                        {formatDate(order.created_at)}
                      </Link>
                    </td>
                    <td className="p-3 font-medium">
                      {order.customer
                        ? (order.customer.company_name ?? order.customer.contact_name ?? "—")
                        : "—"}
                    </td>
                    <td className="p-3 text-center text-muted-foreground">
                      {order.item_count}
                    </td>
                    <td className="p-3">
                      <Badge variant={order.source === "storefront" ? "info" : "secondary"}>
                        {order.source === "storefront" ? common("source_storefront") : common("source_erp")}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[order.status] ?? "secondary"}>
                        {t(order.status)}
                      </Badge>
                    </td>
                    <td className="p-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`./orders/${order.id}`}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Voir la commande"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`?${status ? `status=${status}&` : ""}page=${p}`}>
              <Button variant={page === p ? "default" : "outline"} size="sm">{p}</Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
