# M12-C Top-15 Workbench 可视签收

- 签收时间：2026-08-12 06:21:26（北京时间）
- 方法：15 份最终 `machine-axis.json` 均经可见文件选择器逐一导入真实 Workbench；逐一查看时间轴、动作检查器、命中与数值溯源，并保存独立截图。
- 结果：15/15 `import-active=true`；15/15 UI canonical trace hash 与候选 trace identity 一致；15/15 有独立 Workbench 截图；3/3 objective 有直接显示导入状态、摘要和 trace 的对话框截图；0 issues。
- 边界：本签收只确认 runtime-baseline 产品回放与正式评分产物可视可用；`rankingClaim="AI-guided heuristic Top-N"`、`formalRankingReady=false`、`clientParityReady=false`，不构成全局最优、穷举完整或客户端一致性声明。

| Objective | Rank | Raw identity | UI actions | Trace | 人工观察 | 截图 |
| --- | ---: | --- | ---: | --- | --- | --- |
| cycle-dps-no-toughness | 1 | `0426742c7645…f354` | 1/1 | `c23abe1dcefe6252` | A1 命中 1/1；数值溯源已验证；STARBORN=199002 family 可见 | `workbench-top15/01-cycle-dps-no-toughness-rank-01-0426742c7645.png` |
| cycle-dps-no-toughness | 2 | `05fd79c6703f…674d` | 1/1 | `3f0d8e8ccd072d8c` | A1 命中 1/1；数值溯源已验证；涂山小玉 family 可见 | `workbench-top15/02-cycle-dps-no-toughness-rank-02-05fd79c6703f.png` |
| cycle-dps-no-toughness | 3 | `24310a88c20a…4ff7` | 1/1 | `3bd8c2693b809348` | A1 命中 1/1；数值溯源已验证；米砂 family 可见 | `workbench-top15/03-cycle-dps-no-toughness-rank-03-24310a88c20a.png` |
| cycle-dps-no-toughness | 4 | `3c152cb8d3cb…26ad` | 1/1 | `d5811914b9db407b` | A1 命中 1/1；数值溯源已验证；莉莉 family 可见 | `workbench-top15/04-cycle-dps-no-toughness-rank-04-3c152cb8d3cb.png` |
| cycle-dps-no-toughness | 5 | `610564bdaf63…0230` | 1/1 | `06e8adfe0e922d1a` | A1 命中 1/1；数值溯源已验证；西芙莉雅 family 可见 | `workbench-top15/05-cycle-dps-no-toughness-rank-05-610564bdaf63.png` |
| cycle-dps-with-toughness | 1 | `38b7c64da14c…555c` | 8/8 | `e4195894d42fce78` | 星鸣技命中 6/6；HP/韧性均结算；STARBORN=199002 family 可见 | `workbench-top15/06-cycle-dps-with-toughness-rank-01-38b7c64da14c.png` |
| cycle-dps-with-toughness | 2 | `54019e131cab…bed0` | 8/8 | `d21a3ea9d60eaa01` | 星鸣技命中 6/6；HP/韧性均结算；米蒂 family 可见 | `workbench-top15/07-cycle-dps-with-toughness-rank-02-54019e131cab.png` |
| cycle-dps-with-toughness | 3 | `78db8f263eae…9d36` | 8/8 | `b1ec2b6c21230e1d` | 星鸣技命中 6/6；HP/韧性均结算；莉莉 family 可见 | `workbench-top15/08-cycle-dps-with-toughness-rank-03-78db8f263eae.png` |
| cycle-dps-with-toughness | 4 | `82d3ef3ee546…e195` | 8/8 | `fcfabb0ddcbcdb6c` | 星鸣技命中 6/6；红宝石子弹为 0/12；HP/韧性均结算 | `workbench-top15/09-cycle-dps-with-toughness-rank-04-82d3ef3ee546.png` |
| cycle-dps-with-toughness | 5 | `86a2caad4c49…6040` | 8/8 | `2f019a15cc2e3368` | 星鸣技命中 6/6；HP/韧性均结算；西芙莉雅 family 可见 | `workbench-top15/10-cycle-dps-with-toughness-rank-05-86a2caad4c49.png` |
| fastest-kill | 1 | `41a4968f7d39…ead1` | 221/221 | `bec2d3acbd7ce558` | 221 个 LMB 输入密集物化；A1 命中 1/1；米砂 family 与 SP=100 可见 | `workbench-top15/11-fastest-kill-rank-01-41a4968f7d39.png` |
| fastest-kill | 2 | `743c597a1415…6410` | 221/221 | `58a9ff9a267bdb60` | 221 个 LMB 输入密集物化；A1 命中 1/1；莉莉 family 与 SP=100 可见 | `workbench-top15/12-fastest-kill-rank-02-743c597a1415.png` |
| fastest-kill | 3 | `7d0919ecba94…e47f` | 221/221 | `01385c49efe5095c` | 221 个 LMB 输入密集物化；A1 命中 1/1；STARBORN=199002 family 可见 | `workbench-top15/13-fastest-kill-rank-03-7d0919ecba94.png` |
| fastest-kill | 4 | `97bfa472d625…3f0b` | 221/221 | `e63331a9f7dcb5b9` | 221 个 LMB 输入密集物化；A1 命中 1/1；STARBORN=199001 family 可见 | `workbench-top15/14-fastest-kill-rank-04-97bfa472d625.png` |
| fastest-kill | 5 | `d93f6770e698…736f` | 221/221 | `cca0eb3a883242af` | 221 个 LMB 输入密集物化；A1 命中 1/1；西芙莉雅 family 与 SP=100 可见 | `workbench-top15/15-fastest-kill-rank-05-d93f6770e698.png` |

结构化矩阵与截图 SHA-256：`workbench-top15-visual-signoff.json`。
