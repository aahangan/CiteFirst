import { describe, expect, it } from "vitest";
import { VerticalSchema } from "../engine/schema";
import { getVertical, VERTICAL_IDS, VERTICALS } from ".";
import { defense } from "./defense";

describe("vertical configs", () => {
  it.each(VERTICAL_IDS)("%s is a valid config", (id) => {
    expect(() => VerticalSchema.parse(VERTICALS[id])).not.toThrow();
  });

  it("falls back to the default vertical for unknown or missing ids", () => {
    expect(getVertical(undefined).id).toBe("safety");
    expect(getVertical("nope").id).toBe("safety");
    expect(getVertical("defense").id).toBe("defense");
  });

  const base = structuredClone(defense);

  it("rejects an inspection type that maps to an unknown category", () => {
    const bad = structuredClone(base);
    bad.leads.inspectionTypes.Z = "unicorns";
    expect(() => VerticalSchema.parse(bad)).toThrow(/unknown category.*unicorns/);
  });

  it("rejects a penalty threshold that sets an unknown flag", () => {
    const bad = structuredClone(base);
    bad.leads.penaltyFlags.push({ atLeast: 1, flag: "nope" });
    expect(() => VerticalSchema.parse(bad)).toThrow(/unknown flag/);
  });

  it("requires the dedupe key to include the lead id", () => {
    expect(() => VerticalSchema.parse({ ...base, dedupeKey: "{date}" })).toThrow(/\{id\}/);
  });
});
