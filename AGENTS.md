# AGENTS.md

本文件是 `promilia-axis-tool` 的项目级协作规则。后续 Codex 或开发者进入本仓库时，应先阅读本文，再结合 `PROJECT_MANUAL.md`、`DEVELOPMENT_PLAN.md`、`README.md`、`ARCHITECTURE.md`、`DATA_STRUCTURE_CHANGES.md` 和 `TIMELINE_FEATURES.md` 开始工作。

## 项目定位

- 项目名称：`promilia-axis-tool`
- 中文定位：蓝色星原战斗排轴编辑器
- 目标：为《蓝色星原》提供纯前端排轴、技能时序、伤害统计、资源监控、循环验证和数据维护工具。
- 当前主参考项目：`C:\Codex\AzPr Axis\Endaxis`
- 误参考项目：`Atlos` 不是当前目标参考项目，除非用户明确要求，不要继续围绕 Atlos 做架构对照。

## 技术栈

- Vue 3 + Composition API
- Vite
- Pinia
- Element Plus
- vue-i18n
- ECharts
- SCSS
- Vitest + Vue Test Utils

常用命令：

```powershell
npm run data:generate
npm run build
npm run test -- --run
npm run dev
```

`npm run lint` 当前带 `--fix`，会自动改文件；运行前先确认是否需要格式修复。

## 当前架构事实

- 游戏数据当前来自 `public/gamedata/gamedata.json`，由 `src/store/gamedata.js` 通过 `/gamedata/gamedata.json` 加载。
- 新版真实 AzPr 数据管线已建立：`npm run data:generate` 从 `C:\PC2\Codex\AzPr` 生成 `src/data/generated/`，访问层位于 `src/data/azprGenerated.js`。
- 新版最小领域模型已建立：`src/domain/projectSchema.js` 定义 `Project` / `Actor` / `Enemy` / `Action` schema 与校验器。
- 第一条真实数据垂直切片位于 `src/domain/fixtures/firstVerticalSlice.js`，当前使用末音、哈库茵剑舞和迅狼。
- 新版最小模拟运行时已建立：`src/simulation/` 提供 compiler、engine、mechanics、projection 和 `runSimulation()`。
- 新版工作台第一屏已建立：`src/views/Workbench.vue`，路由为 `/workbench`，组件位于 `src/features/workbench/`。
- 工作台最小可编辑能力已建立：`src/features/workbench/PropertiesPanel.vue` 可选择真实角色/技能/敌人并编辑动作开始时间和等级。
- 工作台时间轴最小交互已建立：可追加动作、选择动作、删除动作，并让多动作进入同一模拟汇总。
- 工作台时间轴拖动已建立：`TimelineGridPreview` 可水平拖动动作块，并按 `60fps` 的 1 帧网格吸附更新 `startMs`。
- 工作台草稿保存/恢复已建立：`src/domain/workbenchDraftStorage.js` 只保存新版 `selection`、`actionDrafts`、`selectedActionId`，不接旧 `skillBlocks`。
- 工作台基础编辑效率已提升：支持复制动作、`Delete` / `Backspace` 快捷删除、方向键微调时间和草稿脏状态提示。
- 工作台动作工具箱雏形已建立：支持技能、等待、注释三类动作；等待/注释进入同一 `actionDrafts -> Project -> simulation` 链路，但不伪造伤害。
- 工作台敌人与资源面板雏形已建立：敌人等级/生命倍率/防御倍率进入新版项目模型；资源面板只读取 `simulationResult.resourceTimeline`。
- 工作台事件动作已建立：支持资源事件和敌人事件动作；资源事件进入 `RESOURCE_CHANGE` 与 `resourceTimeline`，敌人事件进入 `ENEMY_EVENT` 日志。
- 工作台切人动作和多角色 actor 雏形已建立：默认生成主/副两个真实角色 actor，`switch` 动作进入 `SWITCH` 事件日志，暂不改变伤害公式。
- 工作台时间轴角色轨道雏形已建立：`TimelineGridPreview` 按 actor 显示角色轨道，非角色事件进入系统轨，动作块和伤害 marker 都带稳定轨道标记。
- 工作台时间轴缩放和持续时间调整雏形已建立：支持 1x-4x 视图缩放，动作块右侧手柄可拖拽调整 `durationMs`。
- 工作台技能动作形态模型已修正：`普攻`、`重击`、`闪击`、`跃击` 等按独立动作形态处理；普攻段数从技能描述解析，当前不编造单段倍率。
- 工作台动作库已切换为 Endaxis 风格直接动作目录：只列 `普通攻击`、`重击`、`闪击`、`跃击`、`星鸣技`、`星结合击`、`星决技`、`星携技`、`极限反击`、`完美招架`，被动技能不列入动作库。
- 工作台伤害投影已建立公式分层雏形：`formulaBreakdown` 中当前攻击和动作形态倍率是已应用层，敌人防御/抗性/暴击/增伤仍是 `applied: false` 的未应用层；其中敌人防御/抗性 source 已接入 `combat-formula-evidence.json`。
- 模拟结果必须按动作追踪三类数值变化：敌人 HP 伤害、敌人韧性削减、自身能量变化。当前 `actionResultTimeline[]` 已固定三槽结构；HP 使用现有 raw 投影，韧性和充能公式仍是待解析占位，不能混入 HP 伤害公式。
- 当前重构阶段采用框架优先：除已知必要候选外，不要求先确认每个角色、每个技能在每一帧的具体动作；细帧、命中次数、owner/target 归属和 buff runtime 条件先作为后续 evidence 层补充。现阶段优先保证三值状态流、曲线聚合、候选/占位/真实采样输入契约和 Workbench 展示稳定。
- 数据生成器已建立 `combat-formula-evidence.json`：敌人属性链和元素减免字段来源可追溯，但 `skillsub_ele_value.elementId -> element_formula.id` 当前无直接匹配，仍需 asset/效果节点追踪。
- 数据生成器已建立 `skill-asset-evidence.json`：`C:\PC2\Codex\AzPr` 当前没有 `Config/Battle/Skill`、`SkillPreload`、`SkillList` 实体资源时，应按项目规则使用 `C:\Codex\AzPr Extractor` 的 Unity 导出资源；当前 `SkillList` 中 4134 个 `skill_control_*.asset` 目录可用，120 个当前技能中 116 个已匹配，4 个 `*62` 技能缺失。
- `skill-asset-evidence.json` 已新增 `effectLaneCandidateSummary` / `effectLaneCandidates`：用于按 HP 伤害、韧性削减、自身能量变化、元素效果、动作时序、表现资源分类 `skill_control` 候选轨道；这只是 JSON 解析后的名称/字符串模式候选，尚未解引用 `behaviorList` 或确认公式。
- `skill-asset-evidence.json` 已新增 `behaviorReferenceSummary` / `effectLaneBehaviorChains`：用于把 `behaviorList[].m_PathID` 解到同目录目标 MonoBehaviour；当前末音 `10900101` 的 HP 候选已能追到碰撞行为字段和外部 `elementBaseDatas` 引用，但 `m_FileID = 2` 外部对象仍未解析成公式。
- `skill-asset-evidence.json` 已新增 `skillResourceMapEvidence`，并会把行为对象里的外部 `elementBaseDatas` 匹配到根 `skillResourceMaps[].elements`；当前末音 `10900101` 的外部 element 引用已能归属到 `subSkillId`、`stateName` 和 hitEffects，但 element 对象本体仍未导出。
- `skill-asset-evidence.json` 已新增 `scriptTypeCandidate` 和 `elementTypeCatalogEvidence`：当前末音 `10900101` 的 HP 候选行为以字段签名匹配 `InjectToTargetKeyFrameBehaviorData`，IL2CPP element 类型目录记录 `TSpElementParams` 与 `DamageElement`；这些仍是候选证据，不能当作已解析出的外部 element 对象或最终公式。
- `skill-asset-evidence.json` 已新增 `externalElementObjectEvidence`：通过 `scripts/resolve-azpr-element-objects.py` 解析 `skill_control` 的 `m_FileID = 2` external element 对象本体；当前末音 `10900101` 的 8 个 PathID 全部解析到 `d_assets_resourcesassets_config_battle_element_assets`，其中 `TDamageElementParams` 暴露 `formulaParams`、`weakBreakDamageRate`、`recoverSP/petRecoverSP` 等三值计算候选字段。
- `skill-asset-evidence.json` 已新增 `damageElementFieldMappingEvidence`：把 `TDamageElementParams` 字段拆成 HP 伤害、敌人韧性削减、自身能量变化三条候选链；当前末音 `10900101` 的 3 个 damage element 均已映射，`109001081` / `109001306` 已桥接到 12 行 `skillsub_ele_value.valueParam` 等级值。`109001251` 对当前技能直连仍是 `skillsub-element-level-bridge-missing`，但 `skillLevelBridge.relatedElementLevelBridge` 已找到 `10900125 / ground slot 207` 的 12 行关联 A/G 等级链候选，继承/应用未确认。该证据仍不能直接当作最终公式。
- 寒悠悠 `101003` 的 skill_control 已通过 AzPr Extractor 聚焦重导获得真实 MonoBehaviour JSON；生成器已把 `攻击框/命中` 识别为 HP 候选、`抗击` 识别为韧性候选，并把 `elementBaseDatas`、`elementDataList`、`elementIdDatas` 合并为元素引用来源。当前 `10100301/12/13/22` 已能解析动作帧、外部 Element 和 `TDamageElementParams` 候选，`10100361/62` 仍缺动作轨 timing evidence。
- `formulaExecutionMatrixSummary.hitBindingGap.externalElementBinding` 已能把非普攻缺口动作的 `攻击碰撞 / Skill0_6 / subSkill 109001011` 候选 PathID 追到外部对象；当前重击/闪击/跃击都命中 `109001251 / ast_109001251 / TDamageElementParams`，并暴露 HP、削韧、充能字段候选。`hitBindingGap.elementSourceAlignment` 已确认来源分叉：action-level / matrix element 来自 `skill_logic.currentLevel.elementValues` 的 `109001081 / 109001306`，外部 DamageElement 来自 `skill_control.elementBaseDatas` 的 `109001251`，两侧没有 element 重叠；`externalElementBindingSummary` 能显示 `关联等级链 3/3`、`参数来源候选 3/3`、`应用入口候选 3/3`、`原生入口 3/3`、`反汇编片段 3/3`、`充能探针 3/3`、`构造探针 3/3`、`归属探针 3/3` 和 `采样契约 3/3`。`runtimeParameterSourceEvidence` 当前把 `Skill0_6/subSkill 109001011/hitEffects 11_109001_133, 11_109001_005 -> element 109001251 -> derivedSkillId 10900125 -> 末音 ground slot 207` 固化为运行时参数来源候选；`runtimeApplicationTraceEvidence` 当前把 HP 链路对到 `DamageElement + FormulaUtility + OutputDamageData`，削韧链路对到 `FormulaUtility.GetOutputWeaknessDamage + WeakBreakSystem`，充能链路对到 `DamageElement.RecoverSP + RecoverSPArgs + SPSystem`；`nativeMethodSymbolEvidence` 确认 27 个目标 IL2CPP 原生入口，`nativeDisassemblyEvidence` 确认 9 个目标反汇编片段，`selfEnergyRuntimeFormulaProbe` 已把 `recoverSP/petRecoverSP/recoverInterval` 字段复制、`m_recoverSP > 0` 门控和 `SPSystem.RecoverSP.delta` 更新路径固化为未应用探针；`sourceToArgsProbe` 进一步确认 `DamageElement.RecoverSP` 会把 `m_recoverSP` 写入 `RecoverSPArgs.baseDelta`，把 `m_recoverSP` 经 runtime modifier 推导到 `delta`，把 `m_petRecoverSP` 经同路径推导到 `petDelta`，把 `m_recoverInterval` 写入 `interval`，并在该路径写 `tagType = AttackRecoverySp(0)`；`ownerShareIntervalProbe` 进一步确认 `SPSystem.OnTransmit` 的 `0x12F` 分支会使用 `RecoverSPArgs.id/interval` 做节流，并按 `sharePercent/petSharePercent/mainPetSharePercent` 改写 `baseDelta/delta/petDelta` 后回传；`runtimeSamplingProbe` 已定义 runtime hook / 离线导入采样契约，并能通过 `metadata.runtimeSampleCaptures` 消费手动 fixture 验证 `109001081` 的 RecoverSP 导入链路。当前仍缺 C# 方法体、IDA/Ghidra 伪代码或真实运行时 hook 调用顺序，hit 归属、等级继承、覆盖顺序、真实 SPGETUP/SPGETUP_ATK 运行时属性值、recoverInterval 节流语义、共享目标筛选和运行时应用仍未确认。
- `damageElementFieldMappingEvidence.skillLevelBridge.formulaParamAlignment.parameterSummaries` 已记录 `valueParam` 与 `formulaParamValues` 同编号槽位关系：当前 `109001081 / 109001306` 的 `1 / A` 是等级覆盖候选，1-12 级 `1600 -> 3360`、每级 +160；`7 / G` 是常量直连匹配，1-12 级恒为 `10000`。这些仍是候选关系，不能直接当作最终公式。
- `hpDamage.formulaFunctionEvidence` 已记录 `TDamageElementParams.formulaParams.function_1/function_2` 到 `element_formula.id` 的候选公式行：当前末音 `10900101` 的 3 个 damage element 合计 6 条引用全部命中，`function_1 = 1 -> G/10000`，`function_2 = 2 -> (self.ATK[0]*A)/10000`，并记录 `FormulaParams`、`DamageElement`、`BattleConfigManager.elementFormulaConfig` 等 IL2CPP 锚点。该证据仍为 `applied: false`，不能直接改写最终伤害。
- `actionResultTimeline[]` 已接入 `sourceEvidence`：HP、削韧、充能三槽都会引用 `damageElementFieldMappingEvidence` 的候选字段来源。当前末音 `10900101` 动作可显示 `109001081 / 109001306` 两个候选 element，并在 Workbench 三值来源显示 `A 覆盖候选 1,600-3,360 / G 常量匹配 10,000`、`公式函数候选 f1 G/10000 / f2 self.ATK[0]*A/10000`、`候选预览 f2 等级值 307 vs raw 12,461，约 2.5%` 和 `组合诊断 f2 需 ×40.6 才接近 raw / 每 hit ×8.1`。`applied` 仍只代表当前 raw HP 或显式资源 delta，不代表削韧/充能/最终伤害公式已应用。
- 若后续 AzPr 数据库中缺少游戏原始资源文件，优先在 `C:\Codex\AzPr Extractor` 继续导出或索引；表格/Lua 走 `raw_nostreaming_package` 导出流程，Unity 技能/动作/效果资源走 Extractor 的 Unity/default_package 导出结果。
- 项目状态核心在 `src/store/project.js`。
- 主编辑器在 `src/views/Editor.vue`，当前承担了大量 UI、交互和业务协调职责。
- 时间轴组件位于 `src/components/timeline/`。
- 编辑器侧面板位于 `src/components/editor/`。
- 伤害、统计、验证逻辑主要位于 `src/utils/damageCalc.js`、`src/utils/statCalc.js`、`src/utils/validate.js`。

## 数据模型约束

- 新开发应以 `project.actions` 作为排轴动作主模型，不要继续扩散旧的 `project.skillBlocks` 写法。
- 旧工具函数中仍有 `project.skillBlocks` 读取，这是待迁移债务；修复时应统一到 `actions`，或提供清晰的兼容适配层。
- `project.characters` 当前是角色 ID 数组，不是完整角色对象数组。需要角色详情时，从 `gamedataStore.characters` 或传入的 `gamedata.characters` 中按 ID 解析。
- 游戏数值、技能、敌人、元素、装备、奇波等资料应优先进入游戏数据层；不要把新增游戏数据硬编码在组件里。
- 新增字段时同步考虑导入导出、localStorage 项目兼容、测试数据和数据编辑器。

## Endaxis 参考原则

Endaxis 只作为架构和交互成熟度参考，不是蓝色星原数据来源。

除游戏内容、游戏机制命名和伤害计算逻辑外，其他功能设计、操作流程、页面布局、信息密度、组件拆分和交互习惯都应尽量复用 Endaxis 的成熟做法；偏离 Endaxis 时需要有明确的蓝色星原机制原因或更好的用户体验理由。

韧性/失衡和自身能量曲线可以参考 Endaxis/终末地的 `stagger`、`spRecovery`、`spReturn` 多指标追踪与绘制方式；但蓝色星原的削韧、充能、角色独立能量上限和最终公式必须从蓝原本地数据、`skill_control`、效果节点或运行时证据确认。

优先学习：

- 数据访问层和业务层分离。
- 功能入口、操作流程、页面布局和组件职责划分。
- 时间轴 UI 与模拟/统计运行时分离。
- Store 负责状态协调，复杂计算拆到独立模块。
- 测试覆盖核心运行时和数据转换。
- 项目导入导出与内部模型之间使用适配层。

避免直接照搬：

- 明日方舟：终末地的角色、敌人、装备和机制数据。
- 与蓝色星原不匹配的战斗概念命名。
- Endaxis 里为特定机制服务的硬编码逻辑。

## 已知开发阶段

当前已完成阶段 1-3 的最小闭环、阶段 4 工作台主链路、阶段 5-1 至 5-8BZ 的真实数据/数值/动作形态、直接动作库、60fps 帧时间轴、公式分层雏形、战斗公式证据索引、公式 source 接入、skill asset/effect node 候选索引、每动作 HP/韧性/能量三值结果契约、`skill_control` 行为链证据、普通攻击每 hit 候选、候选三曲线、per-element 详情、`formulaExecutionEvidenceMatrix`、`formulaExecutionMatrixSummary`、`hitBindingGapSummary`、`hitBindingGap.externalElementBinding`、`hitBindingGap.elementSourceAlignment`、`skillLevelBridge.relatedElementLevelBridge`、`runtimeParameterSourceEvidence`、`runtimeApplicationTraceEvidence`、`nativeMethodSymbolEvidence`、`nativeDisassemblyEvidence`、`selfEnergyRuntimeFormulaProbe`、`sourceToArgsProbe`、`runtimeModifierProbe`、`nativeConstantReadEvidence`、`ownerShareIntervalProbe`、`runtimeSamplingProbe`、`metadata.runtimeSampleCaptures` 离线样本入口、寒悠悠 `101003` skill_control 中文命中/韧性候选解析、寒悠悠普攻 resourceMap 子段绑定、寒悠悠普攻 buff 引用桥、寒悠悠普攻 `TSummonElementParams` 召唤桥、寒悠悠普攻召唤目标 item skill 与二级 DamageElement、召唤目标候选 Workbench 展示、召唤目标 item `skill_control` 真实重导与触发候选帧、三值曲线框架优先摘要、三值 delta/cumulative state curves、stateCurves Workbench 层级展示/过滤、RecoverSP sampled state curve 映射、非数值动作 placeholder state curve、sampled/placeholder 层级计数提示、状态曲线点级下钻、状态点时间轴 marker、状态点 marker/明细选中联动、状态点 layer/track 共享过滤、状态点 selected-only 焦点模式、状态点邻近导航、同帧三值点分组切换、候选帧热点联动状态点、候选选中帧范围与状态点焦点模式联动、末音 `109001` skill_control 清理重导，以及 `SKILL_CONTROL_SAMPLE_FILE_LIMIT = 200` 覆盖扩展。

当前默认普攻动作输出 5 条 hit 候选、15 个曲线点，本地帧 `12 / 6 / 12 / 7 / 4f`，EventBridge 绝对帧 `0s12f / 0s22f / 1s3f / 3s4f`，连段桥接 `4/4`；寒悠悠 `101003*` 和末音 `109001*` 已在 200 上限下全量解析，主技能外部 Element 引用均为 `unmatched = 0`。寒悠悠普攻子链 `10100302/03` 已通过 resourceMap fallback 绑定到 DamageElement `101003046/101003037`；`10100304/101003180` 已确认为 `TSummonElementParams / SummonElement` 召唤桥，`summonUnitId = 480059`，并沿 `battlefield_item 480059 -> skill 48005901` 追到二级 DamageElement `101003156 / 101003182`；`10100305/101003181` 已确认为 `TSummonElementParams / SummonElement` 召唤桥，`summonUnitId = 480060`，并沿 `battlefield_item 480060 -> skill 48006001` 追到二级 DamageElement `101003157 / 101003179`，同时通过 formulaParams 第 2/13 槽追到 buff `101003079 / 焰火 / 受到特定伤害时触发爆炸` 与 `TBuffElementParams` 目标对象。`summonTargetSkillEvidence` 当前覆盖 2 个召唤目标 skill、4 个二级 DamageElement；`skill_control_48005901/48006001` 已用 AzPr Extractor 聚焦 manifest-sliced 重导补出真实 MonoBehaviour：每个目标 13/13 可读、0 stub、6 条 timeline control、13 个行为节点、4 个外部 element 引用、4 条 HP behavior chain。运行时投影已把这些触发帧候选接入寒悠悠第 4/5 段 per-hit 候选和 Workbench 展示，寒悠悠当前为 `4` 个 hit candidate、`6` 个三值字段、`12` 个候选曲线点，并显示 `召唤目标 2/4段/4元素 · 触发候选 0f/1f/4f/5f/20f/25f/29f/34f`。候选帧仍未等同最终触发帧，命中次数、owner/target 归属和 runtime 条件仍待确认。

全局当前解析 6694 / 7170 个当前 skill_control MonoBehaviour JSON，仍被 200 上限截断的只有 `11100101 / 10300201 / 10100712 / 10700212`；首帧 per-element 对比区可按 `109001306` / `109001081` 横向比较 HP 参数、`f1:G/10000 / f2:self.ATK[0]*A/10000`、槽 `A覆盖1,600-3,360 / G直连10,000`、韧性 `7,000`、能量 `2,700`，并标记 `未应用 · function组合待验证 · 等级覆盖待验证:1 · 每hit倍率待分配`；四动作矩阵摘要覆盖【普通攻击】【重击】【闪击】【跃击】4 个动作、8 行、2 个 element，缩放约 `×2.5-×40.6`，每 hit 缩放约 `×2.5-×11.9`，且只有普攻 2/8 行存在 hit 绑定；`hitBindingGapSummary` 当前确认【重击】【闪击】【跃击】3 个缺口动作均有 `攻击碰撞 / Skill0_6 / subSkill 109001011` 最高置信度候选，`externalElementBindingSummary` 进一步追到 `109001251 / ast_109001251 / TDamageElementParams`；`elementSourceAlignmentSummary` 已确认 action-level/matrix element 为 `109001081 / 109001306`，skill_control 外部 damage element 为 `109001251`，两侧 `overlapElementConfigIds = []`；`relatedElementLevelBridge` 已确认 `109001251 -> 10900125 / ground slot 207` 的 12 行关联等级链候选，A 槽 `4500-9450`、G 槽 `10000`。

`runtimeParameterSourceEvidence` 已把 `Skill0_6/subSkill 109001011/hitEffects`、`109001251`、`10900125/slot 207` 和 IL2CPP 签名锚点合并为 `参数来源候选 3/3`；`runtimeApplicationTraceEvidence` 已把 HP、削韧、充能三条曲线固化为 `应用入口候选 3/3`，`nativeMethodSymbolEvidence` 已确认 27 个目标 IL2CPP 原生入口并让 Workbench 显示 `原生入口 3/3`，`nativeDisassemblyEvidence` 已提取 9 个目标函数反汇编片段并让 Workbench 显示 `反汇编片段 3/3`，`selfEnergyRuntimeFormulaProbe` 已让 Workbench 显示 `充能探针 3/3`，`sourceToArgsProbe` 已让 Workbench 显示 `构造探针 3/3`，`runtimeModifierProbe` 已让 Workbench 显示 `修正探针 3/3`，`ownerShareIntervalProbe` 已让 Workbench 显示 `归属探针 3/3`，`runtimeSamplingProbe` 已让 Workbench 显示 `采样契约 3/3`，导入手动 RecoverSP fixture 时可显示 `样本验证 1/2`；当前已确认 `DamageElement.RecoverSP` 中 `recoverSP / 10000 -> baseDelta`、`recoverSP / 10000 -> delta(经 1 + SPGETUP + SPGETUP_ATK 修正)`、`petRecoverSP / 10000 -> petDelta(经同 modifier)`、`recoverInterval / 1000 -> interval`、`tagType = AttackRecoverySp(0)`、type `0x12F` 发送、`BattleConfigData.shareEnergyPercent/petShareEnergyPercent` 分享配置来源，并已用手动 fixture 验证 `109001081` 的 `baseDelta/delta/petDelta/interval/final-sp-curve` 导入链路。

仍未确认：`FormulaUtility` 调用目标、function 组合顺序、削韧单位、真实 SPGETUP/SPGETUP_ATK 运行时属性值、recoverInterval 节流语义、共享目标筛选、寒悠悠普攻第 4/5 段召唤目标最终触发帧/命中次数/运行时归属、第 5 段焰火 buff 的 runtime 条件，以及真实 hook 样本。组件级 fixture 已验证双 actor / 双 action / 三 series 的组合过滤。`threeValueCurveFramework.stateCurves` 已把 `applied`、`candidate`、`sampled`、`placeholder` 四层统一为 delta / cumulative 点，默认末音样本为 16 个 state 点，寒悠悠样本为 13 个 state 点；导入 RecoverSP fixture 时 `selfEnergyChange.sampled` 会生成 `0.3375` 的 sampled 点，手动资源/敌人事件会进入 placeholder 层。阶段 5-8BP 已让 Workbench 层级控件显示 sampled / placeholder 点数，并在只存在采样/占位点时保留状态曲线入口；阶段 5-8BQ 已在分析面板按轨道显示可见 state point 明细，包含帧、层级、Δ/Σ、动作、hit、element、event、SP 前后值和 sourceKind；阶段 5-8BR 已把 `applied / sampled / placeholder` state point 以轻量 marker 接入主时间轴，候选层继续由原候选三值曲线显示；阶段 5-8BS 已新增共享 `stateCurvePointId`，让时间轴 marker 和分析面板点明细可双向选中并同步高亮；阶段 5-8BT 已把 state layer 可见性提升到 Workbench 共享状态，并让时间轴与分析面板同步按 `applied / candidate / sampled / placeholder` 过滤；阶段 5-8BU 已新增共享 `stateCurveTrackFilters`，让分析面板和时间轴同步按 `enemyHpDamage / enemyToughnessDamage / selfEnergyChange` 过滤；阶段 5-8BV 已新增 `stateCurveFocusMode`，可在选中 state point 后切换“只看选中 / 全部”，并同步收窄分析面板点明细与时间轴 marker；阶段 5-8BW 已新增状态点上一点/下一点导航，导航基于当前 layer/track 过滤后的完整点序列，在 selected-only 下也能移动到相邻点；阶段 5-8BX 已新增同动作/同帧/同 hit 的状态点分组按钮，可在 HP / 韧性 / 能量候选点之间直接切换；阶段 5-8BY 已让候选三值曲线 frame hotspot / marker 点击时反向选中同帧 candidate state point，并激活分析面板同帧分组；阶段 5-8BZ 已让状态点 selected-only 焦点自动收束候选三值曲线到同帧，候选曲线的“选中帧/全部”也会同步切换状态点焦点模式。下一步推进阶段 5-8CA，优先做候选帧详情行与当前三值轨道的高亮联动。

完整对标 Endaxis 的后续路线见 `DEVELOPMENT_PLAN.md`。

已经具备：

- 基础 Vue/Vite/Pinia 工程。
- 首页、编辑器、预设、图鉴、教程、设置、数据编辑器页面。
- 时间轴拖拽、技能块、伤害判定点、Buff/异常条、CD 与资源曲线的初步 UI。
- 项目保存、导入导出、历史记录、数据编辑器和基础 i18n。
- 伤害计算、统计、验证工具的早期实现。

主要债务：

- `actions` 与 `skillBlocks` 模型不统一。
- `Editor.vue` 体量过大，业务逻辑、交互和视图耦合较重。
- Boss 事件相关 UI 调用了 store 中尚未实现的 action。
- 资源监控部分把 `project.characters` 当完整角色对象使用。
- 图片/Markdown 导出仍是占位或未完成。
- 奇波、装备等数据存在硬编码/模拟数据痕迹，尚未完全接入统一游戏数据。

## 质量门槛

提交功能或较大重构前，至少执行：

```powershell
npm run build
npm run test -- --run
```

截至 2026-07-08 的基线：

- `npm run build` 可以通过。
- `npm run test -- --run` 可以通过；当前为 13 个测试文件、108 条测试。
- `npm run data:generate` 可以从 `C:\PC2\Codex\AzPr` 重新生成真实 AzPr 数据拆表。

## 开发规则

- 用户侧文档默认使用中文，代码标识、路径、字段名保持原文。
- 先读现有实现，再修改；优先沿用当前 Vue/Pinia/Element Plus 风格。
- 新功能优先进入新版数据层、领域模型和运行时，不要继续把复杂逻辑堆进旧 `Editor.vue`。
- 旧实现主要用于提取需求、交互样例和迁移逻辑；除非阻塞重构垂直切片，不要把修补旧原型作为第一优先级。
- 小步修改，避免无关重构。
- 涉及项目数据结构时，同步更新 `PROJECT_MANUAL.md` 的阶段记录和风险说明。
- 涉及长期任务时，保持根目录手册或专门状态文档可接续，不要只依赖聊天上下文。
- 不要覆盖用户未提交改动；开始修改前先检查 git 状态。
