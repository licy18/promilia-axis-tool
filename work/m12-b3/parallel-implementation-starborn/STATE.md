# M12-B3 STARBORN S1 / MARK-R1 state

## Goal

Close the formal `STARBORN` optimization object over both current-client source aliases (`199001` / `199002`) in `m12c-zero-distance-passive-boss-v1`, then stop at product visual manual acceptance.

## Branch and boundary

- Branch: `fix/m12-b3-starborn-existing-mark-count`
- Base: `c31e4c3fcf4291462b1b2a2a4d8fbbe6a844588f`
- Fixed worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m12-b3-107001`
- Protected concurrent-axis paths are not to be edited.
- Focused owner generation/tests only; no full build/search/global qualification regeneration.

## MARK-R1 failure-to-pass and correction

- Central product review invalidated the old `+1` ultimate oracle and the unconditional nine-mark acquisition baseline.
- Before this correction, both aliases acquired all nine tuning marks from zero; ultimate and star-carry both used `stackDelta=1` and did not execute the `common function 1007` existing-layer condition.
- Compiler v7 now expands four source-declared groups into 36 alias-local action-effect bindings. Every binding verifies its wrapper asset (`function_1=1007`, `function_2=5`, mark parameter, zero threshold, injected child path) and publishes `snapshotTiming=action-start-before-effects`.
- Runtime captures one mark-count snapshot at action start after exact-boundary expiry and before any same-action child mutation. A conditioned acquisition is rejected when its mark count in that snapshot is zero.
- Correct product outcomes are now: ultimate adds two only to present marks, star-carry adds one only to present marks, both cap at five, and a cap refresh emits `delta=0` without creating a missing mark.
- Independent desired-semantic tests reject removal of the parent condition, ultimate `+1`, any absent `0 -> 1`, uniform nine-mark acquisition, and either alias remaining on the old rule.

## Failure-to-pass baseline

- M10 public catalog contains two source rows (`199001`, `199002`), each with 9 public actions, 13 indexed controls, no profile identity/hash.
- Formal qualification contains one `STARBORN` character record and three blockers:
  - `actor-static-profile-missing`
  - `character-acceptance-not-published`
  - `character-not-optimization-ready`
- The qualification source identities retain both generated character rows.
- A single-alias recipe, empty manifest, `facts=true`, copied profile, or denominator count of two is not an admissible closure.

## Source findings

- Public descriptions, level values, CD/SP, base combat attributes, rarity, weapon, position, element and battle tags agree after alias-ID normalization.
- Source identity is not interchangeable: unit IDs are `104001` (female) and `112001` (male); hero/skill/control/Battle Element IDs and hashes differ.
- Execution timing is materially different. Examples: star skill is 190F on `199001` and 270F on `199002`; ultimate is 322F versus 268F. Normal/charged hit tracks also differ.
- Control assets share 32 normalized suffixes; male additionally has `19900242`, an empty 150F control. Female has a NewTable row/backup slot for `19900142` but no current-client control asset.
- Passive 1 is source-backed by persistent markers `199001214` / `199002343`; star-skill source trees conditionally apply the 20s team attack and target defense effects.
- Passive 2 containers (`*62`) are empty. Its charged-derived behavior must be closed from the actual charged control/Battle Element path, not from the empty container or prose alone.

## Implemented closure

- Independent profile recipes/contracts/profiles and M10 owner reports are published for both `199001` and `199002`.
- Compiler v7 carries the optional data-driven optimization-object/source-alias identity, verifies source-stat formulas against `NewTable/element_formula`, compiles source-backed action-effect passive triggers, and compiles existing-tuning-mark conditions without actor-ID branches. Runtime evaluation reads the selected source actor's stat and supports source-driven team-ally targets.
- Each alias has an independent acceptance recipe and fixture. The manifests retain all action/effect/hit/resource/window identities and classify frozen-policy stimulus as structured N/A.
- `STARBORN` has one optimization-object recipe/report which requires both aliases, selects exactly one alias per axis, and rejects missing aliases, dual selection, cross-alias action/trace/runtime-contract continuation, or hash merging.
- Product visual evidence is fail closed: both recipes explicitly declare no visual scenario coverage, no screenshot record is published, and both owner/object manifests remain `pending` / `optimizationReady=false`.

## Final mechanism result

| Subject | Inventory | Required / pass | N/A | Blocked | Source gap | Acceptance gap | Scenario / pass | Assertion / pass |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `199001` | 322 | 195 / 195 | 127 | 0 | 0 | 0 | 2 / 2 | 1495 / 1495 |
| `199002` | 321 | 195 / 195 | 126 | 0 | 0 | 0 | 2 / 2 | 1537 / 1537 |
| `STARBORN` | 643 | 390 / 390 | 253 | 0 | 0 | 0 | 4 / 4 | 3032 / 3032 |

- Object bundle hash: `1ec70edf17e62d71`.
- Female profile/source-contract/selection hashes: `e6a672b52f0fab334520525c7f795946122d89a25956f9821cdd382ea7b98ba7` / `fb810c3db434d9992c11e0027a7fb5313bc601e6bef3f52c28da8db856f4f737` / `ad3092526ebdb42e`.
- Male profile/source-contract/selection hashes: `ea7e5abf6edaac6bb132b578eb15ec54e6aba3c13db04198d904ad66e4bed86c` / `6d0f40058a3e6e427ea614ef4fd455d7e37d2abd8fbd035fd754077297ae0df3` / `f0d1c1bea5c1ef73`.

## Verification

- Owner profile `--assert-clean`: `199001` and `199002` passed (14 outputs each) after the final runtime ordering change.
- Owner acceptance `--assert-clean`: both passed; stable replay and Workbench adapter round-trip are true.
- Focused Vitest: desired-semantic plus alias closure 2 files / 22 tests, and Workbench Machine Axis adapter 1 file / 9 tests. All 31 passed.
- The dedicated desired-semantic suite is independent of generated golden expectations and covers all-zero, mixed counts, cap-4/cap-5, exact right-open expiry, interruption, same-action precondition snapshot, wrong `+1`, absent acquisition, missing parent condition and either alias left stale.
- The broader pre-existing `verifiedTuningMarkRuntime.test.js` currently reports 26/30 on this baseline branch: four legacy helper scenarios submit `101003`/`101007` actions while `109001` remains the controlled actor, so the integrated axis-legality gate correctly skips them with `controlled-actor-action-unavailable` before tuning runtime. This branch does not bypass or weaken that gate.
- An unsupported object-only CLI spelling was ignored by the acceptance generator and therefore reached full-roster visual verification; it failed closed on the base `107001` fixture SHA mismatch before generation and wrote nothing. STARBORN aggregation is instead verified by its two owner manifests, object manifest and dedicated alias-closure test.
- `node --check`, JSON parsing, `git diff --check` and the shared-production role-ID/name scan all pass.
- Shared production additions are data driven and contain no `199001`, `199002`, `STARBORN`, female/male name special case. No protected concurrent-axis path was touched.

## Product visual stop point

No new STARBORN screenshot is claimed by MARK-R1. The two existing visual fixtures bind the corrected owner profile/source-contract hashes, while their global mechanics-package binding must be refreshed only after central compiler-v7 package regeneration. Product visual acceptance remains explicitly `pending`, and `optimizationReady=false`.

## Central integration obligations

1. Cherry-pick the single branch commit after conflict review; do not overwrite the concurrent axis-legality implementation.
2. Regenerate the global verified mechanics package and all owner/global contract/profile/package outputs for compiler v7, then refresh both STARBORN fixture package hashes.
3. Regenerate global acceptance catalog/index, qualification/binding/summary and formal roster reports; this branch intentionally does not commit them.
4. Rebind or recapture real Workbench screenshots for both aliases against the regenerated package, obtain manual product signoff, then independently decide formal admission/optimization readiness.
