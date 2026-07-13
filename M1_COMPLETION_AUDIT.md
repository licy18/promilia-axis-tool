# M1 对标完成度审计

审计日期：2026-07-14

## 1. 审计结论

`promilia-axis-tool` 的 **M1 / Endaxis 级核心排轴体验已经完成**。当前用户可以从默认示例或空方案出发，配置 3 个角色、各自奇波和敌人，把角色、奇波与敌人动作编入同一 60fps 时间轴，查看 3 条角色能量、3 条奇波能量、敌人 HP 与韧性，编辑后即时重算，并通过本地草稿、JSON、分享链接、PNG 和方案复制恢复同一结果。

完整重构目标仍未完成。当前最主要的非数值缺口是：

1. `switch` 动作只生成事件和日志，尚未形成随时间变化的受控角色状态与切人区间。
2. 动作关系只有 `sequence`，尚未覆盖 Endaxis 的动作/效果端点、触发与消耗关系。
3. 装备、奇波、灵子、敌人防御/抗性及更多培养效果已有配置和来源边界，但真实效果仍为 `unapplied`。

## 2. 审计基线

### promilia-axis-tool

- 基线提交：`1c625ef chore: establish M1 trial release gate`。
- `reports/production-preview-acceptance.json`：37/37 项必需能力通过，判定为 `trial-ready`。
- 本轮验证：85 个测试文件、476 条测试通过，`npm run build` 通过。
- 视觉证据：`reports/m1a-workbench-desktop.png`、`reports/m1a-endaxis-reference.png`、`reports/m1-trial-release-desktop.png`、`reports/m1-trial-release-narrow.png`。
- 包体：Workbench 主块 358,175B gzip，总 JavaScript 739,969B gzip，低于 370,000B/740,000B 硬门槛。

### Endaxis

- 对照提交：`c39bd6b Fix : 修复连携相关充能`。
- 本轮验证：15 个测试文件、230 条测试通过，`npm run build` 通过。
- 关键来源：`src/views/TimelineEditor.vue`、`src/stores/timelineStore.js`、`src/components/ActionConnector.vue`、`src/simulation/`、`src/stores/operatorStore.ts`、`weaponStore.ts`、`gearStore.ts`。

本审计只比较功能层级与工作流，不把终末地数值、装备或敌人机制当作蓝色星原公式来源。

## 3. 功能矩阵

| 能力块 | promilia 当前证据 | 对照结论 |
| --- | --- | --- |
| 项目与方案工作区 | 最多 14 个完整方案，可新增、复制、重命名、删除、继承循环状态、比较并恢复 | 已完成；与 Endaxis 的 14 方案工作区同级，比较与复现审计更完整 |
| 队伍与轨道拓扑 | 3 个角色主轴、3 个奇波子轴、1 个敌人轴；3 条角色能量、3 条奇波能量、HP、韧性共享唯一时间坐标 | M1 已完成；符合蓝色星原 3 人队语义，不照搬 Endaxis 的 4 干员轨 |
| 队伍配置 | 角色、奇波、装备、灵子、敌人及命名配置实例可选择并进入五载体回放 | 配置闭环已完成；未确认培养效果仍不参与计算 |
| 动作编辑 | 拖入、移动、合法跨轨、框选、多选、复制、删除、批量平移、撤销/重做、快捷键与 1 帧定位 | 已完成；生产 E2E 已覆盖编辑后曲线、日志和详情同步 |
| 受控角色与切人 | 有 `switch` 动作、目标角色和 `SWITCH` 日志 | 部分完成；没有按帧维护受控角色区间，也未用它诊断动作归属 |
| 动作关系 | 可建立、显示、选择、复制和删除无环 `sequence` 关系并同步间隔 | 部分完成；尚无 Endaxis 式动作/效果端点、触发和消耗关系 |
| 运行时合同 | `Action -> Hit -> ThreeValueDelta`、状态写入 proposal、`simLog`、曲线、summary 和来源身份已统一 | 结构完成；可替换机制边界稳定 |
| 真实战斗机制 | HP 预览、显式角色能量事件与 validated sample 可应用；奇波能量独立追踪 | 延期；装备、奇波、灵子、防御、抗性、暴击及更多效果仍需稳定 AzPr 证据 |
| 项目交换与回放 | 本地草稿、JSON、分享链接、PNG、预设/方案复制统一使用 Workbench v16，并有 profile、游戏数据和来源兼容门禁 | 已完成并强于对照基线；五载体结果一致由生产 E2E 证明 |
| 复盘与分析 | 同轴事件、帧游标、日志、三值详情、贡献窗口、循环区段、A/B 比较、JSON/PNG 报告与复现审计 | 已完成并超过 M1 所需；后续不再扩张分析面板作为主线 |
| 桌面与窄屏 | 1440x900 完整显示 15 行拓扑；390px 保留固定身份列、局部横向滚动和完整编辑闭环 | M1 已完成；Endaxis 另有专用移动只读视图，当前不是核心阻塞 |
| 游戏数据维护 | 从 AzPr 数据工作区生成角色、技能、敌人、装备、奇波和灵子投影，并进行生产引用/数据审计 | 采用真实数据生成链替代 Endaxis 手工数据编辑器，不构成功能缺口 |

## 4. M1 要求核验

| 明确要求 | 证明 | 结论 |
| --- | --- | --- |
| 3 角色、3 奇波、1 敌人身份在首屏可读 | `m1a-timeline-identity`、桌面/窄屏截图 | 完成 |
| 每个角色和奇波各有自己的能量轴，共 6 条 | `m1b-team-kibo-energy`、8 条状态曲线断言 | 完成 |
| 空方案显示全长平线并可从零编排 | `m1-empty-scenario-workflow` | 完成 |
| 拖入动作后按准确事件帧更新对应曲线 | `m1c-library-to-runtime`、`stage-9b-runtime-step-curves` | 完成 |
| 移动、复制、删除和撤销/重做同步更新结果 | `stage-10a/10b`、主流程 E2E | 完成 |
| 默认示例可展示多角色、奇波、敌人和三类状态变化 | `m1d-demo-milestone` | 完成 |
| 本地草稿、JSON、分享链接、PNG 与方案复制一致 | `m1d-demo-milestone`、项目交换能力组 | 完成 |
| 1440x900 与 390px 可用且不重叠/丢轨 | `m1a-timeline-identity`、`narrow-main-flow` | 完成 |

因此可以关闭 M1 里程碑，但不能关闭“完成 promilia-axis-tool 重构目标”的总目标。

## 5. 后续优先级

### P1：受控角色与切人编排闭环

把现有 `switch` 动作提升为正式时间状态：项目显式保存初始受控角色，runtime 按准确帧生成受控角色区间，时间轴与日志显示当前角色，移动/复制/删除切人动作后响应式更新。五载体、撤销/重做、循环继承与方案比较必须恢复相同控制状态。该阶段不新增伤害公式。

### P2：动作/效果关系语义闭环

在现有 `sequence` 关系上增加可扩展的动作/效果端点和关系类型，允许清楚表达触发、消耗与连携来源，并由运行时诊断关系是否满足。关系只在有 AzPr 依据时影响机制；未知关系继续只追踪，不猜规则。

### P3：已确认 AzPr 机制接入

仅在真实数据源或稳定 runtime evidence 到位后，逐层接入装备、奇波、灵子、防御、抗性及资源变化。每次只接入已确认机制，并继续通过可替换 adapter 与 applied source binding 守门。

下一阶段默认进入 P1，不回到分析报告扩张、校准入口、测试期倍率考古或零碎 UI 修补。
