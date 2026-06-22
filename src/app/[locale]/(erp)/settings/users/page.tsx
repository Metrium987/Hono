import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { notFound } from "next/navigation";
import { InviteForm } from "./invite-form";
import { UsersClient, type MemberRow, type PendingRow, type RoleOption } from "./users-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function UsersPage() {
  const perm = await checkPagePermission("settings", "read");
  if (!perm.allowed) return <ForbiddenPage module="settings" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;
  const isOwner = perm.isOwner;

  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? "";

  if (!teamId) notFound();
  if (!isOwner) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Accès réservé au propriétaire du compte.
      </div>
    );
  }

  const admin = createAdminClient();

  const [teamMembersRes, pendingRes, rolesRes, { data: { users: authUsers } }] = await Promise.all([
    admin
      .from("team_members")
      .select("user_id, is_owner, created_at, role_id, role:role_id(name)")
      .eq("team_id", teamId)
      .order("created_at"),
    admin
      .from("company_invitations")
      .select("id, email, created_at, expires_at, role:role_id(name)")
      .eq("team_id", teamId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("team_roles")
      .select("id, name")
      .eq("team_id", teamId)
      .order("name"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const userMap = new Map(authUsers.map(u => [u.id, u]));

  const members: MemberRow[] = (teamMembersRes.data ?? []).map(m => {
    const u = userMap.get(m.user_id);
    const role = Array.isArray(m.role) ? m.role[0] : m.role;
    return {
      user_id: m.user_id,
      is_owner: m.is_owner,
      created_at: m.created_at,
      role_id: m.role_id ?? null,
      role_name: (role as { name?: string } | null)?.name ?? null,
      name: (u?.user_metadata?.full_name as string | undefined) ?? u?.email ?? m.user_id,
      email: u?.email ?? "—",
    };
  });

  const pending: PendingRow[] = (pendingRes.data ?? []).map(inv => {
    const role = Array.isArray(inv.role) ? inv.role[0] : inv.role;
    return {
      id: inv.id,
      email: inv.email,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      role_name: (role as { name?: string } | null)?.name ?? null,
    };
  });

  const roles: RoleOption[] = rolesRes.data ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les membres de votre équipe et leurs rôles.
          </p>
        </div>
        <InviteForm teamId={teamId} roles={roles} />
      </div>

      <UsersClient
        initialMembers={members}
        initialPending={pending}
        roles={roles}
        teamId={teamId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
