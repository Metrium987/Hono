import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// POST /api/v1/portal/auth — Request a magic link for portal login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, team_id } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Look up portal user by email
    const { data: portalUser, error: userError } = await supabase
      .from("portal_users")
      .select("id, customer_id, name, email, customer:customer_id!inner(team_id)")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (userError || !portalUser) {
      // Don't reveal whether the email exists or not — return 200 for security
      return NextResponse.json({
        success: true,
        message: "If this email is registered, a magic link has been sent.",
      });
    }

    const teamId = team_id ?? (Array.isArray(portalUser.customer)
      ? portalUser.customer[0]?.team_id
      : (portalUser.customer as Record<string, unknown>)?.team_id as string);

    if (!teamId) {
      return NextResponse.json({
        success: true,
        message: "If this email is registered, a magic link has been sent.",
      });
    }

    // Generate a secure random token
    const tokenBuffer = randomBytes(32);
    const token = tokenBuffer.toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    // Store the login token
    const { error: tokenError } = await supabase
      .from("portal_login_tokens")
      .insert({
        portal_user_id: portalUser.id,
        token,
        expires_at: expiresAt,
      });

    if (tokenError) {
      console.error("Failed to create portal login token:", tokenError);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Build magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    // Detect locale — fallback to fr
    const localeMatch = request.nextUrl.pathname.match(/\/([a-z]{2})\//);
    const locale = localeMatch?.[1] ?? "fr";
    const magicLink = `${baseUrl}/${locale}/portal/verify?token=${token}`;

    // Attempt to send email via Resend (if configured)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@votre-domaine.pf";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email.toLowerCase().trim(),
            subject: "Votre lien de connexion Hono",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Connexion à votre espace client</h2>
                <p>Bonjour ${portalUser.name ?? ""},</p>
                <p>Cliquez sur le lien ci-dessous pour vous connecter :</p>
                <a href="${magicLink}"
                   style="display: inline-block; background: #2563eb; color: white;
                          padding: 12px 24px; border-radius: 6px; text-decoration: none;
                          font-weight: bold; margin: 16px 0;">
                  Se connecter
                </a>
                <p style="color: #666; font-size: 14px;">
                  Ce lien expire dans 15 minutes.
                </p>
                <p style="color: #666; font-size: 12px;">
                  Si vous n'avez pas demandé cette connexion, ignorez cet email.
                </p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error("Failed to send portal magic link email:", emailError);
        // Don't fail — the token was created
      }
    } else {
      console.log(`[DEV] Portal magic link for ${email}: ${magicLink}`);
    }

    return NextResponse.json({
      success: true,
      message: "If this email is registered, a magic link has been sent.",
      // In development, return the link for convenience
      ...((process.env.NODE_ENV === "development" || !resendApiKey) && { devLink: magicLink }),
    });
  } catch (err) {
    console.error("Portal auth error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
