# 奇波战斗机制无头核心线程手册

## 线程目标

在 M11 Canonical Headless Combat Core 与 Machine Axis v1 的基础上，完成全奇波天赋/被动的证据分类与可审计解析，并让全部公开奇波动作在 0 距离无头场景中形成确定性运行闭环。网页 UI、视觉时间轴、拖拽交互、检查面板、包体与前端性能不在本线程范围内。

## 完成定义

1. 全量奇波、公开动作与唯一 `fixedSkillId` 都进入 census，新增、遗漏和静默默认均由测试阻断。
2. 每个 fixed skill 明确归入 `pve-combat`、`pvp-only`、`non-combat`、`unreachable` 或 `unresolved`，并保留来源、引用链、解析状态、置信度和 unresolved reason。
3. 已确认 PVE 天赋/被动通过 M11 统一事件、属性快照、Hit、效果、资源、暴击与诊断合同运行，不存在奇波专用旁路模拟器。
4. 星决技、主动技、破韧技在 0 距离场景中覆盖动作分支、Hit、三值、SP、效果生命周期、冷却、派生/延迟/协同关系和逐 Hit 覆盖；证据不足的分支显式诊断。
5. 逐奇波成熟度矩阵可可靠筛选 `machine-optimization-ready`，且代表机制金标与全量 coverage 测试通过。
6. `DEVELOPMENT_PLAN.md` 与 `PROJECT_MANUAL.md` 记录阶段定义、数据合同、验收命令和真实覆盖数字。

## 固定边界与决策

- 复用 `compileProject -> simulateScenario -> projectSimulationResult` 及 `canonicalHeadlessCombatCore`；不另建第二套奇波模拟器。
- 数据、CLI、测试和既有网页消费者共享同一版本化合同与 trace。
- 证据优先级：实际引用链与可达性 > Lua/配置/运行结构/公式 > 技能文本交叉验证。
- 文本与实际引用不一致时记录差异，不用文本补造逻辑。
- 未解析项不得按零效果或通用效果运行；必须返回稳定诊断并阻断成熟度升级。
- 0 距离只把投射物命中时延归零；逐 Hit `landed` 与四种暴击策略继续沿用 M11 合同。
- 当前工作区含既有 M11-B 暂存/未暂存成果与大量报告变动；全部保留，不回退、不覆盖。
- 基线依赖状态：M11-B 独立验收曾在固定提交 `bb62c99` 发现 Machine Axis 奇波动作目录断链；当前 HEAD `8da52fb` 已包含 M11-B-R1 的合同收口与验收稳定化提交。本线程没有修改 `src/machine-axis/**`、`scripts/*machine-axis*`、Machine Axis schema/fixture/CLI 文档，也没有暂存或回退 R1 改动；后续若需要进入重叠文件，另设明确集成阶段并重新验收。

## 阶段记录

### K0：基线与证据盘点

状态：已完成（2026-07-29）。

已确认：

- M11-A-R1 已通过验收，M11-B 已实施完成且当前工作区含其后续改动。
- canonical core 已有 `catalog / compile / validate / simulate / evaluate / explain` 六接口。
- Machine Axis v1 已有 `catalog / validate / simulate / compare / explain` CLI 和逐 Hit 命中/暴击覆盖。
- 项目要求角色/机制不完整时保持显式 evidence gap，不得以默认值标绿。

证据结论：

- Workbench 分母锁定为 122 只奇波、366 个公开动作、172 个唯一 `fixedSkillId`。
- `fixedSkillList` 共 927 次引用，但主要装载星决辅助动作、位移与解密/交流能力，不能当作被动集合。按 slot 枚举和实际引用分类后，127 个唯一技能为 PVE 动作辅助，20 个为非战斗能力，25 个仍缺可达性/语义证据。
- 真正的 PVE 天赋/固有被动来自 `fPropertyskillList` / `bPropertyskillList`：133 次引用、44 个唯一技能。PVP 专用被动来自 `kiboFPropertyskillList` / `kiboBPropertyskillList`：122 次引用、122 个唯一技能。
- 366 个动作的严格闭环口径是 `runnable && reasons.length === 0 && source-verified`；`runtime-ready` 不再等同机制完整。
- 首个完整被动证据链为 迅狼 `520084`：控制根注入触发元素 `520084001`，命中伤害后给受击敌人注入叠层容器 `520084002`，容器叠加上限 5，并注入物防属性 3 与魔防属性 4 的 `dynamicPercent=-500`；持续到离开战斗、内部 CD 为 0。

阶段产物：

- `scripts/generate-kibo-headless-census.mjs`：从原始 pet/skill/skill_level/skillsub_logic、精确 int64 本地化、Unity 控制根/元素引用与现有 public runtime coverage 确定性生成 census。
- `reports/kibo-headless/kibo-mechanics-census.json`：全量 fixed/PVE/PVP/动作清单，逐条 provenance、closure、置信度和 unresolved reason。
- `reports/kibo-headless/kibo-maturity-matrix.json`：122 只奇波的三个公开动作、被动、fixed skill、SP/Hit/效果与剩余缺口矩阵。
- `src/data/generated/kibo-passive-mechanics.json`：仅包含通过完整资产引用链校验的可运行被动；未通过的 43 项单独列入 unresolved。
- census 测试锁定 122 / 366 / 172 / 44 / 122 分母，并阻止 unresolved 缺失原因或生成物漂移。

本阶段三类计数：

- fixed skill 分类：已由证据闭环 147，暂按场景假设 0，仍未解析 25。
- PVE 被动机制：已由证据闭环 1，暂按场景假设 0，仍未解析 43（变化：0 → 1 / 0 → 0 / 44 → 43）。
- PVP 被动分类：已由证据闭环 122，暂按场景假设 0，仍未解析 0；PVE runtime 明确不加载。
- 公开动作：已由证据闭环 132，暂按 0 距离场景假设 53，仍未解析 181。

验收：

- `npm run audit:kibo-headless` 通过。
- `npm test -- --run src/__tests__/scripts/kiboHeadlessCensus.test.js src/__tests__/simulation/verifiedKiboPassiveGeneration.test.js`：2 个文件、4 个测试通过。

### K1：全 PVE 被动机制解析与统一运行时

状态：进行中。

已完成第一批：

- 新增 `verifiedKiboPassiveGeneration`，从生成机制目录按结构化定义生成 `verified-passive-effect-generated` 命令，并进入与 M11 Battle Effect / Tuning Mark 相同的 `effectRuntimeTimeline`；没有第二套奇波模拟器。
- `520084` 在实际迅狼 9 Hit 星决技中按 Hit 触发：同一帧的触发 Hit 不反向受益，下一帧读取 3 层双防降低，后续封顶 5 层；持久效果不在场景结束前过期。
- 逐 Hit `willHit=false` 会同时移除该 Hit 的伤害与被动触发；动作 execution block 不生成被动命令。
- 结构化结果新增 `verifiedKiboPassiveGeneration`，明确输出目录闭环数、场景假设数、未解析目录数、命令数与逐动作 unresolved。
- 第二个来源闭环被动为 `520050`：造成伤害后给敌人施加 10 秒、不可叠加但可刷新的移动速度 `-1000` 与冰抗 `-800`，测试覆盖触发 Hit 本身不受益、有效期内生效和 `10100.001ms` 到期移除。
- 共性运行时已支持定义驱动的内部 CD，并记录逐 Hit `internalCooldownSuppressions`；`520008/520040` 虽有 15 秒/500ms CD 结构，但携带尚未解码的条件 `(2,14)/(2,24)`，因此继续 unresolved，未因运行时已支持 CD 而升级。

#### K1-A1：装备奇波自身静态属性家族

状态：已完成（2026-07-29）。

证据与实现：

- `fPropertyskillList` 由 `DataPropertyUtility.InitPetData / ResetPetAttr / IsFpropertyskill` 装载到奇波实体；控制行为 `directInjectTargetType=0` 与 IL2CPP `EDirectInjectTargetType.Self=0` 相互印证，因此该家族的目标是装备奇波自身，不是搭档角色、敌人或全队。
- 解析器只接受单一 Self 注入根、无触发元素、无未解条件、属性叶节点全部可解析、行为引用与 `skillResourceMaps.elements` 完全覆盖的图；任一额外元素或未计入引用都会继续 unresolved。
- 新闭环 10 项：`520003 / 520012 / 520014 / 520027 / 520043 / 520048 / 520056 / 520057 / 520077 / 520112`。其中 `520057` 为场景起点生效、15 秒到期；其余按资产为离战清除的持久效果。
- 统一生成器会从 `scenario.actors[].loadout.kiboId` 在 `0ms` 加载静态效果，目标合同为 `targetKind=kibo`、`targetId=装备槽对应 actorId`；后台槽同样装载，不依赖首次执行奇波动作。未装备奇波的槽不会生成命令。
- 金标覆盖：双防属性封装、限时移动属性、后台装备槽、未装备反例、`14999.999ms` 有效与 `15000ms` 到期；命令继续进入 M11 的 `effectRuntimeTimeline`。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `2 → 12`，暂按场景假设 `0 → 0`，仍未解析 `42 → 32`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，`machineOptimizationReady=0`。
- census + 被动金标：2 个文件、7 个测试通过。
- M11 非 Machine Axis 回归 6 个文件全部通过；Machine Axis service 的真实奇波星决技用例仍因已登记的 M11-B-R1 动作目录断链失败，本线程未修改其源文件、测试或合同。
- 本线程文件 Prettier 全部通过；定向 ESLint 仅报告既有 `RUBY_STAR_SKILL_BINDING` 未使用 warning，无 error。

#### K1-A2：多根 Self 静态属性图

状态：已完成（2026-07-29）。

证据与实现：

- 静态解析器从“单一注入根”扩展为“一个 Self 行为可注入多个独立根”；每个根分别解析容器、持续时间、叠层和属性叶节点，并要求所有根与所有叶节点对 `skillResourceMaps.elements` 精确全覆盖。
- 新闭环 3 项：`520024`（移动/闪避两个持久根）、`520025`（双防封装、闪避、暴击三个持久根）、`520080`（攻击与承伤两个 10 秒根）。每个根生成独立 effect identity，未把不同生命周期合并成伪容器。
- 真实角斗蜥 `500042` 主动技 `506006` 金标证明：`520080001` 的属性 1 `dynamicPercent=6000` 出现在奇波来源属性 trace，统一伤害结果高于无被动基线；`520080002` 的属性 22 `dynamicExtra=-2000` 同时保持为独立效果。两者在 `9999.999ms` 有效，`10000ms` 移除。
- 同一只角斗蜥的 `520083` 仍有未解条件 `(11,14)`；场景结果同时输出已闭环 `520080` 与 `520083` unresolved 诊断，证明部分证据闭环不会掩盖同奇波的剩余缺口。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `12 → 15`，暂按场景假设 `0 → 0`，仍未解析 `32 → 29`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`。

验收：

- `npm run audit:kibo-headless`：通过，`machineOptimizationReady=0`。
- census + 被动金标：2 个文件、8 个测试通过。
- M11 无头核心与 replay 回归（避开已登记 R1 动作目录断链用例）：6 个文件、57 个测试通过。
- Prettier 全过；定向 ESLint 0 error、1 个既有 warning。

#### K1-A3：PetOwner 与 Self+PetOwner 所有权

状态：已完成（2026-07-29）。

证据与实现：

- IL2CPP `EDirectInjectTargetType.PetOwner=7` 与控制行为的“对应英雄”轨道直接建立装备奇波到其搭档 actor 的所有权映射；运行时使用 `targetKind=actor`、同装备槽 actorId，不传播到其他角色或奇波。
- 新闭环 `520055`：`500220` 的属性 105 `dynamicExtra=3000` 在 `0ms` 持久施加给 PetOwner；金标证明 actor 目标存在且同 actorId 的 kibo 目标为空。角色静态 `SPGETUP` 基线仍缺来源，故本阶段只宣称目标、数值和生命周期闭环，不宣称完整 SP 曲线闭环。
- 新闭环 `520062`：同一属性 55 `dynamicExtra=1200` 的资源元素被两个独立控制行为分别以 `Self=0` 和 `PetOwner=7` 注入；运行时生成一条 kibo 效果与一条 actor 效果，不扩散为全队光环。
- `Player=15` 与 PetOwner 语义不同，当前统一合同没有“玩家全局属性容器”；`520070` 因此继续 unresolved，未擅自映射成当前角色、全队角色或全队奇波。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `15 → 17`，暂按场景假设 `0 → 0`，仍未解析 `29 → 27`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`。

验收：

- `npm run audit:kibo-headless`：通过，`machineOptimizationReady=0`。
- census + 被动金标：2 个文件、10 个测试通过。
- M11 无头核心与 replay 回归：6 个文件、57 个测试通过。
- Prettier 全过；定向 ESLint 0 error、1 个既有 warning。

#### K1-A4：目标实体类型条件与伤害后触发

状态：已完成（2026-07-29）。

证据与实现：

- IL2CPP 枚举闭环 `EElementTriggerFixedConditionType.TargetEntityType=2`、`EElementTriggerConditionType.OR=1`、`EElementTriggerEventType.AfterDamage=2`，并把资产参数 `14 / 24` 对应到 `EEntityType.Monster / KiBo`；解析器只接受完整 OR 条件图与已知实体类型，不把未知参数当作命中。
- 运行时优先读取显式 `scenario.enemy.entityType`；标准编译场景的 `TDEnemy` 通过 `EntityManager.CreateMonsterEntity` 引用链判定为 `Monster=14`。类型不匹配时记录 `kibo-passive-target-entity-type-condition-not-matched`，缺失类型时记录 `kibo-passive-target-entity-type-unresolved`，二者都不生成效果且不会消耗内部 CD。
- 新闭环 `520008`：奇波伤害命中 Monster/KiBo 后，在 `hit+0.001ms` 对目标施加属性 45 `dynamicExtra=-2000`，持续 8 秒、单层刷新、内部 CD 15 秒。金标覆盖显式 Monster 正例、编译 TDEnemy 正例、Hero 反例、实体类型缺失诊断、内部 CD 抑制和到期移除。
- 新闭环 `520040`：相同目标类型条件下施加属性 62 `dynamicExtra=-100`，离战清除、最多 6 层、内部 CD 500ms。真实炎灼角羊 `500039` 星决技集成测试证明首 Hit 后生成效果、进入公共 `effectRuntimeTimeline`，并使后续 Hit 伤害高于仅加载动作效果的基线。
- `520040` 接入使既有 M10 三角色权威场景产生可解释金标迁移：`101010` 场景敌人总承伤仍封顶 862800，炎灼角羊多造成 3 点后主角色归属伤害相应 `699322 → 699319`；`103002` 场景主角色伤害 `164509 → 164523`、削韧 `2190 → 2198`、敌人末血 `698197 → 698183`。已通过官方 character/verified-combat 生成器重建合同、金标和派生哈希。
- `520083` 的 `(11,14)` 仍保持 `passive-trigger-condition-semantics-unresolved:11/14/0/0`；虽然 IL2CPP 已知 `11=CheckSkillType`、技能标签 `14=PetUltraSkill`，尚未闭环条件执行对象、标签来源和动作分支绑定，因此未提前升级。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `17 → 19`，暂按场景假设 `0 → 0`，仍未解析 `27 → 25`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122。
- census + 被动 + Battle Effect 集成金标：3 个文件、15 个测试通过。
- 全部非 Machine Axis 单元/集成回归：149 个文件、917 个测试通过；Machine Axis 测试继续因已登记的 M11-B-R1 动作目录依赖而排除，本线程未修改其实现或合同。
- `npm run data:sync-character-combat` 与 `npm run data:sync-verified-combat` 均成功，生成产物与审计 hash 一致。

#### K1-A5：技能标签条件与元素生命周期触发上限

状态：已完成（2026-07-29）。

证据与实现：

- `skillsub_logic` 的真实动作控制绑定直接提供 `skillTag`：角斗蜥 `50004202` 星决技为 `14`，主动技 `506006` 为 `13`，破韧/合击分支 `50004204` 为 `15`；IL2CPP `ESkillTagType` 分别对应 `PetUltraSkill / PetNormalSkill / PetJointStrikeSkill`。运行时只读取 `resolution.controlBinding.logic.skillTag`，不按动作名称或 eventType 猜标签。
- `520083` 的触发条件资产为 `CheckSkillType=11` 且要求 `PetUltraSkill=14`，事件为 `AfterDamage=2`；效果在命中后 `0.001ms` 施加给受击敌人，持续 40 秒、单层刷新，属性 45 `dynamicExtra=-1000`、属性 3/4 `dynamicPercent=-600`。
- GameAssembly 运行证据闭环 `triggerCounter=1`：`Parse@0x1813BD9C0` 写入 `m_cfgTriggerCounter`，`CanTrigger@0x1813B5770` 比较当前计数，`Trigger@0x1813BFE80` 成功后递增并在达到正数上限时结束元素，`OnReset_Internal@0x1813BC7F0` 才清零。因此合同明确为“每个装备奇波的被动元素实例生命周期内最多一次”，不是内部 CD 或每动作一次。
- 统一生成器新增 skill-tag AND 条件、实例级触发计数和 `triggerLimitSuppressions`。标签不匹配输出 `kibo-passive-skill-tag-condition-not-matched`；来源缺失输出 `kibo-passive-skill-tag-unresolved`；达到上限输出 `kibo-passive-trigger-count-limit-reached`，均不静默运行。
- 真实 `50004202` 金标证明：首个触发 Hit 不吃自身减防，后续 Hit 读取双防 `-600`，后续合格 Hit 被一次上限抑制，效果在 `trigger+39999.999ms` 有效并于 `trigger+40000ms` 移除。真实 `506006` 以标签 13 形成反例，仍只加载已闭环的 `520080` 静态属性根。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `19 → 20`，暂按场景假设 `0 → 0`，仍未解析 `25 → 24`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122。
- census + 被动 + 统一运行时定向验收：3 个文件、36 个测试通过。
- 全部非 Machine Axis 单元/集成回归：149 个文件、918 个测试通过；Machine Axis 测试继续按 M11-B-R1 依赖排除，本线程未修改其实现、schema、fixture、CLI 或文档。
- K1 文件 Prettier 全过；定向 ESLint 0 error，3 个 warning 均来自既有未提交基线。

#### K1-A6：BeforeSkill 双目标叠层家族

状态：已完成（2026-07-29）。

证据与实现：

- 新闭环 `520087`：控制根把唯一触发元素注入 Self；触发资产为 `EElementTriggerEventType.BeforeSkill=5`，技能标签条件为 `CheckSkillType=11`、OR `PetUltraSkill=14`。触发效果把同一属性元素分别注入 `ETriggerEffectTargetType.Self=0` 与 `PetOwner=8`，没有把 PetOwner 扩散为全队。
- 属性元素 `520087002` 为属性 1 `dynamicPercent=200`，持续 30 秒、`combineType=4`、最多 6 层。统一运行时在 action start 生成一条 `targetKind=kibo` 与一条 `targetKind=actor` 命令；第 7 次合格触发保持 6 层并把两个目标的到期时间一起刷新。
- 技能文本写“释放特技后”，但运行资产事件明确为 `BeforeSkill`。机制目录新增机器可读 `sourceTextDifferences`，记录文本主张、运行证据、最终采用的 `before-action` 合同和“以运行资产为准”的裁决，没有用文本覆盖运行顺序。
- 真实小浮蝶 `50004302` 星决技控制绑定提供 `skillTag=14`，效果在动作起点对 Self/PetOwner 同时可见。该星决技本身是纯增益动作，不存在伤害 Hit；`500043` 主动技 `504012` 的 action resolution 当前仍未就绪，因此本阶段不捏造“星决技首 Hit 读取新层”的结果，该动作缺口继续留给 K2。
- 条件运行时扩展为统一支持 skill-tag AND/OR。受控反例锁定标签 13 不匹配和标签缺失诊断；上游 action resolution 未就绪时被动生成器不越过动作合同自行执行。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `20 → 21`，暂按场景假设 `0 → 0`，仍未解析 `24 → 23`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122。
- census + 被动 + 统一运行时定向验收：3 个文件、38 个测试通过。
- 全部非 Machine Axis 单元/集成回归：149 个文件、920 个测试通过；Machine Axis 测试继续按 M11-B-R1 依赖排除。
- K1 文件 Prettier 全过；定向 ESLint 0 error，3 个 warning 均来自既有未提交基线。

#### K1-A7：AfterDamage 多根效果图

状态：已完成（2026-07-29）。

证据与实现：

- 新闭环 `520051`，适用于 `500020 / 500021 / 500022 / 500072`。其唯一 `AfterDamage=2` 触发器并非单一通用减益，而是按资产顺序注入两个独立敌方根：`520051002` 封装属性 3/4 `dynamicPercent=-160`，`520051005` 直接提供属性 66 `dynamicExtra=-60`；两个根均为离战清除、最多 5 层。
- 解析器从“一个伤害触发根”扩展为“同一触发器的全部唯一目标根”，并要求触发效果数、目标引用数、根路径和 `skillResourceMaps.elements` 五个实际元素精确全覆盖。任一重复/遗漏引用、未知目标、未知叶节点或额外资源元素都会保持 unresolved，禁止只解析第一根后把其余效果静默丢弃。
- 统一生成器对一个有效 Hit 只推进一次触发计数/内部 CD 状态，再为每个已验证根生成独立 effect command；多根 ID 带来源 element id，单根既有 ID 保持兼容。两个根各自进入公共 `effectRuntimeTimeline`，分别叠层、刷新和移除。
- 真实 `500020` 主动技 `503001` 金标取得 3 个实际解析伤害 Hit：触发 Hit 本身不读取新减益，后续 Hit 的目标属性轨迹读取双防根；完整根集合的伤害高于只保留双防根的结果，独立证明属性 66 冰抗根被元素抗性计算器消费。由于场景敌人基础防御为 0，双防根与无被动伤害相等，测试以属性轨迹而不是伪造伤害增益证明其生效。
- 将同一真实动作复制为第二次执行后，共产生 `Hit 数 × 2 根 × 2 动作` 条命令，两个 effect identity 均封顶 5 层。`503001` 的公开动作闭环仍保留零距离触发帧/投射物立即命中的场景假设，不因本被动测试而升级为证据完整动作。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `21 → 22`，暂按场景假设 `0 → 0`，仍未解析 `23 → 22`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，生成 JSON 为权威字节输出。
- census + 被动 + 统一运行时定向验收：3 个文件、39 个测试通过。
- 全部非 Machine Axis 单元/集成回归：149 个文件、921 个测试通过；Machine Axis 测试继续按 M11-B-R1 依赖排除。
- K1 源码与手册 Prettier 全过；定向 ESLint 0 error，3 个 warning 均来自既有未提交基线；`git diff --check` 无空白错误（仅既有 CRLF 提示）。

#### K1-A8：复合静态/触发容器与受击缺口显式化

状态：已完成（2026-07-29）。

证据与实现：

- 新闭环 `520082`，适用于 `500261 / 500262 / 500263`。控制行为只向 Self 注入根 `520082000`；该根的实际子图同时包含持久属性 `520082003`（属性 67 `dynamicExtra=+800`）和 `AfterDamage=2` 触发器 `520082001`。触发器带 Monster/KiBo OR 条件，把 `520082004`（属性 67 `dynamicExtra=-1000`、20 秒、单层刷新）施加给命中敌人。
- 新增共性机制家族 `equipped-kibo-self-and-on-damage-enemy-property-effect`。同一条定义在 `0ms` 生成装备奇波 Self 命令，同时在真实伤害 Hit 后生成敌方命令；两部分仍进入 M11 公共 `effectRuntimeTimeline`，没有创建复合被动旁路模拟器。
- 控制资源图只列出 `520082000 / 003 / 001 / 004`，且引用精确全覆盖。资产目录中还存在 `520082002`，但它没有被控制行为、可达根或 `skillResourceMaps.elements` 引用；目录以 `unreachableAssetElements.reason=not-referenced-by-control-resource-map` 显式记录，未把旧的 20 秒封装误接成第二个有效容器。
- 河狸仔真实主动技 `502001` 的 action plan 合法执行并解析出 3 个伤害 Hit。金标证明首 Hit 与“仅静态水抗”基线伤害相同，后两个 Hit 都读取新施加的敌方减水抗；每次命中刷新同一 effect identity，最后一次命中后 `19999.999ms` 有效、`20000ms` 精确移除。该主动技仍因触发帧缺失/投射物落点运行时依赖保留 `scenario-assumed-zero-distance`，本阶段没有升级其公开动作闭环。
- 曾优先尝试证据闭环的 `50026104` 破韧动作作为金标，但统一动作合法性合同在缺少对应破韧战斗态时将其判为 `execute=false`；测试没有绕过规则或伪造可执行态，改用已合法执行的真实主动技。
- `520018` 不再只给出泛化 shape 错误：资产已证明 Self 注入 `AfterReceiveDamage=4` 触发器、`Target=1` 效果目标、属性 66 `dynamicExtra=-500`、8 秒、控制资源两元素精确覆盖，并暴露 `sustainElement=500109103`。IL2CPP 只证明 `ElementTriggerData_Damage` 有 `source/target/self` 字段，当前 M11 又没有带攻击者归属的 incoming-damage 事件，因此仍无法证明 AfterReceiveDamage 生产者把攻击者写入哪个字段。后续固定地址反汇编证明 `TriggerElement.Parse@0x1813BD9C0` 读取配置偏移 `0x13c/0x140/0x144`，但不读取 `sustainElement` 所在的 `0x138`；该字段不再作为生命周期缺口。census、被动目录和运行时诊断均携带结构化 `unresolvedEvidence`；运行时反例证明不会生成猜测效果。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `22 → 23`，暂按场景假设 `0 → 0`，仍未解析 `22 → 21`。
- `520018` 仍属于“仍未解析”，其原因从泛化 shape 缺口收紧为 incoming-damage 事件路径与 Target 实体角色 2 个可执行缺口，不改变三类数量。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122。
- census + 被动 + 统一运行时定向验收：3 个文件、41 个测试通过。
- 全部非 Machine Axis 单元/集成回归：149 个文件、923 个测试通过；Machine Axis 测试继续按 M11-B-R1 依赖排除。
- K1 源码与手册 Prettier 全过；定向 ESLint 0 error，3 个 warning 均来自既有未提交基线；`git diff --check` 无空白错误（仅既有 CRLF 提示）。

#### K1-A9：AfterDamage 派生伤害统一 Hit 闭环

状态：已完成（2026-07-29）。

证据与实现：

- 新闭环 `520041`，适用于焰翎龙 `500058`。控制行为把唯一触发元素 `520041001` 注入 Self；事件为 `AfterDamage=2`，Monster/KiBo OR 条件，内部 CD 2000ms，成功触发后把 DamageElement `520041002` 作用于受击敌人。触发器配置虽带 `sustainElement=500109099`，但固定地址反汇编证明 `TriggerElement.Parse` 不读取该字段，因此目录明确记录 `config-field-not-read-by-trigger-element-parse`，未把它猜成额外条件或生命周期。
- `element_formula` 第 4 行与 DamageElement 参数共同闭环派生伤害：来源为 `Attacker`，公式 `source.ATK[0]*A/10000`，`A=3000` 即装备奇波 ATK 的 30%；伤害类型 `MeleePhysical`、火元素、物理占比 100%、魔法占比 0%、魔法穿透 10000、削韧系数 2000，SP/奇波 SP 回复均为 0。文本“自身攻击力 30% 火伤、间隔 2 秒”只作一致性复核。
- 新增共性机制家族 `on-kibo-damage-derived-damage`。被动生成器按已解析原始 Hit 生成可审计的 `derivedDamageCommands`；统一 `verifiedCombatRuntime` 把命令排为 `passive-derived-hit` 描述符后仍调用公共 `applyHitDescriptor`，沿用属性快照、元素抗性、防御、削韧、护盾和暴击三模式，没有创建奇波专用伤害计算旁路。
- DamageElement 的 `ignoreDamageEvent=1` 在 IL2CPP 标注为“忽略受/承伤事件”。运行合同因此显式记录 `ignoreDamageEvent=true / emitsDamageTriggerEvents=false / recursivePassiveTrigger=false`；被动生成只扫描公开动作的原始 resolution Hit，派生 Hit 不会递归再次触发 `520041`。
- 真实主动技 `501002` action plan 合法执行并解析出 6 个伤害 Hit。首 Hit 在 `hit+0.001ms` 产生一条统一 `VERIFIED_COMBAT_HIT` 派生火伤，后 5 Hit 均被 2 秒内部 CD 抑制；派生事件造成正 HP/削韧变化，读取装备奇波攻击快照，且不新增角色或奇波资源事件。完整 `simulateScenario` 也输出相同派生事件。
- 派生 Hit identity 可单独使用既有 `action.hitOverrides`。受控重复真实主动技解析结果证明：首个派生 Hit 被 `willHit=false` 覆盖后不结算伤害，但成功触发仍消耗 ICD；2 秒内的后续 Hit/动作被抑制，2 秒后再次生成派生伤害。该受控重复只用于机制单测，不宣称绕过主动技自身冷却的动作序列合法。
- `520018` 的 `sustainElement=500109103` 同步按相同反汇编证据排除，不再报告伪生命周期缺口；它仍因 M11 缺少 incoming-damage 事件生产者和 `Target` 实体角色映射保持 unresolved。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `23 → 24`，暂按场景假设 `0 → 0`，仍未解析 `21 → 20`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，PVE 被动最新为 `24 / 0 / 20`。
- census + 被动 + 统一运行时定向验收：3 个文件、43 个测试通过。
- 全部非 Machine Axis 单元/集成回归：149 个文件、925 个测试通过；Machine Axis 测试继续按 M11-B-R1 依赖排除，本线程未修改其实现、schema、fixture、CLI 或文档。
- K1 源码与测试 Prettier 全过；定向 ESLint 0 error、2 个既有 warning；`git diff --check` 无空白错误（仅既有 CRLF 提示）。

#### K1-A10：AfterDamage→Self 攻击叠层闭环

状态：已完成（2026-07-29）。

证据与实现：

- 新闭环 `520090`，适用于跳跳稻草人 `500469` 与秋日守望者 `500470`。控制行为把唯一可达触发根 `520090001` 注入 Self；其 `AfterDamage=2` 条件按资产允许 Item、Monster、KiBo、DefenseTower 与 BaseTower，命中后把 `520090002` 施加给触发来源自身。Hero 不在允许集合内，反例会输出条件不匹配诊断而不生成效果。
- `520090002` 为属性 1 攻击的 `dynamicPercent=+400`，持续 20 秒、最多 10 层；每次合格命中叠层并刷新同一效果的到期时间。技能文本“造成伤害后自身攻击提高 4%，最多 10 层，持续 20 秒”与可达运行图一致，只作为交叉验证。
- `skillResourceMaps.elements` 只包含 `520090001 / 520090002`。同目录 `520090003–006` 虽存在旧的满层追加/清理结构，但没有被当前控制资源图引用；目录以 `unreachableAssetElements.reason=not-referenced-by-control-resource-map` 显式记录，运行时不执行文本或旧资产暗示的额外 20% 效果。
- 新增共性机制家族 `on-kibo-damage-self-property-effect`。伤害触发属性命令不再固定指向敌人；运行时按定义的效果目标把 Self 映射为 `targetKind=kibo`、当前动作 actorId，并继续复用公共属性快照与 `effectRuntimeTimeline`，未按奇波 ID 特判。
- 真实 `500469` 主动技 `506002` 每次解析出 18 个伤害 Hit。金标证明触发 Hit 本身不读取新层，后续动作读取攻击动态百分比并造成高于无被动基线的伤害；重复真实解析结果覆盖 10 层上限、刷新和精确到期，Hero 类型反例证明条件不满足时不生效。
- `520090` 接入使既有 `101003` 权威场景产生可解释迁移：装备 `500469` 后主人总 HP 伤害 `78158 → 78183`，trace 新增 `520090` 的施加、刷新与移除。已通过官方 character/verified-combat 生成器重建合同与派生哈希，未手改生成 JSON。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `24 → 25`，暂按场景假设 `0 → 0`，仍未解析 `20 → 19`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，PVE 被动最新为 `25 / 0 / 19`。
- census + 被动 + 统一运行时定向验收：3 个文件、44 个测试通过。
- character combat pipeline：1 个文件、17 个测试通过；canonical migration：1 个文件、4 个测试通过。
- 全部非 Machine Axis 单元/集成回归：149 个文件、926 个测试通过；Machine Axis 测试继续按 M11-B-R1 依赖排除，本线程未修改其实现、schema、fixture、CLI 或文档。
- K1 源码、测试与手册 Prettier 全过；定向 ESLint 0 error、3 个既有 warning；`git diff --check` 无空白错误（仅既有 CRLF 提示）。

#### K1-A11：控制资源图可达静态属性家族

状态：已完成（2026-07-30）。

证据与实现：

- 静态属性解析器改为只消费 `skillResourceMaps.elements` 明确引用且能由控制行为到达的元素，并继续要求可达根、包装器与属性叶节点精确全覆盖。同目录存在但未进入控制资源表的元素统一写入 `sourceGraph.unreachableAssetElements`，原因固定为 `not-referenced-by-control-resource-map`；不会因文件存在而执行旧图。
- 新闭环 `520002`，适用于 11 只奇波。控制行为分别以 `Self=0` 与 `PetOwner=7` 注入唯一可达元素 `520002005`；IL2CPP `EBattlePropertyType.SPEED_RATIO=45` 证明属性 45 为移动速度修正，实际数值合同为 `dynamicExtra=+1000`、离战清除。运行时在 `0ms` 生成一条 `targetKind=kibo` 与一条 `targetKind=actor` 命令，只作用于装备槽对应奇波和搭档，不扩散到其他队友。
- `520002000–004` 不在当前控制资源表中；其中旧闪避触发/清理图和属性 225 `+2000` 被明确保持不可达。金标证明运行命令中不存在这些元素或闪避属性，未装备奇波时也不生成任何 `520002` 效果。
- `520002` 存在来源文本差异：技能表写“移动速度增加 10%”，可达元素描述写“增加 15%”，但元素实际参数是属性 45、`dynamicExtra=1000`。目录以 `sourceTextDifferences` 同时保留两种文本主张，运行合同只采用数值元素配置，不把任一文本比例写回公式。
- 同一通用规则还闭环三个已逐项审计的静态图：`520026` 为 Self 闪避属性 225 `dynamicExtra=+1600`，并保留技能文本 16%/元素描述 15% 的差异；`520067` 为 Self 双防属性 3/4 `dynamicPercent=+2000` 与火/雷抗属性 62/68 `dynamicExtra=+1500` 的三个独立持久根；`520086` 为 Self 暴击属性 7 与暗增伤属性 60 `dynamicExtra=+2000` 的同一包装根。
- `520026001–003/006`、`520067001`、`520086001` 均不在各自控制资源表中，目录与运行反例证明它们不会生成命令。三个代表奇波在同一场景中只产生 5 条可达静态命令，全部指向各自 kibo 目标并保持到离战。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `25 → 29`，暂按场景假设 `0 → 0`，仍未解析 `19 → 15`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，PVE 被动最新为 `29 / 0 / 15`。
- census + 被动 + 统一运行时定向验收：3 个文件、46 个测试通过。
- 全部非 Machine Axis 单元/集成回归：`npm test -- --run --exclude 'src/__tests__/machine-axis/**' --maxWorkers 2`，149 个文件、928 个测试通过。默认高并发首次运行的 8 项失败均为资源争用造成的原有 5/15/30 秒测试超时，没有业务断言失败；未修改或放宽测试超时。
- K1-A11 源码、测试与手册 Prettier 全过；定向 ESLint 0 error、1 个既有 `RUBY_STAR_SKILL_BINDING` 未使用 warning；`git diff --check` 无空白错误（仅既有 CRLF 提示）。
- 本线程仍未修改 Machine Axis 实现、schema、fixture、CLI 或文档；M11-B-R1 依赖保持等待。

#### K1-A12：Player 容器团队投影与逐实体元素条件

状态：已完成（2026-07-30）。

证据与实现：

- 原生 `InjectToOwnElementBehavior.GetInjectTargets` 证明 `EDirectInjectTargetType.Player=15` 首先只解析为一个 Player 实体句柄，不等同 `AllHero=3`、`AllPet=4` 或 `AllyHero=16`。团队传播来自元素执行后的 `AliveElementSystem.AfterTeamElement`：`PlayerAllEntity=1000` 对本地受控 Player 枚举本地英雄、宠物、玩家奇波与坐骑支路，逐个 `CopyTo`、`SetExecutor` 后交给具体实体执行。当前无头场景把这份原生集合投影为全部 actor 与实际已装备 kibo；未向 M11 的 `actor | kibo | enemy` 目标合同增加虚构 Player 类型。
- `ChangePropertyElement.CopyTo/SetExecutor` 会把条件对象的 source/executor 重新绑定到每个团队副本。`520070` 的 `conditionType=1 / targetType=1 / checkType=0 / entityElementalType=128` 因而在每个具体目标上执行位重叠判断；`128` 对应 Thunder。该原生分支不读取 `subConditionType_Element=0` 或 `maxChangeCount=5`，目录显式记录二者为被忽略配置，未把它们误解释成叠层、倍率或上限。
- 角色元素只取 `scenario.actors[].elementId` 并转换为 `1 << elementId`；奇波元素只取 `scenario.mechanismConfiguration.actors[].loadout.gameDataReferences.kibo.record.element`，且先校验 record ID 与装备 ID 一致，复合元素按 token 合并 mask。不会从角色展示字段 `source.character.element.abbrName` 推断主元素，因此 Ruby `103002` 的“火、雷”展示不会把主元素为火的角色误判为雷。奇波引用缺失、错配或元素未知时生成带目标与来源的结构化 unresolved，绝不静默广播。
- 新闭环 `520054`：控制资源表唯一可达元素为 `520054001`，向 Player 容器注入属性 45 `dynamicExtra=+500` 的持久 replace/max-1 效果；`520054002` 保持 `not-referenced-by-control-resource-map`，运行时不会执行。多只来源奇波会保留各自场景开始命令，但相同 `(targetKind,targetId,effectId)` 通过同效果 replace 收敛，每个具体目标只有一份 stacks=1 数值。属性 45 当前没有移动调度消费者，本阶段只证明属性效果 `+500`，不宣称已改变动作移动或调度行为。
- 新闭环 `520070`：控制资源表唯一可达元素为 `520070002`，只向逐实体 mask 命中的雷角色/雷奇波注入属性 58 `dynamicExtra=+1300`；`520070001` 保持不可达。代表场景同时覆盖雷角色、复合雷奇波、非雷角色、非雷奇波与后台来源槽；真实木音普通攻击输入证明伤害事件的 `dynamicPropertyTrace` 含属性 58 `+1300`，且同场景有被动时的伤害高于移除效果时间线后的结果。
- 独立只读审查未发现 blocker；审查提出的两项合同收紧已落地：无条件的 `520054` 不再携带元素条件消费者 provenance，多来源同帧语义明确为 `same-effect-replacement-at-scenario-start`。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `29 → 31`，暂按场景假设 `0 → 0`，仍未解析 `15 → 13`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run data:sync-kibo-headless` 与 `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，PVE 被动最新为 `31 / 0 / 13`。
- census + 被动 + 统一运行时定向验收：3 个文件、48 个测试通过。
- 全部非 Machine Axis 单元/集成回归：`npm test -- --run --exclude 'src/__tests__/machine-axis/**' --maxWorkers 2`，149 个文件、930 个测试通过。
- K1-A12 源码、测试与手册 Prettier 全过；定向 ESLint 0 error、1 个既有 `RUBY_STAR_SKILL_BINDING` 未使用 warning；`git diff --check` 无空白错误（仅既有 CRLF 提示）。
- 本线程仍未修改 Machine Axis 实现、schema、fixture、CLI 或文档；M11-B-R1 依赖保持等待。

#### K1-A13：PlayerAllEntity 周期团队治疗与统一生命池

状态：已完成（2026-07-30）。完成口径为新战斗、单一 `520066` 来源的数值与生命周期闭环；多来源 Cover 首个保留来源、跨周期触发相位继承和同帧友方生命变更顺序仍是显式运行场景缺口，不计为已假定完成。

证据与实现：

- 新闭环 `520066`“常青树”，适用于 `500147 / 500148 / 500149`。`Player=15` 先向 Player 容器注入根 `520066001`，`PlayerAllEntity=1000` 再复制到本地 actor 与实际装备 kibo。`InjectToOwn.Start` 证明根 attacker/source 是持有 fixed skill 的玩法奇波；`AfterTeamElement` 只替换具体副本的 executor，不改原 attacker/source，因此治疗公式来源为装备奇波，被治疗 holder 为每个具体团队实体。
- `TimeEvent` 原生消费者证明根在首个正时间增量触发，之后只在 `elapsed > ordinal × 5000ms` 时触发；条件失败也消耗该周期，每次更新至多追赶一次。60 FPS 下金标 tick 为 `16.666667 / 5016.666667 / 10016.666667…ms`。根使用 Cover/max-1，持续到离战或技能停止；`triggerFrequency` 无上限，TimeEvent 路径不读取 counter/interval count 配置。
- 条件 `211` 精确为 holder 当前生命 / holder 最大生命 `< 1`。治疗 `520066002` 的 Formula104 以根 attacker 奇波 `MAXHP × 210 / 10000` 为基数，读取来源奇波属性 23 `SHOOT_HEALUP` 与具体 holder 属性 24 `SUFFER_HEALUP`，公式为 `base × (1 + source23 + target24)`，按 Q16 ties-to-even 后再按缺失生命钳制，名义最小值为 1。满血目标不产生治疗记录，死亡目标不会被复活。
- `function_3=201 / coefficient=4000` 存在于资产，但 `DamageElement.Parse/GetOutputHeal` 不读取它，运行时不会额外乘 0.4。技能表“2.1%”与元素描述“2%”的差异已保留，数值配置 `210` 为执行合同。
- M11 统一运行时新增彼此独立的 actor/kibo vital pool、正最大生命快照校验、动态 MAXHP 重算、逐 tick 治疗事件与三值输出；同 owner ID 的角色和奇波不会共享生命。canonical 输出保留根来源、公式来源、目标、tick、贡献来源、生命曲线与结构化 unresolved，不建立奇波专用旁路模拟器。
- 多只同被动奇波会按 native Cover 为每个目标收敛成一个根/时钟，同时保留全部 contributors；由于原生被动初始化顺序尚未证明，公式来源置空并阻断治疗，输出 `periodic-heal-cover-source-order-unresolved`。跨周期边界不伪造新根或首帧 tick，输出相位继承 unresolved；同一 tick 上存在直接/调参治疗等友方生命变更时，同样阻断周期治疗并输出顺序冲突诊断。根被移除、公式来源缺失、来源槽/拓扑错配、目标槽未知、时钟形状被篡改时均显式失败，不按零效果或通用效果运行。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `31 → 32`，暂按场景假设 `0 → 0`，仍未解析 `13 → 12`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run data:sync-kibo-headless` 与最终 `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，PVE 被动最新为 `32 / 0 / 12`。
- `verifiedKiboPeriodicHeal` 金标：1 个文件、20 个测试通过；census、生成、周期治疗、统一运行时、初始状态和周期边界组合验收：6 个文件、78 个测试通过。
- 全部非 Machine Axis 单元/集成回归：`npm test -- --run --exclude 'src/__tests__/machine-axis/**' --maxWorkers 2`，150 个文件、951 个测试通过。
- `npm run build` 通过（仅既有 Sass/chunk warning）；K1-A13 定向 ESLint 0 error、2 个既有未使用符号 warning；`git diff --check` 无空白错误（仅既有 CRLF 提示）。
- 本线程仍未修改 Machine Axis 实现、schema、fixture、CLI 或文档；M11-B-R1 依赖保持等待。

#### K1-A14：BeforeSkill 条件增伤与当前生命 Real 自伤

状态：已完成（2026-07-30）。完成口径为 `520044`“危险利爪”的可达属性条件、BeforeSkill 自伤、所有权、公式、事件顺序与生命池变更闭环；致死后的同步起播已证实，未来 Hit 是否被后续死亡 update 中止仍以运行时诊断显式暴露，不计为默认继续。`520046` 在本阶段只完成结构化证据提取，未在冷却状态尚未接入时虚报闭环。

证据与实现：

- `520044` 控制资源表只引用根 `520044002 / 520044003`，派生目标为 `520044004`；同目录 `520044001` 不在控制资源图中，固定记录为 `not-referenced-by-control-resource-map`，运行时不会执行旧 wrapper。
- `520044002` 在装备奇波上持久注入属性 21 `SHOOT_DMGUP`、`dynamicExtra=+7000`，但原生 `ChangePropertyConditionData` 为 `CurSkillTag=5 / Self=0 / Away=1`。`Away` 表示持续复核条件，只有该装备奇波当前技能包含 `PetUltraSkill=14` 时数值才生效；`maxChangeCount=5` 的原生消费者未把它当触发次数或叠层上限，目录保持 `opaque-not-used-as-trigger-limit`。无头核心把这份持续条件投影成最终有效动作时间线上的左闭右开 action window，不做战斗常驻增伤。
- `520044003` 的 `BeforeSkill=5 + CheckSkillType=11 + tag14` 以 `ElementOwner=11` 执行 `520044004`。原生 accepted SkillStart 顺序已闭环为：合法性检查、扣 SP、提交冷却、写 current-skill slot、BeforeSkill、自伤、写 current-skill id、SkillStart、SkillPlayer.Start；因此统一事件流固定为 `SP cost → cooldown → current-skill condition → vital damage → Hit`，资源不足或动作被拦截时不会自伤。
- Formula103 以装备奇波当前生命为 `self`，系数 `2000`，结果为 `roundToEven(max(1,current Kibo HP × 0.2))`。103 位于原生 block formula 列表，跳过 battle-config miscellaneous 倍率；Real damage 绕过 value shield 与 restraint，没有保 1HP，可把 1HP 降到 0。`function_3=201` 不被这条可达 Real 输出路径读取，不能额外乘 0 或 0.4；recoverSP 与 petRecoverSP 均为 0。
- `ignoreDamageEvent=1` 只可靠屏蔽攻击者侧 Before/AfterAttack，不能按字段中文名扩大为“所有受/承伤事件都关闭”；receive-side 是否派发仍取决于目标 main-control 状态，目录和 vital 事件保留 `dispatch-depends-on-main-control-status-unresolved`。致死自伤不会回滚资源、冷却或同步 SkillPlayer.Start，但未来 Hit 的死亡调度仍输出 `kibo-passive-self-kill-future-hit-death-scheduler-unresolved`。
- 生成目录新增通用 `equipped-kibo-before-skill-composite-effect`、`conditionalPropertyEffects[]` 与 `beforeSkillTriggers[].vitalChanges[]`；生成层新增 `vitalChangeCommands`，并严格校验动作 actor、装备 kibo 与槽位归属。运行时复用统一 `effectRuntimeTimeline`、友方 kibo vital pool、Q16 Real 伤害公式和结构化 `vitalEvents`，没有新增奇波旁路模拟器。
- 技能文本写“释放特技后”，原生触发实际发生在资源/冷却提交后但 SkillStart 前；`sourceTextDifferences` 已保存文本主张、运行证据和采用的原生顺序，没有用文本覆盖运行合同。
- `520046` 已提取 wrapper `520046001`、静态属性 57 `WATER_SHOOTDMGUP +2000`、tag14/tag15 BeforeSkill 与属性 115 `CD_SKILL dynamicPercent=-500`、最多 4 层的完整图，但在 A14 生成物中继续以 4 条 runtime gap 保持 unresolved；该项不计入闭环数。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `32 → 33`，暂按场景假设 `0 → 0`，仍未解析 `12 → 11`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run data:sync-kibo-headless` 与 `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，PVE 被动为 `33 / 0 / 11`。
- census、被动生成、周期生命、BeforeSkill 复合与统一运行时定向验收：5 个文件、75 个测试通过；其中真实烈豹 `500216 / 50021601` 金标覆盖 tag14 正例、tag13 反例、属性快照、1000→800 自伤、护盾绕过、动作窗口到期、装备错位、1HP 致死诊断与 99SP 阻断。
- 全部非 Machine Axis 单元/集成回归：`npm test -- --run --exclude 'src/__tests__/machine-axis/**' --maxWorkers 2`，151 个文件、958 个测试通过。
- `npm run build` 通过（仅既有 Sass/chunk warning）；A14 文件 Prettier 全过，定向 ESLint 0 error、1 个既有 `clampInteger` 未使用 warning；`git diff --check` 无空白错误（仅既有 CRLF 提示）。
- 本线程仍未修改 Machine Axis 实现、schema、fixture、CLI 或文档；M11-B-R1 依赖保持等待。

#### K1-A15：accepted-skill-start 冷却叠层与静态水增伤

状态：已完成（2026-07-30）。完成口径为 `520046`“急流”的可达静态属性、PetUltra/PetJoint accepted SkillStart 触发、当前次/后续冷却顺序、叠层上限、冷却下限、资源与动作拦截回滚及统一效果轨迹闭环；受控非水 Hit 只用于元素消费者反例，不替代目标五只奇波当前缺失的真实可运行非水公开动作证据。

证据与实现：

- 新闭环 `520046`，适用于 `500026 / 500066 / 500067 / 500068 / 500110`。控制资源图的可达静态属性 `520046002` 为属性 57 `WATER_SHOOTDMGUP dynamicExtra=+2000`；`520046003` 在 accepted SkillStart 上以 skill tag 14（PetUltra）或 15（PetJoint）触发 `520046004`，后者为属性 115 `CD_SKILL dynamicPercent=-500`、stack mode 4、最多 4 层、离战清除。
- 原生顺序闭环为“当前动作先按旧层计算并 Cast/刷新冷却，再由 BeforeSkill 增加新层”。连续合格动作的有效冷却严格为 `100% → 95% → 90% → 85% → 80%`，第 5 次及以后保持 80%；当前动作绝不追溯消费刚增加的层。
- 冷却公式按 `base × (1 + allCDPercent + slotCDPercent)` 计算，并以 `base × skillMinCdPer` 钳制；Pet/KiBo 的 `SKILL_MIN_CD_PER=2500`，即 25%。通用会话先组合既有外部冷却适配器结果与本被动的原生 delta，再执行同一最低值钳制；直接会话金标证明 100ms 外部结果叠加 -200ms 原生 delta 时收敛到 250ms，而不是负数或重复乘算。`DEBUG_AllSkillCDMultiValue` 默认 0，只记录为调试覆盖证据，不进入正常 PVE 公式。
- 新增目录驱动的 `verifiedKiboCooldownModifierSession`，按装备 actor/kibo 绑定和控制数据真实 `skillTag` 编译定义，不按奇波名称或 ID 特判。`setCD=false` 的合法 accepted SkillStart 仍增加被动层，但不伪造 CoolDown.Cast；tag 13、未知 tag、未装备、动作规则阻断、冷却阻断和资源不足均不提交层。
- 动作准入改为稳定重放：资源预检发现阻断后，从空冷却/被动状态重新执行规则，保证后来确认不可执行的动作不会遗留冷却窗口或 accepted transition。硬动作规则先于冷却消费；同帧仍按 `startMs + action.id` 确定排序。诊断公开每次 accepted transition、旧/新层、条件结果、冷却策略和未解析 skillTag。
- 被动生成层在 `0ms` 生成属性 57 静态命令，并只为已接受且匹配 tag 的动作生成 `accepted-skill-start` 叠层命令；统一事件优先级固定为 `COOLDOWN_START` 后再施加新层，下一动作的属性快照和冷却评估共同消费同一状态。
- 真实金标使用装备水奇波 `500067` 的主人动作 `10100312` variant 1 与破韧技 `50006704` 成对执行五次：奇波侧窗口依次为 `5000 / 4750 / 4500 / 4250 / 4000ms`，层数为 `0→1→2→3→4→4`，且真实水元素 Hit 的动态属性轨迹读取属性 57。`500066` 主动技 `502004` 的 tag 13 反例不加层；99 SP 的 `50006701` 被资源拦截后既无冷却窗口也无叠层，后续破韧仍从 0 层开始。
- 受控非水反例只把同一已验证 Hit 模板的元素改为火，用来证明静态属性 57 命令虽已安装但不会进入该 Hit 的动态属性轨迹；该分支明确标记 `test-controlled-element-branch`，属于测试场景控制，不计为真实公开动作闭环或证据假设数量。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `33 → 34`，暂按场景假设 `0 → 0`，仍未解析 `11 → 10`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run data:sync-kibo-headless` 与 `npm run audit:kibo-headless`：通过，分母保持 122 / 366 / 172 / 44 / 122，PVE 被动更新为 `34 / 0 / 10`。
- census、被动生成、BeforeSkill、冷却会话、动作规则与统一运行时组合验收：6 个文件、68 个测试通过；`verifiedKiboCooldownPassive` 单文件 5 个金标全部通过。
- A15 实现完成后的全部非 Machine Axis 单元/集成回归以单 worker 执行：152 个文件、962 个测试通过；随后新增的第 5 个受控非水分支已纳入上述定向验收。单独较重的 character combat pipeline 17 个测试通过。
- `npm run build` 通过（仅既有 Sass/chunk warning）；相关文件 Prettier 全过，定向 ESLint 0 error、1 个既有 `RUBY_STAR_SKILL_BINDING` 未使用 warning；`git diff --check` 无空白错误（仅既有 CRLF 提示）。
- 本线程仍未修改 Machine Axis 实现、schema、fixture、CLI 或文档；M11-B-R1 依赖保持等待。

#### K1-A16：PetOwner 逐 Hit 元素条件与角色 SPGETUP 叠层

状态：已完成（2026-07-30）。完成口径为 `520019`“嫩叶”的真实装备所有权、PetOwner AfterDamage 逐 Hit 条件、角色 `SPGETUP` 五层叠加、公共 SP 消费、离场清除与 fail-closed 诊断闭环；同目录不可达治疗元素未接入运行时。

证据与实现：

- 新闭环 `520019`，适用于 `500023 / 500024`。控制行为以 `PetOwner=7` 注入根 `520019001`；根在 `AfterDamage=2` 检查 `CheckDamageType=4`，仅接受 `All=9` 与 `Aqua=6` 或 `Lumiere=8` 的组合，再以 `Source=2` 把 `520019003` 施加给伤害来源角色。效果为属性 105 `SPGETUP dynamicExtra=+400`、stack mode 4、最多 5 层、无时长、`clearType=80`。`520019002` 未进入控制资源图，继续以 `not-referenced-by-control-resource-map` 记录为不可达旧治疗资产。
- AfterDamage 生产者按装备槽建立 kibo、actor 模板 ID 与运行实体 ID 的双身份绑定，修复了把模板 owner `107003` 直接与实体 `actor-107003` 比较而导致真实角色动作无法触发的问题。缺失、冲突或错配的 owner/槽位均输出结构化 unresolved；不再按名称或 ID 特判奇波。
- 每个已命中的真实 Hit 独立读取 damage type 与 elemental type；水、光命中在 `hit+0.001ms` 触发，火元素、未知元素和 `willHit=false` 均不生成效果。当前 Hit 的 SP 回复读取旧层，效果只影响后续 Hit 与自动回复；连续五次合格触发的 raw 层值严格为 `0 → 400 → 800 → 1200 → 1600 → 2000`，第六次保持五层。
- `battle_info` 证据确认属性 105 是 ratio、`attrDefault=0`、最小值 0；原生 `SetAllBasePropertyValue` 会在动态属性出现时从默认值物化缺失属性。verified-combat 生成合同新增 `defaultRaw`，运行时只在存在真实动态 modifier 时物化默认值，并以 `battle_info.attrDefault-on-dynamic-property-materialization` 标记来源，不把全局缺失属性静默补零。
- 公共资源公式开始实际消费角色 `SPGETUP` 后，101010 权威场景发生可解释迁移：角色当前 SP `35.35611 → 35.418732`、自动回复合计 `19.953224 → 20.015864`，奇波当前 SP `79.271744 → 81.026352`；完美闪避首个角色/奇波回复分别 `0.169998 → 0.179474`、`0.649887 → 0.686127`。官方 character/verified-combat 生成器已重建金标与 canonical hashes；其他三份迁移金标 replay/summary 保持不变。
- 公共 `effectRuntimeTimeline` 统一携带 `clearType / clearTypeFlags / expirationTriggers / clearCarrierActorId`。bit 8 按来源离场清除，bit 16 按效果携带者/目标离场清除，并同时识别数值位掩码和字符串标志；跨目标 A→B 金标证明 A 离场只清 bit 8，B 离场才清 bit 16。bit 64 的合同明确为 battle scope：场景 duration 和 cycle boundary 只是同一战斗的观测边界，不伪造战斗退出；新 scenario 实例默认不继承状态。
- 目录中任何带 `runtimeGaps` 的定义都会在通用生成入口被 fail-closed 排除，并把原因暴露到 unresolved。注入“已识别机制族 + runtimeGaps”的测试锁定零命令，防止未来目录误把半闭环定义当作可运行。
- 真实阿比 `10700301` variant 6 / control `10700315` 与装备嫩叶奇波形成端到端金标：覆盖五次水命中、光命中、火反例、miss、错误 owner、五层封顶、旧层 SP 结算、持久状态、新战斗隔离和实际角色切换清除。

本小阶段三类计数变化：

- PVE 被动机制：已由证据闭环 `34 → 35`，暂按场景假设 `0 → 0`，仍未解析 `10 → 9`。
- fixed skill 分类保持 `147 / 0 / 25`；PVP 被动分类保持 `122 / 0 / 0`；公开动作保持 `132 / 53 / 181`；`machineOptimizationReady=0`。

验收：

- `npm run data:sync-kibo-headless`、`npm run audit:kibo-headless` 与 `npm run audit:verified-combat`：全部通过。分母保持 122 / 366 / 172 / 44 / 122，PVE 被动更新为 `35 / 0 / 9`；verified-combat 为 clean，563 个候选动作、620 个 control、521 个 action binding、1853 个 Hit binding、337 个 effect binding、103 个 unresolved、18 个 validator 通过。
- A16 PetOwner 金标 + effect lifecycle：2 个文件、20 个测试通过；census、被动生成、A16、effect timeline、verified runtime、冷却、BeforeSkill 与 action diagnostics 组合：8 个文件、89 个测试通过；character combat pipeline：1 个文件、17 个测试通过。
- 全部非 Machine Axis 单元/集成回归首轮准确捕获 4 组未迁移的 canonical hashes；按官方生成的四份 M10 金标更新后，migration 单文件 4 个测试通过，最终全量为 153 个文件、974 个测试全部通过。
- `npm run build` 通过（仅既有 Sass/circular chunk/large chunk warning）；关键 A16 文件 Prettier 全过；定向 ESLint 0 error、5 个既有 console/未使用符号 warning；`git diff --check` 提交前复核。
- 本线程未修改 Machine Axis 实现、schema、fixture、CLI 或文档；当前 HEAD 已包含独立完成的 M11-B-R1，本阶段没有暂存其工作目录或临时产物。

K1 当前三类计数：

- PVE 被动机制：已由证据闭环 35，暂按场景假设 0，仍未解析 9（相对 K0：1 → 35 / 0 → 0 / 43 → 9）。
- fixed skill 分类保持 147 / 0 / 25；公开动作保持 132 / 53 / 181。

可执行分批计划：

1. K1-A：按 Unity 元素图结构聚类剩余 9 个 PVE 被动；下一批先补证并闭环 `520092` 的有限周期 DOT/治疗与 Cover 相位，再处理条件属性、受击触发与限时容器。每个家族至少一个正例、条件反例和过期/未装备反例。
2. K1-B：解析资源联动、治疗/护盾、延迟/派生、协同/召唤、前后台与来源归属；独有状态机放入可审计机制模块。
3. K1-C：完成 44 项全量 provenance/diff 复核；文本只做交叉验证，`f/b` 字段差异和 6 条未精确匹配的 trait 文本保持显式。
4. K2-A：优先关闭当前 66 个不可运行动作，再按星决技效果目标/触发帧/生命周期缺口推进 0 距离动作闭环。
5. K2-B：扩展 Machine Axis 无头场景 fixture 与金标，覆盖纯伤害、削韧、属性、叠层、条件、资源、延迟/派生、前后台/来源归属。

## 下一阶段目标

推进 K1-A17：先补齐 `520092`“生命吸取”的剩余运行证据，再闭环有限周期 DOT、治疗与 Cover 相位。四只实际引用奇波为 `500179 / 500180 / 500181 / 500360`；完整可达图已确认是 `520092001 AfterDamage → 敌方 520092002 周期容器 → 520092003 DOT`，以及 `520092001 → 自身 520092004 周期容器 → 520092005 治疗`，五个资源元素全部可达、无孤儿。

当前证据已闭环两个容器均为 5 秒、1 秒间隔、60Hz 下首个正时间步开始共 5 tick；Cover 刷新完整 5 秒寿命，但保留已有容器的 tick 相位与首个公式来源，不重启首 tick、不叠第二容器。DOT 每 tick 读取装备奇波实时攻击的 20%，类型为 `Dot=7`、无元素、削韧系数 20%、不递归派发攻击者侧伤害触发；治疗每 tick 读取同一奇波实时攻击的 2%，目标为奇波自身，复用统一治疗增益、缺失生命钳制与死亡拒绝。文本未披露削韧，且内部存在“生命虹吸/生命吸取”命名差异，均保留 provenance/diff。

进入实现前必须补证或显式阻断三项：DOT 的精确暴击资格；不同奇波同时命中同一敌人时“首注入来源”的稳定全序；来源死亡而子容器未级联删除时 DOT 是否继续。前一项若不能证明则不得执行伤害；后两项可在冲突场景输出结构化 unresolved 并阻断结算。金标至少覆盖单来源五跳、重复命中 Cover 刷新不重置相位、统一 Hit 的伤害/削韧、统一生命池治疗、满血/死亡/未命中反例、多来源冲突与来源死亡。只有运行合同和反例都闭环后，计数才可从 `35 / 0 / 9` 更新为 `36 / 0 / 8`；否则保持当前数字。`520015` 继续等待统一 incoming-damage 生产者。Machine Axis 已由独立 R1 接通，但 A17 仍不进入其实现、schema、fixture、CLI 或文档。

## 验收日志

- 2026-07-29：执行 `git status --short --branch`。分支为 `master...origin/master [ahead 615]`；确认存在 M11-B/canonical core/文档/报告的既有未提交改动，后续工作以增量方式保留。
- 2026-07-29：K0 census 与第一批 K1 runtime 验收通过。未修改网页 UI、视觉时间轴、包体或前端性能代码。
- 2026-07-29：K1-A1 自身静态属性家族完成，新增 10 个来源闭环定义，PVE 被动计数更新为 12 / 0 / 32；下一目标切换到 K1-A2 多根静态图和 PetOwner/Player 所有权。
- 2026-07-29：K1-A2 多根 Self 静态图完成，新增 3 个来源闭环定义，PVE 被动计数更新为 15 / 0 / 29；下一目标切换到 K1-A3 PetOwner/Player 所有权。
- 2026-07-29：K1-A3 PetOwner 与 Self+PetOwner 所有权完成，新增 2 个来源闭环定义，PVE 被动计数更新为 17 / 0 / 27；下一目标切换到 K1-A4 条件枚举与触发家族。
- 2026-07-29：K1-A4 TargetEntityType 条件与伤害后触发完成，新增 2 个来源闭环定义，PVE 被动计数更新为 19 / 0 / 25；全部非 Machine Axis 回归 149 文件、917 测试通过；下一目标切换到 K1-A5 CheckSkillType/PetUltraSkill 条件。
- 2026-07-29：K1-A5 CheckSkillType/PetUltraSkill 条件与元素生命周期触发上限完成，新增 1 个来源闭环定义，PVE 被动计数更新为 20 / 0 / 24；全部非 Machine Axis 回归 149 文件、918 测试通过；下一目标切换到 K1-A6 BeforeSkill 双目标叠层家族。
- 2026-07-29：K1-A6 BeforeSkill 双目标叠层家族完成，新增 1 个来源闭环定义，PVE 被动计数更新为 21 / 0 / 23；全部非 Machine Axis 回归 149 文件、920 测试通过；下一目标切换到 K1-A7 伤害后多根效果图。
- 2026-07-29：K1-A7 AfterDamage 多根效果图完成，新增 1 个来源闭环定义，PVE 被动计数更新为 22 / 0 / 22；全部非 Machine Axis 回归 149 文件、921 测试通过；下一目标切换到 K1-A8 嵌套状态与受击来源语义。
- 2026-07-29：K1-A8 复合静态/触发容器完成，新增闭环 `520082`，并把 `520018` 收紧为带结构化证据的显式未解析项；PVE 被动计数更新为 23 / 0 / 21；全部非 Machine Axis 回归 149 文件、923 测试通过；下一目标切换到 K1-A9 伤害后派生攻击。
- 2026-07-29：K1-A9 AfterDamage 派生伤害统一 Hit 闭环完成，新增闭环 `520041`，并用固定地址反汇编排除 `520041/520018` 的 sustain 配置字段伪缺口；PVE 被动计数更新为 24 / 0 / 20；全部非 Machine Axis 回归 149 文件、925 测试通过；下一目标切换到 K1-A10 AfterDamage→Self 攻击叠层图 `520090`。
- 2026-07-29：K1-A10 AfterDamage→Self 攻击叠层闭环完成，新增闭环 `520090`，把同目录未引用的 `520090003–006` 保持为显式不可达资产；PVE 被动计数更新为 25 / 0 / 19；全部非 Machine Axis 回归 149 文件、926 测试通过；下一目标切换到 K1-A11 Self+PetOwner 静态移速图 `520002`。
- 2026-07-30：K1-A11 控制资源图可达静态属性家族完成，新增闭环 `520002 / 520026 / 520067 / 520086`，所有未进入控制资源表的旧元素保持显式不可达；PVE 被动计数更新为 29 / 0 / 15；全部非 Machine Axis 回归 149 文件、928 测试通过；下一目标切换到 K1-A12 Player/全队作用域 `520054 / 520070`。
- 2026-07-30：K1-A12 Player 容器团队投影与逐实体元素条件完成，新增闭环 `520054 / 520070`，PlayerAllEntity、逐副本元素 mask、来源槽、孤儿元素和缺失元素诊断均有金标；PVE 被动计数更新为 31 / 0 / 13；全部非 Machine Axis 回归 149 文件、930 测试通过；下一目标切换到 K1-A13 周期团队治疗 `520066`。
- 2026-07-30：K1-A13 PlayerAllEntity 周期团队治疗与统一生命池完成，新战斗单来源 `520066` 的根归属、5 秒时钟、Formula104、独立 actor/kibo vital pool 与结构化诊断均有金标；多来源 Cover 首个来源、跨周期相位和同帧友方生命顺序仍显式未解析。PVE 被动计数更新为 32 / 0 / 12；全部非 Machine Axis 回归 150 文件、951 测试通过；下一目标切换到 K1-A14 BeforeSkill 复合图 `520044 / 520046`。
- 2026-07-30：K1-A14 BeforeSkill 条件增伤与当前生命 Real 自伤完成，新增闭环 `520044`；tag14 连续属性条件、ElementOwner、自伤 Formula103、Q16/最低 1/可致死、护盾绕过、资源与冷却先行、文本差异和未来 Hit 死亡调度诊断均有金标。`520046` 保持结构化 unresolved，未虚增完成率。PVE 被动计数更新为 33 / 0 / 11；全部非 Machine Axis 回归 151 文件、958 测试通过；下一目标切换到 K1-A15 `520046` accepted-skill-start 冷却叠层。
- 2026-07-30：K1-A15 accepted-skill-start 冷却叠层与静态水增伤完成，新增闭环 `520046`；当前次旧层/后续新层、tag14/15、tag13 反例、四层封顶、25% 下限、外部冷却组合、`setCD=false`、资源/规则阻断回滚及水元素属性消费均有金标。PVE 被动计数更新为 34 / 0 / 10；全部非 Machine Axis 回归 152 文件、962 测试通过，新增受控非水分支后定向 6 文件、68 测试通过；下一目标切换到 K1-A16 `520019` PetOwner 逐 Hit 元素条件与角色 SPGETUP 叠层。
- 2026-07-30：K1-A16 PetOwner 逐 Hit 元素条件与角色 SPGETUP 叠层完成，新增闭环 `520019`；真实 owner 绑定、水/光条件、火与 miss 反例、五层上限、旧层 SP 结算、属性 105 原生默认值物化、bit 8/16/64 生命周期和 `runtimeGaps` fail-closed 均有金标。PVE 被动计数更新为 35 / 0 / 9；首轮全量回归捕获并修复 4 组过期 canonical hash，最终全部非 Machine Axis 回归 153 文件、974 测试通过；下一目标切换到 K1-A17 `520092` 有限周期 DOT/治疗与 Cover 相位。
