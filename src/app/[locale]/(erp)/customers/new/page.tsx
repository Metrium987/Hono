import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { CustomerForm } from "../_components/customer-form";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function NewCustomerPage() {
  const perm = await checkPagePermission("clients", "write");
  if (!perm.allowed) return <ForbiddenPage module="clients" action="write" />;

  const common = await getTranslations("common");
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  return <CustomerForm teamId={teamId} backHref="../customers" />;
}
