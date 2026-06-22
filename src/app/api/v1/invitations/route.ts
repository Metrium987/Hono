import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { Resend } from "resend";
import { randomBytes } from "crypto";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// DELETE /api/v1/invitations — Cancel a pending invitation by ID
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const url = new URL(request.url);
    const id = url.searchParams.get("invitation_id");
    if (!id) return NextResponse.json({ error: "invitation_id requis" }, { status: 400 });

    const { error } = await auth.supabase
      .from("company_invitations")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}

// GET /api/v1/invitations — List pending invitations for the team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "read");

    const { data, error } = await auth.supabase
      .from("company_invitations")
      .select("id, email, is_owner, expires_at, accepted_at, created_at, role:role_id(id, name)")
      .eq("team_id", teamId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}

// POST /api/v1/invitations — Create and send a team invitation
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");

    const body = await request.json();
    const { email, role_id } = body;

    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

    // Check email is not already a member (use admin to bypass RLS on users table)
    const adminForCheck = (await import("@/utils/supabase/admin")).createAdminClient();
    const { data: existingMember } = await adminForCheck
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingMember) {
      const { data: alreadyMember } = await adminForCheck
        .from("team_members")
        .select("team_id")
        .eq("team_id", teamId)
        .eq("user_id", existingMember.id)
        .single();

      if (alreadyMember) {
        return NextResponse.json({ error: "Cet utilisateur est déjà membre de l'équipe" }, { status: 409 });
      }
    }

    // Get team name for the email
    const { data: team } = await auth.supabase
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .single();

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(); // 7 days

    const { data: invitation, error: invError } = await auth.supabase
      .from("company_invitations")
      .insert({
        team_id: teamId,
        email,
        role_id: role_id ?? null,
        token,
        expires_at: expiresAt,
        is_owner: false,
      })
      .select("id, email, token")
      .single();

    if (invError || !invitation) {
      return NextResponse.json({ error: invError?.message ?? "Failed to create invitation" }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/fr/invitations/${token}`;
    const teamName = team?.name ?? "Hono ERP";

    if (resend) {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@hono.pf",
        to: [email],
        subject: `Invitation à rejoindre ${teamName}`,
        html: `
          <p>Bonjour,</p>
          <p>Vous avez été invité(e) à rejoindre l'espace <strong>${teamName}</strong> sur Hono ERP.</p>
          <p>
            <a href="${inviteUrl}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
              Accepter l'invitation
            </a>
          </p>
          <p style="color:#6b7280;font-size:12px;">Ce lien expire dans 7 jours. Si vous n'attendiez pas cette invitation, ignorez cet email.</p>
        `,
      });
    }

    return NextResponse.json({ data: { id: invitation.id, email: invitation.email } }, { status: 201 });
  });
}
