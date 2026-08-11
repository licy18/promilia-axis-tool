# promilia-axis-tool 对标 Endaxis 开发计划

最后更新：2026-08-11

## 1. 目标定义

本计划的目标是让 `promilia-axis-tool` 在功能完整度、架构可维护性、排轴交互密度、模拟/统计能力上对标 `Endaxis`，但保持蓝色星原自己的数据模型和战斗机制。

2026-07-07 策略更新：本项目不再以修补旧原型为主线。旧实现保留为功能清单、交互样例和迁移来源，新版本按“真实数据优先、运行时优先、编辑器后置”的方式从头重构。阶段目标以 `PROJECT_MANUAL.md` 第 6 节为准。

2026-07-08 策略收束：蓝色星原仍在测试阶段，平衡数值和公式细节可能继续调整；当前不再把最终数值考据作为主线阻塞项。后续优先把已解析的 evidence、candidate 和 runtime sample 折叠为可替换的标准生成层，再由运行时层和 UI 层稳定消费。

2026-07-10 入口收束：Workbench 已成为唯一生产排轴入口，旧 Home/Editor/Preset 页面已删除；后续发布清理以引用审计、长轴性能和构建体积为主，不再修补旧页面原型。

2026-07-12 路线更新：8-Z 限定为 production guard、applied source binding 审计、重复合同合并和包体余量恢复；完成后直接进入 Stage 9，以 Endaxis 的时间轴优先信息架构重构 3 角色、3 奇波和敌人多轨工作台。Stage 9 不接入未确认公式，也不把零碎标签、提示或按钮样式作为独立阶段。

2026-07-13 主线重定义：Stage 13 及其自动后续路线取消，实测校准 WIP 封存于本地 `deferred/stage-13a-calibration` 分支，M1 完成前不合并。当前唯一产品主线是 **M1 / Endaxis 级核心排轴体验**：让用户无需理解 profile、binding、schema 或校准合同，即可完成 3 人队与奇波配置、多轨编排、6 条独立能量轴与敌人 HP/韧性复盘、方案保存/分享/比较。Stage 11/12 分析能力保留为高级二级入口，不再作为主线增长点。

2026-07-28 路线重整：M10-B2-R1 收口后暂停继续扩角色，主线改为 **唯一无头战斗核心 + 机器排轴接口 + 可视化机制验收台**。机器接口和网页必须消费同一份确定性 trace，不得维护两套模拟逻辑；网页保留动作块、资源/三值曲线、Buff/状态区间、hit 编辑和因果检查能力，但暂缓与机制验收无关的视觉、响应式、拖拽手感和包体工作。角色只有依次达到 `extracted -> runtime-integrated -> visually-accepted -> optimization-ready` 后，才能进入正式配队或输出轴搜索。

### 2026-08-11 测试、审计与发布门禁 V2

验证流程现在分为三个互不冒充的层级：

1. Development：`npm run test:smart` 根据当前 working tree bytes、dependency map、gate/runner 版本和相关环境合同计算指纹，只执行受影响的 targeted/audit gate；无法分类的文件一律升级到保守门禁。`--plan` 只规划，不能输出 release ready。
2. Integration：分线全部合入后只运行一次既有 `npm run test:full`，作为联合回归 checkpoint；targeted PASS 或 ledger cache 不等于 full PASS。
3. Release：最终 clean tracked HEAD 只运行 `npm run release:verify`。它先执行 M12-C 独有且未被 trial 覆盖的正式证明，再真实调用一次原样保留的 `npm run test:trial-release`，并核对 HEAD、tracked tree 与 stash 前后不漂移。最终 release 不允许从 cache 拼装。

`work/m12-c/gates/gate-ledger.json` 是可丢弃的派生证据缓存，不是 authority source。只有真实命令 `exitCode=0`、输出完整且指纹完全相同的 `mode=executed,status=pass` 才可在开发/集成层复用；FAIL、timeout、OOM、cancelled、interrupted、解析失败和语义版本漂移均 fail closed。ledger 采用临时运行记录、原子替换、PID/hostname/timestamp 锁及 stale-lock 恢复；本 V2 首次上线前必须由新 HEAD 的真实 `release:verify` PASS 建立 bootstrap authority。

`formal-search-admission` 与 release 结果分开判定。它额外核验 qualification、E22 binding、initial-state authority、M12-C determinism、formal runtime baseline、pre-score unresolved/skipped 边界、Kibo autonomous schedule/trigger 闭合证明和产品验收；`clientParityReady=false` 继续单列，不能与 optimization qualification 混同，也不能由测试或 release 自动提升。Kibo 闭合证明缺失、损坏、authority hash 漂移、覆盖不足或仍含 unresolved surface 时，release 可以独立 PASS，但正式搜索保持 `BLOCKED`。任何 required product acceptance pending 同样保持 `BLOCKED`，脚本不代签产品记录。

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
- 机器排轴接口：通过版本化 JSON/JSONL 和 CLI 完成动作目录查询、合法性校验、模拟、对比和因果解释，不依赖浏览器或像素坐标。
- 可视化机制验收台：直接渲染无头核心 trace，显示实际动作形态、状态交易、派生命中、Buff 目标/生命周期和属性影响。
- 批量评估与优化：只在 `optimization-ready` 角色范围内批量比较队伍与输出轴，并输出带场景假设、版本和可信度的可解释 Top-N 结果。
- 分析面板：输出总伤害、DPS、峰值、角色贡献、技能贡献、资源曲线、Buff 覆盖率、异常状态时间线。
- 数据编辑与校验：支持维护蓝色星原角色、技能、敌人、奇波、装备等数据，并能校验字段完整性。
- 导入导出：支持版本化项目 JSON、Markdown、图片或长图、预设轴分享。
- 测试网：关键模型、数据转换、模拟运行时、导入导出和核心组件都有测试覆盖。

## 3. Endaxis 能力拆解

Endaxis 当前值得对标的模块如下：

| 能力         | Endaxis 位置                                             | promilia 对标方向                                 |
| ------------ | -------------------------------------------------------- | ------------------------------------------------- |
| 数据访问层   | `src/data/`、`src/data/timeline.ts`、`src/data/index.ts` | 从单一 `gamedata.json` 逐步过渡到数据访问层       |
| 编辑器主界面 | `src/views/TimelineEditor.vue`                           | `src/views/Workbench.vue` + `features/workbench/` |
| 动作库       | `src/components/ActionLibrary.vue`、`ActionItem.vue`     | 重构技能库/动作库，支持技能、切人、敌方事件       |
| 时间轴网格   | `src/components/TimelineGrid.vue`                        | 强化拖拽、吸附、选择、缩放和多轨交互              |
| 属性面板     | `src/components/PropertiesPanel.vue`                     | 收敛当前编辑面板能力                              |
| 资源监控     | `src/components/ResourceMonitor.vue`                     | 修复现有资源监控并接入运行时投影                  |
| 敌人设置     | `src/components/EnemySettingsPanel.vue`                  | 蓝色星原敌人/Boss 机制面板                        |
| 运行时编译   | `src/simulation/compiler/`                               | 项目模型 -> 模拟场景                              |
| 模拟引擎     | `src/simulation/engine/`、`simulator.ts`                 | 事件队列、角色/敌人状态、命中、Buff、资源         |
| 结果投影     | `src/simulation/projection/`                             | 输出图表、时间线状态条和统计面板数据              |
| 测试体系     | `src/simulation/*.test.ts`、`runtimeCoverage.test.ts`    | 建立蓝色星原机制 golden tests                     |

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

### 阶段 8-Z：生产守门与余量恢复

目标：在不改变三值结果的前提下，为 Stage 9 恢复可靠发布余量。

关键产出：

1. 默认 Workbench applied source binding 审计进入生产守门：不得出现 `bound-drift`，全部 `compatible-unbound` 必须有明确兼容原因。
2. 合并重复 identity/hash/number/text normalization/diagnostics 实现，不新增机制合同。
3. 全部 JavaScript gzip 不高于 733,000B，尽量接近 728,000B；不提高预算，也不为体积长期停滞。

### Stage 9：Endaxis 风格多轨时间轴与团队拓扑

#### Stage 9-A：时间轴数据与布局骨架

固定 3 个角色槽位。每个角色包含动作主轴、关联奇波子轴、角色能量曲线和奇波能量曲线；敌人组包含事件/状态轴、HP 曲线和韧性曲线。首个整块交付必须同时呈现 3 个角色主轴、3 个奇波子轴、1 个敌人轴、6 条独立能量曲线和敌人 HP/韧性，共 8 条状态曲线。奇波未确认效果继续 `unapplied`。

状态：已完成。三槽项目归一化、配置实例、五载体回放和 Workbench 可见轨道已使用同一拓扑合同；桌面与窄屏生产预览已验证 15 行标签/内容像素对齐、6 条能量曲线与敌人 HP/韧性全长可见。

#### Stage 9-B：曲线与动作统一时间坐标

动作块、命中节点和八条阶跃曲线共用同一时间刻度、缩放与横向滚动。空轴从 0 到轴末显示初始水平线；曲线只在对应 runtime event 节点变化，3 个角色与 3 个奇波的能量不得串线，移动、复制和删除动作必须同步更新节点。

状态：已完成。八条轨内曲线直接消费正式 `runtimeOutputs.stateCurves`，按 state snapshot 绘制初始值、准确事件帧和阶跃后的当前值；动作移动、复制、删除、2x 缩放和 30 秒横向滚动均保持节点同步及像素对齐，刻度与轨道滚动位置双向同步。

#### Stage 9-C：时间轴优先的整页结构

首屏优先呈现方案栏、多轨时间轴和完整曲线，固定轨道标签与紧凑工具栏；配置和复盘详情进入侧栏或可切换检查区。桌面与窄屏均需浏览器验收，窄屏允许横向滚动或折叠，但不得重叠、丢轨或破坏时间对齐。

状态：已完成。时间轴成为 Workbench 全宽首行，15 条轨道在桌面首屏完整可见；方案摘要、运行复盘、动作库和配置检查区进入第二行，390px 窄屏保留固定身份列并让时间内容局部滚动。轨道默认密度收紧并按动作重叠、效果区间和事件节点动态增高，桌面与窄屏生产预览均验证无重叠、无丢轨。

Stage 9 的共同验收：方案复制、本地草稿、JSON、分享链接和 PNG 回放后，3 角色/3 奇波/敌人拓扑及曲线结果一致；现有测试、production preview 和未应用机制隔离继续通过。

### Stage 10：多轨编排实际编辑闭环

#### Stage 10-A：角色、奇波与敌人轨道的统一编排操作

状态：已完成。当前可见拓扑已成为统一可编辑工作区：角色动作、奇波事件和敌人事件从时间轴内同一编排入口进入合法轨道，动作可在同类轨道间移动并重绑归属，复制、删除、撤销/重做会同步触发 runtime 重算。奇波事件使用正式 tracking-only 合同，不产生 HP、韧性或能量 delta；本地草稿、JSON、分享链接和 PNG 回放均通过项目 schema v16 重建相同归属与结果。

#### Stage 10-B：跨轨批量编排与长轴操作闭环

状态：已完成。框选可跨角色动作轨、奇波轨和敌人轨形成混合选择；同一角色的动作与奇波事件可作为一组同时平移并重绑到另一角色，敌人事件在混合复制/删除时保持独立合法轨。批量移动使用单个历史快照，复制保留组内动作关系，删除、撤销/重做和 runtime 曲线同步更新；30 秒轴 4x 缩放滚动及方案复制、本地草稿、JSON、分享链接、PNG 回放均已通过。

#### Stage 10-C：统一帧游标与多轨状态复盘

状态：已完成。时间网格、动作块、八条状态曲线断点和 runtime 日志现共享同一个 60fps 帧游标；任意帧可同时读取 3 个角色、3 个奇波的能量及敌人 HP/韧性，曲线断点和日志可精确反向定位，动作编辑后当前帧状态响应式重算。游标在 4x 缩放和横向滚动下保持像素对齐，桌面与窄屏生产预览均已通过。

#### Stage 10-D：播放控制与区段复盘

状态：已完成。统一帧游标现支持播放/暂停、前后逐帧、0.5x/1x/2x 速度和选中 cycle 区段循环；动作高亮、八条状态曲线和事件/runtime 日志按当前帧同步更新。全轴到末帧自动停止，区段按 `[startFrame, endFrame)` 连续回绕；播放状态保持瞬态，不进入项目载体。

#### Stage 10-E：生产余量与长轴播放性能收口

状态：已完成。生产 skill core v2 省略 1,000 个等级行中可由位置、单一 subSkill 和默认匹配状态推导的重复字段，领域读取层恢复同一模型；总 JS gzip 从 738,352B 降至 732,840B，并把硬门槛收紧到 735,000B。120 动作浏览器守门已覆盖 4x/2x 播放、自动滚动、暂停和卸载 rAF 清理，180 动作编译/模拟继续满足预算。

### Stage 11：Endaxis 风格多维复盘分析

#### Stage 11-A：时间窗口与角色贡献分析闭环

状态：已完成。Workbench 现始终提供全轴贡献窗口，并在存在 cycle boundary 时提供各循环区段；同一批 applied hit transactions 按角色与动作聚合 HP、韧性和各角色能量。动作贡献携带 runtime state point 与帧锚点，可同步定位动作、曲线、日志和编辑焦点。分析不建立第二套公式，候选值与未应用培养效果不会进入结果；桌面首屏仍以时间轴为主，390px 窄屏无页面或角色表裁切。

#### Stage 11-B：时间窗口方案对比与差异定位

状态：已完成。A/B 比较现直接消费两侧 `ContributionWindow`，可在全轴或双方共有的同序 cycle 区段比较角色、动作及 HP/韧性/能量；当前动作可回到原轴精确 runtime point，工作区基准可切换后定位，快照/预设/导入基准可转成独立工作区方案后继续编辑。无 cycle boundary 时只暴露全轴，窗口不匹配时不会误比较。比较仍只读取 applied runtime outputs，不复制公式或混入 candidate/unapplied 来源。

#### Stage 11-C：多维复盘生产余量与长轴比较收口

状态：已完成。生产 skill core v3 把跨等级的 label/value ID 等差序列提升到技能级表达，读取层无损恢复既有等级范围；总 JS gzip 从 734,625B 降至 721,642B，恢复 13,358B 余量。双 120 动作方案浏览器守门已覆盖全轴与 cycle 窗口切换、120 条动作贡献比较、基准来源定位和组件卸载清理，未改变 Stage 11-A/B 结果、项目 schema、runtime 或三值公式。

### Stage 12：Endaxis 风格分析成果交换

#### Stage 12-A：分析快照与报告导出闭环

状态：已完成。时间窗口贡献与 A/B 方案比较均可导出版本化 JSON 分析报告；报告冻结现有 applied runtime 结果、动作/state point/frame、transaction/source delta identity，并嵌入对应方案草稿。统一文件入口会先验证 schema、边界、来源草稿和动作/transaction 引用，再打开独立复盘视图；用户可从任一来源或动作恢复独立工作区方案并由标准 runtime 重建定位，当前排轴不会被导入动作直接覆盖。

#### Stage 12-B：分析报告 PNG 与元数据回导闭环

状态：已完成。统一报告视图可导出 JSON 或干净的完整 PNG；PNG 使用既有 CRC/tEXt 工具嵌入同一份已验证 v1 报告，项目 PNG 与报告 PNG 由统一接收器明确分流。PNG 回读会重新验证报告合同并可恢复来源方案、动作、state point 和帧，交付图不包含导出、打开来源或动作定位控件；项目 v16、runtime、三值公式与 applied/unapplied 边界均未改变。

#### Stage 12-C：分析报告可复现性审计

状态：已完成。打开 JSON 或 PNG 分析报告时，系统会用内嵌方案草稿重新执行当前生产 `createWorkbenchProject -> compileProject -> simulateScenario` 链，并重建同一贡献窗口或 A/B 比较。冻结 `analysis`、applied source bindings 与 summary 逐字段核对后给出 exact、drift 或 incompatible；drift 提供最多 12 条最小字段路径和冻结/重放值，不兼容会指出 profile、游戏数据、来源或窗口门禁。审计只读，不覆盖报告、不替换项目、不迁移数值，也不进入 calculator。

### M1：Endaxis 级核心排轴体验

目标主流：

`3 角色 + 各自奇波 + 敌人配置 -> 拖入角色/奇波/敌人动作 -> 同轴查看命中、6 条独立能量轴与敌人 HP/韧性 -> 编辑后即时重算 -> 保存/分享/比较`

#### M1-A：时间轴信息架构与视觉身份

状态：已完成。Workbench 首屏已改为时间轴主舞台：高频命令留在顶栏，项目交换与高级能力进入二级菜单；3 个角色身份、各自奇波子轨、6 条独立能量曲线及敌人事件/HP/韧性在同一坐标内完整显示。检查器默认收起并以覆盖层打开，1440x900 可同屏识别完整拓扑；390x900 使用固定身份列和时间内容局部横向滚动。视觉证据为 `reports/m1a-workbench-desktop.png`、`reports/m1a-workbench-narrow.png`、`reports/m1b-six-energy-desktop.png`、`reports/m1b-six-energy-narrow.png` 与 `reports/m1a-endaxis-reference.png`。

1. 首屏顶部只保留方案、撤销/重做、保存和运行/播放；JSON、PNG、报告、审计等收入“项目/更多”二级入口。
2. 左侧固定 3 张紧凑角色身份卡和独立敌人卡，清楚显示头像、名称、属性/定位和奇波槽。
3. 中央时间轴占主宽度与高度；右侧检查器只在有选中对象时展示，可折叠且默认不挤压时间轴。
4. 3 个角色组各包含角色主轴、奇波子轴、角色能量曲线和奇波能量曲线；敌人组包含事件轴、HP 曲线和韧性曲线。7 条可编排轴与 8 条状态曲线共享唯一 x 轴。
5. 动作块显示图标/名称、类型或状态、持续时间；命中点、选中态和不可执行态可辨识。曲线平线、阶跃和当前帧值形成清晰层级且不遮挡动作。
6. 1440x900 首屏无需下翻即可识别全部队伍、奇波、敌人和八曲线归属；空方案仍显示全长平线。验收必须与 Endaxis 同尺寸截图对照。

#### M1-B：3 人队与奇波配置闭环

状态：已完成。三个唯一角色槽、各自奇波和敌人选择会同步更新身份、动作库、轨道与初始状态；每个角色和奇波各有自己的能量轴，总计 6 条能量轴，加上敌人 HP/韧性共 8 条状态曲线。未确认奇波能量机制保持 tracking-only 全长平线，不进入 calculator。方案复制、本地草稿、JSON、分享链接与 PNG 回放保持相同所有者拓扑。

1. 3 个唯一角色槽可换人，并同步头像、动作库、主轴、能量曲线和配置实例。
2. 每个角色可绑定一个奇波，同步奇波身份、动作库、子轴和独立奇波能量轴；未确认效果继续 `unapplied`。
3. 敌人选择同步身份、HP/韧性初始值和敌人轴。
4. 方案复制、本地草稿、JSON、分享链接和 PNG 回放保持同一队伍、奇波、敌人和轨道身份。

#### M1-C：拖入动作到曲线变化的核心闭环

状态：已完成。桌面工作区把动作库固定在时间轴左侧，角色技能、资源动作、已绑定奇波事件和敌人事件可直接拖入合法轨道，并复用统一 `WorkbenchTimelineEntry -> insertTimelineEntry -> compiler/runtime` 路径按 60fps 帧落位。3 条角色能量与 3 条奇波能量继续按所有者隔离；当前正式 applied 事件会同步更新对应断点、日志和详情，未确认奇波能量及敌人事件效果保持平线。移动、复制、删除、撤销/重做和 JSON 回放均已覆盖。

1. 当前角色、奇波或敌人的动作库可直接拖入合法轨道，随后响应式编译与模拟。
2. 3 条角色能量和 3 条奇波能量严格按所有者隔离；HP 与韧性只在对应 applied event 的准确帧阶跃。
3. 移动、复制、合法跨轨、删除、撤销/重做同步更新动作、命中点、曲线断点、日志和帧游标。
4. 奇波只编排已知动作/事件，未确认效果不伪造曲线变化。

#### M1-D：可展示默认方案与里程碑验收

状态：已完成。首次打开 Workbench 会进入明确标注为“示例方案 · 预览数据”的 3 人方案，包含三个角色动作、奇波事件、敌人事件、角色 2 独立能量阶跃、敌人 HP 阶跃和明确 preview 的韧性阶跃。3 个角色与 3 个奇波分别保持自己的能量轴，共 6 条能量轴；加上敌人 HP/韧性共 8 条状态曲线。方案复制、本地草稿、JSON、分享链接与 PNG 均恢复相同拓扑和曲线结果。1440x900 与 390x900 视觉证据、完整 Workbench/production Playwright、生产构建和包体审计已通过；M1 在此停止，不自动创建后续阶段。

1. 默认提供明确标注的 3 人示例方案，包含多角色动作、至少一个奇波动作/事件、敌人事件和可见的能量/HP/韧性阶跃。
2. 示例只使用当前正式 applied 或明确 preview 数据，不冒充最终战斗数值。
3. Playwright 覆盖“换人/绑奇波/选敌人 -> 拖动作 -> 曲线变化 -> 移动/删除 -> 五载体回放”，并实测 1440x900 与 390px 窄屏。
4. M1-D 完成后立即停止，报告视觉对照、核心流程、测试、包体和剩余差距；不自动创建 M2、Stage 14 或新校准/报告阶段。

#### M1 后续：核心动作身份可视化

状态：已完成。角色与奇波动作现共享统一可视身份，官方技能图标、动作名称、动作类型和已确认 60fps 时长贯通动作库、时间轴块、检查器及项目回放。可编排角色动作和 366 个奇波动作均有可发布图标；奇波图标随动作草稿进入本地草稿、JSON、分享链接和 PNG 回放，角色图标由正式技能目录稳定重建。3 个角色与 3 个奇波仍各自拥有独立能量轴，未确认奇波效果、冷却值和公式继续保持 `unapplied`。

#### M1 后续：动作事件定位与复盘可读闭环

状态：已完成。时间轴把标准 runtime state point 按动作与准确帧聚合为命中或资源事件节点；节点、曲线断点、帧游标和检查器复用同一选择链。用户可从动作轨直接定位三值详情，回源修改动作后查看同步刷新的事件与结果。旧 projection 圆点和分析面板逐段原始伤害列表已移除；运行时结果、五载体合同、6 条独立能量轴和 applied/unapplied 边界不变。

#### M1 后续：试用工作流 checkpoint

状态：已完成。真实页面走查发现默认 30 秒轴上 `0F` 与 `36F` 相邻命中节点会发生像素覆盖，导致早帧点击落入晚帧。事件布局现按当前缩放动态分层，真实浏览器和 production Playwright 均验证相邻帧可往返准确定位。6 条独立能量轴、runtime 结果和项目载体未改变。

#### M1 后续：同屏复盘不离轴闭环

状态：已完成。用户从时间轴事件打开侧边检查器、进入源动作编辑并返回刷新结果时，页面始终保留当前时间轴视口；事件日志和侧边详情只滚动各自容器，不再把文档拖到下方旧分析区。准确帧、三值详情、动作编辑和刷新后事件继续共享既有选择链，6 条独立能量轴、runtime 结果和五载体合同不变。

#### M1 后续：试用发布主流程验收

状态：已完成。真实生产浏览器已从默认示例完成“换人 -> 绑定新奇波 -> 拖入新动作 -> 同轴复盘 -> 回源编辑 -> 保存/重载 -> JSON 恢复”。本阶段修复了已有动作在槽位 3 换人后错误回退到角色 1 轨的问题：动作、切人目标和动作库身份现在按固定槽位一起迁移，3 条角色能量轴与 3 条奇波能量轴始终保持独立。桌面与 390px 窄屏均已验收。

#### M1 后续：空方案从零编排验收

状态：已完成。新建方案现在以零动作开始，八条状态曲线从 0 到轴末完整显示初始平线。用户可在空方案中更换三个角色、绑定各自奇波、选择敌人，再直接拖入角色技能、资源动作、奇波动作和敌人事件。删除最后一个动作后可再次回到合法空方案；本地草稿与 JSON 可恢复相同队伍、轨道和曲线。3 条角色能量轴与 3 条奇波能量轴保持独立，奇波未确认能量仍为 `tracking-only / unapplied`。

#### M1 后续：试用候选发布 checkpoint

状态：已完成。`npm run test:trial-release` 现在以单命令守住单元/组件测试、生产引用、数据投影、包体、applied source、生产构建和 Playwright。默认示例主流程、空方案从零编排和六能量轴事件复盘已纳入 `trial-ready` 必需能力，当前报告为 37/37。`README.md` 与 `TRIAL_RELEASE.md` 提供一致的启动、两条必试流程、机制边界和反馈材料清单。

#### M1 后续：对标完成度审计

状态：已完成。`M1_COMPLETION_AUDIT.md` 使用当前代码、37/37 production capability、桌面/窄屏证据和 Endaxis `c39bd6b` 源码逐项核对工作区、队伍拓扑、编辑、运行时、项目回放与复盘。M1-A 至 M1-D 的明确要求均有直接证据，可以关闭 M1 核心里程碑；完整重构目标仍缺少受控角色时间状态、动作/效果关系语义和已确认 AzPr 机制接入。

#### M1 后续：受控角色与切人编排闭环

状态：已完成。项目可显式选择初始前台角色，`switch` 动作会在准确 60fps 帧生成受控角色 transition 与 interval；帧游标、时间轴身份底色和日志同步显示当前前台。移动、删除、撤销/重做、循环边界继承以及方案复制、本地草稿、JSON、分享链接和 PNG 均恢复同一控制状态。3 条角色能量轴与 3 条奇波能量轴继续独立，切人不伪造任何三值变化。候选值证据保留在二级分析区，不再重复叠加到核心时间轴。

#### M1 后续：动作/效果关系语义闭环

状态：已完成。`sequence`、效果触发、刷新和消耗现统一进入同一动作/效果关系图；runtime 给出 satisfied、unsatisfied、blocked 或 invalid 诊断，时间轴、效果复盘和日志共享选择与准确帧定位。动作移动、效果删除与撤销会同步重建关系，本地草稿、JSON、分享链接和 PNG 回放得到同一图。关系合同只做追踪与诊断，不进入 calculator；3 条角色能量轴与 3 条奇波能量轴继续独立。

#### P3 六资源所有者机制输入检查点

状态：已完成。角色能量继续只接受已验证 `recover-sp-applied`；奇波能量新增 `PetEntity.PetUltimateCdTime` 受控观测入口，并用实际 `PetEntity.data -> BaseData.configId/entityId`、固定槽位、角色和奇波 ID 做四重所有者核对。观测值只进入对应奇波的 tracking 曲线，不进入 calculator；`petDelta` 继续保留为 SP 分享诊断，未被误接为奇波能量。

#### P3 六资源观测回放一致性

状态：已完成。方案复制、本地草稿、JSON、分享链接和 PNG 现共同回放 3 条角色能量变化与 3 条奇波就绪观测，保持相同资源所有者、准确帧、原始观测和六轴曲线结果。奇波采样导入在动作重绑定前锁定 `slotId / actorId / kiboId`，拓扑缺失或任一所有者漂移会拒绝整份 capture；旧角色 SP 外部样本绑定语义不变。

#### P3 六资源采样导入闭环

状态：已完成。一个 `runtime-sample-captures` 文件可同时包含 3 个角色 SP 与 3 个奇波观测；绑定优先使用精确动作 ID，缺失时按当前三人队中的 owner、技能或纯奇波动作选择唯一动作，不再把整批数据都压到当前选中动作。歧义、多 owner 和 owner drift 会拒绝，旧外部角色样本仍可使用选中动作兼容回退。CLI 可通过重复 `--input` 直接打包六个采集文件，并拒绝重复会话 ID。浏览器已验证一次导入 6 组、三条奇波曲线各自产生断点、JSON 导出回载一致。

#### P0/P3 六资源生产试用检查点

状态：已完成。候选发布现把“六个独立输入文件 -> normalizer v2 批次 -> production Workbench 一次导入 -> 六个 owner 动作绑定 -> 项目 JSON 回放”列为必需 capability，与开发态主流程共用同一夹具。完整 `test:trial-release` 通过 491 条单元/组件测试和 40/40 项 production preview。仓库与 AzPr 数据工作区未发现非 fixture runtime capture，因此验收明确只证明六资源工作流和所有者隔离，不把夹具或 tracking-only 奇波观测冒充真实机制。

#### P3 六资源受控采样范围隔离

状态：已完成。显式 PID host 新增 `role-sp / kibo-energy / toughness / all` 采集范围；agent 只安装所选资源链的 hooks，避免奇波会话混入 RecoverSP 或削韧事件后被绑定到错误动作。奇波范围强制提供槽位与奇波 ID，角色和韧性范围拒绝奇波参数；会话元数据保留范围和完整绑定身份。旧调用默认 `all`，项目与标准 capture schema 不变。

#### P3 六资源采样计划与离线预检

状态：已完成。版本化计划强制三个固定槽位各有一份角色 SP 与一份奇波能量会话，合计 6 个独立资源 owner；同槽 `actorId` 必须一致，奇波、会话、动作和输出身份必须唯一。预检可在不启动客户端时生成六条受控命令，并对已有文件执行 production 来源及 owner binding 核对；六份全部通过后可从同一计划生成 `--require-production` 批次。工具不启动或附加客户端，也不自动执行采集命令。

#### P3 Workbench 项目到六资源计划桥接

状态：已完成。Workbench project/draft v1-v16 可直接生成六资源计划，自动继承 3 个角色槽、各自奇波、敌人及兼容来源动作；动作候选唯一时直接锁定，有歧义时必须按槽显式选择。缺奇波、owner 不兼容、重复身份或旧/未来不支持 schema 均在写文件前拒绝。生成后继续复用同一六 owner 预检、受控命令和 production 批次守门，不新增 UI 或公式。

当前里程碑：**M12-B3-C15 已在 `aafb6aa6c645b7b7490fdba0f71b8941da311f6e` 通过产品验收，阶段暂停待命**。C15 以版本化原生证据闭合持久安装根、周期条件复评和有限叶生命周期，接入 `10084/10152/10197`；`10078` 因 `[302,303]` 多 PropertyTag 的原生匹配语义未闭合而继续 fail-closed。当前为 42/62 灵子、11/12 套装技能运行时接入，375 条阻断（354 not-implemented、21 evidence-insufficient）；五类 admission、M12-C 与正式搜索继续锁定。未收到用户明确恢复指令前，不启动 C16 或任何新机制批次。

### M2-R1：时间轴直接装配表面（已完成并通过产品验收）

- 在现有角色身份列内提供独立头像按钮和 6 个固定尺寸槽位：武器、上装、下装、耳环、戒指、灵子，使用 2 行 3 列紧凑布局；奇波只在所属奇波子轨提供直接入口。身份容器不再伪装成包裹按钮的 `role=button`，槽位事件与轨道选择、游标和旧检查器隔离。
- 已装备显示真实图标，空槽显示稳定空框/加号，tooltip 标明槽位；奇波子轨和敌人身份分别直达对应选择器。右侧检查器只保留初始 SP、敌人倍率等高级配置和详细摘要，不再承担基础换人/装配。
- 换人继续只调用 `updateTeamSlot`：未上阵角色替换固定槽位，已上阵角色交换槽位且不产生重复；动作、切人目标、动作库和六轴 owner 沿现有规范化迁移，新角色培养项按合同重置，不继承旧角色装备。

### M2-R2：统一按需可视选择器（已完成并通过产品验收）

- 只实现一个异步统一选择器，由 target kind 展示角色、奇波、指定装备槽、灵子或敌人；桌面使用对话框，390px 使用可滚动覆盖层/抽屉。
- 候选卡显示真实图标、名称、可靠摘要和当前状态；奇波/装备/灵子可卸下，装备严格按槽位过滤。提供名称搜索；角色标出当前槽和队伍中状态，不扩成图鉴、复杂排序或数值编辑器。
- 完整 detail catalog 只在首次打开选择器时 fetch 并在会话内缓存，槽位已选项解析复用同一缓存；加载失败显示可重试错误。源图标缺失的敌人使用文字首字空态，不显示坏图或伪造图标。培养效果继续 `unapplied`。
- 奇波、装备、灵子和敌人等长列表使用面板内独立滚动区；原生滚动条隐藏，只保留一条常驻且可拖动的自定义滚动轨。鼠标滚轮、触控滚动及列表顶/底的滚动链不得带动后台工作台。

### M2-R3：真实工作流与发布验收（已完成并通过产品验收）

- 默认方案与空方案分别执行真实路径：槽位 3 头像换成未上阵角色，验证动作/动作库迁移，逐项装配奇波/五件装备/灵子，直接换敌人，撤销/重做装配，拖入动作并保存/回载；E2E 禁止直接操作右侧原生下拉框。
- 集成守门继续证明方案复制、本地草稿、JSON、分享链接和 PNG 恢复同一 loadout、owner 和 8 条曲线；选择器在切换方案、关闭和导入后不保留旧 target。
- 1440x900 使用占满首屏剩余高度的时间轴工作区；三角色、三奇波、敌人与 8 条状态曲线在同一内部滚动坐标中保持归属和对齐。390x900 关闭选择器后回到无页面横向溢出的时间轴。截图至少覆盖桌面选择器、桌面装配完成、窄屏选择器、窄屏关闭后时间轴。
- 角色动作轨加高到可清楚辨识头像与 6 个接近正方形的装配图标，8 条状态曲线提高到可辨识高度；动作块和关系线按 `durationMs / axisDurationMs` 使用真实宽度，不再设置 8% 展示下限。动作块在轨道中部为 Buff、CD 和运行时节点保留上下区域，短动作通过容器宽度收起内部编辑手柄，使移动、跨轨和批量拖拽仍可操作。
- 时间轴外框高度必须独立于内容宽度；缩放或长轴触发内部横向滚动条时，工作区总高度保持不变，不得推挤后续页面区域。
- 完整 trial-release、生产数据、applied-source 与 740,000B 发布门槛通过；只在末尾做一次结构性包体收口，优先删除旧重复下拉主交互并让选择器保持 lazy chunk，同时提交与当前源码一致的 bundle 报告。完成并通过产品验收后停止，等待下一阶段确认。

验收结果：M2 已完成并通过产品验收。93 个测试文件、508 条单元/组件测试与 41/41 production preview 全部通过；本轮新增固定首屏时间轴高度、轨道可读尺寸、动作上下留白以及横向滚动条不改变外框高度的浏览器守门。生产引用、数据、bundle 与 applied-source 审计通过；总 JavaScript gzip 为 719,860B，Workbench 主块为 329,042B，低于 740,000B/370,000B 硬门槛。桌面与窄屏证据由 `m1a-workbench-desktop.png`、`m1a-workbench-narrow.png`、`m2-direct-equipped-desktop.png` 和 `m2-direct-timeline-narrow.png` 覆盖。下一阶段尚未确认。

### M3-A：动作状态生成层（已完成并通过产品验收）

- 先审计真实角色与奇波动作目录，明确哪些可编排动作具有可信 CD、效果身份和生命周期来源，哪些只能保持无状态；审计只决定自动生成覆盖，不反向填造缺失数据。
- 动作从动作库拖入后，由统一 generation 路径把可信动作记录转换为结构化冷却来源、效果身份及已确认的触发/结束描述。Project、动作草稿、compiler 输入和回放消费同一描述，不建立第二套 UI 数据。
- 自动生成项必须保留 source identity 与 `applied / tracking-only / unapplied` 状态。禁止从描述文本猜倍率、持续时间、层数或精确触发帧；证据不足时不生成虚假 Buff/CD 条。
- 装备、灵子、奇波培养倍率、敌人防御/抗性及测试期平衡值不进入 M3，P3 非 fixture 真实采样继续暂停。

完成结果：覆盖审计确认 120 个角色技能中 52 个具有正式结构化 CD：40 个直接来自 `skillsub_logic.coolDown`，另有 12 个星决技在逻辑行为 CD 为 0 时由正值 `skill_level.coolDown` 提供展示/就绪 CD；两处均为 0 的技能保持“未提供”，不生成零长度条。366 个奇波动作全部从 `skillsub_logic.coolDown` 读取标准战斗 CD，并保留奇波对战 CD 作为来源诊断，不混用为当前模式。6 个 Buff 对象候选中仅寒悠悠 `10100322` 的星携技满足“明确目标注入行为 + 57F 触发 + 8000ms 生命周期 + 结构化动作变体绑定”，其余 5 个保持 tracking-only；奇波仍不生成未确认 Buff。动作草稿、Project 动作和回放共享 `AzPrActionStatusGeneration`，生成项保留来源身份、置信状态并始终 `appliedToCalculators = false`。

### M3-B：运行时状态生命周期（已完成并通过产品验收）

- 复用现有 compiler、execution plan、readiness timeline、effect runtime、interval projection 与 relation graph；动作实际执行后生成可信 CD 窗口，并在有可靠输入时生成 `apply / refresh / stack / consume / remove / expire` 生命周期。
- 被规则阻塞或跳过的动作不得生成 CD 或效果。移动、复制、删除、跨轨、切人、撤销/重做和循环继承后必须经同一响应链重算，不保留旧窗口或旧节点。
- 角色、奇波和敌人的 owner、target、动作关系、效果区间、事件节点、曲线与日志使用同一 identity；方案复制、本地草稿、JSON、分享链接和 PNG 恢复相同状态内容。
- 未确认效果继续 `appliedToCalculators = false`。M3 不改变 HP、韧性、六条资源曲线或战斗公式，只建立状态生成与复盘闭环。

完成结果：目录 generation 已直接进入既有 compiler 和 execution plan；可信 CD 由 readiness timeline 生成，唯一严格绑定的生命周期由 effect runtime 统一投影到区间与 action/effect relation graph。冷却状态按 `ownerKind + ownerId + skillId` 隔离并使用有效 CD 判定，同技能在窗口内复用会被 execution plan 跳过，不产生第二个 CD 窗口、效果或数值事件。来源基础值与最终有效值由 `AzPrActionCooldownEvaluation` 分离，adapter 可按动作时点读取场景、既有窗口和后续 runtime effect state 接口并返回修正结果；默认 adapter 不猜测任何技能/Buff 公式。移动、删除、复制和循环边界继承均从同一描述重算，方案复制、本地草稿、JSON、分享链接和 PNG 已验证恢复相同状态，全部效果继续 `appliedToCalculators = false`。

### M3-C：同轴可视化与真实工作流验收（已完成并通过产品验收）

- 在 M2 已预留的轨道空间内，动作块上方显示 Buff/状态区间，下方显示 CD 条与生命周期节点；动作块继续居中，不能靠无边界增加轨道高度破坏固定高时间轴。
- 条块显示稳定图标或空态、名称、来源动作、开始/结束帧和来源状态。点击条块或节点应移动统一帧游标、打开既有检查器并可回到来源动作；无可靠来源时保持干净空区。
- 主流程 E2E 必须从动作库拖入真实目录动作触发自动生成，不得直接向 fixture 注入 `effectCommands` 冒充主流程。覆盖可信 CD、已有可靠生命周期的效果、无可靠效果保持空白、阻塞动作不生成状态、编辑后重算及保存/回载。
- 默认方案与空方案均需通过撤销/重做、循环继承、五载体、1440x900、390x900、长轴滚动和完整 trial-release。包体只守 740,000B 硬门槛，不为 M3 拆出逐字节优化阶段。完成后停止等待用户验收，不自动创建 M4。

完成结果：状态区间在目标轨上显示名称、准确起止帧和 `unapplied` 状态，可信 CD 在来源动作下方显示并可回到动作与起始帧；同一 owner 的重叠 Buff 与不同技能 CD 通过各自布局器独立占行，奇波 CD 保持在所属奇波子轨，不与角色 CD 共用 identity。水灵偶 `灵偶涟漪` 现以精确 `kiboId = 500003 / skillId = 50000302` 读取标准战斗 CD `24000ms`，冷却内再次拖入会显示明确阻塞态且不产生第二条窗口；可确认星决技使用相同冲突链。生命周期节点和区间点击统一移动帧游标、选择来源动作并打开既有检查器。目录自动生成项在检查器中为只读来源摘要，叠层未确认时明确使用单实例 runtime 投影，不伪装成游戏机制。真实动作库拖入流程覆盖可信生命周期、角色/奇波/星决技 CD、无可靠效果、CD 阻塞、移动、删除、撤销/重做、默认/空方案、保存回载、长轴和 1440x900/390x900。完整守门为 97 个测试文件、530 条单元/组件测试和 43/43 production preview；生产引用、数据、动作状态、bundle 与 applied-source 审计均通过，总 JavaScript gzip 为 729,806B，Workbench 主块为 338,493B，低于 740,000B/370,000B 硬门槛。视觉证据新增 `reports/m3-water-kibo-cooldown-desktop.png` 与 `reports/m3-water-kibo-cooldown-narrow.png`。

### M4-A：统一合法放置提议层（已完成并通过产品验收）

- 新增一个标准放置提议合同，输入用户请求的轨道、帧位、动作或动作组以及当前方案状态，输出 `valid / adjustable / blocked / unresolved`、建议帧位、目标轨、冲突动作、规则来源和调整原因。该合同只组合现有同轨占用、CD readiness、受控角色区间、动作关系、owner/target 与时间边界，不复制规则实现。
- 动作库拖入、已有动作移动、复制粘贴和批量平移必须消费同一提议；单动作与动作组共享相同 60fps 坐标和边界语义。组提议保留相对帧差、跨轨归属和组内关系，不逐个动作独立挤压。
- 只有具有确定来源的占用、CD 和关系约束可以给出自动调整位置。SP 单位、未知 Buff 规则、未确认奇波效果等保持 `unresolved`，只提示而不自动移动或阻止提交。
- 放置提议属于编辑/运行时派生状态，不进入 calculator，不改变 HP、韧性、六资源曲线或 M3 状态生成；禁止引入新的排轴求解器、优化目标或数值评分。

完成结果：新增 `AzPrActionPlacementProposal` 派生合同，候选动作先以当前项目配置临时编译，再由既有 `AzPrActionRuleDiagnostics` 与 readiness 判定同轨占用和技能 CD；只有带确定来源与建议帧的冲突可将整个动作组后移，组内关系和相对帧差保持不变，轴末无空间或组内固有冲突则整体阻塞。SP 与前台角色区间不匹配继续作为 `unresolved` 提示且可提交，不改变 calculator、三值曲线或项目 schema。动作插入、移动、复制粘贴和批次平移均已生成同一提议，当前自由编辑提交行为保持不变。

### M4-B：事务式约束编辑接线（已完成并通过产品验收）

- 时间轴提供清楚的“自由 / 约束辅助”分段模式。自由模式保持现有行为，允许用户故意留下冲突并由 diagnostics 解释；约束辅助模式只在提议为 `valid` 或 `adjustable` 时提交，确定阻塞时保持原状态。
- 约束辅助提交必须是单次历史事务：动作、关系、生成状态、CD/Buff 区间和选中态一起更新，撤销/重做完整恢复；批量操作不能部分成功，也不能在失败后留下临时 owner、窗口或关系。
- 自动调整优先选择不早于请求帧的最早合法位置，并保持动作组相对布局。跨轨移动必须重新核对 owner、受控角色和对应角色/奇波轨；超出时间轴时整组回退或明确阻塞，不逐项截断。
- 方案切换、导入、循环继承和五载体回放不保存拖拽中的临时提议；已提交结果继续通过现有项目合同恢复。辅助模式本身是本地 UI 偏好，不升级项目 schema。

完成结果：时间轴提供显式“自由 / 辅助”分段模式，本地模式与临时提议不进入项目 schema。辅助模式下，插入、复制粘贴、关联组移动、跨轨迁移和批次平移均在历史快照前消费同一提议；`adjustable` 整组采用建议位置，`blocked` 整组拒绝且不推进剪贴板或历史。关联动作会扩展为同一事务并保持相对帧差，跨角色时角色轴与奇波子轴 owner 一起迁移；撤销/重做完整恢复。自由模式及原有诊断流程保持不变，`unresolved` 仍可原位提交。

### M4-C：同轴拖拽反馈与真实工作流验收（已完成并通过产品验收）

- 在当前时间轴内显示固定尺寸的拖拽 ghost、目标帧引导线和合法/调整/阻塞状态；只用简短 tooltip 或现有检查器说明主要规则，不新增大型诊断面板。反馈不得遮挡动作、Buff/CD 条和八条曲线，也不得改变工作区高度。
- 新动作拖入、已有动作拖动、跨轨移动、框选动作组、复制粘贴和关系组移动使用同一视觉语言。约束辅助预览必须显示请求帧与建议帧的差异，提交后 ghost 和临时引导立即清理。
- 真实 E2E 至少覆盖角色同轨占用、角色/奇波同技能 CD、跨角色合法移动、关系动作组保持、时间轴末端整组处理、自由模式保留冲突、约束辅助自动调整、确定阻塞不落盘以及撤销/重做。主流程必须使用真实动作库和真实拖拽，不直接调用内部更新函数冒充交互。
- 默认方案与空方案均需通过方案复制、本地草稿、JSON、分享链接、PNG、循环继承、1440x900、390x900、长轴缩放滚动和完整 `test:trial-release`。包体只守 740,000B 硬门槛，不为 M4 拆出逐字节优化阶段。M4 完成后停止等待产品验收，不自动创建 M5。

完成结果：动作库拖入和已有动作移动在同一时间轴内显示固定高度 ghost、请求帧与辅助建议帧；状态颜色区分合法、可调整、阻塞和未决，短 tooltip 复用既有规则摘要，不增加面板或轨道高度。真实星鸣技拖拽验证两次充能、同轨占用、最早可用位置、轴末阻塞不落历史、自由模式保留冲突及撤销/重做；390px 下关闭覆盖式检查器后可继续在当前横向滚动位置预览，页面无横向溢出。完整 trial-release 通过 98 个测试文件、544 条单元/组件测试和 44/44 production preview；41 项必需能力全部通过，总 JavaScript gzip 为 735,830B，Workbench 主块为 344,517B，低于 740,000B/370,000B 硬门槛。视觉证据为 `reports/m4-constraint-placement-desktop.png` 与 `reports/m4-constraint-placement-narrow.png`。

验收结果：M4 已完成并通过产品验收。

### M5-A：编排片段生成与兼容合同（已完成并通过产品验收）

- 从当前多选动作或完整关系组生成版本化编排片段，以最早动作归零，保留动作目录 identity、持续时间、相对帧差、跨轨归属和组内关系；固定队伍槽同时记录所需角色/奇波兼容身份，禁止把专属动作静默套用到不兼容 owner。
- 片段与“预设轴库”分层：预设继续保存完整项目，片段库只保存局部编排。片段不保存动作实例 ID、选中态、CD/Buff 区间、曲线、日志或 calculator 输出，避免把旧运行时结果复制到新方案。
- 提供本地版本化片段库及单一 JSON 导入/导出合同，支持命名、标签、复制和删除；不引入后端、账号、在线分享或社区市场，不升级 Workbench project schema。

完成结果：新增独立的 `AzPrWorkbenchTimelineFragment` v1 与片段库 v1。保存单个动作会自动扩展到完整关系组，以最早动作归零并保留相对帧差、角色/奇波/敌人轨语义、固定队伍槽身份、来源动作 identity 和关系；自动生成状态、旧动作/关系 ID、插入元数据、生成批次及运行时输出均不会进入片段，手工效果输入则保留并在插入时重分配 ID。兼容检查会阻塞角色、奇波或真实来源动作不匹配，奇波目录尚未加载时只返回 `unresolved`。本地片段库与完整项目预设分离，支持命名、标签、复制、删除及单一 JSON 库导入导出，不升级 Workbench project schema。

### M5-B：事务式插入与运行时重建（已完成并通过产品验收）

- 片段拖入或点击插入时重新分配动作/关系 ID，按当前固定队伍槽解析角色、奇波与敌人轨；身份不兼容、来源动作缺失或关系不完整时给出明确 `blocked / unresolved`，不得猜测替代动作。
- 整个片段作为一个 M4 放置提议和一个历史事务处理。自由模式保持请求位置，辅助模式整组采用最早确定建议位置；任一确定阻塞都不落盘，不允许部分插入或关系悬空。
- 插入成功后统一重跑 M3 generation、compiler、readiness、effect runtime、CD/Buff 投影、曲线与日志；重复拖入同一片段也必须从当前方案状态重算。撤销/重做完整恢复，已插入结果继续随方案复制、本地草稿、JSON、分享链接和 PNG 回放。

完成结果：片段实例化会先执行固定槽位、角色、奇波与真实来源动作兼容检查，再按当前方案重分配动作/关系 ID；损坏关系、owner 漂移或来源目录未就绪时整组返回 `blocked / unresolved` 且不生成部分草稿。兼容组使用现有 `createWorkbenchActionDraft` 重建动作，因此旧 `statusGeneration`、CD/Buff 和自动效果命令不会复用，M3 generation 会基于新动作 ID 与当前目录重新生成。Workbench 将整组关系加入同一个 M4 放置提议，轴末等确定阻塞在自由与辅助模式下都不落盘；自由模式保持请求帧，辅助模式整组采用建议偏移，随后只记录一次历史快照并触发一次既有运行时同步。标准项目 JSON 往返已验证保留新动作、关系与重建后的状态 identity。

### M5-C：时间轴片段库与真实工作流验收（已完成并通过产品验收）

- 在现有动作库中增加紧凑的“动作 / 片段”视图；用户可从当前选择保存片段，片段条目显示名称、动作数、持续范围、涉及轨道和兼容状态，并可直接拖到时间轴。复用 M4 ghost、请求帧、建议帧和合法状态，不新增独立编排页面或大型分析面板。
- 桌面与 390px 下都要完成“选择动作组 -> 保存片段 -> 清空或切换方案 -> 拖回主轴 -> 编辑 -> 撤销/重做 -> 保存回载”的可见主流程；身份不兼容、轴末阻塞、自由/辅助差异、跨角色与奇波关系组都必须通过真实交互验证。
- 完成时运行单元/组件、生产数据、五载体、长轴滚动、1440x900、390x900 与完整 `test:trial-release`。包体只在 M5-C 末尾做一次结构性检查，不拆出逐字节压缩阶段；功能完成后停止等待产品验收，不自动进入 M6。

完成结果：动作库现提供紧凑“动作 / 片段”切换。片段可从当前关系组选区保存、搜索、复制、删除及 JSON 导入导出，卡片直接显示动作数、帧跨度、轨道和兼容状态；点击与指针拖拽共用 M4 整组 ghost 和放置提议。真实角色/奇波关系组已验证辅助模式自动避让、轴末整体阻塞、自由模式保留 readiness 冲突、身份不兼容禁用、撤销/重做及项目回载；390px 下片段库在时间轴前保持可拖回且页面无横向溢出。完整 `test:trial-release` 通过 100 个测试文件、553 条单元/组件测试和 45/45 production preview，41 项必需能力判定为 `trial-ready`；总 JavaScript gzip 为 723,205B，初始入口为 89,229B，Workbench 主块为 338,124B，均低于发布硬门槛。桌面与窄屏证据为 `reports/m5-timeline-fragment-desktop.png` 和 `reports/m5-timeline-fragment-narrow.png`。M5 已完成，等待产品验收，不自动进入 M6。

验收结果：M5 已完成并通过产品验收。

### M6-A：验证公式包与动作机制生成（已完成）

- 新增单一受控同步入口，把 `C:\PC2\Codex\AzPr\work\combat-formulas\combat-formula-calculator.mjs`、`outputs\combat-formulas-evidence-20260718.json`、1/12 级真实技能样例及来源 build/hash 转成仓库内可发布的版本化公式包；生产运行不得依赖外部绝对路径。同步结果必须保留区域、日期、来源 identity、置信状态和校验和，并以知识库 18/18 向量作为交叉守门。
- 在现有 mechanics profile catalog 注册 verified profile，完整声明 Q16.16 截断、中点取偶和实际乘法顺序；旧 preview profile 只保留为旧项目兼容与缺输入诊断，新建方案默认选择 verified profile。公式包版本或项目选择不兼容时明确阻塞/降级，不静默回到 raw preview。
- 从完整 Battle 导出与现有动作目录生成严格的 `skill/subskill -> damage element -> formula/recoverSP/petRecoverSP/recoverInterval/weakBreakDamageRate` 绑定。只有来源链唯一且所需输入齐全的动作进入 applied；未绑定动作保持 `unresolved / unapplied`，禁止从技能描述文本猜倍率或机制。

完成结果：新增 `data:sync-verified-combat` 与 `audit:verified-combat` 单一受控入口，知识库复算器、证据、真实样例和完整 Battle 来源被同步为仓库内 `azpr-verified-combat-mechanics-package` v1 与生成式 Q16.16 runtime。当前包通过 18/18 验证，审计 619 个候选动作、407 个 control、224 个 applied 动作绑定和 1763 个 applied hit 绑定；208 个敌人韧性 profile 中 204 个通过原表属性交叉校验并可应用，其余 4 个保持 unresolved。每次同步保留 build、区域、来源哈希、package hash 与 identity。verified profile 已注册，新建方案默认使用，旧项目继续保留自身 profile；包未加载、身份不唯一、control 缺失或敌人输入不完整时只返回 unresolved，不回退伪造预览值。

### M6-B：三值运行时与状态机替换（已完成）

- 复用现有 `AzPrThreeValueMechanicsAdapter` 和 runtime hit transaction，接入普通、失序爆发、真实伤害、次数盾/数值盾与最低值约束；每个命中按知识库顺序执行 Q16.16 运算并保留 trace。暴击等随机分支使用项目中显式、可回放的命中结果，不在每次响应式重算时重新随机。
- 同一命中事务以护盾前 HP 伤害计算普通削韧，支持专用 Weakness 路线、`WDM_MIN/MAX`、恢复延迟、Break 线性恢复、结束等待及 Break 承伤倍率；HP 与韧性必须共享同一命中 identity、帧位和 before/delta/after，不得分别用两套预览值。
- 角色与奇波资源轴按 0.1 秒固定步长计算前台/后台自动回能，并在准确命中帧应用 `recoverSP / petRecoverSP / recoverInterval`、后台分享、动作消耗和 `[0, MAXSP]` 裁剪。受控角色区间决定前后台身份，六个资源 owner 独立；缺少确切 MAXSP、属性或动作来源时只保留未决平线，不伪造变化。
- M3 已确认状态可以通过现有 adapter 影响公式；装备、灵子、奇波培养、吸血、反伤、事件回调和 `useOneBreak` 等尚未确认机制继续 `unapplied`，不为完成 M6 扩写知识库边界。

完成结果：新增 `AzPrVerifiedCombatRuntime` v1，并由现有 simulation engine、standard delta generation、mechanics adapter、hit transaction 和 runtime projection 共同消费。命中事务按 verified Q16.16 路线处理普通/失序/真实伤害、数值盾/次数盾、普通削韧、纯 Weakness 与 Break 状态；敌人 profile 驱动普通韧性恢复延迟、Break 线性恢复、结束等待和退出，所有命中与状态步都保留同一 before/delta/after 及来源 identity。角色与奇波 SP 复用 100ms 固定步长、前后台身份、命中恢复/分享/间隔/消耗/裁剪，随机分支只消费可回放结果。`AzPrInitialRuntimeState` 升级为 v3，循环继承角色 SP、奇波 SP、敌人 HP/韧性/Break 进度、恢复剩余时间、盾、来源锚点与既有效果；被阻塞动作和 unresolved 动作不生成 applied 三值。

### M6-C：八曲线同轴工作流与产品验收（已完成）

- 用户从真实动作库拖入具有精确来源的角色或奇波动作后，三角色 SP、三奇波能量、敌人 HP 与敌人韧性/Break 八条曲线在同一 60fps 时间轴按帧变化；自动回能显示连续稀疏线段，命中/消耗/削韧/Break 节点可点击并回到来源动作。既有检查器只增加公式版本、分支、before/delta/after 和来源摘要，不新增大型分析页面。
- 真实主流程至少覆盖芃芃 `10100703 / 101007012` 的 HP、削韧、角色/奇波命中回能链，以及重岩蹄 `50046903` 的三伤害元素链；覆盖前后台切换、回能间隔、SP 裁剪、护盾吸收、Break 前后承伤、纯 Weakness、自由/辅助排轴、片段插入后重算、撤销/重做和来源不足保持 unapplied。
- 默认方案与空方案均验证方案复制、本地草稿、JSON、分享链接、PNG、循环继承、1440x900、390x900 和长轴滚动。五载体必须恢复相同 verified profile、动作绑定、命中事务、曲线断点与 trace；旧 preview 项目导入不得被静默改写。
- 完成时新增公式同步/漂移审计并运行完整 `test:trial-release`，视觉证据同时展示动作、八条真实曲线和可回源节点。包体只在 M6-C 末尾统一检查，不拆出压缩阶段；M6 完成后停止等待产品验收，不自动进入 M7 或自动最优排轴。

完成结果：真实 Workbench 路径已覆盖芃芃公开动作 `10100701` 经 control `10100703` 命中 `101007012`，以及重岩蹄 `50046903` 的五个真实 hit；三角色 SP、三奇波 SP、敌人 HP 与韧性/Break 均由同一帧级事件驱动并可回到 source identity。动作移动、删除、撤销/重做、长轴缩放、循环继承和五载体恢复保持一致。当前严格动作目录的 applied hit 只覆盖 damage type 1-5；没有唯一真实动作 binding 的纯 Weakness、真实伤害和叠加越限分支只保留公式级守门，不伪造可拖动作或曲线节点。完整 `test:trial-release` 通过 103 个测试文件、566 条单元/组件/集成测试、46/46 production preview 与 41/41 必需能力；总 JavaScript gzip 为 738,031B，初始入口为 89,225B，Workbench 主块为 352,701B，均低于 740,000B / 120,000B / 370,000B 硬门槛，总量高于 735,000B 预警线。视觉证据为 `reports/m6-verified-combat-desktop.png` 与 `reports/m6-verified-combat-narrow.png`。M6 当前只等待产品验收，不自动创建下一里程碑。

### M6-R：数值链与稀疏曲线整改（已完成，等待产品复验）

整改完成“模拟序列 -> 显示序列”投影：100ms 自动回能与韧性恢复只保留斜率边界、回满点和终点，技能消耗、命中回复、HP/韧性扣减保留同帧 before/after 阶跃；同一动作的密集命中聚合为一个可回源节点，不同动作仍保持独立身份。时间轴删除逐 tick 圆点、动作下方 Lightning 队列、重复菱形和 glow/filter，八条曲线均按自身 `current/max` 归一化。

数值侧统一属性 227 为 `SPRET_AUTO`，命中回复读取各角色/奇波 owner 的 `SPGETUP / SPGETUP_ATK`，并按 DamageElement identity 限流；该阶段曾记录的 `1 -> 0` 消耗结论已由 M6-R2 推翻，最终合同为满 `100` 时施放帧 `100 -> 0`、`99/100` 时阻止伤害、CD 与效果。HP/削韧继续使用 verified Q16.16 顺序和各自 max。曲线投影与视觉证据继续作为 M6-R2 的显示基线。

### M6-R2：SP 单位契约修正（已完成，等待产品复验）

完成结果：受控同步入口同时生成完整 SP 证据合同和紧凑运行时投影；20 个角色与 122 个奇波 profile 均保留 `maxSpBase=1`、成长来源与倍率 `100`，并得到 `effectiveMaxSp=100`。运行时删除技能消耗 `/100`，自动回复在 Q16.16 下前台 `1s=0.208282`、`30s=6.248474`；芃芃 `101007012` 单次有效命中分别回复角色 `1.069992` 与奇波 `4.161102` SP。重岩蹄 `50046903` 和角色星决技均以 `100` 为施放门槛，满值精确扣为 `0`，`99/100` 明确阻止执行。

草稿 schema 升至 v17，v1-v16 的角色/奇波归一化资源在载体入口迁移为绝对 SP，新 JSON、分享、PNG 与本地草稿只写出点制语义；空奇波槽同样显示 `0/100`。聚焦数值与五载体测试、105 个测试文件共 582 条单元/组件/集成测试以及 M6-R2 真实浏览器工作流均已通过；完整 production preview 以 46 条流程为最终守门。总 JavaScript gzip 为 739,933B，Workbench 主块为 354,623B，低于 740,000B / 370,000B 硬门槛。视觉证据为 `reports/m6r2-sp-units-desktop.png` 与 `reports/m6r2-sp-units-narrow.png`。当前停在 M6-R2，等待产品复验。

### M7-A：动作全集与三值映射生成（已完成，等待产品验收）

- 分母必须由当前客户端公开角色技能表和奇波动作目录生成，不依赖已有绑定集合，也不硬编码 owner。每个公开角色的普攻、主动技、星决技及真实派生段/连段/蓄力变体，以及每个公开奇波可释放技能，都必须进入动作全集。
- 受控同步入口统一关联公开 skill、skill control、Battle 帧触发、DamageElement、专用 Weakness、召唤/派生命中和等级倍率。每个动作、变体与命中保留 owner、动作类型、帧率/命中帧、HP/韧性/SP 字段、source identity、源文件字段路径及结构化状态。
- 每个维度只能是 `applied`、`verified-zero` 或 `unresolved`。只有原配置明确为零才可写 `verified-zero`；缺源、间接引用未展开、owner/control 歧义必须保持 `unresolved`，不得用零掩盖。

### M7-B：全量通用运行时与八曲线接入（已完成，等待产品验收）

- 继续复用唯一 verified mechanics runtime，不按角色或技能分支。每个真实命中帧结算 HP、韧性，并按 DamageElement identity 处理 interval；角色命中回复对命中 owner 为 100%、后台角色各 50%，奇波命中回复对全部已装配奇波各 100%，接收者使用自己的 `SPGETUP / SPGETUP_ATK` 并在 `0..100` 裁剪。
- 动作消耗、阻塞、命中、持续伤害、Weakness 与召唤/派生命中使用同一来源身份和事件顺序。多段命中按真实节点分别变化；明确为零的维度保持平线，未决维度不生成伪节点。
- 三角色 SP、三奇波 SP、敌人 HP 与敌人韧性曲线只消费通用运行时结果；延续 M6-R 的稀疏语义节点，不增加光效、点阵、闪电或额外装饰。未完整解析的动作在动作库与诊断中显示结构化原因。

### M7-C：覆盖报告与全目录验收（已完成，等待产品验收）

- 生成机器可读覆盖报告和简洁 Markdown 矩阵，按 owner/actionKind 汇总目录动作、已关联、可运行、unresolved 与命中数，并分别统计 HP、韧性、角色回能、奇波回能的 nonzero、verified-zero、unresolved；列出所有 unresolved 项及原因。
- 生成式完整性测试必须证明公开动作全集 100% 被分类，所有 Battle 非零 `recoverSP / petRecoverSP` 均已关联或进入 unresolved。真实运行时验收需跨角色、跨动作类型、跨奇波；芃芃和重岩蹄只作为回归，不作为全量覆盖证明。
- 完成时运行完整 `npm run test:trial-release`，检查 1440x900 与 390px 主流程、五载体和包体硬门槛。全量映射保持生成产物或按需加载；仅在最终超过硬门槛时做一次有边界的优化。完成后提交并停在 M7 等待产品验收，不自动进入下一里程碑。

完成结果：独立公开目录分母包含 20 个角色、122 个奇波和 562 个顶层动作（196 角色 / 366 奇波），并保留 592 个公开动作变体；全部动作均显式分类，其中 318 个可运行、244 个保持 `unresolved`，不存在静默遗漏或缺源写零。覆盖报告审计 1,174 个来源命中节点并发布 1,028 个完整动作命中绑定；667 个 Battle 非零回能元素全部关联到完整公开动作或以结构化原因进入 unresolved。主要剩余缺口是目标相关投射物命中帧、触发帧缺失、control/root variant 歧义及未验证基础函数输入。

唯一 verified runtime 已按动作选中的 control/subskill 和命中 identity 驱动八条曲线，未完整动作只应用已有独立可靠的资源门槛并明确跳过未决伤害。跨目录精确样例覆盖寒悠悠星鸣技 7 段 `459 HP / 321 韧性`、末音重击 3 段 `359 / 350`、500001 奇波主动技 6 段 `3030 / 606`，并验证命中回能共享与 interval。方案复制、本地草稿、JSON、分享链接、PNG 恢复相同绑定、逐命中结果和稀疏语义节点；动作库对 unresolved 项显示“三值未完整”及来源原因。

完整 `test:trial-release` 通过 105 个测试文件、586 条单元/组件/集成测试和 47/47 production preview；生产引用、游戏数据、动作状态、verified 映射与 applied-source 审计均通过。总 JavaScript gzip 为 739,564B，Workbench 主块为 365,560B，低于 740,000B / 370,000B 硬门槛；桌面与窄屏证据为 `reports/m7-catalog-runtime-desktop.png` 和 `reports/m7-catalog-runtime-narrow.png`。当前停止在 M7，等待产品验收。

### M7-R1：普攻输入链拆分（已完成，等待产品复验）

- 动作库保留单一“普攻”入口；一次拖入按当前客户端连续 normal-attack control 生成完整 `A1..An` 兄弟动作，每段是可独立选择、移动、删除和编辑的 action instance，不保留聚合父动作。
- `attackInputSegments` 记录序号、总段数、control/player/resourceMap、真实段时长与衔接来源、本段唯一 hit bindings、source identity 及 `applied / unresolved`。段数和输入边界只从 control 链生成，不从技能描述或命中数猜测；单次输入内多 hit 继续留在同一 A 块。
- 整链插入使用一次历史事务，后续单段编辑独立；移动或删除一段只重算该段命中与八曲线节点。旧聚合普攻能唯一解析时迁移为独立段，否则保留 `legacy-unresolved` 且不执行整套伤害。
- 默认/空方案、单段与整链撤销/重做、方案复制、本地草稿、JSON、分享链接、PNG、桌面和 390px 必须保持段 ID、顺序、独立编辑及运行时结果一致，并通过完整 `npm run test:trial-release`。完成后提交并停在 M7-R1 等待产品复验，不开始 M8。

完成结果：同步生成器从 20 名角色的连续普攻 control 生成 20 条输入链、95 个独立输入段，其中 49 段具备完整运行时绑定，46 段因输入边界或来源不足保持 `unresolved`。不同角色的 5 段、4 段和 3 段链均由客户端数据生成；莉莉 A3 的 6 个真实命中继续唯一归属于一个输入块。动作库一次拖入以单次事务创建无父节点的兄弟 action，之后移动 A2、删除 A3 或编辑任意一段只影响该段及其命中和八曲线节点；旧聚合块仅在可唯一解析时迁移。

完整 `test:trial-release` 通过 106 个测试文件、597 条单元/组件/集成测试和 48/48 production preview；五种项目载体、整链与单段撤销/重做、默认/空方案和长轴窄屏流程均通过。总 JavaScript gzip 为 680,130B，Workbench 主块为 368,851B，低于 740,000B / 370,000B 硬门槛；视觉证据为 `reports/m7r1-attack-input-chain-desktop.png` 与 `reports/m7r1-attack-input-chain-narrow.png`。当前停在 M7-R1 等待产品复验。

### M7-R2：普攻连段时序修正（已完成，等待产品复验）

- `attackInputSegments` 分离完整动画长度、最后命中帧、下一输入窗口和有效占轴长度。完整 `frameCountDict / aniLength` 只保留为动画来源证据，不再直接作为连续普攻块宽度。
- 统一同步入口沿 `skillPlayer -> skillTrackData -> behaviorlineControl` 引用链读取 `EventBridgeBehaviorData`。A1 到倒数第二段使用明确指向下一 control 的真实输入窗口，并保留 `Immediately / Wait` 模式；末段使用可靠的重新允许普攻窗口。缺少唯一来源时保持 `unresolved`，不得用命中数、描述或常数猜测。
- 一次拖入按输入窗口起点连续排布，动作块宽度对应有效占轴长度；窗口起止作为 M4 约束诊断输入。移动 A2 等单段时不自动吸附或补回，但需要明确标出过早、过晚或来源未决，命中仍保持段内相对帧。
- 旧 M7-R1 项目继续读取并在能唯一解析时刷新为新时序合同；五种项目载体保持窗口、有效时长、独立编辑和三值结果一致。验收覆盖莉莉 A1-A5、4 段与 3 段角色、末段复位、桌面/390px 和完整 `npm run test:trial-release`；完成后停在 M7-R2 等待产品复验。

完成结果：生成器现沿真实 Unity 引用链解析 EventBridge 输入窗口，当前 20 条普攻链、95 个输入段中有 63 段获得可靠时序，32 段因缺少精确下一 control 或重新开放普攻来源保持 `unresolved`。莉莉 A1-A5 的有效占轴由错误的完整动画 `155/221/282/192/293F` 修正为 `19/32/40/42/56F`，完整动画长度继续只作证据；窗口早于末次命中时以末次命中帧作为最早安全衔接点。旧版未编辑链会在载入时紧凑迁移，已移动或改时长的单段保留用户编辑；自由排轴继续允许窗口外位置，并给出过早、过晚或来源未决诊断。

发布验收通过 106 个测试文件、599 条单元/组件/集成测试和 48/48 production preview；verified 数据同步、生产引用、Workbench 数据、动作状态、applied-source 与 bundle 守门均通过。总 JavaScript gzip 为 681,539B，Workbench 主块为 369,983B；视觉证据为 `reports/m7r2-attack-input-timing-desktop.png` 与 `reports/m7r2-attack-input-timing-narrow.png`。当前停在 M7-R2 等待产品复验，不进入 M8。

### M7-R3：按键操作轴（已完成，等待产品复验）

- 建立单一 `Action / switch -> semantic input` 派生合同：统一记录 command、press/hold、键位、输入起止时间、来源 action/transition identity 与来源状态。物理键位只由中央蓝色星原 PC profile 解析；普攻 A1..An 各生成一次输入，自动命中、持续 tick、CD 与状态事件不生成标记。
- 在时间刻度上方增加与动作共享唯一 x 坐标、缩放和横向滚动的操作轴。press 使用紧凑键帽，hold 使用真实按住区间；重叠区间自动分层，点击可定位来源动作或换人时刻，桌面与 390px 均不得产生页面级横向溢出。
- 新增、移动、删除及撤销/重做后纯投影即时重算，不持久化可推导 marker；方案复制、本地草稿、JSON、分享链接、PNG 回载及导出保持一致。验收覆盖莉莉 A1-A5、主动技、星决技、奇波技、真实 hold、1/2/3 换人、长轴缩放与完整 `npm run test:trial-release`，完成后停在 M7-R3 等待产品复验。

完成结果：新增唯一的蓝色星原 PC 键位 profile 与 `AzPrTimelineOperationInputProjection` v1。客户端已确认的普攻/重击、星鸣技、星决技、奇波技和格挡/反击键位均保留来源 identity；上下文攻击才使用明确标注的项目默认映射。verified 公式包升级为 v6，从 `skillsub_logic.inputTriggerType / holdTriggerTime` 生成 press/hold 合同，hold 只采用真实按住时长，不借用动画尾长。时间刻度上方现按同一 x 坐标投影莉莉 A1-A5 的 5 个独立 LMB、E/R 技能输入与 1/2/3 换人；奇波仅在 verified control 的 `spCost > 0` 时投影 Q。角色星结合击必须与当前已装备奇波的合击在同一 60fps 帧出现，合法配对只生成一个关联双方 action identity 的 F；未装备奇波、缺少配对或错帧会同时进入 readiness 与 runtime 阻断。碰撞自动分层，点击标记会选择来源动作并移动统一帧游标，移动、删除和撤销/重做只更新对应标记。纯投影不写入项目，五载体回放和 PNG 导出继续消费同一动作真相。

合击插入整改：从角色动作库拖入“星结合击”或从奇波子轨拖入“合击”，现都会在一次历史事务中自动生成另一半，并以 `simultaneous / start -> start / gapMs = 0` 关系吸附到同一 60fps 帧。任一半的时间移动、复制或删除都会原子作用于整对，单次撤销/重做恢复整对；跨角色槽移动被拒绝。没有已装备奇波、目录中缺少可靠对应动作或奇波身份不匹配时整次插入被阻止，不落盘半套合击。

完整 `test:trial-release` 通过 109 个测试文件、613 条单元/组件/集成测试和 48/48 production preview，41/41 必需能力、数据同步、生产引用、动作状态、applied-source 与 bundle 守门全部通过。总 JavaScript gzip 为 688,924B，初始入口为 89,228B，Workbench 主块为 369,906B，均低于硬门槛。视觉证据为 `reports/m7r3-operation-axis-desktop.png`、`reports/m7r3-operation-axis-narrow.png`、`reports/m7r3-operation-axis-skills-desktop.png`、`reports/m7r3-operation-axis-skills-narrow.png`、`reports/m7r3-operation-axis-zoomed-desktop.png`、`reports/m7-catalog-runtime-desktop.png` 与 `reports/m7-catalog-runtime-narrow.png`。产品已于 2026-07-21 确认 M7-R3 验收通过，M8 以该版本为基线。

### M8-A：机器证据包与静态属性编译（已完成）

- 把 `BWiki/data/combat-formula-knowledge.json` 作为机制索引，把报告生成脚本直接读取的 `combat-property-sources-20260719.json`、`combat-sp-recovery-sharing-20260719.json`、`combat-overlimit-mechanics-20260718.json`、`combat-formulas-evidence-20260718.json`、`combat-coefficient-ranges-20260718.json` 与 `combat-enemy-break-profiles-20260718.json` 作为机器事实输入；技能级绑定继续读取完整 Battle 导出和 NewTable。扩展 `data:sync-verified-combat` 与 `audit:verified-combat`，为每份输入保存版本、来源 identity、哈希和验证结果，禁止解析 DOCX 或复制正文数字。
- 建立唯一静态属性编译器：角色等级模板、灵子、饰品装备、星赐、好感度按属性 ID 汇总为 EB/EP/EE，再按 `S=EB*(1+EP)+EE` 生成角色战前属性；effect 型灵子/套装技能不得塞进静态面板。装配变化必须直接改变后续伤害、韧性、治疗与 SP 计算输入，并在检查器显示逐来源明细。
- 接入奇波面板与角色继承：物种和等级底值、爱好、悟性、亲密度继承按结构化快照的取整顺序计算；ATK/DEF/MDEF/MAXHP 的角色基础与加成分别 floor，暴击率先减 500、暴伤先减 15000 再继承。先审计项目当前 20 角色/122 奇波 profile 与报告 17 可收集角色/147 战斗奇波的集合差异，按 identity 分类，不用强行对齐数量。

完成结果：唯一受控同步包已升级到 v7，纳入统一知识索引、6 份机器事实报告及静态 NewTable 输入的版本、来源 identity、SHA256 和结构验证。静态编译器按属性 ID 聚合等级、星赐、好感度、灵子及五件装备的 EB/EP/EE，并以同一结果驱动角色面板、奇波亲密度继承和 verified 动作计算；动态灵子与套装效果继续明确 `unapplied`。身份审计确认 17 个可收集角色全部可应用，Workbench 额外 3 个身份标为非当前公开目录；122 个 Workbench 奇波全部可应用，战斗表额外 25 个身份保留为未暴露目录。配置经方案、草稿、JSON、分享链接和 PNG 保存，编译结果始终从来源重建，不持久化第二份数值真相。

验收结果：三人三奇波换装对照证明角色属性、奇波继承与角色/奇波动作结果沿同一因果链重算；未知身份不回退到示例值或 0，来源漂移由 `audit:verified-combat` 拒绝。完整 `test:trial-release` 通过 110 个测试文件、618 条单元/组件/集成测试和 49/49 production preview；生产引用、数据、动作状态、verified-combat、applied-source 与 bundle 守门全部通过。总 JavaScript gzip 为 696,976B，Workbench 主块为 369,521B，低于 740,000B/370,000B 硬门槛；视觉证据为 `reports/m8a-static-loadout-desktop.png`。

### M8-B：全动作 Battle 效果绑定与动态属性运行时（已完成）

- 在既有 `skill/subskill -> control -> hit` 图上遍历完整 Battle 配置，生成动作到 Damage、PropertyChange、Sp、Heal、Shield、Pack/Judgment/Inject、印记容器及消耗分支的绑定；记录真实命中帧、目标、持续、叠层、刷新、互斥、tags 与来源 identity。不得人工为少数示例技能填效果，也不得从描述文本补枚数或系数。
- 复用 P4 effect command 生命周期，但让已验证 PropertyChange 真正进入 DB/DP/DE 与标量属性查询，使 buff 在对应时间窗改变后续动作结算；单次命中的穿透、`weakBreakDamageRate`、`recoverSP` 保持 hit-local，不回写面板。SP 同时保留自动回能、命中共享和直接 SpElement 三条入口及各自增幅/共享规则。
- 每个公开动作按“伤害/韧性/SP/生命/护盾/动态属性/印记”逐维输出 `applied / verified-zero / unresolved` 覆盖审计。只有 `functionId=5` 的已验证字面值可直接落数；其他公式函数先进入复算器或保持 unresolved，禁止把未知值当 0。

完成结果：唯一同步入口现递归生成 3,673 个 Battle 效果节点，并把 562 个公开动作关联到 3,202 条动作级效果绑定；Damage、PropertyChange、Sp、Heal、Shield、Inject、Pack、Judgment 与 Stack 均进入逐维机器/Markdown 审计。50 条目标、触发、生命周期和 `functionId=5` 字面值完整的 PropertyChange 正式进入 calculator，其余 3,152 条按 `verified-zero / unresolved` 保留结构化原因；未解释包装、条件、公式或 M8-C 印记状态机没有被写成 0。

统一 generation 从标准动作解析 verified effect command、直接 SP、治疗和护盾事件，effect runtime 负责 apply/refresh/stack/remove/expire，verified combat runtime 在命中时按属性 tags 查询动态 Force/DP/DE 并重算伤害、元素抗性和 SP 输入。阻塞动作不生成状态；手工追踪效果与 verified calculator effect 使用独立 authority identity，不能借同名 effect 越权改数值；循环继承只接受完整 verified source identity。真实 500039 奇波技能已证明 16 秒火属性增幅只在生命周期内改变后续命中。发布守门通过 111 个测试文件、622 条测试和 49/49 production preview；总 JavaScript gzip 702,741B，Workbench 主块 362,616B，低于 740,000B/370,000B 硬门槛。

### M8-C：队伍印记与九属性调谐运行时（已完成）

- 新增队伍级九元素印记池：每元素上限 5，逐层独立记录获取、20 秒消退与实际消费；获取/消费必须来自 M8-B 的动作效果绑定并落在真实命中帧。持有状态的 5 秒就绪/定时行为、循环初始状态和继承都进入同一确定性事件队列。
- 持有附伤和消耗超限走 verified Q16.16 路线并使用动作发生时的真实属性快照；火/水/冰/风/木/地/雷/光/暗各自的增益、减益、控制、治疗、回能、持续伤害、连锁与真伤按 profile 分派。消耗按实际持有枚数，保留 before/delta/after；地属性削韧例外、光属性真伤例外和风属性直给 SP 不得套用公共主段。
- 印记产生的 buff/debuff 继续经 M8-B 的动态属性与效果生命周期作用于后续动作，避免另建一套旁路计算器。来源链不唯一的角色专属/旧测试机制保持 unresolved。

完成结果：verified 包 v9 收录九种印记容器、持有模板、超限包和属性来源；安全的真实动作绑定驱动团队池逐层获取、20 秒到期与 ConsumePack 实际消费，多印记/条件分支歧义继续 unresolved。持有附伤、超限主伤害、光真实伤害、火持续伤害、风直接 SP、木周期治疗以及已验证 buff/debuff 均进入既有 Q16.16 runtime 与 effect timeline；雷链未闭环目标选择保持 unresolved。初始状态 schema v4 与循环边界保存逐层剩余时间、5 秒持有就绪和来源，五载体回放签名覆盖印记事件及最终状态。

> 2026-07-28 机制勘误：上述“逐层独立记录 20 秒消退 / 保存逐层剩余时间”已被客户端本机代码证据推翻。正确模型为同属性容器共享计时、每次获得（含满 5 层重施）刷新、每满 20 秒只自然减少 1 层；部分消费不刷新。M8-C 的实现验收已按此重开并修复，证据与影响见 `reports/tuning-mark-shared-decay-audit-20260728.md`；依赖旧时限的历史 DPS 结果必须重算。

### M8-D：同轴 UI、数值溯源与全量验收（已完成并通过产品验收）

- 时间轴新增“队伍印记”资源组，按方案实际涉及元素显示 0-5 阶梯曲线、获取/消耗节点和每层到期边界；技能 buff 在既有效果轴显示区间。二者与操作轴、动作块和八条三值曲线共享同一 60fps 坐标，默认清晰克制，不加点阵、发光拖尾或装饰性控制点。
- 装配检查器显示“灵子/装备/星赐/好感度 -> 角色属性 -> 奇波继承属性”的逐来源结果；动作检查器显示“动作 -> 效果 -> 属性快照 -> 命中结果 -> 印记/buff 状态”的可回溯链。修改装配或动作后必须从同一 runtime 重算，UI 不自行改数值。
- 方案复制、本地草稿、JSON、分享链接、PNG 五载体恢复同一装配、效果、印记与数值结果；桌面和 390px 窄屏验收至少覆盖一套完整三人/三奇波流程、九元素标准向量、装备/灵子换装前后对照及 unresolved 可见性。完整 `npm run test:trial-release` 通过后停在 M8 等待产品验收。

完成结果：新增稀疏队伍印记曲线投影，只为实际涉及的元素显示 0-5 阶梯与获取、消费、到期语义节点；连续时间段不生成点阵，节点、动作、效果区间、操作轴和八条战斗曲线共用 60fps 坐标、缩放、滚动与统一帧游标。点击印记节点可回到准确来源动作，检查器用同一 runtime 输出展示“动作 -> 效果 -> 属性快照 -> 命中结果 -> 状态/印记”链；无来源的 verified 全局效果也能安全生成独立 identity，效果区间保留真实 calculator applied 状态。

验收结果：默认/空方案、编辑与撤销/重做、循环及方案复制、本地草稿、JSON、分享链接、PNG 回放保持相同装配、效果、印记与数值结果。产品复验后的印记镜像去重保持三名角色的 calculator 实例，只由唯一队伍印记轴绘制。独立重跑 `npm run test:trial-release` 通过 115 个测试文件、636 条单元/组件/集成测试、50/50 production preview 和 41/41 必需能力；verified-combat、生产引用、Workbench 数据、动作状态及 applied-source 守门全部通过。总 JavaScript gzip 为 713,761B，Workbench 主块为 369,839B，低于 740,000B/370,000B 硬门槛。视觉证据为 `reports/m8d-verified-mechanics-desktop.png` 与 `reports/m8d-verified-mechanics-narrow.png`。M8 已通过产品验收。

### M9-A：全动作时长与输入占轴审计（已完成）

- 以 562 个公开动作及其全部公开变体为固定分母，分别解析普攻、重击、角色技能、星决技、合击和奇波动作的输入帧、实际动作占轴区间、命中帧、可取消/派生窗口与冷却；这些时间概念不得互相代替。普攻继续保持一次左键一个 A1..An 动作块，每块使用该段真实起止帧，不能合并整套连段。
- 当前覆盖报告中已有 29 个普攻段被压成 `durationFrames=1`，其中红宝石 A1-A5 与涂山小玉 A1/A2/A4/A5 同时标为 `unresolved`。一帧只允许用于客户端证据明确为瞬时的系统/资源事件；任何可操作攻击在证据不足时必须显示 `unresolved-duration`，不得以 `Math.max(1)`、命中包络缺省值或描述文本伪造可运行时长。
- 时长来源按“SkillControl/player resourceMap 的动作/动画帧段 -> EventBridge/input/link window -> 已验证动画资源元数据 -> unresolved”分级并保留 identity。覆盖报告按 owner、action kind、来源状态列出 1 帧、缺时长和异常长动作；非普攻动作同样逐项审计，不因已有数值绑定而跳过。

完成结果：562 个公开动作中 527 个占轴时长可应用、35 个保持未解析；95 个普攻输入段中 64 个可应用、31 个保持未解析，全部公开变体与 control/player 变体均进入可复现报告。一帧兜底已清零，未解析动作不能进入运行时；红宝石、涂山小玉的分歧变体保留逐变体事实而不擅自选段。输入、占轴、动画、命中、连段窗口和 CD 使用独立字段与来源 identity。

验收结果：完整 `npm run test:trial-release` 通过 115 个测试文件、640 条单元/组件/集成测试与 50/50 production preview；verified-combat、生产引用、Workbench 数据、动作状态、applied-source 和包体守门全部通过。Workbench 主块为 368,934B gzip，总 JavaScript 为 715,233B gzip，低于 370,000B/740,000B 硬门槛。

### M9-B：派生动作与角色特殊资源状态机（已完成）

- 建立通用 `ActionVariantGraph`，表达基础动作到普攻派生、重击派生、蓄力、强化、追加、自动后续等变体的输入关系、前置状态、决策帧和来源。描述文本仅用于发现候选、命名和用户说明；是否派生、何时派生及派生到哪个 action 必须由 `skillsub_logic`、control/resourceMap、EventBridge、Battle judgment/pack/stack 与实际客户端关系共同确认。
- 用户可直接输入的派生动作保留独立动作块；同一按键根据状态变形时，由运行时在输入帧按资源状态选择唯一实际变体；无需再次输入的自动后续由运行时生成并追溯到父动作。不能把隐藏变体全铺进目录，也不能把整条派生链合并成一个不可编辑块。
- 增加通用角色特殊资源合同：`ownerId/resourceIdentity/capacity/initialValue/gain/consume/expire/transform/decisionFrame/sourceIdentity`。只有确有该资源的角色显示自己的阶梯资源轴，默认平直，动作命中或效果在准确帧获取/消耗资源，资源值决定派生可用性与形态。红宝石（103002）和涂山小玉（101010）作为必验实例，但实现不得按角色名硬编码；装配、循环、撤销/重做和五载体必须保留相同资源状态与派生决定。

完成结果：唯一同步包现生成通用 `ActionVariantGraph`、特殊资源 profile 与逐帧 operation。运行时在输入决策帧选择实际 subskill，资源不足会先阻止执行；红宝石子弹与涂山小玉爆发状态叠层按真实来源帧获取、消耗、清空、转化和到期。只有装配了已确认资源 profile 的角色新增阶梯轴，无特殊资源角色保持原八曲线拓扑；循环边界与方案复制、本地草稿、JSON、分享链接、PNG 均从同一状态重建。覆盖报告保留 `43/71` 个可应用资源操作、`85/318` 条可应用变体边及全部 unresolved identity，不把投射物时点、包装关系或缺失静态 element identity 猜成已应用。

验收结果：完整 `npm run test:trial-release` 通过 116 个测试文件、647 条单元/组件/集成测试与 50/50 production preview。Workbench 主块为 367,155B gzip，总 JavaScript 为 720,691B gzip，低于 370,000B/740,000B 硬门槛。

### M9-C：效果语义、目标/触发与公式收口（已完成）

- 在修正后的动作时长和变体图上，把 3,208 条动作级效果边归一为去重语义效果，区分 wrapper、条件边、计算目标副本和最终玩法效果；覆盖报告以语义效果为主分母并保留原始 Battle 边审计。已完成的目标枚举分流和语义投影继续保留，不另建 runtime。
- 从完整 Battle 参数、类型定义和 control/event 数据解析 source、target、trigger frame、duration、tags 与 owner；补齐有证据的 Inject、Pack、Judgment、Stack、条件 PropertyChange 生命周期，并将已验证的非字面 PropertyChange、SP、Heal、Shield 与嵌套 Damage 按 function family 接入唯一 Q16.16 注册表。未知函数、投射物实际碰撞、随机目标和运行时选敌继续明确 unresolved/runtime-dependent。
- SP 继续区分自动、命中和直接 SpElement；命中共享、英雄/奇波目标、增幅范围与后台复制顺序沿 2026-07-19 机器快照执行。所有效果必须消费 M9-A/B 产生的真实动作帧与实际变体，禁止回退到基础动作起点或描述猜值。

完成结果：原始 Battle 效果图现归一为 3,122 条稳定语义记录，其中 1,583 条为最终玩法效果、1,539 条为 wrapper/条件结构；目标、触发、生命周期、叠层、来源动作与计算副本均保留唯一 identity。379 条语义效果已有验证计算路径：304 条来源完整的字面属性效果通过 55 个按 control/map/element 去重的 Q16.16 公式向量进入精简运行目录，75 条既有调谐机制继续委托 M8 唯一状态机。未知函数、条件 wrapper、投射物碰撞与运行时选敌继续按原因保持 unresolved，不把缺口改写为零。

验收结果：新语义公式与 M8 已应用值完成 304 条效果 x 12 级共 3,648 组逐值等价校验；完整 `npm run test:trial-release` 通过 117 个测试文件、651 条单元/组件/集成测试与 50/50 production preview。Workbench 主块为 367,781B gzip，总 JavaScript 为 721,772B gzip，低于 370,000B/740,000B 硬门槛。

### M9-D：公开动作可运行覆盖与真实队伍验收（已完成，等待产品验收）

- 以 562 个公开动作、20 名角色和 122 只 Workbench 奇波为固定产品分母，重新生成时长、变体、特殊资源、HP、韧性、角色 SP、奇波 SP、治疗、护盾、动态属性和印记逐维状态。所有静态证据充分的角色核心动作与奇波 active/break/signature 必须可运行；剩余 unresolved 只能是运行时依赖或尚无机制证据，并按 owner/action kind 单独列出。
- 重点收口当前 180 个未解析动作、491 个未关联非零回能元素，以及动作时长、派生关系、角色资源和效果覆盖中的静态缺口；不以降低数字为目的，任何从 unresolved 转为 applied 的项都必须能回到唯一 Battle identity 和复算步骤。
- 用包含红宝石、涂山小玉及第三名角色的三人三奇波队伍验收“资源获取 -> 派生选择/形态变化 -> Buff/印记 -> 后续伤害/韧性/SP/治疗或护盾”连续因果链，并用无特殊资源角色做回归。现有时间轴只新增有真实机制依据的角色资源轴，不增加装饰性轨道；完整 `npm run test:trial-release` 通过后停在 M9 等待产品验收。

完成结果：唯一同步入口新增 M9-D 固定产品覆盖报告，以 562 个公开动作、20 名角色和 122 只奇波为不可静默漂移的分母。当前 373 个动作可运行，189 个未解析动作全部归入 118 个“运行时依赖且仍缺静态证据”和 71 个“静态证据缺口”，未分类为 0。667 个非零回能元素重新分账为 153 个当前公开动作已应用、38 个当前公开动作未解、76 个仅属未选 control 变体、400 个不属于当前公开动作目录，后两类不再冒充产品动作缺口。逐动作继续保留时长、变体、特殊资源、HP、韧性、角色/奇波 SP、治疗、护盾、动态属性和印记状态及来源 identity。

真实验收方案由寒悠悠、红宝石、涂山小玉和三只独立奇波组成：寒悠悠产生火印记，红宝石星决技消费印记并获取 12 发子弹，火奇波效果在后续命中 trace 中生效，涂山小玉连续获取资源、由星决技转化状态并在输入帧选择重击 subskill 2；无特殊资源的寒悠悠不生成额外资源轴。既有五载体回放守门与该链联合通过。完整 `npm run test:trial-release` 通过 119 个测试文件、655 条测试和 50/50 production preview；Workbench 主块为 367,785B gzip，总 JavaScript 为 721,816B gzip，低于 370,000B/740,000B 门槛。M9 当前等待产品验收，不自动进入下一阶段。

### M9-R1：可编排动作与零距离投射物场景整改（已完成，等待产品验收）

- 分离 `schedulable`、`sourceEvidenceStatus` 与 `scenarioRuntimeStatus`：公开动作即使时长或部分效果未解析，也可作为规划块加入时间轴；规划占轴不得生成伪命中。已有可靠动作/发射帧和公式的部分继续结算，剩余缺口保留准确诊断。
- 排轴场景默认 `targetDistance=0`、`defaultWillHit=true`。每个投射物 hit 使用稳定 `hitIdentity`，命中帧为 `launchFrame + travelFrames`；零距离时 `travelFrames=0`，即发射后在同一帧命中。该结果标记为 `scenario-assumed-zero-distance`，不能改写客户端来源中的 `projectile-impact-frame-runtime-dependent`。
- 每个 hit 的 `willHit` 可在动作检查器内单独编辑，默认开启。关闭后只取消该 hit 的伤害、削韧、命中回能、命中印记和命中触发效果，不取消施法消耗、发射前自 Buff 或其他独立 hit；多弹、多段、爆炸和混合直接/投射物动作分别保留 identity，禁止整招一键误删所有命中。
- 移动、复制、删除、撤销/重做、循环、方案复制、本地草稿、JSON、分享链接与 PNG 必须重建相同命中选择和三值节点。命中编辑只出现在动作检查器，不在曲线上绘制一排控制点；验收覆盖寒悠悠、涂山小玉、至少一个奇波投射物动作及一个混合直接/投射物动作。

完成结果：562 个公开动作全部可分类，场景视图中 455 个可运行，其中 62 个动作由零距离假设补齐；107 个剩余动作继续保留公式、目标或其他静态证据缺口。657 条排轴记录分为 630 条精确所选变体占轴、26 条来源动画规划时长和 1 条通用规划时长，通用 30F 仅用于仍缺 control identity 的米砂 A5。22 个重点多变体 control 已单列为部分解析、尚未建模或静态证据缺口，不再统一显示为“无法解析”。逐 hit 选择、场景合同和 legacy 普攻拆分均进入项目、历史、循环与五载体重放；完整发布守门通过 120 个测试文件、664 条测试和 50/50 production preview，Workbench 主块 369,273B gzip、总 JavaScript 726,492B gzip。当前停在 M9-R1 等待产品验收。

### M9-R2：全角色派生控制与零时长换人事件（已完成，等待产品验收）

- 以全部公开角色中存在多个 control player、subskill 或 resourceMap 候选的动作作为固定分母，逐项生成可追溯派生规则。`input-controlled` 包括蓄力长度、松开时机、方向和可选追击，由用户在动作检查器选择；`resource-controlled` 与 `state-controlled` 由运行时在输入决策帧读取资源、形态、Buff、架势和前置动作后自动选择；无额外输入的后续段标记为 `automatic-follow-up`。组合条件先按状态/资源过滤合法分支，再应用用户输入，最后生成自动后续，禁止用第一项、最长项或默认 subskill 替代未建模选择。
- 生成层至少保留控制源、决策帧、输入区间或档位、资源阈值/消耗、状态条件、所选 subskill、来源 identity 和解析状态。技能描述只用于发现候选；选择规则必须回到 `skillsub_logic`、control/resourceMap、EventBridge、Battle switch relation、judgment/pack/stack 与动画证据。报告需将每个候选明确归入已应用、尚未建模、静态证据缺口或运行时依赖，不再把“已找到各形态时长”写成“无法解析时长”。
- 切人动作改为 `startFrame == endFrame`、`durationFrames = 0` 的精确帧事件，不占动作区间、不触发普通轨道碰撞，也不自行产生伤害、韧性、SP 或 Buff。时间轴使用目标角色头像和向下指针形成 Endaxis 式固定尺寸标记，可选择、拖动和检查；同帧冲突切人必须拒绝或确定排序，受控角色在该帧完成切换，操作轴只投影一个对应的 `1/2/3` 输入标记。
- 星携技不再被一律当作可独立拖入的普通动作。必须逐角色解析其真实 `on-enter`、`on-exit` 或条件触发关系：A 切至 B 时，退场触发归 A，入场触发归 B；星携技以切人事件的确定性子动作生成，保留自己的真实起始偏移、持续时间、命中与效果。移动/删除切人事件同步移动/删除子动作，初始前台不凭空触发入场技；只有证据表明确实可手动释放的星携技才继续出现在动作库。
- 输入控制分支在检查器提供档位/选项并实时更新时长、命中和效果；资源/状态自动分支只显示当前结果、触发原因和来源，不给用户手动覆盖。跨过状态边界移动动作时必须重新选择自动分支。撤销/重做、复制、循环、方案复制、本地草稿、JSON、分享链接和 PNG 使用同一稳定 identity；验收至少覆盖蓄力重击用户选档、红宝石资源派生、涂山小玉状态派生、入场星携技、退场星携技及不触发条件。

M9-R2A 已固定当前客户端 20 名角色、154 个公开动作引用和 136 个派生 control 的审计分母；63 个多 player/resourceMap control 全部进入 `derivedControlContracts`，未出现静默遗漏。M9-R2B 已将可确认的蓄力档位保存为稳定输入 identity，并由同一 variant runtime 在输入帧先处理资源/状态自动分支、再应用用户输入；检查器选档会同步重建真实时长、命中和效果，自动分支保持只读可溯源。M9-R2C 已将新建与旧项目切人统一为精确帧零时长事件，排除普通轨道碰撞与三值/状态生成，并以固定头像指针投影支持选择、移动和删除；同帧冲突按稳定 identity 拒绝，后续动作绝对帧不因迁移改变。M9-R2D 已覆盖 20 名角色的切人触发目录，其中 17 条绑定可确定生成真实子动作，3 条因动作映射缺失保持静态证据缺口；11 条入场、9 条退场关系均保留来源身份。星携技只由父切人事件派生，移动、删除、历史和五载体回放确定性重建；变体 control 使用自己的 verified CD identity，避免与同一公开技能根的其他动作误冲突。完整发布守门通过 125 个测试文件、691 条测试和 51/51 production preview；Workbench 主块 354,059B gzip、总 JavaScript 735,571B gzip，低于硬门槛。当前停止并等待产品验收，不自动进入下一里程碑。

### M9-R2-R1：检查器、来源文本与长轴验收修复（已完成，等待产品复验）

右侧检查器现可由固定可见按钮或 Escape 真正关闭并释放时间轴区域；Battle 来源名称统一经过可见文本守门，损坏 raw 来源仍保留审计身份并使用安全语义回退。新建及旧隐式 30 秒草稿统一迁移为 120 秒，用户可在 30/60/90/120/180 秒间切换，长轴按稳定 px/s 内部滚动并随撤销、草稿和五载体回放；缩短会截断内容时明确阻止。聚焦领域/回放测试、127 个文件共 701 条全量单测及关键生产路径通过；上游编码修复后已增量重同步并通过名称与 verified-combat 漂移复验，恢复的真实中文名称不再错误标记为 `corrupt-source-encoding`，可见文本防线继续保留。

### M9-R2-R2：时间轴初始能量直接编辑（已完成，等待产品验收）

角色与已配置奇波的能量轨现直接提供 `0..runtime max`、步长 `0.01` 的初始值输入：角色写回 `actorConfigs[].initialSp`，奇波按 `slotId + kiboId` 写回 `initialRuntimeState.kiboEnergyBySlot`，第 0 帧、曲线、命中回复与技能消耗随同一状态重算。未配置奇波继续显示既有 `0 / 1` 空槽占位且不可编辑；输入事件与轨道选择、游标和检查器隔离，PNG 保持静态初值。聚焦 9 个测试文件共 181 条测试、生产构建、引用/包体守门及 1 条桌面/390px production preview 通过；Workbench 主块 357,058B gzip、总 JavaScript 739,355B，低于 370,000B/740,000B 硬门槛。视觉证据为 `reports/m9-r2-r2-initial-energy-desktop.png` 与 `reports/m9-r2-r2-initial-energy-narrow.png`。

### M9-R3：涂山小玉真实机制修正（已完成，等待产品验收）

默认普攻链现使用 `20/35/47/30/80F` 的实际输入占轴，A5 不再以 `240F` 完整动画尾长占轴；爆发状态普攻切换为 `72/75/72F` 三段链。A5 后重击由输入窗口与爆发状态共同解析最终语义形态，具体 control/subskill 映射以 M9-R3-R2 为准；辅助排轴吸附到最早合法帧，运行时以整数帧判断边界。缘结值同一交易跨至 100 时清空并进入 10 秒状态，星决技在来源 `272F` 进入或刷新状态；状态同时驱动资源轴、统一 Buff 区间、普攻链和重击形态。

被动 `10101061` 已作为常驻监听效果接入：已确认动作在来源帧叠加 8 秒 Buff，最多 4 层，每层攻击力 `+5%`、调谐强度 `+32%`，动态属性快照和后续结算消费同一效果状态。完美招架公开动作到内部 control 的静态关系仍保留精确证据缺口；`10101062` 按当前客户端未实装处理，不注册运行时 profile。验证覆盖 128 个测试文件、714 条单元/组件/集成测试、全部 54 条 production preview、生成包漂移和 applied-source 审计；总 JavaScript gzip `738,978B`、Workbench 主块 `357,237B`，低于硬门槛。视觉证据为 `reports/m9-r3-xiaoyu-mechanics-desktop.png` 与 `reports/m9-r3-xiaoyu-mechanics-narrow.png`。

### M9-R3-R2：小玉动作形态与实际占轴收口（已完成，等待产品验收）

普通重击、强化重击、特殊重击和强化特殊重击现分别执行 `10101010/sub0`、`10101010/sub2`、`10101042/sub0`、`10101042/sub1`；`10101010/sub1` 作为普通重击后的独立连续重击输入段。最终形态由爆发状态、上一有效动作和来源派生窗口共同决定，动作标签、检查器、命中/资源结果与机制 trace 同时保留公开语义和实际 control/subskill。

小玉 21 个公开动作/形态已完成“完整动画”和“有效占轴”分离审计，当前 21/21 具有来源明确的有效占轴。四种重击与连续重击分别按 `75/64/90/60/75F` 占轴；唯一 effective timeline 同时驱动动作宽度、框选/复制、辅助放置、重叠诊断和执行边界，恰在结束帧可衔接、提前 1F 会报重叠。129 个测试文件、723 条单元/组件/集成测试及真实 Workbench 聚焦流程通过；生成包漂移、applied-source、构建和包体守门通过，总 JavaScript gzip 为 `739,861B`。视觉证据为 `reports/m9-r3-r2-xiaoyu-forms-occupancy-desktop.png` 与 `reports/m9-r3-r2-xiaoyu-forms-occupancy-narrow.png`；`10101062` 继续按未实装边界忽略。

### M9-R3-R2-R1：小玉爆发普攻链验收回归（实现已完成，等待产品复验）

爆发链 `10101001/04/05 sub1` 的 `72/75/72F` 占轴、A1→A2 与 A2→A3 接续窗口、状态和来源 identity 现由已选 chain segment 统一投影；A1/A2 不再产生接续时序未解析诊断，A3 不会因不存在 A4 而误报，三段 readiness 均为 `ready`。星决技与缘结值跨 100 两条爆发入口使用同一链选择；动作库点击、指针拖拽、自由/辅助放置、移动和回放均在实际候选帧重算，不复用拖拽开始时的目录形态。

A3 后重击按来源 EventBridge 的半开窗口 `[0,20)` 与 `[40,72)` 解析：窗口内执行强化特殊重击 `10101042/sub1`，窗口外执行强化重击 `10101010/sub2`，并同步更新语义名、实际 control/subskill、占轴、命中和三值 trace。129 个测试文件、733 条测试、真实点击/指针拖拽 production preview、构建及 verified-combat 漂移审计通过；桌面与窄屏证据为 `reports/m9-r3-r2-r1-xiaoyu-burst-chain-desktop.png` 和 `reports/m9-r3-r2-r1-xiaoyu-burst-chain-narrow.png`。总 JavaScript gzip 为 `740,444B`，Workbench 主块为 `357,911B`；功能实现已收口，但总包仍比 `740,000B` 发布硬门槛高 `444B`，按本轮范围不做包体优化，保留为发布前风险。

### M9-R3-R2-R2：小玉全动作隐藏输入派生（实现已完成，等待产品复验）

小玉 21/21 个公开执行形态及其可达包装 control 已完成 EventBridge 行为窗审计；生成层现从统一来源产出 7 条指定输入派生边，包括普通 A5、爆发 A3 的双窗口、星鸣技、星决技、极限反击和连续重击。运行时与 Workbench 共同消费半开窗口，在点击、拖拽、跨窗移动、辅助放置和保存重载时同步重算实际 control/subskill、占轴、命中与三值，不让普通取消窗覆盖指定派生。

星携技入场链已核实为 `10101021/sub0`，当前客户端未发现其指向特殊重击的直接或间接执行边；`10101041` 实为闪避包装后进入极限反击 `10101025/sub0`，不能作为星携技证据。机器/Markdown 审计、146 条聚焦测试、129 个测试文件与 741 条完整单测、真实 UI production preview、构建和来源漂移守门均通过；桌面/窄屏证据为 `reports/m9-r3-r2-r2-xiaoyu-hidden-inputs-desktop.png` 和 `reports/m9-r3-r2-r2-xiaoyu-hidden-inputs-narrow.png`。总 JavaScript gzip 为 `740,445B`，超发布硬门槛 `445B`，按本轮范围仅记录风险，不做包体优化。

### M9-R3-R3：Workbench 性能收口（实现已完成，等待产品复验）

Workbench 保留完整模拟数据，并以语义曲线投影、窗口化日志/来源列表、按需挂载检查面和缓存后的拖拽候选求值降低渲染成本。120 秒、7 动作 production fixture 的 DOM element 从 `92,463` 降至 `1,883`，CDP live nodes 从 `590,432` 降至 `11,212`；静置 5 秒 `TaskDuration` 从 `1,467.081ms` 降至 `95.789ms`，最大 long task 从 `1,884ms` 降至 `612ms`，交互 p95 为 `24.9ms`。60 次连续 pointermove 只触发 1 次候选求值，一次已提交编辑只触发 1 次 authoritative compile 与 simulation。

132 个测试文件、750 条完整单测、verified-combat/applied-source/production import/workbench data 守门、构建、小玉隐藏派生 production preview 与专用性能 E2E 均通过。Workbench 主块为 `361,550B` gzip，低于 `370,000B` 门槛；总 JavaScript 为 `744,280B` gzip，超 `740,000B` 发布硬门槛 `4,280B`，按本阶段范围只记录发布风险，不转入包体优化或下一里程碑。

### M9-R3-R2-R3：派生输入窗口与动作块贴边接续（实现已完成，等待产品复验）

指定输入派生现使用统一的上下文时序合同，分别保存 `inputFrame`、`executionStartFrame` 与 `predecessorEffectiveEndFrame`。原始 `[start,end)` EventBridge 判定保持不变；立即打断关系会在确证帧同步截断前动作、启动后动作并取消真正未发生的后续事件，缓冲关系则允许输入标记与动作块起点分离。星鸣技、星决技、爆发 A3、极限反击和普通 A5 的贴边接续均消费同一投影，爆发 A3 的自然接续选择后段合法窗口而非最早 `0F`。

机器审计覆盖 `1,154` 个公开时序来源、`1,342` 条 verified window，以及小玉 `21/21` 个形态和 `86/86` 条窗口；`1,305` 条窗口已解析输入语义，`37` 条保留明确证据缺口。132 个测试文件、768 条完整单测、真实自由拖拽/隐藏派生/爆发链 production preview、性能 fixture、构建及来源守门通过。Workbench 主块为 `361,659B` gzip；总 JavaScript 为 `746,434B` gzip，较本阶段基线增加 `5,989B`、超发布硬门槛 `6,434B`，按本阶段边界只记录风险，不转入包体优化。

### M10：单角色战斗运行逻辑完整解析与接入

M10 固定当前客户端 20 名公开角色为角色分母；每名角色的动作分母由公开动作目录与其可达的 control/subskill/resourceMap/EventBridge、切人子动作和被动监听闭包共同生成，不可达测试 control 必须保留排除理由。角色的公开动作、派生形态、输入/执行时序、有效占轴、全部命中、三值/SP、CD、个人/队伍资源、印记、效果、被动、动态属性、治疗/护盾、切人和配置传播等维度，只能标为 `applied`、`runtime-evidence-required`、`static-evidence-gap` 或 `not-applicable`。

统一流水线按 Discovery -> Normalize -> Compile -> Validate -> Runtime capture -> Apply 执行。角色差异只进入版本化 profile 和声明式 recipe；运行时继续复用 verified package 的通用算子，禁止在生成层之外新增散落的角色 ID/技能 ID 分支。单角色命令必须幂等，失败不得覆盖上一份有效全量包；UI、动作库、状态轴、曲线和 trace 只消费同一编译结果，不维护第二份角色规则。

#### M10-A：流水线与涂山小玉金标准（已通过产品验收）

- 生产同步现自动发现全部 `profile-recipes/*.json`，统一汇总证据与 control policy，经 `raw evidence + declarative recipe -> generic character compiler -> owner contracts -> merged verified package -> runtime/UI` 单向链编译所有 owner；profile、golden、运行时合同和全局目录来自同一轮中间结果。第二个非空 synthetic owner 可在不修改 compiler/sync 源码的情况下进入完整生产编排。
- `pipelineMaturity`、`combatCoverageState` 与 `characterComplete` 由守门计算。小玉当前为 `runtime-applied / partial`、`characterComplete=false`，不会计入 `uiVerifiedProfileCount`；410 条 raw 记录归一为 225 条语义记录，其中 99 条仍可能影响玩法结果，包装重复、不可达与不适用项单独分账。
- 120 秒三人队 golden 现调用 authoritative project compiler 与 simulation，69 条独立断言覆盖命中、HP、韧性、前后台角色 SP、奇波 SP、缘结阈值/清空、爆发刷新、三段爆发普攻、特殊重击、被动四层、动态属性及装配传播数值差异；篡改关键预期会使守门失败。
- `sync-character-combat-profile --owner <id>` 会从原始证据和 recipe 重新编译，不读取既有 owner contract；默认只写 owner staging，失败零写入，`--all` 才原子发布全局 package/catalog。双 owner 发现、编译、合并、owner A -> owner B -> all、删除/篡改合同自愈和重复零漂移均有整链测试守门；小玉运行策略已进入声明式 recipe，生产 runtime、Workbench 与 UI 没有新增角色 ID 分支。
- 135 个测试文件、781 条单元/组件测试及 57/57 production preview 全部通过，41/41 必需能力为 `trial-ready`；character/verified 漂移、applied-source、生产引用、Workbench 数据和动作状态审计通过。小玉 117 条语义效果、7 条动态属性依赖与 69 条 golden 数值断言均保持不变。总 JS gzip `746,804B`，仍超发布硬门槛 `6,804B`；依本轮边界只记录既有发布风险，不做包体优化。

#### M10-A 小玉闭环缺口修复轮（已通过独立机制验收）

- 普通 A3 已接入 `101010091@18F`；普通 A4 已接入四个独立的 `101010107@10/14/18/22F`，命中开关分别控制伤害、削韧和角色/奇波回能，且不与爆发 A2 的 12 hit 合并。
- 入场星携技保持 `95F` 有效占轴，`55F/109F` 两次命中可越过动作块尾端结算；派生只读动作的 hit 编辑写回父切人事件并随草稿、JSON、分享与 PNG 重放。完美招架反击由公开 `10101027` 映射到 `10101049/sub1`，只有同帧 `successful-parry` 场景事件存在时才执行两次命中。
- 缘结值到 100 的阈值事务现原子完成 `100 -> 0`、进入爆发和风印记 `+2`；星决技刷新是否再次授予风印记继续标为 `runtime-evidence-needed`。玉未央只消费真实 direct trigger，极限反击本体 `10101025` 的 apply count 固定为 0，实际派生重击、完美招架反击、星携技和星决技分别有正向守门。
- 生成审计现覆盖小玉 23 个带有效占轴的公开/运行形态与 89 条可达窗口。完整单测 `141/141` 文件、`867/867` 用例，production preview `62/62`，character/verified 漂移、production imports、Workbench data、action status、applied-source 和 production build 均通过。Workbench gzip `370,692B`、总 JS gzip `761,260B` 仍超过既定门槛，本轮仅记录风险，不做包体优化。

#### M10-B：全角色逐个解析与验收（暂停扩角色，当前执行 M10-B1 修复轮）

- 角色状态严格按 `not-started -> evidence-indexed -> profile-compiled -> runtime-applied -> UI-verified` 推进；每个角色独立生成、提交和验收，不批量自动标绿。
- 推荐先红宝石（弹药/特殊资源），再寒悠悠（队伍印记/支援链），随后按 `reports/m10/all-character-coverage-manifest.json` 中的机制类型和证据缺口逐个推进其余角色。
- 每个角色优先补通用算子，再由声明式 profile 引用；静态证据不能区分的条件进入 capture plan，不猜默认分支。完成单个角色后更新全量漂移、golden fixture、运行时/UI 验收和队列状态，未经产品验收不自动进入下一个角色。

##### M10-B1：红宝石（103002）单角色完整战斗解析与接入（R3 衔接/派生闭包已通过产品验收；角色总 Profile 仍为 partial）

- Discovery 与阶段审计当前得到 10 个公开动作、27 个 control、24 个执行形态、124 个命中，以及普通 A1-A3 和强化 E1-E12 两个 applied 输入阶段；重导出恢复星鸣技终端链后，公开形态门禁达到 10/10 runtime-ready。角色总 Profile 仍因 4 项实机 capture 与静态效果缺口保持 `partial`。
- 子弹资源 `actor:103002:element:103002047` 以容量 12 进入通用资源算子。41 条交易现分为 21 条 applied 与 20 条 wrapper/not-applicable；普通 A3 仅在有弹时进入强化阶段，E1-E12 每次独立消耗 1 发并在空弹时停止。
- 星鸣技 `10300212/sub0` 在施法第 0F 把弹药补至 12、向唯一队伍资源池增加 1 枚火属性调谐印记并开启 4 秒快速强化入口；37/44/49/54/59/64/69F 的 7 段真实命中分别结算伤害、削韧、角色 SP 与奇波 SP。逐 hit 关闭只取消对应命中事务，不影响施法资源效果。
- 被动 10300261 只保留可达 `103002275/276` 支持的 15 秒、最多 6 层、属性 229 每层 `+20` 合同。无名第二被动 10300262 按当前客户端统一产品边界归为 `not-applicable`；零引用 `103002252/253` 归为 `legacy-or-unreachable-current-client`，二者均不再计入玩法缺口或运行时。
- 120 秒 authoritative golden 由真实 project compiler 与 simulation 生成，当前 123 条断言覆盖普通/强化阶段、逐发耗弹、空弹阻塞、星鸣技 7 段逐 hit 三值、补弹/火印记/快速入口，以及原有前后台 SP、被动和装配传播；replay hash 为 `134c7336b453a2e3d72a308564f90d319d3f506c859420adcf767d64d168229c`。
- 141 个测试文件/871 条测试、62/62 production preview、41/41 必需能力及 character/verified、production imports、Workbench data、action status、applied-source 守门均通过。Workbench gzip `370,688B` 超主块门槛 `688B`，总 JS gzip `761,243B` 超发布硬门槛 `21,243B`；按本轮边界只记录风险。
- 真实 Workbench 流程已证明普通拖入只生成 A1-A3；星鸣技后再次拖入普攻生成 E1-E12，12 次交易从 `12 -> 0`，并覆盖整批撤销/重做、保存回载和 390px。角色状态保持 `runtime-applied / partial`、`characterComplete=false`；当前停止等待产品复验，不启动寒悠悠。
- R2 将公开“普攻”保存为输入意图，由当前时间轴重放状态统一解析普通或强化链；A3 转段窗、实际弹药与快速入口会在移动、删除、撤销/重做和重载后重新决定 E1/A1，不再把拖入时的计算结果持久化成用户选择。E1-E12 的默认排布按每段 authoritative occupancy 逐帧紧贴，用户手动制造的间隔继续保留。
- 切人派生统一增加运行时物化门：CD 中只在切人绑定上保留剩余时间诊断，不创建星携技动作、占轴、生命周期或关系边；切人本身和其后的手动动作继续执行。完整验收通过 136 个测试文件、800 条单元/组件/集成测试及 60/60 production preview，character/verified 漂移和全部生产数据守门 clean。Workbench gzip `364,475B`，总 JS gzip `751,445B` 超硬门槛 `11,445B`；当前按范围仅记录发布风险，停在 M10-B1-R2 产品复验点。
- R3 当前以 10 个公开动作、159 条原始窗口为固定分母，按完整 subskill 来源去重后得到 37 条语义转移且全部进入统一运行时；19 条仅具静态窗口证据的记录独立保留，玩法相关转移缺口为 0。A3、换弹、星鸣技、星决技结束和入场星携技五种入口均按来源窗口动态选择 E1；强化闪击保持 E 序号，空弹、E12、超时、切出和明确中断按同一状态机退出。
- 入场星携技 `10300221` 在实际子动作第 54F增加 1 枚雷属性调谐印记，并以自身 `[80,112)` 窗口开放强化普攻；CD 门禁抑制子动作时，命中、印记和窗口均不生成。E1-E12 每击只产生一次红温交易，E3/E6/E9/E12 的火印记消费与超限事件按序结算。独立复验确认 114 条 authoritative golden、136 个测试文件/818 条测试、61/61 production preview、真实切人/拖拽流程及全部来源与生产数据门禁通过，M10-B1-R3 衔接/派生闭包正式通过产品验收。该结论不代表红宝石全量战斗机制完成：角色仍为 `runtime-applied / partial`、`characterComplete=false`，保留 5 个 runtime capture 需求和数值/效果静态缺口。Workbench gzip `364,491B`，总 JS gzip `752,607B` 超硬门槛 `12,607B`，风险继续单独保留；当前停在阶段边界，不启动下一角色。
- 阶段收口将所有带容量的角色个人资源接入通用初值控件；红宝石弹药以 `initialRuntimeState.specialResourcesByActor` 为唯一真值，支持 `0..12` 整数初值、历史事务与五载体重放，并从 0 帧重新决定 A/E 链。红宝石现为 `zero-distance-simulation-complete=true`、`real-client-evidence-complete=false`：初始弹药不再要求实机采样，剩余 4 项 capture 仅保留真实投射物时序证据。按完整重导出清理跨 subskill 重复边及三个假缺口后，semantic/raw/gameplay-impacting 分母为 `475/483/51`；123 条 golden 断言通过，角色总 Profile 仍诚实保持 `runtime-applied / partial`。
- 完整重导出确认问题域共有 66 个容器、1,487 个完整对象、0 个 stub，773/773 条外部 gameplay track 与 281/281 条 FileID=3 引用完整。同步器现以 `behaviorTriggerScope=skill-player` 按 subskill 过滤命中、运行时效果和语义效果，并由通用 orchestrator 把 owner 默认策略应用到全部 required controls；修复范围覆盖红宝石 `10300201/02/03/04/10/12/14/24/25/44/49` 与小玉 `10101010/10101042`，去除跨形态重复归属而不删除真实 hit。红宝石与小玉分别保持 `24`/`21` 个执行形态、`124`/`107` 个 hit，公开动作均为 10/10 runtime-ready；`10300253` 作为当前 SkillList 不可达证据保留。完整审计见 `reports/m10/reexport-subskill-scope-20260729.json`。

##### M10-B2：寒悠悠（101003）单角色战斗解析与接入（已通过功能验收并关闭）

- Discovery 固定得到 10 个公开动作、30 个可达 control、14 个执行形态、73 个命中和 40 个语义效果；7 个不可达/包装 control 保留排除理由。10 个公开动作均进入 runtime-ready，五段普攻与两段蓄力重击使用各自真实 control/subskill 和有效占轴。
- 通用 compiler v3 新增声明式敌方目标状态、逐命中状态交易、条件命中组和运行时效果绑定。寒悠悠 `焰火` 使用 `element 101003079`、容量 15、逐层 10 秒；星鸣技七次真实命中各叠一层。无名第二被动 `10100362` 按当前客户端产品边界为 `not-applicable`，不再生成末次命中额外层。重击一段按 `>=6` 消耗 6 层、否则全消；重击二段按 `>=10 / >=8 / 否则全消` 结算，并在来源帧增加 1 枚火属性调谐印记。
- 焰火爆炸触发的主控攻击力 `+10% / 24s`、全队调谐 `+18 / 24s / 最多2层` 与寒悠悠直接 SP `+2` 复用统一 effect/runtime；运行时和 UI 不含寒悠悠 ID 分支。星鸣技动作块使用 93F 已验证重新输入占轴，完整 180F 动画和 61–109F 命中仍独立保留。
- 120 秒 authoritative golden 以真实 compiler + simulation 生成 76 条断言：寒悠悠总 HP/韧性变化为 `69,372 / 6,069`，两次爆炸共直接回复 4 SP，动态攻击与调谐、火印记、前后台角色/奇波 SP、切人继承及装配传播均有精确结果；golden hash 为 `ad078bd41e8f5ed75937f5e00a420c7d87cb4d9f9050a0709b81024ba0c5c6a5`。
- 真实 Workbench 已覆盖公共入口拖入星鸣技与重击、逐 hit 开关、无焰火负例、撤销/重做、刷新回载、主控 Buff 切人迁移和星决技双 Buff；1440x900 和 390x900 均无新增溢出。141 个测试文件/859 条测试、62/62 production preview、41/41 必需能力以及 character/verified、production imports、Workbench data、action status、applied-source 守门均通过。
- 角色状态仍为 `runtime-applied / partial`、`characterComplete=false`：42 条 semantic 记录中有 10 项 runtime evidence、30 项 static evidence gap、2 项 not-applicable，其中 24 项影响玩法结果。隐藏大招爆炸按当前客户端废案归入 `legacy-unreachable`，不再生成 capture 或阻断零距离模拟。Workbench 与总 JS 超门槛继续只记录为对外发布风险，不阻断 M11。

共同工程边界：总 JavaScript gzip 的发布硬门槛为 740,000B，735,000B 仅作预警；初始入口 120,000B、Workbench 主块 370,000B 继续守门。该门槛继续约束对外试用和正式发布，但不阻断 M11/M12 的无头核心、内部验收台与批量模拟里程碑；这些阶段只记录体积变化，不以逐字节压缩替代机制正确性和机器能力。

##### M10-B2-R1：寒悠悠产品复验整改（已通过功能验收并关闭）

- 首轮产品复验未通过。既有 E2E 只证明页面出现过焰火区间和任意三值节点，没有证明焰火消费、5 次派生爆炸、Buff/SP 后果和后续属性影响；星决技同帧的 24 秒全队调谐与 15 秒主控调谐效果也未被分别验证。
- R1 已从公共动作入口锁定完整因果链：星鸣技七段真实命中形成焰火 `0 -> 7`，重击一段消费 6 层至 1 层并物化 5 次爆炸，检查器和 HP/韧性节点明确区分 4 次本体命中与 5 次条件命中；关闭一段 E hit 得到 `6 -> 0`，移走 E 后只保留 4 次本体命中，撤销和保存重放恢复同一结果。
- 引爆后果分别显示主控攻击力 `+10% / 24s`、全队调谐强度 `+18/层 / 24s / 最多2层` 与寒悠悠 SP `+2`。星决技 148F 同时生成两条独立身份：全队 2 层 `+36 / 24s`，以及触发时主控角色获得寒悠悠基础调谐强度 10% 的 15 秒效果；同属性、同帧效果不再互相吞并，用户界面统一使用“调谐强度”术语。
- 切人继承只由 `inheritType` 决定，团队元素布尔值单独保留。寒悠悠 `480124006`（Self）与 `101003206/207`（Source）在精确切人帧迁移目标并保留原始到期、层数及公式来源；全队效果不复制，小玉 `101010206` 与红宝石 `103002275` 均锁定 `transferCount=0`。全量 82 个非零继承元素的字段矩阵已进入审计。
- 当前 20 名角色的无名第二被动统一归类为 `unnamed-secondary-passive-not-implemented-current-client`，保留来源但不生成 listener、capture 或玩法缺口；命名第一被动不受影响。
- 页面只增加机制验收必需的层数、派生命中、来源元素、目标、属性修正和生命周期信息；无焰火时不会展示未物化的爆炸候选。M10 功能验收已通过并关闭，下一阶段直接进入 M11-A；第四角色、包体优化和非验收 UI 继续暂停。

### M11：无头核心、机器排轴与可视化验收台

M11 不另写第二套简化模拟器，而是把现有生成、编译、状态重放和数值结算整理为唯一权威核心。网页、CLI、批量评估和未来 AI 工具都消费同一份版本化输入和确定性 trace。

上游静态证据确认：当前客户端对每个符合条件的 `DamageElement` 在执行前调用 `RandomUtility.Range(0, 10000)`，把整数结果写入该元素自己的 `criticalRandom`，随后按 `criticalRandom < 有效暴击阈值` 判定。当前构建的整数 Range 落到 `UnityEngine.Random.Range`，因此游戏语义是逐伤害元素的运行时伪随机采样，不是固定暴击序列或期望值结算。完整证据和建模边界见 `reports/m11/critical-sampling-evidence-20260729.md`。

#### M11-A：Canonical Headless Combat Core（已完成并通过产品验收）

- 定义无 UI 的纯接口，至少覆盖 `catalog`、`compile`、`validate`、`simulate`、`evaluate` 和 `explain`。
- 输入包含数据/profile 版本、队伍与装配、敌人、初始状态、战斗时长、语义动作意图、场景级暴击策略及随机种子；输出包含归一执行计划、合法性诊断、逐帧事件、状态快照、三值/资源/Buff 变化、贡献拆分、因果链及输入哈希。
- 核心不得依赖 Vue、DOM、像素坐标、拖拽或 `localStorage`；UI 不得维护机制副本或补造运行时没有产生的结果。
- 暴击策略固定为 `sampled`、`expected`、`critical`、`non-critical` 四种场景模式；逐 hit 可用 `inherit` 或四种显式模式覆盖。`sampled` 使用核心自有的显式种子 PRNG，按归一事件顺序逐次取 `0..9999`，并在 trace 写入 seed、流序号、roll、有效阈值和结果；同输入同 seed 必须得到相同 trace/hash，不得在回放中调用未注入的 `Math.random()`。
- `expected` 复用命中时刻的实际暴击率、抗暴和暴击伤害公式，只对可暴击伤害计算概率加权值，不伪造布尔“已暴击”事件。若暴击分支会改变 Buff、资源、派生或其他后续状态，核心必须进行带权分支或返回 `expected-branch-required` 阻断诊断，不得把期望伤害与某一条状态分支静默混用。
- 先迁移小玉派生、红宝石强化链、寒悠悠焰火链三条金标准。同一场景在 Node 与 Workbench 中必须得到相同 trace/hash。

验收门：不启动浏览器即可完成确定性模拟；输入顺序、同帧优先级、状态到期、派生和暴击结果有精确断言；同 seed 的采样结果可复现，期望值模式不产生伪暴击副作用；三条金标准在迁移前后无语义漂移。

阶段结果：唯一无头核心已提供 `catalog / compile / validate / simulate / evaluate / explain` 六个接口，Workbench 的权威编译、模拟、方案对比、放置评估与分析报告复现均消费同一核心。R1 使场景级或逐 hit 的 `sampled` 都在校验期要求 seed 并创建确定性随机源，资源预检与最终结算使用隔离随机流；命中时从目标属性 102 读取 `CRI_DEFENSE`，trace 分别保留来源暴击率、目标减暴、有效阈值和 roll。小玉、红宝石、寒悠悠及寒悠悠主控 Buff 切人四份 golden 的 replay/summary hash 无漂移，canonical trace hash 按新追踪合同更新。完整 146 文件/901 测试、62/62 production preview、41/41 必需能力及全部来源/漂移守门通过；Workbench gzip `375,287B`、总 JS gzip `768,160B` 的既有发布风险继续单列，不在本阶段压缩。

#### M11-B：Machine Axis Contract 与 CLI（已通过产品验收）

- 建立版本化 JSON Schema，支持绝对帧、`after previous/end`、偏移、切人、用户可选 variant、逐 hit 的命中与暴击覆盖、初始资源、敌人参数、目标时长、场景级 `criticalPolicy` 和 `randomSeed`。
- 每个稳定 hit identity 分别保存 `landed: inherit|hit|miss` 与 `criticalMode: inherit|sampled|expected|critical|non-critical`；两者互不代偿。`miss` 必须关闭该 hit 的伤害、削韧、回能和命中效果；暴击模式只作用于实际命中且本来可暴击的分支。变体改变后无法解析的旧 hit override 必须报机器诊断，不得按显示序号误绑到新 hit。
- CLI 提供 `catalog`、`validate`、`simulate`、`compare`、`explain`，支持 stdin/stdout 和文件形式的 JSON/JSONL。无效动作返回机器可读原因，不生成占轴失败块。
- CLI 支持场景级 `--critical-policy sampled|expected|critical|non-critical` 与 `--seed`；高级复盘可为单 hit 提供捕获的 `criticalRoll`，该值进入输入哈希并优先于采样，但普通作者不需要手填随机数。
- AI 使用公开动作和语义变体即可排轴，不需要知道内部 control/subskill；输出仍保留 resolved control、hit、effect 和 source identity 供审计。
- 机器轴可直接导入 Workbench，Workbench 也可导出同一语义合同。

验收门：一条命令可完成完整长轴模拟、对比和解释；保存重放稳定；命中、随机/强制/期望暴击均可按 hit round-trip；任何结果都能回到具体 action/hit/effect、暴击决策及来源版本。
阶段结果：R1 让 Machine Axis 直接消费正式奇波动作投影，`catalog` 现完整覆盖 122 只奇波、366 个 signature/active/break 动作；FPS 合同诚实锁定 60，CLI 输入/输出失败分别稳定返回 INPUT=3 与 RUNTIME=5，输出写入失败会把版本化错误回退到 stdout。更新后的 120 秒 fixture 含 14 个机器输入与 16 个最终执行项，三名角色均实际入轴，迅狼星决技消耗 `100 -> 0`，红宝石公开普攻按重放状态解析为 E1 并消耗弹药 `6 -> 5`；API、CLI、Workbench 得到相同 `input/data/trace/evaluation` hash `1670cb62718bc08b / c49a239709b43a16 / 017c87abc8087efc / 8b144d1df218405e`。R2 为真实 CLI 子进程 I/O 用例设置 30 秒测试边界，并由正式夹具同时校验报告顶层、R1 与 R2 canonical hash。聚焦 7 文件/43 测试、隔离完整 151 文件/931 测试、62/62 production preview、41/41 必需能力和六道来源/漂移审计通过；四份 M10 golden 无漂移。M11-B-R2 已在 `8da52fb` 通过产品验收；Workbench gzip `375,306B`、总 JS gzip `768,501B` 的既有超限继续仅作为对外发布风险。

#### M11-C：Visual Verification Workbench（已通过产品验收）

- 当前网页收敛为权威 trace 的编辑与验收表面，保留动作块、操作轴、三值/能量/印记/特殊资源曲线、Buff/状态区间和逐 hit 编辑。
- 检查面为每个 hit 提供相互独立的命中选择和暴击选择；暴击使用 `继承 / 随机 / 期望 / 暴击 / 不暴击`，默认继承场景策略。页面显示命中时刻的有效暴击率、抗暴、暴伤，以及采样模式的 roll/阈值/结果或期望模式的概率加权贡献，不在曲线上增加装饰性暴击点。
- 支持载入机器轴和预置验收场景；选中动作或节点时显示 resolved variant、触发条件、state before/after、派生 hit、效果目标/数值/起止以及后续属性影响。
- 同属性、同帧但来源、目标、时长或叠层语义不同的效果必须分别显示；运行时未产生的结果不得由 UI 标签伪装。
- 本阶段优先保证桌面内部验收效率。窄屏精修、动画、装饰、非必要拖拽手感和包体压缩不作为阶段阻断门。

验收门：人可以从页面直接发现条件未生效、派生错形态、Buff 漏失、同帧顺序错误、hit 未结算和暴击分支错误；页面每个可见事实都能映射到 trace identity，导入导出后逐 hit 选择不漂移。

阶段结果：Workbench 现按 canonical trace hash 构建 memoized action/hit/effect/resource/state 索引；检查面显示请求/实际形态、control/subskill、执行时序、诊断、逐 hit 命中与五种暴击策略，以及来源、目标和生命周期互不合并的效果/资源事实。M11-C-R1 让暴伤与 expected 非暴击/暴击分支、概率、核心加权结果和事件物化状态直接来自 canonical settlement；标准轴显示 `150%` 暴伤与 `6.2 / 6 / 10 / 5% / false`，缺失物化字段如实显示未知。trace hash 因新增 canonical 元数据由 `fa0f3130b8c77583` 更新为 `017c87abc8087efc`，input/data/evaluation 与玩法 replay/summary 语义不变。完整 preview `63/63`、必需能力 `42/42` 与六道审计通过；R2 仅同步陈旧 golden hash 引用。M11-C 已在 `308dd07fbbb8fe0759062e9dcc02c65b0fd46115` 通过产品验收并进入 M11-D；包体和纯性能抖动继续只记录为发布风险。

#### M11-D：角色机制验收协议

- 每个角色自动生成场景矩阵：正常触发、条件不足负例、窗口内外边界、资源刚好/不足、Buff 刷新与到期、hit 开关、前后台/切人、全部动作变体和保存重放。
- 暴击矩阵至少覆盖 0%/100%、整数阈值边界、命中前属性变化、同 seed 重放、逐 hit 强制暴击/不暴击/期望/随机、miss 与暴击覆盖并存、不可暴击伤害拒绝，以及带暴击副作用时的期望分支守门。
- 成熟度统一为 `extracted -> runtime-integrated -> visually-accepted -> optimization-ready`。未闭环的 `runtime-evidence-required`、`static-evidence-gap` 和未知公式必须显式阻断或降低可信度，不能用默认值静默补齐。
- 小玉、红宝石、寒悠悠完成新协议迁移与产品复验后，才继续第四个角色。

验收门：每个 `optimization-ready` 角色都有机器断言、可视场景和产品验收记录；暴击相关机制必须声明能否进入精确期望模式；任一门失败都会撤销优化资格。

阶段结果：R1 将 requirement inventory、可执行 scenario case、结构化 trace projection、精确 coverage edge、source/acceptance ledger 和成熟度收拢为单向可信派生链；manifest 与 catalog 均绑定 committed manifest index，篡改 N/A、required/summary、ledger、签收或 catalog 后即使重算自身 hash 也会被 validator 与 canonical gate 拒绝。`899edea0c5a1f718153ebe86712ecd8c31aabf7d` 曾完成角色单边产品签收，但该资格未带入最终合并外审基线；当前三角色保持 `runtime-integrated`，`visually-accepted=0`、`optimization-ready=0`。精确归因后的矩阵通过/必需为小玉 `56/407`、红宝石 `36/709`、寒悠悠 `62/243`；887 个唯一功能阻断拆为 181 个上游 source gap 与 706 个 acceptance scenario gap，另有 575 个 wrapper/N/A 来源记录明确非阻断。聚焦回归、验收幂等审计、六道既有审计、production build 和可视导入均通过，玩法 golden/hash 无漂移。M11-D 协议实现已完成，后续视觉资格仍需按最终合并基线重新验收；M12 未启动。

#### M11-R：外部审计整改（已通过并关闭）

M11-01..08 已在前轮外部复审关闭。R2 将原始 Machine Axis actions 数组顺序在 compile 前固化为 source sequence，并贯穿派生动作、诊断、执行块和 runtime；action ID 不再决定同帧 Break、伤害或资源。CLI 缺值/非法值在 I/O 前统一返回 exit 2，warning path 使用 canonical plan 真实索引。产品确认同名奇波可跨角色重复并按 `actorId+kiboId` 隔离 CD/资源；客户端未知的跨 owner 同帧优先级仍保持 evidence-open，但数组顺序作为场景显式顺序。

最终外部短复核基线 `64603640bda82d6ab3d869e98d70696f73caeef7` 无新增 P0-P3，M11-09、CLI 参数边界和 warning path 全部关闭。ID 重命名反例为 `468 / 468`，CLI 参数边界 `7/7`，warning path 精确指向 `executionPlan.actions.1` 与 `.15`；官方完整性校验和五命令 smoke 均通过。现有 merged-only 审计包与 SHA 保持不变。该结论只关闭 M11 无头核心外审，不授予角色/奇波视觉验收或优化资格；三角色保持 `runtime-integrated`、`visuallyAcceptedCount=0`、`optimizationReadyCount=0`，M12 继续锁定。

#### M11-R3：基线清理（已通过）

Workbench 草稿快照与项目重建路径现在持久化并恢复 Machine Axis source sequence，持久化重建后的 input/trace hash 与权威基线 `c91f9da64e02ef84 / d10c45fb73dc7c6f` 一致，M11-09 的数组顺序语义在 Workbench 侧同样成立；空 draft 不再被误标为根序列 0。同时把审计基线自带的陈旧测试期望同步到已提交权威 golden 报告（旧 trace hash `017c87…`、expected 临界分支、assertionCount、调谐印记伤害），并将 M11-01 边界用例超时放宽到 15s 消除并行负载误报。全量回归 165 文件 / 1100 测试通过。

### M12：批量评估、搜索与末音试点

#### M12-A：Batch Evaluator

- 在无头核心上增加批量场景/轴评估、并行执行与指标聚合。
- 输出总伤害、DPS、爆发窗口、削韧、资源余量、空转、不可执行动作，以及按角色、动作和 hit 的贡献。
- 纯伤害暴击默认可用 `expected` 做确定性比较；需要还原游戏波动时对显式 seed 集合运行 `sampled`，报告均值、方差、分位数和样本数。存在状态型暴击副作用时只允许精确带权分支或多 seed 采样，不得用一次强制暴击/不暴击代表期望。
- 先建立真实基准和热点报告，再决定吞吐目标；不为追求速度降低机制精度或跳过合法性检查。

#### M12-B：Search/Optimizer

- 以动作结束、状态变化、资源阈值和窗口边界为搜索节点，不逐帧蛮力枚举。
- 使用动作语法、beam search、等价状态 hash 合并和上界剪枝；外层枚举队伍，内层搜索输出轴。
- 输出带场景假设、数据版本、合法性、暴击策略/seed 集、覆盖可信度和因果解释的 Top-N 结果，不给脱离前提的单一“最佳答案”。

#### M12-B2：可持续循环 DPS（已通过产品验收并正式关闭）

- M12-B-R2 已通过产品复验，现优先实现 `cycle-dps`，早于 M12-C、进一步性能优化和其他评分扩展。
- 默认基准场景使用无限 HP 敌人并关闭韧性、击破和死亡截断；轴可以包含暖机段，但必须显式声明非空半开循环区间 `[loopStartFrame, loopEndFrame)`。
- 循环伤害只统计命中时间落在半开区间内的 HP 伤害事件，延迟命中按实际发生帧归入对应循环，边界事件不得重复计数。`cycleDps = loopHpDamage / ((loopEndFrame - loopStartFrame) / fps)`。
- 循环闭环是硬门而不是扣分项：结束帧的角色 SP、奇波能量、弹药、特殊资源、队伍印记及其他可消耗战斗状态不得少于开始帧；主控角色、形态和所有会影响下一轮合法性的状态必须允许从循环首动作重新执行。
- CD、充能层数、内部 CD 和持续效果不能只看数值快照，必须把同一循环至少连续重放两次；第二轮不得出现 CD、资源、条件、重叠或派生阻断，且循环结束状态仍满足同一闭环门。一次性暖机 Buff 或不可再生资源不得伪装成可持续循环收益。
- 默认纯伤害暴击使用 `expected`；显式多 seed `sampled` 使用 cycle-local 共同随机数验证闭环、用各 seed 的独立 canonical run 统计 DPS，报告样本数、均值、样本方差、分位数及 actor/action/hit 贡献守恒。存在状态型暴击副作用时继续要求精确带权分支或显式多 seed，不能用单 seed 冒充循环期望。
- 报告必须输出暖机段、循环起止帧、循环时长、循环总伤、循环 DPS、逐角色/动作/hit 贡献、开始/结束状态差、CD/充能闭环证明、连续重放证明、假设、hash 与 seed 集。
- 验收必须覆盖：无循环节拒绝、资源净亏拒绝、下一轮 CD 阻断拒绝、延迟命中边界不重计、一次性 Buff 不得抬高循环值，以及合法循环连续重放后 DPS 与状态闭环保持稳定。

阶段结果：`AzPrMachineAxisCycleDps` v1 已通过唯一 canonical core 实现，CLI `cycle` 可重放显式循环并输出暖机、半开区间伤害、三层贡献、资源/状态差、两轮可执行性、动作形态闭环、假设和 hash。R1 保证无限 HP 模式在普通、调谐/超限与真实伤害公式入口不受初始有限 HP 截断，并把奇波被动内置 CD 与有限触发寿命纳入闭环。R2 将 sampled 的自然暴击方差与状态/暖机泄漏分离：64 seeds 官方轴均通过闭环，伤害均值 `22.59375`、样本方差 `1.07043651`，actor/action/hit 聚合均与样本均值守恒；`-1` 与 `9999999` 由生成层明确归为 unlimited，小正整数仍为 finite。河狸仔 520082 稳态循环通过，520087 六层稳定刷新边界闭合；驮驮龙 15 秒 ICD 与真实一次性触发仍保持拒绝。提交 `76530074f6c2fb1d2b88b4eee1d2fd558d01ce2b` 已通过产品验收，M12-B2 正式关闭且不做 R3；下一阶段为 M12-B3 optimization qualification，M12-C 继续锁定。

#### M12-B-R2 已通过产品验收（2026-08-01）

M12-B-R1 已关闭原五项主体缺口；R2 进一步把资源等待从逐整数事件改为候选动作真实费用驱动的最早可执行阈值，并让多 seed 的角色、动作与 hit 贡献按稳定 identity 聚合且与排序指标守恒。独立验收确认 SP 90→100 在 `2886F` 达阈值、`2887F` 释放星决技，405/425 两个样本的总指标和三层贡献均为 415；聚焦回归 6 文件/62 测试、相关无头回归 6 文件/66 测试及 production build 均通过。M12-B 正式关闭且不做 R3，当前进入 M12-B2；M12-C 继续锁定。

#### M12-B3：风/雷体系、星临者与装配优化资格阶段（E21 已关闭，末音 S3-R1 等待产品复验）

- 本阶段只建立并验收优化资格，不执行正式配队搜索；M12-B2 已通过并关闭，当前从 B3-A 固定分母、资格产物和严格培养合同开始，M12-C 在本阶段整体通过前继续锁定。
- B3-A-R1 已在 `f902de10c42c2c4dc750be2316fabe3bc026f8cc` 通过产品验收。B3-B-R1 唯一生成命令继续重算 `11/43/62/137/12`，source/roster/manifests/ledger/catalog/binding hash 分别为 `4c1259408e1d716c`、`a8f727dfd0288518`、`8f8feddcd152890a`、`d6dcd25e48632b9e`、`14e8c20e2a6ab41c`、`79777849b22eeb65`。固定培养输入 profile hash 仍为 `c432bd0a3f2d6415`；当前版本仍不研究或应用奇波 DNA，`dnaFactors` 省略时规范为 `[]`，非空输入在 compile/validate/search 前拒绝，DNA 不进入资格缺口。
- B3-B-R1 将 `hero_rank` 拆为表声明、等级/突破档合法性、属性应用、技能可用性与技能效果运行时五层合同。`GameAssembly.dll` 的 `HeroData.Populate(HeroAttrInfo)@0x2458520`、`RefreshAttributes@0x2458C00`、`RefreshHeroSkill@0x2458F50` 及 `AttrModuleInfo` 调用边只能证明服务端属性模块被刷新，不能排除 `HeroAttrInfo` 已包含突破属性；在取得同角色同等级空装配的相邻档最终面板差分前，`hero_rank.attribute` 不进入角色面板、奇波继承或伤害，11 个角色培养 blocker 恢复。表内技能只记录声明；实际可用性与效果运行时分开，`112001` 的错误 ID 继续单列。装备实例仍以运行时 `bGoldSide/maxValue` 与客户端术语共同区分普通最多 100、缘星固定 110；固定 `4星/+9/110` 只生成合法缘星实例，主副属性继续使用分段 `ceil` 公式。
- formal admission 由 11/43/62/137/12 对象准入、12/12 套装技能、角色-奇波/灵子/装备绑定、装备部位和所有 hash 共同重算；任一分母少 1、set-skill 或 binding 未就绪、hash 漂移时均以 `optimization-qualification-stage-locked` 在 project/search 前拒绝，只有完整 synthetic 全绿矩阵可解锁。8 个已接入灵子已用数据驱动矩阵覆盖 Before/After、normal/charged/star-skill、stack/refresh、持续/到期、错误动作抑制与同帧边界；`AfterSkill` 不反向增益自身末帧 hit。当前五类 optimization-ready 仍全为 0，阻断账本为 454 条（438 `not-implemented`、16 `evidence-insufficient`），M12-C 继续锁定。
- B3-B-R1 已在 `f846161c4a71bbc2de2b5bed3f598f03344fc692` 通过产品验收：资格/灵子矩阵 `2 文件 / 40`、Machine Axis `12 文件 / 157`、九道审计与 production build 均通过；分母 11/43/62/137/12、454 条 blocker（438 `not-implemented`、16 `evidence-insufficient`）及五类空 admission 保持诚实。B3-C 现建立 62 灵子与 12 套装技能的动态机制族 census，并只接入来源闭合批次；整个 B3 尚未完成。
- B3-C-R1 已在 `2804f201ac2a6ea4eebc1339703a9d40c0aba5a5` 通过产品验收：Battle element 叶节点 `defaultPropertyTags` 已保留到 census、effect definition、modifier、来源审计和 hit 结算；`10060` 仅增强普攻，`10094/10098` 仅增强重击，未知、缺失或多标签不会扩大成全伤害。
- B3-C2 进一步闭合 `10055/10093` 的 AfterSkill 星决技 OR 选择器、`AllHero` 独立目标命令和 action-end 时序，以及 `10097` 的真实极限反击 BeforeSkill/action-start 路径。`baseFunctionId=3` 的 `dynamicExtra` 经统一 Q16.16 公式注册表按 `A/10000` 结算，`baseFunctionId=5` 保持 A 点数；来源角色、目标角色、刷新、右开到期与循环继承均进入 canonical trace。C2-R1 明确将 BeforeSkill/AfterSkill 绑定为 `execute=true` 的动作事件，无 hit 或全部 miss 仍触发；BeforeDamage/AfterDamage 继续只由 landed hit 触发，blocked 动作两类事件均不生成。当前灵子为 12/62 `runtime-applied`、50/62 `dynamic-unapplied`，阻断账本为 446 条（430 `not-implemented`、16 `evidence-insufficient`），五类 formal admission 为空，M12-C 继续锁定。census/hash 与验证结论见 `reports/m12/m12-b3-c-dynamic-loadout-effect-acceptance.json`。
- C2 功能提交为 `942639f07d5a417f8145f8c11aadf006646dfbee`，C2-R1 产品验收基线为 `ba3422c722f8640857fa8fd9d19040e755c8484a`。C3 从 verified `controlBinding.logic.skillTag` 识别真实切入派生 `EntrySkill=22`：`10151` 以叶节点 10 秒生命周期刷新；`10147` 保留 `19001101 -> 19001001 -> 19001002` 三层来源，由 BuffElement 包装层 6 秒控制生命周期，叶节点 `time=-1` 不会扩成常驻，且 `defaultPropertyTags=[301]` 继续只匹配重击。退场 tag、伪造独立星携技和未执行/CD 阻断动作均不触发；全 miss 的已执行入场动作仍触发。当前灵子为 14/62 `runtime-applied`、48/62 `dynamic-unapplied`，阻断账本为 442 条（426 `not-implemented`、16 `evidence-insufficient`），五类 formal admission 为空，M12-C 继续锁定。
- C3 已在 `e05b10fd27a6c723a773a7680169a9180031c48e` 通过产品验收。C4 至 C13 均已按各自产品基线通过；C14 在 `a5434a1e0b01c2d70db1832064e34f63fb44e279` 通过来源身份核查，`set-skill:3:4` 因正式文本与唯一可达旧图冲突而保持 `evidence-insufficient`。C15 由 `periodic-persistent-property-runtime-evidence.json` 闭合持久根的周期复评、失败条件消耗周期、有限 Cover 叶和卸载边界，并接入 `10084/10152/10197`；`10078` 的 `[302,303]` 多 PropertyTag 匹配仍缺原生证据。C15 已在 `aafb6aa6c645b7b7490fdba0f71b8941da311f6e` 通过产品验收。当前为 42/62 灵子、11/12 套装技能 `runtime-applied`、375 条阻断（354 `not-implemented`、21 `evidence-insufficient`）；五类 formal admission 为空，M12-C 继续锁定，阶段暂停等待用户明确恢复。
- 资格分母由生成数据按规则确定，而不是手写后静默漂移。角色范围为 `element.abbrName` 的离散属性标签中包含 `风` 或 `雷` 的全部角色，再额外并入一个统一的星临者优化对象；底层 `199001/199002` 只作为该对象的来源身份别名，不分别进入优化分母。奇波同样将 `element` 按 `、` 等分隔符拆成离散属性标签，纳入标签中包含 `风` 或 `雷` 的全部单属性及双属性奇波。装配范围为当前公开目录的全部灵子和五部位装备，并以 verified 静态目录中的套装技能门槛记录为动态效果分母。阶段启动时必须生成并提交 `reports/m12/m12-b3-optimization-qualification-roster.json`，记录筛选与归一化规则、生成时间、源文件 SHA-256、优化对象 ID/名称、来源别名、装配兼容关系与各分母计数；源数据变化必须显式重定基线并重新验收，不能自动增删分母。
- 当前生成快照为 `2026-07-08T03:35:51.289Z`。角色源 `characters.json` SHA-256 为 `4A73F5E393F7410F5AF80A811CAC604D97CA6BF74CA8E0BE66445CA932FB5052`，奇波源 `kibos.json` SHA-256 为 `1CCA2E3D0D1CB5A0A984164AB0C6B05EF0B6C5416B0E9872F0C8AB36394519C4`，装备源 `equipment.json` SHA-256 为 `D718604A7B28F84163C175F7F7D0B4D26F891606BB18ACF22939E2EF16EAF593`，灵子源 `soulessences.json` SHA-256 为 `385DBB96CF0FECA4B42C7D3D63040C506C310BEEB62ED7F9F37AC68FD012DCBE`，当前 verified mechanics package 文件 SHA-256 为 `B84AACA9CD3FE1384DF62CBDDE5DB531A0339E1C6A988F3FB6C9088D7953A971`。
- 当前角色分母为 11 个优化对象：`101010 涂山小玉`、`102001 莉莉`、`103002 红宝石`、`107001 西芙莉雅`、`107002 米砂`、`108001 忒拉拉`、`108003 米蒂`、`109001 末音`、`111001 法兰塔`、`112001 姬瑟贝露`，以及统一的 `STARBORN 星临者`。星临者只生成一份资格 manifest、一个优化候选和一个队伍对象；`199001 女主角`、`199002 男主角` 作为 `sourceCharacterIds`/运行时外观别名映射到它，别名一致性只做适配回归，不形成两份产品签收，也不得被优化器枚举两次。
- 当前奇波分母为 43 只。单属性 22 只，其中风属性 13 只：`500001 迅狼`、`500064 柔风鹰`、`500065 风剪鹰`、`500120 哈加`、`500123 风灵苞`、`500124 风灵朵`、`500125 岚音花`、`500126 风灵仔`、`500127 风灵偶`、`500128 岚灵偶`、`500322 赛可洛`、`500323 托纳缇欧`、`500324 伊欧利安`；雷属性 9 只：`500129 呼姆猴`、`500130 环尾猴`、`500131 环影猴`、`500164 雷灵苞`、`500165 雷灵朵`、`500166 电音花`、`500173 雷灵仔`、`500174 雷灵偶`、`500175 电灵偶`。
- 含风或雷标签的双属性奇波 21 只：`500025 拉加野猪（雷、地）`、`500043 小浮蝶（风、光）`、`500044 浮蝶（风、光）`、`500045 幻蝶（风、光）`、`500057 猪古力（雷、地）`、`500082 雷冠牦（雷、地）`、`500185 森彩灵蝶（风、光）`、`500220 星云伊欧（暗、雷）`、`500231 铁鬃霸主（雷、地）`、`500296 帕莫拉（雷、风）`、`500304 库库（风、水）`、`500305 库库尔（风、水）`、`500306 库库尔克（风、水）`、`500357 啵啵丁（风、木）`、`500358 绒绒云（风、木）`、`500360 怯影之翼（暗、风）`、`500368 小音浮（风、雷）`、`500369 乐乐蛙（风、雷）`、`500370 音霸蛙（风、雷）`、`500469 跳跳稻草人（风、地）`、`500470 秋日守望者（风、地）`。
- 当前装配分母为 62 个灵子、137 件公开装备和 12 个套装技能门槛记录。现有 62/62 灵子与 137/137 装备已有静态 profile，可把等级/等阶、主属性和已确认固定副属性传入角色与奇波伤害。灵子效果已按来源闭包分为 38/62 `runtime-applied` 与 24/62 `dynamic-unapplied`；常驻根与事件型效果均由同一 canonical 属性运行时消费。套装技能为 8/12 `runtime-applied` 与 4/12 `dynamic-unapplied`：六条两件套常驻分量与本轮两条四件套 BeforeDamage 分量分别只安装一次，其余四件套继续阻断。所有灵子和套装仍缺产品可视签收或其他资格门，因此当前没有对象可标为 `optimization-ready`。
- 统一搜索边界：角色等级、星赐层数/节点与临阶加成，奇波等级、四维天赋等级与羁绊等级，灵子等级、等级上限突破阶与升星级，装备稀有度、强化等级、同调评分与实例档，全部属于调用方给定的场景培养条件，不是优化器的搜索维度。当前版本的奇波 `dnaFactors` 固定为空且绝不枚举。canonical core 必须能结构化接收并正确结算其余各项；优化器只在一个不可变培养 profile 下枚举角色、奇波、灵子、装备 ID、队伍/套装组合及动作轴。培养 profile 必须进入输入、canonical 输出、缓存键、状态/build hash 和 Top-N 报告；不得为不同候选静默取不同等级，也不得把任何未声明项默认为最高。
- 每个角色优化对象必须通过 M11-D 的完整四态链 `extracted -> runtime-integrated -> visually-accepted -> optimization-ready`，结构化覆盖角色等级、星赐层数、当前层全部节点、已取得的临阶突破属性及其他会影响战斗的培养项，并覆盖全部可达动作/派生、资源、Buff/印记、CD/充能/内部 CD、延迟事件、逐 hit 命中与暴击、切人及循环边界；任何会影响搜索合法性或评分的 source gap、acceptance gap、未知公式或场景假设都必须阻断资格，不能靠默认值标绿。星临者的两个底层身份还必须编译为相同的战斗机制 hash，优化结果执行时只解析成用户选择的一个外观别名。
- 每只奇波采用同等级四态门禁：培养 Schema 必须表达等级、四个核心属性（`1/3/4/5`）的天赋等级、由 `pet_talent_upgrade` 解析出的四维数值、固定空数组 `dnaFactors: []` 和羁绊等级。非空 DNA 属于当前版本不支持的产品范围，必须结构化拒绝；DNA 因子及联动不参与运行时、资格缺口或优化枚举。四维天赋等级不能再由调用方直接猜一个悟性值；例如天赋 10 级必须按当前表解析为该档起始值 `120`。客户端有效羁绊等级为 `1..10`，未提升羁绊的初始有效档是 1 级；`favor_lv=0` 只作为网络字段缺失/未初始化时的防御性占位，客户端会将其判为空值并视为配置错误，不能作为合法模拟条件。1 级按 `pet_favorability.levelEffect=900` 得到角色属性继承系数 `900/10000=9%`。静态属性与角色继承、星决技/主动技/合击动作、PvE 天赋与被动、战斗 fixed skill、能量获取与消耗、CD/充能/内部 CD、触发次数与生命周期、延迟事件、Buff/印记/护盾/伤害和循环状态都必须进入 canonical core，并由机器场景、可视场景和产品签收共同证明。仅有目录动作、技能文本或静态分类不构成优化资格。
- 每个灵子采用同一四态门禁：等级 1..100、等级上限突破阶 `rank=1..6`、同名灵子升星 `star=1..4`、等级与突破限制、全部静态属性、升星后的效果技能等级，以及效果技能的触发条件、来源/目标、倍率、叠层/刷新、持续时间、CD/内部 CD、资源及前后台语义必须进入 canonical core。`rank` 与 `star` 是两套独立系统，Schema、目录、hash 和报告不得继续用一个“等阶/突破”字段混写；仅应用静态面板而忽略效果技能时必须阻断资格。
- 每件装备采用同一四态门禁：部位兼容、全部合法强化等级、同调评分、主属性、固定副属性、套装 ID 与件数门槛都必须结构化。强化等级必须从 `accessory_level.level` 解析对应的基础属性档；同调评分必须映射上游 `accessory_customed.score`（“同调当前值”），并按 `EQUIPMENT_SCORE_FORMULA_PARAM=8500|6000|125|200000` 的当前证据，对主、副属性分别执行与客户端相同的分段取整公式 `ceil(base*0.85) + ceil(base*0.6*0.0125*(score-20))`。`accessory_level.json`、`accessory_main.json`、`accessory_customed.json`、`game.json` 和同调上限文本都必须进入装备来源链及提交 hash，不能只读取当前缺少同调字段的 `equipment.json` 投影。当前 137 件公开装备共有 410 条副属性记录，全部满足 `minimum === maximum` 且标为 `verified-fixed-sub-attribute`，可变副词条分母为 0；本阶段不得发明随机词条、roll、词条预算或相关搜索维度。全部 12 条套装技能须分别闭环触发、目标、叠层、刷新、持续、CD/内部 CD、资源与循环边界，不能把“凑齐件数”当作效果已接入。
- Machine Axis 必须用严格版本化 Schema 表达角色 ID/等级/星赐/临阶，奇波 ID/等级/四维天赋/空 DNA/羁绊，灵子 ID/等级/突破阶/升星级，五件装备 ID/稀有度/强化等级/同调评分。省略 `dnaFactors` 时规范为 `[]` 并写入 canonical 输出和 build hash，非空则在运行与搜索前拒绝。场景级固定培养条件允许在 compile 时展开成每个候选实体的已解析条件，但输入、canonical 输出和 build hash 都必须保留原值与解析值；拒绝未知字段、非法组合、错误部位、超出实例上限的评分和缺失的优化必需参数，不能继续依赖宽泛 `loadout: object` 或在未声明时静默使用最高等级。`catalog` 必须直接提供各类培养范围、等级依赖、角色/部位兼容、四维天赋与羁绊规则、普通/缘星实例档及其同调上限、固定属性、套装关系、效果成熟度和来源 hash；缘星资格与上限应按实例上的 `bGoldSide/maxValue` 证据建模，不能误写成基础装备 ID 的固有属性，也不能依赖 UI 私有目录拼装候选。
- 优化器采用“外层队伍与装配候选、内层动作轴”的分层搜索，但角色、奇波、灵子与装备的所有培养值都由调用方固定。外层只枚举各类 ID、合法绑定、部位和套装组合，不得展开角色等级/星赐、奇波等级/天赋/羁绊、灵子等级/突破/升星、装备强化/同调分支；DNA 始终为空且没有候选维度。例如调用方指定 `4星 / +9 / 同调110` 时，只比较能按该培养档生成合法实例的四星装备组合。上游文本明确“缘星装备固定拥有 110 的同调评分上限，普通装备上限最多为 100”，所以 `同调110` 条件必须编译为合法的缘星实例档：同一基础装备 ID 若支持该实例档仍可参与枚举，不支持时才排除或结构化拒绝；不能把普通实例强行套用 110。装配层再按兼容、套装、属性上界和等价 build hash 生成并剪枝，禁止对 62 灵子与五部位装备做无约束笛卡尔积；固定培养条件、实例档、静态属性、动态效果和角色到奇波继承都必须进入状态/build hash。Top-N 顶层报告必须直接列出完整队伍、奇波、灵子、装备、固定培养 profile、实例档、套装效果、build hash、覆盖资格和相对贡献，不能只把装配藏在结果 `axis` 中。
- 另设角色-装配-奇波绑定门禁，至少覆盖装配属性进入角色、角色属性向奇波传播、装配效果的来源/受益者/目标、前后台与切人、同名奇波跨 owner 的 `actorId+kiboId` 资源/CD/被动状态隔离、同帧角色/装配/奇波事件顺序，以及保存重放和连续循环边界。只有完整绑定场景通过的组合才能进入优化器候选。
- 未达到资格的单位或装配仍可保留在目录或研究场景中，但 canonical catalog/validator/optimizer 必须以结构化原因拒绝其进入正式搜索，不能只降低分数或输出 warning；任何 `dynamic-unapplied` 灵子或套装效果均为硬阻断。本阶段不以部分完成通过：11/11 角色优化对象、43/43 奇波、62/62 灵子、137/137 装备、12/12 套装技能及规定绑定场景必须全部为绿，资格清单和核心实际准入集合必须 hash 一致。
- UI 美化、窄屏精修、动画、拖拽手感、包体压缩和纯吞吐优化不阻断本阶段；Workbench 工作只服务于机制可见性、逐单位签收和错误复现。

统一培养条件验收反例至少覆盖：同一组 ID 在两个合法培养 profile 下得到不同属性与不同 hash；固定一个 profile 后，候选数不得随任一培养字段的可用范围扩张；角色、奇波、灵子或装备 ID 改变时仍完整继承同一固定 profile；Top-N、replay 与 Workbench 导入均逐字段保留 profile 及其 hash；缺失或非法培养组合在搜索前失败，不能回退到最高值。奇波还必须证明天赋 10 级解析为四维 `120`、省略 DNA 与显式 `[]` 得到同一 canonical 输入、非空 DNA 在 compile/validate/search 前拒绝、初始羁绊 1 级按 9% 继承角色属性，并在严格 Machine Axis 输入中拒绝 `bondLevel/favor_lv=0`。

装备培养验收反例至少覆盖：同一装备 ID 在不同合法强化/同调条件下得到不同属性与 build hash；同一固定培养条件下不同装备组合可被正确比较；优化器候选数不随可用强化等级或同调区间扩张；`4星 / +9 / 同调110` 夹具只生成合法缘星实例且不额外枚举培养值；同一基础 ID 的普通/缘星实例上限判定正确；缺失条件、非法强化等级和超过实例上限的同调评分均在模拟或搜索前结构化拒绝。核心数值反例必须同时覆盖主属性、副属性、分段 `ceil` 舍入、角色面板、角色到奇波继承与最终伤害。

验收门：提交固定分母、星临者别名归一化规则、装配兼容矩阵及其来源 hash；11/11 角色优化对象、43/43 奇波、62/62 灵子、137/137 装备与 12/12 套装技能均为 `optimization-ready` 且没有影响搜索的开放缺口；星临者只出现一次且两个来源别名机制 hash 一致；角色-装配-奇波绑定矩阵、严格 Machine Axis round-trip、固定培养条件不扩张搜索空间的反例、固定装配与联合装配搜索反例、canonical replay、连续循环和 Workbench 产品签收全部通过；对清单内任一资格对象撤销资格时，M12-C 立即重新锁定。

#### M12-C：末音试点

- 权威实施合同见 `work/m12-c/STATE.md`。本阶段只枚举正式 9 人 roster 中以 `109001 末音` 为必选核心的三人队：另外两人从其余 8 个优化对象中选择，共 28 个对象队伍；STARBORN 仍是一个对象，但每条轴必须显式且互斥地选择 `199001` 或 `199002`，因此共有 35 个来源配置。队伍顺序不形成变体；初始前台由内层动作轴搜索并进入 `axisHash`，不进入队伍或 `buildHash`。
- 固定培养为角色 80 级/星赐 7、奇波 80 级/四天赋 10/羁绊 1/`dnaFactors=[]`、灵子 80 级/`rank=6`/`star=1`、装备四星 `+9/同调110` 合法缘星实例。外层枚举合法队伍与角色到奇波、灵子、五部位装备的绑定及派生套装效果，内层再搜索动作轴；不得先按静态面板贪心选装，也不得让 illegal/unscoreable 候选进入评分。
- 三个目标分别输出独立 Top-N：`cycle-dps-no-toughness`、`cycle-dps-with-toughness`、`fastest-kill`。三者统一使用 80 级标准敌人 `310054 雷冠牦` 和零距离静止场景；两个循环目标使用无限 HP 并分别关闭/启用韧性，击杀目标使用有限 HP/韧性和首次致死 cursor。禁止合成权重榜单。
- 循环轴可由调用方用版本化 preset 固定角色/奇波 SP、队伍印记和来源允许的角色专属资源，以跳过暖机；不同 preset 分榜，且循环仍须证明资源、CD、状态、印记逐层到期和 pending event 可连续闭环。只给印记层数时按 0F 新获得、完整正常持续时间处理。
- 击杀轴初始资源的通用资格原则是“可在非战斗状态持久保留且不会随时间过期”；M12-C v1 为控制证据范围，只开放角色/奇波 SP 与红宝石 `103002047` 弹药，调谐印记固定为 0，其他角色资源/状态全部固定为 0 或未激活。满 SP 可作为统一 preset；红宝石弹药合法范围为 `0..12`，切人不得重填。preset 由整次 run 固定并进入 hash，不能按候选偷选。
- 手动排轴、Workbench、CLI、batch 与三个自动目标必须消费同一无头合法性门。Top-N 自动导入可视化验收台，由产品复核动作、派生、资源、Buff、印记、Break 和伤害曲线；复核通过后才能形成正式结论。当前五个角色视觉签收、STARBORN 每种既有印记 `+1`、合击同帧“伤害后清空架势并 Break”及 objective-scoped 初始状态门未全部关闭前，M12-C/formal search 继续锁定。

执行边界：M10-B2-R1 完成后先实施 M11，不继续盲目扩角色。暂缓新的营销式页面、视觉特效、非必要响应式适配、包体压缩、与验收无关的拖拽细节和全角色批量标绿；允许继续的 UI 工作仅限暴露、定位和复验机制错误。

## 6. 推荐里程碑

| 里程碑      | 用户可完成的事                                                  | 验收锚点                                                           |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| M1-A        | 首屏直接理解 3 人、3 奇波、敌人、7 轴和 8 曲线                  | 1440x900 / 390px 与 Endaxis 对照                                   |
| M1-B        | 完成换人、绑奇波、选敌人并稳定回放                              | 五载体身份一致                                                     |
| M1-C        | 从动作库拖入并立即看到同轴命中与曲线变化                        | 编辑、撤销、日志和曲线同步                                         |
| M1-D        | 打开即可演示、保存、分享和比较示例队伍                          | 完整 Playwright、视觉、包体与剩余差距报告                          |
| M2          | 配置三人、奇波、装备、灵子和敌人并回到主轴编排                  | 五载体回放、六轴身份、1440/390px 可见验收                          |
| M3          | 拖入真实动作并自动看到可信状态与 CD 内容                        | 生成/runtime 同源、五载体、同轴可视验收                            |
| M4          | 拖拽前看到合法位置并选择自由或约束辅助排轴                      | 统一提议、事务编辑、真实拖拽与五载体验收                           |
| M5          | 保存局部动作组并作为片段拖回任意兼容方案                        | 片段合同、原子插入、运行时重建与主轴验收                           |
| M6          | 拖入真实动作并看到来源可靠的八条机制曲线                        | 精确数值链、稀疏语义投影、同轴回源与五载体                         |
| M7          | 当前客户端全部公开角色/奇波动作均有可追溯三值分类与运行时结果   | 独立目录分母、全量映射报告、跨 owner 运行时与八曲线                |
| M7-R1       | 拖一次普攻即得到可独立编辑的真实 A1..An 输入链                  | control 链生成、逐段命中、整链事务与五载体                         |
| M7-R2       | 普攻块按真实输入窗口紧凑排布并可诊断连段合法性                  | EventBridge 窗口、有效时长、旧项目兼容与五载体                     |
| M7-R3       | 在同轴操作栏读取显式输入，并约束角色/奇波合击同帧发动           | 中央键位合同、合击配对、缩放滚动与五载体                           |
| M8-A        | 装配灵子/装备后得到可溯源角色面板，并正确传递到奇波             | 机器证据包、静态属性编译、角色到奇波继承                           |
| M8-B        | 全动作自动绑定 Battle 效果，并在时间窗内改变后续动作结果        | 效果图、动态属性桶、逐维覆盖审计                                   |
| M8-C        | 队伍印记随真实命中获取、消耗、到期并触发九属性调谐              | 九元素状态机、Q16.16 结算、已验证例外                              |
| M8-D        | 在同轴 UI 中复盘装配、buff、印记与动作数值的完整因果链          | 桌面/窄屏、五载体、全量 trial-release                              |
| M9-A        | 每个公开动作块按真实动作区间占轴，未解析时长不再伪装为一帧      | 全动作时长审计、来源分级、异常报告                                 |
| M9-B        | 派生动作与角色特殊资源按输入帧状态选择并完整回放                | ActionVariantGraph、角色资源轴、五载体                             |
| M9-C        | 去重后的真实效果按实际变体、目标、触发和公式进入唯一运行时      | 语义效果分母、状态机、Q16.16 注册表                                |
| M9-D        | 当前公开角色与奇波的静态可解动作完整驱动战斗曲线                | 固定产品分母、真实队伍因果链、发布守门                             |
| M9-R1       | 未解析动作可编排，投射物按零距离场景立即命中且逐 hit 可编辑     | 场景命中合同、动作检查器、五载体与三值回放                         |
| M9-R2       | 自选输入派生，自动资源/状态派生，并由零时长切人触发星携技       | 全量变体图、换人事件合同、五载体与真实队伍回放                     |
| M9-R3-R2    | 小玉重击按上下文选择真实形态并使用实际占轴                      | 四形态 control 映射、统一 effective timeline 与真实 Workbench 流程 |
| M9-R3-R2-R2 | 小玉所有可达动作按真实指定输入窗派生后续形态                    | 全动作 EventBridge 审计、统一 context edge 与真实 UI 跨窗复验      |
| M9-R3-R2-R3 | 派生输入和动作执行分时建模，贴边放置无需视觉重叠                | 半开窗口审计、上下文占轴、真实拖拽与桌面/窄屏复验                  |
| M9-R3-R3    | 在完整模拟数据下流畅编辑、拖拽、复盘并按需打开检查面            | DOM/节点硬门槛、求值计数、桌面/窄屏 production 性能基线            |
| M10-A       | 用一个 owner 命令重建角色完整战斗 profile、运行时切片和缺口账本 | 小玉金标准、幂等同步、golden trace、无运行时角色特判               |
| M10-B       | 逐个角色完成证据、运行时与 UI 验收，不批量自动标绿              | 每角色独立提交、五态进度、通用算子扩展与产品复验                   |
| M10-B1      | 红宝石普攻按重放状态切换普通/强化链并驱动弹药因果               | A3/快速入口重投影、E1-E12 连排与真实 Workbench                     |
| M10-B2      | 寒悠悠按真实命中叠加/消费焰火并驱动重击、Buff 与三值            | 两段蓄力、目标状态运行时、被动效果、golden 与真实 Workbench        |
| M10-B2-R1   | 从公共入口看清并验证寒悠悠完整状态与效果因果链                  | 焰火层数/消费、5 次爆炸、双 Buff、SP、后续属性与强负例             |
| M11-A       | 不启动网页即可确定性编译并模拟完整排轴                          | 无 UI 核心、版本化输入、权威 trace/hash 与三角色金标准             |
| M11-A-R1    | sampled、减暴与报告复现共享唯一确定性调用链                     | seed 门禁、随机流隔离、CRI_DEFENSE、canonical report replay        |
| M11-B       | AI/脚本通过 JSON 与 CLI 建轴、校验、模拟、比较和解释            | Machine Axis Schema、结构化错误、导入导出与来源追溯                |
| M11-C       | 在页面复验机器轴的动作形态、资源、Buff、hit 和因果              | trace 同源、机制检查器、桌面验收场景                               |
| M11-D       | 只有经过机器与可视化双验收的角色可用于优化                      | 四态成熟度、场景矩阵、缺口阻断与产品签收                           |
| M11-R       | 清零外部审计的 M11-01..09 边界缺陷并保留证据状态                | raw Schema、两阶段排轴、统一 horizon、守恒、实例 CD 与整数帧顺序   |
| M12-A       | 批量评估大量合法队伍和轴                                        | 并行模拟、贡献指标、性能基准与无语义降级                           |
| M12-B       | 搜索可解释的候选队伍和输出轴 Top-N                              | 事件边界搜索、状态合并、剪枝、版本和可信度                         |
| M12-C       | 为末音生成并复验持续、爆发和削韧候选方案                        | 固定场景、候选队友闭环、Top-N 回灌 Workbench                       |

## 7. 立即执行清单

1. 已完成：Stage 13-A WIP 封存至本地 `deferred/stage-13a-calibration`，`master` 回到最后完整基线 `593def1`。
2. 已完成：M1-A 整页信息架构和视觉身份重构，以及 promilia / Endaxis 同尺寸首屏对照。
3. 已完成：M1-B 3 人队、奇波与敌人配置闭环，以及 3 角色 + 3 奇波的 6 条独立能量轴。
4. 已完成：M1-C 动作库拖入、合法轨道落位、响应式 runtime、六能量轴所有者隔离及曲线/日志/回放同步。
5. 已完成：M1-D 可展示默认方案、五载体回放、桌面/窄屏视觉与里程碑验收；当前停在 M1 结束点，等待新的产品目标，不自动展开新里程碑。
6. 已完成：按后续产品要求确认 3 个角色与 3 个奇波必须各自拥有资源轴；六轴运行时所有者已独立。AzPr 当前证据表明奇波轴对应 `PetUltimateCdTime()` 的技能就绪进度，而不是角色 SP；真实 `totalTime` 尚未稳定映射，因此奇波曲线继续 tracking-only，不伪造变化。
7. 已完成：全部 122 只奇波的 366 个展示动作已形成按需加载目录，真实技能 ID、名称和 60fps 规范时长可拖入所属奇波轨，并在五载体回放中保持一致；未确认效果与奇波能量变化仍为 `unapplied`。
8. 已完成：统一角色/奇波动作的官方图标、类型、名称和已确认时长，动作库、时间轴块、检查器与项目回放共享同一可视身份；六条独立能量轴及未应用机制边界不变。
9. 已完成：动作块、命中/资源事件节点、曲线断点、帧游标和检查器共享动作来源与准确帧定位；回源修改后运行时结果同步刷新，六条独立能量轴不变。
10. 已完成：M1 试用工作流 checkpoint 修复同轨相邻事件像素覆盖，`36F -> 0F` 往返定位的帧游标、三值详情和选中态一致。
11. 已完成：M1 同屏复盘不离轴闭环，事件查看、回源编辑和刷新结果均保持时间轴视口，内部日志同步不会再带动页面跳离主轴。
12. 已完成：M1 试用发布主流程验收，已有动作随固定队伍槽位换人，配置、拖入、复盘、回改、保存和 JSON 恢复保持同一角色/奇波/敌人拓扑及 6 条能量轴。
13. 已完成：M1 空方案从零编排验收，零动作可配置队伍、拖入首个动作、删空回平线并恢复项目，6 条能量轴与敌人 HP/韧性全程保持独立。
14. 已完成：M1 试用候选发布 checkpoint，单命令守门、37 项必需能力、试用指南和反馈材料清单现已统一。
15. 已完成：M1 对标完成度审计，确认 M1 核心里程碑已满足，同时识别受控角色时间状态、动作/效果关系语义和真实机制接入三类剩余大缺口。
16. 已完成：受控角色与切人编排闭环，初始前台、准确帧切换、控制区间、循环继承和五载体回放保持一致，6 条能量轴不变。
17. 已完成：动作/效果关系语义闭环，触发、刷新、消耗、来源回溯、runtime 诊断和五载体回放使用统一关系图，6 条能量轴保持独立。
18. 已完成：P3 六资源所有者机制输入检查点，角色 SP 与奇波就绪观测均按精确资源所有者进入独立曲线；`petDelta` 不作为奇波曲线输入。
19. 已完成：P3 六资源观测回放一致性，方案复制与四种项目载体保持 3 角色 + 3 奇波的所有者、准确帧和非零曲线结果一致，奇波 owner drift 不再被动作重绑定掩盖。
20. 已完成：P3 六资源采样导入闭环，六组 capture 可一次打包、按唯一 owner 动作绑定、生成三条独立奇波观测曲线并通过 JSON 回放。
21. 已完成：P0/P3 六资源生产试用检查点，六文件打包、一次导入、六 owner 绑定和 JSON 回放进入 40 项候选发布守门，真实样本缺口与 unapplied 边界保持明确。
22. 已完成：P3 六资源受控采样范围隔离，SP、奇波就绪和韧性会话分别安装独立 hook 集并记录采集范围，避免跨资源污染。
23. 已完成：六资源采样计划与离线预检，固定 3 个角色 SP owner 和 3 个奇波能量 owner，生成独立受控命令并守门已有文件与 production 批次。
24. 已完成：Workbench 项目到六资源计划桥接，队伍、奇波、敌人和动作 owner 从项目 JSON 自动锁定，歧义必须显式消解。
25. 已完成并通过产品验收：M2 时间轴直接装配与可读性整改。角色头像、奇波子轨和敌人身份均为可视选择入口，角色身份区直接显示五件装备与灵子 6 个槽位；固定高时间轴内部浏览放大的角色轨与 8 条状态曲线，动作居中并保留 Buff/CD 区，长轴横向滚动不改变工作区总高度。E2E 通过卡片选择器完成换人和装配，不调用右侧原生下拉框冒充主流程。
26. 已完成并通过产品验收：M3-A/B/C 已打通真实动作目录 generation、既有 runtime 生命周期、同轴 Buff/CD 展示和真实动作库拖入工作流；整改后同轨状态条独立占行，奇波与可确认星决技读取真实结构化 CD，同技能复用进入统一冲突检测，未来技能/Buff CD 修正通过 `base -> adapter -> effective` 合同接入而非写死。下一阶段尚未确认，不自动进入 M4、P3 真实采样或公式研究。
27. 已完成并通过产品验收：M4-A/B/C 已完成统一合法放置提议、事务式约束编辑和同轴拖拽反馈。自由模式保留原提交语义；辅助模式只在用户明确选择后整组采用确定建议，阻塞不落盘，关系组、跨轨 owner、剪贴板和撤销/重做保持原子一致。真实动作库拖拽、默认/空方案、五载体、循环继承、桌面/窄屏与完整 trial-release 已通过。
28. 已完成并通过产品验收：M5-A/B/C 已交付局部片段合同、独立本地库、严格兼容检查、M4 整组放置、M3 运行时重建，以及动作库中的保存、搜索、导入导出、点击/拖拽插入工作流。片段不保存旧结果、不猜测不兼容 owner。
29. 已完成，等待产品复验：M6-R2 已把上一轮错误的 `0..1` 资源空间修正为角色/奇波统一的 `0..100` 绝对 SP 点，并同步修复生成包来源、技能消耗、回能、诊断、曲线与五载体兼容；不自动进入 M7。
30. 已完成，等待产品验收：M7 已以公开角色/奇波动作目录为独立分母生成全量动作、变体和命中三值分类，接入同一 verified runtime 与八曲线，并通过机器/Markdown 覆盖报告、跨 owner 主流程和五载体回放收口；不自动进入下一里程碑。
31. 已完成，等待产品复验：M7-R1 已按真实 normal-attack control 链生成独立 `A1..An`，并守住逐段运行时、整链事务、旧项目迁移和五载体一致性；不进入 M8。
32. 已完成，等待产品复验：M7-R2 已将完整动画尾长与有效连段占轴分离，按真实 EventBridge 输入窗口排布和诊断 `A1..An`；不进入 M8。
33. 已完成并通过产品验收：M7-R3 从当前动作与换人事件派生统一按键输入；耗能奇波主动技使用 Q，角色星结合击与已装备奇波合击必须同帧共享 F。拖入任意一半会自动补齐另一半并以单次事务同帧吸附，后续移动、复制、删除和撤销/重做保持整对。
34. 已完成：M8-A 已将机器证据与 NewTable 纳入带哈希的唯一同步包，完成角色装配到静态面板、角色面板到奇波继承及下游动作输入的确定性编译；动态培养效果继续 unapplied。
35. 已完成：M8-B 已生成全动作 Battle 效果图、动态属性生命周期和逐维覆盖审计；只有来源完整的 verified 字面效果进入 calculator，未知公式与包装语义保持 unresolved。
36. 历史完成记录（已由第 53 项勘误）：M8-C 曾按逐层独立到期模型接入团队印记获取与消费；该计时模型不再作为 verified 结论。
37. 已完成并通过产品验收：M8-D 已把队伍印记资源轴、既有效果区间和动作数值溯源接入同一 runtime 事实及时间坐标；印记 calculator 镜像去重后，独立发布守门仍通过 636 条测试与 50/50 production preview。
38. 已完成：M9-A 全动作时长与输入占轴审计。562 个公开动作与全部公开变体已分类，未解析时长不再以一帧或命中/CD 兜底，也不会进入运行时。
39. 已完成：M9-B 派生动作与角色特殊资源状态机。通用变体图按输入帧选择实际动作，红宝石与涂山小玉的已确认资源事件驱动独立阶梯轴、执行前置条件、循环继承和五载体重建；无证据角色不生成空资源轴。
40. 已完成：M9-C 效果语义、目标/触发与公式收口。完整审计保留 3,122 条语义效果；304 条来源完整的字面属性效果进入唯一 effect runtime，既有调谐机制继续委托 M8 状态机，运行时依赖和未知公式保持 unresolved。
41. 已完成，等待产品验收：M9-D 以 562 动作、20 角色、122 奇波为固定产品分母，将目录外回能元素与当前动作缺口分账，并通过包含红宝石、涂山小玉的三人三奇波连续因果链、五载体和完整发布守门；当前不自动创建下一里程碑。
42. 已完成，等待产品验收：M9-R1 已解耦“可排轴”、来源证据和场景结算，已知变体/动画时长不再落入通用 30F；零距离投射物、逐 hit 命中编辑、撤销/循环和五载体回放使用同一稳定 identity。
43. 已完成，等待产品验收：M9-R2 已完成全量派生控制合同、用户输入选择、零时长精确帧切人事件，以及真实入场/退场星携技的确定性子动作；五载体、桌面/窄屏与完整发布守门均已通过，不自动进入下一里程碑。
44. 已完成，等待产品验收：M9-R3-R2 已纠正小玉四种重击与连续重击的实际 control/subskill 映射，并让生成、运行时、动作宽度、辅助放置和重叠诊断共享同一有效占轴；不自动进入下一里程碑。
45. 实现已完成，等待产品复验：M9-R3-R2-R1 已把爆发三段链的确证接续窗口贯通所有落轴入口，星决技与资源满 100 均稳定选择爆发链，A3 后重击按半开 EventBridge 窗口切换强化特殊/强化重击；当前仅保留总 JS gzip 超发布硬门槛 `444B` 的发布风险，不自动扩展功能或进入下一里程碑。
46. 实现已完成，等待产品复验：M9-R3-R2-R2 已审计小玉 21/21 个公开形态并接入 7 条有直接证据的隐藏输入派生；星携技入场链未发现特殊重击派生，未生成传闻边。总 JS gzip 超发布硬门槛 `445B`，当前不压包、不扩其他角色或后续里程碑。
47. 实现已完成，等待产品复验：M9-R3-R3 已将完整模拟结果的曲线、日志、来源与检查面改为稀疏投影、窗口化和按需挂载，并隔离拖拽预览与 authoritative simulation；复杂 fixture 的 DOM 与交互指标通过专用性能守门。总 JS gzip 超发布硬门槛 `4,280B`，当前按范围不压包、不扩机制或进入下一里程碑。
48. 实现已完成，等待产品复验：M9-R3-R2-R3 已拆分派生输入帧、后续执行起点和前动作关系结束帧，保持原始半开窗口并让真实贴边拖拽稳定选择对应形态；全角色窗口审计、完整单测、聚焦 production preview 和性能回归通过。总 JS gzip 超发布硬门槛 `6,434B`，当前按范围不压包、不扩机制或进入下一里程碑。
49. 已完成并通过产品验收：M10-A-R2 已将自动 recipe 发现、多 owner 通用编译、单轮 package 合并、runtime/profile/golden 生成与 owner 自愈发布贯通为生产主链；独立复验确认 135 文件/781 测试、57/57 production preview、41/41 必需能力及两条漂移审计通过。小玉仍诚实标为 `runtime-applied / partial`，69 条 golden、117 条语义效果和 7 条动态属性依赖保持一致；总 JS gzip 超硬门槛仅记录为既有发布风险。当前停在阶段边界，M10-B/红宝石未启动。
50. 实现已完成，等待产品复验：M10-B1-R1 已将普通 A1-A3 与强化 E1-E12 拆为两个真实输入阶段，接通逐发耗弹、空弹停止，以及星鸣技第 40F 补至 12 发、火印记 `+1` 和 4 秒快速强化入口；114 条 authoritative golden、136 文件/795 测试及 58/58 production preview 通过。红宝石保持 `runtime-applied / partial`，总 JS gzip 超硬门槛 `8,362B` 仅记录为发布风险，当前不启动寒悠悠。
51. 实现已完成，等待产品复验：M10-B1-R2 已将公开普攻改为按时间轴状态重放的输入意图，修正 A3/快速入口后的 E1 选择和 E1-E12 默认紧贴排布；通用切人派生在 CD 中不再物化失败占轴块。136 文件/800 测试、60/60 production preview 与全部来源/生产数据审计通过，总 JS gzip 超硬门槛 `11,445B` 继续仅记录为发布风险。
52. 已完成并通过产品验收：M10-B1-R3 当前按完整重导出完成红宝石 10 个公开动作、159 条原始窗口和 37/37 条语义转移的衔接/派生闭包，接通 A3、换弹、星鸣技、星决技、入场星携技五种强化入口及闪击续段、E12/空弹/超时/切出重置；独立复验确认真实切人、54F 雷印记、公开普攻拖入 E1-E12、跨窗回退、历史与回载均正确。红宝石总 Profile 仍为 `runtime-applied / partial`，保留 5 个 runtime capture 和静态机制缺口；当前停在阶段边界，不启动下一角色。
53. 已修复，等待产品复验：M8-C 调谐印记衰减改为同属性容器共享计时；获得和满层重施均刷新，20 秒仅自然减少 1 层，部分消费不刷新、全消费使旧任务失效。初始状态 v6、循环边界、曲线语义节点和旧逐层状态迁移使用同一合同；依赖旧模型的 DPS 排名须重算。
54. 已回查：101010 小玉与 103002 红宝石的既有 120 秒权威轴在共享衰减规则下与旧金标可观测轨迹相同。小玉三层火印的前两层在旧到期前被 FIFO 消费，剩余层的新旧截止时刻同为 43.45 秒；红宝石每种属性均只有单层且在 20 秒内消费或准时衰减。两轴动作、伤害和动态属性期望不改，新增逐事件回归测试；其他长间隔、满层或 20 秒后消费的轴仍须单独重算。
55. 实施完成，等待产品复验：M10-B2-R1 已用公共入口和强正负例锁定寒悠悠七段焰火 `7 -> 1`、4+5 次命中、引爆 Buff/SP、主控 Buff 切人继承、星决技 24 秒全队双层与 15 秒主控比例 Buff；无名第二被动统一 N/A，红宝石初始弹药改为通用场景输入。141 文件/859 测试、62/62 production preview 与全部漂移/来源守门通过；当前不启动 M11 或下一角色。
56. 路线已重整：M10-B2-R1 收口后进入 M11 无头核心、机器排轴合同、可视化验收台和角色验收协议，再进入 M12 批量评估、搜索器与末音试点。UI 美化、非必要响应式、包体压缩和全角色盲目扩张暂缓。
57. 实施完成，等待产品复验：M10-A 小玉闭环缺口修复已接通普通 A3/A4、95F 星携技块后的 109F 延迟结算、带成功招架前置的 `10101049/sub1`、缘结阈值风印记 `+2` 和玉未央真实触发边界；141 文件/867 测试、62/62 production preview、两道漂移审计、生产数据守门与构建通过。M11、下一角色和包体优化继续暂停。
58. 实施完成，等待产品复验：M10-B1 已消费上游完整 Typetree 重导出，恢复星鸣技 7 段真实命中和第 0F 补弹、火印记、强化入口；公开形态 10/10 runtime-ready，123 条 authoritative golden、141 文件/871 测试和 62/62 production preview 通过。红宝石总 Profile 仍为 `runtime-applied / partial`；M11、下一角色和包体优化继续暂停。
59. 已完成并通过功能验收：M10 收口将寒悠悠隐藏大招爆炸归为当前客户端 `not-applicable / legacy-unreachable` 废案，capture 由 11 降至 10、零距离阻断由 1 降至 0；小玉 117、红宝石 123、寒悠悠 76 条 golden 的 replay/summary hash 均无漂移。M10 正式关闭，当前进入 M11-A；包体超限只保留为对外发布风险。
60. 实施完成：M11-A 已建立唯一 Canonical Headless Combat Core，Node 与 Workbench 共用 `catalog / compile / validate / simulate / evaluate / explain` 和同一 canonical trace/hash；四模式暴击、显式 seed、逐 hit 覆盖及确定性采样已接入。
61. 已完成并通过产品验收：M11-A-R1 已在 `80c5f35` 关闭逐 hit `sampled` 随机源与 seed 门禁、预检随机序列污染、目标 `CRI_DEFENSE` 和分析报告旧调用链；四份 golden 的 replay/summary hash 无漂移。
62. 已完成并通过产品验收：M11-B-R2 在 8da52fb 关闭并发测试超时与验收报告 canonical hash 漂移；122 只奇波/366 动作、固定 60 FPS、真实 CLI I/O、三角色 120 秒 fixture、六道审计与 62/62 production preview 均通过。
63. 已通过产品验收：M11-C 在 `308dd07` 完成 canonical trace 可视编辑与复验闭环。
64. 已完成协议实现：M11-D-R1 在 `899edea0c5a1f718153ebe86712ecd8c31aabf7d` 完成 committed source-of-truth、可执行 scenario case、精确 coverage edge、去重 ledger 与 manifest/catalog 发布索引门禁；该角色单边可视签收未带入最终合并外审基线，当前 `visually-accepted=0`、`optimization-ready=0`。M12、第四角色、包体优化和未验收奇波机制接入均未启动。
65. 已完成并通过最终外部短复核：M11 无头核心外审在 `64603640bda82d6ab3d869e98d70696f73caeef7` 关闭，M11-01..09 与 R2 CLI/path 跟进项无新增 P0-P3；现有审计包和 SHA 不变。此结论不授予角色/奇波视觉验收或优化资格，M12 保持锁定，等待用户明确解锁。
66. C15 已在 `aafb6aa6c645b7b7490fdba0f71b8941da311f6e` 通过产品验收；`10084/10152/10197` 的周期持久根与有限叶接入保持生效，`10078` 继续以多 PropertyTag 原生语义缺口阻断。当前阶段暂停待命，五类 formal admission、M12-C、正式搜索、C16 与新机制批次继续锁定。

## 8. 风险和取舍

- 不建议继续大修旧 `Editor.vue`。旧编辑器可以读作需求样本，但不应成为新架构中心。
- 数据、运行时和项目交换底座已可用；当前优先把它们收束为唯一无头核心和同源可视化验收台，不再用页面美化、交互细修或包体小修补代替机制正确性与机器能力。
- 不建议把技能描述解析出的倍率当成精确时序。时序字段必须记录来源。
- AI 和静态资产解析不能替代运行时证据及产品可视化验收；搜索器不得把未验收角色或未闭环机制当成精确真值。
- 无头核心与 Workbench 必须共享同一 trace。任何为 CLI、优化器或 UI 单独维护的机制副本都会造成双真相，属于阻断问题。
- 不建议引入后端。当前项目定位仍适合纯前端，本地生成数据、导入导出和静态部署即可覆盖主要需求。
- 可以在新模块中优先引入更强类型和 schema；是否全量 TypeScript 化应在阶段 0 单独决定。

## 9. 每阶段验收规则

每个阶段结束时按验证目的检查：

```powershell
# 日常开发：只证明受影响范围
npm run test:smart

# 多分线最终集成：只建立一次联合 checkpoint
npm run test:full

# 最终 clean tracked HEAD：唯一正式发布证明
npm run release:verify
```

`npm run test:trial-release` 保持原命令、原覆盖和原强度，供 `release:verify` 真实调用；不得改为 smart cache。若 release 失败，先修复并运行失败来源对应的 targeted regression，然后直接重新运行完整 `release:verify`，不在两次 release 之间手工重复 full/audit/build/preview 全链。

同时维护：

- `PROJECT_MANUAL.md`：更新阶段状态。
- `DEVELOPMENT_PLAN.md`：勾勒下一阶段任务变化。
- 相关架构文档：数据结构或运行时有实质变化时同步更新。

## 10. M12-C 首个试点产品政策覆盖（2026-08-08，当前权威口径）

- 首个试点固定为角色与目标全程距离 0、投射物立即命中、无限 HP 静态 Boss、Boss 不攻击，且默认关闭韧性/击破/死亡截断。该合同由 `m12c-zero-distance-passive-boss-v1` 生成，policy hash 为 `967b0667f315db5b`；输入、canonical data/trace、build hash、Machine Axis、formal admission、cycle replay、trial release 与 Workbench 导入必须一致携带，缺失或漂移即在搜索前拒绝。
- 专用闪击/闪避/跃击/跳跃/下落/位移动作，以及完美闪避、完美格挡/招架、极限反击和任何依赖 Boss 主动攻击的反应动作，不进入正式候选面；来源 requirement、专属 hit/effect/window 保留并以 `m12c-zero-distance-passive-boss-out-of-scope` 生成结构化 N/A。手工/研究 runtime 保留，不回退既有实现。
- 角色候选由 `m12c-wind-thunder-mark-producer-roster-v1` 冻结，roster hash `a690b860f0967e3d`。正式分母改为 9 个优化对象：既有 `101010/103002/109001`，可在当前动作面主动生产 750/250 印记的 `102001/107001/107002/108003/112001`，以及统一 `STARBORN`。底层来源别名共 10 个；`199001/199002` 仍只合并成一个产品对象。
- 生产来源：`10200113` frame `211/216/220` 向 750 注入多层；`10700112@10`、`10700113@133` 含 depth=0 的 750 根；`10700212@90` 含独立 depth=0 的 750 根（不能与 `@82` 消费判断混淆）；`10800313` 与 `10800322@37` 含 250 根；`11200112@27` 含 250 根。
- `108001` 只有 150 生产根，750 仅存在于消费/overdrive 路径；`111001` 没有 250/750 生产根，仅通过 judgment 消费已有印记。两者以 `m12c-no-in-scope-wind-or-thunder-mark-production` 标为 `product-scenario-excluded`，保留源数据、手工 runtime 与覆盖清单，但不进入候选 roster、完整 character acceptance、optimization-ready 门禁或正式绑定矩阵。
- 因此末音签收后剩余普通角色为 5 个：`102001/107001/107002/108003/112001`；不开始下一个角色，先停在末音产品视觉签收点。奇波/灵子/装备/套装分母仍为 `43/62/137/12`，Kibo DNA 固定 `[]`；M12-C 与正式搜索继续锁定。

## 11. M12-B3-E21 套装技能收口（2026-08-08）

- `set-skill:3:4` 的正式文本“普攻命中后自身攻击力 +1%、12 秒、最多 10 层”与当前唯一可达控制图冲突。全量反查 212,053 份 SkillList JSON 与 14,779 个战斗元素，没有第二个 `19998005` 绑定，也没有该 ATK/12s/10 层精确签名；该文本按产品裁决登记为旧数据，不再驱动运行时。
- 当前可执行图为权威来源：`set-skill:3:2` 使自身 MAXHP +6.2%；四件套常驻根 `199999086` 使自身 MAXHP +2%；`199999022 -> 199999023` 在每 5 次 `AfterReceiveDamage` 后再给予自身 MAXHP +5%，以 Cover 语义保持。常驻 +2% 已进入静态装配运行时；受击分支来源已闭合，但在 `m12c-zero-distance-passive-boss-v1` 的 Boss 不攻击场景中结构化 N/A。
- 套装 N/A 不使用独立硬编码：证据、灵子/套装生成器和资格门禁共同绑定 scenario policy `967b0667f315db5b` 与 roster policy `a690b860f0967e3d`，政策漂移即 fail-closed。证据文件 `set-three-source-identity-evidence.json` 为 13,883B，SHA-256 `4649262068c0e4a4ff860b0a059d673072d9a180317daf7d764c0e9b4d453577`。
- 生成资格现为套装技能 `12/12 optimization-ready`、视觉目录 `254/254`；套装阻断清零。全局剩余 16 个唯一阻断均属于角色（1 个静态 profile、6 个验收未发布、9 个角色未 optimization-ready），因此 M12-C 与正式搜索仍锁定。
- E21 已完成；M12-C 前不再有套装机制任务。下一步仍是末音产品视觉签收、其余 5 名正式角色、STARBORN 统一对象、绑定矩阵与 trial-release/循环重放总门禁。

## 12. M12-B3-E20-2-109001-S3-R1 末音无头 parity 收口（2026-08-08）

- 产品打回的直接反例已经进入 canonical 与 Machine Axis 测试，而非修展示：非璀璨 A5 不再产生雷印记；璀璨 A5 在 47F 恰好 `+2`；A4 只判断璀璨、消费 `element 250`，成功后才生成一个 `element 296` 超限 packet，璀璨不被消费。旧 golden frame 547 的错误 `0→2` 与 frame 1029 的 `+1/-1`、璀璨 `1→0` 均消失。
- 通用编译链支持 `element_formula 102100` 的 `self.ELEMENT_LAYERS[M] > I` activation wrapper，并保持稳定 `sourceSequencePath`。A4 off+mark1、on+mark0/on+mark1/on+mark2、同一窗口连续两次消费、资源不足拒绝、8 秒右开到期/刷新/同帧排序、星鸣追击后紧接 A4 均由真实事务和 packet 数验证；Workbench 只显示实际应用事务，suppressed 声明不伪装成资源变化。
- 星决减冷却改为 accepted/executed 后才物化的一次性 transaction；`slot=-1` 在事件时解析正在冷却的目标，没有目标即消费且不预存。Charge 改为原生共享顺序计时器：`currentChargeCount + coolTime`，10900112 固定 15 秒；`t0/t1/t2/t6` 反例下一层在 t17，自然 t15/t30 顺序恢复，一次 Fixed -20 最多回一层。状态、timer、最后结算 identity 与 reset transaction identity 已进入 cycle boundary、search readiness 和 replay hash；普通单层技能与 Kibo cooldown 回归通过。
- 当前 109001 requirement `207`，required/pass/N/A/blocked=`138/138/69/0`，source/acceptance gap=`0/0`，non-blocking=`13`；成熟度保持 `runtime-integrated`，唯一 blocker 是 `acceptance-product-visual-signoff-pending`。真实闭合与产品政策 N/A 分开记账：251/252/253、buff/critical/主动窗口、璀璨与 Charge 为真实机制；102001093/反应动作面按 passive-boss policy N/A，799 按客户端孤儿 N/A。
- 当前资格分母 `9/43/62/137/12`，qualification source/roster/manifests/ledger/binding/catalog=`0a4b69e0716de917/a3edc962effdcba0/1cb4029bc8a8c91f/c70e8c978317e184/8d6ae083ad89db3b/4346c39d4d818730`，全局剩余 16 个 blocker 均为角色项。verified package=`ed65d281dc63732353605142ee3f8ebebd7329618def661d8477b48d266e6e7e`，文件 SHA-256=`1f3ed08b56ebf56c48ecf1f7909dbd537d172918253b0f6871b3048540f44aa0`。
- 当前执行边界不变：先等待末音产品视觉复验，不启动 108003、其他角色、STARBORN、E22、M12-C 或正式搜索；Kibo DNA 继续固定 `[]`。
- 验证已收口：串行 Vitest `192/192` 文件、`1472/1472` 用例；verified-combat/character-combat 生成器对拍、scenario/roster policy、character acceptance、visual acceptance、optimization qualification、production imports、Workbench data、action status、applied source bindings、Kibo headless 均 clean；production build 1878 modules 通过。

## 13. M12 优化器正式主指标合同重构（2026-08-08）

- 正式主指标固定为 `cycle-dps-no-toughness`、`cycle-dps-with-toughness`、`fastest-kill`，默认值为 `cycle-dps-no-toughness`。旧 `damage`、`burst`、`toughness` 仅保留为 `legacy-diagnostic`，不能进入 formal admission、trial release 或 M12-C。
- 无韧性循环使用无限 HP、权威等级与实际防御，关闭韧性、击破和死亡截断；有韧性循环使用无限 HP、实际防御/韧性/恢复/破韧规则；最快击杀使用实际 HP、防御、韧性与首次致死 cursor。三者均固定距离 0、目标静止且不攻击。
- `AzPrEnemyProfile` 严格绑定 enemyId、level、来源身份/hash、实际 HP/DEF/MDEF/元素防御/韧性与 break rules。等级成长由已合并的 enemy-level pipeline 提供，优化器不得补默认值或伪造档案。
- 当前可审计运行时按“破韧发生包使用 packet 前状态、同帧后续包按 canonical source sequence 读取已更新 broken、破韧结束右开且 state tick 先于 hit”结算。产品现批准该版本化无头 runtime 作为当前 formal-score 基线；客户端同帧与恢复顺序仍标记为 parity pending，未来证据若不一致必须升版合同并使受影响分数失效重算。
- batch/search/cycle/kill 统一统计 requested/effective healing、overhealing、effective HPS、settlement count，以及 source actor/action 贡献。护盾、suppressed 事件与生命伤害不混入治疗统计。
- objective、target policy、enemy profile 与 settlement contract 进入 canonical input/data/trace/build hash。M12-C 与正式搜索继续锁定，本阶段只收口合同与组合运行时。

## 14. M12-B3-E20-2-108003-S1 米蒂缩减动作面资格（2026-08-09，产品验收通过）

- 用户下发米蒂任务同时授权接受 109001 S3-R1。签收只通过生成器绑定到已集成提交 `4a5030a52bd51a118f579957bc449efa0c38cf3b`：末音已成为 `optimization-ready`，required/pass=`138/138`、blocker=`0`；没有手改汇总数字。
- 米蒂已发布完整 source inventory、profile、golden、acceptance recipe、Machine Axis fixture、scenario cases/matrix、ledger/manifest 与 Workbench 证据。来源共 `510` 个 identity；requirement=`225`，required/pass/N/A/blocked=`139/139/86/0`，source/acceptance gap=`0/0`，2 个场景与 `1035/1035` assertion 全通过。中央产品验收接受 `fdaad80c9839ac8c9768427a9f48b1dcd2138cee`，生成器已升级 maturity=`optimization-ready`、blocker=`[]`。
- 正式动作面真实闭合：普攻 `2/3/4` 箭；短蓄 `1+6`；普通满蓄 `1+12`；蓄电满蓄 `3+36`。派生闪电球逐父箭 landed 门控，全 miss 不产包。单 Boss 星决只结算可达 `5` 包，250 镜像引用只产生一次 `+2`；离场星携为 `11` 击/`12F` cadence，37F 的 `+2` 根只发生一次。
- 蓄电按 10 秒右开、刷新和一次合法重击消费；10800361 每次星鸣对三名队员各产生 10 个 1 秒 `+2 SP` tick，攻击 Buff 对三 actor 独立维持 24 秒；10800362 只在最后一击 landed 后给 source actor `+5 SP`。250 容器按共享上限 5、满层刷新、20 秒逐层衰减结算，未把声明或重复资源引用当成事务。
- scenario policy/roster policy 继续冻结为 `967b0667f315db5b / a690b860f0967e3d`；反应/位移/空中动作保留来源行并结构化 N/A，不进入候选轴。108003 Machine Axis input/data/trace/evaluation/build=`ff0e5cfeb6204398/9e1c2699347eea59/9f2b9badd29cf1f2/3c2fb1d6fda5e7b9/320ddf8446ee4c92`。
- M10 与 M12 状态分栏：`reports/m10/108003` 仍诚实保持完整通用档案的 `runtime-applied / partial / runtime-ready 7/10`，继续追踪全场景原生证据；M12 `optimization-ready` 仅表示 frozen passive-boss 缩减动作面 `139/139` required 行已闭合，另 `86` 行有来源 scenario N/A。不得用 M12 签收覆盖或篡改 M10 的 full-profile 未闭事实。
- 当前全局正式分母仍为 `9/43/62/137/12`，唯一 blocker=`13` 且全部为角色项；qualification source/roster/manifests/ledger/binding/catalog=`26db4986bce695fe/b3bb274e638433c1/f6aab7de4accdba6/3f1ee6e8e0af5ec4/6cba81d337120c35/b8810086de37175e`。M12-C/formal search 继续锁定，Kibo DNA=`[]`。
- 迭代期只运行一次 bounded `test:full`：首轮 `1511 passed / 16 failed`，失败均由聚焦复跑收口为 `242/242`，没有重复全量；中央独立复验另有核心 `11 files/190 tests`、Workbench DOM `108/108`、十项 assert-clean 与 production build 全绿。closeout 后停住等待中央集成，不开始下一角色。

## 15. M12-B3-OPT-T2 有韧敌人客户端原生结算证据（2026-08-08）

- TC 客户端静态证据已闭合单包顺序：普通/真实 HP output 先读取 packet 前 `inWeakState` 与 profile 属性 221 `WP_BREAK_DMGUP`，随后调用 `WeaknessPointChange/SetWeaknessPoint`，最后调用 `ChangeHP`。因此破韧发生包使用 pre-break 倍率；倍率来自敌人权威 profile，不硬编码 2 倍；pure toughness 路径不套 HP break multiplier。
- local-controlled WeakBreakSystem 以每次 update 的 deltaTime 推进 `m_curWeakTime/m_curWeakEndTime`，在 `>=` 边界转换，区间右开；remote-controlled 路径仅作 performance mirror。这也证明现 runtime 固定 100ms tick 与 local 路径存在已登记差异，但正式 passive boss 的权威 local/remote/network 路径尚未闭合，不能据此改成另一条猜测路径。
- 通用 runtime 已把普通/调谐 packet 修为“pre-break 计算 HP output → 韧性/破韧状态 → HP”，并将顺序投影到 canonical/cycle/kill hash。没有 enemyId/actionId 特判；无韧目标仍完全不产生 toughness/broken 状态。
- `runtime-capture` v3 已准备同帧单调序列与状态前后 hook。当前环境没有运行中的获准客户端进程，且工具禁止自动启动/附加/绕过反作弊，所以没有伪造 capture。
- 截至 OPT-T2，该批 blocker 尚未解除：同帧多 DamageElement 的刚破韧状态可见性、break 结束帧 state update/hit phase、致死包后同队列尾包以及正式场景 authoritative execution path 均记录为 evidence `leavesOpen`。后续产品政策已将“当前 formal-score 可用性”与“客户端 parity 是否闭合”拆分，见第 16 节。

## 15. M12-B3-OPT-T3 有韧敌人 controlled capture 预检（2026-08-09）

- 本机绑定 TC GameAssembly/dump/script 的 bytes 与 SHA-256 全部匹配 manifest v3，但预检未发现运行中的 `AzurPromilia.exe`。capture policy 禁止自动启动、自动附加或绕过反作弊，因此未生成、补写或推断任何客户端记录。冻结 blocked preflight 为 `reports/m12/m12-b3-enemy-toughness-controlled-capture-preflight-20260809.json`（4,732 bytes，SHA-256 `ac6c3b9014540668a83c06d162139227ee1f9d6c776983c21ea84f45d0f757bb`）。
- capture agent/host 现为每个 DamageElement、嵌套来源路径和每次 hook 调用生成稳定 identity，并记录全局单调 sequence、客户端 frame/deltaTime/thread。唯一 session-end 汇总 agent/host 数量、最终 sequence、未清线程栈和 diagnostics。
- production audit 对丢包、重复 hook、entry/exit 不完整、线程切换、帧号缺失、缺 session-end 或 agent diagnostic 全部 fail closed；normalizer v3 输出逐字节可重复、移除本机 PID/模块路径/加载基址与输入绝对路径，并绑定原始 JSONL 精确 bytes/hash。self-test 与 synthetic fixture 只能验证工具，不能关闭客户端 blocker。
- 112001 消费接口要求同一 eventIdentity/sourceSequencePath 下观测 damage/overlimit 单包顺序、191F wrapper、128F watcher、权威 break cursor 与 observer-active-at-break；没有真实动作时只接受带等价调用链证明的探针。目前这些观察均未执行。
- 下一步需要 operator 手动启动并登录绑定 TC 客户端、进入 0 距离静止不攻击 Boss 场景、准备 112001 或有调用链证明的等价 probe，再提供 PID 并显式确认本次受控 attach。随后执行破韧、同帧后续包、break-end 边界和有限 HP 致死尾包探针。
- 四条动态 `leavesOpen` 尚未闭合；该 preflight 产物仍如实记录当时的 evidence gate 状态，不能冒充真实 capture。后续 runtime-baseline formal-score 产品政策不改变这份历史证据，也不解锁 M12-C。

## 16. M12-B3 优化器 runtime-baseline formal score（2026-08-09）

- `m12-enemy-settlement-runtime-v2` 将 formal scoring 与客户端 parity 分为两条状态：`formalScoring.formalReady=true`、`scoreAuthority=formal-for-current-runtime-contract`，同时 `evidence.clientParityReady=false` 并保留 controlled-capture pending warning。
- 有韧循环只在两轮 replay 与敌人韧性/break/recovery 相位严格闭合后输出 `formalScore=loopHpDamage/loopDurationSeconds`；最快击杀只在真实首次致死 cursor 存在时输出精确 TTK formal score。默认调用不再需要内部 `allowUnverifiedRuntimeTiming` 开关。
- 当前 score 冻结使用现有无头语义：fixed 100ms weakness tick、breaking packet 读取 pre-break、同帧后续包按 canonical source sequence、break end 右开且 tick-before-hit。正式场景执行路径按产品决定选 `local-controlled`，但未声称 fixed 100ms 已与客户端 local per-update deltaTime 达成 parity。
- 首次致死 cursor 是 fastest-kill 的评分截止点；其后的 HP/韧性尾包只作诊断，不改变 kill 可行性或 TTK。现 runtime 仍主动截断尾包，但客户端尾包处置不再是 formal-score blocker。
- 客户端 capture 若证明任一评分相关顺序不同，必须创建新 settlement contract，旧合同下受影响的 formal scores 全部失效并重算。当前未运行正式优化；M12-C、角色/资格总门和 trial-release 总门继续锁定。
