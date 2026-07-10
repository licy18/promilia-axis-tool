# promilia-axis-tool 对标 Endaxis 开发计划

最后更新：2026-07-08

## 1. 目标定义

本计划的目标是让 `promilia-axis-tool` 在功能完整度、架构可维护性、排轴交互密度、模拟/统计能力上对标 `Endaxis`，但保持蓝色星原自己的数据模型和战斗机制。

2026-07-07 策略更新：本项目不再以修补旧原型为主线。旧实现保留为功能清单、交互样例和迁移来源，新版本按“真实数据优先、运行时优先、编辑器后置”的方式从头重构。阶段目标以 `PROJECT_MANUAL.md` 第 6 节为准。

2026-07-08 策略收束：蓝色星原仍在测试阶段，平衡数值和公式细节可能继续调整；当前不再把最终数值考据作为主线阻塞项。后续优先把已解析的 evidence、candidate 和 runtime sample 折叠为可替换的标准生成层，再由运行时层和 UI 层稳定消费。

2026-07-10 入口收束：Workbench 已成为唯一生产排轴入口，旧 Home/Editor/Preset 页面已删除；后续发布清理以引用审计、长轴性能和构建体积为主，不再修补旧页面原型。

对标不等于照搬：

- 不复制 Endaxis 的《明日方舟：终末地》数据。
- 不把 Endaxis 的游戏机制直接套到蓝色星原。
- 游戏内容和伤害计算逻辑最终必须以蓝色星原真实数据和机制为准；测试期允许先使用可替换、可标注来源和置信度的生成数据驱动运行时与 UI。
- 其他功能设计、操作流程、页面布局、组件组织、信息密度和交互习惯应尽量复用 Endaxis。
- 学习的是架构分层、编辑器能力、运行时组织、数据维护方式和测试策略。

目标参考项目：

```text
C:\Codex\AzPr Axis\Endaxis
```

当前项目：

```text
C:\Codex\AzPr Axis\promilia-axis-tool
```

## 2. 最终形态

完成后，项目应具备以下能力：

- 稳定的排轴编辑器：多角色、多轨道、拖拽、吸附、选择、批量移动、复制粘贴、撤销重做、上下文菜单。
- 统一动作模型：所有技能、切人、Boss 事件、资源变化、Buff、异常状态都进入统一时间轴模型。
- 独立数据层：游戏数据通过访问层读取，组件不直接依赖原始 JSON 结构。
- 独立模拟运行时：给定项目 JSON，可以在无 UI 环境下计算伤害、资源、Buff、CD、敌人状态和日志。
- 分析面板：输出总伤害、DPS、峰值、角色贡献、技能贡献、资源曲线、Buff 覆盖率、异常状态时间线。
- 数据编辑与校验：支持维护蓝色星原角色、技能、敌人、奇波、装备等数据，并能校验字段完整性。
- 导入导出：支持版本化项目 JSON、Markdown、图片或长图、预设轴分享。
- 测试网：关键模型、数据转换、模拟运行时、导入导出和核心组件都有测试覆盖。

## 3. Endaxis 能力拆解

Endaxis 当前值得对标的模块如下：

| 能力         | Endaxis 位置                                             | promilia 对标方向                           |
| ------------ | -------------------------------------------------------- | ------------------------------------------- |
| 数据访问层   | `src/data/`、`src/data/timeline.ts`、`src/data/index.ts` | 从单一 `gamedata.json` 逐步过渡到数据访问层 |
| 编辑器主界面 | `src/views/TimelineEditor.vue`                           | `src/views/Workbench.vue` + `features/workbench/` |
| 动作库       | `src/components/ActionLibrary.vue`、`ActionItem.vue`     | 重构技能库/动作库，支持技能、切人、敌方事件 |
| 时间轴网格   | `src/components/TimelineGrid.vue`                        | 强化拖拽、吸附、选择、缩放和多轨交互        |
| 属性面板     | `src/components/PropertiesPanel.vue`                     | 收敛当前编辑面板能力                        |
| 资源监控     | `src/components/ResourceMonitor.vue`                     | 修复现有资源监控并接入运行时投影            |
| 敌人设置     | `src/components/EnemySettingsPanel.vue`                  | 蓝色星原敌人/Boss 机制面板                  |
| 运行时编译   | `src/simulation/compiler/`                               | 项目模型 -> 模拟场景                        |
| 模拟引擎     | `src/simulation/engine/`、`simulator.ts`                 | 事件队列、角色/敌人状态、命中、Buff、资源   |
| 结果投影     | `src/simulation/projection/`                             | 输出图表、时间线状态条和统计面板数据        |
| 测试体系     | `src/simulation/*.test.ts`、`runtimeCoverage.test.ts`    | 建立蓝色星原机制 golden tests               |

## 4. 初始差距（历史基线）

### P0 稳定性差距

- `npm run test -- --run` 未通过，原因是 `SkillBlock.test.js` 使用 `jest.mock`。
- `project.actions` 与旧 `project.skillBlocks` 并存，统计和验证读取旧模型。
- 已删除的旧 `Editor.vue` 曾调用 store 中不存在的 Boss event action；生产 Workbench 不再经过该路径。
- `ResourceMonitor.vue` 把 `project.characters` 当完整角色对象数组使用，但当前项目里它是角色 ID 数组。

### P1 架构差距

- 旧 `Editor.vue` 过重问题已通过退役页面和建立 Workbench 分层解决；遗留组件仍待引用审计。
- 缺少稳定的数据访问层，组件和工具函数直接读 `gamedata.json` 结构。
- 伤害、统计、验证逻辑分散，尚未形成独立运行时。
- 导入导出缺少清晰版本化适配层。

### P2 功能差距

- PNG 项目快照与元数据回导已完成；Markdown 报告导出仍未完成。
- Boss/敌人事件系统未闭环。
- 奇波、装备等数据仍有硬编码或模拟数据痕迹。
- 资源、Buff、异常状态的显示还不是由统一模拟结果投影生成。
- 缺少 Endaxis 式伤害详情、模拟日志、贡献拆分和运行时覆盖测试。

## 5. 开发路线

### 阶段 0：重构准备与边界冻结

目标：把旧项目定位为参考样本，冻结新版目录、数据边界和第一条垂直切片。

关键产出：

1. 文档入口完整：`AGENTS.md`、`PROJECT_MANUAL.md`、`DEVELOPMENT_PLAN.md`。
2. 旧原型功能清单：迁移、替代、放弃分别标注。
3. 新版模块边界：数据层、领域模型、模拟运行时、编辑器工作台、导入导出。
4. 第一条垂直切片定义：真实角色 + 真实敌人 + 单技能动作 + 无 UI 模拟 + 基础展示。

### 阶段 1：真实 AzPr 数据管线

目标：从 `C:\PC2\Codex\AzPr` 生成新版游戏数据层，先消灭占位数据。

关键产出：

1. 数据生成器和校验器。
2. 角色、技能、元素、敌人、奇波、装备、灵子、图片索引的拆表输出。
3. 数据访问入口：组件和运行时只读访问层，不直接读原始导出表。
4. 缺失时序数据标记：`needsTimingData`、`timingSource`。

### 阶段 2：核心领域模型与项目格式

目标：建立版本化项目模型和迁移层。

关键产出：

1. `Project`、`Actor`、`Enemy`、`Action`、`TimingProfile`、`Loadout` 等核心模型。
2. 统一时间单位和动作类型。
3. 旧 localStorage / 旧导出项目的迁移策略。
4. schema、fixture 和模型测试。

### 阶段 3：战斗计算运行时最小闭环

目标：先在无 UI 环境下跑通一次真实数据模拟。

关键产出：

1. `src/simulation/`：compiler、engine、mechanics、projection、fixtures。
2. 最小机制：基础属性、敌人属性、技能命中、基础伤害、冷却、资源变化、模拟日志。
3. golden tests：同一输入得到稳定输出。
4. 运行时投影：伤害序列、资源序列、日志、统计摘要。

### 阶段 4：新版编辑器骨架

目标：搭建对标 Endaxis 的工作台，而不是继续扩写旧 `Editor.vue`。

关键产出：

1. `ActionLibrary`、`TimelineGrid`、`PropertiesPanel`、`EnemyPanel`、`ResourceMonitor`、`AnalysisPanel`、`Toolbar`。
2. 真实角色/敌人选择、技能拖入、基础时间轴编辑和模拟按钮。
3. UI 读取项目模型和运行时投影，不直接拼战斗结果。

### 阶段 5：机制扩展与精度补强

目标：把最小模拟推进到可用于真实排轴复盘，但当前先做结构可信，不追求测试期最终数值完全准确。

关键产出：

1. 生成层：把技能、动作、命中、HP / 韧性 / 能量三值候选折叠成标准 `Action -> Hit -> ThreeValueDelta` 合同，并保留 source / confidence / layer 标记。
2. 运行时层：像 Endaxis 一样只消费标准合同，输出 `simLog`、`stateCurves`、资源曲线、敌人状态曲线和统计摘要。
3. UI 层：优先补 Endaxis 式资源监控、模拟日志、伤害/三值详情弹层、贡献拆分和编辑器工作流。
4. Evidence 层：继续保留公式、skill_control、runtime sample 证据，但只作为生成层来源和诊断面板，不阻塞主工作台。

### 阶段 6：导入导出、预设和分享

目标：完成排轴创建、保存、复盘和分享闭环。

关键产出：

1. 版本化项目 JSON。
2. Markdown 导出。
3. 图片/长图导出。
4. 预设轴库、标签、搜索、复制和版本兼容提示。

### 阶段 7：替换旧版与发布

目标：新架构成为主线，旧原型退出核心开发路径。

关键产出：

1. 旧功能迁移/替代/放弃清单关闭。
2. 旧占位数据、旧模型读取和临时兼容层清理。
3. 构建、测试、性能、长轴和基础移动端查看检查。
4. README、架构文档、数据说明和用户向说明同步。

## 6. 推荐里程碑

| 里程碑        | 目标                 | 主要产出                                   |
| ------------- | -------------------- | ------------------------------------------ |
| M1 数据真实   | 新版脱离占位数据     | AzPr 数据生成器、拆表数据、校验报告        |
| M2 模型稳定   | 项目结构可长期维护   | 版本化项目模型、schema、迁移层             |
| M3 运行时闭环 | 可无 UI 模拟一条轴   | compiler、engine、projection、golden tests |
| M4 编辑器成型 | 操作体验接近 Endaxis | 工作台组件、真实数据拖拽、运行时投影       |
| M5 机制结构可信 | 能稳定复盘代表队伍框架 | 标准生成合同、运行时投影、UI 详情和覆盖测试 |
| M6 分享发布   | 可稳定交付用户       | 导入导出、预设、性能、发布文档             |

## 7. 立即执行清单

建议下一轮开发从这些任务开始：

1. 已完成：建立新版数据生成器入口 `scripts/generate-azpr-data.mjs`。
2. 已完成：从 `C:\PC2\Codex\AzPr` 生成角色、元素、技能基础数据。
3. 已完成：生成敌人、奇波、装备、灵子和图片索引。
4. 已完成：为技能补 `needsTimingData` / `timingSource`。
5. 已完成：建立数据访问层 `src/data/azprGenerated.js` 和校验报告。
6. 已完成：定义最小 `Project` / `Action` / `Actor` / `Enemy` schema。
7. 已完成：准备第一条垂直切片 fixture。
8. 下一步：建立 `src/simulation/` 最小编译和模拟测试。

2026-07-07 更新：

- 已完成：最小 `Project` / `Action` / `Actor` / `Enemy` schema，文件为 `src/domain/projectSchema.js`。
- 已完成：第一条真实数据垂直切片 fixture，文件为 `src/domain/fixtures/firstVerticalSlice.js`。
- 已完成：建立 `src/simulation/`，先完成 `compileProject()`、`simulateScenario()` 和 projection 测试。
- 已完成：进入阶段 4，新建 `/workbench` 编辑器工作台第一屏，展示第一条垂直切片的 actor / enemy / action / eventLog / damageTimeline。
- 已完成：阶段 4-2，把只读工作台推进到最小可编辑，完成 `PropertiesPanel`、动作选择状态和真实角色/技能/敌人选择入口。
- 已完成：阶段 4-3，让时间轴进入最小交互状态，支持追加第二个动作、删除动作、选择动作编辑和多动作模拟汇总。
- 已完成：阶段 4-4A，补齐时间轴动作块拖动/吸附的基础手感。
- 已完成：阶段 4-4B，建立新版 workbench 草稿保存/恢复入口，不接旧 `skillBlocks`。
- 已完成：阶段 4-5，提高时间轴基础编辑效率，支持动作复制、快捷删除、键盘微调和草稿脏状态提示。
- 已完成：阶段 4-6，扩展工作台动作类型和工具箱雏形，支持等待动作、注释动作和对应事件日志，非技能动作不伪造伤害。
- 已完成：阶段 4-7，补齐敌人与资源面板雏形，敌人等级/倍率进入新版项目模型，资源面板读取 `simulationResult.resourceTimeline`。
- 已完成：阶段 4-8，接入资源事件和敌人事件动作，让动作工具箱能驱动资源面板和敌人事件日志。
- 已完成：阶段 4-9，建立切人动作和多角色 actor 雏形，默认主/副角色 actor、`SWITCH` 事件和切人属性编辑已进入新版工作台链路。
- 已完成：阶段 4-10，建立多轨道/角色轨道显示雏形，动作块和伤害 marker 会按 actor 或系统轨显示。
- 已完成：阶段 4-11，建立时间轴缩放和动作持续时间调整雏形，视图缩放和 `durationMs` 拖拽调整已进入工作台链路。
- 下一步：阶段 4-12，建立轨道内重叠检测和时间轴诊断雏形，开始给编辑结果提供结构化冲突提示。

2026-07-07 阶段 4-12 至 5-6 追加更新：

- 已完成：阶段 4-12 至 4-30，补齐轨道诊断、跨轨归属、动作库上下文、插入策略、技能动作形态选择、动作形态批次生成、批次移动/对齐、批次摘要定位和时间轴同批次高亮。
- 已完成：阶段 5-1，建立真实技能动作形态倍率适配层，动作和模拟投影可追溯到 hero-module 聚合来源。
- 已完成：阶段 5-2，建立 `skill_level.json` 字段级交叉校验，当前 118 个技能完全匹配、2 个技能存在语言 ID 缺失差异。
- 已完成：阶段 5-3，建立 `skillsub_logic` / `skillsub_ele_value` 技能逻辑字段索引，区分显示层和逻辑层冷却/能量。
- 已完成：阶段 5-4，在 Workbench 展示技能逻辑来源和显示/逻辑差异。
- 已完成：阶段 5-5，建立 `valueParam` 与动作形态倍率的直接数值匹配诊断，确认当前不能把 `valueParam` 直接当作倍率公式来源。
- 已完成：阶段 5-6，新增 `value-param-index.json` 参数 ID 词典雏形，当前参数 `1 -> A`、`7 -> G` 均为 `unresolved` 公式槽位。
- 已完成：阶段 5-7，接入 `role-attribute-dynamic-current-rank.xlsx` 同源口径的角色当前数值面板，生成 `character-attribute-panels.json`，Workbench 展示当前 actor 面板，raw 投影改用当前面板攻击。
- 已完成：阶段 5-8A，修正技能动作形态模型，`普攻/重击/闪击/跃击` 不再误作同一技能多段；普攻段数从描述解析，当前只记录总倍率与段数。
- 已完成：阶段 5-8B，动作库切换为 Endaxis 风格直接动作目录，只列 `普通攻击/重击/闪击/跃击/星鸣技/星结合击/星决技/星携技/极限反击/完美招架`，被动技能不列入动作库；时间轴颗粒度统一为 60fps 的 1 帧网格。
- 已完成：阶段 5-8C，建立 `formulaBreakdown` 真实伤害公式分层雏形，当前攻击和动作形态倍率为已应用层，敌人防御/抗性/暴击/增伤为未应用层。
- 已完成：阶段 5-8D，新增 `combat-formula-evidence.json`，确认敌人属性链和元素减免字段来源，同时记录 `skillsub_ele_value.elementId` 与 `element_formula.id` 当前无直接匹配。
- 已完成：阶段 5-8E，把 `combat-formula-evidence.json` 接入 `formulaBreakdown.layers.enemyDefense.source` / `enemyResistance.source`，使防御/抗性层显示“证据已找到、公式未映射”，但仍保持 `applied: false`。
- 已完成：阶段 5-8F，新增 `skill-asset-evidence.json`，确认 `C:\PC2\Codex\AzPr` 缺少 `Config/Battle/Skill` 实体资源，并按规则从 `C:\Codex\AzPr Extractor` 的 `SkillList/skill_control_*.asset` 建立候选索引；当前 120 个技能中 116 个匹配，4 个 `*62` 技能缺失。
- 已完成：阶段 5-8G，新增每动作三值结果契约，`actionResultTimeline[]` 对每个动作固定追踪敌人 HP 伤害、敌人韧性削减、自身能量变化；当前 HP 走 raw 投影，削韧和充能公式保持独立占位。
- 已完成：阶段 5-8H，对 `skill_control` MonoBehaviour 样本建立效果轨道候选分类，输出 `effectLaneCandidateSummary` / `effectLaneCandidates`；当前确认末音 `10900101` 有 `攻击碰撞` HP 候选，但削韧、充能仍未在该技能样本中确认。
- 已完成：阶段 5-8I，解引用 `behaviorList` / PathID / MonoBehaviour 关联链，末音 `10900101` 的 36 条 behaviorList 引用全部解到本地行为对象，HP 候选行为链已追到 `collisionLayer/elementalType/targetType/elementBaseDatas` 等字段。
- 已完成：阶段 5-8J，新增 `skillResourceMapEvidence`，把行为对象里的外部 `elementBaseDatas` 引用匹配到根 `skillResourceMaps[].elements`；末音 `10900101` 的 13 条外部 element 引用全部匹配到对应 `subSkillId`、`stateName` 和 hitEffects。
- 已完成：阶段 5-8K，新增行为脚本类型候选和 IL2CPP element 类型目录；末音 `10900101` 的 HP 候选行为已匹配 `InjectToTargetKeyFrameBehaviorData` 字段签名，当前全局有 1 个技能命中脚本类型候选、2 个 element 类型候选。
- 已完成：阶段 5-8L，新增 `externalElementObjectEvidence` 与 `resolve-azpr-element-objects.py`，把末音 `10900101` 的 8 个 `m_FileID = 2` external element PathID 全部解析到 `battle_element_assets` 对象本体；当前确认 3 个 `TDamageElementParams`、2 个 `TFxElementParams`、2 个 `TFreezeFrameElementParams`、1 个 `TBuffElementParams`。
- 已完成：阶段 5-8M，新增 `damageElementFieldMappingEvidence`，把 `TDamageElementParams` 的 `formulaParams`、`weakBreakDamageRate`、`recoverSP/petRecoverSP` 分别映射到 HP 伤害、敌人韧性削减、自身能量变化三条候选链；末音 `10900101` 的 3 个 damage element 均完成字段映射，其中 `109001081` / `109001306` 已桥接到 12 行 `skillsub_ele_value.valueParam` 等级值。
- 已完成：阶段 5-8N，把 `damageElementFieldMappingEvidence` 接入 `actionResultTimeline[]` 的 `sourceEvidence` 层和 Workbench 分析面板“三值来源”展示；末音 `10900101` 当前动作可显示 HP、削韧、充能候选 elementId `109001081 / 109001306`，并保留 `109001251` 未桥接记录。
- 已完成：阶段 5-8O，新增 `formulaParamAlignment.parameterSummaries`，确认末音 `109001081 / 109001306` 的参数 `1 / A` 是 1-12 级线性增长的等级覆盖候选，参数 `7 / G` 是 1-12 级恒定的同槽直连匹配；这些仍是公式槽位关系证据，不是最终公式应用。
- 已完成：阶段 5-8P，把 `formulaParamAlignment.parameterSummaries` 接入 `actionResultTimeline[].sourceEvidence`，并在 Workbench 三值来源中展示未应用公式候选；当前显示 `A 覆盖候选 1,600-3,360 / G 常量匹配 10,000`，但不改变 raw HP、削韧或充能数值。
- 已完成：阶段 5-8Q，新增 `hpDamage.formulaFunctionEvidence`，确认末音 `10900101` 的 3 个 `TDamageElementParams` 合计 6 条 `function_1/function_2` 引用全部候选命中 `element_formula.id`：`1 -> G/10000`、`2 -> (self.ATK[0]*A)/10000`；同时记录 `FormulaParams`、`DamageElement`、`BattleConfigManager.elementFormulaConfig` 等 IL2CPP 锚点，但仍不应用最终公式。
- 已完成：阶段 5-8R，把 `formulaFunctionEvidence` 接入 `actionResultTimeline[].hpDamage.sourceEvidence.formulaFunctionSummary` 和 Workbench 三值来源展示；当前显示 `公式函数候选 f1 G/10000 / f2 self.ATK[0]*A/10000`，仍不改变 raw HP、削韧或充能数值。
- 已完成：阶段 5-8S，新增 `formulaCandidatePreview` 未应用预览，当前末音 `10900101` 的 f2 公式用等级 A=1600 得到 307，约为现有 raw HP 12461 的 2.5%，诊断为 `large-difference`；Workbench 显示 `候选预览 f2 等级值 307 vs raw 12,461，约 2.5%`，仍不改变最终数值。
- 已完成：阶段 5-8T，新增 `formulaCandidatePreview.combinationPreviews`，验证 `function_2`、`function_1*function_2`、`function_1+function_2` 等简单组合仍远低于 raw HP；当前 f2 等级值需约 `×40.6` 才接近 raw，按 5 hit 平均仍需每 hit `×8.1`，Workbench 显示组合诊断。
- 已完成：阶段 5-8U，新增 `summary.formulaCandidatePatternSummary`，把四动作样本【普通攻击 / 重击 / 闪击 / 跃击】的 f2 候选值与 raw HP 投影做跨动作差异摘要；当前 f2 候选值在四动作中均为 `307`，`requiredScaleToRaw` 随描述倍率变化，范围约 `×2.5` 到 `×40.6`，Workbench 显示候选模式摘要，仍保持 `applied: false`。
- 已完成：阶段 5-8V，新增 `formulaCandidatePatternSummary.skillControlBehaviorCorrelations`，把 f2 差异模式与当前技能级 `skill_control` HP 行为节点证据放在同一摘要里；末音 `10900101` 当前确认 HP 行为候选 5 个、采样命中帧 `13/16/19f`、资源归属 `Skill0_6 / Skill0_1` 和 hitEffects，但动作形态级绑定仍标为未确认。
- 已完成：阶段 5-8W，新增按 lane 保留的 `effectLaneCandidatesByLane` / `effectLaneBehaviorChainsByLane`，完整保留末音 `10900101` 的 5 条 HP 行为链，并在仿真中生成动作形态级候选绑定；当前【普通攻击】中置信候选为 `普通-攻击碰撞 / Skill0_1 / 12-13f, 13-14f`，【重击 / 闪击 / 跃击】低置信共享候选为 `攻击碰撞 / Skill0_6`。
- 已完成：阶段 5-8X-A，新增 `stateTimingEvidence`，把 `AnimationBehaviorData` 和 `EventBridgeBehaviorData` 时序行为纳入 evidence/投影/Workbench；当前 `Skill0_6` 有 `动作` 动画状态控制与 3 个 HP 命中窗口，`Skill0_1` 只有 2 个 HP 资源映射窗口，尚未在同一 skill_control 中找到动画状态控制。
- 已完成：阶段 5-8X-B，新增 `eventBridgeTargetSkillControlEvidence`，把 `10900102 / 80102` 等 EventBridge 目标技能接入状态证据；当前确认 `10900102` 是 `10900101` 的子技能，目标 skill_control 动画状态为 `Skill0_2`，有 4 个 `普攻-攻击碰撞` HP 候选；`80102` 在 SkillList 和 `skill.json` 中缺失。
- 已完成：阶段 5-8X-C，把 EventBridge 目标从单跳索引升级为递归普攻连段链索引；当前 `10900102 -> 10900103 -> 10900104 -> 10900105` 均确认为 `10900101` 的子 skill_control，链路动画状态为 `Skill0_2 / Skill0_3 / Skill0_4 / Skill0_5`，HP timeline 候选合计 30 个；同时修正 `Skill0_1` 的直接动画状态证据，使主 skill_control 的 `Skill0_1 / Skill0_6` 均为动画+命中候选。
- 已完成：阶段 5-8Y，把普攻链候选升级为普通攻击多段/每 hit 候选；当前从【普通攻击】描述解析 `expectedHitCount = 5`，并建立 `normalAttackHitChainCandidate`，覆盖 `10900101 / Skill0_1` 与 `10900102-10900105 / Skill0_2-5` 五段候选，HP timeline 候选数为 `2 / 4 / 9 / 7 / 10`，总计 32 个，仍保持 `applied: false`。
- 已完成：阶段 5-8Z，把 `normalAttackHitChainCandidate.hitGroups[]` 继续向下解析到每 hit 的 `behaviorList -> elementBaseDatas -> TDamageElementParams`；当前普通攻击 5 段均有三值字段候选，覆盖 `damageElementMappedHitGroupCount = 5/5`，合计 12 个 `TDamageElementParams` 映射，Workbench 显示 `三值候选 5/5段`，仍保持 `applied: false`。
- 已完成：阶段 5-8AA，把普通攻击每段 `damageElementFieldMappings[]` 接入 `actionResultTimeline[].hitCandidates[]` 和 `hitCandidateSummary`，当前默认普攻动作输出 5 条 per-hit 候选、12 个三值字段映射、60fps 相对帧点 `12/6/12/7/4f`，Workbench 显示 `逐hit候选 5/5段 · 三值字段 12`；这些仍是未应用预览。
- 已完成：阶段 5-8AB，把 `hitCandidates[]` 聚合为顶层 `candidateValueSeries` 三条候选曲线；当前默认普攻输出 HP 参数候选 `2500/4800/3000/5400/13000`、削韧候选 `7000x5`、能量候选 `2700/2599/2399/3000/2599`，Workbench 显示 `候选曲线 15` 及三条未应用小折线。
- 已完成：阶段 5-8AC，把 `candidateValueSeries` 扩展为 `chart` 图表层，输出 `sourceFrameIndex` 与 `displayFrameIndex` 双轨帧点；当前默认普攻因子 `skill_control` 局部帧回退产生 12 个显示帧调整，Workbench 显示 `候选时间曲线 15` 和三条 60fps 多曲线。
- 已完成：阶段 5-8AD，追 `10900101 -> 10900102-10900105` 普攻子 `skill_control` 的 EventBridge 连段触发帧，建立 `normalAttackSequenceTimingEvidence`；当前连段桥接 `4/4`，链起点 `0/16/51/116/180f`，绝对帧候选 `0s12f/0s22f/1s3f/2s3f/3s4f`，`candidateValueSeries.chart` 显示帧调整降为 0。
- 已完成：阶段 5-8AE，把 `candidateValueSeries.chart` 的 HP、削韧、能量候选点同步到主时间轴 marker；当前默认普攻显示 15 个候选三值 marker，全部归属 `actor-109001`，并与真实伤害投影 marker 使用独立图例和 `data-testid`。
- 已完成：阶段 5-8AF，把主时间轴候选 marker 升级为多曲线轨；当前默认普攻在 `actor-109001` 轨显示 3 条候选曲线、15 个候选 marker 和 5 个按帧 hotspot，首帧提示可同时查看 HP、削韧、能量三个候选值。
- 已完成：阶段 5-8AG，给候选多曲线轨增加基础交互控制；当前时间轴可按 HP / 韧性 / 能量切换候选曲线显隐，点击按帧 hotspot 可查看该帧可见三值候选、`hitSkill`、element 候选和时序来源摘要，关闭 HP 后默认样本剩余 2 条曲线、10 个 marker。
- 已完成：阶段 5-8AH，把选中帧摘要升级为候选来源详情下钻，并新增 `全部 / 选中帧` 候选范围切换；当前首帧 HP 详情显示样本 `1,000/1,800/1,900/2,500`、`candidateCount = 4`、帧来源 `src12/disp12/local12/chain0/abs12` 和 element `109001081/109001306`，选中帧范围会收缩到 3 个 marker、3 条 curve、1 个 hotspot。
- 已完成：阶段 5-8AI，把候选详情继续下钻到 per-element 原始字段；`candidateValueSeries` / `chart` 点新增 `elementDetails[]`，首帧可区分 `109001306` 与 `109001081` 的 HP 参数、削韧、能量、petRecoverSP 和 recoverInterval 字段，并补角色/动作过滤下拉。
- 已完成：阶段 5-8AJ，把 per-element 详情与公式函数、公式槽位、等级覆盖关系联动展示；首帧 element 详情现在可显示 `f1:G/10000`、`f2:self.ATK[0]*A/10000`、`A覆盖1,600-3,360`、`G直连10,000`，并新增双 actor / 双 action / 三 series 的组件级过滤 fixture。
- 已完成：阶段 5-8AK，把 per-element 详情整理成结构化横向比较区和原生 tooltip；当前选中帧可按 element 行对比 HP 参数、公式函数、A/G 槽位、削韧、能量和 `未应用/function组合待验证/等级覆盖待验证/每hit倍率待分配` 状态。
- 已完成：阶段 5-8AL，在 `actionResultTimeline[].hpDamage.sourceEvidence` 新增 `formulaExecutionEvidenceMatrix`，按 element / hit / action 汇总 function 组合候选、A 槽覆盖候选、G 常量匹配和每 hit 倍率缺口；当前默认普攻矩阵为 2 个 element，首选 f2 等级值预览 `307` 对比 raw `12,461`，仍需约 `×40.6 / 每 hit ×8.1`，并固化三类未确认 diagnostics，保持 `applied: false`。
- 已完成：阶段 5-8AM，在 `simulation.summary` 新增 `formulaExecutionMatrixSummary`，按 action / element 聚合公式执行矩阵；当前四动作样本覆盖【普通攻击】【重击】【闪击】【跃击】4 个动作、8 行、2 个 element，缩放范围约 `×2.5-×40.6`，每 hit 缩放约 `×2.5-×11.9`，并明确只有普攻 2/8 行存在 hit 绑定。
- 已完成：阶段 5-8AN，在 `formulaExecutionMatrixSummary` 新增 `hitBindingGapSummary`，把重击/闪击/跃击的 6 行 hit 绑定缺口与 skill_control 最高置信度候选对齐；当前三个缺口动作都命中 `攻击碰撞 / Skill0_6 / subSkill 109001011` 候选，但仍保持 `shared-action-family-candidate-unconfirmed` 和 `applied: false`。
- 已完成：阶段 5-8AO，在 `hitBindingGap` 新增 `externalElementBinding`，把重击/闪击/跃击的 `攻击碰撞 / Skill0_6 / subSkill 109001011` 候选 PathID 桥接到外部对象；当前三个缺口动作都能追到 `109001251 / ast_109001251 / TDamageElementParams`，并暴露 HP `function_1/function_2`、削韧 `weakBreakDamageRate = 7000`、充能 `recoverSP = 5899` 候选，但 `skillsub-element-level-bridge-missing` 和 hit 归属仍未确认。
- 已完成：阶段 5-8AP，在 `hitBindingGap` 新增 `elementSourceAlignment`，并在 `hitBindingGapSummary` 新增 `elementSourceAlignmentSummary`；当前确认 action-level / matrix element 为 `109001081 / 109001306`，来源 `skill_logic.currentLevel.elementValues`，而非普攻外部 DamageElement 为 `109001251`，来源 `skill_control.elementBaseDatas / Skill0_6 / subSkill 109001011`，二者没有 element 重叠，Workbench 显示 `来源差异 x/y`。
- 已完成：阶段 5-8AQ，在 `skillLevelBridge` 下新增 `relatedElementLevelBridge` 关联等级链候选；当前确认 `109001251` 的直连等级桥接仍缺失，但全量 `skillsub_ele_value` 中存在 `skillId = 10900125` 的 12 行 A/G 参数，`10900125` 可由 `elementId / 10` 推导并出现在末音 `ground slot 207`，Workbench 显示 `关联等级链 x/y`，继承/应用仍保持未确认。
- 已完成：阶段 5-8AR，在 `hitBindingGap.externalElementBinding` 下新增 `runtimeParameterSourceEvidence` 运行时参数来源候选；当前确认 `Skill0_6 / subSkill 109001011 / hitEffects 11_109001_133, 11_109001_005 -> element 109001251 -> derivedSkillId 10900125 -> 末音 ground slot 207` 可以组成候选链，并记录 `DamageElement.Parse(skillId, ...)` 与 `SkillElementInjector.ExecuteDamageElement` 签名锚点；Workbench 显示 `参数来源候选 x/y`，但 runtime 应用仍未确认。
- 已完成：阶段 5-8AS，在 `hitBindingGap.externalElementBinding` 下新增 `runtimeApplicationTraceEvidence` 三值运行时应用入口候选；当前 HP 链路命中 `DamageElement + FormulaUtility + OutputDamageData`，削韧链路命中 `FormulaUtility.GetOutputWeaknessDamage / WeakBreakSystem`，充能链路命中 `DamageElement.RecoverSP / RecoverSPArgs / SPSystem`，Workbench 显示 `应用入口候选 x/y`，但方法体、覆盖顺序、单位和触发条件仍未确认。
- 已完成：阶段 5-8AT，在 `runtimeApplicationTraceEvidence` 下新增 `nativeMethodSymbolEvidence` 与三链 `nativeMethodSymbols`；当前确认 27 个目标 IL2CPP 原生入口可从 `script.json` 定位到地址/签名，并由 `il2cpp.h` 字段布局和 `stringliteral.json` 字符串交叉支撑，Workbench 显示 `原生入口 x/y`；但 C# 方法体、IDA/Ghidra 伪代码、运行时调用顺序、单位和触发条件仍未确认。
- 已完成：阶段 5-8AU，在 `runtimeApplicationTraceEvidence` 下新增 `nativeDisassemblyEvidence`，从 TC `GameAssembly.dll` 提取目标函数反汇编片段；当前已确认 `DamageElement.Parse` 会把 `recoverSP/petRecoverSP/recoverInterval` 复制进运行时字段，`DamageElement.RecoverSP` 会用 `m_recoverSP` 门控充能路径，`SPSystem.RecoverSP` 中 `delta` 参与资源更新，Workbench 显示 `反汇编片段 x/y`；但 `FormulaUtility` 间接调用、削韧 transmit type、单位和共享规则仍未确认。
- 已完成：阶段 5-8AV，新增 `selfEnergyRuntimeFormulaProbe` / `runtimeSelfEnergyFormulaProbe`，把 `DamageElement.Parse -> DamageElement.RecoverSP -> SPSystem.RecoverSP` 的字段复制、`m_recoverSP > 0` 门控、`delta` 更新路径和 raw/per-10000 单位假设做成未应用探针；当前 action-level、每 hit 候选和非普攻外部 DamageElement 缺口都能显示 `充能探针 x/y`，但 `baseDelta`、`delta` 最终角色、宠物共享、recoverInterval 时间基准和 recoverTagType 仍未确认。
- 已完成：阶段 5-8AW，把 `SPSystem.OnTransmit@0x14837F0` 纳入 `nativeDisassemblyEvidence`，确认 RecoverSPArgs transmit type `0x12F`、`RecoverSPArgs.id/baseDelta/delta/interval/tagType/sharePercent/petSharePercent/petDelta/mainPetSharePercent` 字段、`id + interval` 节流和共享回传路径；新增 `ownerShareIntervalProbe`，让 action-level、每 hit 候选和非普攻外部 DamageElement 缺口都能显示 `归属探针 x/y`。
- 已完成：阶段 5-8AX，把 `DamageElement.RecoverSP@0x138EEE0` 的完整构造段和 `RecoverSPArgs.OnReset@0x1254070` 纳入证据，新增 `sourceToArgsProbe`；当前确认 `recoverSP -> baseDelta`、`recoverSP -> delta(经 runtime modifier)`、`petRecoverSP -> petDelta(经同 modifier)`、`recoverInterval -> interval`、`tagType = AttackRecoverySp(0)` 和 type `0x12F` 发送，Workbench 显示 `构造探针 x/y`。
- 已完成：阶段 5-8AY，把 `DamageElement.RecoverSP` 中两个 runtime modifier 固化为 `EBattlePropertyType.SPGETUP(105)` 与 `SPGETUP_ATK(228)`，确认 `AliveProperty.GetBattlePropertyCurrentValue` / `SnapshotPropertyManager.GetBattlePropertyCurrentValue` + `MyFloat.op_Implicit(float)` 的取值链，确认 `BattleConfigData.shareEnergyPercent@0x108` 与 `petShareEnergyPercent@0x10C`，并新增 `runtimeModifierProbe`；Workbench 显示 `修正探针 x/y`。
- 已完成：阶段 5-8AZ，从 `C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll` 的 `.rdata` 读取 float32 常量并新增 `nativeConstantReadEvidence`：`0x189956B08 = 1.0`、`0x189956D8C = 1000.0`、`0x189956FB0 = 10000.0`；`sourceToArgsProbe` 和 `runtimeModifierProbe` 已显示 divisor/value 证据。
- 已完成：阶段 5-8BA，新增 `runtimeSamplingProbe` 与 `SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA`，定义 `DamageElement.RecoverSP`、`AliveProperty.GetBattlePropertyCurrentValue`、`SnapshotPropertyManager.GetBattlePropertyCurrentValue`、`SPSystem.OnTransmit`、`SPSystem.RecoverSP` 五类采样点、离线导入事件类型和验证公式；Workbench 显示 `采样契约 x/y`。
- 已完成：阶段 5-8BB，建立 `metadata.runtimeSampleCaptures` 离线样本入口，`runtimeSamplingProbe` 可消费手动整理的 RecoverSP fixture，按 `recover-sp-args-built`、modifier 读取、`recover-sp-ontransmit-12f`、`recover-sp-applied`、share rebroadcast 事件验证 `baseDelta/delta/petDelta/interval/final-sp-curve`；当前 fixture 覆盖 `109001081`，状态为 `runtime-sampling-offline-samples-partially-validated`，Workbench 在有样本时显示 `样本验证 x/y`。
- 已完成：P7-A 新增 `ValidatedRuntimeSample -> ThreeValueDelta` 机制 adapter；完整 RecoverSP 与削韧采样可以按原始帧进入 runtime 的角色能量/敌人韧性曲线，错误或不完整样本保持未应用。
- 已完成：P7-B 建立 Workbench 实测 capture JSON 导入、动作/角色/敌人映射、v8 项目持久化与结果刷新闭环；同 session 重导会替换，冲突绑定整批拒绝。
- 进行中：P7-C 已完成 TC hook manifest、显式 Frida host/agent、JSONL 会话归并、标准 envelope 规范化、production audit 和 Workbench JSONL 导入；受控本地进程 transport 已实测，当前没有非 fixture 游戏 capture，不视为真实采集完成。
- 下一步：由操作者启动明确授权的客户端并提供 PID/当前动作绑定，显式确认后产出首份真实 JSONL，通过 `--require-production`、P7-A adapter、三值曲线、sim log 和项目回导验收；不自动启动或无确认附加客户端，不扩展碎片 UI 或测试期倍率。

旧原型中的 `skillBlocks`、Boss 事件 action、`ResourceMonitor.vue` 等问题保留为迁移参考；除非它们阻塞数据或运行时垂直切片，不再作为第一优先修补项。

## 8. 风险和取舍

- 不建议继续大修旧 `Editor.vue`。旧编辑器可以读作需求样本，但不应成为新架构中心。
- 不建议先做大规模视觉重写。真实数据和运行时闭环没有起来之前，UI 很容易再次绑定错误模型。
- 不建议把技能描述解析出的倍率当成精确时序。时序字段必须记录来源。
- 不建议引入后端。当前项目定位仍适合纯前端，本地生成数据、导入导出和静态部署即可覆盖主要需求。
- 可以在新模块中优先引入更强类型和 schema；是否全量 TypeScript 化应在阶段 0 单独决定。

## 9. 每阶段验收规则

每个阶段结束时至少检查：

```powershell
npm run build
npm run test -- --run
```

同时维护：

- `PROJECT_MANUAL.md`：更新阶段状态。
- `DEVELOPMENT_PLAN.md`：勾勒下一阶段任务变化。
- 相关架构文档：数据结构或运行时有实质变化时同步更新。
