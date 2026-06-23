import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkSegmentedControl } from "@/components/ui/segmented-control";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";
import { InvoicesListClient, type InvoiceRow } from "./invoices-list-client";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function InvoicesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const perm = await checkPagePermission("invoices", "read");
  if (!perm.allowed) return <ForbiddenPage module="invoices" />;

  const t = await getTranslations("invoices_page");
  const statusT = await getTranslations("invoice_status");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Counts per status for badge display
  const [
    { count: totalCount },
    { count: draftCount },
    { count: sentCount },
    { count: paidCount },
    { count: overdueCount },
    { count: cancelledCount },
  ] = await Promise.all([
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("team_id", perm.teamId).is("deleted_at", null),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("team_id", perm.teamId).eq("status", "draft").is("deleted_at", null),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("team_id", perm.teamId).eq("status", "sent").is("deleted_at", null),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("team_id", perm.teamId).eq("status", "paid").is("deleted_at", null),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("team_id", perm.teamId).eq("status", "overdue").is("deleted_at", null),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("team_id", perm.teamId).eq("status", "cancelled").is("deleted_at", null),
  ]);

  // List query
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total_ttc, paid_amount, issue_date, due_date, customer:customer_id(company_name, contact_name), currency:currency_id(symbol)",
      { count: "exact" }
    )
    .eq("team_id", perm.teamId)
    .is("deleted_at", null);

  if (status) query = query.eq("status", status);

  const { data: rawInvoices, count } = await query
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1);

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

  const filterSegments = [
    { value: "",          label: t("filter_all"),           href: ".",                count: totalCount ?? 0 },
    { value: "draft",     label: statusT("draft_plural"),   href: "?status=draft",    count: draftCount ?? 0 },
    { value: "sent",      label: statusT("sent_plural"),    href: "?status=sent",     count: sentCount ?? 0 },
    { value: "overdue",   label: statusT("overdue_plural"), href: "?status=overdue",  count: overdueCount ?? 0 },
    { value: "paid",      label: statusT("paid_plural"),    href: "?status=paid",     count: paidCount ?? 0 },
    { value: "cancelled", label: statusT("cancelled_plural"), href: "?status=cancelled", count: cancelledCount ?? 0 },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-wrap-balance">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle", { count: count ?? 0 })}
          </p>
        </div>
        <Button asChild>
          <Link href="./new">
            <Plus className="h-4 w-4" />
            {t("new_invoice")}
          </Link>
        </Button>
      </div>

      {/* Filter — Apple HIG segmented control */}
      <LinkSegmentedControl
        segments={filterSegments}
        value={status as "" | "draft" | "sent" | "paid" | "overdue" | "cancelled"}
      />

      <InvoicesListClient
        invoices={invoices}
        currentPage={page}
        totalPages={totalPages}
        baseUrl="."
        currentStatus={status}
      />
    </div>
  );
}
