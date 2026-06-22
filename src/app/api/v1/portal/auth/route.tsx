import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
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

    const adminSupabase = createAdminClient();

    // Look up portal user by email using admin client (bypasses RLS since this is unauthenticated lookup)
    const { data: portalUser } = await adminSupabase
      .from("portal_users")
      .select("id, customer_id, name, email, auth_user_id, customer:customer_id!inner(team_id)")
      .eq("email", normalizedEmail)
      .single();

    const resolvedTeamId = team_id ?? process.env.NEXT_PUBLIC_DEFAULT_TEAM_ID ?? "";

    let effectivePortalUser = portalUser;

    if (!effectivePortalUser) {
      // Nouveau client : créer customer + portal_user
      if (!resolvedTeamId) {
        return NextResponse.json({ error: "Team not configured" }, { status: 500 });
      }

      const name = normalizedEmail.split("@")[0];

      const { data: newCustomer, error: customerErr } = await adminSupabase
        .from("customers")
        .insert({ team_id: resolvedTeamId, contact_name: name, email: normalizedEmail })
        .select("id")
        .single();

      if (customerErr || !newCustomer) {
        return NextResponse.json({
          success: true,
          message: "If this email is registered, a magic link has been sent.",
        });
      }

      const { data: newPortalUser } = await adminSupabase
        .from("portal_users")
        .insert({ customer_id: newCustomer.id, email: normalizedEmail, name })
        .select("id, customer_id, name, email, auth_user_id, customer:customer_id!inner(team_id)")
        .single();

      if (!newPortalUser) {
        return NextResponse.json({
          success: true,
          message: "If this email is registered, a magic link has been sent.",
        });
      }

      effectivePortalUser = newPortalUser as typeof portalUser;
    }

    const pu = effectivePortalUser!;
    const teamId = resolvedTeamId || (Array.isArray(pu.customer)
      ? pu.customer[0]?.team_id
      : (pu.customer as { team_id: string } | null)?.team_id);

    if (!teamId) {
      return NextResponse.json({
        success: true,
        message: "If this email is registered, a magic link has been sent.",
      });
    }

    // Create Supabase Auth user if not linked yet
    let authUserId = pu.auth_user_id;
    if (!authUserId) {
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { portal_user_id: pu.id, is_portal: true },
      });
      if (!createError && newUser?.user) {
        authUserId = newUser.user.id;
        await adminSupabase
          .from("portal_users")
          .update({ auth_user_id: authUserId })
          .eq("id", pu.id);
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
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@votre-domaine.pf";
      const localeMatch = request.nextUrl.pathname.match(/\/([a-z]{2})\//);
      const locale = localeMatch?.[1] ?? "fr";

      const subject = locale === "fr"
        ? "Votre lien de connexion Hono"
        : "Your Hono login link";

      /* eslint-disable react-hooks/error-boundaries */
      const emailElement = (
        <PortalMagicLinkEmail
          data={{
            customerName: pu.name ?? null,
            magicLink,
            locale,
          }}
        />
      );
      /* eslint-enable react-hooks/error-boundaries */

      (async () => {
        try {
          const resend = new Resend(resendApiKey);
          const html = await render(emailElement);
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
      })();
    } else {
      console.warn(`[DEV] Portal magic link would be sent to ${normalizedEmail} (no RESEND_API_KEY configured)`);
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
