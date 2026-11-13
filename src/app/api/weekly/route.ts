import { z } from "zod";
import { allow, clientIp } from "@/lib/db";
import { STATES } from "@/lib/geo";
import { siteUrl } from "@/lib/leads";
import { subscribe } from "@/lib/weekly";

const Body = z.object({ email: z.email().max(254), state: z.string().length(2) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const state = parsed.data?.state.toUpperCase();
  if (!parsed.success || !state || !STATES[state]) return Response.json({ error: "Enter a valid email." }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  if (!(await allow(`weekly:${clientIp(req)}`, 10, 3600)) || !(await allow(`weekly:${email}`, 3, 3600))) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  await subscribe(email, state, siteUrl(req));
  return Response.json({ ok: true });
}
