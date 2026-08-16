# M12-C owner / STARBORN Workbench 视觉签收

状态：`accepted-explicit-user-signoff`

审阅基线：`bda6696e07969b82445a922e19f3c9739a315dc6`

签收时间：`2026-08-12T18:46:16+08:00`

签收指令：`签收全部 owner，并将 199001/199002 作为单一 STARBORN 对象联合签收。`

本轮为 normal-input authority v2 技术闭合后的全新证据，未复用旧截图或旧签收身份。每个 owner 都通过 `generate-character-acceptance.mjs --owner <id> --runtime-package-output ...` 生成精确 owner-only runtime package，再由 Playwright 在 1440×900 Workbench 页面执行真实 Machine Axis 文件导入、展开代表动作的 canonical trace，并保存导入对话框和 trace 截图。用户已对下列全部 owner/alias 作出明确产品签收；`199001/199002` 的两份 alias 证据只共同支撑一个 `STARBORN` optimization-object 裁决，不构成两个对象。

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

## 产品签收结果

- 10/10 owner/alias review 记录均已绑定本次用户明确签收；正式 acceptance evidence commit 为 `13d28aa515312a63395f49ddff3c778967e1b20f`。
- 8 个普通 owner 各自形成角色级产品裁决；`199001` 与 `199002` 保留各自角色级 manifest，但其对象级裁决统一绑定 `optimization-object-product-acceptance:STARBORN:13d28aa515312a63395f49ddff3c778967e1b20f:c94d6b6166226f10`。
- `101003` 不在本轮审阅或签收范围，继续保持 pending/unready。

新的 acceptance identity 与派生产物已刷新；仍需在签收提交后的 clean HEAD 上单次运行 `release:verify` 并重建 Formal Search Admission，之后才能启动全新搜索。

---

# 2026-08-16 机制包更新后真实重签（DoT / 审查修复基线 @81e2e56f）

状态：`accepted-explicit-user-signoff`

审阅基线：`81e2e56f`（mechanism package `d47224a5`）

签收时间：`2026-08-16 10:48（北京时间）`

签收指令：`继续签收`（用户对既有 10 owner + STARBORN 联合签收范围的延续授权）

机制包重建（流血 DOT 修复 + 审查 6 项修复）后，既有 829d628 签收的 qualification subject 全部失效。本轮按"不得据 hash 自动续签"原则重新捕获真实证据：逐 owner 生成精确 owner-only runtime package，Playwright 在 1440×900 Workbench 真实导入 Machine Axis、展开代表动作 canonical trace 并截图。10/10 Playwright 审阅 PASS，证据 commit 为 `7d765d87`。

| owner / 对象          | canonical trace    | 证据（2026-08-16）                                                                                                                                                                                                                                   |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 101010                | `532e9df6de5392b2` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-101010-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-101010-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-101010-review.json) |
| 102001                | `27a9f92545dcb618` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-102001-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-102001-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-102001-review.json) |
| 103002                | `1b9428463a24dd60` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-103002-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-103002-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-103002-review.json) |
| 107001                | `ec2b0fdf5281b027` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-107001-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-107001-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-107001-review.json) |
| 107002                | `28629db898bf3180` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-107002-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-107002-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-107002-review.json) |
| 108003                | `3319a6c6dcc13c16` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-108003-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-108003-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-108003-review.json) |
| 109001                | `2f15aea4124a3481` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-109001-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-109001-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-109001-review.json) |
| 112001                | `1bb74aaaa6ef43a4` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-112001-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-112001-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-112001-review.json) |
| STARBORN alias 199001 | `733f9b45105c1632` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-199001-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-199001-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-199001-review.json) |
| STARBORN alias 199002 | `e96dadeaf0c69577` | [trace](./visual-evidence/2026-08-16/20260816-81e2e56f-199002-canonical-trace.png) · [import](./visual-evidence/2026-08-16/20260816-81e2e56f-199002-import-dialog.png) · [record](./visual-evidence/2026-08-16/20260816-81e2e56f-199002-review.json) |

## 本轮签收落账

- 10/10 owner recipe `acceptanceCommit=7d765d87`、`screenshotSha256` 与 review JSON 一致；qualification subject / scenarioSetHash / recordIdentity 由 owner-only 权威生成器 binding expectation 回填。
- STARBORN 对象级 recipe 同步到 `7d765d87`，对象 subject `d99f600c89a285b6`、`formalAdmission=true`；199001/199002 仍只联合为一个 STARBORN 对象。
- 10/10 owner `binding=verified`、`optimization-ready`；STARBORN `binding=verified`、`optimization-ready`；101003 保持 pending/unready（非签收范围）。
- 修复两处验收派生缺陷：112001 twoTwo isolated case 三个 break 结算断言按当前机制包真实语义更新（196f 触发 break / pre-break overlimit / post-break 独立 packet，旧期望 191f 为机制包更新前的 false fact）；11200113 GP加攻（112001256）effect 投影 path_id → elementId 归一化，消除最后 1 个 acceptance-scenario-gap。
- canonical replay 六角色 trace hash 期望同步到当前 runtime 值（与 review JSON 一致）。

## 产品签收结果

- 10/10 owner/alias review 记录全部绑定本轮签收；正式 acceptance evidence commit 为 `7d765d87ee0db22fc0ee25f26dbf926946fbf08b`。
- `199001` 与 `199002` 保留各自角色级 manifest，对象级裁决统一绑定 `optimization-object-product-acceptance:STARBORN:7d765d87ee0db22fc0ee25f26dbf926946fbf08b:d99f600c89a285b6`。
- `101003` 不在本轮审阅或签收范围，继续保持 pending/unready。
