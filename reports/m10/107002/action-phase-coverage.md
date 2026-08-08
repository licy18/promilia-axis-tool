# 107002 动作阶段与派生入口审计

- 阶段：0（已应用 0）
- 输入段：0
- 阶段切换：0
- 快速入口：0/0
- 公开动作就绪：9/10

## 动作阶段

| 阶段 | 入口 | 前置 | 输入段 | 执行 control/sub | 退出条件 | 状态 |
| --- | --- | --- | ---: | --- | --- | --- |

## 阶段切换与快速入口

| 来源 | 触发帧/窗口 | 目标 | 条件 | 状态 |
| --- | --- | --- | --- | --- |

## 公开动作复核

| 动作 | 就绪 | 状态 | 剩余缺口 |
| --- | --- | --- | --- |
| normal-attack | 是 | applied-with-residual-gaps | normal-attack-input-segment-duration-unresolved |
| charged-attack | 是 | applied |  |
| dodge-attack | 否 | static-evidence-gap | projectile-impact-frame-runtime-dependent；trigger-frame-missing |
| plunging-attack | 是 | applied |  |
| star-skill | 是 | applied |  |
| star-combo | 是 | applied |  |
| ultimate | 是 | applied-with-residual-gaps | trigger-frame-missing |
| star-carry | 是 | applied |  |
| limit-counter | 是 | applied |  |
| perfect-parry | 是 | applied |  |

> 本报告由 owner contract 生成；描述只用于发现与命名，运行状态以 control、资源事务、派生窗口和效果绑定为准。
