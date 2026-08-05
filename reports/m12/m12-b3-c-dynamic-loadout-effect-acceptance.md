# M12-B3-C15 Periodic Persistent Property Roots

- Status: `product-accepted-stage-paused`.
- Product acceptance baseline: `aafb6aa6c645b7b7490fdba0f71b8941da311f6e`.
- Base: C14 product acceptance `a5434a1e0b01c2d70db1832064e34f63fb44e279`.
- Scope: only the persistent installation root, periodic condition evaluation, and finite property-leaf lifecycle shared by `10078/10084/10152/10197`. M12-C, formal search, UI, package, performance, and later mechanism batches remain locked.

## Evidence Contract

The versioned artifact is `scripts/optimization-qualification/evidence/periodic-persistent-property-runtime-evidence.json`, `13603B`, SHA-256 `da295df64cfde1d6770e19b542b9fd1cca35c559606ccf31f65b2b0273b68461`. It binds GameAssembly `222485544B / c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`, the reviewed dump, battle-element assets, formula table, eight exact RVA ranges, and every root/leaf source identity.

`SkillPlayer` updates the persistent roots, `TriggerElement.OnUpdate` evaluates the source conditions, and `TriggerEffect` injects a finite `ChangePropertyElement` leaf. The first evaluation occurs at frame 1; a 1000ms root then evaluates at 61F/121F, while a 2000ms root evaluates at 121F/241F. A failed condition consumes that period. The persistent root and finite right-open leaf lifetime remain separate, and `Cover` refreshes one source instance.

## Runtime Disposition

- `10084`: applied. Root `19006000` refreshes 1100ms attr8 leaf `19006001` on the equipped actor; verified critical damage changes only while the leaf is active.
- `10152`: applied. Root `19004901` requires both source conditions and refreshes 1200ms attr222 leaf `19004902`; verified toughness settlement changes only while active. The leaf uses source `baseFunctionId=5`.
- `10197`: applied. Root `19007701` targets `GetSelfPet`; 2300ms attr21 leaf `19007702` changes only that actor's Kibo damage and does not leak to the actor.
- `10078`: remains evidence-insufficient. Root `19004600` and leaf `19004601` are indexed, but native matching for the source's multiple property tags `[302,303]` is not closed. No unscoped attr21 modifier is emitted.

All star values come from `skillsub_ele_value`; star 1 and another source star are regression-locked. Runtime sequence identity uses actor/loadout/control/map/root/tick/leaf provenance, not descriptor enumeration order. The periodic cadence phase is included in cycle boundary state, so a phase-shifted loop fails closure.

## Qualification

The denominator remains `11/43/62/137/12`. Runtime integration is `42/62` soul essences and `11/12` set skills. The unique ledger is 375 items: `354 not-implemented + 21 evidence-insufficient`. `set-skill:3:4` remains the sole set gap. All five formal admission counts remain zero, `dnaFactors=[]`, and M12-C remains locked.

Final generated hashes are source `661271d99b9e9b9e`, roster `93b5f932243f030b`, manifests `0700d78f431be1b9`, ledger `81dc3cbf160a4132`, binding `e2680052cfb8ea87`, and catalog `fd4eb4442b914a17`. Dynamic census/catalog/source hashes are `637c622f607c7593 / 9c5eba7a4694f5b6 / d5e0287dc75b3c16`.

## Verification

- C15 source/census/runtime/cycle focused: `5 files / 179 tests`.
- Complete optimization qualification: `11 / 71`.
- Three-character profile/golden/migration: `4 / 38`; gameplay assertions and replay semantics are unchanged.
- Canonical/runtime/cycle: `6 / 187`; Machine Axis: `12 / 160` with the established 30-second process-test budget.
- Nine deterministic audits are clean. Applied-source covers 49 property sources: 27 triggered, 22 persistent, including 3 periodic persistent roots, with zero drift.
- Production build passed with 1875 modules; generation assert-clean and `git diff --check` passed.
- Standard Machine Axis hashes remain `368b3279f56166c7 / 2c77540ff1b38280 / 03ea90d03d234e76 / 0b410dc9255d2654`.
- Existing Sass deprecation, circular chunk, large chunk, package-size, and performance warnings remain non-blocking and are outside C15.

C15 passed product acceptance at the recorded baseline. Work remains paused until an explicit user instruction; C16, M12-C, formal search, and any new mechanism batch have not started.
