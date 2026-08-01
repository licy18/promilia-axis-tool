# M12-B3 Optimization Qualification

## Goal

Build a recomputable qualification boundary for the wind/thunder roster, STARBORN aliases, Kibo, soul essence, equipment, set skills, and their binding matrix. This stage does not run formal optimization. M12-C remains locked.

## Baseline

- Accepted M12-B2 implementation: `76530074f6c2fb1d2b88b4eee1d2fd558d01ce2b`.
- M12-B2 closeout commit: `db8c0506aa4dca9e9a4ef20ae34ca1920011f4c9`.
- Branch: `feature/m12-b3-optimization-qualification`.
- Worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m12-b3`.
- B3-A-R1 repair baseline: `c16954f79eabc392b9e8667b7faed3fa89de6d06`.
- The B3 contract was selectively synchronized from the dirty main-workspace plan on 2026-08-01; the main workspace was not modified.

## Frozen Plan Snapshot

- Character optimization objects: `11`, including one `STARBORN` object with source aliases `199001` and `199002`.
- Kibo: `43` (`22` wind/thunder single-element and `21` dual-element containing wind or thunder).
- Soul essence: `62`.
- Public equipment: `137`.
- Set-skill threshold records: `12`.
- Current known blockers include `54/62` soul-essence effect skills and `12/12` set skills classified as `dynamic-unapplied`; `8/62` source-closed soul effects are runtime-integrated but still lack complete qualification.
- Kibo DNA is outside the current product scope. The only canonical value is `dnaFactors: []`; omitted input normalizes to empty, non-empty input is rejected before compile/validate/search, and DNA evidence does not count as a qualification gap.

## Current Status

- B2 product acceptance is closed.
- B3-A-R1 source and denominator recomputation is complete: source `95cac6744423e44b`, roster `e574c0d8d5c9f335`, manifests `41d8d2857ee6c699`, ledger `f31dfaa6bed204c3`, catalog `9a7300aa8825aba6`, binding matrix `d21335a454947b3c`.
- Generated roster, consolidated manifests, gap ledger, binding matrix, summary, and runtime catalog are deterministic under `npm run audit:optimization-qualification`.
- Strict cultivation profile v1 is wired into Machine Axis, canonical input hashing, and direct Workbench adapter round-trip. Kibo talent level 10 resolves to 120; bond level 1 resolves to 900 basis points and level 0 is rejected.
- Formal qualification derives one whole-stage gate from the `11/43/62/137/12` records, admissions, set-skill thresholds, actor-Kibo/soul/equipment bindings, equipment slots, and source hashes. Partial green catalogs are rejected before project/search; research scenarios remain compatible.
- Static cultivation applies character level, completed star-gift attributes strictly through `selectedRank - 1`, current/prior eligible nodes, Kibo level/talents/bond, soul-essence level/rank, equipment enhancement, and source-backed tuning. `hero_rank` now supplies `levelBreakthroughRank` legality against `rankLevelLimit`; its attributes and skill unlocks remain explicit unapplied evidence rather than a second unproven stat stack. Xiaoyu level 80, star-gift rank 7 matches the committed naked panel with attribute completion through rank 6, and the corrected panel propagates to Kibo inheritance and damage.
- Runtime-applied soul effects: `10001 汁石就是力量`, `10002 家书`, `10037 厨房的秘密`, `10060 宵祝`, `10094 陪伴`, `10125 高手在此！`, `10154 月下秘仪`, and `10155 恶作剧前奏`. One data-driven matrix covers Before/After, stack/refresh, normal/charged/star-skill, suppression, exact duration/expiry, and same-frame settlement. An `AfterSkill` effect is available to following actions at the boundary but never retroactively buffs its own final-frame hit.
- The public schema requires `levelBreakthroughRank`; legacy `ascensionRank` is rejected. Previous completed star-gift ranks apply all nodes, while the current rank applies only explicit node IDs. All 12 source character identities have 7 star-gift ranks, 6 level-breakthrough rows, and no missing rune source identity.
- Current verification: focused and headless regression `24 files / 285 tests` passed, including the standalone Machine Axis result `12 files / 157 tests`; optimization qualification plus production imports, Workbench data, action status, applied-source, character acceptance, character combat, verified combat, and Kibo headless audits are clean; production build passed with pre-existing Sass/chunk warnings. The applied-source check no longer rewrites `generatedAt` when semantic content is unchanged.
- Current optimization-ready counts are zero for all five object kinds. M12-C remains locked.
- Current maturity is `233 extracted / 32 runtime-integrated`; all five optimization-ready counts remain zero. Blocking gaps are `727` unique (`586 not-implemented`, `141 evidence-insufficient`).
- Status: `B3-A-R1 verification-complete-awaiting-product-acceptance`. Stop here; do not continue B3 batches or enter M12-C before product review.

## B3-A Blockers

- Not implemented: 586 unique object-scoped blockers, including 54 unresolved soul-essence dynamic skills, 12 set skills, strict cultivation runtime propagation, and missing visual acceptance. Moving DNA to the current-version product boundary removed exactly 86 former blockers (`2 x 43`); DNA contributes zero source or acceptance gaps.
- Evidence insufficient: 141 object-scoped blockers: 137 equipment instance `bGoldSide/maxValue` gaps and 4 selected Kibo passive gaps.
- STARBORN aliases normalize to one source-mechanism hash, but the verified static/runtime actor contract is not compiled for either alias.

## Hard Boundaries

- Do not run formal team/loadout/action-axis optimization.
- Do not start M12-C until the full `11/43/62/137/12` denominator and binding matrix qualify.
- Do not modify the dirty main workspace, UI, package size, performance, or unrelated character/Kibo mechanics.
