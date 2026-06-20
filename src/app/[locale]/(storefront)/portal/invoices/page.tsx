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

type PortalInvoice = {
  id: string;
  invoice_number: string;
  status: string;
  total_ttc: number;
  paid_amount: number;
  issue_date: string;
  due_date: string;
  currency: { symbol?: string | null } | Array<{ symbol?: string | null }> | null;
};

export default async function PortalInvoicesPage(props: { searchParams: SearchParams }) {
  const session = await getPortalSession();
  if (!session) redirect("./auth");

  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";

  const [it, pt] = await Promise.all([
    getTranslations("invoice_status"),
    getTranslations("portal"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_ttc, paid_amount, issue_date, due_date, currency:currency_id(symbol)")
    .eq("customer_id", session.customerId)
    .is("deleted_at", null);

  if (status) {
    // Refetch with status filter
  }

  const invoiceList: PortalInvoice[] = Array.isArray(invoices) ? invoices : [];
  const filtered = status ? invoiceList.filter((inv) => inv.status === status) : invoiceList;

  function getStatusBadge(s: string) {
    const variants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
      draft: "secondary",
      sent: "default",
      viewed: "default",
      partial: "warning",
      paid: "success",
      overdue: "destructive",
      cancelled: "secondary",
      refunded: "secondary",
    };
    return <Badge variant={variants[s] ?? "default"}>{it(s)}</Badge>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pt("my_invoices")}</h1>
          <p className="text-sm text-muted-foreground">{pt("invoice_count", { count: filtered.length })}</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["", "sent", "paid", "overdue", "cancelled"].map((s) => {
          const label = s === "" ? pt("filter_all_f") : it(s + "_plural");
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
              <TableHead>{pt("invoice_ref")}</TableHead>
              <TableHead>{pt("issue_date")}</TableHead>
              <TableHead>{pt("due_date")}</TableHead>
              <TableHead>{pt("status")}</TableHead>
              <TableHead className="text-right">{pt("total_ttc")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  {pt("no_invoices")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const currency = Array.isArray(inv.currency) ? inv.currency[0] : inv.currency;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      <Link href={`./invoices/${inv.id}`} className="hover:text-primary transition-colors">
                        {inv.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(inv.issue_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{new Date(inv.due_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {inv.total_ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}
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
