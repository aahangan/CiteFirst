import { z } from "zod";
import { currentAccount, saveAccount } from "@/lib/accounts";
import { normalizeAreas } from "@/lib/geo";

const Body = z.object({
  company: z.string().trim().min(1).max(100),
  areas: z.string().max(2000),
  digest: z.boolean(),
});

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { areas, invalid } = normalizeAreas(parsed.data.areas);
  if (invalid.length) return Response.json({ error: `These aren't U.S. states: ${invalid.join(", ")}` }, { status: 400 });

  // Exclusive states must stay inside the service area. Dropping one from the area keeps it locked
  // (and billed) until the user unlocks it explicitly, so nothing changes on their invoice silently.
  const outside = areas.length ? account.lockedAreas.filter((z) => !areas.includes(z)) : [];
  if (outside.length) {
    return Response.json({ error: `Unlock ${outside.join(", ")} before removing them from your area.` }, { status: 400 });
  }

  account.company = parsed.data.company;
  account.areas = areas;
  account.digest = parsed.data.digest;
  await saveAccount(account);
  return Response.json({ ok: true, areas });
}
