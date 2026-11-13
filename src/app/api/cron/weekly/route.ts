import { cronAuthorized } from "@/lib/cron";
import { siteUrl } from "@/lib/leads";
import { todayNY } from "@/lib/runtime";
import { sendWeekly } from "@/lib/weekly";

export const maxDuration = 300;

// Vercel Cron sends the free weekly state reports on Monday mornings (vercel.json).
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await sendWeekly(todayNY(), siteUrl(req)));
}
