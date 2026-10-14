import type Stripe from "stripe";
import { type Account, createAccount, findAccountByEmail, findAccountBySubscription, saveAccount } from "./accounts";
import { isVerticalId } from "@/verticals";
import { normalizeAreas } from "./geo";
import { db } from "./db";
import { getStripe, toAccountStatus } from "./stripe";

/** Idempotently turns a completed Checkout Session into an account. Called by both the redirect and the webhook. */
export async function accountFromCheckout(sessionOrId: string | Stripe.Checkout.Session): Promise<Account | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const session =
    typeof sessionOrId === "string"
      ? await stripe.checkout.sessions.retrieve(sessionOrId, { expand: ["subscription"] })
      : sessionOrId;
  if (session.status !== "complete" || !session.subscription) return null;

  const sub =
    typeof session.subscription === "string" ? await stripe.subscriptions.retrieve(session.subscription) : session.subscription;
  const existing = await findAccountBySubscription(sub.id);
  if (existing) return existing;

  const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase();
  const meta = session.metadata ?? {};
  const fields = {
    company: meta.company || "My company",
    vertical: isVerticalId(meta.vertical) ? meta.vertical : undefined,
    areas: normalizeAreas(meta.areas ?? "").areas,
    status: toAccountStatus(sub.status),
    stripeCustomer: typeof session.customer === "string" ? session.customer : session.customer?.id,
    stripeSubscription: sub.id,
  };

  // Re-subscribing with the same email reuses the old account (and its pipeline).
  const prior = email ? await findAccountByEmail(email) : null;
  if (prior) {
    Object.assign(prior, fields);
    await saveAccount(prior);
    await db.set(`sub:${sub.id}`, prior.id);
    return prior;
  }
  return createAccount({ email, ...fields });
}
