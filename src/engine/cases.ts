// Builds OSHA cases (an inspection plus its violations) from the DOL inspection and violation feeds.
import { log } from "./log";
import { formatStandard, industryFor, INSPECTION_TYPES, SCOPES, standardName } from "./osha";
import type { CitedItem, InspectionInfo, OshaCase } from "./schema";
import { type DolOptions, dolQueryAll, dolQueryIn, missingColumns, type Row } from "./sources/dol";

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const day = (v?: string) => (v ? v.slice(0, 10) : undefined);
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Llc|Lp|Llp|Pllc|Pc|Usa)\b/g, (w) => w.toUpperCase());
/** State plans prefix some names with an internal case number: "Wa317991855 - Price Cold Storage". */
export const stripCaseNumber = (name: string) => name.replace(/^[A-Z]{2,3}\d[A-Z0-9]{5,} - (?=\S)/i, "");
const money = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const INSPECTION_FIELDS = [
  "activity_nr", "estab_name", "site_address", "site_city", "site_state", "site_zip", "naics_code",
  "insp_type", "insp_scope", "nr_in_estab", "union_status", "open_date", "close_case_date",
];
export const VIOLATION_FIELDS = [
  "activity_nr", "citation_id", "delete_flag", "standard", "viol_type", "issuance_date",
  "current_penalty", "initial_penalty", "contest_date", "abate_date",
];
/** If any of these disappear from the feed, its schema changed and we alert. */
export const REQUIRED_INSPECTION = ["activity_nr", "estab_name", "site_state", "insp_type", "open_date"];
export const REQUIRED_VIOLATION = ["activity_nr", "viol_type", "issuance_date"];

/** Pure: the inspection half of a case from one inspection row, or null if it's unusable. */
export function inspectionInfo(r: Row): InspectionInfo | null {
  if (!r.activity_nr || !r.open_date || !r.site_state) return null;
  const employees = Number(r.nr_in_estab);
  return {
    activityNr: r.activity_nr,
    name: stripCaseNumber(titleCase((r.estab_name ?? "Unnamed establishment").replace(/\s+/g, " "))),
    address: titleCase(r.site_address ?? ""),
    city: titleCase(r.site_city ?? ""),
    state: r.site_state.toUpperCase(),
    zip: (r.site_zip ?? "").slice(0, 5),
    naics: r.naics_code,
    industry: industryFor(r.naics_code),
    inspectionType: INSPECTION_TYPES[r.insp_type ?? ""] ? r.insp_type! : "L",
    scope: SCOPES[r.insp_scope ?? ""],
    employees: Number.isFinite(employees) && employees > 0 ? employees : undefined,
    // Per the DOL data dictionary: Y/U/A = union, N/B/blank = not.
    union: ["Y", "U", "A"].includes(r.union_status ?? ""),
    openDate: day(r.open_date)!,
    closeDate: day(r.close_case_date),
  };
}

/** Pure: an inspection plus its (non-deleted) violation rows. `firstSeen` is filled in by `stampFirstSeen`. */
export function summarize(info: InspectionInfo, violations: Row[]): OshaCase {
  const vs = violations.filter((v) => v.delete_flag !== "X");
  const items: CitedItem[] = vs
    .map((v) => {
      const standard = formatStandard(v.standard ?? "");
      return { citationId: v.citation_id ?? "", standard, standardName: standardName(standard), type: v.viol_type ?? "U", penalty: money(v.current_penalty) };
    })
    .sort((a, b) => b.penalty - a.penalty || a.citationId.localeCompare(b.citationId));
  const dates = (field: string) => vs.map((v) => day(v[field])).filter((d): d is string => !!d).sort();
  return {
    ...info,
    issuanceDate: dates("issuance_date").at(-1),
    contestDate: dates("contest_date")[0],
    abateBy: dates("abate_date").at(-1),
    items,
    penalty: vs.reduce((s, v) => s + money(v.current_penalty), 0),
    initialPenalty: vs.reduce((s, v) => s + money(v.initial_penalty), 0),
    firstSeen: {},
  };
}

/**
 * Pure: joins inspections with violations. Every opened inspection becomes a case; a `known`
 * inspection (from yesterday's snapshot) only does if it has violations in this batch.
 */
export function buildCases(opened: Row[], violations: Row[], known: InspectionInfo[] = []): OshaCase[] {
  const byNr = new Map<string, Row[]>();
  for (const v of violations) {
    if (!v.activity_nr) continue;
    const list = byNr.get(v.activity_nr);
    if (list) list.push(v);
    else byNr.set(v.activity_nr, [v]);
  }
  const infos = new Map<string, InspectionInfo>();
  for (const k of known) if (byNr.has(k.activityNr)) infos.set(k.activityNr, { ...k, name: stripCaseNumber(k.name) });
  for (const r of opened) {
    const info = inspectionInfo(r);
    if (info && !infos.has(info.activityNr)) infos.set(info.activityNr, info);
  }
  return [...infos.values()].map((info) => summarize(info, byNr.get(info.activityNr) ?? []));
}

/** OSHA's typical publication lag in days, measured Oct 2026 (inspections ~3-4 weeks, citations ~4-5). */
export const TYPICAL_LAG_DAYS = { inspection: 24, citation: 33 } as const;

const addDays = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Pure: records when each case's news first appeared. Carried over from the previous snapshot;
 * new news is stamped `today`. On the very first ingest (no previous snapshot) we can't know, so
 * each case gets its event date plus OSHA's typical lag (never later than today).
 */
export function stampFirstSeen(cases: OshaCase[], previous: OshaCase[] | null, today: string): OshaCase[] {
  const prev = new Map((previous ?? []).map((c) => [c.activityNr, c.firstSeen]));
  return cases.map((c) => {
    const p = prev.get(c.activityNr);
    const estimate = (kind: "inspection" | "citation", eventDate: string) => {
      const d = addDays(eventDate, TYPICAL_LAG_DAYS[kind]);
      return d < today ? d : today;
    };
    const first = (kind: "inspection" | "citation", eventDate: string) => p?.[kind] ?? (previous ? today : estimate(kind, eventDate));
    const cited = c.items.length > 0 && !!c.issuanceDate;
    return {
      ...c,
      firstSeen: {
        inspection: first("inspection", c.openDate),
        ...(cited ? { citation: first("citation", c.issuanceDate!) } : {}),
      },
    };
  });
}

export type CaseFetch = { cases: OshaCase[]; inspectionRows: number; violationRows: number; missingColumns: string[] };

export type FetchOptions = DolOptions & {
  /** Inspection types worth fetching when opened (cited inspections are fetched whatever their type). */
  inspectionTypes: string[];
  /** Inspections already known from the previous snapshot, so they aren't looked up again. */
  known?: InspectionInfo[];
  /**
   * Cap on lookup requests per run. The API has a small hourly quota; inspections not looked up
   * today are looked up on a later run (their cases appear then). A normal day needs one or two.
   */
  maxLookupRequests?: number;
};

/**
 * Every case that's news in the window: inspections of the wanted types opened in it, plus
 * inspections (opened any time) that had citations issued in it. Each run re-reads the whole
 * window, which picks up records OSHA publishes late.
 */
export async function fetchCases(asOf: Date, days: number, opts: FetchOptions): Promise<CaseFetch> {
  const from = isoDate(new Date(asOf.getTime() - days * DAY_MS));
  const [opened, issued] = await Promise.all([
    dolQueryAll("OSHA", "inspection", {
      filter: { and: [{ field: "open_date", operator: "gt", value: from }, { field: "insp_type", operator: "in", value: opts.inspectionTypes }] },
      fields: INSPECTION_FIELDS,
    }, opts),
    dolQueryAll("OSHA", "violation", { filter: { field: "issuance_date", operator: "gt", value: from }, fields: VIOLATION_FIELDS }, opts),
  ]);

  // Citations usually arrive months after the inspection opened; look up the ones we don't know yet.
  const have = new Set([...opened.map((r) => r.activity_nr), ...(opts.known ?? []).map((k) => k.activityNr)]);
  const missing = [...new Set(issued.map((v) => v.activity_nr).filter((nr) => nr && !have.has(nr)))];
  // If throttled partway, keep what we have; the rest are looked up on the next run.
  const older = missing.length
    ? await dolQueryIn("OSHA", "inspection", "activity_nr", missing, { fields: INSPECTION_FIELDS }, { ...opts, maxRequests: opts.maxLookupRequests ?? 15, partialOnError: true })
    : [];
  const pending = missing.length - new Set(older.map((r) => r.activity_nr)).size;

  const cases = buildCases([...opened, ...older], issued, opts.known);
  log.info("cases.fetched", { from, opened: opened.length, lookedUp: older.length, pendingLookups: pending, violations: issued.length, cases: cases.length });
  return {
    cases,
    inspectionRows: opened.length + older.length,
    violationRows: issued.length,
    missingColumns: [...missingColumns(opened, REQUIRED_INSPECTION), ...missingColumns(issued, REQUIRED_VIOLATION)],
  };
}
