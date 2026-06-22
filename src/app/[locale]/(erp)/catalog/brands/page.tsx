import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";
import { BrandsClient } from "./brands-client";

export default async function BrandsPage() {
  const perm = await checkPagePermission("catalog", "read");
  if (!perm.allowed) return <ForbiddenPage module="catalog" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url, created_at")
    .eq("team_id", perm.teamId)
    .order("name", { ascending: true });

  return (
    <BrandsClient
      teamId={perm.teamId}
      initialBrands={brands ?? []}
    />
  );
}
