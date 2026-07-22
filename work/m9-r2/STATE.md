# M9-R2 State

## Goal

Complete full-role derived action control, exact-frame zero-duration switch events,
and verified enter/exit star-carry derivation without guessing unresolved rules.

## Baseline

- Branch: `master`
- M9-R1 commit: `35860de`
- Product-plan edits in `DEVELOPMENT_PLAN.md` and `PROJECT_MANUAL.md` are preserved.
- Existing untracked `work/m8/` is unrelated and must remain untouched.

## Phases

1. M9-R2A: derived-control audit and shared decision contract. Complete.
2. M9-R2B: input selection plus resource/state runtime resolution and inspector. Complete.
3. M9-R2C: zero-duration exact-frame switch model, migration, runtime, and visual. Complete.
4. M9-R2D: switch trigger bindings, derived star-carry actions, replay/E2E/release gate. Complete.

## Current

- Phase: M9-R2 complete; waiting for product acceptance.
- Audit denominator: 20 actors, 154 public action references, 136 derived controls,
  63 multi-player/resource-map controls, zero silent omissions.
- Semantic input selections persist by selector identity; verified charge tiers update
  subskill, duration, hits, and effects in one edit. Resource/state branches retain
  runtime priority and read-only provenance.
- Switches persist as exact-frame, zero-duration events, do not occupy ordinary action
  ranges, and reject same-frame conflicts deterministically. Legacy 600ms switches keep
  their start frame and do not shift later actions. The timeline projects a fixed avatar
  marker that remains selectable, movable, and removable.
- Switch trigger catalog: 20 actor profiles, 17 applied and 3 static evidence gaps;
  11 on-enter and 9 on-exit identities remain fully auditable.
- Exact-frame switches now derive read-only star-carry children with real timing, hits,
  cooldowns, effects, and owner identity. Five carriers persist only the parent event.
- Next: stop and wait for product acceptance. Do not enter a new milestone.

## Verification

- Baseline from M9-R1: 120 test files / 664 tests; production preview 50/50.
- M9-R2A focused tests: 2 files / 15 tests; verified-combat drift clean.
- M9-R2B focused tests: 4 files / 34 tests; production build and bundle audit pass.
- M9-R2C focused tests: 8 files / 186 tests pass, including exact-frame insertion
  inside an occupied ordinary action range.
- M9-R2C desktop and narrow browser checks: marker, operation axis, and action blocks do
  not overlap; screenshots are recorded under `reports/m9-r2c-switch-event-*.png`.
- M9-R2C production build and bundle audit pass: Workbench 351,510B gzip; total
  JavaScript 731,960B gzip, both below hard limits.
- M9-R2D focused browser flow covers one enter and one exit child, move, undo/redo,
  save/reload, and desktop/narrow rendering.
- Full `npm run test:trial-release`: 125 test files / 691 tests, 51/51 production
  preview and 41/41 required capabilities. Workbench 354,059B gzip; total JavaScript
  735,571B gzip, below the 370,000B / 740,000B hard limits.
