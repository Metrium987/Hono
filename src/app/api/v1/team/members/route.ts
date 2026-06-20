import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    const admin = createAdminClient();
    const { data: members } = await admin
      .from("team_members")
      .select("user_id, role_name, is_owner")
      .eq("team_id", teamId)
      .order("created_at");

    const userIds = (members ?? []).map((m) => m.user_id);
    if (!userIds.length) return NextResponse.json({ data: [] });

    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = (members ?? []).map((m) => {
      const u = userMap.get(m.user_id);
      const name = (u?.user_metadata?.full_name as string | undefined) ?? u?.email ?? m.user_id;
      return { id: m.user_id, email: u?.email ?? null, name, role_name: m.role_name, is_owner: m.is_owner };
    });

    return NextResponse.json({ data });
  });
}
