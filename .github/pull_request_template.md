## Task

<!-- CDX-nnn, or the phase item this implements. Link to docs/TASKS.md. -->

## What changed

<!-- What a reviewer needs to know to read the diff, not a restatement of it. -->

## Acceptance criteria

<!-- Copy the criteria from the task and tick them off honestly. -->

- [ ]
- [ ]

## Checks

- [ ] `apps/api`: `npm run typecheck` and `npm test` pass
- [ ] `apps/worker`: `pytest -q` and `ruff check src tests` pass
- [ ] `apps/web`: `npm run build` passes
- [ ] New behaviour is covered by tests; any bug fix has a test that fails without it
- [ ] No secrets, keys or real credentials in the diff

## Deliberately not done

<!-- Anything skipped, stubbed or deferred. "Nothing" is a valid answer.
     Discovering this in review instead of here costs a round trip. -->

## Bugs found outside this task's scope

<!-- Per docs/WORKFLOW.md: fix in a separate commit and describe it here,
     or leave it and describe it. Do not fold it in silently. -->
