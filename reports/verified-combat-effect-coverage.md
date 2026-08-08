# M9-C Battle 语义效果覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作：646
- 控制：584
- 直接元素根：4305
- 原始引用边：1809
- 效果图节点：3731
- 去重语义效果：3440
- 最终玩法效果：1863
- 结构包装/条件：1577
- 语义可计算：1065
- 语义明确零：7
- 语义未解析：791

## 语义放置

- runtime-dependent: 106
- static-evidence-gap: 447
- static-resolved: 1310

## 公式族

- basis-point-property-a-with-common-ratio: 2
- literal-a-direct: 15
- literal-a-with-common-ratio: 719
- source-atk-ratio-heal: 7
- source-tuning-ratio-with-common-ratio: 1
- unsupported-0-0: 10
- unsupported-1-0: 76
- unsupported-1-2: 177
- unsupported-1-3: 359
- unsupported-1-4: 23
- unsupported-1-101: 2
- unsupported-1-104: 19
- unsupported-1-108: 10
- unsupported-1-110: 6
- unsupported-1-111: 6
- unsupported-1-113: 4
- unsupported-1-115: 20
- unsupported-1-116: 22
- unsupported-1-120: 26
- unsupported-1-122: 11
- unsupported-1-2008: 1
- unsupported-1-107202: 8
- unsupported-1-107203: 8
- unsupported-22-12: 2
- unsupported-104-12: 8
- unsupported-108-12: 5
- unsupported-1007-3: 6
- unsupported-1007-5: 4
- unsupported-102100-0: 1
- unsupported-102100-3: 1
- verified-tuning-state-formula: 304

## 原始边审计

- 效果绑定：3120
- 可计算：1785
- 明确零：12
- 未解析：1304

## 元素类型

- damage: 1135
- inject: 361
- judgment: 50
- other: 1555
- pack: 115
- property-change: 358
- shield: 7
- sp: 41
- stack: 109

## 未解析原因

- effect-target-static-evidence-gap: 457
- effect-trigger-frame-static-evidence-gap: 404
- enemy-hit-driven-perfect-defense-branch-not-applicable-in-passive-boss-scenario: 4
- nested-damage-runtime-family-unimplemented: 144
- perfect-defense-state-required-not-applicable-in-passive-boss-scenario: 4
- property-duration-zero-unresolved: 5
- property-formula-not-literal-function-5: 93
- runtime-target-from-projectile-collision: 68
- runtime-target-selection-ally: 43
- runtime-trigger-projectile-collision-frame: 68
- scenario-out-of-scope-not-applicable: 8
- shield-formula-not-literal-function-5: 2
- source-driven-transform-remove-handles-state-subtree: 4
- sp-formula-not-literal-function-5: 37
- tuning-consume-current-packet-not-in-candidate-map: 39
- tuning-consume-judgment-missing: 39
- tuning-consume-mark-identity-ambiguous: 39
- tuning-consume-success-branch-unresolved: 39
- tuning-mark-relation-elementDataList-unresolved: 2
- tuning-mark-relation-notDelElementDataList-unresolved: 12
- tuning-mark-relation-triggerEffectList-unresolved: 1
- wrapper-condition-semantics-unresolved: 155

> 只有真实触发帧、唯一目标且公式输入可安全解释的维度进入运行时；其余逐项来源见同名 JSON。
