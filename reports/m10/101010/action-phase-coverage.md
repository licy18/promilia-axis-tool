# 101010 动作阶段与派生入口审计

- 阶段：2（已应用 2）
- 输入段：8
- 阶段切换：0
- 快速入口：0/0
- 公开动作就绪：10/10

## 动作阶段

| 阶段 | 入口 | 前置 | 输入段 | 执行 control/sub | 退出条件 | 状态 |
| --- | --- | --- | ---: | --- | --- | --- |
| xiaoyu-normal-default-five-inputs | condition-selected | resource-state-inactive | 5 | A1=10101001/sub0；A2=10101002/sub0；A3=10101003/sub0；A4=10101004/sub0；A5=10101005/sub0 | chain-complete | applied |
| xiaoyu-burst-three-inputs | condition-selected | resource-state-active | 3 | A1=10101001/sub1；A2=10101004/sub1；A3=10101005/sub1 | chain-complete | applied |

## 阶段切换与快速入口

| 来源 | 触发帧/窗口 | 目标 | 条件 | 状态 |
| --- | --- | --- | --- | --- |

## 公开动作复核

| 动作 | 就绪 | 状态 | 剩余缺口 |
| --- | --- | --- | --- |
| normal-attack | 是 | applied-with-residual-gaps | trigger-frame-missing |
| charged-attack | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing；projectile-impact-frame-runtime-dependent；trigger-frame-missing |
| dodge-attack | 是 | applied |  |
| plunging-attack | 是 | applied |  |
| star-skill | 是 | applied-with-residual-gaps | base-function-unverified；effect-target-unresolved；effect-trigger-frame-missing；hp:damage-formula-inputs-incomplete；judgment-condition-runtime-unimplemented；nested-damage-trigger-lifecycle-not-expanded；nested-effect-wrapper-semantics-unresolved；toughness:pre-shield-damage-inputs-incomplete；trigger-frame-missing；tuning-consume-current-packet-not-in-candidate-map；tuning-consume-judgment-missing；tuning-consume-mark-identity-ambiguous；tuning-consume-success-branch-unresolved |
| star-combo | 是 | applied |  |
| ultimate | 是 | applied-with-residual-gaps | base-function-unverified；effect-combine-semantics-unresolved；effect-target-unresolved；effect-trigger-frame-missing；hp:damage-formula-inputs-incomplete；judgment-condition-runtime-unimplemented；nested-damage-trigger-lifecycle-not-expanded；nested-effect-wrapper-semantics-unresolved；sp-formula-not-literal-function-5；toughness:pre-shield-damage-inputs-incomplete；trigger-frame-missing；tuning-consume-current-packet-not-in-candidate-map；tuning-consume-judgment-missing；tuning-consume-mark-identity-ambiguous；tuning-consume-success-branch-unresolved；tuning-mark-relation-elementDataList-unresolved；tuning-mark-relation-notDelElementDataList-unresolved |
| star-carry | 是 | applied |  |
| limit-counter | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing |
| perfect-parry | 是 | applied |  |

> 本报告由 owner contract 生成；描述只用于发现与命名，运行状态以 control、资源事务、派生窗口和效果绑定为准。
