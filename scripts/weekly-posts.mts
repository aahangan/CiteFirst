// Drafts this week's social posts (LinkedIn, safety groups): one per busy state, from cases OSHA
// published in the last 7 days, each linking to that state's public citations page. Nothing is posted.
//
//   npx tsx --env-file-if-exists=.env.local scripts/weekly-posts.mts [count=5] [days=7]
// Reads the same snapshot as the app; locally that's .data/db.json, so run `npm run ingest` first.
import { mkdirSync, writeFileSync } from "fs";
import { getLeads } from "../src/lib/cases";
import { STATES, usd } from "../src/lib/geo";
import { leadTopics, lowerTopic, stateSlug, summarize } from "../src/lib/report";
import { safety } from "../src/verticals/safety";

const count = Number(process.argv[2] ?? 5);
const days = Number(process.argv[3] ?? 7);
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://getcitefirst.com";
const date = new Date().toISOString().slice(0, 10);

const leads = await getLeads(safety, { areas: [], days });
const byState = Map.groupBy(leads, (l) => l.state);
const reports = [...byState].map(([state, ls]) => summarize(state, ls)).filter((r) => r.cited >= 5).sort((a, b) => b.penalties - a.penalties).slice(0, count);

const an = (word: string) => `${/^[aeiou]/.test(word) ? "an" : "a"} ${word}`;

const posts = reports.map((r) => {
  const name = STATES[r.state];
  const top = r.biggest[0];
  const where = r.cities.slice(0, 3).map((c) => c.name).join(", ");
  const lines = [
    `${name} OSHA enforcement, last ${days} days: ${r.cited} employers cited, ${usd(r.penalties)} in penalties.`,
    "",
    r.standards.length ? `Most cited: ${r.standards.slice(0, 3).map((s) => `${lowerTopic(s.name)} (${s.count})`).join(", ")}.` : "",
    top ? `Largest: ${an((top.industry ?? "local").toLowerCase())} employer in ${top.city}${top.employees ? ` with ${top.employees.toLocaleString()} employees` : ""}, ${usd(top.penalty)}${leadTopics(top)[0] ? ` (${lowerTopic(leadTopics(top)[0])})` : ""}.` : "",
    where ? `Busiest areas: ${where}.` : "",
    r.open ? `Plus ${r.open} open accident, complaint and referral inspections that haven't reached citations yet.` : "",
    "",
    `Full breakdown, updated daily: ${site}/osha-citations/${stateSlug(r.state)}?utm_source=linkedin&utm_medium=social`,
    "",
    `#OSHA #WorkplaceSafety #${name.replace(/\s+/g, "")} #SafetyFirst`,
  ];
  return `## ${name}\n\n${lines.filter((l, i) => l || lines[i - 1]).join("\n")}`;
});

mkdirSync("outreach/posts", { recursive: true });
const file = `outreach/posts/${date}.md`;
writeFileSync(file, `# Weekly OSHA posts, ${date}\n\nOne per state; post one or two a day rather than all at once.\n\n${posts.join("\n\n---\n\n")}\n`);
console.log(`${posts.length} posts → ${file}`);
