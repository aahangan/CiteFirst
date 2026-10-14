// Shared pieces for outreach: matching a prospect firm to real, recent OSHA cases near it, and the
// pitch built from them. Used by scripts/outreach-drafts.mts.
import type { Lead } from "../src/engine/schema";

export const SENDER = { name: "Aahan Gandhi", site: "getcitefirst.com" };

/** Rough metro buckets for matching a firm to nearby cases. */
export const REGIONS: Record<string, string[]> = {
  "Gulf Coast": ["Houston", "Pasadena", "Baytown", "Deer Park", "La Porte", "Katy", "Sugar Land", "The Woodlands", "Conroe", "Spring", "Humble", "Pearland", "League City", "Galveston", "Texas City", "Beaumont", "Port Arthur", "Orange", "Freeport", "Corpus Christi", "Victoria", "Channelview", "Tomball", "Cypress", "Missouri City", "Rosenberg"],
  DFW: ["Dallas", "Fort Worth", "Arlington", "Irving", "Plano", "Frisco", "McKinney", "Garland", "Grand Prairie", "Mesquite", "Denton", "Carrollton", "Richardson", "Lewisville", "Allen", "Grapevine", "Coppell", "Mansfield", "Euless", "Haltom City", "Wylie", "Rockwall", "Sherman", "Waxahachie", "Midlothian", "Weatherford", "Cleburne", "Farmers Branch", "Addison", "Lancaster", "Desoto", "Cedar Hill", "Keller", "Southlake"],
  South: ["San Antonio", "New Braunfels", "Seguin", "Schertz", "Cibolo", "Boerne", "Laredo", "McAllen", "Edinburg", "Brownsville", "Harlingen", "Pharr", "Mission", "Converse", "Universal City"],
  Central: ["Austin", "Round Rock", "Georgetown", "Pflugerville", "Cedar Park", "Leander", "San Marcos", "Kyle", "Buda", "Taylor", "Temple", "Killeen", "Waco", "Bryan", "College Station", "Hutto", "Manor", "Bastrop"],
  Permian: ["Midland", "Odessa", "Big Spring", "Pecos", "Andrews", "Monahans", "Kermit", "Seminole", "Stanton", "San Angelo", "Lubbock"],
};
export const regionOf = (city: string) => Object.entries(REGIONS).find(([, cities]) => cities.some((c) => c.toLowerCase() === city.toLowerCase()))?.[0];

const AREA_NAMES: Record<string, string> = { DFW: "Dallas–Fort Worth", "Gulf Coast": "the Houston area", South: "the San Antonio area", Central: "Central Texas", Permian: "the Permian Basin" };
export const areaName = (region?: string) => (region && AREA_NAMES[region]) || "Texas";

/** Specialty words → NAICS sector labels from the lead data. */
const SPECIALTY_INDUSTRIES: [RegExp, string[]][] = [
  [/construct|roof|data center|EM 385/i, ["Construction"]],
  [/oil|gas|petro|H2S|drill|frac|refin/i, ["Mining & oil/gas", "Utilities"]],
  [/manufactur|factory|fabricat|industrial|machine/i, ["Manufacturing"]],
  [/warehouse|forklift|logistic/i, ["Warehousing & delivery", "Transportation", "Wholesale"]],
];

export function parseCsv(text: string): Record<string, string>[] {
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

export const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** One case as a line a safety consultant would care about. Employer names are left out on purpose. */
export function describe(l: Lead) {
  const what = l.industry ? l.industry.toLowerCase().replace("mining & oil/gas", "oil & gas") : "local";
  // "an oil & gas company" but "a utilities company" (the "you" sound).
  const article = /^[aeio]|^u(?!ti|ni|se|su)/.test(what) ? "An" : "A";
  const size = l.employees && l.employees >= 20 ? `, ~${l.employees.toLocaleString("en-US")} employees` : "";
  if (l.kind === "inspection") return `${article} ${what} company in ${l.city}${size}: OSHA opened a ${l.inspectionType.toLowerCase()} inspection, no citations yet.`;
  const items = l.notes.filter((n) => !n.startsWith("+")).map((n) => n.split(" · ")[1]?.toLowerCase()).filter((x): x is string => !!x && !/^(serious|willful|repeat|other)/.test(x));
  // "fall protection" already covers "fall protection training".
  const topics = items.filter((t, i) => !items.slice(0, i).some((p) => t.startsWith(p) || p.startsWith(t))).slice(0, 2).join(" and ");
  // OSHA publishes citations weeks after issuing them, so describe them as recently published, not by issue date.
  return `${article} ${what} company in ${l.city}${size}: citations recently published${l.penalty ? `, ${usd(l.penalty)} in penalties` : ""}${topics ? `, including ${topics}` : ""}.`;
}

export function pickLeads(all: Lead[], firm: Record<string, string>) {
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

/** The pitch for one firm: email subject and body, plus a shorter message for website contact forms. */
export function pitch(firm: Record<string, string>, leads: Lead[], mailingAddress: string) {
  const { region, picked, inRegion } = pickLeads(leads, firm);
  const first = firm.contact_name ? firm.contact_name.split(/[ (]/)[0] : "";
  // "Berg Compliance Solutions (BES)" → "Berg Compliance Solutions"
  const name = firm.firm.replace(/\s*\(.*?\)\s*/g, " ").trim();
  // Quiet regions get the statewide number, so the pitch doesn't undersell.
  const local = inRegion >= 10;
  const count = local ? inRegion : leads.length;
  const where = local ? areaName(region) : "Texas";
  const subject = `${count} ${local ? "" : "Texas "}employers OSHA cited or inspected ${local ? `in ${where} ` : ""}this month`;
  const cases = picked.map((l) => `- ${describe(l)}`);
  const offer = `Would a free 30-day trial be useful for ${name}? Reply "yes" and I'll set it up for your area. No card needed. You can see this week's cases at https://${SENDER.site}/demo.`;
  const body = [
    first ? `Hi ${first},` : `Hi ${name} team,`,
    "",
    "I'm Aahan, a UCLA student building CiteFirst on my own: a lead service for safety consultants and trainers.",
    "",
    `Every morning it sends you the employers OSHA just inspected or cited in your area. In the last 30 days OSHA published ${count} of them in ${where}. A few recent ones:`,
    "",
    ...cases,
    "",
    "Each lead names the employer and lists the exact standards cited and the penalties, so you know what training and programs they need before you call. It all comes from OSHA's public enforcement records, so you can look up any of them yourself: https://www.osha.gov/ords/imis/establishment.html",
    "",
    offer,
    "",
    "Thanks,",
    SENDER.name,
    `CiteFirst · ${SENDER.site}`,
    "",
    mailingAddress,
    "If you'd rather not hear from me, just reply \"no thanks\" and I won't email again.",
  ].join("\n");
  // Contact forms collect the sender's details separately and often cap length.
  const formMessage = [
    `Hi ${name} team, I'm Aahan, a UCLA student building CiteFirst: every morning it sends safety consultants the employers OSHA just inspected or cited in their area. In the last 30 days OSHA published ${count} in ${where}, for example:`,
    ...cases,
    `Would a free 30-day trial be useful? No card needed. This week's cases: https://${SENDER.site}/demo. Reply to this email or reach me at aahangandhi@gmail.com.`,
  ].join("\n");
  return { name, first, region, picked, count, where, subject, body, formMessage };
}
