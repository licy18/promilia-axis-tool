# M12-B3 Optimization Qualification

## Goal

Build a recomputable qualification boundary for the wind/thunder roster, STARBORN aliases, Kibo, soul essence, equipment, set skills, and their binding matrix. This stage does not run formal optimization. M12-C remains locked.

## Baseline

- Accepted M12-B2 implementation: `76530074f6c2fb1d2b88b4eee1d2fd558d01ce2b`.
- M12-B2 closeout commit: `db8c0506aa4dca9e9a4ef20ae34ca1920011f4c9`.
- Branch: `feature/m12-b3-optimization-qualification`.
- Worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m12-b3`.
- The B3 contract was selectively synchronized from the dirty main-workspace plan on 2026-08-01; the main workspace was not modified.

## Frozen Plan Snapshot

- Character optimization objects: `11`, including one `STARBORN` object with source aliases `199001` and `199002`.
- Kibo: `43` (`22` wind/thunder single-element and `21` dual-element containing wind or thunder).
- Soul essence: `62`.
- Public equipment: `137`.
- Set-skill threshold records: `12`.
- Current known blockers include `62/62` soul-essence effect skills and `12/12` set skills classified as `dynamic-unapplied`.
- Kibo DNA is outside the current product scope. The only canonical value is `dnaFactors: []`; omitted input normalizes to empty, non-empty input is rejected before compile/validate/search, and DNA evidence does not count as a qualification gap.

## Current Status

- B2 product acceptance is closed.
- B3-A source and denominator recomputation is complete: source `bb10266218ee7a04`, roster `a036b7e4f6be6b73`, manifests `c13b786ee8cc1f5b`, ledger `c03eea5e1ba08ad8`, catalog `3a122af58e041688`, binding matrix `12bbd3ebe73dfe38`.
- Generated roster, consolidated manifests, gap ledger, binding matrix, summary, and runtime catalog are deterministic under `npm run audit:optimization-qualification`.
- Strict cultivation profile v1 is wired into Machine Axis, canonical input hashing, and direct Workbench adapter round-trip. Kibo talent level 10 resolves to 120; bond level 1 resolves to 900 basis points and level 0 is rejected.
- Formal qualification rejects all current unqualified objects before project creation. Research scenarios remain compatible.
- Post-checkpoint static cultivation slices apply character level, source-selected star-gift rank/node attributes, six ascension attribute stages, Kibo level/talents/bond, soul-essence level/rank, equipment enhancement, and source-backed tuning into the authoritative static compiler. All 62 soul-essence effect skills bind to source-supported `star=1..4` skill levels and public Schema rejects star 5. DNA is no longer sourced or applied in this version; the empty-only value remains part of canonical input and replay hashes. Soul-essence dynamic effects, star-gift skill-level changes, ascension skill unlocks, and equipment instance-tier legality remain explicit blockers. Legacy Machine Axis hashes remain unchanged when no strict profile is supplied.
- The strict validator binds current-rank rune IDs to the selected character and rank. Previous completed ranks apply their full node sets; the current rank applies only the explicitly selected nodes. All 12 source character identities have 7 star-gift ranks, 6 ascension rows, and no missing rune source identity.
- Current verification: DNA-scope qualification/static/Machine Axis/Workbench `6 files / 57 tests` passed; optimization qualification plus production imports, Workbench data, action status, applied-source, character acceptance, character combat, verified combat, and Kibo headless audits are clean; production build passed with pre-existing Sass/chunk warnings.
- Current optimization-ready counts are zero for all five object kinds. M12-C remains locked.
- Verified before checkpoint: B3-A focused `1 file / 8 tests`, shared Machine Axis/acceptance `18 files / 198 tests`, optimization qualification plus eight existing data/source audits clean, and production build passed with only pre-existing Sass/chunk warnings.
- Next: checkpoint the empty-only DNA product boundary, then continue only evidence-backed soul-essence and set-skill qualification operators without running formal search.

## B3-A Blockers

- Not implemented: 602 unique object-scoped blockers, including 62 soul-essence dynamic skills, 12 set skills, strict cultivation runtime propagation, and missing visual acceptance. Moving DNA to the current-version product boundary removed exactly 86 former blockers (`2 x 43`); DNA now contributes zero source or acceptance gaps.
- Evidence insufficient: 141 object-scoped blockers: 137 equipment instance `bGoldSide/maxValue` gaps and 4 selected Kibo passive gaps.
- STARBORN aliases normalize to one source-mechanism hash, but the verified static/runtime actor contract is not compiled for either alias.

## Hard Boundaries

- Do not run formal team/loadout/action-axis optimization.
- Do not start M12-C until the full `11/43/62/137/12` denominator and binding matrix qualify.
- Do not modify the dirty main workspace, UI, package size, performance, or unrelated character/Kibo mechanics.
