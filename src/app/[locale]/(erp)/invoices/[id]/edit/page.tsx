import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { InvoiceForm } from "../../invoice-form";

type Params = Promise<{ id: string }>;

export default async function EditInvoicePage({ params }: { params: Params }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  const common = await getTranslations("common");
  const t = await getTranslations("invoice_form");

  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  // Fetch invoice + reference data in parallel
  const [invoiceRes, customersRes, currenciesRes, taxRatesRes, teamRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, items:invoice_items(*)")
      .eq("id", id)
      .eq("team_id", teamId)
      .single(),
    supabase.from("customers").select("id, company_name, contact_name, email").eq("team_id", teamId).order("contact_name"),
    supabase.from("currencies").select("id, code, symbol, symbol_position, is_default").eq("team_id", teamId),
    supabase.from("tax_rates").select("id, name, rate, is_active").eq("team_id", teamId),
    supabase.from("teams").select("id, invoice_prefix, late_fee_fixed").eq("id", teamId).single(),
  ]);

  if (invoiceRes.error) notFound();

  const invoice = invoiceRes.data;

  const initialData = {
    customer_id: invoice.customer_id,
    issue_date: invoice.issue_date,
    service_date: invoice.service_date ?? "",
    due_date: invoice.due_date,
    currency_id: invoice.currency_id,
    late_fee_fixed: invoice.late_fee_fixed ?? 5000,
    notes: invoice.notes ?? "",
    message: invoice.message ?? "",
    items: (invoice.items ?? []).map((item: { description: string; quantity: number; unit_price_ht: number; tax_rate_id: string | null }) => ({
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
        <h1 className="text-2xl font-bold tracking-tight">{t("title_edit")}</h1>
      </div>
      <InvoiceForm
        customers={customersRes.data ?? []}
        currencies={currenciesRes.data ?? []}
        taxRates={taxRatesRes.data ?? []}
        team={teamRes.data ?? { id: teamId, invoice_prefix: "FAC-", late_fee_fixed: 5000 }}
        teamId={teamId}
        editId={id}
        initialData={initialData}
      />
    </div>
  );
}
