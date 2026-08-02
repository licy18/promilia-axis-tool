# M12-B3-C7 Non-Damage Event Transactions

- Status: `verification-complete-awaiting-product-acceptance`
- Base: C6 product-accepted at `5c5a33a21cce05fbf090af72c783bad475b55656`
- Scope: soul essences `10048`, `10169`, `10175`, and `10176`; `10018`, `10052`, and `10101` remain outside this batch.

## Source Contract

The frozen `GameAssembly.dll` (`222485544B`, SHA-256 `c60d1379...22b`) closes three native consumers: `HeroSwitchSystem.TriggerSwitchEnter@0x1596740`, `ShieldElement.Execute@0x13A2040`, and `DamageUtility.OnAfterHeal@0x1872130`. It also proves that `triggerInv` is parsed as milliseconds. The exact byte windows and source identities are stored in `scripts/optimization-qualification/evidence/soulessence-non-damage-runtime-evidence.json` (`5872B`, SHA-256 `1465c750...552`).

Canonical non-damage transactions now project successful switches, direct and periodic heals, and direct shield acquisition from their existing settlements. `Self` observes the native event subject; `Target(1)` on AfterHeal resolves to the healed actor. Initial state, rejected descriptors, no-op switches, and zero-value shields do not emit triggerable events. Periodic heals retain their real source but do not borrow stale action tags.

## Runtime Result

`10048` is runtime-applied: a real switch into the equipped actor creates one SwitchEnter event and three deterministic AllHero attack modifiers for 8 seconds; initial foreground, switch-out, same-actor no-op, and invalid switches do not trigger. Its `triggerInv=10` is preserved as a 10ms interval gate.

`10175` is runtime-applied: an executed ultimate heal creates a 2-second attack modifier on the actual healed actor, including healer != target and full-HP zero-effective-heal cases. Blocked descriptors do not trigger, and numeric tests prove only the healed target receives the damage increase during the right-open lifetime.

`10169` remains evidence-insufficient because native shield refresh/replacement dispatch has not been closed. `10176` remains unapplied because `combineType=5 / combineNumber=-1` semantics are unresolved. Neither is approximated by the runtime.

## Qualification

Soul effects are `25/62 runtime-applied` and `37/62 dynamic-unapplied`. The unique blocker ledger is `420` (`402 not-implemented`, `18 evidence-insufficient`). All 12 set effects remain unapplied; every formal admission count is zero and M12-C remains locked.

Verification passed C7 focused mechanics `3 files / 82 tests`, three-character profile/migration `4 / 38`, Machine Axis `12 / 157`, canonical/runtime `6 / 87`, nine deterministic audits, and production build. Applied-source audit is `25 property sources / 0 drift`, `13 tuning conditions / 0 drift`, and `12 priority consume groups / 0 drift`.
