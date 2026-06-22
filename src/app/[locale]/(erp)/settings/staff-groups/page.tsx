import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffGroupsClient, type StaffGroupRow, type MemberRow } from "./staff-groups-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function StaffGroupsPage() {
  const perm = await checkPagePermission("settings", "read");
  if (!perm.allowed) return <ForbiddenPage module="settings" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const admin = createAdminClient();

  const [groupsRes, teamMembersRes, { data: { users: authUsers } }] = await Promise.all([
    admin
      .from("staff_groups")
      .select("*, member_count:staff_group_members(count), members:staff_group_members(user_id)")
      .eq("team_id", teamId)
      .order("name"),
    admin
      .from("team_members")
      .select("user_id, role_name")
      .eq("team_id", teamId),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const userMap = new Map(authUsers.map(u => [u.id, u]));

  const members: MemberRow[] = (teamMembersRes.data ?? []).map(m => {
    const u = userMap.get(m.user_id);
    return {
      id: m.user_id,
      name: (u?.user_metadata?.full_name as string | undefined) ?? u?.email ?? m.user_id,
      email: u?.email ?? null,
    };
  });

  const groups: StaffGroupRow[] = (groupsRes.data ?? []).map((g: Record<string, unknown>) => ({
    id: g.id as string,
    name: g.name as string,
    color: g.color as string,
    description: (g.description as string | null) ?? null,
    member_count: (g.member_count as Array<{ count: number }>)?.[0]?.count ?? 0,
  }));

  const groupMembers: Record<string, string[]> = {};
  for (const g of (groupsRes.data ?? [])) {
    const raw = g as Record<string, unknown>;
    const mems = raw.members as Array<{ user_id: string }> | null;
    groupMembers[raw.id as string] = (mems ?? []).map(m => m.user_id);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../settings"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Groupes staff</h1>
          <p className="text-sm text-muted-foreground">Organisez votre équipe en groupes pour l&apos;agenda</p>
        </div>
      </div>

      <StaffGroupsClient
        initialGroups={groups}
        members={members}
        groupMembers={groupMembers}
        teamId={teamId}
      />
    </div>
  );
}
