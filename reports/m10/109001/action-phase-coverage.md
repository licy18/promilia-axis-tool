# 109001 动作阶段与派生入口审计

- 阶段：0（已应用 0）
- 输入段：0
- 阶段切换：0
- 快速入口：2/2
- 公开动作就绪：10/10

## 动作阶段

| 阶段 | 入口 | 前置 | 输入段 | 执行 control/sub | 退出条件 | 状态 |
| --- | --- | --- | ---: | --- | --- | --- |

## 阶段切换与快速入口

| 来源 | 触发帧/窗口 | 目标 | 条件 | 状态 |
| --- | --- | --- | --- | --- |
| 10900112/sub0 | 40F + 616.6666666666666ms | 10900143/sub0 | always | applied |
| 10900121/sub0 | 108F + 616.6666666666666ms | 10900143/sub0 | always | applied |

## 公开动作复核

| 动作 | 就绪 | 状态 | 剩余缺口 |
| --- | --- | --- | --- |
| normal-attack | 是 | applied |  |
| charged-attack | 是 | applied-with-residual-gaps | effect-trigger-frame-missing；nested-effect-wrapper-semantics-unresolved |
| dodge-attack | 是 | applied |  |
| plunging-attack | 是 | applied |  |
| star-skill | 是 | applied |  |
| star-combo | 是 | applied |  |
| ultimate | 是 | applied-with-residual-gaps | base-function-unverified；effect-target-unresolved；effect-trigger-frame-missing；hp:damage-formula-inputs-incomplete；nested-damage-trigger-lifecycle-not-expanded；nested-effect-wrapper-semantics-unresolved；sp-formula-not-literal-function-5；toughness:pre-shield-damage-inputs-incomplete；trigger-frame-missing；tuning-consume-current-packet-not-in-candidate-map；tuning-consume-judgment-missing；tuning-consume-mark-identity-ambiguous；tuning-consume-success-branch-unresolved |
| star-carry | 是 | applied |  |
| limit-counter | 是 | applied |  |
| perfect-parry | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing |

> 本报告由 owner contract 生成；描述只用于发现与命名，运行状态以 control、资源事务、派生窗口和效果绑定为准。
