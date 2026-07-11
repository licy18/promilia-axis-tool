# Workbench 时间轴能力

最后更新：2026-07-11

## 1. 主入口

生产时间轴位于：

- `src/features/workbench/TimelineGridPreview.vue`：轨道、动作、命中、冷却、效果和三值 marker 渲染。
- `src/views/Workbench.vue`：动作草稿、选择状态、编辑历史和运行时同步编排。
- `src/domain/timebase.js`：60fps 时间换算和吸附。
- `src/domain/workbenchProjectFactory.js`：action draft 规范化与标准 `Project.actions` 生成。

旧 `src/components/timeline/` 已在阶段 7-B 删除，不再存在平行时间轴实现。

## 2. 时间基准

- 固定帧率：60fps。
- 最小编辑颗粒度：1 帧。
- `startMs` 和 `durationMs` 在领域层通过 `snapMsToFrame()` 规范化。
- UI 可以显示毫秒，但动作移动、持续时间调整、批次偏移和候选帧都必须回到帧网格。
- 不能确认的命中帧、动作时长和取消窗口必须保留 `needsTimingData` / `timingSource`，不能把文本解析结果标为精确实测。

## 3. 轨道与动作

角色动作按 actor 轨显示，等待、注释、资源和敌人事件按系统轨显示。技能动作使用蓝色星原固定动作目录：

```text
普通攻击
重击
闪击
跃击
星鸣技
星结合击
星决技
星携技
极限反击
完美招架
```

被动技能不作为时间轴动作。普攻多段命中属于“普通攻击”动作内部 hit，不拆成多个技能动作。

标准动作草稿至少包含：

```text
id / type / actorCharacterId
skillId / actionVariantIndex / level
startMs / durationMs
targetCharacterId
effectCommands[]
insertion / generationBatch
```

## 4. 编辑能力

- 从动作库插入技能、切人、等待、资源、敌人事件和注释。
- 动作列表与时间轴共享多选：普通点击替换，Ctrl/Cmd 点击切换，Shift 点击选择连续范围；主动作继续负责属性编辑和结果定位。
- 时间轴支持框选模式，点击框选工具或按 `Ctrl/Cmd+B` 后可以跨轨拖出选择区域；框选结果继续进入同一多选、批量编辑和运行结果定位链。
- 拖动或数值输入修改起始帧；拖动已选动作会整组预览并在松手时提交一次历史记录，按帧调整持续时间仍作用于主动作。
- 任意动作组可以复制、粘贴、删除和按帧移动；右键动作或时间轴空白处可以在目标帧粘贴，组内相对帧差与角色轨保持不变。
- 两个或更多所选动作可以按时间顺序建立可视化前后关系。关系固定连接 `source.end -> target.start`，禁止自连、重复边和有向环；移动或改时长会更新间隔，删除端点会清理相关关系。
- `Ctrl/Cmd+C` / `Ctrl/Cmd+V` 使用 Workbench 会话剪贴板，`Ctrl/Cmd+D` 复制主动作，Delete/Backspace 删除所选组，方向键整组按帧微调。
- `Ctrl/Cmd+Z`、`Ctrl/Cmd+Y` 和 `Ctrl/Cmd+Shift+Z` 撤销/重做。
- 同轨重叠时可自动推迟，并保留诊断说明。

多选和动作剪贴板只属于编辑会话与撤销历史，项目重置或方案切换会清除；动作关系、循环边界和初始运行状态随各方案进入 v12 项目交换格式。复制动作组时只复制两个端点都位于所选组内的关系。

所有动作变更必须通过 Workbench mutation/runtime sync 路径刷新模拟结果，不能只移动 DOM。

### 工作区布局

- 桌面端提供均衡、专注编辑和专注复盘模式；动作库与侧边检查区可以独立折叠。
- 分隔线可以拖动调整宽度，键盘方向键按步进调整，Home 或双击恢复单侧默认宽度。
- 布局使用 `WorkbenchLayout v1` 独立持久化，刷新恢复但不进入项目交换、预设、撤销历史或 PNG 元数据。
- 1180px 以下转为两栏/下置检查区；760px 以下忽略桌面折叠状态，按动作库、主流程、检查区完整纵向排列。
- PNG 导出使用独立固定表面，不读取当前面板宽度或折叠状态。

## 5. 可见运行层

时间轴同时显示或关联以下运行数据：

- 动作执行状态：正常、条件待确认、确定跳过。
- 冷却与充能次数窗口。
- 效果命令的 apply/refresh/remove/expire 区间。
- 命中与候选命中 marker。
- 敌人 HP、敌人韧性和每角色能量的状态曲线 marker。
- applied、candidate、sampled 和 placeholder 来源层。
- 可添加、拖动和删除的循环边界，以及当前复盘区段高亮。
- 从区段起始边界创建继承方案；新方案继续显示继承效果区间与三值状态。

状态效果区间只能从 `AzPrEffectRuntimeTimeline` 投影：角色目标进入对应角色轨，敌人目标进入独立敌人效果轨；区间按真实持续帧占位，重叠效果自动分配子轨，并在条内标出刷新/叠层和结束节点。点击区间后，生命周期详情、当前生效快照和来源动作回改必须共享同一 interval/event 选择。

点击曲线点、命中日志、动作结果或贡献行后，必须落到同一个稳定 state point，并能返回对应动作继续编辑。

循环边界严格吸附 60fps 帧网格并位于项目时长内部。边界只把同一份 runtime output 切成连续区段，区段统计可读取 HP、韧性、各角色能量、动作贡献和效果覆盖，但不能复制动作、外推循环次数或参与 calculator。

从边界创建继承方案时，边界前的 runtime snapshot 转换为 `AzPrInitialRuntimeState`，边界后的动作、关系和后续边界整体减去边界时间；边界当帧动作与事件在新方案结算。仍生效效果按剩余时长从 0 帧继续，原方案与公式不变，未重映射的 runtime capture 不携带到新轴。

## 6. 三值合同

时间轴不自行计算伤害或资源。每个动作通过模拟层生成：

```text
Action
  -> Hit
    -> hpDamage
    -> toughnessDamage
    -> selfEnergyChange
```

Runtime 消费标准 delta 后输出 `simLog`、`stateCurves`、资源曲线、状态快照和 summary；效果 runtime 另输出 lifecycle event，`EffectIntervalProjection` 只负责归并可视区间。时间轴只消费 projection，不读取 evidence 临时结构作为数值事实，也不让效果区间直接改写 calculator。

## 7. 项目交换

动作草稿、关系、循环边界与初始运行状态通过 WorkbenchProjectFile v12 的 `scenarioWorkspace.scenarios[].draft` 持久化。根级字段镜像活动方案；草稿、JSON、分享链接、PNG 元数据、runtime capture 和预设轴库共享完整方案工作区。任何新时间轴字段都必须同步考虑每条方案、全部交换路径及旧版本迁移。

JSON 项目、带项目元数据的 PNG 和 runtime capture 可以通过文件选择或窗口级拖放进入同一 `WorkbenchProjectFileReceiveResult`。外部文件进入窗口时显示释放遮罩；只接受单个文件。合法项目统一调用 `applyImportedProjectDraft()`，无效、损坏、多文件或无元数据 PNG 不得修改当前方案。拖放状态和接收结果不进入项目交换格式。

## 8. 长轴验收

运行时基准：

```powershell
npm run benchmark:long-axis:check
```

默认构造 180 个真实技能动作，验证 Project、Scenario、ExecutionPlan、ActionResult、HitTransaction、StateCurve 和 SimLog 数量一致，并检查编译与模拟 p95 预算。

浏览器基准：

```powershell
npm run benchmark:long-axis:browser
```

默认加载 120 动作 v12 草稿，验证动作列表、时间轴块、动作结果、状态曲线和运行结果导航均可见，首屏完成时间预算为 15 秒。

当前浏览器仍直接渲染全部动作和曲线点；当基准显示真实瓶颈时，再采用虚拟化、分层折叠或按需渲染，不提前引入无证据复杂度。

## 9. 回归入口

```powershell
npm run test -- --run
npm run test:e2e:workbench-flow
npm run audit:production-imports:check
npm run benchmark:long-axis:check
npm run benchmark:long-axis:browser
```

核心测试位置：

- `src/__tests__/features/TimelineGridPreview.test.js`
- `src/__tests__/views/Workbench.test.js`
- `e2e/workbench-continuous-edit.spec.js`
- `e2e/workbench-long-axis.spec.js`
