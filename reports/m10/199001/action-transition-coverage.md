# 199001 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：67
- 语义转移：4/4
- 仅索引未接入窗口：1
- 玩法影响缺口：0

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 19900101/sub0 | input-window | [20,50) | - | starborn-199001-normal-five-inputs / A2 | continue-chain | applied |
| hidden-control 19900102/sub0 | input-window | [39,69) | - | starborn-199001-normal-five-inputs / A3 | continue-chain | applied |
| normal-attack 19900103/sub0 | input-window | [48,78) | - | starborn-199001-normal-five-inputs / A4 | continue-chain | applied |
| hidden-control 19900104/sub0 | input-window | [45,95) | - | starborn-199001-normal-five-inputs / A5 | continue-chain | applied |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 19900103/sub0 | 1/1 | 0 | 0 | applied |
| charged-attack | 19900110/sub0 | 0/0 | 0 | 0 | not-applicable |
| dodge-attack | 19900115/sub0 | 0/0 | 0 | 0 | not-applicable |
| plunging-attack | 19900111/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 19900112/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-combo | 19900126/sub0 | 0/0 | 0 | 0 | not-applicable |
| ultimate | 19900113/sub0 | 0/0 | 0 | 9 | applied |
| star-carry | 19900122/sub0 | 0/0 | 0 | 9 | applied |
| limit-counter | 19900125/sub0 | 0/0 | 0 | 0 | not-applicable |
| perfect-parry | 19900127/sub0 | 0/0 | 0 | 0 | not-applicable |
