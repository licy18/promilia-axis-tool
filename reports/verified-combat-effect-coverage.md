# M9-C Battle 语义效果覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作：648
- 控制：586
- 直接元素根：4367
- 原始引用边：1919
- 效果图节点：3817
- 去重语义效果：3580
- 最终玩法效果：1983
- 结构包装/条件：1597
- 语义可计算：1123
- 语义明确零：7
- 语义未解析：853

## 语义放置

- runtime-dependent: 108
- static-evidence-gap: 507
- static-resolved: 1368

## 公式族

- basis-point-property-a-with-common-ratio: 2
- literal-a-direct: 15
- literal-a-with-common-ratio: 779
- source-atk-ratio-heal: 7
- source-max-hp-ratio-heal: 17
- source-tuning-ratio-with-common-ratio: 1
- unsupported-0-0: 10
- unsupported-1-0: 76
- unsupported-1-2: 177
- unsupported-1-3: 363
- unsupported-1-4: 23
- unsupported-1-101: 2
- unsupported-1-104: 2
- unsupported-1-108: 10
- unsupported-1-110: 6
- unsupported-1-111: 6
- unsupported-1-113: 4
- unsupported-1-115: 20
- unsupported-1-116: 22
- unsupported-1-120: 34
- unsupported-1-122: 15
- unsupported-1-2001: 6
- unsupported-1-2008: 1
- unsupported-1-107202: 8
- unsupported-1-107203: 8
- unsupported-22-12: 2
- unsupported-104-12: 8
- unsupported-108-12: 5
- unsupported-1007-3: 6
- unsupported-1007-5: 2
- unsupported-102100-0: 1
- unsupported-102100-3: 1
- verified-tuning-state-formula: 344

## 原始边审计

- 效果绑定：3210
- 可计算：1906
- 明确零：12
- 未解析：1271

## 元素类型

- damage: 1157
- inject: 383
- judgment: 50
- other: 1557
- pack: 117
- property-change: 378
- shield: 7
- sp: 41
- stack: 127

## 未解析原因

- effect-target-static-evidence-gap: 517
- effect-trigger-frame-static-evidence-gap: 464
- enemy-hit-driven-perfect-defense-branch-not-applicable-in-passive-boss-scenario: 4
- nested-damage-runtime-family-unimplemented: 144
- perfect-defense-state-required-not-applicable-in-passive-boss-scenario: 4
- property-duration-zero-unresolved: 5
- property-formula-not-literal-function-5: 99
- runtime-target-from-projectile-collision: 68
- runtime-target-selection-ally: 45
- runtime-trigger-projectile-collision-frame: 68
- scenario-out-of-scope-not-applicable: 8
- shield-formula-not-literal-function-5: 2
- source-driven-transform-remove-handles-state-subtree: 4
- sp-formula-not-literal-function-5: 35
- tuning-consume-current-packet-not-in-candidate-map: 39
- tuning-consume-judgment-missing: 39
- tuning-consume-mark-identity-ambiguous: 39
- tuning-consume-success-branch-unresolved: 39
- tuning-mark-relation-elementDataList-unresolved: 2
- tuning-mark-relation-notDelElementDataList-unresolved: 12
- tuning-mark-relation-triggerEffectList-unresolved: 1
- wrapper-condition-semantics-unresolved: 155

> 只有真实触发帧、唯一目标且公式输入可安全解释的维度进入运行时；其余逐项来源见同名 JSON。
