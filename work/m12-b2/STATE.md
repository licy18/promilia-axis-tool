# M12-B2-R2 Sustainable Cycle DPS

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
- Sampled pure-damage closure uses cycle-local common random numbers while reported DPS comes from each independent seed run. Reports include count, mean, sample variance, quantiles, and actor/action/hit conservation.
- Infinite HP bypasses finite-current-HP minimum protection in every enemy damage formula family while preserving shield handling.
- Kibo passive internal cooldown and finite trigger lifetime are canonical state; `-1` and `9999999` are generated as unlimited, positive small integers remain finite, and evidence-open counters are not silently classified.

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
- B2 worktree: `feature/m12-b2-cycle-dps`; R2 fixes are based on rejected commit `07284997f97e6f86c3ac17712937522d39bd37b0`.
- `AzPrMachineAxisCycleDps` v1, canonical evaluator, CLI `cycle`, target policy, fixture, report, and R2 regressions are implemented; R2 is waiting for product recheck.
- Canonical example: `[60,360)`, 5s, two cycles at 22.44996643 HP damage / 4 hits, cycle DPS 4.48999329.
- Tuning-mark closure uses non-worse stacks, shared decay semantics, and an independent held-ready countdown instead of exact row hashing.
- Infinite-target HP=1 and baseline HP now have identical normal, stack-over-limit, real-damage, hit-contribution and cycle-DPS results.
- Kibo 500206 / passive 520008 short-loop repro is rejected by `kiboPassiveRuntime` closure; no fixed third/fourth replay heuristic is used.
- Sampled 64-seed official axis: mean damage `22.59375`, sample variance `1.07043651`, p5/p25/p50/p75/p95 `22/22/22/24/24`; mean DPS `4.51875`; actor/action/hit contribution differences are all `0`.
- Kibo 500261 / passive 520082 sustainable loop is accepted; 520087 unlimited six-stack stable-refresh boundary closes. Real finite passive 520083 and Kibo 500206 / passive 520008 remain rejected.
- Canonical expected hashes: input `06083e73632e9e4d`, data `7b865d8e1825995a`, trace `db903427dcd1ecac`, evaluation `412605349bbf2fe3`, cycle `3950fd090a8634e1`.
- Three character numeric assertions and input/data hashes are unchanged; canonical trace hashes changed only because practical-unlimited passive state no longer exposes a false finite remainder.
- Verification: focused blocker tests `3/57`, full Machine Axis tests `12/157`, canonical/critical/Kibo tests `9/82`, character golden/profile tests `7/58`, eight audits clean, and production build passed.
- Remaining work: scoped diff review, R2 commit, then stop for product recheck.
