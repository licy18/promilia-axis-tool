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
