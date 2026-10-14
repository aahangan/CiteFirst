// Refreshes the OSHA case snapshot from the DOL API. Runs daily on GitHub Actions before the 7am
// delivery (.github/workflows/ingest.yml), outside the web app: the DOL API throttles hard, so
// requests are paced and a run can take several minutes, longer than a serverless function may.
//
//   npm run ingest                    (reads .env.local; writes Redis, or .data/db.json without it)
import { ingest } from "../src/lib/cases";

const started = Date.now();
// The date in New York, where the 7am email goes out.
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const result = await ingest(date, new Date(), { write: true });
const cited = result.cases.filter((c) => c.items.length).length;
console.log(`Ingested ${result.cases.length} cases (${cited} cited) for ${date} in ${Math.round((Date.now() - started) / 1000)}s.`);
if (result.missingColumns.length) {
  console.error(`Feed changed, missing columns: ${result.missingColumns.join(", ")}`);
  process.exit(1);
}
if (!result.cases.length) {
  console.error("No cases returned; kept the previous snapshot.");
  process.exit(1);
}
