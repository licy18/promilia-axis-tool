# M12 Optimizer Primary Objectives

## Goal

Refactor the formal optimizer contract so the only primary objectives are:

1. `cycle-dps-no-toughness`
2. `cycle-dps-with-toughness`
3. `fastest-kill`

The legacy `damage`, `burst`, and `toughness` metrics remain diagnostic/compatibility-only and must never silently enter formal admission, trial release, or M12-C search.

This batch implements and verifies objective/runtime/protocol behavior only. It does not run formal optimization and does not unlock M12-C.

## Workspace Boundary

- Worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m12-optimizer-objectives`
- Branch: `feature/m12-optimizer-primary-objectives`
- Base: `8ced55eb0135b1edf3fd014bdaf4a2f0b03c79cf`
- Other worktrees and the main workspace are out of scope.

## Product Decisions

- Default formal objective is `cycle-dps-no-toughness`.
- All formal HP scores use post-defense settled HP damage.
- Both cycle objectives require accepted loop proof before producing a formal score.
- Toughness-enabled cycles must include current toughness, broken state, break/recovery timing, and all future-damage-affecting enemy state in closure.
- `fastest-kill` requires a structured, source-hashed enemy profile and ranks only real kill candidates by exact first lethal frame/time.
- All objectives use `m12c-zero-distance-passive-boss-v1`: distance 0, immediate projectile hits, stationary/non-attacking enemy, and no reactive dodge/parry/counter stimuli.
- Healing is diagnostic only: requested/effective/overheal/effective HPS, total and by source actor/action. Shield remains separate.
- Enemy level growth is owned by `feature/m12-b3-enemy-level`; this branch only consumes a strict structured enemy profile and must not invent or duplicate growth formulas.

## Current Status

- [x] Confirmed clean worktree, branch, and exact base.
- [x] Read repository `AGENTS.md`, M12 plan/manual sections, and `work/m12-b3/STATE.md`.
- [x] Confirmed M12-C/formal search remain locked and current global scenario policy is hash-bound.
- [x] Map current search/batch/cycle/CLI/schema/runtime/healing contracts.
- [x] Implement primary objective protocol and legacy downgrade.
- [x] Implement cycle-with-toughness and fastest-kill runtime semantics.
- [x] Add unified healing diagnostics.
- [x] Wire schemas, CLI, batch/search/report/hash/Workbench boundaries.
- [x] Complete focused/full verification.
- [x] Create the single cohesive commit; the final SHA is reported in the task handoff.

## Implemented Contracts

- `AzPrMachineAxisObjectiveContract` / `m12-primary-objectives-v1` freezes the three primary IDs, the three legacy-diagnostic IDs, exact scoring/proof/target semantics, and canonical hashes. Unknown, renamed, missing, extra, hash-drifted, or definition-drifted fields reject.
- `AzPrEnemyProfile` is a strict consumer contract for the independent `feature/m12-b3-enemy-level` output. It consumes, but does not calculate, resolved HP, DEF/MDEF, level, toughness, element defense and break rules plus source/hash provenance.
- `m12-enemy-settlement-runtime-v1` records current runtime packet order. Client-native order remains open, so `cycle-dps-with-toughness` and `fastest-kill` return no formal score and formal admission rejects with `machine-axis-enemy-settlement-client-order-open`. Diagnostic proof is available only through explicit internal opt-in.
- Fastest kill ranks real kills by first lethal frame, then time/cursor, reports requested/effective damage, overkill, action/hit, and rejects post-death HP/toughness settlement. Runtime death truncation is armed only by a structured enemy profile plus enabled target policy, preserving old finite-HP golden behavior.
- Cycle reports now include exact enemy packet settlements and state transitions inside `[start,end)`, enemy toughness/break/profile state in both boundary closures, and healing clipped to each cycle.
- Healing uses a strict settlement whitelist and reports requested/effective/overheal/effective HPS plus stable by-source-actor/action rows. Shields and suppressed/non-settled events are excluded.

## Verification Progress

- PASS: objective/enemy-settlement/enemy-profile/healing/kill unit suites (21 before later integration additions).
- PASS: verified runtime suite including two full break cycles, breaking-packet 1x, same-frame subsequent packet 2x, right-open exit, and finite-profile death truncation (35 tests).
- PASS: focused no-toughness and toughness cycle defense/packet tests. The same action packets preserve pre-defense values while settled score changes with DEF.
- PASS: search engine focused suite (6 tests).
- PASS: verified-combat generator write after scoping death truncation; only generated golden hashes changed, not old runtime totals.
- PASS: scenario policy regeneration (`policyHash=8af1aefabb228acf`).
- PASS: optimization qualification regeneration; `m12cLocked=true`, catalog hash `1949fdcb838eee88`.
- PASS: full cycle suite 36/36 after regenerating the committed acceptance report; batch/Workbench 17/17, including objective/profile JSON round-trip and healing report integration.
- PASS: legacy search acceptance boundaries 11/11 after explicitly selecting the legacy-diagnostic `damage` objective; this preserves the new formal default instead of weakening it.
- PASS: final objective/profile/settlement/healing/kill/search/report/CLI/qualification/runtime group 151/152 under parallel load; the only miss was an existing Workbench real-simulation test exceeding the default 5s at 5.9s. It now uses the file's established 30s boundary and passes 6/6 in isolation.
- PASS: `audit:verified-combat`, `audit:optimization-scenario-policy`, `audit:optimization-qualification`, `audit:production-imports:check`, and `audit:workbench-data:check`; qualification reports `m12cLocked=true`, catalog hash `1949fdcb838eee88`.
- PASS: `machine-axis:build`, production `build`, Node syntax checks for all changed JS/MJS, generated cycle report synchronization, and `git diff --check`.
- NOTE: ESLint's configured parser reports three parse errors for repository-supported JSON import attributes (`import ... with { type: 'json' }`) in existing import sites; Node syntax checks and both Vite builds pass. Remaining ESLint findings are pre-existing unused warnings.
- COMPLETE: staged diff audit is clean; this state file is included in the single cohesive commit.

## Failed Approach Recorded

- First death-truncation implementation applied to every legacy finite-HP target and changed historical golden totals. It was rejected. The implementation now requires a structured enemy profile, which is mandatory for fastest-kill and leaves legacy finite scenarios unchanged.
- Qualification evidence files were temporarily normalized with Prettier to work around Windows CRLF raw-hash checks; this altered intentional JSON formatting in several frozen artifacts. They were restored byte-for-byte from HEAD using a scoped `core.autocrlf=false` restore. Only the scenario-policy hash binding in the set-three source evidence remains changed, with dependent acceptance/generation hashes regenerated.
- Markdown files were briefly passed to Prettier, creating a large formatting-only diff. All three were restored from the verified clean base and the contract notes were reapplied as small semantic additions only.
- The first Workbench integration assertion exposed that `normalizeCombatScenario` dropped `objectiveContract`. The shared normalizer now preserves it; the structured enemy profile remains on the existing `project.enemy` carrier, and both survive JSON export/import without defaulting.

## Evidence Locked From Existing Runtime

- The break-triggering packet calculates HP damage against the pre-break state, then deducts toughness and enters break; it does not receive the break multiplier.
- Weakness state transitions run before same-frame combat hits. A hit on the exact break-exit frame sees the recovered/unbroken state and does not receive the break multiplier.
- Runtime events expose the stable order tuple `(absoluteFrame, runtimePhasePriority, runtimePriority, runtimeSequenceIndex)`, so kill-time diagnostic cutoffs can include only settlements at or before the exact lethal event.
- Existing cycle replay is already strict and two-cycle, but its boundary comparison omits enemy toughness/break phase and its scenario constructor hard-wires toughness/break disabled.
- Existing generated scenario policy freezes a single no-toughness target policy; this batch must make the target policy objective-indexed without changing the shared zero-distance/passive-boss interaction policy or unlocking admission.

## Known Risks / Open Evidence

- Runtime ordering evidence exists and must be encoded as a versioned objective contract plus regression tests, not left implicit in implementation order.
- Existing B2 `cycle-dps` was defined only for toughness-disabled infinite-HP scenarios; its loop proof must be generalized without weakening current closure.
- Existing search objectives are `damage|burst|toughness`; compatibility parsing must be separated from formal objective admission.

## Verification Target

- Focused Machine Axis batch/search/cycle/CLI/schema/Workbench tests.
- Determinism and protocol audits, optimization-qualification/scenario-policy regressions.
- Production build.
- `git diff --check`.
- No formal optimization run.

## Integrated Closeout (2026-08-08)

- Integrated verified package: `226b60bec7c3b9e701b0a5483ec71685c71530bbec65f1df632362a30f588a4b`.
- Integrated scenario policy: `967b0667f315db5b`; candidate roster: `a690b860f0967e3d`.
- Qualification hashes: source `bb14836067d2dee7`, roster `42d85964ffd402b4`, manifests `726dec2e22a3577d`, ledger `96e3367a9ab6adef`, binding `5f73e56a48591121`, catalog `b26e4d9379d9a95d`.
- Formal admission for toughness-cycle and fastest-kill remains blocked by `machine-axis-enemy-settlement-client-order-open`; no formal optimization was run and M12-C remains locked.
