import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadSummary } from "@/components/LeadCard";
import { TallyList, TopicLinks } from "@/components/ReportParts";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WeeklySignup } from "@/components/WeeklySignup";
import { labelsFor } from "@/engine/schema";
import { BRAND, TRIAL_DAYS } from "@/lib/brand";
import { STATES, usd } from "@/lib/geo";
import { lowerTopic, MIN_TOPIC_CASES, REPORT_DAYS, stateFromSlug, stateSlug, topicReport } from "@/lib/report";
import { safety } from "@/verticals/safety";

// Report data is cached in lib/report; see the state page.
export const dynamic = "force-dynamic";

async function load(params: PageProps<"/osha-citations/[state]/[topic]">["params"]) {
  const { state, topic } = await params;
  const code = stateFromSlug(state);
  const r = code ? await topicReport(code, topic) : null;
  return code && r ? { code, r } : null;
}

export async function generateMetadata({ params }: PageProps<"/osha-citations/[state]/[topic]">): Promise<Metadata> {
  const got = await load(params).catch(() => null);
  if (!got) return {};
  const { code, r } = got;
  const name = STATES[code];
  const title = `${r.topic} OSHA citations in ${name}: ${r.cited} employers, last ${REPORT_DAYS} days`;
  const description = `${r.cited} ${name} employers cited by OSHA for ${lowerTopic(r.topic)} in the last ${REPORT_DAYS} days, with ${usd(r.penalties)} in total penalties. Cities, industries and the largest cases, updated daily.`;
  return {
    title,
    description,
    alternates: { canonical: `/osha-citations/${stateSlug(code)}/${(await params).topic}` },
    openGraph: { title, description },
    // Thin pages stay out of search results but still work as links.
    robots: r.cited < MIN_TOPIC_CASES ? { index: false } : undefined,
  };
}

export default async function TopicPage({ params, searchParams }: PageProps<"/osha-citations/[state]/[topic]">) {
  const { weekly } = await searchParams;
  const got = await load(params);
  if (!got) notFound();
  const { code, r } = got;
  const name = STATES[code];
  const labels = labelsFor(safety);
  const alsoCited = r.standards.filter((s) => s.name !== r.topic).slice(0, 6);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-20">
        <nav className="mb-4 text-sm text-muted">
          <Link href="/osha-citations" className="hover:text-foreground">OSHA citations by state</Link> ›{" "}
          <Link href={`/osha-citations/${stateSlug(code)}`} className="hover:text-foreground">{name}</Link> › {r.topic}
        </nav>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold">{r.topic} citations in {name}</h1>
        <p className="mt-3 text-lg text-muted">
          In the last {REPORT_DAYS} days OSHA published {lowerTopic(r.topic)} citations against <b className="text-foreground">{r.cited.toLocaleString()}</b> {name}{" "}
          {r.cited === 1 ? "employer" : "employers"}
          {r.penalties > 0 && <>, with <b className="text-foreground">{usd(r.penalties)}</b> in total penalties on those cases</>}.
          {r.fatalities > 0 && ` ${r.fatalities} followed a fatality or catastrophe.`}
        </p>

        <div className="my-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal/30 bg-signal/5 p-4">
          <p className="text-sm"><b>Sell {lowerTopic(r.topic)} training, programs or equipment in {name}?</b> Get every newly cited employer by email at 7am, with names, cited standards and fix-by dates.</p>
          <Link href={`/signup?areas=${code}`} className="btn btn-signal px-4 py-2 text-sm">Try it free for {TRIAL_DAYS} days</Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <TallyList title="Cities" items={r.cities} unit="employers" />
          <TallyList title="Industries" items={r.industries} unit="employers" />
          <TopicLinks state={code} items={alsoCited} title="Also cited on these cases" />
        </div>

        <div className="mt-8"><WeeklySignup state={code} stateName={name} notice={typeof weekly === "string" ? weekly : undefined} /></div>

        <section className="mt-12">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-2xl font-extrabold">Largest {name} {lowerTopic(r.topic)} cases this month</h2>
          <p className="mb-4 text-sm text-muted">Employer names are shown to {BRAND.name} subscribers.</p>
          <div className="divide-y divide-line rounded-2xl border border-line bg-card">
            {r.biggest.map((l) => <div key={l.id} className="p-5"><LeadSummary lead={l} labels={labels} masked /></div>)}
          </div>
        </section>

        <p className="mt-10 text-muted">
          From OSHA enforcement records the U.S. Department of Labor publishes as open data. Citations usually appear 4 to 5 weeks after they&apos;re issued. {BRAND.name} isn&apos;t affiliated with OSHA.{" "}
          <Link href={`/osha-citations/${stateSlug(code)}`} className="underline">All {name} OSHA citations</Link>.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
