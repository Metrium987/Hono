import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditNotesListClient, type CreditNoteRow } from "./credit-notes-list-client";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function CreditNotesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const t = await getTranslations("credit_notes_page");
  const common = await getTranslations("common");
  const statusT = await getTranslations("credit_note_status");

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

  let query = supabase
    .from("credit_notes")
    .select("id, credit_note_number, status, total_ttc, issue_date, reason, customer:customer_id(company_name, contact_name), currency:currency_id(symbol)", { count: "exact" })
    .eq("team_id", teamId);

  if (status) {
    query = query.eq("status", status);
  }

  const { data: rawCreditNotes, count } = await query
    .order("issue_date", { ascending: false })
    .range(offset, offset + limit - 1);

  type RawCreditNote = {
    id: string; credit_note_number: string; status: string;
    total_ttc: number; issue_date: string; reason: string | null;
    customer: { company_name: string | null; contact_name: string }[] | null;
    currency: { symbol: string }[] | null;
  };

  const creditNotes: CreditNoteRow[] = ((rawCreditNotes ?? []) as RawCreditNote[]).map((cn) => ({
    id: cn.id,
    credit_note_number: cn.credit_note_number,
    status: cn.status,
    total_ttc: cn.total_ttc,
    issue_date: cn.issue_date,
    reason: cn.reason,
    customer: Array.isArray(cn.customer) ? (cn.customer[0] ?? null) : (cn.customer ?? null),
    currency: Array.isArray(cn.currency) ? (cn.currency[0] ?? null) : (cn.currency ?? null),
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
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "draft", "issued", "applied", "cancelled"].map((s) => {
          const label = s === "" ? t("filter_all") : statusT(`${s}_plural` as keyof typeof statusT);
          const href = s ? `?status=${s}` : ".";
          return (
            <Link key={s} href={href}>
              <Button variant={status === s ? "default" : "outline"} size="sm">
                {label}
              </Button>
            </Link>
          );
        })}
      </div>

      <CreditNotesListClient
        creditNotes={creditNotes ?? []}
        currentPage={page}
        totalPages={totalPages}
        baseUrl="."
        currentStatus={status}
      />
    </div>
  );
}
