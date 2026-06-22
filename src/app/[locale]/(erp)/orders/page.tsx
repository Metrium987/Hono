import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  processing: "default",
  completed: "default",
  cancelled: "destructive",
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

  let query = supabase
    .from("orders")
    .select(`
      id, source, status, notes, created_at, updated_at,
      customer:customer_id(id, company_name, contact_name, email),
      items:order_items(id, description, quantity, unit_price_ht)
    `, { count: "exact" })
    .eq("team_id", teamId);

  if (status) query = query.eq("status", status);

  const { data: rawOrders, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const orders = (rawOrders ?? []).map((o) => ({
    id: o.id,
    source: o.source,
    status: o.status,
    notes: o.notes ?? "",
    created_at: o.created_at,
    customer: Array.isArray(o.customer) ? o.customer[0] ?? null : o.customer,
    items: Array.isArray(o.items) ? o.items : o.items ?? [],
    item_count: Array.isArray(o.items) ? o.items.length : 0,
  }));

  const totalPages = Math.ceil((count ?? 0) / limit);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{common("orders")}</h1>
          <p className="text-sm text-muted-foreground">{common("total_orders", { count: count ?? 0 })}</p>
        </div>
        <Button asChild>
          <Link href="orders/new">
            <Plus className="mr-2 h-4 w-4" /> {common("new_order")}
          </Link>
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        <Link href=".">
          <Button variant={!status ? "default" : "outline"} size="sm">{common("all")}</Button>
        </Link>
        {["pending", "processing", "completed", "cancelled"].map((s) => (
          <Link key={s} href={`?status=${s}`}>
            <Button variant={status === s ? "default" : "outline"} size="sm">{t(s)}</Button>
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">{common("th_date")}</th>
                <th className="text-left p-3 font-medium">{common("th_customer")}</th>
                <th className="text-left p-3 font-medium">{common("th_items")}</th>
                <th className="text-left p-3 font-medium">{common("th_source")}</th>
                <th className="text-left p-3 font-medium">{common("th_status")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-muted-foreground">
                    {common("no_orders")}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="p-3">
                      <Link href={`./orders/${order.id}`} className="hover:text-primary transition-colors">
                        {formatDate(order.created_at)}
                      </Link>
                    </td>
                    <td className="p-3 font-medium">
                      {order.customer
                        ? `${order.customer.company_name ?? order.customer.contact_name ?? ""}`
                        : "—"}
                    </td>
                    <td className="p-3">{order.item_count}</td>
                    <td className="p-3">
                      <Badge variant="outline">{order.source === "storefront" ? common("source_storefront") : common("source_erp")}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={STATUS_VARIANTS[order.status] ?? "secondary"}>
                        {t(order.status)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`?status=${status || ""}&page=${p}`}>
              <Button variant={page === p ? "default" : "outline"} size="sm">{p}</Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
