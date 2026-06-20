import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CustomerForm } from "../../_components/customer-form";

type Params = Promise<{ id: string }>;

export default async function EditCustomerPage(props: { params: Params }) {
  const { id } = await props.params;
  const common = await getTranslations("common");
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

  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (error || !customer) notFound();

  return (
    <CustomerForm
      teamId={teamId}
      customerId={id}
      backHref={`../../customers/${id}`}
      initialData={{
        contact_name: customer.contact_name ?? "",
        company_name: customer.company_name ?? "",
        is_b2b: customer.is_b2b ?? false,
        n_tahiti: customer.n_tahiti ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        address_line1: customer.address_line1 ?? "",
        address_line2: customer.address_line2 ?? "",
        city: customer.city ?? "",
        island: customer.island ?? "",
        postal_code: customer.postal_code ?? "",
        portal_enabled: customer.portal_enabled ?? false,
        payment_terms: customer.payment_terms ?? 30,
        notes: customer.notes ?? "",
      }}
    />
  );
}
