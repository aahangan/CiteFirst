import { describe, expect, it } from "vitest";
import { dolPage, dolQueryAll, dolQueryIn, MAX_URL_LENGTH, requestUrl } from "./sources/dol";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const noSleep = async () => {};
// No pacing in tests.
const fast = { minIntervalMs: 0 };

describe("DOL client", () => {
  it("builds v4 URLs with filters, fields and paging", () => {
    const url = new URL(requestUrl("OSHA", "inspection", { filter: { field: "open_date", operator: "gt", value: "2026-09-01" }, fields: ["activity_nr", "open_date"] }, { limit: 10, offset: 20 }));
    expect(url.pathname).toBe("/v4/get/OSHA/inspection/json");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("fields")).toBe("activity_nr,open_date");
    expect(JSON.parse(url.searchParams.get("filter_object")!)).toEqual({ field: "open_date", operator: "gt", value: "2026-09-01" });
  });

  it("sends the key as a query parameter and stringifies values", async () => {
    let url = "";
    const rows = await dolPage("OSHA", "inspection", {}, { limit: 10, offset: 0 }, {
      ...fast, apiKey: "k",
      fetch: async (u) => { url = String(u); return json({ data: [{ activity_nr: 123, nr_in_estab: null, estab_name: " ACME " }] }); },
    });
    expect(new URL(url).searchParams.get("X-API-KEY")).toBe("k");
    expect(rows).toEqual([{ activity_nr: "123", estab_name: "ACME" }]);
  });

  it("retries rate limits and server errors, but not bad requests", async () => {
    let calls = 0;
    const flaky = async () => (++calls < 3 ? json({ error: "busy" }, calls === 1 ? 429 : 503) : json([{ a: 1 }]));
    expect(await dolPage("OSHA", "x", {}, { limit: 1, offset: 0 }, { ...fast, apiKey: "k", fetch: flaky, sleep: noSleep })).toEqual([{ a: "1" }]);
    expect(calls).toBe(3);

    calls = 0;
    const bad = async () => { calls++; return json({ error: "bad filter" }, 400); };
    await expect(dolPage("OSHA", "x", {}, { limit: 1, offset: 0 }, { ...fast, apiKey: "k", fetch: bad, sleep: noSleep })).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });

  it("retries network errors and gives up after the retry limit", async () => {
    let calls = 0;
    const down = async () => { calls++; throw new TypeError("fetch failed"); };
    await expect(dolPage("OSHA", "x", {}, { limit: 1, offset: 0 }, { ...fast, apiKey: "k", fetch: down, sleep: noSleep, retries: 2 })).rejects.toThrow(/fetch failed/);
    expect(calls).toBe(3);
  });

  it("fails clearly without a key", async () => {
    const prev = process.env.DOL_API_KEY;
    delete process.env.DOL_API_KEY;
    await expect(dolPage("OSHA", "x", {}, { limit: 1, offset: 0 })).rejects.toThrow(/DOL_API_KEY/);
    process.env.DOL_API_KEY = prev;
  });

  it("pages until a short page", async () => {
    const offsets: string[] = [];
    const rows = await dolQueryAll("OSHA", "x", {}, {
      ...fast, ...fast, apiKey: "k", pageSize: 2,
      fetch: async (u) => {
        const off = new URL(String(u)).searchParams.get("offset")!;
        offsets.push(off);
        return json(off === "4" ? [{ i: 4 }] : [{ i: off }, { i: off }]);
      },
    });
    expect(offsets).toEqual(["0", "2", "4"]);
    expect(rows).toHaveLength(5);
  });

  it("batches `in` lookups", async () => {
    const filters: unknown[] = [];
    await dolQueryIn("OSHA", "inspection", "activity_nr", ["1", "2", "3"], {}, {
      ...fast, ...fast, apiKey: "k", batchSize: 2,
      fetch: async (u) => { filters.push(JSON.parse(new URL(String(u)).searchParams.get("filter_object")!)); return json([]); },
    });
    expect(filters).toEqual([{ field: "activity_nr", operator: "in", value: ["1", "2"] }, { field: "activity_nr", operator: "in", value: ["3"] }]);
  });

  it("keeps `in` lookups under the URL length limit", async () => {
    const ids = Array.from({ length: 400 }, (_, i) => String(340_000_000 + i));
    const urls: string[] = [];
    const rows = await dolQueryIn("OSHA", "inspection", "activity_nr", ids, { fields: ["activity_nr", "open_date"] }, {
      ...fast, apiKey: "x".repeat(43),
      fetch: async (u) => { urls.push(String(u)); return json([]); },
    });
    expect(rows).toEqual([]);
    expect(urls.length).toBeGreaterThan(3);
    expect(Math.max(...urls.map((u) => u.length))).toBeLessThanOrEqual(MAX_URL_LENGTH);
    const sent = urls.flatMap((u) => (JSON.parse(new URL(u).searchParams.get("filter_object")!) as { value: string[] }).value);
    expect(sent).toEqual(ids);
  });

  it("refuses to send a URL the API would reject", async () => {
    const long = Array.from({ length: 300 }, (_, i) => String(i));
    await expect(dolPage("OSHA", "x", { filter: { field: "a", operator: "in", value: long } }, { limit: 1, offset: 0 }, { ...fast, apiKey: "k", fetch: async () => json([]) })).rejects.toThrow(/over the API/);
  });
});
