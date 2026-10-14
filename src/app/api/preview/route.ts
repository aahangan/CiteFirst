import { getLeads } from "@/lib/cases";
import { allow, clientIp } from "@/lib/db";
import { normalizeAreas } from "@/lib/geo";
import { getVertical, isVerticalId } from "@/verticals";

// Lets visitors see how many leads their states produced recently, before paying.
export async function GET(req: Request) {
  if (!(await allow(`preview:${clientIp(req)}`, 120, 3600))) return Response.json({ error: "Slow down" }, { status: 429 });
  const params = new URL(req.url).searchParams;
  const raw = params.get("vertical");
  const vertical = getVertical(isVerticalId(raw) ? raw : undefined);
  const { areas, invalid } = normalizeAreas(params.get("areas") ?? "");
  const leads = await getLeads(vertical, { areas, days: 30 });
  return Response.json({
    areas,
    invalid,
    count: leads.length,
    cited: leads.filter((l) => l.kind === "citation").length,
    penalties: Math.round(leads.reduce((s, l) => s + l.penalty, 0)),
    hot: leads.filter((l) => l.heat >= 60).length,
  });
}
