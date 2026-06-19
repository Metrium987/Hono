import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPortalSession } from "@/lib/portal/session";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

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

  function getStatusBadge(s: string) {
    const variants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "info"> = {
      draft: "secondary",
      sent: "info",
      viewed: "info",
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
          <p className="text-sm text-muted-foreground">{pt("quote_count", { count: quotes?.length ?? 0 })}</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["", "draft", "sent", "accepted", "converted", "expired"].map((s) => {
          const label = s === "" ? pt("filter_all") : qt(s + "_plural");
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
              <TableHead>{pt("quote_ref")}</TableHead>
              <TableHead>{pt("issue_date")}</TableHead>
              <TableHead>{pt("due_date")}</TableHead>
              <TableHead>{pt("status")}</TableHead>
              <TableHead className="text-right">{pt("total_ttc")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(quotes ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  {pt("no_quotes")}
                </TableCell>
              </TableRow>
            ) : (
              (quotes ?? []).map((q: Record<string, unknown>) => {
                const currency = Array.isArray(q.currency) ? q.currency[0] : q.currency;
                return (
                  <TableRow key={q.id as string}>
                    <TableCell className="font-medium">
                      <Link href={`./quotes/${q.id}`} className="hover:text-primary transition-colors">
                        {q.quote_number as string}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {new Date(q.issue_date as string).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      {q.validity_date ? new Date(q.validity_date as string).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(q.status as string)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {(q.total_ttc as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {(currency as Record<string, unknown>)?.symbol as string ?? "F"}
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
