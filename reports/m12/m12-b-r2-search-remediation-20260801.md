# M12-B-R2 Search Remediation

Status: verification complete, awaiting product acceptance.

## Closed Findings

- Resource waits now use the blocked candidate's real resource condition and the canonical future resource trajectory. Pangpang at 90 SP reaches the 100 SP ultimate threshold at frame 2886, resumes at frame 2887, and executes the ultimate within depth 2. Kibo 500001 at 99 energy reaches 100 at frame 294, resumes at frame 295, and executes signature action 50000102.
- A special-resource transaction with explicit 0→6 growth produces the required-5 threshold at frame 60 and resumes at frame 61; the matching 0→0 case produces no wait. The search no longer invents ammo or special-resource recovery.
- Multi-seed contributions are averaged by stable actor, action, and hit identity. Samples 405 and 425 produce score, HP metric, burst metric, and each aggregate contribution sum of 415. Every sample keeps its own metrics, contributions, and trace hash.

## Verification

- Focused search: 6 files / 62 tests passed.
- Related Machine Axis service, batch evaluator, canonical core/boundary, and Kibo energy regression: 5 files / 43 tests passed.
- Canonical architecture boundary: 1 file / 3 tests passed; axis boundary: 1 file / 23 tests passed.
- Eight data/source/acceptance audits are clean; focused ESLint and the production build passed.
- The independently accepted R1 depth-8 result (8 actions, 8 unique IDs, score/HP 1259, two-team global Top-N) remains covered by the focused real-core regression.

## Boundary

M12-B2 sustainable cycle DPS and M12-C have not started. This commit stops at the M12-B-R2 product re-review boundary.
