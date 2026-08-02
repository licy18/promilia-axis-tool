# M12-B3-C2-R1 Action/Hit Event Gate Remediation

- Status: `verification-complete-awaiting-product-acceptance`
- Repair base: `942639f07d5a417f8145f8c11aadf006646dfbee`; M12-B3-C-R1 remains product-accepted at `2804f201ac2a6ea4eebc1339703a9d40c0aba5a5`.
- Dynamic census: `d67e16da316ccb87`; soul effect catalog: `b3fd516e07fd6424`.
- Formal admissions: `0 / 0 / 0 / 0 / 0`; M12-C remains locked.

## Contract

`10055` and `10093` preserve the raw `OR` group `CheckSkillSlot(6)=UltraSkill(4) OR CheckSkillType(11)=UltraSkill(4)`. Runtime selection reads the final verified slot/tag binding. Their target comes from `triggerEffectList[].targetType=AllHero(15)`, not `triggerTargetType`, and creates one deterministic command per hero while preserving the carrier as source/formula/effect adder. Kibo receives no direct AllHero command.

`10055` uses base `A`; `10093` and `10097` use base `A/10000`. All three pass through `AzPrVerifiedBattleEffectFormulaRegistry` and Q16.16, preserving raw A, formula identity, Q16 trace, and evaluated point value. `10093` star 1 is approximately `93.8`, not `938000`; `10097` spans `112.5 / 150 / 187.5 / 225`.

## Runtime Matrix

- `10055/10093`: apply at ultimate action-end. Earlier ultimate hits do not receive the layer; all three heroes do, and two controlled-actor switches preserve the original absolute expiry.
- `10097`: uses the real `10101025/sub0` limit-counter binding and skill tag 11. It applies at action-start, so later verified hits in that action consume the layer.
- `BeforeSkill/AfterSkill` are action events: an execution-plan entry with `execute=true` fires once even when the action has no hit or every verified hit is disabled/missed. `execute=false` remains suppressed. `BeforeDamage/AfterDamage` remain landed-hit events and keep `soulessence-effect-no-landed-source-hit` for miss suppression.
- Repeated triggers refresh one effect per target; right-open expiry and canonical cycle inheritance remain on the shared effect timeline.
- The prior 10060/10094/10098 PropertyTag 300/301 cross-action matrix remains unchanged.
- A real three-actor replay proves that the non-source teammate's `VERIFIED_TUNING_DAMAGE` receives the active AllHero mastery value in both `payload.mastery` and `rawDamage`, then returns to the no-soul baseline after expiry.

## Result

Soul effects are now `12/62 runtime-applied` and `50/62 dynamic-unapplied`. The unique blocker ledger is `446` (`430 not-implemented`, `16 evidence-insufficient`). All 12 set effects remain unapplied; no formal qualification was granted.

Verification passed: focused mechanics `5 files / 83 tests`, Machine Axis `12 / 157`, three-character profile/golden `3 / 34`, canonical migration/combat runtime `3 / 39`, nine deterministic audits, and production build. Existing Sass, circular-chunk, and large-chunk warnings remain non-blocking.
