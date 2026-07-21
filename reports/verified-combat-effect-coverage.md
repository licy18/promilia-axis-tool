# M8-B Battle 效果覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作：562
- 控制：453
- 直接元素根：3433
- 效果图节点：3673
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

- effect-combine-semantics-unresolved: 4
- effect-target-ally-unresolved: 14
- effect-target-any-unresolved: 59
- effect-target-unresolved: 2733
- effect-trigger-frame-missing: 778
- heal-formula-not-literal-function-5: 62
- inject-wrapper-classified-through-child-edges: 1320
- judgment-condition-runtime-unimplemented: 80
- nested-damage-trigger-lifecycle-not-expanded: 385
- nested-effect-wrapper-semantics-unresolved: 972
- pack-lifecycle-runtime-unimplemented: 166
- property-change-type-not-battle-property: 1
- property-conditions-not-expanded: 27
- property-formula-not-literal-function-5: 428
- shield-formula-not-literal-function-5: 10
- sp-formula-not-literal-function-5: 84
- sp-recover-type-not-direct-sp: 10
- stack-lifecycle-runtime-unimplemented: 18
- tuning-consume-judgment-missing: 6
- tuning-consume-mark-identity-ambiguous: 38
- tuning-consume-success-branch-unresolved: 6
- tuning-mark-max-mismatch: 45
- tuning-mark-relation-elementDataList-unresolved: 1
- tuning-mark-relation-notDelElementDataList-unresolved: 10
- tuning-mark-relation-triggerEffectList-unresolved: 1

> 只有真实触发帧、唯一目标且公式输入可安全解释的维度进入运行时；其余逐项来源见同名 JSON。
