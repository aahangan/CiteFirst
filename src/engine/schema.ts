// A vertical is one lead product (e.g. OSHA cases sold to defense attorneys). Each one is a
// single config file validated against this schema; the engine does the rest.
import { z } from "zod";

const Labelled = z.object({ label: z.string().min(1), weight: z.number().min(0).max(100) });

/** OSHA `insp_type` code → category id. */
const InspectionTypes = z.record(z.string().regex(/^[A-Z]$/), z.string());

/** OSHA `viol_type` code → category id. */
const ViolationTypes = z.record(z.string().regex(/^[A-Z]$/), z.string());

export const VerticalSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    name: z.string().min(1),
    /** Who buys these leads, e.g. "OSHA defense attorneys". */
    audience: z.string().min(1),
    noun: z.object({ singular: z.string().min(1), plural: z.string().min(1) }),
    categories: z.record(z.string(), Labelled),
    flags: z.record(z.string(), Labelled).default({}),
    /** Which cases become leads, and how they're categorized. */
    leads: z.object({
      /** Inspections of these types become leads as soon as they're opened (before any citation). */
      inspectionTypes: InspectionTypes.refine((t) => Object.keys(t).length > 0, "needs at least one inspection type"),
      /** Every case with citations becomes a lead; its violations are categorized by type. */
      violationTypes: ViolationTypes,
      /** Penalty thresholds (current penalty, dollars) → flag id. Highest matching threshold wins. */
      penaltyFlags: z.array(z.object({ atLeast: z.number().positive(), flag: z.string() })).default([]),
      /** Flag set while the employer still has cited hazards to fix (an abatement date not yet passed). */
      abatementFlag: z.string().optional(),
      /** Flag for establishments with at least this many employees. */
      largeEmployer: z.object({ atLeast: z.number().int().positive(), flag: z.string() }).optional(),
    }),
    /** Template for the "already sent" key: {id}, {date}, {kind}, {vertical}. */
    dedupeKey: z.string().refine((k) => k.includes("{id}"), "must include {id}").default("{id}:{kind}"),
    email: z.object({
      /** {count}, {noun} */
      subject: z.string().min(1),
      /** {area}, {nouns}, {company} */
      intro: z.string().min(1),
    }),
    outreach: z.object({
      seller: z.string().min(1),
      situation: z.string().min(1),
      goal: z.string().min(1),
      offers: z.string().min(1),
      /** Extra rules for this audience (e.g. attorney solicitation rules). */
      rules: z.array(z.string()).default([]),
    }),
  })
  .superRefine((v, ctx) => {
    const cats = new Set(Object.keys(v.categories));
    const flags = new Set(Object.keys(v.flags));
    const need = (ok: boolean, path: (string | number)[], message: string) => ok || ctx.addIssue({ code: "custom", path, message });
    for (const [code, cat] of Object.entries(v.leads.inspectionTypes)) need(cats.has(cat), ["leads", "inspectionTypes", code], `unknown category "${cat}"`);
    for (const [code, cat] of Object.entries(v.leads.violationTypes)) need(cats.has(cat), ["leads", "violationTypes", code], `unknown category "${cat}"`);
    v.leads.penaltyFlags.forEach((p, i) => need(flags.has(p.flag), ["leads", "penaltyFlags", i], `unknown flag "${p.flag}"`));
    if (v.leads.abatementFlag) need(flags.has(v.leads.abatementFlag), ["leads", "abatementFlag"], `unknown flag "${v.leads.abatementFlag}"`);
    if (v.leads.largeEmployer) need(flags.has(v.leads.largeEmployer.flag), ["leads", "largeEmployer"], `unknown flag "${v.leads.largeEmployer.flag}"`);
  });

export type VerticalInput = z.input<typeof VerticalSchema>;
export type Vertical = z.output<typeof VerticalSchema>;

/** Validates a vertical config at load time so a broken config fails loudly at build/test time. */
export function defineVertical(config: VerticalInput): Vertical {
  return VerticalSchema.parse(config);
}

/** One cited violation item, as shown to customers. */
export type CitedItem = {
  citationId: string;
  standard: string;
  /** Plain-English name of the standard when known, e.g. "Fall protection". */
  standardName?: string;
  type: string;
  penalty: number;
};

/** The inspection half of a case: everything that comes from the inspection feed. */
export type InspectionInfo = {
  activityNr: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  naics?: string;
  industry?: string;
  inspectionType: string;
  scope?: string;
  employees?: number;
  union: boolean;
  openDate: string;
  closeDate?: string;
};

/**
 * One OSHA inspection joined with its violations. This is what the daily ingest stores; verticals
 * turn cases into scored leads. Dates are YYYY-MM-DD.
 */
export type OshaCase = InspectionInfo & {
  /** Latest citation issuance date, when the case has citations. */
  issuanceDate?: string;
  /** Earliest contest date across its violations, when contested. */
  contestDate?: string;
  /** Latest abatement due date across its violations: when the employer must have fixed everything. */
  abateBy?: string;
  items: CitedItem[];
  /** Current (post-settlement) total penalty. */
  penalty: number;
  initialPenalty: number;
  /**
   * When each kind of news first appeared in OSHA's published data (YYYY-MM-DD). OSHA publishes
   * weeks after the fact, so this, not the event date, decides what's "new" for the morning email.
   */
  firstSeen: { inspection?: string; citation?: string };
};

export type LeadKind = "inspection" | "citation";

export type Lead = {
  /** Stable per inspection, e.g. "osha:1234567". */
  id: string;
  vertical: string;
  activityNr: string;
  /** "inspection" = opened, no citations yet; "citation" = citations issued. */
  kind: LeadKind;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  industry?: string;
  naics?: string;
  /** YYYY-MM-DD of the event: citation issuance date, else the inspection open date. */
  date: string;
  /** YYYY-MM-DD this lead first appeared in OSHA's published data. */
  published: string;
  openDate: string;
  inspectionType: string;
  scope?: string;
  employees?: number;
  union: boolean;
  /** The employer has already filed a notice of contest. */
  contested: boolean;
  /** Last date the cited hazards must be fixed by. */
  abateBy?: string;
  penalty: number;
  categories: string[];
  flags: string[];
  notes: string[];
  /** 0-100 urgency */
  heat: number;
};

/** What the UI needs to label leads, safe to pass to client components. */
export type VerticalLabels = {
  id: string;
  name: string;
  noun: { singular: string; plural: string };
  categories: Record<string, string>;
  flags: Record<string, string>;
};

export function labelsFor(v: Vertical): VerticalLabels {
  return {
    id: v.id,
    name: v.name,
    noun: v.noun,
    categories: Object.fromEntries(Object.entries(v.categories).map(([k, c]) => [k, c.label])),
    flags: Object.fromEntries(Object.entries(v.flags).map(([k, f]) => [k, f.label])),
  };
}
