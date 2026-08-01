# M12-B-R1 Search Remediation

## Goal

Repair the M12-B optimizer correctness findings from the independent acceptance record at `doc/promilia-axis-m12-b-independent-acceptance-20260801.md`. Work starts from merged baseline `8a8e45252ccf0784018cdded689eb34387e7d638`; M12-C remains locked.

## Blocking Findings

- Search-generated action IDs repeat across depth, and a dead-end discards the last valid frontier.
- Search snapshots mix a 120-second final state with frame zero; event-boundary nodes are not consumed by the main loop.
- `burstWindowMs` does not control scoring.
- No outer candidate-team enumeration exists.
- Search bypasses the M12-A critical state-effect guard and ignores explicit seed sets.

## Done Criteria

- Depth 8 and 24 searches retain valid non-empty results with repeated semantic actions and globally unique IDs.
- Search state uses the actual prefix node frame and preserves arrival time, remaining horizon, cooldown/effect/resource state, and cumulative gain in dominance decisions.
- Action-end, cooldown-ready, resource/state, window, and horizon boundaries are consumed by the main loop, including evidence-backed wait candidates.
- Burst scoring, ordering, and report metrics share the requested window.
- Critical state-effect policy and explicit sampled seed sets match M12-A semantics.
- Candidate teams are enumerated outside the inner axis search and merged into one cross-team Top-N.
- Focused real-core tests, existing M12-A/M11 regressions, data audits, and build pass; performance remains informational.
- One focused commit is produced, then work stops at M12-B-R1 product re-review. M12-C is not started.

## Current Status

- Isolated branch/worktree created at `C:\Codex\AzPr Axis\.worktrees\promilia-m12-b-r1`.
- Baseline includes M12-B functional commit `5f5bb0765e07ecd125b8ad6f09cfcbf8cc6460c6` through merge `8a8e452`.
- All five acceptance findings are implemented and covered by real-core tests.
- Real CLI depth 8/24 returned 8/24 actions with 8/24 unique IDs; neither search collapsed at a dead end.
- Real CLI one-second burst with seeds `r1-a,r1-b` produced sample scores `405/425` and mean/rank/report score `415`.
- Character, verified-combat, source, production-data, acceptance, and Kibo audits are clean; production build passes.
- Full-suite performance timeouts remain informational under the product boundary; targeted assertion regressions are green.
- M12-B-R1 is ready for product re-review. M12-B2 cycle DPS is next; M12-C remains locked.

## Next Steps

1. Commit the focused R1 source, tests, fixture/schema, reports, and high-level documents.
2. Stop at the M12-B-R1 product re-review boundary.
3. After R1 acceptance, implement M12-B2 sustainable cycle DPS before M12-C.

## Do Not Do

- Do not modify the dirty master worktree, screenshots, or unrelated `work/` trees.
- Do not start M12-C, add UI, optimize bundle size/performance, or add character/Kibo mechanics.
- Do not accept empty successful reports or hide unresolved evidence assumptions.
