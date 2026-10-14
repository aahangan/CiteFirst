// One-off: re-estimate first-seen dates on the stored snapshot (as if it were the first ingest),
// without calling the DOL API. Use after changing TYPICAL_LAG_DAYS.   npx tsx --env-file-if-exists=.env.local scripts/restamp.mts
import { stampFirstSeen } from "../src/engine/cases";
import { db } from "../src/lib/db";
import { STATE_CODES } from "../src/lib/geo";
import type { OshaCase } from "../src/engine/schema";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
let n = 0;
for (const s of STATE_CODES) {
  const cases = await db.get<OshaCase[]>(`cases:${s}`);
  if (!cases?.length) continue;
  await db.set(`cases:${s}`, stampFirstSeen(cases.map((c) => ({ ...c, firstSeen: {} })), null, today));
  n += cases.length;
}
console.log(`Re-stamped ${n} cases as of ${today}.`);
