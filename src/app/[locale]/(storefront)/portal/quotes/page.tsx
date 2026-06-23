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

type PortalQuoteRow = {
  id: string;
  quote_number: string;
  status: string;
  issue_date: string;
  validity_date: string | null;
  total_ttc: number;
  currency: { symbol?: string | null } | Array<{ symbol?: string | null }> | null;
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  draft: "secondary",
  sent: "default",
  viewed: "default",
  accepted: "success",
  rejected: "destructive",
  expired: "secondary",
  converted: "default",
};

export default async function PortalQuotesPage(props: { searchParams: SearchParams }) {
  const session = await getPortalSession();
  if (!session) redirect("./auth");

  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";

  const [qt, pt] = await Promise.all([
    getTranslations("quote_status"),
    getTranslations("portal"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, quote_number, status, total_ttc, issue_date, validity_date, currency:currency_id(symbol)")
    .eq("customer_id", session.customerId)
    .order("created_at", { ascending: false });

  const quoteRows: PortalQuoteRow[] = Array.isArray(quotes) ? quotes : [];
  const filtered = status ? quoteRows.filter((q) => q.status === status) : quoteRows;

  function unwrapCurrency(value: PortalQuoteRow["currency"]): { symbol?: string | null } | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }

  const filterSegments = [
    { value: "",          label: pt("filter_all"),         href: ".",                  count: quoteRows.length },
    { value: "draft",     label: qt("draft_plural"),       href: "?status=draft",      count: quoteRows.filter((q) => q.status === "draft").length },
    { value: "sent",      label: qt("sent_plural"),        href: "?status=sent",       count: quoteRows.filter((q) => q.status === "sent").length },
    { value: "accepted",  label: qt("accepted_plural"),    href: "?status=accepted",   count: quoteRows.filter((q) => q.status === "accepted").length },
    { value: "converted", label: qt("converted_plural"),   href: "?status=converted",  count: quoteRows.filter((q) => q.status === "converted").length },
    { value: "expired",   label: qt("expired_plural"),     href: "?status=expired",    count: quoteRows.filter((q) => q.status === "expired").length },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{pt("my_quotes")}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {pt("quote_count", { count: filtered.length })}
          </p>
        </div>
      </div>

      <LinkSegmentedControl
        segments={filterSegments}
        value={status as "" | "draft" | "sent" | "accepted" | "converted" | "expired"}
        className="mb-5"
      />

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-medium">{pt("quote_ref")}</TableHead>
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
                  {pt("no_quotes")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((q) => {
                const currency = unwrapCurrency(q.currency);
                return (
                  <TableRow key={q.id} className="group hover:bg-accent/40 transition-colors">
                    <TableCell className="font-medium">
                      <Link href={`./quotes/${q.id}`} className="hover:text-primary transition-colors">
                        {q.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-[13px]">
                      {new Date(q.issue_date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="font-mono text-[13px]">
                      {q.validity_date ? new Date(q.validity_date).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[q.status] ?? "default"}>{qt(q.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {q.total_ttc.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} {currency?.symbol ?? "F"}
                    </TableCell>
                    <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`./quotes/${q.id}`}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        aria-label="Voir le devis"
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
