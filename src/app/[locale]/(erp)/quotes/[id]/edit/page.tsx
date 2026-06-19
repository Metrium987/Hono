import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { QuoteForm } from "../../quote-form";

type Params = Promise<{ id: string }>;

export default async function EditQuotePage({ params }: { params: Params }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  const common = await getTranslations("common");

  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  const [quoteRes, customersRes, currenciesRes, taxRatesRes] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, items:quote_items(*)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single(),
    supabase.from("customers").select("id, company_name, contact_name, email").eq("team_id", teamId).order("contact_name"),
    supabase.from("currencies").select("id, code, symbol, symbol_position, is_default").eq("team_id", teamId),
    supabase.from("tax_rates").select("id, name, rate, is_active").eq("team_id", teamId),
  ]);

  if (quoteRes.error) notFound();

  const quote = quoteRes.data;

  const initialData = {
    customer_id: quote.customer_id,
    issue_date: quote.issue_date,
    validity_date: quote.validity_date ?? "",
    currency_id: quote.currency_id,
    notes: quote.notes ?? "",
    items: (quote.items ?? []).map((item: { description: string; quantity: number; unit_price_ht: number; tax_rate_id: string | null }) => ({
      key: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: item.description,
      quantity: item.quantity.toString(),
      unit_price_ht: item.unit_price_ht.toString(),
      tax_rate_id: item.tax_rate_id ?? "",
    })),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modifier le devis</h1>
      </div>
      <QuoteForm
        customers={customersRes.data ?? []}
        currencies={currenciesRes.data ?? []}
        taxRates={taxRatesRes.data ?? []}
        teamId={teamId}
        editId={id}
        initialData={initialData}
      />
    </div>
  );
}
