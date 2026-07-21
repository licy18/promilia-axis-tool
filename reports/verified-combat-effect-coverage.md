# M9-C Battle 语义效果覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作：562
- 控制：453
- 直接元素根：3433
- 原始引用边：1351
- 效果图节点：3673
- 去重语义效果：3122
- 最终玩法效果：1583
- 结构包装/条件：1539
- 语义可计算：379
- 语义明确零：2
- 语义未解析：1202

## 语义放置

- runtime-dependent: 83
- static-evidence-gap: 366
- static-resolved: 1134

## 公式族

- literal-a-with-common-ratio: 676
- unsupported-0-0: 10
- unsupported-1-0: 56
- unsupported-1-2: 118
- unsupported-1-3: 279
- unsupported-1-4: 20
- unsupported-1-11: 19
- unsupported-1-101: 2
- unsupported-1-104: 15
- unsupported-1-108: 12
- unsupported-1-113: 4
- unsupported-1-115: 14
- unsupported-1-116: 14
- unsupported-1-120: 26
- unsupported-1-122: 15
- unsupported-1-2008: 2
- unsupported-1-107202: 8
- unsupported-1-107203: 6
- unsupported-22-12: 1
- unsupported-104-12: 3
- unsupported-108-12: 6
- unsupported-1007-3: 4
- unsupported-102100-3: 1
- verified-tuning-state-formula: 272

## 原始边审计

- 效果绑定：3335
- 可计算：125
- 明确零：2
- 未解析：3208

## 元素类型

- damage: 1116
- inject: 358
- judgment: 50
- other: 1520
- pack: 115
- property-change: 357
- shield: 7
- sp: 41
- stack: 109

## 未解析原因

- effect-target-static-evidence-gap: 366
- effect-trigger-frame-static-evidence-gap: 366
- heal-formula-not-literal-function-5: 50
- nested-damage-runtime-family-unimplemented: 360
- property-change-type-not-battle-property: 1
- property-conditions-not-expanded: 25
- property-formula-not-literal-function-5: 355
- runtime-target-from-projectile-collision: 69
- runtime-target-selection-ally: 19
- runtime-trigger-projectile-collision-frame: 69
- shield-formula-not-literal-function-5: 10
- sp-formula-not-literal-function-5: 76
- sp-recover-type-not-direct-sp: 8
- tuning-consume-judgment-missing: 6
- tuning-consume-mark-identity-ambiguous: 38
- tuning-consume-success-branch-unresolved: 6
- tuning-mark-max-mismatch: 45
- tuning-mark-relation-elementDataList-unresolved: 1
- tuning-mark-relation-notDelElementDataList-unresolved: 10
- tuning-mark-relation-triggerEffectList-unresolved: 1
- wrapper-condition-semantics-unresolved: 662

> 只有真实触发帧、唯一目标且公式输入可安全解释的维度进入运行时；其余逐项来源见同名 JSON。
