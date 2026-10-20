// Builds follow-ups for first emails that were delivered and haven't been followed up yet: a short
// in-thread note citing 2 OSHA cases near the firm that were published after the first email.
// Output: outreach/followups.csv (email, firm, thread_id, subject, body). Nothing is sent from here.
//
//   OUTREACH_MAILING_ADDRESS="..." npx tsx --env-file-if-exists=.env.local scripts/outreach-followups.mts [--skip a@x.com,b@y.com] [--since YYYY-MM-DD]
// --skip takes addresses that replied or opted out, so they get no follow-up.
// --since overrides "published after the first email" with a fixed date (for testing on an old snapshot).
// The subject column is left empty: send as "Re: <the thread's original subject>", read from Gmail.
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getLeads } from "../src/lib/cases";
import type { Lead } from "../src/engine/schema";
import { safety } from "../src/verticals/safety";
import { areaName, csvCell, describe, parseCsv, pickLeads, regionOf, SENDER, stateName } from "./outreach-lib.mjs";

const MAILING_ADDRESS = process.env.OUTREACH_MAILING_ADDRESS ?? "[YOUR MAILING ADDRESS]";
const DIR = "outreach";
/** Prospect list file → state, matching how the lists are named. */
const FILE_STATES: Record<string, string> = {
  texas: "TX", florida: "FL", california: "CA", newyork: "NY", pennsylvania: "PA", illinois: "IL", ohio: "OH",
  michigan: "MI", massachusetts: "MA", newjersey: "NJ", northcarolina: "NC", virginia: "VA",
  georgia: "GA", colorado: "CO", wisconsin: "WI", missouri: "MO", louisiana: "LA",
  tennessee: "TN", indiana: "IN", arizona: "AZ", minnesota: "MN", alabama: "AL",
  oklahoma: "OK", kentucky: "KY", southcarolina: "SC", connecticut: "CT", maryland: "MD",
  washington: "WA", oregon: "OR", kansas: "KS", iowa: "IA", utah: "UT",
};

const args = process.argv.slice(2);
const skipArg = args[args.indexOf("--skip") + 1];
const skip = new Set(args.includes("--skip") && skipArg ? skipArg.split(",").map((s) => s.trim().toLowerCase()) : []);
const since = args.includes("--since") ? args[args.indexOf("--since") + 1] : undefined;

// Every firm we know, with the state its list belongs to.
const firms = new Map<string, { row: Record<string, string>; state: string }>();
for (const file of readdirSync(DIR).filter((f) => /^[a-z]+\d*-prospects\.csv$/.test(f))) {
  const state = FILE_STATES[file.replace("-prospects.csv", "")];
  if (!state) continue;
  for (const row of parseCsv(readFileSync(join(DIR, file), "utf8"))) if (row.email) firms.set(row.email.toLowerCase(), { row, state });
}

const log = parseCsv(readFileSync(join(DIR, "sent-log.csv"), "utf8"));
const followedUp = new Set(log.filter((r) => /follow-up/i.test(r.notes)).map((r) => r.email.toLowerCase()));
const firsts = log.filter((r) => r.status === "sent" && r.thread_id && !/follow-up/i.test(r.notes) && !followedUp.has(r.email.toLowerCase()) && !skip.has(r.email.toLowerCase()));

const leadsByState = new Map<string, Lead[]>();
const out = [["email", "firm", "thread_id", "subject", "body"]];
const missing: string[] = [];
for (const sent of firsts) {
  const known = firms.get(sent.email.toLowerCase());
  if (!known) {
    missing.push(sent.email);
    continue;
  }
  const { row, state } = known;
  if (!leadsByState.has(state)) leadsByState.set(state, await getLeads(safety, { areas: [state], days: 30 }));
  // Only cases published after the first email, so the follow-up brings news.
  const fresh = leadsByState.get(state)!.filter((l) => l.published > (since ?? sent.sent_on));
  if (!fresh.length) continue;
  const { region, inRegion } = pickLeads(fresh, row, state);
  const local = inRegion >= 5;
  // Naming the region means both examples must come from it (pickLeads alone may reach outside for city variety).
  const { picked } = pickLeads(local ? fresh.filter((l) => regionOf(l.city, state) === region) : fresh, row, state);
  const cases = picked.filter((l) => l.kind === "citation").slice(0, 2);
  if (cases.length < 2) cases.push(...picked.filter((l) => !cases.includes(l)).slice(0, 2 - cases.length));
  const where = local ? areaName(region, state) : stateName(state);
  const count = local ? inRegion : fresh.length;
  const name = row.firm.replace(/\s*\(.*?\)\s*/g, " ").replace(/,?\s+(LLC|Inc\.?|L\.L\.C\.)$/i, "").trim();
  const first = row.contact_name ? row.contact_name.split(/[ (]/)[0] : "";
  const body = [
    first ? `Hi ${first},` : `Hi ${name} team,`,
    "",
    `Following up on my note from last ${new Date(`${sent.sent_on}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}. Since then OSHA has published ${count} more ${count === 1 ? "case" : "cases"} in ${where}, for example:`,
    "",
    ...cases.map((l) => `- ${describe(l)}`),
    "",
    `If you'd like these every morning, reply "yes" and I'll set up a free 30-day trial for ${name}, or tell me which counties you cover. No card needed.`,
    "",
    "Thanks,",
    SENDER.name,
    `CiteFirst · ${SENDER.site}`,
    "",
    MAILING_ADDRESS,
    "If you'd rather not hear from me, just reply \"no thanks\" and I won't email again.",
  ].join("\n");
  out.push([sent.email, sent.company, sent.thread_id, "", body]);
}

writeFileSync(join(DIR, "followups.csv"), out.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
console.log(`Follow-ups: ${out.length - 1} → ${join(DIR, "followups.csv")} (from ${firsts.length} delivered first emails${skip.size ? `, ${skip.size} skipped` : ""}).`);
if (missing.length) console.log(`Not in any prospect list (no follow-up drafted): ${missing.join(", ")}`);
