import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";
import ContainerDetailClient, { type Container } from "./container-detail-client";

type Params = Promise<{ locale: string; id: string }>;

export default async function ContainerDetailPage({ params }: { params: Params }) {
  const { locale, id } = await params;

  const perm = await checkPagePermission("inventory", "read");
  if (!perm.allowed) return <ForbiddenPage module="inventory" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [{ data: container }, { data: vendors }] = await Promise.all([
    supabase
      .from("containers")
      .select(`
        id, container_number, status, arrival_date, cost_fob, notes,
        vendor:vendor_id(id, name),
        items:container_items(
          id, original_name, quantity_expected, quantity_received, unit_cost, is_matched, product_id,
          product:product_id(id, name, sku, current_stock)
        ),
        documents:container_documents(id, document_type, file_name, file_url)
      `)
      .eq("id", id)
      .eq("team_id", perm.teamId)
      .single(),
    supabase
      .from("vendors")
      .select("id, name")
      .eq("team_id", perm.teamId)
      .order("name"),
  ]);

  if (!container) notFound();

  return (
    <ContainerDetailClient
      container={container as unknown as Container}
      vendors={vendors ?? []}
      teamId={perm.teamId}
      locale={locale}
    />
  );
}
