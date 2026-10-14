import { defineVertical } from "../engine/schema";

/** Employers that OSHA just inspected or cited, sold to safety consultants and trainers. */
export const safety = defineVertical({
  id: "safety",
  name: "Safety consulting leads",
  audience: "safety consultants and training providers",
  noun: { singular: "OSHA inspection", plural: "OSHA inspections" },
  categories: {
    fatality: { label: "Fatality/catastrophe", weight: 35 },
    accident: { label: "Accident", weight: 35 },
    complaint: { label: "Employee complaint", weight: 30 },
    referral: { label: "Referral", weight: 25 },
    followup: { label: "Follow-up", weight: 30 },
    willful: { label: "Willful", weight: 40 },
    repeat: { label: "Repeat", weight: 45 },
    serious: { label: "Serious", weight: 30 },
    other: { label: "Other-than-serious", weight: 15 },
  },
  flags: {
    abatementDue: { label: "HAZARDS STILL TO FIX", weight: 15 },
    penalty25k: { label: "$25K+ PENALTY", weight: 15 },
    penalty5k: { label: "$5K+ PENALTY", weight: 8 },
    largeEmployer: { label: "100+ EMPLOYEES", weight: 10 },
  },
  leads: {
    inspectionTypes: { M: "fatality", A: "accident", B: "complaint", C: "referral", F: "followup" },
    violationTypes: { W: "willful", R: "repeat", S: "serious", O: "other" },
    penaltyFlags: [
      { atLeast: 25_000, flag: "penalty25k" },
      { atLeast: 5_000, flag: "penalty5k" },
    ],
    largeEmployer: { atLeast: 100, flag: "largeEmployer" },
    abatementFlag: "abatementDue",
  },
  dedupeKey: "{id}:{kind}",
  email: {
    subject: "{count} new {noun} in your states",
    intro: "Good morning, {company}. Employers OSHA is investigating or just cited in {area}, newly published, hottest first:",
  },
  outreach: {
    seller: "a workplace safety consulting and training company",
    situation: "an employer that OSHA recently inspected or cited, according to public OSHA enforcement records",
    goal: "book a call to help the employer get ready while the inspection is open, or fix (abate) the cited hazards by OSHA's deadline, document the corrections and train crews before any follow-up inspection",
    offers: "abatement help, written safety programs, OSHA 10/30 and topic training for the cited standards, and mock inspections",
    rules: [
      "Be respectful if the inspection followed an accident or fatality: don't mention injuries or deaths directly; refer to \"your recent OSHA inspection\".",
      "Never claim affiliation with OSHA, and never imply you can reduce penalties (that's legal work).",
    ],
  },
});
