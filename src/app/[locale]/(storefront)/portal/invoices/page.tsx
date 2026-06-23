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

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  draft: "secondary",
  sent: "default",
  viewed: "default",
  partial: "warning",
  paid: "success",
  overdue: "destructive",
  cancelled: "secondary",
  refunded: "secondary",
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
    .is("deleted_at", null)
    .order("issue_date", { ascending: false });

  const invoiceList: PortalInvoice[] = Array.isArray(invoices) ? invoices : [];
  const filtered = status ? invoiceList.filter((inv) => inv.status === status) : invoiceList;

  const filterSegments = [
    { value: "",          label: pt("filter_all_f"),     href: ".",                 count: invoiceList.length },
    { value: "sent",      label: it("sent_plural"),      href: "?status=sent",      count: invoiceList.filter((i) => i.status === "sent").length },
    { value: "paid",      label: it("paid_plural"),      href: "?status=paid",      count: invoiceList.filter((i) => i.status === "paid").length },
    { value: "overdue",   label: it("overdue_plural"),   href: "?status=overdue",   count: invoiceList.filter((i) => i.status === "overdue").length },
    { value: "cancelled", label: it("cancelled_plural"), href: "?status=cancelled", count: invoiceList.filter((i) => i.status === "cancelled").length },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{pt("my_invoices")}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {pt("invoice_count", { count: filtered.length })}
          </p>
        </div>
      </div>

      <LinkSegmentedControl
        segments={filterSegments}
        value={status as "" | "sent" | "paid" | "overdue" | "cancelled"}
        className="mb-5"
      />

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-medium">{pt("invoice_ref")}</TableHead>
              <TableHead className="font-medium">{pt("issue_date")}</TableHead>
              <TableHead className="font-medium">{pt("due_date")}</TableHead>
              <TableHead className="font-medium">{pt("status")}</TableHead>
              <TableHead className="text-right font-medium">{pt("total_ttc")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {pt("no_invoices")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const currency = Array.isArray(inv.currency) ? inv.currency[0] : inv.currency;
                return (
                  <TableRow key={inv.id} className="group hover:bg-accent/40 transition-colors">
                    <TableCell className="font-medium">
                      <Link href={`./invoices/${inv.id}`} className="hover:text-primary transition-colors">
                        {inv.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-[13px]">
                      {new Date(inv.issue_date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="font-mono text-[13px]">
                      {new Date(inv.due_date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status] ?? "default"}>{it(inv.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {inv.total_ttc.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} {currency?.symbol ?? "F"}
                    </TableCell>
                    <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`./invoices/${inv.id}`}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        aria-label="Voir la facture"
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
