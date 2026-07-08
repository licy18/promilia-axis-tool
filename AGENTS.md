# AGENTS.md

本文件只记录长期协作规则和坑点。阶段流水、验收记录、证据细节和临时状态不要写在这里；分别放到 `PROJECT_MANUAL.md`、`DATA_STRUCTURE_CHANGES.md`、`DEVELOPMENT_PLAN.md` 或专门状态文件。

## 快速入口

- 当前项目：`promilia-axis-tool`，蓝色星原战斗排轴编辑器。
- 当前主参考项目：`C:\Codex\AzPr Axis\Endaxis`。
- 误参考项目：`Atlos` 不是当前目标参考项目，除非用户明确要求，不要围绕 Atlos 做架构对照。
- 进入仓库后先读本文件，再按任务需要读 `PROJECT_MANUAL.md`、`DEVELOPMENT_PLAN.md`、`ARCHITECTURE.md`、`DATA_STRUCTURE_CHANGES.md`、`TIMELINE_FEATURES.md`。
- 当前具体阶段、下一步和验收结果以 `PROJECT_MANUAL.md` 末尾为准，不要在本文件复制流水账。

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

## 架构锚点

- 新版 AzPr 数据管线：`scripts/generate-azpr-data.mjs` -> `src/data/generated/`，访问层为 `src/data/azprGenerated.js`。
- 新版项目模型：`src/domain/projectSchema.js`，核心模型是 `Project` / `Actor` / `Enemy` / `Action`。
- 新版模拟运行时：`src/simulation/`，包含 compiler、engine、mechanics、projection 和 `runSimulation()`。
- 新版工作台：`src/views/Workbench.vue`，路由 `/workbench`，组件在 `src/features/workbench/`。
- 旧主编辑器：`src/views/Editor.vue` 仍是历史债务来源，不要继续把复杂新逻辑堆进去。
- 项目状态旧入口：`src/store/project.js`；修旧功能时注意它仍可能读取旧模型。
- 时间轴旧组件：`src/components/timeline/`；新版工作台优先用 `src/features/workbench/TimelineGridPreview.vue`。

## 当前路线边界

- 蓝色星原仍在测试阶段，数值和平衡可能变动；当前主线不要继续追逐最终公式、最终倍率或每个 runtime 条件。
- 优先做三层收束：
  - 生成层：把现有 evidence / candidate / runtime sample 折叠成标准 `Action -> Hit -> ThreeValueDelta` 输入合同。
  - 运行时层：只消费标准合同，输出 `simLog`、`stateCurves`、资源曲线和统计摘要。
  - UI 层：优先补 Endaxis 式资源监控、模拟日志、伤害/三值详情弹层、贡献拆分和编辑器体验。
- Evidence 层保留为来源追溯和诊断信息，不再作为用户主路径，也不阻塞工具体验。
- `actionResultTimeline[]` 必须持续按动作追踪三类数值变化：敌人 HP 伤害、敌人韧性削减、自身能量变化。不要把韧性或充能混进 HP 伤害公式。
- 当前 `5-8CJ` 已给 runtime sim log 的筛选隐藏提示增加一键显示当前选中日志的操作；下一步优先补运行时三值状态基线和“剩余/当前状态”标注。

## Endaxis 参考原则

- Endaxis 只作为架构和交互成熟度参考，不是蓝色星原数据来源。
- 除游戏内容、机制命名和伤害计算逻辑外，功能设计、操作流程、页面布局、信息密度、组件拆分和交互习惯应尽量复用 Endaxis。
- 韧性/失衡和自身能量曲线可以参考 Endaxis 的 `stagger`、`spRecovery`、`spReturn` 多指标追踪与绘制方式，但蓝色星原最终公式不能照搬 Endaxis。
- 优先学习 Endaxis 的分层方式：数据访问层、运行时编译、模拟引擎、结果投影、资源监控、模拟日志和详情面板。

## 数据模型规则

- 新开发应以 `project.actions` 作为排轴动作主模型，不要继续扩散旧 `project.skillBlocks`。
- 旧工具函数中仍有 `project.skillBlocks` 读取；修复时应统一到 `actions`，或提供清晰兼容适配层。
- `project.characters` 是角色 ID 数组，不是完整角色对象数组；需要角色详情时从数据 store 或访问层解析。
- 游戏数值、技能、敌人、元素、装备、奇波等资料应优先进入游戏数据层，不要硬编码在组件里。
- 新增持久化字段时，同步考虑导入导出、localStorage 兼容、测试 fixture 和数据编辑器。
- 如果只新增前端派生字段或 projection 字段，记录在 `DATA_STRUCTURE_CHANGES.md`，但不要误写成项目保存 schema 变更。

## 本地资源坑点

- 真实 AzPr 数据来自 `C:\PC2\Codex\AzPr`；若缺少原始游戏资源，优先查 `C:\Codex\AzPr Extractor` 的导出或索引。
- 表格/Lua 资源走 `raw_nostreaming_package` 导出流程；Unity 技能/动作/效果资源走 Extractor 的 Unity/default_package 导出结果。
- 当前生成出的 evidence 只能作为来源或候选，不能直接当最终公式。
- 测试期数值要可替换、可标注来源和置信度；不要把临时平衡数值写死到 UI。

## 开发规则

- 用户侧文档默认使用中文，代码标识、路径、字段名保持原文。
- 开始修改前先检查 git 状态；不要覆盖用户或其他线程未提交改动。
- 先读现有实现，再修改；优先沿用当前 Vue/Pinia/Element Plus 风格。
- 小步修改，避免无关重构。
- 新功能优先进入新版数据层、领域模型和运行时，再接 Workbench UI。
- 涉及项目数据结构或路线边界时，同步更新 `PROJECT_MANUAL.md` 和 `DATA_STRUCTURE_CHANGES.md`。
- 长任务需要可接续状态，写到项目手册或专门状态文件，不要只依赖聊天上下文。

## 质量门槛

提交功能或较大重构前，至少执行：

```powershell
npm run build
npm run test -- --run
```

截至 2026-07-08 的基线：

- `npm run build` 可以通过。
- `npm run test -- --run` 可以通过。
- `npm run data:generate` 可以从 `C:\PC2\Codex\AzPr` 重新生成真实 AzPr 数据拆表。
