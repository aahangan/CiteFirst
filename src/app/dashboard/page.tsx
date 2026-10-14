import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { LeadBoard } from "@/components/LeadBoard";
import { labelsFor } from "@/engine/schema";
import { accountVertical, getLeadStates, isLive, requireAccount } from "@/lib/accounts";
import { describeAreas } from "@/lib/geo";
import { leadsForAccount } from "@/lib/leads";

export const metadata: Metadata = { title: "Leads · CiteFirst" };

const RANGES = [7, 14, 30];

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const account = await requireAccount();
  const params = await searchParams;
  const days = RANGES.includes(Number(params.days)) ? Number(params.days) : 30;
  const labels = labelsFor(accountVertical(account));

  if (!isLive(account)) {
    return <DashboardShell account={account} active="leads"><p className="text-muted">Your subscription isn&apos;t active.</p></DashboardShell>;
  }

  const [leads, states] = await Promise.all([leadsForAccount(account, { days }), getLeadStates(account.id)]);

  return (
    <DashboardShell account={account} active="leads">
      {params.welcome && (
        <div className="mb-6 rounded-xl border border-line bg-card p-4 text-sm">
          <b>You&apos;re in.</b> These are the recent {labels.noun.plural} in your states. Starting tomorrow, new ones arrive by email at 7am ET. Tip: start with the highest heat scores and the cases with hazards still to fix.
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Leads</h1>
          <p className="text-sm text-muted">
            {describeAreas(account.areas)} · last {days} days · {leads.length} cases
            {account.lockedAreas.length > 0 && ` · ${account.lockedAreas.length} exclusive`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex rounded-lg border border-line bg-card p-1">
            {RANGES.map((d) => (
              <Link key={d} href={`/dashboard?days=${d}`} className={`rounded-md px-3 py-1 ${d === days ? "bg-foreground text-white" : "text-muted"}`}>{d}d</Link>
            ))}
          </div>
          <a href={`/api/leads/export?days=${days}`} className="btn btn-ghost px-3 py-1.5">Export CSV</a>
        </div>
      </div>
      <LeadBoard leads={leads} initialStates={states} labels={labels} />
    </DashboardShell>
  );
}
