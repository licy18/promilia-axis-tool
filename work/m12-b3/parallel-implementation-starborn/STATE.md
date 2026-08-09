# M12-B3 STARBORN S1 state

## Goal

Close the formal `STARBORN` optimization object over both current-client source aliases (`199001` / `199002`) in `m12c-zero-distance-passive-boss-v1`, then stop at product visual manual acceptance.

## Branch and boundary

- Branch: `fix/m12-b3-starborn-acceptance`
- Base: `ccd9831514112e099cc0d519bd42b29d681f03e0`
- Fixed worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m12-b3-107001`
- Protected concurrent-axis paths are not to be edited.
- Focused owner generation/tests only; no full build/search/global qualification regeneration.

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
- Compiler v6 carries the optional data-driven optimization-object/source-alias identity, verifies source-stat formulas against `NewTable/element_formula`, and compiles source-backed action-effect passive triggers. Runtime evaluation reads the selected source actor's stat and supports source-driven team-ally targets.
- Each alias has an independent acceptance recipe and fixture. The manifests retain all action/effect/hit/resource/window identities and classify frozen-policy stimulus as structured N/A.
- `STARBORN` has one optimization-object recipe/report which requires both aliases, selects exactly one alias per axis, and rejects missing aliases, dual selection, cross-alias action/trace/runtime-contract continuation, or hash merging.
- Product visual evidence is fail closed: both recipes explicitly declare no visual scenario coverage, no screenshot record is published, and both owner/object manifests remain `pending` / `optimizationReady=false`.

## Final mechanism result

| Subject | Inventory | Required / pass | N/A | Blocked | Source gap | Acceptance gap | Scenario / pass | Assertion / pass |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `199001` | 304 | 177 / 177 | 127 | 0 | 0 | 0 | 2 / 2 | 788 / 788 |
| `199002` | 303 | 177 / 177 | 126 | 0 | 0 | 0 | 2 / 2 | 781 / 781 |
| `STARBORN` | 607 | 354 / 354 | 253 | 0 | 0 | 0 | 4 / 4 | 1569 / 1569 |

- Object bundle hash: `9bd9ca22e91aa53a`.
- Female profile/source-contract/selection hashes: `2888fedae88a3726abf1254b87de8b94b8e8f0078844ab23037cbe25a0edbeb4` / `2ed144048bb942edad39f4137345ebaab2655341b9a1b048c3fdf61930b3bea0` / `e4ef8378fec82ce4`.
- Male profile/source-contract/selection hashes: `210946074881e6625b4a7b42328b5c0ceb0a0e9126ce6095c0920ba3b4104f74` / `7b2595f919d05fc6cedaa884dfeec427ed455fffaf5a07e527c0ca8a5eacec5d` / `5245ae49fda152a4`.

## Verification

- Owner profile `--assert-clean`: `199001` and `199002` passed (14 outputs each).
- Owner acceptance `--assert-clean`: both passed; stable replay and Workbench adapter round-trip are true.
- Optimization-object `--assert-clean`: passed.
- Focused Vitest: 4 acceptance files / 19 tests; target-state runtime 1 file / 16 tests; compiler/profile target 1 test. All 36 passed.
- Additional visual-verifier suite: 3/4 passed; the only failure is a base-unchanged `107001` fixture hash mismatch (`recipe bb4bed72...`, actual `60485ff5...`). Neither implicated file differs from base `ccd98315`.
- Shared production additions are data driven and contain no `199001`, `199002`, `STARBORN`, female/male name special case. No protected concurrent-axis path was touched.

## Product visual stop point

The in-app Browser session was blocked by its localhost URL security policy while reloading Workbench. No browser/CDP/native-picker workaround was used. The temporary owner runtime overlay was restored to the exact original global package SHA-256 `ED28C3D46132A84798AE7C8A3034ABBAE43E3FF67337B5D372B966C27B611309`; no global package diff remains. Consequently there is no STARBORN screenshot/SHA in this branch, and product visual acceptance remains explicitly pending.

## Central integration obligations

1. Cherry-pick the single branch commit after conflict review; do not overwrite the concurrent axis-legality implementation.
2. Regenerate the global verified mechanics package and all owner/global contract/profile/package outputs for compiler v6.
3. Regenerate global acceptance catalog/index, qualification/binding/summary and formal roster reports; this branch intentionally does not commit them.
4. Capture and byte-bind real Workbench screenshots for both aliases (or an approved object-level visual protocol), obtain manual product signoff, then independently decide formal admission/optimization readiness.
