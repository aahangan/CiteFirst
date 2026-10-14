import { describe, expect, it } from "vitest";
import { defense } from "../verticals/defense";
import { safety } from "../verticals/safety";
import { inspections, violations } from "./__fixtures__/osha";
import { buildCases, inspectionInfo, stampFirstSeen } from "./cases";
import { caseToLead, casesToLeads, dedupeKey, scoreLead } from "./normalize";
import { formatStandard, standardName } from "./osha";

const NOW = new Date("2026-10-06T12:00:00Z").getTime();
// As if both were first published on Oct 5.
const cases = stampFirstSeen(buildCases(inspections, violations), [], "2026-10-05");
const byNr = (nr: string) => cases.find((c) => c.activityNr === nr)!;

describe("buildCases", () => {
  it("joins inspections with their non-deleted violations, once per inspection", () => {
    expect(cases.map((c) => c.activityNr)).toEqual(["1800001", "1700002", "1800003"]);
    const c = byNr("1700002");
    expect(c.items).toHaveLength(3);
    expect(c.penalty).toBe(16131 + 161323);
    expect(c.initialPenalty).toBe(16131 + 161323 + 1000);
    expect(c.issuanceDate).toBe("2026-09-29");
    expect(c.abateBy).toBe("2026-11-02");
  });

  it("cleans up names, zips and codes", () => {
    const c = byNr("1700002");
    expect(c).toMatchObject({ name: "Big Box Warehouse Inc", city: "Dallas", zip: "75201", industry: "Warehousing & delivery", employees: 300, union: true });
    expect(c.items[0]).toMatchObject({ standard: "1910.147(c)(4)(i)", standardName: "Lockout/tagout", type: "W" });
  });

  it("only keeps a known inspection when it has new violations", () => {
    const known = [inspectionInfo(inspections[1])!, { ...inspectionInfo(inspections[2])!, activityNr: "1500009" }];
    const built = buildCases([], violations, known);
    expect(built.map((c) => c.activityNr)).toEqual(["1700002"]);
  });
});

describe("stampFirstSeen", () => {
  const fresh = buildCases(inspections, violations);

  it("estimates publish dates on the first ingest from OSHA's typical lag, capped at today", () => {
    const first = stampFirstSeen(fresh, null, "2026-10-14");
    expect(first.find((c) => c.activityNr === "1700002")!.firstSeen).toEqual({ inspection: "2026-06-07", citation: "2026-10-14" });
    expect(first.find((c) => c.activityNr === "1800001")!.firstSeen).toEqual({ inspection: "2026-10-14" });
    const later = stampFirstSeen(fresh, null, "2026-12-01");
    expect(later.find((c) => c.activityNr === "1700002")!.firstSeen.citation).toBe("2026-11-01");
  });

  it("stamps new news today and keeps what was already seen", () => {
    // Yesterday: both inspections known, no citations yet.
    const before = stampFirstSeen(buildCases(inspections, []), null, "2026-10-01");
    const after = stampFirstSeen(fresh, before, "2026-10-14");
    expect(after.find((c) => c.activityNr === "1800001")!.firstSeen).toEqual({ inspection: "2026-10-01" });
    expect(after.find((c) => c.activityNr === "1700002")!.firstSeen).toEqual({ inspection: "2026-06-07", citation: "2026-10-14" });
  });
});

describe("standards", () => {
  it("formats OSHA's compact standard codes", () => {
    expect(formatStandard("19260501 B13")).toBe("1926.501(b)(13)");
    expect(formatStandard("19101200 E01")).toBe("1910.1200(e)(1)");
    expect(formatStandard("296-863-60005(1)")).toBe("296-863-60005(1)");
  });

  it("names common standards and leaves others blank", () => {
    expect(standardName("1926.501(b)(13)")).toBe("Fall protection");
    expect(standardName("1910.1200(e)(1)")).toBe("Hazard communication");
    expect(standardName("1904.39(a)")).toBe("Injury and illness recordkeeping");
    expect(standardName("1915.77")).toBeUndefined();
  });
});

describe("caseToLead", () => {
  it("turns a cited case into a citation lead dated by when it was published", () => {
    const l = caseToLead(byNr("1700002"), safety, NOW)!;
    expect(l).toMatchObject({ id: "osha:1700002", kind: "citation", date: "2026-09-29", published: "2026-10-05", abateBy: "2026-11-02", contested: false, state: "TX" });
    expect(l.categories).toEqual(["accident", "willful", "serious", "other"]);
    expect(l.flags).toEqual(["abatementDue", "penalty25k", "largeEmployer"]);
    expect(l.notes[0]).toContain("Lockout/tagout · Willful · $161,323");
  });

  it("drops the abatement flag once the fix-by date passes", () => {
    const late = caseToLead(byNr("1700002"), safety, new Date("2026-11-03T12:00:00Z").getTime())!;
    expect(late.flags).not.toContain("abatementDue");
  });

  it("makes open unprogrammed inspections leads before any citation", () => {
    const l = caseToLead(byNr("1800001"), safety, NOW)!;
    expect(l).toMatchObject({ kind: "inspection", date: "2026-10-02", categories: ["complaint"], flags: [], abateBy: undefined });
    expect(l.notes[0]).toMatch(/Complaint inspection opened 2026-10-02 · partial scope\. No citations/);
  });

  it("skips programmed inspections without citations", () => {
    expect(caseToLead(byNr("1800003"), defense, NOW)).toBeNull();
    expect(caseToLead(byNr("1800003"), safety, NOW)).toBeNull();
  });

  it("uses each vertical's own flags and weights", () => {
    const l = caseToLead(byNr("1700002"), defense, NOW)!;
    expect(l.flags).toEqual(["penalty100k", "largeEmployer"]);
    expect(l.vertical).toBe("defense");
  });
});

describe("casesToLeads", () => {
  it("filters by publish date and sorts hottest first", () => {
    expect(casesToLeads(cases, safety, { now: NOW, from: "2026-10-01" }).map((l) => l.activityNr)).toEqual(["1700002", "1800001"]);
    expect(casesToLeads(cases, safety, { now: NOW, from: "2026-10-05" })).toEqual([]);
  });

  it("scores freshness from the publish date", () => {
    const l = caseToLead(byNr("1800001"), safety, NOW)!;
    expect(scoreLead({ ...l, published: "2026-10-05" }, safety, NOW)).toBeGreaterThan(scoreLead({ ...l, published: "2026-09-10" }, safety, NOW));
  });

  it("dedupes inspections and citations separately, so a citation on a known inspection is still news", () => {
    const inspection = caseToLead(byNr("1800001"), safety, NOW)!;
    expect(dedupeKey(inspection, safety)).toBe("osha:1800001:inspection");
    expect(dedupeKey({ ...inspection, kind: "citation" }, safety)).toBe("osha:1800001:citation");
  });
});
