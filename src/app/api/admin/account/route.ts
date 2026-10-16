import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { currentAccount, findAccountByEmail, isAdmin, saveAccount } from "@/lib/accounts";
import { normalizeAreas } from "@/lib/geo";
import { VERTICAL_IDS, type VerticalId } from "@/verticals";

// Edits an existing account's company, product or states without emailing anyone.
const Body = z.object({
  email: z.email().max(254),
  company: z.string().trim().min(1).max(100).optional(),
  areas: z.string().max(2000).optional(),
  vertical: z.enum(VERTICAL_IDS as [VerticalId, ...VerticalId[]]).optional(),
});

function hasAdminSecret(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function PATCH(req: Request) {
  if (!hasAdminSecret(req) && !isAdmin(await currentAccount())) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the fields." }, { status: 400 });
  const { email, company, areas, vertical } = parsed.data;

  const account = await findAccountByEmail(email.toLowerCase());
  if (!account) return Response.json({ error: "No account with that email." }, { status: 404 });
  if (areas !== undefined) {
    const { areas: states, invalid } = normalizeAreas(areas);
    if (invalid.length) return Response.json({ error: `Not U.S. states: ${invalid.join(", ")}` }, { status: 400 });
    account.areas = states;
  }
  if (company) account.company = company;
  if (vertical) account.vertical = vertical;
  await saveAccount(account);
  return Response.json({ email: account.email, company: account.company, vertical: account.vertical, areas: account.areas, status: account.status });
}
