# M9-R3-R2 涂山小玉动作占轴审计

- 动作/形态行：21
- 精确占轴：21
- 动画规划占轴：0
- 未解析：0
- 已剔除收招尾帧：21

| 动作 | 语义形态 | control/sub | 动画 | 首末命中 | 有效占轴 | 占轴窗 | 状态 | 来源 |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- |
| charged-attack | 普通重击 | 10101010/sub0 | 310F | ---F | 75F | specific-input-transition | applied | verified-specific-input-window |
| charged-attack | 连续重击 | 10101010/sub1 | 230F | ---F | 75F | specific-input-transition | applied | verified-specific-input-window |
| charged-attack | 强化重击 | 10101010/sub2 | 250F | ---F | 64F | unconditional-attack-reopen | applied | verified-unconditional-attack-reopen-window |
| charged-attack | 特殊重击 | 10101042/sub0 | 280F | ---F | 90F | specific-input-transition | applied | verified-specific-input-window |
| charged-attack | 强化特殊重击 | 10101042/sub1 | 205F | ---F | 60F | specific-input-transition | applied | verified-specific-input-window |
| dodge-attack | dodge-attack | 10101015/sub0 | 165F | 9-19F | 22F | specific-input-transition | applied | verified-specific-input-window |
| limit-counter | limit-counter | 10101025/sub0 | 285F | 15-57F | 60F | unconditional-attack-reopen | applied | verified-unconditional-attack-reopen-window |
| normal-attack | 普通攻击 A1 | 10101001/sub0 | 215F | 12-12F | 20F | - | applied | next-control-input-window |
| normal-attack | 爆发普攻 A1 | 10101001/sub1 | 216F | 13-65F | 72F | - | applied | next-control-input-window |
| normal-attack | 普通攻击 A2 | 10101002/sub0 | 285F | 12-33F | 35F | - | applied | next-control-input-window |
| normal-attack | 普通攻击 A3 | 10101003/sub0 | 305F | ---F | 47F | - | applied | next-control-input-window |
| normal-attack | 普通攻击 A4 | 10101004/sub0 | 225F | ---F | 30F | - | applied | next-control-input-window |
| normal-attack | 爆发普攻 A2 | 10101004/sub1 | 270F | 8-99F | 75F | - | applied | next-control-input-window |
| normal-attack | 普通攻击 A5 | 10101005/sub0 | 240F | 31-73F | 80F | - | applied | attack-reopen-window |
| normal-attack | 爆发普攻 A3 | 10101005/sub1 | 190F | 32-56F | 72F | - | applied | attack-reopen-window |
| perfect-parry | perfect-parry | 10101027/sub0 | 190F | ---F | 36F | unconditional-attack-reopen | applied | verified-unconditional-attack-reopen-window |
| plunging-attack | plunging-attack | 10101011/sub0 | 310F | 36-36F | 50F | unconditional-attack-reopen | applied | verified-unconditional-attack-reopen-window |
| star-carry | star-carry | 10101021/sub0 | 295F | ---F | 95F | unconditional-attack-reopen | applied | verified-unconditional-attack-reopen-window |
| star-combo | star-combo | 10101026/sub0 | 200F | 40-40F | 60F | unconditional-attack-reopen | applied | verified-unconditional-attack-reopen-window |
| star-skill | star-skill | 10101012/sub0 | 260F | 15-70F | 120F | unconditional-attack-reopen | applied | verified-unconditional-attack-reopen-window |
| ultimate | ultimate | 10101013/sub0 | 455F | 136-284F | 329F | unconditional-attack-reopen | applied | verified-unconditional-attack-reopen-window |

完整动画、命中帧、输入/派生窗口和有效占轴分别保留；时间轴阻塞只消费 effective occupancy。
