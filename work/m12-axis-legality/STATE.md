# M12-B3 Axis Legality Audit

## Scope and baseline

- Worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m12-optimizer-objectives`
- Branch: `fix/m12-b3-axis-legality`
- Baseline: `ccd9831514112e099cc0d519bd42b29d681f03e0`
- Allowed scope: generic Machine Axis/search/runtime/schema/tests and this directory only.
- Formal search, M12-C, global qualification/binding/index, character acceptance, manuals and global state are out of scope.

## Source ledger

- `蓝原数据机制导论.extract.txt` P0231-P0240: external report describes joint-point behaviour; it is not sufficient runtime evidence.
- `pet-skill-release-mechanics.md` and research `STATE.md`: UI minimum gate is controlled Kibo alive, player in battle and `existPetBreakTarget=true`; click calls `firePetBreakSkill` through slot `JointStrikeSkill=601`. `PreWeakBreakSystem.OnUpdateDeltaTime@0x13FB720 -> UpdatePreBreakThreshold@0x13FCB20 -> PetData.m_ExistPetBreakTarget@0x460` closes part of the static per-update predicate chain. The formula-source field, controlled-entity `+0x40` input gate, service exclusion runtime input and post-cast/server weakness cleanup remain open.
- `pet.json`: `breakSkillList` maps Kibo `500001` to `601#50000112`.
- `const.lua`: `JointStrikeSkill=601`.
- Kibo headless manual: verified control binding for the Kibo joint slot is `skillTag=15` (`PetJointStrikeSkill`); runtime consumers must not infer it from a name or generic `eventType=break`.
- `enemy.json` and `battle_info.json`: toughness/profile inputs exist but do not by themselves close the joint-trigger predicate.
- `pet-skill-release-mechanics.md` lines 59/63/99-100/206 and research `STATE.md` lines 208/217/248: Kibo target selection and SP response are bound to the current controlled Hero; `OperateHeroPetAI` activates that Hero's Kibo AI. Tag `0` identifies the ordinary AI/behavior-tree surface, but does not close the NodeCanvas graph, token arbitration, normal-vs-active priority, initial delay or recast cadence. Nonzero trigger tags also remain source-open.
- Hero ordinary switch static chain: `SwitchExitBehavior.Initialize@0x13E4B70` immediately moves the old Hero to SwitchExit and queues four `EntityTranlate` actions plus `HeroLeaveAction`; `FluentBehavior.OnUpdate@0x13CD9C0` consumes their always-finished actions in the same update. This revokes old-Hero input/chain authority at the ordered boundary without proving a global `SkillStop`.
- Kibo ordinary switch static chain: `PetSwitchExitBehavior` (`dump.cs` around 278108) sets SwitchExit/manual BT stop/exit state. `AliveSkillSystem.OnTransmit` calls `InterruptSkill` only for `ForceSkillStart(14)` and `SkillStop(17)`, not `FluentBehavior(61)`, `PetStartExit(140)` or `PetExitFinish(141)`. Therefore a switch forbids a new cast but does not blanket-cancel an already materialized detached packet.
- `PetStaySystem.isWiatSkillFinishExit` is limited to stay/recall paths and is not generalized to ordinary switch. A not-yet-materialized owner-bound tail remains `actor-switch-exit-tail-order-unresolved` or `kibo-switch-exit-tail-order-unresolved`.

## Confirmed defects before changes

- Search generator exposes every normal-attack segment as an independent child and gives each segment a different `groupId`.
- Runtime variant resolution can fall back to the default chain and execute a requested A2/A3 without an accepted predecessor.
- Rule diagnostics classify missing/order/window chain evidence as unresolved warnings and leave actions executable; A1-only is incorrectly diagnosed as an incomplete suffix.
- Search scores candidates without first rejecting skipped/unresolved/rule-blocked execution plans.
- Search appends one action per child, so an actor star-combo and Kibo counterpart requiring the same frame cannot be discovered atomically.
- Rule diagnostics, command projection and Workbench insertion treat generic Kibo `break` entries as joint attacks.
- Canonical/manual axes can schedule a player-input action for a non-controlled actor; the skipped/blocked state is not shared by every evaluator.
- A catalog-declared `star-carry` mapping can bypass the standalone switch-trigger gate when manually imported with a valid-looking public-action declaration.
- An ordered same-frame `old actor input -> switch -> new actor input` can execute input from two actors in one client frame.
- A zero-duration switch leaves the search node at the left boundary of its frame, so snapshot/dominance can record the old controlled actor after the switch has executed.
- A caller can construct `createVerifiedKiboAutoCastDerivation()` from its own embedded `autoCastRule`; the old validator recomputes identity from the same untrusted fields and treats `structurallyValid=true` as a background exemption.
- The old Kibo scheduler traverses every team slot for the full horizon, so three equipped Kibo can attack concurrently even though only the controlled Hero's Kibo AI is active.
- The old scheduler labels nonzero `petSkillLogicTag` actions as simplified event-triggered autos and fabricates casts without a closed trigger source.
- A JSON-cloned or raw-scenario `switchTriggerGeneration` can be presented as if it were compiler output because generation authority is not instance-bound.
- Switch occupancy treats every mid-action switch as an unresolved cancellation. It cannot distinguish an already materialized detached packet from an unmaterialized owner-bound future packet, and thus cannot express the client's no-blanket-interrupt ruling.

## Product decision retained

- `existPetBreakTarget` is layered: verified `breakSkillList` plus `skillTag=15` identifies the Kibo joint action, and the `PreWeakBreakSystem` static eligibility predicates are partially closed. Remaining unnamed/runtime predicate inputs and the post-cast server effect/weakness cleanup still prevent a formal trigger/effect proof.
- Formal candidate surface must therefore exclude/reject joint attacks with `joint-attack-trigger-unresolved`; diagnostic Workbench insertion may preserve a paired draft with an explicit unresolved proof.
- The installed mechanics graph contains exactly one applied normal-chain continuity rule: Ruby owner `103002`, intermediary control `10300215`, rule `ruby-enhanced-dodge-chain-continuity`, with the right-open resume window `[30F,246F)`. Shared code consumes the sourced rule/runtime window; it does not special-case the owner ID. Other skill actions reset the normal chain, while switch clears all actor chain state.
- Every player-input action is foreground-only. Background activity is accepted only through a verified, immutable derivation contract bound to its trigger, owner, target and source sequence; no generic off-field exemption exists.
- At any instant only the current controlled Hero's equipped Kibo may start a new autonomous normal/active cast. Switching uses right-open controlled intervals; old owner before the ordered boundary and new owner after it. Background Kibo energy recovery is independent and does not grant attack authority.
- Signature and break/joint are player-input kinds and never qualify for the autonomous exemption. Nonzero autonomous trigger tags are not scheduled until their trigger sources are closed.
- Ordinary Hero/Kibo switch immediately revokes new input/AI/normal-chain authority. It is neither a blanket rollback nor a blanket finish: packets settled or materially detached before the boundary may continue once; a future owner-bound packet without canonical dependency evidence rejects the formal candidate.

## Failure-to-pass

- Command: `npm test -- --run src/__tests__/simulation/actionRuleDiagnostics.test.js src/__tests__/domain/workbenchJointAttackInsertion.test.js src/__tests__/machine-axis/machineAxisSearchGenerator.test.js`
- Result before implementation: 3 files, 24 tests, 19 passed / 5 failed.
- Failures reproduce the intended defects:
  - A1-only emitted `attack-input-chain-incomplete` for the unused suffix.
  - standalone A2 remained executable instead of a violated predecessor gate.
  - right-open chain window failures were not hard legality failures.
  - generic Kibo `break` emitted `joint-attack-pair-missing`.
  - generator exposed segments other than A1 in the initial child surface.
- Additional focused counterexamples established that an off-field manual A1 could settle damage, a catalog-declared manual `star-carry` could avoid the switch trigger rule, two actors could input in one frame around a switch, and a completed zero-duration switch could hash as the old foreground actor.
- R3 authority counterexamples established that a self-signed Kibo normal, signature, break or arbitrary skill can bypass foreground admission; changing frame, sequence, slot, owner, mapping or package fields can be re-signed by the same public factory. A structured-cloned switch generation also used to retain apparent authority.
- R3 scheduling counterexample established that the scheduler generated new actions for all three team Kibo across the horizon. A Kibo with trigger tag `10|7` was also fabricated despite the trigger remaining open.
- R3 switch-tail counterexamples established the required split: a future actor-bound hit must reject; a projectile launched before switch and a pre-materialized effect continue once; a delayed hit merely landing on the switch frame has no proven packet phase and must reject.
- R2 failure-to-pass established that two tag-0 normal/active skills were guessed as frame-0 active-first and then repeated from duration/CD. A structured clone plus caller-supplied `generationAuthoritative=true`, and a kind-only compilation marker, could also mint apparent background authority. These paths changed formal damage/resource/CD and score without NodeCanvas evidence.

## Implementation

- Implemented strict normal-chain admission:
  - A1 is a legal prefix; A2+ requires an accepted same-actor, same-group, same-chain predecessor.
  - Sequence skip/reversal/duplicate consumption, cross actor, switch/interruption, stale context identity and conflicting explicit/context chain identity are rejected.
  - Link windows are right-open. Exact start passes and exact end fails.
  - A blocked predecessor cascades to successors. Hit landed/miss/blocked does not substitute for the control-input acceptance proof.
  - Search snapshots/hash and cycle closure now bind chain identity, sequence, predecessor identity and remaining link-window phase.
  - The generator exposes only A1 at idle, the exact sourced successor while a chain is active, and a new stable group after reset/completion.
- Implemented source-driven reset/continuity:
  - Ordinary non-normal actor skills clear the search chain and reopen only A1.
  - Canonical trace projects an `attack-chain-continuity-window` only when canonical runtime actually applies one. Search state preserves the next sequence only from that runtime evidence; empty continuity data is omitted to avoid unrelated trace-hash drift.
  - The sole installed Ruby continuity rule is tested at exact start and exact end; excluded dodge/counter actions are not added to the formal optimizer surface.
- Implemented strict joint classification:
  - Kibo side must match `pet.breakSkillList`, installed mapping identity and `skillTag=15/PetJointStrikeSkill`.
  - Generic `break`, labels containing 合击 and ordinary Kibo actions no longer use joint input/insertion/pair diagnostics.
  - A structurally valid actor/Kibo pair remains unresolved because `existPetBreakTarget` is not authoritative. Formal search excludes both halves; manual formal cycle/kill paths reject with `joint-attack-trigger-unresolved`.
- Implemented the foreground-input contract:
  - `controlled-actor-action-unavailable`, `controlled-actor-source-order-unresolved` and `controlled-actor-frame-input-conflict` are hard, stable execution-plan failures.
  - A switch is accepted only from the current actor; source-ordered same-frame switch/input uses the declared order, unordered order fails closed, and two actors cannot both consume player input in one frame.
  - Wait never changes the controlled actor. A zero-duration switch advances the search node beyond the switch frame before snapshot/hash/dominance.
  - Off-field invalid input settles no damage, effect, resource, cooldown, charge, chain or accepted transition.
  - Manual `star-carry` is always rejected; only a verified switch-trigger binding may materialize it. Verified Kibo auto-cast is the other current background action derivation, and owner slot/equipped Kibo/source sequence are all bound.
- Implemented shared formal action-legality proof and pre-score pruning for service/manual import, Workbench export/import, batch, search, cycle and fastest-kill. Reports include deterministic codes/counts/categories/minimal counterexamples; sampled proofs, controlled actor and chain state participate in hashes.
- Fastest-kill rejects newly scheduled actions after the first lethal cursor; packets already belonging to the lethal action remain diagnostic and cannot improve TTK.
- Replaced self-signed Kibo authority with a compiler-owned pipeline:
  - persisted projects may contain only player inputs; raw `autoCast`, `autoCastRule`, `derivedAction`, switch binding or switch-tail declarations fail with `project-derived-action-declaration-not-compiler-owned`;
  - compilation regenerates Kibo eligibility/exclusion evidence from the installed verified mechanics package and catalog, then materializes a deep-frozen WeakSet-authoritative registry;
  - any future registry/action identity must bind package/catalog/mapping hashes, actor/Kibo/slot, action kind/skill, frame, per-slot sequence, source path/source source, controlled interval and switch-tail policy;
  - runtime exemption requires `valid=true`, `evidenceClosed=true` and an authoritative registry match. A JSON clone, self-computed identity or raw scenario field cannot grant authority.
- Reworked Kibo scheduling around separate eligibility and timing contracts:
  - right-open `[startFrame,endFrame)` controlled-owner intervals, equipped Kibo identity and explicit alive state form a closed, hash-bound foreground eligibility contract;
  - tag-0 normal/active emits no action while NodeCanvas graph/token/priority/cadence evidence is open; it records `kibo-auto-cast-schedule-unresolved` and hard-rejects all three formal objectives before score;
  - nonzero tags remain `kibo-auto-cast-trigger-unresolved`; neither path fabricates damage, resources, cooldowns, priority or cadence;
  - controlled timeline, foreground eligibility, initial Kibo vital boundary, exclusions, package/catalog identity and registry hash enter canonical identity. Explicitly dead Kibo do not receive an auto-schedule blocker because they cannot begin an action.
- Added compiler-owned Hero/Kibo switch-exit tail policies:
  - switch revokes new input/AI and clears the old Hero normal chain immediately, without emitting a global `SkillStop` or synthetic exit skill;
  - a settled packet, pre-materialized effect or detached projectile launched before the ordered boundary is retained once;
  - a future owner-bound packet, missing materialization evidence, or delayed same-frame packet with no packet-phase source fails closed with owner-specific stable codes;
  - policy identity, boundary frame/source path, packet evidence and mechanics package hash enter trace/data hashes. Structural factory output and JSON clones are not authoritative.
- Kept Hero and Kibo lanes separate in search: autonomous Kibo occupancy neither resets the Hero normal chain nor pushes the Hero's next input frame. Manual/Workbench axes and optimizer candidates still converge through the same compiler and action-legality proof.

## Completeness matrix

| Dimension                        | Status                                          | Formal proof path                                                                                                                                                   | Remaining boundary                                                                                                     |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Normal attack chain              | Completed in this batch                         | Accepted predecessor, actor/group/chain identity, right-open link window and chain phase are in execution plan/state/hash                                           | None for installed chains                                                                                              |
| Chain reset/continuity           | Completed in this batch                         | Non-normal actions reset; only installed sourced continuity windows preserve the chain                                                                              | New continuity rules must arrive through mechanics data, not code exemptions                                           |
| Foreground controlled actor      | Completed in this batch                         | Canonical diagnostics -> execution plan -> shared legality proof; controlled actor is in trace/search snapshot/hash                                                 | Same-frame search continuation intentionally advances one frame because search state has no intra-frame cursor         |
| Occupancy/cancel/switch          | Existing runtime plus hard-gate wiring          | Actor overlap and exact-end boundary are consumed; mid-occupancy switch is rejected and derived child rolls back                                                    | Authoritative general cancel windows are not available, so formal mid-occupancy cancellation stays fail-closed         |
| Cooldown/charge/shared readiness | Existing runtime, now consumed by formal proof  | Readiness blocks, charge state, shared timer and exact-ready transitions feed execution plan/proof/state                                                            | None identified in audited paths                                                                                       |
| Actor/Kibo/special resources     | Existing runtime, generalized in this batch     | Resource owner kind/id/identity and shortage details feed one proof; blocked actions cannot transact                                                                | None identified in audited paths                                                                                       |
| Owner/target/scenario            | Existing preflight plus foreground/joint wiring | Controlled owner, equipped Kibo, source slot, target/range and passive-boss exclusions fail before score                                                            | Joint eligibility has open runtime fields and post-cast effect semantics                                               |
| Same-frame/compound atomicity    | Completed for current active contracts          | Source sequence conflicts and duplicate/cross-actor inputs reject; blocked switch rolls back derived star-carry                                                     | Formal joint pair remains disabled, so its future resource/CD two-sided transaction is not activated                   |
| Wait/state dominance/hash        | Completed in this batch                         | Active actor, cooldown/charge/resources/effects/enemy/chain/pending state are in snapshot/hash; zero-duration switch uses post-frame boundary                       | No intra-frame search cursor; conservative one-frame advance is intentional                                            |
| Death boundary                   | Completed for formal TTK                        | Later scheduled actions reject before final score; first lethal cursor remains authoritative                                                                        | Same-action tail packets are diagnostic only                                                                           |
| Entry consistency                | Completed in this batch                         | Service is the shared gate for generated/manual/Workbench/import; batch/cycle/kill/search consume the same proof                                                    | None identified in audited paths                                                                                       |
| Reporting/determinism            | Completed in this batch                         | Stable code/count/category/minimal counterexample/proof hash and schema projection                                                                                  | None identified in audited paths                                                                                       |
| Kibo derivation authority        | Completed and hardened in R2                    | Compiler regeneration -> installed package/catalog mapping -> immutable WeakSet registry -> canonical exact match; clones/raw declarations/kind markers fail closed | No autonomous entry is authorized until its schedule evidence is sourced                                               |
| Controlled Kibo eligibility      | Closed; autonomous schedule remains open        | Right-open controlled intervals, ordered switch transitions, equipped/live Kibo and initial vital boundary are hash-bound                                           | Tag-0 stays `kibo-auto-cast-schedule-unresolved`; nonzero tags stay trigger-unresolved; energy recovery is independent |
| Joint trigger/effect evidence    | Static eligibility partially closed             | PreWeakBreak methods/RVAs, threshold formula and closed predicates are in the hashed source ledger                                                                  | Unnamed/runtime predicate inputs plus post-cast server effect and weakness cleanup remain formal blockers              |
| Hero/Kibo switch-exit tails      | Completed for materialized/detached evidence    | Immediate foreground revocation plus compiler-owned per-packet materialization policy and stable blocker                                                            | Not-yet-materialized owner-bound tails remain owner-specific formal blockers until their dependency is sourced         |

## Verification

- Focused verification passed:
  - core legality/joint/input/derivation: 8 files / 95 tests.
  - service/batch/Workbench/generator/state/search/report/CLI: 8 files / 106 tests.
  - post-review manual star-carry and foreground/switch derivation: 2 files / 29 tests.
  - post-review action diagnostics + shared legality proof: 2 files / 28 tests.
  - post-boundary search state/generator/engine: 3 files / 28 tests.
  - service + Workbench after removing the manual star-carry exemption: 2 files / 27 tests.
  - cycle legality/chain replay/real closure: 4 passed / 36 skipped; fastest-kill: 10 passed; canonical core: 12 passed.
  - changed search-acceptance contribution-conservation counterexample passed in isolation. The whole acceptance file exceeded the bounded run at about 184 seconds with no failure output and was not repeated.
  - Prettier on changed JS/JSON, ESLint on all 39 changed JS files (`0` errors, `5` pre-existing unused warnings), `node --check` on all 39 changed JS files and `git diff --check` passed before final state update; final diff checks are repeated before commit.
- Baseline issue intentionally not modified: `ccd98315` already stores `m12-cycle-dps-example.json` with mechanics hash `71ff1c31...`, while its installed generated package is `e4f894ee...`. The real cycle CLI therefore exits validation code 4. Global generated fixtures/reports are outside this task's allowed scope and were not hand-edited.
- Not run by scope: `test:full`, full build, formal optimization/M12-C, global qualification/binding/index generators.
- R3 focused verification after compiler-authority review:
  - scheduler/registry + action rules + switch derivation + tail policy: 4 files / 56 tests;
  - compiler/status/switch replay/canonical core/service: 5 files / 46 tests;
  - search generator/state/engine: 3 files / 28 tests; Workbench adapter: 1 file / 9 tests;
  - fastest-kill: 1 file / 10 tests; batch shared hard gate: 1 passed / 11 skipped; cycle chain/joint/replay legality: 3 passed / 37 skipped;
  - switch-generation/tail authority rerun after lint cleanup: 2 files / 15 tests;
  - explicit registry-hash projection rerun: scheduler + canonical core + service, 3 files / 42 tests;
  - all changed/new JS passed `node --check`; ESLint has zero errors and one pre-existing `machineAxisService.js` unused-parameter warning; Prettier and `git diff --check` pass.
- R2 focused verification (current corrective diff):
  - scheduler/canonical/joint/action diagnostics final rerun: 4 files / 62 tests passed;
  - cycle evaluator: 1 file / 40 tests; action-legality + batch + fastest-kill: 3 files / 30 tests;
  - search generator/state: 2 files / 20 tests; search engine: 1 file / 8 tests; full search acceptance boundary: 1 file / 11 tests (160 seconds);
  - Machine Axis service: 1 file / 18 tests; Workbench adapter final focused run: 1 file / 9 tests; search report passed in the preceding focused pair;
  - the first combined search run and first acceptance rerun hit command timeouts, not test failures; the same files were split/repeated to completion above.
- The cycle `real second replay still on cooldown` fixture remains blocked earlier by the already recorded baseline mechanics package hash mismatch. It was not rewritten or counted as an R3 failure.
