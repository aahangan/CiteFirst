import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { STATES } from "@/lib/geo";
import { REPORT_DAYS, stateCounts, stateSlug } from "@/lib/report";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: `OSHA citations by state, last ${REPORT_DAYS} days · ${BRAND.name}`,
  description: `Recent OSHA inspections and citations in every U.S. state: counts, penalties, most cited standards and largest cases. Updated daily from OSHA enforcement data.`,
  alternates: { canonical: "/osha-citations" },
};

export default async function StatesIndex() {
  const counts = await stateCounts().catch(() => ({}) as Awaited<ReturnType<typeof stateCounts>>);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 pb-20">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold">OSHA citations by state</h1>
        <p className="mt-3 mb-8 text-lg text-muted">Employers cited and open OSHA investigations published in the last {REPORT_DAYS} days. Pick a state for penalties, most cited standards and the largest cases.</p>
        <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {Object.entries(STATES).map(([code, name]) => (
            <li key={code}>
              <Link href={`/osha-citations/${stateSlug(code)}`} className="flex justify-between rounded-lg border border-line bg-card px-4 py-2.5 hover:border-foreground/30">
                <span>{name}</span>
                <span className="text-sm text-muted">{counts[code]?.cited ?? 0} cited</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
