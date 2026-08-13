# M12-C 末音配队、装配与动作轴优化计划

## 0.00000000000000 2026-08-14 07:59 035fcfee Gate 单一 E21 封套漂移闭合

- clean pushed `master@035fcfee85ac3cc2e7c3a966685dba32d8e3547a` 的唯一 Gate V2 已真实通过 character-combat、visual acceptance `254/254`、binding `22/22`、Kibo headless 与 machine-axis settlement；全量 Vitest 为 `250/251 files`、`2104/2105 tests`，随后以 exit `1`、record=`4797d93ac315132dc9f220ba23be5fe5cb4edb06bf4dd1bd8fd9c94728cac6fe`、`failureStage=test` 诚实封账。runner restoration 零残留，HEAD/remote 相等且 tracked tree 恢复 clean；未产生 Formal Search Admission，搜索任务保持 idle。
- 唯一失败为 `beforeSkillCompositeEvidence.test.js`：历史 E21 产品验收封套 `reports/m12/m12-b3-c-dynamic-loadout-effect-acceptance.json` 的六个 qualification hash 仍指向上一轮全 owner 重绑基线，而当前 101010/103002 successor trace 定向重绑后的权威 qualification 已稳定为 source snapshot `a12ba639b8a0241f`、roster `2e05d812634e9255`、manifests `1ab0a2c54addc3bc`、ledger `cdc23eb7c297b95d`、binding `608f02723e5a5c72`、catalog `28cb520282781801`。其余 249 个对象属性一致，没有生产运行时、动作、数值或 authority 漂移。
- 最小修复只同步上述六个封套 hash；`audit:optimization-qualification` 继续 `263/263`、零 blocker 且 assert-clean。全部 10 个引用该封套的 evidence tests 为 `10 files / 35 tests PASS`，没有放宽断言或修改生成器。
- 下一步只允许完成格式、精确 diff、保护项复核，提交并推送该单一封套派生修复；随后从新 clean HEAD 重建 Gate V2。新的 executed PASS、独立 Formal Search Admission `15/15` 与 live authority 复核完成前，搜索保持 idle，任何旧 run/config/checkpoint/result 均不得恢复或复用。

## 0.0000000000000 2026-08-14 07:38 52a98164 Gate 首阶段 golden trace 漂移闭合

- clean pushed `master@52a98164ded7682563a8b66323bfaf70c651ff3d` 的唯一 Gate V2 已在首个 `character-combat` 阶段按设计 fail closed：exit `1`、record=`2454f5866bf98e73fe9a89987a27f7f2be44d0b74dd15f052db710ad4b8d0d89`、`failureStage=character-combat`、completed stages `0`。runner 未进入后续测试/审计/preview，也未产生 Formal Search Admission；搜索任务保持 idle。
- 唯一漂移为 `reports/m10/101010/golden-trace.json` 与 `reports/m10/103002/golden-trace.json`。权威生成器刷新后两者都仅改变 canonical `traceHash/buildHash`；各自 `inputHash/dataHash`、source package、动作与数值未变：101010 `f7288eb9ac2a6e6a/3b84188ca7a55b60 -> 4a0fc926d239eb60/255047384ecaabac`，103002 `987a76c210638cec/2cfbe94134267d21 -> 33bf4c0426d6b26c/c6a439fcfed6de41`。
- 首次写回尝试未带 release 的 8 GiB `NODE_OPTIONS`，全量重算工作集逼近默认 V8 上限后退出且没有任何 tracked 产物；未把它计为成功，也未重复该配置。随后按 release 合同以 `--max-old-space-size=8192` 运行同一权威生成器，290.3 秒、exit `0`，原子写回后严格只有上述两文件漂移；同配置 `audit:character-combat` 304.6 秒 PASS。一次未带 8 GiB 且受 180 秒工具边界影响的 5 文件 Vitest 没有可靠终态输出，未计为 PASS；子进程自然退出且未产生额外 tracked 产物，后续不重复该调用。
- 下游 `audit:character-acceptance` 首次准确阻断 101010 的旧 product record binding。以临时 pending recipe 运行 owner-only 权威生成器后取得新 binding expectation，再恢复既有 `829d628bff9476c489d03e152e9377fd8c8e9e3c` 视觉证据签收：101010 qualification subject `6a3877d3e52d8431 -> 81fa9f4067851a48`、product scenario hash 保持 `f47ed3bbb4551a6b`；103002 subject `af39e2ab7808d82b -> 1341fb521686b889`、product scenario hash `f8fa50a894427c98 -> 772e03bd84be8025`。其他 owner 不重签，STARBORN 仍是 199001/199002 联合的单一 optimization object。
- 8 GiB 全量 character acceptance 写回 148.7 秒 PASS，恢复 `10/10` visually accepted / optimization-ready；随后 assert-clean + qualification + binding 链 167.7 秒 PASS。qualification 仍为 `263/263` 且零 blocker，新 hash 为 source snapshot `a12ba639b8a0241f`、roster `2e05d812634e9255`、manifests `1ab0a2c54addc3bc`、ledger `cdc23eb7c297b95d`、binding `608f02723e5a5c72`、catalog `28cb520282781801`；E22 binding `22/22 PASS`。
- 聚焦 acceptance/qualification/binding 首轮 `5 files / 48 passed / 2 stale identity assertions failed`，只更新上述两个新签收身份后同组 `5 files / 50 tests PASS`；golden migration/profile/Ruby/tuning-mark 组以 8 GiB 运行 302.1 秒，`4 files / 41 tests PASS`。没有放宽验证、动作或数值语义。
- 下一步只允许完成格式/保护项/精确 diff 复核，提交并推送最小派生刷新，再从新 clean HEAD 重建 Gate V2；在新 executed PASS 与独立 Admission 15/15 前不得交付 descriptor 或启动搜索。

## 0.000000000000 2026-08-14 06:44 c84d7efa 搜索封账与 103002 prefix successor 修复

- 唯一 c84d7efa run `m12c-moyin-top5-c84d7efa-20260814-054532698-cce886124878` 已按中央裁决完整 fail closed：任务 idle、无存活 worker、未继续 canary/seed/shard，三个 objective 均无最终 Top-5。`STOP_REPORT.json` canonical SHA-256=`1355f7c025ef304a468a447e4d96672131eeb2aacc962897e401e81e51dedd97`；本 run 永久不可 resume，Phase 1 的 105/105 与两次 calibration 仅保留为历史诊断证据。
- 两个独立 103002 canary 分别以 `verified-normal-attack-input-phase-conflict` 和 `103002 runtime continuation missing` 停止。`PRODUCTION_DEFECT_001.json` canonical SHA-256=`aec4c1a4549f7b64430bed2469be4668bde740cd900c1b6105d8cf2f7a46a2b1` 将根因缩小为 production canonical prefix→generator surface 缺失：ultimate-only prefix 已开启并满足条件的签名 quick-entry 窗口未投影到 `normalAttackSpecialContinuationCandidates`，而显式写入后继的完整轴可正常 replay。
- 中央最小 tracked WIP 仅投影 `applied=true`、`normal-attack`、有限右开区间、可在 installed graph 中唯一映射到 `derived-or-quick-entry` chain/segment 的待消费窗口；歧义、非普通攻击、未应用或非法区间继续 fail closed。generator 对带显式 chain 的 successor 从 installed graph 取得唯一 authority segment，不猜帧、context、chain 或 subskill。
- 新增 103002 ultimate-only prefix → canonical candidate → generator@329F → `prepare()` → `simulate()` → normal-input proof 的端到端正例，以及 exact-end 537F 不复用 successor 的负例；既有已消费 candidate 测试改为集合包含，以容纳同轴更早且独立的合法 pending window。聚焦 runtime/core/search-state/generator/service 为 `5 files / 151 tests PASS`，Prettier 与 `git diff --check` PASS。
- 提交前生产闭合已完成：ESLint 与两个 production `node --check` PASS；`audit:production-imports:check` 为 240 source / 236 production-reachable / 4 allowed test-only / 0 unexpected / 0 unreferenced，报告无漂移；production build 1906 modules PASS；`audit:bundle:check` 三项预算 PASS（initial `119997/120000`、Workbench `489281/500000`、total JS gzip `919232/920000`），projection guards 全真，未抬预算，canonical bundle 派生报告已刷新。live normal/charged/mechanics hash 仍分别为 `530396bf773cc439`、`d44151784c01218413e4a8b0d3950f938b91947684c38f9c68eebc7223b07446`、`04794a7c3de2ddc5bfea9ba2808e33241494c228c7428ba838777486ce305216`。
- 从本 WIP 出现起，c84d7efa release/admission 对后续搜索失效；搜索任务保持 idle。下一步只允许提交并推送新的 clean HEAD，再重建 Gate V2 executed PASS 与独立 Formal Search Admission 15/15；新 descriptor 交付后必须以不同 runId 从零启动，任何旧 config/checkpoint/result 均不得复用。
- 保护项保持：既有 untracked evidence 全部保留；`.readonly-ruby-probe.mjs` SHA-256=`68CBE4D07C1A23C1FE7EB25029B2C6A12819B2027E651B64209D60C4D0109B4A`；`stash@{0}=900e193bf710b8f894b50e0bc966db70cbd7e717`。两份污染配置未读取、未使用。

## 0.00000000000 2026-08-14 04:59 108003 generator/schema fail-closed 与中央最小修复

- 唯一新 run `m12c-moyin-top5-6e1610f5-20260814-043250243-2fdf4a98` 在 Phase 1 计划生成前按 production-defect policy 停止并封账：未生成 105-shard plan、未启动 worker、未建立 objective front、未产出 Top-5。旧 `0e02c64` 产物和两份污染配置仍未读取或复用；停止报告为 `work/m12-c/runs/<runId>/STOP_REPORT.json`，SHA-256=`1c52c55c0f47b1bbfa5a07be8eabf9852b821e3666672d9fea5f1b6155f02679`。
- 最小复现确认当前 production generator 为 108003 三档重击生成的 `intent.semanticVariant` 除 schema 已发布字段外，还携带 candidate-only 的 `semanticName` 与 `sourceIdentity`；Machine Axis schema 以 `additionalProperties=false` 确定性拒绝，issue=`machine-axis-schema-any-of @ actions.0.intent.semanticVariant`。输入/结果 SHA-256 分别为 `8437a3fad8bcdaacb704e8d0f7cd3192a6534f38d1c7802967ac0bf77a966587` / `5f541c5db2fe0df510925c0fb91696230091c9a5a6f63a617469edba409b4e63`。
- 中央最小 production WIP 仅在生成 action 时投影 schema 发布的 `selectorIdentity/selectorKind/publicVariantIndex/chargeTier/inputFrame/mode`；`semanticName/sourceIdentity` 继续保留在外层 candidate label/provenance，不扩 schema、不降 legality、不改重击 authority。新增 108003 light/medium/full 三档真实 generator -> `prepare()` -> `simulate()` 回归；单文件 `14/14 PASS`，随后搜索 generator/engine/local result/outer pool+service/charged proof+authority/formal admission 共 `8 files / 69 tests PASS`。
- 提交前复核：Prettier/ESLint/`node --check`/`git diff --check` PASS，production build PASS，`audit:production-imports:check` 为 `236 production-reachable / 4 allowed test-only / 0 unexpected / 0 unreferenced`；`audit:bundle:check` 三项 PASS（initial `119997/120000`、Workbench `488805/500000`、total JS gzip `918573/920000`），其中 initial 仅余 `3 bytes`，属于需保留的近预算风险而非阻断。bundle 派生报告已随 production 变化刷新。
- 从 tracked production 发生上述 WIP 起，`6e1610f5` release/admission 对后续搜索即失效；本次封账 run 不得 resume。下一步只允许完成格式/静态/生产构建与聚焦复核，形成新的 clean commit 并推送，再从新 HEAD 完整执行 Gate V2 和独立 Formal Search Admission `15/15`；新 authority 建立后另建不同 run，仍不得复用本次 run 的 checkpoint/results。

## 0.0000000000 2026-08-14 03:40 Gate V2 stale trace 身份闭合

- clean `master@c15ce4d597aefb936b13ee4e2beb968d36129c7e` 的第二次完整 Gate V2 在 character-combat、visual `254/254`、binding `22/22`、Kibo headless 与 settlement 全部通过后，于 full Vitest 诚实失败：`249/251 files`、`2097/2103 tests`，共 6 个 stale canonical trace hash 断言；release record=`6cd71ec6c00aaa90f314c2c032a3f115995f43e9607e47ad248eb21b634df078`、`status=fail`、`failureStage=test`。runner restoration 零残留，HEAD/remote 相等且 tracked clean；该 FAIL 不产生新 admission，搜索任务继续 idle。
- 6 个失败均保持 input/data/evaluation hash 不变，只因已验证的 input-derived successor candidate 现在进入 canonical trace。显式 fixture 新 trace：101010=`29b1a5cf197fd4f6`、103002=`0925f2d1732c9700`、109001=`68ccfb659f8eb692`、108003=`6b0763f7a68abaef`、107002=`f589ce53d905f26b`；未删除或放宽断言。
- 权威 character generator 的全量 pending 探针进一步证明 10 个正式 owner 的 product scenario 都包含该合法续段投影，因此全部 subject 都真实漂移。按既有用户无人监管签收授权重新绑定 10 个 owner，并恢复 `10/10` visually accepted、optimization-ready；101003 仍 pending/unready。199001/199002 仍只联合为一个 `STARBORN` 对象，新 object subject=`1817ace2a1b05e96`、bundle=`3ef27e3854a8b0ea`，`390/390` requirements、`3237/3237` assertions、零 gap。
- 最终 character acceptance `--assert-clean` 通过；qualification 仍为 `263/263`、零 blocker，新 hash 为 source snapshot `3c00684bb6300262`、roster `303421ced9f6f720`、manifests `86c747adbb2271ec`、ledger `96a5a0f07dc936c3`、binding `296cf266686e15a9`、catalog `1c179cc44e6c1dbb`；E22 binding `22/22`、visual acceptance `254/254`。character/qualification 聚焦目录首轮已有 28 files / 201 tests 通过，修正后其余 5 files / 27 tests 通过，合计覆盖 33 files / 228 tests 全绿。
- production import、Workbench data、action status、optimization scenario policy 均 clean；bundle 未抬预算且 PASS：initial `119996/120000`、Workbench `488805/500000`、total JavaScript gzip `918476/920000`，projection guards 全真。下一步只允许提交并推送本批签收身份与派生镜像，再从新 clean HEAD 完整重跑 Gate V2；executed PASS、独立 Formal Search Admission `15/15` 与 live authority 复核前不得恢复旧 run 或启动新搜索。
- 保护项未变：所有既有 untracked evidence 保留；`.readonly-ruby-probe.mjs` SHA-256=`68CBE4D07C1A23C1FE7EB25029B2C6A12819B2027E651B64209D60C4D0109B4A`；`stash@{0}=900e193bf710b8f894b50e0bc966db70cbd7e717`，两份污染配置未读取、未使用。

## 0.000000000 2026-08-14 03:03 新 HEAD Gate V2 首轮 binding 派生漂移

- clean `master@1f98f6321b9d11a05b4d3cfced4335a75bdc7e5a` 已推送并执行完整 Gate V2；character-combat 与 visual acceptance `254/254` 通过，随后 binding gate 按设计 fail closed。release record=`e31346613e20a5e63db33c15303da7a3f02c28f2357199218df8a193dd0977cf`、`status=fail`、`failureStage=binding`，没有产生新 Formal Search Admission，原搜索继续停止。
- 漂移仅为 103002 canonical successor trace 修复引起的 E22 smoke identity 更新：cycle hash `1397460c525baf78 -> ec435ce5c50defca`、trace hash `c127427123e360c8 -> eda093098990bf02`；normal-input authority 仍为 `530396bf773cc439`，verified mechanics package 仍为 `04794a7c3de2ddc5bfea9ba2808e33241494c228c7428ba838777486ce305216`。
- 两份 generator-owned binding matrix 已由权威生成器刷新，binding matrix hash `30a4025ffdb47558 -> 72f6e52502b3855b`；`--assert-clean` 为 `22/22 PASS`，binding/formal admission/outer pool+service/normal authority/search state 共 `6 files / 61 tests PASS`。
- 下一步：提交并推送这两份派生镜像和本状态记录；再从新的 clean HEAD 完整重跑 Gate V2。新 executed PASS、独立 Formal Search Admission `15/15` 和 live authority 复核全部完成前，不恢复或复用任何搜索结果。

## 0.00000000 2026-08-14 02:41 103002 successor canonical replay 集成修复进行中

- 唯一全新 run `m12c-moyin-top5-fresh-20260813-231115989-f30892fe58f6` 已在两条冻结 A1 canary 后 fail closed 停止；当前无搜索 Node 进程，三目标 Top-5 尚未完成。旧 `0e02c64` release/admission 对受影响搜索已失效，不得恢复或复用结果。
- 最小复现 `refinement/kill-103002-terminal-normal-phase-disagreement/minimal-production-reproduction.json`（SHA-256 `c38da13fc9fcf59aae96c472bc6e651548646af69e0c6ed3b4c904b7354a30f1`）确认：同一 103002 大招后强化 A1 在 production prepare/runtime 中使用 applied `input-derived` successor window 选中 `10300201/sub1`，但 canonical trace 没有投影 runtime 的 `specialContinuationCandidates`，search replay 因而回退 idle/default A1 并错误拒绝。
- 中央已做最小生产修复 WIP：runtime 把唯一匹配 authority phase 的 derived candidate 与 `contextActionId` 投影到 canonical trace；search replay/state 只接受 source action 已执行的候选，并继续由既有 normal-input authority 严格比对 chain/sequence/control/subskill/context。没有放宽 legality，也没有创建或运行搜索。
- 新增生产形状回归包含 switch on-enter、Kibo、103002 ultimate@94 与 enhanced E1@423，并有 source action 未执行的负例。runtime、canonical core、search state/service、cycle/kill evaluator、search engine 与 local-search result 共 `8 files / 203 tests PASS`；对原 92-action stopped-run 输入的只读 diagnostic 同样得到 prepare `0 issue`、canonical proof PASS、强化 E1 `10300201/sub1`、source=`input-derived`。
- 提交前静态/生产检查已通过：Prettier、ESLint、`git diff --check`，production import `240 source / 236 reachable / 4 allowed test-only / 0 unexpected / 0 unreferenced`，production build `1906 modules`。bundle 权威检查 PASS：initial `119996/120000`、Workbench `488799/500000`、total JavaScript gzip `918441/920000`，全部 projection guard 为真；派生 `reports/bundle-composition.json` 已随当前实现刷新。
- 下一步：形成 clean commit 并推送；随后从新 clean HEAD 真实重跑 Gate V2 与独立 Formal Search Admission `15/15`。全部新 authority 建立前搜索保持停止，旧 run 不得按旧 admission 恢复。

## 0.0000000 2026-08-13 22:00 bundle 等价修复与 production preview 复核

- 未改任何预算、重击 authority payload 或 canonical 行为：通过去重 source identity/选择结果构造，并使用 `onlyExplicitManualChunks=true` 仅把 5 个既有懒加载分析面板合并为 `workbench-analysis-panels`，公共依赖保持原分包。真实 `audit:bundle:check` PASS：initial `119995/120000`、Workbench `488504/500000`、total JavaScript gzip `918092/920000`，相对失败值净降 `2537` bytes，总预算余量 `1908` bytes；projection guard 全部为真，全部 external catalogs 在位。
- 实际 `vite preview` 上以非写入 reporter 定点验证新 chunk 的三个交互入口：`diagnostics-lazy-load`、`action-effect-relations`、`scenario-comparison` 均 PASS（`3/3`），未改写 production-preview acceptance 或任何 tracked 截图。完整 production preview 仍必须由新 clean HEAD 的 Gate V2 重跑。
- charged authority/hash 最终定点复验为 5 files / 103 tests PASS，authority hash 保持 `d44151784c01218413e4a8b0d3950f938b91947684c38f9c68eebc7223b07446`；production import 为 240 source / 236 production-reachable / 4 allowed test-only / 0 unexpected / 0 unreferenced，且报告无漂移。一次尝试删除 installed-package 唯一 mapping 查找导致 6 个 authority lookup 回归失败，已立即完整恢复该 fail-closed 路径且未重复该方案。
- 下一步：完成格式、production-import、聚焦测试与保护项的提交前复核；形成新 clean stable HEAD 后再真实执行完整 `release:verify`。在 Gate V2 PASS 与 Formal Search Admission `15/15` 之前继续禁止正式搜索。

## 0.000000 2026-08-13 21:42 Gate V2 bundle 预算失败与等价收敛

- clean `master@17515c009d46207b2722547d894dc13493c102cb` 上的真实 `release:verify` 已通过 character-combat、visual `254/254`、binding `22/22`、Kibo headless、settlement、全量 Vitest `251/251 files` / `2102/2102 tests`、production imports、Workbench data、action-status、verified-combat、scenario policy、owner/STARBORN acceptance 与 optimization qualification `263/263`，但在 `audit:bundle:check` 诚实失败；Gate V2 record=`ae120b7647a052f2c153c2702853d35a59faec3139984c4e4ffca4c6e37bd441`、`failureStage=audit:bundle:check`，未授予 release/admission authority。
- 精确预算差异为 total JavaScript gzip `920629 / 920000`，超 `629` bytes；initial entry `120000 / 120000` 与 Workbench `488532 / 500000` 仍通过。不得抬高预算或把该失败改写为 PASS；当前只允许在保持 charged authority hash 与 canonical 行为不变的前提下收敛生产实现，重建并提交新的 bundle composition 后，从新 clean HEAD 再完整执行 Gate V2。
- runner 正确保留失败现场 `reports/bundle-composition.json` 作为唯一 tracked drift；全部 untracked evidence、两份污染配置、`.readonly-ruby-probe.mjs` 与 `stash@{0}` 均未触碰，未启动任何搜索。

## 0.00000 2026-08-13 21:09 Gate V2 首轮失败与重击循环复放修复

- owner/STARBORN 签收与发布基线已在 `master@3feca4571c6dc7fc7fabf2adb320e5529adc9dd3` 形成三笔提交：`692c769c` 重击输入 authority、`829d628b` 全新 owner 视觉证据、`3feca457` 签收派生。199001/199002 仍只联合为一个 STARBORN optimization object；101003 保持 pending/unready。
- 首个 launcher 因 PowerShell 引号拆分在进入 release 前退出，不计 Gate 尝试。修正后的 `authorized-release-3feca4571c6d-20260813-retry1` 于 clean HEAD 真实执行；character-combat、visual `254/254`、binding `22/22`、Kibo headless 与 settlement 均通过，随后 full Vitest 为 `238/251 files`、`2076/2102 tests`，共 `13 files / 26 tests` 失败。Gate V2 诚实落盘 `status=fail`、`failureStage=test`，release record=`9db9190603e7fd35f3d149c185b5399031944a067192565c6f6d10dad58a6a99`；runner output restoration 无残留 tracked drift。
- 失败主体是新签收/新 golden 已生效但测试仍绑定旧 `13d28aa` 证据、旧哈希或旧 pool-stale 状态；这些断言已改绑 `829d628b` 当前视觉证据，并区分当前 automated evidence 与历史 superseded evidence。107002/Gisele 由旧 pending 期望改为当前 accepted/optimization-ready；STARBORN 仍以双 alias 证据联合约束单一对象。
- 唯一生产分层违规已关闭：角色 ID、客户端/审计身份与动作表整体下沉到 `src/data/verifiedChargedInputAuthorityData.js`，`src/domain/verifiedChargedInputAuthority.js` 只保留通用解析/调度。拆分前后 charged authority hash 均为 `d44151784c01218413e4a8b0d3950f938b91947684c38f9c68eebc7223b07446`，payload 字节语义未变；production import 已刷新为 240 source / 236 production-reachable / 4 allowed test-only / 0 unexpected / 0 unreferenced。
- 定点调试发现并修复真实循环缺陷：`createLoopReplayPlan` 曾把第一轮重击的绝对 `physicalInput` 原样复制到第二轮，造成 execution-frame mismatch，合法的一动作重击循环被 `machine-axis-cycle-second-replay-not-runnable` 错拒。现在第二轮移除陈旧声明，由 canonical charged proof 按实际前序重新派生 `release -> repress -> prehold`；M12-C outer integration `7/7` 重新通过，单动作重击循环恢复进入评分候选，threshold/rearm/108003 Charging reopen 证明仍 fail closed。
- 扩大聚焦复验覆盖 CLI、outer、charged proof、全部受影响 owner/STARBORN、golden 与验收派生：首轮 `13 files / 161 tests PASS`；格式化后的最终提交前复验为 `15 files / 210 tests PASS`，charged authority hash 仍为 `d44151784c01218413e4a8b0d3950f938b91947684c38f9c68eebc7223b07446`。角色 identity 分层单测与首轮全部失败点亦通过，`git diff --check` PASS。尚未把任何定点结果冒充 release authority。
- 当前下一步仅允许：提交本轮修复形成新 clean stable HEAD；从该 HEAD 重新真实执行完整 `release:verify`；PASS 后再独立执行 Formal Search Admission `15/15` 并推送 `origin/master`。在这三步完成前继续禁止创建/运行/复用正式搜索或读取两份污染配置。
- 保护项未变：所有既有 untracked evidence 原样保留；`.readonly-ruby-probe.mjs` SHA-256=`68CBE4D07C1A23C1FE7EB25029B2C6A12819B2027E651B64209D60C4D0109B4A`；`stash@{0}=900e193bf710b8f894b50e0bc966db70cbd7e717`，未读取、弹出或改写。

## 0.0000 2026-08-13 20:31 charged-input owner 签收与发布前收口

- 重击输入/时序实现基线为 `692c769cf0525044e3d33bba2fddb434b1d088aa`，全新视觉证据提交为 `829d628bff9476c489d03e152e9377fd8c8e9e3c`。10 个正式 owner 已逐一复核并签收；199001/199002 仅作为一个 `STARBORN` optimization object 联合签收，101003 继续 pending/unready。
- 全量 owner 派生已恢复：10/10 runtime-integrated、visually-accepted、optimization-ready；101010 `202/202`、103002 `190/190`、199001/199002 各 `195/195`，全部 headless/canonical/Workbench 通过。101003 保持 41 blocked、13 source gap、34 acceptance gap、47 functional blockers，不进入正式分母。
- `STARBORN` 联合对象为 `390/390` requirements、`3237/3237` assertions，bundle=`7fe94b34a6ced9c4`、product visual accepted、optimization-ready；两个 source alias 的 profile/source-contract/selection/canonical identity 继续各自独立。
- qualification 已刷新为 `263/263` optimization-ready、零 blocking gap；hash 为 source snapshot `13f59868a5f1bb43`、roster `fbdf04dfec427c24`、manifests `37669e2b1f2563c1`、ledger `631b16c493b03ea8`、binding `94b6b0eed55c2058`、catalog `67a8ec8745246dd3`。E22 binding `22/22`、visual acceptance `254/254`。
- production import audit 已把 AI 粗排/多核内层执行器两个新模块纳入正式 CLI 入口：239 source、235 production-reachable、4 allowed test-only、0 unexpected、0 unreferenced。聚焦 13 files / 182 tests PASS；`git diff --check` PASS。
- 一次发布前 `audit:verified-combat` 子进程在工具命令超时后自然完成，但退出输出未被可靠收回，因此不计为 PASS；正式 `release:verify` 必须在最终 clean stable HEAD 自行重跑并给出 Gate V2 权威。
- 保护项复核：主仓仍为 `bfccda35aa2655304779c1820137aa92b5a50e9a`；`.readonly-ruby-probe.mjs` SHA-256=`68CBE4D07C1A23C1FE7EB25029B2C6A12819B2027E651B64209D60C4D0109B4A`；`stash@{0}=900e193bf710b8f894b50e0bc966db70cbd7e717`。所有既有 untracked evidence、10 份本轮 runtime package 与三份 AI smoke 目录均保留且不得纳入提交。
- 当前尚未获得 release/admission authority：下一步只允许形成最终 tracked commit、将其快进到 `master`，再从 clean HEAD 真实运行 `release:verify` 与独立 Formal Search Admission 15/15。两者全部通过并推送前不得启动或复用正式搜索。

## 0.000 2026-08-13 00:00 normal-input v2 最终修复与无人监管准入

- clean `01a032ed1a59dd6bc8bb19f48df3067865d30d51` 上的第六次 release 已真实通过前五个独立 gate、247/247 Vitest files、2070/2070 tests、全部 assert-clean 审计、1903-module production build 与 64/64 production preview；runner outputs 成功恢复且 tracked postflight clean。随后在独立 Formal Search Admission 装载 live normal-input authority 时，原生 Node ESM 发现 `verifiedNormalAttackInputAuthority.js` 的 `canonicalSerialization` 与 `timebase` 两个相对 import 缺 `.js` 后缀；record=`98956a0729a08c92e3e598857ff4f8fd3625cd072c8a8a6eb860a37be9a627b7`、status=`interrupted`、failureStage=`orchestration`，因此仍不授予 release PASS/admission。两个后缀现已补齐，并新增真实 `node.exe` 导入 descriptor 回归；live authority v2 hash 保持 `530396bf773cc439`，聚焦 2 files / 21 tests PASS。bundle 仅同步该模块 `originalBytes 30885→30891`，initial `119981/120000`、Workbench `487872/500000`、total gzip `914424/920000` 三项预算仍全绿；须从新 clean HEAD 再完整建权。
- clean `f11ab4c12a435dd4ed8e5d89ce963fa3d44533e3` 上的第五次 release 编排因承载它的前台 shell 在约 30 分钟达到工具层超时而被外部终止；其 production preview 子进程随后只运行到日志可见的 62/64，并未回到 release 编排器完成 runner-output restoration、postflight、Gate V2 原子落盘或 Formal Search Admission。wrapper exit `1` 仅代表编排被中断，`latest-release-verify.json` 仍是上一轮 `4ec04079` 的诚实 FAIL，因此本次既不记业务 PASS，也不记业务 FAIL。遗留的 100 个 tracked `reports/*.png` 已在确认全部子进程退出、且没有任何其他 tracked 漂移后，按 `release-runner-output-v1` 的精确路径边界恢复到 HEAD；所有 untracked evidence、污染文件与 stash 均未触碰。下一次必须从新的 clean docs-only HEAD 以独立后台进程完整重跑，由 Gate V2 自身给出最终权威。
- clean `66793ae27315fbabc7f37759f23dd621c14cc711` 上的首次无人监管 release 已真实执行并诚实失败，release record=`897beb9b3b44d3f5f4b048b09357ba52374c2059537ad157252adedcc8fedea5`、failureStage=`test`：247 files / 2070 tests 中仅 `productionImportsAudit` 1 项失败。根因是本批新增 Workbench 调度模块未进入 canonical production-import report；现已用权威生成器刷新为 source 235 / production-reachable 231 / allowed test-only 4 / unexpected 0 / unreferenced 0，聚焦 3/3 PASS。旧 release 仍为 FAIL，不产生 admission；提交这个单一派生清单修复后才允许从新 clean HEAD 完整重跑。
- clean `83dd0e123f3ab3c273566b6e89165679e6f2ca94` 上的第二次 release 已通过全 2070 tests，随后在 `audit:character-acceptance` 因 current subject 与旧签收 tuple 不一致而 `FAIL (executed)`。按用户无人监管签收授权，使用真实 64/64 production preview 和 fail-closed owner generator 重新绑定：103002=`314afdb71e2322d8`，199001=`138965042f15f3bc`，199002=`a05e5a190129fc65`；199001/199002 继续仅联合为单一 STARBORN object，object subject=`9affb48ed674b7be`、bundle=`aa1a84ff439f8c8e`。owner 全量仍为 10 accepted、101003 pending；STARBORN 390/390、3237/3237；qualification 263/263、blocking gap 0；聚焦 4 files / 76 tests 和 character/object/qualification/import clean 审计全过。第二次 FAIL 不产生 admission，须提交本次真实重绑及全部派生后从新 clean HEAD 完整建权。
- clean `483cf1530fc156023b2754894c012329c4dff50d` 上第三次 release 于独立 `binding` gate `FAIL (executed)`，record=`da56914c0c2e398a8ac8795301f645afa291af46007d61f913e1e320bad58dfe`：重绑后的 qualification 正确，但最终 `m12-b3-binding-matrix.json/.md` 仍为旧派生镜像。两件已由权威生成器刷新并 `22/22` clean；binding 与 outer build pool 2 files / 19 tests PASS，28 canonical teams / 35 source configs 且 STARBORN 仍单一对象。第三次 FAIL 不产生 admission，提交后仍须从新 clean HEAD 完整建权。
- clean `4ec040794b6f185df2a6dea7253a2704d899c6be` 上第四次 release 已通过独立 gates，full Vitest 仅 `beforeSkillCompositeEvidence` 1/2070 失败；record=`d9793c1f9b7b5061a6fc0f0a0af05cced0b9981d330c38b810bf08c2a8002f9e`、failureStage=`test`。根因是历史 E21 产品验收封套的六个 qualification hash 镜像仍为更早基线；已精确同步当前 `sourceSnapshot/roster/manifests/ledger/binding/catalog` 权威 hash，所有 10 个引用封套的证据测试 35/35 PASS。第四次 FAIL 不产生 admission，提交后须从新 clean HEAD 完整建权。
- 在 `c4761acf4e906b2b47f2cf149a307ef01f4584ee` 后完成通用 normal-input 收口：graph phase transition 可在 Ruby 默认 A3 的来源化 `[34,79)` 窗口进入强化 E1；显式 chain 在缺 owner overlay 时只从唯一 applied/ready、owner/source/identity 一致且 segment 连续、occupancy 精确的 graph chain 投影；context-selected E1 可从唯一执行 control/subskill 反推链并让 E2 继承。没有新增 Ruby owner-id 特判。
- 当前实证：Machine Axis service + context scheduling + Workbench attack-input chain + variant runtime 4 files / 141 tests PASS；官方 Ruby CLI `103002-visual-fresh-cli-closeout.json` exit 0，E1=`10300201/sub1`、24F；production build 1903 modules PASS；真实 production preview 42/42 capabilities、64/64 tests PASS，612920ms。预览生成的 100 个非确定性 tracked PNG 已精确恢复，`reports/production-preview-acceptance.json` 与 canonical bundle 报告保留。
- Ruby phase-transition 投影已拆到 Workbench 动态模块，既有共享链解析保持首屏可用；权威 bundle check 现场通过且未抬预算：initial entry `119981/120000` gzip bytes、Workbench `487871/500000`、total JavaScript `914453/920000`，三项 budget status 全为 true。
- 用户授权后再次核对产品范围：10 个 optimization owner/alias 已全部签收，199001/199002 继续只支撑单一 STARBORN 对象。101003 当前轴 `actionLegalityProof.passed=true/finalScoreEligible=true` 且 Workbench trace 可见，但 owner generator 仍为 required 155 / passed 114、41 blocked、13 source gap、34 acceptance gap、47 functional failure；因此 101003 继续 pending/unready，新截图仅作为 untracked 诊断证据，不进入 acceptance recipe 或正式提交。
- 用户已明确授权重新发布、无人监管推进并另开 GPT-5.6-sol max 搜索任务。中央任务只负责修复提交、真实 Gate V2 release PASS、独立 Formal Search Admission 15/15、clean HEAD 推送与 authority v2 descriptor/hash 交接；不得创建任何 search run/config 或执行 `search:ai-guided`。独立任务 id 为 `019ff67c-6c58-7782-8bdb-0aaf52ef79c1`，在准入证据交付前保持只读等待。
- 保护项：不读取/使用两个既有污染文件，不清理任何 untracked evidence，不暂存 `.readonly-ruby-probe.mjs` 或 `work/**` 诊断材料，不动 `stash@{0}=900e193bf710b8f894b50e0bc966db70cbd7e717`。

状态：`M12-C4/C5/C6` 的既有搜索结论已于 2026-08-12 撤回并重新锁定。正式 run `m12c4-moyin-top5-20260812-v1` 暴露普攻链状态机漏洞：连段输入窗内重复普攻被错误解析为新的 `A1`，因此 `0.3s` 单次 A1 循环、重复 A1 击杀轴及其 Top-5/finalization/replay/Workbench 签收/closeout 全部属于受污染历史证据，不得继续作为产品结果或新搜索 checkpoint。当前 `optimizationFormalScoreReady=false`、`formalRankingReady=false`、`clientParityReady=false`；只有无头核心、排轴器和优化器统一接入修正后的连段状态并重新完成准入后，才可启动新的 M12-C4 搜索。

已验证实现基线（迁移前身份）：`master@777af8f790986efab42de398fd2ef394610a9a77`；Git LFS 等价提交：`d4da771d726dce458f1c44425f8280a2c9f13598`。迁移只改变 Git 存储身份，不改变生成包工作树字节或实现语义。

本文件是 M12-C 的实施合同。`DEVELOPMENT_PLAN.md` 保留阶段摘要，实际实现、测试和产品复验均以本文件为准。实现与优化资格全绿不等于客户端一致性或产品视觉自动签收；未满足对应产品边界前，不得把 M12-C 搜索结果声明为已获产品验收。

## 0.00 2026-08-12 14:53 旧中央线程紧急收口快照

- 收口原因：Codex 桌面端已无法可靠打开原中央线程。旧线程从此只作历史记录；没有启动新的长跑、Formal Search 或无关工程任务，也没有正在等待的本线程命令。
- Git 恢复点：分支 `master`；收口文档提交前的实现 HEAD 为 `32835990ff14deb2289d0070ade48b8125b6f0d7`（`fix(m12-c): migrate Xiaoyu normal input acceptance`），相对 `origin/master` 为 ahead 39。包含本段的 docs-only 提交是该实现 HEAD 的直接后继；续接时必须以 `git rev-parse HEAD` 和 `git status --short --branch` 复核实际 checkout。
- 已完成批次：normal-input authority v2、runtime/Workbench/search 评分前 fail-closed、STARBORN genuine context、防伪 continuation marker、107002 A1/A2 弹道机制与正式评分资格、109001/112001 技术轴，以及 101010 技术验收均已在主线形成独立提交。最近三个关键提交为 `2c86cc4b`（Misa mechanics）、`ad6fb7d7`（Misa scoring/acceptance closure）和 `32835990`（Xiaoyu acceptance migration）。这些是技术闭合，不等于产品视觉签收。
- 最近真实聚焦结果：101010 closure tests `6/6 PASS`；canonical replay 过滤结果 `2 PASS / 6 SKIP`；owner generator required/pass `202/202`，blocked/source gap/acceptance gap/functional failure 均为 `0`，headless/canonical/Workbench 为 true。未在本收口阶段运行 full、trial-release、`release:verify` 或 formal admission。
- 当前未提交 Ruby/103002 WIP（tracked）：`fixtures/character-acceptance/103002-visual.json`、`103002-active-surface-closure.json`、`103002-marker-expiry-ordering.json`、`103002-window-boundaries.json`、`103002-joint-attack-runtime.json`、`scripts/character-acceptance/acceptance-recipes/103002.json`。本线程自建恢复脚本 `.readonly-ruby-probe.mjs` 仍为 untracked；其他 `work/**` untracked evidence 均为既有资料，未删除、移动或改写，`stash@{0}` 未动。
- Ruby WIP 已做但未签收：5 个 fixture 已改绑 package hash `62906a98964fa5948c80519e4454a4c8056f841d620a4c40b959c725f1941fc8`；main A1/A2/A3/E1、enhanced E1-E12、marker 与 reload-window 边界开始改为显式 absolute frame、同 group/context/chain；recipe 新增 start-minus-one lane-overlap 负例。当前 diff 为 6 tracked files、`101 insertions / 43 deletions`，不是可提交批次。
- Ruby 当前真实 blocker：带 owner overlay 的只读 probe 尚未到 E1，即先被 `103002-active-surface-closure.json` 中旧的密集独立 A1 critical cadence 拒绝。A1@0 后的 120/360/420/480/600/700F 等 fresh A1 落在 successor/recovery 约束内，产生 normal-input phase conflict；因此不能把“无输出/未到 E1”记为 PASS。下一步须把每个 critical/pre-post star-carry 普攻改成合法完整 A1→A2→A3 或经验证的 idle/reopen 链，并同步后续 switch/star/ultimate/E1-E12 绝对帧和 recipe 断言，再跑 owner-focused generator/tests。
- 三条工作流状态：① authority/core/search fail-closed：技术实现完成，最终 release 仍未建立；② owner acceptance：技术迁移进行中，Ruby dirty，所有受影响角色和 STARBORN object 的新 Playwright/Workbench 产品视觉签收仍未完成，旧截图/hash 仅追溯；③ release/search：`optimizationFormalScoreReady=false`、formal admission 未重跑、最终 HEAD 未推送，三个目标当前有效 Top-5 均为 `0/5`，旧 release/admission/run/checkpoint/finalization/closeout 一律失效。
- 严格续接顺序：先读本节与 `work/m12-c/CODEX_HANDOFF.md`，复核 HEAD/status；完成 Ruby 技术闭合；逐 owner 做真实 replay、Workbench/Playwright 视觉检查并独立签收；所有 owner/STARBORN 完成后一次性刷新派生产物；只运行一次 `NODE_OPTIONS=--max-old-space-size=8192 npm run release:verify`；要求 clean、HEAD 不漂移、formal admission 15/15、authority v2 live descriptor 全绑定并推送 `origin/master`；最后才创建全新 run，按 source-family/team 分片重新搜索三个 objective Top-5。

## 0.01 2026-08-12 15:50 Ruby/103002 技术闭合快照

- 续接入口核对通过：`master@dafc6095a2825030d462e68a311022ae9cc9ad33`，相对 `origin/master` ahead 40；初始六个 Ruby tracked WIP 与 `.readonly-ruby-probe.mjs` 均存在。所有既有 untracked evidence 原样保留，`stash@{0}` 未读取或改动。
- 普攻链已按 authority v2 闭合：active-surface 中十组 critical/pre-post star-carry 普攻均为显式 `ruby-normal-default-three-inputs` A1→A2→A3；主轴 A1/A2/A3 同样显式绑定默认链，并在 A3 的来源化 `[34,79)` phase transition 内于 672F 合法进入 `ruby-enhanced-twelve-inputs` E1。强化 E1→E12 使用来源化 `attack-reopen-window` 续段；缺 reopen、资源/entry-policy/source identity 任一权威时仍 fail closed。
- compiler/runtime 修复保持通用：上下文前驱按前驱自身显式 chain 解析，目标按请求 chain 解析；derived chain 仅在已应用 `derived-or-quick-entry`、同一来源化资源门槛/逐段消耗、回指默认 opener 且 reopen 明确允许 `normal-attack` 时，才允许用 reopen 形成后继。没有新增 owner-id 分支，也没有改 authority v2 版本/hash。
- reload 边界保持右开 `[24,264)`：`-300/24/263/264F` 分别物化 default/enhanced/enhanced/default，`23F` 作为 `action-lane-overlap` 负例。owner-only 生成报告为 requirement 696、required/pass 190/190、N/A 506，blocked/source gap/acceptance gap/functional failure 全 0；6 个证据场景（1 golden + 5 machine）共 1778/1778 assertions，5 个 machine 场景 headless/canonical/Workbench 全绿。
- 主轴 canonical input/data/trace/evaluation/build hash 为 `0d81f27dc4ba1cea` / `4b4e77c78408e1ef` / `9fadee844fa09040` / `b0acda242f007986` / `d6adc7d6fdc52e02`；active-surface 为 `c098c6e04ea9a5ea` / `6d2fa208fc1a64f7` / `aef8824f88df5d7f` / `009654b3cfb789bb` / `bc058f5828628d55`。`node scripts/generate-character-acceptance.mjs --owner 103002 --assert-clean` 已通过。
- 聚焦验证：normal-input authority + Machine Axis service 44/44，Ruby closure 5/5，Ruby profile + verified runtime 77/77；`.readonly-ruby-probe.mjs` 需经 `vite-node` 运行，确认 prepared valid、E1→E12 全部物化和执行。raw `node` 会被仓库既有 extensionless ESM import 阻断，不要重复；这不是 Ruby runtime 失败。
- 不要用旧多 owner canonical batch 或简化 test helper overlay 代替 owner 生成器：当前全局 package/旧 owner fixture 尚处迁移期；简化 Ruby helper overlay 的 input/trace 为 `0c12e71e18e218c2` / `6214b892da466fb4`，与正式 owner overlay 不同，该试验接线已撤回。`characterAcceptanceCanonicalReplay.test.js` 中 Ruby 期望值已更新为正式 owner manifest hash，待最终全局派生产物刷新后统一运行。
- 产品边界没有改变：103002 `productVisualAcceptance=pending`、`optimizationReady=false`，唯一 blocker 为 `acceptance-product-visual-signoff-pending`。本批没有运行 full/trial-release/`release:verify`、formal admission 或任何搜索，也没有签收或复用旧截图。下一步仍是逐 owner/STARBORN 的真实 replay、Workbench/Playwright 视觉检查与独立签收；全部完成前不得刷新最终 release authority 或启动 Formal Search。

## 0.02 2026-08-12 17:05 正式 owner 技术闭合快照

- 技术批已由 `2409ce3e` 提交（`fix(m12-c): close remaining owner acceptance axes`），其直接父提交 `830504cd` 为 Ruby/103002 闭合。未跟踪的 `.readonly-ruby-probe.mjs`、`work/**` evidence 与 `stash@{0}` 均未删除、移动、暂存或改写。
- 107001 已按完整 A1→A2→A3 与 A3 来源化 reopen 重排：早段 critical/resource 探针使用真实 A1 命中，A2/A3 helper 命中显式 miss；第 8/9/10 点风语分别由 A1/A2/A3 合法取得，10 点阈值在继承风印 1200F 过期前完成。原 72F fresh A1 保留为 phase-conflict 负例，230F idle/reopen 才作为正向 fresh A1；Lumi 生命周期探针锚定真实 transform 动作 `window-inside-end`。
- owner-only profile overlay 只在 `inputToIndex=true`、明确 normal-attack、控制技/来源 identity/后继 segment 全部一致时，把 raw target subskill 投影到来源化后继 subskill；同时只补齐该 control/subskill 的已安装 hit identity，不覆盖已有相等集合。其他 owner 的 round-trip 交叉验证保持稳定；不可运行负例仅在 schema-valid、not-runnable、not-evaluated 的完整分类成立时计为合格，不放宽主场景或 stale-hit 校验。
- 当前正式技术矩阵全部零缺口：101010 `202/202`、102001 `108/108`、103002 `190/190`、107001 `80/80`、107002 `108/108`、108003 `134/134`、109001 `134/134`、112001 `184/184`、199001 `195/195`、199002 `195/195`；每个 owner 的 blocked/source gap/acceptance gap/functional failure 均为 0，headless replay、canonical replay 与 Workbench round-trip 全绿，且所有 `productVisualAcceptance` 仍为 `pending`、`optimizationReady=false`。
- 聚焦回归为 Machine Axis service、Sifliya runtime、verified action variant、action-rule diagnostics 共 4 files / `141/141 PASS`；`node --check scripts/generate-character-acceptance.mjs` 与 `git diff --check` 通过。为了技术诊断曾使用的 visual-evidence 环境旁路和 manifest 输出接线均已撤回，没有进入提交。
- 下一步只能在 `2409ce3e` 之后启动逐 owner/别名的全新 Workbench/Playwright 截图与人工视觉复核；199001/199002 必须作为同一个 STARBORN optimization object 做一致性裁决。旧截图/hash 仅追溯，不得复用或自动代签。全部真实产品签收前仍禁止 `release:verify`、formal admission 与任何正式搜索。

## 0.03 2026-08-12 owner / STARBORN 视觉待签快照

- 审阅基线为 `bda6696e07969b82445a922e19f3c9739a315dc6`。新建 `e2e/m12-c-owner-visual-review.spec.js`，对 101010、102001、103002、107001、107002、108003、109001、112001、199001、199002 串行生成精确 owner-only runtime package，真实导入 Workbench 并展开代表动作 canonical trace；10/10 Playwright 审阅 PASS。
- 证据位于 `work/m12-c/product-review/visual-evidence/2026-08-12/`：每个 owner/alias 两张全新 1440×900 PNG 和一份 `pending-explicit-user-signoff` JSON，共 20/20 PNG 尺寸与 SHA-256 复核通过。汇总入口为 `work/m12-c/product-review/OWNER_VISUAL_SIGNOFF.md`。
- 代表性闭合可见：Ruby E1=`10300201/sub1`；Sifliya A3=`10700103/sub4`；Misa A3=`10700203/sub0`；Gisele Heavy3=`11200141/sub3`。STARBORN 199001/199002 两别名分别真实导入并显示自身 A3 trace，但产品裁决仍按单一 STARBORN optimization object 联合签收，不能拆成两个对象。
- 首次裸 Workbench 导入 107001 被诚实拒绝为 normal-input missing，证明 owner overlay 并非全局默认包；正式审阅严格采用仓库生成器导出的 owner-only runtime package。审阅夹具第一次因关闭对话框后读取已卸载节点超时，冻结状态文字后复跑 PASS；107002 最初所选 ultimate 无直接 hit 行，改用配方明确验证的 A3 后在不放宽 hit 断言的情况下 PASS。
- 当前所有新 review 记录仍为 `pending-explicit-user-signoff`；recipe 未写入 accepted identity，STARBORN 旧对象级 accepted 记录未被沿用。等待用户明确签收前仍禁止刷新最终派生产物、运行 `release:verify` / formal admission 或启动任何正式搜索。

## 0.04 2026-08-12 18:46 owner / STARBORN 明确签收与派生闭合

- 用户明确回复：`签收全部 owner，并将 199001/199002 作为单一 STARBORN 对象联合签收。` 本轮 101010、102001、103002、107001、107002、108003、109001、112001、199001、199002 全部角色级记录已接受；199001/199002 的两份 alias 视觉证据同时只形成一个 `STARBORN` optimization-object 联合裁决。101003 不在签收范围，保持 pending/unready。
- 10 份角色 recipe 与单一 STARBORN object recipe 均绑定新证据提交 `13d28aa515312a63395f49ddff3c778967e1b20f`；角色 qualification subject 分别为 `6c361b4ae3dc61a8`、`4a34ddcb5e9904e5`、`a87a71c9f84966c5`、`4aa2a54123438a90`、`bd44ed4ae5bace66`、`c7c62aa773bdfba5`、`885f1095802cc741`、`aae0ae0f9ebc0700`、`42d43e9176435686`、`aaefedcae3ad61aa`；STARBORN object subject 为 `c94d6b6166226f10`、bundle 为 `7d47f4085c8a6214`。
- 全量 character acceptance 已一次写回：11 个 owner 中 10 个 runtime-integrated、visually accepted 且 optimization-ready；签收目标全部 blocker/source gap/acceptance gap/functional failure 为 0。未签收的 101003 诚实保留 41 blocked、13 source gap、34 acceptance gap、47 functional failure。optimization qualification 为 263/263、blocking unique gap 0、`m12cLocked=false`。
- 派生刷新暴露并关闭两个通用一致性缺口：assertion 的深层 `undefined` 在 JSON 落盘时会改变 hash，现统一先做 JSON 值归一化并有序列化稳定性回归；E22 显式请求全局 normal-chain identity 时，Machine Axis 只查 profile overlay 导致裸全局包 missing，现优先匹配 owner profile，缺匹配且链等于全局 chain 时才回退 verified `attackInputSegments`。聚焦回归 2 files / 40 tests PASS，E22 binding 22/22 PASS，visual acceptance 254/254 ready。
- 当前仍没有 release authority 或 Formal Search Admission；必须先提交本批，使 tracked tree clean，再按 handoff 只运行一次 8 GiB `release:verify`，独立确认 HEAD 稳定、formal admission 15/15 与 authority v2 live descriptor 后才能推送并启动全新搜索。所有既有 untracked evidence 与 `.readonly-ruby-probe.mjs` 保留，`stash@{0}` 未动。

## 0.05 2026-08-12 20:38 单次 release 失败与定向技术收口

- owner/STARBORN 签收批已提交为 `04e955e8c99118e3a255194f7f6cf0cc6ba4f619`（`feat(m12-c): accept owner visual evidence`）。在该 clean tracked HEAD 上依 handoff 唯一一次执行 `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run release:verify`；preflight 确认 HEAD/parent 稳定、tracked clean、untracked evidence 存在且 `stash@{0}=900e193bf710b8f894b50e0bc966db70cbd7e717`。
- 本轮 release 真实通过 character-combat、visual acceptance 254/254、E22 binding 22/22、Kibo headless 与 machine-axis settlement，随后在 `test:trial-release` 失败：247 个 Vitest files 为 215 pass / 32 fail，tests 为 1944 pass / 105 fail / 20 skip。`work/m12-c/gates/latest-release-verify.json` 保持 `status=fail`、`failureStage=test`，release record 为 `4b7afb2a5b81a4b7245efe6cf3202f5f0198e70fad1ee12a5b4a255fc3e89170`；不得将其改写为 release PASS 或 Formal Search Admission。
- 32 个失败文件均属于签收后陈旧 fixture/test/report 镜像，未通过放宽生产 runtime 修复：formal Machine Axis fixtures 与 E21/E22 镜像改绑当前 mechanics package `62906a98964fa5948c80519e4454a4c8056f841d620a4c40b959c725f1941fc8`；角色验收、canonical/headless hash 与 10 个已签 owner 状态同步，101003 继续 pending；历史非法 `m11-b-three-actor-120s.json` 未改。
- 普攻/魂质测试改用真实完整 A1→A2→A3/A5 链、合法 context/reopen 和可真实结算的技能资源；伪造 switch→charged 上下文改为明确要求 `VERIFIED_ACTION_CONTEXT_WINDOW_MISSING`，没有削弱 fail-closed。生产导入清单由 `npm run audit:production-imports` 原子刷新，仅新增本轮已进入生产可达图的测试/e2e 文件，`unexpectedTestOnlyCount=0`、`unreferencedCount=0`。
- 定向复验覆盖 release 原失败面全部 32 files / 598 tests：acceptance/data 12/116、Machine Axis 非 CLI 12/115、CLI 2/56、runtime 3/192、trace/import/Workbench 3/119，全部通过；其中 production-import report 首次只读检查诚实报告 drift，生成器刷新后自身 3/3 通过。另有 soul 全文件 125/125、Prettier 与 `git diff --check` 通过。一次 32 文件合并命令因工具 6 分钟上限被中止，其精确 Vitest 子树已回收，不计 PASS/FAIL，也未遗留进程。
- 严格遵守“只运行一次 release”：没有第二次 `release:verify`，没有生成 READY admission、没有推送、没有启动 Formal Search。下一步只能先提交本定向镜像收口；即使 tracked tree clean，当前 authority 仍为 FAIL，必须由后续明确裁决是否授权新的完整 release 建权。所有既有 untracked evidence、`.readonly-ruby-probe.mjs` 与 `stash@{0}` 原样保留。

## 0.0 2026-08-12 普攻链合法性纠正（当前最高优先级）

- 普攻输入是状态相关的输入意图，不是可以任意重复选择的 `A1` 动作。角色处于 `A1 -> A2` 连段输入窗时，再次输入普攻只能解析为 `A2`；处于 `A2 -> A3` 窗时只能解析为 `A3`，后续段以角色权威 transition graph 类推。
- 部分技能会打开角色专属的特殊续段窗口。窗口有效时，同一输入只能解析为该特殊续段；若调用方、排轴器或优化器试图回到 `A1`，必须在物化/评分前 fail closed。只有当前没有有效续段窗口、旧链已超时/完成/被合法取消时，普攻输入才允许新开 `A1`。
- 同一版本化 continuation state 必须由无头 runtime、Machine Axis compiler/service、Workbench 排轴投影和 search generator/beam state 共同消费，并进入 canonical input/trace、axis/result identity、状态合并键、循环边界和击杀 proof；不得在任何一层维护第二套猜测规则。
- 循环闭合必须证明链状态也闭合。仅有一次 `A1` 且终点仍处于 `A2` 输入窗的 `[0,18)` 不构成可重复循环；击杀轴不得把连续 LMB 输入全部重新解释为 `A1`。非法、skipped、unresolved 或 continuation-state 不闭合的候选一律不评分。
- 旧 run 原地保留用于追溯，不删除、不移动、不续跑；新的实现必须使用新合同版本、新 authority/hash 和新 run id，从旧 checkpoint/finalization fail closed。
- 单一权威已由 `bc30f03e5ccfce14e98edcc13495779ee6174f51` 落库：`verifiedNormalAttackInputAuthority` 从 verified mapping adjacency 生成 hash-bound structural form；末音 A1 的 17/18/72/73/229/230F 分别为 locked/successor/recovery/idle，A5 reopen 与特殊续段另有精确相位。
- runtime 接线提交为 `dc952acc686e4b147b1255ac2aa071fbc65aafc5` 与 `9c4b0c56e121ef7436e1c9b523d3830939688df6`：错误的显式 A1/new-group 不能绕过相位，generic 单输入物化真实后继；同 group 的合法多轮连段按 reopen/idle 分实例，不能误合并或重置相位。核心 authority/runtime/action-rule 聚焦为 3 files、86/86 PASS。
- Workbench live 输入由 `bfd0b9f8f5d8576b09c41b2829b696edadd86ff3` 改为一次 click/drag 只物化一个精确输入，优先级为 special/context > successor > idle A1；缺失、多义或资源不足时零插入。迁移后的 Workbench 完整单文件为 109/109 PASS，M11-C 定向真实浏览器验证由 `861445b02d59e7ed33af7f9229003fe4301429a5` 通过。
- Machine Axis service、canonical core 与 action-legality proof 已统一投影 authority descriptor、结构化 form/expected/actual 证据，并拒绝错误 sequence；新的 `m11-b-three-actor-authority.json` 取代共享消费者中的旧 standalone-A3 baseline。旧 `m11-b-three-actor-120s.json` 保留为必须失败的历史反例，不删除、不覆盖。
- 当前中央聚焦复验：service 20/20、canonical core 15/15、Workbench 109/109；authority consumer 收口后的 acceptance/adapter/axis-boundary 合并集为 3 files、45/45 PASS，CLI/batch 示例已迁到 authority fixture。搜索/优化器已由 `dfadb9e8`、`70c2363d`、`959d6be4` 串行集成并以 9 files、114/114 PASS 复验：拒绝 `[0,18)` 单 A1 循环、允许 `[0,230)` 恢复终点闭合，Ruby 强化续段保留弹药缺口证明；旧 fixture 仅作为 service 明确负例。artifact/resume/finalization/pointer/closeout 现统一对 repo live descriptor 做全字段稳定比较，同 hash 伪造字段的负例已通过；最终独立复核、派生产物刷新与单次 release 准入尚未完成，因此 `optimizationFormalScoreReady=false`，不得启动新搜索。
- 角色签收输入的技术迁移已由中央 `c6afa94a`、`da4aa093` 合入：10 份原 accepted recipe 全部先降为 `pending`，历史 `scenarioIdentities` 与 `automatedEvidence` 原样保留，签收身份字段显式清空；没有据测试或 hash 自动续签。107001 的 19F fresh A1 已从正向场景移为 `VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT` 负例，20/71/72F 正向边界保留；107002 恢复 A3/A4、critical、miss/pickup 原产品探针并补齐真实 A1→A2→A3/A4 前驱。当前仅建立待签技术基线，production structural authority、逐 owner replay/截图人工复核与新 acceptance 记录仍未完成。
- production structural authority 已由中央 `2b8f50d40f4afeb0498bb780db50bb9e78952420` 合入：normal-input authority 升为 policy v2，live contract hash=`530396bf773cc439`，结构形态按“已验证 graph，否则唯一 mapping reachable prefix”解析，旧 v1/hash=`780cb44a08c522eb` 的 admission/artifact 必须 fail closed。action-legality proof 同步升为 schema v2；结构上可排程但 mechanics 未解析或产生 `DAMAGE_SKIPPED` 的 carrier 会保留 `passed=true` 供 acceptance 观察，但 `finalScoreEligible=false`，formal primary service、cycle、kill 与 search 均不得评分。109001/112001 完整 mapping 链、112001 A4→heavy3、107001 19/20/71/72F、107002 A1→A4 structural carrier 与 STARBORN 199001/199002 verified-empty A1 均有聚焦覆盖；中央独立复验为 authority/service/cycle/kill/admission 5 files、98/98 PASS，verified-empty/runtime 2 files、9/9 PASS。角色重放、视觉复核和新 acceptance 记录仍未完成，不得据此启动搜索。
- 结构权威独立审查暴露的三个评分前漏洞已由中央 `def7f0a4fd75893ba0c336f9575962c6f8ea0d76` 关闭：STARBORN verified-empty A1 只能作为普通连段时序 carrier，`contextReady=false` 且不得触发特殊 context、资源、被动、切人或 companion 通道；primary search 在计算 metrics/contributions/heuristic 前即要求 `actionLegalityProof.finalScoreEligible=true` 且 `scoreExclusions=[]`；formal admission 会重新加载仓库 live normal-input descriptor 并做全字段稳定相等比较，任意同形伪 hash/改字段均 fail closed。红测为 69/73（4 个目标失败），修复后关联集 7 files、120/120 PASS。米砂 107002 的 A1/A2 mechanics 缺口随后在独立工作树从既有 MonoBehaviour 命中源补齐 scoped runtime policy：A1 为 `10/13F` 两个真实伤害事务，A2 为 `29/29/32/32/57/57/63/63F` 八个真实事务；A3/A4 保持既有权威，A5 继续 unresolved/fail closed。中央 `2c86cc4b` 合入后，错误 subskill、缺失/多义 segment 与伪 context identity 仍被 package/runtime 拒绝；`fbedb09b` 又修正了 package-hash 重绑和测试 context-edge identity，STARBORN/Misa/Machine Axis 关联集 4 files、135/135 PASS。当前 verified mechanics package hash=`8334e22113e45ce29b5d20828a3a13e36e8de3d8ff3f8afb02e0bcbe9d353fa2`；全部角色 fixture、派生报告与产品视觉仍须在最终集成 HEAD 重放和重新签收，不能只做字符串换 hash。
- 107002 projectile source closure 已在中央主线完成：profile recipe 只对 `10700201/sub0`、`10700202/sub0` 且 `scenario-assumed-zero-distance` 的十条 runtime-dependent projectile source record 做精确 `applied` 闭合，没有 blanket promotion；A1 `2` 包、A2 `8` 包逐条保留 raw identity。107002 acceptance 轴把八组 critical 探针改为相隔 `600F` 的合法 A1→A2→A3 链，主轴和 miss/pickup 轴补齐 A1→A4；正式 owner 结果为 requirement `191`、required/pass `108/108`、N/A `83`、blocked/source gap/acceptance gap/functional failure 全 `0`，headless/canonical/Workbench 全绿。A1→A4 的 `actionLegalityProof.finalScoreEligible=true`，不再因弹道或变体 unresolved 被排除；A4 的减防若跨 cycle 边界未闭合仍会按状态门禁拒绝，A5 仍 unresolved。当前 verified package hash 更新为 `62906a98964fa5948c80519e4454a4c8056f841d620a4c40b959c725f1941fc8`；全包 validator `18/18` 且 `audit:verified-combat` clean。107002 产品视觉仍为 `pending`，唯一 blocker 为 `acceptance-product-visual-signoff-pending`，不得据技术闭合自动签收。
- 101010 acceptance 技术轴已在当前主线按同一 authority 重放：三个 fixture 全部绑定 verified package `62906a98964fa5948c80519e4454a4c8056f841d620a4c40b959c725f1941fc8`，孤立 A4 探针补齐同 group/context 的 A1→A2→A3→A4；charged-input 四个边界分别以 `-200/75/99/100F` 证明窗口外默认 `10101010/sub0`、窗口内 `10101010/sub1`、右边界恢复默认，`74F` 的 source 占轴冲突作为 `action-lane-overlap` 负例保留，未伪造正向输入。owner generator 为 requirement `383`、required/pass `202/202`、N/A `181`，blocked/source gap/acceptance gap/functional failure 全 `0`，headless/canonical/Workbench 全绿；主轴 canonical input/data/trace/evaluation hash 分别为 `b8f9391bf6c8d0ed`/`48497e3ca2309f8a`/`1771ed0580495bd5`/`a753f6788d66964d`。产品视觉仍为 `pending` 且 `optimizationReady=false`，唯一 blocker 为 `acceptance-product-visual-signoff-pending`；历史截图元数据只作追溯，未续签。
- 112001 的 acceptance 普攻链已由中央 `414f942844ad0aa76a58792e2ee05e93c84e9800` 与 `3ac522933b672da03856c73196c5fad2c33445a4` 收口：主轴在原 Heavy3 绝对帧前补齐同 group/context 的 A1→A2→A3→A4，66/68F release 边界用独立完整链保持原 sub2/sub3 结论；5% 暴击的六个独立 A1 探针迁到 `0/230/460/690/920/1150F` 的真实 idle 边界，保留 499/500、expected、forced critical/non-critical、miss、统一 hit identity 与无资源/效果副通道。owner overlay 生成结果为 184/184、0 blocked/source gap/acceptance gap/functional failure，中央专用复验 5/5 PASS。产品视觉仍为 `pending`，旧 fixture hash/截图不得续签；必须在最终集成 HEAD 重新导入 Workbench、查看 trace 并生成新签收记录。
- 109001 的 acceptance 正向轴已由中央 `a2639485681ddb4697f108fcc2d1d05860de376c` 与 `8f9c8344ed488866fcd9c873ca7f8f263e44dc40` 重建：显式 500057 signature 合法预置首层印记，五轮 limit-counter + 完整 A1→A5 逐轮证明 A4 `1→0/2→1/3→2/4→3/5→4` 与 A5 x2 source `0→2/1→3/2→4/3→5/4→5`；held 严格锁定 `[3515,4045,4356,4667,4978]F`、伤害 `[158,316,473,631,789]`，首层到 held 为 `300F=5000ms`，最后 refresh 到 expire 为 `1200F=20s`。四个独立 window fixture 分别证明 39/78F 回到默认 A1 并闭合完整链、41/76F 只选择 10900143；critical 499/500 与 attr7/attr8 两层增量 `2×43/2×86` 保持。末音专用 qualification 7/7、canonical replay 1/1、owner generator 134/134、Workbench DOM 1/1 均通过；产品视觉仍为 `pending`，旧截图和旧签收 hash 未复用。
- STARBORN 的 genuine context continuation 运行时已由中央 `2c9230161d10d34a7aca09dc2e312e75cd4193d2` 接通：charged `10/sub1` 或 star `12/sub0` 的普通输入先于默认 chain 消费 graph context edge，物化 public `03/sub1` / execution `01/sub1`，再允许同 actor、同 group 的 A3；missing、ambiguous、跨 actor、错 group/sequence/target 及缺 input identity 均 fail closed，verified-empty A1 仍没有特殊 context 通道。独立审查随后发现 caller 可伪造 `verifiedContextContinuation` marker，中央 `1c3d36144d721afb853de6ddab91daa84720bfb4` 已改为先清 raw marker、只为 live verified selection 派生并以模块私有投影身份证明；外部 axis 自签反例已关闭，中央与独立复验均为 4 files、132/132 PASS。199001/199002 acceptance fixture 和产品视觉仍待迁移、重放与重新签收。

## 0. 2026-08-11 中央集成快照

- `M12-C1/C2` 已接入生产路径：28 个队伍对象、35 个来源配置、STARBORN 单一优化对象/双互斥别名、lazy build generator、固定培养/装配资格投影、`buildHash`、headless service 和 CLI 均已实现并通过回归。
- `M12-C3` 已实现 objective-scoped initial-state preset、canonical hash 和 formal authority 校验；循环轴与击杀轴白名单均 fail closed。
- STARBORN 最终合同为：星决技对 action-start 已存在的每一种印记分别 `+1`，星携同样 `+1`，逐种 cap 5；无印记不创建，`199001/199002` 不双计。`+2` 仅保留为必须失败的负向测试。
- M12-B3 optimization qualification 为 263/263：角色 9/9、奇波 43/43、灵子 62/62、装备 137/137、套装 12/12；`blockingUniqueGapCount=0`，`m12cLocked=false`。E22 binding matrix 为 22/22。
- 当前权威 hash：verified mechanics package `fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58`；roster `8f79e3260a1bd756`；manifests `e76c15a97197b559`；ledger `2173684e22b4ad5c`；qualification binding matrix `2f38f4d3ef1a95ce`；qualification catalog `6476cfbe9e49fcd5`；E22 report `86f1d0af5c870cb6`。
- 全量门禁：`test:full` 228/228 files、1877/1877 tests；确定性聚焦集 16 files、166/166 tests；Workbench production preview 64/64；最终 `test:trial-release` exit 0。production build、Workbench data、action status、applied-source、Kibo headless、production imports、bundle、binding matrix 和确定性审计均通过。
- `clientParityReady=false` 仍由已验证 mechanics/profile evidence 明确保留；它与 optimization qualification 全绿是两条独立状态，禁止混同。
- 2026-08-11 用户明确签收单一 STARBORN optimization-object。正式 recipe/manifest 已更新为 `productVisualAcceptance=accepted`、`formalAdmission=true`、`optimizationReady=true`，acceptance subject hash=`c645f8836bf6fd0a`、bundle hash=`3338e8e57a632564`；签收绑定到基线 HEAD `76605d759376a93a2981fc27f2fa18e3464b17f7`，后续证据漂移不得自动续签。既有 `199001/199002` 角色级 accepted 记录保持原样，本次没有把一个对象拆成两次签收。
- 正式 M12-C 搜索、三个 objective 的 Top-N 和产品结论均尚未运行/生成；下一实施阶段仍是 `M12-C4`，不得把上述门禁通过数冒充搜索结果。
- GitHub 发布前对 `origin/master..master` 的 849 个未发布提交执行了单路径 Git LFS 迁移；完整 old SHA → new SHA 映射见 `work/m12-c/lfs-migration-object-map-2026-08-11.csv`。10 个既有 accepted 记录的原 `acceptanceCommit` 与 `recordIdentity` 均保持不变，映射仅用于迁移追溯，不构成自动续签。

## 0.1 2026-08-11 Gate V2 实施基线

- 新增 `npm run test:smart`：按 working tree bytes 计算 dependency fingerprint，支持 `--base <sha>`、`--plan`、`--integration`、`--explain`、可重复的 `--simulate-change <path>` 和 `--json <path>`。Unknown change 一律升级为 `test-full`、M12-C determinism 与 production-imports，不会输出“无需测试”。
- 新增 `npm run release:verify`：只接受 clean tracked tree；不删除 untracked evidence，不 stash/pop，不切分支，不修改产品 acceptance。它真实执行未被 trial 覆盖的 M12-C 附加 gate，再真实调用一次保持原样的 `test:trial-release`，最后复核 HEAD、tracked tree 与 stash 未变化。
- `scripts/gates/gate-definitions.mjs` 是单一 dependency map；fingerprint 包含 gate schema/version、dependency-map hash、runner hash、相关环境合同、canonical path 与当前文件内容 SHA-256。README/STATE/普通 docs 不会使 full/bundle/preview/qualification/binding 指纹失效；production/test/script/config/fixture/generated authority 改动按域失效。
- `work/m12-c/gates/gate-ledger.json` 只作为 derived cache。记录区分 `executed` 与 `reused`，保留真实 command、exit code、duration 与可解析 summary；FAIL、timeout、OOM、cancelled、interrupted、输出不完整、解析失败和 fingerprint/schema/version mismatch 永不复用。pending 记录、原子替换和带 stale 检测的进程锁用于崩溃/并发恢复。
- Release 内部 stage 的原始记录只保留执行审计，不直接成为 reusable PASS。只有最终 `release-verify`、formal admission 与全部 stage 投影在同一原子 ledger 事务中提交后，且投影与真实 source record 在 HEAD、working-tree fingerprint、dependency fingerprint、gate definition version、runner/schema authority 上闭合，planner 才允许复用；失败、中断、stale 或旧式无 release 背书的 stage 记录一律拒绝。
- Bootstrap 规则：旧 HEAD 的 release PASS 不转移给本次 scripts/tests/config 变更；只有本实现所在最终提交的真实 `release:verify` PASS 才允许后续 smart reuse。每次动态结果以 ignored 的 `work/m12-c/gates/latest-*.json` 和 ledger 为准，不在本 tracked 状态文件手写可漂移 PASS。
- `formal-search-admission` 不以 release PASS 自动推导 READY。STARBORN optimization-object 的产品阻断已由用户显式签收解除；2026-08-11 的新产品裁决把 43 只 admitted Kibo 的 71 个 autonomous surface（43 普攻、28 主动技）整体延后并移出排轴、优化和评分。准入现在校验版本化 `m12c-kibo-axis-action-scope-v1`、qualification/action-catalog/scheduler/search-generator authority 与 43/71 覆盖，不再要求一个虚构的 cadence readiness proof。`clientParityReady=false` 继续单列，不回锁已通过的 headless formal-score 基线，也不被自动提升。
- 本改动只优化验证编排，没有启动 M12-C4、没有生成 Top-N、没有代签产品验收。提交前最终 Integration checkpoint 已在当前 working-tree bytes 上通过 `239/239` files、`1943/1943` tests（`NODE_OPTIONS=--max-old-space-size=8192`）；该记录不是 release authority，最终 clean HEAD 的 `release:verify` 结果仍须在交付报告中与 Development/Integration 分层列出。
- 首次 clean HEAD `release:verify` 在 5 个附加 gate 全部通过后，于原始 trial 的全量段因两个保持默认 5 秒预算的重型测试超时而失败（`237/239` files、`1941/1943` tests）；失败台账未写 PASS，`&&` 链未进入后续 audit/build/preview。两个用例的断言与覆盖保持原样，仅把各自显式预算调整为 30 秒；修复后只跑对应 targeted regression，再直接重跑完整 `release:verify`。
- 第二次 clean HEAD release 的 5 个附加 gate 仍全绿，trial 全量改善为 `238/239` files、`1942/1943` tests，但同一 production-import CLI 文件中另一个多次启动全图审计的用例在默认 5 秒预算下耗时 5.58 秒。策略改为给该文件 3 个真实 CLI 集成用例统一设置 30 秒 per-test budget，不再逐个追赶；所有 canonical byte、只读、tamper、missing-output 和 mtime 断言保持不变。

## 0.2 2026-08-11 外层池正式接入搜索

- 新增生产服务 `src/machine-axis/m12cOuterSearchService.js`，把权威 28 队/35 source config 的 lazy build pool 接到既有 `machineAxisSearchEngine`；每个 build 原子尝试三名队员作为初始前台，候选经同一 formal `machineAxisService.prepare` 后才进入内层搜索，最终按 objective 聚合单一全局 Top-N。
- 每条结果保留完整 `buildHash`、`poolHash`、队伍/来源配置、固定培养、奇波/灵子/五件装备、初始前台和正式 axis。初始前台仍不进入 `buildHash`；外层 variant budget 不足 3 时不会执行半个 build。初始 SP/专属资源若不属于当前 build 会直接拒绝，不会静默丢弃。
- CLI 新增 `m12c-outer-search`，AI-guided runner 支持 `--outer`、外层预算和 initial-state 输入。外层 guidance 可独立控制 source/build/variant 范围，不会把 outer-only beam/action 策略泄漏到内层。
- 报告严格区分 bounded-domain 与完整池：只有 35/35 source config、无 build constraints、无动态外层剪枝、全部 build 枚举完成、零失败且 Top-N 全部 final-score eligible 时，`formalRankingReady` 才能为 true；受预算/约束的样本不得冒充全池正式榜单。
- 真实一 build/三前台冒烟已在新范围下进入真实 inner engine：不再产生 `kibo-auto-cast-schedule-unresolved`；两条前台 variant 产生候选，一条仅因循环动作/状态未闭合而为空。43 只合格奇波的 71 个自主动作仍完整保留在证据普查中，但不再生成、排程或评分。
- 本阶段最终验证：outer/build/guidance/CLI 聚焦集 4 files、76/76；search/service/objective/C3 兼容集 6 files、60/60；`machine-axis:build`、production `build`（1900 modules）、`audit:production-imports:check`（unexpected test-only 0 / unreferenced 0）和 `audit:bundle:check`（3 项预算均 true）通过。Gate V2 仍有并行未提交 tracked 改动，因此本阶段没有把旧 `test:full`/`test:trial-release` 结果冒充当前 dirty tree 的新 release 证明，也没有运行要求 clean tracked HEAD 的 `release:verify`。
- 正式 M12-C 搜索仍未启动。下一搜索前需在最终 clean tracked HEAD 上完成本次范围变更的 Gate V2 `release:verify`；在此之前不得生成或宣称三个 objective 的正式 Top-N。

## 0.3 2026-08-11 奇波自主动作产品延后

- 当前只计算奇波特性技（`signature`）、合击（`break`/joint attack）与已验证被动；奇波 `normal-attack`、`active` 不进入 Workbench 动作库、Machine Axis、搜索候选、自动调度或伤害评分。
- `src/domain/kiboAxisActionScopePolicy.js` 是单一版本化范围合同。Machine Axis catalog 仍发布全部来源动作和顶层 scope policy，可据动作 kind 确定性分类；显式输入自主动作时以 `machine-axis-kibo-action-product-deferred` fail closed，不能借手写项目或旧 fixture 绕过。
- `kiboAutoCastScheduler` 只生成可审计的 `scopeExclusions`，不再生成动作、trigger/schedule exclusion 或 runtime registry。若未来恢复奇波 AI，必须发布新 policy 版本并闭合行为树、优先级、初始延迟、重施 cadence 与触发 authority，不能只改 guidance。
- `formal-search-admission` 直接核验 43/43 奇波、71/71 deferred autonomous surfaces、43/43 signature 和 43/43 joint-attack surface，以及 policy/catalog/scheduler/search-generator hash；这证明“范围已应用”，不声称自主 AI 已实现。
- 本节不改变 Kibo source catalog、verified mechanics package、静态培养属性、SP、大招、合击或被动运行时，也不启动正式搜索。
- 当前工作树全量 Vitest 为 240/240 files、1936/1936 tests；聚焦范围回归 11/11 files、125/125 tests。production build（1901 modules）、Machine Axis CLI build、bundle 三项预算、production imports、Workbench data、action status、applied-source、Kibo headless、optimization scenario/qualification 与 E22 binding 22/22 均通过。
- 去除 autonomous derivation registry 会改变部分既有验收轴的 canonical input/data/trace identity，即使伤害评价不变；例如 107002 的 evaluation hash 仍为 `5238bf8119e66446`，但 input/data/trace 已变为 `30780d8354ecceaf` / `9167d13d5bd46dc0` / `9d108c00b14b69ae`。代码回归常量已同步，产品记录没有由自动化静默续签。
- 最终签收范围按完整 M10/verified golden 输入重算：101010、102001、103002、107001、107002、108003、109001、112001 的 acceptanceCommit/recordIdentity 均由用户明确签收到范围实现基线 `be60e68d1c1bcf77a962426ddb0af37fc384c4da`；199001、199002 未漂移并保留既有签收，101003 继续为 pending。原截图 SHA 与场景身份均保持不变，自动化没有代签。
- 严格 `audit:character-acceptance` 已恢复 clean：11 runtime-integrated、10 visually-accepted、10 optimization-ready；qualification 仍为 263/263、E22 binding 22/22、visual acceptance 254/254。
- clean HEAD `50e292dd91423e05c25b8e1f99eb21d589f5e505` 的首次 `release:verify` 在首个 `character-combat` 阶段正确拦截 7 份旧 golden trace（101003、101010、102001、103002、107002、108003、109001）。全量原子同步后实际 diff 仅为这 7 份 trace 的 input/trace/data/build hash；verified mechanics package 仍为 `fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58`。后续实证表明 golden 自身也是签收输入，不能据 package hash 不变推导“无需重签”。
- clean HEAD `5700680f5359095ba7a3db5501baf79a7000b14f` 的第二次 `release:verify` 已通过 character-combat、visual acceptance 254/254、E22 binding 22/22、Kibo headless 122/448 与 machine-axis settlement；trial-release 全量 Vitest 为 239/240 files、1933/1936 tests，唯一失败是 `characterCombatHeadlessMigration.test.js` 中小玉、红宝石、寒悠悠三组仍指向同步前 golden hash。仅同步这 12 个测试镜像常量后再运行 clean HEAD release，不改变 runtime 或产品签收。
- clean HEAD `ca1b5bef19a22c4c754163a86a5baa3dad69f816` 的第三次 `release:verify` 已达到全量 Vitest 240/240 files、1936/1936 tests，并通过 production imports、Workbench data、action status；随后 `audit:verified-combat` 正确拦截不属于常规 character-combat 发布集的 `101003/ultimate-controlled-buff-switch-golden.json`。verified-combat 原子同步的实际 diff 仅为该文件四个 canonical hash，mechanics package 仍为 `fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58`；后续必须单独核验 golden 参与的角色签收输入，不能只凭 package hash 推断无需重签。
- 用户要求停止从头重复全量并从断点继续；`a16f82f4d73e6b63bde1d0615c75bbcc5e5ef508` 上 `audit:verified-combat` 已 clean（18/18 validator），optimization-scenario 也 clean。后续 character-acceptance 首先暴露常规 M10 golden 属于 qualification subject 输入，因此对 101010、102001、103002、107002、108003、109001 做同一产品基线的第二波重绑；107001、112001、199001、199002 保持 verified，101003 保持 pending。
- 断点续跑最终结果：签收聚焦 6 files/76 tests PASS；character acceptance 11 runtime-integrated / 10 visually-accepted / 10 optimization-ready；qualification 263/263；E22 22/22；visual acceptance 254/254；production build 1901 modules；bundle 总 JS gzip 897786 bytes 且三项预算全绿；applied-source 3/3；production preview 42/42 capabilities、64/64 tests PASS（637911ms）。Playwright 写出的 101 份非确定性 PNG 已恢复，未改写角色截图 SHA；只保留 `reports/production-preview-acceptance.json` 作为本次 64/64 证据。
- 全量 Vitest 240/240 files、1936/1936 tests，以及 production imports、Workbench data、action status 的证据来自 `ca1b5bef19a22c4c754163a86a5baa3dad69f816` 的第三次 release 执行；其后改动仅为 verified/golden 镜像、签收 recipe/派生产物、测试常量、报告和文档，并已按影响域做上述聚焦与断点门禁。依用户指令没有再次从头执行 `release:verify`，因此 Gate V2 台账中不存在当前最终 HEAD 的单次 release PASS，`formal-search-admission` 仍不得伪造为 READY；正式搜索继续未启动。

## 0.4 2026-08-11 AI 引导 Top-N 产品裁决

- 用户明确裁决：面对约 `80396186388671058977832111` 个合法 build 的完整装配空间，M12-C4 不要求证明全局最优；由 AI 通过版本化 guidance 主动选择外层样本、动作过滤、beam/depth、等待/切人策略和迭代预算，目标是在可用算力内找到尽可能优的三个独立 Top-N。
- 所有结果必须标为 `AI-guided heuristic Top-N`，并保留 `guidanceHash`、provenance、来源/构筑覆盖、预算、seed、拒绝分布、closed-cycle/killed proof 与迭代链。`fullPoolEnumerationComplete=false` / `formalRankingReady=false` 是诚实的全池非穷举声明，不再作为“能否执行 M12-C4 AI 引导搜索”的阻断，但不得改写为全局最优、穷举完整或客户端一致。
- 搜索按多轮反馈闭环推进：先覆盖 35/35 source config 的低预算基线，再由 AI 扩大高潜构筑和动作深度；使用独立 seed/策略复核，直到 Top-N 身份和分数改善在连续轮次中稳定，再进入 M12-C5 Workbench 人工复验。任一候选仍须先通过既有 qualification、binding、legality 和 objective proof，AI 不能让 illegal、skipped、unresolved 或 blocked 候选进入评分。
- clean HEAD `07f7989860e3797e9bdde2660c1e6c752a06efb4` 的单次 `release:verify` 已通过 character-combat、visual acceptance、E22 binding、Kibo headless 与 machine-axis settlement；trial 全量为 241/242 files、1953/1954 tests，唯一失败是新增两份 gate 测试尚未进入 `reports/production-import-audit.json` 的 canonical file list。生成器同步后实际审计为 `unexpectedTestOnlyCount=0`、`unreferencedCount=0`；按用户“不再反复跑全量”的要求，仅复验该派生报告与对应单测，不把失败台账伪造为 PASS。

## 0.5 2026-08-11 Gate V2 并发污染处置

- clean HEAD `df94157eb91722fd8b72343c84c55d2e335b69bd` 的 release trial 已真实通过 242/242 Vitest files、1954/1954 tests、全部 assert-clean/build/bundle 审计与 64/64 production preview；静态 runner-output policy 随后恢复 101 个 tracked 试跑输出，tracked tree 回到 clean。
- 该轮不能记为 release PASS：验证期间另一个并发流程提交 `03d5e55a2fc4de14d488abc871b5579293aa4e0f`，postflight 检出 HEAD 从 `df94157e` 漂移到 `03d5e55a` 并按规则 fail closed。全绿 trial 只属于旧 HEAD，不能转授给新 HEAD。
- 同一并发流程在 release authority 建立前启动 `node scripts/run-ai-guided-search.mjs --outer --contract work/m12-c/m12c4-search-template.json --guidance-file work/m12-c/guidance.m12c4.round1.cycle-no-toughness.json`。2026-08-11 23:09（北京时间）已终止核实的 Node PID 57568 及父 PowerShell PID 54684；未生成目标 feedback 文件。
- `work/m12-c/guidance.m12c4.round1.cycle-no-toughness.json` 与 `work/m12-c/m12c4-search-template.json` 作为 untracked 污染证据原样保留，不作为 release 输入、正式搜索产物或 Top-N 依据。只有新的最终 clean tracked HEAD 完成真实 `release:verify` 且独立 admission 允许后，才可重新授权搜索。
- clean HEAD `e9fe2cef1b0ee058111c23ad65a71c402fd40433` 的下一轮 release 同样真实通过 242/242 Vitest files、1954/1954 tests 与 64/64 production preview，但进入独立 admission 编排时，原生 Node ESM 无法解析 `kiboAxisActionScopePolicy.js` 中缺少 `.js` 后缀的 `canonicalSerialization` import；本轮记为 `interrupted/orchestration`，不记为 PASS。修复为显式 `.js` import，并新增由真实 `node.exe` 导入该 policy 的回归用例；最终 clean HEAD 仍须重跑完整 release。
- clean HEAD `89916a8f14e05b912ef1324b4ee6dbe95fe39d69` 的 release 已真实通过 242/242 Vitest files、1955/1955 tests 与 64/64 production preview；postflight 唯一漂移为生产 source 多出 `.js` 三个字节后应同步的 `reports/bundle-composition.json`。报告的 `kiboAxisActionScopePolicy.js.originalBytes` 从 5802 变为 5805，JS gzip 总量仍为 897786 bytes、三项预算全绿；独立重跑 bundle audit 后字节幂等。本轮仍按 postflight FAIL 记录，提交 canonical bundle 报告后重跑最终 release。

## 0.6 2026-08-12 M12-C4/C5/C6 正式搜索收口

- 唯一准入起点为已推送的 `master@baeb03489aa823d59981d60255af5b418aa48178`，现场确认 `HEAD == origin/master`、tracked tree clean；release record `5ae44c228b24bca4a2b8de189307547ea1252a8c21104edbf7bcb0af1fca0a24` 的 Formal Search Admission 为 READY 14/14、0 blockers。准入基线全量 Vitest 242/242 files、1961/1961 tests，preview 64/64、binding 22/22、qualification 263/263。本次 closeout 没有重复这些长门禁。
- 正式版本化根为 `work/m12-c/formal-search-v1/`，run 为 `runs/m12c4-moyin-top5-20260812-v1/`。准入前污染文件 `work/m12-c/guidance.m12c4.round1.cycle-no-toughness.json` 与 `work/m12-c/m12c4-search-template.json` 未被读取、续跑或纳入正式输入，`stash@{0}` 未改动。
- `M12-C4` 完成：三个 objective 都形成 5 个不同 raw identity 的确定性最终榜。无韧循环 Top-5 均为 `20797.9953003 HP DPS`，有韧循环均为 `469.50721728 HP DPS`，最快击杀均为 `66133.333333 ms`；cutoff ties 均完整保留。effective source coverage 三项目标均为 35/35；累计 round/shard 为无韧 10/79、有韧 8/77、击杀 6/61，failed/missing 全为 0。最新 finalization hash 分别为 `eb3cb1777b0aa8f8c46f9f223f0cb681bd1b7c36aeeaf2775a73b5aa054175f0`、`0ddbd25bb856b45ebabd541053aa51c517270d2059151ae3403cfd9ecdd9855a`、`134a48ee991927504e2f206048e6fde764a5566f37485fa5fa78917201943154`。
- preset admission 修复按 canonical projection/hash fail closed 扫描全部 objective/terminal round：隔离 2 个受 Ruby=0 污染的 raw identity、6 个 occurrence，并只重跑受影响必要 shard/terminal confirm；quarantine hash=`0bb833990380bd9ff5dbea2e5b3a1cd959bd2a8354e76ec3ab0986940acc2505`，replacement/repair evidence valid。cold cycle 明确拒绝显式 0 或伪装 Ruby 字段；fastest-kill 只允许 actor/Kibo SP=100、marks=[]，以及 103002 入队时唯一 `actor:103002:element:103002047` 的 12/12 弹药。
- `M12-C5` 完成：最终 15 个 `machine-axis.json` 均经真实文件选择器导入 Workbench 并逐条查看 timeline、动作检查器、trace 身份与摘要。结构化矩阵记录 15/15 import active、15/15 canonical trace match、15/15 individual screenshot、15/15 manual accepted，并为三个 objective 各保存 1 张直接可见“已导入 Machine Axis”和摘要/trace 的证据；见 `product-review/workbench-top15-visual-signoff.json` 与 `product-review/WORKBENCH_TOP15_SIGNOFF.md`。
- 真实导入发现 Vue reactive Proxy 不能直接 `structuredClone`。修复只对持久化 JSON-safe 合同字段在 `DataCloneError` 时使用 JSON fallback，普通正式输入仍保持原 `structuredClone` 语义；因此独立 Top-15 复验恢复原 hash `a5bf3e453572c37bd6b81a46d28f26e23144dba70ae9005872e75c98bed20f27`，15/15 valid、0 issues。fastest-kill 边界保持 220 动作未击杀且剩余 `2807.551112 HP`，第 221 动作在 frame 3968 / `66133.333333 ms` 首次致死，第 222 动作按 target-dead fail closed。
- `M12-C6` 完成：formal-search-v1 五个 node:test 文件 23/23；project factory + Machine Axis adapter 38/38；真实 Workbench Machine Axis import 聚焦用例 1/1；Prettier、diff-check 通过，ESLint 0 errors（2 条既有 unused warning）。overall closeout 连续两次得到 `3e67f6f08ee5457373c1c18952bc7611bff37f29f24b6c0c53d58c3fdcd2a8fa`，valid=true、0 issues、15/15 formal-score qualification、18/18 screenshot hash；见 `final-verification/overall-closeout.json` 与 `final-verification/OVERALL_CLOSEOUT.md`。
- bounded 停止只基于声明轮次的 Top-5 identity/score/family/cutoff 稳定与独立策略无新增 family：无韧使用修复后的三组 terminal confirm，有韧 round5/6/7 稳定并由 round8 coverage corroborate，击杀 round4/5/6 稳定且保持 4 families/3 cutoff ties。此停止条件不是 admissible bound、全局最优性或完整枚举证明。

## 1. 目标与结果身份

M12-C 在同一无头核心中联合优化队伍、装配、初始前台和动作轴，但必须把身份分层：

1. `teamIdentity`：三个优化对象及 STARBORN 的单一来源别名选择。
2. `buildHash`：队伍、别名、每个角色的奇波/灵子/五件装备、固定培养 profile、合法实例档、派生套装效果及全部资格/来源/binding hash。
3. `axisHash`：`buildHash`、初始前台、初始状态 preset、动作序列、连段/切人/奇波/合击状态和敌人场景。
4. `resultKey`：`axisHash`、`objectiveId`、敌人 profile/hash、暴击策略、时域或循环证明策略及运行时合同 hash。

初始前台不是队伍变体，也不进入 `buildHash`。优化器在内层动作轴搜索中尝试合法的初始前台；不同初始前台属于不同 `axisHash`。正式输入必须显式声明初始受控角色，禁止回退为队伍数组第一个角色，也不得在 0F 免费触发入场或离场星携效果。

## 2. 配队范围与合法性

- 每队恰好三个优化对象，必须包含 `109001 末音`。
- 另外两人从 `101010`、`102001`、`103002`、`107001`、`107002`、`108003`、`112001`、`STARBORN` 中选择，角色对象不得重复。
- `108001`、`111001` 不进入本阶段正式 roster。
- 队伍顺序 canonical 化；UI 槽位排列不形成新队伍。
- `STARBORN` 是一个优化对象。每条队伍/轴必须显式且只能选择一个来源别名 `199001` 或 `199002`，两个别名不得同时存在、共享资源或重复计数。
- 对象队伍共有 `C(8,2)=28` 种：不含 STARBORN 的 21 种，加含 STARBORN 的 7 种。计入 STARBORN 两个互斥别名后，共 35 个来源配置；它们仍只对应 28 个队伍对象身份。

## 3. 固定培养与装配搜索

培养条件是场景常量，不是搜索维度：

- 角色：80 级；星赐第 7 层，应用第 1..6 层已取得属性并全选第 7 层节点；`hero_rank` 不作为输入或数值来源。
- 奇波：80 级；四项天赋均 10 级并解析为 `120`；羁绊 1 级，按 9% 继承；`dnaFactors=[]`。
- 灵子：80 级、`rank=6`、`star=1`。
- 装备：四星、`+9`、同调 110，只生成来源合法的缘星实例。

每个角色恰好装配：

- 1 只来自 43 只 M12-B3 合格目录的奇波；
- 1 个来自 62 个合格目录、职业兼容或通用的灵子；
- 5 件装备，部位固定为武器、上装、下装、耳环和戒指。

全局装备资格分母仍是 137；在本阶段固定的四星 `+9/同调110` 缘星条件下，合法搜索池为 53 个四星基础 ID：武器 17 个，其余四个部位各 9 个。该 53 是 M12-C 固定培养条件下的候选投影，不得反向改写全局 137 件资格分母。

当前没有账号库存约束，因此：

- 不同角色可使用同一个灵子或装备基础 ID，视为相互独立的合法实例；
- 同种奇波可跨角色重复，运行时 CD、SP、被动和资源必须按 `actorSlotId+kiboId` 隔离；
- 单个角色内部仍必须满足部位、职业、实例档和唯一装配槽约束。

套装效果只能由五件已选装备派生，不能作为独立候选直接勾选：

- 2 件同套装启用一次两件套；
- 4 件或 5 件同套装启用一次两件套和一次四件套；
- `2+2+1` 可分别启用两个两件套；
- 5 件同套装没有两件套加四件套之外的额外层数。

跨角色同名灵子效果共享同一目标/effect identity，不因携带者不同而复制实例：

- `refresh`：层数保持 1，重复触发刷新绝对到期时间；
- `stack`：共享一个层数池和同一个上限；
- `block`：已有实例时拒绝重复应用，也不刷新持续时间。

正式搜索前必须保留跨携带者触发、切人、到期边界和保存重放的回归，证明手动排轴、批量评估和自动优化消费同一效果状态机。

装配层先生成并裁剪合法 build 池，再为每个 build 搜索动作轴。不得先按静态面板贪心选出一个装配后才排轴，也不得让非法或未闭合 build 进入评分；`illegal` 与 `unscoreable` 分开报告，但二者都没有分数。

## 4. 固定敌人与场景

三个目标都使用同一个标准敌人：`310054 雷冠牦`，80 级，标准模板 3。不得误用奇波 `500082`，也不得切换到高难或双 Boss 变体。

共同场景为 `m12c-zero-distance-passive-boss-v1`：

- 角色与敌人固定距离 0，默认不移动；
- 投射物按已冻结零距离规则立即命中；
- 敌人静止且不攻击；
- 所有倍率为 1.0，候选不得覆盖敌人属性；
- 三个结果族绑定同一个敌人来源和 profile hash，仅目标侧 HP/韧性政策不同。

## 5. 三个独立目标与 Top-N

三个目标分别运行并分别输出 Top-N，禁止合成权重分数或用一个榜单替代另两个榜单。`N` 是运行参数。

| objectiveId                | 正式目标                              | 敌人状态                                                    | 截止/闭环                               |
| -------------------------- | ------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `cycle-dps-no-toughness`   | 最大化闭环循环 HP DPS                 | 无限 HP；保留等级、防御和元素抗性；关闭韧性、Break 与其增益 | 非空半开循环区间和连续重放闭环          |
| `cycle-dps-with-toughness` | 最大化正常韧性结算下的闭环循环 HP DPS | 无限 HP；正常韧性、Break 与恢复                             | 非空半开循环区间和连续重放闭环          |
| `fastest-kill`             | 最小化首次致死完整 settlement cursor  | 有限 HP 与韧性；正常 Break                                  | 首次致死 cursor，之后事件截断或仅记诊断 |

排名候选是完整的“队伍 + 装配 + 初始前台 + 初始状态 + 动作轴”。同一 build 可以合法出现在三个榜单中；任何 UI 分组或同 build 折叠都不得改变正式 Top-N 顺序与结果集合。

候选只有在动作轴 legality proof、目标 proof、资格、来源和 binding 全部通过时才可评分。`illegal`、`skipped`、`unresolved`、`blocked` 均在评分前剪除，不能先算伤害再扣分。

## 6. 循环轴初始状态

循环轴允许用版本化 `initialStatePreset` 跳过重复暖机，但 preset 是一次运行的外部固定输入，不是优化器按候选自行挑选的变量。两个循环目标在同一比较批次必须使用同一个 preset；不同 preset 生成不同 hash 和独立榜单，结果不得混排。

循环 preset 可声明：

- 每个入队角色的初始 SP；
- 每个已装备奇波的初始 SP；
- 按来源化印记 ID 声明的队伍调谐印记层数；
- profile 中明确 `scenarioConfigurable=true` 的角色专属数值资源；
- 若未来允许有时限的角色专属状态，必须同时声明来源化状态身份和剩余时长，不能只凭一个资源数值推断状态已激活。

所有值必须属于当前 build，满足来源上限和 `inputStep`，越界直接拒绝，禁止静默 clamp。只给印记数量时，M12-C 规定这些印记在 0F 视为刚获得并拥有完整正常持续时间；改变该时钟语义必须升级 preset 合同。当前不允许把任意 Buff、召唤物、已生效场地、冷却进度或 pending event 当作暖机输入。

初始资源不得成为不可再生的一次性循环收益。循环 proof 必须至少闭合受控角色、角色/奇波 SP、印记层数与逐层到期、角色专属资源/状态、CD/充能/内部 CD、持续效果、pending event 和敌人边界；连续重放第二轮仍须合法且维持同一闭环状态。

## 7. 击杀轴初始状态

### 7.1 通用理论定义

击杀轴可带入战斗的初始资源，严格定义为：**允许所有在非战斗状态下能持久化保留、且不会随时间自行过期的资源，作为初始状态进入战斗。**

这一定义描述未来可扩展的资格原则，不等于本阶段要为每一种角色资源补做客户端证据。临时 Buff、调谐印记、倒计时状态、召唤物、场地效果、冷却进度和 pending event 不满足该定义。

### 7.2 M12-C 当前产品白名单

为控制证据与实现范围，M12-C v1 只开放以下字段：

1. SP：入队角色和其已装备奇波的 SP。允许使用满 SP preset；具体 preset 对整次运行固定并进入 hash，不能由单个候选自行选择。
2. 红宝石弹药：仅当 `103002` 入队时，可配置 `actor:103002:element:103002047`，合法范围为 `0..12`、步长 1。它是一次性的入场持久资源，切走再切回不得重填。

击杀轴的所有调谐印记固定为 0。除上述 SP 和红宝石弹药外，其他角色专属资源、形态、Buff、召唤物、场地、冷却和 pending event 全部固定为 0/未激活；M12-C v1 不为它们搜索客户端持久化证据。

白名单只限制可出现的字段，不允许候选偷选更有利的值。每次正式 run 必须先冻结统一的 `initialStatePreset`；不同 SP 或弹药值属于不同 preset/hash 和不同榜单。未来若要纳入其他符合通用定义的持久资源，必须由产品显式批准、升级初始状态政策版本并重跑全部结果，不能悄悄扩列。

## 8. 动作轴共同合法性

手动排轴、Workbench 导入、CLI、batch、三个目标的自动搜索和 replay 必须经过同一个无头 legality gate：

- 只有当前前台受控角色响应玩家输入；后台角色不能开始新的输入动作；
- 普攻后段必须由同 actor、同 chain 的已接受前段在右开输入窗 `[start,end)` 内派生；exact end、跳段、倒序、重复、跨 actor、切人后续接、blocked predecessor 和 context conflict 均拒绝；
- 切人后旧角色所属奇波不再开始新动作；只有已经物化的投射物或场地 tail 可按来源继续，未物化尾包无证据时 fail closed；
- 奇波普攻与主动技当前按版本化产品范围整体延后，不生成、不排程、不评分；特性技、合击和已验证被动继续经过原有 legality/runtime，恢复自主 AI 时必须升级 policy 并重新闭合 cadence authority；
- 合击必须原子生成完整双方动作，禁止半边合击、generic break、同帧或名字匹配冒充 trigger；
- 合击的当前产品合同是：有韧性敌人视为可合击目标；合击伤害本身不翻倍；同帧先结算伤害，再以附带削韧清空剩余架势并进入 Break；米砂相关触发由其奇波 40F 命中造成的破韧驱动；
- STARBORN 星决技必须对队伍当前已拥有的每一种印记分别增加 1 层，并逐种执行各自上限/刷新规则；没有的印记类型不得凭空创建，也不得跨别名双计。

上述合法性合同已由聚焦回归、canonical replay、Workbench production preview 和全量 trial-release 覆盖；产品视觉签收与 `clientParityReady` 仍按各自证据状态独立判断。

## 9. 实施顺序

1. `M12-C0`：冻结本计划、敌人 profile、三目标合同和 initial-state policy/version/hash。
2. `M12-C1`：实现并验证 28 个队伍对象、35 个来源配置、STARBORN 单别名和初始前台轴身份。
3. `M12-C2`：生成合法 build 池，闭合灵子职业、奇波隔离、五部位装备、套装派生、同名效果刷新/叠层/阻断及 build hash。
4. `M12-C3`：实现 objective-scoped 初始状态 validator；循环资源白名单与击杀轴 SP/红宝石弹药白名单必须有正反例。
5. `M12-C4`（完成）：三个 objective 已分别输出 bounded Top-5、proof、hash、贡献、拒绝原因、coverage、budget 与 terminal stability。
6. `M12-C5`（完成）：15/15 Top-5 已真实导入 Workbench，逐条人工复验动作、派生、资源、Buff、印记、Break、伤害曲线与 trace 身份并保存截图矩阵。
7. `M12-C6`（完成）：在既有 release/admission 全量基线上完成固定输入独立 replay、导入、cycle/kill proof、preset 白名单、截图 hash、聚焦 Workbench/adapter 回归与确定性 overall closeout；按用户要求未重复无影响域必要性的 full gate。

## 10. Admission 与当前边界

正式搜索前至少满足：

- 正式 roster 9/9、奇波 43/43、灵子 62/62、装备 137/137、套装技能 12/12 和 E22 binding matrix 22/22 已全部通过，formal admission 与核心 hash 一致；
- `101010`、`103002`、`107002`、`112001` 的既有产品视觉记录保持 accepted；单一 `STARBORN` optimization-object 已由用户在 2026-08-11 明确签收，自动化只校验并派生 manifest，不得自行撤销、续签或拆成两个 alias 记录；
- STARBORN 每种既有印记 `+1` 与合击结算合同已合入主线并通过无头、Workbench 和全量回归；
- objective-scoped initial-state validator 已落实，通用 scenario 字段不能绕过循环/击杀白名单；
- 三个 objective 的雷冠牦 profile、初始 preset、暴击政策和 runtime settlement 合同必须进入未来结果 hash；
- 43 只 admitted Kibo 的全部 autonomous surface 必须由版本化范围合同明确覆盖为 product-deferred；qualification/action catalog/scheduler/search-generator hash、43/71 分母、signature/break 保留面或分类任一漂移都会使 Formal Search `BLOCKED`；
- `clientParityReady=false` 不回锁已经通过的 optimization qualification，但也不能被 formal scoring 或测试通过自动提升；
- 正式搜索与人工 Workbench 复验已按 0.6 节完成；当前交付是 runtime-baseline 下的 bounded heuristic Top-5。`formalRankingReady=false` 与 `clientParityReady=false` 均保持，未来合同、权威数据或客户端证据漂移时必须重新 admission 并重算受影响结果。
