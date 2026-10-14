import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { accountVertical, currentAccount, isLive } from "@/lib/accounts";
import { alert } from "@/lib/alerts";
import { allow } from "@/lib/db";
import { leadsForAccount } from "@/lib/leads";
import { draftOutreach, OutreachError } from "@/lib/outreach";

export const maxDuration = 60;

const Body = z.object({ id: z.string().regex(/^osha:\d+$/) });

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account || !isLive(account)) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid lead" }, { status: 400 });
  // Look the lead up server-side so drafts only use real case data from the account's own states.
  const lead = (await leadsForAccount(account, { days: 45 })).find((l) => l.id === parsed.data.id);
  if (!lead) return Response.json({ error: "That case isn't in your leads anymore." }, { status: 404 });
  if (!(await allow(`outreach:${account.id}`, 100, 86400))) {
    return Response.json({ error: "Daily drafting limit reached (100). It resets tomorrow." }, { status: 429 });
  }

  try {
    const draft = await draftOutreach(lead, account.company, accountVertical(account));
    return Response.json({ draft });
  } catch (err) {
    if (err instanceof OutreachError) return Response.json({ error: err.message }, { status: 422 });
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "Busy right now. Try again in a moment." }, { status: 429 });
    if (err instanceof Anthropic.APIError) {
      console.error("anthropic error", err.status, err.message);
      const error = draftingError(err);
      // Setup problems (bad key, no credits, wrong model) email the admins, once a day.
      if (error.includes("notified")) {
        await alert(`outreach-config:${new Date().toISOString().slice(0, 10)}`, "AI drafting is failing", { status: err.status, message: err.message });
      }
      return Response.json({ error }, { status: 502 });
    }
    throw err;
  }
}

/** A message that points at the fix for the configuration problems we can recognize. */
function draftingError(err: InstanceType<typeof Anthropic.APIError>) {
  const msg = err.message.toLowerCase();
  if (err.status === 401 || err.status === 403) return "Drafting isn't set up correctly (the AI key was rejected). We've been notified.";
  if (msg.includes("credit balance")) return "Drafting is temporarily unavailable (AI account out of credits). We've been notified.";
  if (err.status === 404 || msg.includes("model")) return "Drafting isn't set up correctly (unknown AI model). We've been notified.";
  return "Drafting failed. Try again.";
}
