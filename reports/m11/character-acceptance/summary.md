# M11-D 角色机制验收协议

- 基线：308dd07fbbb8fe0759062e9dcc02c65b0fd46115
- 状态：实现完成，等待产品验收
- 规则：成熟度完全由 golden、canonical 重放、Workbench 往返、矩阵、ledger 与产品记录推导。
- 性能、包体和外部 CPU 抖动仅记录，不参与功能资格判定。

| 角色 | 成熟度 | 矩阵通过/必需 | 阻断 ledger | optimization-ready |
|---|---:|---:|---:|---:|
| 寒悠悠 (101003) | runtime-integrated | 132/243 | 135 | 否 |
| 涂山小玉 (101010) | runtime-integrated | 174/407 | 339 | 否 |
| 红宝石 (103002) | runtime-integrated | 185/709 | 575 | 否 |

三份 Machine Axis 场景均由唯一 canonical core 重放并通过 Workbench 导入/导出；当前产品可视验收记录仍为 pending，且既有 gameplay-impacting 证据缺口继续阻断优化资格。
