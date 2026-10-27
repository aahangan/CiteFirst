# CiteFirst

Daily lead service built on public OSHA enforcement data. Every morning it reads the Department of Labor's
OSHA inspection and violation feeds, joins each inspection with its citations, scores each case by severity,
penalty and employer size, and delivers the newly published ones through a dashboard and a 7am email.

Built and maintained by [Aahan Gandhi](https://github.com/aahangan). Forked from the
[RatSignal](https://github.com/aahangan/RatSignal) lead engine. Not affiliated with OSHA or the U.S. Department of Labor.

Two lead products ("verticals") run on the same data:

| Vertical | Sold to | Emphasis |
|---|---|---|
| `safety` (default) | Safety consultants and training providers | Open accident/complaint/referral inspections, repeat and serious citations, hazards still to fix |
| `defense` | OSHA defense and employment attorneys | Fatality and accident investigations, willful/repeat citations, large penalties |

## Data timing (measured Oct 14, 2026)
OSHA publishes with a lag: inspections appear in the DOL API **3-4 weeks after they open**, citations
**4-5 weeks after they're issued**. Employers have 15 working days from receiving a citation to contest it, so
citations essentially always arrive after that window closes; the product makes no contest-deadline claims.
Inspections usually take months to reach citations, so open inspections still arrive mid-investigation.

## What a lead is
One OSHA inspection (`activity_nr`), in one of two states:
- **Inspection**: an unprogrammed inspection (fatality/catastrophe, accident, complaint, referral, follow-up)
  that has opened but has no citations yet.
- **Citation**: citations were issued. Includes violation types, cited standards (decoded for the common ones),
  current penalty, whether it was contested, and the abatement (fix-by) date.

Leads are dated by when they **first appeared in OSHA's published data** (`firstSeen`, carried from one daily
snapshot to the next), not by the event date. That's what makes "new this morning" meaningful despite the lag.
Each kind is delivered once (`dedupeKey` `{id}:{kind}`), so a citation on an inspection the customer already saw is still news.

## Architecture

```
src/verticals/*.ts        one config file per vertical (validated with Zod): categories, flags, weights, email + outreach copy
src/engine/schema.ts      config schema, OshaCase and Lead types
src/engine/sources/dol.ts DOL open data API v4 client: filters, paging, batched `in` lookups, timeouts, retries with backoff
src/engine/cases.ts       fetch inspections opened + violations issued in the window, look up older cited inspections, join, stamp firstSeen
src/engine/osha.ts        code tables (inspection/violation types, NAICS sectors, standards)
src/engine/normalize.ts   cases -> a vertical's scored leads (pure, unit tested)
src/engine/run.ts         the daily delivery run: idempotent, time-boxed, per-vertical isolation, alerts
src/lib/cases.ts          daily snapshot of cases in Redis, one key per state; pages read this, never the API
src/lib/runtime.ts        wires the run to the ingest, Redis and email
```

### The daily run
`/api/cron/digest` is called by Vercel Cron at 11:00 UTC (about 7am New York). If that morning's ingest
hasn't landed, it retries hourly (`?wait=1`) and sends regardless at 15:00 UTC.
- **Ingest:** re-reads the last 75 days from the DOL API (inspections of lead-worthy types opened, violations issued,
  plus the older inspections those violations belong to, unless yesterday's snapshot already has them) and
  rewrites the per-state snapshot, stamping anything new with today's date. An empty fetch keeps yesterday's
  snapshot. Runs as `npm run ingest` from GitHub Actions (`.github/workflows/ingest.yml`), not in the web app.
- **Delivery:** the Vercel cron reads the snapshot; it alerts if the morning's ingest didn't run.

### DOL API quirks (measured)
- The key only works as the `X-API-KEY` **query parameter**; the header is ignored.
- URLs longer than ~2,000 characters get a bare `403 {"message":"Forbidden"}`, so `in` lookups are packed to fit.
- The quota is small: about 10 requests, then `429`s for a long time (up to the rest of the hour). Requests go
  strictly one at a time, 5 s apart, with long backoff. A normal day needs ~5 (inspections + violations at
  10,000 rows a page, plus a lookup or two). Older inspections that couldn't be looked up are retried on the
  next run, so the very first load fills in over a few days.
- Responses cap at 10,000 rows or 5 MB; our rows measure ~3.5 MB per 10,000, so a short page reliably means the end.
- **Who gets what:** each account gets the leads in its states first published in the last 4 days that it hasn't been
  sent, minus states another firm holds exclusively.
- **Safe re-runs:** each account is claimed once per date in Redis and every delivered lead is remembered for 90 days,
  so running twice, or backfilling, never sends duplicates.
- **Monitoring:** structured logs, plus email alerts to `ADMIN_EMAILS` when the feed returns zero rows, a column
  disappears, the feed fails, or a run is partial. Recent runs and the last ingest are shown on `/admin`.

Backfill missed days (skips days that already completed unless `--force`):
```
CITEFIRST_ADMIN_SECRET=... npm run backfill -- --from 2026-10-01 --to 2026-10-05 [--dry-run]
```

Load today's data by hand (e.g. locally after adding `DOL_API_KEY`):
```
curl -H "Authorization: Bearer $ADMIN_SECRET" "http://localhost:3000/api/cron/digest?force=1"
```

## Development
```
cp .env.example .env.local   # SESSION_SECRET and DOL_API_KEY are needed locally
npm install
npm run dev
npm test                     # Vitest unit tests
npm run lint && npm run typecheck
```
Without Stripe keys, signing up creates a free development account. Without Resend, emails are printed to the
server console. Locally, data is stored in `.data/db.json` instead of Redis.

## Stack
Next.js, TypeScript, Stripe, Upstash Redis, Resend, Zod, Vitest, Claude API, U.S. DOL open data API (OSHA).
