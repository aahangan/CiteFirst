// Client for the U.S. Department of Labor open data API (v4), which serves OSHA enforcement data.
// Docs: https://dataportal.dol.gov (API user guide). Requests need a free key in DOL_API_KEY.
import { log } from "../log";

export type Row = Record<string, string>;

export type Condition = { field: string; operator: "eq" | "neq" | "gt" | "lt" | "in" | "not_in" | "like"; value: string | number | (string | number)[] };
export type Filter = Condition | { and: Filter[] } | { or: Filter[] };

export type DolQuery = {
  filter?: Filter;
  fields?: string[];
  sortBy?: string;
  sort?: "asc" | "desc";
};

export type DolOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  /** Rows per request. The API caps responses at 10,000 rows or 5 MB. */
  pageSize?: number;
  maxRows?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Minimum gap between requests. The API throttles bursts (about 10 quick requests, then minutes of 429s). */
  minIntervalMs?: number;
};

export class DolError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

const BASE = "https://apiprod.dol.gov/v4";

/**
 * Responses stop at 10,000 rows or 5 MB, whichever comes first, and a short page is how we detect
 * the end. 10,000 rows of the fields we request measure ~3.5 MB (inspections) and ~2.7 MB
 * (violations), under 5 MB, so a short page really is the end. Big pages matter: the quota is small.
 */
const PAGE_SIZE = 10_000;

/**
 * Requests from this process run strictly one at a time, `minIntervalMs` apart, whoever makes them:
 * the API rejects a key's requests with 403s when two overlap, and with 429s when they come too fast.
 */
let queue: Promise<unknown> = Promise.resolve();
let lastEnd = 0;
function serially<T>(minIntervalMs: number, sleep: (ms: number) => Promise<void>, fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastEnd + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastEnd = Date.now();
    }
  });
  queue = run.catch(() => {});
  return run;
}

/** The API gateway rejects longer URLs with a bare 403 {"message":"Forbidden"} (measured: ~2,050 chars fails). */
export const MAX_URL_LENGTH = 2_000;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The API returns numbers and nulls; leads only need strings. */
function toRow(raw: Record<string, unknown>): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(raw)) if (v !== null && v !== undefined && v !== "") row[k] = String(v).trim();
  return row;
}

/** The key must go in the query string: the API ignores an X-API-KEY header. Never log these URLs. */
export function requestUrl(agency: string, endpoint: string, q: DolQuery, page: { limit: number; offset: number }, base = BASE, apiKey?: string) {
  const params = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
  if (q.fields?.length) params.set("fields", q.fields.join(","));
  if (q.sortBy) params.set("sort_by", q.sortBy);
  if (q.sort) params.set("sort", q.sort);
  if (q.filter) params.set("filter_object", JSON.stringify(q.filter));
  if (apiKey) params.set("X-API-KEY", apiKey);
  return `${base}/get/${agency}/${endpoint}/json?${params}`;
}

/** One page, with a timeout and retries (exponential backoff) on rate limits, server errors and network failures. */
export async function dolPage(agency: string, endpoint: string, q: DolQuery, page: { limit: number; offset: number }, opts: DolOptions = {}): Promise<Row[]> {
  const apiKey = opts.apiKey ?? process.env.DOL_API_KEY;
  if (!apiKey) throw new DolError("DOL_API_KEY is not set");
  const doFetch = opts.fetch ?? ((input, init) => fetch(input, init));
  const sleep = opts.sleep ?? wait;
  const retries = opts.retries ?? 3;
  const url = requestUrl(agency, endpoint, q, page, opts.baseUrl, apiKey);
  if (url.length > MAX_URL_LENGTH) throw new DolError(`DOL ${endpoint}: request URL is ${url.length} chars, over the API's ${MAX_URL_LENGTH} limit`);

  for (let attempt = 0; ; attempt++) {
    let error: DolError | undefined;
    // Read the whole body inside the serial section, so the next request waits for it.
    const res = await serially(opts.minIntervalMs ?? 5_000, sleep, async () => {
      try {
        const r = await doFetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
          cache: "no-store",
        });
        return { status: r.status, ok: r.ok, text: await r.text() };
      } catch (err) {
        error = new DolError(`DOL ${endpoint}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    });
    if (res?.ok) {
      const body = JSON.parse(res.text) as unknown;
      const data = Array.isArray(body) ? body : (body as { data?: unknown } | null)?.data;
      if (!Array.isArray(data)) throw new DolError(`Unexpected response shape from ${endpoint}`);
      return data.map((r) => toRow(r as Record<string, unknown>));
    }
    if (res) {
      const text = res.text.slice(0, 200);
      error = new DolError(`DOL ${endpoint} ${res.status}: ${text}`, res.status);
      // Bad requests and auth failures won't fix themselves; only retry rate limits and server errors.
      if (res.status !== 429 && res.status < 500) throw error;
    }
    if (attempt >= retries) throw error!;
    const delayMs = (error!.status && error!.status < 500 ? 30_000 : 2_000) * 2 ** attempt;
    log.warn("dol.retry", { endpoint, attempt: attempt + 1, delayMs, error: error!.message });
    await sleep(delayMs);
  }
}

/** Every matching row up to `maxRows`, fetched in pages. Logs a warning if the cap cut results off. */
export async function dolQueryAll(agency: string, endpoint: string, q: DolQuery, opts: DolOptions = {}): Promise<Row[]> {
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const maxRows = opts.maxRows ?? 50_000;
  const rows: Row[] = [];
  while (rows.length < maxRows) {
    const limit = Math.min(pageSize, maxRows - rows.length);
    const page = await dolPage(agency, endpoint, q, { limit, offset: rows.length }, opts);
    rows.push(...page);
    if (page.length < limit) return rows;
  }
  log.warn("dol.truncated", { endpoint, maxRows });
  return rows;
}

/**
 * Looks up rows whose `field` is one of `values` with `in` filters, packing as many values into each
 * request as fit under the API's URL length limit (at most `batchSize`).
 */
export async function dolQueryIn(agency: string, endpoint: string, field: string, values: string[], q: Omit<DolQuery, "filter"> & { filter?: Filter }, opts: DolOptions & { batchSize?: number; maxRequests?: number; partialOnError?: boolean } = {}): Promise<Row[]> {
  const max = opts.batchSize ?? 500;
  const query = (vs: string[]): DolQuery => {
    const batch: Filter = { field, operator: "in", value: vs };
    return { ...q, filter: q.filter ? { and: [batch, q.filter] } : batch };
  };
  // Measure with a placeholder key of the real key's length, so the real URL fits too.
  const keyLength = (opts.apiKey ?? process.env.DOL_API_KEY ?? "").length;
  const fits = (vs: string[]) => requestUrl(agency, endpoint, query(vs), { limit: 99999, offset: 99999 }, opts.baseUrl, "k".repeat(keyLength)).length <= MAX_URL_LENGTH;

  const out: Row[] = [];
  let i = 0;
  let requests = 0;
  while (i < values.length && requests++ < (opts.maxRequests ?? Infinity)) {
    let n = 1;
    while (n < max && i + n < values.length && fits(values.slice(i, i + n + 1))) n++;
    try {
      out.push(...(await dolQueryAll(agency, endpoint, query(values.slice(i, i + n)), opts)));
    } catch (err) {
      if (!opts.partialOnError) throw err;
      log.warn("dol.partial", { endpoint, fetched: i, of: values.length, error: err instanceof Error ? err.message : String(err) });
      break;
    }
    i += n;
  }
  return out;
}

/** Columns from `required` that no row has: a sign the feed's schema changed. */
export function missingColumns(rows: Row[], required: string[]) {
  if (!rows.length) return [];
  return required.filter((c) => !rows.some((r) => c in r));
}
