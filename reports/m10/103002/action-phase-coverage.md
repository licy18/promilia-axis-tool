# 103002 动作阶段与派生入口审计

- 阶段：2（已应用 2）
- 输入段：15
- 阶段切换：1
- 快速入口：10/10
- 公开动作就绪：10/10

## 动作阶段

| 阶段 | 入口 | 前置 | 输入段 | 执行 control/sub | 退出条件 | 状态 |
| --- | --- | --- | ---: | --- | --- | --- |
| ruby-normal-default-three-inputs | default | always | 3 | 普通攻击 A1=10300201/sub0；普通攻击 A2=10300202/sub0；普通攻击 A3=10300203/sub0 | chain-complete | applied |
| ruby-enhanced-twelve-inputs | derived-or-quick-entry | resource-at-least | 12 | 强化普攻 E1=10300201/sub1；强化普攻 E2=10300201/sub2；强化普攻 E3=10300201/sub3；强化普攻 E4=10300202/sub1；强化普攻 E5=10300202/sub2；强化普攻 E6=10300202/sub3；强化普攻 E7=10300203/sub1；强化普攻 E8=10300203/sub2；强化普攻 E9=10300203/sub3；强化普攻 E10=10300204/sub0；强化普攻 E11=10300204/sub1；强化普攻 E12=10300204/sub2 | resource-exhausted-or-input-limit-reached | applied |

## 阶段切换与快速入口

| 来源 | 触发帧/窗口 | 目标 | 条件 | 状态 |
| --- | --- | --- | --- | --- |
| ruby-normal-default-three-inputs#3 | [34,79) | ruby-enhanced-twelve-inputs | resource-at-least | applied |
| 10300210/sub0 | 24F + 4000ms | 10300201/sub1 | resource-at-least | applied |
| 10300212/sub0 | 0F + 4000ms | 10300201/sub1 | resource-at-least | applied |
| 10300213/sub0 | 297F + 4000ms | 10300201/sub1 | resource-at-least | applied |
| 10300221/sub0 | 80F + 533.3333333333334ms | 10300201/sub1 | resource-at-least | applied |
| 10300210/sub0 | 24F + 2000ms | 10300201/sub1 | resource-at-least | verified-action-variant-edge-ready |
| 10300210/sub1 | 33F + 2000ms | 10300201/sub1 | resource-at-least | verified-action-variant-edge-ready |
| 10300210/sub2 | 24F + 4000ms | 10300201/sub1 | resource-at-least | verified-action-variant-edge-ready |
| 10300210/sub2 | 24F + 2000ms | 10300201/sub1 | resource-at-least | verified-action-variant-edge-ready |
| 10300213/sub0 | 297F + 2000ms | 10300201/sub1 | resource-at-least | verified-action-variant-edge-ready |
| 10300226/sub0 | 35F + 2000ms | 10300201/sub1 | resource-at-least | verified-action-variant-edge-ready |

## 公开动作复核

| 动作 | 就绪 | 状态 | 剩余缺口 |
| --- | --- | --- | --- |
| normal-attack | 是 | applied-with-residual-gaps | normal-attack-input-segment-duration-unresolved；projectile-impact-frame-runtime-dependent；trigger-frame-missing |
| charged-attack | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing |
| dodge-attack | 是 | applied-with-residual-gaps | verified-action-effective-occupancy-window-unresolved |
| plunging-attack | 是 | applied |  |
| star-skill | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing；verified-action-effective-occupancy-window-unresolved |
| star-combo | 是 | applied |  |
| ultimate | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing；judgment-condition-runtime-unimplemented；nested-damage-trigger-lifecycle-not-expanded；nested-effect-wrapper-semantics-unresolved；pack-lifecycle-runtime-unimplemented |
| star-carry | 是 | applied-with-residual-gaps | effect-target-unresolved；effect-trigger-frame-missing |
| limit-counter | 是 | applied |  |
| perfect-parry | 是 | applied |  |

> 本报告由 owner contract 生成；描述只用于发现与命名，运行状态以 control、资源事务、派生窗口和效果绑定为准。
