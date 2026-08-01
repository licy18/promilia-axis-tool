# M12-B-R1 Search Remediation

Status: verification complete, awaiting product acceptance.

## Closed Findings

- Repeated semantic actions now receive globally unique axis IDs. Depth 8 and 24 real CLI runs returned 8/8 and 24/24 unique actions; a dead end preserves the last legal frontier, while a fully unsolvable horizon returns `machine-axis-search-no-solution`.
- Search snapshots now represent the actual prefix node frame rather than frame zero or the 120-second final state. They retain remaining horizon, cooldown/effect/resource state, pending delayed settlements, and cumulative gain.
- The main loop consumes action-end, cooldown-ready, resource/state/hit, verified input-window, burst-window, and horizon boundaries through bounded wait candidates.
- `burstWindowMs` is shared by canonical metrics, score, ranking, and report. The 1-second two-seed run produced samples `405 / 425` and score/report/by-actor damage `415 / 415 / 415`.
- Two explicit team candidates are searched independently and merged into one global Top-N.
- Search now applies the M12-A critical state-effect guard and explicit sampled seed sets.

## Verification

- Focused search: 6 files / 60 tests passed.
- Canonical architecture boundary: 1 file / 3 tests passed.
- M12-A, M11, service, and Kibo regressions: 5 files / 56 tests passed.
- Eight data/source/acceptance audits are clean; production build passed.
- One full Vitest attempt reached 167/170 files and 1136/1139 tests before the final targeted fixes: one architecture assertion was corrected and passed directly, one changed real-core test received a local 30-second budget and passed, and one unrelated historical owner-staging case remained a pure 180-second timeout. Per product direction, no second performance-only full run was started.

## Boundary

Deep authoritative search remains slow (`depth24 wallTimeMs=959524`) but correct; performance and bundle warnings are informational here. Evidence-open mechanics remain evidence-open. The next priority is M12-B2 sustainable cycle DPS, using `createSearchLoopClosureProjection` as the state projection seam; M12-C remains locked.
