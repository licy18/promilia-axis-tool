# 蓝色星原战斗排轴编辑器 - 项目架构文档

## 1. 项目概述

### 1.1 项目简介

蓝色星原战斗排轴编辑器是一个用于规划和分析游戏战斗策略的工具，支持技能排轴、伤害计算、循环验证等功能。

### 1.2 技术栈

- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **状态管理**: Pinia
- **UI 组件库**: Element Plus
- **图表库**: ECharts
- **国际化**: Vue I18n
- **路由**: Vue Router
- **拖拽功能**: VueDraggable
- **样式预处理器**: SCSS

## 2. 目录结构

```
src/
├── components/          # 组件目录
│   ├── editor/          # 编辑器相关组件
│   │   ├── GuideTour.vue        # 新手引导组件
│   │   ├── SkillEditPanel.vue   # 技能编辑面板
│   │   ├── SkillLibrary.vue     # 技能库组件
│   │   ├── StatPanel.vue        # 统计面板组件
│   │   └── ValidatePanel.vue    # 验证面板组件
│   ├── datamanage/      # 数据管理组件（预留）
│   └── timeline/        # 时间轴相关组件
│       ├── BuffBlock.vue        # Buff块组件
│       ├── Keyframe.vue         # 关键帧组件
│       ├── LinkLine.vue         # 技能连携线组件
│       ├── ResourceBlock.vue    # 资源变化块组件
│       ├── ResourceCurve.vue    # 资源曲线组件
│       └── SkillBlock.vue       # 技能块组件
├── i18n/               # 国际化文件
│   ├── locales/         # 语言包
│   │   ├── en-US.json   # 英文语言包
│   │   └── zh-CN.json   # 中文语言包
│   └── index.js         # 国际化配置
├── router/             # 路由配置
│   └── index.js         # 路由定义
├── data/               # 新版真实 AzPr 数据访问层
│   ├── generated/       # 由 npm run data:generate 生成的拆表数据
│   └── azprGenerated.js # 生成数据访问入口
├── domain/             # 新版项目领域模型
│   ├── fixtures/        # 真实数据垂直切片 fixture
│   └── projectSchema.js # Project / Actor / Enemy / Action schema
├── features/           # 新版功能模块组件
│   └── workbench/       # 阶段 4 新版工作台分区组件
├── simulation/         # 新版无 UI 模拟运行时
│   ├── compiler/        # Project -> Scenario
│   ├── engine/          # Scenario -> EventLog
│   ├── mechanics/       # 机制与公式
│   ├── projection/      # EventLog -> UI/分析投影
│   └── index.js         # 运行时入口
├── store/              # Pinia 状态管理
│   ├── gamedata.js      # 游戏数据存储
│   ├── history.js       # 历史记录存储
│   ├── project.js       # 项目数据存储
│   └── setting.js       # 全局设置存储
├── styles/             # 样式文件
│   ├── index.scss       # 主样式文件
│   ├── reset.scss       # 重置样式
│   └── theme.scss       # 主题样式
├── utils/              # 工具函数
│   ├── common.js        # 通用工具函数
│   ├── constants.js     # 常量定义
│   ├── damageCalc.js    # 旧原型伤害计算；新版逻辑逐步迁移到 simulation/
│   ├── statCalc.js      # 统计计算工具
│   └── validate.js      # 循环验证工具
├── views/              # 页面组件
│   ├── DataEditor.vue   # 数据编辑器页面
│   ├── Editor.vue       # 主编辑器页面
│   ├── Guide.vue        # 使用教程页面
│   ├── Handbook.vue     # 游戏图鉴页面
│   ├── Home.vue         # 首页
│   ├── Preset.vue       # 预设轴库页面
│   ├── Workbench.vue    # 新版工作台入口
│   └── Setting.vue      # 设置页面
├── App.vue             # 根组件
└── main.js             # 入口文件

public/
├── gamedata/           # 游戏数据
│   └── gamedata.json    # 游戏数据配置文件
└── avatars/            # 角色头像
```

### 2.1 新版重构主线

当前重构目标不是继续加厚旧 `Editor.vue`，而是建立以下链路：

```text
C:\PC2\Codex\AzPr
  -> scripts/generate-azpr-data.mjs
  -> src/data/generated/
  -> src/data/azprGenerated.js
  -> src/domain/projectSchema.js
  -> src/simulation/compiler/compileProject.js
  -> src/simulation/engine/simulateScenario.js
  -> src/simulation/projection/projectSimulationResult.js
  -> 新版编辑器工作台
```

当前已完成：

- 阶段 1：真实 AzPr 数据管线。
- 阶段 2：最小项目领域模型和第一条真实数据 fixture。
- 阶段 3：无 UI 最小模拟运行时。
- 阶段 4-1：新版工作台只读第一屏。
- 阶段 4-2：新版工作台最小可编辑能力。
- 阶段 4-3：新版工作台多动作最小交互。
- 阶段 4-4A：新版工作台时间轴动作拖动/吸附。
- 阶段 4-4B：新版工作台草稿保存/恢复。
- 阶段 4-5：新版工作台动作复制、快捷删除、键盘微调和草稿脏状态。
- 阶段 4-6：新版工作台动作工具箱雏形，支持技能、等待、注释三类动作和非伤害事件日志。
- 阶段 4-7：新版工作台敌人与资源面板雏形，敌人参数进入项目模型，资源面板读取 simulation 投影。
- 阶段 4-8：新版工作台资源事件和敌人事件动作，资源事件进入 `resourceTimeline`，敌人事件进入事件日志。
- 阶段 4-9：新版工作台切人动作和多角色 actor 雏形，默认主/副角色 actor、`SWITCH` 事件和切人属性编辑已进入统一链路。
- 阶段 4-10：新版工作台时间轴角色轨道雏形，动作和伤害 marker 按 actor 或系统轨显示。
- 阶段 4-11：新版工作台时间轴缩放和动作持续时间调整雏形，`durationMs` 通过工作台草稿链路回写。
- 阶段 4-12 至 5-8AT：已继续补齐轨道诊断、动作形态、60fps 帧时间轴、公式分层、战斗公式证据、skill asset 候选索引、每动作 HP/韧性/能量三值结果契约、`skill_control` 效果轨道候选分类、本地行为链解引用、elementBaseDatas 资源映射归属、行为脚本类型候选、IL2CPP element 类型目录、外部 element 对象本体解析、`TDamageElementParams` 三值字段候选映射、Workbench 三值来源展示、`valueParam` / `formulaParamValues` 槽位关系诊断、未应用公式槽位候选展示、`function_1/function_2 -> element_formula` 候选证据索引、动作级 `formulaFunctionSummary` 展示、`formulaCandidatePreview` 未应用数值预览、`combinationPreviews` 简单组合诊断矩阵、`formulaCandidatePatternSummary` 跨动作差异模式摘要、`skillControlBehaviorCorrelations` 技能级行为节点关联摘要、按 lane 保留的 HP 行为链样本、动作形态级行为绑定候选、`stateTimingEvidence` 状态/时序控制证据、EventBridge 目标技能 skill_control 摘要、普攻连段链递归索引、普通攻击多段 / 每 hit 候选、`actionResultTimeline[].hitCandidates[]` per-hit 三值候选预览、顶层 `candidateValueSeries` 三曲线候选聚合、`candidateValueSeries.chart` 60fps 多曲线图表层、基于 EventBridge 的普攻连段绝对帧候选、主时间轴候选三值 marker、主时间轴候选多曲线轨/按帧提示、候选曲线显隐/选中帧来源摘要、chart point 级详情下钻/选中帧范围过滤、per-element 原始字段详情、per-element 公式函数/等级槽位摘要、per-element 横向比较区/tooltip、`formulaExecutionEvidenceMatrix` 公式执行证据矩阵、`formulaExecutionMatrixSummary` 跨动作矩阵摘要、`hitBindingGapSummary` 缺口动作 skill_control 候选摘要、`hitBindingGap.externalElementBinding` 非普攻外部 DamageElement 候选桥接、`hitBindingGap.elementSourceAlignment` action-level 与 skill_control element 来源差异摘要、`skillLevelBridge.relatedElementLevelBridge` 关联等级链候选、`runtimeParameterSourceEvidence` 运行时参数来源候选、`runtimeApplicationTraceEvidence` 三值运行时应用入口候选、`nativeMethodSymbolEvidence` 原生方法符号/方法体缺口证据，以及 actor/action/series 组合过滤入口与多动作组件级验证。

下一阶段：

- 阶段 5-8AU：围绕 `FormulaUtility.GetOutputDamage/GetOutputWeaknessDamage/WeaknessPointChange`、`DamageElement.RecoverSP`、`SPSystem.OnTransmit/RecoverSP` 等目标 RVA 生成或导入方法体级证据，确认 `formulaParamValues`、`skillsub_ele_value.valueParam`、`weakBreakDamageRate`、`recoverSP/petRecoverSP/recoverInterval` 的实际应用顺序和单位。

## 3. 核心模块设计

### 3.1 编辑器核心 (Editor.vue)

- **功能**: 主编辑器页面，集成所有核心功能
- **职责**:
  - 时间轴渲染与交互
  - 技能库管理
  - 统计面板显示
  - 验证面板显示
  - 快捷键处理
  - 撤销/重做功能

### 3.2 伤害计算引擎 (damageCalc.js)

- **功能**: 计算技能伤害和相关属性
- **状态**: 旧原型兼容层。新版运行时入口是 `src/simulation/`，当前第一版只输出低置信度原始伤害投影，后续真实 AzPr 公式应进入 `src/simulation/mechanics/`。
- **核心函数**:
  - `calcBaseDamage()`: 计算基础伤害
  - `calcAttack()`: 计算攻击力区
  - `calcDamageBonus()`: 计算增伤区
  - `calcCritDamage()`: 计算暴击区
  - `calcResistance()`: 计算抗性区
  - `calcLevelPenalty()`: 计算等级压制区
  - `calcToughnessCrit()`: 计算韧性暴击区
  - `calculateSkillDamage()`: 计算技能总伤害

### 3.3 循环验证系统 (validate.js)

- **功能**: 验证排轴的合法性
- **核心函数**:
  - `validateCDConflict()`: 验证CD冲突
  - `validateResource()`: 验证资源合法性
  - `validateDependency()`: 验证技能依赖
  - `validateAction()`: 验证动作合法性
  - `validateTimeline()`: 验证整个时间轴

### 3.4 统计计算工具 (statCalc.js)

- **功能**: 计算排轴的统计数据
- **核心函数**:
  - `calculateTotalTime()`: 计算总时长
  - `calculateTotalDamage()`: 计算总伤害
  - `calculateAverageDPS()`: 计算平均DPS
  - `calculatePeakDPS()`: 计算爆发峰值DPS
  - `calculateTotalToughnessDamage()`: 计算总削韧值
  - `calculateBuffUptime()`: 计算Buff覆盖率
  - `calculateCooldownUtilization()`: 计算CD利用率
  - `calculateResourceOverflow()`: 计算资源溢出率
  - `calculateAllStats()`: 计算所有统计指标

### 3.5 状态管理 (store/)

- **project.js**: 项目数据管理
- **gamedata.js**: 游戏数据管理
- **history.js**: 历史记录管理
- **setting.js**: 全局设置管理

## 4. 数据流设计

### 4.1 项目数据流程

1. **项目创建**: Home.vue → projectStore.createProject() → 存储到localStorage
2. **技能添加**: SkillLibrary.vue → Editor.vue → projectStore.addSkillBlock() → 存储到项目数据
3. **伤害计算**: Editor.vue → damageCalc.js → 计算结果 → StatPanel.vue 显示
4. **循环验证**: Editor.vue → validate.js → 验证结果 → ValidatePanel.vue 显示
5. **历史记录**: Editor.vue → historyStore.recordSkillBlockAction() → 存储操作历史
6. **项目保存**: Editor.vue → projectStore.saveProject() → 存储到localStorage

### 4.2 状态管理流程

```
用户操作 → 组件事件 → Store Action → 状态更新 → 组件重新渲染
```

## 5. 组件层次结构

```
App.vue
├── Home.vue
├── Editor.vue
│   ├── SkillLibrary.vue
│   ├── SkillBlock.vue
│   ├── BuffBlock.vue
│   ├── ResourceBlock.vue
│   ├── Keyframe.vue
│   ├── LinkLine.vue
│   ├── ResourceCurve.vue
│   ├── SkillEditPanel.vue
│   ├── StatPanel.vue
│   ├── ValidatePanel.vue
│   └── GuideTour.vue
├── DataEditor.vue
├── Preset.vue
├── Guide.vue
├── Handbook.vue
└── Setting.vue
```

## 6. 核心功能实现

### 6.1 技能排轴

- **实现**: 通过 SkillBlock 组件和拖拽功能
- **流程**: 从技能库拖拽技能到时间轴 → 计算位置和时长 → 添加到项目数据
- **交互**: 支持拖拽移动、调整时长、点击选择

### 6.2 伤害计算

- **实现**: damageCalc.js 中的计算函数
- **流程**: 遍历技能 → 计算每个技能伤害 → 汇总统计数据
- **特点**: 支持全乘区计算、印记体系、韧性机制、DOT伤害

### 6.3 循环验证

- **实现**: validate.js 中的验证函数
- **流程**: 逐帧检查时间轴 → 检测冲突和问题 → 生成验证报告
- **特点**: 支持CD冲突、资源不足、技能依赖、动作冲突验证

### 6.4 统计分析

- **实现**: statCalc.js 中的统计函数
- **流程**: 分析时间轴数据 → 计算各项指标 → 生成统计报告
- **特点**: 支持总伤害、DPS、Buff覆盖率、CD利用率等多维度统计

### 6.5 可视化

- **实现**: ResourceCurve.vue 和 LinkLine.vue
- **流程**: 数据处理 → ECharts 渲染 → 交互处理
- **特点**: 支持资源曲线、技能连携线、实时数据更新

### 6.6 导入导出

- **实现**: project.js 中的序列化/反序列化函数
- **流程**: 数据序列化 → 文件下载/上传 → 数据解析
- **特点**: 支持 .promilia 格式、Markdown 报告、JSON 源文件

### 6.7 新版工作台动作模型

- **主链路**: `actionDrafts` → `Project.actions` → `compileProject()` → `runSimulation()`。
- **技能动作形态**: `skillLevel.name/value` 解析为 `actionVariants`，用于表达 `普攻`、`重击`、`闪击`、`跃击` 等独立动作形态。
- **动作库目录**: Workbench 主动作库按 Endaxis 风格展示固定动作：`普通攻击`、`重击`、`闪击`、`跃击`、`星鸣技`、`星结合击`、`星决技`、`星携技`、`极限反击`、`完美招架`；被动技能不作为动作库条目。
- **时间基准**: Workbench 使用 `src/domain/timebase.js` 统一到 60fps 的 1 帧网格，新增动作、拖动吸附、持续时间和批次快捷偏移都按帧对齐。
- **普攻段数**: 从技能描述 `【普通攻击】` 中解析，例如 `进行至多五段的普通攻击`；当前只记录总倍率和段数，不编造每段倍率。
- **公式分层**: `damageTimeline[].formulaBreakdown` 将当前攻击和动作形态倍率标记为已应用层，将敌人防御、抗性、暴击、增伤标记为未应用层。
- **动作三值结果**: `actionResultTimeline[]` 是新版模拟结果主入口，每个动作都必须同时输出 `hpDamage`、`toughnessDamage`、`selfEnergyChange`。三槽均可携带 `sourceEvidence`，用于追踪 `damageElementFieldMappingEvidence` 候选字段来源；HP 伤害 source 还会携带 `formulaSlotAlignmentSummary`、`formulaFunctionSummary`、`formulaCandidatePreview`、`combinationPreviews`、`formulaExecutionEvidenceMatrix` 和 `actionLevelElementSource` 等未应用公式候选/预览/执行证据矩阵。顶层 `summary.formulaExecutionMatrixSummary` 会把这些矩阵按 action / element 聚合，用于跨动作观察缩放范围和 hit 绑定覆盖，并通过 `hitBindingGapSummary` 把缺 hit 绑定的动作形态对齐到 skill_control 最高置信度行为候选。缺口动作的 `hitBindingGap.externalElementBinding` 会继续按 PathID 查外部 element 对象和 `TDamageElementParams` 字段映射，`hitBindingGap.elementSourceAlignment` 会对比 action-level 矩阵 element 与 skill_control 外部 DamageElement 是否同源，`skillLevelBridge.relatedElementLevelBridge` 会记录直连缺失时的关联技能等级链候选，`runtimeParameterSourceEvidence` 会把 source subSkill、外部 DamageElement、关联 skill slot 和 IL2CPP 签名锚点合并成运行时参数来源候选，`runtimeApplicationTraceEvidence` 会把 HP、削韧、自身能量三条曲线的 IL2CPP 入口和数据载体分链记录，并通过 `nativeMethodSymbolEvidence` 记录目标入口的原生地址/签名/字段布局和方法体缺口；当前这些层只作为证据，不改变最终三值计算。普通攻击动作还会输出 `hitCandidateSummary` / `hitCandidates[]`，按 60fps 帧点保留每 hit 的 HP、削韧、自身能量候选字段，并会把每 hit 字段候选与动作级同 element 的公式函数、`skillsub_ele_value` 等级槽位摘要合并到 `candidateValueSeries.chart.points[].elementDetails[]`。HP 伤害、削韧和自身能量变化是三条独立公式链，不能只用伤害公式推导另外两项。
- **公式证据**: `src/data/generated/combat-formula-evidence.json` 记录敌人属性链、元素减免字段、弱点倍率字段和 `element_formula` 公式行；当前没有 `elementId -> element_formula.id` 直接匹配。敌人防御/抗性层的 `source` 已引用该证据索引，但仍保持 `applied: false`。
- **技能资源证据**: `src/data/generated/skill-asset-evidence.json` 记录 `skillBytesPath` 表格引用、`C:/PC2/Codex/AzPr` 技能资源缺口、`C:/Codex/AzPr Extractor` 的 `SkillList/skill_control_*.asset` 匹配结果、MonoBehaviour 节点样本、`effectLaneCandidateSummary` / `effectLaneCandidates` 效果轨道候选分类、`behaviorReferenceSummary` / `effectLaneBehaviorChains` 本地行为链解引用、`skillResourceMapEvidence` / `resourceMapMatches` 资源映射归属、`scriptTypeCandidate` 行为脚本类型候选、`stateTimingEvidence` 状态/时序控制证据、递归 `eventBridgeTargetSkillControlEvidence` 目标技能 skill_control 摘要、`normalAttackChainCandidate` 普攻连段链候选、`normalAttackHitChainCandidate` 普通攻击多段 / 每 hit 候选、每段 hit 的 `behaviorList -> elementBaseDatas -> TDamageElementParams` 三值字段候选、`elementTypeCatalogEvidence` IL2CPP element 类型候选目录、`externalElementObjectEvidence` 外部 element 对象本体摘要、`damageElementFieldMappingEvidence` 三值字段候选映射、`formulaParamAlignment.parameterSummaries` 槽位关系诊断，以及 `hpDamage.formulaFunctionEvidence` 的 `function_1/function_2 -> element_formula` 候选公式行；仿真层会把其中的技能级 HP 行为节点、状态/时序摘要、普攻链候选和每段 hit 候选接入 `formulaCandidatePatternSummary.skillControlBehaviorCorrelations`，Workbench 可显示 `命中候选 5/5段` 与 `三值候选 5/5段`，但当前仍不能视为已应用最终公式。
- **兼容字段**: `damageSegmentIndex`、`damageSegments`、`selectedDamageSegment` 暂时作为旧命名兼容层；新逻辑优先使用 `actionVariantIndex`、`actionVariants`、`selectedActionVariant`。
- **当前边界**: 动作形态倍率可用于 raw HP 投影；`skill_control` 已能给出候选帧范围、节点样本、HP/韧性/能量等轨道候选分类、本地行为对象链、外部 element 引用的资源映射归属、脚本类型候选、状态/时序控制证据、EventBridge 目标技能摘要、普通攻击 1-5 段 hitGroup、每段外部 element 引用和 `TDamageElementParams` 三值候选字段、动作结果 sourceEvidence、逐 hit 候选预览，以及 Workbench 可见的公式函数候选、候选预览、组合诊断、主时间轴候选曲线筛选、选帧摘要、chart point 级详情下钻、per-element 原始字段贡献、per-element `f1/f2 + A/G` 槽位关系、横向比较区、执行矩阵摘要和跨动作矩阵摘要。当前 f2 等级值预览为 307，约为 raw HP 12461 的 2.5%；简单加乘组合仍需约 `×40.6` 才接近 raw，`formulaExecutionEvidenceMatrix` 已把该缺口按 element / hit / action 固化为未应用 diagnostics；四动作 `formulaExecutionMatrixSummary` 进一步显示缩放约 `×2.5-×40.6`，且只有普攻 2/8 行存在 hit 绑定，`hitBindingGapSummary` 已确认重击/闪击/跃击都有 `攻击碰撞 / Skill0_6 / subSkill 109001011` 最高置信度候选，并已通过 `externalElementBinding` 追到 `109001251 / ast_109001251 / TDamageElementParams` 三值字段；`elementSourceAlignmentSummary` 已确认 action-level/matrix element `109001081 / 109001306` 与 skill_control 外部 damage element `109001251` 没有重叠；`relatedElementLevelBridge` 已确认 `109001251` 存在 `10900125 / slot 207` 的 12 行 A/G 等级链候选；`runtimeParameterSourceEvidence` 已把 `Skill0_6/subSkill 109001011/hitEffects`、`109001251`、`10900125/slot 207` 和 IL2CPP 签名锚点合并为 `参数来源候选 3/3`；`runtimeApplicationTraceEvidence` 已把 HP 的 `DamageElement + FormulaUtility + OutputDamageData`、削韧的 `GetOutputWeaknessDamage + WeakBreakSystem`、充能的 `RecoverSPArgs + SPSystem` 固化为 `应用入口候选 3/3`；`nativeMethodSymbolEvidence` 已确认 27 个目标 IL2CPP 原生入口可定位到地址/签名并显示 `原生入口 3/3`。普通攻击 5 段均有三值字段候选并已输出 `hitCandidates[]`，但真实每 hit 倍率、削韧单位、充能归属、取消窗口、重击/闪击/跃击 hit 绑定、`109001251` 的运行时参数应用规则、function 组合顺序、等级覆盖应用点和完整公式仍需继续验证 `skillsub_ele_value` / `element_formula` / 角色面板 / 敌方属性链 / 目标 RVA 方法体。

## 7. 扩展指南

### 7.1 添加新角色

1. 在 `public/gamedata/gamedata.json` 中添加角色数据
2. 确保角色数据包含完整的技能信息
3. 重新启动开发服务器

### 7.2 添加新敌人

1. 在 `public/gamedata/gamedata.json` 中添加敌人数据
2. 包含敌人的抗性、韧性、机制等信息
3. 重新启动开发服务器

### 7.3 添加新功能模块

1. 在 `src/components/` 中创建新组件
2. 在 `src/utils/` 中添加相关工具函数
3. 在 `src/store/` 中添加状态管理
4. 在 `src/views/` 中添加页面组件
5. 在 `src/router/index.js` 中添加路由

### 7.4 扩展伤害计算

1. 在 `src/utils/damageCalc.js` 中添加新的计算函数
2. 更新 `calculateSkillDamage()` 函数以包含新的计算逻辑
3. 确保与现有计算流程兼容

### 7.5 扩展验证规则

1. 在 `src/utils/validate.js` 中添加新的验证函数
2. 更新 `validateTimeline()` 函数以包含新的验证规则
3. 在 `src/components/editor/ValidatePanel.vue` 中添加相应的显示逻辑

## 8. 维护建议

### 8.1 代码规范

- 遵循 ESLint 和 Prettier 规范
- 使用 JSDoc 注释核心函数
- 保持代码风格一致

### 8.2 性能优化

- 使用 Vue 3 的 Composition API
- 合理使用 computed 和 watch
- 避免不必要的重渲染
- 对大型计算使用缓存机制

### 8.3 数据管理

- 所有游戏数据通过 `gamedata.json` 配置
- 避免硬编码游戏数值
- 使用常量管理魔法数字

### 8.4 测试建议

- 测试不同角色的技能组合
- 测试大型排轴的性能
- 测试导入导出功能
- 测试各种边界情况

### 8.5 部署建议

- 使用 `npm run build` 构建生产版本
- 确保 `public/gamedata/gamedata.json` 包含最新数据
- 配置适当的服务器缓存策略

## 9. 常见问题与解决方案

### 9.1 技能库不显示技能

- **原因**: 游戏数据未加载或角色ID不匹配
- **解决方案**: 检查 `gamedata.json` 文件，确保角色数据正确

### 9.2 伤害计算不准确

- **原因**: 技能参数配置错误或计算逻辑问题
- **解决方案**: 检查技能参数，调试 `damageCalc.js` 中的计算逻辑

### 9.3 验证结果错误

- **原因**: 验证逻辑问题或时间轴数据错误
- **解决方案**: 检查 `validate.js` 中的验证逻辑，确保时间轴数据正确

### 9.4 性能问题

- **原因**: 大型排轴或复杂计算
- **解决方案**: 优化计算逻辑，使用缓存，考虑分页加载

### 9.5 导入导出失败

- **原因**: 文件格式错误或数据结构不兼容
- **解决方案**: 检查文件格式，确保数据结构符合要求

## 10. 版本历史

| 版本  | 日期       | 主要变更                                   |
| ----- | ---------- | ------------------------------------------ |
| 1.0.0 | 2026-03-25 | 第三阶段完成，添加统计计算、常量管理等功能 |
| 0.2.0 | 2026-03-20 | 第二阶段完成，核心功能实现                 |
| 0.1.0 | 2026-03-15 | 第一阶段完成，基础架构搭建                 |

## 11. 未来规划

### 11.1 功能扩展

- 支持更多游戏机制
- 添加队伍配置界面
- 实现更复杂的AI分析
- 支持多人协作编辑

### 11.2 技术升级

- 迁移到 TypeScript
- 优化构建流程
- 改进响应式设计
- 添加单元测试

### 11.3 数据管理

- 实现在线数据同步
- 添加用户账号系统
- 支持数据备份和恢复
- 建立社区分享平台

---

**文档版本**: 1.1.0
**最后更新**: 2026-07-08
**维护者**: 开发团队
