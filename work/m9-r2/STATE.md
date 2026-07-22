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
2. M9-R2B: input selection plus resource/state runtime resolution and inspector.
3. M9-R2C: zero-duration exact-frame switch model, migration, runtime, and visual.
4. M9-R2D: switch trigger bindings, derived star-carry actions, replay/E2E/release gate.

## Current

- Phase: M9-R2A complete; M9-R2B next.
- Audit denominator: 20 actors, 154 public action references, 136 derived controls,
  63 multi-player/resource-map controls, zero silent omissions.
- Next: persist semantic input selection and resolve input/resource/state branches at action time.

## Verification

- Baseline from M9-R1: 120 test files / 664 tests; production preview 50/50.
- M9-R2A focused tests: 2 files / 15 tests; verified-combat drift clean.
