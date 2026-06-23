import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { QuoteForm } from "../quote-form";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ customer_id?: string; subject?: string }>;

export default async function NewQuotePage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const perm = await checkPagePermission("quotes", "write");
  if (!perm.allowed) return <ForbiddenPage module="quotes" action="write" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("quote_form");
  const common = await getTranslations("common");

  const teamId = perm.teamId;
  if (!teamId) return <div>{common("no_team")}</div>;

  const [customersRes, currenciesRes, taxRatesRes] = await Promise.all([
    supabase.from("customers").select("id, company_name, contact_name, email").eq("team_id", teamId).order("contact_name"),
    supabase.from("currencies").select("id, code, symbol, symbol_position, is_default").eq("team_id", teamId),
    supabase.from("tax_rates").select("id, name, rate, is_active").eq("team_id", teamId),
  ]);

  const prefilledCustomerId = searchParams.customer_id ?? "";
  const prefilledSubject = searchParams.subject ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title_new")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle_new")}</p>
      </div>
      <QuoteForm
        customers={customersRes.data ?? []}
        currencies={currenciesRes.data ?? []}
        taxRates={taxRatesRes.data ?? []}
        teamId={teamId}
        initialData={{
          customer_id: prefilledCustomerId,
          notes: prefilledSubject,
        }}
      />
    </div>
  );
}
