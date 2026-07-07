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
- 数据生成器已建立 `combat-formula-evidence.json`：敌人属性链和元素减免字段来源可追溯，但 `skillsub_ele_value.elementId -> element_formula.id` 当前无直接匹配，仍需 asset/效果节点追踪。
- 数据生成器已建立 `skill-asset-evidence.json`：`C:\PC2\Codex\AzPr` 当前没有 `Config/Battle/Skill`、`SkillPreload`、`SkillList` 实体资源时，应按项目规则使用 `C:\Codex\AzPr Extractor` 的 Unity 导出资源；当前 `SkillList` 中 4134 个 `skill_control_*.asset` 目录可用，120 个当前技能中 116 个已匹配，4 个 `*62` 技能缺失。
- `skill-asset-evidence.json` 已新增 `effectLaneCandidateSummary` / `effectLaneCandidates`：用于按 HP 伤害、韧性削减、自身能量变化、元素效果、动作时序、表现资源分类 `skill_control` 候选轨道；这只是 JSON 解析后的名称/字符串模式候选，尚未解引用 `behaviorList` 或确认公式。
- `skill-asset-evidence.json` 已新增 `behaviorReferenceSummary` / `effectLaneBehaviorChains`：用于把 `behaviorList[].m_PathID` 解到同目录目标 MonoBehaviour；当前末音 `10900101` 的 HP 候选已能追到碰撞行为字段和外部 `elementBaseDatas` 引用，但 `m_FileID = 2` 外部对象仍未解析成公式。
- `skill-asset-evidence.json` 已新增 `skillResourceMapEvidence`，并会把行为对象里的外部 `elementBaseDatas` 匹配到根 `skillResourceMaps[].elements`；当前末音 `10900101` 的外部 element 引用已能归属到 `subSkillId`、`stateName` 和 hitEffects，但 element 对象本体仍未导出。
- `skill-asset-evidence.json` 已新增 `scriptTypeCandidate` 和 `elementTypeCatalogEvidence`：当前末音 `10900101` 的 HP 候选行为以字段签名匹配 `InjectToTargetKeyFrameBehaviorData`，IL2CPP element 类型目录记录 `TSpElementParams` 与 `DamageElement`；这些仍是候选证据，不能当作已解析出的外部 element 对象或最终公式。
- `skill-asset-evidence.json` 已新增 `externalElementObjectEvidence`：通过 `scripts/resolve-azpr-element-objects.py` 解析 `skill_control` 的 `m_FileID = 2` external element 对象本体；当前末音 `10900101` 的 8 个 PathID 全部解析到 `d_assets_resourcesassets_config_battle_element_assets`，其中 `TDamageElementParams` 暴露 `formulaParams`、`weakBreakDamageRate`、`recoverSP/petRecoverSP` 等三值计算候选字段。
- `skill-asset-evidence.json` 已新增 `damageElementFieldMappingEvidence`：把 `TDamageElementParams` 字段拆成 HP 伤害、敌人韧性削减、自身能量变化三条候选链；当前末音 `10900101` 的 3 个 damage element 均已映射，`109001081` / `109001306` 已桥接到 12 行 `skillsub_ele_value.valueParam` 等级值，`109001251` 暂无同 elementId 等级桥接。该证据仍不能直接当作最终公式。
- `actionResultTimeline[]` 已接入 `sourceEvidence`：HP、削韧、充能三槽都会引用 `damageElementFieldMappingEvidence` 的候选字段来源。当前末音 `10900101` 动作可显示 `109001081 / 109001306` 两个候选 element；`applied` 仍只代表当前 raw HP 或显式资源 delta，不代表削韧/充能/最终伤害公式已应用。
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

当前已完成阶段 1-3 的最小闭环、阶段 4 工作台主链路、阶段 5-1 至 5-8N 的真实数据/数值/动作形态、直接动作库、60fps 帧时间轴、公式分层雏形、战斗公式证据索引、公式 source 接入、skill asset/effect node 候选索引、每动作三值结果契约、`skill_control` 效果轨道候选分类、本地行为链解引用、elementBaseDatas 资源映射归属、行为脚本类型候选、IL2CPP element 类型目录、外部 element 对象本体解析、`TDamageElementParams` 三值字段候选映射和 Workbench 三值来源展示。旧 Vue 原型可运行，但不再作为最终架构地基；下一步推进阶段 5-8O，验证 `skillsub_ele_value.valueParam` 与 `TDamageElementParams.formulaParamValues` 的缩放/覆盖关系。

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

截至 2026-07-07 的基线：

- `npm run build` 可以通过。
- `npm run test -- --run` 可以通过；当前为 12 个测试文件、104 条测试。
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
