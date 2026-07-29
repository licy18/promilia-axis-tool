# M9-C Battle 语义效果覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作：563
- 控制：503
- 直接元素根：4357
- 原始引用边：1637
- 效果图节点：3693
- 去重语义效果：3428
- 最终玩法效果：1805
- 结构包装/条件：1623
- 语义可计算：373
- 语义明确零：2
- 语义未解析：1430

## 语义放置

- runtime-dependent: 115
- static-evidence-gap: 504
- static-resolved: 1186

## 公式族

- basis-point-property-a-with-common-ratio: 2
- literal-a-with-common-ratio: 716
- source-tuning-ratio-with-common-ratio: 1
- unsupported-0-0: 10
- unsupported-1-0: 64
- unsupported-1-2: 180
- unsupported-1-3: 312
- unsupported-1-4: 23
- unsupported-1-11: 19
- unsupported-1-101: 2
- unsupported-1-104: 17
- unsupported-1-108: 12
- unsupported-1-110: 12
- unsupported-1-113: 4
- unsupported-1-115: 20
- unsupported-1-116: 29
- unsupported-1-120: 26
- unsupported-1-122: 15
- unsupported-1-2008: 1
- unsupported-1-107202: 8
- unsupported-1-107203: 8
- unsupported-22-12: 1
- unsupported-104-12: 3
- unsupported-108-12: 6
- unsupported-1007-3: 6
- unsupported-1007-5: 4
- unsupported-102100-3: 1
- verified-tuning-state-formula: 303

## 原始边审计

- 效果绑定：3686
- 可计算：336
- 明确零：2
- 未解析：3348

## 元素类型

- damage: 1116
- inject: 361
- judgment: 50
- other: 1537
- pack: 115
- property-change: 357
- shield: 7
- sp: 41
- stack: 109

## 未解析原因

- effect-target-static-evidence-gap: 514
- effect-trigger-frame-static-evidence-gap: 425
- heal-formula-not-literal-function-5: 52
- nested-damage-runtime-family-unimplemented: 473
- property-change-type-not-battle-property: 1
- property-conditions-not-expanded: 33
- property-formula-not-literal-function-5: 392
- runtime-target-from-projectile-collision: 101
- runtime-target-selection-ally: 19
- runtime-trigger-projectile-collision-frame: 101
- shield-formula-not-literal-function-5: 10
- sp-formula-not-literal-function-5: 95
- sp-recover-type-not-direct-sp: 12
- tuning-consume-judgment-missing: 9
- tuning-consume-mark-identity-ambiguous: 45
- tuning-consume-success-branch-unresolved: 9
- tuning-mark-max-mismatch: 46
- tuning-mark-relation-elementDataList-unresolved: 2
- tuning-mark-relation-notDelElementDataList-unresolved: 13
- tuning-mark-relation-triggerEffectList-unresolved: 1
- wrapper-condition-semantics-unresolved: 810

> 只有真实触发帧、唯一目标且公式输入可安全解释的维度进入运行时；其余逐项来源见同名 JSON。
