// OSHA reference data and pure helpers: code tables and standards.

/** OSHA `insp_type` codes. */
export const INSPECTION_TYPES: Record<string, string> = {
  A: "Accident",
  B: "Complaint",
  C: "Referral",
  D: "Monitoring",
  E: "Variance",
  F: "Follow-up",
  G: "Unprogrammed related",
  H: "Planned",
  I: "Programmed related",
  J: "Unprogrammed other",
  K: "Programmed other",
  L: "Other",
  M: "Fatality/catastrophe",
  N: "Unprogrammed emphasis",
};

/** OSHA `insp_scope` codes. */
export const SCOPES: Record<string, string> = { A: "Complete", B: "Partial", C: "Records only", D: "No inspection" };

/** OSHA `viol_type` codes. */
export const VIOLATION_TYPES: Record<string, string> = { S: "Serious", W: "Willful", R: "Repeat", O: "Other-than-serious", U: "Unclassified" };

/** 2-digit NAICS sectors. */
const SECTORS: Record<string, string> = {
  "11": "Agriculture", "21": "Mining & oil/gas", "22": "Utilities", "23": "Construction",
  "31": "Manufacturing", "32": "Manufacturing", "33": "Manufacturing", "42": "Wholesale",
  "44": "Retail", "45": "Retail", "48": "Transportation", "49": "Warehousing & delivery",
  "51": "Information", "52": "Finance", "53": "Real estate", "54": "Professional services",
  "55": "Management", "56": "Admin & waste services", "61": "Education", "62": "Health care",
  "71": "Arts & recreation", "72": "Hotels & restaurants", "81": "Other services", "92": "Public administration",
};

export function industryFor(naics?: string) {
  return naics ? SECTORS[naics.slice(0, 2)] : undefined;
}

/** Frequently cited standards (OSHA's annual top-10 and neighbors), by prefix, most specific first. */
const STANDARDS: [string, string][] = [
  ["1926.501", "Fall protection"],
  ["1926.502", "Fall protection systems"],
  ["1926.503", "Fall protection training"],
  ["1926.451", "Scaffolding"],
  ["1926.1053", "Ladders"],
  ["1926.1060", "Ladder training"],
  ["1926.102", "Eye and face protection"],
  ["1926.100", "Head protection"],
  ["1926.651", "Excavation requirements"],
  ["1926.652", "Trench protection"],
  ["1926.20", "Construction safety program"],
  ["1926.21", "Construction safety training"],
  ["1926.1200", "Confined spaces in construction"],
  ["1926.1400", "Cranes"],
  ["1910.1200", "Hazard communication"],
  ["1910.134", "Respiratory protection"],
  ["1910.147", "Lockout/tagout"],
  ["1910.178", "Powered industrial trucks (forklifts)"],
  ["1910.212", "Machine guarding"],
  ["1910.213", "Woodworking machinery"],
  ["1910.219", "Power transmission guarding"],
  ["1910.22", "Walking-working surfaces"],
  ["1910.23", "Ladders"],
  ["1910.28", "Fall protection"],
  ["1910.303", "Electrical equipment"],
  ["1910.305", "Electrical wiring"],
  ["1910.132", "Personal protective equipment"],
  ["1910.133", "Eye and face protection"],
  ["1910.146", "Permit-required confined spaces"],
  ["1910.157", "Fire extinguishers"],
  ["1910.37", "Exit routes"],
  ["1910.95", "Occupational noise"],
  ["1910.1030", "Bloodborne pathogens"],
  ["1910.1053", "Respirable crystalline silica"],
  ["1926.1153", "Respirable crystalline silica"],
  ["1904", "Injury and illness recordkeeping"],
  ["5A0001", "General Duty Clause"],
];

/** "19260501 B13" or "1926.501(b)(13)" → "1926.501(b)(13)"; anything else unchanged. */
export function formatStandard(raw: string) {
  const s = raw.trim();
  const m = /^(19\d\d)(\d{4})\s*([A-Z0-9 ]*)$/i.exec(s);
  if (!m) return s;
  const section = `${m[1]}.${String(Number(m[2]))}`;
  const paras = m[3].trim().replace(/\s+/g, "").match(/[A-Z]+|\d+|[ivx]+/gi) ?? [];
  return section + paras.map((p) => `(${/^\d+$/.test(p) ? Number(p) : p.toLowerCase()})`).join("");
}

/** California (Cal/OSHA, Title 8 CCR) sections, which state-plan records cite by bare section number. */
const CAL_STANDARDS: Record<string, string> = {
  "342": "Serious injury reporting",
  "461": "Air tank permits",
  "1509": "Construction injury prevention program",
  "1512": "Construction first aid",
  "1670": "Fall protection",
  "3203": "Injury and illness prevention program (IIPP)",
  "3210": "Guardrails",
  "3276": "Ladders",
  "3314": "Lockout/tagout",
  "3328": "Machine safety",
  "3380": "Personal protective equipment",
  "3395": "Heat illness prevention",
  "3396": "Indoor heat illness prevention",
  "3457": "Field sanitation",
  "3650": "Industrial trucks (forklifts)",
  "3653": "Forklift operation",
  "3664": "Forklift operator training",
  "5144": "Respiratory protection",
  "5162": "Emergency eyewash and showers",
  "5194": "Hazard communication",
  "5204": "Respirable crystalline silica",
  "6151": "Fire extinguishers",
};

export function standardName(standard: string) {
  const s = formatStandard(standard);
  const cal = CAL_STANDARDS[s.split("(")[0]];
  if (cal) return cal;
  return STANDARDS.find(([prefix]) => s === prefix || s.startsWith(`${prefix}(`) || s.startsWith(`${prefix}.`) || (prefix.length <= 6 && s.startsWith(prefix)))?.[1];
}
