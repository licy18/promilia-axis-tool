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
- 工作台时间轴拖动已建立：`TimelineGridPreview` 可水平拖动动作块，并按 `500ms` 网格吸附更新 `startMs`。
- 工作台草稿保存/恢复已建立：`src/domain/workbenchDraftStorage.js` 只保存新版 `selection`、`actionDrafts`、`selectedActionId`，不接旧 `skillBlocks`。
- 工作台基础编辑效率已提升：支持复制动作、`Delete` / `Backspace` 快捷删除、方向键微调时间和草稿脏状态提示。
- 工作台动作工具箱雏形已建立：支持技能、等待、注释三类动作；等待/注释进入同一 `actionDrafts -> Project -> simulation` 链路，但不伪造伤害。
- 工作台敌人与资源面板雏形已建立：敌人等级/生命倍率/防御倍率进入新版项目模型；资源面板只读取 `simulationResult.resourceTimeline`。
- 工作台事件动作已建立：支持资源事件和敌人事件动作；资源事件进入 `RESOURCE_CHANGE` 与 `resourceTimeline`，敌人事件进入 `ENEMY_EVENT` 日志。
- 工作台切人动作和多角色 actor 雏形已建立：默认生成主/副两个真实角色 actor，`switch` 动作进入 `SWITCH` 事件日志，暂不改变伤害公式。
- 工作台时间轴角色轨道雏形已建立：`TimelineGridPreview` 按 actor 显示角色轨道，非角色事件进入系统轨，动作块和伤害 marker 都带稳定轨道标记。
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

优先学习：

- 数据访问层和业务层分离。
- 时间轴 UI 与模拟/统计运行时分离。
- Store 负责状态协调，复杂计算拆到独立模块。
- 测试覆盖核心运行时和数据转换。
- 项目导入导出与内部模型之间使用适配层。

避免直接照搬：

- 明日方舟：终末地的角色、敌人、装备和机制数据。
- 与蓝色星原不匹配的战斗概念命名。
- Endaxis 里为特定机制服务的硬编码逻辑。

## 已知开发阶段

当前已完成阶段 1-3 的最小闭环，并完成阶段 4-10 的多轨道/角色轨道显示雏形。旧 Vue 原型可运行，但不再作为最终架构地基；下一步推进阶段 4-11，建立时间轴缩放和动作持续时间调整雏形。

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
- `npm run test -- --run` 可以通过；当前为 10 个测试文件、66 条测试。
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
