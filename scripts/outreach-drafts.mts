// Builds outreach for a prospect list, each piece citing 3 real, recent OSHA cases near the firm:
//   <list>-emails.csv  firms with an email not yet emailed (per outreach/sent-log.csv)
//   <list>-forms.csv   firms with only a website contact form: a shorter message to paste in
//   <list>-calls.md    call sheet for firms with a phone number (including ones whose email bounced)
// Nothing is sent from here.
//
//   OUTREACH_MAILING_ADDRESS="..." npx tsx --env-file-if-exists=.env.local scripts/outreach-drafts.mts outreach/texas-prospects.csv
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getLeads } from "../src/lib/cases";
import { safety } from "../src/verticals/safety";
import { areaName, csvCell, describe, parseCsv, pitch } from "./outreach-lib.mjs";

// CAN-SPAM requires a physical postal address in commercial email.
const MAILING_ADDRESS = process.env.OUTREACH_MAILING_ADDRESS ?? "[YOUR MAILING ADDRESS]";

const [, , input = "outreach/texas-prospects.csv"] = process.argv;
const firms = parseCsv(readFileSync(input, "utf8"));
const logFile = join(dirname(input), "sent-log.csv");
const log = existsSync(logFile) ? parseCsv(readFileSync(logFile, "utf8")) : [];
const emailed = new Set(log.map((r) => r.email.toLowerCase()));
const delivered = new Set(log.filter((r) => r.status === "sent").map((r) => r.company));

const leads = await getLeads(safety, { areas: ["TX"], days: 30 });
if (!leads.length) throw new Error("No Texas leads in the snapshot. Run `npm run ingest` first.");
const write = (suffix: string, text: string) => {
  const file = input.replace(/\.csv$/, suffix);
  writeFileSync(file, text);
  return file;
};

// Emails: anyone with an address we haven't used yet.
const emails = [["email", "firm", "first_name", "subject", "body"]];
for (const firm of firms.filter((f) => f.email && !emailed.has(f.email.toLowerCase()))) {
  const p = pitch(firm, leads, MAILING_ADDRESS);
  emails.push([firm.email, firm.firm, p.first, p.subject, p.body]);
}

// Contact forms: no email, but a website, and not already reached by email.
const forms = [["firm", "website", "subject", "message"]];
for (const firm of firms.filter((f) => !f.email && f.website && !delivered.has(f.firm))) {
  const p = pitch(firm, leads, MAILING_ADDRESS);
  forms.push([firm.firm, firm.website, `Leads for ${p.name}: employers OSHA just cited near you`, p.formMessage]);
}

// Calls: anyone with a phone who hasn't received an email.
const calls = firms.filter((f) => f.phone && !delivered.has(f.firm));
const sheet = [
  "# Call sheet: Texas safety firms",
  "",
  `Generated ${new Date().toISOString().slice(0, 10)} from the live OSHA snapshot (${leads.length} Texas leads, last 30 days).`,
  "",
  "**Opener (30 seconds):** \"Hi, this is Aahan. I'm a UCLA student who built a tool for safety consultants: every morning it emails you the employers OSHA just inspected or cited in your area, with the exact standards they were cited for. I'm offering a free 30-day trial to a few Texas firms. Who handles new business there?\"",
  "",
  "**If they're interested:** get the best email and the counties or cities they cover; I'll set up the trial from /admin.",
  "**Common pushback:** \"We get enough work from referrals.\" → \"Makes sense. This is for when you want more: these are employers that need help right now and often don't have a consultant yet.\"",
  "",
  ...calls.flatMap((firm) => {
    const p = pitch(firm, leads, MAILING_ADDRESS);
    return [
      `## ${firm.firm} · ${firm.city}`,
      `- **Phone:** ${firm.phone}${firm.contact_name ? ` (ask for ${firm.contact_name.replace(/\s*\(.*\)/, "")})` : ""}`,
      `- **Website:** ${firm.website || "none found"}`,
      `- **Focus:** ${firm.specialty}`,
      firm.notes ? `- **Notes:** ${firm.notes}` : null,
      `- **Mention:** ${p.count} employers in ${p.where} in the last 30 days, e.g.`,
      ...p.picked.map((l) => `  - ${describe(l)}`),
      "",
    ].filter((line) => line !== null);
  }),
  "",
  `_Regions: ${["DFW", "Gulf Coast", "South", "Central", "Permian"].map(areaName).join(", ")}._`,
].join("\n");

const toCsv = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
console.log(`Emails: ${emails.length - 1} → ${write("-emails.csv", toCsv(emails))}`);
console.log(`Contact forms: ${forms.length - 1} → ${write("-forms.csv", toCsv(forms))}`);
console.log(`Calls: ${calls.length} → ${write("-calls.md", sheet + "\n")}`);
