// Free weekly OSHA summary for one state: a no-commitment signup that feeds the trial.
import { BRAND, TRIAL_DAYS } from "./brand";
import { getLeads } from "./cases";
import { db } from "./db";
import { escapeHtml, layout, sendEmail } from "./email";
import { type Lead, STATES, usd } from "./geo";
import { leadTopics, lowerTopic, stateSlug, summarize } from "./report";
import { seal, unseal } from "./seal";
import { safety } from "@/verticals/safety";

export type WeeklySub = { email: string; state: string; confirmed: boolean; createdAt: number };
type Token = { e: string; s: string; a: "confirm" | "unsub"; exp?: number };

const k = { sub: (email: string) => `weekly:sub:${email}`, all: "weekly:subs" };
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const link = (site: string, a: Token["a"], sub: Pick<WeeklySub, "email" | "state">) =>
  `${site}/api/weekly/${a === "confirm" ? "confirm" : "unsubscribe"}?token=${encodeURIComponent(seal({ e: sub.email, s: sub.state, a, ...(a === "confirm" ? { exp: Date.now() + CONFIRM_TTL_MS } : {}) } satisfies Token))}`;

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;

const footer = (site: string, sub: WeeklySub) =>
  `<p style="color:#71717a;font-size:12px">You signed up for the free weekly ${escapeHtml(STATES[sub.state])} report at ${BRAND.domain}. <a href="${link(site, "unsub", sub)}" style="color:#71717a">Unsubscribe</a>.${process.env.MAILING_ADDRESS ? ` ${escapeHtml(process.env.MAILING_ADDRESS)}` : ""}</p>`;

/** Saves an unconfirmed signup and emails the confirm link. Re-signing up just resends it. */
export async function subscribe(email: string, state: string, site: string) {
  const existing = await db.get<WeeklySub>(k.sub(email));
  if (existing?.confirmed && existing.state === state) return;
  const sub: WeeklySub = { email, state, confirmed: false, createdAt: existing?.createdAt ?? Date.now() };
  await db.set(k.sub(email), sub);
  await sendEmail(
    email,
    `Confirm your weekly ${STATES[state]} OSHA report`,
    layout(`<p>Tap below to get a free summary of new ${escapeHtml(STATES[state])} OSHA citations and inspections every Monday.</p>
      ${button(link(site, "confirm", sub), "Confirm my subscription")}
      <p style="color:#71717a;font-size:13px">If you didn't ask for this, ignore it and you won't hear from us.</p>`),
  );
}

/** Applies a confirm or unsubscribe link; returns the subscription's state, or null if the link is bad. */
export async function applyToken(raw: string | null, action: Token["a"]): Promise<string | null> {
  const t = unseal<Token>(raw);
  if (!t || t.a !== action || (t.exp && t.exp < Date.now())) return null;
  if (action === "confirm") {
    await db.set(k.sub(t.e), { email: t.e, state: t.s, confirmed: true, createdAt: Date.now() } satisfies WeeklySub);
    await db.sadd(k.all, t.e);
  } else {
    await db.del(k.sub(t.e));
    await db.srem(k.all, t.e);
  }
  return t.s;
}

export async function confirmedSubs(): Promise<WeeklySub[]> {
  const emails = await db.smembers(k.all);
  const subs = await db.mget<WeeklySub>(emails.map(k.sub));
  return subs.filter((s): s is WeeklySub => !!s?.confirmed);
}

const caseLine = (l: Lead) => {
  const who = `${l.industry ? `${l.industry} employer` : "Employer"} in ${l.city}${l.employees ? ` (${l.employees.toLocaleString()} employees)` : ""}`;
  const topics = leadTopics(l).slice(0, 2).map(lowerTopic).join(", ");
  return `${who}: ${usd(l.penalty)}${topics ? `, cited for ${topics}` : ""}`;
};

/** The Monday email for one state, from cases published in the last 7 days. Null on a quiet week. */
export function weeklyEmail(state: string, leads: Lead[], site: string, sub: WeeklySub) {
  const r = summarize(state, leads);
  if (!r.cited && !r.open) return null;
  const name = STATES[state];
  const page = `${site}/osha-citations/${stateSlug(state)}?utm_source=weekly&utm_medium=email`;
  const subject = `${name} OSHA this week: ${r.cited} ${r.cited === 1 ? "employer" : "employers"} cited${r.penalties ? `, ${usd(r.penalties)} in penalties` : ""}`;
  const html = layout(`
    <p>Here's what OSHA published for ${escapeHtml(name)} in the last 7 days:</p>
    <ul>
      <li><b>${r.cited}</b> employers cited${r.penalties ? `, <b>${usd(r.penalties)}</b> in penalties` : ""}</li>
      <li><b>${r.open}</b> open accident, complaint and referral inspections</li>
      ${r.standards.length ? `<li>Most cited: ${escapeHtml(r.standards.slice(0, 4).map((s) => lowerTopic(s.name)).join(", "))}</li>` : ""}
    </ul>
    ${r.biggest.length ? `<p><b>Largest cases</b></p><ol>${r.biggest.slice(0, 5).map((l) => `<li>${escapeHtml(caseLine(l))}</li>`).join("")}</ol>` : ""}
    <p>${BRAND.name} subscribers get these every morning instead of weekly, with employer names, cited standards, fix-by dates and drafted outreach.</p>
    ${button(`${site}/signup?areas=${state}&utm_source=weekly&utm_medium=email`, `Try it free for ${TRIAL_DAYS} days`)}
    <p><a href="${page}">Full ${escapeHtml(name)} report</a></p>
    ${footer(site, sub)}`);
  return { subject, html };
}

/** Sends this week's email to every confirmed subscriber, once per subscriber per date. */
export async function sendWeekly(date: string, site: string) {
  const byState = new Map<string, Lead[]>();
  let sent = 0, quiet = 0, failed = 0;
  for (const sub of await confirmedSubs()) {
    if (!byState.has(sub.state)) byState.set(sub.state, await getLeads(safety, { areas: [sub.state], days: 7 }));
    const email = weeklyEmail(sub.state, byState.get(sub.state)!, site, sub);
    if (!email) { quiet++; continue; }
    if (!(await db.claim(`weekly:sent:${date}:${sub.email}`, String(Date.now())))) continue;
    try {
      await sendEmail(sub.email, email.subject, email.html);
      sent++;
    } catch {
      failed++;
    }
  }
  return { date, sent, quiet, failed };
}
