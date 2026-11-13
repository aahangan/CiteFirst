import { describe, expect, it } from "vitest";
import type { Lead } from "@/engine/schema";
import { stateFromSlug, stateSlug, summarize, topicSlug } from "./report";
import { weeklyEmail } from "./weekly";

const lead = (id: string, o: Partial<Lead> = {}): Lead => ({
  id: `osha:${id}`, vertical: "safety", activityNr: id, kind: "citation", name: id, address: "", city: "Houston", state: "TX", zip: "", date: "2026-10-05",
  published: "2026-10-05", openDate: "2026-08-01", inspectionType: "Complaint", union: false, contested: false, penalty: 0,
  categories: ["serious"], flags: [], notes: [], heat: 50, ...o,
});

describe("state reports", () => {
  it("round-trips state slugs and slugs topic names", () => {
    expect(stateSlug("NY")).toBe("new-york");
    expect(stateFromSlug("new-york")).toBe("NY");
    expect(stateFromSlug("narnia")).toBeUndefined();
    expect(topicSlug("Lockout/tagout")).toBe("lockout-tagout");
    expect(topicSlug("Powered industrial trucks (forklifts)")).toBe("powered-industrial-trucks");
  });

  it("counts each standard once per employer and ranks the largest penalties", () => {
    const r = summarize("TX", [
      lead("1", { penalty: 5000, notes: ["1926.501(b)(13) · Serious · $2,500", "1926.501(b)(1) · Serious · $2,500"] }),
      lead("2", { penalty: 90000, notes: ["1926.501(b)(13) · Serious · $90,000"] }),
      lead("3", { kind: "inspection", city: "Dallas" }),
    ]);
    expect(r).toMatchObject({ cited: 2, open: 1, penalties: 95000 });
    expect(r.standards[0]).toEqual({ name: "Fall protection", count: 2 });
    expect(r.biggest.map((l) => l.id)).toEqual(["osha:2", "osha:1"]);
    expect(r.openCases.map((l) => l.id)).toEqual(["osha:3"]);
  });

  it("builds the weekly email, and skips quiet weeks", () => {
    const sub = { email: "a@x.test", state: "TX", confirmed: true, createdAt: 0 };
    const email = weeklyEmail("TX", [lead("1", { penalty: 12000, industry: "Construction", notes: ["1926.501(b)(13) · Serious · $12,000"] })], "https://s.test", sub);
    expect(email?.subject).toBe("Texas OSHA this week: 1 employer cited, $12,000 in penalties");
    expect(email?.html).toContain("Construction employer in Houston: $12,000, cited for fall protection");
    expect(email?.html).toContain("/api/weekly/unsubscribe?token=");
    expect(weeklyEmail("TX", [], "https://s.test", sub)).toBeNull();
  });
});
