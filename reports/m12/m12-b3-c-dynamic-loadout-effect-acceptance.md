# M12-B3-C7-R2 Landed-Hit Recovery Parity

- Status: `verification-complete-awaiting-product-acceptance`
- Reviewed C7 base: `5647f1a74d74cb63b763ed06367ac8198084cab1`
- Reviewed C7-R1 base: `8760b14b448ff22290895736a6f7b19c077fe589`
- Scope: soul essences `10048`, `10169`, `10175`, and `10176`; `10018`, `10052`, and `10101` remain outside this batch.

## Source Contract

The frozen `GameAssembly.dll` (`222485544B`, SHA-256 `c60d1379...22b`) closes three native consumers: `HeroSwitchSystem.TriggerSwitchEnter@0x1596740`, `ShieldElement.Execute@0x13A2040`, and `DamageUtility.OnAfterHeal@0x1872130`. It also proves that `triggerInv` is parsed as milliseconds. The exact byte windows and source identities are stored in `scripts/optimization-qualification/evidence/soulessence-non-damage-runtime-evidence.json` (`5872B`, SHA-256 `1465c750...552`).

Canonical non-damage transactions now project successful switches, direct and periodic heals, and direct shield acquisition from their existing settlements. `Self` observes the native event subject; `Target(1)` on AfterHeal resolves to the healed actor. Initial state, rejected descriptors, no-op switches, and zero-value shields do not emit triggerable events. Periodic heals retain their real source but do not borrow stale action tags.

## Runtime Result

`10048` is runtime-applied: a real switch into the equipped actor creates one SwitchEnter event and three deterministic AllHero attack modifiers for 8 seconds; initial foreground, switch-out, same-actor no-op, and invalid switches do not trigger. Its `triggerInv=10` is preserved as a 10ms interval gate.

`10175` is runtime-applied: an executed ultimate heal creates a 2-second attack modifier on the actual healed actor, including healer != target and full-HP zero-effective-heal cases. Blocked descriptors do not trigger, and numeric tests prove only the healed target receives the damage increase during the right-open lifetime.

`10169` remains evidence-insufficient because native shield refresh/replacement dispatch has not been closed. `10176` remains unapplied because `combineType=5 / combineNumber=-1` semantics are unresolved. Neither is approximated by the runtime.

## C7-R1 Resource Parity

The rejected C7 build kept action costs in `non-damage-event-projection` but filtered the earlier resource gains that make those actions executable. R1 projects manual resource changes, automatic SP, direct SP, landed-hit actor and Kibo recovery, and tuning overlimit direct SP before applying the same actor/Kibo cost gates. A landed hit contributes recovery through its verified damage transaction identity without evaluating damage, toughness, or critical branches.

The real regression now proves `manual +100 SP -> cost 100 -> direct heal/shield`: full and preliminary runtimes both execute, AfterHeal is emitted exactly once, and `10175` still targets the healed actor. Resource-insufficient actor and Kibo actions emit neither heal nor shield. The isolated projection produces zero damage/toughness events and consumes zero sampled critical rolls; the final runtime starts from a fresh state and random source.

## C7-R2 Landed Recovery Eligibility

R1 still had two landed-hit gates: full runtime recovered only after the damage formula returned ready, while the non-damage projection recovered from transaction presence. Native evidence closes that split. `DamageElement.Parse@0x138E5E0` stores `recoverSP`, `petRecoverSP`, and `recoverInterval`; `AliveElementSystem.ExecuteDamageElement@0x131935A` calls `DamageElement.RecoverSP@0x138EEE0` at `0x1319594`, with the remote branch calling it at `0x1318E52`. Recovery is therefore an independent landed DamageElement transaction, not proof that the simulator has every numeric damage input.

Full and projection runtimes now share one eligibility contract: the action must execute, the hit must remain inside contextual occupancy, recovery source fields must be parseable, and the landed transaction's action, hit, before/after context, timestamp, and transaction identities must agree. Missing or drifted identities, misses, blocked actions, unresolved recovery fields, and recover-interval duplicates fail closed. If damage inputs are unresolved, full runtime keeps `VERIFIED_COMBAT_HIT_UNRESOLVED` and records the recovery as a separate applied resource settlement; projection states that damage was not evaluated and executes no damage, toughness, or critical branch.

The real regression starts Pangpang at 99 SP, lets a verified landed A3 transaction fund a 100-SP ultimate, and verifies the subsequent direct heal in both runtimes across missing enemy profile, actor attack, hit ratio, enemy defense, Kibo source, identity drift, miss/block, and interval boundaries. The projection still emits zero damage/toughness events and consumes zero sampled critical rolls.

## Qualification

Soul effects are `25/62 runtime-applied` and `37/62 dynamic-unapplied`. The unique blocker ledger is `420` (`402 not-implemented`, `18 evidence-insufficient`). All 12 set effects remain unapplied; every formal admission count is zero and M12-C remains locked.

Verification passed C7-R2 focused mechanics `3 files / 103 tests`, three-character profile/migration `4 / 38`, Machine Axis `12 / 157`, canonical/runtime `6 / 72`, nine deterministic audits, and production build. Applied-source audit remains `25 property sources / 0 drift`, `13 tuning conditions / 0 drift`, and `12 priority consume groups / 0 drift`.
