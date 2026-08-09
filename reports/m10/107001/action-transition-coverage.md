# 107001 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：82
- 语义转移：3/3
- 仅索引未接入窗口：8
- 玩法影响缺口：1

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 10700101/sub0 | input-window | [20,72) | gain@12F | sifliya-normal-three-inputs / 普通攻击 A2 | continue-chain | applied |
| hidden-control 10700102/sub4 | input-window | [23,199) | gain@7F；gain@17F | sifliya-normal-three-inputs / 普通攻击 A3 | continue-chain | applied |
| star-skill 10700112/sub0 | input-window | [62,135) | transform-remove@53F；tuning-mark:wind@10F | 10700113/sub0 | input-context-derived | verified-input-context-variant-edge-ready |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 10700103/sub0 | 0/0 | 0 | 0 | not-applicable |
| charged-attack | 10700110/sub0 | 0/0 | 0 | 0 | not-applicable |
| dodge-attack | 10700115/sub0 | 0/0 | 0 | 0 | static-evidence-gap |
| plunging-attack | 10700111/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 10700112/sub0 | 1/1 | 1 | 2 | applied |
| star-combo | 10700126/sub0 | 0/0 | 0 | 0 | not-applicable |
| ultimate | 10700113/sub0 | 0/0 | 0 | 1 | applied |
| star-carry | 10700121/sub0 | 0/0 | 0 | 0 | not-applicable |
| limit-counter | 10700125/sub0 | 0/0 | 0 | 0 | not-applicable |
| perfect-parry | 10700127/sub0 | 0/0 | 0 | 0 | not-applicable |
