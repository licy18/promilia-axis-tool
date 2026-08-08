# 102001 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：80
- 语义转移：4/4
- 仅索引未接入窗口：0
- 玩法影响缺口：0

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 10200101/sub0 | input-window | [19,46) | - | lily-normal-five-inputs / 普通攻击 A2 | continue-chain | applied |
| hidden-control 10200102/sub0 | input-window | [32,50) | - | lily-normal-five-inputs / 普通攻击 A3 | continue-chain | applied |
| normal-attack 10200103/sub0 | input-window | [40,96) | - | lily-normal-five-inputs / 普通攻击 A4 | continue-chain | applied |
| hidden-control 10200104/sub0 | input-window | [42,84) | - | lily-normal-five-inputs / 普通攻击 A5 | continue-chain | applied |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 10200103/sub0 | 1/1 | 0 | 0 | applied |
| charged-attack | 10200110/sub0 | 0/0 | 0 | 0 | not-applicable |
| dodge-attack | 10200115/sub0 | 0/0 | 0 | 0 | not-applicable |
| plunging-attack | 10200111/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 10200112/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-combo | 10200126/sub0 | 0/0 | 0 | 0 | not-applicable |
| ultimate | 10200113/sub0 | 0/0 | 0 | 3 | applied |
| star-carry | 10200122/sub0 | 0/0 | 0 | 0 | not-applicable |
| limit-counter | 10200125/sub0 | 0/0 | 0 | 0 | not-applicable |
| perfect-parry | 10200127/sub0 | 0/0 | 0 | 0 | not-applicable |
