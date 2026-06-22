import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";
import { InventoryCountDetailClient } from "./inventory-count-detail-client";

type Params = Promise<{ locale: string; id: string }>;

export default async function InventoryCountDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const perm = await checkPagePermission("inventory", "read");
  if (!perm.allowed) return <ForbiddenPage module="inventory" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: count, error } = await supabase
    .from("inventory_count")
    .select(`
      id, status, notes, created_at,
      warehouse:warehouse_id(id, name, type),
      items:inventory_count_item(
        id, product_id, system_qty, counted_qty, difference, notes,
        product:product_id(id, name, sku, current_stock)
      )
    `)
    .eq("id", id)
    .eq("team_id", perm.teamId)
    .single();

  if (error || !count) notFound();

  return (
    <InventoryCountDetailClient
      teamId={perm.teamId}
      count={count as any}
    />
  );
}
