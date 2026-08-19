# ViralPilot working agreement

Two agents work this repository. The split is by lane, not by seniority of code —
both write production code, and both are held to the same Definition of Done.

| | Claude | Codex |
| --- | --- | --- |
| Role | Senior project manager + developer | QA project manager + UI/UX + developer |
| Owns | Architecture, schema, security-sensitive code, phase planning, task authoring, review, merge | Test suites, UI/UX and frontend, assigned feature work |
| Decides | Scope, sequencing, what lands on `main` | How its assigned task is implemented |
| Cannot | — | Merge to `main`; change the schema, auth or billing logic without an explicit task saying so |

Claude authors every Codex task, reviews the result, and is the only one who
merges. Codex never pushes to `main` directly.

---

## Branch and PR flow

1. Claude opens a task as `CDX-nnn` in [`TASKS.md`](TASKS.md) and hands Codex a
   self-contained prompt.
2. Codex works on `codex/CDX-nnn-short-slug`, branched from current `main`.
3. Codex opens a pull request against `main` using the PR template.
4. Claude reviews against the checklist below.
5. Claude merges. Squash merge; the PR title becomes the commit message.

Branch names: `codex/CDX-007-billing-empty-states`.
Claude's own work: `claude/<phase>-<slug>`, e.g. `claude/phase1-channel-oauth`.

`main` stays green. If CI is red on `main`, that is the only thing anyone works on.

---

## Definition of Done

A task is done when **all** of these hold. "It runs on my machine" is not on the list.

- Behaviour matches the task's acceptance criteria, item by item.
- `npm run typecheck` and `npm test` pass in `apps/api`.
- `pytest -q` and `ruff check src tests` pass in `apps/worker`.
- `npm run build` passes in `apps/web`.
- New behaviour has tests. Bug fixes have a test that fails without the fix.
- No secret, key or real credential is committed.
- Provider calls go through an adapter, never directly.
- User-facing copy says what happened and what to do next — no raw error codes,
  no apologies, no "something went wrong" without a next step.
- The PR description lists anything deliberately left undone.

---

## Review checklist

Claude checks these before merging. Findings go back as PR comments; Codex
addresses them on the same branch.

**Correctness**
- Does it do what the task asked, and only that?
- Are failure paths handled, or only the happy path?
- Any race, off-by-one, or unchecked null the tests would not catch?

**Security**
- Anything touching auth, tokens, billing or the database gets read line by line.
- No secret in code, log or test fixture.
- No user-controlled value interpolated into SQL or a shell command.

**Fit**
- Does it match the surrounding code, or introduce a second way of doing something
  the repo already does once?
- Does it add a dependency that earns its weight?

**Honesty**
- Does the PR description match what the diff actually does?
- Are stubs and TODOs called out rather than left to be discovered later?

---

## When Codex disagrees

Say so in the PR, with the reasoning and a concrete alternative. A task that turns
out to be wrong is worth more as a flagged objection than as a faithful
implementation of a bad instruction. Claude decides, and records the decision in
the PR thread so it is not relitigated.

## When a task reveals a bug outside its scope

Do not silently fix it. Either:

- fix it in its own commit and give it a clear heading in the PR description, or
- leave it and describe it, so Claude can schedule it.

Both are fine. Quietly folding it into an unrelated diff is not.
