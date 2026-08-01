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

## Current Status

- B2 product acceptance is closed.
- B3-A source and denominator recomputation is complete: source `0e2fa93b88d82707`, roster `6b5961e83e5b1eb7`, manifests `18f56af7088c1225`, ledger `d95dd2bdd11ecf54`, catalog `a97ba5f4ff6a397e`, binding matrix `3cf1c9cc678e4193`.
- Generated roster, consolidated manifests, gap ledger, binding matrix, summary, and runtime catalog are deterministic under `npm run audit:optimization-qualification`.
- Strict cultivation profile v1 is wired into Machine Axis, canonical input hashing, and direct Workbench adapter round-trip. Kibo talent level 10 resolves to 120; bond level 1 resolves to 900 basis points and level 0 is rejected.
- Formal qualification rejects all current unqualified objects before project creation. Research scenarios remain compatible.
- Post-checkpoint static cultivation slices apply character level, source-selected star-gift rank/node attributes, six ascension attribute stages, Kibo level/talents/bond, soul-essence level/rank, equipment enhancement, and source-backed tuning into the authoritative static compiler. Star-gift skill-level changes and ascension skill unlocks remain explicit unapplied sources; DNA, soul star dynamics, and equipment instance-tier legality remain blockers. Legacy Machine Axis hashes remain unchanged when no strict profile is supplied.
- The strict validator binds current-rank rune IDs to the selected character and rank. Previous completed ranks apply their full node sets; the current rank applies only the explicitly selected nodes. All 12 source character identities have 7 star-gift ranks, 6 ascension rows, and no missing rune source identity.
- Post-checkpoint verification: qualification/static/Machine Axis `4 files / 36 tests` passed; optimization qualification, production imports, Workbench data, action status, and applied-source audits are clean; production build passed with pre-existing Sass/chunk warnings. One wider directory run exceeded its 180-second command budget without emitting an assertion failure and was not repeated as a performance gate.
- Current optimization-ready counts are zero for all five object kinds. M12-C remains locked.
- Verified before checkpoint: B3-A focused `1 file / 8 tests`, shared Machine Axis/acceptance `18 files / 198 tests`, optimization qualification plus eight existing data/source audits clean, and production build passed with only pre-existing Sass/chunk warnings.
- Next: checkpoint the character static cultivation slice, then continue only evidence-backed qualification operators without running formal search.

## B3-A Blockers

- Not implemented: 645 unique object-scoped blockers, including 62 soul-essence dynamic skills, 12 set skills, strict cultivation runtime propagation, and missing visual acceptance.
- Evidence insufficient: 184 object-scoped blockers, including Kibo DNA, 4 selected Kibo passive gaps, and missing equipment instance `bGoldSide/maxValue` evidence.
- STARBORN aliases normalize to one source-mechanism hash, but the verified static/runtime actor contract is not compiled for either alias.

## Hard Boundaries

- Do not run formal team/loadout/action-axis optimization.
- Do not start M12-C until the full `11/43/62/137/12` denominator and binding matrix qualify.
- Do not modify the dirty main workspace, UI, package size, performance, or unrelated character/Kibo mechanics.
