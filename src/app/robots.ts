import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://hono.pf";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/fr/products/", "/fr/products/*"],
        disallow: ["/portal/", "/api/", "/(erp)/", "/settings/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
