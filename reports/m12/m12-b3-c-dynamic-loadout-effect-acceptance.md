# M12-B3-C5 Get-Element Event Bridge

- Status: `verification-complete-awaiting-product-acceptance`
- Base: `8bf0b3a77538102c1995dd5943e4a7275664ca0a` (C4-R1 product-accepted baseline)
- Formal admissions: `0 / 0 / 0 / 0 / 0`; M12-C remains locked.

## Contract

The source compiler now preserves `BeforeGetElement(9)`, `AfterGetElement(10)`, `CheckElementId(13)`, trigger-source `Self(0)`, and effect target `AllHero(15)` as separate identities. `GameAssembly.dll` binds event 9 before `AliveElementSystem.OnExecuteNormalElement` mutates the element and event 10 after combine/new-element execution. The exact RVA ranges are hash-gated by `soulessence-get-element-runtime-evidence.json`.

Verified tuning generation publishes one paired transaction for each successful action or threshold acquisition. Both phases share a transaction identity and retain before/delta/after state, mark/profile, source action/actor/hit, frame and source sequence. A successful acquisition at the five-layer cap is a zero-delta refresh transaction and still dispatches; initial-state restoration, consume, expiry, held/periodic state, overlimit packets, and failed/unexecuted actions do not.

`10043 宣告黎明之花` listens only to wind mark 750 acquisitions sourced by its equipped actor, then applies `attribute 229` to every hero before mutation. The effect uses `A/10000`, lasts 16 seconds, stacks independently to five layers, and star values are `75000/100000/125000/150000`. `10149 失控飞行` listens only to fire mark 150 acquisitions from its equipped actor after mutation, applies the same attribute to every hero with literal `A`, lasts 24 seconds, refreshes one layer, and uses `45/60/75/90`.

## Runtime Matrix

Real verified star-skill actions `10700212` and `10800112` produce wind/fire acquire transactions. Both soul effects expand to three deterministic hero commands, increase a non-source teammate's tuning settlement by the source formula, survive controlled-actor switches, and return to baseline at the right-open expiry boundary. Tests cover stacking, cap refresh, repeated refresh, wrong element, same element from the wrong actor, inherited state, consume/expiry, blocked actions, replay and cycle inheritance. C4-R1 ordered candidate selection and one-packet overlimit behavior remain unchanged.

## Result

Soul effects are `19/62 runtime-applied` and `43/62 dynamic-unapplied`. The unique blocker ledger is `432` (`416 not-implemented`, `16 evidence-insufficient`). All 12 set effects remain unapplied and no formal qualification was granted.

Verification passed: C5 focused mechanics `3 files / 86 tests`, Machine Axis `12 / 157`, three-character profile/golden `3 / 34`, canonical/runtime `6 / 106`, headless golden migration `1 / 4`, nine deterministic audits, and production build. Applied-source audit is `19 property sources / 0 drift`, `7 tuning conditions / 0 drift`, and `12 priority consume groups / 0 drift`.

The qualification hashes are `8368dcab431c3a25 / 0f328c23d795ad6b / fde0e0f54cfdde54 / 9f4861b9759f8779 / e5dede43eddc1f7d / 0b52db0abd10b411`. The Machine Axis hashes remain `c8bfd28dcb890f4f / 98deb78db6293f88 / 8586fe2ee148b0fe / 0b410dc9255d2654`; no canonical gameplay hash drift occurred. Existing Sass, circular-chunk and large-chunk warnings remain non-blocking.
