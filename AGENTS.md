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
npm run audit:production-imports:check
npm run audit:bundle:check
npm run audit:workbench-data:check
npm run benchmark:long-axis:check
npm run benchmark:long-axis:browser
npm run test:e2e:production-preview
```

`npm run lint` 当前带 `--fix`，会自动改文件；运行前先确认是否需要格式修复。

## 架构锚点

- 新版 AzPr 数据管线：`scripts/generate-azpr-data.mjs` -> `src/data/generated/`，访问层为 `src/data/azprGenerated.js`。
- Workbench 生产目录统一消费 `workbench-seed.json` v2 精简投影；完整敌人、装备、奇波、魂灵与证据表保留给数据审计，不得重新从 `workbenchProjectFactory.js` 同步引入生产主包。
- 技能逻辑、等级校验和 valueParam 统一消费 `workbench-skill-core.json`；Skill Control/DamageElement 等候选证据消费 `workbench-skill-diagnostics.json`，只在运行复盘或实测采样恢复需要时按需加载。生成后运行 `npm run audit:workbench-data:check`，诊断合同和完整证据表不得重新进入 Workbench 首轮加载路径。
- 新版项目模型：`src/domain/projectSchema.js`，核心模型是 `Project` / `Actor` / `Enemy` / `Action`。
- 新版模拟运行时：`src/simulation/`，包含 compiler、engine、mechanics、projection 和 `runSimulation()`。
- 生产工作台：`src/views/Workbench.vue`，根路径与旧 `/editor` 路径都重定向到 `/workbench`，组件在 `src/features/workbench/`。
- 旧 `Home.vue`、`Editor.vue`、`Preset.vue` 页面已经退役并删除，不得重新建立平行主编辑器或假数据首页。
- 旧 `src/components/editor/`、`src/components/timeline/`、project/history/setting store 和旧计算工具已经按引用审计删除，不得重新引入平行实现。
- 生产时间轴只使用 `src/features/workbench/TimelineGridPreview.vue`；新增源码后运行 `npm run audit:production-imports:check`，不得留下无引用或未允许的 test-only 模块。
- 对外试用和正式发布使用 `npm run audit:bundle:check` 守住首屏、Workbench 和全部 JavaScript gzip 预算；M11/M12 内部里程碑记录超限但不转去压包，不得通过放宽预算或隐藏 Vite 警告伪造发布通过。
- 发布试用前运行 `npm run test:e2e:production-preview`，必须从真实 `dist` 启动 preview 并生成 `reports/production-preview-acceptance.json`；开发服务器主流程通过不能替代该验收。

## 当前路线边界

- 当前顺序固定为：收口 `M10-B2-R1`，再实施 M11 无头核心/机器排轴/可视化验收台，之后才进入 M12 批量评估、搜索与末音试点；R1 后不要直接启动下一角色。
- 生成层、运行时、CLI、优化器和 Workbench 必须消费同一版本化合同并输出同一确定性 trace；禁止维护第二套角色规则、UI 计算或测试专用真相。
- 无头核心不得依赖 Vue、DOM、像素坐标、拖拽或 `localStorage`。机器轴使用语义动作与变体，不要求调用方理解内部 control/subskill。
- Workbench 保留为强制机制验收台：动作形态、hit、三值/资源曲线、状态层数、Buff 生命周期和因果来源必须可见。AI 或机器测试不能替代产品可视化验收。
- 角色成熟度使用 `extracted -> runtime-integrated -> visually-accepted -> optimization-ready`；未达到最后一级的角色不得进入正式配队或输出轴搜索，`runtime-evidence-required` 与 `static-evidence-gap` 不得用默认值静默补齐。
- 蓝色星原仍在测试阶段，平衡数值应保持可替换、带来源和置信度；机制正确性、状态顺序和派生闭包优先于最终倍率考据。
- `actionResultTimeline[]` 必须按动作分别追踪敌人 HP、敌人韧性和自身能量变化，不得把韧性或充能混进 HP 公式。缺少真实基线时保持待确认，不用 0 或上限冒充。
- 新的视觉特效、非必要响应式适配、拖拽手感细修、包体压缩和全角色盲目接入暂缓。包体审计继续记录并约束对外发布，但不阻断 M11/M12 内部核心与验收里程碑。

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
