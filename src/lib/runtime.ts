// Wires the daily delivery run to the stored case snapshot, Redis and email. The snapshot itself is
// refreshed earlier each morning by scripts/ingest.mts (GitHub Actions), outside the web app.
import { log } from "@/engine/log";
import { casesToLeads } from "@/engine/normalize";
import { type RunDeps, runDaily } from "@/engine/run";
import type { OshaCase } from "@/engine/schema";
import { getVertical } from "@/verticals";
import { type Account, areasLockedByOthers, isLive, listAccounts, saveAccount } from "./accounts";
import { alert } from "./alerts";
import { ingestMeta, storedCases } from "./cases";
import { db } from "./db";
import { digestEmail } from "./digest";
import { sendEmail } from "./email";

/** Leads first published in the last few days and not yet sent go out, so a missed day catches up. */
const DIGEST_DAYS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

export function liveDeps(site: string): RunDeps<Account> {
  // One snapshot read per run, shared by every vertical.
  let loaded: Promise<{ cases: OshaCase[]; missingColumns: string[] }> | null = null;
  const load = () =>
    (loaded ??= Promise.all([storedCases([]), ingestMeta()]).then(([cases, meta]) => ({ cases, missingColumns: meta?.missingColumns ?? [] })));
  return {
    store: { get: db.get, set: db.set, claim: db.claim, del: db.del },
    accounts: listAccounts,
    isLive,
    vertical: getVertical,
    fetchSource: async (v, asOf) => {
      const { cases, missingColumns } = await load();
      const from = new Date(asOf.getTime() - DIGEST_DAYS * DAY_MS).toISOString().slice(0, 10);
      const to = asOf.toISOString().slice(0, 10);
      const leads = casesToLeads(cases, v, { from, to, now: asOf.getTime() });
      return { leads, rowCount: cases.length, missingColumns };
    },
    hiddenAreas: areasLockedByOthers,
    saveAccount,
    sendDigest: async (account, leads, v) => {
      const email = digestEmail(account, leads, v, site);
      await sendEmail(account.email, email.subject, email.html);
    },
    alert,
    log,
    now: Date.now,
  };
}

/** Today's date in New York, where the 7am email is scheduled. */
export function todayNY() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export async function runFor(date: string, site: string, opts: { dryRun?: boolean }) {
  // A stale snapshot means this morning's ingest didn't run; delivery still goes out with what we have.
  const meta = await ingestMeta();
  if (!opts.dryRun && date === todayNY() && meta?.date !== date) {
    await alert(`ingest-stale:${date}`, "OSHA ingest didn't run today", { date, lastIngest: meta?.date ?? null });
  }
  return runDaily(date, liveDeps(site), opts);
}
