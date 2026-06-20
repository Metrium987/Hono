import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { SECURITY_HEADERS } from "@/lib/http/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Universal security headers. The middleware sets these on auth-aware pages
  // but its matcher excludes /api/* and static assets, so this headers() block
  // closes the gap. Both reference the same SECURITY_HEADERS constant to avoid drift.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
