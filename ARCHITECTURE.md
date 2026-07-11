# promilia-axis-tool 当前架构

最后更新：2026-07-11

## 1. 架构目标

项目采用“真实数据、版本化领域模型、无 UI 模拟运行时、Workbench 投影”的主链路。Endaxis 用于参考功能组织与交互，不作为蓝色星原数据或公式来源。

核心约束：

- UI 不直接读取原始游戏表，也不成为战斗机制事实标准。
- 每个排轴动作统一进入 `Action -> Hit -> ThreeValueDelta` 生成入口。
- 敌人 HP、敌人韧性和每名角色自身能量是三条独立状态链。
- 公式、实测样本、候选证据和占位结果必须保留来源与状态，不能互相冒充。
- 项目文件、预设库、采样文件和生成数据都必须版本化并可验证迁移。

## 2. 生产入口

`src/views/Workbench.vue` 是唯一生产排轴工作台：

```text
/
/editor
  -> /workbench

/preset
  -> /workbench?presets=1
```

未知旧路由也会回到 Workbench。旧 `Home.vue`、`Editor.vue`、`Preset.vue`、editor/timeline 组件、旧项目 store 和旧计算工具已经按生产引用审计退出代码库。

## 3. 分层结构

```text
C:\PC2\Codex\AzPr
  -> scripts/generate-azpr-data.mjs
  -> src/data/generated/
  -> src/data/azprGenerated.js
  -> src/domain/workbenchProjectFactory.js
  -> src/domain/projectSchema.js
  -> src/simulation/compiler/compileProject.js
  -> src/simulation/engine/simulateScenario.js
  -> generation / mechanics / runtime / projection
  -> src/features/workbench/
  -> src/views/Workbench.vue
```

### 3.1 数据层

- `scripts/generate-azpr-data.mjs`：从本地 AzPr 工作区生成标准拆表数据和来源审计。
- `src/data/generated/`：角色、技能、敌人、属性、装备、奇波、灵子、公式证据和 Workbench seed。
- `src/data/azprGenerated.js`：组件和领域层使用的访问入口，隔离生成 JSON 的具体结构。
- `workbench-seed.json` v2：生产 Workbench 的完整可选目录精简投影；领域工厂不再同步引入完整敌人、装备、奇波、魂灵表。
- `workbench-skill-core.json` v1：首轮模拟需要的技能逻辑、等级交叉校验和 valueParam 生产投影。
- `workbench-skill-diagnostics.json` v1：Skill Control、DamageElement、外部对象和召唤目标候选证据；通过动态入口在运行复盘或实测采样恢复时加载，不进入 Workbench 首轮 chunk。

### 3.2 领域层

- `projectSchema.js`：`Project`、`Actor`、`Enemy`、`Action`、`ActionRelation` 与 `CycleBoundary` 主合同。
- `initialRuntimeState.js`：循环边界继承的敌人三值、角色能量和活动效果起始状态合同。
- `workbenchProjectFactory.js`：把 Workbench 选择、培养配置和动作草稿组装为标准项目。
- `workbenchActionRelations.js`：动作前后关系的规范化、无环校验、间隔同步与删除清理。
- `workbenchDraftStorage.js`：v13 草稿、项目 JSON 和分享链接。
- `workbenchConfigurationLibrary.js`：角色/敌人配置实例库、方案选择、旧项目迁移和活动配置解析。
- `workbenchScenarioWorkspace.js`：最多 14 条完整方案快照的规范化、切换和迁移。
- `workbenchPngProject.js`：PNG 项目元数据写入与回读。
- `workbenchPresetStorage.js`：v1 本地预设库，复用完整 Workbench 项目快照。
- `workbenchRuntimeSampleCapture.js`：外部 capture 文件解析、绑定、去重和项目持久化。

### 3.3 编译与执行层

- `compileProject.js`：把项目模型编译为模拟场景，UI 状态不进入编译合同。
- `actionExecutionPlan.js`：统一决定动作正常执行、条件待确认或确定跳过。
- `simulateScenario.js`：构建事件、执行计划和模拟输出。
- `actionRuleDiagnostics.js`：冷却、充能次数和动作可执行性诊断。
- `effectRuntimeTimeline.js`：效果命令、继承效果、持续时间、层数和目标的运行时轨道。

### 3.4 三值生成层

`src/simulation/generation/` 把动作和命中转换为标准三值 delta：

```text
Action
  -> Hit
    -> hpDamage
    -> toughnessDamage
    -> selfEnergyChange
```

`threeValueGenerationLayer.js` 负责合并已应用、候选、实测和占位层；`threeValueGenerationBuilder.js` 负责稳定输出生成合同。证据字段只用于追溯和诊断，不允许绕过 calculator adapter 直接修改运行时状态。

### 3.5 机制 adapter

- `threeValueCalculatorAdapters.js`：projection 与 runtime 共用的 calculator 入口。
- `threeValueMechanismContext.js`：角色、动作、敌人和来源上下文。
- `threeValueMechanismConfiguration.js`：把 Project 已解析配置与 v13 实例身份编译为 mechanics configuration，声明字段应用边界。
- `threeValueMechanicsAdapter.js`：三轨统一 adapter 注册表、结构化 operands、generation request 与 runtime invocation input。
- `threeValueMechanicsProfile.js`：Scenario 绑定的版本化 operand capability 与机制层应用策略。
- `threeValueMechanismSampleAdapter.js`：把通过验证的 runtime sample 晋级为可应用 delta。
- `damage.js`：当前已确认的伤害计算片段；测试期未知机制保持可替换。

### 3.6 运行时与投影层

`src/simulation/runtime/` 只消费标准生成合同，负责：

- 按命中提交三值 transaction。
- 更新敌人 HP、敌人韧性和各角色能量状态。
- 生成 `simLog`、`stateCurves`、资源曲线、状态快照和 summary。
- 保持动作、命中、曲线点和日志之间的稳定身份映射。
- 每条 generation delta 先生成 `AzPrThreeValueMechanicsAdapter` request，绑定 action、hit、同一份 `mechanismConfiguration`、Scenario `mechanicsProfile` 和来源值；runtime state snapshot 再绑定当时的 `stateBefore` 后统一调用注册 adapter。adapter 不读取 Workbench 配置库或 UI 状态。

`src/simulation/projection/projectSimulationResult.js` 将运行结果组织为 Workbench 可消费的动作结果、贡献、诊断和详情视图；`projectEffectIntervals.js` 将效果事件归并为角色/敌人轨可消费的持续区间；`projectCycleSections.js` 按项目边界切分现有 transaction、能量与效果区间；`projectCycleBoundaryInheritance.js` 把边界前已结算状态投影为新方案初始状态并平移边界后草稿。投影层不反向参与公式计算。

### 3.7 Workbench 层

`src/features/workbench/` 按功能区组织：

- 动作库、时间轴和属性编辑。
- 队伍培养与敌人配置。
- 资源曲线、事件日志、三值详情和贡献分析。
- 规则诊断、效果轨道和运行结果返回编辑。
- 主流程控制器、运行时同步和选中状态映射。
- 时间轴从 runtime effect interval projection 渲染角色/敌人效果区间，并与生命周期复盘和来源动作编辑共用选择状态。
- 时间轴渲染可编辑的 60fps 循环边界和选中区段高亮，区段统计可定位贡献动作返回编辑。
- 项目导入导出、分享和预设库由 `Workbench.vue` 编排，数据格式由 domain 层持有。
- 顶部方案栏管理项目内完整排轴方案；方案切换只替换活动草稿，标准模拟链仍保持单入口。
- `WorkbenchConfigurationLibraryPanel.vue` 管理可命名、复制和删除的角色/敌人配置实例；方案只保存实例选择，活动方案解析后的 `actorConfigs` / `enemyConfig` 继续作为标准模拟输入。
- `WorkbenchLayoutBar.vue` 与按需加载的 `workbenchLayout.js` 管理桌面面板折叠、宽度、专注模式和本地恢复；布局偏好不进入项目合同。
- `WorkbenchProjectDropOverlay.vue` 与按需加载的 `workbenchProjectFileReceiver.js` 统一接收文件选择、方案基准和窗口拖放，再把合法项目或 capture 交还既有恢复入口。

## 4. 关键数据合同

### WorkbenchProjectFile v13

根级包含活动方案的 selection、teamSlots、actorConfigs、enemyConfig、configurationSelection、segmentSplitOptions、actionDrafts、actionRelations、cycleBoundaries、initialRuntimeState、runtimeSampleCaptures 和 selectedActionId，并包含共享 `configurationLibrary` 与 `scenarioWorkspace`。JSON、分享链接、PNG 元数据和预设库都复用该合同；v1-v12 项目从各方案已有 `actorConfigs` / `enemyConfig` 生成配置实例并保留原模拟输入。

### ConfigurationLibrary / ConfigurationSelection v1

`configurationLibrary` 在项目根级保存角色和敌人配置实例；角色实例继续复用既有 `actorConfig`，敌人实例继续复用既有 `enemyConfig`。每条方案的 `configurationSelection` 只绑定当前角色和敌人所选实例 ID。切换方案或选择实例时，domain 层把实例解析回活动草稿的 `actorConfigs` / `enemyConfig`，Project、compiler、generation、runtime 和 calculator 不读取配置库结构，也没有第二套培养或计算模型。

### ThreeValueMechanismConfiguration v1

Project metadata 只携带活动方案的配置实例 ID 和已经解析的 `actorConfigs` / `enemyConfig`；compiler 将它们与 Scenario actor/enemy 合成为 `AzPrThreeValueMechanismConfiguration`。角色来源区分面板 stats、初始 SP 和 loadout，敌人来源区分 HP baseline、伤害预览防御倍率、韧性 baseline、等级和元素防御。当前确认可用的 baseline/预览字段显式标记应用位置；奇波、装备、灵子效果、敌人等级公式和元素防御公式固定为未应用。

`AzPrThreeValueMechanismContext` 为 v3，`ThreeValueDeltaCalculator` 为 v3。阶段 8-N 后 `Action -> Hit -> ThreeValueDelta` 为 v6，`AzPrThreeValueMechanicsAdapter` 为 v3，`ThreeValueRuntimeCalculatorInvocation` 为 v5；每条 delta、generation calculator result、runtime invocation 和 runtime summary 都保留配置、profile、来源状态及实例 ID。

### MechanicsProfile v1 / Adapter v3 / MechanicsOperands v1

compiler 默认把 `azpr-three-value-preview-v1` 作为 `AzPrMechanicsProfile` 绑定到 Scenario，并保留 requested/resolved profile 与 fallback 状态。profile 是纯数据，声明支持的 operand kinds、对应 operation、可用轨道，以及 HP、韧性、能量各层的 applied/unapplied 状态。`compileProject(..., { threeValueMechanicsProfile })` 可选择其他合法 profile。

`Action -> Hit -> ThreeValueDelta v6` 的每条 delta 都携带 `mechanicsAdapterRequest`。generation 固定 `action / hit / mechanismConfiguration / mechanicsProfile / sourceValue.operands`，runtime 固定 `stateBefore` 并生成完整 adapter input。operands evaluator 先按 profile 解析 capability，再按 operation 计算；profile 不支持 kind、轨道或 operation 时明确返回 capability 缺口并回退 generation 值。

注册表支持 HP、韧性、能量轨专用注册或一个 `default` 注册覆盖三轨；`simulateScenario(scenario, { threeValueMechanicsAdapterRegistry })` 是无 UI 顶层注入入口，旧 `runtimeCalculatorAdapters` 仍兼容。runtime state、projection 和 consumer summary 统一输出 operands readiness、重算数、失配数与 operand kinds。

生产构建把 `threeValueMechanicsProfile.js` 与 `threeValueMechanicsAdapter.js` 固定为单个 `azpr-mechanics-runtime` chunk；这是同步机制包的缓存边界，不改变源码 import、测试挂载或 runtime 调用语义，总 JavaScript 体积仍由独立预算限制。

### ScenarioWorkspace v1

包含 `activeScenarioId` 与最多 14 条 `{ id, name, draft }`。每个 draft 是完整 `WorkbenchScenarioDraft`；根级字段始终镜像活动方案，保证 Project、compiler 和 runtime 无需认识工作区。切换方案前同步当前草稿，切换后清理跨方案临时选择和撤销历史。

### ActionRelation v1

当前只支持无环的 `sequence` 关系，固定连接前一动作 `end` 与后一动作 `start`，`gapMs` 随动作位置和时长同步。它表达编排关系，不改变动作执行顺序或三值公式。

### EffectIntervalProjection v1

从 `AzPrEffectRuntimeTimeline` 的施加、刷新、叠层、移除和到期事件生成稳定区间，保留目标、来源动作、生命周期事件、帧范围和峰值层数。该合同是 transient runtime projection，不写入 WorkbenchProjectFile；固定 `appliedToCalculators = false`。

### CycleSectionProjection v1

从项目时长与 `cycleBoundaries[]` 生成连续区段，并按事件发生时间与效果区间重叠切分现有 runtime output。输出区段 HP、韧性、各角色能量、动作贡献和效果覆盖；固定 `readsRuntimeOutputsOnly = true`、`appliedToCalculators = false`，不重复执行动作或改变 calculator。

### InitialRuntimeState / CycleBoundaryInheritanceProjection v1

`AzPrInitialRuntimeState` 保存来源边界、敌人当前 HP/韧性、各角色当前自身能量和活动效果剩余时长。继承投影只读取标准 runtime snapshot/effect event，把边界后动作、关系与后续边界平移到新轴；边界当帧事件由新方案结算。Project 与 Scenario 显式携带初始状态，runtime 仍走同一状态快照和效果时间线入口。

### WorkbenchLayout v1

保存均衡、专注编辑、专注复盘或自定义模式，以及动作库/检查区宽度和折叠状态。该合同只属于浏览器工作区偏好，由 `src/domain/workbenchLayout.js` 规范化并写入独立 localStorage key；Project、Scenario、runtime、项目交换与 PNG 导出均不消费它。

### WorkbenchProjectFileReceiveResult v1

按文件签名、扩展名与 MIME 区分 JSON 项目、PNG 项目和 runtime capture，输出完整 draft、captures 或无效原因。窗口拖放控制器只处理外部 `Files` 事件、拖放深度和单次文件列表；解析成功后仍由 `applyImportedProjectDraft()` 或 capture binding 应用。该结果是 transient import contract，不写入项目或本地草稿。

### WorkbenchPresetLibrary v1

每个预设包含可搜索元数据、兼容状态、摘要和完整 `WorkbenchProjectFile`。旧项目可解析时迁移到当前快照，不兼容条目保留但禁止加载。

### RuntimeSampleCaptureFile v1

外部 JSON/JSONL capture 经来源审计、动作/实体绑定和事件合同验证后写入项目。只有通过机制 adapter 验证的状态前后值可以进入 applied layer。

### RuntimeCaptureHookManifest v1

固定客户端区域、build、`dump.cs`/`GameAssembly.dll` 哈希、目标方法地址和字段偏移。客户端更新后必须重新生成，旧地址不得继续使用。

## 5. 持久化边界

- 当前草稿：`promilia-axis-tool:workbench-draft:v13`。
- 本地预设：`promilia-axis-tool:workbench-presets:v1`。
- 工作区布局：`promilia-axis-tool:workbench-layout:v1`，独立于项目和草稿。
- 项目交换：JSON、分享 URL、PNG 内嵌元数据。
- 临时曲线选中、复盘焦点、筛选和诊断面板状态不写入项目文件。

导入项目或加载预设必须统一经过 `applyImportedProjectDraft()`，以完成规范化、草稿保存、历史清空、临时状态清理和运行时重算。

## 6. 验证体系

- `src/__tests__/domain/`：数据合同、迁移、导入导出和项目工厂。
- `src/__tests__/simulation/`：执行计划、生成层、mechanics、runtime 和投影一致性。
- `src/__tests__/features/`：Workbench 功能组件与主流程控制器。
- `src/__tests__/views/Workbench.test.js`：页面编排和跨组件联动。
- `e2e/workbench-continuous-edit.spec.js`：真实浏览器中的编辑、模拟、曲线、日志、回改、配置和项目交换闭环。

阶段提交前至少执行：

```powershell
npm run test -- --run
npm run build
npm run test:e2e:workbench-flow
npm run audit:production-imports:check
npm run audit:bundle:check
npm run audit:workbench-data:check
npm run benchmark:long-axis:check
npm run benchmark:long-axis:browser
npm run test:e2e:production-preview
git diff --check
```

## 7. 已知边界

- 首份非 fixture 真实战斗 capture 尚未取得，受控 host 就绪不等于真实游戏机制已验证。
- 测试期公式与倍率可能变化，未确认层必须保持来源、置信度和可替换状态。
- 生产引用审计当前为 0 个无引用模块、0 个意外 test-only 模块；新增代码必须维持该守门。
- 当前首屏、Workbench 与全部 JavaScript gzip 预算分别为 120KB、370KB、740KB；新增依赖必须通过构建组成审计。
- Workbench 首轮主包主要由技能核心投影、生产 seed 和模拟/复盘代码构成；候选诊断证据已经移入独立按需包，后续优化应以生产试用和可测量瓶颈为依据。
- `playwright.production.config.js` 只服务真实 `dist` 的发布验收；`production-preview-reporter.mjs` 将十五项必需能力汇总为 `trial-ready` 或 `blocked`，开发服务器 E2E 不替代该结论。
