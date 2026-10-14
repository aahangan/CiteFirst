import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { currentAccount, isAdmin } from "@/lib/accounts";
import { normalizeAreas } from "@/lib/geo";
import { invite } from "@/lib/invite";
import { DEFAULT_VERTICAL, VERTICAL_IDS, type VerticalId } from "@/verticals";
import { siteUrl } from "@/lib/leads";

const Body = z.object({
  email: z.email().max(254),
  name: z.string().trim().max(80).optional(),
  company: z.string().trim().min(1).max(100),
  areas: z.string().max(2000),
  days: z.number().int().min(1).max(90),
  vertical: z.enum(VERTICAL_IDS as [VerticalId, ...VerticalId[]]).default(DEFAULT_VERTICAL),
  send: z.boolean(),
});

function hasAdminSecret(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: Request) {
  const me = await currentAccount();
  if (!isAdmin(me) && !hasAdminSecret(req)) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the form fields." }, { status: 400 });
  const { areas, invalid } = normalizeAreas(parsed.data.areas);
  if (invalid.length) return Response.json({ error: `Not U.S. states: ${invalid.join(", ")}` }, { status: 400 });

  try {
    const { account, email } = await invite(
      { ...parsed.data, email: parsed.data.email.toLowerCase(), areas },
      siteUrl(req),
      { send: parsed.data.send, replyTo: process.env.ADMIN_REPLY_TO ?? me?.email },
    );
    return Response.json({ sent: parsed.data.send, accountId: account?.id ?? null, subject: email.subject, html: email.html, text: email.text });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Invite failed" }, { status: 400 });
  }
}
