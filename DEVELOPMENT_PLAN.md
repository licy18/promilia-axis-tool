# promilia-axis-tool 对标 Endaxis 开发计划

最后更新：2026-07-07

## 1. 目标定义

本计划的目标是让 `promilia-axis-tool` 在功能完整度、架构可维护性、排轴交互密度、模拟/统计能力上对标 `Endaxis`，但保持蓝色星原自己的数据模型和战斗机制。

2026-07-07 策略更新：本项目不再以修补旧原型为主线。旧实现保留为功能清单、交互样例和迁移来源，新版本按“真实数据优先、运行时优先、编辑器后置”的方式从头重构。阶段目标以 `PROJECT_MANUAL.md` 第 6 节为准。

对标不等于照搬：

- 不复制 Endaxis 的《明日方舟：终末地》数据。
- 不把 Endaxis 的游戏机制直接套到蓝色星原。
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
- 下一步：阶段 4-3，让时间轴进入最小交互状态，支持追加第二个动作、删除动作、选择动作编辑和多动作模拟汇总。

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
