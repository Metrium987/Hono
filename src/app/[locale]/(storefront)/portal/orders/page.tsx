import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPortalSession } from "@/lib/portal/session";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function PortalOrdersPage(props: { searchParams: SearchParams }) {
  const session = await getPortalSession();
  if (!session) redirect("./auth");

  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";

  const [ot, pt] = await Promise.all([
    getTranslations("order_status"),
    getTranslations("portal"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let query = supabase
    .from("orders")
    .select("id, status, notes, created_at, items:order_items(id, description, quantity)")
    .eq("customer_id", session.customerId);

  if (status) query = query.eq("status", status);

  const { data: orders } = await query.order("created_at", { ascending: false });

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pt("my_orders")}</h1>
          <p className="text-sm text-muted-foreground">{pt("order_count", { count: orders?.length ?? 0 })}</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["", "pending", "processing", "completed", "cancelled"].map((s) => {
          const label = s === "" ? pt("filter_all_f") : ot(s + "_plural");
          return (
            <Link key={s} href={s ? `?status=${s}` : "."}>
              <Button variant={status === s ? "default" : "outline"} size="sm">
                {label}
              </Button>
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{pt("order_header_date")}</TableHead>
              <TableHead>{pt("order_header_items")}</TableHead>
              <TableHead>{pt("order_header_status")}</TableHead>
              <TableHead>{pt("order_header_notes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  {pt("no_orders")}
                </TableCell>
              </TableRow>
            ) : (
              (orders ?? []).map((order: Record<string, unknown>) => {
                const items = Array.isArray(order.items) ? order.items : [];
                return (
                  <TableRow key={order.id as string}>
                    <TableCell className="font-medium">
                      <Link href={`./orders/${order.id}`} className="hover:text-primary transition-colors">
                        {new Date(order.created_at as string).toLocaleDateString("fr-FR")}
                      </Link>
                    </TableCell>
                    <TableCell>                    {pt("items_count", { count: items.length })}</TableCell>
                    <TableCell>{getStatusBadge(order.status as string)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {(order.notes as string) || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
