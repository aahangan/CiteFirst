import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Vertical } from "@/engine/schema";
import { STATES, shortDate, usd, type Lead } from "./geo";

export const Outreach = z.object({
  callScript: z.string().describe("A natural 30-45 second phone opener plus 2-3 likely objections with short answers"),
  email: z.object({ subject: z.string(), body: z.string() }),
  letter: z.string().describe("A short printed letter to drop off or mail, under 180 words"),
});
export type Outreach = z.infer<typeof Outreach>;

function systemPrompt(v: Vertical) {
  return `You write outreach for ${v.outreach.seller} contacting ${v.outreach.situation}.

Goals: ${v.outreach.goal}.

Rules:
- Be helpful and matter-of-fact, never alarmist. An OSHA inspection is stressful; position the sender as experienced, calm help.
- You may say the information comes from public OSHA enforcement records, but lead with the help offered, not with "we saw you were cited".
- Use only facts from the provided case details. Don't invent dates, penalties, injuries, outcomes, credentials or regulations.
- Mention offers such as ${v.outreach.offers}, phrased so the sender can edit them.
- Use placeholders in square brackets for anything you don't know: [Your Name], [Firm], [Phone], [Offer].
${v.outreach.rules.map((r) => `- ${r}`).join("\n")}
- Plain text only. Keep everything short enough to actually be read.`;
}

let client: Anthropic | null = null;

export class OutreachError extends Error {}

export function caseDetails(lead: Lead, company: string, v: Vertical) {
  return [
    `Sender: ${company}`,
    `Employer: ${lead.name}${lead.industry ? ` (${lead.industry}${lead.naics ? `, NAICS ${lead.naics}` : ""})` : ""}`,
    `Site: ${[lead.address, lead.city, STATES[lead.state] ?? lead.state, lead.zip].filter(Boolean).join(", ")}`,
    lead.employees ? `Employees at site: about ${lead.employees}` : null,
    `OSHA inspection type: ${lead.inspectionType}, opened ${lead.openDate}${lead.scope ? ` (${lead.scope.toLowerCase()} scope)` : ""}`,
    lead.kind === "citation"
      ? `Citations issued ${lead.date}. Current total penalty: ${usd(lead.penalty)}.${lead.contested ? " The employer has contested." : ""}${lead.abateBy ? ` Cited hazards must be fixed (abated) by ${shortDate(lead.abateBy)}.` : ""}`
      : "No citations issued yet (inspection still open).",
    `Categories: ${lead.categories.map((c) => v.categories[c]?.label ?? c).join(", ")}`,
    lead.notes.length ? `Case notes:\n${lead.notes.slice(0, 8).map((n) => `- ${n}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function draftOutreach(lead: Lead, company: string, v: Vertical): Promise<Outreach> {
  if (!process.env.ANTHROPIC_API_KEY) throw new OutreachError("Outreach drafting isn't configured yet (missing ANTHROPIC_API_KEY).");
  const model = process.env.AI_MODEL;
  if (!model) throw new OutreachError("Outreach drafting isn't configured yet (missing AI_MODEL).");
  client ??= new Anthropic();

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Outreach) },
    system: systemPrompt(v),
    messages: [{ role: "user", content: `Write the call script, email and letter for this case.\n\n${caseDetails(lead, company, v)}` }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new OutreachError("Couldn't draft outreach for this case. Try again.");
  }
  return response.parsed_output;
}
