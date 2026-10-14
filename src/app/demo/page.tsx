import type { Metadata } from "next";
import Link from "next/link";
import { LeadSummary } from "@/components/LeadCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { labelsFor } from "@/engine/schema";
import { BRAND } from "@/lib/brand";
import { getLeads, ingestMeta } from "@/lib/cases";
import { STATES } from "@/lib/geo";
import { getVertical, isVerticalId, VERTICAL_IDS } from "@/verticals";

export const metadata: Metadata = { title: `Live demo · ${BRAND.name}` };
export const revalidate = 1800;

export default async function Demo({ searchParams }: PageProps<"/demo">) {
  const { state: rawState, vertical: rawVertical } = await searchParams;
  const state = typeof rawState === "string" && STATES[rawState.toUpperCase()] ? rawState.toUpperCase() : undefined;
  const vertical = getVertical(isVerticalId(rawVertical) ? rawVertical : undefined);
  const labels = labelsFor(vertical);
  const [leads, meta] = await Promise.all([getLeads(vertical, { areas: state ? [state] : [], days: 7 }), ingestMeta()]);
  const href = (v: string, s?: string) => `/demo?vertical=${v}${s ? `&state=${s}` : ""}`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold capitalize">{labels.noun.plural} this week</h1>
            <p className="text-muted">
              {leads.length.toLocaleString()} cases {state ? `in ${STATES[state]}` : "nationwide"} in the last 7 days, hottest first.
              {meta && ` Updated ${new Date(meta.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} from OSHA enforcement data.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-line bg-card p-1 text-sm">
              {VERTICAL_IDS.map((v) => (
                <Link key={v} href={href(v, state)} className={`rounded-md px-3 py-1.5 ${v === vertical.id ? "bg-foreground text-white" : "text-muted"}`}>
                  {v === "defense" ? "For law firms" : "For safety firms"}
                </Link>
              ))}
            </div>
            <form action="/demo" className="flex rounded-lg border border-line bg-card p-1 text-sm">
              <input type="hidden" name="vertical" value={vertical.id} />
              <select name="state" defaultValue={state ?? ""} className="bg-transparent px-2 py-1">
                <option value="">All states</option>
                {Object.entries(STATES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
              <button className="rounded-md bg-foreground px-3 py-1 text-white">Go</button>
            </form>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal/30 bg-signal/5 p-4">
          <p className="text-sm"><b>Employer names are hidden in the demo.</b> In the app you get names, sites, cited standards, OSHA links, AI-drafted outreach and pipeline tracking for your states.</p>
          <Link href={`/signup?vertical=${vertical.id}`} className="btn btn-signal px-4 py-2 text-sm">Start free trial</Link>
        </div>

        {leads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">No cases loaded yet. Check back after the next daily update.</p>
        ) : (
          <div className="divide-y divide-line rounded-2xl border border-line bg-card">
            {leads.slice(0, 40).map((l) => (
              <div key={l.id} className="p-5"><LeadSummary lead={l} labels={labels} masked /></div>
            ))}
          </div>
        )}
        {leads.length > 40 && <p className="mt-4 text-center text-sm text-muted">+ {leads.length - 40} more this week. <Link href={`/signup?vertical=${vertical.id}`} className="underline">Start your trial</Link> to see them all.</p>}
      </main>
      <SiteFooter />
    </>
  );
}
