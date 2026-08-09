# 199001 动作阶段与派生入口审计

- 阶段：1（已应用 1）
- 输入段：5
- 阶段切换：0
- 快速入口：0/0
- 公开动作就绪：10/10

## 动作阶段

| 阶段 | 入口 | 前置 | 输入段 | 执行 control/sub | 退出条件 | 状态 |
| --- | --- | --- | ---: | --- | --- | --- |
| starborn-199001-normal-five-inputs | condition-selected | always | 5 | A1=19900101/sub0；A2=19900102/sub0；A3=19900103/sub0；A4=19900104/sub0；A5=19900105/sub0 | chain-complete | applied |

## 阶段切换与快速入口

| 来源 | 触发帧/窗口 | 目标 | 条件 | 状态 |
| --- | --- | --- | --- | --- |

## 公开动作复核

| 动作 | 就绪 | 状态 | 剩余缺口 |
| --- | --- | --- | --- |
| normal-attack | 是 | applied |  |
| charged-attack | 是 | applied |  |
| dodge-attack | 是 | applied |  |
| plunging-attack | 是 | applied |  |
| star-skill | 是 | applied |  |
| star-combo | 是 | applied |  |
| ultimate | 是 | applied-with-residual-gaps | trigger-frame-missing |
| star-carry | 是 | applied |  |
| limit-counter | 是 | applied |  |
| perfect-parry | 是 | applied |  |

> 本报告由 owner contract 生成；描述只用于发现与命名，运行状态以 control、资源事务、派生窗口和效果绑定为准。
