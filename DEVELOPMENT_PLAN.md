# promilia-axis-tool 对标 Endaxis 开发计划

最后更新：2026-07-07

## 1. 目标定义

本计划的目标是让 `promilia-axis-tool` 在功能完整度、架构可维护性、排轴交互密度、模拟/统计能力上对标 `Endaxis`，但保持蓝色星原自己的数据模型和战斗机制。

2026-07-07 策略更新：本项目不再以修补旧原型为主线。旧实现保留为功能清单、交互样例和迁移来源，新版本按“真实数据优先、运行时优先、编辑器后置”的方式从头重构。阶段目标以 `PROJECT_MANUAL.md` 第 6 节为准。

对标不等于照搬：

- 不复制 Endaxis 的《明日方舟：终末地》数据。
- 不把 Endaxis 的游戏机制直接套到蓝色星原。
- 游戏内容和伤害计算逻辑必须以蓝色星原真实数据和机制为准。
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

| 能力 | Endaxis 位置 | promilia 对标方向 |
| --- | --- | --- |
| 数据访问层 | `src/data/`、`src/data/timeline.ts`、`src/data/index.ts` | 从单一 `gamedata.json` 逐步过渡到数据访问层 |
| 编辑器主界面 | `src/views/TimelineEditor.vue` | 拆薄 `src/views/Editor.vue` |
| 动作库 | `src/components/ActionLibrary.vue`、`ActionItem.vue` | 重构技能库/动作库，支持技能、切人、敌方事件 |
| 时间轴网格 | `src/components/TimelineGrid.vue` | 强化拖拽、吸附、选择、缩放和多轨交互 |
| 属性面板 | `src/components/PropertiesPanel.vue` | 收敛当前编辑面板能力 |
| 资源监控 | `src/components/ResourceMonitor.vue` | 修复现有资源监控并接入运行时投影 |
| 敌人设置 | `src/components/EnemySettingsPanel.vue` | 蓝色星原敌人/Boss 机制面板 |
| 运行时编译 | `src/simulation/compiler/` | 项目模型 -> 模拟场景 |
| 模拟引擎 | `src/simulation/engine/`、`simulator.ts` | 事件队列、角色/敌人状态、命中、Buff、资源 |
| 结果投影 | `src/simulation/projection/` | 输出图表、时间线状态条和统计面板数据 |
| 测试体系 | `src/simulation/*.test.ts`、`runtimeCoverage.test.ts` | 建立蓝色星原机制 golden tests |

## 4. 当前差距

### P0 稳定性差距

- `npm run test -- --run` 未通过，原因是 `SkillBlock.test.js` 使用 `jest.mock`。
- `project.actions` 与旧 `project.skillBlocks` 并存，统计和验证读取旧模型。
- `Editor.vue` 调用 `projectStore.addBossEvent/updateBossEvent/removeBossEvent`，但 store 中没有对应 action。
- `ResourceMonitor.vue` 把 `project.characters` 当完整角色对象数组使用，但当前项目里它是角色 ID 数组。

### P1 架构差距

- `Editor.vue` 过重，UI、交互、业务协调、导出、事件处理混在一起。
- 缺少稳定的数据访问层，组件和工具函数直接读 `gamedata.json` 结构。
- 伤害、统计、验证逻辑分散，尚未形成独立运行时。
- 导入导出缺少清晰版本化适配层。

### P2 功能差距

- 图片导出和 Markdown 导出仍未完成。
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

目标：把最小模拟推进到可用于真实排轴复盘。

关键产出：

1. 蓝色星原战斗公式、元素/异常、Buff、资源、敌人抗性、奇波/装备/灵子规则。
2. 代表角色的 `TimingProfile`，来源可追溯。
3. 可区分精确数据、推断数据和待补数据的结果输出。
4. 覆盖代表队伍和敌人的回归测试。

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

| 里程碑 | 目标 | 主要产出 |
| --- | --- | --- |
| M1 数据真实 | 新版脱离占位数据 | AzPr 数据生成器、拆表数据、校验报告 |
| M2 模型稳定 | 项目结构可长期维护 | 版本化项目模型、schema、迁移层 |
| M3 运行时闭环 | 可无 UI 模拟一条轴 | compiler、engine、projection、golden tests |
| M4 编辑器成型 | 操作体验接近 Endaxis | 工作台组件、真实数据拖拽、运行时投影 |
| M5 机制可信 | 能复盘代表队伍 | 机制规则、TimingProfile、覆盖测试 |
| M6 分享发布 | 可稳定交付用户 | 导入导出、预设、性能、发布文档 |

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
- 下一步：阶段 5-8R，把 `formulaFunctionEvidence` 接入 `actionResultTimeline[].hpDamage.sourceEvidence` 和 Workbench 三值来源展示，只显示未应用公式函数候选，不改变 raw HP、削韧或充能数值。

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
