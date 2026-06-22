import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { DeleteRequestsClient } from "./delete-requests-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function DeleteRequestsPage() {
  const perm = await checkPagePermission("settings", "read");
  if (!perm.allowed) return <ForbiddenPage module="settings" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;
  const isOwner = perm.isOwner;
  if (!teamId) notFound();

  if (!isOwner) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Accès réservé au propriétaire du compte.
      </div>
    );
  }

  const { data: requests } = await supabase
    .from("delete_requests")
    .select("id, table_name, record_id, reason, status, review_notes, reviewed_at, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  return <DeleteRequestsClient initialData={requests ?? []} teamId={teamId} />;
}
