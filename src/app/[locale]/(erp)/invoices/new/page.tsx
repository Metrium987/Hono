import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { InvoiceForm } from "../invoice-form";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function NewInvoicePage() {
  const perm = await checkPagePermission("invoices", "write");
  if (!perm.allowed) return <ForbiddenPage module="invoices" action="write" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("invoice_form");
  const common = await getTranslations("common");

  const teamId = perm.teamId;

  // Fetch reference data
  const [customersRes, currenciesRes, taxRatesRes, teamRes] = await Promise.all([
    supabase.from("customers").select("id, company_name, contact_name, email").eq("team_id", teamId).order("contact_name"),
    supabase.from("currencies").select("id, code, symbol, symbol_position, is_default").eq("team_id", teamId),
    supabase.from("tax_rates").select("id, name, rate, is_active").eq("team_id", teamId),
    supabase.from("teams").select("id, invoice_prefix, late_fee_fixed").eq("id", teamId).single(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title_new")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle_new")}
        </p>
      </div>

      <InvoiceForm
        customers={customersRes.data ?? []}
        currencies={currenciesRes.data ?? []}
        taxRates={taxRatesRes.data ?? []}
        team={teamRes.data ?? { id: teamId, invoice_prefix: "FAC-", late_fee_fixed: 5000 }}
        teamId={teamId}
      />
    </div>
  );
}
