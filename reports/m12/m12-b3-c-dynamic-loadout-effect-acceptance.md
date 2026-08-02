# M12-B3-C8-R1 Stable Direct-Effect Source Order

- Status: `verification-complete-awaiting-product-acceptance`
- Reviewed C8 baseline: `1b16f2ddcbc3594a2c5de964ff11933d1da37c63`
- Accepted predecessor: C7-R3 at `f73b0ac6a457719ad0e24b98415f2f9d67c3e8a5`
- Scope: stable source ordering for generated `direct-sp`, `direct-heal`, and `direct-shield`; no C9 or M12-C work.

## C8 Contract

`CheckElementType(8)` reads the acquired element's native `types`. All nine tuning-mark containers publish those source types; wind mark `750` is distinct from linked property leaf `751` and DamageElement `752`. Soul essence `10052` observes only the equipped actor's real type-41 acquisition and changes verified direct-heal settlement from 100 to 111 at star 1 and 119 at star 4. Initial inheritance, consume, expiry, damage packets, wrong source, and unresolved provenance do not dispatch GetElement.

## R1 Ordering Contract

The rejected C8 build let generated direct effects fall back to a global descriptor ordinal. Unexecuted or out-of-horizon descriptors could therefore move a same-frame heal across the GetElement After phase and change whether `10052` applied.

`AzPrVerifiedEffectSourceSequence` now derives a local path from the action source sequence plus the verified effect graph's timeline group, map, reference kind, element, node traversal, trigger, phase, and target indices. Before, settlement, and After use one canonical ordering namespace. Reordering descriptor arrays does not change these paths. A legacy direct effect without a verified path fails closed with `VERIFIED_DIRECT_EFFECT_SOURCE_SEQUENCE_UNRESOLVED`; the runtime never guesses with a global ordinal.

The production-path regression runs generated direct effects through effect generation, the effect timeline, and the full runtime. Same-frame heal before acquisition remains 100, heal after acquisition is 111, and inserting 30 out-of-horizon descriptors leaves `[100, 111]` unchanged. Generated direct-SP and direct-shield provenance is stable as well. Source-order readiness uses a namespaced status and cannot accidentally classify an unresolved gameplay effect as applied.

## Qualification

The denominator remains `11/43/62/137/12`. Soul effects remain `26/62 runtime-applied`; the unique blocker ledger remains `418` (`400 not-implemented`, `18 evidence-insufficient`). Every formal admission count is zero and M12-C remains locked.

Final qualification hashes are source `b49537c3859dd0ad`, roster `3ae68f8d9c3eb62a`, manifests `d5cf870eb3ca547d`, ledger `dc8015acb06da47a`, binding `d4110346a5460742`, and catalog `fdb4256d91bb9234`. The verified package is `20498c0f...bb88e9` with file SHA-256 `b84aaca9...53a971`.

## Verification

- Focused source/runtime: `8 files / 148 tests`.
- Three-character profile/migration: `4 / 26`; authoritative replay hashes and numeric assertions unchanged.
- Canonical/package boundary: `3 / 27`.
- Machine Axis: `12 / 157` with a 30-second budget for existing process-heavy tests.
- Nine deterministic audits, production build, and `git diff --check`: passed.
- Standard Machine Axis hashes: `ed57d06444210db0 / 5c21e09cba3bab55 / 40a0e5018a43c3ae / 0b410dc9255d2654`.
