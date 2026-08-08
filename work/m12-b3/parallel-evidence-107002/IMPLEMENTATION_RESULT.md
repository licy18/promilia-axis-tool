# M12-B3-107002-S1 实现与验收结果

## 1. 结论与冻结边界

本分支以接受证据基线 `b900801af15ddf66378939dc3e00b3849512cacd` 为起点，在 `m12c-zero-distance-passive-boss-v1` 中实现米砂 `107002` 的缩减动作面。实现只消费冻结来源，不使用 `hero_rank`，Kibo DNA 保持 `[]`，不进入 M12-C 或正式搜索。

本结果是实现候选与聚焦运行时证据，不构成 visual admission、formal admission 或 optimization-ready。角色 report 继续保持 `characterComplete=no`、`simulationComplete=no`；所有仍缺来源的行为都保守关闭或结构化为 frozen-scenario N/A。

## 2. 机制到实现的映射

| 机制族 | 实现状态 | 关键实现/契约 | 聚焦证据 |
|---|---|---|---|
| A3 六 hit 造普通 HP pickup | required 已实现 | `pickupProfiles`、`pickupSpawnBindings`；仅 40/46/52/58/64/70F，`SummonTempData` 池 max6 | golden 精确断言 6 次 Target heal；miss 不 spawn |
| formula104 治疗 | required 已实现为通用 primitive | `verifiedBattleEffectFormulaRuntime.js` 解析 `common1/base=104`，以 source-owner MAXHP 求 3% | 单测拒绝 literal A 与 Target MAXHP；golden 路由只含 Target |
| pickup entity ledger | required 已实现为通用 primitive | `verifiedPickupEntityGeneration.js`；spawn、`spawn+2F` 碰撞开启、`[spawn+2,spawn+900F)`、一次领奖、稳定实体顺序、分池与保守容量拒绝 | 单测覆盖幽灵、重复、非友方、超半径、同帧多实体、右开到期与独立池 |
| A4/charged DEF | required 已实现，复用并扩展 target-state | 84F/76F hit-confirm；同帧 damage -> energy -> 物/法 DEF 各 -1000bp，Cover 24s，strict source sequence | 触发 hit 不反吃、后续 hit 生效；miss 不应用/不刷新；`[t,t+24s)` |
| 星鸣主动作与印记 | required 已实现 | public `10700212` 映射 execution `10700226/sub0`；74/82/90/99/107/114F；82F 候选 `[550,750]` consume 后 inject；90F 独立 +750 | 无候选时无 consume/inject；90F 不能支付 82F；成功 buff 的 source sequence 晚于 consume |
| 星鸣 SP 与成功 buff | required 已实现 | 前四 hit 生成 SP pickup；collision Target + direct-SP ShareAll；成功仅 self 获木/风伤各 +5% 30s及对应 overlimit | Target/ShareAll 不外推 heal/buff；第三次无候选 replay 保持 fail-closed |
| 星决与星携团队治疗 | required 已实现 | raw direct-effect route：星决 135F HP×3 后 SP×3，143/155/167/181/193F AllHero heal，144/150F +木印；星携 46/61/79/98F AllHero heal | golden 分别断言 Target、ShareAll、AllHero；无重复治疗注入 |
| 调谐强度 pickup 被动 | required 已实现为通用 layered effect | +6%/层、max4、24s/层、Overlying；`independent-layer` + `ignore-new-no-refresh` | 0距离最近友方可达；同帧双领、逐层右开过期、满层 no-refresh、两轮 replay |
| action/hit/resource/CD 边界 | required 已实现 | hit override、blocked action、精确 CD 右开、action/hit/effect/control/resource 投影 | 1200F 首次星鸣后 1500F blocked，2640F 右开可执行；hit/miss 均有真实结算 |

新增通用 primitive 均以来源合同驱动，不含 `107002` 角色 ID 特判。角色特有帧、element、路由、池、候选优先级与预期结果仅存在于 `scripts/character-combat/profile-recipes/107002.json`、107002 fixture/acceptance recipe 和 owner 产物。

## 3. required / N/A / conservative 结果

- Frozen scenario 的 required 机制已进入真实 runtime replay；owner `unresolved-ledger` 中 gameplay-impacting unresolved 为 0。
- `10700215`、`10700211`、`10700225`、`10700227` 等闪击/位移/反应或依赖 Boss 攻击事件的动作保留原始来源，并以 `scenario-out-of-scope` / not-applicable 留在 candidate 外。
- `10700262` 当前客户端未实现，结构化 not-applicable；Kibo DNA 不补值。
- A5、完整普攻 occupancy、隐藏团队传播仍缺可达来源，不猜测、不进入候选动作。
- 普通池/星决 `SummonId` 池满时 replacement/refresh 未证，采用 capacity reject；调谐满 4 层时采用 ignore-new/no-refresh。两者都通过反例锁定为 conservative policy。
- pickup 的幽灵实体、重复领取、非友方、超半径、碰撞前与右开到期全部 fail-closed；星鸣无 `[550,750]` 候选时不生成负层、不发 overlimit、不加 30s buff。

## 4. 并行集成冲突面

107002 独有 recipe、fixture、acceptance recipe、owner profile/contract 与 `reports/m10/107002/**` 为低冲突文件。与米蒂 `108003`、西芙莉雅 `107001`、莉莉 `102001` 并行提交最可能发生语义或文本冲突的是：

- `scripts/character-combat/character-combat-contract-compiler.mjs`
- `scripts/character-combat/character-combat-golden-runtime.mjs`
- `scripts/character-combat/character-combat-production-orchestrator.mjs`
- `scripts/character-combat/character-combat-profile-pipeline.mjs`
- `scripts/sync-verified-combat-mechanics.mjs`
- `src/simulation/engine/simulateScenario.js`
- `src/simulation/mechanics/verifiedBattleEffectFormulaRuntime.js`
- `src/simulation/mechanics/verifiedBattleEffectGeneration.js`
- `src/simulation/mechanics/verifiedCombatRuntime.js`
- `src/simulation/mechanics/verifiedTargetStateRuntime.js`
- `src/simulation/mechanics/verifiedTuningMarkGeneration.js`
- `src/simulation/projection/projectSimulationResult.js`
- `src/simulation/runtime/effectRuntimeTimeline.js`

中央集成应按 primitive 语义合并，不能用任一角色分支的共享文件整体覆盖其他实现，也不能 cherry-pick 108003/107001/102001 来替代本分支设计。

## 5. 聚焦验收

- 107002 owner `--assert-clean` 通过：1 个 profile、14 个 owner-only 产物全部 byte-clean。
- Machine Axis 两轮 replay 字节等价，Workbench import/export roundtrip 通过；11 个 fixture action 全部可执行，派生的 `misa-star-before-cooldown-boundary` 探针精确 blocked。package hash 为 `d22540cc215db5e7290b4a3999dea78da282f5405765017b06c916242b06ece4`。
- formula、target-state、effect timeline、action rule、pickup、battle-effect、combat runtime、tuning mark 与 107002 owner profile 的 9 个聚焦测试文件共 113/113 通过；合成 owner compiler 定向用例 1/1 通过。
- 核心证据普通重算连续两轮第二轮 `wrote=false`；resource hash 为 `d0df7f709f29326e513ac928e1193d0552d8d78a4ad9b64ef5196bd53753d018`，runtime hash 为 `d7b3a37d2cf36a506ee747f98a1544503d18f20b5276d09460d13287ba7d94b1`；两份 `--assert-current` 与 S1 scope validator 均通过。
- 静态门禁包括所有改动 JS/MJS `node --check`、JSON parse、Python extractor AST parse、`git diff --check` 与 S1 allowlist scope guard；提交后再执行两轮核心证据 `--assert-clean` 及 strict validator，并要求 tracked/index 保持 clean。

本文件不嵌 carrier commit SHA，以免破坏 post-commit 可复现性。

## 6. 中央集成线统一重生成清单

本分支只发布 107002 owner 产物。合并所有角色的共享 primitive 与 recipe 后，中央线必须统一重生成：

- `src/data/generated/verified-combat-mechanics-package.json`
- character-combat 全局 catalog / coverage / qualification / binding matrix / summary
- 全局 character-acceptance index / summary
- 任何聚合多个 owner 的全局 reports

中央产品验收再决定 visual/formal admission 与 optimization-ready；本实现不自行升级这些状态。
