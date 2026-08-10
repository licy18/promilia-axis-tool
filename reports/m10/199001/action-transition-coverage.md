# 199001 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：67
- 语义转移：9/9
- 仅索引未接入窗口：0
- 玩法影响缺口：0

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 19900101/sub0 | input-window | [20,50) | - | starborn-199001-normal-five-inputs / A2 | continue-chain | applied |
| hidden-control 19900101/sub1 | input-window | [22,52) | - | 19900103/sub0 | input-context-derived | verified-input-context-variant-edge-ready |
| hidden-control 19900102/sub0 | input-window | [39,69) | - | starborn-199001-normal-five-inputs / A3 | continue-chain | applied |
| normal-attack 19900103/sub0 | input-window | [48,78) | - | starborn-199001-normal-five-inputs / A4 | continue-chain | applied |
| hidden-control 19900104/sub0 | input-window | [38,97) | - | 19900110/sub1 | input-context-derived | verified-input-context-variant-edge-ready |
| hidden-control 19900104/sub0 | input-window | [45,95) | - | starborn-199001-normal-five-inputs / A5 | continue-chain | applied |
| hidden-control 19900105/sub0 | input-window | [32,52) | - | 19900110/sub1 | input-context-derived | verified-input-context-variant-edge-ready |
| hidden-control 19900110/sub1 | input-window | [60,90) | action-effect:-@24F；action-effect:-@30F；action-effect:-@36F；action-effect:-@42F；action-effect:-@48F；action-effect:-@54F；action-effect:-@60F；action-effect:-@66F；action-effect:-@72F | 19900101/sub1 | input-context-derived | verified-input-context-variant-edge-ready |
| star-skill 19900112/sub0 | input-window | [53,83) | action-effect:-@16F；action-effect:-@22F；action-effect:-@28F；action-effect:-@34F；action-effect:-@40F；action-effect:-@46F；action-effect:-@52F；action-effect:-@58F；action-effect:-@64F | 19900101/sub1 | input-context-derived | verified-input-context-variant-edge-ready |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 19900103/sub0 | 1/1 | 0 | 0 | applied |
| charged-attack | 19900110/sub0 | 0/0 | 0 | 0 | not-applicable |
| dodge-attack | 19900115/sub0 | 0/0 | 0 | 0 | not-applicable |
| plunging-attack | 19900111/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 19900112/sub0 | 1/1 | 0 | 0 | applied |
| star-combo | 19900126/sub0 | 0/0 | 0 | 0 | not-applicable |
| ultimate | 19900113/sub0 | 0/0 | 0 | 9 | applied |
| star-carry | 19900122/sub0 | 0/0 | 0 | 9 | applied |
| limit-counter | 19900125/sub0 | 0/0 | 0 | 0 | not-applicable |
| perfect-parry | 19900127/sub0 | 0/0 | 0 | 0 | not-applicable |
