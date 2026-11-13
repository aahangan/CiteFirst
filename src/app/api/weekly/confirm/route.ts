import { redirect } from "next/navigation";
import { alert } from "@/lib/alerts";
import { stateSlug } from "@/lib/report";
import { applyToken } from "@/lib/weekly";

export async function GET(req: Request) {
  const state = await applyToken(new URL(req.url).searchParams.get("token"), "confirm");
  if (!state) redirect("/osha-citations?weekly=expired");
  await alert(`weekly-signup:${Date.now()}`, "New weekly report subscriber", { state });
  redirect(`/osha-citations/${stateSlug(state)}?weekly=confirmed`);
}
