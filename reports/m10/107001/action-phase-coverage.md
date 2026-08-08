# 107001 动作阶段与派生入口审计

- 阶段：1（已应用 1）
- 输入段：3
- 阶段切换：0
- 快速入口：0/0
- 公开动作就绪：9/10

## 动作阶段

| 阶段 | 入口 | 前置 | 输入段 | 执行 control/sub | 退出条件 | 状态 |
| --- | --- | --- | ---: | --- | --- | --- |
| sifliya-normal-three-inputs | default | always | 3 | 普通攻击 A1=10700101/sub0；普通攻击 A2=10700102/sub4；普通攻击 A3=10700103/sub4 | chain-complete | applied |

## 阶段切换与快速入口

| 来源 | 触发帧/窗口 | 目标 | 条件 | 状态 |
| --- | --- | --- | --- | --- |

## 公开动作复核

| 动作 | 就绪 | 状态 | 剩余缺口 |
| --- | --- | --- | --- |
| normal-attack | 是 | applied-with-residual-gaps | effect-trigger-frame-missing；normal-attack-input-segment-duration-unresolved；trigger-frame-missing |
| charged-attack | 是 | applied-with-residual-gaps | trigger-frame-missing |
| dodge-attack | 否 | static-evidence-gap | effect-target-unresolved；effect-trigger-frame-missing；projectile-impact-frame-runtime-dependent；trigger-frame-missing；tuning-mark-relation-notDelElementDataList-unresolved |
| plunging-attack | 是 | applied |  |
| star-skill | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing；judgment-condition-runtime-unimplemented；nested-damage-trigger-lifecycle-not-expanded；nested-effect-wrapper-semantics-unresolved；projectile-impact-frame-runtime-dependent；trigger-frame-missing |
| star-combo | 是 | applied |  |
| ultimate | 是 | applied-with-residual-gaps | judgment-condition-runtime-unimplemented；nested-damage-trigger-lifecycle-not-expanded；nested-effect-wrapper-semantics-unresolved；trigger-frame-missing |
| star-carry | 是 | applied-with-residual-gaps | projectile-impact-frame-runtime-dependent；trigger-frame-missing |
| limit-counter | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing；projectile-impact-frame-runtime-dependent；trigger-frame-missing；tuning-mark-relation-notDelElementDataList-unresolved |
| perfect-parry | 是 | applied |  |

> 本报告由 owner contract 生成；描述只用于发现与命名，运行状态以 control、资源事务、派生窗口和效果绑定为准。
