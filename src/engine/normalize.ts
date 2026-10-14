// Pure functions that turn OSHA cases into a vertical's scored leads. No I/O, so they're unit tested.
import { INSPECTION_TYPES, VIOLATION_TYPES } from "./osha";
import type { Lead, OshaCase, Vertical } from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const today = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Freshness counts from when the case was published, since that's when the customer can act on it. */
export function scoreLead(l: Omit<Lead, "heat">, v: Vertical, now = Date.now()): number {
  const weights = l.categories.map((c) => v.categories[c]?.weight ?? 0).sort((a, b) => b - a);
  let heat = (weights[0] ?? 0) + 5 * Math.max(0, weights.length - 1);
  for (const f of l.flags) heat += v.flags[f]?.weight ?? 0;
  const age = (now - new Date(`${l.published}T12:00:00Z`).getTime()) / DAY_MS;
  heat += age <= 3 ? 15 : age <= 7 ? 8 : age <= 14 ? 3 : 0;
  return Math.max(0, Math.min(100, Math.round(heat)));
}

function notesFor(c: OshaCase) {
  if (!c.items.length) {
    return [`${INSPECTION_TYPES[c.inspectionType] ?? "Other"} inspection opened ${c.openDate}${c.scope ? ` · ${c.scope.toLowerCase()} scope` : ""}. No citations issued yet.`];
  }
  const shown = c.items.slice(0, 8).map((i) =>
    [i.standard || "Unlisted standard", i.standardName, VIOLATION_TYPES[i.type] ?? i.type, i.penalty ? usd(i.penalty) : null].filter(Boolean).join(" · "),
  );
  return c.items.length > shown.length ? [...shown, `+ ${c.items.length - shown.length} more items`] : shown;
}

/** One case → one lead for this vertical, or null if the vertical doesn't want it. */
export function caseToLead(c: OshaCase, v: Vertical, now = Date.now()): Lead | null {
  const rules = v.leads;
  const cited = c.items.length > 0 && !!c.issuanceDate;
  const triggerCategory = rules.inspectionTypes[c.inspectionType];
  if (!cited && !triggerCategory) return null;

  const categories = [
    ...(triggerCategory ? [triggerCategory] : []),
    ...new Set(c.items.map((i) => rules.violationTypes[i.type]).filter((x): x is string => !!x)),
  ];
  const date = cited ? c.issuanceDate! : c.openDate;

  const flags: string[] = [];
  if (rules.abatementFlag && cited && c.abateBy && c.abateBy >= today(now)) flags.push(rules.abatementFlag);
  const penaltyFlag = [...rules.penaltyFlags].sort((a, b) => b.atLeast - a.atLeast).find((p) => c.penalty >= p.atLeast);
  if (penaltyFlag) flags.push(penaltyFlag.flag);
  if (rules.largeEmployer && (c.employees ?? 0) >= rules.largeEmployer.atLeast) flags.push(rules.largeEmployer.flag);

  const lead: Omit<Lead, "heat"> = {
    id: `osha:${c.activityNr}`,
    vertical: v.id,
    activityNr: c.activityNr,
    kind: cited ? "citation" : "inspection",
    name: c.name,
    address: c.address,
    city: c.city,
    state: c.state,
    zip: c.zip,
    industry: c.industry,
    naics: c.naics,
    date,
    published: (cited ? c.firstSeen.citation : c.firstSeen.inspection) ?? date,
    openDate: c.openDate,
    inspectionType: INSPECTION_TYPES[c.inspectionType] ?? "Other",
    scope: c.scope,
    employees: c.employees,
    union: c.union,
    contested: !!c.contestDate,
    abateBy: cited ? c.abateBy : undefined,
    penalty: c.penalty,
    categories,
    flags,
    notes: notesFor(c),
  };
  return { ...lead, heat: scoreLead(lead, v, now) };
}

/** Cases → this vertical's leads published in (from, to], hottest first. */
export function casesToLeads(cases: OshaCase[], v: Vertical, opts: { now?: number; from?: string; to?: string } = {}): Lead[] {
  const now = opts.now ?? Date.now();
  return cases
    .map((c) => caseToLead(c, v, now))
    .filter((l): l is Lead => !!l && (!opts.from || l.published > opts.from) && (!opts.to || l.published <= opts.to))
    .sort((a, b) => b.heat - a.heat || b.published.localeCompare(a.published));
}

/** The key that marks a lead as already delivered, from the vertical's dedupe template. */
export function dedupeKey(lead: Lead, v: Vertical) {
  return v.dedupeKey.replace(/\{(id|date|kind|vertical)\}/g, (_m, k: "id" | "date" | "kind" | "vertical") => String(lead[k]));
}
