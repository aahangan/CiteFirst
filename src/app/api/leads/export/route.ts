import { accountVertical, currentAccount, getLeadStates, isLive } from "@/lib/accounts";
import { leadsForAccount } from "@/lib/leads";

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const account = await currentAccount();
  if (!account || !isLive(account)) return new Response("Not signed in", { status: 401 });
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || 30, 1), 45);
  const v = accountVertical(account);
  const [leads, states] = await Promise.all([leadsForAccount(account, { days }), getLeadStates(account.id)]);

  const header = [
    "Heat", "Employer", "Address", "City", "State", "Zip", "Industry", "NAICS", "Employees", "OSHA inspection #", "Inspection type",
    "Opened", "Status", "Citations issued", "Published", "Penalty", "Fixes due by", "Contested", "Categories", "Cited items", "Pipeline status", "Note",
  ];
  const rows = leads.map((l) => [
    l.heat, l.name, l.address, l.city, l.state, l.zip, l.industry ?? "", l.naics ?? "", l.employees ?? "", l.activityNr, l.inspectionType,
    l.openDate, l.kind === "citation" ? "Cited" : "Open inspection", l.kind === "citation" ? l.date : "", l.published, l.penalty || "", l.abateBy ?? "",
    l.contested ? "yes" : "", l.categories.map((c) => v.categories[c]?.label ?? c).join("; "), l.notes.join(" | "),
    states[l.id]?.status ?? "new", states[l.id]?.note ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="citefirst-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
