import { NextRequest, NextResponse } from "next/server";
import { clearPortalSessionCookie } from "@/lib/portal/session";

// POST /api/v1/portal/logout — Clear portal session cookie and redirect to auth
export async function POST(_request: NextRequest) {
  const headers = new Headers();
  
  // Clear the portal session cookie
  headers.append(
    "Set-Cookie",
    `hono_portal=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );

  // Redirect to portal auth page
  // Derive locale from Referer header or default to fr
  const referer = _request.headers.get("referer") ?? "";
  const localeMatch = referer.match(/\/([a-z]{2})\//);
  const locale = localeMatch?.[1] ?? "fr";

  const redirectUrl = `/${locale}/portal/auth`;
  headers.set("Location", redirectUrl);

  return NextResponse.redirect(redirectUrl, {
    status: 302,
    headers,
  });
}
