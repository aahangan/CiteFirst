// Stores the daily OSHA case snapshot, one key per state, so pages never call the DOL API
// (it's rate limited and needs a secret key). The daily ingest rewrites the whole window.
import { type CaseFetch, fetchCases, stampFirstSeen } from "@/engine/cases";
import { log } from "@/engine/log";
import { casesToLeads } from "@/engine/normalize";
import type { Lead, OshaCase, Vertical } from "@/engine/schema";
import { VERTICALS } from "@/verticals";
import { db } from "./db";
import { STATE_CODES } from "./geo";

/**
 * Days of events kept. OSHA publishes inspections ~3-4 weeks after they open and citations
 * ~4-5 weeks after issuance, so this keeps every case visible for 30+ days after it's published.
 */
export const WINDOW_DAYS = 75;
const DAY_MS = 24 * 60 * 60 * 1000;
const key = (state: string) => `cases:${state}`;
const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Every inspection type some vertical turns into a lead as soon as it opens. */
const WANTED_TYPES = [...new Set(Object.values(VERTICALS).flatMap((v) => Object.keys(v.leads.inspectionTypes)))];

export type IngestMeta = { at: number; date: string; cases: number; inspectionRows: number; violationRows: number; missingColumns: string[] };

export const ingestMeta = () => db.get<IngestMeta>("cases:meta");

async function snapshot(states: string[]): Promise<OshaCase[] | null> {
  const stored = await db.mget<OshaCase[]>(states.map(key));
  return stored.some((s) => s !== null) ? stored.flatMap((s) => s ?? []) : null;
}

export async function storedCases(areas: string[]): Promise<OshaCase[]> {
  return (await snapshot(areas.length ? areas : STATE_CODES)) ?? [];
}

/**
 * Fetches the window from the DOL API and stamps when each case first appeared, using the
 * previous snapshot. With `write`, also replaces the snapshot that pages read.
 */
export async function ingest(date: string, asOf: Date, opts: { write: boolean }): Promise<CaseFetch> {
  const previous = await snapshot(STATE_CODES);
  // Runs offline (GitHub Actions), so it can afford to wait out the API's throttling.
  const result = await fetchCases(asOf, WINDOW_DAYS, { inspectionTypes: WANTED_TYPES, known: previous ?? [], retries: 5 });
  const cases = stampFirstSeen(result.cases, previous, date);
  if (opts.write) {
    const byState = new Map<string, OshaCase[]>(STATE_CODES.map((s) => [s, []]));
    for (const c of cases) byState.get(c.state)?.push(c);
    // An empty fetch would wipe the snapshot; keep yesterday's instead (the run alerts on zero rows).
    if (cases.length) await Promise.all([...byState].map(([state, list]) => db.set(key(state), list)));
    const meta: IngestMeta = {
      at: Date.now(), date, cases: cases.length, inspectionRows: result.inspectionRows,
      violationRows: result.violationRows, missingColumns: result.missingColumns,
    };
    await db.set("cases:meta", meta);
    log.info("ingest.done", { ...meta, firstIngest: !previous });
  }
  return { ...result, cases };
}

export type LeadQuery = { areas: string[]; days: number; now?: number };

/** A vertical's leads in these states published in the last `days` days, hottest first. */
export async function getLeads(v: Vertical, q: LeadQuery): Promise<Lead[]> {
  const now = q.now ?? Date.now();
  return casesToLeads(await storedCases(q.areas), v, { from: isoDate(now - q.days * DAY_MS), now });
}
