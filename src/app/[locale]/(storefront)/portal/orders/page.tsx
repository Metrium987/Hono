import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LinkSegmentedControl } from "@/components/ui/segmented-control";
import { getPortalSession } from "@/lib/portal/session";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type PortalOrderRow = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  items: Array<{ id: string; description: string; quantity: number }>;
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "secondary"> = {
  pending:    "warning",
  processing: "default",
  completed:  "success",
  cancelled:  "secondary",
};

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

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, notes, created_at, items:order_items(id, description, quantity)")
    .eq("customer_id", session.customerId)
    .order("created_at", { ascending: false });

  const orderRows: PortalOrderRow[] = Array.isArray(orders) ? orders : [];
  const filtered = status ? orderRows.filter((o) => o.status === status) : orderRows;

  const filterSegments = [
    { value: "",           label: pt("filter_all_f"),          href: ".",                   count: orderRows.length },
    { value: "pending",    label: ot("pending_plural"),        href: "?status=pending",     count: orderRows.filter((o) => o.status === "pending").length },
    { value: "processing", label: ot("processing_plural"),     href: "?status=processing",  count: orderRows.filter((o) => o.status === "processing").length },
    { value: "completed",  label: ot("completed_plural"),      href: "?status=completed",   count: orderRows.filter((o) => o.status === "completed").length },
    { value: "cancelled",  label: ot("cancelled_plural"),      href: "?status=cancelled",   count: orderRows.filter((o) => o.status === "cancelled").length },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{pt("my_orders")}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {pt("order_count", { count: filtered.length })}
          </p>
        </div>
      </div>

      <LinkSegmentedControl
        segments={filterSegments}
        value={status as "" | "pending" | "processing" | "completed" | "cancelled"}
        className="mb-5"
      />

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-medium">{pt("order_header_date")}</TableHead>
              <TableHead className="font-medium">{pt("order_header_items")}</TableHead>
              <TableHead className="font-medium">{pt("order_header_status")}</TableHead>
              <TableHead className="font-medium">{pt("order_header_notes")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  {pt("no_orders")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => {
                const items = Array.isArray(order.items) ? order.items : [];
                return (
                  <TableRow key={order.id} className="group hover:bg-accent/40 transition-colors">
                    <TableCell className="font-mono text-[13px] font-medium">
                      <Link href={`./orders/${order.id}`} className="hover:text-primary transition-colors">
                        {new Date(order.created_at).toLocaleDateString("fr-FR")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pt("items_count", { count: items.length })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[order.status] ?? "default"}>{ot(order.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate text-[13px]">
                      {order.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`./orders/${order.id}`}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        aria-label="Voir la commande"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
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
