# 199002 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：67
- 语义转移：9/9
- 仅索引未接入窗口：0
- 玩法影响缺口：0

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 19900201/sub0 | input-window | [20,50) | - | starborn-199002-normal-five-inputs / A2 | continue-chain | applied |
| hidden-control 19900201/sub1 | input-window | [22,52) | - | 19900203/sub0 | input-context-derived | verified-input-context-variant-edge-ready |
| hidden-control 19900202/sub0 | input-window | [39,69) | - | starborn-199002-normal-five-inputs / A3 | continue-chain | applied |
| normal-attack 19900203/sub0 | input-window | [48,78) | - | starborn-199002-normal-five-inputs / A4 | continue-chain | applied |
| hidden-control 19900204/sub0 | input-window | [38,87) | - | 19900210/sub1 | input-context-derived | verified-input-context-variant-edge-ready |
| hidden-control 19900204/sub0 | input-window | [45,85) | - | starborn-199002-normal-five-inputs / A5 | continue-chain | applied |
| hidden-control 19900205/sub0 | input-window | [32,52) | - | 19900210/sub1 | input-context-derived | verified-input-context-variant-edge-ready |
| hidden-control 19900210/sub1 | input-window | [60,90) | action-effect:-@23F；action-effect:-@29F；action-effect:-@35F；action-effect:-@41F；action-effect:-@47F；action-effect:-@53F；action-effect:-@59F；action-effect:-@65F；action-effect:-@71F | 19900201/sub1 | input-context-derived | verified-input-context-variant-edge-ready |
| star-skill 19900212/sub0 | input-window | [54,84) | action-effect:-@16F；action-effect:-@22F；action-effect:-@28F；action-effect:-@34F；action-effect:-@40F；action-effect:-@46F；action-effect:-@52F；action-effect:-@58F；action-effect:-@64F | 19900201/sub1 | input-context-derived | verified-input-context-variant-edge-ready |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 19900203/sub0 | 1/1 | 0 | 0 | applied |
| charged-attack | 19900210/sub0 | 0/0 | 0 | 0 | not-applicable |
| dodge-attack | 19900215/sub0 | 0/0 | 0 | 0 | not-applicable |
| plunging-attack | 19900211/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 19900212/sub0 | 1/1 | 0 | 0 | applied |
| star-combo | 19900226/sub0 | 0/0 | 0 | 0 | not-applicable |
| ultimate | 19900213/sub0 | 0/0 | 0 | 9 | applied |
| star-carry | 19900222/sub0 | 0/0 | 0 | 9 | applied |
| limit-counter | 19900225/sub0 | 0/0 | 0 | 0 | not-applicable |
| perfect-parry | 19900227/sub0 | 0/0 | 0 | 0 | not-applicable |
