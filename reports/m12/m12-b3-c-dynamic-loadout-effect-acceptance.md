# M12-B3-C4-R1 Priority Consume Closure

- Status: `verification-complete-awaiting-product-acceptance`
- Base: `307daae3ca819c30f69153f108c9a3163a72729e` (C4 reviewed implementation)
- Formal admissions: `0 / 0 / 0 / 0 / 0`; M12-C remains locked.

## Contract

The generator now compiles `CheckElementType(8)`, `HasElementId(10)`, `CheckSkillType(11)` and `CheckTargetElementId(12)` as source-identified predicates with their original AND/OR logic. Runtime consumes the held-mark state and landed overlimit events produced by verified tuning generation; the soul subsystem does not reconstruct mark state from the action plan.

`10124` checks UltraSkill tag 4 and held thunder mark 250 at action-start, then applies a 20-second refreshable attribute-8 effect to all three heroes. `10131` accepts only landed thunder/dark overlimit packets 299/499 and preserves the dark packet as a structured hidden branch absent from the public text. `10136` requires the actual wind packet template 796 types `[22,32,43,307]` plus final NormalAttack tag 1. Both AfterDamage effects are sequenced after the triggering packet, so a new layer cannot affect that packet retroactively.

`ConsumePackElement.CalculateConsumeCount` at RVA `0x1385260` proves that Priority mode traverses `elementArr` in ascending index order, falls through on insufficient layers, and stores only the first sufficient candidate as `m_consumeElementId`. `DoInject` at RVA `0x1386950` then resolves `injectElementDataDict[m_consumeElementId]`. The generator therefore preserves one ordered judgment group and candidate-to-packet mapping; runtime consumes one selected mark and emits at most one overlimit packet.

## Runtime Matrix

Real generated packets cover initial/inherited marks, acquire/consume/expiry boundaries, miss suppression, thunder/dark branches, wind element types, wrong skill tags, refresh, right-open expiry and replay/cycle inheritance. A non-source teammate receives the 10124 critical-damage consequence and returns to baseline at expiry. The generated 10131/10136 commands are replayed through the canonical effect timeline onto later verified toughness hits: the later hit increases during the active interval, while the triggering packet and post-expiry hit remain at baseline.

Priority regressions cover `112001260 [250,450]` with both candidates sufficient, first insufficient fallback, neither sufficient, only-thunder and only-dark states, plus `111001332 [750,250]`. Selection reads the queued canonical mark state after same-frame acquisition/expiry. Unselected marks remain untouched, unselected packets do not materialize, a selected missed packet does not trigger 10131, and an empty group emits one diagnostic rather than one failure per candidate.

## Result

Soul effects are `17/62 runtime-applied` and `45/62 dynamic-unapplied`. The unique blocker ledger is `436` (`420 not-implemented`, `16 evidence-insufficient`). All 12 set effects remain unapplied and no formal qualification was granted.

Verification passed: focused mechanics `5 files / 108 tests`, Machine Axis `12 / 157`, three-character profile/golden `3 / 34`, canonical/runtime `6 / 58`, headless golden migration `1 / 4`, nine deterministic audits, and production build. Applied-source audit is `17 property sources / 0 drift`, `5 tuning conditions / 0 drift`, and `12 priority consume groups / 0 drift`.

The verified package identity changed because ordered judgment groups and binary-backed priority selection became first-class data. The current Machine Axis hashes are `c8bfd28dcb890f4f / 98deb78db6293f88 / 8586fe2ee148b0fe / 0b410dc9255d2654`; evaluation, cycle evaluation `412605349bbf2fe3`, and all gameplay assertions are unchanged. Existing Sass, circular-chunk and large-chunk warnings remain non-blocking.
