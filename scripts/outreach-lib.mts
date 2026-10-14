// Shared pieces for outreach: matching a prospect firm to real, recent OSHA cases near it, and the
// pitch built from them. Used by scripts/outreach-drafts.mts.
import type { Lead } from "../src/engine/schema";

export const SENDER = { name: "Aahan Gandhi", site: "getcitefirst.com" };

/** Per state: rough metro buckets for matching a firm to nearby cases, and how to name them. */
export const STATE_REGIONS: Record<string, { name: string; regions: Record<string, { label: string; cities: string[] }> }> = {
  TX: {
    name: "Texas",
    regions: {
      "Gulf Coast": { label: "the Houston area", cities: ["Houston", "Pasadena", "Baytown", "Deer Park", "La Porte", "Katy", "Sugar Land", "The Woodlands", "Conroe", "Spring", "Humble", "Pearland", "League City", "Galveston", "Texas City", "Beaumont", "Port Arthur", "Orange", "Freeport", "Corpus Christi", "Victoria", "Channelview", "Tomball", "Cypress", "Missouri City", "Rosenberg", "Jersey Village", "Livingston"] },
      DFW: { label: "Dallas–Fort Worth", cities: ["Dallas", "Fort Worth", "Arlington", "Irving", "Plano", "Frisco", "McKinney", "Garland", "Grand Prairie", "Mesquite", "Denton", "Carrollton", "Richardson", "Lewisville", "Allen", "Grapevine", "Coppell", "Mansfield", "Euless", "Haltom City", "Wylie", "Rockwall", "Sherman", "Waxahachie", "Midlothian", "Weatherford", "Cleburne", "Farmers Branch", "Addison", "Lancaster", "Desoto", "Cedar Hill", "Keller", "Southlake", "Princeton", "Roanoke", "Decatur"] },
      South: { label: "the San Antonio area", cities: ["San Antonio", "New Braunfels", "Seguin", "Schertz", "Cibolo", "Boerne", "Laredo", "McAllen", "Edinburg", "Brownsville", "Harlingen", "Pharr", "Mission", "Converse", "Universal City"] },
      Central: { label: "Central Texas", cities: ["Austin", "Round Rock", "Georgetown", "Pflugerville", "Cedar Park", "Leander", "San Marcos", "Kyle", "Buda", "Taylor", "Temple", "Killeen", "Waco", "Bryan", "College Station", "Hutto", "Manor", "Bastrop"] },
      Permian: { label: "the Permian Basin", cities: ["Midland", "Odessa", "Big Spring", "Pecos", "Andrews", "Monahans", "Kermit", "Seminole", "Stanton", "San Angelo", "Lubbock"] },
    },
  },
  FL: {
    name: "Florida",
    regions: {
      "South FL": { label: "South Florida", cities: ["Miami", "Fort Lauderdale", "Hialeah", "Hollywood", "Pembroke Pines", "Miramar", "Doral", "Pompano Beach", "Boca Raton", "Delray Beach", "Boynton Beach", "West Palm Beach", "Jupiter", "Palm City", "Stuart", "Port Saint Lucie", "Homestead", "Coral Springs", "Sunrise", "Plantation", "Davie", "Medley", "Opa Locka", "Riviera Beach", "Lake Worth"] },
      "Tampa Bay": { label: "the Tampa Bay area", cities: ["Tampa", "Saint Petersburg", "St. Petersburg", "Clearwater", "Largo", "Brandon", "Riverview", "Plant City", "Lakeland", "Brooksville", "Spring Hill", "Sarasota", "Bradenton", "Wesley Chapel", "Zephyrhills", "Palmetto", "Pinellas Park", "Oldsmar", "Lutz", "Winter Haven", "Bartow"] },
      Central: { label: "Central Florida", cities: ["Orlando", "Kissimmee", "Sanford", "Winter Park", "Apopka", "Ocoee", "Clermont", "Daytona Beach", "Deland", "Ocala", "Cocoa", "Melbourne", "Palm Bay", "Titusville", "Leesburg", "Lake Mary", "Altamonte Springs", "Oviedo", "Gainesville", "Saint Cloud", "Davenport", "Haines City"] },
      "North FL": { label: "North Florida", cities: ["Jacksonville", "Saint Augustine", "Orange Park", "Fernandina Beach", "Tallahassee", "Pensacola", "Panama City", "Lake City", "Palatka", "Fort Walton Beach", "Destin", "Crestview", "Milton", "Green Cove Springs", "Middleburg"] },
      "Southwest FL": { label: "Southwest Florida", cities: ["Naples", "Fort Myers", "Cape Coral", "Bonita Springs", "Punta Gorda", "Port Charlotte", "Estero", "Lehigh Acres", "Immokalee", "North Port", "Venice"] },
    },
  },
  CA: {
    name: "California",
    regions: {
      LA: { label: "the Los Angeles area", cities: ["Los Angeles", "Long Beach", "Van Nuys", "Lancaster", "Palmdale", "Santa Clarita", "Valencia", "Pasadena", "Glendale", "Burbank", "Torrance", "Carson", "Compton", "Commerce", "Vernon", "City of Industry", "Pomona", "El Monte", "Downey", "Santa Fe Springs", "Gardena", "Inglewood", "Sun Valley", "Chatsworth", "North Hollywood", "Sylmar", "Pacoima", "Whittier", "Montebello", "Paramount", "Rancho Dominguez", "Wilmington", "San Pedro", "Culver City", "Santa Monica", "West Covina", "Azusa", "Irwindale"] },
      "Orange County": { label: "Orange County", cities: ["Anaheim", "Irvine", "Santa Ana", "Orange", "Costa Mesa", "Huntington Beach", "Fullerton", "Garden Grove", "Tustin", "Brea", "Lake Forest", "Newport Beach", "Buena Park", "Placentia", "Mission Viejo", "Yorba Linda", "Cypress", "Westminster", "La Habra", "Fountain Valley"] },
      "Inland Empire": { label: "the Inland Empire", cities: ["Riverside", "San Bernardino", "Ontario", "Fontana", "Rancho Cucamonga", "Corona", "Moreno Valley", "Perris", "Temecula", "Murrieta", "Chino", "Redlands", "Colton", "Rialto", "Victorville", "Hesperia", "Jurupa Valley", "Mira Loma", "Upland", "Palm Springs", "Indio", "Hemet", "Beaumont", "Banning"] },
      "San Diego": { label: "the San Diego area", cities: ["San Diego", "Chula Vista", "Escondido", "Oceanside", "Carlsbad", "El Cajon", "Vista", "San Marcos", "Santee", "National City", "Otay Mesa", "La Mesa", "Poway"] },
      "Bay Area": { label: "the Bay Area", cities: ["San Francisco", "San Jose", "Oakland", "Fremont", "Hayward", "Santa Clara", "Sunnyvale", "Richmond", "Concord", "San Leandro", "Berkeley", "Redwood City", "San Mateo", "Milpitas", "Livermore", "Pleasanton", "Walnut Creek", "Vallejo", "Napa", "Santa Rosa", "Petaluma", "Union City", "South San Francisco", "Palo Alto", "Mountain View", "Brentwood", "Antioch", "Pittsburg", "Fairfield", "Benicia", "Martinez", "Novato", "San Rafael", "Gilroy", "Morgan Hill", "Watsonville", "Santa Cruz", "Salinas"] },
      "Central Valley": { label: "the Central Valley", cities: ["Sacramento", "Stockton", "Modesto", "Fresno", "Bakersfield", "Visalia", "Tracy", "Lodi", "Merced", "Turlock", "Elk Grove", "Roseville", "Rancho Cordova", "West Sacramento", "Davis", "Woodland", "Manteca", "Tulare", "Hanford", "Madera", "Delano", "Redding", "Chico", "Yuba City", "Marysville", "Rocklin", "Lincoln", "Folsom", "Auburn", "Oroville", "Red Bluff", "Anderson", "Ceres", "Patterson", "Shafter", "Selma", "Clovis", "Sanger", "Porterville"] },
    },
  },
};

/** Region a city falls in within a state (case-insensitive), if it's one we know. */
export const regionOf = (city: string, state = "TX") =>
  Object.entries(STATE_REGIONS[state]?.regions ?? {}).find(([, r]) => r.cities.some((c) => c.toLowerCase() === city.toLowerCase()))?.[0];

export const areaName = (region: string | undefined, state = "TX") =>
  (region && STATE_REGIONS[state]?.regions[region]?.label) || STATE_REGIONS[state]?.name || state;

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

export function pickLeads(all: Lead[], firm: Record<string, string>, state: string) {
  const region = firm.region || regionOf(firm.city.split(/ \/ |[(]/)[0].trim(), state);
  const industries = SPECIALTY_INDUSTRIES.filter(([re]) => re.test(firm.specialty)).flatMap(([, s]) => s);
  const score = (l: Lead) =>
    (regionOf(l.city, state) === region ? 100 : 0) + (industries.includes(l.industry ?? "") ? 40 : 0) + (l.kind === "citation" && l.penalty >= 5000 ? 20 : 0) + l.heat / 10;
  const ranked = [...all].sort((a, b) => score(b) - score(a));
  // Mix: prefer two citations and one open inspection, all different cities if possible.
  const picked: Lead[] = [];
  for (const want of ["citation", "citation", "inspection"] as const) {
    const next = ranked.find((l) => l.kind === want && !picked.includes(l) && !picked.some((p) => p.city === l.city)) ?? ranked.find((l) => !picked.includes(l));
    if (next) picked.push(next);
  }
  return { region, picked, inRegion: all.filter((l) => regionOf(l.city, state) === region).length };
}

/** The pitch for one firm: email subject and body, plus a shorter message for website contact forms. */
export function pitch(firm: Record<string, string>, leads: Lead[], mailingAddress: string, state = "TX") {
  const { region, picked, inRegion } = pickLeads(leads, firm, state);
  const stateName = STATE_REGIONS[state]?.name ?? state;
  const first = firm.contact_name ? firm.contact_name.split(/[ (]/)[0] : "";
  // "Berg Compliance Solutions (BES)" → "Berg Compliance Solutions"
  const name = firm.firm.replace(/\s*\(.*?\)\s*/g, " ").trim();
  // Quiet regions get the statewide number, so the pitch doesn't undersell.
  const local = inRegion >= 10;
  const count = local ? inRegion : leads.length;
  const where = local ? areaName(region, state) : stateName;
  const subject = `${count} ${local ? "" : `${stateName} `}employers OSHA cited or inspected ${local ? `in ${where} ` : ""}this month`;
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
