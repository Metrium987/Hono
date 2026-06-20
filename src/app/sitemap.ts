import type { MetadataRoute } from "next";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://hono.pf";
  const teamId = process.env.NEXT_PUBLIC_DEFAULT_TEAM_ID;

  const static_pages: MetadataRoute.Sitemap = [
    { url: `${base}/fr`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/fr/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/fr/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/fr/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  if (!teamId) return static_pages;

  try {
    const admin = createAdminClient();
    const { data: products } = await admin
      .from("products")
      .select("id, updated_at")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .eq("is_published", true);

    const productPages: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
      url: `${base}/fr/products/${p.id}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...static_pages, ...productPages];
  } catch {
    return static_pages;
  }
}
