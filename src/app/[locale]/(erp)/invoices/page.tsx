import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoicesListClient, type InvoiceRow } from "./invoices-list-client";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function InvoicesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const t = await getTranslations("invoices_page");
  const common = await getTranslations("common");
  const statusT = await getTranslations("invoice_status");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  // Build query
  let query = supabase
    .from("invoices")
    .select("id, invoice_number, status, total_ttc, paid_amount, issue_date, due_date, customer:customer_id(company_name, contact_name), currency:currency_id(symbol)", { count: "exact" })
    .eq("team_id", teamId)
    .is("deleted_at", null);

  if (status) {
    query = query.eq("status", status);
  }

  const { data: rawInvoices, count } = await query
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1);

  // Supabase join returns arrays — extract first element for joins
  type RawInvoice = {
    id: string; invoice_number: string; status: string;
    total_ttc: number; paid_amount: number;
    issue_date: string; due_date: string;
    customer: { company_name: string | null; contact_name: string }[] | null;
    currency: { symbol: string }[] | null;
  };
  const invoices: InvoiceRow[] = ((rawInvoices ?? []) as RawInvoice[]).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status,
    total_ttc: inv.total_ttc,
    paid_amount: inv.paid_amount,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    customer: Array.isArray(inv.customer) ? (inv.customer[0] ?? null) : (inv.customer ?? null),
    currency: Array.isArray(inv.currency) ? (inv.currency[0] ?? null) : (inv.currency ?? null),
  }));

  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
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
            {t("new_invoice")}
          </Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {["", "draft", "sent", "paid", "overdue", "cancelled"].map((s) => {
          const label = s === "" ? t("filter_all") : s === "draft" ? statusT("draft_plural") : s === "sent" ? statusT("sent_plural") : s === "paid" ? statusT("paid_plural") : s === "overdue" ? statusT("overdue_plural") : statusT("cancelled_plural");
          const href = s ? `?status=${s}` : "."
          return (
            <Link key={s} href={href}>
              <Button variant={status === s ? "default" : "outline"} size="sm">
                {label}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Client component handles interactive features */}
      <InvoicesListClient
        invoices={invoices ?? []}
        currentPage={page}
        totalPages={totalPages}
        baseUrl="."
        currentStatus={status}
      />
    </div>
  );
}
