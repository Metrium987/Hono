import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/utils/supabase/server-middleware";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Step 1: Refresh Supabase auth session (mutates request cookies in place)
  const supabaseResponse = await updateSession(request);

  // Step 2: Run next-intl locale routing (handles / → /fr redirects etc.)
  const response = intlMiddleware(request);

  // Step 3: Merge Supabase session cookies into the final response.
  // getSetCookie() preserves all cookie attributes (HttpOnly, Secure, Path, SameSite)
  // that would be lost if we used response.cookies.set() directly.
  // This works correctly even when response is a redirect (30x) — browsers
  // process Set-Cookie headers on redirect responses.
  for (const cookie of supabaseResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except internal Next.js paths and static files
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)",
  ],
};
