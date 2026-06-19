import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type PortalSession = {
  portalUserId: string;
  customerId: string;
  email: string;
  name: string | null;
  teamId: string;
};

export async function getPortalSession(): Promise<PortalSession | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: authUser, error } = await supabase.auth.getUser();
    if (error || !authUser?.user) return null;

    const { data: portalUser } = await supabase
      .from("portal_users")
      .select("id, customer_id, email, name, customer:customer_id!inner(team_id)")
      .eq("auth_user_id", authUser.user.id)
      .single();

    if (!portalUser) return null;

    const customer = Array.isArray(portalUser.customer)
      ? portalUser.customer[0]
      : portalUser.customer;

    return {
      portalUserId: portalUser.id,
      customerId: portalUser.customer_id,
      email: portalUser.email,
      name: portalUser.name,
      teamId: customer.team_id,
    };
  } catch {
    return null;
  }
}

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    throw new Error("No portal session");
  }
  return session;
}
