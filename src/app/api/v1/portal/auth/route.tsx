import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { PortalMagicLinkEmail } from "@/lib/email/portal-magic-link-email";

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
    const rateResult = await rateLimit(rateKey, RATE_LIMIT_CONFIGS.MAGIC_LINK);
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
      : (portalUser.customer as { team_id: string })?.team_id);

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

    // Send email via Resend (SDK + React Email component)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@votre-domaine.pf";
        const localeMatch = request.nextUrl.pathname.match(/\/([a-z]{2})\//);
        const locale = localeMatch?.[1] ?? "fr";

        const subject = locale === "fr"
          ? "Votre lien de connexion Hono"
          : "Your Hono login link";

        const resend = new Resend(resendApiKey);
        const html = await render(
          <PortalMagicLinkEmail
            data={{
              customerName: portalUser.name ?? null,
              magicLink,
              locale,
            }}
          />
        );

        const { error: sendError } = await resend.emails.send({
          from: fromEmail,
          to: normalizedEmail,
          subject,
          html,
        });
        if (sendError) {
          console.error("Resend rejected portal magic link email:", sendError);
        }
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
