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
- `workbenchProjectFactory.js`：把 Workbench 选择、培养配置和动作草稿组装为标准项目。
- `workbenchActionRelations.js`：动作前后关系的规范化、无环校验、间隔同步与删除清理。
- `workbenchDraftStorage.js`：v11 草稿、项目 JSON 和分享链接。
- `workbenchScenarioWorkspace.js`：最多 14 条完整方案快照的规范化、切换和迁移。
- `workbenchPngProject.js`：PNG 项目元数据写入与回读。
- `workbenchPresetStorage.js`：v1 本地预设库，复用完整 Workbench 项目快照。
- `workbenchRuntimeSampleCapture.js`：外部 capture 文件解析、绑定、去重和项目持久化。

### 3.3 编译与执行层

- `compileProject.js`：把项目模型编译为模拟场景，UI 状态不进入编译合同。
- `actionExecutionPlan.js`：统一决定动作正常执行、条件待确认或确定跳过。
- `simulateScenario.js`：构建事件、执行计划和模拟输出。
- `actionRuleDiagnostics.js`：冷却、充能次数和动作可执行性诊断。
- `effectRuntimeTimeline.js`：效果命令、持续时间、层数和目标的运行时轨道。

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
- `threeValueMechanismSampleAdapter.js`：把通过验证的 runtime sample 晋级为可应用 delta。
- `damage.js`：当前已确认的伤害计算片段；测试期未知机制保持可替换。

### 3.6 运行时与投影层

`src/simulation/runtime/` 只消费标准生成合同，负责：

- 按命中提交三值 transaction。
- 更新敌人 HP、敌人韧性和各角色能量状态。
- 生成 `simLog`、`stateCurves`、资源曲线、状态快照和 summary。
- 保持动作、命中、曲线点和日志之间的稳定身份映射。

`src/simulation/projection/projectSimulationResult.js` 将运行结果组织为 Workbench 可消费的动作结果、贡献、诊断和详情视图；`projectEffectIntervals.js` 将效果事件归并为角色/敌人轨可消费的持续区间；`projectCycleSections.js` 按项目边界切分现有 transaction、能量与效果区间。三类投影都不反向参与公式计算。

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

## 4. 关键数据合同

### WorkbenchProjectFile v11

根级包含活动方案的 selection、teamSlots、actorConfigs、enemyConfig、segmentSplitOptions、actionDrafts、actionRelations、cycleBoundaries、runtimeSampleCaptures 和 selectedActionId，并新增 `scenarioWorkspace`。JSON、分享链接、PNG 元数据和预设库都复用该合同；v1-v10 项目迁移为单方案工作区。

### ScenarioWorkspace v1

包含 `activeScenarioId` 与最多 14 条 `{ id, name, draft }`。每个 draft 是完整 `WorkbenchScenarioDraft`；根级字段始终镜像活动方案，保证 Project、compiler 和 runtime 无需认识工作区。切换方案前同步当前草稿，切换后清理跨方案临时选择和撤销历史。

### ActionRelation v1

当前只支持无环的 `sequence` 关系，固定连接前一动作 `end` 与后一动作 `start`，`gapMs` 随动作位置和时长同步。它表达编排关系，不改变动作执行顺序或三值公式。

### EffectIntervalProjection v1

从 `AzPrEffectRuntimeTimeline` 的施加、刷新、叠层、移除和到期事件生成稳定区间，保留目标、来源动作、生命周期事件、帧范围和峰值层数。该合同是 transient runtime projection，不写入 WorkbenchProjectFile；固定 `appliedToCalculators = false`。

### CycleSectionProjection v1

从项目时长与 `cycleBoundaries[]` 生成连续区段，并按事件发生时间与效果区间重叠切分现有 runtime output。输出区段 HP、韧性、各角色能量、动作贡献和效果覆盖；固定 `readsRuntimeOutputsOnly = true`、`appliedToCalculators = false`，不重复执行动作或改变 calculator。

### WorkbenchPresetLibrary v1

每个预设包含可搜索元数据、兼容状态、摘要和完整 `WorkbenchProjectFile`。旧项目可解析时迁移到当前快照，不兼容条目保留但禁止加载。

### RuntimeSampleCaptureFile v1

外部 JSON/JSONL capture 经来源审计、动作/实体绑定和事件合同验证后写入项目。只有通过机制 adapter 验证的状态前后值可以进入 applied layer。

### RuntimeCaptureHookManifest v1

固定客户端区域、build、`dump.cs`/`GameAssembly.dll` 哈希、目标方法地址和字段偏移。客户端更新后必须重新生成，旧地址不得继续使用。

## 5. 持久化边界

- 当前草稿：`promilia-axis-tool:workbench-draft:v11`。
- 本地预设：`promilia-axis-tool:workbench-presets:v1`。
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
- `playwright.production.config.js` 只服务真实 `dist` 的发布验收；`production-preview-reporter.mjs` 将十一项必需能力汇总为 `trial-ready` 或 `blocked`，开发服务器 E2E 不替代该结论。
