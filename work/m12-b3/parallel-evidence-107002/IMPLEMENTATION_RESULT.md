# M12-B3-107002-R2 重击吸收实现与验收结果

## 1. 结论与冻结边界

本分支从中央基线 `1a56e0a295f31298da6c3ddb5d70db90183971fb` 修正米砂 `107002` 的生成物领取触发：零距离不再自动碰撞收取，只有米砂来源重击 `10700210/sub0` 在 70F 吸收 owner live 生成物。实现只消费来源与用户产品裁决，不使用 `hero_rank`，Kibo DNA 保持 `[]`，不进入 M12-C 或正式搜索。

本结果是实现候选与聚焦运行时证据，不构成 visual admission、formal admission 或 optimization-ready。旧 accepted visual record 因 trace/qualification subject 漂移而 stale，owner manifest 重开为 `pending`。

## 2. 机制到实现的映射

| 机制族 | 实现状态 | 关键实现/契约 | 聚焦证据 |
|---|---|---|---|
| A3 六 hit 造普通 HP entity | required 已实现 | `pickupProfiles`、`pickupSpawnBindings`；仅 40/46/52/58/64/70F，`SummonTempData` 池 max6；默认不领取 | 无重击奖励0；miss 不 spawn |
| formula104 治疗 | required 已实现为通用 primitive | `verifiedBattleEffectFormulaRuntime.js` 解析 `common1/base=104`，以 source-owner MAXHP 求 3% | 单测拒绝 literal A 与 Target MAXHP；golden 路由只含 Target |
| owner 重击吸收 | required 已实现为通用 primitive | `pickupAbsorbBindings`；`10700210/sub0@70F`、action-owner、successful execute、requiresHit=false；跨四 profile 吸收 | miss 仍吸收；blocked/其他动作/其他 owner/切人不吸收；同帧 spawn 排除、expiry 优先 |
| pickup entity ledger | required 已实现为通用 primitive | 15s live entity、一次 reward、稳定 `sourceOrder/entityId`、分池与保守容量拒绝；collision 证据不再默认排队 | 无重击持续至过期；连续重击/空重击/满池/右开到期 |
| A4/charged DEF | required 已实现，复用并扩展 target-state | 84F/76F hit-confirm；同帧 damage -> energy -> 物/法 DEF 各 -1000bp，Cover 24s，strict source sequence | 触发 hit 不反吃、后续 hit 生效；miss 不应用/不刷新；`[t,t+24s)` |
| 星鸣主动作与印记 | required 已实现 | public `10700212` 映射 execution `10700226/sub0`；74/82/90/99/107/114F；82F 候选 `[550,750]` consume 后 inject；90F 独立 +750 | 无候选时无 consume/inject；90F 不能支付 82F；成功 buff 的 source sequence 晚于 consume |
| 星鸣 SP 与成功 buff | required 已实现 | 前四 hit 生成 SP entity；重击 owner Target + direct-SP ShareAll；成功仅 self 获木/风伤各 +5% 30s及对应 overlimit | Target/ShareAll 不外推 heal/buff；第三次无候选 replay 保持 fail-closed |
| 星决与星携团队治疗 | required 已实现 | raw direct-effect route：星决 135F HP×3 后 SP×3，143/155/167/181/193F AllHero heal，144/150F +木印；星携 46/61/79/98F AllHero heal | golden 分别断言 Target、ShareAll、AllHero；无重复治疗注入 |
| 调谐强度生成物被动 | required 已实现为通用 layered effect | 每个吸收实体 +6%/层、max4、24s/层、Overlying；`independent-layer` + `ignore-new-no-refresh` | collector 固定米砂；稳定六实体前4层、满层 no-refresh、逐层右开过期 |
| action/hit/resource/CD 边界 | required 已实现 | hit override、blocked action、精确 CD 右开、action/hit/effect/control/resource 投影 | 1200F 首次星鸣后 1500F blocked，2640F 右开可执行；hit/miss 均有真实结算 |

新增通用 primitive 均以来源合同驱动，不含 `107002` 角色 ID 特判。角色特有帧、element、路由、池、候选优先级与预期结果仅存在于 `scripts/character-combat/profile-recipes/107002.json`、107002 fixture/acceptance recipe 和 owner 产物。

## 3. required / N/A / conservative 结果

- Frozen scenario 的 required 机制已进入真实 runtime replay；owner `unresolved-ledger` 中 gameplay-impacting unresolved 为 0。
- `10700215`、`10700211`、`10700225`、`10700227` 等闪击/位移/反应或依赖 Boss 攻击事件的动作保留原始来源，并以 `scenario-out-of-scope` / not-applicable 留在 candidate 外。
- `10700262` 当前客户端未实现，结构化 not-applicable；Kibo DNA 不补值。
- A5、完整普攻 occupancy、隐藏团队传播仍缺可达来源，不猜测、不进入候选动作。
- 普通池/星决 `SummonId` 池满时 replacement/refresh 未证，采用 capacity reject；调谐满 4 层时采用 ignore-new/no-refresh。两者都通过反例锁定为 conservative policy。
- 旧 `spawn+2F` 自动领取 trace 已以 27 条 golden 断言真实 failure-to-pass；R2 对无重击、非米砂重击、blocked、same-frame spawn、右开到期和重复吸收全部 fail-closed。星鸣无 `[550,750]` 候选时仍不生成负层、不发 overlimit、不加 30s buff。

## 4. 并行集成冲突面

107002 独有 recipe、fixture、acceptance recipe、owner profile/contract 与 `reports/m10/107002/**` 为低冲突文件。与米蒂 `108003`、西芙莉雅 `107001`、莉莉 `102001` 并行提交最可能发生语义或文本冲突的是：

- `schemas/azpr-machine-axis-v1.schema.json`
- `scripts/character-combat/character-combat-contract-compiler.mjs`
- `scripts/character-combat/character-combat-golden-runtime.mjs`
- `scripts/character-combat/character-combat-profile-pipeline.mjs`
- `scripts/generate-character-acceptance.mjs`
- `scripts/optimization-scenario/optimization-scenario-policy-source.mjs`
- `src/domain/combatScenario.js`
- `src/machine-axis/machineAxisContract.js`
- `src/machine-axis/machineAxisService.js`
- `src/machine-axis/workbenchMachineAxisAdapter.js`
- `src/simulation/mechanics/verifiedPickupEntityGeneration.js`

中央集成应按 primitive 语义合并，不能用任一角色分支的共享文件整体覆盖其他实现，也不能 cherry-pick 108003/107001/102001 来替代本分支设计。

## 5. 聚焦验收

- 107002 owner profile `--assert-clean` 通过：1 个 profile、14 个 owner-only 产物全部 byte-clean。owner acceptance `--assert-clean` 为 requirements 181、required/pass 111/111、N/A 70、blocked/sourceGap/acceptanceGap/functionalFailure 全 0；headless replay、canonical stable、Workbench roundtrip 均 true，product visual 仍 `pending`。
- 完整 Machine Axis 两轮 replay 字节等价，Workbench import/export roundtrip 通过；fixture 21 个 action 全部可执行，派生 cooldown 与 blocked charged-absorb 两个探针均精确 blocked。完整 package hash 为 `d8b0a7c0082a01cfc5b7b33c4a6f36f7d523ace61ab91b120e1366c621eeb416`；input/data/trace/evaluation/build hash 分别为 `4e79c6d8b512eecb` / `4a5fa6164a65f384` / `648af4af89fdd188` / `5238bf8119e66446` / `0cfb1ba2ee221376`。
- 实际 pickup trace：A3 零距离自动治疗 0；`misa-charged` 在 3370F 逐实体吸收六个 A3 HP 生成物并产生 6 次 Target-only formula104；全 miss 的 `misa-charged-ultimate-absorb-miss` 在 4680F 仍吸收 3 个 HP 与 7 个 SP entity，产生 3 次 HP Target 与 21 条 direct-SP ShareAll actor event。blocked 重击、无实体重击及第二次重击均不产生重复奖励。
- R2 runtime/profile/acceptance/Machine Axis 的 14 个聚焦测试文件为 159/159；formula104 两个定向用例另为 2/2。额外运行的全局 M8 legacy-package 一致性用例仍有 1 个中央基线既有失败（global semantic value `600` 对 stale legacy `null`）；测试、公式 runtime 与全局 package 三个输入相对 `1a56e0a...` 均未修改，本支线不手改全局 package，留给中央统一重生成。
- 核心证据当前重算均 `wrote=false`；resource hash 为 `e2455070684172a0dd5e8fdaf86be0abd8aeb63716c145f7fbe2e6f1d6eb8c34`，runtime hash 为 `068bc52253d539bb77487742f60f0f75dbb0d118705683b75b5779742efa528f`；两份 `--assert-current` 与 R2 scope validator 均通过。提交后再执行连续两轮普通生成/`--assert-clean` 与 strict validator，并要求 tracked/index 保持 clean。
- 静态门禁包括所有改动 JS/MJS `node --check`、JSON parse、Python extractor compile、`git diff --check` 与 R2 allowlist scope guard；禁止 `test:full`、`test:core`、build 或全局生成。

本文件不嵌 carrier commit SHA，以免破坏 post-commit 可复现性。

## 6. 中央集成线统一重生成清单

本分支只发布 107002 owner 产物。合并所有角色的共享 primitive 与 recipe 后，中央线必须统一重生成：

- `src/data/generated/verified-combat-mechanics-package.json`
- character-combat 全局 catalog / coverage / qualification / binding matrix / summary
- 全局 character-acceptance index / summary
- 任何聚合多个 owner 的全局 reports

中央产品验收再决定 visual/formal admission 与 optimization-ready；本实现不自行升级这些状态。
