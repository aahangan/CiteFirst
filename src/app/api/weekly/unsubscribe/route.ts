import { redirect } from "next/navigation";
import { stateSlug } from "@/lib/report";
import { applyToken } from "@/lib/weekly";

export async function GET(req: Request) {
  const state = await applyToken(new URL(req.url).searchParams.get("token"), "unsub");
  redirect(state ? `/osha-citations/${stateSlug(state)}?weekly=unsubscribed` : "/osha-citations");
}
