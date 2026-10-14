// Service areas are U.S. states and territories (OSHA's `site_state`).
export { type Lead } from "@/engine/schema";

export const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands",
};

export const STATE_CODES = Object.keys(STATES);

const BY_NAME = new Map(Object.entries(STATES).map(([code, name]) => [name.toLowerCase(), code]));

/** "tx, California ,NY" → { areas: ["CA","NY","TX"], invalid: [] }. Empty = nationwide. */
export function normalizeAreas(raw: string | string[]): { areas: string[]; invalid: string[] } {
  const parts = (Array.isArray(raw) ? raw : raw.split(/[,;\n]+/)).map((s) => s.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    const code = STATES[p.toUpperCase()] ? p.toUpperCase() : BY_NAME.get(p.toLowerCase());
    if (code) valid.push(code);
    else invalid.push(p);
  }
  return { areas: [...new Set(valid)].sort(), invalid };
}

/** "CA, NY and TX" / "all states" */
export function describeAreas(areas: string[], max = 4) {
  if (!areas.length) return "all states";
  if (areas.length > max) return `${areas.length} states`;
  return areas.length === 1 ? STATES[areas[0]] ?? areas[0] : `${areas.slice(0, -1).join(", ")} and ${areas.at(-1)}`;
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
