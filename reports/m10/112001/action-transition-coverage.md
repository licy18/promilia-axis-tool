# 112001 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：70
- 语义转移：7/7
- 仅索引未接入窗口：0
- 玩法影响缺口：0

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 11200102/sub0 | input-window | [55,320) | - | 11200110/sub1 | input-context-derived | verified-input-context-variant-edge-ready |
| normal-attack 11200103/sub0 | input-window | [63,243) | - | 11200110/sub2 | input-context-derived | verified-input-context-variant-edge-ready |
| hidden-control 11200104/sub0 | input-window | [36,266) | - | 11200110/sub3 | input-context-derived | verified-input-context-variant-edge-ready |
| hidden-control 11200105/sub0 | input-window | [59,179) | - | 11200110/sub4 | input-context-derived | verified-input-context-variant-edge-ready |
| star-skill 11200112/sub0 | input-window | [67,298) | tuning-mark:thunder@27F | 11200110/sub1 | input-context-derived | verified-input-context-variant-edge-ready |
| ultimate 11200113/sub0 | input-window | [216,461) | action-effect:-@191F | 11200110/sub3 | input-context-derived | verified-input-context-variant-edge-ready |
| star-carry 11200121/sub0 | input-window | [112,377) | - | 11200110/sub1 | input-context-derived | verified-input-context-variant-edge-ready |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 11200103/sub0 | 1/1 | 0 | 0 | applied |
| charged-attack | 11200110/sub0 | 0/0 | 0 | 0 | not-applicable |
| dodge-attack | 11200115/sub0 | 0/0 | 0 | 0 | not-applicable |
| plunging-attack | 11200111/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 11200112/sub0 | 1/1 | 0 | 1 | applied |
| star-combo | 11200126/sub0 | 0/0 | 0 | 0 | not-applicable |
| ultimate | 11200113/sub0 | 1/1 | 0 | 0 | applied |
| star-carry | 11200121/sub0 | 1/1 | 0 | 0 | applied |
| limit-counter | 11200125/sub0 | 0/0 | 0 | 0 | not-applicable |
| perfect-parry | 11200127/sub0 | 0/0 | 0 | 0 | not-applicable |
