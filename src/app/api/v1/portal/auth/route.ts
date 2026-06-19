import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

// POST /api/v1/portal/auth — Send a Supabase Auth magic link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, team_id } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();

    const rateKey = `magic_link:${normalizedEmail}`;
    const rateResult = rateLimit(rateKey, RATE_LIMIT_CONFIGS.MAGIC_LINK);
    if (!rateResult.allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const adminSupabase = createAdminClient();

    // Look up portal user by email
    const { data: portalUser } = await supabase
      .from("portal_users")
      .select("id, customer_id, name, email, auth_user_id, customer:customer_id!inner(team_id)")
      .eq("email", normalizedEmail)
      .single();

    if (!portalUser) {
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

    // Create Supabase Auth user if not linked yet
    let authUserId = portalUser.auth_user_id;
    if (!authUserId) {
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { portal_user_id: portalUser.id, is_portal: true },
      });
      if (!createError && newUser?.user) {
        authUserId = newUser.user.id;
        await supabase
          .from("portal_users")
          .update({ auth_user_id: authUserId })
          .eq("id", portalUser.id);
      }
    }

    // Generate magic link via Supabase Auth admin API
    // Reuses the existing /auth/callback route for PKCE code exchange
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectTo = `${baseUrl}/auth/callback?next=/portal/dashboard`;

    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (linkError || !linkData) {
      console.error("Failed to generate magic link:", linkError);
      return NextResponse.json({
        success: true,
        message: "If this email is registered, a magic link has been sent.",
      });
    }

    const magicLink = linkData.properties?.action_link ?? "";

    // Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@votre-domaine.pf";
        const localeMatch = request.nextUrl.pathname.match(/\/([a-z]{2})\//);
        const locale = localeMatch?.[1] ?? "fr";

        const subject = locale === "fr"
          ? "Votre lien de connexion Hono"
          : "Your Hono login link";

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: normalizedEmail,
            subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>${locale === "fr" ? "Connexion à votre espace client" : "Log in to your client area"}</h2>
                <p>${locale === "fr" ? "Bonjour" : "Hello"} ${portalUser.name ?? ""},</p>
                <p>${locale === "fr" ? "Cliquez sur le lien ci-dessous pour vous connecter :" : "Click the link below to log in:"}</p>
                <a href="${magicLink}"
                   style="display: inline-block; background: #2563eb; color: white;
                          padding: 12px 24px; border-radius: 6px; text-decoration: none;
                          font-weight: bold; margin: 16px 0;">
                  ${locale === "fr" ? "Se connecter" : "Log in"}
                </a>
                <p style="color: #666; font-size: 14px;">
                  ${locale === "fr" ? "Ce lien expire dans 15 minutes." : "This link expires in 15 minutes."}
                </p>
                <p style="color: #666; font-size: 12px;">
                  ${locale === "fr"
                    ? "Si vous n'avez pas demandé cette connexion, ignorez cet email."
                    : "If you did not request this login, ignore this email."}
                </p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error("Failed to send portal magic link email:", emailError);
      }
    } else {
      console.log(`[DEV] Portal magic link for ${normalizedEmail}: ${magicLink}`);
    }

    return NextResponse.json({
      success: true,
      message: "If this email is registered, a magic link has been sent.",
      ...((process.env.NODE_ENV === "development" || !resendApiKey) && { devLink: magicLink }),
    });
  } catch (err) {
    console.error("Portal auth error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
