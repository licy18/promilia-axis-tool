# M12-B3-JOINT-ATTACK-R1

## Goal

Implement `m12-joint-attack-runtime-v1` as a versioned product assumption: strict threshold eligibility, atomic actor/Kibo input, then a source-driven clear anchored after the verified Kibo JointStrikeSkill landed-hit packet(s).

## Baseline

- Branch: `fix/m12-b3-joint-attack-runtime`
- Parent: `c31e4c3fcf4291462b1b2a2a4d8fbbe6a844588f`
- Initial worktree: clean

## Confirmed failure-to-pass

- A structurally valid pair only emits `joint-attack-trigger-unresolved` and remains `formalEligible=false`.
- Workbench pairs the two inputs but does not bind a runtime assumption.
- Formal search excludes both halves instead of emitting one compound input.
- Verified combat runtime has no joint admission or pair-level post-damage toughness-clear transaction.

## Source/value ledger

- Known client predicate chain: `PreWeakBreakSystem.OnUpdateDeltaTime@0x13FB720` and `UpdatePreBreakThreshold@0x13FCB20`.
- Kibo identity: `NewTable/pet.breakSkillList` plus verified `skillTag=15/PetJointStrikeSkill`; ordinary `break`, names and same-frame coincidence are never sufficient.
- Threshold formula: verified `element_formula.rows[id=223].functionOutput` plus `battle_info` fields `WP_BREAK_TOUGH` and `WP_BREAK_PERCENT`.
- Enemy factor: current compiled enemy catalog invariant `baseAttributes.WP_BREAK_TOUGH=10000` / property id 224; an explicit conflicting input rejects.
- Kibo factor: compiled verified static Kibo `attributes[id=223]` (`WP_BREAK_PERCENT`), owner/mapping/package identity bound into the pair.
- Hit anchor: installed verified combat package action mapping plus landed `DamageElement` hit identity. Formal qualification catalog has 43 Kibo and all 43 joint mappings currently land at relative F40; the complete 122-mapping package includes F0/F35/F37/F39/F40/F44/F45, so runtime never uses a global F40 constant.
- Unknown service exclusion and unnamed controlled-entity gate are resolved only by the user-approved versioned product fallback; `clientParityReady` remains false.

## Contract

- ID: `m12-joint-attack-runtime-v1`
- Contract hash: `9fe09a5ab27781f2`
- Default binding hash: `daededcff4c88b3b`
- `formalReady=true`, `clientParityReady=false`.
- Missing fields, additional/renamed semantics, stale contract hash, binding tamper, fake mapping or absent landed Kibo hit all fail closed.
- Binding is carried by `combatScenario.jointAttackRuntime` through canonical input/data/trace/build identity, Machine Axis schema/service and Workbench round-trip.

## Latest product order

1. Source-ordered input eligibility and atomic pair admission.
2. Resolve the verified Kibo JointStrikeSkill landed hit from its mapping/hit identity; do not assume a global F40.
3. Pair HP packets at that anchor frame settle first and read the pre-clear Break state.
4. One pair-level attached effect then clears toughness and triggers Break once.
5. Later actor packets read canonical state at their own cursor and can observe Break (for example a delayed multi-hit star-combo).
6. Never clear at input acceptance or defer to the actor action end.

## Implemented

- Manual/Workbench insertion commits the runtime binding only after the actor/Kibo compound pair is created successfully.
- Diagnostics resolve only a strict adjacent source-ordered pair; search emits one atomic compound candidate and the engine appends both actions together.
- Dynamic input-time eligibility checks alive/breakable/not-Break/not-rage, foreground actor/equipped-live Kibo, target, range/height/connectivity, conflicts, strict threshold and explicit service/gate negatives.
- Runtime admission and both costs are atomic. Any half failure blocks both action IDs before damage/resource/CD/effect settlement; the service reruns the canonical execution plan with the runtime block.
- The first source-ordered landed hit of the verified Kibo joint mapping is the anchor. Every pair HP packet at that frame settles against pre-clear state, then one pair-level event clears toughness and enters Break; later packets use canonical state at their own cursor.
- Standard F40/F40 and delayed actor F74/F82/F90/F99/F107/F114 counterexamples are source-driven. The latter proves Kibo F40 is pre-Break, the clear occurs once after that frame's pair damage, and delayed actor hits observe Break.
- Direct Kibo control cooldown readiness now consumes the verified mapping even when public and control skill IDs are equal; a second pair cannot bypass slot 601 cooldown.
- Cycle boundary sees enemy toughness/Break drift; fastest-kill consumes the exact first lethal cursor after the same canonical settlement order.

## Verification

- Final focused matrix: 11 files / 161 tests passed (contract, pair/runtime, manual insertion, diagnostics, generator, search, service, Workbench adapter, cycle and kill).
- Additional focused groups passed during iteration: batch/CLI/objective 4 files / 64; search/adapter/cycle/kill/legality 5 files / 77; Machine Axis service 18/18.
- ESLint on every changed JS/Vue: 0 errors (existing unused-symbol warnings only; Vue is ignored by the repository lint pattern).
- All changed production JS passed `node --check`; `git diff --check` passed; no debug markers remain.
- No `test:full`, full build, formal optimization or M12-C execution was run, per scope.

## Open / integration boundary

- This contract is a product assumption, not a claim that the two fallback gates or post-cast server chain match a captured client/server session. A future evidence conflict requires a contract version bump and hash/score recomputation.
- Independent `kibo-auto-cast-schedule-unresolved` remains unchanged: NodeCanvas cadence/priority is not inferred. This can still block a complete formal axis even though an explicitly input joint pair now has a formal legality proof.
- The legacy `verifiedCombatRuntime.test.js` helper still manually schedules actor-101007 A3/Kibo while its central baseline controlled actor is actor-109001 and omits A1/A2. The foreground/chain hard gate correctly rejects it; the joint implementation does not relax that stale fixture.
- Global generated summaries/bindings are intentionally not regenerated in this branch. Central integration must regenerate affected schema/report/build hashes and run the heavier qualification/build gates.
