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
- Branch: `feature/m12-optimizer-toughness-client-order`
- Base: `140eefcd233cd9c1d136728f1c94b91aff632278`
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

## OPT-T2 Client Settlement Order (2026-08-08)

- Branch: `feature/m12-optimizer-toughness-client-order`; integrated base: `140eefcd233cd9c1d136728f1c94b91aff632278`.
- Scope is limited to TC client-native toughness/break/recovery/packet-order evidence, reusable capture support, and the corresponding generic runtime/formal-readiness contract. No character-specific mechanics, Mitti work, formal optimization, M12-C work, or merge back to B3 is authorized.
- Evidence-first rule: the current runtime ordering is a hypothesis until independently closed by GameAssembly/dump/script consumers. Runtime behavior cannot be used to prove itself.
- Current gate remains fail closed: `m12-enemy-settlement-runtime-v1` is `formalReady=false` with `machine-axis-enemy-settlement-client-order-open`.
- Bound client identities: GameAssembly SHA-256 `c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`; dump.cs SHA-256 `0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a`; script.json SHA-256 `604394cf001aea1e3acee698a145392b0e808db7e0ff917ca337cf92ef876c0b`.
- Next: extract exact class/method/enum bindings, cross-disassemble native callsites and update paths, then decide per conclusion whether static evidence closes it or a controlled runtime capture remains mandatory.

### OPT-T2 Evidence Result

- Static client evidence closes: breaking packet multiplier reads pre-break state; ordinary/real routes use property 221; toughness change dispatch precedes HP change; pure toughness is not HP break-multiplied; enum/state fields; local per-update/right-open state machine; remote performance-only update.
- Generic runtime packet transaction corrected to compute HP output from pre-break state, settle toughness/break, then HP; `settlementOrder` is carried into canonical/cycle/kill hashes. Fixed 100ms recovery remains unchanged because the authoritative formal enemy local/remote/network path is still open.
- Evidence report: `reports/m12/m12-b3-enemy-toughness-settlement-evidence-20260808.json`, reportHash `54336a6032a07777838313fe3d8991d77b3d11aa34d2fc3ed778cd68c8d07487`, `formalReady=false`.
- Capture manifest v3 and agent now bind the required packet/state/time hooks and monotonic same-frame record order. No source client process was running; controlled-capture policy forbids automatic launch/attach/bypass, so no capture was fabricated.
- Leaves open: same-frame cross-packet weak-state visibility; break-end update versus hit; lethal/tail-packet disposition; authoritative passive-boss local/remote/network path. Blocker remains `machine-axis-enemy-settlement-client-order-open`; with-toughness/kill formalScore remains null.
- Final evidence identities after R1: source artifact `0129a1dc0227ab5d67dd399b05d51d1006b294f33cbb2126266f06bd232b8be9` (18,807 bytes); generated report file `c2c746bd9462838e626c68dc533e9ac47dbfc84d4770a42d177dc009a35946cc` (19,799 bytes); semantic `reportHash=54336a6032a07777838313fe3d8991d77b3d11aa34d2fc3ed778cd68c8d07487`.
- Capture manifest v3: `azpr-tc-20260709-three-value-runtime-capture-v3`, 33 methods / 43 fields, file SHA-256 `3724588d3c94f620095820181ddf008f10896963d9663590d9818b92d8587ea4`.
- PASS verification: evidence/contract/objective/capture/CLI/qualification (101 tests); kill/search/report/batch/Workbench (32 tests); full cycle (37 tests); full verified runtime (36 tests); evidence/profile tamper group (21 tests); Frida agent (6 tests); profile-driven 0/1.5x multiplier focused checks; `machine-axis:build`; production `build`; evidence and capture-manifest `--assert-clean`; scenario-policy, qualification (`m12cLocked=true`, catalog `b26e4d9379d9a95d`), production-import and Workbench-data audits; changed-file ESLint with zero errors (three pre-existing warnings); Node syntax checks; `git diff --check`.
- `audit:verified-combat` was attempted twice under bounded 120s/180s runs and timed out without a reported assertion failure. Per the no-repeat rule it was not retried and is not claimed as a current OPT-T2 pass. Targeted runtime coverage above is green.
- No formal optimization or source-client capture was run. M12-C remains locked, Kibo DNA remains unchanged, and the formal blocker remains intentional.
- Next external step: a later explicitly authorized controlled client session must close every `leavesOpen` item before contract v2 / `formalReady=true`, recovery-clock changes, or formal-score release.

### OPT-T2-R1 Evidence/Runtime Consistency

- Corrected the frozen source artifact and generated report: current ordinary-hit and tuning single-packet runtime mutation now matches the client-static dispatch order. Only the native per-update-delta versus fixed-100ms clock remains in `runtimeComparison.differs`; the four controlled-capture boundaries remain byte-for-byte unchanged in both `leavesOpen` and `pendingControlledCapture`.
- `VERIFIED_ENEMY_DAMAGE_PACKET_SETTLEMENT_ORDER` now lives in a small shared leaf module and is re-exported by `verifiedCombatRuntime`. The evidence validator imports that exact constant and rejects any runtime-comparison drift.
- Both ordinary and tuning damage paths call one executable settlement transaction. A Proxy regression observes actual finite-HP writes as `toughness -> inBreak -> hp`; a source guard rejects either path if it reintroduces direct `enemy.hp` or `enemy.toughness` mutation instead of the shared transaction. Both emitted packet types are checked against the shared settlement-order constant.
- PASS: evidence/contract/full verified-runtime group 57/57; capture manifest/Frida/cycle/kill group 51/51; evidence report and capture manifest `--assert-clean`; optimization scenario policy (`967b0667f315db5b`) and qualification (`m12cLocked=true`, catalog `b26e4d9379d9a95d`) audits.
- `formalReady=false`, `formalScore=null`, blocker `machine-axis-enemy-settlement-client-order-open`, and all four `leavesOpen` remain unchanged. No controlled capture, formal optimization, new mechanics, full test, or build was run in R1.
- Failed approach recorded: importing the full extensionless Vite runtime module directly from the Node evidence generator produced `ERR_MODULE_NOT_FOUND` for `verifiedCombatMechanicsPackage`. The shared order was moved to an explicit `.js` leaf module, which gives the generator and runtime one source of truth without changing repository-wide module resolution.

## OPT-T3 Controlled Client Capture (2026-08-09)

- Accepted baseline: `618e7d731a0aeb7d22dd19506f790706dfadb646`; branch/worktree boundaries unchanged.
- Read-only preflight recomputed all bound sources: GameAssembly `222485544` bytes / `c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`; dump.cs `97428254` bytes / `0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a`; script.json `368815582` bytes / `604394cf001aea1e3acee698a145392b0e808db7e0ff917ca337cf92ef876c0b`. All match.
- Frida 17.15.3 full process enumeration found no running `AzurPromilia.exe`. The executable and anti-cheat files exist, but manifest policy explicitly forbids automatic launch/attach/bypass. No process was attached, no scenario was claimed, and no real controlled-session record was fabricated.
- Structured result: `blocked-source-game-process-required`; preflight artifact `reports/m12/m12-b3-enemy-toughness-controlled-capture-preflight-20260809.json` is 4,732 bytes / SHA-256 `ac6c3b9014540668a83c06d162139227ee1f9d6c776983c21ea84f45d0f757bb`. It preserves all four dynamic leavesOpen: same-frame cross-packet weak-state visibility; break-end update versus hit; lethal/tail-packet disposition; authoritative passive-boss local/remote/network path.
- Capture host/agent now emit monotonic `captureSequence`, packet `eventIdentity/damagePacketSequence/sourceSequencePath`, hook `hookInvocationIdentity/hookMethodKey`, client frame/delta/thread, and one `capture-session-end` with agent/host counts, final sequence, packet/invocation counts, open-thread-state count and diagnostics.
- Workbench production audit rejects sequence gaps, duplicate hook rows, incomplete entry/exit pairs, packet/invocation thread switching, missing frame clock, missing/duplicate session end, open stacks, count mismatch, or any agent diagnostic. Normalizer v3 is byte-repeatable, drops local PID/module path/load base and absolute input paths, and binds exact raw source bytes/SHA-256; one-byte semantic no-op tampering still changes the binding. Synthetic and self-test data remain explicitly non-production.
- 112001 probe contract is ready but unexecuted: it requires single-packet damage/overlimit HP-toughness-break order, 191F current-packet applicability, 128F watcher ordering, authoritative break event/cursor, and observer-active-at-break. Equivalent probes require a proven same-consumer/same-phase call chain.
- Formal state remains intentionally locked: `formalReady=false`, `formalScore=null`, blocker `machine-axis-enemy-settlement-client-order-open`; no formal search or M12-C work ran.
- Minimum external interaction: manually launch/login the bound TC client; enter the zero-distance stationary non-attacking Boss scenario; prepare 112001 or a call-chain-proven equivalent probe; provide the client PID and explicitly confirm the one-session controlled Frida attach; execute identifiable break, same-frame follow-up, break-end boundary and finite-HP lethal-tail probes.
- PASS: final focused capture/evidence/contract/objective/full verified-runtime/cycle/kill group, 10 files / 130 tests. Tamper matrix covers sequence loss, duplicate hook row, hook-method drift, source-path drift, thread switch, missing frame, missing session end, diagnostics, and packet/hook count mismatches.
- PASS: evidence and capture-manifest `--assert-clean`; optimization scenario policy `967b0667f315db5b`; optimization qualification `m12cLocked=true`, catalog `b26e4d9379d9a95d`; production-import and Workbench-data audits.
- PASS: normalizer v3 exact-byte repeatability/raw-tamper test; production-preview `[six-resource-capture-import]` Workbench import/export/replay; production build (1,886 modules); changed-file ESLint; Node/Python syntax; `git diff --check`.
- Intentionally not run: formal optimization, source-client capture/attach, M12-C, `test:full`, or another character/mechanism batch.

## OPT-T3-R1 Production Imports Assert-Clean Gate (2026-08-09)

- Central reproduction on clean `17e412b7` proved the prior `audit:production-imports:check` was false-green: exit 0 rewrote `reports/production-import-audit.json` from 214/210 to 215/211 source/reachable files, changed `src/simulation/mechanics` 26→27, and added `verifiedEnemyDamagePacketSettlementOrder.js`. The generated M file is accepted as the canonical report update and was not reverted.
- Root cause: `scripts/audit-production-imports.mjs` unconditionally wrote the report before `--assert-clean`, while assert mode only rejected unreferenced or unexpected-test-only source files.
- R1 computes canonical report bytes in memory. `--assert-clean` compares the existing report byte-for-byte, reports missing/mismatch hashes, exits nonzero on report drift or existing semantic issues, and never creates a directory or rewrites the report. Ordinary generation uses byte comparison and writes only when changed.
- New CLI regressions use explicit temporary `--output` paths and prove: canonical generation is write-if-changed; repeated generation preserves bytes and mtime; canonical assert is read-only; tampered and missing reports fail without mutation or directory creation; the committed default report is canonical and read-only.
- Failure-to-pass recorded: before regenerating the committed report, the new focused suite produced 2 pass / 1 fail at the default-report assertion. After normal generation synchronized the report, the same suite passed 3/3.
- Product boundary is unchanged: no controlled client capture/attach or anti-cheat bypass; `formalReady=false`, `formalScore=null`, all four dynamic leavesOpen, M12-C and formal-search locks remain intact.
- Canonical production-import report after adding the focused test: 27,799 bytes / SHA-256 `3f901ff377347fe6cac7faa69b58d69f6fe54570b0885105c4ac4d09aba17fc6`; counts are 215 source / 211 production reachable / 4 allowed test-only / 0 unexpected / 0 unreferenced.
- PASS pre-commit: capture/normalizer/Workbench/evidence/contract/objective/full runtime/cycle/kill plus R1 audit tests, 12 files / 137 tests. Evidence report/manifest, scenario policy, optimization qualification (`m12cLocked=true`) and Workbench-data audits are clean. Changed-file ESLint and `git diff --check` pass.
- The fixed production-import assert was observed preserving Git status, report SHA-256 and report mtime. Final acceptance requires the same check twice from the clean R1 commit before handoff.
- Production build was not rerun in R1 because only the Node audit CLI, its generated report/test, and task state changed; no application/runtime production module or bundle input changed from the already built `17e412b7` baseline.
