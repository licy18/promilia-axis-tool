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

| 类型         | 用途                   | 当前运行时行为                                                                                      |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `skill`      | 真实角色技能动作       | 进入伤害投影、冷却、资源消耗和时序缺口日志                                                          |
| `wait`       | 排轴中的等待窗口       | 输出 `WAIT` 事件，记录 `durationMs` 和 `note`，不投射伤害                                           |
| `annotation` | 排轴备注/阶段标记      | 输出 `ANNOTATION` 事件，记录 `note`，不投射伤害                                                     |
| `resource`   | 手动资源变化           | 输出 `RESOURCE_CHANGE` 事件，记录 `resource`、`change`、`reason`、`note`，并进入 `resourceTimeline` |
| `enemyEvent` | 敌人/Boss 事件标记     | 输出 `ENEMY_EVENT` 事件，记录 `eventType` 和 `note`，不投射伤害                                     |
| `switch`     | 切换到另一个角色 actor | 输出 `SWITCH` 事件，记录来源 actor、目标 actor、`durationMs` 和 `note`，不投射伤害                  |

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

| 字段名        | 类型  | 描述                                     | 示例                                                                                                                           |
| ------------- | ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `damageTicks` | Array | 伤害判定帧数组，记录技能的伤害判定时间点 | `[{"offset": 45, "multiplier": 2.5, "element": "fire", "hitType": "skill"}]`                                                   |
| `buffs`       | Array | 技能触发的buff效果数组                   | `[{"name": "水之守护", "type": "defense", "value": 0.2, "duration": 10, "trigger": "onHit", "target": "self"}]`                |
| `debuffs`     | Array | 技能触发的debuff效果数组                 | `[{"name": "岩元素减抗", "type": "resistanceReduction", "value": 0.2, "duration": 10, "trigger": "onHit", "target": "enemy"}]` |

#### 2.1.2 字段变更

| 旧字段           | 新字段        | 说明                                            |
| ---------------- | ------------- | ----------------------------------------------- |
| `judgmentPoints` | `damageTicks` | 重命名并调整结构，将`time`字段改为`offset`      |
| `buff`           | `buffs`       | 从单个对象改为数组，增加`trigger`和`target`字段 |
| `debuff`         | `debuffs`     | 从单个对象改为数组，增加`trigger`和`target`字段 |

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
    id: 'action-0003',
    type: 'skill',
    skillId: 10900101,
    level: 1,
    damageSegmentIndex: 0,
  },
  {
    id: 'action-0004',
    type: 'skill',
    skillId: 10900101,
    level: 1,
    damageSegmentIndex: 1,
  },
];
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
'stage5-current-panel-attack-multiplier-v1';
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
  '普通攻击',
  '重击',
  '闪击',
  '跃击',
  '星鸣技',
  '星结合击',
  '星决技',
  '星携技',
  '极限反击',
  '完美招架',
];
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
'stage5-damage-layer-breakdown-v1';
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
getAzprCombatFormulaEvidence();
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
  { id: 2, functionOutput: '(self.ATK[0]*A)/10000' },
  { id: 23, functionOutput: '(self.DEF[0]*A)/10000' },
  { id: 101, functionOutput: '(self.ATK[0]*A)/10000' },
];
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
'evidence-found-formula-unmapped';
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
'evidence-found-formula-unmapped';
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
- Unity 技能、动作、效果资源缺失时，使用 AzPr Extractor 的 Unity/default*package 导出结果，当前入口是 `SkillList/skill_control*\*.asset`。
- 不把 `skillBytesPath` 字符串当作已存在文件；必须检查实际路径或 Extractor 输出。

### 31.4 当前缺口

当前 4 个技能没有匹配到 `skill_control_*.asset`：

```javascript
[10101062, 10700262, 10800562, 11200262];
```

`skill_control` MonoBehaviour 样本已记录 `startFrame`、`endFrame`、`frameCount`、`eventType`、`eventID`、`elementList` 等候选字段，但尚未解析引用关系，也尚未确认这些节点与 `skillsub_ele_value.elementId` 或 `element_formula.id` 的最终映射。

### 31.5 数据入口

`src/data/azprGenerated.js` 新增：

```javascript
getAzprSkillAssetEvidence();
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

| key                | 含义                                               |
| ------------------ | -------------------------------------------------- |
| `hpDamage`         | 敌人 HP 伤害候选，例如 `攻击碰撞`、`damage`、`hit` |
| `toughnessDamage`  | 敌人韧性/失衡削减候选                              |
| `selfEnergyChange` | 自身能量/充能变化候选                              |
| `elementEffect`    | 元素或属性效果候选                                 |
| `timingControl`    | 动作、跳转、打断、连击、位移等时序控制候选         |
| `presentation`     | SFX、特效、镜头、VO、武器等表现资源候选            |

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

## 43. 2026-07-08 actionResultTimeline 公式函数 sourceEvidence 摘要

阶段 5-8R 把 `hpDamage.formulaFunctionEvidence` 接入动作级 `sourceEvidence`，并在 Workbench 三值来源里显示未应用公式函数候选。

### 43.1 sourceEvidence.formulaFunctionSummary

`actionResultTimeline[].hpDamage.sourceEvidence` 新增：

```javascript
{
  "formulaFunctionSummary": [
    {
      "field": "function_1",
      "functionId": 1,
      "status": "element_formula-row-found",
      "relationStatus": "function-id-matches-element_formula-id-candidate",
      "functionOutput": "G/10000",
      "variables": ["G"],
      "variableInputs": [
        {
          "variable": "G",
          "paramId": 7,
          "formulaParamSlot": 7,
          "formulaParamValue": 10000,
          "slotStatus": "formula-param-slot-found",
          "candidateCount": 2
        }
      ],
      "candidateElementConfigIds": [109001081, 109001306],
      "candidateCount": 2,
      "applied": false
    },
    {
      "field": "function_2",
      "functionId": 2,
      "functionOutput": "(self.ATK[0]*A)/10000",
      "variables": ["A"],
      "variableInputs": [
        {
          "variable": "A",
          "paramId": 1,
          "formulaParamSlot": 1,
          "formulaParamValue": 1000,
          "slotStatus": "formula-param-slot-found",
          "candidateCount": 2
        }
      ],
      "candidateElementConfigIds": [109001081, 109001306],
      "candidateCount": 2,
      "applied": false
    }
  ]
}
```

含义：

- `field`：来自 `TDamageElementParams.formulaParams.function_1/function_2`。
- `functionOutput`：对应 `element_formula.id = functionId` 的公式输出文本。
- `variableInputs`：将公式变量按 A=1、G=7 等约定映射回 `formulaParamValues` 槽位。
- `candidateElementConfigIds` / `candidateCount`：当前动作桥接到多少个候选 damage element 支持同一条公式函数关系。
- `applied`：必须为 `false`，表示只展示证据，不参与数值。

### 43.2 candidates[].fieldCandidate.formulaFunctionEvidence

`sourceEvidence.candidates[].fieldCandidate` 会保留 compact `formulaFunctionEvidence`，用于从动作结果反查单个候选 element 的 functionId、公式行和变量槽位。

### 43.3 Workbench 展示

Workbench 分析面板三值来源当前会显示：

```text
公式函数候选 f1 G/10000 / f2 self.ATK[0]*A/10000
```

### 43.4 当前边界

- 该摘要只是动作级证据视图，不改变 `hpDamage.value`。
- 下一阶段需要把候选公式做成未应用数值预览，并与 `skill_level` 描述倍率 raw HP 投影做差异诊断。

## 44. 2026-07-08 actionResultTimeline 公式候选 preview

阶段 5-8S 在 `actionResultTimeline[].hpDamage.sourceEvidence` 中新增 `formulaCandidatePreview`，用于把 `element_formula` 候选公式代入当前动作上下文，和现有 raw HP 投影做差异诊断。

### 44.1 sourceEvidence.formulaCandidatePreview

示例：

```javascript
{
  "formulaCandidatePreview": {
    "status": "candidate-preview-computed-combination-unconfirmed",
    "applied": false,
    "baseAttack": {
      "key": "self.ATK[0]",
      "value": 1920,
      "source": "character-attribute-panel-current-rank"
    },
    "rawProjection": {
      "value": 12461,
      "expression": "round(baseAttack.value * actionMultiplier.value)",
      "actionMultiplier": 6.49,
      "rawMultiplier": "649%",
      "source": "current-skill-level-description-raw-projection"
    },
    "functionPreviews": [
      {
        "elementConfigId": 109001081,
        "field": "function_2",
        "functionId": 2,
        "functionOutput": "(self.ATK[0]*A)/10000",
        "formulaParamPreview": {
          "inputSource": "TDamageElementParams.formulaParamValues",
          "value": 192,
          "roundedValue": 192,
          "status": "computed"
        },
        "currentLevelPreview": {
          "inputSource": "skill_logic.currentLevel.valueParam",
          "valueParam": "1#1600|7#10000",
          "value": 307.2,
          "roundedValue": 307,
          "status": "computed"
        },
        "comparison": {
          "status": "compared-to-raw-projection",
          "rawProjectionValue": 12461,
          "previewRoundedValue": 307,
          "delta": -12154,
          "ratioToRawProjection": 0.0246,
          "differenceStatus": "large-difference"
        },
        "applied": false
      }
    ],
    "diagnostics": {
      "comparablePreviewCount": 2,
      "largeDifferenceCount": 2,
      "statuses": ["not-compared-scalar-candidate", "large-difference"]
    }
  }
}
```

### 44.2 输入来源

- `baseAttack`：当前模拟已应用的角色攻击，来自角色数值面板。
- `formulaParamPreview`：直接使用 `TDamageElementParams.formulaParamValues` 槽位。
- `currentLevelPreview`：优先使用当前动作 `logicModel.elementValues.valueParam` 的同编号槽位，用于验证技能等级覆盖候选。
- `rawProjection`：现有 `skill_level` 描述倍率 raw HP 投影，仍是当前 `hpDamage.value` 的来源。

### 44.3 Workbench 展示

Workbench 分析面板三值来源当前会显示：

```text
候选预览 f2 等级值 307 vs raw 12,461，约 2.5%
```

### 44.4 当前边界

- `formulaCandidatePreview.applied` 必须保持 `false`。
- 当前 f2 预览与 raw 投影差距巨大，不能把 `element_formula` 候选直接迁入最终公式。
- 下一阶段必须继续追 `DamageElement` function 组合顺序、命中段绑定、等级覆盖规则和动作描述倍率之间的关系。

## 45. 2026-07-08 formulaCandidatePreview 组合诊断矩阵

阶段 5-8T 在 `formulaCandidatePreview` 中新增 `combinationPreviews`，用于验证简单 function 组合是否能解释当前 raw HP 投影。

### 45.1 formulaCandidatePreview.combinationPreviews

示例：

```javascript
{
  "combinationPreviews": [
    {
      "elementConfigId": 109001081,
      "strategy": "function_2-current-level-value-param",
      "expression": "function_2",
      "inputSource": "skill_logic.currentLevel.valueParam",
      "functionValues": {
        "function_2": 307.2
      },
      "value": 307.2,
      "roundedValue": 307,
      "hitCount": 5,
      "comparison": {
        "status": "compared-to-raw-projection",
        "rawProjectionValue": 12461,
        "previewRoundedValue": 307,
        "delta": -12154,
        "ratioToRawProjection": 0.0246,
        "requiredScaleToRaw": 40.59,
        "requiredPerHitScaleToRaw": 8.12,
        "differenceStatus": "large-difference"
      },
      "status": "combination-preview-computed",
      "applied": false
    }
  ]
}
```

当前会生成以下简单组合：

- `function_2`
- `function_1 * function_2`
- `function_1 + function_2`

每组组合分别使用 `TDamageElementParams.formulaParamValues` 和当前等级 `skill_logic.currentLevel.valueParam` 两套输入。

### 45.2 diagnostics 新增字段

```javascript
{
  "combinationPreviewCount": 12,
  "combinationLargeDifferenceCount": 12
}
```

含义：

- `combinationPreviewCount`：当前动作所有候选 element 的简单组合预览条数。
- `combinationLargeDifferenceCount`：与 raw HP 投影差异超过阈值的组合条数。

### 45.3 Workbench 展示

Workbench 分析面板三值来源当前会显示：

```text
组合诊断 f2 需 ×40.6 才接近 raw / 每 hit ×8.1
```

### 45.4 当前边界

- `combinationPreviews` 只验证简单组合，不代表真实 `DamageElement` 运行顺序。
- 当前简单组合仍远低于 raw HP，说明下一步应扩大样本并继续追命中段绑定、运行时额外缩放和动作描述倍率之间的关系。

## 46. 2026-07-08 formulaCandidatePatternSummary 跨动作差异模式

阶段 5-8U 在仿真 `summary` 中新增 `formulaCandidatePatternSummary`，用于把多个动作的候选公式预览与 raw HP 投影做同口径比较。

### 46.1 summary.formulaCandidatePatternSummary

示例：

```javascript
{
  "formulaCandidatePatternSummary": {
    "status": "formula-candidate-patterns-found",
    "actionCount": 4,
    "comparableActionCount": 4,
    "preferredStrategy": "function_2-current-level-value-param",
    "strategies": ["function_2-current-level-value-param"],
    "requiredScaleMin": 2.5,
    "requiredScaleMax": 40.59,
    "requiredScaleRange": 38.09,
    "previewRoundedValueCount": 1,
    "previewRoundedValues": [307],
    "scaleSpreadStatus": "varies-by-action-variant",
    "previewValueStatus": "same-preview-across-actions",
    "missingRuntimeScaleStatus": "tracks-description-multiplier-before-runtime-hit-mapping",
    "applied": false
  }
}
```

含义：

- `preferredStrategy`：当前优先比较的候选组合，默认为 `function_2-current-level-value-param`。
- `requiredScaleMin` / `requiredScaleMax`：各动作候选值需要乘上的缩放范围，才能接近 raw HP 投影。
- `previewRoundedValues`：候选公式预览值集合；当前四动作样本均为 `307`。
- `scaleSpreadStatus`：判断所需缩放是否随动作形态明显变化。
- `missingRuntimeScaleStatus`：阶段性解释标签；当前表示候选值一致，但 raw 投影随描述倍率变化。
- `applied`：必须保持 `false`，该摘要只做证据诊断。

### 46.2 actionSummaries

每个动作保留一条可比较摘要：

```javascript
{
  "actionId": "action-segment-0",
  "actionName": "普通攻击",
  "actionVariantIndex": 0,
  "actionVariantLabel": "普攻",
  "rawMultiplier": "649%",
  "rawProjectionValue": 12461,
  "previewRoundedValue": 307,
  "requiredScaleToRaw": 40.59,
  "requiredPerHitScaleToRaw": 8.12,
  "damageFields": {
    "amp": 6553,
    "physicalRatio": 10000,
    "elementCalFactor": 10000,
    "formulaParamsCount": 0
  },
  "applied": false
}
```

注意：

- `damageFields` 保留 `TDamageElementParams` 原始缩放值，不在该层归一化。
- 当前 `formulaParamsCount = 0` 来自已压缩的 source evidence；若后续需要分析每个公式参数，应从 `formulaSlotAlignmentSummary` 或原始 generated evidence 补链。
- 四动作样本只证明 f2 候选值未随动作描述倍率变化，不证明 f2 无效。

### 46.3 Workbench 展示

Workbench 分析面板三值来源下会显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1
```

多动作时会显示缩放范围，例如：

```text
候选模式 4 动作 · f2 缩放 ×2.5-×40.6 / 每 hit ×2.5-×11.9，随描述倍率变化
```

### 46.4 当前边界

- `formulaCandidatePatternSummary` 不参与 HP、削韧、充能计算。
- 不能把 `requiredScaleToRaw` 当作真实公式常量；它只是“候选预览值与当前 raw 投影之间缺多少”的诊断值。
- 下一阶段需要把这些差异与 `skill_control` 行为节点命中数量、命中帧、element 绑定和 hitEffects 关联。

## 47. 2026-07-08 skillControlBehaviorCorrelations 技能级行为节点关联

阶段 5-8V 在 `formulaCandidatePatternSummary` 中新增 `skillControlBehaviorCorrelations`，用于把 formula candidate 差异模式与当前技能级 `skill_control` 行为链证据关联。

### 47.1 summary.formulaCandidatePatternSummary.skillControlBehaviorCorrelations

示例：

```javascript
{
  "skillControlBehaviorCorrelations": [
    {
      "status": "skill-level-hp-behavior-candidates-found",
      "sourceKind": "azpr-skill-control-behavior-chain-evidence",
      "file": "src/data/generated/skill-asset-evidence.json",
      "scope": "skill-level-not-action-variant-bound",
      "skillId": 10900101,
      "skillName": "哈库茵剑舞",
      "hpLaneCandidateCount": 5,
      "resolvedHpBehaviorRefCount": 5,
      "externalElementBaseRefCount": 13,
      "resourceMapMatchedElementBaseRefCount": 13,
      "sampledHpBehaviorChainCount": 3,
      "sampledResolvedHpBehaviorCount": 3,
      "hitFrameStartFrames": [13, 16, 19],
      "resourceBindings": {
        "subSkillIds": [10900101, 109001011],
        "stateNames": ["Skill0_6", "Skill0_1"],
        "hitEffects": [
          "11_109001_133",
          "11_109001_005",
          "11_109001_116"
        ]
      },
      "correlationStatus": "skill-level-only-action-variant-binding-unresolved",
      "applied": false
    }
  ]
}
```

含义：

- `hpLaneCandidateCount`：当前技能 `skill_control` 中按 HP 伤害 lane 分类的行为候选数。
- `resolvedHpBehaviorRefCount`：HP lane 行为引用解到本地 MonoBehaviour 的数量。
- `externalElementBaseRefCount` / `resourceMapMatchedElementBaseRefCount`：外部 element 引用与根 `skillResourceMaps` 的匹配情况。
- `sampledHpBehaviorChainCount` / `sampledResolvedHpBehaviorCount`：当前 generated evidence 中实际保留的 HP 行为链样本数。
- `hitFrameStartFrames`：当前样本里已看到的行为开始帧，仍是采样值。
- `resourceBindings`：从行为节点的 `elementBaseDatas` 反查到的 `subSkillIds`、`stateNames`、`hitEffects`。
- `correlationStatus`：明确当前只是技能级关联，动作形态绑定尚未确认。

### 47.2 actionSummaries[].skillControlBehaviorCorrelation

每个动作摘要会保留精简版字段：

```javascript
{
  "skillControlBehaviorCorrelation": {
    "status": "skill-level-hp-behavior-candidates-found",
    "scope": "skill-level-not-action-variant-bound",
    "hpLaneCandidateCount": 5,
    "resolvedHpBehaviorRefCount": 5,
    "sampledHpBehaviorChainCount": 3,
    "hitFrameStartFrames": [13, 16, 19],
    "stateNames": ["Skill0_6", "Skill0_1"],
    "hitEffects": [
      "11_109001_133",
      "11_109001_005",
      "11_109001_116"
    ],
    "correlationStatus": "skill-level-only-action-variant-binding-unresolved",
    "applied": false
  }
}
```

该字段用于把每个动作的 f2 候选差异与同技能行为证据放在同一观察面板中，但不代表该动作已经绑定到这些行为节点。

### 47.3 Workbench 展示

Workbench 候选模式摘要会追加行为节点提示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 13f/16f/19f · Skill0_6/Skill0_1
```

### 47.4 当前边界

- `skillControlBehaviorCorrelations.applied` 必须保持 `false`。
- 当前字段只证明技能级行为候选和资源归属存在，不证明动作形态级绑定。
- 阶段 5-8W 已扩展 generated evidence 的采样策略，完整 HP 行为链样本见第 48 节。

## 48. 阶段 5-8W：动作形态级行为绑定候选

阶段 5-8W 把技能级 HP 行为节点继续推进到动作形态级候选绑定，但仍保持证据态，不参与实际伤害计算。

### 48.1 skillAssetEvidence.currentSkillControlEvidence[]

`src/data/generated/skill-asset-evidence.json` 在每个 current skill control item 中新增按 lane 保留的样本：

```javascript
{
  "effectLaneCandidatesByLane": {
    "hpDamage": [
      { "name": "攻击碰撞", "startFrame": 19, "endFrame": 20 },
      { "name": "普通-攻击碰撞", "startFrame": 13, "endFrame": 14 }
    ]
  },
  "effectLaneBehaviorChainsByLane": {
    "hpDamage": [
      {
        "sourceName": "普通-攻击碰撞",
        "sourceStartFrame": 12,
        "sourceEndFrame": 13,
        "resolvedBehaviors": [
          {
            "scriptTypeCandidate": {
              "className": "InjectToTargetKeyFrameBehaviorData"
            },
            "startFrame": 12,
            "frameCount": 1,
            "elementBaseDataRefs": [
              {
                "resourceMapMatches": [
                  {
                    "subSkillIds": [10900101],
                    "stateNames": ["Skill0_1"],
                    "hitEffects": ["11_109001_116"]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

含义：

- `effectLaneCandidatesByLane`：按 HP / toughness / energy 等 lane 分类保留的 effect node 候选样本。
- `effectLaneBehaviorChainsByLane`：按 lane 保留的已解引用行为链样本，包含原始行为节点帧、`resolvedBehaviors[]`、`elementBaseDataRefs[]`、`resourceMapMatches[]` 等证据。
- `stateName`、`subSkillId` 和 hitEffect 在 generated evidence 里来自 `resourceMapMatches[]`；仿真投影会再折叠为 `stateNames`、`subSkillIds` 和 `hitEffects` 便于界面展示。
- 当前阶段只对 HP lane 生成动作绑定候选；韧性和能量 lane 仍等待蓝色星原真实字段确认。

### 48.2 formulaCandidatePatternSummary.skillControlBehaviorCorrelations[]

仿真投影在技能级关联摘要中新增动作形态绑定候选：

```javascript
{
  "actionVariantBindingStatus": "action-variant-binding-candidates-generated-unconfirmed",
  "actionVariantBindingSummary": {
    "actionVariantCount": 4,
    "boundCandidateCount": 4,
    "confidenceLevels": ["medium", "low"],
    "statuses": ["action-variant-binding-candidates-found"]
  },
  "actionVariantBindingCandidates": [
    {
      "actionId": "action-0001",
      "actionLabel": "普攻",
      "confidence": "medium",
      "bindingStatus": "normal-action-name-state-candidate-unconfirmed",
      "candidateCount": 5,
      "topCandidates": [
        {
          "sourceName": "普通-攻击碰撞",
          "sourceStartFrame": 12,
          "sourceEndFrame": 13,
          "stateNames": ["Skill0_1"],
          "subSkillIds": [10900101],
          "hitEffects": ["11_109001_116"]
        }
      ],
      "applied": false
    }
  ]
}
```

### 48.3 actionSummaries[].skillControlBehaviorCorrelation

每个动作摘要会带上该动作自己的候选绑定精简视图：

```javascript
{
  "skillControlBehaviorCorrelation": {
    "actionVariantBindingStatus": "action-variant-binding-candidates-generated-unconfirmed",
    "actionVariantBindingCandidate": {
      "confidence": "medium",
      "bindingStatus": "normal-action-name-state-candidate-unconfirmed",
      "topCandidates": [
        {
          "sourceName": "普通-攻击碰撞",
          "sourceStartFrame": 12,
          "stateNames": ["Skill0_1"]
        }
      ],
      "applied": false
    }
  }
}
```

Workbench 候选模式摘要会追加动作绑定提示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f
```

### 48.4 当前边界

- 所有 `actionVariantBindingCandidates[].applied` 和 `actionVariantBindingCandidate.applied` 必须保持 `false`。
- 【普通攻击】当前只有中置信候选：`普通-攻击碰撞 / Skill0_1 / 12-13f, 13-14f`。
- 【重击 / 闪击 / 跃击】当前只是低置信共享候选：`攻击碰撞 / Skill0_6`。
- 下一阶段必须验证 `Skill0_1` / `Skill0_6` 与动作形态的真实对应关系，不能把候选直接写入最终伤害公式。

## 49. 阶段 5-8X-A：stateTimingEvidence

阶段 5-8X-A 新增状态/时序控制证据索引，用于继续验证 `Skill0_1` / `Skill0_6` 与动作形态的真实对应关系。

### 49.1 behavior script candidates

`skill-asset-evidence.json` 现在可识别三类行为脚本候选：

- `AnimationBehaviorData`：字段签名来自 `dump.cs:284907-284946`，关键字段包括 `selectedStateName`、`aniLength`、`aniStartFrame`、`aniEndFrame`。
- `EventBridgeBehaviorData`：字段签名来自 `dump.cs:285740-285783`，关键字段包括 `allowAttack`、`allowMove`、`allowJump`、`allowDodge`、`bridge`、`type`、`skillId`、`frameIndex`。
- `InjectToTargetKeyFrameBehaviorData`：阶段 5-8K 已接入的 HP 命中注入行为。

### 49.2 currentSkillControlEvidence[].stateTimingEvidence

新增字段示例：

```javascript
{
  "stateTimingEvidence": {
    "status": "state-timing-evidence-found-action-binding-unconfirmed",
    "sourceKind": "azpr-skill-control-state-timing-evidence",
    "scope": "skill-level-action-state-candidates",
    "hpStateWindowCount": 5,
    "timingControlChainCount": 5,
    "animationStateControlCount": 1,
    "eventBridgeControlCount": 4,
    "hpStateNames": ["Skill0_1", "Skill0_6"],
    "animationStateNames": ["Skill0_6"],
    "eventBridgeSkillIds": [0, 80102, 10900102],
    "stateFindings": [
      {
        "stateName": "Skill0_1",
        "status": "hp-state-resource-map-only-no-local-animation-control",
        "hpStartFrames": [12, 13],
        "animationControlCount": 0
      },
      {
        "stateName": "Skill0_6",
        "status": "hp-state-has-animation-control-candidate",
        "hpStartFrames": [13, 16, 19],
        "animationControlCount": 1
      }
    ],
    "bindingStatus": "state-timing-evidence-candidates-unconfirmed",
    "applied": false
  }
}
```

### 49.3 projection / Workbench

- `formulaCandidatePatternSummary.skillControlBehaviorCorrelations[].stateTimingEvidence`：保留技能级状态/时序证据摘要。
- `formulaCandidatePatternSummary.skillControlBehaviorCorrelations[].stateTimingEvidenceStatus`：快速状态字段。
- `actionSummaries[].skillControlBehaviorCorrelation.stateTimingFindings`：按动作主置信候选过滤的 state finding。
- Workbench 候选模式摘要会追加：

```text
状态证据 Skill0_1 仅资源命中 / Skill0_6 动画+命中
```

### 49.4 当前边界

- 这些字段仍为证据索引，所有 `applied` 必须保持 `false`。
- `Skill0_6` 有动画状态控制和 HP 命中窗口，但仍不能拆分重击、闪击、跃击。
- `Skill0_1` 只有 HP 资源映射命中，尚未在同一 `skill_control_10900101` 中找到动画状态控制；下一步需要追相关 `skill_control_10900102.asset`、`skill_control_80102.asset`、Yoo index 和 EventBridge runtime。

## 50. 阶段 5-8X-B：eventBridgeTargetSkillControlEvidence

阶段 5-8X-B 在 `stateTimingEvidence` 下新增 EventBridge 目标技能 skill_control 摘要，用于确认跳转/桥接目标是否仍属于同一普攻链。

### 50.1 stateTimingEvidence.eventBridgeTargetSkillControlEvidence

字段示例：

```javascript
{
  "eventBridgeTargetSkillControlEvidence": {
    "status": "event-bridge-target-skill-controls-indexed",
    "targetSkillIds": [80102, 10900102],
    "foundTargetSkillControlCount": 1,
    "missingTargetSkillControlCount": 1,
    "childSkillTargetIds": [10900102],
    "targetAnimationStateNames": ["Skill0_2"],
    "targetHpTrackNames": ["普攻-攻击碰撞"],
    "targetSkillControls": [
      {
        "skillId": 10900102,
        "status": "found",
        "skillTableStatus": "found",
        "parentSkill": 10900101,
        "relationToSourceSkill": "child-skill-of-source",
        "animationStateNames": ["Skill0_2"],
        "hpTimelineCandidateCount": 4,
        "eventBridgeSkillIds": [0, 10900103]
      },
      {
        "skillId": 80102,
        "status": "missing-skill-control-directory",
        "skillTableStatus": "missing-skill-table-row",
        "relationToSourceSkill": "unknown-target-not-in-skill-table"
      }
    ],
    "applied": false
  }
}
```

### 50.2 projection / Workbench

- `formulaCandidatePatternSummary.skillControlBehaviorCorrelations[].stateTimingEvidence.eventBridgeTargetSkillControlEvidence` 保留压缩摘要。
- Workbench 状态证据后追加目标技能摘要：

```text
目标技能 10900102->Skill0_2 / 80102缺失
```

### 50.3 当前边界

- 目标技能摘要只证明 EventBridge 目标 skill_control 的存在、状态名和候选 HP 轨道，不直接证明最终动作绑定。
- `10900102` 已确认是 `10900101` 的子技能，并继续桥接到 `10900103`；下一阶段应递归追完整普攻连段链。
- `80102` 暂不在 `SkillList` 和当前 `skill.json`，必须先确认它是否是非技能表 ID、枚举值或其他资源 ID，不能直接按技能控制处理。

## 51. 阶段 5-8X-C：递归普攻连段链候选

阶段 5-8X-C 将 `eventBridgeTargetSkillControlEvidence` 从单跳目标摘要扩展为递归目标链索引，并新增 `normalAttackChainCandidate`。本节覆盖并更新第 49 / 50 节中对末音 `10900101` 的旧样例：当前 `Skill0_1` 已通过直接 `AnimationBehaviorData` 补证为动画+命中候选，`EventBridge` 目标不再只停留在 `10900102` 单跳。

### 51.1 stateTimingEvidence 更新

`stateTimingEvidence` 现在同时合并：

- timingControl 行为链中解析出的 `AnimationBehaviorData` / `EventBridgeBehaviorData`。
- skill_control 目录顶层直接挂载的 `AnimationBehaviorData` / `EventBridgeBehaviorData`。

合并时优先保留 timingControl 链上的轨道名和帧窗，直接扫描只用于补缺口。当前末音 `10900101` 的摘要：

```javascript
{
  "animationStateControlCount": 2,
  "eventBridgeControlCount": 5,
  "animationStateNames": ["Skill0_1", "Skill0_6"],
  "stateFindings": [
    {
      "stateName": "Skill0_1",
      "status": "hp-state-has-animation-control-candidate",
      "hpStartFrames": [12, 13],
      "animationControlCount": 1
    },
    {
      "stateName": "Skill0_6",
      "status": "hp-state-has-animation-control-candidate",
      "hpStartFrames": [13, 16, 19],
      "animationControlCount": 1
    }
  ],
  "applied": false
}
```

### 51.2 eventBridgeTargetSkillControlEvidence 更新

新增或扩展字段：

- `directTargetSkillIds`：源 skill_control 直接 EventBridge 目标。
- `targetSkillIds`：递归追踪后见到的所有目标 ID。
- `chainDepthMax`：当前追踪到的最大跳数。
- `targetSkillControls[].discoveryDepth`：目标 skill_control 位于第几跳。
- `targetSkillControls[].discoveredFromSkillId`：由哪个 skill_control 桥接发现。
- `normalAttackChainCandidate`：同源 `parentSkill` 子 skill_control 组成的普攻连段候选。

末音 `10900101` 当前摘要：

```javascript
{
  "eventBridgeTargetSkillControlEvidence": {
    "status": "event-bridge-target-skill-controls-indexed",
    "directTargetSkillIds": [80102, 10900102],
    "targetSkillIds": [80102, 10900102, 10900103, 10900104, 10900105],
    "targetSkillControlCount": 5,
    "foundTargetSkillControlCount": 4,
    "missingTargetSkillControlCount": 1,
    "childSkillTargetIds": [10900102, 10900103, 10900104, 10900105],
    "chainDepthMax": 4,
    "targetAnimationStateNames": [
      "Skill0_2",
      "Skill0_3",
      "Skill0_4",
      "Skill0_5"
    ],
    "normalAttackChainCandidate": {
      "status": "normal-attack-child-skill-chain-candidate-unconfirmed",
      "chainSkillIds": [10900102, 10900103, 10900104, 10900105],
      "chainLength": 4,
      "animationStateNames": [
        "Skill0_2",
        "Skill0_3",
        "Skill0_4",
        "Skill0_5"
      ],
      "hpTimelineCandidateCount": 30,
      "bridgeTargetSkillIds": [0, 10900103, 10900104, 10900105],
      "applied": false
    },
    "applied": false
  }
}
```

### 51.3 projection / Workbench

- `compactEventBridgeTargetSkillControlEvidence()` 保留 `directTargetSkillIds`、`chainDepthMax`、`normalAttackChainCandidate`、`discoveryDepth`、`discoveredFromSkillId`。
- Workbench 状态证据后优先显示普攻链摘要：

```text
普攻链 10900102->Skill0_2 / 10900103->Skill0_3 / +2 · 目标缺失 80102
```

### 51.4 当前边界

- `normalAttackChainCandidate.applied` 必须保持 `false`。
- 当前只确认普攻连段 skill_control 链和 HP timeline 候选存在，还没有建立普通攻击第 1/2/3/4/5 段与每 hit 伤害/削韧/充能节点的最终绑定。
- `80102` 仍是缺失目标，不可直接按技能表行处理。
- 下一阶段应新增普通攻击多段/每 hit 候选字段，建议暂命名为 `normalAttackHitChainCandidate`。

## 52. 阶段 5-8Y：normalAttackHitChainCandidate

阶段 5-8Y 新增普通攻击多段 / 每 hit 候选字段。该字段仍是 evidence，不是最终公式输入。

### 52.1 stateTimingEvidence.normalAttackDescriptionEvidence

从技能描述【普通攻击】段落解析普通攻击段数：

```javascript
{
  "normalAttackDescriptionEvidence": {
    "status": "normal-attack-hit-count-found",
    "sourceKind": "azpr-skill-description-normal-attack-hit-count",
    "sectionTitle": "普通攻击",
    "expectedHitCount": 5,
    "sourceField": "skill.description.plain",
    "applied": false
  }
}
```

### 52.2 eventBridgeTargetSkillControlEvidence.normalAttackHitChainCandidate

字段示例：

```javascript
{
  "normalAttackHitChainCandidate": {
    "status": "normal-attack-hit-chain-candidates-found-unconfirmed",
    "sourceKind": "azpr-normal-attack-hit-chain-candidate",
    "bindingStatus": "normal-attack-hit-chain-candidates-unconfirmed",
    "expectedHitCount": 5,
    "expectedHitCountSource": "azpr-skill-description-normal-attack-hit-count",
    "descriptionSectionTitle": "普通攻击",
    "candidateHitGroupCount": 5,
    "coverageStatus": "matches-description-hit-count",
    "chainSkillIds": [10900102, 10900103, 10900104, 10900105],
    "animationStateNames": [
      "Skill0_1",
      "Skill0_2",
      "Skill0_3",
      "Skill0_4",
      "Skill0_5"
    ],
    "hpTimelineCandidateCount": 32,
    "hitGroups": [
      {
        "hitIndex": 1,
        "label": "普通攻击 1段",
        "candidateSource": "source-skill-control-hp-state-window",
        "skillId": 10900101,
        "discoveryDepth": 0,
        "animationStateNames": ["Skill0_1"],
        "hpTimelineCandidateCount": 2,
        "hpFrameStartFrames": [12, 13],
        "subSkillIds": [10900101],
        "hitEffects": ["11_109001_116"],
        "bindingStatus": "normal-attack-hit-candidate-unconfirmed",
        "applied": false
      },
      {
        "hitIndex": 2,
        "candidateSource": "event-bridge-child-skill-control-hp-timeline",
        "skillId": 10900102,
        "discoveryDepth": 1,
        "animationStateNames": ["Skill0_2"],
        "hpTimelineCandidateCount": 4,
        "hpFrameStartFrames": [6, 10, 14, 26],
        "bindingStatus": "normal-attack-hit-candidate-unconfirmed",
        "applied": false
      }
    ],
    "applied": false
  }
}
```

当前末音 `10900101` 五段候选的 HP timeline 数量为 `2 / 4 / 9 / 7 / 10`，总计 32。

### 52.3 projection / Workbench

- `compactEventBridgeTargetSkillControlEvidence()` 保留 `normalAttackHitChainCandidate` 压缩摘要。
- Workbench 普攻链摘要新增：

```text
命中候选 5/5段
```

### 52.4 当前边界

- 所有 `normalAttackHitChainCandidate` 与 `hitGroups[]` 仍为 `applied: false`。
- 第 1 段来自主 skill_control 的 HP state window，已带 `subSkillId` 和 hitEffect；第 2-5 段目前来自目标 skill_control HP timeline，尚未解析到 `behaviorList`、`elementBaseDatas` 或 `TDamageElementParams`。
- 下一阶段应把第 2-5 段也解析到外部 element 对象和 HP/削韧/充能三值字段。

## 53. 阶段 5-8Z：normalAttackHitChainCandidate 每 hit 三值字段候选

阶段 5-8Z 把普通攻击 5 段 hitGroup 继续向下解析到行为链、外部 element 引用和 `TDamageElementParams` 字段映射。该字段仍是 evidence，不是最终公式输入。

### 53.1 targetSkillControls[] 扩展

`eventBridgeTargetSkillControlEvidence.targetSkillControls[]` 新增：

- `skillResourceMapEvidence`：目标 skill_control 的 `skillResourceMaps[].elements` 归属证据。
- `behaviorReferenceSummary`：目标 skill_control 的 `behaviorList` 解引用摘要。
- `hpBehaviorChainCount` / `hpBehaviorChains`：目标 skill_control 的 HP 行为链样本。

### 53.2 hitGroups[] 扩展

`normalAttackHitChainCandidate.hitGroups[]` 新增：

- `behaviorChainCandidateCount`
- `resolvedBehaviorCount`
- `externalElementBaseRefCount`
- `resourceMapMatchedElementBaseRefCount`
- `resourceMapUnmatchedElementBaseRefCount`
- `elementBaseDataRefs[]`
- `damageElementFieldMappingStatus`
- `damageElementFieldMappingCount`
- `damageElementElementConfigIds[]`
- `damageElementPathIds[]`
- `damageElementFieldMappings[]`

### 53.3 候选级汇总

`normalAttackHitChainCandidate` 新增：

```javascript
{
  "damageElementFieldMappingStatus": "all-hit-groups-have-damage-element-field-mappings",
  "damageElementMappedHitGroupCount": 5,
  "damageElementFieldMappingCount": 12,
  "damageElementElementConfigIds": [
    109001018,
    109001021,
    109001081,
    109001117,
    109001134,
    109001135,
    109001137,
    109001280,
    109001285,
    109001306,
    109001313,
    109001328
  ],
  "applied": false
}
```

### 53.4 projection / Workbench

- `compactNormalAttackHitChainCandidate()` 保留候选级和 hitGroup 级三值字段摘要。
- Workbench 普攻链摘要新增：

```text
三值候选 5/5段
```

### 53.5 当前边界

- `damageElementFieldMappings[].applied` 必须保持 `false`。
- 这些字段只说明每段 hit 可以追到哪些 HP、削韧、自身能量候选字段；不能直接推导最终伤害、削韧或充能数值。
- 下一阶段应把这些候选接入 per-hit 三曲线预览，并继续显式记录未确认的公式组合顺序和执行条件。

## 54. 阶段 5-8AA：actionResultTimeline per-hit 三值候选预览

阶段 5-8AA 在仿真投影层新增每动作逐 hit 候选预览。该结构服务于后续曲线绘制和公式诊断，不改变当前实际投影值。

### 54.1 actionResultTimeline[].hitCandidateSummary

字段示例：

```javascript
{
  "hitCandidateSummary": {
    "status": "all-hit-candidates-have-damage-element-fields",
    "hitCandidateCount": 5,
    "mappedHitCandidateCount": 5,
    "damageElementFieldMappingCount": 12,
    "frameRate": 60,
    "primaryFrames": [12, 6, 12, 7, 4],
    "candidateElementConfigIds": [
      109001018,
      109001021,
      109001081,
      109001117,
      109001134,
      109001135,
      109001137,
      109001280,
      109001285,
      109001306,
      109001313,
      109001328
    ],
    "applied": false
  }
}
```

非普攻动作或缺少 hitChain 证据的动作返回：

```javascript
{
  "status": "no-per-hit-candidates",
  "hitCandidateCount": 0,
  "damageElementFieldMappingCount": 0,
  "mappedHitCandidateCount": 0,
  "applied": false
}
```

### 54.2 actionResultTimeline[].hitCandidates[]

单条 hit 候选字段：

- `sourceKind = azpr-normal-attack-per-hit-damage-element-candidate`
- `actionId` / `actionName` / `actionVariantIndex` / `actionVariantLabel`
- `skillId` / `hitSkillId` / `hitIndex`
- `frameRate` / `frameStartFrames` / `primaryFrame` / `timeMsCandidates` / `candidateTimeMs`
- `hpTimelineCandidateCount`
- `behaviorChainCandidateCount`
- `damageElementFieldMappingCount`
- `actionLevelElementMatchCount`
- `damageElementElementConfigIds`
- `hpDamage`
- `toughnessDamage`
- `selfEnergyChange`
- `candidates[]`
- `unresolved[]`
- `applied = false`

### 54.3 当前边界

- `hitCandidates[]` 可以作为曲线候选输入，但不是最终三值曲线。
- 当前 `candidateTimeMs` 仅使用动作开始时间加 hitGroup 相对帧点，尚未解析子 skill_control 串联时长、取消窗口或输入节奏。
- 第 2-5 段的 `actionLevelElementMatchCount` 目前可能为 0，因为它们的 damage element 不一定在源动作的 `skillsub_ele_value` 等级行中直接出现。

## 55. 阶段 5-8AB：candidateValueSeries 候选三曲线

阶段 5-8AB 在仿真投影顶层新增 `candidateValueSeries`。该结构把 `actionResultTimeline[].hitCandidates[]` 聚合成可绘制的 HP、削韧、自身能量候选曲线，服务于后续 Endaxis 式多曲线展示；当前仍不参与最终计算。

### 55.1 顶层结构

字段示例：

```javascript
{
  "candidateValueSeries": {
    "schemaVersion": 1,
    "sourceKind": "azpr-action-result-candidate-value-series",
    "status": "candidate-value-series-found-unapplied",
    "frameRate": 60,
    "summary": {
      "seriesCount": 3,
      "pointCount": 15,
      "hitCandidateCount": 5,
      "actionCount": 1,
      "applied": false
    },
    "series": [],
    "applied": false
  }
}
```

`summary.candidateValueSeriesSummary` 同步引用该摘要，便于统计面板读取。

### 55.2 series[]

当前固定输出三类候选曲线：

- `hpDamageFormulaParamCandidate`：HP 参数候选，`valueKind = TDamageElementParams.formulaParamValues`，`unit = raw-param`。
- `toughnessDamageCandidate`：削韧候选，`valueKind = TDamageElementParams.weakBreakDamageRate`，`unit = raw-field`。
- `selfEnergyCandidate`：自身能量候选，`valueKind = TDamageElementParams.recoverSP`，`unit = raw-field`。

单条曲线字段：

- `key` / `label` / `valueKind` / `unit`
- `status`
- `pointCount`
- `valueMin` / `valueMax` / `valueRange`
- `points[]`
- `applied = false`

### 55.3 points[]

单点字段：

- `actionId` / `actionName` / `actionVariantLabel`
- `skillId` / `hitSkillId` / `hitIndex`
- `sequenceIndex`
- `frameRate` / `primaryFrame` / `timeMs`
- `value` / `valueMin` / `valueMax` / `valueSamples`
- `candidateCount`
- `elementConfigIds`
- `sourceStatus`
- `applied = false`

当前末音 `10900101` 默认普攻样本：

- HP：`2500 / 4800 / 3000 / 5400 / 13000`。
- 削韧：`7000 / 7000 / 7000 / 7000 / 7000`。
- 能量：`2700 / 2599 / 2399 / 3000 / 2599`。

### 55.4 Workbench

Workbench 分析面板新增候选曲线列表：

```text
候选曲线 15
HP参数候选 5点 · 2,500-13,000 · raw-param
削韧候选 5点 · 7,000 · raw-field
能量候选 5点 · 2,399-3,000 · raw-field
```

### 55.5 当前边界

- `candidateValueSeries.applied` 必须保持 `false`。
- HP 曲线当前取每个 hit 候选参数的最大非零、非 `10000` 值作为预览点，不代表最终 HP 伤害公式。
- 削韧和能量曲线当前直接暴露字段候选值，尚未确认缩放、命中次数、间隔、目标归属或角色资源归属规则。
- 下一阶段应把这些点转换为时间轴绝对帧点或图表 marker，并继续追最终公式执行链。

## 56. 阶段 5-8AC：candidateValueSeries.chart 时间轴图表层

阶段 5-8AC 在 `candidateValueSeries` 内新增 `chart`，把候选曲线转换成 Workbench 可直接绘制的 60fps 图表点。该层仍属于未应用候选可视化。

### 56.1 candidateValueSeries.chart

字段示例：

```javascript
{
  "chart": {
    "schemaVersion": 1,
    "sourceKind": "azpr-candidate-value-series-chart",
    "status": "candidate-chart-found-unapplied",
    "durationMs": 30000,
    "frameRate": 60,
    "frameMs": 16.666667,
    "frameCount": 1800,
    "summary": {
      "seriesCount": 3,
      "pointCount": 15,
      "displayFrameAdjustmentCount": 12,
      "timeOrderStatus": "source-times-non-monotonic-display-adjusted",
      "applied": false
    },
    "series": [],
    "applied": false
  }
}
```

`candidateValueSeries.summary` 同步新增：

- `chartPointCount`
- `displayFrameAdjustmentCount`
- `timeOrderStatus`

### 56.2 chart.series[]

单条图表曲线字段：

- `key` / `label` / `valueKind` / `unit`
- `status`
- `pointCount`
- `valueMin` / `valueMax` / `valueRange`
- `frameMin` / `frameMax`
- `displayFrameAdjustmentCount`
- `timeOrderStatus`
- `polylinePoints`
- `points[]`
- `applied = false`

### 56.3 chart.points[]

单点字段：

- `actionId` / `actionName` / `actionVariantLabel`
- `skillId` / `hitSkillId` / `hitIndex` / `sequenceIndex`
- `sourceFrameIndex` / `sourceTimeMs`
- `displayFrameIndex` / `displayFrameLabel` / `displayTimeMs`
- `timeAdjustmentStatus`
- `xPercent` / `yPercent`
- `value` / `valueMin` / `valueMax` / `valueSamples`
- `candidateCount`
- `elementConfigIds`
- `sourceStatus`
- `applied = false`

### 56.4 当前样本

末音 `10900101` 默认普攻 HP 曲线：

- 源帧：`12 / 6 / 12 / 7 / 4f`。
- 显示帧：`0s12f / 0s13f / 0s14f / 0s15f / 0s16f`。
- 第 2-5 点 `timeAdjustmentStatus = sequence-display-frame-adjusted`。

Workbench 显示：

```text
候选时间曲线 15
60fps · 30s0f · 显示帧调整 12
```

### 56.5 当前边界

- `displayFrameIndex` 只是可视化帧，不应被当成已确认的运行时命中绝对帧。
- `timeOrderStatus = source-times-non-monotonic-display-adjusted` 表示存在子 `skill_control` 局部帧回退，必须继续追 EventBridge 和动画状态切换证据。
- 下一阶段应优先消除默认普攻样本中的 12 个显示帧调整，或把主时间轴 marker 明确标注为候选显示帧。

## 57. 阶段 5-8AD：normalAttackSequenceTimingEvidence 连段绝对帧候选

阶段 5-8AD 在仿真投影层新增普攻连段时序候选。该层使用上一段 `skill_control` 的 `EventBridgeBehaviorData` 指向下一段 skillId 的 `behaviorStartFrame` 累加连段起点，再叠加每段 HP timeline 本地命中帧，得到候选绝对帧。

### 57.1 actionResultTimeline[].hitCandidateSummary 扩展

新增字段：

- `absolutePrimaryFrames`
- `sequenceChainStartFrames`
- `sequenceTimingStatus`
- `sequenceTimingSourceKind`
- `sequenceTimingTransitionCount`
- `sequenceTimingResolvedTransitionCount`
- `sequenceTimingAbsoluteFrameStatus`
- `sequenceTimingTransitions[]`

当前默认样本：

```javascript
{
  "absolutePrimaryFrames": [12, 22, 63, 123, 184],
  "sequenceChainStartFrames": [0, 16, 51, 116, 180],
  "sequenceTimingStatus": "normal-attack-sequence-absolute-frame-candidates-found",
  "sequenceTimingTransitionCount": 4,
  "sequenceTimingResolvedTransitionCount": 4,
  "sequenceTimingAbsoluteFrameStatus": "absolute-hit-frames-strictly-increasing"
}
```

`sequenceTimingTransitions[]` 示例：

```javascript
[
  {
    fromSkillId: 10900101,
    toSkillId: 10900102,
    bridgeStartFrame: 16,
    chainStartFrame: 16,
  },
  {
    fromSkillId: 10900102,
    toSkillId: 10900103,
    bridgeStartFrame: 35,
    chainStartFrame: 51,
  },
  {
    fromSkillId: 10900103,
    toSkillId: 10900104,
    bridgeStartFrame: 65,
    chainStartFrame: 116,
  },
  {
    fromSkillId: 10900104,
    toSkillId: 10900105,
    bridgeStartFrame: 64,
    chainStartFrame: 180,
  },
];
```

### 57.2 actionResultTimeline[].hitCandidates[] 扩展

每条 hit 候选新增：

- `localCandidateTimeMs`
- `absolutePrimaryFrame`
- `absoluteFrameStartFrames`
- `absoluteCandidateTimeMs`
- `chainStartFrame`
- `sequenceTimingStatus`
- `sequenceTimingSourceStatus`
- `sequenceTiming`

第 2 段示例：

```javascript
{
  "hitIndex": 2,
  "hitSkillId": 10900102,
  "primaryFrame": 6,
  "localCandidateTimeMs": 100,
  "chainStartFrame": 16,
  "absolutePrimaryFrame": 22,
  "absoluteCandidateTimeMs": 366.666667,
  "candidateTimeMs": 366.666667
}
```

### 57.3 candidateValueSeries.chart 行为变化

`candidateValueSeries.chart` 现在优先使用 `absoluteCandidateTimeMs` 作为图表源时间。

当前默认样本：

- `displayFrameAdjustmentCount = 0`。
- `timeOrderStatus = source-times-monotonic`。
- HP / 削韧 / 能量三条曲线的 `frameMin = 12`，`frameMax = 184`。
- 图表帧范围显示为 `0s12f-3s4f`。

### 57.4 当前边界

- 绝对帧是 EventBridge 与 HP timeline 的中置信候选，不是最终 timing profile。
- `candidateTimeMs` 已从本地帧时间升级为绝对候选时间；本地时间保留在 `localCandidateTimeMs`。
- 仍需继续验证输入条件、取消窗口、桥接 `type/bridge/frameIndex` 语义和运行时实际命中触发。

## 58. 阶段 5-8AE：TimelineGrid 候选三值 marker

阶段 5-8AE 不改变项目 JSON 或仿真数据结构，只把 `candidateValueSeries.chart` 投影到主时间轴 UI。

### 58.1 TimelineGridPreview 输入

`TimelineGridPreview` 新增：

```vue
<TimelineGridPreview
  :candidate-value-chart="simulationResult.candidateValueSeries.chart"
/>
```

输入来源仍是 `candidateValueSeries.chart.series[].points[]`。

### 58.2 UI marker 投影

每个 chart point 生成一个时间轴候选 marker：

- `seriesKey`
- `seriesLabel`
- `valueKind`
- `unit`
- `actionId`
- `hitIndex`
- `timeMs = displayTimeMs || sourceTimeMs`
- `frameLabel`
- `value`

轨道归属沿用 action 归属：若 `actionId` 能找到对应 action，则使用 `resolveTimelineActionLaneId(action)`；否则进入系统轨。

### 58.3 稳定测试标记

候选 marker 使用独立测试标记：

```html
data-testid="workbench-timeline-candidate-value-marker"
data-series-key="hpDamageFormulaParamCandidate" data-hit-index="1"
data-frame-label="0s12f"
```

真实伤害 marker 仍使用：

```html
data-testid="workbench-timeline-damage-marker"
```

两者语义必须保持分离。

### 58.4 当前样本

默认末音普攻样本：

- 候选 marker 总数：15。
- 全部归属：`actor-109001`。
- HP 首点：`hitIndex = 1`，`frameLabel = 0s12f`。
- HP 末点：`hitIndex = 5`，`frameLabel = 3s4f`。

### 58.5 当前边界

- 时间轴当前是 marker 点，不是连续曲线轨。
- marker 值仍是未应用候选字段值。
- 下一阶段应补多曲线轨或悬浮提示，避免用户只能靠 marker 形状判断来源。

## 59. 阶段 5-8AF：TimelineGrid 候选多曲线轨与按帧提示

阶段 5-8AF 继续扩展主时间轴 UI 投影，不改变底层仿真 schema。输入仍来自 `candidateValueSeries.chart`。

### 59.1 curve track

每个含候选点的 lane 新增曲线轨：

```html
data-testid="workbench-timeline-candidate-value-curve-track"
```

当前默认样本只有 `actor-109001` 一条候选曲线轨。

### 59.2 curve line

每条候选曲线使用独立 polyline：

```html
data-testid="workbench-timeline-candidate-value-curve"
data-series-key="hpDamageFormulaParamCandidate" data-point-count="5"
```

当前默认样本：

- `hpDamageFormulaParamCandidate`
- `toughnessDamageCandidate`
- `selfEnergyCandidate`

### 59.3 marker 与 yPercent

候选 marker 不再按固定三行摆放，而是按 `candidateValueSeries.chart.points[].yPercent` 计算纵坐标，使 marker 与曲线线段对齐。

marker 继续保留：

```html
data-testid="workbench-timeline-candidate-value-marker"
data-series-key="hpDamageFormulaParamCandidate" data-hit-index="1"
data-frame-label="0s12f" data-marker-title="HP参数候选 0s12f hit1: 2,500
raw-param"
```

### 59.4 frame hotspot

同一 hit 帧的三条候选值合并为一个 hover hotspot：

```html
data-testid="workbench-timeline-candidate-value-frame-hotspot"
data-hit-index="1" data-frame-label="0s12f"
```

首帧提示：

```text
0s12f hit1: HP参数候选 2,500 raw-param / 削韧候选 7,000 raw-field / 能量候选 2,700 raw-field
```

### 59.5 当前边界

- hotspot 目前使用原生 `title` / `aria-label`，不是自定义浮层。
- 曲线显隐和来源详情暂未交互化。
- 后续多动作、多角色样本需要验证曲线密度和 hover 命中区域。

## 60. 阶段 5-8AG：TimelineGrid 候选曲线显隐与选中帧摘要

阶段 5-8AG 仍是 UI 投影层增强，不新增或迁移底层仿真 schema。输入继续来自 `candidateValueSeries.chart.series[].points[]`。

### 60.1 series visibility

时间轴标题区新增三枚曲线显隐开关：

```html
data-testid="workbench-candidate-value-toggle"
data-series-key="hpDamageFormulaParamCandidate"
```

开关只影响当前 `TimelineGridPreview` 内部可见性：

- curve line 渲染数量。
- candidate marker 渲染数量。
- frame hotspot 聚合值。
- selected frame summary 当前可见值。

不会改写 `candidateValueSeries.chart`，也不会改变 `applied = false` 的候选语义。

### 60.2 selected frame summary

选中按帧 hotspot 或候选 marker 后，时间轴下方显示：

```html
data-testid="workbench-candidate-value-frame-summary"
data-testid="workbench-candidate-value-frame-summary-values"
data-testid="workbench-candidate-value-frame-summary-source"
```

当前摘要读取并展示：

- `frameLabel`
- `hitIndex`
- 当前可见 series 的 `value` / `unit`
- `hitSkillId`
- `elementConfigIds`
- `sourceStatus`
- `timeAdjustmentStatus`

### 60.3 当前样本

默认末音普攻样本：

- 默认可见：3 条曲线、15 个 marker、5 个按帧 hotspot。
- 首帧值摘要：`HP 2,500 raw-param / 韧性 7,000 raw-field / 能量 2,700 raw-field`。
- 关闭 HP 后：2 条曲线、10 个 marker，首帧摘要不再显示 HP。

### 60.4 当前边界

- 这不是新的数据契约，只是把既有 chart point 字段投影到交互 UI。
- 选中帧来源摘要仍不是 per-element 全量详情；下一阶段应补 `valueSamples`、`candidateCount`、source/local/chain 帧等下钻信息。
- 多动作长轴的曲线密度控制仍未完成。

## 61. 阶段 5-8AH：TimelineGrid 候选来源详情与选中帧范围

阶段 5-8AH 继续使用既有 `candidateValueSeries.chart.series[].points[]`，没有新增底层仿真字段，也没有迁移 schema。

### 61.1 marker passthrough

`TimelineGridPreview` 的候选 marker 现在会透传 chart point 的更多来源字段：

- `valueMin`
- `valueMax`
- `valueSamples`
- `candidateCount`
- `sourceFrameIndex`
- `displayFrameIndex`
- `localFrameIndex`
- `chainStartFrame`
- `absoluteFrameIndex`
- `sourceTimeMs`
- `displayTimeMs`

这些字段只用于 UI 展示和测试断言，不改变 `candidateValueSeries.chart` 原始结构。

### 61.2 detail rows

选中帧摘要新增详情行：

```html
data-testid="workbench-candidate-value-frame-detail-row"
data-series-key="hpDamageFormulaParamCandidate" data-candidate-count="4"
data-source-frame-index="12"
```

当前每行展示：

- series label
- 当前值与单位
- `valueSamples` 和 `candidateCount`
- `sourceFrameIndex/displayFrameIndex/localFrameIndex/chainStartFrame/absoluteFrameIndex`
- `elementConfigIds`

### 61.3 display scope

候选曲线范围新增：

```html
data-testid="workbench-candidate-value-scope-option"
data-scope-key="selected-frame"
```

当前支持：

- `all`：显示当前可见 series 的全部候选点。
- `selected-frame`：仅显示已选中 hit 帧的候选点；未选中候选帧前禁用。

### 61.4 当前样本

默认末音普攻首帧：

- HP detail：`2,500 raw-param`
- HP samples：`1,000 / 1,800 / 1,900 / 2,500`
- HP candidateCount：`4`
- frame detail：`src12 / disp12 / local12 / chain0 / abs12`
- element：`109001081 / 109001306`

切换到 `selected-frame` 后：

- candidate marker：3
- candidate curve：3
- frame hotspot：1

### 61.5 当前边界

- 详情行仍是 chart point 级别，不是每个 `elementConfigId` 的原始字段拆解。
- `selected-frame` 是长轴密度控制的最小入口，尚未覆盖按 actor/action/series 组合过滤。

## 62. 阶段 5-8AI：candidateValueSeries per-element 详情与组合过滤

阶段 5-8AI 在 `candidateValueSeries.series[].points[]` 和 `candidateValueSeries.chart.series[].points[]` 上新增 `elementDetails[]`。该字段来自 `actionResultTimeline[].hitCandidates[].candidates[]`，用于 Workbench 选中帧详情，不参与最终公式计算。

### 62.1 elementDetails[]

每个候选曲线点新增：

```json
{
  "elementDetails": [
    {
      "elementConfigId": 109001306,
      "pathId": 123,
      "elementName": "TDamageElementParams",
      "hpDamage": {
        "rawFormulaParamValues": [1000, 1800, 2500],
        "formulaFunctionIds": [1, 2],
        "formulaFunctionMatchedIds": [1, 2]
      },
      "toughnessDamage": {
        "weakBreakDamageRate": 7000,
        "hitType": 1,
        "interruptPriority": 1,
        "useOneBreak": 0
      },
      "selfEnergyChange": {
        "recoverSP": 2700,
        "petRecoverSP": 10399,
        "recoverInterval": 9999,
        "ownerScope": "self"
      },
      "applied": false
    }
  ]
}
```

字段说明：

- `hpDamage.rawFormulaParamValues`：过滤掉 `10000` 常量槽后的 HP 参数候选。
- `toughnessDamage.weakBreakDamageRate`：削韧字段候选。
- `selfEnergyChange.recoverSP/petRecoverSP/recoverInterval`：自身能量相关字段候选。
- `applied` 必须保持 `false`，表示仍未应用为最终伤害、削韧或充能公式。

### 62.2 TimelineGrid filters

`TimelineGridPreview` 新增组合过滤入口：

```html
data-testid="workbench-candidate-value-actor-filter"
data-testid="workbench-candidate-value-action-filter"
```

当前可组合的过滤维度：

- 角色：按 actor lane 过滤。
- 动作：按 `actionId` 过滤。
- 曲线：沿用 HP / 韧性 / 能量 series 显隐。
- 范围：沿用 `all` / `selected-frame`。

### 62.3 当前样本

默认末音普攻首帧：

- `109001306`：HP `1,000 / 1,800 / 2,500`，韧性 `7,000`，能量 `2,700`，宠物能量 `10,399`，间隔 `9,999`。
- `109001081`：HP `1,000 / 1,900 / 2,500`，韧性 `7,000`，能量 `2,700`，宠物能量 `10,399`，间隔 `9,999`。

### 62.4 当前边界

- `elementDetails[]` 是候选字段明细，不代表执行顺序、同 hit 多候选组合方式或最终公式。
- 组合过滤已接入 UI，但当前默认 fixture 只有一个 actor 和一个 action；多动作验证需要后续样本。

## 63. 阶段 5-8AJ：per-element 公式函数 / 槽位详情

阶段 5-8AJ 扩展 `elementDetails[]`，把每 hit 的三值字段候选与动作级同 `elementConfigId` 的公式函数、`skillsub_ele_value` 等级槽位证据合并到同一详情对象中。该字段仍只服务 Workbench 候选详情展示，不进入最终公式计算。

### 63.1 elementDetails[].hpDamage

新增或继续透传：

```json
{
  "hpDamage": {
    "formulaFunctionRefs": [
      {
        "field": "function_1",
        "functionId": 1,
        "functionOutput": "G/10000",
        "variables": ["G"],
        "applied": false
      },
      {
        "field": "function_2",
        "functionId": 2,
        "functionOutput": "(self.ATK[0]*A)/10000",
        "variables": ["A"],
        "applied": false
      }
    ],
    "formulaFunctionEvidence": {
      "status": "formula-functions-matched",
      "applied": false
    }
  }
}
```

字段说明：

- `formulaFunctionRefs[]` 是每个 element 的轻量展示字段，来自 `TDamageElementParams.formulaParams.function_1/function_2 -> element_formula` 候选关系。
- `formulaFunctionEvidence` 保留更完整的证据摘要，供后续详情表或 tooltip 使用。
- `applied` 必须保持 `false`，不能据此直接计算最终 HP。

### 63.2 elementDetails[].skillLevelBridge

新增或继续透传：

```json
{
  "skillLevelBridge": {
    "status": "skillsub-element-level-bridge-found",
    "levelRows": 12,
    "parameterIds": [1, 7],
    "varyingParameterIds": [1],
    "formulaSlotAlignment": {
      "directSlotMatchParamIds": [7],
      "overrideCandidateParamIds": [1],
      "parameterSummaries": [
        {
          "id": 1,
          "variable": "A",
          "relationStatus": "level-scaling-override-candidate",
          "firstLevelValue": 1600,
          "lastLevelValue": 3360
        },
        {
          "id": 7,
          "variable": "G",
          "relationStatus": "constant-direct-slot-match",
          "formulaParamValue": 10000
        }
      ]
    }
  }
}
```

字段说明：

- `formulaSlotAlignment` 表示 `skillsub_ele_value.valueParam` 与 `TDamageElementParams.formulaParamValues` 的槽位候选关系。
- 默认末音普攻样本中，`A` 是等级覆盖候选 `1,600 -> 3,360`，`G` 是常量直连 `10,000`。
- 这仍不证明覆盖规则已经确认，只说明候选关系已能按 element 展示。

### 63.3 hit candidate merge

`createHitCandidatePreview()` 会按 `elementConfigId` 将：

- `normalAttackHitChainCandidate.hitGroups[].damageElementFieldMappings[]` 的每 hit 三值字段候选；
- `damageElementSource.candidates[]` 的动作级公式函数、槽位、等级桥接证据；

合并后再写入 `hitCandidates[].candidates[]`。这样 `candidateValueSeries.chart.points[].elementDetails[]` 可以同时展示 HP 参数、削韧、能量、公式函数和等级槽位。

### 63.4 多动作过滤 fixture

新增 `src/__tests__/features/TimelineGridPreview.test.js`，构造：

- 2 个 actor；
- 2 个 action；
- HP / 韧性 / 能量 3 条 candidate series；
- 每条 series 各 2 个点。

验证结果：

- 初始 marker 数为 6。
- 选择 `actor-b` 后为 3。
- 叠加 `action-a` 后为 0。
- 恢复全部 actor 且保留 `action-a` 后为 3。
- 再关闭 HP series 后为 2。

## 64. 阶段 5-8AK：候选帧 per-element 横向比较 UI 模型

阶段 5-8AK 不新增持久化 schema，也不改变 `candidateValueSeries.chart` 原始数据。`TimelineGridPreview` 在选中候选帧时，从当前 frame group 的可见 `values[].elementDetails[]` 派生 `selectedCandidateElementComparisonRows`，用于 UI 对比和原生 tooltip。

### 64.1 selectedCandidateElementComparisonRows

派生行按 `elementConfigId + pathId` 聚合：

```json
{
  "elementConfigId": 109001306,
  "pathId": "-4052262175632216603",
  "hpText": "1,000/1,800/2,500",
  "functionText": "f1:G/10000/f2:self.ATK[0]*A/10000",
  "slotText": "A覆盖1,600-3,360/G直连10,000",
  "toughnessText": "7,000",
  "energyText": "能量2,700/宠物10,399/间隔9,999",
  "statusText": "未应用 · function组合待验证 · 等级覆盖待验证:1 · 每hit倍率待分配"
}
```

字段说明：

- `hpText` 来自 `hpDamage.rawFormulaParamValues`。
- `functionText` 来自 `hpDamage.formulaFunctionRefs[]`。
- `slotText` 来自 `skillLevelBridge.formulaSlotAlignment.parameterSummaries[]`。
- `toughnessText` 来自 `toughnessDamage.weakBreakDamageRate`。
- `energyText` 来自 `selfEnergyChange.recoverSP/petRecoverSP/recoverInterval`。
- `statusText` 明确记录仍未应用公式、function 组合待验证、等级覆盖待验证和每 hit 倍率待分配。

### 64.2 DOM hooks

新增：

```html
data-testid="workbench-candidate-element-comparison"
data-testid="workbench-candidate-element-comparison-row"
data-element-config-id="109001306" data-status="未应用 · function组合待验证 ·
等级覆盖待验证:1 · 每hit倍率待分配"
```

每行 `title` 属性作为最小 tooltip，串联 element、HP、函数、槽位、削韧、能量和状态。

### 64.3 当前边界

- 这是前端派生比较模型，不是导出数据结构。
- 当前 tooltip 是原生 `title`，还不是完整交互详情面板。
- `statusText` 是诊断状态，不代表已经确认 `DamageElement` 的最终公式执行顺序。

## 65. 阶段 5-8AL：DamageElement 公式执行证据矩阵

阶段 5-8AL 在 `actionResultTimeline[].hpDamage.sourceEvidence` 下新增 `formulaExecutionEvidenceMatrix`。该字段由仿真投影层从动作级 `formulaCandidatePreview`、`sourceEvidence.candidates[]` 和逐 hit `hitCandidates[]` 派生，用于把公式执行顺序候选、等级槽位覆盖候选和每 hit 倍率缺口放到同一张 evidence-only 矩阵。

### 65.1 字段位置

```json
{
  "actionResultTimeline": [
    {
      "hpDamage": {
        "sourceEvidence": {
          "formulaExecutionEvidenceMatrix": {
            "status": "evidence-matrix-built-execution-unconfirmed",
            "applied": false
          }
        }
      }
    }
  ]
}
```

### 65.2 矩阵结构

```json
{
  "status": "evidence-matrix-built-execution-unconfirmed",
  "actionId": "action-0001",
  "actionName": "普通攻击",
  "skillId": 10900101,
  "actionVariantIndex": 0,
  "actionVariantLabel": "普攻",
  "hitCount": 5,
  "elementCount": 2,
  "rowCount": 2,
  "preferredStrategy": "function_2-current-level-value-param",
  "rows": [
    {
      "elementConfigId": 109001081,
      "hitIndexes": [1],
      "hitBindingStatus": "per-hit-candidate-bound",
      "preferredFunctionOrderCandidate": {
        "strategy": "function_2-current-level-value-param",
        "expression": "function_2",
        "inputSource": "skill_logic.currentLevel.valueParam",
        "roundedValue": 307,
        "comparisonStatus": "compared-to-raw-projection",
        "rawProjectionValue": 12461,
        "previewRoundedValue": 307,
        "differenceStatus": "large-difference",
        "applied": false
      },
      "slotOverrideCandidates": [
        {
          "id": 1,
          "variable": "A",
          "relationStatus": "level-scaling-override-candidate",
          "formulaParamValue": 1000,
          "firstLevelValue": 1600,
          "lastLevelValue": 3360,
          "applied": false
        }
      ],
      "directSlotMatches": [
        {
          "id": 7,
          "variable": "G",
          "relationStatus": "constant-direct-slot-match",
          "formulaParamValue": 10000,
          "firstLevelValue": 10000,
          "lastLevelValue": 10000,
          "applied": false
        }
      ],
      "perHitScaleGap": {
        "status": "requires-runtime-scale-or-hit-allocation",
        "requiredScaleToRaw": 40.58957654723127,
        "requiredPerHitScaleToRaw": 8.117915309446254,
        "hitCount": 5,
        "boundHitCount": 1,
        "differenceStatus": "large-difference",
        "applied": false
      },
      "unresolved": [
        "function-combination-order-unconfirmed",
        "level-override-application-point-unconfirmed",
        "per-hit-multiplier-allocation-unconfirmed"
      ],
      "applied": false
    }
  ],
  "diagnostics": {
    "functionCombinationOrderStatus": "unconfirmed",
    "levelOverrideApplicationStatus": "unconfirmed",
    "perHitMultiplierAllocationStatus": "unconfirmed",
    "rowsWithLargeDifference": 2,
    "rowsWithSlotOverrideCandidates": 2,
    "rowsWithHitBindings": 2
  },
  "applied": false
}
```

字段说明：

- `functionOrderCandidates[]` 是从 `formulaCandidatePreview.combinationPreviews[]` 按 element 分组后的组合候选，当前包括 f2、f1\*f2、f1+f2 等简单诊断组合。
- `preferredFunctionOrderCandidate` 优先选择 `function_2-current-level-value-param`；若不存在，则选择首个可与 raw 投影比较的组合。
- `slotOverrideCandidates[]` 记录等级值可能覆盖的变量槽，当前默认样本为 A 槽。
- `directSlotMatches[]` 记录常量直连槽，当前默认样本为 G 槽。
- `perHitScaleGap` 记录候选值与 raw HP 投影之间需要的缩放；该字段用于诊断运行时缺口，不参与计算。
- `hitIndexes[]` 来自逐 hit 候选中包含该 element 的 hit 编号。默认样本中两个动作级 element 均只绑定到 hit1，后续 hit 的 element 仍需要继续追等级值或运行时映射。

### 65.3 Workbench 摘要

`AnalysisPanel` 在三值来源中新增一行摘要：

```text
执行矩阵 2 element · function未确认 · A覆盖候选 2 · 缩放 ×40.6 / 每 hit ×8.1 · 差异 2/2
```

该摘要只用于提示当前证据矩阵和主要缺口，不替代后续完整详情面板。

### 65.4 当前边界

- `formulaExecutionEvidenceMatrix.applied` 必须保持 `false`，直到 `DamageElement` runtime 执行顺序确认。
- 该矩阵只接在 HP 伤害的 sourceEvidence 下；削韧和充能仍分别由各自 sourceEvidence 追踪候选字段。
- 下一阶段需要扩展到更多动作/技能样本，验证 `hitIndexes`、A 槽覆盖点和缩放缺口是否跨动作稳定。

## 66. 阶段 5-8AM：跨动作公式执行矩阵摘要

阶段 5-8AM 在 `simulation.summary` 下新增 `formulaExecutionMatrixSummary`，用于把多个动作的 `formulaExecutionEvidenceMatrix` 聚合为跨动作/跨 element 的诊断摘要。该字段仍然是 evidence-only，不参与 HP、削韧或充能计算。

### 66.1 字段位置

```json
{
  "summary": {
    "formulaExecutionMatrixSummary": {
      "status": "formula-execution-matrices-found",
      "applied": false
    }
  }
}
```

### 66.2 顶层摘要

四动作样本当前输出：

```json
{
  "status": "formula-execution-matrices-found",
  "actionCount": 4,
  "matrixActionCount": 4,
  "actionVariantCount": 4,
  "actionVariantLabels": ["普攻", "重击", "闪击", "跃击"],
  "rowCount": 8,
  "elementCount": 2,
  "preferredStrategy": "function_2-current-level-value-param",
  "requiredScaleMin": 2.501628664495114,
  "requiredScaleMax": 40.58957654723127,
  "requiredPerHitScaleMin": 2.501628664495114,
  "requiredPerHitScaleMax": 11.882736156351792,
  "scaleSpreadStatus": "varies-by-action-variant",
  "perHitScaleSpreadStatus": "varies-by-action-variant",
  "hitBindingCoverageStatus": "some-rows-missing-hit-bindings",
  "slotOverrideCoverageStatus": "all-rows-have-slot-override-candidates",
  "rowsWithLargeDifference": 8,
  "rowsWithSlotOverrideCandidates": 8,
  "rowsWithDirectSlotMatches": 8,
  "rowsWithHitBindings": 2,
  "applied": false
}
```

字段说明：

- `matrixActionCount`：有 `formulaExecutionEvidenceMatrix` 的动作数量。
- `rowCount`：所有矩阵行总数。
- `elementCount`：跨动作唯一 `elementConfigId` 数量。
- `requiredScaleMin/Max`：首选 function 组合候选对齐 raw HP 所需的缩放范围。
- `requiredPerHitScaleMin/Max`：按当前 hitCount 归一后的缩放范围。
- `hitBindingCoverageStatus`：矩阵行是否有逐 hit 绑定。
- `slotOverrideCoverageStatus`：矩阵行是否有 A 槽等级覆盖候选。

### 66.3 actionSummaries

`actionSummaries[]` 按动作聚合：

```json
{
  "actionId": "action-segment-1",
  "actionVariantLabel": "重击",
  "rawMultiplier": "190%",
  "rowCount": 2,
  "elementConfigIds": [109001081, 109001306],
  "requiredScaleMin": 11.882736156351792,
  "requiredScaleMax": 11.882736156351792,
  "rowsWithHitBindings": 0,
  "hitBindingCoverageStatus": "no-rows-have-hit-bindings",
  "slotOverrideCandidateCount": 2,
  "directSlotMatchCount": 2,
  "applied": false
}
```

当前含义：

- 【普通攻击】两行都有 hit 绑定。
- 【重击】【闪击】【跃击】都有动作级矩阵，但 `rowsWithHitBindings = 0`，说明还缺 hit 级 DamageElement 绑定证据。

### 66.4 elementSummaries

`elementSummaries[]` 按 element 聚合：

```json
{
  "elementConfigId": 109001081,
  "actionCount": 4,
  "actionVariantLabels": ["普攻", "重击", "闪击", "跃击"],
  "hitIndexes": [1],
  "rowCount": 4,
  "requiredScaleMin": 2.501628664495114,
  "requiredScaleMax": 40.58957654723127,
  "rowsWithHitBindings": 1,
  "hitBindingCoverageStatus": "some-rows-missing-hit-bindings",
  "slotOverrideCandidateVariables": ["A"],
  "directSlotMatchVariables": ["G"],
  "applied": false
}
```

该摘要用于判断同一 element 的缩放缺口是否跨动作稳定，以及某个 element 是否只在部分动作中能绑定 hit。

### 66.5 Workbench 摘要

`AnalysisPanel` 在三值来源顶部新增：

```text
执行矩阵摘要 4 动作 · 8 行 · 2 element · 缩放 ×2.5-×40.6 / 每 hit ×2.5-×11.9，随动作变化 · hit绑定 2/8
```

默认单动作样本显示：

```text
执行矩阵摘要 1 动作 · 2 行 · 2 element · 缩放 ×40.6 / 每 hit ×8.1 · hit绑定 2/2
```

### 66.6 当前边界

- `formulaExecutionMatrixSummary.applied` 必须保持 `false`。
- 该摘要不能证明 f2、f1\*f2 或 f1+f2 就是真实 `DamageElement` 执行顺序。
- 下一阶段应优先补非普攻动作的 hit 绑定来源，再判断缩放缺口是否来自 hit 分配、等级覆盖点、运行时常量或其他 `DamageElement` 逻辑。

## 67. 阶段 5-8AN：hit 绑定缺口与 skill_control 候选摘要

阶段 5-8AN 在 `summary.formulaExecutionMatrixSummary` 下新增 `hitBindingGapSummary`，并在 `actionSummaries[]` 下新增 `hitBindingGap`。该字段用于把缺 hit 级 `DamageElement` 绑定的动作形态，与已有 `formulaCandidatePatternSummary.skillControlBehaviorCorrelations[].actionVariantBindingCandidates[]` 对齐。

### 67.1 hitBindingGapSummary

四动作样本当前输出：

```json
{
  "status": "all-missing-hit-actions-have-skill-control-candidates",
  "actionCount": 4,
  "missingActionCount": 3,
  "missingRowCount": 6,
  "actionsWithBindingCandidates": 3,
  "actionVariantLabels": ["重击", "闪击", "跃击"],
  "candidateSourceNames": ["攻击碰撞"],
  "candidateStateNames": ["Skill0_6"],
  "candidateSubSkillIds": [109001011],
  "bindingStatuses": ["shared-action-family-candidate-unconfirmed"],
  "applied": false
}
```

字段说明：

- `missingActionCount`：存在矩阵行但缺 hit 绑定的动作数。
- `missingRowCount`：缺 hit 绑定的矩阵行数。
- `actionsWithBindingCandidates`：缺口动作中，已找到 skill_control 行为候选的动作数。
- `candidateSourceNames/stateNames/subSkillIds`：只聚合最高置信度候选，用于避免弱候选污染摘要。

### 67.2 actionSummaries[].hitBindingGap

重击样例：

```json
{
  "actionId": "action-segment-1",
  "actionVariantLabel": "重击",
  "status": "skill-control-binding-candidate-found-hit-elements-unresolved",
  "matrixRowCount": 2,
  "rowsWithHitBindings": 0,
  "missingRowCount": 2,
  "behaviorBindingStatus": "action-variant-binding-candidates-found",
  "behaviorBindingConfidence": "low",
  "behaviorBindingCandidateCount": 5,
  "sourceNames": ["攻击碰撞"],
  "sourceStartFrames": [13, 16, 19],
  "stateNames": ["Skill0_6"],
  "hitEffects": ["11_109001_133", "11_109001_005"],
  "subSkillIds": [109001011],
  "bindingStatuses": ["shared-action-family-candidate-unconfirmed"],
  "unresolved": [
    "hit-damage-element-binding-unresolved",
    "external-element-object-binding-unconfirmed"
  ],
  "applied": false
}
```

`behaviorBindingEvidence.candidates[]` 仍保留最多 5 条候选，其中包括较弱的普通攻击窗口；但摘要字段只使用最高置信度候选。

### 67.3 Workbench 摘要

当存在缺口时，`AnalysisPanel` 的跨动作矩阵摘要会追加：

```text
缺口候选 3/3
```

默认单动作普攻样本没有缺口，因此不显示该片段。

### 67.4 当前边界

- `hitBindingGapSummary` 证明“缺口动作有 skill_control 候选”，不证明该候选已绑定到最终 hit 或最终 `TDamageElementParams`。
- `shared-action-family-candidate-unconfirmed` 仍需继续追外部 element 对象、hitEffect、subSkill 与 IL2CPP runtime 执行顺序。
- 下一阶段应沿 `elementPathIds` / `elementRoundedPathIds` / `subSkillIds` 把非普攻动作候选推进到 hit 级三值字段映射。

## 68. 阶段 5-8AO：非普攻缺口外部 DamageElement 候选桥接

阶段 5-8AO 在 `actionSummaries[].hitBindingGap` 下新增 `externalElementBinding`，并在 `hitBindingGapSummary` 下新增 `externalElementBindingSummary`。该字段用于把缺 hit 绑定动作的 skill_control 行为候选，继续按 `skillId + elementPathIds[]` 桥接到外部 element 对象和 `TDamageElementParams` 字段映射。

### 68.1 actionSummaries[].hitBindingGap.externalElementBinding

重击样例：

```json
{
  "status": "damage-element-field-candidates-found-hit-binding-unconfirmed",
  "skillId": 10900101,
  "sourceCandidateCount": 3,
  "elementBaseRefCount": 9,
  "resolvedElementRefCount": 9,
  "uniqueExternalElementObjectCount": 3,
  "damageElementRefCount": 3,
  "damageElementCandidateCount": 1,
  "sourceNames": ["攻击碰撞"],
  "sourceStartFrames": [13, 16, 19],
  "stateNames": ["Skill0_6"],
  "hitEffects": ["11_109001_133", "11_109001_005"],
  "subSkillIds": [109001011],
  "scriptClassNames": [
    "TDamageElementParams",
    "TFreezeFrameElementParams",
    "TFxElementParams"
  ],
  "damageElementPathIds": ["-5633710717881758712"],
  "damageElementConfigIds": [109001251],
  "damageElementNames": ["ast_109001251"],
  "hpFormulaFunctionIds": [1, 2],
  "hpFormulaFunctionOutputs": ["G/10000", "(self.ATK[0]*A)/10000"],
  "weakBreakDamageRates": [7000],
  "recoverSPValues": [5899],
  "petRecoverSPValues": [22999],
  "skillLevelBridgeStatuses": ["skillsub-element-level-bridge-missing"],
  "applied": false
}
```

### 68.2 externalElementBinding.candidates[]

每个候选对应一个最高置信度 `behaviorBindingEvidence.candidates[]` 来源窗口。字段要点：

- `elementRefs[]`：候选窗口里的每个外部 element PathID。
- `elementRefs[].objectStatus`：是否在 `externalElementObjectEvidence.objects[]` 中解析到对象本体。
- `elementRefs[].scriptClassName`：外部对象脚本类型候选，例如 `TDamageElementParams`、`TFreezeFrameElementParams`、`TFxElementParams`。
- `elementRefs[].damageElementFieldMapping`：当 PathID 命中 `damageElementFieldMappingEvidence.fieldMappings[]` 时，嵌入 HP / 削韧 / 充能三值字段摘要。
- `damageElementFieldMapping.skillLevelBridge.status`：必须保留等级桥接状态；当前 `109001251` 为 `skillsub-element-level-bridge-missing`。

### 68.3 hitBindingGapSummary.externalElementBindingSummary

四动作样本当前输出：

```json
{
  "status": "all-candidate-gaps-have-damage-element-field-candidates",
  "gapCount": 3,
  "gapsWithExternalElementCandidates": 3,
  "gapsWithDamageElementCandidates": 3,
  "damageElementCandidateCount": 1,
  "damageElementConfigIds": [109001251],
  "damageElementPathIds": ["-5633710717881758712"],
  "sourceStartFrames": [13, 16, 19],
  "stateNames": ["Skill0_6"],
  "subSkillIds": [109001011],
  "hpFormulaFunctionIds": [1, 2],
  "weakBreakDamageRates": [7000],
  "recoverSPValues": [5899],
  "skillLevelBridgeStatuses": ["skillsub-element-level-bridge-missing"],
  "applied": false
}
```

### 68.4 Workbench 摘要

当存在缺口外部 DamageElement 候选时，`AnalysisPanel` 的跨动作矩阵摘要会追加：

```text
伤害元素候选 3/3
```

单个重击动作切换时会显示：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1
```

### 68.5 当前边界

- `externalElementBinding` 证明候选 PathID 能追到外部对象和 DamageElement 字段，不证明该 DamageElement 已绑定到最终 hit。
- `109001251` 与动作级矩阵当前使用的 `109001081 / 109001306` 不一致；下一阶段必须解释这条差异，不能直接把二者合并计算。
- `skillsub-element-level-bridge-missing` 表明 `109001251` 暂未找到当前等级 `valueParam` 覆盖点；最终公式仍保持 `applied: false`。

## 69. 阶段 5-8AP：action-level 与 skill_control element 来源差异摘要

阶段 5-8AP 在 HP source、hit 绑定缺口和跨动作摘要中补充 element 来源对齐信息。新增字段仍全部是 evidence-only，用于解释为什么当前动作级矩阵使用 `109001081 / 109001306`，而非普攻 skill_control 缺口候选落到 `109001251`。

### 69.1 hpDamage.sourceEvidence.actionLevelElementSource

`actionResultTimeline[].hpDamage.sourceEvidence` 新增：

```json
{
  "actionLevelElementSource": {
    "sourceKind": "skill_logic.currentLevel.elementValues",
    "sourcePath": "skill-logic-index.json.levels.elementValues",
    "skillsubEleValueTablePath": "C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/skillsub_ele_value.json",
    "skillId": 10900101,
    "level": 1,
    "levelIndex": 0,
    "subSkillId": 10900101,
    "skillLevelRowId": 1657,
    "elementConfigIds": [109001081, 109001306],
    "rowCount": 2,
    "rows": [
      {
        "rowId": 973,
        "elementConfigId": 109001081,
        "valueParam": "1#1600|7#10000"
      },
      {
        "rowId": 985,
        "elementConfigId": 109001306,
        "valueParam": "1#1600|7#10000"
      }
    ],
    "applied": false
  }
}
```

该字段只记录动作级 `skill_logic.currentLevel.elementValues` 的来源，不表示这些行已经绑定到每个 hit 或最终公式。

### 69.2 actionSummaries[].hitBindingGap.elementSourceAlignment

`summary.formulaExecutionMatrixSummary.actionSummaries[].hitBindingGap` 新增：

```json
{
  "elementSourceAlignment": {
    "status": "external-damage-elements-diverge-from-action-level-elements",
    "actionLevelSourceKind": "skill_logic.currentLevel.elementValues",
    "actionLevelSkillId": 10900101,
    "actionLevelSubSkillId": 10900101,
    "actionLevelElementConfigIds": [109001081, 109001306],
    "matrixElementConfigIds": [109001081, 109001306],
    "externalElementSourceKind": "skill_control.elementBaseDatas",
    "externalStateNames": ["Skill0_6"],
    "externalSubSkillIds": [109001011],
    "externalHitEffects": ["11_109001_133", "11_109001_005"],
    "externalDamageElementConfigIds": [109001251],
    "overlapElementConfigIds": [],
    "actionLevelOnlyElementConfigIds": [109001081, 109001306],
    "externalOnlyElementConfigIds": [109001251],
    "matrixMatchesActionLevel": true,
    "externalSkillLevelBridgeStatuses": [
      "skillsub-element-level-bridge-missing"
    ],
    "finding": "skill-control-subskill-damage-element-not-in-action-level-values",
    "unresolved": [
      "action-variant-element-selection-unconfirmed",
      "skill-control-subskill-to-skill-level-bridge-unconfirmed",
      "external-damage-element-level-bridge-missing",
      "runtime-parameter-inheritance-or-override-unconfirmed"
    ],
    "applied": false
  }
}
```

`status` 当前可见值：

- `external-damage-elements-diverge-from-action-level-elements`：外部 DamageElement 与动作级 element 均存在，但没有重叠。
- `external-damage-elements-overlap-action-level-elements`：两侧存在重叠。
- `external-damage-elements-match-action-level-elements`：外部 DamageElement 完全落在动作级 element 集合中。
- `action-level-or-external-element-source-missing`：缺少其中一侧来源。

### 69.3 hitBindingGapSummary.elementSourceAlignmentSummary

四动作样本当前输出：

```json
{
  "status": "all-candidate-gaps-have-action-level-external-element-divergence",
  "gapCount": 3,
  "alignedGapCount": 3,
  "divergentGapCount": 3,
  "overlappingGapCount": 0,
  "missingGapCount": 0,
  "actionLevelElementConfigIds": [109001081, 109001306],
  "matrixElementConfigIds": [109001081, 109001306],
  "externalDamageElementConfigIds": [109001251],
  "overlapElementConfigIds": [],
  "actionLevelOnlyElementConfigIds": [109001081, 109001306],
  "externalOnlyElementConfigIds": [109001251],
  "actionLevelSubSkillIds": [10900101],
  "externalSubSkillIds": [109001011],
  "externalStateNames": ["Skill0_6"],
  "externalHitEffects": ["11_109001_133", "11_109001_005"],
  "externalSkillLevelBridgeStatuses": ["skillsub-element-level-bridge-missing"],
  "findings": [
    "skill-control-subskill-damage-element-not-in-action-level-values"
  ],
  "unresolved": [
    "action-variant-element-selection-unconfirmed",
    "skill-control-subskill-to-skill-level-bridge-unconfirmed",
    "external-damage-element-level-bridge-missing",
    "runtime-parameter-inheritance-or-override-unconfirmed"
  ],
  "applied": false
}
```

### 69.4 Workbench 摘要

当存在来源分叉时，`AnalysisPanel` 的跨动作矩阵摘要会追加：

```text
来源差异 3/3
```

单个重击动作切换时会显示：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 来源差异 1/1
```

### 69.5 当前边界

- `elementSourceAlignment` 只解释两条证据链的来源差异，不决定最终 runtime 采用哪一组 element。
- 不能把 `109001251` 直接合并到 action-level 矩阵，也不能用 `109001081 / 109001306` 的 `valueParam` 直接覆盖 `109001251`。
- 下一阶段应追 `109001251` 的运行时参数来源：固定 `formulaParamValues`、继承 action-level `valueParam`、运行时覆盖或另一条等级配置链。

## 70. 阶段 5-8AQ：relatedElementLevelBridge 关联等级链候选

阶段 5-8AQ 在 `damageElementFieldMappingEvidence.fieldMappings[].skillLevelBridge` 下新增 `relatedElementLevelBridge`。该字段用于表达“当前 skill 直连等级桥接缺失，但同一个 `elementConfigId` 在全量 `skillsub_ele_value` 中存在关联 skill/subSkill 等级行”的证据。

### 70.1 skillLevelBridge.relatedElementLevelBridge

`109001251` 当前样例：

```json
{
  "status": "skillsub-element-level-bridge-missing",
  "elementConfigId": 109001251,
  "levelRows": 0,
  "relatedElementLevelBridge": {
    "status": "related-slot-skill-element-level-bridge-found",
    "source": "skillsub_ele_value.json.allRowsByElementId",
    "sourceSkillId": 10900101,
    "derivedSkillId": 10900125,
    "primarySkillId": 10900125,
    "primaryRelationStatus": "element-id-derived-skill-id",
    "candidateSkillIds": [10900125],
    "candidateCount": 1,
    "levelRows": 12,
    "parameterIds": [1, 7],
    "varyingParameterIds": [1],
    "firstLevel": {
      "level": 1,
      "skillLevelRowId": 1728,
      "subSkillId": 10900125,
      "rowId": 1261,
      "valueParam": "1#4500|7#10000"
    },
    "lastLevel": {
      "level": 12,
      "skillLevelRowId": null,
      "subSkillId": 10900125,
      "rowId": 1272,
      "valueParam": "1#9450|7#10000"
    },
    "inheritanceStatus": "related-skill-level-inheritance-unconfirmed",
    "applied": false
  }
}
```

### 70.2 relatedElementLevelBridge.candidates[]

每个 candidate 表示一个同 elementId 的 `skillsub_ele_value.skillId`：

```json
{
  "skillId": 10900125,
  "relationStatus": "element-id-derived-skill-id",
  "derivedFromElementId": true,
  "parentSkillId": 10900121,
  "skillType": 1,
  "skillDisplayType": 0,
  "skillModuleTag": 2,
  "characterSlotRefs": [
    {
      "characterId": 109001,
      "characterName": "末音",
      "group": "ground",
      "slot": 207
    }
  ],
  "skillLevelRowCount": 1,
  "skillLevelLevels": [1],
  "levelRows": 12,
  "parameterIds": [1, 7],
  "varyingParameterIds": [1],
  "applied": false
}
```

`skillLevelRowCount = 1` 但 `levelRows = 12` 是重要证据：当前只能确认 `skillsub_ele_value` 侧存在 12 级参数，不能确认这些参数如何跟随可升级技能等级。

### 70.3 formulaParamAlignment

`relatedElementLevelBridge.formulaParamAlignment` 复用既有槽位摘要：

- `A / 参数 1`：`4500 -> 9450`，12 级每级 +450，`relationStatus = level-scaling-override-candidate`。
- `G / 参数 7`：恒为 `10000`，与 `formulaParamValues[7]` 直连匹配。
- `conclusion = slot-override-candidate-unconfirmed`。

### 70.4 projection 与 Workbench 摘要

投影层会把该字段压缩到：

- `actionResultTimeline[].*.sourceEvidence.candidates[].skillLevelBridge.relatedElementLevelBridge`
- `hitBindingGap.externalElementBinding.candidates[].elementRefs[].damageElementFieldMapping.skillLevelBridge.relatedElementLevelBridge`
- `hitBindingGap.externalElementBinding.relatedSkillLevelBridgeStatuses`
- `hitBindingGapSummary.externalElementBindingSummary.relatedSkillLevelBridgeStatuses`

Workbench 摘要新增：

```text
关联等级链 3/3
```

单个重击动作切换时显示：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 来源差异 1/1
```

### 70.5 当前边界

- `relatedElementLevelBridge` 不是最终公式输入，只是参数来源候选。
- `skillLevelBridge.status` 仍保持直连缺失；只有 `relatedElementLevelBridge.status` 表示找到了关联链。
- 下一阶段需要验证 runtime 是否通过 `elementConfigId / 10`、`parentSkill`、角色 slot、`skillModuleTag` 或 `SkillElementInjector` 执行上下文选择 `10900125` 的等级参数。

## 71. 阶段 5-8AR：runtimeParameterSourceEvidence 运行时参数来源候选

阶段 5-8AR 在 `hitBindingGap.externalElementBinding` 下新增 `runtimeParameterSourceEvidence`。该字段用于把三条原本分散的证据合并到同一候选链：

- `skill_control` 行为候选：`Skill0_6 / subSkill 109001011 / hitEffects 11_109001_133, 11_109001_005`。
- 外部 DamageElement：`elementConfigId = 109001251`、`pathId = -5633710717881758712`、`TDamageElementParams`。
- 关联等级链：`derivedSkillId = 10900125`、末音 `ground slot 207`、12 行 `A/G` 参数。

### 71.1 hitBindingGap.externalElementBinding.runtimeParameterSourceEvidence

重击样例：

```json
{
  "status": "runtime-parameter-source-candidates-found-application-unconfirmed",
  "sourceKind": "azpr-runtime-parameter-source-candidate",
  "sourceSkillId": 10900101,
  "sourceStateNames": ["Skill0_6"],
  "sourceSubSkillIds": [109001011],
  "sourceHitEffects": ["11_109001_133", "11_109001_005"],
  "sourceStartFrames": [13, 16, 19],
  "damageElementConfigIds": [109001251],
  "damageElementPathIds": ["-5633710717881758712"],
  "relatedSkillIds": [10900125],
  "derivedSkillIds": [10900125],
  "characterSlotRefs": [
    {
      "characterId": 109001,
      "characterName": "末音",
      "group": "ground",
      "slot": 207
    }
  ],
  "candidateCount": 1,
  "relationFindings": [
    "skill-control-source-subskill-uses-external-damage-element",
    "skill-control-hit-effect-links-external-damage-element",
    "element-config-id-derived-related-skill-id",
    "related-bridge-primary-skill-matches-derived-skill-id",
    "related-skill-present-in-character-slot",
    "il2cpp-damage-element-parse-receives-skill-id",
    "il2cpp-skill-element-injector-executes-damage-element"
  ],
  "applied": false
}
```

### 71.2 runtimeMethodEvidence

`runtimeParameterSourceEvidence.runtimeMethodEvidence[]` 记录 IL2CPP 签名锚点：

- `DamageElement.Parse(TElementParams param, int skillId, CustomBattleVerifyInfo verifyInfo)`，说明 DamageElement 解析阶段具备 `skillId` 参数。
- `SkillElementInjector.ExecuteDamageElement(DamageElement element)`，说明 SkillElementInjector 确实执行 DamageElement。

当前 dump 只有签名，没有方法体；因此这些锚点只能证明运行时上下文可能携带 skillId / DamageElement，不能证明 `10900125` 的 A/G 参数已经被应用。

### 71.3 externalElementBindingSummary

`hitBindingGapSummary.externalElementBindingSummary` 新增：

- `runtimeParameterSourceStatuses`
- `runtimeParameterSourceCandidateCount`
- `runtimeParameterSourceSkillIds`
- `gapsWithRuntimeParameterSourceCandidates`

四动作样例当前为：

```json
{
  "runtimeParameterSourceStatuses": [
    "runtime-parameter-source-candidates-found-application-unconfirmed"
  ],
  "runtimeParameterSourceCandidateCount": 3,
  "runtimeParameterSourceSkillIds": [10900125],
  "gapsWithRuntimeParameterSourceCandidates": 3
}
```

### 71.4 Workbench 摘要

Workbench 执行矩阵摘要新增：

```text
参数来源候选 3/3
```

单个重击动作切换时显示：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 参数来源候选 1/1 · 来源差异 1/1
```

### 71.5 当前边界

- `runtimeParameterSourceEvidence` 只是运行时参数来源候选，不是最终公式输入。
- `10900125` 的 `A = 4500-9450` 仍不能直接覆盖 `TDamageElementParams.formulaParamValues[1] = 1000`。
- HP、削韧、自身能量三条公式链仍保持 `applied: false`。
- 下一阶段应继续追 `DamageElement.Parse/Execute`、`FormulaUtility`、`RecoverSP` 和弱点击破相关执行点，确认参数覆盖顺序和三值应用点。

## 72. 阶段 5-8AS：runtimeApplicationTraceEvidence 三值运行时应用入口候选

阶段 5-8AS 在 `hitBindingGap.externalElementBinding` 下新增 `runtimeApplicationTraceEvidence`。该字段用于记录 HP、削韧、自身能量三条曲线在 IL2CPP dump 中能确认到的运行时入口和数据载体。

### 72.1 hitBindingGap.externalElementBinding.runtimeApplicationTraceEvidence

重击样例：

```json
{
  "status": "runtime-application-entrypoints-found-method-bodies-missing",
  "sourceKind": "azpr-runtime-application-trace-evidence",
  "damageElementConfigIds": [109001251],
  "damageElementPathIds": ["-5633710717881758712"],
  "trackedValueChainCount": 3,
  "methodBodyStatus": "il2cpp-dump-signatures-only",
  "parameterOverrideStatus": "related-skill-level-candidate-found-execution-override-order-unconfirmed",
  "applied": false
}
```

### 72.2 hpDamage

`runtimeApplicationTraceEvidence.hpDamage` 记录：

- 输入字段：`TDamageElementParams.formulaParams.function_1`、`function_2`、`formulaParamValues`。
- 当前函数 ID：`[1, 2]`。
- 入口方法：
  - `DamageElement.ExecuteEffect / Execute / BaseExecute / Parse`
  - `FormulaUtility.GetOutput / GetOutputDamage / Calculate / innerCalculate / GetFunctionParams / SkillDmgUp / WeaknessPointChange`
  - `FormulaUtility.OutputDamageData.outputDamage / realDamage / isCritical / isShield`

当前状态为 `formula-output-entrypoints-found-application-order-unconfirmed`。

### 72.3 toughnessDamage

`runtimeApplicationTraceEvidence.toughnessDamage` 记录：

- 输入字段：`TDamageElementParams.weakBreakDamageRate`、`TDamageElementParams.useOneBreak`。
- 当前样例值：`weakBreakDamageRates = [7000]`。
- 入口方法：
  - `FormulaUtility.GetOutputWeaknessDamage / WeaknessPointChange`
  - `WeakBreakSystem.OnTransmit / UpdateWeakState / WeakBreaking / WeakBreakEnding / WeakBreakEnd / WeaknessPointUpdate`

当前状态为 `weak-break-entrypoints-found-unit-scale-unconfirmed`。

### 72.4 selfEnergyChange

`runtimeApplicationTraceEvidence.selfEnergyChange` 记录：

- 输入字段：`TDamageElementParams.recoverSP`、`petRecoverSP`、`recoverInterval`。
- 当前样例值：`recoverSPValues = [5899]`、`petRecoverSPValues = [22999]`、`recoverIntervals = [9999]`。
- 入口方法/载体：
  - `DamageElement.RecoverSP`
  - `RecoverSPArgs.baseDelta / delta / interval / tagType / skillId / sharePercent / petSharePercent / petDelta / mainPetSharePercent`
  - `SPSystem.OnTransmit / RecoverSP / m_recoverTimerMap`

当前状态为 `recover-sp-entrypoints-found-owner-share-unconfirmed`。

### 72.5 externalElementBindingSummary

`hitBindingGapSummary.externalElementBindingSummary` 新增：

- `runtimeApplicationTraceStatuses`
- `runtimeApplicationTraceChainCount`
- `gapsWithRuntimeApplicationTraceEvidence`

四动作样例当前为：

```json
{
  "runtimeApplicationTraceStatuses": [
    "runtime-application-entrypoints-found-method-bodies-missing"
  ],
  "runtimeApplicationTraceChainCount": 9,
  "gapsWithRuntimeApplicationTraceEvidence": 3
}
```

### 72.6 Workbench 摘要

Workbench 执行矩阵摘要新增：

```text
应用入口候选 3/3
```

单个重击动作切换时显示：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 参数来源候选 1/1 · 应用入口候选 1/1 · 来源差异 1/1
```

### 72.7 当前边界

- `runtimeApplicationTraceEvidence` 只证明三条曲线存在运行时入口和数据载体，不证明最终公式已经确认。
- `methodBodyStatus = il2cpp-dump-signatures-only` 必须保留；当前没有方法体，不能确认覆盖顺序、单位和触发条件。
- `runtimeApplicationTraceEvidence.applied = false`，HP、削韧、自身能量最终公式仍不能应用。
- 下一阶段需要寻找方法体、native 符号/字符串交叉引用、反编译产物或运行时采样证据。

## 73. 阶段 5-8AT：nativeMethodSymbolEvidence 原生方法符号与方法体缺口证据

阶段 5-8AT 在 `runtimeApplicationTraceEvidence` 下新增方法体可用性和原生方法符号证据。该字段用于明确区分：

- 已找到：目标运行时入口的原生地址、签名、字段布局和字符串字面量。
- 未找到：可直接确认执行顺序的 C# 方法体、IDA/Ghidra 伪代码或运行时 hook 日志。

### 73.1 runtimeApplicationTraceEvidence 顶层新增字段

重击样例：

```json
{
  "methodBodyStatus": "native-addresses-and-signatures-found-method-bodies-not-extracted",
  "methodBodyAvailabilityStatus": "native-addresses-and-signatures-found-method-bodies-not-extracted",
  "runtimeNativeMethodSymbolCount": 27,
  "runtimeNativeMethodSymbolKeys": [
    "Lens.Gameplay.Modules.BigWorld.FormulaUtility$$GetOutputDamage@0x187F360",
    "Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$OnTransmit@0x14C05A0",
    "Lens.Gameplay.Modules.BigWorld.SPSystem$$RecoverSP@0x1483F40"
  ],
  "applied": false
}
```

### 73.2 runtimeApplicationTraceEvidence.nativeMethodSymbolEvidence

新增对象字段：

- `status`：当前为 `native-addresses-and-signatures-found-method-bodies-not-extracted`。
- `sourceKind`：`azpr-il2cpp-native-method-symbol-evidence`。
- `sourceFiles[]`：记录 `dump.cs`、`script.json`、`il2cpp.h`、`stringliteral.json` 和 `DummyDll/Assembly-CSharp.dll` 的可用状态。
- `availableEvidence[]`：记录当前已有签名、原生地址、字段布局和字符串证据。
- `missingEvidence[]`：记录仍缺 C# 方法体、IDA/Ghidra/C++ 伪代码和运行时 hook 调用顺序。
- `methodCount`：当前为 `27`，按 `qualifiedName@rva` 去重。
- `chainMethodCounts[]`：当前 HP `13`、削韧 `11`、充能 `4`。`FormulaUtility.WeaknessPointChange` 同时属于 HP 和削韧链，因此链路计数可大于去重总数。
- `targetMethods[]`：每个目标入口记录 `chains`、`className`、`method`、`qualifiedName`、`address`、`rva`、`signature`。
- `fieldLayoutEvidence[]`：记录 `RecoverSPArgs`、`FormulaUtility.OutputDamageData`、`DamageElement`、`SPSystem`、`WeakBreakSystem` 的关键字段布局。
- `stringLiteralEvidence[]`：记录 `SPSystem`、`GetOutputDamage`、`GetOutputWeaknessDamage`、`RecoverSP`、`WeakBreak`、`WeaknessPointChange`、`SkillDmgUp` 等字符串地址。
- `applied`：固定为 `false`。

### 73.3 三条曲线新增 nativeMethodSymbols

`runtimeApplicationTraceEvidence.hpDamage.nativeMethodSymbols[]` 当前覆盖：

- `AliveElementSystem.ExecuteDamageElement / OnExecuteDamageElement`
- `DamageElement.BaseExecute / ExecuteEffect / Execute / Parse`
- `FormulaUtility.Calculate / innerCalculate / GetFunctionParams / GetOutput / GetOutputDamage / SkillDmgUp / WeaknessPointChange`

`runtimeApplicationTraceEvidence.toughnessDamage.nativeMethodSymbols[]` 当前覆盖：

- `FormulaUtility.GetOutputWeaknessDamage / WeaknessPointChange`
- `WeakBreakSystem.OnSelfTakenDamage / OnTransmit / OnWeakPointChange / UpdateWeakState / WeakBreaking / WeakBreakEnding / WeakBreakEnd / WeaknessPointUpdate`

`runtimeApplicationTraceEvidence.selfEnergyChange.nativeMethodSymbols[]` 当前覆盖：

- `RecoverSPArgs..ctor`
- `DamageElement.RecoverSP`
- `SPSystem.OnTransmit / RecoverSP`

### 73.4 externalElementBindingSummary

`hitBindingGapSummary.externalElementBindingSummary` 新增：

- `runtimeMethodBodyStatuses`
- `runtimeNativeMethodSymbolStatuses`
- `runtimeNativeMethodSymbolCount`
- `gapsWithRuntimeNativeMethodSymbols`

四动作样例当前为：

```json
{
  "runtimeMethodBodyStatuses": [
    "native-addresses-and-signatures-found-method-bodies-not-extracted"
  ],
  "runtimeNativeMethodSymbolStatuses": [
    "native-addresses-and-signatures-found-method-bodies-not-extracted"
  ],
  "runtimeNativeMethodSymbolCount": 27,
  "gapsWithRuntimeNativeMethodSymbols": 3
}
```

### 73.5 Workbench 摘要

Workbench 执行矩阵摘要新增：

```text
原生入口 3/3
```

单个重击动作切换时显示：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 参数来源候选 1/1 · 应用入口候选 1/1 · 原生入口 1/1 · 来源差异 1/1
```

### 73.6 当前边界

- `nativeMethodSymbolEvidence` 只证明目标入口可定位到原生地址，不证明方法体和执行顺序已经确认。
- `methodBodyStatus` 从阶段 5-8AS 的 `il2cpp-dump-signatures-only` 细化为 `native-addresses-and-signatures-found-method-bodies-not-extracted`。
- `runtimeApplicationTraceEvidence.applied = false`，HP、削韧、自身能量最终公式仍不能应用。
- 下一阶段需要围绕目标 RVA 生成方法体级证据或运行时采样证据。

## 74. 阶段 5-8AU：nativeDisassemblyEvidence 原生反汇编片段证据

阶段 5-8AU 在 `runtimeApplicationTraceEvidence` 下新增 `nativeDisassemblyEvidence`，并把方法体状态从“只有原生地址”推进到“已有目标反汇编片段但公式语义未确认”。

### 74.1 runtimeApplicationTraceEvidence 顶层字段变化

`runtimeApplicationTraceEvidence` 更新：

```json
{
  "status": "runtime-application-entrypoints-found-native-disassembly-snippets",
  "methodBodyStatus": "native-disassembly-snippets-extracted-formula-semantics-unconfirmed",
  "methodBodyAvailabilityStatus": "native-disassembly-snippets-extracted-formula-semantics-unconfirmed",
  "runtimeNativeDisassemblyFunctionCount": 7,
  "runtimeNativeDisassemblyFunctionKeys": [
    "FormulaUtility.GetOutputDamage@0x187F360",
    "DamageElement.Parse@0x138E5E0",
    "SPSystem.RecoverSP@0x1483F40"
  ],
  "nativeDisassemblyEvidence": {},
  "applied": false
}
```

`unresolved[]` 从 `native-method-body-decompilation-pending` 调整为：

- `native-disassembly-semantics-unconfirmed`
- `runtime-call-target-mapping-unconfirmed`
- `runtime-parameter-override-order-unconfirmed`
- `hp-toughness-energy-application-points-unconfirmed`

### 74.2 runtimeApplicationTraceEvidence.nativeDisassemblyEvidence

新增对象字段：

- `status`：当前为 `native-disassembly-snippets-extracted-formula-semantics-unconfirmed`。
- `sourceKind`：`azpr-il2cpp-native-disassembly-evidence`。
- `tool` / `toolPath`：当前使用 `dumpbin /disasm:nobytes /range`。
- `primaryBinary`：记录 TC `GameAssembly.dll` 路径、长度、metadata 长度、image base 和与 Extractor metadata 的匹配状态。
- `alternateBinaries[]`：记录 JP `GameAssembly.dll` 可用但非当前 TC dump 主来源。
- `managedDecompilerAudit`：记录 `DummyDll/Assembly-CSharp.dll` 只能反编译出 `[Address]` 与空方法 stub。
- `functionCount`：当前为 `7`。
- `targetFunctions[]`：每个目标函数记录 `chains`、`className`、`method`、`rva`、`va`、`disassemblyRange`、`observations[]`、`confirmed[]`、`unresolved[]`。
- `applied`：固定为 `false`。

当前 `targetFunctions[]` 覆盖：

- `FormulaUtility.GetOutputDamage`
- `FormulaUtility.GetOutputWeaknessDamage`
- `FormulaUtility.WeaknessPointChange`
- `DamageElement.Parse`
- `DamageElement.RecoverSP`
- `SPSystem.RecoverSP`
- `WeakBreakSystem.OnTransmit`

### 74.3 externalElementBinding 与 summary 新增字段

`hitBindingGap.externalElementBinding` 新增：

- `runtimeNativeDisassemblyStatuses`
- `runtimeNativeDisassemblyFunctionCount`
- `runtimeNativeDisassemblyFunctionKeys`

`hitBindingGapSummary.externalElementBindingSummary` 新增：

- `runtimeNativeDisassemblyStatuses`
- `runtimeNativeDisassemblyFunctionCount`
- `gapsWithRuntimeNativeDisassembly`

四动作样例当前为：

```json
{
  "runtimeNativeDisassemblyStatuses": [
    "native-disassembly-snippets-extracted-formula-semantics-unconfirmed"
  ],
  "runtimeNativeDisassemblyFunctionCount": 7,
  "gapsWithRuntimeNativeDisassembly": 3
}
```

### 74.4 已确认与仍未确认

已确认：

- `DamageElement.Parse` 会把 `TDamageElementParams+0x12C/0x130/0x134` 复制到 `DamageElement+0x240/0x244/0x248`，对应 `recoverSP/petRecoverSP/recoverInterval` 的运行时字段物化。
- `DamageElement.RecoverSP` 会用 `DamageElement+0x240` 的 `m_recoverSP` 做进入充能路径的门控。
- `SPSystem.RecoverSP` 中 `delta` 参与资源值累加路径。
- `WeakBreakSystem.OnTransmit` 存在 transmit type 分支，但具体削韧分支仍未命名。

仍未确认：

- `FormulaUtility` 下游间接调用目标、function 组合顺序和敌方属性应用顺序。
- `weakBreakDamageRate` 单位和对应 transmit type。
- `recoverSP/petRecoverSP/recoverInterval` 的共享比例、角色/宠物归属、冷却或间隔触发规则。
- `skillsub_ele_value.valueParam` 与 `TDamageElementParams.formulaParamValues` 的最终覆盖点。

### 74.5 Workbench 摘要

Workbench 执行矩阵摘要新增：

```text
反汇编片段 3/3
```

单个重击动作切换时显示：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 参数来源候选 1/1 · 应用入口候选 1/1 · 原生入口 1/1 · 反汇编片段 1/1 · 来源差异 1/1
```

### 74.6 当前边界

- `nativeDisassemblyEvidence` 只证明已有目标原生片段和部分字段复制/门控事实，不等于完整公式反编译。
- `runtimeApplicationTraceEvidence.applied = false`，HP、削韧、自身能量最终公式仍不能应用。
- 下一阶段需要命名间接调用、字段偏移和 transmit type，再把充能链路推进到可测试公式探针。

## 75. 阶段 5-8AV：selfEnergyRuntimeFormulaProbe 充能运行时公式探针

阶段 5-8AV 新增充能公式探针，用于把 `recoverSP/petRecoverSP/recoverInterval` 的运行时字段复制、门控和资源更新路径结构化记录。该探针仍为证据层，不能参与最终能量计算。

### 75.1 action-level sourceEvidence

`selfEnergyChange.sourceEvidence` 新增：

```json
{
  "selfEnergyRuntimeFormulaProbe": {
    "status": "recover-sp-runtime-probe-built-unapplied",
    "sourceKind": "azpr-self-energy-runtime-formula-probe",
    "sourceStatus": "action-level-damage-element-candidates",
    "candidateCount": 2,
    "gateOpenCount": 2,
    "gateCondition": "DamageElement.m_recoverSP > 0",
    "recoverSPValues": [2700],
    "petRecoverSPValues": [10399],
    "recoverIntervals": [9999],
    "perTenThousandRecoverSPValues": [0.27],
    "perTenThousandPetRecoverSPValues": [1.0399],
    "perTenThousandRecoverIntervals": [0.9999],
    "applied": false
  }
}
```

`selfEnergyChange` 顶层同步新增快捷字段：

```json
{
  "runtimeFormulaProbe": {
    "status": "recover-sp-runtime-probe-built-unapplied",
    "applied": false
  }
}
```

### 75.2 hitCandidates[].selfEnergyChange

每 hit 候选摘要新增：

```json
{
  "selfEnergyChange": {
    "runtimeFormulaProbe": {
      "status": "recover-sp-runtime-probe-built-unapplied",
      "candidateCount": 2,
      "gateOpenCount": 2,
      "samples": [
        {
          "elementConfigId": 109001081,
          "recoverSP": 2700,
          "petRecoverSP": 10399,
          "recoverInterval": 9999,
          "gateOpen": true,
          "scaledCandidates": {
            "rawField": {
              "recoverSP": 2700,
              "petRecoverSP": 10399,
              "recoverInterval": 9999
            },
            "perTenThousand": {
              "recoverSP": 0.27,
              "petRecoverSP": 1.0399,
              "recoverInterval": 0.9999
            }
          },
          "applied": false
        }
      ],
      "applied": false
    }
  }
}
```

### 75.3 externalElementBinding

非普攻缺口 `hitBindingGap.externalElementBinding` 新增：

- `runtimeSelfEnergyFormulaProbe`
- `runtimeSelfEnergyFormulaProbeStatuses`
- `runtimeSelfEnergyFormulaProbeCandidateCount`
- `runtimeSelfEnergyFormulaProbeGateOpenCount`

`hitBindingGapSummary.externalElementBindingSummary` 新增：

- `runtimeSelfEnergyFormulaProbeStatuses`
- `runtimeSelfEnergyFormulaProbeCandidateCount`
- `runtimeSelfEnergyFormulaProbeGateOpenCount`
- `gapsWithRuntimeSelfEnergyFormulaProbe`

四动作样例当前为：

```json
{
  "runtimeSelfEnergyFormulaProbeStatuses": [
    "recover-sp-runtime-probe-built-unapplied"
  ],
  "runtimeSelfEnergyFormulaProbeCandidateCount": 3,
  "runtimeSelfEnergyFormulaProbeGateOpenCount": 3,
  "gapsWithRuntimeSelfEnergyFormulaProbe": 3
}
```

### 75.4 探针固定结构

`runtimeFieldMap[]` 固定记录：

- `recoverSP`: `TDamageElementParams+0x12C -> DamageElement+0x240`
- `petRecoverSP`: `TDamageElementParams+0x130 -> DamageElement+0x244`
- `recoverInterval`: `TDamageElementParams+0x134 -> DamageElement+0x248`

`runtimeChainSteps[]` 固定记录：

- `DamageElement.Parse@0x138E5E0`: 字段复制已确认。
- `DamageElement.RecoverSP@0x138EEE0`: `DamageElement.m_recoverSP > 0` 门控已确认。
- `SPSystem.RecoverSP@0x1483F40`: `delta` 进入资源更新路径已确认，单位仍未确认。

`unitHypotheses[]` 固定记录：

- `raw-field`: 原始字段值候选。
- `per-ten-thousand`: 万分比缩放候选。

### 75.5 当前边界

- `selfEnergyRuntimeFormulaProbe.applied = false`，最终自身能量值仍不能从候选字段直接计算。
- `baseDelta-vs-delta-role-unconfirmed`、`recover-tag-type-unconfirmed`、`pet-recover-sp-share-rule-unconfirmed`、`recover-interval-timebase-unconfirmed` 必须继续保留。
- 下一阶段应追 `RecoverSPArgs` 构造来源、`SPSystem.OnTransmit` 类型映射和 runtime hook 采样点。

## 76. 阶段 5-8AW：ownerShareIntervalProbe 归属/共享/间隔子探针

阶段 5-8AW 在 `selfEnergyRuntimeFormulaProbe` 下新增 `ownerShareIntervalProbe`，用于记录 `SPSystem.OnTransmit` 中 RecoverSPArgs type `0x12F` 的归属、共享和 interval 节流证据。该结构仍为证据层，不参与最终自身能量值计算。

### 76.1 selfEnergyRuntimeFormulaProbe

新增字段：

```json
{
  "recoverSpArgsFieldMap": [
    {
      "field": "baseDelta",
      "offset": "0x1C",
      "runtimeUse": "sp-system-recover-sp-argument"
    }
  ],
  "ownerShareIntervalProbe": {
    "status": "owner-share-interval-subprobe-built-unapplied",
    "sourceKind": "azpr-self-energy-owner-share-interval-subprobe",
    "sourceFunction": "SPSystem.OnTransmit@0x14837F0",
    "candidateCount": 2,
    "gateOpenCount": 2,
    "confirmedRuntimeRules": {},
    "candidateMappings": {},
    "samples": [],
    "applied": false
  }
}
```

### 76.2 recoverSpArgsFieldMap

固定记录 `RecoverSPArgs` 字段：

- `id@0x18`: interval timer map key。
- `baseDelta@0x1C`: `SPSystem.RecoverSP` 参数。
- `delta@0x20`: `SPSystem.RecoverSP` 参数与资源更新值。
- `interval@0x24`: 恢复节流间隔。
- `tagType@0x28`: `TSpElementParams.ERecoverTagType`。
- `skillId@0x2C`: 来源技能 ID 载体。
- `sharePercent@0x30`: 普通共享目标缩放。
- `petSharePercent@0x34`: pet 共享缩放。
- `petDelta@0x38`: pet 共享 delta 来源。
- `isAddition@0x3C`: 直接恢复路径选择。
- `additionId@0x40`: 恢复后 addition 记录。
- `mainPetSharePercent@0x44`: main pet 共享缩放。

### 76.3 confirmedRuntimeRules

`ownerShareIntervalProbe.confirmedRuntimeRules` 当前固定记录：

- `transmitType.value = 303`，`hex = "0x12F"`。
- `directRecoverCall.method = "SPSystem.RecoverSP@0x1483F40"`。
- 直接调用字段：`tagType@0x28`、`baseDelta@0x1C`、`delta@0x20`。
- interval 节流字段：`id@0x18`、`interval@0x24`、`SPSystem.m_recoverTimerMap@0x20`。
- 共享回传路径：`background-entity-share`、`pet-share`、`main-pet-share`，均重新发送 type `0x12F`。

### 76.4 externalElementBinding

非普攻缺口 `hitBindingGap.externalElementBinding` 新增：

- `runtimeSelfEnergyOwnerShareIntervalProbeStatuses`
- `runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount`
- `runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount`

`hitBindingGapSummary.externalElementBindingSummary` 新增：

- `runtimeSelfEnergyOwnerShareIntervalProbeStatuses`
- `runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount`
- `runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount`
- `gapsWithRuntimeSelfEnergyOwnerShareIntervalProbe`

四动作样例当前为：

```json
{
  "runtimeSelfEnergyOwnerShareIntervalProbeStatuses": [
    "owner-share-interval-subprobe-built-unapplied"
  ],
  "runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount": 3,
  "runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount": 3,
  "gapsWithRuntimeSelfEnergyOwnerShareIntervalProbe": 3
}
```

### 76.5 Workbench 摘要

Workbench 执行矩阵摘要新增：

```text
归属探针 3/3
```

单动作切换到重击时可见：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 参数来源候选 1/1 · 应用入口候选 1/1 · 原生入口 1/1 · 反汇编片段 1/1 · 充能探针 1/1 · 归属探针 1/1 · 来源差异 1/1
```

### 76.6 当前边界

- `ownerShareIntervalProbe.applied = false`。
- 已确认 `SPSystem.OnTransmit` 使用 `RecoverSPArgs` 字段的方式，但尚未确认 `DamageElement.RecoverSP` 如何构造这些 args。
- 下一阶段应追 `recoverSP -> baseDelta/delta`、`petRecoverSP -> petDelta`、`recoverInterval -> interval` 的 source-to-args 映射，并确认 `recoverTagType` 枚举与共享目标筛选。

## 77. 阶段 5-8AX：sourceToArgsProbe RecoverSPArgs 构造子探针

阶段 5-8AX 在 `selfEnergyRuntimeFormulaProbe` 下新增 `sourceToArgsProbe`，用于记录 `DamageElement.RecoverSP` 如何把 `DamageElement` 运行时字段写入 `RecoverSPArgs`。该结构仍为证据层，不参与最终自身能量值计算。

### 77.1 selfEnergyRuntimeFormulaProbe

新增字段：

```json
{
  "sourceToArgsProbe": {
    "status": "source-to-args-subprobe-built-unapplied",
    "sourceKind": "azpr-self-energy-source-to-args-subprobe",
    "sourceFunction": "DamageElement.RecoverSP@0x138EEE0",
    "argsResetFunction": "RecoverSPArgs.OnReset@0x1254070",
    "candidateCount": 2,
    "gateOpenCount": 2,
    "confirmedRuntimeRules": {},
    "candidateMappings": {},
    "samples": [],
    "applied": false
  }
}
```

### 77.2 confirmedRuntimeRules

`sourceToArgsProbe.confirmedRuntimeRules` 当前固定记录：

- `DamageElement.m_recoverSP@0x240 -> RecoverSPArgs.baseDelta@0x1C`：转 float 并除以 native 常量，当前作为 per-10000 候选。
- `DamageElement.m_recoverSP@0x240 -> RecoverSPArgs.delta@0x20`：由 `baseDelta * (nativeConstant + runtimeModifierA + runtimeModifierB)` 推导。
- `DamageElement.m_petRecoverSP@0x244 -> RecoverSPArgs.petDelta@0x38`：由 `petRecoverSP` 基础值走同一 modifier 路径推导。
- `DamageElement.m_recoverInterval@0x248 -> RecoverSPArgs.interval@0x24`：转 float 并除以 native 常量，divisor 仍未确认。
- `DamageElement.RecoverSP -> RecoverSPArgs.tagType@0x28 = 0`：当前路径对应 `AttackRecoverySp`。
- `RecoverSPArgs.OnReset@0x1254070`：清空 `id` 到 `mainPetSharePercent` 的 args 字段。

枚举证据：

```json
{
  "recoverTagType": [
    { "name": "AttackRecoverySp", "value": 0 },
    { "name": "AutoRecoverySp", "value": 1 },
    { "name": "Other", "value": 2 }
  ],
  "shareType": [
    { "name": "NoShare", "value": 0 },
    { "name": "ShareHalf", "value": 1 },
    { "name": "ShareAll", "value": 2 }
  ]
}
```

### 77.3 samples

样本结构：

```json
{
  "elementConfigId": 109001081,
  "pathId": "-5794772393213319773",
  "gateOpen": true,
  "argsConstructionCandidates": {
    "baseDelta": {
      "sourceField": 2700,
      "perTenThousandCandidate": 0.27,
      "status": "source-to-baseDelta-confirmed-unit-candidate"
    },
    "delta": {
      "sourceField": 2700,
      "baseDeltaCandidate": 0.27,
      "modifierStatus": "runtime-modifier-sources-unconfirmed"
    },
    "petDelta": {
      "sourceField": 10399,
      "basePetDeltaCandidate": 1.0399,
      "modifierStatus": "runtime-modifier-sources-unconfirmed"
    },
    "interval": {
      "sourceField": 9999,
      "divisorStatus": "native-divisor-unconfirmed"
    },
    "tagType": {
      "value": 0,
      "name": "AttackRecoverySp"
    }
  },
  "applied": false
}
```

### 77.4 externalElementBinding

非普攻缺口 `hitBindingGap.externalElementBinding` 新增：

- `runtimeSelfEnergySourceToArgsProbeStatuses`
- `runtimeSelfEnergySourceToArgsProbeCandidateCount`
- `runtimeSelfEnergySourceToArgsProbeGateOpenCount`

`hitBindingGapSummary.externalElementBindingSummary` 新增：

- `runtimeSelfEnergySourceToArgsProbeStatuses`
- `runtimeSelfEnergySourceToArgsProbeCandidateCount`
- `runtimeSelfEnergySourceToArgsProbeGateOpenCount`
- `gapsWithRuntimeSelfEnergySourceToArgsProbe`

四动作样例当前为：

```json
{
  "runtimeSelfEnergySourceToArgsProbeStatuses": [
    "source-to-args-subprobe-built-unapplied"
  ],
  "runtimeSelfEnergySourceToArgsProbeCandidateCount": 3,
  "runtimeSelfEnergySourceToArgsProbeGateOpenCount": 3,
  "gapsWithRuntimeSelfEnergySourceToArgsProbe": 3
}
```

### 77.5 Workbench 摘要

Workbench 执行矩阵摘要新增：

```text
构造探针 3/3
```

单动作切换到重击时可见：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 参数来源候选 1/1 · 应用入口候选 1/1 · 原生入口 1/1 · 反汇编片段 1/1 · 充能探针 1/1 · 构造探针 1/1 · 归属探针 1/1 · 来源差异 1/1
```

### 77.6 当前边界

- `sourceToArgsProbe.applied = false`。
- 已确认 source-to-args 的主要字段写入路径，但 `delta` / `petDelta` 的 runtime modifier 来源仍未确认。
- `recoverInterval` native divisor、share config 来源对象、owner 选择和最终 SP 曲线仍未确认。

## 78. 阶段 5-8AY：runtimeModifierProbe 修正倍率与分享配置子探针

阶段 5-8AY 在 `selfEnergyRuntimeFormulaProbe` 下新增 `runtimeModifierProbe`，用于记录 `DamageElement.RecoverSP` 中 `delta/petDelta` 的修正倍率来源、interval divisor 地址和分享配置来源。该结构仍为证据层，不参与最终自身能量值计算。

### 78.1 selfEnergyRuntimeFormulaProbe

新增字段：

- `runtimeModifierProbe.status`：有候选时为 `runtime-modifier-subprobe-built-unapplied`。
- `runtimeModifierProbe.sourceKind`：固定为 `azpr-self-energy-runtime-modifier-subprobe`。
- `runtimeModifierProbe.sourceFunction`：固定为 `DamageElement.RecoverSP@0x138EEE0`。
- `runtimeModifierProbe.candidateCount` / `gateOpenCount`：沿用 `selfEnergyRuntimeFormulaProbe` 的候选数量和 `m_recoverSP > 0` 门控数量。
- `runtimeModifierProbe.confirmedRuntimeRules`：静态确认规则集合。
- `runtimeModifierProbe.modifierPropertyIds`：当前为 `[105, 228]`。
- `runtimeModifierProbe.samples[]`：每个 DamageElement 候选的修正公式预览。
- `runtimeModifierProbe.unresolved`：仍未确认的常量值、divisor 值、实时属性值和目标筛选。
- `runtimeModifierProbe.applied`：固定为 `false`。

### 78.2 confirmedRuntimeRules

`confirmedRuntimeRules` 当前包含：

- `deltaFormulaShape`：记录 `RecoverSPArgs.baseDelta@0x1C`、`delta@0x20`、`petDelta@0x38` 和公式形态 `scaledSource * (nativeConstant@0x189956B08 + SPGETUP + SPGETUP_ATK)`。
- `modifierSources[]`：
  - `SPGETUP`：`propertyId = 105 / 0x69`，来源枚举 `EBattlePropertyType.SPGETUP`。
  - `SPGETUP_ATK`：`propertyId = 228 / 0xE4`，来源枚举 `EBattlePropertyType.SPGETUP_ATK`。
  - 两者常规路径均使用 `AliveProperty.GetBattlePropertyCurrentValue@0x12A7EE0`，snapshot 路径使用 `SnapshotPropertyManager.GetBattlePropertyCurrentValue@0x181D240`，并经 `MyFloat.op_Implicit(float)@0x11B2AE0` 转 float。
- `intervalScale`：记录 `DamageElement.m_recoverInterval@0x248 -> RecoverSPArgs.interval@0x24`，divisor 地址为 `0x189956D8C`。
- `shareConfigSources[]`：
  - `RecoverSPArgs.sharePercent@0x30 <- BattleConfigData.shareEnergyPercent@0x108`
  - `RecoverSPArgs.petSharePercent@0x34 <- BattleConfigData.petShareEnergyPercent@0x10C`
  - `RecoverSPArgs.mainPetSharePercent@0x44 <- constant-1.0`

### 78.3 samples

样例结构：

```json
{
  "elementConfigId": 109001251,
  "pathId": "-5633710717881758712",
  "gateOpen": true,
  "deltaFormulaPreview": {
    "baseDeltaCandidate": 0.5899,
    "petBaseDeltaCandidate": 2.2999,
    "modifierPropertyIds": [105, 228],
    "formulaShape": "base * (nativeConstant@0x189956B08 + SPGETUP + SPGETUP_ATK)",
    "nativeConstantAddress": "0x189956B08",
    "status": "modifier-values-runtime-unapplied"
  },
  "intervalScaleCandidate": {
    "sourceField": 9999,
    "nativeDivisorAddress": "0x189956D8C",
    "status": "divisor-address-confirmed-value-unread"
  },
  "applied": false
}
```

### 78.4 externalElementBinding

非普攻缺口 `hitBindingGap.externalElementBinding` 新增：

- `runtimeSelfEnergyModifierProbeStatuses`
- `runtimeSelfEnergyModifierProbeCandidateCount`
- `runtimeSelfEnergyModifierProbeGateOpenCount`

`hitBindingGapSummary.externalElementBindingSummary` 新增：

- `runtimeSelfEnergyModifierProbeStatuses`
- `runtimeSelfEnergyModifierProbeCandidateCount`
- `runtimeSelfEnergyModifierProbeGateOpenCount`
- `gapsWithRuntimeSelfEnergyModifierProbe`

四动作样例当前为：

```json
{
  "runtimeSelfEnergyModifierProbeStatuses": [
    "runtime-modifier-subprobe-built-unapplied"
  ],
  "runtimeSelfEnergyModifierProbeCandidateCount": 3,
  "runtimeSelfEnergyModifierProbeGateOpenCount": 3,
  "gapsWithRuntimeSelfEnergyModifierProbe": 3
}
```

### 78.5 Workbench 摘要

Workbench 执行矩阵摘要新增：

```text
修正探针 3/3
```

单动作切换到重击时可见：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 参数来源候选 1/1 · 应用入口候选 1/1 · 原生入口 1/1 · 反汇编片段 1/1 · 充能探针 1/1 · 构造探针 1/1 · 修正探针 1/1 · 归属探针 1/1 · 来源差异 1/1
```

### 78.6 当前边界

- `runtimeModifierProbe.applied = false`。
- 已确认两个 modifier 的属性来源与分享配置字段来源，但未读取 `nativeConstant@0x189956B08` 的实际值。
- `recoverInterval` divisor `0x189956D8C` 只确认地址，尚未确认实际值和时间单位。
- `SPGETUP/SPGETUP_ATK` 实时属性值、owner/share 目标筛选和最终 SP 曲线仍未确认。

## 79. 阶段 5-8AZ：nativeConstantReadEvidence 原生常量读取证据

阶段 5-8AZ 在充能证据层新增 `nativeConstantReadEvidence`，用于把 `DamageElement.RecoverSP` 中已定位的原生常量地址升级为可验证的 PE `.rdata` float32 读数。该结构仍为 evidence-only，不参与最终自身能量值计算。

### 79.1 nativeConstantReadEvidence

字段：

- `status`：当前为 `gameassembly-rdata-float32-values-read`。
- `sourceFile`：`C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll`。
- `fileSize`：`222485544`。
- `imageBase`：`0x180000000`。
- `constants[]`：每个常量的 key、VA、RVA、section、fileOffset、float32、uint32Hex、usage 和 status。

当前读数：

```json
{
  "status": "gameassembly-rdata-float32-values-read",
  "sourceFile": "C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll",
  "imageBase": "0x180000000",
  "constants": [
    {
      "key": "recover-sp-modifier-base",
      "va": "0x189956B08",
      "rva": "0x9956B08",
      "section": ".rdata",
      "fileOffset": "0x9954708",
      "float32": 1,
      "uint32Hex": "0x3F800000"
    },
    {
      "key": "recover-interval-divisor",
      "va": "0x189956D8C",
      "rva": "0x9956D8C",
      "section": ".rdata",
      "fileOffset": "0x995498C",
      "float32": 1000,
      "uint32Hex": "0x447A0000"
    },
    {
      "key": "recover-sp-per-ten-thousand-divisor",
      "va": "0x189956FB0",
      "rva": "0x9956FB0",
      "section": ".rdata",
      "fileOffset": "0x9954BB0",
      "float32": 10000,
      "uint32Hex": "0x461C4000"
    }
  ]
}
```

### 79.2 sourceToArgsProbe 更新

`SELF_ENERGY_SOURCE_TO_ARGS_RULES.nativeScaleFacts[]` 更新：

- `RecoverSPArgs.baseDelta@0x1C`：新增 `nativeDivisorAddress = 0x189956FB0`、`nativeDivisorValue = 10000`，状态升级为 `source-to-base-delta-divisor-confirmed`。
- `RecoverSPArgs.delta@0x20`：公式从 `nativeConstant + runtimeModifierA + runtimeModifierB` 细化为 `1 + SPGETUP + SPGETUP_ATK`。
- `RecoverSPArgs.petDelta@0x38`：新增 `nativeDivisorAddress = 0x189956FB0`、`nativeDivisorValue = 10000`、`nativeConstantValue = 1`。
- `RecoverSPArgs.interval@0x24`：新增 `nativeDivisorAddress = 0x189956D8C`、`nativeDivisorValue = 1000`，状态升级为 `source-to-interval-confirmed-divisor-confirmed`。

`sourceToArgsProbe.samples[].argsConstructionCandidates` 更新：

- `baseDelta.nativeDivisorValue = 10000`。
- `delta.modifierBaseConstantValue = 1`。
- `petDelta.nativeDivisorValue = 10000`。
- `interval.nativeDivisorValue = 1000`。
- `interval.intervalSecondsCandidate = recoverInterval / 1000`。

### 79.3 runtimeModifierProbe 更新

`runtimeModifierProbe.confirmedRuntimeRules.deltaFormulaShape` 更新：

```json
{
  "expression": "scaledSource * (1 + SPGETUP + SPGETUP_ATK)",
  "nativeConstantAddress": "0x189956B08",
  "nativeConstantValue": 1,
  "nativeConstantStatus": "value-confirmed-from-gameassembly-rdata"
}
```

`runtimeModifierProbe.samples[].deltaFormulaPreview` 更新：

- `formulaShape = base * (1 + SPGETUP + SPGETUP_ATK)`。
- `nativeConstantValue = 1`。
- `status = modifier-base-constant-confirmed-values-runtime-unapplied`。

`runtimeModifierProbe.samples[].intervalScaleCandidate` 更新：

- `nativeDivisorValue = 1000`。
- `intervalSecondsCandidate = recoverInterval / 1000`。
- `status = divisor-value-confirmed-time-unit-unapplied`。

### 79.4 当前边界

- `nativeConstantReadEvidence` 只证明二进制中的常量读数。
- `SPGETUP/SPGETUP_ATK` 实时属性值仍未确认。
- `intervalSecondsCandidate` 是基于 divisor 的候选单位；真实节流命中、share rebroadcast 顺序和最终每角色 SP 曲线仍需 runtime 样本验证。

## 80. 阶段 5-8BA：runtimeSamplingProbe runtime 采样契约

阶段 5-8BA 在 `selfEnergyRuntimeFormulaProbe` 下新增 `runtimeSamplingProbe`，用于把已确认的 `DamageElement.RecoverSP -> RecoverSPArgs -> SPSystem` 充能链路转成 runtime hook / 离线样本导入契约。该结构仍为 evidence-only，不参与最终自身能量值计算。

### 80.1 runtimeSamplingProbe

字段：

- `status`：当前为 `runtime-sampling-schema-built-awaiting-capture`。
- `sourceKind`：`azpr-self-energy-runtime-sampling-subprobe`。
- `sourceFunction`：`DamageElement.RecoverSP@0x138EEE0`。
- `candidateCount`：当前候选 DamageElement 数量。
- `gateOpenCount`：当前通过 `m_recoverSP > 0` gate 的候选数量。
- `importedRuntimeSampleCount`：已导入 runtime 样本数，当前为 `0`。
- `importStatus`：当前为 `runtime-samples-not-imported`。
- `sampleSchema`：引用 `SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA`。
- `requiredEventTypes[]`：离线样本至少应覆盖的事件类型。
- `sampleExpectations[]`：按 element 建立的样本预期，包含 `expectedRecoverSpArgs`、`requiredRuntimeValues`、`correlationKeys` 和 `status`。
- `unresolved[]`：仍需 runtime 样本验证的缺口。
- `applied`：固定为 `false`。

`sampleExpectations[].expectedRecoverSpArgs` 当前记录：

- `baseDelta = recoverSP / 10000`。
- `deltaFormula = recoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)`。
- `petDeltaFormula = petRecoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)`。
- `intervalSecondsCandidate = recoverInterval / 1000`。
- `tagType = AttackRecoverySp`。

### 80.2 SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA

`SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA` 定义 runtime hook / 离线导入样本的共同契约：

- `status`：`runtime-sample-schema-ready-awaiting-capture`。
- `version`：`1`。
- `sourceKind`：`azpr-self-energy-runtime-sample-schema`。
- `hookPoints[]`：运行时建议采样点。
- `offlineImportShape`：离线 JSON 的根字段、关联键和事件类型。
- `validationChecks[]`：导入样本后必须跑的验证项。
- `unresolved[]`：schema 仍未解决的运行时缺口。
- `applied`：固定为 `false`。

当前 hook 点：

- `damage-element-recover-sp-args-built`：`DamageElement.RecoverSP@0x138EEE0`，在 `RecoverSPArgs` 字段写完、type `0x12F` 发送前采样。
- `alive-property-recover-sp-modifiers`：`AliveProperty.GetBattlePropertyCurrentValue@0x12A7EE0`，采样 id `105 / 228` 的 `SPGETUP / SPGETUP_ATK` 实时属性值。
- `snapshot-property-recover-sp-modifiers`：`SnapshotPropertyManager.GetBattlePropertyCurrentValue@0x181D240`，采样攻击者 snapshot 下的同两类属性值。
- `sp-system-ontransmit-12f`：`SPSystem.OnTransmit@0x14837F0`，采样 `0x12F` 分支的节流命中、share 目标和回传字段。
- `sp-system-recover-sp-applied`：`SPSystem.RecoverSP@0x1483F40`，采样每个角色最终应用前后的 SP 值。

离线导入事件类型：

- `recover-sp-args-built`
- `recover-sp-modifier-property-read`
- `recover-sp-ontransmit-12f`
- `recover-sp-applied`
- `recover-sp-share-rebroadcast`

建议关联键：

- `captureSessionId`
- `frameIndex`
- `sourceElementConfigId`
- `args.id`
- `roleEntityId`

验证项：

- `base-delta-scale`：`args.baseDelta == recoverSP / 10000`。
- `pet-delta-scale-and-modifier`：验证 `petRecoverSP / 10000` 与 modifier 后的 `petDelta`。
- `delta-scale-and-modifier`：验证 `recoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)`。
- `interval-scale`：验证 `recoverInterval / 1000` 与 OnTransmit 节流时间。
- `final-sp-curve`：验证 `SPSystem.RecoverSP` 前后差值与最终每角色 SP 曲线。

### 80.3 外部缺口摘要字段

`hitBindingGap.externalElementBinding` 和 `externalElementBindingSummary` 新增字段：

- `runtimeSelfEnergySamplingProbeStatuses`：收集非普攻外部 DamageElement 的 `runtimeSamplingProbe.status`。
- `runtimeSelfEnergySamplingProbeCandidateCount`：汇总候选数。
- `runtimeSelfEnergySamplingProbeGateOpenCount`：汇总 gate 通过数。
- `gapsWithRuntimeSelfEnergySamplingProbe`：具备采样契约的缺口动作数量。

Workbench 执行矩阵摘要新增：

```text
采样契约 3/3
```

单动作切换到重击时可见：

```text
hit绑定 0/2 · 缺口候选 1/1 · 伤害元素候选 1/1 · 关联等级链 1/1 · 参数来源候选 1/1 · 应用入口候选 1/1 · 原生入口 1/1 · 反汇编片段 1/1 · 充能探针 1/1 · 构造探针 1/1 · 修正探针 1/1 · 归属探针 1/1 · 采样契约 1/1 · 来源差异 1/1
```

### 80.4 当前边界

- `runtimeSamplingProbe.applied = false`。
- `importedRuntimeSampleCount = 0`，当前还没有真实 runtime hook 样本导入。
- `SPGETUP/SPGETUP_ATK` 实时属性值、owner/share 目标筛选、interval 节流命中和最终每角色 SP 曲线仍未确认。
- 阶段 5-8BB 需要建立离线 runtime 样本导入/fixture 入口，再用真实 hook JSON 或手动整理样本驱动这些验证项。

## 81. 阶段 5-8BB：runtimeSampleCaptures 离线样本导入结构

阶段 5-8BB 新增 RecoverSP 离线 runtime 样本入口，用于把真实 hook JSON 或手动整理样本接入 `runtimeSamplingProbe` 的校验器。该结构仍为 evidence-only，不改变 `selfEnergyChange.value`。

### 81.1 项目 metadata 入口

`compileProject()` 会从项目 metadata 收集以下字段，并写入编译后 `scenario.runtimeSampleCaptures`：

- `metadata.runtimeSampleCaptures`
- `metadata.recoverSpRuntimeSampleCaptures`
- `metadata.runtimeSamples`

这些字段可以是单个 capture 对象，也可以是 capture 数组。推荐使用 `runtimeSampleCaptures`。

capture 根字段：

- `schemaVersion`
- `captureSessionId`
- `clientRegion`
- `clientBuild`
- `source`
- `events[]`

### 81.2 事件形状

每个事件通过 `eventType` 区分类型。兼容旧输入的 `type`，但规范输出统一为 `eventType`。

基础关联字段：

- `captureSessionId`
- `actionId`
- `actorId`
- `frameIndex`
- `timeMs`
- `sourceElementConfigId`
- `pathId`
- `args.id`

RecoverSP 事件类型：

- `recover-sp-args-built`
- `recover-sp-modifier-property-read`
- `recover-sp-ontransmit-12f`
- `recover-sp-applied`
- `recover-sp-share-rebroadcast`

`recover-sp-args-built.args` 推荐字段：

- `id`
- `baseDelta`
- `delta`
- `interval`
- `tagType`
- `skillId`
- `sharePercent`
- `petSharePercent`
- `petDelta`
- `mainPetSharePercent`

`recover-sp-modifier-property-read` 推荐字段：

- `ownerEntityId`
- `propertyId`
- `propertyName`
- `isRatio`
- `myFloatRaw`
- `floatValue`

`recover-sp-ontransmit-12f` 推荐字段：

- `receiverEntityId`
- `timerMapHit`
- `timerPreviousTime`
- `timerNextTime`
- `directRecoverCalled`
- `shareRebroadcastTargets`
- `petShareTargets`
- `mainPetShareTargets`

`recover-sp-applied` 推荐字段：

- `roleEntityId`
- `recoverTagType`
- `baseDelta`
- `delta`
- `spBefore`
- `spAfter`
- `spDeltaApplied`

### 81.3 runtimeSamplingProbe 新增输出

`runtimeSamplingProbe` 新增或升级字段：

- `importedRuntimeSampleCount`：当前导入的事件数量。
- `importStatus`：
  - `runtime-samples-not-imported`
  - `offline-runtime-samples-validated`
  - `offline-runtime-samples-matched-validation-incomplete`
  - `offline-runtime-samples-validation-failed`
  - `offline-runtime-samples-imported-no-matches`
- `sampleImportSummary`：导入摘要。
- `runtimeSampleCaptures`：capture 摘要，不包含完整事件 payload。
- `sampleExpectations[].runtimeSampleMatch`：单个候选 element 的事件匹配和校验结果。

`sampleImportSummary` 字段：

- `status`
- `captureCount`
- `importedRuntimeSampleCount`
- `importedEventTypes`
- `requiredEventTypes`
- `matchedSampleCount`
- `validatedSampleCount`
- `failedSampleCount`
- `missingSampleCount`
- `validationStatuses`

`runtimeSampleMatch` 字段：

- `status`
- `validationStatus`
- `matchedEventCount`
- `eventTypeCounts`
- `captureSessionIds`
- `correlationIds`
- `frameIndexes`
- `roleEntityIds`
- `modifierValues`
- `expectedRuntimeArgs`
- `observedRuntimeArgs`
- `onTransmit`
- `finalSpCurve`
- `shareRebroadcastEventCount`
- `validationResults[]`

`validationResults[].key` 当前覆盖：

- `base-delta-scale`
- `delta-scale-and-modifier`
- `pet-delta-scale-and-modifier`
- `interval-scale`
- `final-sp-curve`

### 81.4 手动 fixture

新增 fixture 文件：

```text
src/simulation/fixtures/recoverSpRuntimeSampleFixture.js
```

当前 fixture 覆盖 `109001081`：

```json
{
  "recoverSP": 2700,
  "petRecoverSP": 10399,
  "recoverInterval": 9999,
  "SPGETUP": 0.2,
  "SPGETUP_ATK": 0.05,
  "baseDelta": 0.27,
  "delta": 0.3375,
  "petDelta": 1.299875,
  "interval": 9.999
}
```

默认普通攻击 action-level 有 `109001081` 与 `109001306` 两个候选，因此当前导入此 fixture 后状态是部分验证：

```text
runtime-sampling-offline-samples-partially-validated
样本验证 1/2
```

### 81.5 当前边界

- 当前 fixture 是手动整理样本，不是真实 hook 结果。
- `runtimeSamplingProbe.applied = false`。
- `109001306`、`109001251`、share target、interval throttle 命中/未命中和最终每角色 SP 曲线仍需真实 capture 验证。

## 82. 阶段 5-8BC：寒悠悠 skill_control 中文命中轨与多字段元素引用

阶段 5-8BC 扩展 `skill-asset-evidence.json` 的证据生成逻辑，用于支持寒悠悠 `101003` 这类 skill_control 导出形态。该阶段仍是 evidence-only，不改变项目保存 schema，不把候选字段应用到最终 HP / 韧性 / 能量计算。

### 82.1 lane 识别扩展

`SKILL_EFFECT_LANES` 新增中文轨道名模式：

- HP 伤害候选新增 `攻击框`、`命中`。
- 韧性削减候选新增 `抗击`。

因此生成摘要中的候选数量会扩大：

```json
{
  "effectLaneCandidateSkills": {
    "hpDamage": 7,
    "toughnessDamage": 7
  },
  "hpDamageBehaviorReferenceResolvedSkills": 7
}
```

这些 lane 仍只是候选分类，不能单独证明最终命中、削韧或公式应用。

### 82.2 元素引用字段扩展

行为对象的元素引用来源从单一 `elementBaseDatas` 扩展为：

- `elementBaseDatas`
- `elementDataList`
- `elementIdDatas`
- `toOwnElementBaseDatas`
- `toOwnElementDatas`

`elementBaseDataRefs[]` 保持原字段名以兼容既有消费者，但现在可能来自多个 source key。每条引用新增：

```json
{
  "sourceKey": "elementDataList"
}
```

行为对象摘要新增：

```json
{
  "elementRefSourceCounts": {
    "elementDataList": 1,
    "elementIdDatas": 2
  }
}
```

消费者应把 `sourceKey` 视为可选字段；旧数据缺失该字段时仍按 `elementBaseDatas` 兼容处理。

### 82.3 寒悠悠当前证据结果

重导 `skill_control_101003*` 后，生成器可解析寒悠悠主要动作：

- `10100301 鸢回影`：159 帧，桥接 `10100302/03/04/05`，外部 DamageElement 包含 `101003087`。
- `10100312 花照夜`：180 帧，外部 DamageElement 包含 `101003033 / 101003108`。
- `10100313 沐星雨`：290 帧，外部 DamageElement 包含 `101003118 / 101003122`。
- `10100322 缚风烟`：191 帧，外部 DamageElement 包含 `101003071 / 101003074`。

全局外部 Element 解析摘要从 6 技能 43 引用扩展为 14 技能 89 引用，DamageElement 字段映射从 16 个对象扩展为 31 个对象。

### 82.4 当前边界

- `10100361` / `10100362` 仍没有可用动作轨 timing evidence。
- `10100301` 的普攻子技能链已经发现，但每段 hit 到 DamageElement 的绑定仍未闭合。
- 外部 Element 名称存在原始编码乱码，UI 和报告应优先显示 `elementConfigId`、PathID 和脚本类型。
- 本阶段不改变最终公式、运行时采样 schema 或 `selfEnergyChange.value` 的应用边界。

## 83. 阶段 5-8BD：末音 skill_control 清理重导后的报表语义

阶段 5-8BD 清理并重导 `skill_control_109001*`，属于源数据清洁和 evidence 报表更新，不改变项目保存 schema。

### 83.1 清理结果

旧目录中末音 MonoBehaviour JSON 曾混有真实对象与 `stubOnly` 壳对象。清理 27 个 `skill_control_109001*.asset` 目录并重新 manifest-sliced 导出后：

```json
{
  "candidateBundles": 27,
  "writtenFiles": 1437,
  "typeCounts": {
    "MonoBehaviour": 1437
  },
  "errorCount": 0,
  "stubOnly": 0
}
```

因此 `jsonFileCount` 现在表示干净导出的真实 MonoBehaviour 文件数，不再包含旧 stub。末音普攻 `10900101` 的 `jsonFileCount` 从旧混合目录的 `193` 变为 `97`。

### 83.2 末音外部引用闭环

重生成后的末音主技能外部 Element 引用没有未匹配项：

```json
[
  { "skillId": 10900101, "external": 14, "matched": 14, "unmatched": 0 },
  { "skillId": 10900112, "external": 9, "matched": 9, "unmatched": 0 },
  { "skillId": 10900113, "external": 25, "matched": 25, "unmatched": 0 },
  { "skillId": 10900121, "external": 1, "matched": 1, "unmatched": 0 },
  { "skillId": 10900161, "external": 1, "matched": 1, "unmatched": 0 }
]
```

这说明末音当前没有资源映射层面的外部 DamageElement 缺口。剩余问题不是找不到外部对象，而是抽样上限、动作 hit 绑定和运行时公式验证。

### 83.3 仍需保留的缺口标记

阶段 5-8BD 时 `SKILL_CONTROL_SAMPLE_FILE_LIMIT = 80` 仍会限制报表覆盖：

- `10900101`：97 个 JSON，解析 80 个，剩余 17 个未纳入当前报表。
- `10900113`：95 个 JSON，解析 80 个，剩余 15 个未纳入当前报表。
- `10900121`：104 个 JSON，解析 80 个，剩余 24 个未纳入当前报表。

消费者展示末音报表时应区分：

- `resourceMapUnmatchedElementBaseRefs = 0`：外部资源映射已闭环。
- `jsonFileCount > parsedJsonSampleFiles`：当前 evidence 仍是抽样解析，不是全量解析。
- `formulaFunctionEvidence.applied = false`：字段和公式 ID 已匹配，但最终 HP / 韧性 / 能量公式仍未应用。
- `selfEnergyChange` 主动作缺真实 runtime capture：仍需 hook 样本确认最终每角色能量曲线。

## 84. 阶段 5-8BE：skill_control 抽样上限提高到 200

阶段 5-8BE 将 `SKILL_CONTROL_SAMPLE_FILE_LIMIT` 从 80 提高到 200。该变更只扩大 `skill-asset-evidence.json` 的 MonoBehaviour 深度扫描范围，不改变项目保存 schema，也不改变最终公式应用边界。

### 84.1 覆盖率变化

重生成后当前技能覆盖率为：

```json
{
  "totalJson": 7170,
  "parsedCurrentSkillControlSampleFiles": 6694,
  "remainingBySampleLimit": 476,
  "cappedSkillCount": 4
}
```

对比阶段 5-8BD 的 80 上限：

- 解析数量从 5092 提高到 6694。
- 被上限截断的技能从 33 个降到 4 个。
- 末音 `109001*` 与寒悠悠 `101003*` 已全部覆盖。

### 84.2 目标角色影响

末音当前已全量解析：

```json
[
  { "skillId": 10900101, "json": 97, "parsed": 97 },
  { "skillId": 10900112, "json": 75, "parsed": 75 },
  { "skillId": 10900113, "json": 95, "parsed": 95 },
  { "skillId": 10900121, "json": 104, "parsed": 104 },
  { "skillId": 10900161, "json": 3, "parsed": 3 },
  { "skillId": 10900162, "json": 1, "parsed": 1 }
]
```

寒悠悠当前已全量解析：

```json
[
  { "skillId": 10100301, "json": 65, "parsed": 65 },
  { "skillId": 10100312, "json": 137, "parsed": 137 },
  { "skillId": 10100313, "json": 177, "parsed": 177 },
  { "skillId": 10100322, "json": 73, "parsed": 73 },
  { "skillId": 10100361, "json": 5, "parsed": 5 },
  { "skillId": 10100362, "json": 5, "parsed": 5 }
]
```

### 84.3 仍被截断的技能

当前仍超过 200 上限的技能只有：

- `11100101 疾风投羽`：431 / 200。
- `10300201 灵感的火花`：351 / 200。
- `10100712 蛟龙戏珠`：279 / 200。
- `10700212 浮茵`：215 / 200。

若这些技能进入重点分析，应使用目标技能全量解析或角色白名单全量解析，而不是继续全局盲目提高上限。

### 84.4 消费者注意

`jsonFileCount > parsedJsonSampleFiles` 仍表示 evidence 报表不是全量解析。`jsonFileCount === parsedJsonSampleFiles` 只表示 MonoBehaviour 扫描覆盖完整，不代表 HP / 韧性 / 能量公式已最终应用；公式应用仍以 `formulaFunctionEvidence.applied` 和 runtime capture 验证为准。

## 85. 阶段 5-8BF：寒悠悠普攻 resourceMap 子段绑定

阶段 5-8BF 扩展了 `skill-asset-evidence.json` 中普通攻击子段绑定的证据来源。EventBridge 目标技能即使没有 `behaviorReferenceSummary.resourceMapMatchedElementBaseRefs`，只要 `skillResourceMapEvidence.elementRefCount > 0`，也会进入外部 Element 解析队列。

### 85.1 生成器变化

- `externalElementObjectEvidence` 的目标技能筛选新增根级 `skillResourceMapEvidence.elementRefCount` 判断。
- `normalAttackHitChainCandidates.hitGroups[]` 新增或稳定输出 `resourceMapElementRefCount`，用于标记子技能 resourceMap fallback 引用数量。
- `hitGroups[].candidateSource` 可为 `event-bridge-child-skill-control-resource-map`，表示该 hit 候选来自目标子技能根级 resourceMap，而不是行为链 HP timeline。
- `hitGroups[].damageElementFieldMappingStatus` 新增 `resource-map-element-refs-found-damage-element-fields-missing`，表示 resourceMap 元素已解析，但没有命中 `TDamageElementParams` 字段。
- hit group 到 DamageElement 字段映射支持 `roundedPathId`，用来对齐 Unity 导出的 64 位 pathId 与 JS 数字侧的近似值。

### 85.2 Workbench 投影变化

`createHitCandidatePreview()` 输出新增：

- `resourceMapElementRefCount`
- `resourceMapUnmatchedElementBaseRefCount`
- `hasResourceMapElementRefs`

当没有 DamageElement 字段映射但存在 resourceMap 元素引用时，preview 状态从普通缺字段升级为 `per-hit-resource-map-elements-found-fields-missing`。这让 UI 可以把“资源引用已找到但类型未识别”和“完全没有候选”分开显示。

### 85.3 生成结果变化

重生成后全局摘要变化为：

```json
{
  "externalElementObjectResolvedSkills": 18,
  "externalElementObjectResolvedRefs": 97,
  "damageElementFieldMappedSkills": 15,
  "damageElementFieldMappedObjects": 33,
  "hpDamageFieldCandidateRefs": 33,
  "toughnessDamageFieldCandidateRefs": 33,
  "selfEnergyFieldCandidateRefs": 33,
  "damageElementFormulaFunctionMatchedRefs": 66
}
```

寒悠悠 `10100301` 普攻子链当前输出：

- `10100302`：`resourceMapElementRefCount = 2`，映射到 DamageElement `101003046`。
- `10100303`：`resourceMapElementRefCount = 1`，映射到 DamageElement `101003037`。
- `10100304`：`resourceMapElementRefCount = 2`，存在 resourceMap 元素但 DamageElement 字段未确认。
- `10100305`：`resourceMapElementRefCount = 3`，存在 resourceMap 元素但 DamageElement 字段未确认。

### 85.4 兼容性

该阶段只增加证据字段和缺口状态，不删除既有字段。消费者应将新状态视为比 `damage-element-field-mappings-missing` 更精确的中间态，而不是最终公式已应用。

## 86. 阶段 5-8BG：formulaParam buff 引用桥证据

阶段 5-8BG 在 `skill-asset-evidence.json` 中新增 formula 参数引用 buff 的结构化证据。该证据用于识别“Element 本身不是 DamageElement，但 formulaParams 指向 buff_info”的桥接对象。

### 86.1 新增输入表

生成器新增读取：

- `Assets/ResourcesAssets/Config/NewTable/buff_info.json`
- `Assets/ResourcesLang/chs/Table/lang_buff_info.json`

`lang_buff_info` 的 id 是超出 JS 安全整数范围的大数字，生成器会对该表建立局部 BigInt 近邻索引，避免 `433804921100305152` 这类语言 ID 被解析成近似数字后无法匹配。

### 86.2 externalElementObjectEvidence 新字段

当外部 Element 对象的 `formulaParams.formulaParamValues` 命中 `buff_info.id` 时，该对象新增：

- `formulaParamReferenceEvidence.status = "formula-param-buff-references-found"`
- `formulaParamReferenceEvidence.buffReferenceIds`
- `formulaParamReferenceEvidence.references[].formulaParamSlots`
- `formulaParamReferenceEvidence.references[].buffInfo`
- `formulaParamReferenceEvidence.references[].buffElementObject`
- `formulaParamBridgeCandidate.status = "formula-param-buff-reference-found"`
- `formulaParamBridgeCandidate.inferredRole = "buff-trigger-or-apply-bridge-candidate"`

`externalElementObjectEvidence.summary` 新增：

```json
{
  "formulaParamBuffReferenceObjects": 15,
  "formulaParamBuffReferences": 15,
  "formulaParamBuffReferenceResolvedObjects": 1,
  "unknownScriptBuffReferenceObjects": 7
}
```

### 86.3 normalAttackHitChainCandidate 新字段

`normalAttackHitChainCandidate.hitGroups[]` 新增：

- `externalElementObjectReferenceCount`
- `externalElementObjectReferences`
- `formulaParamBuffReferenceCount`
- `formulaParamBuffReferenceIds`
- `formulaParamBuffReferences`

当 hit group 没有 DamageElement 字段映射，但存在 formulaParam buff 引用时：

- `damageElementFieldMappingStatus = "resource-map-element-buff-reference-found-damage-element-fields-missing"`

顶层候选新增：

- `formulaParamBuffReferenceHitGroupCount`
- `formulaParamBuffReferenceIds`

### 86.4 Workbench 投影变化

`createHitCandidatePreview()` 新增：

- `externalElementObjectReferenceCount`
- `formulaParamBuffReferenceCount`
- `formulaParamBuffReferenceIds`
- `hasFormulaParamBuffReferences`
- `formulaParamBuffReferences`

当 per-hit 没有 DamageElement 字段映射，但存在 buff 引用桥时，preview 状态为：

- `per-hit-buff-reference-found-fields-missing`

### 86.5 寒悠悠当前样例

寒悠悠普攻第 5 段 `10100305` 当前为：

- `101003181 / scriptPathId 5576338162890961044`
- `formulaParamSlots = [2, 13]`
- `buffId = 101003079`
- `buffInfo.name = 焰火`
- `buffInfo.description = 受到特定伤害时触发爆炸`
- `buffElementObject.scriptTypeCandidate.className = TBuffElementParams`

该状态只证明第 5 段存在 buff 桥候选，不证明爆炸伤害 Element 已找到，也不应用最终 HP / 韧性 / 能量公式。

## 87. 阶段 5-8BH：TSummonElementParams 召唤桥字段

阶段 5-8BH 将 `scriptPathId = 5576338162890961044` 从 unknown Element 识别为 `TSummonElementParams`。该阶段仍只改变证据结构，不改变最终计算。

### 87.1 elementTypeCatalogEvidence 新增类型

`skill-asset-evidence.json.elementTypeCatalogEvidence.elementTypes[]` 新增：

```json
{
  "role": "summon-unit-or-trigger-bridge",
  "sourceLineRange": "dump.cs:396216-396258",
  "namespace": "Lens.Gameplay.Modules.BigWorld.Config",
  "className": "TSummonElementParams",
  "label": "召唤",
  "typeDefIndex": 9758,
  "baseType": "TElementParams",
  "evidenceKind": "config-element-params",
  "runtimeType": "Lens.Gameplay.Modules.BigWorld.SummonElement",
  "runtimeSourceLineRange": "dump.cs:275944-275984"
}
```

### 87.2 externalElementObjectEvidence 新增字段

当外部 Element 对象匹配 `TSummonElementParams` 时，该对象新增：

- `scriptTypeCandidate.className = "TSummonElementParams"`
- `scriptTypeCandidate.role = "summon-unit-or-trigger-bridge"`
- `summonFields`

`summonFields` 当前包含：

- `summonUnitId`
- `summonType`
- `summonPropertyType`
- `summonLifeTime`
- `summonCount`
- `summonTotalMaxCount`
- `dieWithOwner`
- `dieWithOutBattle`
- `dieWithChangeHero`
- `useFindPoint`
- `dieOutTimeSkill`
- `dieOutMaxCountSkill`
- `dieWithChangeHeroSkill`
- `dieWithOwnerSkill`
- `summonCountType`
- `summonPointType`
- `ground`
- `summonPositionType`
- `summonInheritType`
- `summonInheritTargetType`
- `rotOffset`
- `summonPoints`
- `attributeData`
- `effect`
- `isCombo`
- `capsuleHeight`
- `capsuleRadius`
- `isGetTargetList`

如果该召唤对象的 `formulaParams.formulaParamValues` 同时命中 buff id，`formulaParamBridgeCandidate` 会改为：

```json
{
  "status": "formula-param-buff-reference-found",
  "scriptTypeCandidateStatus": "script-type-candidate-found",
  "scriptTypeClassName": "TSummonElementParams",
  "inferredRole": "summon-element-buff-trigger-bridge-candidate",
  "confidence": "medium",
  "referencedBuffIds": [101003079],
  "summonFields": {}
}
```

这比阶段 5-8BG 的 `buff-trigger-or-apply-bridge-candidate` 更具体：对象语义已确认是召唤桥，而不是未知脚本桥。

### 87.3 normalAttackHitChainCandidate 变化

`normalAttackHitChainCandidate.hitGroups[].externalElementObjectReferences[]` 会在召唤对象上携带：

- `scriptTypeClassName = "TSummonElementParams"`
- `summonFields`
- 若存在 buff 引用，则继续携带 `formulaParamBridgeCandidate` 与 `formulaParamBuffReferenceIds`

寒悠悠当前样例：

- 第 4 段 `10100304 / 101003180`：`summonUnitId = 480059`，没有 DamageElement 字段或 buff 引用。
- 第 5 段 `10100305 / 101003181`：`summonUnitId = 480060`，继续引用 `101003079 / 焰火`。

### 87.4 兼容性

- `externalElementObjectEvidence.summary.unknownScriptBuffReferenceObjects` 从 `7` 下降到 `6`。
- `elementTypeCatalogCandidates` 从 `2` 增加到 `3`。
- `damageElementFieldMappedObjects`、HP 候选、削韧候选和充能候选计数不变。
- 读取方不能把 `TSummonElementParams` 当成 `TDamageElementParams`；它只说明下一跳应沿 `summonUnitId` 或 buff runtime 继续追踪。

## 88. 阶段 5-8BI：summonTargetSkillEvidence

阶段 5-8BI 新增 `skill-asset-evidence.json.summonTargetSkillEvidence`，用于记录召唤 Element 的二级目标 skill 和目标 DamageElement。

### 88.1 顶层字段

新增：

- `summonTargetSkillEvidence`
- `summary.summonTargetSkillCount`
- `summary.summonTargetDamageElementObjects`

当前生成摘要：

```json
{
  "summonTargetSkillCount": 2,
  "summonTargetDamageElementObjects": 4
}
```

`summonTargetSkillEvidence.summary` 当前为：

```json
{
  "summonSourceObjectCount": 2,
  "summonUnitCount": 2,
  "targetSkillCount": 2,
  "resolvedTargetSkillCount": 2,
  "targetSkillControlStubOnlySkillCount": 2,
  "requestedPathIds": 4,
  "resolvedPathIds": 4,
  "unresolvedPathIds": 0,
  "damageElementObjectCount": 4,
  "damageElementFieldMappingCount": 4
}
```

### 88.2 targets[]

`summonTargetSkillEvidence.targets[]` 每项表示一个 `summonUnitId`：

- `summonUnitId`
- `sourceObjects[]`：来源召唤 Element，例如 `101003180` 或 `101003181`
- `battlefieldItem`：`battlefield_item` 摘要
- `targetSkillIds`
- `targetSkills[]`
- `damageElementObjectCount`
- `damageElementConfigIds`
- `applied = false`

当前样例：

- `480059 -> 48005901 -> 101003156 / 101003182`
- `480060 -> 48006001 -> 101003157 / 101003179`

### 88.3 targetSkills[]

`targetSkills[]` 每项记录：

- `skillRow.parentSkill`
- `skillLevelRows`
- `skillsubLogicRow`
- `skillElementValueSummaries[]`
- `skillControlDirectory`
- `externalElementObjectStatus`
- `scriptClassCounts`
- `damageElementConfigIds`
- `damageElementObjects[]`
- `damageElementFieldMappings[]`

注意：当前 `skill_control_48005901.asset` 与 `skill_control_48006001.asset` 的落盘 MonoBehaviour JSON 都是：

- `skillControlDirectory.status = "skill-control-json-stub-only"`
- `jsonFileCount = 13`
- `stubOnlyJsonFiles = 13`

这表示落盘 JSON 不能确认行为轨、触发帧或命中次数；二级 DamageElement 来自 compact bundle preload 解析。

### 88.4 summon object 轻量引用

外部召唤对象新增：

- `summonTargetSkillEvidence.status`
- `summonTargetSkillEvidence.summonUnitId`
- `summonTargetSkillEvidence.targetSkillIds`
- `summonTargetSkillEvidence.damageElementObjectCount`
- `summonTargetSkillEvidence.damageElementConfigIds`
- `summonTargetSkillEvidence.applied = false`

`normalAttackHitChainCandidate.hitGroups[].externalElementObjectReferences[]` 也会携带这份轻量引用，方便第 4/5 段下钻。

### 88.5 兼容性与边界

- 该字段不改变主 `damageElementFieldMappingEvidence` 的 33 个当前技能 DamageElement 统计。
- 二级目标的 4 个 DamageElement 记录在 `summonTargetSkillEvidence.damageElementFieldMappingEvidence` 中。
- 消费方必须把这些二级 DamageElement 视为 nested candidate；在触发帧、命中次数、owner/target 和 runtime 条件确认前，不能并入最终 HP / 韧性 / 能量曲线。

## 89. 阶段 5-8BJ：per-hit summon target candidates

阶段 5-8BJ 将 5-8BI 的静态 `summonTargetSkillEvidence` 接入运行时投影和 Workbench 展示。该阶段仍不应用最终公式。

### 89.1 actionResultTimeline[].hitCandidates[]

`hitCandidates[]` 中若某 hit 来源为 `TSummonElementParams` 且能追到目标 item skill，会新增或更新：

- `damageElementFieldMappingCount`：包含直接 DamageElement 与召唤目标二级 DamageElement。
- `directDamageElementFieldMappingCount`
- `summonTargetDamageElementFieldMappingCount`
- `summonTargetEvidenceSummary`
- `damageElementElementConfigIds`：包含二级目标 DamageElement ids。
- `status = "per-hit-summon-target-candidate-fields-found-trigger-unconfirmed"`：仅召唤目标命中时使用。

`summonTargetEvidenceSummary` 结构：

```json
{
  "status": "summon-target-damage-element-candidates-linked-unapplied",
  "sourceKind": "azpr-summon-target-hit-candidate-summary",
  "sourceElementConfigIds": [101003180],
  "sourcePathIds": ["1572718271109451571"],
  "summonUnitIds": [480059],
  "targetSkillIds": [48005901],
  "damageElementConfigIds": [101003156, 101003182],
  "damageElementCandidateCount": 2,
  "triggerTimingStatus": "summon-target-trigger-frame-unconfirmed",
  "hitCountStatus": "summon-target-hit-count-unconfirmed",
  "runtimeOwnershipStatus": "summon-target-runtime-ownership-unconfirmed",
  "applied": false
}
```

### 89.2 candidates[]

召唤目标展开后的每个 `candidates[]` 项新增：

- `sourceKind = "azpr-summon-target-damage-element-candidate"`
- `sourceElementConfigId`
- `sourcePathId`
- `summonTarget`

`summonTarget` 记录：

- `summonUnitId`
- `targetSkillId`
- `battlefieldItemId`
- `battlefieldItemParam`
- `skillControlStatus`
- `triggerTimingStatus`
- `hitCountStatus`
- `runtimeOwnershipStatus`
- `calculationBoundary`
- `applied = false`

`skillLevelBridge` 会保留 `source = "summon-target-skill-element-values"`，并用目标 item skill 的 `skillElementValueSummaries[]` 扩展 12 级 A/G 槽位范围。例如：

- `101003156`：A 槽 `3500 -> 7350`，G 槽 `10000`。
- `101003182`：A 槽 `1500 -> 3150`，G 槽 `10000`。
- `101003157`：A 槽 `5000 -> 10500`，G 槽 `10000`。
- `101003179`：A 槽 `3000 -> 6300`，G 槽 `10000`。

### 89.3 hitCandidateSummary

`hitCandidateSummary` 新增：

- `summonTargetMappedHitCandidateCount`
- `summonTargetDamageElementFieldMappingCount`
- `summonTargetDamageElementConfigIds`
- `summonTargetSkillIds`
- `summonUnitIds`
- `summonTargetTriggerTimingStatuses`

寒悠悠普攻当前摘要：

```json
{
  "hitCandidateCount": 4,
  "mappedHitCandidateCount": 4,
  "damageElementFieldMappingCount": 6,
  "summonTargetMappedHitCandidateCount": 2,
  "summonTargetDamageElementFieldMappingCount": 4,
  "summonTargetDamageElementConfigIds": [101003156, 101003157, 101003179, 101003182],
  "summonTargetSkillIds": [48005901, 48006001],
  "summonUnitIds": [480059, 480060],
  "summonTargetTriggerTimingStatuses": ["summon-target-trigger-frame-unconfirmed"]
}
```

### 89.4 candidateValueSeries / Workbench

`candidateValueSeries` 和 `candidateValueSeries.chart.series[].points[]` 会透传：

- `summonTargetEvidenceSummary`
- `triggerTimingStatus`
- `elementDetails[].sourceKind`
- `elementDetails[].sourceElementConfigId`
- `elementDetails[].sourcePathId`
- `elementDetails[].summonTarget`

`TimelineGridPreview` 会在选中候选帧来源中显示 `召唤目标 {summonUnitId}->{targetSkillId} · 触发帧未确认`，并在 element 对比表状态中追加 `召唤触发待确认`。

### 89.5 兼容性与边界

- 该阶段只改变运行时投影和 Workbench 展示，不改变生成数据的 `summonTargetSkillEvidence` 静态结构。
- 第 4/5 段曲线点仍使用来源 hitGroup 的候选帧；目标 item skill 的真实触发帧未确认。
- `applied` 必须保持 `false`，不能把召唤目标二级 DamageElement 当成最终 HP / 韧性 / 能量公式结果。

## 90. 阶段 5-8BK：summon target skill_control frame candidates

阶段 5-8BK 通过 AzPr Extractor 聚焦 manifest-sliced 重导补齐 `skill_control_48005901/48006001` 的真实 MonoBehaviour JSON，并把目标 item skill_control 的行为轨候选写入生成数据和 Workbench。

### 90.1 skill-asset-evidence summonTargetSkillEvidence

`summonTargetSkillEvidence.summary.targetSkillControlStubOnlySkillCount` 从 `2` 变为 `0`。

`summonTargetSkillEvidence.targets[].targetSkills[].skillControlDirectory` 新增：

- `parsedReadableJsonFiles`
- `unreadableJsonFiles`
- `skillResourceMapEvidence`
- `timelineControlSampleCount`
- `behaviorNodeSampleCount`
- `frameCandidateSampleCount`
- `elementListCandidateSampleCount`
- `frameRange`
- `startFrameCandidates`
- `triggerFrameCandidateSummary`
- `effectLaneCandidateSummary`
- `behaviorReferenceSummary`
- `hpBehaviorChainCount`
- `hpBehaviorChains`
- `sampleNodeCandidates`

当前目标摘要：

```json
[
  {
    "skillId": 48005901,
    "jsonFileCount": 13,
    "stubOnlyJsonFiles": 0,
    "parsedReadableJsonFiles": 13,
    "timelineControlSampleCount": 6,
    "behaviorNodeSampleCount": 13,
    "startFrameCandidates": [0, 1, 4, 25, 34, 43],
    "frameRange": { "minStartFrame": 0, "maxEndFrame": 112 },
    "hpBehaviorChainCount": 4
  },
  {
    "skillId": 48006001,
    "jsonFileCount": 13,
    "stubOnlyJsonFiles": 0,
    "parsedReadableJsonFiles": 13,
    "timelineControlSampleCount": 6,
    "behaviorNodeSampleCount": 13,
    "startFrameCandidates": [0, 1, 5, 20, 29, 38],
    "frameRange": { "minStartFrame": 0, "maxEndFrame": 105 },
    "hpBehaviorChainCount": 4
  }
]
```

`triggerFrameCandidateSummary` 结构：

```json
{
  "status": "skill-control-trigger-frame-candidates-found-unconfirmed",
  "sourceKind": "azpr-summon-target-skill-control-frame-candidate-summary",
  "candidateStartFrames": [0, 1, 4, 25, 34, 43],
  "frameRange": { "minStartFrame": 0, "maxEndFrame": 112 },
  "timelineControlCount": 6,
  "behaviorNodeCount": 13,
  "applied": false
}
```

### 90.2 actionResultTimeline[].hitCandidateSummary

`hitCandidateSummary` 新增：

- `summonTargetTriggerFrameCandidates`

寒悠悠普攻当前值：

```json
{
  "summonTargetTriggerTimingStatuses": [
    "summon-target-trigger-frame-candidates-found-unconfirmed"
  ],
  "summonTargetTriggerFrameCandidates": [0, 1, 4, 5, 20, 25, 29, 34, 38, 43]
}
```

### 90.3 hitCandidates[].summonTargetEvidenceSummary

`summonTargetEvidenceSummary` 更新：

- `triggerTimingStatus` 可为 `summon-target-trigger-frame-candidates-found-unconfirmed`。
- 新增 `triggerFrameCandidates`。
- 新增 `triggerFrameCandidateSummaries[]`。

第 4 段当前候选：

```json
{
  "targetSkillIds": [48005901],
  "triggerTimingStatus": "summon-target-trigger-frame-candidates-found-unconfirmed",
  "triggerFrameCandidates": [0, 1, 4, 25, 34, 43]
}
```

### 90.4 candidates[].summonTarget

召唤目标 candidate 的 `summonTarget` 新增：

- `triggerFrameCandidates`
- `triggerFrameCandidateSummary`

`skillControlStatus` 现在可为 `skill-control-json-readable`，不再固定为 `skill-control-json-stub-only`。

### 90.5 Workbench

- `AnalysisPanel` 的逐 hit 摘要会显示 `触发候选 {frames}`。
- `TimelineGridPreview` 的候选帧来源会显示 `触发候选帧 {frames}`。
- element 对比状态在存在候选帧时显示 `召唤触发候选待确认`。

### 90.6 兼容性与边界

- `triggerFrameCandidates` 是 item skill_control 内部候选帧，不是最终战斗时间轴触发帧。
- 这些字段不能改变 `applied: false` 语义，也不能让二级 DamageElement 直接并入最终 HP / 韧性 / 能量曲线。
- 仍需后续用来源 hitGroup、`Delay#4`、buff runtime 条件和真实采样确认最终触发帧、命中次数和 owner/target。

## 91. 阶段 5-8BL：threeValueCurveFramework 框架优先摘要

阶段 5-8BL 将当前开发重心从“继续收敛每个技能的具体命中帧”调整为“先搭稳 HP / 韧性 / 能量三值曲线框架”。新增字段不改变现有候选曲线算法，也不把候选值推进为最终公式。

### 91.1 simulationResult.threeValueCurveFramework

模拟结果顶层新增：

```json
{
  "threeValueCurveFramework": {
    "schemaVersion": 1,
    "sourceKind": "azpr-three-value-curve-framework",
    "status": "three-value-curve-framework-ready-details-deferred",
    "developmentFocus": "framework-first-before-frame-perfecting",
    "frameRate": 60,
    "frameMs": 16.666667,
    "timebase": {
      "granularity": "one-frame",
      "frameRate": 60,
      "frameMs": 16.666667,
      "frameIndexBase": 0
    },
    "summary": {
      "trackCount": 3,
      "candidateTrackCount": 3,
      "candidatePointCount": 15,
      "chartPointCount": 15,
      "detailsDeferred": true,
      "applied": false
    },
    "tracks": [],
    "applied": false
  }
}
```

`developmentFocus = framework-first-before-frame-perfecting` 表示当前阶段允许细帧、命中次数、归属和 buff runtime 条件后补。读取方不应因为存在 `triggerFrameCandidates` 就要求唯一真实命中帧。

### 91.2 computationContract

`threeValueCurveFramework.computationContract` 记录框架输入层和未确认策略：

- `inputLayers`：`confirmed-action-result-values`、`candidate-hit-values`、`runtime-sample-captures`、`placeholder-values`。
- `curvePointPolicy`：候选点和采样点都可以进入曲线展示，但未应用候选不能改写最终 totals。
- `unresolvedTimingPolicy`：候选帧、来源帧和显示帧必须分离，直到技能细帧被确认。
- `valueApplicationPolicy`：只有显式 applied 的 result slot 能影响 totals。

### 91.3 tracks[]

固定三条轨道：

- `enemyHpDamage`：读取 `actionResultTimeline[].hpDamage`，候选 series 为 `hpDamageFormulaParamCandidate`。
- `enemyToughnessDamage`：读取 `actionResultTimeline[].toughnessDamage`，候选 series 为 `toughnessDamageCandidate`。
- `selfEnergyChange`：读取 `actionResultTimeline[].selfEnergyChange`，候选 series 为 `selfEnergyCandidate`，并保留 `projectedValueByActor[]`。

单条轨道字段：

```json
{
  "key": "enemyHpDamage",
  "label": "敌人HP伤害",
  "resultField": "hpDamage",
  "candidateSeriesKey": "hpDamageFormulaParamCandidate",
  "ownerScope": "enemy",
  "valueUnit": "raw-damage",
  "status": "track-ready-with-candidate-points",
  "resultSlotCount": 1,
  "projectedValue": 12461,
  "candidatePointCount": 5,
  "chartPointCount": 5,
  "timeOrderStatus": "source-times-monotonic",
  "applied": false
}
```

### 91.4 summary.threeValueCurveFrameworkSummary

`simulationResult.summary` 新增 `threeValueCurveFrameworkSummary`，用于面板快速显示：

```json
{
  "trackCount": 3,
  "candidateTrackCount": 3,
  "candidatePointCount": 15,
  "chartPointCount": 15,
  "actionResultCount": 1,
  "actionCount": 1,
  "actorCount": 2,
  "detailsDeferred": true,
  "applied": false
}
```

Workbench 分析面板显示：

```text
三值框架 3轨 · 曲线 3条/15点 · 细节后补
```

### 91.5 兼容性与边界

- `candidateValueSeries` 原结构不变，继续作为候选曲线输入。
- `threeValueCurveFramework.applied` 必须保持 `false`，它是框架摘要，不是最终公式。
- 现阶段不要为了填充该框架而继续深挖每个角色每个技能的逐帧动作；细帧应在框架稳定后作为可替换 evidence 或 runtime sample 接入。
- 下一阶段应新增 delta / cumulative 曲线层，让三值变化可以按帧积分显示。

## 92. 阶段 5-8BM：threeValueCurveFramework.stateCurves

阶段 5-8BM 在 `threeValueCurveFramework` 下新增 `stateCurves`，把三值曲线从“候选点集合”推进到可计算的 delta / cumulative 状态曲线框架。

### 92.1 stateCurves 顶层

```json
{
  "stateCurves": {
    "schemaVersion": 1,
    "sourceKind": "azpr-three-value-delta-cumulative-state-curves",
    "status": "state-curves-built-with-delta-cumulative-layers",
    "frameRate": 60,
    "frameMs": 16.666667,
    "layerKeys": ["applied", "candidate", "sampled", "placeholder"],
    "summary": {
      "trackCount": 3,
      "layerCount": 12,
      "pointCount": 16,
      "appliedPointCount": 1,
      "candidatePointCount": 15,
      "sampledPointCount": 0,
      "placeholderPointCount": 0,
      "cumulativeLayerCount": 4,
      "applied": false
    },
    "tracks": [],
    "applied": false
  }
}
```

### 92.2 曲线层语义

固定四层：

- `applied`：来自 `actionResultTimeline` 中 `applied = true` 的结果槽位，例如当前 raw HP 投影或显式资源 delta。
- `candidate`：来自 `candidateValueSeries.chart` 的候选点，保留 raw-param / raw-field 语义，累计值只用于诊断。
- `sampled`：预留真实 runtime sample 映射入口；有 capture 但未映射时保持 pending。
- `placeholder`：动作骨架存在但没有 applied/candidate/sampled 点时生成 0 delta 占位。

层之间必须隔离累计，不能把 `candidate.cumulative` 与 `applied.cumulative` 相加。

### 92.3 state curve track

单条 track：

```json
{
  "trackKey": "enemyHpDamage",
  "label": "敌人HP伤害",
  "ownerScope": "enemy",
  "valueUnit": "raw-damage",
  "status": "state-curve-track-ready",
  "pointCount": 6,
  "layers": [],
  "applied": false
}
```

默认三条轨道仍是：

- `enemyHpDamage`
- `enemyToughnessDamage`
- `selfEnergyChange`

### 92.4 layer point

点结构统一包含：

```json
{
  "sourceKind": "candidate-chart-point",
  "actionId": "action-0001",
  "frameIndex": 12,
  "frameLabel": "0s12f",
  "delta": 2500,
  "cumulative": 2500,
  "applied": false
}
```

`candidate` 点还会透传 `hitIndex`、`sourceFrameIndex`、`displayFrameIndex`、`localFrameIndex`、`chainStartFrame`、`valueSamples`、`elementConfigIds`、`triggerTimingStatus` 等候选来源字段。

### 92.5 当前样例

默认末音样本：

- `stateCurves.summary.pointCount = 16`
- `appliedPointCount = 1`
- `candidatePointCount = 15`
- HP applied layer：`delta = 12461`，`cumulative = 12461`
- HP candidate layer：5 点，累计序列 `2500 -> 7300 -> 10300 -> 15700 -> 28700`

寒悠悠样本：

- `stateCurves.summary.pointCount = 13`
- `appliedPointCount = 1`
- `candidatePointCount = 12`

### 92.6 Workbench

`summary.threeValueCurveFrameworkSummary` 新增：

- `stateCurvePointCount`
- `appliedStatePointCount`
- `candidateStatePointCount`
- `placeholderStatePointCount`

Workbench 分析面板摘要从：

```text
三值框架 3轨 · 曲线 3条/15点 · 细节后补
```

扩展为：

```text
三值框架 3轨 · 曲线 3条/15点 · 状态 16点 · 细节后补
```

### 92.7 兼容性与边界

- `candidateValueSeries` 与 `candidateValueSeries.chart` 原结构不变。
- `stateCurves.applied` 继续为 `false`，表示该结构本身不代表最终公式已应用。
- `applied` 层可以用于当前结果曲线；`candidate` / `sampled` / `placeholder` 层必须明确标识来源，不能直接进入最终 totals。
- 下一阶段应把 `stateCurves` 接入更明确的 Workbench 层级展示或过滤，而不是继续追单个技能的逐帧细节。

## 93. 阶段 5-8BN：stateCurves Workbench layer view

阶段 5-8BN 不改变 `threeValueCurveFramework.stateCurves` 的持久结构，只把它接入 Workbench 分析面板的紧凑展示与过滤层。

### 93.1 AnalysisPanel 输入

`AnalysisPanel` 新增 prop：

```vue
<AnalysisPanel
  :three-value-curve-framework="simulationResult.threeValueCurveFramework"
/>
```

该 prop 读取：

- `threeValueCurveFramework.stateCurves.summary`
- `threeValueCurveFramework.stateCurves.tracks[]`
- `tracks[].layers[]`

### 93.2 UI 层级过滤

分析面板新增“状态曲线”区块：

```text
状态曲线 16
已用 候选 采样 占位
敌人HP伤害 raw-damage · 2/2层 · 6点
已用 1点 Δ12,461 Σ12,461
候选 5点 Δ2,500-13,000 Σ28,700
```

默认层级：

- `applied = true`
- `candidate = true`
- `sampled = false`
- `placeholder = false`

关闭 `candidate` 后，默认末音样本只剩 HP applied 1 点，标题计数从 `16` 变为 `1`。

### 93.3 当前样例断言

默认末音样本：

- `workbench-state-curves` 存在。
- `workbench-state-curve-row` 为 3 行。
- 标题点数为 `16`。
- HP 行显示 `raw-damage · 2/2层 · 6点`。
- HP applied chip：`已用 1点 Δ12,461 Σ12,461`。
- HP candidate chip：`候选 5点 Δ2,500-13,000 Σ28,700`。

寒悠悠样本：

- 标题摘要仍显示 `三值框架 3轨 · 曲线 3条/12点 · 状态 13点 · 细节后补`。
- HP candidate chip 显示 `候选 4点 Δ6,400-18,000 Σ44,300`。

### 93.4 兼容性与边界

- 本阶段不修改 `candidateValueSeries.chart` 和主时间轴 marker。
- 该展示层只负责层级可见性和摘要，不改变模拟结果。
- `sampled` / `placeholder` 默认隐藏，是为了避免在没有真实点时制造噪音；后续可在样本导入和动作骨架视图成熟后默认开放。
- 下一阶段应优先让 runtime sample 或占位动作真正进入对应层，而不是继续追单个技能逐帧细节。

## 94. 阶段 5-8BO：RecoverSP sampled state curve 与 placeholder 骨架

阶段 5-8BO 扩展 `threeValueCurveFramework.stateCurves` 的输入来源，让 `sampled` 和 `placeholder` 不再只是空层。

### 94.1 runtimeSampleContext 输入

`projectSimulationResult()` 现在把 `runtimeSampleContext` 传给：

```js
buildThreeValueCurveFramework({
  scenario,
  actionResultTimeline,
  candidateValueSeries,
  runtimeSampleContext
});
```

并继续下传到 `buildThreeValueStateCurves()` / `createSampledStateCurveLayer()`。

### 94.2 sampled layer 映射

当前只映射自身能量轨：

- `track.key = selfEnergyChange`
- `eventType = recover-sp-applied`

映射为 state point：

```json
{
  "sourceKind": "runtime-recover-sp-applied-sample",
  "eventType": "recover-sp-applied",
  "actionId": "action-0001",
  "actorId": "actor-109001",
  "sourceElementConfigId": 109001081,
  "frameIndex": 12,
  "frameLabel": "0s12f",
  "delta": 0.3375,
  "cumulative": 0.3375,
  "spBefore": 10,
  "spAfter": 10.3375,
  "recoverTagType": 0,
  "applied": false
}
```

`sampled` layer 在有点时：

```json
{
  "status": "delta-cumulative-points-built",
  "mappingStatus": "runtime-samples-mapped-to-state-curve",
  "runtimeSampleCount": 1,
  "importedRuntimeSampleCount": 6,
  "pointCount": 1,
  "finalCumulative": 0.3375
}
```

### 94.3 summary 扩展

`summary.threeValueCurveFrameworkSummary` 新增：

- `sampledStatePointCount`

RecoverSP fixture 导入后当前摘要：

```json
{
  "stateCurvePointCount": 17,
  "appliedStatePointCount": 1,
  "candidateStatePointCount": 15,
  "sampledStatePointCount": 1,
  "placeholderStatePointCount": 0
}
```

### 94.4 placeholder 骨架验证

`placeholder` 层继续由未被 `applied` / `candidate` / `sampled` 占用的 action 生成 0 delta 点。本阶段新增测试覆盖手动资源/敌人事件：

```json
{
  "pointCount": 22,
  "appliedPointCount": 2,
  "candidatePointCount": 15,
  "sampledPointCount": 0,
  "placeholderPointCount": 5
}
```

其中 HP placeholder 层覆盖：

```json
["action-resource", "action-enemy"]
```

### 94.5 兼容性与边界

- sampled 点是 runtime evidence 层，仍不改写 `selfEnergyChange.value`。
- 当前 sampled 映射只覆盖 RecoverSP / 自身能量；HP 和韧性采样仍待后续补充。
- placeholder 点只表示“动作存在但该轨道没有已应用/候选/采样点”，不代表游戏中真实发生 0 值事件。
- 下一阶段应让 Workbench 对 sampled / placeholder 的存在更可见，例如层级控件计数、自动提示或按动作骨架下钻。

## 95. 阶段 5-8BP：stateCurves layer count UI

阶段 5-8BP 不修改 `threeValueCurveFramework.stateCurves` 的持久结构，只补充 Workbench 对现有四层的消费规则。

### 95.1 层级控件派生结构

`AnalysisPanel` 新增前端派生的 `stateCurveLayerOptions`：

```js
[
  { key: 'applied', label: '已用', pointCount: 1, trackCount: 1 },
  { key: 'candidate', label: '候选', pointCount: 15, trackCount: 3 },
  { key: 'sampled', label: '采样', pointCount: 0, trackCount: 0 },
  { key: 'placeholder', label: '占位', pointCount: 0, trackCount: 0 }
]
```

其中：

- `pointCount` 为所有 track 中同名 layer 的点数总和。
- `trackCount` 为该 layer 至少有 1 个点的 track 数。
- 该结构只存在于界面层，不写回模拟结果。

### 95.2 显示规则

状态曲线区块的入口条件从 `stateCurveTrackRows.length > 0` 调整为：

```js
stateCurveTotalPointCount > 0
```

这样当默认启用的 `applied / candidate` 层没有点，但 `sampled / placeholder` 有点时，用户仍能看到层级开关并手动展开。

轨道行的 `visibleLayers` 现在只保留：

```js
activeLayers.has(layer.key) && layer.pointCount > 0
```

因此 UI 不再显示 `0点` 空层，状态曲线标题中的数字表示当前启用层的可见点数。

### 95.3 小数显示

状态曲线 layer 摘要改用 `formatStateCurveNumber()`：

- 普通整数仍走千分位，例如 `12,461`。
- 非整数值保留最多 4 位小数，并去掉尾随 0。
- RecoverSP sampled fixture 的 `0.3375` 会显示为 `采样 1点 Δ0.3375 Σ0.3375`。

### 95.4 验证

新增 `AnalysisPanel` 组件级 fixture，覆盖：

- `selfEnergyChange.sampled.pointCount = 1`
- `enemyHpDamage.placeholder.pointCount = 1`
- applied / candidate 均为 0 点时，状态曲线区块仍显示。
- 勾选 sampled 后可见点数从 `0` 变为 `1`。
- 再勾选 placeholder 后可见点数变为 `2`。

阶段验收：

- `npm test -- --run src\__tests__\views\Workbench.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过。
- `npm run test -- --run`：通过。
- `npm run build`：通过。

下一阶段 5-8BQ 应把这些点级信息进一步接入下钻或时间轴提示，而不是改动 `stateCurves` 基础结构。

## 96. 阶段 5-8BQ：stateCurves point detail view

阶段 5-8BQ 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只在 Workbench 分析面板中新增点级消费视图。

### 96.1 前端派生点行

`AnalysisPanel` 通过 `createStateCurveVisiblePointRows(track, visibleLayers)` 从可见 layer 里派生点行：

```js
{
  ...point,
  rowKey,
  trackKey,
  layerKey,
  layerLabel,
  layerIndex,
  pointIndex,
  valueUnit
}
```

排序规则：

1. `frameIndex`
2. `timeMs`
3. `layerIndex`
4. `sequenceIndex`
5. `eventIndex`
6. `hitIndex`
7. `pointIndex`

这只是 UI 派生结构，不写回 `stateCurves`。

### 96.2 点级展示字段

每个可见点渲染为：

```text
0s12f
候选 Δ2,500 Σ2,500
普通攻击 · hit1 · element 109001306/109001081 · candidate-chart-point
```

对 RecoverSP sampled 点，可展示：

```text
0s12f
采样 Δ0.3375 Σ0.3375
action-sample · element 109001081 · recover-sp-applied · SP 10->10.3375 · runtime-recover-sp-applied-sample
```

对 placeholder 点，可展示：

```text
1s0f
占位 Δ0 Σ0
资源动作 · action-result-placeholder
```

### 96.3 数值格式

`formatStateCurveNumber()` 当前规则：

- 整数继续走 `formatNumber()` 千分位。
- 非整数保留最多 4 位小数并去掉尾随 0。
- 支持负数，例如 `-10.25`。

该规则用于 layer 摘要和 point 明细，避免 SP 曲线里的 `10.3375` 被显示为 `10`。

### 96.4 验证

新增 / 扩展 Workbench 测试覆盖：

- 默认末音 HP 状态曲线下有 6 个可见点：1 个 applied、5 个 candidate。
- 首个 applied 点显示 `0s0f / 已用 Δ12,461 Σ12,461 / 普通攻击`。
- 首个 candidate 点显示 `0s12f / 候选 Δ2,500 Σ2,500 / hit1 / 109001306 / 109001081`。
- 关闭 candidate 层后，HP 轨道只剩 1 个点。
- sampled fixture 展开后显示 `recover-sp-applied`、`element 109001081`、`SP 10->10.3375`。
- placeholder fixture 展开后显示 `1s0f`、`资源动作`、`action-result-placeholder`。

阶段验收：

- `npm test -- --run src\__tests__\views\Workbench.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过。

下一阶段 5-8BR 应把 state point 接入主时间轴轻量 marker 或提示，让分析面板明细和时间轴位置能互相对应。

## 97. 阶段 5-8BR：stateCurves timeline markers

阶段 5-8BR 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只在 `TimelineGridPreview` 中新增时间轴派生 marker。

### 97.1 输入

`Workbench.vue` 现在把完整三值曲线框架传给时间轴：

```vue
<TimelineGridPreview
  :three-value-curve-framework="simulationResult.threeValueCurveFramework"
/>
```

`TimelineGridPreview` 新增 prop：

```js
threeValueCurveFramework: {
  type: Object,
  default: () => ({
    stateCurves: {
      tracks: []
    }
  })
}
```

### 97.2 渲染层选择

当前时间轴 state marker 只消费：

```js
new Set(['applied', 'sampled', 'placeholder'])
```

原因：

- `candidate` 层已经由原有“候选三值”曲线、marker 和 frame hotspot 展示。
- `applied / sampled / placeholder` 是此前最容易在主时间轴上不可见的状态变化层。

### 97.3 派生 marker

`createStateCurveTimelineMarker()` 从 state point 派生：

```js
{
  id,
  trackKey,
  trackLabel,
  layerKey,
  layerLabel,
  valueUnit,
  actionId,
  actionName,
  actorId,
  frameIndex,
  frameLabel,
  timeMs,
  top,
  delta,
  cumulative,
  hitIndex,
  eventType,
  resultStatus,
  sourceKind,
  elementConfigIds,
  sourceElementConfigId,
  elementConfigId,
  spBefore,
  spAfter
}
```

lane 解析顺序：

1. 若 `actionId` 对应已有 action，沿 action lane。
2. 否则若 `actorId` 是 actor lane，沿 actor lane。
3. 否则进入 system lane。

### 97.4 tooltip

marker title 格式：

```text
状态点 敌人HP伤害 已用 0s0f: Δ12,461 Σ12,461 · 普通攻击 · action-result-applied-value
```

RecoverSP sampled marker 可包含：

```text
SP 10->10.3375
```

placeholder marker 可包含：

```text
action-result-placeholder
```

### 97.5 验证

扩展 Workbench 测试覆盖：

- 默认末音样例生成 1 个 state marker。
- 该 marker 位于 `actor-109001` lane，`trackKey = enemyHpDamage`，`layerKey = applied`，`frameLabel = 0s0f`。
- marker title 包含 `状态点 敌人HP伤害 已用 0s0f: Δ12,461 Σ12,461` 和 `普通攻击`。
- 添加资源/敌人事件后，placeholder marker 覆盖 `action-0002` 和 `action-0003`。
- placeholder marker title 均包含 `action-result-placeholder`。

阶段验收：

- `npm test -- --run src\__tests__\views\Workbench.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过。

下一阶段 5-8BS 应补状态点 marker 筛选、选中或与分析面板点级明细联动。

## 98. 阶段 5-8BS：stateCurvePointId selected-link

阶段 5-8BS 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只新增前端共享 ID 与选中状态。

### 98.1 共享 ID

新增文件：

```text
src/features/workbench/stateCurvePointIdentity.js
```

导出：

```js
createStateCurvePointId({
  trackKey,
  layerKey,
  point,
  pointIndex
})
```

ID 由以下字段组成：

```js
[
  trackKey,
  layerKey,
  point.actionId ?? point.eventType ?? 'point',
  point.frameIndex ?? point.timeMs ?? pointIndex,
  point.sequenceIndex ?? point.eventIndex ?? point.hitIndex ?? pointIndex
].join('|')
```

该 ID 只用于 Workbench 前端联动，不写回导出的模拟数据。

### 98.2 Workbench 选中状态

`Workbench.vue` 新增：

```js
const selectedStateCurvePointId = ref('');

function selectStateCurvePoint(pointId) {
  selectedStateCurvePointId.value = pointId || '';
}
```

并传给：

- `TimelineGridPreview`
- `AnalysisPanel`

两者都通过 `select-state-curve-point` 事件回传选中 ID。

### 98.3 时间轴 marker

`TimelineGridPreview` 的 state marker 新增：

```html
data-state-point-id
role="button"
selected class
```

点击、Enter、Space 都会触发：

```js
emit('select-state-curve-point', marker.statePointId)
```

### 98.4 分析面板点明细

`AnalysisPanel` 的 state point row 新增：

```html
data-state-point-id
role="button"
selected class
```

点击、Enter、Space 都会触发：

```js
emit('select-state-curve-point', point.statePointId)
```

### 98.5 验证

扩展 Workbench 测试覆盖：

- 时间轴 applied marker 和分析面板 applied point 共享同一个 `data-state-point-id`。
- 点击候选 state point 后，候选明细高亮，applied 时间轴 marker 不高亮。
- 再点击 applied 时间轴 marker 后，marker 与对应分析面板点同步高亮。

阶段验收：

- `npm test -- --run src\__tests__\views\Workbench.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过。

下一阶段 5-8BT 应补状态点 layer / track 筛选或 selected-only 焦点模式。

## 99. 阶段 5-8BT：stateCurveLayerFilters shared UI state

阶段 5-8BT 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只把 Workbench 对 state layer 的可见性改为共享前端状态，让分析面板和时间轴消费同一套过滤条件。

### 99.1 Workbench 共享状态

`Workbench.vue` 新增：

```js
const stateCurveLayerFilters = ref({
  applied: true,
  candidate: true,
  sampled: false,
  placeholder: false
});

function updateStateCurveLayerFilter({ layerKey, visible }) {
  stateCurveLayerFilters.value = {
    ...stateCurveLayerFilters.value,
    [layerKey]: Boolean(visible)
  };
}
```

并传给：

- `TimelineGridPreview`
- `AnalysisPanel`

两者都通过 `update-state-curve-layer-filter` 回传 layer 开关变化。

### 99.2 AnalysisPanel 受控过滤

`AnalysisPanel` 新增 prop：

```js
stateCurveLayerFilters
```

状态曲线 layer 开关从内部 `v-model` 改为：

```html
:checked="isStateCurveLayerVisible(layer.key)"
@change="setStateCurveLayerVisible(layer.key, $event.target.checked)"
```

`stateCurveTrackRows` 继续只按可见 layer 生成 `visibleLayers` 和 `visiblePointRows`。这仍是 UI 派生结构，不写回 `stateCurves`。

### 99.3 TimelineGridPreview layer toggle

`TimelineGridPreview` 新增时间轴层开关：

```html
data-testid="workbench-timeline-state-layer-toggle"
```

时间轴只列出会渲染为 marker 的层：

```js
applied
sampled
placeholder
```

`candidate` 层仍由候选三值曲线和分析面板明细负责，不重复生成状态点 marker。

`createStateCurveTimelineMarkers()` 新增过滤条件：

```js
STATE_CURVE_TIMELINE_LAYER_KEYS.has(layer.key) &&
isStateCurveTimelineLayerVisible(layer.key) &&
(layer.pointCount ?? 0) > 0
```

### 99.4 默认值与语义

默认可见性保持：

- `applied = true`
- `candidate = true`
- `sampled = false`
- `placeholder = false`

因此默认末音样本仍会显示 applied 状态点；手动资源/敌人事件产生的 placeholder 状态点需要显式打开“占位”层后才会在时间轴显示。

### 99.5 验证

扩展 Workbench 测试覆盖：

- 时间轴“已用”开关关闭后，applied 状态 marker 消失，分析面板 applied layer 同步关闭。
- 从分析面板重新打开 applied 后，时间轴 marker 同步恢复。
- 单测挂载 `AnalysisPanel` 时模拟父组件回传 `stateCurveLayerFilters`，验证 sampled / placeholder 仍可被打开。
- 资源动作和敌人事件测试显式打开 placeholder 后，再验证 placeholder 状态 marker。

阶段验收：

- `npm run test -- --run`：通过。

下一阶段 5-8BU 应补状态点 track 筛选或 selected-only 焦点模式。

## 100. 阶段 5-8BU：stateCurveTrackFilters shared UI state

阶段 5-8BU 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只新增 Workbench 前端共享的 track 可见性状态。它和阶段 5-8BT 的 `stateCurveLayerFilters` 并列，用于在状态点数量增加后按三值轨道过滤展示。

### 100.1 Workbench 共享状态

`Workbench.vue` 新增：

```js
const stateCurveTrackFilters = ref({});

function updateStateCurveTrackFilter({ trackKey, visible }) {
  stateCurveTrackFilters.value = {
    ...stateCurveTrackFilters.value,
    [trackKey]: Boolean(visible)
  };
}
```

默认语义是“未显式关闭即显示”：

```js
effectiveStateCurveTrackFilters[trackKey] !== false
```

这样后续如果新增三值轨道或调试轨道，不会因为默认过滤表缺少 key 而被隐藏。

### 100.2 AnalysisPanel track controls

`AnalysisPanel` 新增 prop：

```js
stateCurveTrackFilters
```

并新增轨道开关：

```html
data-testid="workbench-state-curve-track-toggle"
```

轨道选项来自：

```js
threeValueCurveFramework.stateCurves.tracks[]
```

当前默认样本会显示：

- `enemyHpDamage`：6 点
- `enemyToughnessDamage`：5 点
- `selfEnergyChange`：5 点

`stateCurveTrackRows` 同时满足 layer 可见与 track 可见后才生成 `visibleLayers` 和 `visiblePointRows`。

### 100.3 TimelineGridPreview track controls

`TimelineGridPreview` 新增 prop：

```js
stateCurveTrackFilters
```

并新增时间轴轨道开关：

```html
data-testid="workbench-timeline-state-track-toggle"
```

时间轴轨道选项只统计会渲染为 marker 的层：

```js
applied
sampled
placeholder
```

因此默认末音样本时间轴只出现 `enemyHpDamage 1`，因为默认只有 applied HP 状态点会渲染为 marker；candidate HP / 韧性 / 能量点继续由候选三值曲线显示。

`createStateCurveTimelineMarkers()` 新增 track gate：

```js
isStateCurveTrackVisible(track.trackKey)
```

### 100.4 验证

扩展 Workbench 测试覆盖：

- 分析面板显示 3 个状态曲线 track toggle，点数为 `6 / 5 / 5`。
- 时间轴默认显示 `enemyHpDamage 1` track toggle。
- 从分析面板关闭 `enemyHpDamage` 后，可见状态点数从 `16` 降为 `10`，HP row 消失，时间轴状态 marker 消失。
- 从时间轴重新打开 `enemyHpDamage` 后，分析面板 HP track toggle 和时间轴 marker 同步恢复。

阶段验收：

- `npm run test -- --run`：通过。

下一阶段 5-8BV 应补 selected-only 焦点模式或状态点导航。

## 101. 阶段 5-8BV：stateCurveFocusMode selected-only UI state

阶段 5-8BV 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只新增 Workbench 前端共享的焦点模式。该模式叠加在 `stateCurveLayerFilters` 和 `stateCurveTrackFilters` 之后，用于快速把状态曲线视图收窄到当前选中的 state point。

### 101.1 Workbench 共享状态

`Workbench.vue` 新增：

```js
const stateCurveFocusMode = ref('all');

function updateStateCurveFocusMode(mode) {
  if (mode === 'selected' && !selectedStateCurvePointId.value) {
    return;
  }
  stateCurveFocusMode.value = mode === 'selected' ? 'selected' : 'all';
}
```

`selectStateCurvePoint('')` 会把焦点模式恢复为 `all`，避免无选中点时停留在空焦点。

### 101.2 AnalysisPanel focus controls

`AnalysisPanel` 新增 prop：

```js
stateCurveFocusMode
```

并新增分段按钮：

```html
data-testid="workbench-state-curve-focus-all"
data-testid="workbench-state-curve-focus-selected"
```

有效焦点模式：

```js
props.stateCurveFocusMode === 'selected' && props.selectedStateCurvePointId
  ? 'selected'
  : 'all'
```

因此未选中 state point 时，“选中”按钮不可用，且视图保持 `all`。

### 101.3 点明细过滤

`createStateCurveVisiblePointRows()` 新增 selected-only gate：

```js
!isStateCurveSelectedFocusActive.value ||
point.statePointId === props.selectedStateCurvePointId
```

进入 selected-only 后：

- `stateCurveVisiblePointCount` 按 `visiblePointRows.length` 计算。
- `stateCurveTrackRows` 会过滤掉不包含选中点的轨道。
- 轨道摘要和 layer pill 只保留包含选中点的可见层。

### 101.4 时间轴 marker 过滤

`TimelineGridPreview` 新增 prop：

```js
stateCurveFocusMode
```

`createStateCurveTimelineMarkers()` 新增 marker gate：

```js
!isStateCurveSelectedFocusActive.value ||
marker.statePointId === props.selectedStateCurvePointId
```

注意：时间轴仍只渲染 `applied / sampled / placeholder` 状态 marker。若当前选中点属于 `candidate` 层，分析面板可以聚焦该候选点，但时间轴不会额外生成 candidate state marker；candidate 仍由原候选三值曲线负责。

### 101.5 验证

扩展 Workbench 测试覆盖：

- 选中默认 applied HP 状态点后，“选中”按钮可用。
- 点击“选中”后，状态曲线可见点数从 `16` 降为 `1`。
- 点明细只剩当前 `data-state-point-id` 对应的 applied HP 点。
- 时间轴 marker 同步保持 1 个当前选中点。
- 点击“全部”后，可见点数恢复为 `16`，点明细恢复 16 行。

阶段验收：

- `npm run test -- --run`：通过。

下一阶段 5-8BW 应补状态点邻近导航或同帧三值点切换。

## 102. 阶段 5-8BW：stateCurveNavigationPointRows

阶段 5-8BW 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只新增 `AnalysisPanel` 内的状态点导航派生序列。该序列用于在当前 layer / track 过滤结果内做上一点 / 下一点切换。

### 102.1 派生层拆分

`AnalysisPanel` 将原本直接生成 `stateCurveTrackRows` 的逻辑拆成两层：

```js
stateCurveBaseTrackRows
stateCurveTrackRows
```

- `stateCurveBaseTrackRows`：只应用 layer / track 过滤，保留完整可导航点序列。
- `stateCurveTrackRows`：在 base rows 上再叠加 selected-only 焦点过滤，用于实际展示。

这样进入 `stateCurveFocusMode = selected` 后，界面可以只显示当前点，但导航仍能基于完整过滤序列跳到相邻点。

### 102.2 导航序列

新增：

```js
stateCurveNavigationPointRows
selectedStateCurveNavigationIndex
stateCurveNavigationSummary
```

`stateCurveNavigationPointRows` 来自：

```js
stateCurveBaseTrackRows.value.flatMap(track => track.visiblePointRows)
```

并通过 `compareStateCurvePointRows` 排序。

### 102.3 排序规则

`compareStateCurvePointRows()` 新增 `trackIndex` 排序项：

```js
frameIndex
timeMs
trackIndex
layerIndex
sequenceIndex
eventIndex
hitIndex
pointIndex
```

这让同一帧的 HP / 韧性 / 能量点顺序稳定，为下一阶段同帧三值切换做准备。

### 102.4 UI 控件

`AnalysisPanel` 状态曲线标题新增：

```html
data-testid="workbench-state-curve-nav-prev"
data-testid="workbench-state-curve-nav-next"
data-testid="workbench-state-curve-nav-position"
```

导航按钮通过：

```js
selectAdjacentStateCurvePoint(direction)
```

触发原有：

```js
emit('select-state-curve-point', nextPoint.statePointId)
```

不会改变 layer / track / focus 设置。

### 102.5 candidate 边界

若导航跳到 `candidate` 层 state point：

- `AnalysisPanel` 可以在 selected-only 模式下只显示该 candidate 点。
- `TimelineGridPreview` 仍不会生成 candidate state marker。
- 候选层继续由候选三值曲线和候选 marker 负责。

### 102.6 验证

扩展 Workbench 测试覆盖：

- 选中 applied HP 点并进入 selected-only 后，导航位置为 `1/16`。
- “上一点”禁用，“下一点”可用。
- 点击“下一点”后，位置变为 `2/16`，点明细切到第一条 candidate HP 点。
- 因为 candidate 不生成 state marker，时间轴状态 marker 数量变为 0。
- 点击“上一点”后回到 applied HP 点，时间轴状态 marker 恢复为 1。

阶段验收：

- `npm run test -- --run`：通过。

下一阶段 5-8BX 应补同帧三值点切换或状态点分组导航。

## 103. 阶段 5-8BX：stateCurveFrameGroupRows

阶段 5-8BX 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只在 `AnalysisPanel` 中新增同帧状态点分组派生字段和 UI。该能力用于在同一动作 / 同一帧 / 同一 hit 或 event 的 HP、韧性、能量状态点之间直接切换。

### 103.1 frameGroupKey

`createStateCurveVisiblePointRows()` 为每个前端点行新增：

```js
frameGroupKey
trackLabel
```

`frameGroupKey` 由以下字段组成：

```js
[
  point.actionId ?? point.eventType ?? 'point',
  point.frameIndex ?? point.timeMs ?? point.frameLabel ?? 'time',
  point.hitIndex ?? point.eventIndex ?? point.sequenceIndex ?? point.eventType ?? 'event'
].join('|')
```

该 key 只用于 Workbench 前端分组，不写回模拟结果。

### 103.2 分组选项

新增：

```js
selectedStateCurveNavigationPoint
selectedStateCurveFrameGroupRows
```

`selectedStateCurveFrameGroupRows` 从 `stateCurveNavigationPointRows` 中筛选与当前选中点 `frameGroupKey` 相同的点。由于 `stateCurveNavigationPointRows` 已经应用 layer / track 过滤，分组选项不会绕过用户当前隐藏的层或轨道。

### 103.3 UI 控件

状态曲线标题新增：

```html
data-testid="workbench-state-curve-frame-group-controls"
data-testid="workbench-state-curve-frame-group-option"
```

当同组点数大于 1 时显示。按钮上写入：

```html
data-state-point-id
data-track-key
data-layer-key
data-frame-group-key
```

点击按钮触发：

```js
emit('select-state-curve-point', point.statePointId)
```

### 103.4 显示文案

分组按钮显示：

```text
HP 候选 Δ2,500
韧性 候选 Δ7,000
能量 候选 Δ2,700
```

轨道短标签当前映射：

- `enemyHpDamage` -> `HP`
- `enemyToughnessDamage` -> `韧性`
- `selfEnergyChange` -> `能量`

### 103.5 DOM 标记

状态点明细行新增：

```html
data-track-key
```

用于测试和人工调试当前选中点所属三值轨道。

### 103.6 验证

扩展 Workbench 测试覆盖：

- 从 applied HP 点进入 selected-only 后，点击下一点切到第一条 candidate HP 点。
- 同帧分组按钮出现 3 个选项，轨道顺序为 `enemyHpDamage / enemyToughnessDamage / selfEnergyChange`。
- 点击韧性选项后，导航位置变为 `3/16`，点明细的 `data-track-key` 为 `enemyToughnessDamage`。
- 点击 HP 选项后，导航位置回到 `2/16`，选中点恢复为第一条 candidate HP 点。

阶段验收：

- `npm run test -- --run`：通过。

下一阶段 5-8BY 应把状态点导航与候选三值曲线帧热点联动。

## 104. 阶段 5-8BY：candidate frame hotspot to state point link

阶段 5-8BY 不修改 `threeValueCurveFramework.stateCurves` 的模拟结果结构，只把候选三值曲线的 frame hotspot / marker 与现有状态点导航联动起来。

### 104.1 共享 frame group helper

`createStateCurveFrameGroupKey()` 从 `AnalysisPanel.vue` 移到：

```js
src/features/workbench/stateCurvePointIdentity.js
```

现在导出：

```js
createStateCurvePointId()
createStateCurveFrameGroupKey()
```

`AnalysisPanel` 与 `TimelineGridPreview` 共用该 helper，避免两边对“同动作 / 同帧 / 同 hit”产生不同解释。

### 104.2 Candidate frame group 补充帧字段

`TimelineGridPreview.createCandidateValueFrameGroups()` 的 group 派生对象新增：

```js
displayFrameIndex
sourceFrameIndex
```

用于生成和 state point 一致的 `frameGroupKey`。优先使用 `displayFrameIndex`，回退到 `sourceFrameIndex / timeMs / frameLabel`。

### 104.3 热点点击联动

以下入口现在会在保留原候选帧摘要行为的同时，尝试选择对应状态点：

```js
selectCandidateFrameGroup(group)
selectCandidateFrameGroupByMarker(marker)
```

新增流程：

```js
selectStateCurvePointForCandidateFrame(frame)
findCandidateStateCurvePointForFrame(frame)
```

匹配条件：

- state track 未被 `stateCurveTrackFilters` 隐藏。
- `candidate` layer 未被 `stateCurveLayerFilters` 隐藏。
- layer 有点。
- `createStateCurveFrameGroupKey(point)` 与候选帧 group key 相同。

匹配成功后：

```js
emit('select-state-curve-point', point.statePointId)
```

### 104.4 选择策略

当前按 `threeValueCurveFramework.stateCurves.tracks[]` 顺序搜索。默认样本中顺序为：

1. `enemyHpDamage`
2. `enemyToughnessDamage`
3. `selfEnergyChange`

因此点击同帧候选热点会优先选中 HP candidate state point，再由 5-8BX 的同帧分组按钮切换到韧性或能量。

### 104.5 边界

- 该联动不会生成 candidate state marker；时间轴 candidate 仍由候选曲线 / marker / frame hotspot 负责。
- 若用户隐藏 candidate layer 或对应 track，候选帧热点仍会显示候选摘要，但不会强行选中隐藏的 state point。
- 匹配不到 state point 时不抛错，只保留原候选帧选中行为。

### 104.6 验证

扩展 Workbench 测试覆盖：

- 点击 hit1 的 candidate frame hotspot 后，候选帧摘要仍显示。
- 状态点导航位置同步变为 `2/16`。
- 第一条 candidate HP state point 的明细行同步选中。
- 同帧分组中的 HP candidate 按钮同步 active。

阶段验收：

- `npm run test -- --run`：通过。

下一阶段 5-8BZ 应补候选三值曲线 selected-frame scope 与状态点焦点模式联动。

## 105. 阶段 5-8BZ：candidate selected-frame scope 与 state focus 联动

阶段 5-8BZ 不修改模拟输出结构，只调整 Workbench 前端的派生状态和事件链，让候选三值曲线的 `selected-frame` 范围与状态点的 selected-only 焦点保持一致。

### 105.1 新增事件链

`TimelineGridPreview` 新增 emit：

```js
update-state-curve-focus-mode
```

`src/views/Workbench.vue` 接入：

```vue
@update-state-curve-focus-mode="updateStateCurveFocusMode"
```

因此候选三值曲线内部的范围按钮可以复用 Workbench 已有的状态点焦点状态：

```js
stateCurveFocusMode
selectedStateCurvePointId
```

### 105.2 Candidate scope -> state focus

`setCandidateDisplayScope(scope)` 现在有联动语义：

```js
setCandidateDisplayScope('selected-frame')
```

会先通过现有流程选中同帧 candidate state point：

```js
selectStateCurvePointForCandidateFrame(selectedCandidateFrameGroup.value)
```

匹配成功后再 emit：

```js
emit('update-state-curve-focus-mode', 'selected')
```

切回：

```js
setCandidateDisplayScope('all')
```

会 emit：

```js
emit('update-state-curve-focus-mode', 'all')
```

### 105.3 State focus -> candidate scope

`TimelineGridPreview` 新增 `watch()`，监听：

```js
props.stateCurveFocusMode
props.selectedStateCurvePointId
props.threeValueCurveFramework
props.stateCurveLayerFilters
props.stateCurveTrackFilters
candidateSeriesVisibility
candidateActorFilter
candidateActionFilter
```

当 `stateCurveFocusMode = selected` 且选中点属于 `candidate` layer 时：

1. 通过 `findStateCurvePointById(pointId)` 在当前可见 state track / layer 中找到选中 state point。
2. 用 `createStateCurveFrameGroupKey(point)` 与当前可见候选 series 点匹配。
3. 匹配到同动作 / 同帧 / 同 hit 后，设置：

```js
selectedCandidateFrameGroupId = frameGroupId
candidateDisplayScope = 'selected-frame'
```

当状态点焦点切回 `all`，或 selected-only 选中点不是 `candidate` layer 时：

```js
candidateDisplayScope = 'all'
```

### 105.4 可见性边界

联动尊重当前过滤：

- candidate series visibility。
- candidate actor filter。
- candidate action filter。
- state layer filter。
- state track filter。

若用户主动隐藏对应 candidate series、action、actor、state layer 或 state track，联动不会强行显示隐藏内容。

### 105.5 与数据结构的关系

本阶段没有新增或修改以下数据：

```js
candidateValueSeries.chart
threeValueCurveFramework.stateCurves
actionResultTimeline
```

它只新增 Workbench 前端派生关系：

```txt
candidate selected-frame scope <-> stateCurveFocusMode(selected/all)
```

candidate state point 仍不作为时间轴 state marker 渲染，仍由候选曲线 / marker / frame hotspot 负责显示。

### 105.6 验证

扩展 Workbench 测试覆盖：

- 状态点导航从 applied 点移动到第一个 candidate HP 点时，候选 scope 自动变为 `selected-frame`。
- 同帧候选 marker 从 15 个收束为 3 个，frame hotspot 从 5 个收束为 1 个。
- 状态点焦点回到 applied 或 `all` 时，候选 scope 自动回到 `全部`。
- 点击候选 scope 的 `选中帧` 后，分析面板状态点焦点同步进入 selected-only，显示 1 个状态点。
- 点击候选 scope 的 `全部` 后，分析面板状态点焦点同步回到 all，显示 16 个状态点。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过。
- `npm run test -- --run`：通过。

下一阶段 5-8CA 方向调整为生成层 / 运行时层 / UI 层收束。

## 106. 阶段 5-8CA 路线收束：标准生成层合同

蓝色星原仍在测试阶段，平衡数值、最终倍率和公式细节可能继续调整；后续不再把最终数值考据作为当前主线阻塞项。现有 evidence / candidate / runtime sample 继续保留，但应折叠成运行时可消费的标准生成层输入。

### 106.1 目标合同

下一阶段优先定义最小稳定合同，形态围绕：

```txt
Action -> Hit -> ThreeValueDelta
```

每个三值 delta 至少需要能表达：

```js
{
  actionId,
  hitIndex,
  frame,
  timeMs,
  trackKey,
  layerKey,
  hpDelta,
  toughnessDelta,
  energyDelta,
  sourceKind,
  sourceIds,
  confidence
}
```

字段名可随实现微调，但语义应保持稳定：生成层负责归一化和来源标注，运行时层负责消费，UI 层负责展示。

### 106.2 分层边界

- 生成层读取 `candidateValueSeries.chart`、`threeValueCurveFramework.stateCurves`、`actionResultTimeline[].sourceEvidence`、`metadata.runtimeSampleCaptures` 等现有来源。
- 运行时层不继续追公式证据，只消费标准合同并输出 `simLog`、`stateCurves`、资源曲线和统计摘要。
- UI 层不再把 evidence 矩阵作为主路径，优先补资源监控、模拟日志、详情弹层和贡献拆分。
- evidence 层继续保留，用于解释 source / confidence 和后续替换真实公式。

### 106.3 当前阶段约束

5-8CA 允许新增生成层派生字段或内部 projection 字段，但暂不要求修改项目保存 schema。若后续标准合同需要落入项目文件，必须另开迁移记录并补导入导出兼容测试。

## 107. 阶段 5-8BZ2：candidate frame track focus UI state

阶段 5-8BZ2 是 5-8BZ selected-frame / state focus 联动后的 UI 收口，不改变模拟输出结构，也不改变项目保存 schema。

### 107.1 Track 与 candidate series 映射

`TimelineGridPreview` 新增两组前端常量：

```js
STATE_TRACK_TO_CANDIDATE_SERIES_KEY
CANDIDATE_SERIES_TO_STATE_TRACK_KEY
```

当前映射为：

```js
enemyHpDamage -> hpDamageFormulaParamCandidate
enemyToughnessDamage -> toughnessDamageCandidate
selfEnergyChange -> selfEnergyCandidate
```

该映射只用于 Workbench 候选层高亮，不作为公式或运行时合同。

### 107.2 选中 state point 派生候选焦点

新增派生状态：

```js
selectedStateCurvePoint
selectedCandidateFocusSeriesKey
```

当选中点属于 `candidate` layer 时，按 `trackKey` 找到对应候选 series；否则焦点为空。

### 107.3 DOM 测试属性

以下元素新增测试/调试属性：

```html
data-state-track-key
data-track-focused
```

覆盖位置：

- `workbench-candidate-value-frame-detail-row`
- `workbench-timeline-candidate-value-marker`
- `workbench-timeline-candidate-value-curve`

当同帧状态点从 HP 切到韧性或能量时，候选详情行、marker 和曲线的 `data-track-focused` 会同步转移到对应 series。

### 107.4 样式

新增 `track-focused` class：

- 候选帧详情行：边框、背景和左侧 inset 线高亮。
- 候选 marker：尺寸、边框和外发光增强。
- 候选曲线：线宽和不透明度增强。

### 107.5 边界

- 不新增 candidate state marker。
- 不改变 `candidateValueSeries.chart`。
- 不改变 `threeValueCurveFramework.stateCurves`。
- 不改变 `actionResultTimeline`。
- candidate element 对比区尚未做列级焦点。

### 107.6 验证

扩展 Workbench 测试覆盖：

- 状态点导航到 hit1 candidate HP 时，HP 详情行、HP marker、HP 曲线 `data-track-focused = true`。
- 切换同帧韧性状态点后，焦点转移到 `toughnessDamageCandidate`，HP 曲线 `data-track-focused = false`。
- 回到 applied 点后，不再存在 focused 候选详情行。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过。
- `npm run test -- --run`：通过。

下一阶段仍为 5-8CA：落地标准生成层合同最小版本。

## 108. 阶段 5-8CA：threeValueGenerationLayer 标准生成层合同

阶段 5-8CA 在 `simulationResult` 顶层新增内部 projection：

```js
threeValueGenerationLayer
```

该结构是运行时和 UI 后续消费的标准生成层输入，不是项目保存 schema；当前不需要导入导出迁移。

### 108.1 顶层结构

```js
{
  schemaVersion: 1,
  sourceKind: 'azpr-standard-three-value-generation-layer',
  status: 'standard-three-value-generation-layer-ready',
  contract: {
    name: 'Action -> Hit -> ThreeValueDelta',
    version: 1,
    frameRate: 60,
    frameMs: 16.666667,
    deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
    requiredDeltaFields: [
      'actionId',
      'hitKey',
      'frameIndex',
      'timeMs',
      'trackKey',
      'layerKey',
      'delta',
      'sourceKind',
      'sourceIds',
      'confidence'
    ]
  },
  inputSources: [
    'threeValueCurveFramework.stateCurves.applied',
    'threeValueCurveFramework.stateCurves.candidate',
    'threeValueCurveFramework.stateCurves.sampled',
    'threeValueCurveFramework.stateCurves.placeholder'
  ],
  actions: [],
  deltas: [],
  summary: {},
  applied: false
}
```

### 108.2 ThreeValueDelta

`threeValueGenerationLayer.deltas[]` 是扁平运行时输入。每条 delta 当前包含：

```js
{
  id,
  actionId,
  actionName,
  actionType,
  actorId,
  actorName,
  hitKey,
  hitIndex,
  hitSkillId,
  frameIndex,
  frameLabel,
  timeMs,
  trackKey,
  trackLabel,
  layerKey,
  layerLabel,
  valueUnit,
  delta,
  hpDelta,
  toughnessDelta,
  energyDelta,
  sourceKind,
  sourceIds,
  confidence,
  sourceStatus,
  resultStatus,
  candidateCount,
  sequenceIndex,
  applied,
  replaceable
}
```

`hpDelta / toughnessDelta / energyDelta` 中只有当前 `trackKey` 对应字段有值，其他字段为 `null`。

### 108.3 Action / Hit 分组

`threeValueGenerationLayer.actions[]` 按动作聚合：

```js
{
  actionId,
  actionName,
  actionType,
  actorId,
  actorName,
  startMs,
  hitCount,
  deltaCount,
  hits: []
}
```

`hits[]` 按同一动作内的 `hitKey + frameIndex + timeMs` 聚合：

```js
{
  hitKey,
  hitIndex,
  hitSkillId,
  frameIndex,
  frameLabel,
  timeMs,
  layerKeys,
  trackKeys,
  deltaCount,
  deltas
}
```

这样同一 hit 的 HP / 韧性 / 能量候选可以作为一组输入被运行时或详情面板消费。

### 108.4 Summary

`summary.threeValueGenerationLayerSummary` 指向 `threeValueGenerationLayer.summary`，字段包括：

```js
{
  contractName: 'Action -> Hit -> ThreeValueDelta',
  actionCount,
  actionWithDeltaCount,
  hitCount,
  deltaCount,
  trackCount,
  appliedDeltaCount,
  candidateDeltaCount,
  sampledDeltaCount,
  placeholderDeltaCount,
  replaceableDeltaCount,
  frameMin,
  frameMax,
  applied: false
}
```

Workbench 分析面板通过该 summary 显示 `生成合同` 摘要。

### 108.5 验证

当前测试覆盖：

- 默认末音样例：`deltaCount = 16`，`hitCount = 6`，`appliedDeltaCount = 1`，`candidateDeltaCount = 15`。
- 默认末音 hit1：同帧聚合 3 条 candidate delta，分别为 HP `2500`、韧性 `7000`、能量 `2700`。
- 寒悠悠普攻样例：`deltaCount = 13`，`hitCount = 5`，`candidateDeltaCount = 12`，召唤目标候选也进入合同。
- RecoverSP 离线样本：`sampledDeltaCount = 1`，采样 delta 为 `selfEnergyChange / sampled / energyDelta = 0.3375`，并保留 `captureSessionId` 与 `elementConfigId`。
- Workbench 渲染 `生成合同 1动作/6命中 · Delta 16 · 候选 15 · 已用 1`。

阶段验收：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。

下一阶段 5-8CB 应让运行时投影优先消费该标准合同，并保持现有 Workbench 可视化不倒退。

## 109. 阶段 5-8CB：threeValueRuntimeProjection 消费生成层合同

阶段 5-8CB 在 `simulationResult` 顶层新增内部 projection：

```js
threeValueRuntimeProjection
```

该结构是运行时消费层结果，不是项目保存 schema；当前不需要导入导出迁移。它的输入来源固定为：

```js
threeValueGenerationLayer.deltas[].applied === true
```

也就是说，`candidate / sampled / placeholder` delta 仍保留在生成层作为可替换来源和诊断依据，默认不进入运行时累计。

### 109.1 顶层结构

```js
{
  schemaVersion: 1,
  sourceKind: 'azpr-runtime-projection-from-three-value-generation-layer',
  status,
  inputContractName: 'Action -> Hit -> ThreeValueDelta',
  appliedOnly: true,
  enemyStateCurve,
  selfEnergyCurveByActor,
  simLog,
  summary,
  applied: true
}
```

### 109.2 enemyStateCurve

`enemyStateCurve` 当前聚合 `enemyHpDamage` 和 `enemyToughnessDamage` 的 applied delta：

```js
{
  sourceKind: 'three-value-generation-layer-applied-enemy-deltas',
  status,
  pointCount,
  frameMin,
  frameMax,
  hpDelta,
  toughnessDelta,
  points,
  applied: true
}
```

`points[]` 是 applied delta 的运行时点位，保留 `sourceDeltaId / actionId / hitKey / frameIndex / timeMs / trackKey / layerKey / hpDelta / toughnessDelta / energyDelta / confidence / sourceIds` 等字段，供后续敌人状态曲线和详情弹层消费。

### 109.3 selfEnergyCurveByActor

`selfEnergyCurveByActor[]` 按项目中的 actor 顺序输出，即使某个角色没有能量变化也保留 0 值：

```js
{
  actorId,
  actorName,
  resource: 'sp',
  delta,
  pointCount,
  points,
  applied: true
}
```

这保持了 `summary.selfEnergyDeltaByActor` 的旧输出形状，同时给后续资源监控曲线留下逐点数据。

### 109.4 simLog

`simLog[]` 当前是一条 applied delta 一条日志的最小版：

```js
{
  eventType: 'THREE_VALUE_DELTA_APPLIED',
  sequenceIndex,
  sourceDeltaId,
  timeMs,
  frameIndex,
  frameLabel,
  actionId,
  actionName,
  actorId,
  actorName,
  hitKey,
  hitIndex,
  trackKey,
  layerKey,
  delta,
  hpDelta,
  toughnessDelta,
  energyDelta,
  confidence,
  applied: true
}
```

后续 UI 层应直接消费该日志，而不是再回头读取 evidence 或候选矩阵。

### 109.5 Summary 与兼容字段

`summary.threeValueRuntimeProjectionSummary` 指向 `threeValueRuntimeProjection.summary`：

```js
{
  inputContractName,
  inputDeltaCount,
  appliedDeltaCount,
  enemyHpDelta,
  enemyToughnessDelta,
  selfEnergyDelta,
  selfEnergyActorCount,
  enemyStatePointCount,
  selfEnergyPointCount,
  simLogCount,
  source: 'threeValueGenerationLayer.applied-deltas',
  appliedOnly: true,
  applied: true
}
```

以下既有 summary 字段现在从 `threeValueRuntimeProjection` 派生：

```js
summary.totalRawDamage
summary.totalProjectedToughnessDamage
summary.totalSelfEnergyDelta
summary.selfEnergyDeltaByActor
```

这让旧 Workbench 指标保持可用，同时把真实运行时来源迁移到标准合同消费层。

### 109.6 验证

当前测试覆盖：

- 默认末音样例：运行时投影 `inputDeltaCount = 16`、`appliedDeltaCount = 1`、`enemyHpDelta = 12461`、`selfEnergyDelta = 0`、`simLogCount = 1`。
- RecoverSP 离线样本：生成层存在 sampled delta，但运行时投影仍只消费 applied delta。
- 寒悠悠 SP 技能样例：运行时投影包含 1 个 self energy point，寒悠悠自身能量变化等于技能 SP 消耗，队友保持 0。
- Workbench 渲染 `运行投影 HP 12,461 · 韧性 0 · 能量 0 · 日志 1`。

阶段验收：

- `npm run test -- --run`：通过，13 个测试文件、109 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CC 应围绕 `threeValueRuntimeProjection` 补 Endaxis 式资源监控、模拟日志和三值详情弹层最小骨架。

## 110. 阶段 5-8CC：Workbench 消费 threeValueRuntimeProjection

阶段 5-8CC 不修改项目保存 schema，也不修改 `threeValueRuntimeProjection` 的模拟结果结构。本阶段新增的是 Workbench UI 消费关系：

```vue
<ResourceMonitorPanel
  :runtime-projection="simulationResult.threeValueRuntimeProjection"
/>

<EventLogPanel
  :runtime-projection="simulationResult.threeValueRuntimeProjection"
/>
```

### 110.1 ResourceMonitorPanel

`ResourceMonitorPanel` 新增 prop：

```js
runtimeProjection
```

新增前端派生：

```js
runtimeSummary = runtimeProjection.summary
runtimeEnemyState = runtimeProjection.enemyStateCurve
runtimeActorEnergyRows = runtimeProjection.selfEnergyCurveByActor
```

新增测试入口：

```html
data-testid="workbench-runtime-resource-monitor"
data-testid="workbench-runtime-enemy-hp-delta"
data-testid="workbench-runtime-enemy-toughness-delta"
data-testid="workbench-runtime-sim-log-count"
data-testid="workbench-runtime-energy-list"
data-testid="workbench-runtime-energy-actor-row"
```

该面板仍保留原有 `resourceTimeline` 事件列表和 `workbench-resource-event-count / workbench-resource-sp-total / workbench-resource-empty` 测试入口。

### 110.2 EventLogPanel

`EventLogPanel` 新增 prop：

```js
runtimeProjection
```

新增前端派生：

```js
runtimeSimLogRows = runtimeProjection.simLog
selectedRuntimeLogIndex
selectedRuntimeLog
```

新增测试入口：

```html
data-testid="workbench-runtime-sim-log"
data-testid="workbench-runtime-sim-log-row"
data-testid="workbench-runtime-sim-log-detail"
```

`runtimeSimLogRows[]` 当前直接消费 5-8CB 的 `simLog[]`。点击或键盘选中一条日志后，详情区显示：

```js
actionName / actionId
hitKey
formatRuntimeDelta(row)
sourceDeltaId
```

### 110.3 验证

当前测试覆盖：

- 默认末音样例显示运行资源监控入口、敌人 HP `12,461`、敌人韧性 `0`、`1 日志`。
- 默认末音样例显示模拟日志入口，日志行文本包含 `普通攻击 · HP 12,461`。
- 默认末音样例的模拟日志详情包含 `action-0001|applied-frame-0-point-0`。
- 切换到有 SP 消耗的技能后，运行时日志数量变为 `2 日志`，角色能量行和模拟日志都包含 `SP -{spCost}`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、35 条测试。
- `npm run test -- --run`：通过，13 个测试文件、109 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CD 应把 runtime sim log 详情升级为可筛选的三值详情弹层或右侧详情面板，并开始接贡献拆分骨架。

## 111. 阶段 5-8CD：runtime sim log 筛选与详情派生

阶段 5-8CD 不修改项目保存 schema。本阶段包含一个 simulation projection 字段增强和一组 Workbench UI 派生字段。

### 111.1 Applied state point 来源增强

`createAppliedStateCurveLayer()` 生成的 applied point 新增字段：

```js
{
  actionType,
  targetId,
  targetName,
  skillId,
  elementConfigIds,
  sourceStatus
}
```

其中 `elementConfigIds` 从 `result.sourceEvidence` 中的 `matchedElementConfigIds / logicElementIds / candidates[].elementConfigId` 归并。该字段会被 `threeValueGenerationLayer.deltas[].sourceIds.elementConfigIds` 继承，再被 runtime point 的 `sourceIds` 暴露给 UI。

### 111.2 EventLogPanel 筛选状态

`EventLogPanel` 新增前端状态：

```js
runtimeTrackFilter // all | enemyHpDamage | enemyToughnessDamage | selfEnergyChange
runtimeActorFilter // all | actorId | system
runtimeActionFilter // all | actionId | system
selectedRuntimeLogIndex
```

新增派生：

```js
runtimePointByDeltaId
runtimeTrackFilterOptions
runtimeActorFilterOptions
runtimeActionFilterOptions
filteredRuntimeSimLogRows
selectedRuntimeLog
selectedRuntimeLogPoint
selectedRuntimeContributionRows
selectedRuntimeSourceRows
```

这些派生只消费：

```js
runtimeProjection.simLog
runtimeProjection.enemyStateCurve.points
runtimeProjection.selfEnergyCurveByActor[].points
```

不会回退读取 evidence 矩阵。

### 111.3 UI 测试入口

新增测试入口：

```html
data-testid="workbench-runtime-sim-log-filter-count"
data-testid="workbench-runtime-sim-log-filters"
data-testid="workbench-runtime-sim-log-track-filter"
data-testid="workbench-runtime-sim-log-actor-filter"
data-testid="workbench-runtime-sim-log-action-filter"
data-testid="workbench-runtime-sim-log-empty"
data-testid="workbench-runtime-sim-log-contribution"
data-testid="workbench-runtime-sim-log-contribution-row"
data-testid="workbench-runtime-sim-log-source"
data-testid="workbench-runtime-sim-log-source-row"
```

### 111.4 验证

当前测试覆盖：

- 默认末音样例的 runtime sim log 过滤计数为 `1/1`。
- 默认末音样例的 track filter 文案为 `全部1 / HP1 / 韧性0 / 能量0`。
- 默认末音样例的贡献详情为 `敌人 HP 12,461 / 敌人韧性 0 / 自身能量 0`。
- 默认末音样例的来源详情包含 `Skill 10900101` 与 `Element 109001081`。
- 切换到有 SP 消耗的技能后，点击 `selfEnergyChange` track filter，日志从 `2/2` 过滤为 `1/2`，详情贡献显示 `自身能量 -{spCost}`，来源详情包含该技能 ID。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、35 条测试。
- `npm run test -- --run`：通过，13 个测试文件、109 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CE 应把 runtime sim log 选中项与时间轴 / 状态点焦点联动，或优先补运行时资源监控的 HP / 韧性 / 能量多曲线图。

## 112. 阶段 5-8CE：runtime sim log 状态点联动

阶段 5-8CE 不修改项目保存 schema。本阶段只增强 simulation projection 字段，并新增 Workbench UI 事件联动。

### 112.1 Generation / runtime projection 字段

`threeValueGenerationLayer.deltas[]` 新增：

```js
{
  stateCurveSequenceIndex,
}
```

语义：保留源 `threeValueCurveFramework.stateCurves` 点在生成 `stateCurvePointId` 时使用的序号。它与 runtime log 的显示序号不同，后者可能按 applied delta 全局或按角色曲线重排。

`threeValueRuntimeProjection.simLog[]` 与 runtime point 新增：

```js
{
  stateCurveSequenceIndex,
}
```

该字段从 generation delta 继承，用于 UI 重新生成同一个 `stateCurvePointId`：

```js
createStateCurvePointId({
  trackKey,
  layerKey,
  point: {
    actionId,
    frameIndex,
    sequenceIndex: stateCurveSequenceIndex,
  },
  pointIndex: stateCurveSequenceIndex,
})
```

### 112.2 EventLogPanel 联动事件

`EventLogPanel` 新增事件：

```js
emit('select-runtime-state-point', stateCurvePointId)
```

触发时机：

- 点击 runtime sim log 行。
- 对 runtime sim log 行按 Enter。
- 对 runtime sim log 行按 Space。

新增派生：

```js
selectedRuntimeStatePointId
```

新增测试入口：

```html
data-testid="workbench-runtime-sim-log-state-point"
```

### 112.3 Workbench 焦点行为

`Workbench` 新增处理函数：

```js
selectRuntimeStatePoint(pointId)
```

行为：

- 复用 `selectStateCurvePoint(pointId)` 更新全局 `selectedStateCurvePointId`。
- 当 `pointId` 非空时，把 `stateCurveFocusMode` 切到 `selected`。
- 时间轴 state marker 和分析面板状态曲线继续消费同一个选中状态，不新增第二套日志专用焦点状态。

### 112.4 验证

当前测试覆盖：

- runtime sim log 详情中的 `状态点` 与时间轴 applied state marker 的 `data-state-point-id` 一致。
- 点击 runtime sim log 行后，状态曲线焦点按钮切到 `选中`。
- 点击 runtime sim log 行后，状态曲线可见点数从 `16` 收窄为 `1`。
- 点击 runtime sim log 行后，对应时间轴 state marker 包含 `selected` 类。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、36 条测试。
- `npm run test -- --run`：通过，13 个测试文件、110 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CF 应把 `ResourceMonitorPanel` 升级为 HP / 韧性 / 自身能量多曲线图，并复用本阶段建立的状态点焦点链路。

## 113. 阶段 5-8CF：runtime resource multi-curve

阶段 5-8CF 不修改项目保存 schema。本阶段新增 Workbench UI 派生结构和共享状态点 ID helper。

### 113.1 共享 runtime 状态点 ID

`src/features/workbench/stateCurvePointIdentity.js` 新增导出：

```js
createRuntimeStateCurvePointId(row, point)
```

输入可以是 `threeValueRuntimeProjection.simLog[]` 行，也可以是 runtime point。函数会按以下优先级恢复源状态曲线序号：

```js
row.stateCurveSequenceIndex
point.stateCurveSequenceIndex
hitKey 中的 -point-{index}
point.sequenceIndex
row.sequenceIndex
0
```

然后复用 `createStateCurvePointId()` 生成同一个 `stateCurvePointId`。`EventLogPanel` 与 `ResourceMonitorPanel` 都应使用该 helper，不要各自拼接 ID。

### 113.2 ResourceMonitorPanel 新增 props / event

`ResourceMonitorPanel` 新增输入：

```js
selectedStateCurvePointId: string
```

新增事件：

```js
emit('select-runtime-state-point', stateCurvePointId)
```

`Workbench` 将该事件接回现有 `selectRuntimeStatePoint()`，继续复用全局 `selectedStateCurvePointId` 和 `stateCurveFocusMode`。

### 113.3 Runtime resource curve 派生结构

`ResourceMonitorPanel` 从 projection 派生曲线序列，不写回 simulation result：

```js
runtimeCurveSourceSeries[]
runtimeCurveDomain
runtimeCurveSeries[]
runtimeCurveZeroY
```

当前序列：

```js
enemy-hp          // trackKey: enemyHpDamage, valueField: hpDelta
enemy-toughness   // trackKey: enemyToughnessDamage, valueField: toughnessDelta
self-energy-*     // trackKey: selfEnergyChange, valueField: energyDelta, per actor
```

每个曲线点包含：

```js
{
  delta,
  cumulative,
  statePointId,
  frameIndex,
  frameLabel,
  x,
  y
}
```

`cumulative` 是 UI 派生累计变化量，不代表敌人剩余 HP / 剩余韧性 / 角色当前能量。

### 113.4 新增测试入口

```html
data-testid="workbench-runtime-resource-chart"
data-testid="workbench-runtime-resource-chart-line"
data-testid="workbench-runtime-resource-chart-point"
data-testid="workbench-runtime-resource-chart-series"
```

曲线点暴露：

```html
data-series-key
data-track-key
data-actor-id
data-frame-label
data-value
data-delta
data-state-point-id
data-selected
```

### 113.5 验证

当前测试覆盖：

- 默认末音样例中，runtime resource chart 存在。
- legend 包含 `enemy-hp / enemy-toughness / self-energy-*` 序列。
- 默认 HP 曲线点的 `data-value` 为 `12461`，且 `data-state-point-id` 与 runtime sim log 的状态点一致。
- 点击曲线点后，状态曲线焦点切到 `选中`，对应时间轴 marker selected。
- 切换到有 SP 消耗的技能后，曲线点包含 `selfEnergyChange`，且 `data-delta` 等于 `-spCost`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、37 条测试。
- `npm run test -- --run`：通过，13 个测试文件、111 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CG 应建立统一的运行时三值选中详情入口，让 runtime sim log、资源曲线点、状态曲线点共享同一份 selected point 详情。

## 114. 阶段 5-8CG：runtime selected detail

阶段 5-8CG 不修改项目保存 schema。本阶段新增 Workbench UI 派生结构和一个详情展示组件。

### 114.1 统一详情派生

新增文件：

```text
src/features/workbench/runtimeSelectedDetail.js
```

主要导出：

```js
createRuntimeSelectedDetail({
  runtimeProjection,
  selectedStateCurvePointId,
})
```

返回值为 `null` 或详情对象：

```js
{
  statePointId,
  sourceDeltaId,
  actionId,
  actionName,
  actorId,
  actorName,
  hitKey,
  hitIndex,
  frameIndex,
  frameLabel,
  timeMs,
  trackKey,
  trackLabel,
  layerKey,
  valueUnit,
  delta,
  cumulative,
  hpDelta,
  toughnessDelta,
  energyDelta,
  status,
  confidence,
  sourceIds,
  contributionRows,
  sourceRows,
  simLogRow,
  point,
}
```

派生规则：

- 只从 `threeValueRuntimeProjection` 读取 applied runtime point 和 `simLog`。
- 使用 `createRuntimeStateCurvePointId()` 匹配 `selectedStateCurvePointId`。
- `delta / cumulative` 按运行时序列重新累计，其中 HP、韧性按敌人曲线累计，能量按角色 SP 曲线累计。
- 不从 evidence 矩阵回读，不写回 simulation result。

### 114.2 新增详情面板

新增组件：

```text
src/features/workbench/RuntimeSelectedDetailPanel.vue
```

输入：

```js
detail: Object | null
```

新增测试入口：

```html
data-testid="workbench-runtime-selected-detail"
data-testid="workbench-runtime-selected-detail-action"
data-testid="workbench-runtime-selected-detail-frame"
data-testid="workbench-runtime-selected-detail-track"
data-testid="workbench-runtime-selected-detail-status"
data-testid="workbench-runtime-selected-detail-delta"
data-testid="workbench-runtime-selected-detail-cumulative"
data-testid="workbench-runtime-selected-detail-contribution-row"
data-testid="workbench-runtime-selected-detail-source-delta"
data-testid="workbench-runtime-selected-detail-state-point"
data-testid="workbench-runtime-selected-detail-source-row"
```

`Workbench` 新增：

```js
runtimeSelectedDetail = computed(() =>
  createRuntimeSelectedDetail({
    runtimeProjection: simulationResult.value.threeValueRuntimeProjection,
    selectedStateCurvePointId: selectedStateCurvePointId.value,
  })
)
```

### 114.3 验证

当前测试覆盖：

- 点击 runtime sim log 行后，统一详情显示同一个状态点 ID、动作、delta、累计、贡献槽位和来源 element。
- 点击 runtime resource chart point 后，统一详情状态点 ID 与曲线点一致，HP 贡献槽激活。
- 点击 applied state curve point 后，统一详情状态点 ID 与状态曲线点一致，来源 delta 与 Skill 来源可见。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CH 应把全局 `selectedStateCurvePointId` 反向同步到 runtime sim log，让从资源曲线或状态曲线选中的点也能高亮对应日志行。

## 115. 阶段 5-8CH：runtime sim log selected sync

阶段 5-8CH 不修改项目保存 schema。本阶段只新增 Workbench UI prop、DOM 标记和筛选提示状态。

### 115.1 EventLogPanel 新增输入

`EventLogPanel` 新增：

```js
selectedStateCurvePointId: string
```

`Workbench` 将全局 `selectedStateCurvePointId` 传入 `EventLogPanel`。

### 115.2 日志行状态点标记

runtime sim log 行新增：

```html
data-state-point-id
```

行选中判断变为：

```js
isRuntimeLogRowSelected(row, index)
```

规则：

- 如果存在外部 `selectedStateCurvePointId`，优先比较日志行 `statePointId`。
- 如果没有外部选中点，保留原来的 `selectedRuntimeLogIndex === index` 行为。

当外部选中点在当前筛选结果内时：

```js
syncSelectedRuntimeLogIndexFromStatePoint(filteredRuntimeSimLogRows)
```

会把内部 `selectedRuntimeLogIndex` 同步到对应行。

### 115.3 筛选隐藏提示

新增派生：

```js
selectedRuntimeLogFilteredOut
```

条件：

- `selectedStateCurvePointId` 对应某条 runtime sim log；
- 但该日志行不在当前 `filteredRuntimeSimLogRows` 内。

新增测试入口：

```html
data-testid="workbench-runtime-sim-log-selection-filtered"
```

文案：

```text
选中三值点不在当前日志筛选内
```

该提示不重置 HP / 韧性 / 能量、actor、action 筛选。

### 115.4 验证

当前测试覆盖：

- 从 runtime resource chart point 选中 HP 点后，对应 runtime sim log 行 `data-selected="true"`。
- 从 applied state curve point 选中 HP 点后，对应 runtime sim log 行 `data-selected="true"`。
- 在 runtime sim log 筛选为 `selfEnergyChange` 时，从资源曲线选中 HP 点，筛选计数仍为 `1/2`，并显示隐藏提示。
- 切回 `全部` 筛选后，HP 日志行恢复高亮。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CI 应让 `EventLogPanel` 的内嵌三值详情消费 `RuntimeSelectedDetail` 派生结果，减少日志详情和右侧详情之间的重复逻辑。

## 116. 阶段 5-8CI：EventLogPanel detail consumes RuntimeSelectedDetail

阶段 5-8CI 不修改项目保存 schema。本阶段只新增 Workbench UI prop 和详情数据源标记。

### 116.1 EventLogPanel 新增输入

`EventLogPanel` 新增：

```js
runtimeSelectedDetail: Object | null
```

`Workbench` 将已有：

```js
runtimeSelectedDetail
```

传入 `EventLogPanel`。

### 116.2 日志详情数据源

runtime sim log 内嵌详情新增：

```html
data-detail-source="runtime-selected-detail | runtime-log-fallback"
```

规则：

- 当 `runtimeSelectedDetail.statePointId === selectedRuntimeStatePointId` 时，使用 `runtime-selected-detail`。
- 否则使用 `runtime-log-fallback`。

优先来自统一详情的字段：

```js
actionName / actionId
hitKey
trackLabel / trackKey
actorName / actorId
status
sourceDeltaId
statePointId
contributionRows
sourceRows
```

fallback 仍使用当前 `selectedRuntimeLog` 和 `selectedRuntimeLogPoint`。

### 116.3 验证

当前测试覆盖：

- 默认初始状态下，日志详情为 `data-detail-source="runtime-log-fallback"`。
- 点击 runtime sim log 行后，日志详情切到 `data-detail-source="runtime-selected-detail"`。
- 点击 runtime resource chart point 后，日志详情也使用 `runtime-selected-detail`。
- SP 技能场景中，筛选隐藏 HP 点再切回 `全部` 后，目标 HP 日志高亮，日志详情使用 `runtime-selected-detail`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CJ 应给 runtime sim log 的“选中点不在当前筛选内”提示增加一键显示当前选中日志的操作。

## 117. 阶段 5-8CJ：runtime sim log show selected action

阶段 5-8CJ 不修改项目保存 schema。本阶段只新增 Workbench UI 操作和筛选状态调整函数。

### 117.1 EventLogPanel 新增操作

在 `selectedRuntimeLogFilteredOut` 为 `true` 时，提示区新增按钮：

```html
data-testid="workbench-runtime-sim-log-show-selected"
```

按钮文案：

```text
显示日志
```

点击后调用：

```js
showSelectedRuntimeLog()
```

### 117.2 筛选调整规则

`showSelectedRuntimeLog()` 查找当前 `selectedStateCurvePointId` 对应的 runtime sim log 行。

调整规则：

- `runtimeTrackFilter` 为 `all` 或已等于目标 `trackKey` 时不改；否则改为目标 `trackKey`。
- `runtimeActorFilter` 为 `all` 或已等于目标 `actorId` 时不改；否则改为目标 `actorId`，缺省为 `system`。
- `runtimeActionFilter` 为 `all` 或已等于目标 `actionId` 时不改；否则改为目标 `actionId`，缺省为 `system`。

该操作不修改：

- `selectedStateCurvePointId`
- 时间轴选择
- 动作选择
- 项目保存 schema

### 117.3 验证

当前测试覆盖：

- SP 技能场景中，runtime sim log 筛选为 `selfEnergyChange` 时，从资源曲线选中 HP 点会显示隐藏提示。
- 点击 `显示日志` 后，筛选计数保持 `1/2`，但 active track filter 切到 `enemyHpDamage`。
- 点击后隐藏提示消失，对应 HP 日志行 `data-selected="true"`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CK 应补运行时三值状态基线，让 HP / 韧性 / 能量除了累计变化量外，开始具备“剩余/当前状态”字段和 UI 标注。

## 118. 阶段 5-8CK：runtime three-value state baselines

阶段 5-8CK 不修改项目保存 schema。本阶段只扩展 `runSimulation()` 返回的运行时投影派生字段，以及 Workbench 的展示字段。

### 118.1 敌人状态曲线新增字段

`threeValueRuntimeProjection.enemyStateCurve` 新增：

```js
baseline: {
  hp: {
    sourceKind: 'scenario-enemy-hp-baseline',
    sourceStatus: 'baseline-derived-from-scenario-enemy-max-hp',
    sourcePath: 'scenario.enemy.stats.maxHp * scenario.enemy.hpMultiplier',
    initialValue,
    baseValue,
    multiplier,
    valueUnit: 'hp',
    applied,
  },
  toughness: {
    sourceKind: 'scenario-enemy-toughness-baseline',
    sourceStatus: 'baseline-pending-azpr-enemy-toughness-state',
    sourcePath: 'pending enemy weak-break/toughness state evidence',
    initialValue: null,
    valueUnit: 'toughness',
    applied: false,
  },
}
```

并新增：

```js
stateMetrics: {
  hp: {
    key: 'hp',
    label: '敌人 HP',
    stateLabel: '剩余',
    initialValue,
    delta,
    rawCurrentValue,
    currentValue,
    overrunValue,
    remainingValue,
    deltaDirection: 'decrease',
    baselineConfirmed,
    baselineStatus,
    stateStatus,
  },
  toughness: {
    key: 'toughness',
    label: '敌人韧性',
    stateLabel: '剩余',
    initialValue: null,
    currentValue: null,
    baselineConfirmed: false,
    baselineStatus: 'baseline-pending-azpr-enemy-toughness-state',
  },
}
```

兼容字段：

```js
hpInitial
hpRemaining
hpBaselineStatus
toughnessInitial
toughnessRemaining
toughnessBaselineStatus
```

HP `currentValue` 按血条语义不小于 0；若累计 delta 超过初始值，差额记录在 `overrunValue`。

### 118.2 自身能量曲线新增字段

`threeValueRuntimeProjection.selfEnergyCurveByActor[]` 新增：

```js
baseline: {
  sourceKind: 'scenario-actor-self-energy-baseline',
  sourceStatus: 'baseline-pending-azpr-initial-self-energy',
  sourcePath: 'pending battle start/current SP evidence',
  initialValue: null,
  maxValue,
  maxValueSourceStatus,
  valueUnit: 'sp',
  applied: false,
}
stateMetric: {
  key: 'selfEnergy',
  label: '自身能量',
  stateLabel: '当前',
  initialValue: null,
  currentValue: null,
  delta,
  deltaDirection: 'increase',
  baselineConfirmed: false,
  baselineStatus: 'baseline-pending-azpr-initial-self-energy',
}
```

当前只读取 `maxSp` 作为上限证据，不把 `maxSp` 当成初始当前 SP。

### 118.3 摘要新增字段

`threeValueRuntimeProjection.summary` 新增：

```js
enemyHpInitial
enemyHpRemaining
enemyHpBaselineStatus
enemyToughnessInitial
enemyToughnessRemaining
enemyToughnessBaselineStatus
selfEnergyBaselineReadyActorCount
```

`summary.selfEnergyDeltaByActor[]` 新增：

```js
currentValue
baselineStatus
```

### 118.4 UI 派生字段

`createRuntimeSelectedDetail()` 现在为选中 runtime point 派生：

```js
stateLabel
stateValue
stateValueStatus
baselineStatus
baselineInitialValue
baselineMaxValue
baselineConfirmed
```

`ResourceMonitorPanel` 新增测试入口：

```html
data-testid="workbench-runtime-enemy-hp-state"
data-testid="workbench-runtime-enemy-toughness-state"
data-testid="workbench-runtime-energy-actor-state"
```

`RuntimeSelectedDetailPanel` 新增：

```html
data-testid="workbench-runtime-selected-detail-state-value"
```

### 118.5 验证

当前测试覆盖：

- 默认迅狼 HP 基线为 `8628`，累计 HP delta 为 `12461`，剩余 HP 为 `0`，`overrunValue` 为 `3833`。
- 敌人韧性基线保持 `baseline-pending-azpr-enemy-toughness-state`。
- 寒悠悠 SP 消耗场景中，自身能量初始/当前值保持 `null`，基线状态为 `baseline-pending-azpr-initial-self-energy`。
- Workbench 资源面板显示 HP `剩余 0`、韧性 `剩余待确认`、角色能量 `当前待确认`。
- 选中 runtime HP 点后，三值详情显示状态值 `0`。

阶段验收：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有既有 Windows 换行提示。

下一阶段 5-8CL 应让 runtime resource chart 支持“累计变化量 / 状态值”两种视图，并把基线来源状态、HP 溢出值放进 tooltip / 详情提示。

## 119. 阶段 5-8CL：runtime resource chart mode projection

阶段 5-8CL 不修改项目保存 schema。本阶段只扩展 Workbench 资源曲线的局部 UI 状态、DOM 测试入口和统一详情派生字段。

### 119.1 曲线模式

`ResourceMonitorPanel` 新增局部 UI 状态：

```js
runtimeCurveMode: 'delta' | 'state'
```

模式含义：

- `delta`：默认模式，沿用累计变化量曲线，`plotValue = cumulative`。
- `state`：状态值模式，使用 `stateMetrics` 派生，HP / 韧性为剩余值，自身能量为当前值。

模式切换入口：

```html
data-testid="workbench-runtime-resource-chart-mode"
data-mode="delta | state"
data-active="true | false"
```

### 119.2 曲线点新增 DOM 字段

runtime resource chart point 新增：

```html
data-curve-mode="delta | state"
data-value="plotValue"
data-cumulative="cumulativeDelta"
data-state-value="stateValue"
data-baseline-status="baselineStatus"
data-overrun="overrunValue"
```

兼容规则：

- `delta` 模式下 `data-value` 仍为累计变化量。
- `state` 模式下 `data-value` 为状态值。
- 基线未知时，状态值模式不绘制该点；图例仍显示待确认。

### 119.3 曲线图例新增 DOM 字段

runtime resource chart series 新增：

```html
data-source-point-count="sourcePointCount"
data-baseline-status="baselineStatus"
data-curve-mode="delta | state"
```

`data-point-count` 在当前模式下表示实际绘制点数量；`data-source-point-count` 表示该轨道来源点数量。

### 119.4 统一详情新增字段

`createRuntimeSelectedDetail()` 新增：

```js
rawStateValue
overrunValue
```

`RuntimeSelectedDetailPanel` 新增显示入口：

```html
data-testid="workbench-runtime-selected-detail-overrun"
data-testid="workbench-runtime-selected-detail-baseline-status"
```

### 119.5 验证

当前测试覆盖：

- 默认 runtime chart 模式为 `delta`，HP 点 `data-value=12461`。
- 切换到 `state` 后，HP 点 `data-value=0`、`data-cumulative=12461`、`data-state-value=0`、`data-overrun=3833`。
- 状态模式图例 HP 行显示 `剩余 0 / 溢出 3,833`。
- 自身能量基线未知时显示 `当前待确认`。
- 选中 runtime HP 点后，统一详情显示状态值 `0`、溢出 `3,833`、基线 `敌人面板`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一阶段 5-8CM 应抽出三值运行时公式适配器框架，让 HP / 韧性 / 自身能量 delta 的产生入口统一成可替换 calculator contract。

## 120. 阶段 5-8CM：three-value calculator contract

阶段 5-8CM 不修改项目保存 schema。本阶段扩展 `threeValueGenerationLayer`、`threeValueRuntimeProjection` 的派生字段。

### 120.1 Generation contract 新增 calculatorContract

`threeValueGenerationLayer.contract` 新增：

```js
calculatorContract: {
  name: 'ThreeValueDeltaCalculator',
  version: 1,
  outputFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
  requiredOutputs: [
    'delta',
    'status',
    'sourceIds',
    'confidence',
    'replaceable',
  ],
  calculatorKeys: [
    'azpr-hp-delta-calculator',
    'azpr-toughness-delta-calculator',
    'azpr-self-energy-delta-calculator',
  ],
  policy,
}
```

### 120.2 Delta 新增 calculator 字段

`threeValueGenerationLayer.deltas[]` 新增：

```js
calculator: {
  key,
  version,
  trackKey,
  outputField,
  kind,
  status,
  delta,
  deltaFieldValue,
  valueUnit,
  sourceKind,
  sourceIds,
  confidence,
  replaceable,
  appliedToRuntime,
  unresolved,
}
calculatorKey
calculatorVersion
calculationKind
calculationStatus
calculationReplaceable
```

语义：

- `replaceable`：沿用 state layer 语义，表示该 delta 所在 layer 是否可被替换。
- `calculationReplaceable`：表示该 calculator 输出是否可被最终 AzPr 公式替换。
- 当前阶段这两个字段可能不同，例如 applied HP delta 的 layer 已应用，但 formula adapter 仍 `calculationReplaceable=true`。

### 120.3 Runtime projection 透传字段

`threeValueRuntimeProjection.enemyStateCurve.points[]`、`selfEnergyCurveByActor[].points[]`、`simLog[]` 透传：

```js
calculator
calculatorKey
calculatorVersion
calculationKind
calculationStatus
calculationReplaceable
```

### 120.4 Summary 新增字段

`threeValueGenerationLayer.summary` 新增：

```js
calculatorCount
calculatorKeys
calculatorReplaceableDeltaCount
calculatorStatuses
calculatorSummary
```

`calculatorSummary` 包含：

```js
contractName
contractVersion
calculatorCount
calculatorKeys
calculatorReplaceableDeltaCount
statuses
outputFields
confidenceLevels
appliedToRuntimeCount
```

### 120.5 验证

当前测试覆盖：

- 默认样本 calculator contract 暴露三条 calculator key。
- 默认样本 `calculatorCount=3`，`calculatorReplaceableDeltaCount=16`。
- 默认 applied HP delta 使用 `azpr-hp-delta-calculator`，`calculationKind=raw-result-preview`，`calculationStatus=raw-hp-projection`。
- 候选 hit-1 的 HP / 韧性 / 自身能量 delta 分别使用三条对应 calculator。
- recover-sp runtime sample 使用 self-energy calculator，`calculationKind=recover-sp-runtime-sample`。
- 寒悠悠显式 SP 消耗使用 self-energy calculator，`calculationKind=explicit-resource-event-or-cost-preview`。

阶段验收：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有既有 Windows 换行提示。

下一阶段 5-8CN 应把 calculator 来源接入 Workbench 统一三值详情和 runtime sim log 详情。

## 121. 阶段 5-8CN：calculator source detail rows

阶段 5-8CN 不修改项目保存 schema。本阶段只扩展 Workbench 的运行时详情派生字段和 DOM 测试入口。

### 121.1 统一详情新增 calculatorRows

`createRuntimeSelectedDetail()` 新增：

```js
calculatorRows: [
  {
    key: 'calculator',
    label: '适配器',
    value,
    rawValue,
  },
  {
    key: 'kind',
    label: '来源',
    value,
    rawValue,
  },
  {
    key: 'replaceable',
    label: '替换',
    value,
    rawValue,
  },
  {
    key: 'status',
    label: '公式',
    value,
    rawValue,
  },
  {
    key: 'unresolved',
    label: '缺口',
    value,
    rawValue,
  },
]
```

`calculatorRows` 从 runtime point 的 `calculator` / `calculatorKey` / `calculationKind` / `calculationStatus` / `calculationReplaceable` 派生；缺失时可从 `simLogRow` 回退。

### 121.2 新增导出 helper

`runtimeSelectedDetail.js` 新增导出：

```js
createRuntimeDetailCalculatorRows(point, simLogRow)
```

用于 `RuntimeSelectedDetailPanel` 和 `EventLogPanel` 共享同一套 calculator 文案。

### 121.3 新增 DOM 测试入口

右侧三值详情新增：

```html
data-testid="workbench-runtime-selected-detail-calculator-row"
data-calculator-key="calculator | kind | replaceable | status | unresolved"
```

runtime sim log 内嵌详情新增：

```html
data-testid="workbench-runtime-sim-log-calculator"
data-testid="workbench-runtime-sim-log-calculator-row"
data-calculator-key="calculator | kind | replaceable | status | unresolved"
```

### 121.4 当前展示文案

默认 HP applied 点当前展示为：

```text
适配器 HP适配器
来源 HP预览
替换 可替换
公式 公式未确认
缺口 最终公式、防御抗性顺序、命中绑定
```

### 121.5 验证

当前测试覆盖：

- 默认 runtime sim log fallback 详情显示 calculator rows。
- 点击 runtime sim log 行后，统一三值详情显示同一套 calculator rows。
- 既有贡献、来源、状态值、基线与 HP 溢出断言继续通过。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一阶段 5-8CO 应把 calculator 定义、状态映射和未确认项整理到独立运行时 adapter 模块，并补 calculator 诊断摘要入口。

## 122. 阶段 5-8CO：three-value calculator adapter module

阶段 5-8CO 不修改项目保存 schema。本阶段整理 projection/runtime 派生结构和 adapter 模块边界。

### 122.1 新增 adapter 模块

新增：

```js
src/simulation/threeValueCalculatorAdapters.js
```

导出：

```js
THREE_VALUE_CALCULATOR_DEFINITIONS
getThreeValueCalculatorKeys()
createThreeValueCalculatorResult(args)
summarizeThreeValueCalculators(deltas)
createThreeValueCalculatorDisplayRows(point, simLogRow)
formatThreeValueCalculatorKey(calculatorKey, trackKey)
formatThreeValueCalculationKind(kind, trackKey)
formatThreeValueCalculationStatus(status)
formatThreeValueUnresolvedItems(items)
```

其中 calculator 定义仍为：

```text
azpr-hp-delta-calculator
azpr-toughness-delta-calculator
azpr-self-energy-delta-calculator
```

### 122.2 runtime projection summary 新增诊断字段

`threeValueRuntimeProjection.summary` 新增：

```js
calculatorCount
calculatorKeys
calculatorReplaceableDeltaCount
calculatorStatuses
calculatorSummary
```

字段语义与 generation layer summary 保持一致，但统计范围只包含 runtime projection 实际消费的 applied delta。

`calculatorSummary` 结构继续沿用：

```js
{
  contractName,
  contractVersion,
  calculatorCount,
  calculatorKeys,
  calculatorReplaceableDeltaCount,
  statuses,
  outputFields,
  confidenceLevels,
  appliedToRuntimeCount,
}
```

### 122.3 UI 派生字段复用

`runtimeSelectedDetail.js` 的：

```js
createRuntimeDetailCalculatorRows(point, simLogRow)
```

继续保留对外接口，但内部改为调用：

```js
createThreeValueCalculatorDisplayRows(point, simLogRow)
```

因此 Workbench 右侧三值详情和 runtime sim log 详情的 DOM 结构与保存 schema 均不变。

### 122.4 验证

当前测试覆盖：

- 默认样本 runtime summary 只统计 applied HP calculator。
- recover-sp sample 场景 generation 层仍保留 sampled self-energy calculator，runtime 层仍只统计 applied HP calculator。
- 寒悠悠显式 SP 消耗场景 runtime summary 同时统计 HP calculator 和 self-energy calculator。
- Workbench calculator rows 文案保持原行为。

阶段验收：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CP 应建立 Workbench 全局 calculator 诊断入口，把 generation/runtime 两层的 adapter 状态、状态分布和缺口集中展示。

## 123. 阶段 5-8CP：calculator diagnostics summary

阶段 5-8CP 不修改项目保存 schema。本阶段扩展 `calculatorSummary` 派生字段，并在 Workbench 中新增只读诊断入口。

### 123.1 calculatorSummary 新增统计字段

`summarizeThreeValueCalculators(deltas)` 现在额外输出：

```js
outputCount
calculatorKeyCounts
kindCounts
statusCounts
unresolvedItemCounts
layerCounts
trackCounts
```

其中 `calculatorKeyCounts[]` 的行结构为：

```js
{
  key,
  count,
  trackKeys,
  kinds,
  statuses,
  outputFields,
  unresolvedItems,
  replaceableCount,
  appliedToRuntimeCount,
}
```

通用计数行结构为：

```js
{
  kind | status | item | layerKey | trackKey,
  count,
}
```

这些字段同时出现在：

```js
threeValueGenerationLayer.summary.calculatorSummary
threeValueRuntimeProjection.summary.calculatorSummary
summary.threeValueGenerationLayerSummary.calculatorSummary
summary.threeValueRuntimeProjectionSummary.calculatorSummary
```

### 123.2 缺口排序规则

`unresolvedItemCounts` 先按 `count` 降序排序；同数时按固定缺口优先级排序：

```text
final-azpr-formula-confirmation
enemy-defense-resistance-critical-order
hit-to-damage-element-binding
weak-break-damage-rate-unit-scale
target-toughness-state-baseline
initial-current-sp-baseline
recover-sp-owner-share-and-throttle
```

这样默认 runtime HP 点会稳定显示为“最终公式、防御抗性顺序、命中绑定”。

### 123.3 Workbench 新增诊断 DOM

`AnalysisPanel` 在“三值来源”区域新增：

```html
data-testid="workbench-three-value-calculator-diagnostics"
data-testid="workbench-three-value-calculator-diagnostic-row"
data-calculator-scope="generation | runtime"
```

默认样本当前显示两行：

```text
生成适配器 3类/16条 · 可替换 16
运行适配器 1类/1条 · 可替换 1
```

### 123.4 验证

当前测试覆盖：

- generation `calculatorSummary.outputCount = 16`。
- 默认样本 HP / 韧性 / 自身能量 calculator 分布为 `6 / 5 / 5`。
- 默认样本候选 delta 的状态汇总为 `per-hit-candidate-fields-found-formula-unapplied = 15`。
- Workbench 全局诊断行稳定显示 generation/runtime 两层摘要、来源分布、状态分布和缺口分布。

阶段验收：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CQ 应把全局 calculator 诊断入口与现有三值曲线/日志筛选轻量联动。

## 124. 阶段 5-8CQ：calculator diagnostics focus bridge

阶段 5-8CQ 不修改项目保存 schema。本阶段新增 Workbench 内部 UI 状态与组件事件，用于把 calculator 诊断摘要联动到已有三值曲线和 runtime sim log 筛选。

### 124.1 AnalysisPanel 新增交互事件

`AnalysisPanel` 新增 prop：

```js
calculatorDiagnosticScope: String
```

calculator 诊断行新增：

```html
data-active="true | false"
```

并在点击时发出：

```js
focus-three-value-calculator-scope(scope)
```

其中 `scope` 当前为：

```text
generation
runtime
```

### 124.2 Workbench 新增内部状态

`Workbench.vue` 新增内部状态：

```js
calculatorDiagnosticScope
calculatorDiagnosticFocus
```

`calculatorDiagnosticFocus` 当前结构：

```js
{
  scope,
  sequence,
}
```

`sequence` 用于让子组件识别重复点击同一 scope 的外部 focus 请求。

### 124.3 scope 联动规则

点击 `generation`：

```js
stateCurveLayerFilters = {
  applied: false,
  candidate: true,
  sampled: true,
  placeholder: true,
}
stateCurveTrackFilters = {}
selectedStateCurvePointId = ''
stateCurveFocusMode = 'all'
```

点击 `runtime`：

```js
stateCurveLayerFilters = {
  applied: true,
  candidate: false,
  sampled: false,
  placeholder: false,
}
stateCurveTrackFilters = {}
selectedStateCurvePointId = first runtime sim log state point id
stateCurveFocusMode = selectedStateCurvePointId ? 'selected' : 'all'
```

### 124.4 EventLogPanel 外部 focus

`EventLogPanel` 新增 prop：

```js
calculatorDiagnosticFocus: Object | null
```

当 `calculatorDiagnosticFocus.scope === 'runtime'` 且 `sequence` 变化时：

```js
runtimeTrackFilter = 'all'
runtimeActorFilter = 'all'
runtimeActionFilter = 'all'
selectedRuntimeLogIndex = 0
```

### 124.5 验证

当前测试覆盖：

- 点击 generation calculator 诊断行后，`applied` 层关闭、`candidate` 层开启，默认样本状态曲线可见点为 15。
- 先把 runtime sim log 手动筛到能量导致 `0/1`，再点击 runtime calculator 诊断行，会恢复为 `1/1` 且轨道筛选为全部。
- 点击 runtime calculator 诊断行后，状态曲线进入 selected focus。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CR 应把三值曲线和模拟日志的当前视角反馈做得更清楚，补状态标签和空状态解释。

## 125. 阶段 5-8CR：three-value view feedback labels

阶段 5-8CR 不修改项目保存 schema。本阶段新增 Workbench 只读 UI 派生标签，用来解释当前三值曲线和模拟日志处于什么视角。

### 125.1 状态曲线视角摘要

`AnalysisPanel` 新增 DOM：

```html
data-testid="workbench-state-curve-view-summary"
data-calculator-scope="all | generation | runtime"
```

显示结构：

```text
{视角标签}{可见点/总点}点{当前层级} · {当前轨道} · {focus模式}
```

默认样本示例：

```text
全部视角16/16点已用/候选 · 全部轨道 · 全部三值点
生成视角15/16点候选/采样/占位 · 全部轨道 · 全部三值点
运行视角1/16点已用 · 全部轨道 · 选中三值点
```

### 125.2 模拟日志筛选摘要

`EventLogPanel` 新增 DOM：

```html
data-testid="workbench-runtime-sim-log-filter-summary"
data-calculator-scope="manual | runtime"
```

显示结构：

```text
{视角标签}{可见日志/总日志}条{轨道筛选} · {角色筛选} · {动作筛选}
```

默认样本示例：

```text
日志筛选1/1条全部 · 全部角色 · 全部动作
日志筛选0/1条能量 · 全部角色 · 全部动作
运行视角1/1条全部 · 全部角色 · 全部动作
```

### 125.3 验证

当前测试覆盖：

- 初始状态曲线视角摘要。
- 初始 runtime sim log 筛选摘要。
- generation calculator 诊断联动后的状态曲线视角摘要。
- 手动筛到能量后的 runtime sim log 空筛选摘要。
- runtime calculator 诊断联动后的状态曲线和 runtime sim log 视角摘要。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CS 应继续把 candidate/sample/applied 的参与范围说明清楚，减少用户把候选诊断误读为已应用结果的风险。

## 126. 阶段 5-8CS：three-value layer participation labels

阶段 5-8CS 不修改项目保存 schema。本阶段新增 Workbench 状态曲线的只读参与范围说明。

### 126.1 Layer role metadata

`AnalysisPanel` 内部 `STATE_CURVE_LAYER_OPTIONS` 新增 UI 派生字段：

```js
roleLabel
participationLabel
pointParticipationLabel
```

当前语义：

```text
applied     已应用    进曲线/日志    参与当前三值曲线和模拟日志
candidate   候选诊断  不进结果       候选诊断，不参与当前结果
sampled     采样诊断  不进结果       采样诊断，不参与当前结果
placeholder 缺口占位  不进结果       缺口占位，不参与当前结果
```

### 126.2 新增 DOM / attribute

状态曲线层级开关新增：

```html
data-testid="workbench-state-curve-layer-role"
```

状态曲线点新增：

```html
data-participation="已应用 | 候选诊断 | 采样诊断 | 缺口占位"
data-testid="workbench-state-curve-point-participation"
```

### 126.3 验证

当前测试覆盖：

- 默认样本四个层级开关显示 `进曲线/日志`、`不进结果`。
- 默认 applied HP 点显示 `参与当前三值曲线和模拟日志`。
- 默认 candidate HP 点显示 `候选诊断，不参与当前结果`。
- sampled fixture 显示 `采样诊断，不参与当前结果`。
- placeholder fixture 显示 `缺口占位，不参与当前结果`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CT 应把 runtime applied 三值点与 actionResultTimeline 动作级三值结果继续对齐，强化 delta 来源追踪。

## 127. 阶段 5-8CT：action result runtime point locator

阶段 5-8CT 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段新增 Workbench 前端派生定位关系，让动作级三值结果可以定位到 runtime applied 状态点和模拟日志。

### 127.1 AnalysisPanel 新增输入

`AnalysisPanel` 新增 prop：

```js
runtimeProjection
```

该 prop 只读消费：

```js
runtimeProjection.simLog[]
runtimeProjection.enemyStateCurve.points[]
runtimeProjection.selfEnergyCurveByActor[].points[]
```

用于按 `actionId` 建立动作结果到 runtime applied delta 的派生索引。

### 127.2 动作结果行新增派生 DOM

`workbench-action-result-source-row` 新增：

```html
data-action-id
data-has-runtime-trace
data-runtime-state-point-id
data-selected
data-source-delta-ids
```

并新增只读摘要：

```html
data-testid="workbench-action-result-runtime-trace"
```

默认样本当前显示：

```text
定位 1条运行结果 · HP 12,461 · Delta action-0001|applied-frame-0-point-0
```

### 127.3 Workbench / EventLogPanel 新增定位事件

`AnalysisPanel` 点击动作结果行时发出：

```js
select-runtime-state-point(statePointId)
```

`Workbench` 接收后：

```js
stateCurveLayerFilters = { applied: true, candidate: false, sampled: false, placeholder: false }
stateCurveTrackFilters = {}
stateCurveFocusMode = 'selected'
calculatorDiagnosticScope = 'runtime'
runtimeLogFocus = { source: 'action-result', statePointId, sequence }
```

`EventLogPanel` 新增 prop：

```js
runtimeLogFocus
```

当 `runtimeLogFocus.source === 'action-result'` 时，模拟日志筛选恢复为全部，并定位到相同 `statePointId` 对应的 runtime log。

### 127.4 验证

当前测试覆盖：

- 默认动作结果行携带 applied HP 状态点 ID 和 source delta ID。
- 动作结果行显示 runtime trace 摘要。
- 当模拟日志被筛到能量导致 `0/1` 后，点击动作结果行会恢复日志为 `1/1`。
- 状态曲线切到 `运行视角 1/16点 已用 · 全部轨道 · 选中三值点`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一阶段 5-8CU 应从结果定位继续推进到动作级贡献拆分面板入口，让用户能在不追最终公式的前提下看到 HP / 韧性 / 能量三条当前贡献。

## 128. 阶段 5-8CU：action contribution breakdown entry

阶段 5-8CU 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段新增 Workbench 前端派生贡献面板，来源仍是 `threeValueRuntimeProjection` 的 applied runtime delta。

### 128.1 贡献面板显示条件

`AnalysisPanel` 新增内部派生：

```js
selectedActionContribution
```

当 `selectedStateCurvePointId` 能在 `runtimeTraceByActionId` 中找到对应动作时显示贡献面板；选中 candidate / sampled / placeholder 诊断点时不会伪造动作贡献。

### 128.2 新增 DOM

新增面板：

```html
data-testid="workbench-action-contribution-panel"
data-action-id
```

新增贡献行：

```html
data-testid="workbench-action-contribution-row"
data-track-key="enemyHpDamage | enemyToughnessDamage | selfEnergyChange"
data-active="true | false"
data-count
data-delta
data-state-point-id
```

三条固定轨道为：

```text
敌人 HP
敌人韧性
自身能量
```

### 128.3 当前汇总规则

每条贡献行只汇总当前动作下 runtime applied delta：

```js
enemyHpDamage -> sum(row.hpDelta)
enemyToughnessDamage -> sum(row.toughnessDelta)
selfEnergyChange -> sum(row.energyDelta)
```

没有 applied delta 的轨道显示 `0` 和 `暂无已应用结果`。

默认样本当前显示：

```text
敌人 HP 12,461 已应用 1条 · action-0001|applied-frame-0-point-0
敌人韧性 0 暂无已应用结果
自身能量 0 暂无已应用结果
```

### 128.4 验证

当前测试覆盖：

- 点击动作结果定位 runtime applied 点后显示动作贡献拆分面板。
- 默认 `action-0001` 面板包含 HP / 韧性 / 能量三条贡献。
- HP 行携带 `data-count=1`、`data-delta=12461` 和 source delta 短 ID。
- 韧性/能量行在没有 applied delta 时显示 0 和暂无已应用结果。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一阶段 5-8CV 应把动作贡献拆分和右侧三值详情/模拟日志详情继续收束，形成更稳定的 Endaxis 式贡献详情入口。

## 129. 阶段 5-8CV：contribution breakdown detail focus

阶段 5-8CV 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段只新增 Workbench 前端事件来源和日志筛选摘要，让动作贡献拆分、右侧三值详情和模拟日志详情使用同一个 runtime state point。

### 129.1 AnalysisPanel 新增事件

动作贡献行点击时不再复用普通 runtime 选择事件，而是发出：

```js
select-action-contribution-point(statePointId)
```

该事件用于表达“从动作贡献拆分入口定位到 runtime point”。

### 129.2 Workbench runtimeLogFocus 来源

`runtimeLogFocus.source` 当前可见值扩展为：

```text
action-result
action-contribution
```

两种来源都会让 Workbench：

```js
stateCurveLayerFilters = { applied: true, candidate: false, sampled: false, placeholder: false }
stateCurveTrackFilters = {}
stateCurveFocusMode = 'selected'
calculatorDiagnosticScope = 'runtime'
```

区别只在于日志筛选摘要来源标签。

### 129.3 EventLogPanel 新增摘要来源

`workbench-runtime-sim-log-filter-summary` 的 `data-calculator-scope` 现在可见：

```text
manual
runtime
action-result
action-contribution
```

当来源为 `action-contribution` 时显示：

```text
贡献定位 1/1条 全部 · 全部角色 · 全部动作
```

### 129.4 贡献行文案

当前选中的贡献行会在 meta 中显示：

```text
详情已同步 · 已应用 1条 · action-0001|applied-frame-0-point-0
```

该文案表示动作贡献拆分、右侧三值详情和模拟日志详情正在消费同一个 runtime state point。

### 129.5 验证

当前测试覆盖：

- 点击 HP 贡献行后，日志筛选摘要切换为 `贡献定位`。
- `RuntimeSelectedDetailPanel` 的状态点等于贡献行目标状态点。
- `EventLogPanel` 的日志状态点等于贡献行目标状态点。
- 日志详情来源为 `runtime-selected-detail`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一阶段 5-8CW 应继续把贡献拆分入口做成更完整的贡献详情区域，优先整合来源、适配器和状态点摘要，不引入最终公式。

## 130. 阶段 5-8CW：inline contribution detail summary

阶段 5-8CW 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段新增 `AnalysisPanel` 内的前端派生贡献详情摘要。

### 130.1 新增派生结构

`selectedActionContribution` 新增：

```js
detail: {
  trackKey,
  label,
  statePointId,
  rows: [
    { key, label, value, rawValue? }
  ],
}
```

`detail` 来源于当前选中贡献行对应的 runtime applied delta，优先匹配 `selectedStateCurvePointId`。

### 130.2 新增 DOM

新增详情容器：

```html
data-testid="workbench-action-contribution-detail"
data-track-key
data-state-point-id
```

新增详情行：

```html
data-testid="workbench-action-contribution-detail-row"
data-detail-key="statePoint | sourceDelta | sourceIds | calculator | kind | status | unresolved"
```

### 130.3 当前字段

默认 HP 贡献详情当前展示：

```text
状态点: <runtime state point id>
Delta: action-0001|applied-frame-0-point-0
来源: Skill 10900101 / Element 109001081
适配器: HP适配器
来源类型: HP预览
公式状态: 公式未确认
缺口: 最终公式、防御抗性顺序、命中绑定
```

缺口字段从 `calculator.unresolved` 派生，和统一三值详情/日志详情保持一致。

### 130.4 验证

当前测试覆盖：

- 贡献详情容器 track/state point 与当前 HP 贡献一致。
- `statePoint` / `sourceDelta` / `sourceIds` / `calculator` / `kind` / `status` / `unresolved` 详情行显示正确。
- `unresolved` 行包含最终公式、防御抗性顺序、命中绑定。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一阶段 5-8CX 应把贡献详情与 runtime resource curve / timeline marker 的焦点联动继续收束。

## 131. 阶段 5-8CX：contribution focus source on resource and timeline markers

阶段 5-8CX 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段新增 Workbench 前端焦点来源派生字段。

### 131.1 Workbench 新增派生状态

新增：

```js
runtimeFocusSource
```

派生规则：

```js
runtimeLogFocus.statePointId === selectedStateCurvePointId
  ? runtimeLogFocus.source
  : ''
```

当前来源值继续使用：

```text
action-result
action-contribution
```

普通 `selectRuntimeStatePoint()` 会清空 `runtimeLogFocus.source`，避免手动点击资源曲线或日志时保留旧来源。

### 131.2 ResourceMonitorPanel 新增 prop / DOM

新增 prop：

```js
runtimeFocusSource: String
```

`workbench-runtime-resource-chart-point` 新增：

```html
data-runtime-focus-source
```

只有当该点是当前 `selectedStateCurvePointId` 时写入来源，否则为空字符串。

### 131.3 TimelineGridPreview 新增 prop / DOM

新增 prop：

```js
runtimeFocusSource: String
```

`workbench-timeline-state-curve-marker` 新增：

```html
data-runtime-focus-source
```

同样只在 marker 对应当前选中 runtime state point 时写入来源。

### 131.4 验证

当前测试覆盖：

- 点击 HP 贡献行后，runtime resource chart point 的 `data-selected="true"`。
- 同一曲线点的 `data-runtime-focus-source="action-contribution"`。
- 对应 timeline marker 带 `selected` class。
- 同一 marker 的 `data-runtime-focus-source="action-contribution"`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一阶段 5-8CY 应继续收束分析面板里的动作结果、贡献拆分和三值详情布局，减少跨面板跳读。

## 132. 阶段 5-8CY：inline runtime result detail in AnalysisPanel

阶段 5-8CY 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段只把已有 `runtimeSelectedDetail` 派生结果接入 `AnalysisPanel`，用于主流程内的紧凑结果详情展示。

### 132.1 Workbench prop 接线

`Workbench` 向 `AnalysisPanel` 新增传入：

```vue
:runtime-selected-detail="runtimeSelectedDetail"
```

该对象仍由现有 `createRuntimeSelectedDetail()` 生成，来源是 `threeValueRuntimeProjection` 与 `selectedStateCurvePointId`。

### 132.2 AnalysisPanel 新增 prop

新增 prop：

```js
runtimeSelectedDetail: Object | null
```

新增本地派生：

```js
selectedRuntimeResultDetail
```

该派生仅返回当前 prop，不重新计算 runtime point，不改变 `runtimeTraceByActionId`、`selectedActionContribution` 或 state curve 逻辑。

### 132.3 新增 DOM / 测试锚点

`action-contribution-panel` 内新增紧凑结果详情区：

```html
data-testid="workbench-action-result-detail-panel"
data-action-id
data-state-point-id
data-track-key
```

详情行新增：

```html
data-testid="workbench-action-result-detail-row"
data-detail-key="frame|track|delta|cumulative|state|status"
```

当前展示字段全部来自 `runtimeSelectedDetail`：

- `actionName` / `actionId`
- `frameLabel` / `timeMs`
- `trackLabel` / `trackKey`
- `delta`
- `cumulative`
- `stateLabel` / `stateValue`
- `status`
- `sourceDeltaId`

### 132.4 验证

当前测试覆盖：

- 点击动作结果后，`workbench-action-result-detail-panel` 与当前 `appliedStatePointId` 一致。
- 结果详情区的 `data-action-id="action-0001"`、`data-track-key="enemyHpDamage"`。
- 默认 HP 样本显示 `Delta12,461`、`累计12,461`、`剩余0`、`状态raw-hp-projection`。
- 该区域与动作贡献拆分、右侧三值详情和模拟日志详情共用同一个 runtime state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8CZ 应继续贴近 Endaxis 主流程，优先改善结果定位后的动作编辑闭环。

## 133. 阶段 5-8CZ：action result focus selects source action

阶段 5-8CZ 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段只新增 Workbench 前端事件，让动作结果定位同时同步源动作选择。

### 133.1 AnalysisPanel 新增事件

新增 emit：

```js
select-action-result
```

点击 `workbench-action-result-source-row` 时，`selectActionResultRuntimePoint(entry)` 不再只发出 state point，而是发出：

```js
{
  actionId: trace.actionId,
  statePointId: trace.firstStatePointId,
}
```

`select-runtime-state-point` 事件仍保留在声明中，避免影响组件未来复用；本阶段动作结果行走新事件。

### 133.2 Workbench 新增处理函数

新增：

```js
selectActionResult({ actionId, statePointId })
```

处理顺序：

1. 若 `actionId` 存在于 `actionDrafts`，先调用既有 `selectAction(actionId)`。
2. 再调用 `selectActionResultRuntimePoint(statePointId)`，沿用 `action-result` runtime 聚焦链路。

因此结果定位会同步：

- `selectedActionId`
- 时间轴动作块 selected class
- `PropertiesPanel.selectedAction`
- runtime selected state point
- runtime sim log `action-result` 焦点来源

### 133.3 验证

当前测试覆盖：

- 新建等待动作后，时间轴 `action-0002` 为选中，属性面板显示等待动作。
- 点击 `action-0001` 动作结果后，时间轴选中回到 `action-0001`。
- `action-0002` 不再选中。
- 属性面板回到技能动作编辑态，`workbench-level-input` 出现，`workbench-start-input` 回到 `0`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DA 应继续完善 Endaxis 式编辑闭环，优先让动作编辑后的结果区反馈更清楚。

## 134. 阶段 5-8DA：current action marker on result rows

阶段 5-8DA 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段只把 Workbench 当前 `selectedActionId` 作为前端派生状态传入 `AnalysisPanel`，用于结果区标记当前编辑动作。

### 134.1 AnalysisPanel 新增 prop

新增：

```js
selectedActionId: String
```

由 `Workbench` 传入：

```vue
:selected-action-id="selectedActionId"
```

该字段来自既有工作台状态，不新增保存字段。

### 134.2 动作结果行新增 DOM 状态

`workbench-action-result-source-row` 新增：

```html
data-current-action
```

当 `entry.actionId === selectedActionId` 时：

- `data-current-action="true"`
- 追加 `current-action` class
- 显示 `workbench-action-result-current-action` 标签，文案为 `正在编辑`

### 134.3 结果详情区新增 DOM 状态

`workbench-action-result-detail-panel` 新增：

```html
data-current-action
```

当 `runtimeSelectedDetail.actionId === selectedActionId` 时：

- `data-current-action="true"`
- 标题摘要从 `Delta ...` 变为 `正在编辑 · Delta ...`

### 134.4 验证

当前测试覆盖：

- 选中等待动作 `action-0002` 时，`action-0001` 的结果行 `data-current-action="false"`。
- 点击 `action-0001` 动作结果后，结果行 `data-current-action="true"` 并显示 `正在编辑`。
- 结果详情区 `data-current-action="true"` 且文本包含 `正在编辑`。
- 时间轴和属性面板仍同步选回 `action-0001`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DB 应继续改善动作编辑后的结果反馈，优先在结果详情或动作结果行展示草稿变更状态。

## 135. 阶段 5-8DB：draft status on result rows

阶段 5-8DB 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段只把 Workbench 既有 `draftStatus` 作为前端派生状态传入 `AnalysisPanel`，用于结果区显示草稿状态。

### 135.1 AnalysisPanel 新增 prop

新增：

```js
draftStatus: String
```

由 `Workbench` 传入：

```vue
:draft-status="draftStatus"
```

该字段来自既有工作台状态，不新增保存字段。

### 135.2 草稿状态归一化

新增派生：

```js
draftResultStatus
```

当前映射：

```text
有未保存改动 -> dirty / 草稿已变更 / dirty=true
已保存草稿 -> saved / 草稿已保存 / dirty=false
已恢复草稿 -> restored / 草稿已恢复 / dirty=false
已重置草稿 -> reset / 草稿已重置 / dirty=false
草稿不可用 -> unavailable / 草稿不可用 / dirty=false
其他 -> unsaved / 未保存草稿 / dirty=true
```

### 135.3 动作结果行新增 DOM 状态

`workbench-action-result-source-row` 新增：

```html
data-draft-status
data-draft-dirty
```

当前编辑动作结果行额外显示：

```html
data-testid="workbench-action-result-draft-status"
```

文案来自 `draftResultStatus.resultLabel`。

### 135.4 结果详情区新增 DOM 状态

`workbench-action-result-detail-panel` 新增：

```html
data-draft-status
data-draft-dirty
```

当详情对应当前编辑动作时，标题摘要格式为：

```text
正在编辑 · {草稿状态} · Delta ...
```

### 135.5 验证

当前测试覆盖：

- 新建等待动作后，`action-0001` 结果行 `data-draft-status="dirty"`、`data-draft-dirty="true"`。
- 点击 `action-0001` 动作结果后，当前编辑结果行显示 `草稿已变更`。
- 结果详情区同步 `data-draft-status="dirty"` 并包含 `草稿已变更`。
- 保存草稿后，同一结果行更新为 `data-draft-status="saved"`、`data-draft-dirty="false"`，标签显示 `草稿已保存`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DC 应继续改善动作编辑后的结果反馈，优先让动作字段变更后结果区明确提示“结果已随当前草稿刷新”。

## 136. 阶段 5-8DC：result refresh status on current draft

阶段 5-8DC 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段继续扩展 `draftResultStatus` 前端派生，用于说明当前结果是否已经随工作台草稿刷新。

### 136.1 draftResultStatus 新增字段

`draftResultStatus` 新增：

```js
refreshKey: String
refreshLabel: String
```

当前映射：

```text
dirty -> current-draft / 结果已随当前草稿刷新
saved -> saved-draft / 结果来自已保存草稿
restored -> restored-draft / 结果来自恢复草稿
reset -> reset-draft / 结果来自重置草稿
unavailable -> preview-only / 结果仅当前预览
unsaved -> unsaved-draft / 结果来自未保存草稿
```

### 136.2 动作结果行新增 DOM 状态

`workbench-action-result-source-row` 新增：

```html
data-result-refresh-status
```

当前编辑动作结果行额外显示：

```html
data-testid="workbench-action-result-refresh-status"
```

文案来自 `draftResultStatus.refreshLabel`。

### 136.3 结果详情区新增 DOM 状态

`workbench-action-result-detail-panel` 新增：

```html
data-result-refresh-status
```

当前编辑动作的标题摘要格式从：

```text
正在编辑 · 草稿状态 · Delta ...
```

扩展为：

```text
正在编辑 · 草稿状态 · 结果刷新状态 · Delta ...
```

### 136.4 验证

当前测试覆盖：

- dirty 草稿时，`action-0001` 结果行 `data-result-refresh-status="current-draft"`。
- 当前编辑结果行显示 `结果已随当前草稿刷新`。
- 结果详情区同步 `data-result-refresh-status="current-draft"` 并包含 `结果已随当前草稿刷新`。
- 保存草稿后，同一结果行更新为 `data-result-refresh-status="saved-draft"`，标签显示 `结果来自已保存草稿`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DD 应继续完善编辑反馈链路，优先提供最小字段变更来源入口。

## 137. 阶段 5-8DD：last action edit source on result rows

阶段 5-8DD 不修改项目保存 schema，也不修改 simulation 输出结构。本阶段只新增 Workbench 前端派生状态，用于把最近一次动作字段编辑来源展示到结果区。

### 137.1 Workbench 新增前端状态

新增：

```js
actionEditSource
```

结构：

```js
{
  actionId: string,
  fieldKey: string,
  label: string,
  sequence: number,
}
```

该状态不保存到 `workbench-draft`，恢复/重置草稿时清空。

### 137.2 字段来源映射

当前最小映射：

```text
startMs -> 开始时间变更
level -> 等级变更
actionVariantIndex / damageSegmentIndex -> 动作形态变更
durationMs -> 时长变更
actorCharacterId -> 动作归属变更
skillId -> 技能变更
laneId -> 轨道变更
change -> 资源变化变更
eventType -> 敌人事件变更
targetCharacterId -> 切换目标变更
resource -> 资源类型变更
reason -> 资源原因变更
note -> 备注变更
```

当前记录点：

- `updateAction(patch)`
- `updateActionTime({ actionId, startMs })`
- `updateActionDuration({ actionId, durationMs })`
- `updateActionLane({ actionId, laneId })`

### 137.3 AnalysisPanel 新增 prop

新增：

```js
actionEditSource: Object | null
```

由 `Workbench` 传入：

```vue
:action-edit-source="actionEditSource"
```

只有 `actionEditSource.actionId` 与结果行 / 结果详情对应动作一致时展示。

### 137.4 动作结果行新增 DOM 状态

`workbench-action-result-source-row` 新增：

```html
data-edit-source-field
data-edit-source-label
```

当前编辑动作结果行额外显示：

```html
data-testid="workbench-action-result-edit-source"
```

### 137.5 结果详情区新增 DOM 状态

`workbench-action-result-detail-panel` 新增：

```html
data-edit-source-field
data-edit-source-label
```

当前编辑动作的标题摘要会在刷新状态后追加最近编辑来源。

### 137.6 验证

当前测试覆盖：

- 尚未编辑字段时，`action-0001` 结果行 `data-edit-source-field=""`。
- 修改等级后，结果行 `data-edit-source-field="level"`、`data-edit-source-label="等级变更"`。
- 当前编辑动作结果行显示 `等级变更`。
- 结果详情区同步 `data-edit-source-field="level"` 并包含 `等级变更`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DE 应继续完善编辑闭环，优先让字段来源标签反向定位到对应编辑控件或时间轴入口。

## 138. 阶段 5-8DE：字段来源反向定位属性控件

阶段目标：

- 在不改变三值计算结果、不新增保存 schema 的前提下，让动作结果中的最近编辑来源能够反向定位到属性面板对应控件。

### 138.1 Workbench 新增前端派生状态

新增：

```js
actionEditFocus = {
  actionId: string,
  fieldKey: string,
  label: string,
  sequence: number,
}
```

用途：

- `AnalysisPanel` 点击最近编辑来源标签后发出 `focus-action-edit-source`。
- `Workbench` 接收来源后选中对应动作，并把字段聚焦目标传给 `PropertiesPanel`。
- `applyDraftState()` 会清空该派生状态。

该状态不写入 localStorage，不属于项目保存 schema。

### 138.2 PropertiesPanel 新增 prop

新增：

```js
actionEditFocus: Object | null
```

由 `Workbench` 传入：

```vue
:action-edit-focus="actionEditFocus"
```

### 138.3 属性控件新增 DOM 落点

属性面板动作字段控件新增：

```html
data-testid="workbench-action-edit-control"
data-edit-field
data-edit-focused
```

当前覆盖字段：

```text
skillId
startMs
level
durationMs
change
eventType
targetCharacterId
actorCharacterId
actionVariantIndex
resource
reason
note
```

字段归一：

```text
laneId -> actorCharacterId
damageSegmentIndex -> actionVariantIndex
```

### 138.4 AnalysisPanel 新增事件

新增 emit：

```js
focus-action-edit-source
```

`workbench-action-result-edit-source` 标签现在可点击；点击后只传递最近编辑来源，不改变 action result 的三值结果。

### 138.5 验证

当前测试覆盖：

- 修改 `action-0001` 等级后，结果行显示 `等级变更`。
- 点击 `等级变更` 后，属性面板 `data-edit-field="level"` 写入 `data-edit-focused="true"`。
- `startMs` 控件保持 `data-edit-focused="false"`。
- 来源动作仍保持选中。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DF 应继续完善编辑闭环，优先把来源反向定位扩展到时间轴入口高亮，或补字段级前后值摘要。

## 139. 阶段 5-8DF：字段来源反向定位时间轴入口

阶段目标：

- 复用 `actionEditFocus` 前端派生状态，让动作结果来源标签点击后同时定位属性面板控件和时间轴动作块。

### 139.1 TimelineGridPreview 新增 prop

新增：

```js
actionEditFocus: Object | null
```

由 `Workbench` 传入：

```vue
:action-edit-focus="actionEditFocus"
```

该 prop 只用于前端高亮，不写入 localStorage，不属于项目保存 schema。

### 139.2 时间轴动作块新增 DOM 状态

`workbench-timeline-action` 新增：

```html
data-edit-focused
data-edit-focus-field
data-edit-focus-label
```

字段归一保持与属性面板一致：

```text
laneId -> actorCharacterId
damageSegmentIndex -> actionVariantIndex
```

### 139.3 验证

当前测试覆盖：

- 点击 `等级变更` 前，时间轴来源动作 `data-edit-focused="false"`。
- 点击 `等级变更` 后，时间轴来源动作 `data-edit-focused="true"`。
- 时间轴来源动作同步写入 `data-edit-focus-field="level"` 和 `data-edit-focus-label="等级变更"`。
- 来源动作块带 `edit-focused` 样式并保持选中。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DG 应继续完善编辑闭环，优先为最近编辑来源补字段级前后值摘要。

## 140. 阶段 5-8DG：字段来源前后值摘要

阶段目标：

- 为最近编辑来源补轻量字段前后值摘要，让结果定位链路能说明“哪个字段从什么改成什么”。

### 140.1 actionEditSource / actionEditFocus 新增派生字段

新增：

```js
previousValue: string
nextValue: string
changeSummary: string
```

完整前端状态形态：

```js
{
  actionId: string,
  fieldKey: string,
  label: string,
  previousValue: string,
  nextValue: string,
  changeSummary: string,
  sequence: number,
}
```

该状态只存在于 Workbench 前端运行时，不写入 localStorage，不属于项目保存 schema。

### 140.2 记录来源

以下入口会取编辑前后的动作草稿并生成摘要：

```text
updateAction(patch)
updateActionTime({ actionId, startMs })
updateActionDuration({ actionId, durationMs })
updateActionLane({ actionId, laneId })
```

字段显示策略：

```text
startMs / durationMs -> 帧时间，例如 0s0f
level / actionVariantIndex / damageSegmentIndex -> 数字文本
skillId -> 技能名
actorCharacterId / laneId / targetCharacterId -> 角色名
change -> 带符号数字
resource / reason / eventType / note -> 原文本
```

### 140.3 DOM 状态

`AnalysisPanel` 结果行和结果详情区新增：

```html
data-edit-source-summary
```

`PropertiesPanel` 字段落点新增：

```html
data-edit-focus-summary
```

`TimelineGridPreview` 动作块新增：

```html
data-edit-focus-summary
```

### 140.4 验证

当前测试覆盖：

- 修改 `action-0001` 等级后，结果行 `data-edit-source-summary="1 -> 2"`。
- 来源标签显示 `等级变更 1 -> 2`。
- 结果详情区同步 `data-edit-source-summary="1 -> 2"`。
- 点击来源标签后，属性面板等级控件和时间轴来源动作块同步 `data-edit-focus-summary="1 -> 2"`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DH 应继续完善 Workbench 主流程编辑体验，优先把最近编辑摘要接入结果定位/对比的小面板或操作反馈区域。

## 141. 阶段 5-8DH：最近编辑集中反馈条

阶段目标：

- 在分析面板中集中展示最近动作字段编辑来源和前后值摘要，并提供统一定位入口。

### 141.1 AnalysisPanel 新增派生反馈

新增内部派生：

```js
actionEditFeedback
```

输入仍为既有 `actionEditSource` prop，不新增 Workbench 保存字段。

反馈内容：

```js
{
  actionId: string,
  actionName: string,
  fieldKey: string,
  label: string,
  changeSummary: string,
  display: string,
}
```

### 141.2 DOM 状态

新增反馈条：

```html
data-testid="workbench-action-edit-feedback"
data-action-id
data-edit-source-field
data-edit-source-label
data-edit-source-summary
```

新增定位按钮：

```html
data-testid="workbench-action-edit-feedback-focus"
```

点击按钮会发出既有事件：

```js
focus-action-edit-source
```

### 141.3 验证

当前测试覆盖：

- 修改 `action-0001` 等级后，反馈条 `data-action-id="action-0001"`。
- 反馈条 `data-edit-source-field="level"`。
- 反馈条 `data-edit-source-summary="1 -> 2"`。
- 反馈条文本包含 `等级变更 1 -> 2`。
- 点击 `workbench-action-edit-feedback-focus` 后，属性面板和时间轴来源聚焦状态同步更新。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DI 应继续完善结果定位体验，优先把最近编辑反馈与贡献拆分或曲线选中状态联动。

## 142. 阶段 5-8DI：最近编辑联动三值结果点

阶段目标：

- 让最近编辑反馈条能直接定位到该动作对应的三值 runtime state point，并复用现有贡献拆分与曲线选中链路。

### 142.1 actionEditFeedback 新增派生字段

新增内部派生：

```js
runtimeStatePointId: string
runtimeDeltaCount: number
```

来源：

- `runtimeTraceByActionId.get(actionEditSource.actionId)`
- `runtimeStatePointId` 取该 trace 的 `firstStatePointId`
- `runtimeDeltaCount` 取该 trace 的 `count`

这些字段只存在于 `AnalysisPanel` 运行时派生中，不写入 localStorage，不属于项目保存 schema。

### 142.2 DOM 状态

`workbench-action-edit-feedback` 新增：

```html
data-runtime-state-point-id
data-runtime-delta-count
```

新增结果定位按钮：

```html
data-testid="workbench-action-edit-feedback-result-focus"
data-runtime-state-point-id
```

点击按钮会发出既有事件：

```js
select-action-result
```

### 142.3 验证

当前测试覆盖：

- 修改 `action-0001` 等级后，反馈条携带 runtime state point。
- `workbench-action-edit-feedback-result-focus` 与反馈条携带同一个 state point。
- 点击结果定位按钮后，`workbench-state-curve-focus-selected` 进入 active。
- `workbench-action-contribution-panel` 定位到 `action-0001`。
- `workbench-runtime-selected-detail-state-point` 等于反馈条携带的 state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DJ 应继续完善结果定位体验，优先在最近编辑反馈条中标明当前结果定位状态。
