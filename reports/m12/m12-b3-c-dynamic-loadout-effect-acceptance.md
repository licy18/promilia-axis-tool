# M12-B3-C6 BeforeDamage Event Bridge

- Status: `verification-complete-awaiting-product-acceptance`
- Base: C5 product-accepted at `5c713e55ffdc46e5e75e9a4a4dcc1d0366201be0`
- Scope: soul essences `10044`, `10123`, `10130`, and `10150`; `10018` remains blocked by its unresolved outer activation prerequisite.

## Source Contract

`AliveElementSystem.OnExecuteDamageElement@0x1318800` calls `OnBeforeAttack` at `0x1319276`, settles the damage at `0x131935A`, then calls `OnAfterAttack` at `0x13193C7`. The frozen binary/range hashes prove event 1 is dispatched before settlement and event 2 after settlement. `CheckElementId(13)` reads the actual damage element ID, while `CheckElementType(8)` reads the damage template's real `types` collection.

Ordinary landed hits and verified tuning damage packets publish the same stable `before -> settlement -> after` transaction. Misses, blocked actions, absent packets, held marks without consumption, and initial-state restoration publish no triggerable BeforeDamage event. Each transaction retains action/actor/hit, final control binding, skill and property tags, damage element/types, tuning judgment/selected candidate, frame, and source sequence.

## Runtime Result

`10044` reacts to landed fire `196` or wind `796` packets and adds the source actor's fire damage property. `10123` reacts to wind `796`; `10130` matches real template type `37`; `10150` stacks on fire `196` or wind `796`. PropertyTag `[301]` remains an independent charged-damage scope: a trigger command may exist while an ordinary or otherwise mismatched settlement receives no modifier.

BeforeDamage is visible to its own matching settlement but never to an earlier same-frame source sequence. C4 AfterDamage remains post-settlement and cannot self-apply. Refresh, stack cap, right-open expiry, Self ownership, switch behavior, replay, and cycle state are covered by real ordinary/tuning runtime tests.

## Qualification

Soul effects are `23/62 runtime-applied` and `39/62 dynamic-unapplied`. The unique blocker ledger is `424` (`408 not-implemented`, `16 evidence-insufficient`). All 12 set effects remain unapplied; every formal admission count is zero and M12-C remains locked.

Final verification passed C6 focused mechanics `4 files / 115 tests`, three-character profile/migration `4 / 38`, Machine Axis `12 / 157`, canonical/runtime `6 / 62`, nine deterministic audits, and production build. Applied-source audit is `23 property sources / 0 drift`, `13 tuning conditions / 0 drift`, and `12 priority consume groups / 0 drift`.
