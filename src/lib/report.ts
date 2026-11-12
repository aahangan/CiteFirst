// Public per-state summaries of recent OSHA enforcement, for the indexable /osha-citations pages.
import { standardName } from "@/engine/osha";
import { getLeads } from "./cases";
import { type Lead, STATES } from "./geo";
import { safety } from "@/verticals/safety";

export const REPORT_DAYS = 30;

/** "New York" → "new-york". */
export const stateSlug = (code: string) => STATES[code].toLowerCase().replace(/[^a-z]+/g, "-");
const BY_SLUG = new Map(Object.keys(STATES).map((code) => [stateSlug(code), code]));
export const stateFromSlug = (slug: string) => BY_SLUG.get(slug);

export type Tally = { name: string; count: number };

const tally = (names: (string | undefined)[], top: number): Tally[] => {
  const counts = new Map<string, number>();
  for (const n of names) if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, top);
};

export type StateReport = {
  state: string;
  leads: Lead[];
  cited: number;
  open: number;
  penalties: number;
  /** Cited standards, counted once per employer. */
  standards: Tally[];
  cities: Tally[];
  industries: Tally[];
  fatalities: number;
};

export function summarize(state: string, leads: Lead[]): StateReport {
  const cited = leads.filter((l) => l.kind === "citation");
  return {
    state,
    leads,
    cited: cited.length,
    open: leads.length - cited.length,
    penalties: cited.reduce((s, l) => s + l.penalty, 0),
    standards: tally(cited.flatMap((l) => [...new Set(l.notes.map((n) => standardName(n.split(" · ")[0])))]), 8),
    cities: tally(leads.map((l) => l.city), 8),
    industries: tally(leads.map((l) => l.industry), 6),
    fatalities: leads.filter((l) => l.categories.includes("fatality")).length,
  };
}

export async function stateReport(state: string): Promise<StateReport> {
  return summarize(state, await getLeads(safety, { areas: [state], days: REPORT_DAYS }));
}

/** Case counts for every state, for the index page and sitemap. */
export async function stateCounts(): Promise<Record<string, { cited: number; total: number }>> {
  const leads = await getLeads(safety, { areas: [], days: REPORT_DAYS });
  const out: Record<string, { cited: number; total: number }> = {};
  for (const l of leads) {
    const c = (out[l.state] ??= { cited: 0, total: 0 });
    c.total++;
    if (l.kind === "citation") c.cited++;
  }
  return out;
}
