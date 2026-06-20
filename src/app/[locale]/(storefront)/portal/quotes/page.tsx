import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  let query = supabase
    .from("quotes")
    .select("id, quote_number, status, total_ttc, issue_date, validity_date, currency:currency_id(symbol)")
    .eq("customer_id", session.customerId);

  if (status) query = query.eq("status", status);

  const { data: quotes } = await query.order("created_at", { ascending: false });
  const quoteRows: PortalQuoteRow[] = Array.isArray(quotes) ? quotes : [];

  function unwrapCurrency(value: PortalQuoteRow["currency"]): { symbol?: string | null } | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }

  function getStatusBadge(s: string) {
    const variants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
      draft: "secondary",
      sent: "default",
      viewed: "default",
      accepted: "success",
      rejected: "destructive",
      expired: "secondary",
      converted: "default",
    };
    return <Badge variant={variants[s] ?? "default"}>{qt(s)}</Badge>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pt("my_quotes")}</h1>
          <p className="text-sm text-muted-foreground">{pt("quote_count", { count: quoteRows.length })}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {["", "draft", "sent", "accepted", "converted", "expired"].map((s) => {
          const label = s === "" ? pt("filter_all") : qt(s + "_plural");
          return (
            <Link key={s} href={s ? `?status=${s}` : "."}>
              <Button variant={status === s ? "default" : "outline"} size="sm">{label}</Button>
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{pt("quote_ref")}</TableHead>
              <TableHead>{pt("issue_date")}</TableHead>
              <TableHead>{pt("due_date")}</TableHead>
              <TableHead>{pt("status")}</TableHead>
              <TableHead className="text-right">{pt("total_ttc")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quoteRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{pt("no_quotes")}</TableCell>
              </TableRow>
            ) : (
              quoteRows.map((q) => {
                const currency = unwrapCurrency(q.currency);
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      <Link href={`./quotes/${q.id}`} className="hover:text-primary transition-colors">{q.quote_number}</Link>
                    </TableCell>
                    <TableCell>{new Date(q.issue_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{q.validity_date ? new Date(q.validity_date).toLocaleDateString("fr-FR") : "—"}</TableCell>
                    <TableCell>{getStatusBadge(q.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {q.total_ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}
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
