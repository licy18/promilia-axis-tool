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
