# AI YouTube Automation Platform

Standalone product of Quantum Synergy Solutions. Helps established YouTube creators
produce and publish video without putting the channel's monetisation at risk.

This repository currently contains **Phase 0 — Standalone foundation** (SRS v1.1, weeks 1–3):
authentication and accounts (FR-1), subscriptions, billing and quota (FR-12), and the
cross-language job queue that later phases run generation work on.

Design documents live in [`docs/`](docs/); diagram sources in [`docs/diagrams/`](docs/diagrams/).
Deployment to a subdomain on an existing VPS: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Layout

```
apps/
  api/        Node 22 + Express + TypeScript + Prisma   — REST API
  worker/     Python 3.11                                — job consumer
  web/        React 18 + Vite + TypeScript               — web application
contracts/    Plan catalogue and job protocol, shared by the API and the worker
infra/        nginx config for the web image
docs/         SRS, proposal, business model, UML diagrams
```

`contracts/` is the single source of truth for anything both runtimes must agree on.
`plans.json` holds pricing and allowances; `jobs.json` documents the queue protocol.

---

## Why the queue is not BullMQ

The generation workers are Python (SRS §5.1), so the queue has to be readable from
both Node and Python. `contracts/jobs.json` defines a small Redis list protocol instead:

| Key | Purpose |
| --- | --- |
| `q:default` | pending jobs, `LPUSH` by the API |
| `q:default:processing` | in-flight, entered by `BRPOPLPUSH` |
| `q:default:dead` | exhausted retries and permanently invalid jobs |
| `job:{id}` | status hash, 7-day TTL |

`BRPOPLPUSH` moves a job between the first two lists atomically, so a crashed worker
leaves the job visible in `processing` rather than losing it. On boot the worker
returns anything stranded there to `pending` — which is correct for a single worker
and wrong for several, so set `WORKER_RECLAIM_ON_START=0` before scaling out and
replace it with lease expiry driven by a per-job heartbeat.

### DATABASE_URL is shared, and the two runtimes disagree about it

Prisma accepts `?schema=public`; libpq rejects it outright. The worker normalises
the URL (`worker.db.normalise_dsn`) — `schema` becomes `options=-c search_path=…`
and Prisma-only pool parameters are dropped — so one `DATABASE_URL` serves both.

---

## Running it

### Prerequisites

Node 22, Python 3.11, and either Docker or local PostgreSQL 16 + Redis 7.

### 1. Configure

```bash
cp .env.example .env
```

Fill in at minimum `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (32+ characters each)
and your Stripe **test mode** keys. The API refuses to boot on invalid configuration
rather than failing at the first request that needs a value.

### 2. With Docker

```bash
docker compose up --build
```

### 3. Without Docker

Start PostgreSQL and Redis yourself, then in three terminals:

```bash
cd apps/api && npm install && npx prisma migrate deploy && npm run dev
```

```bash
cd apps/worker
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
PYTHONPATH=src .venv/Scripts/python -m worker
```

`PYTHONPATH=src` is required outside Docker; the worker image sets it itself.

```bash
cd apps/web && npm install && npm run dev
```

API on `http://localhost:4300`, web on `http://localhost:5273`.

### Stripe webhooks in development

```bash
stripe listen --forward-to localhost:4300/api/billing/webhook
```

Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`. Create four recurring test
prices ($29 / $79 / $199 / $399) and put their ids in the `STRIPE_PRICE_*` variables.

---

## Gate G0

> A user signs up, subscribes through Stripe in test mode, and a dummy job runs
> end to end through the queue.

With all three services running:

```bash
node scripts/verify-g0.mjs
```

The script registers a user, confirms an unverified account is refused, verifies the
email, signs in, checks that a replayed refresh token is rejected, reads the plan
catalogue and allowance, enqueues a probe job, polls until the worker reports success,
then drains the free plan's three videos and asserts a `402 allowance_exhausted`.
It exits non-zero on the first failure.

Last run against PostgreSQL 18.1 and Redis 7.2.5: **12 checks passed, 0 failed.**

The Stripe leg is deliberately manual — it needs a real card entry in test mode:

1. Sign in at `http://localhost:5273`
2. Billing → choose Creator → complete checkout with card `4242 4242 4242 4242`
3. Confirm the dashboard shows plan `CREATOR` with 30 videos

---

## Known behaviour worth keeping in mind

- A failing job retries with linear backoff and is dead-lettered on the third
  attempt. Verified live: `FAILED (1 attempt)` → `DEAD (3 attempts)`, with the
  payload in `q:default:dead` and `processing` back to empty.
- The worker sleeps during backoff rather than using a delayed set. Acceptable at
  Phase 0 volumes; revisit when a stalled job would block real throughput.
- The dashboard polls every two seconds. Whether that becomes a WebSocket is still
  an open question in the SRS.

## Gate G1

> A real YouTube channel connects by OAuth, tokens survive a refresh cycle, and
> history imports.

**Met on 19 August 2026** against a live channel, verified end to end rather than
by mocks. Two scripts reproduce the check once a channel is connected:

```bash
cd apps/api
npx tsx scripts/g1-tokens.ts     # tokens are encrypted at rest, scopes stored
npx tsx scripts/g1-refresh.ts    # tokens survive a refresh cycle
```

`g1-refresh.ts` is the one worth keeping. It expires the stored token, requests a
new one, and asserts six things — that a usable token came back, that it changed,
that the **stored ciphertext was replaced**, that the expiry moved forward, that
`lastRefreshedAt` was recorded, and that the **refresh token was preserved**.

That last check matters more than it looks: Google omits the refresh token on
renewal, so keeping the existing one is the difference between a channel that
works indefinitely and one that dies silently after an hour.

## Tests

```bash
cd apps/api    && npm run typecheck && npm test
cd apps/worker && .venv/Scripts/python -m pytest -q && .venv/Scripts/python -m ruff check src tests
cd apps/web    && npm run build
```

CI runs all three on every push and pull request.

---

## Phase 0 requirement coverage

| Requirement | Status | Note |
| --- | --- | --- |
| FR-1.1 Email registration with verification | Done | Token hashed at rest; only the hash is stored |
| FR-1.2 Google OAuth sign-in | Done | ID-token flow; links to an existing account only when Google asserts the address is verified |
| FR-1.3 Password reset via time-limited token | Done | 60-minute expiry, revokes all sessions on use |
| FR-1.4 Profile, locale and account deletion | Partial | Soft delete and locale done; profile editing UI pending |
| FR-12.1 Stripe checkout and customer portal | Done | Webhook signature verified, replay-safe |
| FR-12.2 Enforce monthly allowance | Done | Atomic conditional update; no double-spend under concurrency |
| FR-12.3 Meter and bill overage | Partial | Metered to `UsageRecord`; invoicing lands with FR-13 |
| FR-12.4 Local payment methods | Not started | P2, pending demand validation (SRS open issue 3) |
| FR-12.5 Dunning, invoices, tax fields | Not started | Handled by the Stripe portal for now |

**All Phase 0 P0 requirements are now delivered.** FR-1.2 uses the Google Identity
Services ID-token flow, which is the right shape for sign-in. FR-2 (channel
connection) needs a different flow from the same OAuth client — the authorization
code flow with offline access and YouTube scopes — and lands in Phase 1.

Set `GOOGLE_CLIENT_ID` (API) and `VITE_GOOGLE_CLIENT_ID` (web) to enable it. Left
unset, the API route returns 501 and the web app simply does not render the button,
so a deployment without Google configured shows email sign-in only rather than a
control that fails when clicked.

---

## Security notes

- Passwords hashed with Argon2id. Login hashes a dummy value when the account is
  missing so response timing does not reveal which addresses are registered.
- Refresh tokens are rotated on every use and the presented token is revoked, so a
  stolen token fails on replay instead of granting a parallel session.
- Email verification and reset tokens are stored only as SHA-256 hashes.
- Access tokens are short-lived, and every authenticated request re-checks account
  status so suspension takes effect immediately rather than at token expiry.
- Stripe webhook events are recorded by id before the effect is applied, making
  redelivery idempotent.
- Google sign-in links to an existing password account **only** when Google asserts
  `email_verified`. Without that check, anyone able to present a token for an
  unverified address would inherit the matching account.
