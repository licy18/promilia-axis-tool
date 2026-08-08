# 101003 动作阶段与派生入口审计

- 阶段：1（已应用 1）
- 输入段：5
- 阶段切换：0
- 快速入口：0/0
- 公开动作就绪：10/10

## 动作阶段

| 阶段 | 入口 | 前置 | 输入段 | 执行 control/sub | 退出条件 | 状态 |
| --- | --- | --- | ---: | --- | --- | --- |
| han-normal-five-inputs | default | always | 5 | 普通攻击 A1=10100301/sub0；普通攻击 A2=10100302/sub0；普通攻击 A3=10100303/sub0；普通攻击 A4=10100304/sub0；普通攻击 A5=10100305/sub0 | chain-complete | applied |

## 阶段切换与快速入口

| 来源 | 触发帧/窗口 | 目标 | 条件 | 状态 |
| --- | --- | --- | --- | --- |

## 公开动作复核

| 动作 | 就绪 | 状态 | 剩余缺口 |
| --- | --- | --- | --- |
| normal-attack | 是 | applied-with-residual-gaps | trigger-frame-missing |
| charged-attack | 是 | applied-with-residual-gaps | trigger-frame-missing |
| dodge-attack | 是 | applied |  |
| plunging-attack | 是 | applied |  |
| star-skill | 是 | applied |  |
| star-combo | 是 | applied |  |
| ultimate | 是 | applied |  |
| star-carry | 是 | applied-with-residual-gaps | verified-action-effective-occupancy-window-unresolved |
| limit-counter | 是 | applied-with-residual-gaps | trigger-frame-missing |
| perfect-parry | 是 | applied |  |

> 本报告由 owner contract 生成；描述只用于发现与命名，运行状态以 control、资源事务、派生窗口和效果绑定为准。
