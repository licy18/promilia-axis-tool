# 101003 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：57
- 语义转移：5/5
- 仅索引未接入窗口：0
- 玩法影响缺口：0

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 10100301/sub0 | input-window | [18,50) | - | han-normal-five-inputs / 普通攻击 A2 | continue-chain | applied |
| hidden-control 10100302/sub0 | input-window | [38,55) | - | han-normal-five-inputs / 普通攻击 A3 | continue-chain | applied |
| normal-attack 10100303/sub0 | input-window | [32,55) | - | han-normal-five-inputs / 普通攻击 A4 | continue-chain | applied |
| hidden-control 10100304/sub0 | input-window | [51,183) | - | han-normal-five-inputs / 普通攻击 A5 | continue-chain | applied |
| hidden-control 10100349/sub0 | input-window | [19,160) | - | 10100349/sub1 | input-context-derived | verified-input-context-variant-edge-ready |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 10100303/sub0 | 1/1 | 0 | 0 | applied |
| charged-attack | 10100310/sub0 | 0/0 | 0 | 0 | not-applicable |
| dodge-attack | 10100315/sub0 | 0/0 | 0 | 0 | not-applicable |
| plunging-attack | 10100311/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 10100312/sub0 | 0/0 | 0 | 2 | applied |
| star-combo | 10100326/sub0 | 0/0 | 0 | 0 | not-applicable |
| ultimate | 10100313/sub0 | 0/0 | 0 | 3 | applied |
| star-carry | 10100322/sub0 | 0/0 | 0 | 1 | applied |
| limit-counter | 10100325/sub0 | 0/0 | 0 | 0 | not-applicable |
| perfect-parry | 10100327/sub0 | 0/0 | 0 | 0 | not-applicable |
