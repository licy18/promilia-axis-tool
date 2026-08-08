# M11-D-R1 角色机制验收协议

- 初始基线：308dd07fbbb8fe0759062e9dcc02c65b0fd46115
- R1 基线：5add67feb2a0ced22453df78d1408312a9e33fdb
- 状态：可信派生收口完成，等待产品复验
- 规则：requirement、scenario case、coverage edge、ledger 与成熟度均从 committed source-of-truth 和 canonical replay 派生。
- 性能、包体和外部 CPU 抖动仅记录，不参与功能资格判定。

| 角色 | 成熟度 | 矩阵通过/必需 | source gap | acceptance gap | optimization-ready |
|---|---:|---:|---:|---:|---:|
| 寒悠悠 (101003) | runtime-integrated | 122/214 | 13 | 69 | 否 |
| 涂山小玉 (101010) | runtime-integrated | 164/361 | 72 | 82 | 否 |
| 红宝石 (103002) | runtime-integrated | 172/663 | 71 | 203 | 否 |
| 末音 (109001) | runtime-integrated | 166/195 | 0 | 12 | 否 |

三份 Machine Axis 场景继续由唯一 canonical core 重放并通过 Workbench 导入/导出；产品可视签收仍为 pending，真实 source gap 与尚缺场景覆盖继续阻断优化资格。
