import type { MetadataRoute } from "next";
import { STATES } from "@/lib/geo";
import { stateSlug, stateTopics } from "@/lib/report";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getcitefirst.com";

// Topic pages come and go with the data, so build this per request from the cached topic list.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const topics = await stateTopics().catch(() => ({}) as Record<string, string[]>);
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/demo`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/osha-citations`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...Object.keys(STATES).flatMap((code) => [
      { url: `${base}/osha-citations/${stateSlug(code)}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 },
      ...(topics[code] ?? []).map((t) => ({ url: `${base}/osha-citations/${stateSlug(code)}/${t}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.6 })),
    ]),
  ];
}
