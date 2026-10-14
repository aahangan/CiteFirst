import { z } from "zod";
import { claimArea, currentAccount, isLive, isTrial, lockOwner, releaseArea, saveAccount } from "@/lib/accounts";
import { STATES } from "@/lib/geo";
import { getStripe, syncAreaLockQuantity } from "@/lib/stripe";

const Body = z.object({ area: z.string().regex(/^[A-Z]{2}$/), action: z.enum(["lock", "unlock"]) });

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account || !isLive(account)) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { area, action } = parsed.data;

  if (!STATES[area] || (account.areas.length && !account.areas.includes(area))) {
    return Response.json({ error: "That state isn't in your service area." }, { status: 400 });
  }
  const billed = !!getStripe() && !!account.stripeSubscription;

  if (action === "lock") {
    if (account.lockedAreas.includes(area)) return Response.json({ ok: true, lockedAreas: account.lockedAreas });
    // Trials can't lock: otherwise a competitor could lock a whole state for free for two weeks.
    if (isTrial(account)) {
      return Response.json({ error: "Exclusive states start once your trial ends. Contact us to start your paid plan early." }, { status: 402 });
    }
    if (!(await claimArea(account, area))) {
      return Response.json({ error: "Another company already holds this state." }, { status: 409 });
    }
    account.lockedAreas = [...account.lockedAreas, area].sort();
  } else {
    if ((await lockOwner(account, area)) === account.id) await releaseArea(account, area);
    account.lockedAreas = account.lockedAreas.filter((z) => z !== area);
  }

  try {
    if (billed) await syncAreaLockQuantity(account.stripeSubscription!, account.lockedAreas.length);
  } catch (err) {
    // Billing failed: undo the lock so nobody holds a state they aren't paying for.
    if (action === "lock") {
      await releaseArea(account, area);
      account.lockedAreas = account.lockedAreas.filter((z) => z !== area);
    }
    console.error("state lock billing failed", err);
    return Response.json({ error: "Couldn't update billing. Try again." }, { status: 502 });
  }
  await saveAccount(account);
  return Response.json({ ok: true, lockedAreas: account.lockedAreas });
}
