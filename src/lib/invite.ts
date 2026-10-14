import { type Account, createAccount, findAccountByEmail, saveAccount } from "./accounts";
import { BRAND } from "./brand";
import { escapeHtml, layout, sendEmail } from "./email";
import { describeAreas } from "./geo";
import { seal } from "./seal";
import { getVertical, type VerticalId } from "@/verticals";

export type InviteInput = {
  email: string;
  name?: string;
  company: string;
  /** State codes; empty = nationwide. */
  areas: string[];
  days: number;
  vertical: VerticalId;
};

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

export function inviteEmail(input: InviteInput, endsAt: number, link: string) {
  const area = describeAreas(input.areas, 6);
  const hi = input.name?.trim() ? `Hi ${input.name.trim()},` : `Hi ${input.company} team,`;
  const subject = `Your ${BRAND.name} access for ${area} is ready`;
  const paras = [
    `As promised, here's your free access to ${BRAND.name}.`,
    `Whenever OSHA opens or cites new ${getVertical(input.vertical).noun.plural} in ${area}, you'll get them in an email at 7am ET, ranked by urgency, with cited standards, penalties and fix-by dates. On quiet days there's no email.`,
    "You also have a dashboard with every recent case in your states, where you can track who you've contacted and draft outreach for any employer.",
  ];
  const after = [
    `The button works for 7 days. After that, log in anytime at ${BRAND.domain}/login with this email address.`,
    `Your free trial runs until ${fmtDate(endsAt)}. No card on file and nothing to cancel.`,
    "Questions or ideas? Just reply to this email.",
  ];
  const signature = `Aahan Gandhi\n${BRAND.name} · ${BRAND.domain}`;
  const html = layout(`
    <p>${escapeHtml(hi)}</p>
    ${paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
    <p><a href="${link}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Open my dashboard</a></p>
    ${after.map((p) => `<p style="color:#52525b;font-size:14px">${escapeHtml(p)}</p>`).join("")}
    <p>${escapeHtml(signature).replace("\n", "<br>")}</p>`);
  const text = [hi, ...paras, `Open my dashboard: ${link}`, ...after, signature].join("\n\n");
  return { subject, html, text };
}

/** Creates (or converts) a free pilot account and, unless previewing, emails the invite. */
export async function invite(input: InviteInput, site: string, opts: { send: boolean; replyTo?: string }) {
  const endsAt = Date.now() + input.days * 24 * 60 * 60 * 1000;
  const existing = await findAccountByEmail(input.email);
  if (existing && ["active", "trialing", "past_due"].includes(existing.status)) {
    throw new Error("That email already has a paid account.");
  }

  if (!opts.send) {
    return { account: null, email: inviteEmail(input, endsAt, `${site}/api/auth/verify?token=PREVIEW`) };
  }

  let account: Account;
  if (existing) {
    Object.assign(existing, { company: input.company, vertical: input.vertical, areas: input.areas, status: "pilot", pilotEndsAt: endsAt, digest: true });
    await saveAccount(existing);
    account = existing;
  } else {
    account = await createAccount({ email: input.email, company: input.company, vertical: input.vertical, areas: input.areas, status: "pilot", pilotEndsAt: endsAt });
  }
  const token = seal({ aid: account.id, exp: Date.now() + LINK_TTL_MS });
  const email = inviteEmail(input, endsAt, `${site}/api/auth/verify?token=${encodeURIComponent(token)}`);
  await sendEmail(account.email, email.subject, email.html, { replyTo: opts.replyTo, text: email.text });
  return { account, email };
}
