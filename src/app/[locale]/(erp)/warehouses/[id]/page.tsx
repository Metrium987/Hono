import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";
import { WarehouseDetailClient } from "./warehouse-detail-client";

type Params = Promise<{ locale: string; id: string }>;

export default async function WarehouseDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const perm = await checkPagePermission("inventory", "read");
  if (!perm.allowed) return <ForbiddenPage module="inventory" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [{ data: warehouse }, { data: locations }, { data: counts }] = await Promise.all([
    supabase
      .from("warehouses")
      .select("id, name, type, location, is_active")
      .eq("id", id)
      .eq("team_id", perm.teamId)
      .single(),
    supabase
      .from("warehouse_locations")
      .select("id, code, description, is_active")
      .eq("warehouse_id", id)
      .eq("team_id", perm.teamId)
      .order("code", { ascending: true }),
    supabase
      .from("inventory_count")
      .select("id, status, created_at, completed_at")
      .eq("warehouse_id", id)
      .eq("team_id", perm.teamId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!warehouse) notFound();

  return (
    <WarehouseDetailClient
      teamId={perm.teamId}
      warehouse={warehouse}
      initialLocations={locations ?? []}
      recentCounts={counts ?? []}
    />
  );
}
