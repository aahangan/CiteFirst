import { Resend } from "resend";
import { BRAND } from "./brand";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "CiteFirst <alerts@getcitefirst.com>";

export function emailConfigured() {
  return resend !== null;
}

export async function sendEmail(to: string, subject: string, html: string, opts: { replyTo?: string; text?: string } = {}) {
  if (!resend) {
    console.log(`[email disabled] to=${to} subject=${subject}`);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, replyTo: opts.replyTo, text: opts.text });
  if (error) throw new Error(error.message);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function layout(body: string) {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:auto;padding:24px;color:#18181b">
  <div style="font-weight:800;font-size:18px;margin-bottom:16px">${BRAND.logo[0]}<span style="color:#ea580c">${BRAND.logo[1]}</span></div>
  ${body}
  <p style="color:#71717a;font-size:12px;margin-top:32px">${BRAND.disclaimer}</p>
</div>`;
}
