# M12-C owner / STARBORN Workbench 视觉签收

状态：`pending-explicit-user-signoff`

审阅基线：`bda6696e07969b82445a922e19f3c9739a315dc6`

本轮为 normal-input authority v2 技术闭合后的全新证据，未复用旧截图或旧签收身份。每个 owner 都通过 `generate-character-acceptance.mjs --owner <id> --runtime-package-output ...` 生成精确 owner-only runtime package，再由 Playwright 在 1440×900 Workbench 页面执行真实 Machine Axis 文件导入、展开代表动作的 canonical trace，并保存导入对话框和 trace 截图。所有自动记录仍保持 `pending-explicit-user-signoff`；自动化不能代替用户产品签收。

| owner / 对象          | 导入结果                | 代表动作                          | control / sub  | canonical trace    | 证据                                                                                                                                                                                                                                                 |
| --------------------- | ----------------------- | --------------------------------- | -------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 101010                | 30 input / 32 execution | `xiaoyu-enhanced-charged`         | `10101010 / 2` | `1771ed0580495bd5` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-101010-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-101010-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-101010-review.json) |
| 102001                | 21 / 23                 | `lily-ultimate-all-land`          | `10200113 / 0` | `52fce6c80b00bef6` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-102001-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-102001-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-102001-review.json) |
| 103002                | 10 / 10                 | `ruby-chain-e1`                   | `10300201 / 1` | `9fadee844fa09040` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-103002-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-103002-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-103002-review.json) |
| 107001                | 50 / 50                 | `sifliya-a3-cycle-1`              | `10700103 / 4` | `23a2c1330d29e380` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-107001-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-107001-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-107001-review.json) |
| 107002                | 44 / 46                 | `misa-a3`                         | `10700203 / 0` | `1910eb5fa24efb76` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-107002-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-107002-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-107002-review.json) |
| 108003                | 26 / 26                 | `miti-full-charge-state-on`       | `10800342 / 0` | `ceb231f9f9812e1b` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-108003-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-108003-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-108003-review.json) |
| 109001                | 44 / 44                 | `moyin-thunder-preseed-signature` | `50005701 / 0` | `ff78b9d9ff0d2b93` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-109001-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-109001-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-109001-review.json) |
| 112001                | 11 / 13                 | `gisele-heavy3-threshold67`       | `11200141 / 3` | `d3becf22243bcf71` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-112001-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-112001-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-112001-review.json) |
| STARBORN alias 199001 | 48 / 50                 | `starborn-f-thrust-a3`            | `19900103 / 0` | `16ecf9bdf80c0a24` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-199001-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-199001-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-199001-review.json) |
| STARBORN alias 199002 | 48 / 50                 | `starborn-m-thrust-a3`            | `19900203 / 0` | `de92ab91256337a8` | [trace](./visual-evidence/2026-08-12/20260812-bda6696e-199002-canonical-trace.png) · [import](./visual-evidence/2026-08-12/20260812-bda6696e-199002-import-dialog.png) · [record](./visual-evidence/2026-08-12/20260812-bda6696e-199002-review.json) |

## 自动复核结果

- 10/10 owner/alias Playwright 审阅通过；每次均断言 `已导入 Machine Axis`、`data-machine-axis-import-active=true`、指定 `control/sub` 和至少一条可见 canonical hit。
- 20/20 PNG 均为 1440×900，文件 SHA-256 与对应 review JSON 完全一致。
- 103002 Ruby 可见强化普攻 E1 `control 10300201 / sub 1`；107001 可见 A3 `control 10700103 / sub 4` 与风语资源事务；107002 可见合法 A3；112001 可见 Heavy3 `sub 3`。
- STARBORN 两个别名都在同一 1588F 派生突刺后 A3 场景显示 `sub 0`，画面分别标识女主角/男主角，canonical trace 与截图 hash 各自独立；产品裁决仍只有一个 `STARBORN` optimization object。

## 产品签收边界

用户若确认这 10 组证据，可明确回复：`签收全部 owner，并将 199001/199002 作为单一 STARBORN 对象联合签收。`

收到明确签收后，下一步才是写入新的 acceptance identity、刷新一次派生产物、提交签收记录；仍需在签收提交后的 clean HEAD 上单次运行 `release:verify` 并重建 Formal Search Admission，之后才能启动全新搜索。
