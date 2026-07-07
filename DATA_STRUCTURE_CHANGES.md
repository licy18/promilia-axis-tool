# 数据结构变更文档

## 2026-07-07：新版项目领域模型

当前重构主线已从旧原型技能字段扩展，进入新版项目领域模型阶段。新模型入口位于 `src/domain/projectSchema.js`，第一条真实数据 fixture 位于 `src/domain/fixtures/firstVerticalSlice.js`。

### 新版 Project 最小结构

```javascript
{
  schemaVersion: 1,
  game: 'azur-promilia',
  id: 'fixture-first-vertical-slice',
  name: '首条垂直切片：末音普攻对迅狼',
  time: {
    unit: 'ms',
    durationMs: 30000,
    fps: 60
  },
  actors: [],
  enemy: {},
  actions: [],
  resources: [],
  buffs: [],
  loadouts: [],
  metadata: {}
}
```

### 当前约束

- 内部时间单位固定为 `ms`，旧 UI 可以继续显示秒或帧，但进入运行时前必须转换。
- `actors[].characterId`、`enemy.enemyId`、`actions[].skillId` 必须能对应 `src/data/generated/` 中的真实 AzPr 数据。
- 技能动作必须保留 `timing.needsTimingData` 和 `timing.source`，直到获得可靠 asset、运行时捕获或人工标注。
- 新版项目不再使用 `skillBlocks` 作为主模型；旧字段只作为迁移输入或旧 UI 兼容来源。

### 第一条垂直切片

- 角色：末音，`characterId = 109001`
- 技能：哈库茵剑舞，`skillId = 10900101`
- 敌人：迅狼，`enemyId = 300032`
- 用途：阶段 3 `src/simulation/` 的 compiler / engine / projection 输入样本。
- 当前快照文件：`src/data/generated/first-vertical-slice.json`。该文件由 `npm run data:generate` 输出，供工作台和测试读取，避免首屏加载全量生成数据。
- 当前工作台 seed：`src/data/generated/workbench-seed.json`。该文件由 `npm run data:generate` 输出，包含 20 个角色、120 个技能和 199 个带战斗属性的敌人，字段已裁剪到工作台与运行时当前需要的范围。
- 当前工作台选择状态：`selection` 包含 `characterId`、`secondaryCharacterId`、`skillId` 和 `enemyId`。`characterId` 是当前主角色，`secondaryCharacterId` 是切人动作和多 actor 雏形使用的默认副角色。
- 当前工作台 actor：`src/domain/workbenchProjectFactory.js` 会按主/副角色生成多个 `Project.actors[]`；技能等级按角色汇总到对应 actor 的 `skillLevels` 和 `metadata.sourceSkillIds`。
- 当前工作台动作草稿：`src/domain/workbenchProjectFactory.js` 使用 `actionDrafts[]` 生成新版 `Project.actions[]`。草稿按类型保留 `id`、`type`、`skillId`、`targetCharacterId`、`startMs`、`durationMs`、`level`、`resource`、`change`、`reason`、`eventType`、`note` 等字段；生成项目时再解析为 actor、targetActor、enemy target 和 runtime 事件。
- 当前工作台敌人配置：`enemyConfig` 包含 `level`、`hpMultiplier`、`defenseMultiplier`，通过 `createEnemyFromData()` 写入新版 `Project.enemy`。
- 当前工作台草稿存储：`src/domain/workbenchDraftStorage.js` 使用 `schemaVersion: 1` 的 `workbench-draft` 保存 `selection`、`enemyConfig`、`actionDrafts`、`selectedActionId` 和 `savedAt`。该草稿是新版 workbench 专用状态，不包含旧 `skillBlocks`。
- 当前工作台时间轴投影：`TimelineGridPreview` 接收 `scenario.actors[]`、`scenario.actions[]` 和 `simulationResult.damageTimeline[]` 后按 `actor.id` / `actorId` 生成角色轨道；无 actor 的动作进入 `system` 系统轨。该轨道归属目前是 UI 投影，不改变项目 JSON schema。

### 当前动作类型

`Project.actions[]` 当前已支持以下动作类型：

| 类型 | 用途 | 当前运行时行为 |
| --- | --- | --- |
| `skill` | 真实角色技能动作 | 进入伤害投影、冷却、资源消耗和时序缺口日志 |
| `wait` | 排轴中的等待窗口 | 输出 `WAIT` 事件，记录 `durationMs` 和 `note`，不投射伤害 |
| `annotation` | 排轴备注/阶段标记 | 输出 `ANNOTATION` 事件，记录 `note`，不投射伤害 |
| `resource` | 手动资源变化 | 输出 `RESOURCE_CHANGE` 事件，记录 `resource`、`change`、`reason`、`note`，并进入 `resourceTimeline` |
| `enemyEvent` | 敌人/Boss 事件标记 | 输出 `ENEMY_EVENT` 事件，记录 `eventType` 和 `note`，不投射伤害 |
| `switch` | 切换到另一个角色 actor | 输出 `SWITCH` 事件，记录来源 actor、目标 actor、`durationMs` 和 `note`，不投射伤害 |

`switch` 当前只作为日志型非伤害动作，不改变后续技能的 actor 归属、Buff 归属或队伍资源；这些属于后续机制阶段。

## 2026-07-07：最小模拟运行时输出

阶段 3 新增 `src/simulation/`，当前输出结构如下：

```javascript
{
  schemaVersion: 1,
  scenario: {
    projectId: 'fixture-first-vertical-slice',
    projectName: '首条垂直切片：末音普攻对迅狼',
    durationMs: 30000,
    actorCount: 1,
    actionCount: 1,
    enemyId: 'enemy-300032',
    enemyName: '迅狼'
  },
  eventLog: [],
  damageTimeline: [],
  resourceTimeline: [],
  summary: {
    totalRawDamage: 0,
    projectedHitCount: 0,
    actionCount: 0,
    formulaVersion: 'stage3-raw-attack-multiplier-v1',
    confidence: 'low',
    timingMissingActionCount: 0,
    timingMissingActionIds: []
  },
  diagnostics: {
    validationWarnings: [],
    limitations: []
  }
}
```

当前 `damageTimeline` 是低置信度原始伤害投影，只使用角色 `ATK` 与技能等级倍率。最终防御、抗性、暴击、Buff、奇波、装备、灵子和精确命中帧尚未纳入。

当前 `resourceTimeline` 只收集 simulation engine 明确输出的资源事件，例如技能 `spCost` 或手动 `resource` 动作产生的 `RESOURCE_CHANGE`。UI 资源面板不得从动作列表或技能描述里另行推算资源。

## 1. 变更背景和目标

为了适应新的技能系统架构，提高技能数据的灵活性和扩展性，我们对角色和技能数据结构进行了系统性重构。本次重构的主要目标是：

- 为技能数据模型增加伤害判定帧属性，实现伤害判定的精确时间点记录
- 添加绑定buff机制，使技能能够关联并触发特定的buff效果
- 确保重构后的角色和技能数据结构与新技能系统架构完全兼容
- 建立数据迁移方案，确保现有数据的完整性和准确性

## 2. 数据结构变更内容

### 2.1 技能数据结构变更

#### 2.1.1 新增字段

| 字段名 | 类型 | 描述 | 示例 |
|-------|------|------|------|
| `damageTicks` | Array | 伤害判定帧数组，记录技能的伤害判定时间点 | `[{"offset": 45, "multiplier": 2.5, "element": "fire", "hitType": "skill"}]` |
| `buffs` | Array | 技能触发的buff效果数组 | `[{"name": "水之守护", "type": "defense", "value": 0.2, "duration": 10, "trigger": "onHit", "target": "self"}]` |
| `debuffs` | Array | 技能触发的debuff效果数组 | `[{"name": "岩元素减抗", "type": "resistanceReduction", "value": 0.2, "duration": 10, "trigger": "onHit", "target": "enemy"}]` |

#### 2.1.2 字段变更

| 旧字段 | 新字段 | 说明 |
|-------|-------|------|
| `judgmentPoints` | `damageTicks` | 重命名并调整结构，将`time`字段改为`offset` |
| `buff` | `buffs` | 从单个对象改为数组，增加`trigger`和`target`字段 |
| `debuff` | `debuffs` | 从单个对象改为数组，增加`trigger`和`target`字段 |

### 2.2 伤害判定帧结构

```javascript
{
  "offset": 45,          // 判定时间点（帧）
  "multiplier": 2.5,     // 伤害倍率
  "element": "fire",     // 元素类型
  "hitType": "skill",    // 攻击类型
  "description": "技能伤害" // 伤害描述（可选）
}
```

### 2.3 Buff效果结构

```javascript
{
  "name": "水之守护",         // Buff名称
  "type": "defense",        // Buff类型
  "value": 0.2,             // Buff值
  "duration": 10,           // 持续时间（秒）
  "trigger": "onHit",       // 触发条件
  "target": "self"          // 目标
}
```

### 2.4 Debuff效果结构

```javascript
{
  "name": "岩元素减抗",         // Debuff名称
  "type": "resistanceReduction", // Debuff类型
  "value": 0.2,                  // Debuff值
  "duration": 10,                // 持续时间（秒）
  "trigger": "onHit",            // 触发条件
  "target": "enemy"             // 目标
}
```

## 3. 数据迁移方案

### 3.1 迁移工具

我们创建了专门的数据迁移工具 `src/utils/dataMigration.js`，用于将旧版本的技能数据结构转换为新版本。迁移工具支持以下功能：

- 将旧的 `judgmentPoints` 转换为新的 `damageTicks`
- 将旧的单个 `buff` 转换为新的 `buffs` 数组
- 将旧的单个 `debuff` 转换为新的 `debuffs` 数组
- 为没有 `damageTicks` 的技能添加默认值
- 保留旧字段以确保兼容性

### 3.2 迁移流程

1. 检查数据版本号，判断是否需要迁移
2. 对每个角色的每个技能执行迁移
3. 更新版本号和更新时间
4. 返回迁移后的数据

### 3.3 兼容性保证

- 迁移过程中保留旧字段，确保现有代码能够继续工作
- 新字段采用合理的默认值，确保即使没有迁移的旧数据也能正常显示
- 迁移工具能够处理各种边缘情况，如缺失字段、空数组等

## 4. 代码变更

### 4.1 组件更新

- **SkillBlock.vue**：更新以支持新的 `damageTicks` 和 `buffs` 数据结构
- **Editor.vue**：确保拖放系统能够正确处理新的数据结构

### 4.2 工具函数

- **dataMigration.js**：新增数据迁移工具，处理旧数据到新数据结构的转换

### 4.3 测试文件

- **dataMigration.test.js**：新增单元测试，验证数据迁移的正确性

## 5. 测试验证

### 5.1 单元测试

我们编写了 comprehensive 的单元测试，验证以下功能：

- 旧的 `judgmentPoints` 到新的 `damageTicks` 的转换
- 旧的单个 `buff` 到新的 `buffs` 数组的转换
- 旧的单个 `debuff` 到新的 `debuffs` 数组的转换
- 为没有 `damageTicks` 的技能添加默认值
- 版本号检查和迁移执行

### 5.2 测试结果

所有数据迁移相关的测试用例都已通过，确保了迁移工具的正确性和可靠性。

## 6. 兼容性说明

### 6.1 向后兼容

- 旧的 `judgmentPoints`、`buff` 和 `debuff` 字段仍然保留，确保现有代码能够继续工作
- 新代码应优先使用新的 `damageTicks`、`buffs` 和 `debuffs` 字段

### 6.2 向前兼容

- 对于没有迁移的旧数据，系统会自动为其添加默认的 `damageTicks`
- 新的技能数据结构已经完全集成到技能系统中，支持所有新功能

## 7. 后续建议

### 7.1 数据维护

- 建议在添加新角色或技能时，直接使用新的数据结构
- 定期检查数据版本，确保所有数据都已迁移到最新版本

### 7.2 功能扩展

- 可以基于新的数据结构，进一步扩展技能系统的功能，如：
  - 更复杂的 buff 效果（如叠加、刷新机制）
  - 更精确的伤害判定（如多段伤害的不同元素类型）
  - 技能间的交互和联动效果

### 7.3 性能优化

- 对于大型技能数据，可以考虑使用缓存机制，减少数据迁移的开销
- 可以优化伤害判定点的计算和渲染，提高时间轴的性能

## 8. 总结

本次数据结构重构成功实现了以下目标：

- 为技能数据模型增加了伤害判定帧属性，实现了伤害判定的精确时间点记录
- 添加了绑定 buff 机制，使技能能够关联并触发特定的 buff 效果
- 确保了重构后的角色和技能数据结构与新技能系统架构完全兼容
- 建立了数据迁移方案，确保了现有数据的完整性和准确性
- 编写了单元测试，验证了数据转换的正确性

这些变更为技能系统的进一步扩展和优化奠定了坚实的基础，同时保持了与现有代码的兼容性。

## 9. 2026-07-07 Workbench 动作倍率段选择补充

新版 `workbench` 动作草稿和项目动作新增 `damageSegmentIndex` 字段。

### 9.1 字段说明

```javascript
{
  "type": "skill",
  "skillId": 10900101,
  "level": 1,
  "damageSegmentIndex": 1
}
```

- `damageSegmentIndex` 表示当前技能动作选用 `damageSegments[index]` 中的哪一个倍率段。
- 默认值为 `0`，即继续保持过去“使用第一个可解析倍率段”的行为。
- 技能切换、动作归属切换导致技能变化时，该字段会重置为 `0`。
- 保存草稿时会保留该字段；生成项目和编译 scenario 时会透传到 action。

### 9.2 当前边界

- 该字段只代表“倍率段选择”，不代表真实命中帧、前后摇、取消窗口或动作帧。
- 倍率段仍来自技能描述/等级倍率表的解析结果，真实时序仍应通过 `TimingProfile` 或运行时捕获补足。
- 当索引超出当前技能等级可用段数时，workbench 归一化会 clamp 到有效范围内。

## 10. 2026-07-07 Workbench 技能段批量生成补充

本阶段没有新增持久化字段，而是确立了技能段批量生成的草稿写入约定。

### 10.1 写入形态

从技能等级倍率表批量拆分时，会生成多条普通 `skill` 动作，每条动作继续使用阶段 4-21 引入的 `damageSegmentIndex`：

```javascript
[
  {
    "id": "action-0003",
    "type": "skill",
    "skillId": 10900101,
    "level": 1,
    "damageSegmentIndex": 0
  },
  {
    "id": "action-0004",
    "type": "skill",
    "skillId": 10900101,
    "level": 1,
    "damageSegmentIndex": 1
  }
]
```

- 批量生成不会创建新的 `multiHitAction` 或嵌套子动作结构，避免在真实命中帧确认前提前固化错误模型。
- 每条生成动作仍走普通动作保存、编译和模拟路径，因此现有草稿恢复、时间轴诊断和伤害投影逻辑可直接复用。
- 若插入时同轨已有动作占用，生成动作会继续写入结构化 `insertion` 元信息。

### 10.2 当前边界

- 生成顺序来自当前等级表可解析倍率段顺序，不代表真实动画命中顺序一定可靠。
- 生成时间仍来自现有插入策略和默认动作时长，不代表真实帧数据。
- 后续若接入 `TimingProfile` 或运行时捕获，应优先在动作 timing 层补真实 hit frame，而不是把 `damageSegmentIndex` 升级成时序字段。

## 11. 2026-07-07 Workbench 拆段生成配置补充

Workbench 草稿新增可选 `segmentSplitOptions` 配置块，用于保存动作库“拆段”生成策略。

### 11.1 字段说明

```javascript
{
  "segmentSplitOptions": {
    "intervalMs": 1500,
    "startAfterSelectedAction": true,
    "skipExistingSegments": true
  }
}
```

- `intervalMs`：批量生成多个倍率段动作时，相邻段请求起始时间的间隔。默认 `2000`，归一化范围为 `100-10000`。
- `startAfterSelectedAction`：为 `true` 时，从当前选中动作的结束时间开始生成；为 `false` 时，继续从现有推荐插入点开始生成。
- `skipExistingSegments`：为 `true` 时，跳过当前轴中已有的同角色、同技能、同等级、同 `damageSegmentIndex` 技能动作。

### 11.2 兼容性

- 该字段只存在于 `workbench-draft` 草稿层，不进入通用 `Project` action 数据模型。
- 旧草稿缺少 `segmentSplitOptions` 时会自动使用默认配置，不需要迁移脚本。
- 若某一段因同轨冲突被自动推迟，后续段会按上一段实际落点继续计算间隔；真实落点仍以动作自身 `startMs` 和可选 `insertion` 元信息为准。

### 11.3 当前边界

- `segmentSplitOptions` 只影响新生成动作，不会回写或重排已经存在的动作。
- `intervalMs` 是编辑辅助间隔，不代表真实命中帧间隔。
- `skipExistingSegments` 只按当前草稿动作字段匹配，不做语义去重或真实连段判定。

## 12. 2026-07-07 Workbench 拆段预览状态说明

阶段 4-24 新增拆段生成预览，但没有新增持久化字段。

### 12.1 临时状态

`segmentSplitPreview` 仅存在于 `Workbench.vue` 运行时状态中，用于在确认前展示预计生成结果：

```javascript
{
  "skillId": 10900101,
  "generatedCount": 3,
  "skippedCount": 1,
  "autoDelayedCount": 0,
  "actions": [
    {
      "damageSegmentIndex": 1,
      "requestedStartMs": 1000,
      "resolvedStartMs": 1000
    }
  ]
}
```

- 该结构不会保存到 `workbench-draft`，刷新或重开后不会恢复。
- 取消预览不会改变 `actionDrafts`。
- 确认预览后才会生成普通 `skill` 动作，并继续使用 `damageSegmentIndex`、`startMs` 和可选 `insertion` 元信息保存真实写入结果。

### 12.2 当前边界

- 预览只模拟当前草稿状态下的预计插入结果；如果动作、角色、拆段配置或时间轴发生变化，旧预览会被清理。
- 预览中的 `resolvedStartMs` 是编辑器插入策略的预计落点，不代表真实游戏帧。

## 13. 2026-07-07 Workbench 拆段生成批次标记补充

确认拆段预览后生成的技能动作新增可选 `generationBatch` 元信息，用于表达“这些动作来自同一次拆段生成”。

### 13.1 字段说明

```javascript
{
  "id": "action-0003",
  "type": "skill",
  "skillId": 10900101,
  "damageSegmentIndex": 1,
  "generationBatch": {
    "batchId": "segment-batch-0001",
    "source": "skill-segment-split",
    "skillId": 10900101,
    "actorCharacterId": 109001,
    "level": 1,
    "segmentCount": 4,
    "createdAt": "2026-07-07T00:00:00.000Z"
  }
}
```

- `batchId`：同一次确认拆段生成的动作共享同一个批次 ID。
- `source`：当前固定为 `skill-segment-split`。
- `skillId`、`actorCharacterId`、`level`：记录批次来源上下文。
- `segmentCount`：记录本次确认实际生成的动作数量。
- `createdAt`：记录确认生成时间。

### 13.2 兼容性

- `generationBatch` 是可选字段，旧动作缺少该字段时按普通动作处理。
- 该字段会保存在 `workbench-draft.actionDrafts[]`，并透传到 Project skill action 和编译后的 scenario action。
- 复制单个生成动作时会清除 `generationBatch`，避免复制件误入原批次。

### 13.3 当前边界

- 批次标记只表达编辑器生成来源，不代表真实连段、命中帧、动画段或取消窗口。
- 当前批量管理只提供“删除同批次动作”入口；后续可在该字段基础上继续扩展批量选择、批量重排或撤销栈。

## 14. 2026-07-07 Workbench 拆段批次整体偏移补充

阶段 4-26 没有新增持久化字段，而是基于 `generationBatch.batchId` 对同批次动作批量修改 `startMs`。

### 14.1 行为说明

- 批次整体偏移会对同一 `generationBatch.batchId` 的所有动作应用同一个时间偏移。
- 批次内动作的相对间隔保持不变。
- 偏移会按场景时间范围夹紧，避免动作起点小于 `0` 或超出 `project.time.durationMs`。
- 若批次动作原本带有自动推迟 `insertion` 元信息，整体移动后会清理该元信息和系统自动推迟备注，避免旧插入原因误导。

### 14.2 当前边界

- 批次偏移只移动动作起始时间，不重新计算真实技能帧、命中帧或取消窗口。
- 偏移后若与同轨动作重叠，仍由现有时间轴诊断报告，不自动避让。
- 批次偏移不会改变 `generationBatch` 本身；保存草稿后动作的新 `startMs` 即为权威状态。

## 15. 2026-07-07 Workbench 批次任意偏移输入补充

阶段 4-27 没有新增持久化字段，而是为已有批次整体偏移增加任意数值输入。

### 15.1 行为说明

- 用户可为同一 `generationBatch.batchId` 输入任意 `offsetMs`，再一次性应用到同批次动作。
- 输入偏移复用阶段 4-26 的整体移动逻辑：
  - 保持批次内相对间隔。
  - 按场景时间范围夹紧。
  - 清理旧自动推迟 `insertion` 元信息和系统自动推迟备注。
  - 保存后仍只以各动作 `startMs` 作为权威时间。

### 15.2 当前边界

- 任意偏移输入是 UI 临时值，不保存到草稿。
- 该输入只表达编辑器偏移量，不代表真实技能帧偏移。
- 移动后如果造成同轨重叠，仍由时间轴诊断提示，不自动避让。

## 16. 2026-07-07 Workbench 批次目标起点输入补充

阶段 4-28 没有新增持久化字段，而是为已有批次整体偏移增加目标起点输入。

### 16.1 行为说明

- 用户可为同一 `generationBatch.batchId` 输入目标 `startMs`，让批次中最早的一条动作对齐到该时间。
- 目标起点输入会在运行时换算为 `targetStartMs - currentBatchMinStartMs`，再复用阶段 4-26 的整体移动逻辑。
- 因为底层复用整体移动逻辑，所以仍会：
  - 保持批次内相对间隔。
  - 按场景时间范围夹紧。
  - 清理旧自动推迟 `insertion` 元信息和系统自动推迟备注。
  - 保存后只以各动作 `startMs` 作为权威时间。

### 16.2 当前边界

- 目标起点输入是 UI 临时值，不保存到草稿。
- 该输入只表达编辑器对齐命令，不代表真实技能首帧、命中帧或取消窗口。
- 如果目标起点超出场景边界，最终保存的 `startMs` 以夹紧后的动作时间为准。
- 对齐后如果造成同轨重叠，仍由时间轴诊断提示，不自动避让。

## 17. 2026-07-07 Workbench 批次摘要/集中管理面板补充

阶段 4-29 没有新增持久化字段，而是在 UI 层从现有动作草稿派生批次摘要。

### 17.1 派生结构

批次摘要由 `actionDrafts[]` 中带 `generationBatch.batchId` 的动作即时聚合：

```javascript
{
  "batchId": "segment-batch-0001",
  "skillName": "哈库茵剑舞",
  "sourceLabel": "拆段生成",
  "count": 4,
  "minStartMs": 3500,
  "maxStartMs": 9500,
  "selected": true
}
```

- `batchId`：来自动作自身的 `generationBatch.batchId`。
- `skillName`：优先用 `generationBatch.skillId` 在当前技能列表中反查；找不到时回退到动作名称。
- `sourceLabel`：当前把 `skill-segment-split` 显示为“拆段生成”。
- `count`：同批次动作数量。
- `minStartMs` / `maxStartMs`：同批次动作当前起点范围。
- `selected`：当前选中的动作是否属于该批次。

### 17.2 行为说明

- 批次摘要不写入 `workbench-draft`；刷新后会从已保存的 `actionDrafts[]` 重新计算。
- 批次删除、固定偏移、任意偏移和目标起点对齐集中到摘要面板执行。
- 单动作卡不再重复显示批次级删除/移动/对齐控件，只保留动作自身复制/删除与批次来源说明。
- 摘要面板继续复用阶段 4-26 至 4-28 的批次移动与对齐逻辑，保存后仍只以各动作 `startMs` 作为权威时间。

### 17.3 当前边界

- 阶段 4-29 时摘要项只反映选中态，还不能点击摘要直接定位或选择整组动作。
- 批次摘要仍是编辑器辅助视图，不代表真实连段、动作帧、命中帧或取消窗口。

## 18. 2026-07-07 Workbench 批次定位/时间轴联动补充

阶段 4-30 没有新增持久化字段，而是在 UI 层增加批次定位和同批次高亮。

### 18.1 派生状态

- `firstActionId`：批次摘要从同批次动作的最小 `startMs` 派生，用于点击摘要后定位到该批次第一条动作。
- `selectedBatchId`：动作库和时间轴都从当前 `selectedActionId` 对应动作的 `generationBatch.batchId` 派生。
- `data-batch-highlight`：仅用于 UI 和测试的派生属性，标识当前动作或伤害标记是否属于选中批次。

### 18.2 行为说明

- 点击批次摘要会发出既有 `select-action` 事件，选中该批次的第一条动作。
- 摘要内删除、偏移、对齐等控制按钮会阻止冒泡，不会误触发摘要定位。
- 动作列表中与当前选中动作同批次的动作会显示同批次高亮。
- 时间轴动作块和对应伤害标记会根据 `selectedBatchId` 显示同批次高亮。
- 保存草稿时仍只保存 `selectedActionId`、`actionDrafts[]` 等既有字段；批次定位和高亮会在恢复后重新派生。

### 18.3 当前边界

- 当前仍不保存独立的“选中批次”状态；批次高亮由当前选中动作反推。
- 点击摘要只定位到批次第一条动作，还没有滚动到对应动作卡或时间轴位置。
- 这仍是编辑器辅助联动，不代表真实连段、动作帧、命中帧或取消窗口。

## 19. 2026-07-07 技能倍率段数据源适配补充

阶段 5-1 建立了 `skillDamageSegments` 适配层，用来把当前技能倍率段从普通 `labels/values` 解析结果升级为带来源和诊断的结构。

### 19.1 来源字段

当前工作台使用的技能倍率段来自本地 AzPr 聚合数据：

- 根目录：`C:\PC2\Codex\AzPr`
- 聚合文件：`BWiki/data/hero-modules/local-all/<characterId>.hero-module.local.json`
- 技能对象：`data.skillSystem.<skillId>`
- 标签字段：`skillSystem.<skillId>.skillLevel.name`
- 等级倍率字段：`skillSystem.<skillId>.skillLevel.values[<levelIndex>]`
- 描述字段：`skillSystem.<skillId>.skillDescribe`

`scripts/generate-azpr-data.mjs` 的 `compactSkill()` 现在会保留 `source.heroModule`，所以 `workbench-seed.json` 里的技能也能追溯到本地 hero-module 文件。

### 19.2 `damageModel` 结构

`createSkillAction()` 现在通过 `createSkillDamageModel(skill, level)` 生成 `damageModel`：

```javascript
{
  "source": "azpr-local-hero-module-skill-level",
  "sourceKind": "azpr-local-hero-module-skill-level",
  "sourcePath": "C:/PC2/Codex/AzPr/BWiki/data/hero-modules/local-all/109001.hero-module.local.json",
  "skillId": 10900101,
  "characterId": 109001,
  "fieldPaths": {
    "labels": "skillSystem.10900101.skillLevel.name",
    "values": "skillSystem.10900101.skillLevel.values[0]",
    "description": "skillSystem.10900101.skillDescribe",
    "sourceTable": "BWiki/data/hero-modules/local-all/<characterId>.hero-module.local.json"
  },
  "level": 1,
  "levelIndex": 0,
  "labels": ["普攻", "重击", "闪击", "跃击"],
  "values": ["649%", "190%", "40%", "136%"],
  "diagnostics": []
}
```

### 19.3 Segment 来源

`getSkillDamageSegments()` 和模拟编译后的 `selectedDamageSegment` 会保留单段来源：

```javascript
{
  "index": 0,
  "label": "普攻",
  "rawValue": "649%",
  "multiplier": 6.49,
  "source": {
    "kind": "azpr-local-hero-module-skill-level",
    "path": "C:/PC2/Codex/AzPr/BWiki/data/hero-modules/local-all/109001.hero-module.local.json",
    "skillId": 10900101,
    "characterId": 109001,
    "level": 1,
    "levelIndex": 0,
    "labelField": "skillSystem.10900101.skillLevel.name[0]",
    "valueField": "skillSystem.10900101.skillLevel.values[0][0]"
  }
}
```

`projectSimulationResult.damageTimeline[]` 现在保留完整 `segment`，因此投影结果也能追溯倍率来源。

### 19.4 诊断码

- `skill-missing`：技能对象不存在。
- `skill-source-missing`：技能缺少本地来源路径。
- `skill-level-values-missing`：技能缺少等级倍率表。
- `skill-level-row-missing`：当前等级缺少倍率行。
- `skill-level-label-value-mismatch`：标签数量与倍率值数量不一致。
- `skill-damage-multiplier-unparseable`：某个倍率值无法解析为数字倍率。

### 19.5 当前边界

- 当前来源是 BWiki hero-module 聚合数据，虽然来自本地 AzPr 数据树，但还未与 `Assets/ResourcesAssets/Config/NewTable/skill_level.json` 做字段级交叉校验。
- 当前只解决倍率段来源和解析诊断，不解决真实命中帧、动画帧、取消窗口或完整伤害公式。

## 20. 2026-07-07 NewTable 技能等级交叉校验补充

阶段 5-2 新增 `skill-level-crosscheck.json`，用于把 hero-module 聚合技能倍率与本地 `NewTable/skill_level.json` 逐等级交叉校验。

### 20.1 来源字段

交叉校验使用两张本地表：

- 原始等级表：`C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\NewTable\skill_level.json`
- 简体中文语言表：`C:\PC2\Codex\AzPr\Assets\ResourcesLang\chs\Table\lang_skill_level.json`

`skill_level.json` 的 `name` 和 `value` 字段是 `|` 分隔的语言 ID；生成器会通过 `lang_skill_level.json` 还原为标签和倍率文本，再与 hero-module 聚合层的 `skillLevel.name` / `skillLevel.values` 比较。

### 20.2 生成文件

`src/data/generated/skill-level-crosscheck.json` 的单个技能结构：

```javascript
{
  "skillId": 10900101,
  "characterId": 109001,
  "status": "matched",
  "matchedLevelCount": 12,
  "levels": [
    {
      "level": 1,
      "levelIndex": 0,
      "rowId": 1657,
      "status": "matched",
      "fieldPaths": {
        "row": "skill_level.rows[id=1657]",
        "labels": "skill_level.rows[id=1657].name -> lang_skill_level",
        "values": "skill_level.rows[id=1657].value -> lang_skill_level",
        "description": "skill_level.rows[id=1657].skillDescribe -> lang_skill_level"
      },
      "labels": ["普攻", "重击", "闪击", "跃击"],
      "values": ["649%", "190%", "40%", "136%"],
      "labelIds": ["7116760813568", "7116760813569", "7116760813570", "7116760813571"],
      "valueIds": ["7116760813824", "7116760813825", "7116760813826", "7116760813827"],
      "matches": {
        "labels": true,
        "values": true
      },
      "diagnostics": []
    }
  ]
}
```

当前统计：

- `matchedSkills`: 118
- `missingSkills`: 0
- `mismatchedSkills`: 2
- `matchedLevels`: 998
- `missingLevels`: 0
- `mismatchedLevels`: 2

两个真实差异项是 `10800562`（卡塔露）和 `19900361`（诺诺），表现为 `lang_skill_level.json` 缺少对应语言 ID，导致 hero-module 聚合层仍保留语言 ID 文本。

### 20.3 `damageModel.crossCheck`

`createSkillDamageModel()` 现在会附带当前等级的 `crossCheck`：

```javascript
{
  "sourceKind": "azpr-newtable-skill-level-crosscheck",
  "status": "matched",
  "tablePath": "C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/skill_level.json",
  "langTablePath": "C:/PC2/Codex/AzPr/Assets/ResourcesLang/chs/Table/lang_skill_level.json",
  "skillId": 10900101,
  "characterId": 109001,
  "level": 1,
  "levelIndex": 0,
  "rowId": 1657,
  "labels": ["普攻", "重击", "闪击", "跃击"],
  "values": ["649%", "190%", "40%", "136%"],
  "matches": {
    "labels": true,
    "values": true
  }
}
```

`selectedDamageSegment.source.crossCheck` 和 `damageTimeline[].segment.source.crossCheck` 会保留单段的 `rowId`、`labelId`、`valueId`、字段路径和匹配状态。

### 20.4 新增诊断码

- `skill-level-crosscheck-skill-missing`：缺少技能 ID，无法查交叉校验。
- `skill-level-crosscheck-entry-missing`：生成索引中缺少该技能。
- `skill-level-crosscheck-level-missing`：生成索引中缺少该等级。
- `skill-level-crosscheck-row-missing`：原始 `skill_level.json` 缺少该技能行。
- `skill-level-crosscheck-level-row-missing`：原始 `skill_level.json` 缺少该等级行。
- `skill-level-crosscheck-lang-missing`：`lang_skill_level.json` 缺少 `name` 或 `value` 引用的语言 ID。
- `skill-level-crosscheck-label-mismatch`：还原标签与 hero-module 聚合标签不一致。
- `skill-level-crosscheck-value-mismatch`：还原倍率与 hero-module 聚合倍率不一致。

### 20.5 当前边界

- 本阶段确认的是技能等级显示倍率字段可信度，不代表真实命中帧、动作帧、取消窗口或完整伤害公式已经接入。
- `skill_level.coolDown` / `spCost` 仍按显示层处理，真实技能时序和资源逻辑需要继续向 `skillsub_logic`、技能 asset 或运行时捕获推进。

## 21. 2026-07-07 技能逻辑字段来源索引补充

阶段 5-3 新增 `skill-logic-index.json`，用于把当前角色技能的 `skill_level.subSkillId` 映射到 `skillsub_logic.json` 和 `skillsub_ele_value.json`。

### 21.1 来源字段

本阶段使用三张本地 NewTable：

- 技能等级表：`C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\NewTable\skill_level.json`
- 技能逻辑表：`C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\NewTable\skillsub_logic.json`
- 技能元素数值表：`C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\NewTable\skillsub_ele_value.json`

映射关系：

- `skill_level.skillId` 对应角色技能 ID。
- `skill_level.subSkillId` 对应 `skillsub_logic.skillId`。
- `skillsub_ele_value.skillId + level` 对应某个 `subSkillId` 在指定等级的数值参数。

### 21.2 生成文件

`src/data/generated/skill-logic-index.json` 的单个技能结构：

```javascript
{
  "skillId": 10900101,
  "characterId": 109001,
  "status": "mapped",
  "levelCount": 12,
  "subSkillIds": [10900101],
  "subSkills": [
    {
      "subSkillId": 10900101,
      "logic": {
        "cooldownMs": 0,
        "spCost": 0,
        "selfCooldownMs": 0,
        "publicCooldownMs": 0,
        "gcdMs": 0
      },
      "displayPairs": [
        {
          "cooldownMs": 0,
          "spCost": 0
        }
      ],
      "displayMatchesLogic": true
    }
  ],
  "levels": [
    {
      "level": 1,
      "skillLevelRowId": 1657,
      "subSkillId": 10900101,
      "display": {
        "cooldownMs": 0,
        "spCost": 0
      },
      "elementValues": [
        {
          "rowId": 973,
          "elementId": 109001081,
          "valueParam": "1#1600|7#10000"
        }
      ]
    }
  ]
}
```

当前统计：

- `mappedSkills`: 76
- `missingSkills`: 0
- `mismatchedSkills`: 44
- `subSkillIds`: 120
- `missingLogicRows`: 0
- `displayLogicMismatchSubSkills`: 44
- `levelRows`: 1000
- `elementValueRows`: 2808
- `levelsMissingElementValues`: 100
- `logicRowsWithNonZeroTiming`: 60

`displayLogicMismatchSubSkills` 是信息级诊断，不代表原表错误；它表示 `skill_level.coolDown/spCost` 与 `skillsub_logic.coolDown/spCost` 在字段语义上不同，排轴和模拟必须保留来源区别。

### 21.3 `logicModel` 结构

`createSkillAction()` 现在会附带 `logicModel`：

```javascript
{
  "sourceKind": "azpr-newtable-skill-logic-index",
  "status": "mapped",
  "skillId": 10900101,
  "level": 1,
  "subSkillId": 10900101,
  "skillLevelRowId": 1657,
  "display": {
    "sourceKind": "azpr-newtable-skill-level-display",
    "cooldownMs": 0,
    "spCost": 0,
    "fieldPaths": {
      "cooldownMs": "skill_level.rows[id=1657].coolDown",
      "spCost": "skill_level.rows[id=1657].spCost",
      "subSkillId": "skill_level.rows[id=1657].subSkillId"
    }
  },
  "logic": {
    "sourceKind": "azpr-newtable-skill-logic-index",
    "cooldownMs": 0,
    "spCost": 0,
    "selfCooldownMs": 0,
    "publicCooldownMs": 0,
    "gcdMs": 0,
    "fieldPaths": {
      "cooldownMs": "skillsub_logic.rows[skillId=10900101].coolDown",
      "spCost": "skillsub_logic.rows[skillId=10900101].spCost",
      "selfCooldownMs": "skillsub_logic.rows[skillId=10900101].selfCD",
      "gcdMs": "skillsub_logic.rows[skillId=10900101].GCD"
    }
  },
  "elementValues": [
    {
      "rowId": 973,
      "elementId": 109001081,
      "valueParam": "1#1600|7#10000",
      "params": [
        { "id": 1, "value": 1600 },
        { "id": 7, "value": 10000 }
      ]
    }
  ]
}
```

### 21.4 新增诊断码

- `skill-logic-skill-missing`：缺少技能 ID，无法解析逻辑字段。
- `skill-logic-entry-missing`：生成索引中缺少该技能。
- `skill-logic-level-missing`：生成索引中缺少该技能等级。
- `skill-logic-skill-level-missing`：`skill_level.json` 缺少该技能等级行。
- `skill-logic-row-missing`：`skillsub_logic.json` 缺少 `subSkillId` 对应逻辑行。
- `skill-display-logic-timing-mismatch`：显示层 `coolDown/spCost` 与逻辑层 `coolDown/spCost` 不一致。
- `skill-element-value-row-missing`：该等级没有 `skillsub_ele_value` 数值参数行。

### 21.5 当前边界

- 当前只建立字段来源和显示/逻辑区分，还没有把 `valueParam` 的参数 ID 解释为具体命中段、伤害类型、附着或资源效果。
- 真实命中帧、动画帧、取消窗口仍需继续从技能 asset、`skillsub_logic` 关联表或运行时捕获补齐。

## 22. 2026-07-07 Workbench 技能逻辑来源展示补充

阶段 5-4 没有新增草稿持久化字段，而是在 Workbench 动作详情中展示 `logicModel` 的派生信息。

### 22.1 展示字段

技能动作详情现在展示：

- `skill_level` 显示层：`display.cooldownMs`、`display.spCost`、`skillLevelRowId`。
- `skillsub_logic` 逻辑层：`logic.cooldownMs`、`logic.spCost`、`logic.selfCooldownMs`、`logic.gcdMs`。
- `skillsub_ele_value` 当前等级参数行：`rowId`、`elementId`、`valueParam`。
- `skill-display-logic-timing-mismatch`：当显示层与逻辑层冷却/能量不一致时，显示来源差异提示。

### 22.2 派生规则

- Workbench 草稿仍只保存 `actionDrafts[]` 中的技能 ID、等级、时间、伤害段等编辑字段。
- `logicModel` 会在 `createWorkbenchProject()` / `createSkillAction()` 时由当前技能和等级重新派生。
- 保存并恢复草稿后，逻辑来源展示会从重新编译的场景动作恢复，不写入 `workbench-draft`。

### 22.3 当前边界

- 本阶段只展示来源和差异，不解释 `valueParam` 参数 ID 的战斗语义。
- UI 中展示的逻辑层字段仍不代表真实命中帧、动画帧、取消窗口或完整伤害公式。

## 23. 2026-07-07 `valueParam` 与倍率段关联诊断补充

阶段 5-5 没有新增草稿持久化字段，而是在 `logicModel` 和倍率段来源中增加派生诊断信息。

### 23.1 `logicModel.valueParamSummary`

`createSkillLogicModel(skill, level, { damageModel })` 现在会解析当前等级 `skillsub_ele_value.valueParam`，并生成摘要：

```javascript
{
  "rowCount": 2,
  "paramCount": 4,
  "uniqueParamIds": [1, 7],
  "directMatchCount": 0,
  "linkedSegmentCount": 0,
  "unmatchedSegmentCount": 4,
  "unexplainedParamIds": [1, 7]
}
```

含义：

- `rowCount`：当前技能等级命中的 `skillsub_ele_value` 行数。
- `paramCount`：解析出的 `id#value` 参数对数量。
- `uniqueParamIds`：当前等级出现过的参数 ID。
- `directMatchCount`：与倍率段候选值直接匹配的参数数量。
- `linkedSegmentCount`：至少有一个直接参数匹配的倍率段数量。
- `unmatchedSegmentCount`：能解析倍率但没有直接参数匹配的倍率段数量。
- `unexplainedParamIds`：尚未被直接匹配解释的参数 ID。

### 23.2 `logicModel.damageParameterLinks[]`

每个倍率段会生成一条关联诊断：

```javascript
{
  "segmentIndex": 0,
  "label": "普攻",
  "rawValue": "649%",
  "multiplier": 6.49,
  "status": "unmatched",
  "candidates": [
    { "kind": "raw-number", "value": 649 },
    { "kind": "multiplier", "value": 6.49 },
    { "kind": "basis-points", "value": 64900 }
  ],
  "matches": [],
  "unmatchedParamIds": [1, 7]
}
```

当前候选值只做保守枚举：

- `raw-number`：去掉 `%` 后的原始数字，例如 `649`。
- `multiplier`：解析后的倍率，例如 `6.49`。
- `basis-points`：百分数字乘 100，例如 `64900`。
- `ten-thousand-ratio`：倍率乘 10000；与 `basis-points` 数值相同时会被去重。

只有 `valueParam` 参数值与上述候选值直接相等或近似相等时，`status` 才会变为 `matched`。当前首个技能 `10900101` 与差异技能 `10100712` 都是 `unmatched`，因此不能把 `valueParam` 直接作为倍率公式来源。

### 23.3 模拟与 UI 派生字段

模拟编译和投影会把当前伤害段的关联诊断挂到段来源上：

```javascript
{
  "valueParamLink": {
    "segmentIndex": 0,
    "rawValue": "649%",
    "status": "unmatched",
    "unmatchedParamIds": [1, 7]
  }
}
```

出现位置：

- `scenario.actions[].selectedDamageSegment.source.valueParamLink`
- `damageTimeline[].segment.source.valueParamLink`
- Workbench 技能逻辑来源区的当前倍率段关联提示

这些字段都由当前技能、等级、倍率段和 `logicModel` 派生，不写入 `workbench-draft`。

### 23.4 新增诊断码

- `skill-value-param-damage-segment-unmatched`：倍率段可解析，但没有与当前等级 `valueParam` 参数值建立直接数值匹配。
- `skill-value-param-damage-segment-unparseable`：倍率段无法解析为数值，无法参与直接匹配。

### 23.5 当前边界

- 本阶段只处理直接数值匹配，不解释参数 ID 的真实战斗语义。
- `unmatched` 是预期诊断，不代表数据错误；它提醒后续开发不能把未解释的 `valueParam` 写入伤害公式。
- 下一阶段需要建立参数 ID 词典，继续调查 `1`、`7` 等参数在本地表、技能描述和战斗逻辑中的来源含义。

## 24. 2026-07-07 `valueParam` 参数 ID 词典补充

阶段 5-6 新增一个小型生成索引，用于记录 `skillsub_ele_value.valueParam` 参数 ID 的公式槽位统计和当前语义状态。

### 24.1 新增生成文件

`src/data/generated/value-param-index.json`：

```javascript
{
  "sourceKind": "azpr-newtable-value-param-index",
  "source": {
    "skillLogicIndex": "skill-logic-index.json",
    "skillsubEleValueTable": "C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/skillsub_ele_value.json",
    "elementFormulaTable": "C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/element_formula.json"
  },
  "summary": {
    "parameterIds": 2,
    "observedParameterPairs": 5616,
    "observedElementValueRows": 2808,
    "observedSkills": 75,
    "formulaRows": 152,
    "unresolvedParameterIds": [1, 7],
    "constantParameterIds": [7]
  },
  "params": [
    {
      "id": 1,
      "variable": "A",
      "semanticStatus": "unresolved",
      "category": "varying-formula-slot"
    },
    {
      "id": 7,
      "variable": "G",
      "semanticStatus": "unresolved",
      "category": "constant-formula-slot",
      "isConstant": true
    }
  ]
}
```

`manifest.json` 新增：

```javascript
{
  "files": {
    "valueParamIndex": "value-param-index.json"
  },
  "counts": {
    "valueParamIndex": 2
  }
}
```

`validation-report.json` 新增 info 级提示：

- `skill-value-param-semantic-unresolved`：参数 ID 已建立公式槽位统计，但战斗语义仍未确认，不能直接写入伤害公式。

### 24.2 `logicModel.elementValues[].params[]`

参数解析结果现在会附带精简词典描述：

```javascript
{
  "id": 1,
  "value": 1600,
  "descriptor": {
    "sourceKind": "azpr-newtable-value-param-index",
    "id": 1,
    "variable": "A",
    "label": "参数 1 / A",
    "semanticStatus": "unresolved",
    "category": "varying-formula-slot",
    "roleHint": "当前技能范围内随技能和等级变化的公式槽位；战斗语义未确认。",
    "isConstant": false,
    "rowCount": 2808,
    "skillCount": 75,
    "elementCount": 234,
    "minValue": 200,
    "maxValue": 408450
  }
}
```

参数 `7` 的 `descriptor.category` 为 `constant-formula-slot`，`isConstant` 为 `true`，当前观测值恒为 `10000`。

### 24.3 `logicModel.valueParamSummary`

摘要新增：

```javascript
{
  "semanticStatusCounts": {
    "unresolved": 4
  },
  "unresolvedParamIds": [1, 7],
  "constantParamIds": [7]
}
```

这些字段由当前 `valueParam` 派生，不写入 `workbench-draft`。

### 24.4 Workbench 派生展示

Workbench 技能逻辑来源区现在会展示当前参数语义状态：

- `参数 1 / A：公式槽位，语义未确认`
- `参数 7 / G：恒定公式槽位，语义未确认`

### 24.5 当前边界

- `variable` 是基于 `element_formula.functionOutput` 中 A/G 等变量命名约定的槽位推断，不等同于已确认的战斗语义。
- `semanticStatus: "unresolved"` 是本阶段的安全默认值；后续只有找到 `elementId -> 公式/效果节点` 的证据后才能升级。
- 当前仍不能把参数 `1` 或 `7` 直接写入真实伤害公式。

## 25. 2026-07-07 角色当前数值面板补充

阶段 5-7 新增角色当前面板快照，先固定“技能倍率要乘哪个角色面板值”。

### 25.1 新增生成文件

`src/data/generated/character-attribute-panels.json`：

```javascript
{
  "sourceKind": "azpr-role-attribute-current-rank-panel",
  "source": {
    "referenceWorkbook": "C:/PC2/Codex/AzPr/BWiki/generated/spreadsheets/role-attribute-dynamic-current-rank.xlsx"
  },
  "policy": {
    "level": 80,
    "currentRank": 7,
    "currentRankRunes": "all-selected",
    "rankBonusIncludedThrough": 6
  },
  "summary": {
    "characters": 20,
    "attributesPerCharacter": 29,
    "panelRows": 580
  }
}
```

单角色条目包含：

- `core.attack`、`core.maxHp`、`core.physicalDefense`、`core.magicalDefense`、`core.tuningStrength`、`core.critRate`、`core.critDamage`、`core.damageAmplification`、`core.damageReduction`。
- `attributes[]`：完整 29 项展示属性，保留 `levelBase`、`starBase`、`fixedAdd`、`percentAddRaw`、`formulaRaw`、`fixedPanelValue`、`percentBonusValue`、`panelTotalValue`、`effectiveValue`、`displayText`。

`manifest.json` 新增：

```javascript
{
  "files": {
    "characterAttributePanels": "character-attribute-panels.json"
  },
  "counts": {
    "characterAttributePanels": 20
  }
}
```

`validation-report.json` 新增：

- `character-attribute-panel-missing`：正常时 `severity: "ok"`、`count: 0`。

### 25.2 Workbench seed 压缩面板

`workbench-seed.json.gameData.characters[].attributePanel` 只保留 UI 和当前 raw 投影需要的核心字段：

```javascript
{
  "level": 80,
  "currentRank": 7,
  "currentRankRunes": "all-selected",
  "rankBonusIncludedThrough": 6,
  "core": {
    "attack": {
      "name": "攻击",
      "effectiveValue": 1920,
      "displayText": "1920"
    }
  }
}
```

完整字段以 `character-attribute-panels.json` 为准，不在 seed 中重复展开。

### 25.3 Project / Actor / Simulation 字段

`createActorFromCharacter()` 新增：

```javascript
{
  "attributePanel": character.attributePanel ?? null
}
```

`compileActor().stats` 现在优先读取 `actor.attributePanel.core`：

```javascript
{
  "attack": 1920,
  "maxHp": 10748,
  "source": "character-attribute-panel-current-rank"
}
```

`damageTimeline[]` 新增：

```javascript
{
  "attack": 1920,
  "attackSource": "character-attribute-panel-current-rank"
}
```

当前 raw 投影公式版本改为：

```javascript
"stage5-current-panel-attack-multiplier-v1"
```

### 25.4 Workbench 展示

`PropertiesPanel` 新增“角色数值面板”派生展示：

- 来源：当前动作归属 actor 的 `attributePanel`。
- 展示：攻击、生命、物防、魔防、调谐、暴击率、暴击伤害、伤害增幅等核心属性。
- 不写入 `workbench-draft`。

### 25.5 当前边界

- 本阶段只解决角色面板值来源，不代表最终伤害公式完成。
- 当前排行口径固定为 80 级、临阶 7、当前阶星赐全选；后续配装/练度编辑需要新 schema。
- 防御、抗性、暴击、增伤、减伤、buff、装备、奇波、灵子仍需后续分层接入。

## 26. 2026-07-07 技能动作形态模型修正

本阶段修正技能倍率表语义：`skillLevel.name/value` 中的 `普攻`、`重击`、`闪击`、`跃击` 等不再视为“同一个技能的多段伤害”，而是技能可生成的动作形态。

### 26.1 Damage model 派生字段

`createSkillDamageModel()` 现在输出：

```javascript
{
  "sourceKind": "azpr-local-hero-module-skill-level-action-variant",
  "variants": [
    {
      "index": 0,
      "actionVariantIndex": 0,
      "kind": "normal-attack",
      "label": "普攻",
      "displayLabel": "普通攻击",
      "rawValue": "649%",
      "multiplier": 6.49,
      "hitModel": {
        "hitCount": 5,
        "distributionStatus": "total-only",
        "totalRawValue": "649%"
      }
    }
  ],
  "actionVariants": "<same as variants>",
  "segments": "<compat alias>"
}
```

兼容字段：

- `segments` 仍保留为 `variants` 的别名，避免旧编译和测试入口一次性断裂。
- `selectedDamageSegment` 仍保留为 `selectedActionVariant` 的兼容别名，后续可在项目 schema 版本升级时再清理命名。

### 26.2 草稿索引字段

技能动作草稿新增：

```javascript
{
  "actionVariantIndex": 1,
  "damageSegmentIndex": 1
}
```

- 新逻辑优先读取 `actionVariantIndex`。
- `damageSegmentIndex` 暂时保留并同步写入，用来兼容既有 `workbench-draft`。
- `skill-segment-split` 旧批次来源仍可读取；新生成批次来源为 `skill-action-variant-split`，并新增 `variantCount`，同时保留 `segmentCount`。

### 26.3 普攻段数来源

普攻多段不再来自 `skillLevel.values[0]` 的拆分，因为当前数据只有总倍率。

当前策略：

- 从技能描述的 `【普通攻击】` 段落解析 `进行至多五段的普通攻击`。
- 生成 `hitModel.hitCount = 5`。
- `hitModel.distributionStatus = "total-only"`，表示只有总倍率 `649%`，每段真实倍率仍未确认。
- 不编造 `普攻 1段` 至 `普攻 5段` 的单段倍率。

### 26.4 Workbench 展示

- 右侧属性面板从“伤害段”改为“动作形态”。
- 动作库批量入口从“拆段”改为“形态”，按 `variants` 生成动作。
- `valueParam` 关联提示从“倍率段”改为“动作形态倍率”。

### 26.5 当前边界

- 本阶段修正动作建模，不等于拿到了普攻每一段的真实倍率、命中帧或取消窗口。
- 当前 raw 投影仍使用所选动作形态的总倍率。
- 下一步真实伤害公式分层必须以 `actionVariantIndex + hitModel` 为输入，不能再把普攻、重击、闪击、跃击当成同一动作的多段命中。

## 27. 2026-07-07 Endaxis 风格动作目录与 60fps 时间基准

阶段 5-8B 新增 Workbench 交互适配层，目标是让动作库和时间轴颗粒度先对齐 Endaxis 的排轴体验。

### 27.1 时间基准

新增 `src/domain/timebase.js`：

```javascript
{
  "WORKBENCH_FPS": 60,
  "WORKBENCH_FRAME_MS": 16.666666666667
}
```

提供：

- `msToFrame(value)`：毫秒转最近帧数。
- `frameToMs(value)`：帧数转毫秒，并做浮点尾数规整。
- `snapMsToFrame(value)`：毫秒吸附到最近 1 帧。
- `formatFrameTime(value)`：显示为 `秒s帧f`，例如 `1s30f`。

Workbench 的新增动作、拖动吸附、持续时间编辑和批次快捷偏移都按该时间基准处理。

### 27.2 动作目录

新增 `src/domain/skillActionCatalog.js`，从 `getSkillActionVariants()` 派生可直接放入时间轴的动作目录：

```javascript
[
  "普通攻击",
  "重击",
  "闪击",
  "跃击",
  "星鸣技",
  "星结合击",
  "星决技",
  "星携技",
  "极限反击",
  "完美招架"
]
```

目录条目包含：

- `kind`：稳定动作类型，例如 `normal-attack`、`star-skill`。
- `label`：动作库显示名。
- `skillId`：底层真实技能 ID。
- `actionVariantIndex` / `damageSegmentIndex`：动作形态索引和兼容索引。
- `rawValue` / `multiplier` / `hitModel`：当前可用倍率与段数信息。
- `durationFrames` / `durationMs`：暂定默认动作长度。

### 27.3 过滤规则

动作目录只收录可进入时间轴的主动战斗动作。

不会列入动作库的项包括：

- 被动技能。
- 属性提升项，例如 `暴击率`、`攻击力`。
- 资源或蓄能提示项，例如 `星决蓄能`。
- 泛化效果项，例如 `伤害提升`。

### 27.4 当前边界

- `durationFrames` 只是交互占位默认值，不是正式动作帧、命中帧或取消窗口。
- 技能名仍作为底层数据来源保留，但动作库主显示以直接动作名为准。
- `damageSegmentIndex` 继续作为兼容字段保留，后续 schema 升级时再迁移到更干净的 action variant 命名。

## 28. 2026-07-07 伤害公式分层雏形

阶段 5-8C 将原先单一 `rawDamage = attack * multiplier` 投影改为结构化公式分层输出。当前仍是 raw 投影，但每一层是否已应用会明确记录。

### 28.1 公式版本

当前模拟公式版本：

```javascript
"stage5-damage-layer-breakdown-v1"
```

### 28.2 damageTimeline 字段

`damageTimeline[]` 新增：

```javascript
{
  "formulaVersion": "stage5-damage-layer-breakdown-v1",
  "formulaBreakdown": {
    "status": "partial",
    "expression": "round(baseAttack.value * actionMultiplier.value)",
    "result": 12461,
    "appliedLayerKeys": ["baseAttack", "actionMultiplier"],
    "unappliedLayerKeys": [
      "enemyDefense",
      "enemyResistance",
      "critical",
      "damageBonus"
    ],
    "layers": {
      "baseAttack": {
        "label": "角色当前攻击",
        "value": 1920,
        "source": "character-attribute-panel-current-rank",
        "applied": true
      },
      "actionMultiplier": {
        "label": "动作形态倍率",
        "value": 6.49,
        "rawValue": "649%",
        "actionVariantIndex": 0,
        "applied": true
      },
      "enemyDefense": {
        "label": "敌人防御",
        "applied": false,
        "status": "placeholder",
        "multiplier": 1,
        "defenseMultiplier": 1
      },
      "enemyResistance": {
        "applied": false,
        "status": "placeholder",
        "multiplier": 1
      },
      "critical": {
        "applied": false,
        "status": "placeholder",
        "multiplier": 1
      },
      "damageBonus": {
        "applied": false,
        "status": "placeholder",
        "multiplier": 1
      }
    }
  }
}
```

### 28.3 编译 stats 补充

`compileActor().stats` 新增：

```javascript
{
  "damageAmplification": 0,
  "damageReduction": 0
}
```

这两个字段来自角色当前面板 `attributePanel.core`，本阶段只进入 `damageBonus` 占位层，不参与最终伤害。

### 28.4 当前边界

- 只有 `baseAttack` 与 `actionMultiplier` 会参与当前 `rawDamage`。
- `enemyDefense.defenseMultiplier` 会保留 Workbench 敌人配置，但目前仍 `applied: false`。
- `enemyResistance`、`critical`、`damageBonus` 均是明确占位层，不得把它们解释为真实公式已完成。
- 下一步需要用本地数据证据确认敌人防御/抗性和 `elementId` 公式节点后，才能升级对应层的 `applied` 状态。

## 29. 2026-07-07 战斗公式证据索引

阶段 5-8D 新增 `src/data/generated/combat-formula-evidence.json`，用于把可确认的数据来源和仍缺失的公式链路分开记录。

### 29.1 新增生成文件

`manifest.json.files` 新增：

```javascript
{
  "combatFormulaEvidence": "combat-formula-evidence.json"
}
```

`validation-report.json.counts` 新增：

```javascript
{
  "combatFormulaEvidence": 152
}
```

`azprGenerated.js` 新增访问入口：

```javascript
getAzprCombatFormulaEvidence()
```

### 29.2 evidence summary

当前摘要：

```javascript
{
  "enemyCount": 208,
  "enemiesWithProperty": 199,
  "enemiesWithBaseDefense": 198,
  "enemiesWithElementDefense": 198,
  "enemiesWithWeakPointDamage": 198,
  "allElementValueRows": 13118,
  "currentSkillElementValueRows": 2808,
  "allUniqueElementIds": 1800,
  "currentSkillUniqueElementIds": 234,
  "elementFormulaRows": 152,
  "directAllElementFormulaIdMatches": 0,
  "directCurrentElementFormulaIdMatches": 0,
  "relationStatus": "no-direct-elementId-to-element_formula-id-match"
}
```

### 29.3 敌人属性证据链

敌人属性来源链：

```text
enemy.propertyId -> unit_property.baseAttributeId -> template_value.baseAttribute -> battle_info.attrVal
```

样例 `300032 迅狼`：

```javascript
{
  "baseDefenseValues": {
    "DEF": 9000,
    "MDEF": 9000
  },
  "elementDefenseValues": {
    "FIRE_DEFENSE": 0,
    "WIND_DEFENSE": 0,
    "WATER_DEFENSE": 0
  },
  "weakPointDamageValues": {
    "WDM_FIRE": 10000,
    "WDM_WATER": 10000,
    "WDM_DARK": 10000
  }
}
```

这证明敌人防御、元素减免和弱点倍率字段有本地表来源，但不证明最终伤害公式。

### 29.4 公式证据边界

`element_formula.json` 中已发现攻击/防御相关公式行，例如：

```javascript
[
  { "id": 2, "functionOutput": "(self.ATK[0]*A)/10000" },
  { "id": 23, "functionOutput": "(self.DEF[0]*A)/10000" },
  { "id": 101, "functionOutput": "(self.ATK[0]*A)/10000" }
]
```

但当前全量 `skillsub_ele_value.elementId` 与 `element_formula.id` 直接等值匹配数为 `0`，因此不能直接把这些公式行应用到技能伤害。

`validation-report.json` 新增 info 级诊断：

```javascript
{
  "code": "combat-formula-evidence-direct-link-missing",
  "severity": "info"
}
```

### 29.5 当前边界

- `combat-formula-evidence.json` 是证据索引，不是公式执行层。
- 当前 `formulaBreakdown.layers.enemyDefense` 和 `enemyResistance` 仍必须保持 `applied: false`。
- 下一步需要继续追踪 skill asset / effect node，把 `skillsub_ele_value.elementId` 连接到具体公式或效果节点。

## 30. 2026-07-07 公式证据 source 接入

阶段 5-8E 将 5-8D 的证据索引接入模拟结果，但不改变最终伤害公式。

### 30.1 `formulaBreakdown.layers.enemyDefense`

`enemyDefense.status` 从纯占位升级为：

```javascript
"evidence-found-formula-unmapped"
```

`enemyDefense.source` 由字符串升级为对象：

```javascript
{
  "kind": "azpr-combat-formula-evidence-index",
  "file": "src/data/generated/combat-formula-evidence.json",
  "status": "enemy-property-attributes-found",
  "formulaStatus": "formula-rows-found-without-elementId-direct-link",
  "relationStatus": "no-direct-elementId-to-element_formula-id-match",
  "sourceChain": "enemy.propertyId -> unit_property.baseAttributeId -> template_value.baseAttribute -> battle_info.attrVal",
  "propertyId": 300032,
  "baseAttributeId": 300032,
  "attributeValues": [
    { "key": "DEF", "value": 9000 },
    { "key": "MDEF", "value": 9000 }
  ]
}
```

`defenseMultiplier`、`physicalDefense`、`magicalDefense` 仍保留在 layer 顶层，且 `applied` 仍为 `false`。

### 30.2 `formulaBreakdown.layers.enemyResistance`

`enemyResistance.status` 同样为：

```javascript
"evidence-found-formula-unmapped"
```

`enemyResistance.source` 记录动作元素和敌人元素防御字段：

```javascript
{
  "kind": "azpr-combat-formula-evidence-index",
  "file": "src/data/generated/combat-formula-evidence.json",
  "elementValueStatus": "element-values-have-params-but-no-direct-formula-id-link",
  "actionElementId": 4,
  "attributeValues": [
    { "key": "NORMAL_DEFENSE", "value": 0 },
    { "key": "FIRE_DEFENSE", "value": 0 }
  ]
}
```

`actionElementId` 只记录动作元素，不代表已经确认应套用哪个元素防御字段。

### 30.3 兼容边界

- `source` 的类型从字符串变为对象，读取方应按对象处理；若旧逻辑只展示 source 文本，需要先做格式化。
- 最终伤害仍是 `round(baseAttack.value * actionMultiplier.value)`。
- `appliedLayerKeys` 仍只有 `baseAttack` 和 `actionMultiplier`；`enemyDefense` / `enemyResistance` 仍在 `unappliedLayerKeys`。
- 下一步应生成 skill asset / effect node 候选索引，继续追踪 `skillsub_ele_value.elementId` 到真实公式节点的链路。

## 31. 2026-07-07 技能资源证据索引

阶段 5-8F 新增 `src/data/generated/skill-asset-evidence.json`，用于把表格层技能引用、AzPr Assets 缺口和 AzPr Extractor Unity 技能控制资源连接起来。

### 31.1 新增生成文件

`manifest.json.files` 新增：

```javascript
{
  "skillAssetEvidence": "skill-asset-evidence.json"
}
```

`validation-report.json.counts` 新增：

```javascript
{
  "skillAssetEvidence": 116
}
```

### 31.2 `skill-asset-evidence.json` 摘要

```javascript
{
  "sourceKind": "azpr-skill-asset-evidence-index",
  "summary": {
    "skillTableRows": 3200,
    "currentSkillCount": 120,
    "currentSkillsWithSkillTableRow": 120,
    "currentSkillsWithExtractedSkillControl": 116,
    "currentSkillsMissingExtractedSkillControl": 4,
    "skillBytesPathOwnerRows": 646,
    "uniqueSkillBytesPaths": 682,
    "existingSkillBytesPathsInAzPrAssets": 0,
    "extractedSkillControlDirectories": 4134,
    "relationStatus": "skill-control-assets-found-in-azpr-extractor"
  }
}
```

### 31.3 路径探测规则

当前探测结果：

```javascript
{
  "azprSkillRoot": {
    "path": "C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/Battle/Skill",
    "exists": false
  },
  "azprSkillPreloadRoot": {
    "path": "C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/Battle/SkillPreload",
    "exists": false
  },
  "extractorSkillListRoot": {
    "path": "C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList",
    "exists": true
  }
}
```

因此后续规则为：

- 表格和 Lua 缺失时，使用 AzPr Extractor 的 `raw_nostreaming_package` 导出流程补 `C:/PC2/Codex/AzPr/Assets`。
- Unity 技能、动作、效果资源缺失时，使用 AzPr Extractor 的 Unity/default_package 导出结果，当前入口是 `SkillList/skill_control_*.asset`。
- 不把 `skillBytesPath` 字符串当作已存在文件；必须检查实际路径或 Extractor 输出。

### 31.4 当前缺口

当前 4 个技能没有匹配到 `skill_control_*.asset`：

```javascript
[10101062, 10700262, 10800562, 11200262]
```

`skill_control` MonoBehaviour 样本已记录 `startFrame`、`endFrame`、`frameCount`、`eventType`、`eventID`、`elementList` 等候选字段，但尚未解析引用关系，也尚未确认这些节点与 `skillsub_ele_value.elementId` 或 `element_formula.id` 的最终映射。

### 31.5 数据入口

`src/data/azprGenerated.js` 新增：

```javascript
getAzprSkillAssetEvidence()
```

读取方应把它作为证据索引使用；在阶段 5-8G 之前，不应把其中的帧范围直接当成最终动作时长或命中帧。

## 32. 2026-07-07 每动作三值结果契约

阶段 5-8G 新增 `simulationResult.actionResultTimeline[]`，用于保证每个动作都同时追踪三类数值变化：

- 敌人 HP 伤害。
- 敌人韧性削减。
- 自身能量变化。

### 32.1 新增顶层字段

`projectSimulationResult()` 输出新增：

```javascript
{
  "actionResultTimeline": [
    {
      "actionId": "action-0001",
      "actionType": "skill",
      "hpDamage": {},
      "toughnessDamage": {},
      "selfEnergyChange": {}
    }
  ]
}
```

旧字段 `damageTimeline` 和 `resourceTimeline` 保留，作为兼容和专门视图使用；后续工作台分析面板应优先按 `actionResultTimeline` 展示动作级结果。

### 32.2 `hpDamage`

当前 HP 伤害沿用已有 raw 投影：

```javascript
{
  "value": 12461,
  "applied": true,
  "status": "raw-hp-projection",
  "formulaBreakdown": {
    "expression": "round(baseAttack.value * actionMultiplier.value)"
  }
}
```

这仍不是最终实战伤害公式；防御、抗性、暴击、增伤等层仍保持未应用。

### 32.3 `toughnessDamage`

当前削韧固定独立占位：

```javascript
{
  "value": 0,
  "applied": false,
  "status": "formula-unmapped",
  "formulaBreakdown": {
    "unappliedLayerKeys": [
      "actionToughnessValue",
      "enemyToughnessState",
      "weaknessOrBreakModifier"
    ]
  }
}
```

削韧公式不得从 HP 伤害公式直接推导；必须后续从 `skill_control`、效果节点、敌人韧性字段或相邻 battle 表中确认。

### 32.4 `selfEnergyChange`

当前自身能量变化会应用显式资源变化，例如技能 `spCost` 或手动资源动作：

```javascript
{
  "value": -30,
  "applied": true,
  "status": "explicit-cost-applied-charge-formula-unmapped",
  "formulaBreakdown": {
    "appliedLayerKeys": ["explicitResourceDelta"],
    "unappliedLayerKeys": [
      "actionChargeGain",
      "hitEnergyGain",
      "passiveEnergyModifiers"
    ]
  }
}
```

充能获取公式仍未确认；显式消耗和手动资源变化只是已知 delta，不能代表完整自身能量公式。

### 32.5 摘要字段

`summary` 新增：

```javascript
{
  "actionResultCount": 1,
  "totalProjectedToughnessDamage": 0,
  "totalSelfEnergyDelta": 0,
  "selfEnergyDeltaByActor": [
    {
      "actorId": "actor-109001",
      "actorName": "末音",
      "resource": "sp",
      "delta": 0
    }
  ]
}
```

当前 `totalProjectedToughnessDamage` 为占位汇总，后续解析削韧公式后才会有真实含义。

### 32.6 Endaxis 参考边界

这类结果曲线可以参考 Endaxis/终末地：

- `stagger` 作为失衡/韧性类指标。
- `spRecovery`、`spReturn` 作为角色 SP 变化指标。
- 时间轴上多条曲线、标签和命中点并行展示的方式。

但机制来源必须保持蓝色星原优先：

- 蓝色星原韧性值只可类比终末地失衡值，不可直接复用终末地公式。
- 自身能量类似 SP，但必须按角色 actor 独立记录。
- 削韧、充能和 HP 伤害需要分别从蓝原表、`skill_control`、效果节点或运行时证据确认。

## 33. 2026-07-07 skill_control 效果轨道候选分类

阶段 5-8H 在 `skill-asset-evidence.json` 中新增效果轨道候选字段，用于把 `skill_control` MonoBehaviour 样本先按用途分组，供下一阶段解引用行为链。

### 33.1 summary 新增字段

`skill-asset-evidence.json.summary` 新增：

```javascript
{
  "effectLaneCandidateSkills": {
    "hpDamage": 1,
    "toughnessDamage": 0,
    "selfEnergyChange": 1,
    "elementEffect": 3,
    "timingControl": 4,
    "presentation": 4
  },
  "hpDamageCandidateSkills": 1,
  "toughnessCandidateSkills": 0,
  "selfEnergyCandidateSkills": 1
}
```

这些计数表示“当前抽样中至少出现过该类候选轨道的当前技能数量”，不是完整技能覆盖率，也不是公式确认数。

### 33.2 技能证据项新增字段

`currentSkillControlEvidence[]` 的 `found` 项新增：

```javascript
{
  "effectLaneCandidateSummary": {
    "hpDamage": {
      "label": "敌人 HP 伤害",
      "count": 5
    },
    "toughnessDamage": {
      "label": "敌人韧性削减",
      "count": 0
    },
    "selfEnergyChange": {
      "label": "自身能量变化",
      "count": 0
    }
  },
  "effectLaneCandidates": [
    {
      "type": "timeline-control",
      "laneHints": ["hpDamage"],
      "laneHintSource": "name-trackName-string-pattern",
      "file": "MonoBehaviour_-2219364397070875723__-2219364397070875723.json",
      "name": "攻击碰撞",
      "trackName": "攻击碰撞",
      "startFrame": 19,
      "endFrame": 20,
      "behaviorListCount": 1
    }
  ]
}
```

### 33.3 分类维度

当前固定六类候选：

| key | 含义 |
| --- | --- |
| `hpDamage` | 敌人 HP 伤害候选，例如 `攻击碰撞`、`damage`、`hit` |
| `toughnessDamage` | 敌人韧性/失衡削减候选 |
| `selfEnergyChange` | 自身能量/充能变化候选 |
| `elementEffect` | 元素或属性效果候选 |
| `timingControl` | 动作、跳转、打断、连击、位移等时序控制候选 |
| `presentation` | SFX、特效、镜头、VO、武器等表现资源候选 |

分类依据是 JSON 解析后的 `name`、`trackName` 和字符串字段模式匹配。直接文本搜索可能漏掉 Unity JSON 中转义的中文字段，因此不能作为唯一依据。

### 33.4 当前边界

- `effectLaneCandidates` 是追踪入口，不是最终命中帧、削韧帧、充能帧或公式节点。
- `laneHints` 可以多值，表示同一个 MonoBehaviour 候选可能同时命中多个分类模式。
- 下一阶段必须解引用 `behaviorList`、PathID、MonoBehaviour 引用和相邻资源，才能确认真实行为对象。
- 未出现 `toughnessDamage` 或 `selfEnergyChange` 候选不代表游戏没有削韧/充能机制，只表示当前抽样和当前模式尚未定位到明确字段。

## 34. 2026-07-07 skill_control 本地行为链解引用

阶段 5-8I 在 `skill-asset-evidence.json` 中新增本地行为链证据，用于记录 `timeline control -> behaviorList -> target MonoBehaviour` 的可解析链路。

### 34.1 summary 新增字段

`skill-asset-evidence.json.summary` 新增：

```javascript
{
  "behaviorReferenceResolvedSkills": 5,
  "hpDamageBehaviorReferenceResolvedSkills": 1,
  "externalElementBaseReferenceSkills": 1
}
```

这些计数表示当前抽样中：

- 至少有一个 `behaviorList` 引用能解到本地 MonoBehaviour 的当前技能数。
- 至少有一个 HP 伤害候选行为链能解到本地 MonoBehaviour 的当前技能数。
- 至少有一个行为对象包含外部 `elementBaseDatas` 引用的当前技能数。

### 34.2 技能证据项新增字段

`currentSkillControlEvidence[]` 的 `found` 项新增：

```javascript
{
  "behaviorReferenceSummary": {
    "behaviorListRefs": 36,
    "resolvedBehaviorListRefs": 36,
    "unresolvedBehaviorListRefs": 0,
    "externalElementBaseRefs": 13,
    "resolvedBehaviorRefsByLane": {
      "hpDamage": 5,
      "toughnessDamage": 0,
      "selfEnergyChange": 0,
      "elementEffect": 6,
      "timingControl": 5,
      "presentation": 20
    }
  },
  "effectLaneBehaviorChains": [
    {
      "laneHints": ["hpDamage"],
      "sourceFile": "MonoBehaviour_-2219364397070875723__-2219364397070875723.json",
      "sourceName": "攻击碰撞",
      "sourceStartFrame": 19,
      "sourceEndFrame": 20,
      "behaviorRefs": [
        {
          "fileId": 0,
          "pathId": "1081335820946113461",
          "roundedPathId": "1081335820946113400",
          "targetFile": "MonoBehaviour_1081335820946113461__1081335820946113461.json",
          "status": "resolved-local-monoBehaviour"
        }
      ],
      "resolvedBehaviors": [
        {
          "pathId": "1081335820946113461",
          "scriptPathId": "8289252000250858251",
          "startFrame": 19,
          "frameCount": 1,
          "collisionLayer": 5,
          "elementalType": 1023,
          "targetType": 1,
          "externalElementBaseRefCount": 3
        }
      ]
    }
  ]
}
```

### 34.3 PathID 精度规则

Unity `m_PathID` 是 64 位整数，JavaScript `JSON.parse` 会把它读成普通 `Number` 并丢失低位精度。因此新增字段遵循：

- `pathId`：从文件名或原始 JSON 文本中抽取的精确字符串，作为证据记录使用。
- `roundedPathId`：由 `JSON.parse` 后的 Number 转成字符串，仅用于说明本次匹配经历了 JS 精度折损。
- 生成器用 `roundedPathId` 反查同目录文件索引，但输出必须保留精确 `pathId`。

### 34.4 当前边界

- `resolved-local-monoBehaviour` 只说明 `behaviorList` 能解到同目录目标 MonoBehaviour，不说明目标行为已经等于伤害公式。
- `scriptPathId = 8289252000250858251` 是识别行为类型的强线索，但仍需脚本类型名、更多样本或 typetree 证据确认。
- `elementBaseDatas[].fileId = 2` 表示外部文件引用，当前不在同目录 JSON 中；下一阶段必须追 bundle 外部对象或 Extractor 索引。
- 削韧和自身能量仍未在本地行为链中确认，不得从 HP 碰撞行为推导。

## 35. 2026-07-07 elementBaseDatas 资源映射归属

阶段 5-8J 在 `skill-asset-evidence.json` 中新增 `skillResourceMapEvidence`，并把行为对象里的外部 `elementBaseDatas` 引用匹配回根 `skillResourceMaps[].elements`。

### 35.1 summary 新增字段

`skill-asset-evidence.json.summary` 新增：

```javascript
{
  "resourceMapMatchedElementBaseReferenceSkills": 1,
  "resourceMapUnmatchedElementBaseReferenceSkills": 0
}
```

含义：

- `resourceMapMatchedElementBaseReferenceSkills`：至少一个外部 `elementBaseDatas` 引用能匹配到根 `skillResourceMaps[].elements` 的当前技能数。
- `resourceMapUnmatchedElementBaseReferenceSkills`：至少一个外部 `elementBaseDatas` 引用仍无法匹配根资源映射的当前技能数。

### 35.2 技能证据项新增字段

`currentSkillControlEvidence[]` 的 `found` 项新增：

```javascript
{
  "skillResourceMapEvidence": {
    "status": "root-skillResourceMaps-found",
    "file": "skill_control_10900101__-2033047303768548289.json",
    "resourceMapCount": 2,
    "elementRefCount": 8,
    "resourceMaps": [
      {
        "index": 0,
        "skillIds": [10900101],
        "subSkillIds": [10900101],
        "stateNames": ["Skill0_1"],
        "hitEffects": ["11_109001_116"]
      },
      {
        "index": 1,
        "skillIds": [10900101],
        "subSkillIds": [109001011],
        "stateNames": ["Skill0_6"],
        "hitEffects": ["11_109001_133", "11_109001_005"]
      }
    ]
  }
}
```

`behaviorReferenceSummary` 新增：

```javascript
{
  "resourceMapMatchedElementBaseRefs": 13,
  "resourceMapUnmatchedElementBaseRefs": 0
}
```

`elementBaseDataRefs[]` 新增：

```javascript
{
  "fileId": 2,
  "pathId": "-5633710717881758712",
  "roundedPathId": "-5633710717881759000",
  "resourceMapMatchCount": 1,
  "resourceMapMatches": [
    {
      "resourceMapIndex": 1,
      "subSkillIds": [109001011],
      "stateNames": ["Skill0_6"],
      "hitEffects": ["11_109001_133", "11_109001_005"]
    }
  ]
}
```

### 35.3 当前边界

- `resourceMapMatches` 只证明外部 element 引用属于哪组 `skillResourceMaps`，不证明已经解析了 element 对象本体。
- `effects` / `hitEffects` 是资源名线索，不等同于伤害公式、削韧公式或充能公式。
- 这些资源映射帮助缩小追踪范围：下一步应沿 `subSkillId`、`stateName`、`hitEffects` 和 element PathID 继续找对象结构。
- 当前仍不能把 `elementBaseDatas` 直接映射到 `skillsub_ele_value.elementId` 或 `valueParam`。

## 36. 2026-07-07 行为脚本类型候选和 element 类型目录

阶段 5-8K 在 `skill-asset-evidence.json` 中新增行为脚本类型候选和 IL2CPP element 类型候选目录，用于继续追踪 HP 伤害、削韧和自身能量的真实效果节点。

### 36.1 summary 新增字段

`skill-asset-evidence.json.summary` 新增：

```javascript
{
  "scriptTypeCandidateSkills": 1,
  "elementTypeCatalogCandidates": 2
}
```

含义：

- `scriptTypeCandidateSkills`：至少一个已解出的行为对象带有 `scriptTypeCandidate` 的当前技能数。
- `elementTypeCatalogCandidates`：当前固化到 IL2CPP 类型目录中的候选类型数量。

### 36.2 顶层新增 elementTypeCatalogEvidence

```javascript
{
  "elementTypeCatalogEvidence": {
    "status": "il2cpp-element-type-candidates-found",
    "source": "C:/Codex/AzPr Extractor/outputs/il2cpp-dump/dump.cs",
    "elementTypes": [
      {
        "role": "self-energy-change",
        "className": "TSpElementParams",
        "label": "能量",
        "typeDefIndex": 9754,
        "baseType": "TElementParams",
        "evidenceKind": "config-element-params"
      },
      {
        "role": "hp-damage-runtime",
        "className": "DamageElement",
        "typeDefIndex": 6976,
        "baseType": "BaseElement",
        "evidenceKind": "runtime-element"
      }
    ]
  }
}
```

### 36.3 resolvedBehaviors 新增 scriptTypeCandidate

`effectLaneBehaviorChains[].resolvedBehaviors[]` 在字段签名吻合时新增：

```javascript
{
  "scriptPathId": "8289252000250858251",
  "scriptTypeCandidate": {
    "status": "field-signature-matched",
    "confidence": "medium",
    "className": "InjectToTargetKeyFrameBehaviorData",
    "typeDefIndex": 7239,
    "baseType": "SkillBehaviorData",
    "interfaces": ["IElementSkillBehaviourData"],
    "matchedFields": [
      "collisionLayer",
      "elementalType",
      "targetType",
      "elementBaseDatas",
      "toOwnElementBaseDatas",
      "damageEffectId"
    ]
  }
}
```

`behaviorReferenceSummary` 新增：

```javascript
{
  "scriptTypeCandidateBehaviorRefs": 5
}
```

### 36.4 当前边界

- `scriptTypeCandidate` 是 `scriptPathId` 加导出字段签名的候选，不是直接 MonoScript 资源名解析。
- `elementTypeCatalogEvidence` 只是后续查找对象体的类型目录，不证明 `m_FileID = 2` 外部对象已经被解析。
- 仍必须继续解析 bundle 外部对象表，才能确认 `elementId`、`valueParam`、削韧、充能或公式 ID。

## 37. 2026-07-07 external element 对象本体摘要

阶段 5-8L 在 `skill-asset-evidence.json` 中新增 `externalElementObjectEvidence`，用于把 `skill_control` 中的 `m_FileID = 2` external element PathID 解析到 `d_assets_resourcesassets_config_battle_element_assets` 共享对象池。

### 37.1 summary 新增字段

`skill-asset-evidence.json.summary` 新增：

```javascript
{
  "externalElementObjectResolvedSkills": 1,
  "externalElementObjectResolvedRefs": 8,
  "externalElementObjectUnresolvedRefs": 0
}
```

含义：

- `externalElementObjectResolvedSkills`：至少一个 external element 对象本体已解析的当前技能数。
- `externalElementObjectResolvedRefs`：已解析到对象本体的 PathID 数量。
- `externalElementObjectUnresolvedRefs`：仍未解析到对象本体的 PathID 数量。

### 37.2 顶层新增 externalElementObjectEvidence

```javascript
{
  "externalElementObjectEvidence": {
    "status": "element-objects-resolved",
    "summary": {
      "skillCount": 1,
      "resolvedSkills": 1,
      "requestedPathIds": 8,
      "resolvedPathIds": 8,
      "unresolvedPathIds": 0
    },
    "skills": [
      {
        "skillId": 10900101,
        "skillControlBundle": {
          "bundleIndex": 75402,
          "logicalName": "d_assets_resourcesassets_config_battle_skilllist_skill_control_10900101",
          "packName": "ypm6fu6ccxdszvz7zhuinq"
        },
        "elementAssetsBundle": {
          "bundleIndex": 74227,
          "logicalName": "d_assets_resourcesassets_config_battle_element_assets"
        },
        "scriptClassCounts": {
          "TDamageElementParams": 3,
          "TFxElementParams": 2,
          "TFreezeFrameElementParams": 2,
          "TBuffElementParams": 1
        }
      }
    ]
  }
}
```

### 37.3 对象摘要字段

`externalElementObjectEvidence.skills[].objects[]` 的关键字段：

```javascript
{
  "pathId": "-5633710717881758712",
  "status": "resolved-in-element-assets-bundle",
  "containerPath": "Assets/ResourcesAssets/Config/Battle/Element/Assets/ast_109001251.asset",
  "scriptPathId": "3156599909451817364",
  "elementConfigId": 109001251,
  "scriptTypeCandidate": {
    "className": "TDamageElementParams",
    "typeDefIndex": 9720
  },
  "formulaParams": {
    "function_1": 1,
    "function_2": 2,
    "formulaParamValues": [1000, 3000, 0, 0, 0, 8500, 10000, 10000]
  },
  "damageFields": {
    "weakBreakDamageRate": 7000,
    "recoverSP": 5899,
    "petRecoverSP": 22999,
    "recoverInterval": 9999
  },
  "mediaPackNames": ["11_109001_133"]
}
```

### 37.4 当前边界

- 已解析对象本体，不等于已确认最终公式。
- `TDamageElementParams` 中的 `formulaParams`、`weakBreakDamageRate`、`recoverSP`、`petRecoverSP` 是 HP、削韧、充能三条计算链的候选字段。
- 下一阶段必须确认这些字段的缩放、触发次数、目标归属和与 `skillsub_ele_value` / `element_formula` 的关系。

## 38. 2026-07-07 TDamageElementParams 三值字段映射摘要

阶段 5-8M 在 `skill-asset-evidence.json` 中新增 `damageElementFieldMappingEvidence`，用于把已解析出的 `TDamageElementParams` 对象拆成 HP 伤害、敌人韧性削减、自身能量变化三条候选链。

### 38.1 summary 新增字段

`skill-asset-evidence.json.summary` 新增：

```javascript
{
  "damageElementFieldMappedSkills": 1,
  "damageElementFieldMappedObjects": 3,
  "hpDamageFieldCandidateRefs": 3,
  "toughnessDamageFieldCandidateRefs": 3,
  "selfEnergyFieldCandidateRefs": 3,
  "damageElementSkillLogicBridgeMatches": 2
}
```

含义：

- `damageElementFieldMappedSkills`：存在 `TDamageElementParams` 字段映射的当前技能数。
- `damageElementFieldMappedObjects`：已映射的 `TDamageElementParams` 对象数。
- `hpDamageFieldCandidateRefs`：HP 伤害候选字段引用数。
- `toughnessDamageFieldCandidateRefs`：敌人韧性削减候选字段引用数。
- `selfEnergyFieldCandidateRefs`：自身能量变化候选字段引用数。
- `damageElementSkillLogicBridgeMatches`：同 elementId 能桥接到 `skill-logic-index.json.levels.elementValues` 的对象数。

### 38.2 顶层新增 damageElementFieldMappingEvidence

```javascript
{
  "damageElementFieldMappingEvidence": {
    "status": "damage-element-field-candidates-found",
    "summary": {
      "skillCount": 1,
      "mappedSkills": 1,
      "damageElementObjects": 3,
      "hpDamageCandidateRefs": 3,
      "toughnessDamageCandidateRefs": 3,
      "selfEnergyCandidateRefs": 3,
      "skillsubElementBridgeMatchedObjects": 2,
      "skillsubElementBridgeMissingObjects": 1,
      "skillsubElementBridgeLevelRows": 24
    }
  }
}
```

### 38.3 fieldMappings 对象摘要

`damageElementFieldMappingEvidence.skills[].fieldMappings[]` 的关键字段：

```javascript
{
  "elementConfigId": 109001081,
  "hpDamage": {
    "status": "candidate-from-TDamageElementParams-formulaParams",
    "formulaFunctionIds": {
      "function_1": 1,
      "function_2": 2
    },
    "formulaSlotCandidates": [
      { "slot": 1, "variable": "A", "rawValue": 1000 },
      { "slot": 2, "variable": "B", "rawValue": 1900 },
      { "slot": 6, "variable": "F", "rawValue": 2500 },
      { "slot": 7, "variable": "G", "rawValue": 10000 }
    ]
  },
  "toughnessDamage": {
    "status": "candidate-from-TDamageElementParams-weak-break-fields",
    "weakBreakDamageRate": 7000,
    "hitType": 1,
    "knockBackId": 1,
    "knockBackForce": 1
  },
  "selfEnergyChange": {
    "status": "candidate-from-TDamageElementParams-recover-sp-fields",
    "recoverSP": 2700,
    "petRecoverSP": 10399,
    "recoverInterval": 9999
  }
}
```

### 38.4 skillLevelBridge 摘要

当 `elementConfigId` 能在当前技能等级值中找到同 elementId 时，`skillLevelBridge` 会记录等级桥接：

```javascript
{
  "status": "skillsub-element-level-bridge-found",
  "elementConfigId": 109001081,
  "levelRows": 12,
  "parameterIds": [1, 7],
  "varyingParameterIds": [1],
  "firstLevel": {
    "level": 1,
    "valueParam": "1#1600|7#10000"
  },
  "lastLevel": {
    "level": 12,
    "valueParam": "1#3360|7#10000"
  },
  "formulaParamAlignment": {
    "status": "same-element-id-found-slot-alignment-unverified",
    "firstLevelDirectSlotMatches": [7],
    "firstLevelMismatches": [
      {
        "id": 1,
        "variable": "A",
        "skillsubValue": 1600,
        "formulaParamValue": 1000
      }
    ]
  }
}
```

### 38.5 当前边界

- `damageElementFieldMappingEvidence` 是字段候选映射，不是最终公式。
- `skillsub_ele_value.valueParam` 已能桥接部分 elementId 的等级值，但 `valueParam` 与 `formulaParamValues` 的覆盖关系、缩放关系和公式输入顺序仍未确认。
- 下一阶段应把这些候选字段接入 `actionResultTimeline[]` source 层和 Workbench 展示层，保持未确认公式 `applied: false`，再继续验证 HP、削韧、充能三条最终计算链。

## 39. 2026-07-08 actionResultTimeline 三值 sourceEvidence 摘要

阶段 5-8N 把 `damageElementFieldMappingEvidence` 接入 `simulationResult.actionResultTimeline[]`。每个动作的 HP 伤害、敌人韧性削减、自身能量变化三槽都可以携带 `sourceEvidence`，用于说明当前动作能追溯到哪些 `TDamageElementParams` 候选字段。

### 39.1 hpDamage.sourceEvidence

```javascript
{
  "hpDamage": {
    "value": 12461,
    "applied": true,
    "status": "raw-hp-projection",
    "sourceEvidence": {
      "kind": "azpr-damage-element-field-mapping-evidence",
      "file": "src/data/generated/skill-asset-evidence.json",
      "status": "candidate-fields-found",
      "skillId": 10900101,
      "actionVariantIndex": 0,
      "actionVariantLabel": "普攻",
      "logicElementIds": [109001081, 109001306],
      "matchedElementConfigIds": [109001081, 109001306],
      "unbridgedElementConfigIds": [109001251],
      "candidateCount": 2,
      "bridgeMatchedLevelRows": 24
    }
  }
}
```

HP 槽仍使用当前 raw 投影值；`sourceEvidence` 只是候选字段来源。`hpDamage.formulaBreakdown.layers.damageElementFields` 会把这些候选字段作为未应用层记录。

### 39.2 toughnessDamage.sourceEvidence

```javascript
{
  "toughnessDamage": {
    "value": 0,
    "applied": false,
    "status": "candidate-fields-found-formula-unmapped",
    "sourceEvidence": {
      "status": "candidate-fields-found",
      "candidateCount": 2,
      "candidates": [
        {
          "elementConfigId": 109001081,
          "fieldCandidate": {
            "weakBreakDamageRate": 7000,
            "hitType": 1,
            "knockBackId": 1,
            "knockBackForce": 1
          }
        }
      ]
    }
  }
}
```

削韧槽找到候选字段后会从纯 `formula-unmapped` 升级为 `candidate-fields-found-formula-unmapped`，但仍保持 `applied: false` 和 `value: 0`。

### 39.3 selfEnergyChange.sourceEvidence

```javascript
{
  "selfEnergyChange": {
    "value": 0,
    "applied": false,
    "status": "candidate-fields-found-charge-formula-unmapped",
    "sourceEvidence": {
      "status": "candidate-fields-found",
      "candidateCount": 2,
      "candidates": [
        {
          "elementConfigId": 109001081,
          "fieldCandidate": {
            "recoverSP": 2700,
            "petRecoverSP": 10399,
            "recoverInterval": 9999
          }
        }
      ]
    }
  }
}
```

若动作同时有显式 SP 消耗，`selfEnergyChange.value` 仍只应用显式资源 delta，`sourceEvidence` 只说明后续充能公式候选字段。

### 39.4 Workbench 展示

Workbench 分析面板新增“三值来源”列表，当前展示：

- 每个动作的 HP / 削韧 / 充能候选数量。
- 已桥接的 elementId，例如 `109001081, 109001306`。
- 当前动作三值结果摘要，例如 `伤害 12,461 · 韧性 0 · 能量 0`。

### 39.5 当前边界

- `sourceEvidence` 不是最终公式结果，只证明动作级结果可以追溯到候选字段。
- 当前动作形态和 element 的匹配仍是 `skillId + logicModel.elementValues[].elementId` 级别，尚未精确到命中帧或动作段。
- 下一阶段需要验证 `valueParam` 和 `formulaParamValues` 的真实覆盖/缩放关系，再决定是否把候选字段推进到 applied 公式层。

## 40. 2026-07-08 valueParam / formulaParamValues 槽位关系诊断摘要

阶段 5-8O 在 `skill-asset-evidence.json.damageElementFieldMappingEvidence` 中增强 `skillLevelBridge.formulaParamAlignment`，用于记录 `skillsub_ele_value.valueParam` 与 `TDamageElementParams.formulaParamValues` 同编号槽位的候选关系。

### 40.1 summary 新增字段

```javascript
{
  "valueParamFormulaSlotDirectMatchObjects": 2,
  "valueParamFormulaSlotOverrideCandidateObjects": 2,
  "valueParamFormulaSlotUnresolvedObjects": 2
}
```

含义：

- `valueParamFormulaSlotDirectMatchObjects`：至少有一个参数在所有检查等级中与同编号 `formulaParamValues` 槽位直接匹配的对象数。
- `valueParamFormulaSlotOverrideCandidateObjects`：至少有一个参数显示出同编号槽位覆盖候选的对象数。
- `valueParamFormulaSlotUnresolvedObjects`：已桥接到技能等级值但仍未确认最终公式关系的对象数。

### 40.2 parameterSummaries

`skillLevelBridge.formulaParamAlignment.parameterSummaries[]` 新增参数级诊断：

```javascript
{
  "id": 1,
  "variable": "A",
  "formulaParamValue": 1000,
  "levelRows": 12,
  "minValue": 1600,
  "maxValue": 3360,
  "firstLevelValue": 1600,
  "lastLevelValue": 3360,
  "uniqueValues": [1600, 1760, 1920, 2080, 2240, 2400, 2560, 2720, 2880, 3040, 3200, 3360],
  "isConstantAcrossLevels": false,
  "directSlotMatchLevels": [],
  "mismatchLevels": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  "progression": {
    "status": "arithmetic-progression",
    "step": 160
  },
  "relationStatus": "level-scaling-override-candidate"
}
```

### 40.3 当前样本结论

末音 `10900101`：

- `109001081` / `109001306` 的参数 `1 / A`：`valueParam` 从 1 级 `1600` 到 12 级 `3360`，每级 +160；同编号 `formulaParamValues[0]` 固定为 `1000`，因此记录为 `level-scaling-override-candidate`。
- `109001081` / `109001306` 的参数 `7 / G`：`valueParam` 在 1-12 级恒为 `10000`，与 `formulaParamValues[6] = 10000` 全等级直连匹配，因此记录为 `constant-direct-slot-match`。
- `109001251`：仍无同 elementId 的技能等级桥接，不能检查槽位关系。

### 40.4 当前边界

- `level-scaling-override-candidate` 不是最终公式确认，只说明 `valueParam` 和同编号 `formulaParamValues` 槽存在强候选覆盖关系。
- `constant-direct-slot-match` 不是最终公式确认，只说明同编号槽位值一致。
- 下一阶段应把这些参数级关系接入动作级 `sourceEvidence` 和 Workbench 展示层，再继续追 `formulaParams.function_1/function_2` 的实际执行公式。

## 41. 2026-07-08 actionResultTimeline 公式槽位 sourceEvidence 摘要

阶段 5-8P 把 `formulaParamAlignment.parameterSummaries` 接入动作级 `sourceEvidence`，并在 Workbench 三值来源里显示未应用公式候选。

### 41.1 sourceEvidence.formulaSlotAlignmentSummary

`actionResultTimeline[].hpDamage.sourceEvidence` 新增：

```javascript
{
  "formulaSlotAlignmentSummary": [
    {
      "id": 1,
      "variable": "A",
      "relationStatus": "level-scaling-override-candidate",
      "formulaParamValue": 1000,
      "firstLevelValue": 1600,
      "lastLevelValue": 3360,
      "progression": {
        "status": "arithmetic-progression",
        "step": 160
      },
      "candidateCount": 2
    },
    {
      "id": 7,
      "variable": "G",
      "relationStatus": "constant-direct-slot-match",
      "formulaParamValue": 10000,
      "candidateCount": 2
    }
  ]
}
```

含义：

- `candidateCount`：当前动作桥接到的候选 element 中，有多少个给出相同参数关系。
- `relationStatus`：仍是未应用公式候选，不改变 `hpDamage.value`。

### 41.2 candidates[].skillLevelBridge.formulaSlotAlignment

每个候选 element 的 `skillLevelBridge` 新增 compact 字段：

```javascript
{
  "formulaSlotAlignment": {
    "status": "same-element-id-found-slot-alignment-unverified",
    "conclusion": "slot-override-candidate-unconfirmed",
    "directSlotMatchParamIds": [7],
    "overrideCandidateParamIds": [1],
    "parameterSummaries": []
  }
}
```

### 41.3 Workbench 展示

Workbench 分析面板三值来源当前会显示：

```text
公式候选 A 覆盖候选 1,600-3,360 / G 常量匹配 10,000
```

### 41.4 当前边界

- 这些字段只是把 5-8O 的槽位关系带入动作结果和 UI，不应用最终公式。
- 下一阶段需要继续确认 `function_1/function_2` 的公式入口和执行链，否则不能把 A/G 候选推进到 applied 层。

## 42. 2026-07-08 TDamageElementParams formulaFunctionEvidence

阶段 5-8Q 在 `skill-asset-evidence.json.damageElementFieldMappingEvidence` 中新增 `hpDamage.formulaFunctionEvidence`，用于记录 `TDamageElementParams.formulaParams.function_1/function_2` 到 `element_formula.id` 的候选公式行。

### 42.1 summary 新增字段

```javascript
{
  "formulaFunctionCheckedObjects": 3,
  "formulaFunctionDirectElementFormulaObjects": 3,
  "formulaFunctionRefs": 6,
  "formulaFunctionMatchedRefs": 6,
  "formulaFunctionUnmatchedRefs": 0,
  "formulaFunctionUniqueIds": [1, 2]
}
```

含义：

- `formulaFunctionCheckedObjects`：包含可检查 `function_1/function_2` 的 `TDamageElementParams` 对象数。
- `formulaFunctionRefs`：检查到的 function 引用条数；当前 3 个对象各 2 条，共 6 条。
- `formulaFunctionMatchedRefs` / `formulaFunctionUnmatchedRefs`：functionId 是否能在 `element_formula.id` 中找到同 ID 行。
- `formulaFunctionUniqueIds`：当前命中的唯一 functionId；末音 `10900101` 为 `[1, 2]`。

### 42.2 hpDamage.formulaFunctionEvidence

每个 `fieldMappings[].hpDamage` 新增：

```javascript
{
  "formulaFunctionEvidence": {
    "status": "direct-element-formula-id-candidates-found",
    "relationStatus": "function-id-matches-element_formula-id-candidate",
    "applied": false,
    "functionRefs": [
      {
        "field": "function_1",
        "functionId": 1,
        "status": "element_formula-row-found",
        "elementFormulaRow": {
          "id": 1,
          "functionOutput": "G/10000",
          "variables": ["G"]
        },
        "variableInputs": [
          {
            "variable": "G",
            "paramId": 7,
            "formulaParamSlot": 7,
            "formulaParamValue": 10000,
            "slotStatus": "formula-param-slot-found"
          }
        ],
        "applied": false
      },
      {
        "field": "function_2",
        "functionId": 2,
        "status": "element_formula-row-found",
        "elementFormulaRow": {
          "id": 2,
          "functionOutput": "(self.ATK[0]*A)/10000",
          "variables": ["A"]
        },
        "variableInputs": [
          {
            "variable": "A",
            "paramId": 1,
            "formulaParamSlot": 1,
            "formulaParamValue": 1000,
            "slotStatus": "formula-param-slot-found"
          }
        ],
        "applied": false
      }
    ],
    "matchedFunctionIds": [1, 2],
    "unmatchedFunctionIds": []
  }
}
```

### 42.3 IL2CPP 证据锚点

`runtimeEvidence[]` 当前记录：

- `FormulaParams.function_1/function_2/formulaParamValues`
- `DamageElement.ExecuteEffect/Execute/BaseExecute/Parse`
- `SkillElementInjector.OnExecuteDamageElement/ExecuteDamageElement`
- `BattleConfigManager.elementFormulaConfig`
- `ElementFormulaData`
- `TDElementFormula`

这些锚点说明 functionId 与公式配置存在候选关联，但仍不能证明 `DamageElement` 的最终组合顺序。

### 42.4 当前边界

- `formulaFunctionEvidence.applied` 必须保持 `false`，直到确认真实执行顺序和完整公式。
- 当前只确认 `function_1 = 1 -> G/10000`、`function_2 = 2 -> (self.ATK[0]*A)/10000` 的候选直连。
- 还未确认 `function_1/function_2` 是加法、乘法、兜底/主公式、前后处理，还是其他运行时分支。
- 下一阶段应把该证据接入动作级 `sourceEvidence` 和 Workbench 展示层，继续保持不参与数值计算。
