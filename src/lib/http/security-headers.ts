/**
 * Centralized security headers, including Content-Security-Policy.
 *
 * Applied via:
 *   - middleware.ts          → covers all non-static, non-api routes (auth-aware)
 *   - next.config.ts headers() → universal coverage including /api/* responses
 *
 * Both call sites reference the same source of truth so header values never drift.
 *
 * CSP note: `'unsafe-inline'` + `'unsafe-eval''` in script-src are required for
 * Next.js (hydration, inline runtime, HMR in dev). This is the standard Next.js
 * CSP posture. connect-src whitelists the three external services this app calls
 * (Supabase, Resend, Stripe).
 */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8400"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    process.env.NODE_ENV === "development"
      ? "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.stripe.com http://localhost:8400 ws://localhost:8400"
      : "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

/**
 * Apply security headers to a Response/NextResponse. Used by middleware.
 */
export function setSecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}
