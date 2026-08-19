# Task ledger

Claude authors every task; Codex implements against the prompt as written.
Statuses: `open` (handed over) · `in review` (PR open) · `merged` · `dropped`.

Full prompts live with the task. If a prompt turns out to be ambiguous, that is a
defect in the task, not in the implementation — say so in the PR and it gets
rewritten.

| ID | Title | Lane | Status | PR |
| --- | --- | --- | --- | --- |
| CDX-001 | DB-backed integration test suite for auth, billing and allowance | QA | **merged** | #2 |
| CDX-002 | Channels screen for FR-2, with proper loading, empty and error states | UI/UX | open | — |

---

### Commit attribution

Both agents authenticate to GitHub as , so the PR page cannot tell
them apart. Keep the shared account for auth, but set a distinct **git author** so
the history stays truthful:

| Agent |  |
| --- | --- |
| Claude | , plus a  trailer |
| Codex |  |

Shehryar Ahmed FR-2: channel connection via YouTube OAuth (core) (#4)
Shehryar Ahmed CDX-001: add DB-backed auth, billing and allowance integration tests (#2)
star-anonymus docs: sequence deployment after the build, record what it does and does not block
Shehryar Ahmed docs: deployment runbook for a subdomain on an existing VPS (#3)
Shehryar Ahmed FR-1.2: Google sign-in (#1)
star-anonymus Phase 0: standalone foundation should make authorship obvious without opening a diff.

## Claude's parallel track

Not Codex work. Listed so the two lanes do not collide.

| Item | Phase | Status |
| --- | --- | --- |
| FR-1.2 Google OAuth sign-in | 0 (carried) | **merged** (#1) |
| Deployment runbook | infra | **merged** (#3) |
| FR-2 Channel connection, YouTube OAuth | 1 | **merged** (#4) — API only, UI is CDX-002 |
| FR-2.5 full history import (back catalogue) | 1 | next — FR-9 duplicate detection needs it |
| Gate G1 live verification | 1 | blocked on Google OAuth client credentials |
| Lease-based reclaim to replace reclaim-on-boot | infra | deferred — single worker is correct for now |

### Sequencing note — deployment is deliberately deferred

The product ships before it is hosted. A domain and public deployment are a
launch concern, and blocking build progress on them would be the wrong trade.

What this does **not** block: FR-2 development. A Google Cloud OAuth client with
`http://localhost` origins needs no consent-screen verification and allows up to
100 test users, which is ample for building and testing channel connection.

What it **does** block, and therefore must be resolved before launch:

- Google consent-screen verification, which is domain-bound and slow — and
  slower still for YouTube scopes, which Google treats as sensitive
- Stripe live mode and its webhook endpoint
- Any email sent to a real creator

Revisit at the end of Phase 1, which is when Google verification needs to be
in flight to avoid it becoming the critical path. Tracked as SRS open issue 6.

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
