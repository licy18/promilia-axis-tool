# M9-C Battle 语义效果覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作：563
- 控制：543
- 直接元素根：4014
- 原始引用边：1655
- 效果图节点：3695
- 去重语义效果：3368
- 最终玩法效果：1755
- 结构包装/条件：1613
- 语义可计算：688
- 语义明确零：7
- 语义未解析：1060

## 语义放置

- runtime-dependent: 105
- static-evidence-gap: 421
- static-resolved: 1229

## 公式族

- basis-point-property-a-with-common-ratio: 2
- literal-a-direct: 15
- literal-a-with-common-ratio: 682
- source-atk-ratio-heal: 7
- source-tuning-ratio-with-common-ratio: 1
- unsupported-0-0: 10
- unsupported-1-0: 64
- unsupported-1-2: 170
- unsupported-1-3: 322
- unsupported-1-4: 23
- unsupported-1-101: 2
- unsupported-1-104: 15
- unsupported-1-108: 10
- unsupported-1-110: 6
- unsupported-1-113: 4
- unsupported-1-115: 20
- unsupported-1-116: 22
- unsupported-1-120: 26
- unsupported-1-122: 11
- unsupported-1-2008: 1
- unsupported-1-107202: 8
- unsupported-1-107203: 8
- unsupported-22-12: 2
- unsupported-104-12: 2
- unsupported-108-12: 5
- unsupported-1007-3: 6
- unsupported-1007-5: 4
- unsupported-102100-3: 1
- verified-tuning-state-formula: 306

## 原始边审计

- 效果绑定：3685
- 可计算：1320
- 明确零：7
- 未解析：2358

## 元素类型

- damage: 1118
- inject: 361
- judgment: 50
- other: 1537
- pack: 115
- property-change: 357
- shield: 7
- sp: 41
- stack: 109

## 未解析原因

- effect-target-static-evidence-gap: 431
- effect-trigger-frame-static-evidence-gap: 376
- heal-formula-not-literal-function-5: 34
- nested-damage-runtime-family-unimplemented: 307
- property-change-type-not-battle-property: 1
- property-duration-zero-unresolved: 5
- property-formula-not-literal-function-5: 119
- runtime-target-from-projectile-collision: 67
- runtime-target-selection-ally: 43
- runtime-trigger-projectile-collision-frame: 67
- shield-formula-not-literal-function-5: 9
- sp-formula-not-literal-function-5: 37
- sp-recover-type-not-direct-sp: 12
- tuning-consume-current-packet-not-in-candidate-map: 9
- tuning-consume-judgment-missing: 9
- tuning-consume-mark-identity-ambiguous: 9
- tuning-consume-success-branch-unresolved: 9
- tuning-mark-max-mismatch: 48
- tuning-mark-relation-elementDataList-unresolved: 2
- tuning-mark-relation-notDelElementDataList-unresolved: 13
- tuning-mark-relation-triggerEffectList-unresolved: 1
- wrapper-condition-semantics-unresolved: 605

> 只有真实触发帧、唯一目标且公式输入可安全解释的维度进入运行时；其余逐项来源见同名 JSON。
