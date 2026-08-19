# Task ledger

Claude authors every task; Codex implements against the prompt as written.
Statuses: `open` (handed over) · `in review` (PR open) · `merged` · `dropped`.

Full prompts live with the task. If a prompt turns out to be ambiguous, that is a
defect in the task, not in the implementation — say so in the PR and it gets
rewritten.

| ID | Title | Lane | Status | PR |
| --- | --- | --- | --- | --- |
| CDX-001 | DB-backed integration test suite for auth, billing and allowance | QA | open | — |

---

## Claude's parallel track

Not Codex work. Listed so the two lanes do not collide.

| Item | Phase | Status |
| --- | --- | --- |
| FR-1.2 Google OAuth sign-in | 0 (carried) | done — `claude/phase0-google-oauth` |
| FR-2 Channel connection, YouTube OAuth | 1 | not started |
| Lease-based reclaim to replace reclaim-on-boot | infra | not started |

---

## CDX-001 — DB-backed integration test suite

**Lane** QA · **Status** open · **Branch** `codex/CDX-001-integration-tests`

The API's current tests are hermetic: they never touch Prisma, so nothing verifies
that the auth and billing flows behave correctly against a real database. Phase 1
will be built on top of these flows, so they need real coverage first.

Acceptance criteria are in the handover prompt. Summary:

- `apps/api/tests/integration/` running against real PostgreSQL and Redis
- covers registration through verification, login, refresh rotation and replay
  rejection, password reset with session revocation, allowance consumption and
  exhaustion, Stripe webhook idempotency, and account deletion
- includes a concurrency test proving allowance cannot be double-spent
- wired into `.github/workflows/ci.yml`, which already declares the services
- existing hermetic tests keep passing and stay hermetic
