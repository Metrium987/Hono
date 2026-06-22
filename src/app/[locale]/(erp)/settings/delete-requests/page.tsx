import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { DeleteRequestsClient } from "./delete-requests-client";

export default async function DeleteRequestsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: memberships } = await supabase
    .from("team_members").select("team_id, is_owner").eq("user_id", user.id).limit(1);
  const teamId = memberships?.[0]?.team_id;
  const isOwner = memberships?.[0]?.is_owner ?? false;
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
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  return <DeleteRequestsClient initialData={requests ?? []} teamId={teamId} />;
}
