# 101010 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：95
- 语义转移：8/8
- 仅索引未接入窗口：6
- 玩法影响缺口：2

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 10101001/sub0 | input-window | [20,65) | - | xiaoyu-normal-default-five-inputs / A2 | continue-chain | applied |
| hidden-control 10101001/sub1 | input-window | [72,108) | - | xiaoyu-burst-three-inputs / A2 | continue-chain | applied |
| hidden-control 10101002/sub0 | input-window | [35,65) | - | xiaoyu-normal-default-five-inputs / A3 | continue-chain | applied |
| normal-attack 10101003/sub0 | input-window | [47,101) | - | xiaoyu-normal-default-five-inputs / A4 | continue-chain | applied |
| hidden-control 10101004/sub0 | input-window | [30,71) | - | xiaoyu-normal-default-five-inputs / A5 | continue-chain | applied |
| hidden-control 10101004/sub1 | input-window | [75,120) | - | xiaoyu-burst-three-inputs / A3 | continue-chain | applied |
| hidden-control 10101010/sub2 | state-activation | [0,600) | transform@0F；clear@0F | xiaoyu-burst-three-inputs / A1 | direct-entry | verified-action-variant-edge-ready |
| ultimate 10101013/sub0 | state-activation | [272,872) | transform@272F；clear@264F；transform-remove@264F | xiaoyu-burst-three-inputs / A1 | direct-entry | verified-action-variant-edge-ready |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 10101003/sub0 | 1/1 | 0 | 0 | applied |
| charged-attack | 10101010/sub0 | 0/0 | 5 | 0 | applied |
| dodge-attack | 10101015/sub0 | 0/0 | 0 | 0 | not-applicable |
| plunging-attack | 10101011/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 10101012/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-combo | 10101026/sub0 | 0/0 | 0 | 0 | not-applicable |
| ultimate | 10101013/sub0 | 1/1 | 3 | 3 | applied |
| star-carry | 10101021/sub0 | 0/0 | 0 | 0 | static-evidence-gap |
| limit-counter | 10101025/sub0 | 0/0 | 8 | 0 | applied |
| perfect-parry | 10101027/sub0 | 0/0 | 0 | 0 | static-evidence-gap |
