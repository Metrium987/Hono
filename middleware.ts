import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/utils/supabase/server-middleware";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Step 1: Run Supabase SSR session refresh first
  const supabaseResponse = await updateSession(request);

  // Step 2: Run next-intl locale routing (uses the refreshed request)
  const intlResponse = intlMiddleware(request);

  // Step 3: Forward Supabase session cookies through the intl response
  const supabaseCookies = supabaseResponse.headers.getSetCookie();
  for (const cookie of supabaseCookies) {
    intlResponse.headers.append("set-cookie", cookie);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Skip internal paths and static files
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)",
  ],
};
