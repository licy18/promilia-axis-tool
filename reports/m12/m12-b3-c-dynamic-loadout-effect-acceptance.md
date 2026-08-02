# M12-B3-C-R1 PropertyTag Closure

- Status: `verification-complete-awaiting-product-acceptance`
- Repair baseline: `5878ef8ca5bcff5eb0bdafeb92571837faaff865`
- PropertyTag contract: `146e6a9a7db86606`
- Dynamic census: `23f55b801a5f0e31`; soul effect catalog: `a63cde47d91815d6`
- Formal admissions: `0 / 0 / 0 / 0 / 0`; M12-C remains locked.

## Contract

The effect leaf's raw `defaultPropertyTags` is now preserved through the 62-soul/12-set census, runtime definition, modifier, source identity, and applied-source audit. Final hit scope comes only from the resolved action/control binding: verified `ESkillTagType.NormalAttack=1` maps to `EBattlePropertyTag.NormalAttack=300`, while `WhackAttack=2` maps to `Skill1=301`. Single-tag matching is exact. Unknown, missing, or multi-tag mappings do not expand into global damage; tags `302..316` remain explicit evidence gaps.

All nine runtime-applied soul effects were compared against the upstream Battle element source. `10060/19009002` retains `[300]`; `10094/19006602` and `10098/19006702` retain `[301]`; the other six remain deliberately unscoped. Applied-source drift is `0/9`.

## Runtime Matrix

- `10060 宵祝`: star-skill trigger, then only normal-attack hits receive the layer.
- `10094 陪伴`: star-skill trigger, then only charged-attack hits receive the layer.
- `10098 此身为枪`: a landed charged hit applies its layer after that hit; later charged hits receive it, while normal, star-skill, ultimate, and Kibo hits do not.
- Miss, same-frame hit sequence, expiry, replay inheritance, and cycle inheritance remain covered.

The runtime-applied denominator remains `9/62`; `53/62` soul effects and `12/12` set effects remain unapplied where evidence or operators are incomplete. The unique blocker ledger remains `452` (`436 not-implemented`, `16 evidence-insufficient`).

## Verification

- Focused source/tag/runtime: `5 files / 85 tests`.
- Machine Axis: `12 files / 157 tests`.
- Three-character profile/golden: `3 files / 34 tests`; canonical migration/combat runtime: `3 files / 33 tests`; no gameplay assertion drift.
- Nine audits clean: optimization qualification, production imports, Workbench data, action status, applied source, character acceptance, character combat, verified combat, and Kibo headless.
- Production build passed. Existing Sass, circular-chunk, and large-chunk warnings remain non-blocking.
