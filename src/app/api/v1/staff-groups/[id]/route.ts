import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const { name, description, color, member_ids } = await request.json();

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description ?? null;
    if (color !== undefined) update.color = color;

    const { data, error } = await auth.supabase
      .from("staff_groups")
      .update(update)
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Replace members if provided
    if (Array.isArray(member_ids)) {
      await auth.supabase.from("staff_group_members").delete().eq("group_id", id);
      if (member_ids.length > 0) {
        await auth.supabase.from("staff_group_members").insert(
          member_ids.map((uid: string) => ({ group_id: id, user_id: uid }))
        );
      }
    }

    return NextResponse.json({ data });
  });
}

export async function DELETE(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const { error } = await auth.supabase
      .from("staff_groups")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
