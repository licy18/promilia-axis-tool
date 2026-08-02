# M12-B3-C4 Tuning Mark Event Condition Bridge

- Status: `verification-complete-awaiting-product-acceptance`
- Base: `e05b10fd27a6c723a773a7680169a9180031c48e` (C3 product acceptance)
- Formal admissions: `0 / 0 / 0 / 0 / 0`; M12-C remains locked.

## Contract

The generator now compiles `CheckElementType(8)`, `HasElementId(10)`, `CheckSkillType(11)` and `CheckTargetElementId(12)` as source-identified predicates with their original AND/OR logic. Runtime consumes the held-mark state and landed overlimit events produced by verified tuning generation; the soul subsystem does not reconstruct mark state from the action plan.

`10124` checks UltraSkill tag 4 and held thunder mark 250 at action-start, then applies a 20-second refreshable attribute-8 effect to all three heroes. `10131` accepts only landed thunder/dark overlimit packets 299/499 and preserves the dark packet as a structured hidden branch absent from the public text. `10136` requires the actual wind packet template 796 types `[22,32,43,307]` plus final NormalAttack tag 1. Both AfterDamage effects are sequenced after the triggering packet, so a new layer cannot affect that packet retroactively.

## Runtime Matrix

Real generated packets cover initial/inherited marks, acquire/consume/expiry boundaries, miss suppression, thunder/dark branches, wind element types, wrong skill tags, refresh, right-open expiry and replay/cycle inheritance. A non-source teammate receives the 10124 critical-damage consequence and returns to baseline at expiry. The generated 10131/10136 commands are replayed through the canonical effect timeline onto later verified toughness hits: the later hit increases during the active interval, while the triggering packet and post-expiry hit remain at baseline.

## Result

Soul effects are `17/62 runtime-applied` and `45/62 dynamic-unapplied`. The unique blocker ledger is `436` (`420 not-implemented`, `16 evidence-insufficient`). All 12 set effects remain unapplied and no formal qualification was granted.

Verification passed: focused mechanics `5 files / 99 tests`, Machine Axis `12 / 157`, three-character profile/golden `3 / 34`, canonical/runtime `6 / 104`, headless golden migration `1 / 4`, nine deterministic audits, and production build. Applied-source audit is `17 property sources / 0 drift` plus `5 tuning conditions / 0 drift`.

The verified package identity changed because tuning event source identities and packet `elementTypes` became first-class data. The current Machine Axis hashes are `572695e45011465c / 35835e12c6a6e279 / 67802e753205e852 / 0b410dc9255d2654`; evaluation and all gameplay assertions are unchanged. Existing Sass, circular-chunk and large-chunk warnings remain non-blocking.
