import type { Lead, Vertical } from "@/engine/schema";
import type { Account } from "./accounts";
import { escapeHtml, layout } from "./email";
import { describeAreas, shortDate, usd } from "./geo";

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function leadRow(l: Lead, v: Vertical) {
  const labels = l.categories.map((c) => v.categories[c]?.label ?? c).join(", ");
  const flags = l.flags.map((f) => `<span style="color:#c2410c;font-weight:700;font-size:11px">${escapeHtml(v.flags[f]?.label ?? f)}</span>`).join(" ");
  const status = l.kind === "citation"
    ? `Cited ${shortDate(l.date)}${l.penalty ? ` · <b>${usd(l.penalty)}</b>` : ""}${l.abateBy && l.abateBy >= l.published ? ` · fixes due ${shortDate(l.abateBy)}` : ""}${l.contested ? " · contested" : ""}`
    : `Inspection opened ${shortDate(l.openDate)}`;
  return `<tr>
    <td style="padding:10px 8px;border-top:1px solid #e4e4e7;vertical-align:top">
      <b>${escapeHtml(l.name)}</b> ${flags}<br>
      <span style="color:#52525b">${escapeHtml([l.city, l.state].filter(Boolean).join(", "))}${l.industry ? ` · ${escapeHtml(l.industry)}` : ""}</span><br>
      ${status} · ${escapeHtml(labels)}
    </td>
    <td style="padding:10px 8px;border-top:1px solid #e4e4e7;vertical-align:top;text-align:right;font-weight:800;color:${l.heat >= 60 ? "#ea580c" : "#18181b"}">${l.heat}</td>
  </tr>`;
}

/** The morning email for one account, built from the vertical's template. */
export function digestEmail(account: Account, leads: Lead[], v: Vertical, site: string) {
  const top = leads.slice(0, 25);
  const vars = {
    count: leads.length,
    noun: leads.length === 1 ? v.noun.singular : v.noun.plural,
    nouns: v.noun.plural,
    area: describeAreas(account.areas),
    company: account.company,
  };
  return {
    subject: fill(v.email.subject, vars),
    html: layout(`<p>${escapeHtml(fill(v.email.intro, vars))}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${top.map((l) => leadRow(l, v)).join("")}</table>
      ${leads.length > top.length ? `<p>+ ${leads.length - top.length} more in your dashboard.</p>` : ""}
      <p><a href="${site}/dashboard" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Open dashboard</a></p>
      <p style="color:#71717a;font-size:12px">OSHA publishes inspections and citations several weeks after they happen. This email lists what was newly published.</p>`),
  };
}
