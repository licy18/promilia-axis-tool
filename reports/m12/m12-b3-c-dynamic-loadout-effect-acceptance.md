# M12-B3-C13 AfterDamage Target Weakness Debuff

- Status: `verification-complete-awaiting-product-acceptance`.
- Base: C12-R1 product acceptance `5537e5a59f9776d7045b0ce8ad9915738715a9a4`.
- Scope: only `set-skill:6:4`; `set-skill:3:4`, C14, M12-C, formal search, UI, package, and performance work remain locked.

## Evidence Contract

The versioned artifact is `scripts/optimization-qualification/evidence/after-damage-target-property-runtime-evidence.json`, `12185B`, SHA-256 `c60a582cda07b5e017cb47751a323f8958a6b1e292dc1a7f5bb34e7904374447`. It binds 9 exact RVA ranges to GameAssembly `222485544B / c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b` and dump `97428254B / 0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a`.

The executable graph is `199999063 -> 199999071 -> 199999064/199999070`. It proves AfterDamage(2), Self observation, OR selection of final verified NormalAttack(1) or WhackAttack(2), native Target(1), Cover refresh, and two PropertyElement leaves for attr202/203. The localized skill says 30% for 8 seconds, the trigger description says 30% for 24 seconds, while the executable wrapper and leaves resolve to `A=2000` through common function 1/base function 5 for 20% over 24000ms. The executable graph, formulas, and native consumers are authoritative.

`TriggerElement.Parse`, `CanTrigger`, `Trigger`, and `get_triggerCount` prove `triggerCounter=999999` is a finite TriggerEvent lifetime: one count is consumed per accepted trigger occurrence, not per target or property leaf. The counter and remaining lifetime enter canonical cycle state. The unload remover deletes only the source roots; an already materialized target wrapper keeps its original absolute expiry.

## Runtime Contract

Four or five valid same-set pieces install one trigger. A landed normal or charged attack applies one enemy-target debuff after the current packet settles, so the triggering packet is unchanged. Later legal hits inside `[apply, apply+24000ms)` receive the source-backed +20% physical and magical weakness-absorption modifiers; refresh does not stack, and the exact expiry frame restores the baseline.

Miss, `execute=false`, runtime block, wrong or missing final skill tag, wrong source, missing target, unmaterialized damage, and non-damage projection all fail closed. Source actors and enemy targets remain isolated; same-frame ordering follows stable source sequence; repeated initialization, switch, replay, and two-cycle state do not duplicate or lose the effect. Finite trigger counters that decrease across a proposed loop correctly fail the closure gate.

`set-skill:3:4` remains blocked: its accessory text describes normal-attack attack stacking, while the reachable graph identifies Iron-Mane Overlord, a five-received-hit state, and max-HP semantics. C13 does not infer across that identity conflict.

## Qualification

The denominator remains `11/43/62/137/12`. Runtime integration is `39/62` soul essences and `11/12` set skills. The unique ledger is `381 = 363 not-implemented + 18 evidence-insufficient`; the sole remaining dynamic set gap is `set-skill:3:4`. All five formal admission counts remain zero, `dnaFactors=[]`, and M12-C remains locked.

Final qualification hashes are source `52aefbcdd3136e43`, roster `fd752ae90abcb097`, manifests `6eedb0da6923c0c1`, ledger `afad67326a28035d`, binding `4eccbccddb161a51`, and catalog `64a821822e0362fa`. Dynamic census/catalog/source hashes are `59553fb7be3d86fb / 1648903a7e038e2c / 3a5cdd3fce685b76`.

## Verification

- C13 focused: `6 files / 178 tests`.
- Complete optimization qualification: `9 / 63`.
- Three-character profile/golden/migration: `4 / 38`; gameplay assertions and replay semantics unchanged.
- Canonical/runtime/cycle: `6 / 190`; Machine Axis: `12 / 159` with the established 30-second process-test budget.
- Nine deterministic audits, production build (`1875` modules), generation assert-clean, and `git diff --check`: passed.
- Standard Machine Axis hashes remain `ed57d06444210db0 / 5c21e09cba3bab55 / 416b4a015702f1b2 / 0b410dc9255d2654`.
- Existing Sass deprecation, circular chunk, large chunk, package-size, and performance warnings remain non-blocking and were not worked on.
