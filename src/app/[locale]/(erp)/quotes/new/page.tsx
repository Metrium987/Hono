import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { QuoteForm } from "../quote-form";

export default async function NewQuotePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations("quote_form");
  const common = await getTranslations("common");

  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  const [customersRes, currenciesRes, taxRatesRes] = await Promise.all([
    supabase.from("customers").select("id, company_name, contact_name, email").eq("team_id", teamId).order("contact_name"),
    supabase.from("currencies").select("id, code, symbol, symbol_position, is_default").eq("team_id", teamId),
    supabase.from("tax_rates").select("id, name, rate, is_active").eq("team_id", teamId),
  ]);

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
      />
    </div>
  );
}
