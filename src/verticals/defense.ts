import { defineVertical } from "../engine/schema";

/** Fatality, accident and complaint investigations (before citations) and big citations, sold to OSHA defense attorneys. */
export const defense = defineVertical({
  id: "defense",
  name: "OSHA defense leads",
  audience: "OSHA defense and employment attorneys",
  noun: { singular: "OSHA case", plural: "OSHA cases" },
  categories: {
    fatality: { label: "Fatality/catastrophe", weight: 45 },
    accident: { label: "Accident", weight: 40 },
    complaint: { label: "Employee complaint", weight: 20 },
    referral: { label: "Referral", weight: 20 },
    followup: { label: "Follow-up", weight: 25 },
    willful: { label: "Willful", weight: 45 },
    repeat: { label: "Repeat", weight: 40 },
    serious: { label: "Serious", weight: 25 },
    other: { label: "Other-than-serious", weight: 8 },
  },
  flags: {
    penalty100k: { label: "$100K+ PENALTY", weight: 25 },
    penalty25k: { label: "$25K+ PENALTY", weight: 15 },
    penalty5k: { label: "$5K+ PENALTY", weight: 5 },
    largeEmployer: { label: "250+ EMPLOYEES", weight: 5 },
  },
  leads: {
    inspectionTypes: { M: "fatality", A: "accident", B: "complaint", C: "referral", F: "followup" },
    violationTypes: { W: "willful", R: "repeat", S: "serious", O: "other" },
    penaltyFlags: [
      { atLeast: 100_000, flag: "penalty100k" },
      { atLeast: 25_000, flag: "penalty25k" },
      { atLeast: 5_000, flag: "penalty5k" },
    ],
    largeEmployer: { atLeast: 250, flag: "largeEmployer" },
  },
  dedupeKey: "{id}:{kind}",
  email: {
    subject: "{count} new {noun} in your states",
    intro: "Good morning, {company}. Newly published {nouns} in {area}, most serious first:",
  },
  outreach: {
    seller: "a law firm that defends employers in OSHA enforcement matters",
    situation: "an employer that OSHA recently inspected or cited, according to public OSHA enforcement records",
    goal: "get a short consultation call with the employer's owner, safety manager or general counsel while the OSHA investigation is still open, or about how to respond to citations",
    offers: "a free case review, guidance on document requests and employee interviews during an open investigation, informal conference and settlement experience",
    rules: [
      "Lawyer solicitation is regulated by state bar rules. Write the email and letter as written communications only, and label each one \"Advertising Material\" at the top.",
      "The call script is for calling a business's general counsel or safety manager, not an injured worker or their family. Never contact anyone about a death or injury in a way that could look like approaching the victim's family.",
      "Never promise outcomes (e.g. \"we'll get the penalty dropped\"), and don't state or imply any contest deadline: the case data doesn't show when the employer received the citation.",
      "End the email and letter with a one-line note that this is attorney advertising and not legal advice.",
    ],
  },
});
