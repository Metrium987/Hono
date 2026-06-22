import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { createAdminClient } from "@/utils/supabase/admin";

type Params = Promise<{ userId: string }>;

// PATCH /api/v1/team/members/[userId] — Change role (owner only)
export async function PATCH(request: NextRequest, props: { params: Params }) {
  const { userId } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    if (!auth.isOwner) {
      return NextResponse.json({ error: "Réservé au propriétaire du compte" }, { status: 403 });
    }

    const { role_id } = await request.json();
    const admin = createAdminClient();

    // Prevent owner from changing their own role
    if (userId === auth.userId) {
      return NextResponse.json({ error: "Vous ne pouvez pas modifier votre propre rôle" }, { status: 400 });
    }

    // Prevent changing an owner's role
    const { data: target } = await admin
      .from("team_members")
      .select("is_owner")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    if (target?.is_owner) {
      return NextResponse.json({ error: "Impossible de modifier le rôle d'un propriétaire" }, { status: 400 });
    }

    const { error } = await admin
      .from("team_members")
      .update({ role_id: role_id ?? null })
      .eq("team_id", teamId)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}

// DELETE /api/v1/team/members/[userId] — Remove a member (owner only)
export async function DELETE(request: NextRequest, props: { params: Params }) {
  const { userId } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    if (!auth.isOwner) {
      return NextResponse.json({ error: "Réservé au propriétaire du compte" }, { status: 403 });
    }

    if (userId === auth.userId) {
      return NextResponse.json({ error: "Vous ne pouvez pas vous retirer vous-même" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: target } = await admin
      .from("team_members")
      .select("is_owner")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    if (target?.is_owner) {
      return NextResponse.json({ error: "Impossible de retirer un propriétaire" }, { status: 400 });
    }

    const { error } = await admin
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
