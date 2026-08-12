# AzPr M12-C 中央集成续接 Handoff

## 2026-08-13 00:00 无人监管发布准入续接

- 第一次无人监管 release 尝试在 clean `66793ae27315fbabc7f37759f23dd621c14cc711` 上真实执行，record `897beb9b3b44d3f5f4b048b09357ba52374c2059537ad157252adedcc8fedea5`，结果 `FAIL (executed)`：247 files / 2070 tests 中仅 `productionImportsAudit` 1 项失败，原因是新增 `verifiedNormalAttackInputScheduling.js` 尚未进入 canonical production-import report。报告已由权威生成器刷新为 235 source / 231 production-reachable / 4 allowed test-only / 0 unexpected / 0 unreferenced，聚焦测试 3/3 PASS；必须提交该单一派生清单修复后，从新的 clean HEAD 完整重跑建权，旧 FAIL 不得作为准入。
- 第二次 release 在 clean `83dd0e123f3ab3c273566b6e89165679e6f2ca94` 上跨过全 2070 tests 后于 `audit:character-acceptance` 诚实失败：normal-input 修复改变 103002、199001、199002 的 current acceptance subject，旧记录按设计 fail closed。用户已授权无人监管签收；现依本轮真实 64/64 preview 与各 owner 生成器重新绑定：103002 subject `314afdb71e2322d8`、199001 `138965042f15f3bc`、199002 `a05e5a190129fc65`；199001/199002 仍只联合形成一个 STARBORN object，object subject `9affb48ed674b7be`、bundle `aa1a84ff439f8c8e`。owner 全量 10 accepted / 101003 pending，STARBORN 390/390 + 3237/3237，qualification 263/263、零 blocking gap；聚焦 4 files / 76 tests 和各 clean generator 通过。第二次 FAIL 也不得作为准入。
- 当前工作批在 `c4761acf4e906b2b47f2cf149a307ef01f4584ee` 之后修复 Ruby `A3 -> E1` phase transition、无 owner overlay 的 graph-chain segment 投影、context-selected E1 后的 E2 链继承，以及相应 Workbench 顺序输入验收。中央聚焦回归为 4 files / 141 tests PASS，生产 build 1903 modules 通过。
- 新 phase-transition 投影按依赖职责进入 Workbench 动态模块，既有共享链解析仍留在首屏模块；bundle 权威脚本现场通过，initial entry `119981/120000` gzip bytes、Workbench `487871/500000`、total JavaScript `914453/920000`，三项 `budgetStatus=true`，未提高预算。
- 新鲜官方 Ruby CLI 输出位于 `work/m12-c/diagnostics/103002-visual-fresh-cli-closeout.json`：E1 为 `10300201/sub1`、24F，三段强化命中；随后同一实现完成真实 production preview 42/42 capabilities、64/64 tests PASS，报告在 `reports/production-preview-acceptance.json`。
- 用户已授权无人监管签收。既有产品范围不变：101010、102001、103002、107001、107002、108003、109001、112001、199001、199002 为 10 个已签角色 owner/alias；199001/199002 仍只形成一个 `STARBORN` optimization object。101003 的当前 CLI 轴虽为 `axis-action-legality-passed` 且新增 Workbench 截图已只作为 untracked 诊断证据保留，但 owner generator 仍真实报告 41 blocked / 13 source gap / 34 acceptance gap / 47 functional failure，因此继续 pending/unready，不得自动升格。
- 本批提交后只允许从 clean tracked HEAD 运行一次用户重新授权的 8 GiB `release:verify`，要求 Gate V2 executed PASS、Formal Search Admission READY 15/15、normal-input authority v2 live descriptor 全字段绑定、HEAD 无漂移、`origin/master == HEAD`。中央任务不得创建 search run/config 或启动 `search:ai-guided`；准入证据必须交给独立任务 `019ff67c-6c58-7782-8bdb-0aaf52ef79c1` 后由其启动全新三目标搜索。
- 保护项继续生效：全部既有 untracked evidence、`.readonly-ruby-probe.mjs` 与新增 101003 诊断截图均不删、不移动、不暂存；`stash@{0}` 必须仍为 `900e193bf710b8f894b50e0bc966db70cbd7e717`。污染文件 `work/m12-c/guidance.m12c4.round1.cycle-no-toughness.json`、`work/m12-c/m12c4-search-template.json` 不得读取或使用。

时间：2026-08-12 20:40（北京）
仓库：`C:\Codex\AzPr Axis\promilia-axis-tool`

## 从这里开始

1. 完整读取 `work/m12-c/STATE.md` 的 `0.00`、`0.04`、`0.05` 与本文件。
2. 只读核对：`git status --short --branch`、`git rev-parse HEAD`、`git log -2 --oneline`、`git stash list --format='%gd %H %s' | Select-Object -First 1`。
3. 当前技术收口 HEAD：`d9efacbaedbba5c9cd9e78a56d28385b0af76b5b`（`test(m12-c): refresh signed owner fixtures`）；其父提交 `04e955e8c99118e3a255194f7f6cf0cc6ba4f619` 为全部 owner/STARBORN 视觉签收批。本 handoff 是其直接后继；提交后分支 `master` 相对 `origin/master` 预期 ahead 47，仍须以现场 Git 输出为准。

## 当前权威状态

- 101010、102001、103002、107001、107002、108003、109001、112001、199001、199002 已明确签收；199001/199002 只形成一个 `STARBORN` optimization-object 联合签收。101003 不在范围内，保持 pending/unready。
- owner/alias 新视觉证据位于 `work/m12-c/product-review/visual-evidence/2026-08-12/`；签收汇总见 `work/m12-c/product-review/OWNER_VISUAL_SIGNOFF.md`。不要复用更早截图/hash，也不要把 199001/199002 拆为两个 optimization object。
- character acceptance 当前为 11 owner 中 10 个 runtime-integrated、visually accepted、optimization-ready；qualification 263/263、E22 binding 22/22、visual acceptance 254/254。当前 mechanics package hash 为 `62906a98964fa5948c80519e4454a4c8056f841d620a4c40b959c725f1941fc8`。
- clean HEAD `04e955e8` 上按旧 handoff 唯一一次 8 GiB `release:verify` 已执行，并在 `test:trial-release` 失败。记录 `work/m12-c/gates/latest-release-verify.json` 为 `status=fail`、`failureStage=test`、release record `4b7afb2a5b81a4b7245efe6cf3202f5f0198e70fad1ee12a5b4a255fc3e89170`。不得把它记为 PASS/READY。
- release 暴露的 32 个陈旧 fixture/test/report 文件已在 `d9efacba` 定向闭合；按组复验全部 32 files / 598 tests PASS，Prettier、JSON parse、`git diff --check` 通过。没有第二次运行 `release:verify`，没有 Formal Search Admission、推送或新搜索。

## 当前工作树与保护项

- tracked tree 在 `d9efacba` 后应 clean；只允许既有 untracked evidence 存在。
- `.readonly-ruby-probe.mjs` 与全部 `work/**` untracked evidence 原样保留，不删除、不移动、不纳入提交。
- `stash@{0}` 必须保持 `900e193bf710b8f894b50e0bc966db70cbd7e717 On master: codex-preserve-master-before-m12-b3-c31e4c3f`。
- `fixtures/machine-axis/m11-b-three-actor-120s.json` 是旧 mechanics hash 的必须失败历史反例，未更新且不得迁成正式输入。

## 后续边界

1. 当前 release authority 仍为 FAIL，Formal Search Admission 仍关闭；不得启动 `search:ai-guided`、正式搜索、推送或复用旧 checkpoint/result/finalization/closeout。
2. 不要自动再次运行 `release:verify`。旧 handoff 的“只运行一次”额度已经使用且失败；必须等待用户或中央任务对“是否授权一个新的完整 release 建权”作出明确裁决。
3. 若获得新的 release 授权，必须从当时的 clean tracked HEAD 重新完整执行，独立核对 HEAD 不漂移、formal admission 15/15、authority v2 live descriptor 全绑定；不得用本次 598 项定向 PASS 代替 release authority。
4. 只有新的 release PASS、独立 admission READY、推送完成后，才可创建全新 run 并按 source-family/team 分片重搜三个 objective；当前有效 Top-5 仍为 `0/5`。
