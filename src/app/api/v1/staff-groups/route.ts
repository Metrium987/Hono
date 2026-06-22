import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "read");
    const { data, error } = await auth.supabase
      .from("staff_groups")
      .select("*, member_count:staff_group_members(count)")
      .eq("team_id", teamId)
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const { name, description, color, member_ids } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "name requis" }, { status: 400 });

    const { data: group, error } = await auth.supabase
      .from("staff_groups")
      .insert({ team_id: teamId, name: name.trim(), description: description ?? null, color: color ?? "#6366f1" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (Array.isArray(member_ids) && member_ids.length > 0) {
      await auth.supabase.from("staff_group_members").insert(
        member_ids.map((uid: string) => ({ group_id: group.id, user_id: uid }))
      );
    }

    return NextResponse.json({ data: group }, { status: 201 });
  });
}
