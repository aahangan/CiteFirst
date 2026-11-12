import type { MetadataRoute } from "next";
import { STATES } from "@/lib/geo";
import { stateSlug } from "@/lib/report";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getcitefirst.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/demo`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/osha-citations`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...Object.keys(STATES).map((code) => ({ url: `${base}/osha-citations/${stateSlug(code)}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
