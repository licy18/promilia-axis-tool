# M9-R3-R2-R2 涂山小玉隐藏输入派生审计

- 公开执行形态：21/21
- EventBridge / 支持控制审计行：89
- 已接入上下文派生边：7
- 普攻链直接接续：8
- 系统/移动控制排除：22

## 已接入指定输入派生

| 来源动作 | source control/sub | 输入 | 半开窗口 | 目标形态 | target control/sub | 条件 |
| --- | --- | --- | --- | --- | --- | --- |
| 普通重击 | 10101010/sub0 | charged-attack | [75, 100)F | 连续重击 | 10101010/sub1 | always |
| 极限反击 | 10101025/sub0 | charged-attack | [60, 96)F | 特殊重击 | 10101042/sub0 | always |
| 星鸣技 | 10101012/sub0 | charged-attack | [86, 120)F | 特殊重击 | 10101042/sub0 | always |
| 星决技 | 10101013/sub0 | charged-attack | [295, 329)F | 强化特殊重击 | 10101042/sub1 | always |
| 爆发普攻 A3 | 10101005/sub1 | charged-attack | [0, 20)F | 强化特殊重击 | 10101042/sub1 | resource-state-active |
| 爆发普攻 A3 | 10101005/sub1 | charged-attack | [40, 72)F | 强化特殊重击 | 10101042/sub1 | resource-state-active |
| 普通攻击 A5 | 10101005/sub0 | charged-attack | [37, 102)F | 特殊重击 | 10101042/sub0 | resource-state-inactive |

## 公开形态覆盖

| 形态 | control/sub | 窗口行 | 已应用关系 | 指定派生 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| 普通攻击 A1 | 10101001/sub0 | 3 | 1 | 0 | covered |
| 普通攻击 A2 | 10101002/sub0 | 3 | 1 | 0 | covered |
| 普通攻击 A3 | 10101003/sub0 | 3 | 1 | 0 | covered |
| 普通攻击 A4 | 10101004/sub0 | 3 | 1 | 0 | covered |
| 普通攻击 A5 | 10101005/sub0 | 6 | 4 | 1 | covered |
| 爆发普攻 A1 | 10101001/sub1 | 3 | 1 | 0 | covered |
| 爆发普攻 A2 | 10101004/sub1 | 3 | 1 | 0 | covered |
| 爆发普攻 A3 | 10101005/sub1 | 4 | 3 | 2 | covered |
| 普通重击 | 10101010/sub0 | 3 | 1 | 1 | covered |
| 星携技 | 10101021/sub0 | 3 | 0 | 0 | covered |
| 完美招架反击 | 10101049/sub1 | 5 | 2 | 0 | covered |
| 强化重击 | 10101010/sub2 | 2 | 0 | 0 | covered |
| 特殊重击 | 10101042/sub0 | 4 | 1 | 0 | covered |
| 强化特殊重击 | 10101042/sub1 | 5 | 2 | 0 | covered |
| 连续重击 | 10101010/sub1 | 3 | 1 | 0 | covered |
| 闪击 | 10101015/sub0 | 4 | 1 | 0 | covered |
| 跃击 | 10101011/sub0 | 3 | 0 | 0 | covered |
| 星鸣技 | 10101012/sub0 | 4 | 1 | 1 | covered |
| 星结合击 | 10101026/sub0 | 1 | 0 | 0 | covered |
| 星决技 | 10101013/sub0 | 3 | 1 | 1 | covered |
| 极限反击 | 10101025/sub0 | 4 | 1 | 1 | covered |

## 星携技核查

- 结论：当前客户端入场槽直接执行 10101021/sub0；其 EventBridge 与效果链未发现指向 10101042。10101041 来自闪避系统槽并桥接极限反击，传闻更可能混淆了极限反击路径。
- 状态：verified-not-found-in-current-client
- 入场执行：10101021/sub0；直接指向 10101042 的边：0
- 10101041 来源控制：10101014, 10101024

普通取消/重开窗口、普攻连段、指定输入派生、状态分支和系统控制分别保留；窗口统一采用 [startFrame, endFrame) 半开区间。
