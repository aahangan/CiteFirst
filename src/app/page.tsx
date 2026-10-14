import Link from "next/link";
import { LeadSummary } from "@/components/LeadCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { labelsFor } from "@/engine/schema";
import { BRAND, PLAN, TRIAL_DAYS } from "@/lib/brand";
import { getLeads } from "@/lib/cases";
import { usd } from "@/lib/geo";
import { safety } from "@/verticals/safety";

export const revalidate = 3600;

async function stats() {
  const leads = await getLeads(safety, { areas: [], days: 30 }).catch(() => []);
  const cited = leads.filter((l) => l.kind === "citation");
  return {
    open: leads.length - cited.length,
    cited: cited.length,
    penalties: cited.reduce((s, l) => s + l.penalty, 0),
    samples: [...cited.slice(0, 2), ...leads.filter((l) => l.kind === "inspection").slice(0, 1)],
  };
}

const steps = [
  { title: "OSHA opens an investigation", body: "An accident, a worker complaint or a referral sends OSHA to a site. Citations, penalties and deadlines to fix every hazard follow, months later. All of it becomes public record." },
  { title: "You get it at 7am", body: `${BRAND.name} reads OSHA's newly published records every morning, filters your states, ranks each employer by severity, penalty and size, and emails you the list.` },
  { title: "You offer the fix", body: "An employer under investigation or facing fix-by dates needs written programs, training and abatement help now. The first credible consultant to call usually gets the work." },
];

const features = [
  ["Morning lead email", "Newly published OSHA inspections and citations in your states, hottest first."],
  ["Before the citation", "Accident, complaint and referral inspections show up while the investigation is still open, usually months before penalties."],
  ["Cited standards in plain English", "Fall protection, lockout/tagout, forklifts: know exactly what training and programs they need before you call."],
  ["Fix-by dates", "OSHA's abatement deadline for every citation, so you know who has to fix hazards, and by when."],
  ["AI-drafted outreach", "A respectful letter, email and call opener for each employer, written from the actual OSHA record."],
  ["Pipeline + CSV", "Mark employers called, quoted or won. Export to your CRM anytime."],
];

const faqs = [
  ["Where does the data come from?", "The U.S. Department of Labor publishes OSHA inspection and violation records, federal and state-plan, as open data. We read it daily, join inspections with their citations, and organize it into leads. We're not affiliated with OSHA or the Department of Labor."],
  ["How fresh is it?", "We check every morning and send what OSHA newly published. OSHA itself publishes with a lag: inspections typically appear 3 to 4 weeks after they open, and citations 4 to 5 weeks after they're issued. Inspections usually take months to reach citations, so open inspections still reach you mid-investigation."],
  ["Is it OK to contact these employers?", "Yes. OSHA enforcement records are public, and offering safety services to a business is ordinary B2B sales. Be respectful after accidents, never imply you work with OSHA, and follow email and telemarketing laws."],
  ["Do you have leads for attorneys?", "Yes. Choose \"Law firm\" at signup for a version tuned to OSHA defense work: fatality and accident investigations, willful and repeat citations, and large penalties. Attorney outreach drafts are written as labeled advertising, since bar rules on solicitation vary by state."],
  ["What's an exclusive state?", `For ${PLAN.areaLock}/month per state, no other customer buying the same lead type sees that state's cases. One firm per state, first come, first served.`],
  ["Can I cancel anytime?", `Yes, from your settings page. You're not charged during the ${TRIAL_DAYS}-day trial if you cancel before it ends.`],
];

export default async function Home() {
  const s = await stats();
  const labels = labelsFor(safety);
  return (
    <>
      <div className="night">
        <SiteHeader dark />
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-signal" /> Leads for safety consultants and trainers
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.04] font-extrabold tracking-tight md:text-6xl">
              OSHA is at their door. <span className="text-amber">Be the safety expert who calls.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-300">
              Every morning, {BRAND.name} sends safety consultants and trainers the employers in their states that OSHA is investigating or just cited, with the standards they broke, their penalties and their fix-by dates.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-signal px-6 py-3.5 text-lg">Start {TRIAL_DAYS}-day free trial</Link>
              <Link href="/demo" className="btn border border-white/20 px-6 py-3.5 text-lg hover:border-white/40">See this week&apos;s cases</Link>
            </div>
            {s.open + s.cited > 0 && (
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
                <Stat value={s.open.toLocaleString()} label="open accident, complaint and referral inspections published, last 30 days" />
                <Stat value={s.cited.toLocaleString()} label="employers cited, last 30 days" />
                <Stat value={usd(s.penalties)} label="in penalties on those citations" />
              </dl>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 text-foreground shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Published this month · nationwide</p>
              <span className="text-xs text-muted">Names unlocked in trial</span>
            </div>
            <div className="divide-y divide-line">
              {s.samples.map((l) => (
                <div key={l.id} className="py-4 first:pt-0 last:pb-0">
                  <LeadSummary lead={l} labels={labels} masked />
                </div>
              ))}
              {!s.samples.length && <p className="text-sm text-muted">Loading the latest citations…</p>}
            </div>
          </div>
        </section>
      </div>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="mb-10 text-center font-[family-name:var(--font-display)] text-3xl font-extrabold">How it works</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {steps.map((st, i) => (
              <li key={st.title} className="rounded-2xl border border-line bg-card p-6">
                <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-signal/10 font-bold text-signal">{i + 1}</span>
                <h3 className="mb-1 font-semibold">{st.title}</h3>
                <p className="text-muted">{st.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-card">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">One client pays for the year</h2>
              <p className="mt-4 text-lg text-muted">
                An employer with fresh OSHA citations needs written programs, crew training and abatement help, and usually ongoing safety support after. One engagement is worth thousands; {BRAND.name} costs {PLAN.base} a month.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {features.map(([title, body]) => (
                <div key={title}>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-4xl px-5 py-20">
          <h2 className="mb-2 text-center font-[family-name:var(--font-display)] text-3xl font-extrabold">Simple pricing</h2>
          <p className="mb-10 text-center text-muted">{TRIAL_DAYS}-day free trial. Cancel anytime.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-signal bg-card p-7">
              <h3 className="font-semibold text-muted">{BRAND.name} Pro</h3>
              <p className="mt-2 mb-5"><span className="font-[family-name:var(--font-display)] text-5xl font-extrabold">{PLAN.base}</span><span className="text-muted">/month</span></p>
              <ul className="mb-7 space-y-2 text-sm">
                {["Every newly published OSHA inspection and citation in your states", "7am lead email, daily", "Cited standards, penalties and fix-by dates", "AI-drafted letters, emails and call openers", "Pipeline tracking and CSV export"].map((p) => <li key={p}>✓ {p}</li>)}
              </ul>
              <Link href="/signup" className="btn btn-signal w-full py-3">Start free trial</Link>
            </div>
            <div className="rounded-2xl border border-line bg-card p-7">
              <h3 className="font-semibold text-muted">Exclusive state add-on</h3>
              <p className="mt-2 mb-5"><span className="font-[family-name:var(--font-display)] text-5xl font-extrabold">+{PLAN.areaLock}</span><span className="text-muted">/state/month</span></p>
              <p className="mb-5 text-sm">Lock a state and no other firm buying the same leads sees its cases. One firm per state, first come, first served.</p>
              <p className="text-sm text-muted">Available once your trial converts. Manage locks from your settings.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-24">
          <h2 className="mb-8 text-center font-[family-name:var(--font-display)] text-3xl font-extrabold">Questions</h2>
          <div className="space-y-3">
            {faqs.map(([q, a]) => (
              <details key={q} className="rounded-xl border border-line bg-card p-5">
                <summary className="cursor-pointer font-semibold">{q}</summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-white">{value}</dd>
      <p className="mt-1 text-xs leading-snug text-zinc-400">{label}</p>
    </div>
  );
}
