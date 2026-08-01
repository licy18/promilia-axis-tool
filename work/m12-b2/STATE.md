# M12-B2 Sustainable Cycle DPS

## Goal

Implement a canonical, headless sustainable-cycle evaluator on top of Machine Axis. M12-C remains locked.

## Product Contract

- A cycle requires an explicit non-empty half-open interval `[loopStartFrame, loopEndFrame)`.
- The cycle scenario uses infinite enemy HP and disables toughness, break, and death truncation.
- Damage is assigned by the actual hit frame; an event at `loopEndFrame` belongs to the next cycle.
- Actor SP, Kibo energy, special resources, tuning marks, controlled actor, and other consumable state must close.
- The semantic loop is replayed twice through the canonical core. The second replay must remain executable and close again.
- One-time warmup state cannot raise the reported sustainable result.
- Expected critical is the default for pure-damage evaluation; sampled stateful critical requires explicit seeds.

## Implementation Direction

1. Add a versioned cycle envelope and validator.
2. Add a canonical target-evaluation policy for infinite HP and disabled toughness/break.
3. Resolve the first loop through Machine Axis, clone only semantic loop intents for a second cycle, and replay both through the same core.
4. Build interval contributions from canonical damage events and state closure from canonical snapshots.
5. Expose API/CLI output with hashes, assumptions, state diffs, contribution conservation, and two-cycle proof.

## Required Regressions

- Missing/empty loop is rejected.
- Net resource loss is rejected.
- A cooldown that blocks the second cycle is rejected.
- Delayed hits at half-open boundaries are counted exactly once.
- A one-time warmup Buff cannot inflate cycle DPS.
- A legal loop produces stable damage and state closure over two replays.

## Status

- M12-B-R2 merged and accepted on master.
- B2 worktree: `feature/m12-b2-cycle-dps` from `ebd7122`.
- `AzPrMachineAxisCycleDps` v1, canonical evaluator, CLI `cycle`, target policy, fixture, report, and focused regressions are implemented.
- Canonical example: `[60,360)`, 5s, two cycles at 22.44996643 HP damage / 4 hits, cycle DPS 4.48999329.
- Tuning-mark closure uses non-worse stacks, shared decay semantics, and an independent held-ready countdown instead of exact row hashing.
- Canonical hashes: input `06083e73632e9e4d`, data `7b865d8e1825995a`, trace `db903427dcd1ecac`, evaluation `412605349bbf2fe3`, cycle `65c9b0958a65fd5f`.
- Verification: cycle `1/22`, focused headless `11/145`, character golden/profile `4/38`, eight audits clean, production build passed.
- Remaining work: scoped diff review and commit, then stop for product acceptance.
