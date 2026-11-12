import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadSummary } from "@/components/LeadCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { labelsFor } from "@/engine/schema";
import { BRAND, PLAN, TRIAL_DAYS } from "@/lib/brand";
import { ingestMeta } from "@/lib/cases";
import { STATES, usd } from "@/lib/geo";
import { REPORT_DAYS, stateFromSlug, stateReport, stateSlug } from "@/lib/report";
import { safety } from "@/verticals/safety";

// The report data is cached in lib/report; the Redis client's no-store fetches rule out static rendering.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/osha-citations/[state]">): Promise<Metadata> {
  const code = stateFromSlug((await params).state);
  if (!code) return {};
  const r = await stateReport(code).catch(() => null);
  const name = STATES[code];
  const title = `OSHA citations in ${name}: ${r?.cited ?? "Recent"} employers cited in the last ${REPORT_DAYS} days`;
  const description = r
    ? `${r.cited} ${name} employers cited and ${r.open} open OSHA inspections published in the last ${REPORT_DAYS} days, with ${usd(r.penalties)} in penalties.${r.standards[0] ? ` Most cited: ${r.standards.slice(0, 3).map((s) => s.name.toLowerCase()).join(", ")}.` : ""} Updated daily.`
    : `Recent OSHA inspections and citations in ${name}, updated daily.`;
  return { title, description, alternates: { canonical: `/osha-citations/${stateSlug(code)}` }, openGraph: { title, description } };
}

export default async function StatePage({ params }: PageProps<"/osha-citations/[state]">) {
  const code = stateFromSlug((await params).state);
  if (!code) notFound();
  const [r, meta] = await Promise.all([stateReport(code), ingestMeta()]);
  const name = STATES[code];
  const labels = labelsFor(safety);
  const { biggest, openCases: open } = r;
  const signup = `/signup?areas=${code}`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-20">
        <nav className="mb-4 text-sm text-muted"><Link href="/osha-citations" className="hover:text-foreground">OSHA citations by state</Link> › {name}</nav>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold">OSHA citations in {name}</h1>
        <p className="mt-3 text-lg text-muted">
          In the last {REPORT_DAYS} days OSHA published citations against <b className="text-foreground">{r.cited.toLocaleString()}</b> {name} employers
          {r.penalties > 0 && <>, totaling <b className="text-foreground">{usd(r.penalties)}</b> in penalties</>}, and opened{" "}
          <b className="text-foreground">{r.open.toLocaleString()}</b> accident, complaint and referral inspections that haven&apos;t reached citations yet.
          {r.fatalities > 0 && ` ${r.fatalities} of these cases followed a fatality or catastrophe.`}
          {meta && ` Updated ${new Date(meta.at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`}
        </p>

        <div className="my-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal/30 bg-signal/5 p-4">
          <p className="text-sm"><b>Safety consultant or trainer in {name}?</b> Get every new {name} OSHA case by email at 7am, with employer names, cited standards and fix-by dates.</p>
          <Link href={signup} className="btn btn-signal px-4 py-2 text-sm">Try it free for {TRIAL_DAYS} days</Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <TallyList title="Most cited standards" items={r.standards} unit="employers" />
          <TallyList title="Cities" items={r.cities} unit="cases" />
          <TallyList title="Industries" items={r.industries} unit="cases" />
        </div>

        {biggest.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-1 font-[family-name:var(--font-display)] text-2xl font-extrabold">Largest {name} OSHA penalties this month</h2>
            <p className="mb-4 text-sm text-muted">Employer names are shown to {BRAND.name} subscribers.</p>
            <div className="divide-y divide-line rounded-2xl border border-line bg-card">
              {biggest.map((l) => <div key={l.id} className="p-5"><LeadSummary lead={l} labels={labels} masked /></div>)}
            </div>
          </section>
        )}

        {open.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-1 font-[family-name:var(--font-display)] text-2xl font-extrabold">Open {name} OSHA investigations</h2>
            <p className="mb-4 text-sm text-muted">Inspections opened after an accident, complaint or referral, with no citations published yet.</p>
            <div className="divide-y divide-line rounded-2xl border border-line bg-card">
              {open.map((l) => <div key={l.id} className="p-5"><LeadSummary lead={l} labels={labels} masked /></div>)}
            </div>
          </section>
        )}

        <section className="mt-12 space-y-3 text-muted">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-foreground">About this data</h2>
          <p>These are OSHA enforcement records the U.S. Department of Labor publishes as open data, covering federal OSHA and state-plan programs. OSHA publishes with a lag: inspections usually appear 3 to 4 weeks after they open, and citations 4 to 5 weeks after they&apos;re issued.</p>
          <p>{BRAND.name} checks the records every morning and emails safety consultants and trainers the new cases in their states, ranked by severity, penalty and employer size, for {PLAN.base}/month. We&apos;re not affiliated with OSHA or the Department of Labor.</p>
          <p><Link href={signup} className="font-semibold text-signal underline">Start a free trial for {name}</Link> or <Link href={`/demo?state=${code}`} className="underline">see this week&apos;s {name} cases</Link>.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function TallyList({ title, items, unit }: { title: string; items: { name: string; count: number }[]; unit: string }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ol className="space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.name} className="flex justify-between gap-3"><span>{i.name}</span><span className="text-muted" title={unit}>{i.count}</span></li>
        ))}
      </ol>
    </div>
  );
}
