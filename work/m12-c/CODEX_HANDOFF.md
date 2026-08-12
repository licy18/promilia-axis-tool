# AzPr M12-C 中央集成续接 Handoff

时间：2026-08-12 14:53（北京）
仓库：`C:\Codex\AzPr Axis\promilia-axis-tool`

## 从这里开始

1. 读取 `work/m12-c/STATE.md` 的 `0.00` 收口快照和本文件。
2. 运行只读核对：`git status --short --branch`、`git rev-parse HEAD`、`git log -1 --oneline`。
3. 预收口实现 HEAD：`32835990ff14deb2289d0070ade48b8125b6f0d7`；包含本 handoff 的 docs-only 提交是其直接后继。分支 `master`，当时相对 `origin/master` ahead 39。

## 当前工作树

未提交 Ruby/103002 tracked WIP：

- `fixtures/character-acceptance/103002-visual.json`
- `fixtures/character-acceptance/103002-active-surface-closure.json`
- `fixtures/character-acceptance/103002-marker-expiry-ordering.json`
- `fixtures/character-acceptance/103002-window-boundaries.json`
- `fixtures/character-acceptance/103002-joint-attack-runtime.json`
- `scripts/character-acceptance/acceptance-recipes/103002.json`

本线程诊断恢复脚本：`.readonly-ruby-probe.mjs`（untracked）。不要误删其他 `work/**` evidence，不动 `stash@{0}`。

## 已完成与真实验证

- authority v2、runtime/Workbench/search fail-closed、STARBORN context/marker 防伪、Misa A1/A2 projectile authority 已合入。
- `ad6fb7d7`：Misa scoring/acceptance technical closure。
- `32835990`：Xiaoyu technical migration；closure `6/6 PASS`，canonical `2 PASS / 6 SKIP`，owner required/pass `202/202`，零 gap/blocker，headless/canonical/Workbench true。
- 本收口没有运行 full、trial-release、`release:verify`、formal admission 或搜索。

## 当前 blocker

Ruby WIP 把 package hash、main A1/A2/A3/E1、enhanced E1-E12、marker 与 reload window 开始迁到显式 absolute frame/group/context。带 owner overlay 的 probe 尚未到 E1，就被 active-surface 的旧密集独立 A1 critical cadence 拒绝：A1@0 后 120/360/420/480/600/700F 等 fresh A1 违反 successor/recovery phase。无输出或未到 E1 不是 PASS。

恢复方案：保留 critical action IDs/hit overrides，把 critical 与 pre/post star-carry 普攻改成合法完整 A1→A2→A3 或经权威确认的 reopen 链；同步 switch/star/ultimate/E1-E12 absolute frames 和 recipe 时间断言；然后跑 Ruby owner-focused tests/generator。未达到完整 owner result 前不要提交 Ruby 批次。

## 后续门禁顺序

1. 完成 Ruby 技术闭合。
2. 逐 owner/STARBORN 做真实 replay、Workbench/Playwright 视觉检查并生成新签收；旧截图/hash 不复用。
3. 全部完成后一次性刷新派生产物。
4. clean tracked HEAD 上只运行一次：`$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run release:verify`。
5. 独立确认 HEAD 不漂移、formal admission 15/15、authority v2 live descriptor 完整绑定、推送 `origin/master`。
6. 创建新 run，按 source-family/team 分片，用 AI-guided bounded heuristic 重搜三个 objective；当前有效 Top-5 均为 `0/5`。

禁止：复用旧 checkpoint/result/finalization/closeout；再次跑 35-source 无中间产物单体长跑；据技术绿灯自动代签产品视觉；删除或移动既有 untracked evidence。
