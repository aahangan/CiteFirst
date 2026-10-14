import { type Account, accountVertical, areasLockedByOthers } from "./accounts";
import { getLeads } from "./cases";
import type { Lead } from "./geo";

/** Leads in the account's states, minus states another company holds exclusively. */
export async function leadsForAccount(account: Account, opts: { days: number }): Promise<Lead[]> {
  const leads = await getLeads(accountVertical(account), { areas: account.areas, days: opts.days });
  const hidden = await areasLockedByOthers(account, [...new Set(leads.map((l) => l.state))]);
  return hidden.size ? leads.filter((l) => !hidden.has(l.state)) : leads;
}

export function siteUrl(req: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
}
