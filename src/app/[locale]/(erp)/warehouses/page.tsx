import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";
import { WarehousesClient } from "./warehouses-client";

export default async function WarehousesPage() {
  const perm = await checkPagePermission("inventory", "read");
  if (!perm.allowed) return <ForbiddenPage module="inventory" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name, type, location, is_active, created_at")
    .eq("team_id", perm.teamId)
    .order("name", { ascending: true });

  return <WarehousesClient teamId={perm.teamId} initialWarehouses={warehouses ?? []} />;
}
