# M9-R3-R2-R3 派生输入与动作接续审计

- 小玉公开执行形态：21
- 小玉窗口审计：86/86
- 全公开动作窗口：1351
- 已解析输入/执行语义：1314
- 可解析贴边接续：969
- 同一后继多窗口行：525

原始窗口始终保持 `[startFrame, endFrame)`；贴边修复通过分离输入帧、执行起点和前动作关系性结束帧完成。

## 小玉已应用上下文派生

| 来源 | control/sub | 窗口 | 通用占轴 | 语义 | 规范输入 | 执行起点 | 前动作结束 | 贴边结果 |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- |
| 普通重击 | 10101010/sub0 | [75,100)F | 75F | immediate-interrupt | 75F | 75F | 75F | resolved |
| 极限反击 | 10101025/sub0 | [60,96)F | 60F | immediate-interrupt | 60F | 60F | 60F | resolved |
| 星鸣技 | 10101012/sub0 | [86,120)F | 120F | immediate-interrupt | 119F | 119F | 119F | resolved |
| 星决技 | 10101013/sub0 | [295,329)F | 329F | immediate-interrupt | 328F | 328F | 328F | resolved |
| 爆发普攻 A3 | 10101005/sub1 | [0,20)F | 72F | immediate-interrupt | - | - | - | not-applicable |
| 爆发普攻 A3 | 10101005/sub1 | [40,72)F | 72F | immediate-interrupt | 71F | 71F | 71F | resolved |
| 普通攻击 A5 | 10101005/sub0 | [37,102)F | 80F | immediate-interrupt | 80F | 80F | 80F | resolved |

## 全量分类

- generic-occupancy-inside-window: 809
- unresolved: 3
- window-after-generic-occupancy: 77
- window-before-generic-occupancy: 300
- window-end-equals-generic-occupancy: 55
- window-start-equals-generic-occupancy: 107
