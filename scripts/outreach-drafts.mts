// Builds personalized cold emails for prospects: each firm gets 3 real, recent OSHA cases from its
// own region, pulled from the stored snapshot. Output is a mail-merge CSV (one row per firm with an
// email) for sending from Gmail with a merge add-on. Nothing is sent from here.
//
//   npx tsx --env-file-if-exists=.env.local scripts/outreach-drafts.mts outreach/texas-prospects.csv
import { readFileSync, writeFileSync } from "fs";
import { getLeads } from "../src/lib/cases";
import { safety } from "../src/verticals/safety";
import type { Lead } from "../src/engine/schema";

const SENDER = { name: "Aahan Gandhi", site: "getcitefirst.com" };
// CAN-SPAM requires a physical postal address in commercial email.
const MAILING_ADDRESS = process.env.OUTREACH_MAILING_ADDRESS ?? "[YOUR MAILING ADDRESS]";

/** Rough metro buckets for matching a firm to nearby cases. */
const REGIONS: Record<string, string[]> = {
  "Gulf Coast": ["Houston", "Pasadena", "Baytown", "Deer Park", "La Porte", "Katy", "Sugar Land", "The Woodlands", "Conroe", "Spring", "Humble", "Pearland", "League City", "Galveston", "Texas City", "Beaumont", "Port Arthur", "Orange", "Freeport", "Corpus Christi", "Victoria", "Channelview", "Tomball", "Cypress", "Missouri City", "Rosenberg"],
  DFW: ["Dallas", "Fort Worth", "Arlington", "Irving", "Plano", "Frisco", "McKinney", "Garland", "Grand Prairie", "Mesquite", "Denton", "Carrollton", "Richardson", "Lewisville", "Allen", "Grapevine", "Coppell", "Mansfield", "Euless", "Haltom City", "Wylie", "Rockwall", "Sherman", "Waxahachie", "Midlothian", "Weatherford", "Cleburne", "Farmers Branch", "Addison", "Lancaster", "Desoto", "Cedar Hill", "Keller", "Southlake"],
  South: ["San Antonio", "New Braunfels", "Seguin", "Schertz", "Cibolo", "Boerne", "Laredo", "McAllen", "Edinburg", "Brownsville", "Harlingen", "Pharr", "Mission", "Converse", "Universal City"],
  Central: ["Austin", "Round Rock", "Georgetown", "Pflugerville", "Cedar Park", "Leander", "San Marcos", "Kyle", "Buda", "Taylor", "Temple", "Killeen", "Waco", "Bryan", "College Station", "Hutto", "Manor", "Bastrop"],
  Permian: ["Midland", "Odessa", "Big Spring", "Pecos", "Andrews", "Monahans", "Kermit", "Seminole", "Stanton", "San Angelo", "Lubbock"],
};
const regionOf = (city: string) => Object.entries(REGIONS).find(([, cities]) => cities.some((c) => c.toLowerCase() === city.toLowerCase()))?.[0];

/** Specialty words → NAICS sector labels from the lead data. */
const SPECIALTY_INDUSTRIES: [RegExp, string[]][] = [
  [/construct|roof|data center|EM 385/i, ["Construction"]],
  [/oil|gas|petro|H2S|drill|frac|refin/i, ["Mining & oil/gas", "Utilities"]],
  [/manufactur|factory|fabricat|industrial|machine/i, ["Manufacturing"]],
  [/warehouse|forklift|logistic/i, ["Warehousing & delivery", "Transportation", "Wholesale"]],
];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** One case as a line a safety consultant would care about. Employer names are left out on purpose. */
function describe(l: Lead) {
  const what = l.industry ? l.industry.toLowerCase().replace("mining & oil/gas", "oil & gas") : "local";
  const article = /^[aeiou]/.test(what) ? "An" : "A";
  const size = l.employees && l.employees >= 20 ? `, ~${l.employees.toLocaleString("en-US")} employees` : "";
  if (l.kind === "inspection") return `${article} ${what} company in ${l.city}${size}: OSHA opened a ${l.inspectionType.toLowerCase()} inspection, no citations yet.`;
  const items = l.notes.filter((n) => !n.startsWith("+")).map((n) => n.split(" · ")[1]?.toLowerCase()).filter((x): x is string => !!x && !/^(serious|willful|repeat|other)/.test(x));
  // "fall protection" already covers "fall protection training".
  const topics = items.filter((t, i) => !items.slice(0, i).some((p) => t.startsWith(p) || p.startsWith(t))).slice(0, 2).join(" and ");
  // OSHA publishes citations weeks after issuing them, so describe them as just published, not by issue date.
  return `${article} ${what} company in ${l.city}${size}: citations just published${l.penalty ? `, ${usd(l.penalty)} in penalties` : ""}${topics ? `, including ${topics}` : ""}.`;
}

function pickLeads(all: Lead[], firm: Record<string, string>) {
  const region = firm.region || regionOf(firm.city.split(/[ /(]/)[0]);
  const industries = SPECIALTY_INDUSTRIES.filter(([re]) => re.test(firm.specialty)).flatMap(([, s]) => s);
  const score = (l: Lead) =>
    (regionOf(l.city) === region ? 100 : 0) + (industries.includes(l.industry ?? "") ? 40 : 0) + (l.kind === "citation" && l.penalty >= 5000 ? 20 : 0) + l.heat / 10;
  const ranked = [...all].sort((a, b) => score(b) - score(a));
  // Mix: prefer two citations and one open inspection, all different cities if possible.
  const picked: Lead[] = [];
  for (const want of ["citation", "citation", "inspection"] as const) {
    const next = ranked.find((l) => l.kind === want && !picked.includes(l) && !picked.some((p) => p.city === l.city)) ?? ranked.find((l) => !picked.includes(l));
    if (next) picked.push(next);
  }
  return { region, picked, inRegion: all.filter((l) => regionOf(l.city) === region).length };
}

const [, , input = "outreach/texas-prospects.csv"] = process.argv;
const firms = parseCsv(readFileSync(input, "utf8"));
const leads = await getLeads(safety, { areas: ["TX"], days: 30 });
if (!leads.length) throw new Error("No Texas leads in the snapshot. Run `npm run ingest` first.");

const out: string[][] = [["email", "firm", "first_name", "subject", "body"]];
for (const firm of firms.filter((f) => f.email)) {
  const { region, picked, inRegion } = pickLeads(leads, firm);
  const first = firm.contact_name ? firm.contact_name.split(/[ (]/)[0] : "";
  const area = region === "DFW" ? "Dallas–Fort Worth" : region === "Gulf Coast" ? "the Houston area" : region === "South" ? "the San Antonio area" : region === "Central" ? "Central Texas" : region === "Permian" ? "the Permian Basin" : "Texas";
  // Quiet regions get the statewide number, so the pitch doesn't undersell.
  const local = inRegion >= 10;
  const count = local ? inRegion : leads.length;
  const subject = `${count} ${local ? "" : "Texas "}employers OSHA cited or inspected ${local ? `in ${area} ` : ""}this month`;
  const body = [
    first ? `Hi ${first},` : `Hi ${firm.firm} team,`,
    "",
    `I run CiteFirst, which sends safety consultants the employers OSHA just inspected or cited in their area, every morning. In the last 30 days that was ${count} employers in ${local ? area : "Texas"}. A few recent ones:`,
    "",
    ...picked.map((l) => `- ${describe(l)}`),
    "",
    "Each one comes with the cited standards, penalties and fix-by dates, so you know exactly what training and programs they need before you call.",
    "",
    `Would a free 30-day trial be useful for ${firm.firm}? Reply "yes" and I'll set it up for your area. No card needed. You can see this week's cases at https://${SENDER.site}/demo.`,
    "",
    "Thanks,",
    SENDER.name,
    `CiteFirst · ${SENDER.site}`,
    "",
    `${MAILING_ADDRESS}`,
    "If you'd rather not hear from me, just reply \"no thanks\" and I won't email again.",
  ].join("\n");
  out.push([firm.email, firm.firm, first, subject, body]);
}

const file = input.replace(/\.csv$/, "-emails.csv");
writeFileSync(file, out.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
console.log(`Wrote ${out.length - 1} emails to ${file} from ${leads.length} Texas leads.`);
