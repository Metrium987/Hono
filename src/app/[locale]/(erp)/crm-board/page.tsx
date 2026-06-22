import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { CrmBoardClient, type CustomerCard } from "./crm-board-client";

export default async function CrmBoardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) redirect("/onboarding");

  const { data } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, customer_type, email, phone")
    .eq("team_id", teamId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const customers: CustomerCard[] = (data ?? []).map(c => ({
    id: c.id,
    name: c.company_name ?? c.contact_name,
    email: c.email ?? null,
    customer_type: c.customer_type ?? null,
  }));

  return <CrmBoardClient customers={customers} teamId={teamId} />;
}
