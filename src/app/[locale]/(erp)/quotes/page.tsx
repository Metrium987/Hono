import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotesListClient } from "./quotes-list-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function QuotesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const perm = await checkPagePermission("quotes", "read");
  if (!perm.allowed) return <ForbiddenPage module="quotes" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("quotes_page");
  const common = await getTranslations("common");
  const statusT = await getTranslations("quote_status");

  const teamId = perm.teamId;
  if (!teamId) return <div>{common("no_team")}</div>;

  let query = supabase
    .from("quotes")
    .select("id, quote_number, status, total_ttc, issue_date, validity_date, customer:customer_id(company_name, contact_name), currency:currency_id(symbol)", { count: "exact" })
    .eq("team_id", teamId);

  if (status) {
    query = query.eq("status", status);
  }

  const { data: rawQuotes, count } = await query
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1);

  type RawQuote = {
    id: string; quote_number: string; status: string; total_ttc: number;
    issue_date: string; validity_date: string | null;
    customer: { company_name: string | null; contact_name: string }[] | null;
    currency: { symbol: string }[] | null;
  };

  const quotes = ((rawQuotes ?? []) as RawQuote[]).map((q) => ({
    id: q.id,
    quote_number: q.quote_number,
    status: q.status,
    total_ttc: q.total_ttc,
    issue_date: q.issue_date,
    validity_date: q.validity_date,
    customer: Array.isArray(q.customer) ? (q.customer[0] ?? null) : (q.customer ?? null),
    currency: Array.isArray(q.currency) ? (q.currency[0] ?? null) : (q.currency ?? null),
  }));

  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { count: count ?? 0 })}
          </p>
        </div>
        <Button asChild>
          <Link href="./new">
            <Plus className="mr-2 h-4 w-4" />
            {t("new_quote")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "draft", "sent", "accepted", "rejected", "expired", "converted"].map((s) => {
          const labels: Record<string, string> = { "": t("filter_all"), draft: statusT("draft_plural"), sent: statusT("sent_plural"), accepted: statusT("accepted_plural"), rejected: statusT("rejected_plural"), expired: statusT("expired_plural"), converted: statusT("converted_plural") };
          return (
            <Link key={s} href={s ? `?status=${s}` : "."}>
              <Button variant={status === s ? "default" : "outline"} size="sm">
                {labels[s] ?? s}
              </Button>
            </Link>
          );
        })}
      </div>

      <QuotesListClient quotes={quotes} currentPage={page} totalPages={totalPages} baseUrl="." currentStatus={status} />
    </div>
  );
}
