import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

type Params = Promise<{ token: string }>;

// GET /api/v1/invitations/[token] — Check invitation validity
export async function GET(request: NextRequest, props: { params: Params }) {
  const { token } = await props.params;
  const cookieStore = await cookies();
  const sb = createClient(cookieStore);

  const { data: invitation } = await sb
    .from("company_invitations")
    .select(`
      id, email, role_id, is_owner, expires_at, accepted_at, created_at,
      team:team_id(id, name),
      role:role_id(id, name, permissions)
    `)
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!invitation) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  return NextResponse.json({ data: invitation });
}

// POST /api/v1/invitations/[token] — Accept invitation
export async function POST(request: NextRequest, props: { params: Params }) {
  const { token } = await props.params;
  const body = await request.json();
  const { action } = body;

  if (action !== "accept") {
    return NextResponse.json({ error: "Invalid action. Use 'accept'." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sb = createClient(cookieStore);

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: invitation } = await sb
    .from("company_invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!invitation) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  if (invitation.email !== user.email) {
    return NextResponse.json({ error: "This invitation was sent to a different email address" }, { status: 403 });
  }

  const { error: memberError } = await sb
    .from("team_members")
    .insert({
      team_id: invitation.team_id,
      user_id: user.id,
      role_id: invitation.role_id,
      is_owner: invitation.is_owner,
    });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  await sb
    .from("company_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return NextResponse.json({ success: true, team_id: invitation.team_id });
}

// DELETE /api/v1/invitations/[token] — Reject/cancel invitation
export async function DELETE(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const { token } = await props.params;

    const { error } = await auth.supabase
      .from("company_invitations")
      .delete()
      .eq("token", token)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
