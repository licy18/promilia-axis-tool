# M11-D-R1 角色机制验收协议

- 初始基线：308dd07fbbb8fe0759062e9dcc02c65b0fd46115
- R1 基线：5add67feb2a0ced22453df78d1408312a9e33fdb
- 状态：可信派生与已明确产品签收的 owner 已闭合；未签 owner 继续 fail closed
- 规则：requirement、scenario case、coverage edge、ledger 与成熟度均从 committed source-of-truth 和 canonical replay 派生。
- 性能、包体和外部 CPU 抖动仅记录，不参与功能资格判定。

| 角色 | 成熟度 | 矩阵通过/必需 | source gap | acceptance gap | optimization-ready |
|---|---:|---:|---:|---:|---:|
| 寒悠悠 (101003) | extracted | 114/155 | 13 | 34 | 否 |
| 涂山小玉 (101010) | optimization-ready | 202/202 | 0 | 0 | 是 |
| 莉莉 (102001) | optimization-ready | 108/108 | 0 | 0 | 是 |
| 红宝石 (103002) | optimization-ready | 190/190 | 0 | 0 | 是 |
| 西芙莉雅 (107001) | optimization-ready | 80/80 | 0 | 0 | 是 |
| 米砂 (107002) | optimization-ready | 108/108 | 0 | 0 | 是 |
| 米蒂 (108003) | optimization-ready | 134/134 | 0 | 0 | 是 |
| 末音 (109001) | optimization-ready | 134/134 | 0 | 0 | 是 |
| 姬瑟贝露 (112001) | optimization-ready | 184/184 | 0 | 0 | 是 |
| 女主角 (199001) | optimization-ready | 195/195 | 0 | 0 | 是 |
| 男主角 (199002) | optimization-ready | 195/195 | 0 | 0 | 是 |

Machine Axis 场景继续由唯一 canonical core 重放并通过 Workbench 导入/导出；已明确签收的 owner 可进入 optimization-ready，未签 owner 的真实 source gap 与尚缺场景覆盖继续阻断其优化资格。
