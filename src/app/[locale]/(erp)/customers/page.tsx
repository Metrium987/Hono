import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomersListClient, type CustomerRow } from "./customers-list-client";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function CustomersPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const t = await getTranslations("customers_page");
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

  const { data: customers, count } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, email, phone, n_tahiti, portal_enabled, city", { count: "exact" })
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const customerRows: CustomerRow[] = (customers ?? []).map((c) => ({
    id: c.id,
    company_name: c.company_name,
    contact_name: c.contact_name,
    email: c.email,
    phone: c.phone,
    n_tahiti: c.n_tahiti,
    portal_enabled: c.portal_enabled,
    city: c.city,
  }));

  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle", { count: count ?? 0 })}</p>
        </div>
        <Button asChild>
          <Link href="customers/new"><Plus className="mr-2 h-4 w-4" />{t("new")}</Link>
        </Button>
      </div>
      <CustomersListClient customers={customerRows} currentPage={page} totalPages={totalPages} baseUrl="." />
    </div>
  );
}
