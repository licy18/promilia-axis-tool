# M12-C 末音配队、装配与动作轴优化计划

状态：`M12-C4/C5/C6` 的既有搜索结论已于 2026-08-12 撤回并重新锁定。正式 run `m12c4-moyin-top5-20260812-v1` 暴露普攻链状态机漏洞：连段输入窗内重复普攻被错误解析为新的 `A1`，因此 `0.3s` 单次 A1 循环、重复 A1 击杀轴及其 Top-5/finalization/replay/Workbench 签收/closeout 全部属于受污染历史证据，不得继续作为产品结果或新搜索 checkpoint。当前 `optimizationFormalScoreReady=false`、`formalRankingReady=false`、`clientParityReady=false`；只有无头核心、排轴器和优化器统一接入修正后的连段状态并重新完成准入后，才可启动新的 M12-C4 搜索。

已验证实现基线（迁移前身份）：`master@777af8f790986efab42de398fd2ef394610a9a77`；Git LFS 等价提交：`d4da771d726dce458f1c44425f8280a2c9f13598`。迁移只改变 Git 存储身份，不改变生成包工作树字节或实现语义。

本文件是 M12-C 的实施合同。`DEVELOPMENT_PLAN.md` 保留阶段摘要，实际实现、测试和产品复验均以本文件为准。实现与优化资格全绿不等于客户端一致性或产品视觉自动签收；未满足对应产品边界前，不得把 M12-C 搜索结果声明为已获产品验收。

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
- 结构权威独立审查暴露的三个评分前漏洞已由中央 `def7f0a4fd75893ba0c336f9575962c6f8ea0d76` 关闭：STARBORN verified-empty A1 只能作为普通连段时序 carrier，`contextReady=false` 且不得触发特殊 context、资源、被动、切人或 companion 通道；primary search 在计算 metrics/contributions/heuristic 前即要求 `actionLegalityProof.finalScoreEligible=true` 且 `scoreExclusions=[]`；formal admission 会重新加载仓库 live normal-input descriptor 并做全字段稳定相等比较，任意同形伪 hash/改字段均 fail closed。红测为 69/73（4 个目标失败），修复后关联集 7 files、120/120 PASS。米砂 107002 的 A1/A2 仍是独立 mechanics 权威缺口，当前只能结构验收、不能正式评分，已另开独立工作树追溯真实弹道命中与变体来源；不得把本次 pre-score 拒绝误写成该缺口已解决。
- 112001 的 acceptance 普攻链已由中央 `414f942844ad0aa76a58792e2ee05e93c84e9800` 与 `3ac522933b672da03856c73196c5fad2c33445a4` 收口：主轴在原 Heavy3 绝对帧前补齐同 group/context 的 A1→A2→A3→A4，66/68F release 边界用独立完整链保持原 sub2/sub3 结论；5% 暴击的六个独立 A1 探针迁到 `0/230/460/690/920/1150F` 的真实 idle 边界，保留 499/500、expected、forced critical/non-critical、miss、统一 hit identity 与无资源/效果副通道。owner overlay 生成结果为 184/184、0 blocked/source gap/acceptance gap/functional failure，中央专用复验 5/5 PASS。产品视觉仍为 `pending`，旧 fixture hash/截图不得续签；必须在最终集成 HEAD 重新导入 Workbench、查看 trace 并生成新签收记录。

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
