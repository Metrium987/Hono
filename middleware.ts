import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/utils/supabase/server-middleware";
import { setSecurityHeaders } from "@/lib/http/security-headers";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request);

  const response = intlMiddleware(request);

  setSecurityHeaders(response.headers);

  if (typeof supabaseResponse.headers.getSetCookie === "function") {
    for (const cookie of supabaseResponse.headers.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
  } else {
    const setCookieValue = supabaseResponse.headers.get("set-cookie");
    if (setCookieValue) {
      response.headers.append("set-cookie", setCookieValue);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except internal Next.js paths and static files
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)",
  ],
};
