import { alert } from "@/lib/alerts";
import { ingest } from "@/lib/cases";
import { cronAuthorized } from "@/lib/cron";
import { todayNY } from "@/lib/runtime";

export const maxDuration = 300;

// Vercel Cron refreshes the case snapshot here before the 7am delivery (vercel.json). GitHub's
// scheduled run of scripts/ingest.mts started hours late in late Oct 2026, so it is now the backup:
// running both is harmless, since first-seen dates carry over from the previous snapshot.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const date = todayNY();
  const started = Date.now();
  try {
    const result = await ingest(date, new Date(), { write: true });
    const report = {
      date,
      cases: result.cases.length,
      cited: result.cases.filter((c) => c.items.length).length,
      missingColumns: result.missingColumns,
      seconds: Math.round((Date.now() - started) / 1000),
    };
    if (result.missingColumns.length || !result.cases.length) {
      await alert(`ingest-failed:${date}`, "OSHA ingest returned bad data", report);
      return Response.json({ report }, { status: 500 });
    }
    return Response.json({ report });
  } catch (err) {
    await alert(`ingest-failed:${date}`, "OSHA ingest failed", { date, error: String(err) });
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
