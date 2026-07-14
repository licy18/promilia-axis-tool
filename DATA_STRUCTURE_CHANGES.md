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
- **旧 Editor.vue（已移除）**：历史上曾负责拖放兼容；当前生产 Workbench 通过标准 action draft 和项目规范化处理数据结构

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

## 143. 阶段 5-8DJ：最近编辑结果定位状态

阶段目标：

- 在最近编辑反馈条中标明该编辑对应的三值结果点是否已经是当前选中结果点。

### 143.1 actionEditFeedback 新增派生字段

新增内部派生：

```js
resultFocused: boolean
resultFocusStatus: 'focused' | 'available' | 'unavailable'
resultFocusLabel: string
```

派生规则：

```text
runtimeStatePointId 为空 -> unavailable / 无结果点
runtimeStatePointId 等于 selectedStateCurvePointId -> focused / 结果已定位
其他情况 -> available / 结果未定位
```

这些字段只存在于 `AnalysisPanel` 运行时派生中，不写入 localStorage，不属于项目保存 schema。

### 143.2 DOM 状态

`workbench-action-edit-feedback` 新增：

```html
data-result-focused
data-result-focus-status
```

新增状态标签：

```html
data-testid="workbench-action-edit-feedback-result-status"
```

当 `resultFocused=true` 时：

- `workbench-action-edit-feedback-result-focus` 显示 `结果已定位`。
- `workbench-action-edit-feedback-result-focus` 置为 disabled。

### 143.3 验证

当前测试覆盖：

- 最近编辑反馈条在 runtime point 已选中时写入 `data-result-focused="true"`。
- 最近编辑反馈条写入 `data-result-focus-status="focused"`。
- 状态标签显示 `结果已定位`。
- 结果定位按钮禁用且文本为 `结果已定位`。
- 贡献拆分和运行详情仍与反馈条 runtime state point 一致。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DK 应继续完善结果定位体验，优先让反馈条在用户选中其他结果点后清楚标记为未定位，并保留一键回到最近编辑结果点的路径。

## 144. 阶段 5-8DK：最近编辑结果回跳路径

阶段目标：

- 验证并固定最近编辑反馈条在用户切换到其他三值结果点后的未定位状态和回跳能力。

### 144.1 数据结构变化

本阶段不新增字段。

继续复用阶段 5-8DJ 的派生状态：

```js
resultFocused
resultFocusStatus
resultFocusLabel
runtimeStatePointId
runtimeDeltaCount
```

这些字段仍只存在于 `AnalysisPanel` 运行时派生中，不写入 localStorage，不属于项目保存 schema。

### 144.2 验证路径

当前测试覆盖：

- 最近编辑反馈条处于 `focused / 结果已定位`。
- 新增资源动作制造另一个 runtime state point。
- 选择资源曲线的其他 state point 后，最近编辑反馈条变为 `available / 结果未定位`。
- `workbench-action-edit-feedback-result-focus` 恢复可用并显示 `定位结果`。
- 点击该按钮后，运行详情回到最近编辑反馈条携带的 runtime state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DL 应继续完善 Workbench 主流程体验，优先减少最近编辑反馈、动作结果行、贡献拆分之间的重复信息。

## 145. 阶段 5-8DL：最近编辑摘要集中展示

阶段目标：

- 将最近编辑摘要的视觉展示集中到 `workbench-action-edit-feedback`，减少动作结果行和结果详情标题的重复文本。

### 145.1 数据结构变化

本阶段不新增字段。

继续复用：

```html
data-edit-source-field
data-edit-source-label
data-edit-source-summary
```

这些 DOM 状态仍保留在动作结果行和结果详情区，只是视觉摘要由集中反馈条承接。

### 145.2 展示规则

新增内部判断：

```js
shouldShowActionResultEditSource(entry)
isActionEditFeedbackForAction(actionId)
```

规则：

- 当 `actionEditFeedback.actionId === entry.actionId` 时，动作结果行不渲染 `workbench-action-result-edit-source`。
- 当 `actionEditFeedback.actionId === detail.actionId` 时，结果详情标题不再拼接编辑摘要。
- `workbench-action-edit-feedback` 继续显示 `formatActionEditSourceDisplay(source)` 并保留定位入口。

### 145.3 验证

当前测试覆盖：

- 动作结果行仍保留 `data-edit-source-summary="1 -> 2"`。
- 同一动作的 `workbench-action-result-edit-source` 不再渲染。
- 结果详情区仍保留 `data-edit-source-summary="1 -> 2"`。
- 结果详情标题不再重复显示 `等级变更 1 -> 2`。
- 最近编辑反馈条仍显示 `等级变更 1 -> 2`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DM 应继续完善 Workbench 主流程体验，优先检查贡献拆分与运行详情之间是否还有可收敛的重复摘要或状态标签。

## 146. 阶段 5-8DM：分析面板结果详情紧凑摘要

阶段目标：

- 减少分析面板内结果详情与独立“三值详情”面板之间的重复展示。

### 146.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

新增的是 `AnalysisPanel` 内部前端派生行：

```js
createCompactRuntimeResultRows(detail)
```

当前派生行 key：

```text
point
delta
cumulative
state-status
```

这些行只由 `selectedRuntimeResultDetail` 派生，用于分析面板紧凑展示。

### 146.2 DOM 状态

`workbench-action-result-detail-panel` 新增：

```html
data-detail-mode="compact"
data-full-detail-source="workbench-runtime-selected-detail"
```

含义：

- `compact` 表示分析面板内只展示定位摘要。
- `workbench-runtime-selected-detail` 表示完整运行明细由独立“三值详情”面板承接。

### 146.3 验证

当前测试覆盖：

- 动作结果详情面板写入 `data-detail-mode="compact"`。
- 动作结果详情面板写入 `data-full-detail-source="workbench-runtime-selected-detail"`。
- 紧凑摘要只保留 `point`、`delta`、`cumulative`、`state-status` 四类行。
- 贡献拆分和独立“三值详情”仍定位到同一个 runtime state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DN 应继续推进 Workbench 主流程 UI 的曲线交互和结果定位细节。

## 147. 阶段 5-8DN：资源曲线选中点摘要

阶段目标：

- 在资源曲线面板内补充当前选中三值点的就地摘要，减少用户在曲线、日志和独立详情面板之间来回确认的成本。

### 147.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

新增的是 `ResourceMonitorPanel` 内部前端派生：

```js
selectedRuntimeCurvePoint
selectedRuntimeCurvePointRows
```

派生来源：

```text
props.selectedStateCurvePointId
runtimeCurveSourceSeries
```

当前摘要行 key：

```text
point
action
delta
cumulative
state
```

这些行只用于资源曲线面板内的选中点摘要，不作为持久化数据。

### 147.2 DOM 状态

新增选中点摘要容器：

```html
data-testid="workbench-runtime-resource-chart-selection"
data-state-point-id
data-track-key
data-series-key
data-curve-mode
data-runtime-focus-source
```

`data-runtime-focus-source` 当前取值：

```text
manual
action-result
action-contribution
```

摘要行：

```html
data-testid="workbench-runtime-resource-chart-selection-row"
data-detail-key="point|action|delta|cumulative|state"
```

### 147.3 验证

当前测试覆盖：

- 点击运行资源曲线点后，选中点摘要出现并绑定同一个 `statePointId`。
- 手动曲线点选择时，摘要区写入 `data-runtime-focus-source="manual"`。
- 通过动作结果定位时，摘要区写入 `data-runtime-focus-source="action-result"`。
- 摘要区保留 `point`、`action`、`delta`、`cumulative`、`state` 五类行。
- 运行日志、资源曲线、时间轴 marker 和独立“三值详情”仍共享同一个选中 state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DO 应继续补曲线点前后切换或邻近点导航。

## 148. 阶段 5-8DO：资源曲线邻近点导航

阶段目标：

- 让用户能从当前选中三值点快速切换到前后邻近结果点，提升曲线巡检效率。

### 148.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

新增的是 `ResourceMonitorPanel` 内部前端派生：

```js
runtimeCurveNavigationPoints
selectedRuntimeCurvePointIndex
selectedRuntimeCurvePreviousPoint
selectedRuntimeCurveNextPoint
```

派生来源：

```text
runtimeCurveSourceSeries
props.selectedStateCurvePointId
```

排序规则：

```text
frameIndex -> sequenceIndex -> track order -> seriesIndex -> pointIndex
```

当前轨道顺序：

```text
enemyHpDamage -> enemyToughnessDamage -> selfEnergyChange
```

这些字段只用于资源曲线面板导航，不作为持久化数据。

### 148.2 DOM 状态

`workbench-runtime-resource-chart-selection` 新增：

```html
data-navigation-count
data-navigation-index
data-previous-state-point-id
data-next-state-point-id
```

新增按钮：

```html
data-testid="workbench-runtime-resource-chart-selection-prev"
data-testid="workbench-runtime-resource-chart-selection-next"
data-testid="workbench-runtime-resource-chart-selection-index"
```

按钮点击继续复用既有事件：

```js
select-runtime-state-point
```

### 148.3 验证

当前测试覆盖：

- 新增资源动作后，资源曲线存在多个 runtime state point。
- 选中第一个曲线点后，摘要区写入 `data-navigation-count > 1` 和 `data-navigation-index="0"`。
- 点击下一点后，资源曲线选中点、运行日志选中行和独立“三值详情”同步到 next state point。
- 点击上一点后，摘要区回到原 state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DP 应继续补从曲线点/三值详情反向定位对应动作和编辑控件的路径。

## 149. 阶段 5-8DP：三值结果反向定位动作

阶段目标：

- 从资源曲线选中点回到对应动作和编辑入口，让结果巡检能自然进入修轴。

### 149.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

新增的是前端事件和派生焦点：

```js
focus-runtime-action
focusRuntimeAction(payload)
```

事件 payload：

```js
{
  actionId: string,
  fieldKey: 'startMs',
  frameLabel: string,
  statePointId: string,
  trackKey: string
}
```

`Workbench` 会把该 payload 转换为既有 `actionEditFocus`：

```js
{
  actionId,
  fieldKey: 'startMs',
  label: '结果定位',
  changeSummary: '三值点 ... · 敌人 HP|敌人韧性|自身能量'
}
```

这些字段仍是前端派生焦点状态，不写入 localStorage，不属于项目保存 schema。

### 149.2 DOM 状态

`workbench-runtime-resource-chart-selection` 新增动作定位按钮：

```html
data-testid="workbench-runtime-resource-chart-selection-action-focus"
data-action-id
data-focus-field="startMs"
data-state-point-id
```

点击后现有组件会进入：

```html
workbench-timeline-action[data-edit-focused="true"]
workbench-action-edit-control[data-edit-field="startMs"][data-edit-focused="true"]
```

### 149.3 验证

当前测试覆盖：

- 选中资源曲线点后，动作定位按钮携带对应 `actionId` 和 `startMs` 焦点字段。
- 点击动作定位按钮后，时间轴对应动作进入选中和编辑焦点状态。
- 时间轴动作写入 `data-edit-focus-label="结果定位"`。
- 属性面板开始时间控件进入 `data-edit-focused="true"`，焦点摘要包含三值轨道。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DQ 应继续串起“定位动作 -> 修改字段 -> 结果回看”的编辑反馈闭环。

## 150. 阶段 5-8DQ：结果定位编辑反馈闭环

阶段目标：

- 标记从三值结果定位进入编辑后的最近编辑来源，并保留回看刷新后结果点的路径。

### 150.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`actionEditFocus` 新增前端派生字段：

```js
editOrigin: 'runtime-focus' | ''
originStatePointId: string
originTrackKey: string
originFrameLabel: string
```

`actionEditSource` 新增前端派生字段：

```js
editOrigin: 'runtime-focus' | ''
originLabel: string
originStatePointId: string
originTrackKey: string
originFrameLabel: string
```

派生规则：

```text
actionEditFocus.editOrigin === 'runtime-focus'
且 actionEditFocus.actionId === editedActionId
-> 最近编辑来源继承 runtime origin
```

这些字段只存在于 Workbench 前端状态，不写入 localStorage，不属于项目保存 schema。

### 150.2 DOM 状态

`workbench-action-edit-feedback` 新增：

```html
data-edit-origin
data-origin-state-point-id
data-origin-track-key
data-origin-frame-label
```

新增来源标签：

```html
data-testid="workbench-action-edit-feedback-origin"
```

刷新后结果点仍使用既有字段：

```html
data-runtime-state-point-id
```

### 150.3 验证

当前测试覆盖：

- 从资源曲线点点击 `定位动作` 后修改 `startMs`。
- 最近编辑反馈条写入 `data-edit-origin="runtime-focus"`。
- 最近编辑反馈条保留原始 `data-origin-state-point-id` 和 `data-origin-track-key`。
- 最近编辑反馈条显示 `来自结果定位`。
- 修改后 `data-runtime-state-point-id` 指向刷新后的结果点。
- 点击 `定位结果` 后，独立“三值详情”切到刷新后的 runtime state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DR 应补独立“三值详情”面板中的动作定位/编辑入口。

## 151. 阶段 5-8DR：三值详情动作定位入口

阶段目标：

- 让独立“三值详情”面板也能进入与资源曲线一致的修轴闭环。

### 151.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`RuntimeSelectedDetailPanel` 新增前端事件：

```js
focus-runtime-action
```

事件 payload 复用阶段 5-8DP：

```js
{
  actionId: string,
  fieldKey: 'startMs',
  frameLabel: string,
  statePointId: string,
  trackKey: string
}
```

`Workbench` 继续使用既有 `focusRuntimeAction()` 处理该事件。

### 151.2 DOM 状态

`RuntimeSelectedDetailPanel` 新增按钮：

```html
data-testid="workbench-runtime-selected-detail-action-focus"
data-action-id
data-focus-field="startMs"
data-state-point-id
```

点击后继续进入既有状态：

```html
workbench-timeline-action[data-edit-focused="true"]
workbench-action-edit-control[data-edit-field="startMs"][data-edit-focused="true"]
workbench-action-edit-feedback[data-edit-origin="runtime-focus"]
```

### 151.3 验证

当前测试覆盖：

- 运行日志选中结果点后，独立“三值详情”显示动作定位按钮。
- 点击三值详情动作定位按钮后，对应时间轴动作进入选中和编辑焦点状态。
- 属性面板开始时间控件进入编辑焦点状态。
- 修改开始时间后，最近编辑反馈条继续保留 `runtime-focus` origin 和原始 state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DS 应补事件日志详情中的动作定位入口。

## 152. 阶段 5-8DS：事件日志动作定位入口

阶段目标：

- 让事件日志详情也能进入与资源曲线和三值详情一致的修轴闭环。

### 152.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`EventLogPanel` 新增前端事件：

```js
focus-runtime-action
```

事件 payload 复用阶段 5-8DP：

```js
{
  actionId: string,
  fieldKey: 'startMs',
  frameLabel: string,
  statePointId: string,
  trackKey: string
}
```

payload 来源：

```text
matchedRuntimeSelectedDetail -> selectedRuntimeLog fallback
```

`Workbench` 继续使用既有 `focusRuntimeAction()` 处理该事件。

### 152.2 DOM 状态

`EventLogPanel` 运行日志详情新增按钮：

```html
data-testid="workbench-runtime-sim-log-action-focus"
data-action-id
data-focus-field="startMs"
data-state-point-id
```

点击后继续进入既有状态：

```html
workbench-timeline-action[data-edit-focused="true"]
workbench-action-edit-control[data-edit-field="startMs"][data-edit-focused="true"]
workbench-action-edit-feedback[data-edit-origin="runtime-focus"]
```

### 152.3 验证

当前测试覆盖：

- 运行日志详情显示动作定位按钮，并携带当前日志 state point。
- 点击事件日志详情动作定位按钮后，对应时间轴动作进入选中和编辑焦点状态。
- 属性面板开始时间控件进入编辑焦点状态。
- 修改开始时间后，最近编辑反馈条继续保留 `runtime-focus` origin 和原始 state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DT 应收敛属性面板内的编辑焦点提示与可操作控件。

## 153. 阶段 5-8DT：属性面板编辑焦点提示

阶段目标：

- 让属性面板内被结果定位命中的编辑控件更明确地显示自身来源和用途。

### 153.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`PropertiesPanel` 动作编辑控件新增前端 DOM 派生状态：

```html
data-edit-focus-label
data-edit-focus-origin
```

继续复用既有字段：

```html
data-edit-focused
data-edit-focus-summary
```

派生来源：

```text
props.actionEditFocus.label
props.actionEditFocus.editOrigin
props.actionEditFocus.changeSummary
```

### 153.2 展示规则

当控件满足：

```text
data-edit-focused="true"
```

控件通过统一 CSS 显示：

```text
{data-edit-focus-label} · {data-edit-focus-summary}
```

当：

```text
data-edit-focus-origin="runtime-focus"
```

提示使用 runtime 结果定位样式。

### 153.3 验证

当前测试覆盖：

- 从独立“三值详情”入口定位动作后，属性面板 `startMs` 控件写入 `data-edit-focus-label="结果定位"`。
- 同一控件写入 `data-edit-focus-origin="runtime-focus"`。
- 同一控件摘要包含三值轨道。
- 从事件日志详情入口定位动作后，也能得到同一组属性面板焦点状态。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DU 应补编辑后的结果回看提示，区分原始结果点和刷新后结果点。

## 154. 阶段 5-8DU：编辑反馈结果点映射

阶段目标：

- 在最近编辑反馈条中明确区分编辑来源的原始结果点和当前刷新后的结果点。

### 154.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`AnalysisPanel` 的 `actionEditFeedback` 新增前端派生字段：

```js
originPointDisplay: string
runtimePointDisplay: string
hasResultPointMap: boolean
```

派生来源：

```text
actionEditSource.originStatePointId
actionEditSource.originFrameLabel
actionEditSource.originTrackKey
runtimeTraceByActionId[actionId].firstStatePointId
runtimeTraceByActionId[actionId].count
resultFocusStatus
```

### 154.2 DOM 状态

`workbench-action-edit-feedback` 内新增结果点映射容器：

```html
data-testid="workbench-action-edit-feedback-result-map"
data-origin-state-point-id
data-runtime-state-point-id
```

映射行：

```html
data-testid="workbench-action-edit-feedback-result-map-row"
data-result-point-key="origin|runtime"
```

含义：

- `origin`：编辑前定位来源的原始结果点。
- `runtime`：当前动作刷新后的可定位结果点。

### 154.3 验证

当前测试覆盖：

- 从资源曲线点定位动作后修改 `startMs`。
- 最近编辑反馈条结果点映射保留原始 state point。
- 最近编辑反馈条结果点映射保留刷新后 state point。
- 原始 state point 与刷新后 state point 不同。
- 映射行显示 `原结果`、`刷新后` 和三值轨道/定位状态。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DV 应补刷新后结果点在资源曲线选中点摘要中的同步提示。

## 155. 阶段 5-8DV：资源曲线刷新后结果上下文

阶段目标：

- 让资源曲线选中点摘要同步最近编辑反馈条中的刷新后结果点状态。

### 155.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`Workbench` 新增前端派生的 `actionEditResultContext`，并传给 `ResourceMonitorPanel`：

```js
{
  status: 'refreshed-edit-result',
  actionId: string,
  fieldKey: string,
  label: string,
  changeSummary: string,
  originStatePointId: string,
  originTrackKey: string,
  originFrameLabel: string,
  runtimeStatePointId: string,
  runtimeTrackKey: string
}
```

派生来源：

```text
actionEditSource
threeValueRuntimeProjection.simLog[]
threeValueRuntimeProjection.enemyStateCurve.points[]
threeValueRuntimeProjection.selfEnergyCurveByActor[].points[]
```

`ResourceMonitorPanel` 内部新增 `selectedRuntimeCurveResultContext`，只在当前选中资源曲线点的 `statePointId` 等于 `actionEditResultContext.runtimeStatePointId` 时生效。

### 155.2 DOM 状态

资源曲线选中点摘要新增状态：

```html
data-testid="workbench-runtime-resource-chart-selection"
data-result-context-status="refreshed-edit-result"
data-result-context-action-id
data-result-context-origin-state-point-id
```

摘要来源标签新增：

```html
data-testid="workbench-runtime-resource-chart-selection-source"
data-result-context-active="true|false"
```

含义：

- `data-result-context-active="false"`：普通手动选择、动作结果定位或贡献拆分定位。
- `data-result-context-active="true"`：当前选中点是最近编辑后的刷新后结果点，来源标签显示 `刷新后结果`。

### 155.3 验证

当前测试覆盖：

- 手动选择资源曲线点时，摘要来源显示 `手动选择`。
- 从资源曲线定位动作后修改 `startMs`。
- 点击最近编辑反馈条 `定位结果` 后，资源曲线摘要选中刷新后的 state point。
- 刷新后结果摘要写入 `data-result-context-status="refreshed-edit-result"`。
- 刷新后结果摘要保留原始结果点 ID 和 action ID。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DW 应继续压缩结果定位后的编辑路径，让资源曲线、三值详情、模拟日志和动作属性面板之间的当前编辑上下文更紧凑一致。

## 156. 阶段 5-8DW：结果定位编辑焦点同步状态

阶段目标：

- 让三值详情、模拟日志和动作属性面板共享结果定位后的当前编辑焦点状态。

### 156.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`Workbench` 将已有的前端状态 `actionEditFocus` 传给：

```text
RuntimeSelectedDetailPanel
EventLogPanel
```

两个面板仅在以下条件同时满足时派生同步状态：

```text
actionEditFocus.editOrigin === "runtime-focus"
actionEditFocus.actionId === 当前详情 actionId
actionEditFocus.originStatePointId === 当前详情 statePointId
```

派生出的状态结构：

```js
{
  status: 'edit-focus-synced',
  actionId: string,
  fieldKey: string,
  label: string,
  statePointId: string,
  summary: string
}
```

### 156.2 DOM 状态

三值详情新增：

```html
data-testid="workbench-runtime-selected-detail-edit-context"
data-edit-context-status="edit-focus-synced"
data-action-id
data-edit-focus-field
data-edit-focus-label
data-state-point-id
```

模拟日志详情新增：

```html
data-testid="workbench-runtime-sim-log-edit-context"
data-edit-context-status="edit-focus-synced"
data-action-id
data-edit-focus-field
data-edit-focus-label
data-state-point-id
```

含义：

- 状态存在：当前详情或日志点已经把编辑焦点同步到动作属性面板。
- 状态不存在：尚未从该结果点进入动作编辑，或当前编辑焦点来自其他动作/其他 state point。

### 156.3 验证

当前测试覆盖：

- 三值详情点击 `定位动作` 前，不显示同步状态。
- 三值详情点击 `定位动作` 后，显示 `edit-focus-synced`。
- 模拟日志点击 `定位动作` 前，不显示同步状态。
- 模拟日志点击 `定位动作` 后，显示 `edit-focus-synced`。
- 两个入口仍会同步属性面板 `startMs` 控件的 `runtime-focus` 高亮。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DX 应补结果定位后的快捷往返，让编辑、结果回看和日志定位之间的切换更少。

## 157. 阶段 5-8DX：属性面板结果回看入口

阶段目标：

- 在动作属性面板提供结果定位后的快捷回看入口，减少编辑和结果点之间的往返成本。

### 157.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`PropertiesPanel` 新增 prop：

```js
actionEditResultContext: Object | null
```

该 prop 复用阶段 5-8DV 已有的前端派生状态。属性面板内部新增 `runtimeResultReturnContext`：

```js
{
  status: 'origin-result' | 'refreshed-edit-result',
  actionId: string,
  fieldKey: string,
  label: string,
  summary: string,
  originStatePointId: string,
  statePointId: string
}
```

派生规则：

```text
actionEditFocus.editOrigin === "runtime-focus"
actionEditFocus.actionId === selectedAction.id
```

当 `actionEditResultContext.runtimeStatePointId` 可用时：

```text
status = "refreshed-edit-result"
statePointId = actionEditResultContext.runtimeStatePointId
```

否则：

```text
status = "origin-result"
statePointId = actionEditFocus.originStatePointId
```

### 157.2 DOM 状态

属性面板动作编辑区新增：

```html
data-testid="workbench-action-edit-result-return"
data-return-status="origin-result|refreshed-edit-result"
data-action-id
data-origin-state-point-id
data-state-point-id
```

按钮：

```html
data-testid="workbench-action-edit-result-return-button"
data-state-point-id
```

点击按钮会向 `Workbench` 发出 `return-runtime-result`，由 Workbench 复用动作结果定位流程选中对应 runtime state point。

### 157.3 验证

当前测试覆盖：

- 未进入结果定位编辑时，属性面板不显示结果回看入口。
- 点击三值详情 `定位动作` 后，入口显示 `origin-result` 并指向来源 state point。
- 修改 `startMs` 后，入口切换为 `refreshed-edit-result` 并指向刷新后的 state point。
- 点击 `回到结果点` 后，三值详情选中刷新后的 runtime state point。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DY 应补结果回看后的当前动作/结果区域状态一致性，让用户更少依赖手动筛选或滚动确认当前位置。

## 158. 阶段 5-8DY：动作结果当前位置同步状态

阶段目标：

- 在结果回看后，让动作结果行和结果详情区明确显示当前 runtime state point 已经对齐。

### 158.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`AnalysisPanel` 复用已有：

```text
selectedStateCurvePointId
runtimeTraceByActionId[actionId].statePointIds
```

新增前端派生状态：

```js
getActionResultLocationStatus(entry): 'selected-result' | 'available'
getActionResultSelectedStatePointId(entry): string
```

当 `selectedStateCurvePointId` 属于当前动作 runtime trace 时：

```text
status = "selected-result"
selectedStatePointId = selectedStateCurvePointId
```

否则：

```text
status = "available"
selectedStatePointId = ""
```

### 158.2 DOM 状态

动作结果行新增：

```html
data-testid="workbench-action-result-source-row"
data-result-location-status="selected-result|available"
data-selected-state-point-id
```

当状态为 `selected-result` 时显示：

```html
data-testid="workbench-action-result-location-status"
```

结果详情区新增：

```html
data-testid="workbench-action-result-detail-panel"
data-result-location-status="selected-result"
data-selected-state-point-id
```

详情区状态标签：

```html
data-testid="workbench-action-result-detail-location-status"
```

含义：

- `selected-result`：当前选中的 runtime state point 已经映射到该动作结果行/详情。
- `available`：该动作有 runtime trace，但当前选中的 state point 不属于该动作结果。

### 158.3 验证

当前测试覆盖：

- 属性面板回看刷新后结果点后，动作结果行 `data-selected="true"`。
- 同一行写入 `data-result-location-status="selected-result"`。
- 同一行写入刷新后的 `data-selected-state-point-id`。
- 结果详情区写入同一状态和同一 selected state point。
- 两处都显示 `当前位置已同步`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8DZ 应补当前结果定位后的筛选/导航反馈，让日志、曲线和结果面板围绕同一 state point 工作时更可见。

## 159. 阶段 5-8DZ：模拟日志导航同步状态

阶段目标：

- 让模拟日志明确显示当前选中 runtime state point 是否已经进入当前日志筛选和导航位置。

### 159.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`EventLogPanel` 复用已有：

```text
selectedStateCurvePointId
runtimeProjection.simLog[]
filteredRuntimeSimLogRows
```

新增前端派生状态 `runtimeLogNavigationStatus`：

```js
{
  status: 'none' | 'synced' | 'filtered-out' | 'missing',
  label: string,
  detail: string,
  statePointId: string,
  navigationCount: number,
  navigationIndex: number,
  sourceCount: number,
  sourceIndex: number
}
```

状态含义：

- `none`：当前没有选中 runtime state point。
- `synced`：当前 state point 已进入当前日志筛选列表。
- `filtered-out`：当前 state point 存在于全量日志，但被当前筛选隐藏。
- `missing`：当前 state point 不在模拟日志中。

### 159.2 DOM 状态

模拟日志新增导航同步条：

```html
data-testid="workbench-runtime-sim-log-navigation"
data-navigation-status="synced|filtered-out|missing"
data-state-point-id
data-navigation-index
data-navigation-count
data-source-index
data-source-count
```

含义：

- `data-navigation-index`：当前筛选列表中的 0 基索引；筛选外或缺失时为 `-1`。
- `data-source-index`：全量模拟日志中的 0 基索引；缺失时为 `-1`。
- `data-state-point-id`：当前正在同步/追踪的 runtime state point。

### 159.3 验证

当前测试覆盖：

- 属性面板回看刷新后结果点后，模拟日志导航显示 `synced`。
- HP state point 被能量日志筛选隐藏后，模拟日志导航显示 `filtered-out`。
- 筛选外状态写入 `data-navigation-index="-1"`。
- 点击 `显示日志` 后，模拟日志导航切回 `synced`。
- 同步状态写入当前 state point 和当前筛选 index。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一阶段 5-8EA 应整理结果定位链路的主路径提示，减少重复状态标签，让当前动作、当前结果点和当前日志位置的关系更清楚。

## 160. 阶段 5-8EA：最近编辑定位链路摘要

阶段目标：

- 把最近编辑后的动作、结果点和详情同步状态压缩为一条主路径摘要。

### 160.1 数据结构变化

本阶段不新增保存字段，不变更 `Project` schema、simulation 输出或 localStorage 数据。

`AnalysisPanel` 的 `actionEditFeedback` 新增前端派生字段：

```js
locationChain: {
  status: 'synced' | 'pending' | 'unavailable',
  actionSynced: boolean,
  resultSynced: boolean,
  detailSynced: boolean,
  syncedCount: number,
  totalCount: number,
  label: string,
  detail: string
}
```

派生依据：

```text
selectedActionId
selectedStateCurvePointId
runtimeSelectedDetail.statePointId
actionEditFeedback.runtimeStatePointId
```

当前固定检查三项：

```text
动作是否已选中
刷新后结果点是否已定位
结果详情是否已同步
```

### 160.2 DOM 状态

最近编辑反馈条新增：

```html
data-testid="workbench-action-edit-feedback-location-chain"
data-chain-status="synced|pending|unavailable"
data-chain-synced-count
data-chain-total-count
data-action-synced="true|false"
data-result-synced="true|false"
data-detail-synced="true|false"
```

含义：

- `synced`：动作、结果点、结果详情三项全部同步。
- `pending`：存在刷新后结果点，但仍有至少一项未同步。
- `unavailable`：当前动作没有可用刷新后结果点。

### 160.3 验证

当前测试覆盖：

- 属性面板回看刷新后结果点后，定位链路显示 `synced`。
- 同步数为 `3/3`。
- 动作、结果、详情三个布尔状态都为 `true`。
- 摘要文字包含 `动作已选中`、`结果已定位`、`详情已同步`。

阶段验收：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

后续不再继续 5-8EB/EC 这类微型状态标签阶段；下一步按生成层、运行时层、UI 主流程三个大能力块推进。

## 161. 生成层能力块：标准合同入口模块化

本阶段属于生成层。

### 161.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 161.2 新增模块

新增生成层入口：

```text
src/simulation/generation/threeValueGenerationLayer.js
```

该模块导出：

```js
createThreeValueGenerationLayer({ scenario, stateCurves })
compareThreeValueGenerationDeltas(left, right)
THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY
THREE_VALUE_DELTA_FIELDS
```

`THREE_VALUE_DELTA_FIELDS` 当前固定为：

```js
['hpDelta', 'toughnessDelta', 'energyDelta']
```

`THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY` 当前固定为：

```js
{
  enemyHpDamage: 'hpDelta',
  enemyToughnessDamage: 'toughnessDelta',
  selfEnergyChange: 'energyDelta'
}
```

### 161.3 接线变化

`projectSimulationResult()` 的生成层接线从 projection 内部函数改为：

```js
createThreeValueGenerationLayer({
  scenario,
  stateCurves: threeValueCurveFramework.stateCurves
})
```

runtime applied delta 排序改为复用 generation 模块：

```js
compareThreeValueGenerationDeltas
```

### 161.4 标准合同

生成层仍输出：

```text
Action -> Hit -> ThreeValueDelta
```

标准 delta 继续包含：

```text
actionId
hitKey
hitIndex
frameIndex
timeMs
trackKey
layerKey
delta
hpDelta
toughnessDelta
energyDelta
sourceKind
sourceIds
confidence
calculator
calculatorKey
calculationKind
calculationStatus
calculationReplaceable
applied
replaceable
```

### 161.5 验证

新增测试：

```text
src/__tests__/simulation/threeValueGenerationLayer.test.js
```

当前验证：

- 独立 generation 测试直接输入最小 state curve，并生成 action / hit / delta 标准分组。
- 既有 `firstVerticalSliceSimulation.test.js` 继续验证完整 simulation 结果、runtime projection 和三值曲线结果不变。
- `npm run test -- --run src/__tests__/simulation/threeValueGenerationLayer.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、14 条测试。
- `npm run test -- --run`：通过，14 个测试文件、115 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步应进入运行时层能力块，把 runtime projection 的曲线、日志和 summary 继续模块化为只消费 generation layer applied deltas 的稳定入口。

## 162. 运行时层能力块：Runtime Projection 入口模块化

本阶段属于运行时层。

### 162.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 162.2 新增模块

新增运行时入口：

```text
src/simulation/runtime/threeValueRuntimeProjection.js
```

该模块导出：

```js
createThreeValueRuntimeProjection({
  scenario,
  threeValueGenerationLayer
})

createSelfEnergyDeltaSummaryByActor(selfEnergyCurveByActor)
```

### 162.3 接线变化

`projectSimulationResult()` 的运行时层接线从 projection 内部函数改为：

```js
createThreeValueRuntimeProjection({
  scenario,
  threeValueGenerationLayer
})
```

顶层 summary 的自身能量角色摘要继续由 runtime 输出派生：

```js
createSelfEnergyDeltaSummaryByActor(
  threeValueRuntimeProjection.selfEnergyCurveByActor
)
```

### 162.4 Runtime 消费边界

runtime projection 当前只消费 generation layer 中的 applied delta：

```text
threeValueGenerationLayer.deltas[].applied === true
```

runtime 输出仍保持：

```text
threeValueRuntimeProjection.enemyStateCurve
threeValueRuntimeProjection.selfEnergyCurveByActor
threeValueRuntimeProjection.simLog
threeValueRuntimeProjection.summary
```

其中 `candidate / sampled / placeholder` delta 仍停留在 generation layer，用于来源追溯和诊断，不进入 runtime 的曲线、日志和最终 summary。

### 162.5 验证

新增测试：

```text
src/__tests__/simulation/threeValueRuntimeProjection.test.js
```

当前验证：

- 独立 runtime 测试直接输入包含 applied 与 candidate 的 generation layer。
- 测试确认 runtime 只把 applied delta 写入 `enemyStateCurve`、`selfEnergyCurveByActor` 和 `simLog`。
- 测试确认 `summary.inputDeltaCount` 统计全部 generation delta，但 `summary.appliedDeltaCount`、曲线点和 simLog 只统计 applied delta。
- 测试确认 `createSelfEnergyDeltaSummaryByActor()` 继续从 runtime actor curve 派生顶层自身能量摘要。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/threeValueGenerationLayer.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，3 个测试文件、15 条测试。
- `npm run test -- --run`：通过，15 个测试文件、116 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步应进入 UI 主流程能力块，围绕 Endaxis 式完整流程推进：排轴动作编辑 -> 运行模拟 -> 资源曲线监控 -> 日志/详情查看 -> 回到动作修改。

## 163. UI 主流程能力块：Workbench 主流程控制条

本阶段属于 UI 主流程。

### 163.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 163.2 新增组件

新增：

```text
src/features/workbench/WorkbenchFlowPanel.vue
```

该组件读取：

```text
selectedAction
threeValueRuntimeProjection
runtimeSelectedDetail
actionEditResultContext
```

该组件发出：

```text
open-runtime-results
focus-runtime-action
return-runtime-result
```

### 163.3 Workbench 接线

`Workbench.vue` 在 `ScenarioHeader` 和 `workbench-grid` 之间接入：

```vue
<WorkbenchFlowPanel
  :selected-action="selectedAction"
  :runtime-projection="simulationResult.threeValueRuntimeProjection"
  :runtime-selected-detail="runtimeSelectedDetail"
  :action-edit-result-context="actionEditResultContext"
/>
```

事件复用既有主路径函数：

```text
open-runtime-results -> focusThreeValueCalculatorScope('runtime')
focus-runtime-action -> focusRuntimeAction()
return-runtime-result -> returnRuntimeResultFromProperties()
```

### 163.4 DOM 状态

新增主流程面板：

```html
data-testid="workbench-flow-panel"
data-action-id
data-runtime-sim-log-count
data-runtime-detail-action-id
data-runtime-detail-state-point-id
data-edit-result-state-point-id
```

新增主流程按钮：

```html
data-testid="workbench-flow-open-runtime"
data-testid="workbench-flow-edit-runtime-action"
data-testid="workbench-flow-return-edit-result"
```

### 163.5 验证

Workbench 测试新增覆盖：

- 初始状态下主流程条显示当前动作和 runtime 日志数量。
- 初始状态下 `查看运行结果` 可用，`编辑结果动作` 与 `回到刷新结果` 在缺少对应上下文时禁用。
- 点击 `查看运行结果` 后选中 runtime state point。
- 点击 `编辑结果动作` 后，属性面板动作编辑焦点来源为 `runtime-focus`。
- 修改动作后，主流程条拿到刷新后的 runtime state point。
- 点击 `回到刷新结果` 后，runtime detail 和动作结果行同步到刷新后的 state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、41 条测试。
- `npm run test -- --run`：通过，15 个测试文件、117 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步 UI 主流程能力块应继续围绕完整工作区节奏推进，不再拆成单个状态标签或提示文案阶段。

## 164. UI 主流程能力块：主流程运行结果导航

本阶段属于 UI 主流程。

### 164.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 164.2 WorkbenchFlowPanel 输入变化

`WorkbenchFlowPanel` 新增输入：

```text
selectedStateCurvePointId
```

该字段用于在主流程条内判断当前选中的 runtime state point 位于第几个 applied runtime 结果。

### 164.3 WorkbenchFlowPanel 事件变化

`WorkbenchFlowPanel` 新增事件：

```text
select-runtime-state-point
```

`Workbench.vue` 接线为：

```text
select-runtime-state-point -> selectRuntimeFlowStatePoint()
```

### 164.4 DOM 状态

`workbench-flow-panel` 新增：

```html
data-runtime-navigation-count
data-runtime-navigation-index
data-runtime-next-state-point-id
data-runtime-previous-state-point-id
```

新增主流程运行结果导航：

```html
data-testid="workbench-flow-runtime-navigation"
data-testid="workbench-flow-runtime-navigation-index"
data-testid="workbench-flow-runtime-previous"
data-testid="workbench-flow-runtime-next"
```

### 164.5 运行时点 ID

主流程条复用：

```js
createRuntimeStateCurvePointId(row, point)
```

输入来自：

```text
threeValueRuntimeProjection.simLog[]
threeValueRuntimeProjection.enemyStateCurve.points[]
threeValueRuntimeProjection.selfEnergyCurveByActor[].points[]
```

不新增独立 runtime point ID 规则。

### 164.6 验证

Workbench 测试新增覆盖：

- 默认单 runtime 结果时，导航数量为 1，未选中时索引为 `-/1`，前后按钮禁用。
- 添加资源动作后，主流程条 runtime 导航数量为 2。
- 点击下一个 runtime 结果后，`runtimeSelectedDetail.statePointId` 切到下一个 state point。
- 点击上一个 runtime 结果后，`runtimeSelectedDetail.statePointId` 回到上一个 state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步 UI 主流程能力块应继续围绕完整工作区节奏和编辑体验推进，不再拆成单个状态标签或提示文案阶段。

## 165. UI 主流程能力块：运行结果同步当前动作

本阶段属于 UI 主流程。

### 165.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 165.2 Workbench 主流程接线变化

`WorkbenchFlowPanel` 的运行结果导航事件仍为：

```text
select-runtime-state-point
```

`Workbench.vue` 将主流程条来源的事件接到：

```text
selectRuntimeFlowStatePoint(pointId)
```

该函数先复用既有 `selectRuntimeStatePoint(pointId)` 更新当前 runtime state point，再调用 `selectActionFromRuntimeStatePoint(pointId)` 同步当前动作。

### 165.3 runtime state point 解析

新增 Workbench 内部派生函数：

```text
findRuntimeStatePointContextById(runtimeProjection, statePointId)
selectActionFromRuntimeStatePoint(pointId)
```

解析来源仍是：

```text
threeValueRuntimeProjection.simLog[]
threeValueRuntimeProjection.enemyStateCurve.points[]
threeValueRuntimeProjection.selfEnergyCurveByActor[].points[]
createRuntimeStateCurvePointId(row, point)
```

不新增 runtime point ID 规则，不改变 simulation 输出结构。

### 165.4 行为边界

- `openRuntimeResultsFlow()` 进入 runtime 视角后，会同步当前动作到首条 runtime 结果所属动作。
- 主流程条前后切换 runtime 结果时，会同步当前动作到目标 runtime sim log 的 `actionId`。
- 资源曲线、日志、状态曲线的普通选点仍使用既有 `selectRuntimeStatePoint()` 行为，不强制切换当前动作。

### 165.5 验证

Workbench 测试新增覆盖：

- 添加资源动作后，点击主流程条 `查看运行结果` 会把当前动作切到首条 runtime 结果所属动作。
- 点击主流程条下一个 runtime 结果后，当前动作切到第二条结果所属动作。
- 点击主流程条上一个 runtime 结果后，当前动作回到第一条结果所属动作。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 166. UI 主流程能力块：时间轴下方资源监控区

本阶段属于 UI 主流程。

### 166.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 166.2 Workbench DOM 布局变化

`Workbench.vue` 新增资源监控区域：

```html
data-testid="workbench-resource-area"
```

`ResourceMonitorPanel` 从右侧 `side-stack` 移到该区域中，仍消费原有输入：

```text
resourceTimeline
threeValueRuntimeProjection
selectedStateCurvePointId
runtimeFocusSource
actionEditResultContext
summary
diagnostics
```

事件接线保持不变：

```text
select-runtime-state-point -> selectRuntimeStatePoint()
focus-runtime-action -> focusRuntimeAction()
```

### 166.3 网格区域变化

`workbench-grid` 新增 `resources` grid area：

```text
actions timeline  analysis
actions resources analysis
actions events    analysis
```

窄屏布局也保留 `resources` 区域，移动端顺序为：

```text
actions -> timeline -> resources -> analysis -> events
```

### 166.4 验证

Workbench 测试新增覆盖：

- `workbench-resource-area` 存在。
- `workbench-resource-area` 内包含 `workbench-runtime-resource-monitor`。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 167. UI 主流程能力块：日志详情回看刷新结果

本阶段属于 UI 主流程。

### 167.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 167.2 EventLogPanel 输入变化

`EventLogPanel` 新增输入：

```text
actionEditResultContext
```

该输入来自 `Workbench.vue` 的既有派生上下文，用于判断当前 runtime-focus 编辑是否已经产生刷新后的 runtime state point。

### 167.3 EventLogPanel 事件变化

`EventLogPanel` 新增事件：

```text
return-runtime-result
```

`Workbench.vue` 接线为：

```text
return-runtime-result -> returnRuntimeResultFromProperties()
```

该事件复用既有回看逻辑，不新增平行状态。

### 167.4 DOM 变化

事件日志详情新增回看按钮：

```html
data-testid="workbench-runtime-sim-log-return-result"
data-action-id
data-origin-state-point-id
data-return-status
data-state-point-id
```

当日志详情对应的动作处于 `runtime-focus` 编辑来源，并且 `actionEditResultContext.runtimeStatePointId` 可用时显示。

### 167.5 验证

Workbench 测试新增覆盖：

- 从模拟日志详情点击 `定位动作` 后，编辑焦点进入 `runtime-focus`。
- 修改开始时间后，日志详情回看按钮携带来源 state point 与刷新后 state point。
- 点击日志详情回看按钮后，`RuntimeSelectedDetailPanel` 和模拟日志导航同步到刷新后的 state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 168. UI 主流程能力块：三值详情回看刷新结果

本阶段属于 UI 主流程。

### 168.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 168.2 RuntimeSelectedDetailPanel 输入变化

`RuntimeSelectedDetailPanel` 新增输入：

```text
actionEditResultContext
```

该输入来自 `Workbench.vue` 的既有派生上下文，用于判断三值详情当前对应的 runtime-focus 编辑是否已经产生刷新后的 runtime state point。

### 168.3 RuntimeSelectedDetailPanel 事件变化

`RuntimeSelectedDetailPanel` 新增事件：

```text
return-runtime-result
```

`Workbench.vue` 接线为：

```text
return-runtime-result -> returnRuntimeResultFromProperties()
```

该事件复用既有回看逻辑，不新增平行状态。

### 168.4 DOM 变化

三值详情面板新增回看按钮：

```html
data-testid="workbench-runtime-selected-detail-return-result"
data-action-id
data-origin-state-point-id
data-return-status
data-state-point-id
```

当旧 runtime state point 已随动作编辑失效但刷新结果可用时，三值详情面板仍保留轻量回看上下文：

```html
data-testid="workbench-runtime-selected-detail-return-context"
data-action-id
data-origin-state-point-id
data-state-point-id
```

### 168.5 验证

Workbench 测试新增覆盖：

- 三值详情定位动作前不显示回看入口。
- 修改开始时间后，三值详情回看按钮携带来源 state point 与刷新后 state point。
- 点击三值详情回看按钮后，运行详情、动作结果行和模拟日志导航同步到刷新后的 state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 169. UI 主流程能力块：统一 runtime 回看上下文

本阶段属于 UI 主流程。

### 169.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 169.2 新增共享 helper

新增文件：

```text
src/features/workbench/runtimeResultReturnContext.js
```

导出：

```js
createRuntimeResultReturnContext({
  actionId,
  focus,
  resultContext,
  originStatePointId,
  allowOriginResult,
})
```

输入含义：

- `actionId`：当前入口对应动作。
- `focus`：Workbench 的 `actionEditFocus`。
- `resultContext`：Workbench 的 `actionEditResultContext`。
- `originStatePointId`：当前入口限定的来源 runtime state point；不传时使用 `focus.originStatePointId`。
- `allowOriginResult`：是否允许尚未产生刷新结果时返回来源结果。

返回值仍沿用现有字段：

```text
status
actionId
fieldKey
label
summary
originStatePointId
statePointId
```

### 169.3 接入面板

以下组件改为复用该 helper：

```text
PropertiesPanel.vue
EventLogPanel.vue
RuntimeSelectedDetailPanel.vue
```

`PropertiesPanel` 使用 `allowOriginResult: true`，保留来源结果回看。

`EventLogPanel` 与 `RuntimeSelectedDetailPanel` 只在刷新后结果可用时显示回看入口。

### 169.4 验证

Workbench 测试继续覆盖：

- 属性面板来源结果与刷新后结果回看。
- 日志详情刷新后结果回看。
- 三值详情刷新后结果回看。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 170. UI 主流程能力块：日志详情承接三值详情

本阶段属于 UI 主流程。

### 170.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 170.2 EventLogPanel 派生状态

新增 `runtimeLogDetailHandoff` computed，仅当 `matchedRuntimeSelectedDetail` 存在时返回：

```text
source
statePointId
label
detail
```

`source` 固定为 `runtime-selected-detail`，`statePointId` 来自 `matchedRuntimeSelectedDetail.statePointId`。

### 170.3 DOM 变化

`runtime-log-detail` 内新增：

```html
data-testid="workbench-runtime-sim-log-detail-handoff"
data-detail-source
data-state-point-id
```

当该承接条存在时，以下完整明细块不渲染：

```html
data-testid="workbench-runtime-sim-log-contribution"
data-testid="workbench-runtime-sim-log-source"
data-testid="workbench-runtime-sim-log-calculator"
```

fallback 模式仍保留这些块。

### 170.4 验证

Workbench 测试新增覆盖：

- fallback 模式没有 handoff，完整贡献、来源和适配器明细仍存在。
- runtime-selected-detail 模式显示 handoff，且 handoff state point 等于 selected runtime state point。
- runtime-selected-detail 模式下日志内重复贡献、来源和适配器块不显示。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 171. 生成层能力块：标准 delta 生成入口

本阶段属于生成层。

### 171.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 171.2 新增 generation input

新增文件：

```text
src/simulation/generation/threeValueDeltaGenerationInput.js
```

新增导出：

```js
AZPR_TIMELINE_FRAME_RATE
AZPR_TIMELINE_FRAME_MS
THREE_VALUE_DELTA_GENERATION_TRACK_DEFINITIONS
createThreeValueDeltaGenerationInput()
```

`createThreeValueDeltaGenerationInput()` 优先从以下输入生成标准轨道和层：

```text
actionResultTimeline.hpDamage
actionResultTimeline.toughnessDamage
actionResultTimeline.selfEnergyChange
candidateValueSeries.chart.series
runtimeSampleContext.events
actionResultTimeline.placeholders
```

### 171.3 generation input 结构

返回对象新增：

```text
schemaVersion
sourceKind
status
contractName
frameRate
frameMs
inputSources
sourcePriority
tracks
summary
applied
```

当传入 `actionResultTimeline` / `candidateValueSeries` / `runtimeSampleContext` 时，`sourceKind` 为：

```text
azpr-action-hit-three-value-delta-generation-input
```

没有这些标准输入时，仍可回退读取旧 `stateCurves.tracks`，`sourceKind` 为：

```text
azpr-state-curve-three-value-delta-generation-input
```

### 171.4 三值生成层变化

`createThreeValueGenerationLayer()` 新增标准输入参数：

```js
actionResultTimeline
candidateValueSeries
runtimeSampleContext
```

返回对象新增：

```text
generationInput
inputSourceKind
inputStatus
```

`actions / hits / deltas / summary` 现在由 `generationInput.tracks` 生成。`stateCurves` 只作为兼容回退，不再是 `projectSimulationResult()` 中生成层的主入口。

### 171.5 projection 接线变化

`projectSimulationResult()` 的生成层接线从：

```text
threeValueCurveFramework.stateCurves -> createThreeValueGenerationLayer()
```

改为：

```text
actionResultTimeline + candidateValueSeries + runtimeSampleContext -> createThreeValueGenerationLayer()
```

`threeValueCurveFramework` 继续保留展示、诊断和曲线摘要职责。

### 171.6 验证

新增和继续覆盖：

- 生成层可直接从 action result 与 candidate hit values 生成 applied / candidate / placeholder delta。
- 旧 `stateCurves` 输入仍可作为兼容回退生成标准 delta。
- 第一条真实数据垂直切片继续通过，三值数量和 runtime 汇总保持可用。
- runtime projection 继续只消费标准 generation deltas 的 applied 部分。
- `npm run test -- --run src/__tests__/simulation/threeValueGenerationLayer.test.js`：通过，1 个测试文件、2 条测试。
- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js`：通过，1 个测试文件、1 条测试。
- `npm run test -- --run`：通过，15 个测试文件、119 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 172. 运行时层能力块：标准 delta 消费边界

本阶段属于运行时层。

### 172.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 172.2 新增 runtime input

新增文件：

```text
src/simulation/runtime/threeValueRuntimeInput.js
```

新增导出：

```js
createThreeValueRuntimeInput()
```

输入：

```text
threeValueGenerationLayer
```

输出：

```text
schemaVersion
sourceKind
status
contractName
inputSourceKind
inputStatus
appliedOnly
deltas
appliedDeltas
ignoredDeltaCount
summary
applied
```

`appliedDeltas` 只包含 `threeValueGenerationLayer.deltas` 中 `applied === true` 的标准 delta，并在进入 runtime 前补 `runtimeSequenceIndex` 与数值归一化。

### 172.3 runtime projection 新字段

`createThreeValueRuntimeProjection()` 返回对象新增：

```text
runtimeInput
stateCurves
resourceCurves
```

兼容保留：

```text
enemyStateCurve
selfEnergyCurveByActor
simLog
summary
```

### 172.4 stateCurves / resourceCurves 结构

`stateCurves`：

```text
sourceKind
status
enemy
resources
summary
applied
```

其中：

```text
enemy = enemyStateCurve
resources = resourceCurves
```

`resourceCurves`：

```text
sourceKind
status
resourceKind
curvesByActor
summary
applied
```

其中：

```text
resourceKind = selfEnergy
curvesByActor = selfEnergyCurveByActor
```

### 172.5 summary 新增字段

`threeValueRuntimeProjection.summary` 新增：

```text
runtimeInputStatus
runtimeInputSourceKind
runtimeInputIgnoredDeltaCount
resourceCurveActorCount
activeResourceCurveActorCount
resourceCurvePointCount
runtimeInputSource
```

既有字段 `source = threeValueGenerationLayer.applied-deltas` 保留，用于兼容现有 UI 和测试。

### 172.6 simLog / point 新增字段

`simLog[]` 和 runtime point 新增：

```text
runtimeSequenceIndex
```

该字段来自 `runtimeInput.appliedDeltas[]`，用于标识 runtime 消费 applied delta 的顺序。

### 172.7 验证

新增和继续覆盖：

- runtime input 只消费 applied delta，candidate delta 进入 ignored 统计。
- `stateCurves` 汇总敌人 HP/韧性与资源曲线。
- `resourceCurves.curvesByActor` 与既有 `selfEnergyCurveByActor` 保持同源。
- `simLog[]` 暴露 `runtimeSequenceIndex`，且不包含 candidate delta。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js`：通过，1 个测试文件、1 条测试。
- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、55 条测试。

## 173. UI 主流程能力块：runtime 点位统一入口

本阶段属于 UI 主流程。

### 173.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 173.2 新增 Workbench helper

新增文件：

```text
src/features/workbench/runtimeProjectionPoints.js
```

导出：

```js
getRuntimeEnemyStateCurve()
getRuntimeResourceCurveRows()
createRuntimeProjectionPoints()
createRuntimePointByDeltaId()
```

### 173.3 runtime projection 读取优先级

敌人状态曲线读取顺序：

```text
runtimeProjection.stateCurves.enemy
runtimeProjection.enemyStateCurve
```

资源曲线读取顺序：

```text
runtimeProjection.resourceCurves.curvesByActor
runtimeProjection.selfEnergyCurveByActor
```

### 173.4 接入范围

以下 Workbench 模块改为复用该 helper：

```text
Workbench.vue
WorkbenchFlowPanel.vue
ResourceMonitorPanel.vue
RuntimeSelectedDetail runtimeSelectedDetail.js
EventLogPanel.vue
AnalysisPanel.vue
```

影响路径：

```text
主流程导航 state point
资源曲线点位
日志 state point 映射
分析 trace 映射
右侧三值详情点位
Workbench 顶层 runtime point 定位
```

### 173.5 验证

新增和继续覆盖：

- helper 优先消费 `stateCurves/resourceCurves`，旧字段只作为兼容回退。
- Workbench 主流程、资源曲线、日志详情、分析追踪和右侧三值详情继续通过既有主流程测试。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、43 条测试。
- `npm run test -- --run`：通过，16 个测试文件、120 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 174. UI 主流程能力块：当前动作优先打开运行结果

本阶段属于 UI 主流程。

### 174.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 174.2 Workbench 事件行为变化

`openRuntimeResultsFlow()` 的 runtime state point 选择顺序从：

```text
全局第一个 runtime simLog 点
```

调整为：

```text
当前 selectedActionId 对应的第一个 runtime state point
全局第一个 runtime simLog 点兜底
```

### 174.3 复用函数

优先查找当前动作结果使用既有：

```js
findFirstRuntimeStatePointForAction(runtimeProjection, actionId)
```

选中后继续复用：

```js
selectRuntimeFlowStatePoint(statePointId)
```

因此动作选择、state curve focus、runtime detail 和主流程导航仍走同一条路径。

### 174.4 验证

Workbench 测试更新覆盖：

- 选中追加的资源动作后，`查看运行结果` 直接定位到该动作的 runtime 点。
- 主流程前后导航仍会同步切换 selected action 和 runtime selected detail。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，16 个测试文件、120 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 175. UI 主流程能力块：无结果动作进入运行总览

本阶段属于 UI 主流程。

### 175.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 175.2 Workbench 事件行为变化

`openRuntimeResultsFlow()` 的选择策略调整为：

```text
当前 selectedActionId 有 runtime state point -> 选中该 state point
当前 selectedActionId 没有 runtime state point -> 进入 runtime 视角总览，保留 selectedActionId
```

无结果动作不再回退选中其他动作的第一个 runtime point。

### 175.3 focusThreeValueCalculatorScope 参数

`focusThreeValueCalculatorScope()` 新增可选参数：

```js
focusThreeValueCalculatorScope(scope, { selectFirstRuntimePoint = true } = {})
```

当：

```text
scope = runtime
selectFirstRuntimePoint = false
```

会启用 runtime 视角的 applied 层筛选，但不自动选择第一个 runtime state point。

### 175.4 验证

Workbench 测试新增覆盖：

- 选中等待动作后点击 `查看运行结果`，selected action 保持等待动作。
- runtime 导航保留结果总数，runtime detail 保持未选中。
- 当前动作有 runtime 结果时仍优先打开当前动作结果。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、43 条测试。
- `npm run test -- --run`：通过，16 个测试文件、121 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 176. UI 主流程能力块：运行总览结果巡检入口

本阶段属于 UI 主流程。

### 176.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 176.2 WorkbenchFlowPanel prop

`WorkbenchFlowPanel` 新增 prop：

```js
runtimeOverviewActive
```

Workbench 传入条件：

```text
calculatorDiagnosticScope === runtime
selectedStateCurvePointId 为空
```

### 176.3 DOM 标记

`workbench-flow-panel` 新增：

```html
data-runtime-overview-active
```

用于测试和主流程状态识别。

### 176.4 导航规则

普通选中态保持原规则：

```text
previous = 当前结果前一项
next = 当前结果后一项
```

runtime 总览态且未选中具体结果点时：

```text
previous = 最后一项 runtime navigation point
next = 第一项 runtime navigation point
```

非 runtime 总览态且未选中结果点时，仍不启用前后导航。

### 176.5 验证

Workbench 测试新增覆盖：

- 等待动作进入 runtime 总览后 `data-runtime-overview-active = true`。
- 总览态下一结果按钮可进入第一条 runtime state point。
- 进入具体结果后恢复普通 runtime 导航并同步 selected action。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、43 条测试。
- `npm run test -- --run`：通过，16 个测试文件、121 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 177. UI 主流程能力块：编辑后回到同类运行结果

本阶段属于 UI 主流程。

### 177.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 177.2 Runtime 点查找入口

`runtimeProjectionPoints.js` 新增统一查找入口：

```js
findFirstRuntimeStatePointForAction(runtimeProjection, actionId, {
  preferredTrackKey,
});
```

该入口按动作筛选 runtime simLog，并优先返回 `preferredTrackKey` 对应的 runtime point；偏好曲线不存在时回退到该动作按帧序排序后的第一个 runtime point。

### 177.3 Workbench 回跳规则

`createActionEditResultContext()` 会把运行结果编辑来源中的 `originTrackKey` 传给 runtime 点查找入口，使编辑后的“回到刷新结果”优先回到来源曲线类型。

### 177.4 验证

- runtime 点查找单元测试覆盖：默认第一个结果、优先匹配来源曲线、偏好缺失时回退。
- Workbench 测试覆盖：从资源动作自身能量结果进入编辑，修改开始时间后回到刷新后的自身能量结果。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js`：通过，1 个测试文件、2 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、44 条测试。
- `npm run test -- --run`：通过，16 个测试文件、123 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 178. UI 主流程能力块：再次模拟后巡检顺序刷新

本阶段属于 UI 主流程。

### 178.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 178.2 Runtime state point context

`runtimeProjectionPoints.js` 新增统一上下文入口：

```js
createRuntimeStatePointContexts(runtimeProjection);
```

返回项结构沿用现有运行结果点语义：

```js
{
  row,
  point,
  statePointId,
}
```

该入口从 `runtimeProjection.simLog` 和 runtime 曲线点创建可巡检的 state point context，并统一按 `frameIndex`、`sequenceIndex`、`sourceDeltaId` 排序。

### 178.3 消费方

- `WorkbenchFlowPanel` 的前后巡检直接消费 `createRuntimeStatePointContexts()`。
- `Workbench` 的 runtime 首点选择与 `statePointId` 反查也消费同一入口。
- `findFirstRuntimeStatePointForAction()` 改为复用该入口，再执行 action 和 `preferredTrackKey` 筛选。

### 178.4 验证

- runtime 点查找单元测试覆盖：乱序 `simLog` 会按帧序生成巡检上下文。
- Workbench 测试覆盖：两个 runtime 结果中，把第一个动作推迟到第二个动作之后，回到刷新结果时主流程导航位置更新为第 2 项。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js`：通过，1 个测试文件、3 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、45 条测试。
- `npm run test -- --run`：通过，16 个测试文件、125 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 179. UI 主流程能力块：跨面板结果回跳统一

本阶段属于 UI 主流程。

### 179.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 179.2 EventLogPanel 消费 runtime context

`EventLogPanel` 不再本地组合 `createRuntimeStateCurvePointId(row, point)`，而是通过：

```js
createRuntimeStatePointContexts(runtimeProjection)
```

取得 `row`、`point`、`statePointId`。模拟日志筛选、选中行、详情来源、日志导航、动作定位和结果回跳都复用同一份 runtime context。

编辑来源来自 runtime 结果时，日志回跳上下文优先使用 `actionEditResultContext.actionId`，避免再次模拟后日志顺序变化导致回跳入口丢失。

### 179.3 ResourceMonitorPanel 消费 runtime context

`ResourceMonitorPanel` 的曲线点 `statePointId` 优先从 runtime context 的 `sourceDeltaId` 映射取得；资源曲线前后巡检优先按 runtime context 顺序排序，再回退到曲线点自身排序。

### 179.4 验证

- Workbench 测试覆盖：从模拟日志第一条结果进入编辑，把动作推迟到第二个结果之后，回到刷新结果时日志导航和资源曲线导航都更新为第 2 项。
- 既有日志详情定位动作、资源曲线点定位详情/动作测试继续通过。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js`：通过，1 个测试文件、3 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、46 条测试。
- `npm run test -- --run`：通过，16 个测试文件、126 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 180. UI 主流程能力块：Action Result trace 统一

本阶段属于 UI 主流程。

### 180.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 180.2 AnalysisPanel runtime trace 来源

`AnalysisPanel` 的 Action Result runtime trace 改为从：

```js
createRuntimeStatePointContexts(runtimeProjection)
```

取得 `row`、`point`、`statePointId`，再按 `actionId` 分组生成 Action Result trace 和贡献拆分。`AnalysisPanel` 不再本地使用 `createRuntimePointByDeltaId()` 与 `createRuntimeStateCurvePointId()` 重建 runtime state point。

### 180.3 最近编辑反馈结果点

`AnalysisPanel` 新增消费 `actionEditResultContext`，最近编辑反馈的刷新后结果点优先使用 Workbench 已解析的 `runtimeStatePointId`，再回退到该动作 trace 的第一条结果。

### 180.4 验证

- Workbench 测试覆盖：从模拟日志进入编辑并触发再次模拟后，Action Result 行、贡献拆分行、贡献详情、日志导航、资源曲线和最近编辑反馈都指向同一个刷新后结果点。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、46 条测试。
- `npm run test -- --run`：通过，16 个测试文件、126 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 181. UI 主流程能力块：运行详情同源化

本阶段属于 UI 主流程。

### 181.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 181.2 RuntimeSelectedDetail 来源

`runtimeSelectedDetail.js` 改为通过：

```js
createRuntimeStatePointContexts(runtimeProjection)
```

确认当前选中 `statePointId` 对应的 runtime context，再用该 context 提供的 `row` 作为 `simLogRow`。详情面板仍保留每点累计值、状态值、溢出值等展示补全，但不再自行重建 simLog 与曲线点映射。

### 181.3 ResourceMonitorPanel 兜底收束

`ResourceMonitorPanel` 不再用 `createRuntimeStateCurvePointId(point, point)` 为资源曲线点兜底生成 runtime id；没有进入统一 runtime context 的点不会作为可选 runtime 结果点参与主流程巡检。

### 181.4 验证

- 新增 `runtimeSelectedDetail.test.js` 覆盖：乱序 `simLog` 下，三值详情通过统一 runtime context 解析正确状态点、simLog 行、累计值和状态值。
- 搜索确认主流程组件中直接拼接 runtime state point id 的调用已收敛到 `runtimeProjectionPoints.js` 统一入口。
- `npm run test -- --run src/__tests__/features/runtimeSelectedDetail.test.js`：通过，1 个测试文件、1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、46 条测试。
- `npm run test -- --run`：通过，17 个测试文件、127 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 182. UI 主流程能力块：详情编辑重排回跳闭环

本阶段属于 UI 主流程。

### 182.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 182.2 RuntimeSelectedDetailPanel 返回上下文

`RuntimeSelectedDetailPanel` 继续通过 `createRuntimeResultReturnContext()` 生成结果回跳上下文，但只在当前详情点仍等于编辑来源点时把 `detail.statePointId` 作为 `originStatePointId` 参与校验。编辑后如果 runtime 重新排序或刷新状态点，回跳上下文会回退到 `actionEditFocus.originStatePointId` 与 `actionEditResultContext.runtimeStatePointId` 的标准链路，避免旧详情点和刷新结果点互相打断。

### 182.3 验证

- Workbench 测试覆盖：两个 runtime 结果中，从第一条三值详情进入动作编辑，把动作推迟到第二条结果之后，再从详情面板回到刷新结果；主流程巡检、模拟日志、资源曲线和 Action Result 指向同一个刷新后 `statePointId`。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "keeps runtime detail return synced"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、47 条测试。
- `npm run test -- --run`：通过，17 个测试文件、128 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 183. UI 主流程能力块：直接编辑结果入口统一

本阶段属于 UI 主流程。

### 183.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 183.2 Workbench actionEditResultContext 范围

`Workbench` 顶层 `createActionEditResultContext()` 不再只接受 `runtime-focus` 来源。只要 `actionEditSource.actionId` 有对应 runtime 结果，就会通过：

```js
findFirstRuntimeStatePointForAction(runtimeProjection, source.actionId)
```

解析刷新后的 `runtimeStatePointId`，供主流程条、资源曲线、日志/详情和分析面板共享。

### 183.3 AnalysisPanel 接线

`Workbench.vue` 显式把 `actionEditResultContext` 传入 `AnalysisPanel`。这样 AnalysisPanel 的最近编辑反馈优先使用 Workbench 顶层解析的结果点，不再只依赖自身 trace fallback。

### 183.4 验证

- Workbench 测试覆盖：未从 runtime 反向定位时，直接把当前动作等级从 1 改到 2，主流程条获得刷新后的 `runtimeStatePointId`；点击回到刷新结果后，三值详情和 Action Result 指向同一个 runtime state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "opens the refreshed runtime result"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、48 条测试。
- `npm run test -- --run`：通过，17 个测试文件、129 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 184. UI 主流程能力块：运行视角动作选择同步

本阶段属于 UI 主流程。

### 184.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 184.2 Workbench selectAction 运行视角策略

`Workbench.selectAction()` 新增可选参数：

```js
{ syncRuntimeResult = true }
```

当当前视角已经选中 runtime state point，或处于 runtime overview 时，用户直接选择另一个动作会调用 `findFirstRuntimeStatePointForAction()` 找到该动作的首个 runtime 结果，并同步主流程条、三值详情、资源曲线和模拟日志。

以下从 runtime state point 反向选中动作的路径显式传入 `syncRuntimeResult: false`，避免覆盖用户当前选中的结果点：

```js
selectActionResult()
returnRuntimeResultFromProperties()
focusRuntimeAction()
focusActionEditSource()
selectActionFromRuntimeStatePoint()
```

### 184.3 验证

- Workbench 测试覆盖：添加资源动作并进入运行结果视角后，点击时间轴上的第一个动作，主流程条、三值详情、资源曲线和模拟日志都同步到第一个动作的 runtime state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "syncs runtime detail when selecting"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、49 条测试。
- `npm run test -- --run`：通过，17 个测试文件、130 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 185. UI 主流程能力块：运行视角新增动作同步

本阶段属于 UI 主流程。

### 185.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 185.2 addInsertedAction 运行视角策略

`Workbench.addInsertedAction()` 在写入新动作前记录当前是否处于 runtime 结果视角。新动作插入并成为当前动作后，如果原本处于 runtime 结果视角，则调用：

```js
syncRuntimeResultForSelectedAction(nextAction.id)
```

这样新增有 runtime 结果的动作会直接同步到其结果点；新增等待、备注等无 runtime 结果动作时，会进入 runtime overview，并清掉旧动作的三值详情与资源曲线选点。

### 185.3 验证

- Workbench 测试覆盖：进入默认动作运行结果后新增等待动作，当前动作切到等待动作，主流程进入 runtime overview，旧三值详情和旧资源曲线选点被清空。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "clears stale runtime detail"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、50 条测试。
- `npm run test -- --run`：通过，17 个测试文件、131 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 186. UI 主流程能力块：运行视角删除动作同步

本阶段属于 UI 主流程。

### 186.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 186.2 deleteAction / deleteActionBatch 运行视角策略

`Workbench.deleteAction()` 和 `Workbench.deleteActionBatch()` 在删除前记录：

```js
shouldSyncRuntimeAfterDelete
selectedRuntimeActionId
selectedWasRemoved
selectedRuntimeWasRemoved
```

删除后，如果当前动作或当前 runtime 结果所属动作被移除，则调用：

```js
syncRuntimeResultForSelectedAction(selectedActionId.value)
```

这样主流程会切到新的当前动作结果；如果新动作没有 runtime 结果，则进入 runtime overview。

### 186.3 验证

- Workbench 测试覆盖：添加资源动作并进入第二个动作的运行结果后，删除该动作，主流程条、三值详情、资源曲线和模拟日志都会同步到剩余第一个动作的 runtime state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "syncs runtime detail after deleting"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、51 条测试。
- `npm run test -- --run`：通过，17 个测试文件、132 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 187. UI 主流程能力块：运行视角复制动作同步

本阶段属于 UI 主流程。

### 187.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 187.2 copyAction 运行视角策略

`Workbench.copyAction()` 在复制前记录当前是否处于 runtime 结果视角。副本动作写入并成为当前动作后，如果原本处于 runtime 结果视角，则调用：

```js
syncRuntimeResultForSelectedAction(nextAction.id)
```

这样复制出的动作会立即定位到自己的 runtime 结果点，主流程条、三值详情、资源曲线、模拟日志和 Action Result 使用同一个刷新后的 `statePointId`。

### 187.3 验证

- Workbench 测试覆盖：进入默认动作运行结果后复制该动作，当前动作切到 `action-0002`，runtime 巡检位置切到第 2 项，三值详情、资源曲线、模拟日志和 Action Result 都指向新副本的 runtime state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "syncs runtime detail after copying"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、52 条测试。
- `npm run test -- --run`：通过，17 个测试文件、133 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 188. UI 主流程能力块：运行视角批量动作移动同步

本阶段属于 UI 主流程。

### 188.1 保存结构

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

### 188.2 shiftActionBatch / alignActionBatch 运行视角策略

`Workbench.shiftActionBatch()` 在批量移动前记录：

```js
shouldSyncRuntimeAfterBatchShift
selectedRuntimeActionId
selectedActionInBatch
selectedRuntimeActionInBatch
```

批量动作整体偏移后，如果当前动作或当前 runtime 结果所属动作在该批次中，则调用：

```js
syncRuntimeResultForSelectedAction(actionId)
```

`Workbench.alignActionBatch()` 继续委托 `shiftActionBatch()`，因此批量对齐起点也复用同一套 runtime 同步规则。

### 188.3 验证

- Workbench 测试覆盖：通过草稿恢复生成批次后进入第一个动作运行结果，点击批次 `+30f`，当前动作起点变为 `500ms`，主流程条、三值详情、资源曲线、模拟日志和 Action Result 都同步到新的 runtime state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "syncs runtime detail after shifting"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、53 条测试。
- `npm run test -- --run`：通过，17 个测试文件、134 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 189. 生成层能力块：Action/Hit/Delta 标准合同入口

本阶段属于生成层。

### 189.1 结构变化

`threeValueGenerationLayer` 新增顶层字段：

```js
{
  standardContract,
  hits
}
```

`standardContract` 是生成层的统一消费入口，结构为：

```js
{
  schemaVersion: 1,
  sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
  status,
  name: 'Action -> Hit -> ThreeValueDelta',
  version: 1,
  topology: ['Action', 'Hit', 'ThreeValueDelta'],
  keyFields: {
    action: ['actionId'],
    hit: ['actionId', 'hitKey', 'frameIndex', 'timeMs'],
    delta: ['id']
  },
  deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
  actions,
  hits,
  deltas,
  summary
}
```

`hits` 是从 `actions[].hits` 拉平出的命中列表，每个命中保留 `actionId`、`hitKey`、帧时间、层/轨道集合、`deltaIds` 和对应 `deltas`。

### 189.2 运行时消费策略

`createThreeValueRuntimeInput()` 现在优先读取：

```js
threeValueGenerationLayer.standardContract.deltas
```

如果旧结构没有 `standardContract`，则回退到既有 `threeValueGenerationLayer.deltas`，保持兼容。

runtime 仍只应用 `applied=true` 的 delta；candidate、sampled、placeholder 保留在合同中用于追溯和诊断，不改变运行总值。

### 189.3 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化影响的是模拟结果结构：调用方可以继续读取既有 `threeValueGenerationLayer.actions` / `deltas`，也可以改为读取新的 `standardContract` / `hits`。

### 189.4 验证

- 生成层测试覆盖：`standardContract` 暴露 Action/Hit/ThreeValueDelta 拓扑、keyFields、deltaFields，并复用同一组 actions/hits/deltas。
- runtime 测试覆盖：当顶层 `deltas` 为空但 `standardContract.deltas` 存在时，runtime input 仍能生成 simLog、stateCurves 和 summary。
- 第一纵切测试覆盖：真实 Workbench 模拟结果带有 1 动作、6 命中、16 delta 的标准合同；runtime 从合同接入后仍只应用 1 个 HP delta。
- `npm run test -- --run src/__tests__/simulation/threeValueGenerationLayer.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，3 个测试文件、17 条测试。

## 190. 生成层能力块：Generation Builder 收口

本阶段属于生成层。

### 190.1 结构变化

新增 `createThreeValueGenerationBundle()`，作为生成层统一 builder。模拟结果新增：

```js
{
  threeValueGenerationBundle,
  summary: {
    threeValueGenerationBundleSummary
  }
}
```

`threeValueGenerationBundle` 结构为：

```js
{
  schemaVersion: 1,
  sourceKind: 'azpr-three-value-generation-builder-bundle',
  status,
  contractName: 'Action -> Hit -> ThreeValueDelta',
  threeValueGenerationLayer,
  standardContract,
  runtimeInputSource,
  actions,
  hits,
  deltas,
  summary
}
```

其中 `runtimeInputSource` 只描述 runtime 应消费的标准合同入口：

```js
{
  sourceKind: 'azpr-runtime-input-source-from-generation-builder',
  contractName: 'Action -> Hit -> ThreeValueDelta',
  standardContract,
  deltas,
  summary
}
```

### 190.2 投影层接线

`projectSimulationResult` 现在调用：

```js
createThreeValueGenerationBundle(...)
```

再从 bundle 中取得：

```js
threeValueGenerationBundle.threeValueGenerationLayer
```

供现有 runtime projection 使用。这样投影层不再直接调用 `createThreeValueGenerationLayer()`，后续可以继续把 runtime 消费入口切到 `runtimeInputSource` / `standardContract`。

### 190.3 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化影响的是模拟结果结构：既有 `threeValueGenerationLayer` 仍保留；新增 `threeValueGenerationBundle` 用于后续运行时层和 UI 层收敛入口。

### 190.4 验证

- builder 测试覆盖：`createThreeValueGenerationBundle()` 同时返回 generation layer、standard contract、runtime input source、actions/hits/deltas，并保持引用一致。
- 第一纵切测试覆盖：真实 Workbench 模拟结果暴露 `threeValueGenerationBundle` 与 `threeValueGenerationBundleSummary`；三值结果仍为 1 动作、6 命中、16 delta，runtime 只应用 1 个 HP delta。
- `npm run test -- --run src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、14 条测试。

## 191. 运行时层能力块：runtimeInputSource 直连

本阶段属于运行时层。

### 191.1 结构变化

`createThreeValueRuntimeInput()` 新增一等输入：

```js
createThreeValueRuntimeInput({
  runtimeInputSource,
  threeValueGenerationLayer
})
```

`runtimeInputSource` 优先级高于 `threeValueGenerationLayer`。当它存在时，runtime input 返回：

```js
{
  sourceKind: 'azpr-runtime-input-from-generation-builder-source',
  runtimeInputSourceKind,
  runtimeInputSourceStatus,
  generationLayerSourceKind,
  generationLayerStatus,
  inputSourceKind,
  inputStatus,
  appliedDeltas,
  summary
}
```

`summary` 同步增加：

```js
{
  runtimeInputSourceKind,
  runtimeInputSourceStatus,
  generationLayerSourceKind,
  generationLayerStatus,
  standardContractSourceKind,
  standardContractStatus,
  inputDeltaCount,
  appliedDeltaCount
}
```

### 191.2 投影层接线

`createThreeValueRuntimeProjection()` 新增可选输入：

```js
createThreeValueRuntimeProjection({
  scenario,
  runtimeInputSource,
  threeValueGenerationLayer
})
```

当 `runtimeInputSource` 存在时，runtime projection 的来源变为：

```js
{
  sourceKind: 'azpr-runtime-projection-from-runtime-input-source',
  status: 'runtime-projection-ready-from-runtime-input-source',
  summary: {
    source: 'runtimeInputSource.applied-deltas'
  }
}
```

`projectSimulationResult` 现在传入：

```js
runtimeInputSource: threeValueGenerationBundle.runtimeInputSource
```

旧的 `threeValueGenerationLayer` 参数仍保留为兼容回退。

### 191.3 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化影响的是模拟结果结构和 runtime 输入路径：既有 `threeValueRuntimeProjection.runtimeInput.appliedDeltas` 仍保留；新增来源字段用于明确运行时来自 generation builder 的标准合同入口。

### 191.4 验证

- runtime 测试覆盖：当 `threeValueGenerationLayer.deltas` 为空但 `runtimeInputSource.deltas` 存在时，runtime projection 仍能输出 simLog、敌人状态曲线、资源曲线和 summary。
- 第一纵切测试覆盖：真实 Workbench 模拟结果的 runtime 来源已切到 `runtimeInputSource.applied-deltas`，三值结果仍为 1 动作、6 命中、16 delta，runtime 只应用 1 个 HP delta。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、16 条测试。

## 192. 运行时层能力块：Runtime Output Contract

本阶段属于运行时层。

### 192.1 结构变化

`threeValueRuntimeProjection` 新增：

```js
{
  outputContract
}
```

`outputContract` 结构为：

```js
{
  schemaVersion: 1,
  sourceKind: 'azpr-three-value-runtime-output-contract',
  status,
  inputContractName,
  inputSourceKind,
  runtimeInputSourceKind,
  outputNames: ['simLog', 'stateCurves', 'resourceCurves', 'summary'],
  outputs: {
    simLog,
    stateCurves,
    resourceCurves,
    summary
  },
  summary
}
```

`outputs.simLog` 声明运行日志输出的 key 字段、值字段和 calculator 字段。

`outputs.stateCurves` 声明敌人 HP/韧性状态曲线和资源状态曲线的输出边界。

`outputs.resourceCurves` 声明 `curvesByActor`、actor key、point key 和自身能量值字段。

`outputs.summary` 声明 runtime summary 的值字段、计数字段和来源字段。

### 192.2 summary 扩展

`threeValueRuntimeProjection.summary` 新增：

```js
{
  runtimeOutputContractSourceKind,
  runtimeOutputContractStatus,
  runtimeOutputContractOutputCount
}
```

### 192.3 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化影响的是模拟结果结构：既有 `simLog`、`stateCurves`、`resourceCurves`、`enemyStateCurve`、`selfEnergyCurveByActor`、`summary` 仍保留；新增 `outputContract` 供 UI 和后续运行时层按合同读取输出边界。

### 192.4 验证

- runtime 测试覆盖：output contract 暴露 `simLog`、`stateCurves`、`resourceCurves`、`summary` 四类输出，并记录关键字段、值字段、来源和计数摘要。
- 第一纵切测试覆盖：真实 Workbench 模拟结果暴露 runtime output contract；三值结果仍为 1 动作、6 命中、16 delta，runtime 只应用 1 个 HP delta。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、16 条测试。

## 193. UI 主流程能力块：Runtime Output Contract 读取入口

本阶段属于 UI 主流程。

### 193.1 结构变化

`runtimeProjectionPoints` 新增 UI 读取 helper：

```js
{
  getRuntimeOutputContract,
  getRuntimeOutputContractOutput,
  getRuntimeOutputSummary,
  getRuntimeSimLogRows,
  getRuntimeSimLogCount
}
```

这些 helper 让 Workbench UI 优先读取 `threeValueRuntimeProjection.outputContract` 的输出边界和计数摘要，再回退到既有字段：

```js
{
  summary,
  simLog,
  stateCurves.enemy,
  resourceCurves.curvesByActor,
  enemyStateCurve,
  selfEnergyCurveByActor
}
```

`WorkbenchFlowPanel` 和 `ResourceMonitorPanel` 已改为通过该 helper 读取 runtime summary / simLog count。状态曲线和资源曲线仍返回 runtime projection 的真实输出数据，不把 output contract 元数据当作曲线点使用。

### 193.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 UI 对 runtime projection 的读取入口：既有 `summary`、`simLog`、`stateCurves`、`resourceCurves` 和兼容字段仍可读取；新增 helper 作为后续 Workbench 主流程统一消费 runtime 输出合同的入口。

### 193.3 验证

- Workbench helper 测试覆盖：UI 计数优先读取 output contract，实际日志行和曲线点仍来自 runtime projection 输出。
- Workbench 视图测试覆盖：主流程面板和资源曲线面板在接入 helper 后保持现有行为。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、57 条测试。
- `npm run test -- --run`：通过，18 个测试文件、138 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 194. UI 主流程能力块：运行结果点定位动作

本阶段属于 UI 主流程。

### 194.1 结构变化

`Workbench` 的运行结果选择入口收敛为：

```js
selectRuntimeStatePoint(pointId)
```

该入口现在会同时执行：

```js
selectStateCurvePoint(pointId)
selectActionFromRuntimeStatePoint(pointId)
```

因此通过资源曲线、模拟日志、分析定位或 runtime 视角自动选择进入的 runtime state point，会同步选中该结果点来源动作。`selectRuntimeFlowStatePoint()` 不再单独重复执行动作同步。

`focusThreeValueCalculatorScope('runtime')` 在自动选择第一个运行结果时，也改为通过 `selectRuntimeStatePoint()` 进入同一套选择路径。

### 194.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 当前选择状态：`selectedStateCurvePointId` 和 `selectedActionId` 在 runtime 结果视角下保持同源，不改变模拟结果、三值计算或持久化项目文件。

### 194.3 验证

- Workbench 测试覆盖：当当前选中第二个动作时，点击第一个动作的运行曲线点会同步选中 `action-0001`；继续导航到下一个运行结果会同步选中 `action-0002`。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "links runtime resource curve points"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、53 条测试。
- `npm run test -- --run`：通过，18 个测试文件、138 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 195. UI 主流程能力块：Workbench Flow Model

本阶段属于 UI 主流程。

### 195.1 结构变化

新增 `src/features/workbench/workbenchFlowModel.js`，提供：

```js
{
  WORKBENCH_FLOW_PHASES,
  createWorkbenchFlowModel
}
```

`createWorkbenchFlowModel()` 统一接收：

```js
{
  selectedAction,
  runtimeProjection,
  runtimeSelectedDetail,
  selectedStateCurvePointId,
  runtimeFocusSource,
  runtimeOverviewActive,
  actionEditResultContext
}
```

并输出：

```js
{
  phase,
  selectedActionId,
  selectedActionName,
  selectedStateCurvePointId,
  runtimeFocusSource,
  runtimeOverviewActive,
  runtimeSummary,
  runtimeSimLogCount,
  runtimeDetail,
  editResult,
  runtimeNavigation,
  controls
}
```

`phase` 当前用于区分：

```js
[
  'action-edit',
  'runtime-overview',
  'runtime-result',
  'edit-result-ready',
  'edit-result-review'
]
```

`Workbench.vue` 在页面层生成 `workbenchFlowModel` 并传入 `WorkbenchFlowPanel`。`WorkbenchFlowPanel` 现在优先消费 `flowModel`，只在未传入时回退本地构造。

### 195.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的主流程派生状态：运行导航、当前结果、刷新结果和控制可用性由统一 flow model 提供；模拟结果、三值计算、项目文件和 runtime projection 结构不变。

### 195.3 验证

- flow model 测试覆盖：主流程 phase、运行导航、当前 runtime 结果、编辑后刷新结果和按钮可用性。
- Workbench 视图测试覆盖：初始编辑态、打开运行结果、编辑后刷新结果、返回刷新结果时，主流程面板 phase 与现有 UI 闭环一致。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js -t "flow model|drives the edit-runtime-return loop|renders the first real-data"`：通过，2 个测试文件、5 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、53 条测试。
- `npm run test -- --run`：通过，19 个测试文件、141 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 196. UI 主流程能力块：Runtime Panels 接入 Flow Model

本阶段属于 UI 主流程。

### 196.1 结构变化

`createWorkbenchFlowModel()` 的输出继续扩展：

```js
{
  runtimeFocusSource,
  editResult: {
    source,
    status,
    actionId,
    statePointId,
    runtimeStatePointId,
    changeSummary,
    originStatePointId,
    originTrackKey,
    originFrameLabel,
    label,
    canReturn
  }
}
```

`runtimeStatePointId` 作为兼容字段保留，`statePointId` 作为 flow model 内部统一字段使用。

以下 Workbench 面板新增可选 `flowModel` prop，并优先消费 flow model：

```js
ResourceMonitorPanel
EventLogPanel
RuntimeSelectedDetailPanel
```

`ResourceMonitorPanel` 现在通过 flow model 读取：

```js
{
  selectedStateCurvePointId,
  runtimeFocusSource,
  editResult
}
```

用于资源曲线点选中、定位来源和刷新后结果匹配。

`EventLogPanel` 现在通过 flow model 读取：

```js
{
  selectedStateCurvePointId,
  runtimeFocusSource,
  editResult
}
```

用于日志筛选摘要、日志选中、导航状态和返回刷新结果。

`RuntimeSelectedDetailPanel` 现在通过 flow model 的 `editResult` 生成返回上下文。

`createRuntimeResultReturnContext()` 兼容 `resultContext.statePointId`，不再只接受旧的 `runtimeStatePointId`。

### 196.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的派生主流程状态：资源曲线、模拟日志和三值详情面板从同一个 flow model 获取当前 phase / state point / edit result 语义；模拟结果、三值计算、项目文件和 runtime projection 结构不变。

### 196.3 验证

- flow model 测试覆盖：`runtimeFocusSource` 和标准化 `editResult.statePointId/runtimeStatePointId` 保持一致。
- Workbench 视图测试覆盖：打开运行结果、编辑结果动作、返回刷新结果时，资源曲线、模拟日志、三值详情与主流程条处于同一 flow phase / state point。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js -t "flow model|drives the edit-runtime-return loop|links runtime resource curve points"`：通过，2 个测试文件、5 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、53 条测试。
- `npm run test -- --run`：通过，19 个测试文件、141 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 197. UI 主流程能力块：AnalysisPanel 接入 Flow Model

本阶段属于 UI 主流程。

### 197.1 结构变化

`AnalysisPanel` 新增可选 prop：

```js
{
  flowModel
}
```

内部新增派生入口：

```js
{
  flowPhase,
  flowSelectedStatePointId,
  flowRuntimeSelectedDetail,
  flowEditResult
}
```

这些入口优先读取 `workbenchFlowModel`，再回退到旧 props：

```js
{
  selectedStateCurvePointId,
  runtimeSelectedDetail,
  actionEditResultContext
}
```

`Workbench.vue` 现在把 `workbenchFlowModel` 传入 `AnalysisPanel`。

`AnalysisPanel` 的以下派生逻辑改为 flow model 优先：

```js
selectedActionContribution
selectedRuntimeResultDetail
effectiveStateCurveFocusMode
selectedStateCurveNavigationIndex
isActionResultRuntimeSelected()
getActionResultSelectedStatePointId()
createActionEditFeedback()
getActionEditFeedbackRuntimeStatePointId()
createActionEditFeedbackLocationChain()
createActionContributionRow()
createActionContributionDetail()
isStateCurvePointInFocus()
```

### 197.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的派生主流程状态：分析面板的结果定位、贡献拆分、编辑反馈定位链和状态曲线选中判断从同一个 flow model 获取当前 phase / state point / edit result 语义；模拟结果、三值计算、项目文件和 runtime projection 结构不变。

### 197.3 验证

- Workbench 视图测试覆盖：动作贡献拆分面板与 AnalysisPanel 根节点跟随 `runtime-result` phase 和同一个 state point。
- Workbench 视图测试覆盖：打开运行结果、编辑结果动作、返回刷新结果时，AnalysisPanel 与主流程条、资源曲线、模拟日志、三值详情处于同一 flow phase / state point。
- `npm run test -- --run src/__tests__/views/Workbench.test.js -t "action contribution|drives the edit-runtime-return loop"`：通过，1 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、53 条测试。
- `npm run test -- --run`：通过，19 个测试文件、141 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 198. UI 主流程能力块：Analysis Flow Actions

本阶段属于 UI 主流程。

### 198.1 结构变化

`src/features/workbench/workbenchFlowModel.js` 新增：

```js
WORKBENCH_FLOW_ACTION_KINDS
createWorkbenchFlowAction()
```

标准 flow action 形状：

```js
{
  kind,
  source,
  actionId,
  statePointId,
  fieldKey,
  payload,
  canRun,
  disabledReason
}
```

当前已接入的 action kind：

```js
select-runtime-result
select-contribution-point
focus-edit-source
```

`AnalysisPanel` 的以下入口改为先生成 flow action，再沿用既有事件输出：

```js
selectActionResultRuntimePoint()
selectActionContributionRow()
focusActionEditSource()
focusActionEditFeedback()
selectActionEditFeedbackResult()
```

相关 DOM 节点新增派生 `data-flow-action-*` 标识，用于测试和后续 Workbench 统一调度：

```js
workbench-action-result-source-row
workbench-action-contribution-row
workbench-action-edit-feedback-focus
workbench-action-edit-feedback-result-focus
```

### 198.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的派生主流程动作语义：结果定位、贡献定位、回到编辑来源继续发出原有事件；模拟结果、三值计算、项目文件和 runtime projection 结构不变。

### 198.3 验证

- flow model 测试覆盖：enabled / disabled flow action 的标准字段和禁用原因。
- Workbench 视图测试覆盖：动作结果行、贡献拆分行、编辑来源按钮、编辑结果回跳按钮携带标准 flow action 语义，并保持原有点击行为。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、57 条测试。
- `npm run test -- --run`：通过，19 个测试文件、142 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示和命令通道噪声。

## 199. UI 主流程能力块：Workbench Flow Action Dispatcher

本阶段属于 UI 主流程。

### 199.1 结构变化

`AnalysisPanel` 的父子事件出口收束为：

```js
dispatch-flow-action
```

原先由 `AnalysisPanel` 分别发出的以下事件不再作为该面板的主流程出口：

```js
select-action-result
select-action-contribution-point
focus-action-edit-source
```

`Workbench.vue` 新增统一调度入口：

```js
dispatchWorkbenchFlowAction(action)
```

当前 dispatcher 支持的动作：

```js
select-runtime-result       -> selectActionResult()
select-contribution-point   -> selectActionContributionRuntimePoint()
focus-edit-source           -> focusActionEditSource()
```

`AnalysisPanel` 的点击处理函数现在只生成并上报标准 flow action：

```js
dispatchAnalysisFlowAction(action)
```

Workbench 负责把 action kind 落到现有的状态更新函数，因此选中动作、选中 runtime state point、资源曲线焦点、日志筛选和编辑字段聚焦仍沿用原有稳定实现。

### 199.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的父子事件合同和派生主流程动作调度；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 199.3 验证

- Workbench 视图测试覆盖：`AnalysisPanel` 发出 `dispatch-flow-action` 后，Workbench 能聚焦回编辑来源字段。
- Workbench 视图测试覆盖：`select-runtime-result` flow action 能回到对应 runtime state point，并保持资源曲线、模拟日志和时间轴状态同步。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、57 条测试。
- `npm run test -- --run`：通过，19 个测试文件、142 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 200. UI 主流程能力块：Runtime Panels 接入 Flow Action Dispatcher

本阶段属于 UI 主流程。

### 200.1 结构变化

`WORKBENCH_FLOW_ACTION_KINDS` 新增：

```js
SELECT_RUNTIME_STATE_POINT: 'select-runtime-state-point'
FOCUS_RUNTIME_ACTION: 'focus-runtime-action'
RETURN_RUNTIME_RESULT: 'return-runtime-result'
```

`Workbench.vue` 的 `dispatchWorkbenchFlowAction(action)` 新增分支：

```js
select-runtime-state-point -> selectRuntimeStatePoint()
focus-runtime-action       -> focusRuntimeAction()
return-runtime-result      -> returnRuntimeResultFromProperties()
```

以下面板的父子事件出口改为统一 `dispatch-flow-action`：

```js
ResourceMonitorPanel
EventLogPanel
RuntimeSelectedDetailPanel
```

旧面板事件不再作为上述三个面板的主流程出口：

```js
select-runtime-state-point
focus-runtime-action
return-runtime-result
```

保留在其他尚未迁移面板中的旧事件仍按原有合同工作。

### 200.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的父子事件合同和派生主流程动作调度；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 200.3 验证

- flow model 测试覆盖新增 action kind。
- Workbench 视图测试覆盖：资源曲线点选择、日志行选择、三值详情定位动作、日志详情定位动作、三值详情返回结果、日志详情返回结果都会发出标准 flow action，并保持现有主流程状态同步。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、57 条测试。
- `npm run test -- --run`：通过，19 个测试文件、142 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 201. UI 主流程能力块：Flow/Properties 接入 Flow Action Dispatcher

本阶段属于 UI 主流程。

### 201.1 结构变化

以下面板的主流程事件出口改为统一 `dispatch-flow-action`：

```js
WorkbenchFlowPanel
PropertiesPanel
```

`WorkbenchFlowPanel` 内部动作映射：

```js
runtime navigation    -> select-runtime-state-point
edit runtime action   -> focus-runtime-action
return edit result    -> return-runtime-result
```

`PropertiesPanel` 内部动作映射：

```js
action edit result return -> return-runtime-result
```

`Workbench.vue` 对上述两个面板改为监听：

```js
@dispatch-flow-action="dispatchWorkbenchFlowAction"
```

不再直接监听上述两个面板的以下旧主流程事件：

```js
focus-runtime-action
return-runtime-result
select-runtime-state-point
```

### 201.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的父子事件合同和派生主流程动作调度；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 201.3 验证

- Workbench 视图测试覆盖：主流程条运行结果导航、主流程条编辑结果动作、主流程条回到刷新结果、属性面板回到结果点都会发出标准 flow action，并保持现有状态同步。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、57 条测试。
- `npm run test -- --run`：通过，19 个测试文件、142 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 202. UI 主流程能力块：Workbench Flow Controller

本阶段属于 UI 主流程。

### 202.1 结构变化

新增模块：

```js
src/features/workbench/workbenchFlowController.js
```

新增导出：

```js
WORKBENCH_FLOW_CONTROLLER_HANDLERS
createWorkbenchFlowController()
```

`createWorkbenchFlowController(handlers)` 负责把标准 flow action 路由到 Workbench 提供的处理器：

```js
select-runtime-result       -> selectRuntimeResult
select-runtime-state-point  -> selectRuntimeStatePoint
select-contribution-point   -> selectContributionPoint
focus-runtime-action        -> focusRuntimeAction
focus-edit-source           -> focusEditSource
return-runtime-result       -> returnRuntimeResult
```

`Workbench.vue` 不再直接维护 `dispatchWorkbenchFlowAction()` 内的 action kind 分支，而是创建 controller：

```js
const workbenchFlowController = createWorkbenchFlowController(...)
```

然后由 `dispatchWorkbenchFlowAction(action)` 调用：

```js
workbenchFlowController.dispatch(action)
```

controller 的 `dispatch()` 会返回诊断结果：

```js
{
  handled,
  kind,
  source,
  handlerKey,
  reason,
  action
}
```

当前 `Workbench.vue` 只消费副作用，暂不展示该诊断结果。

### 202.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的主流程动作调度结构；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 202.3 验证

- 新增 `src/__tests__/features/workbenchFlowController.test.js`，覆盖每个 action kind 到对应 handler 的路由。
- controller 测试覆盖 disabled、unsupported 和 missing-handler action 不会误触发处理器。
- Workbench 视图测试继续覆盖 dispatcher 接入后的实际主流程行为。
- `npm run test -- --run src/__tests__/features/workbenchFlowController.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、59 条测试。
- `npm run test -- --run`：通过，20 个测试文件、144 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 203. UI 主流程能力块：Runtime Entry Flow Action

本阶段属于 UI 主流程。

### 203.1 结构变化

`WORKBENCH_FLOW_ACTION_KINDS` 新增：

```js
OPEN_RUNTIME_RESULTS: 'open-runtime-results'
```

`WORKBENCH_FLOW_CONTROLLER_HANDLERS` 新增：

```js
OPEN_RUNTIME_RESULTS: 'openRuntimeResults'
```

`WorkbenchFlowPanel` 的“查看运行结果”入口不再发出专用父事件：

```js
open-runtime-results
```

改为发出标准 flow action：

```js
{
  kind: 'open-runtime-results',
  source: 'workbench-flow-panel',
  actionId,
  payload: {
    runtimeSimLogCount
  }
}
```

`Workbench.vue` 不再监听：

```js
@open-runtime-results="openRuntimeResultsFlow"
```

而是通过既有统一入口消费：

```js
@dispatch-flow-action="dispatchWorkbenchFlowAction"
```

controller 将 `open-runtime-results` 路由到：

```js
openRuntimeResultsFlow({ actionId })
```

### 203.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的主流程入口事件合同；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 203.3 验证

- flow model 测试覆盖新增 `open-runtime-results` action kind。
- controller 测试覆盖 `open-runtime-results` 路由到 `openRuntimeResults` handler。
- Workbench 视图测试覆盖：主流程条“查看运行结果”会发出标准 flow action，并保持原有运行结果打开、编辑动作、返回刷新结果闭环。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、59 条测试。
- `npm run test -- --run`：通过，20 个测试文件、144 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 204. UI 主流程能力块：Runtime Flow Plan

本阶段属于 UI 主流程。

### 204.1 结构变化

新增模块：

```js
src/features/workbench/workbenchRuntimeFlowPlan.js
```

新增导出：

```js
WORKBENCH_RUNTIME_FLOW_PLAN_KINDS
WORKBENCH_RUNTIME_FLOW_PLAN_MODES
createRuntimeEntryFlowPlan()
createRuntimePointFocusFlowPlan()
```

runtime flow plan 的主要字段：

```js
{
  kind,
  mode,
  actionId,
  statePointId,
  calculatorScope,
  pulseCalculatorFocus,
  selectFirstRuntimePoint,
  selectRuntimeStatePoint,
  clearRuntimeSelection,
  stateCurveFocusMode,
  stateCurveLayerFilters,
  stateCurveTrackFilters,
  runtimeLogFocusSource
}
```

`createRuntimeEntryFlowPlan()` 用于描述：

```js
runtime-entry -> runtime-result
runtime-entry -> runtime-overview
```

`createRuntimePointFocusFlowPlan()` 用于描述：

```js
runtime-point-focus -> runtime-result
runtime-point-focus -> runtime-point-empty
```

`Workbench.vue` 新增内部执行入口：

```js
applyRuntimeFlowPlan(plan)
```

以下 Workbench 主流程函数改为先创建 plan，再应用 plan：

```js
openRuntimeResultsFlow()
focusRuntimePointFromAnalysis()
syncRuntimeResultForSelectedAction()
```

### 204.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的运行主流程状态转换组织方式；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 204.3 验证

- 新增 `src/__tests__/features/workbenchRuntimeFlowPlan.test.js`，覆盖运行入口存在运行点、无运行点进入总览、运行点聚焦和空运行点聚焦。
- Workbench 视图测试继续覆盖主流程条打开运行结果、编辑结果动作、返回刷新结果的闭环行为。
- `npm run test -- --run src/__tests__/features/workbenchRuntimeFlowPlan.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、63 条测试。
- `npm run test -- --run`：通过，21 个测试文件、148 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 205. UI 主流程能力块：Action Edit Flow Plan

本阶段属于 UI 主流程。

### 205.1 结构变化

新增模块：

```js
src/features/workbench/workbenchActionEditFlowPlan.js
```

新增导出：

```js
WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS
createRuntimeActionEditFocusPlan()
createEditSourceActionEditFocusPlan()
```

action edit flow plan 的主要字段：

```js
{
  kind,
  canApply,
  actionId,
  requiresExistingAction,
  actionEditFocus
}
```

`createRuntimeActionEditFocusPlan()` 用于描述：

```js
runtime-action-focus
```

其 `actionEditFocus` 保留运行结果定位所需的字段：

```js
{
  actionId,
  fieldKey,
  label,
  previousValue,
  nextValue,
  changeSummary,
  editOrigin,
  originStatePointId,
  originTrackKey,
  originFrameLabel,
  sequence
}
```

`createEditSourceActionEditFocusPlan()` 用于描述：

```js
edit-source-focus
```

`Workbench.vue` 新增内部执行入口：

```js
applyActionEditFlowPlan(plan)
```

以下 Workbench 主流程函数改为先创建 plan，再应用 plan：

```js
focusRuntimeAction()
focusActionEditSource()
```

### 205.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的动作编辑焦点状态转换组织方式；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 205.3 验证

- 新增 `src/__tests__/features/workbenchActionEditFlowPlan.test.js`，覆盖运行结果定位编辑焦点、分析编辑来源焦点和不完整 plan 禁用。
- Workbench 视图测试继续覆盖运行结果定位动作、编辑动作和回到刷新结果的闭环行为。
- `npm run test -- --run src/__tests__/features/workbenchActionEditFlowPlan.test.js src/__tests__/features/workbenchRuntimeFlowPlan.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、62 条测试。
- `npm run test -- --run`：通过，22 个测试文件、151 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 206. UI 主流程能力块：Runtime Result Return Plan

本阶段属于 UI 主流程。

### 206.1 结构变化

`WORKBENCH_RUNTIME_FLOW_PLAN_KINDS` 新增：

```js
RUNTIME_RESULT_RETURN: 'runtime-result-return'
```

`workbenchRuntimeFlowPlan.js` 新增导出：

```js
createRuntimeResultReturnFlowPlan()
```

runtime flow plan 新增字段：

```js
selectActionId
```

`createRuntimeResultReturnFlowPlan()` 用于描述：

```js
runtime-result-return -> runtime-result
runtime-result-return -> runtime-point-empty
```

其主要输出字段：

```js
{
  kind,
  mode,
  actionId,
  selectActionId,
  statePointId,
  calculatorScope,
  pulseCalculatorFocus,
  selectRuntimeStatePoint,
  clearRuntimeSelection,
  stateCurveFocusMode,
  stateCurveLayerFilters,
  stateCurveTrackFilters,
  runtimeLogFocusSource
}
```

`Workbench.vue` 的 `applyRuntimeFlowPlan(plan)` 新增：

```js
plan.selectActionId
```

用于在运行结果返回前选中目标动作。

以下 Workbench 主流程函数改为先创建 runtime result return plan，再应用 plan：

```js
selectActionResult()
returnRuntimeResultFromProperties()
```

### 206.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的运行结果返回状态转换组织方式；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 206.3 验证

- `src/__tests__/features/workbenchRuntimeFlowPlan.test.js` 新增覆盖运行结果返回到目标运行点，以及空运行点返回。
- Workbench 视图测试继续覆盖结果行定位、回到刷新结果、运行详情/曲线/日志同步。
- `npm run test -- --run src/__tests__/features/workbenchRuntimeFlowPlan.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、61 条测试。
- `npm run test -- --run`：通过，22 个测试文件、153 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 207. UI 主流程能力块：Workbench Flow Plan Controller

本阶段属于 UI 主流程。

### 207.1 结构变化

新增模块：

```js
src/features/workbench/workbenchFlowPlanController.js
```

新增导出：

```js
WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS
createWorkbenchFlowPlanController()
```

`createWorkbenchFlowPlanController()` 接收以下 getter：

```js
{
  getRuntimeProjection,
  getSelectedActionId,
  getActionEditFocusSequence
}
```

controller 统一提供以下 plan 生成方法：

```js
createRuntimeEntryPlan()
createRuntimePointFocusPlan()
createRuntimeResultReturnPlan()
createRuntimeActionEditFocusPlan()
createEditSourceActionEditFocusPlan()
```

`Workbench.vue` 不再直接导入以下具体 plan 构造器：

```js
createRuntimeEntryFlowPlan
createRuntimePointFocusFlowPlan
createRuntimeResultReturnFlowPlan
createRuntimeActionEditFocusPlan
createEditSourceActionEditFocusPlan
```

改为创建：

```js
const workbenchFlowPlanController = createWorkbenchFlowPlanController(...)
```

再通过 `WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS` 获取对应 plan。

### 207.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的主流程 plan 生成组织方式；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 207.3 验证

- 新增 `src/__tests__/features/workbenchFlowPlanController.test.js`，覆盖运行入口、运行结果返回、运行点聚焦、运行结果定位编辑焦点和分析编辑来源焦点 plan 创建。
- Workbench 视图测试继续覆盖现有编辑、运行、查看、回改、回结果闭环行为。
- `npm run test -- --run src/__tests__/features/workbenchFlowPlanController.test.js src/__tests__/features/workbenchRuntimeFlowPlan.test.js src/__tests__/features/workbenchActionEditFlowPlan.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、64 条测试。
- `npm run test -- --run`：通过，23 个测试文件、155 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 208. UI 主流程能力块：Flow Controller Plan Handlers

本阶段属于 UI 主流程。

### 208.1 结构变化

`src/features/workbench/workbenchFlowController.js` 新增导出：

```js
createWorkbenchFlowPlanHandlers()
```

`createWorkbenchFlowPlanHandlers()` 接收：

```js
{
  flowPlanController,
  applyRuntimeFlowPlan,
  applyActionEditFlowPlan,
  selectRuntimeStatePoint
}
```

并为 `createWorkbenchFlowController()` 生成标准 handlers：

```js
openRuntimeResults
selectRuntimeResult
selectRuntimeStatePoint
selectContributionPoint
focusRuntimeAction
focusEditSource
returnRuntimeResult
```

其中：

```js
openRuntimeResults      -> createRuntimeEntryPlan -> applyRuntimeFlowPlan
selectRuntimeResult     -> createRuntimeResultReturnPlan -> applyRuntimeFlowPlan
selectContributionPoint -> createRuntimePointFocusPlan -> applyRuntimeFlowPlan
focusRuntimeAction      -> createRuntimeActionEditFocusPlan -> applyActionEditFlowPlan
focusEditSource         -> createEditSourceActionEditFocusPlan -> applyActionEditFlowPlan
returnRuntimeResult     -> createRuntimeResultReturnPlan -> applyRuntimeFlowPlan
selectRuntimeStatePoint -> selectRuntimeStatePoint
```

`Workbench.vue` 不再维护以下中转函数：

```js
openRuntimeResultsFlow()
selectActionResult()
returnRuntimeResultFromProperties()
focusRuntimeAction()
focusActionEditSource()
selectActionContributionRuntimePoint()
focusRuntimePointFromAnalysis()
```

`Workbench.vue` 改为：

```js
const workbenchFlowController = createWorkbenchFlowController(
  createWorkbenchFlowPlanHandlers(...)
)
```

### 208.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的 flow action 到 plan 的主流程接线方式；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 208.3 验证

- `src/__tests__/features/workbenchFlowController.test.js` 新增覆盖 flow action 到 plan controller 与 apply 函数的绑定。
- Workbench 视图测试继续覆盖现有编辑、运行、查看、回改、回结果闭环行为。
- `npm run test -- --run src/__tests__/features/workbenchFlowController.test.js src/__tests__/features/workbenchFlowPlanController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、58 条测试。
- `npm run test -- --run`：通过，23 个测试文件、156 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 209. UI 主流程能力块：Workbench Flow Runtime

本阶段属于 UI 主流程。

### 209.1 结构变化

新增模块：

```js
src/features/workbench/workbenchFlowRuntime.js
```

新增导出：

```js
createWorkbenchFlowRuntime()
```

`createWorkbenchFlowRuntime()` 接收 Workbench 本地状态写入回调：

```js
{
  actionExists,
  selectAction,
  setActionEditFocus,
  focusCalculatorScope,
  setCalculatorScope,
  selectRuntimeStatePoint,
  clearRuntimeSelection,
  setStateCurveLayerFilters,
  setStateCurveTrackFilters,
  focusRuntimeLog
}
```

flow runtime 提供：

```js
applyActionEditFlowPlan(plan)
applyRuntimeFlowPlan(plan)
```

`Workbench.vue` 不再维护本地函数：

```js
applyActionEditFlowPlan()
applyRuntimeFlowPlan()
```

改为创建：

```js
const workbenchFlowRuntime = createWorkbenchFlowRuntime(...)
```

并把以下执行入口交给 `createWorkbenchFlowPlanHandlers()`：

```js
workbenchFlowRuntime.applyRuntimeFlowPlan
workbenchFlowRuntime.applyActionEditFlowPlan
```

`syncRuntimeResultForSelectedAction()` 也改为通过：

```js
workbenchFlowRuntime.applyRuntimeFlowPlan(...)
```

### 209.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的 flow plan 应用组织方式；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 209.3 验证

- 新增 `src/__tests__/features/workbenchFlowRuntime.test.js`，覆盖 action edit plan 应用、禁用 plan、缺失动作、runtime plan 应用、运行总览清空和 calculator focus。
- Workbench 视图测试继续覆盖现有编辑、运行、查看、回改、回结果闭环行为。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、60 条测试。
- `npm run test -- --run`：通过，24 个测试文件、160 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 210. UI 主流程能力块：Flow Runtime Scope State

本阶段属于 UI 主流程。

### 210.1 结构变化

新增模块：

```js
src/features/workbench/workbenchFlowRuntimeScope.js
```

新增导出：

```js
WORKBENCH_FLOW_RUNTIME_SCOPES
createWorkbenchFlowRuntimeScopeState()
```

`createWorkbenchFlowRuntimeScopeState()` 输出：

```js
{
  calculatorScope,
  statePointId,
  selectRuntimeStatePoint,
  clearRuntimeSelection,
  stateCurveFocusMode,
  stateCurveLayerFilters,
  stateCurveTrackFilters,
  runtimeLogFocus
}
```

支持的 scope：

```js
runtime
generation
```

`Workbench.vue` 的 `focusThreeValueCalculatorScope()` 不再直接维护 runtime / generation 分支细节，改为：

```js
createWorkbenchFlowRuntimeScopeState(...)
applyCalculatorScopeFlowState(...)
```

新增内部应用函数：

```js
applyCalculatorScopeFlowState(scopeState)
```

### 210.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的 calculator scope 切换状态组织方式；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 210.3 验证

- 新增 `src/__tests__/features/workbenchFlowRuntimeScope.test.js`，覆盖 runtime 有首点、runtime 无首点、generation 三种视角切换。
- Workbench 视图测试继续覆盖 calculator scope 切换相关的资源曲线、日志和运行详情行为。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntimeScope.test.js src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、60 条测试。
- `npm run test -- --run`：通过，25 个测试文件、163 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 211. UI 主流程能力块：Flow Runtime Point Selection

本阶段属于 UI 主流程。

### 211.1 结构变化

新增模块：

```js
src/features/workbench/workbenchFlowRuntimePointSelection.js
```

新增导出：

```js
createWorkbenchFlowRuntimePointSelectionState()
```

`createWorkbenchFlowRuntimePointSelectionState()` 输出：

```js
{
  statePointId,
  selectedStatePointId,
  stateCurveFocusMode,
  shouldSelectRuntimeAction,
  runtimeLogFocus
}
```

`Workbench.vue` 的 `selectRuntimeStatePoint()` 不再直接维护运行点选择分支，改为：

```js
createWorkbenchFlowRuntimePointSelectionState(...)
applyRuntimePointSelectionState(...)
```

新增内部应用函数：

```js
applyRuntimePointSelectionState(selectionState)
```

### 211.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 的运行点选择状态组织方式；模拟结果、三值计算、项目文件、runtime projection 结构不变。

### 211.3 验证

- 新增 `src/__tests__/features/workbenchFlowRuntimePointSelection.test.js`，覆盖运行点选中和运行点清空两条主流程。
- Workbench 视图测试继续覆盖动作编辑、运行结果查看、资源曲线和详情回跳行为。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntimePointSelection.test.js src/__tests__/features/workbenchFlowRuntimeScope.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、58 条测试。
- `npm run test -- --run`：通过，26 个测试文件、165 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 212. 生成层能力块：Action Hit ThreeValueDelta Generation Entry

本阶段属于生成层。

### 212.1 结构变化

新增模块：

```js
src/simulation/generation/actionHitThreeValueDeltaGeneration.js
```

新增导出：

```js
createActionHitThreeValueDeltaGeneration()
```

`createActionHitThreeValueDeltaGeneration()` 输出：

```js
{
  schemaVersion,
  sourceKind,
  status,
  contractName,
  inputSourceKind,
  inputStatus,
  inputSources,
  threeValueGenerationLayer,
  standardContract,
  actions,
  hits,
  deltas,
  summary,
  applied
}
```

其中 `summary` 明确记录：

```js
{
  contractName,
  generationLayerSourceKind,
  generationLayerStatus,
  standardContractSourceKind,
  standardContractStatus,
  inputSourceKind,
  inputStatus,
  topology,
  deltaFields,
  runtimeDeltaPolicy,
  actionCount,
  hitCount,
  deltaCount,
  appliedDeltaCount,
  candidateDeltaCount,
  sampledDeltaCount,
  placeholderDeltaCount,
  applied
}
```

`createThreeValueGenerationBundle()` 结构新增字段：

```js
actionHitThreeValueDeltaGeneration
```

`runtimeInputSource` 新增字段：

```js
generationEntrySourceKind
generationEntryStatus
```

bundle `summary` 新增字段：

```js
generationEntrySourceKind
generationEntryStatus
```

`src/simulation/index.js` 新增导出：

```js
createActionHitThreeValueDeltaGeneration
```

### 212.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响生成层 bundle / runtime input source 的中间结构；HP / 韧性 / 自身能量 delta 结果、runtime projection、UI 保存草稿结构不变。

### 212.3 验证

- 新增 `src/__tests__/simulation/actionHitThreeValueDeltaGeneration.test.js`，覆盖 generation entry 的 topology、delta fields、runtime delta policy、标准合同引用关系和三值 delta 字段。
- 更新 `src/__tests__/simulation/threeValueGenerationBuilder.test.js`，确认 bundle 从 generation entry 取得 `standardContract`，并写入 generation entry 来源字段。
- `npm run test -- --run src/__tests__/simulation/actionHitThreeValueDeltaGeneration.test.js src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/threeValueGenerationLayer.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js`：通过，4 个测试文件、7 条测试。
- `npm run test -- --run`：通过，27 个测试文件、166 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 213. 运行时层能力块：Action Hit ThreeValueDelta Runtime Input

本阶段属于运行时层。

### 213.1 结构变化

新增模块：

```js
src/simulation/runtime/actionHitThreeValueRuntimeInput.js
```

新增导出：

```js
ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE
createActionHitThreeValueRuntimeInput()
```

`ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE` 固定为：

```js
threeValueRuntimeInput.appliedDeltas
```

`createActionHitThreeValueRuntimeInput()` 输入支持：

```js
{
  runtimeInputSource,
  actionHitThreeValueDeltaGeneration,
  threeValueGenerationLayer
}
```

`createActionHitThreeValueRuntimeInput()` 输出：

```js
{
  schemaVersion,
  sourceKind,
  status,
  contractName,
  appliedDeltaSource,
  inputSourceKind,
  inputStatus,
  runtimeInputSourceKind,
  runtimeInputSourceStatus,
  generationEntrySourceKind,
  generationEntryStatus,
  generationLayerSourceKind,
  generationLayerStatus,
  standardContractSourceKind,
  standardContractStatus,
  appliedOnly,
  deltas,
  appliedDeltas,
  ignoredDeltaCount,
  summary,
  applied
}
```

`summary` 新增或明确字段：

```js
{
  appliedDeltaSource,
  generationEntrySourceKind,
  generationEntryStatus,
  generationLayerSourceKind,
  generationLayerStatus,
  standardContractSourceKind,
  standardContractStatus,
  standardContractActionCount,
  standardContractHitCount,
  inputDeltaCount,
  appliedDeltaCount,
  ignoredDeltaCount,
  appliedTrackKeys,
  appliedLayerKeys,
  ignoredLayerCounts,
  appliedOnly,
  applied
}
```

`src/simulation/runtime/threeValueRuntimeInput.js` 变更为兼容导出层：

```js
createThreeValueRuntimeInput(options) -> createActionHitThreeValueRuntimeInput(options)
```

`createThreeValueRuntimeProjection()` 新增可选输入：

```js
actionHitThreeValueDeltaGeneration
```

runtime projection 输出来源调整：

```js
summary.source = 'threeValueRuntimeInput.appliedDeltas'
summary.runtimeInputSource = 'threeValueRuntimeInput.appliedDeltas'
outputContract.outputs.simLog.inputSource = 'threeValueRuntimeInput.appliedDeltas'
enemyStateCurve.sourceKind = 'three-value-runtime-input-applied-enemy-deltas'
runtime point sourceKind = 'three-value-runtime-input-applied-delta'
```

runtime projection summary 新增字段：

```js
runtimeGenerationEntrySourceKind
runtimeGenerationEntryStatus
```

`src/simulation/projection/projectSimulationResult.js` 现在把 bundle 里的 `actionHitThreeValueDeltaGeneration` 传给 runtime projection。

`src/simulation/index.js` 新增导出：

```js
ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE
createActionHitThreeValueRuntimeInput
createThreeValueRuntimeInput
```

### 213.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响运行时中间结构与来源追踪；HP / 韧性 / 自身能量 delta 数值、runtime projection 曲线结果、Workbench 草稿结构不变。

### 213.3 验证

- 新增 `src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js`，覆盖 runtime input 的 applied-only 筛选、运行时序号、三值字段归一化、ignored layer 统计和 generation entry 来源追踪。
- 更新 `src/__tests__/simulation/threeValueRuntimeProjection.test.js` 与 `src/__tests__/simulation/firstVerticalSliceSimulation.test.js`，确认 runtime 输出来源统一到 `threeValueRuntimeInput.appliedDeltas`。
- `npm run test -- --run src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/actionHitThreeValueDeltaGeneration.test.js src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，5 个测试文件、19 条测试。
- `npm run test -- --run`：通过，28 个测试文件、167 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 214. UI 主流程能力块：Workbench Flow Contract Context

本阶段属于 UI 主流程。

### 214.1 结构变化

新增模块：

```js
src/features/workbench/workbenchFlowContractContext.js
```

新增导出：

```js
createWorkbenchFlowContractContext()
```

`createWorkbenchFlowContractContext()` 输入：

```js
{
  generationBundle,
  runtimeProjection
}
```

`createWorkbenchFlowContractContext()` 输出：

```js
{
  contractName,
  generationEntry,
  standardContract,
  runtimeInput,
  runtimeOutput
}
```

其中 `generationEntry` 与 `standardContract` 统一包含：

```js
{
  sourceKind,
  status,
  actionCount,
  hitCount,
  deltaCount,
  appliedDeltaCount,
  ready
}
```

`runtimeInput` 包含：

```js
{
  sourceKind,
  status,
  runtimeInputSourceKind,
  generationEntrySourceKind,
  appliedDeltaSource,
  inputDeltaCount,
  appliedDeltaCount,
  ignoredDeltaCount,
  appliedOnly,
  ready
}
```

`runtimeOutput` 包含：

```js
{
  sourceKind,
  status,
  simLogInputSource,
  stateCurvesSourceKind,
  resourceCurvesSourceKind,
  outputCount,
  simLogCount,
  ready
}
```

`createWorkbenchFlowModel()` 新增输入：

```js
generationBundle
```

`createWorkbenchFlowModel()` 输出新增字段：

```js
contractContext
```

`controls.canOpenRuntimeResults` 现在要求：

```js
contractContext.runtimeOutput.ready && runtimeSimLogCount > 0
```

`WorkbenchFlowPanel` 新增主流程数据属性：

```html
data-contract-name
data-generation-entry-status
data-runtime-input-source
data-runtime-output-status
```

`Workbench.vue` 现在把 `simulationResult.threeValueGenerationBundle` 同时传入 `WorkbenchFlowPanel` 与 `createWorkbenchFlowModel()`。

### 214.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench 主流程模型与面板的数据上下文；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 214.3 验证

- 新增 `src/__tests__/features/workbenchFlowContractContext.test.js`，覆盖 generation entry、standard contract、runtime input、runtime output 的来源、状态和 ready 判断。
- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，确认 flow model 暴露 `contractContext`，并用 runtime output readiness 控制运行结果入口。
- 更新 `src/__tests__/views/Workbench.test.js`，确认真实 Workbench 主流程面板暴露合同名称、generation entry 状态、runtime input 来源和 runtime output 状态。
- `npm run test -- --run src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、58 条测试。
- `npm run test -- --run`：通过，29 个测试文件、168 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告，且本机 PowerShell/oh-my-posh 输出过非构建失败的通道噪声。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 215. UI 主流程能力块：Workbench Runtime Entry Route

本阶段属于 UI 主流程。

### 215.1 结构变化

`createRuntimeEntryFlowPlan()` 新增输入：

```js
fallbackToFirstRuntimePoint
```

`runtime entry` plan 新增字段：

```js
routeSource
```

可取值：

```js
selected-action-runtime-point
first-runtime-point
runtime-overview
```

行为规则：

```js
selectedActionRuntimePoint = findFirstRuntimeStatePointForAction(...)
fallbackRuntimePoint = fallbackToFirstRuntimePoint
  ? createRuntimeStatePointContexts(runtimeProjection)[0]
  : null
runtimePoint = selectedActionRuntimePoint ?? fallbackRuntimePoint
```

`createWorkbenchFlowPlanController().createRuntimeEntryPlan()` 透传：

```js
fallbackToFirstRuntimePoint
```

`createWorkbenchFlowController()` 对 `OPEN_RUNTIME_RESULTS` 透传 action payload。

`createWorkbenchFlowPlanHandlers().openRuntimeResults` 透传：

```js
fallbackToFirstRuntimePoint
```

`WorkbenchFlowPanel` 的 open runtime action payload 新增：

```js
fallbackToFirstRuntimePoint: true
```

### 215.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench 主流程动作路由；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 215.3 验证

- 更新 `src/__tests__/features/workbenchRuntimeFlowPlan.test.js`，覆盖 selected action runtime point、runtime overview、first runtime point fallback 三种 route source。
- 更新 `src/__tests__/features/workbenchFlowPlanController.test.js` 与 `src/__tests__/features/workbenchFlowController.test.js`，确认 fallback payload 能从主流程 action 进入 runtime entry plan。
- 更新 `src/__tests__/views/Workbench.test.js`，确认选中无结果动作后主动打开运行结果会定位首个运行点，并确认无结果动作自动同步仍会清空 stale runtime detail。
- `npm run test -- --run src/__tests__/features/workbenchRuntimeFlowPlan.test.js src/__tests__/features/workbenchFlowPlanController.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、66 条测试。
- `npm run test -- --run`：通过，29 个测试文件、170 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 216. UI 主流程能力块：Runtime Point Focus Route

本阶段属于 UI 主流程。

### 216.1 结构变化

`createWorkbenchFlowController()` 对 `SELECT_RUNTIME_STATE_POINT` 的 handler payload 从单个字符串：

```js
statePointId
```

调整为结构化对象：

```js
{
  actionId,
  statePointId,
  source
}
```

`createWorkbenchFlowPlanHandlers()` 对 `SELECT_RUNTIME_STATE_POINT` 不再直接调用 `selectRuntimeStatePoint()`，而是创建并应用：

```js
WORKBENCH_FLOW_PLAN_CONTROLLER_METHODS.RUNTIME_POINT_FOCUS
```

payload 为：

```js
{
  statePointId,
  source: source || 'runtime-state-point'
}
```

`Workbench.vue` 移除 `createWorkbenchFlowPlanHandlers()` 中的旧直连 `selectRuntimeStatePoint` 参数。运行点选择现在统一通过：

```text
flow action -> flow controller -> runtime point focus plan -> workbench flow runtime
```

### 216.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench 主流程路由；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 216.3 验证

- 更新 `src/__tests__/features/workbenchFlowController.test.js`，确认 `select-runtime-state-point` 进入 `runtime-point-focus` plan，并保留 flow action 来源。
- 更新 `src/__tests__/views/Workbench.test.js`，确认资源曲线点选择后的 runtime focus source 来自 `resource-runtime-curve`。
- `npm run test -- --run src/__tests__/features/workbenchFlowController.test.js src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/features/workbenchFlowPlanController.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、63 条测试。
- `npm run test -- --run`：通过，29 个测试文件、170 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 217. UI 主流程能力块：State Curve Runtime Route

本阶段属于 UI 主流程。

### 217.1 结构变化

`createRuntimePointFocusFlowPlan()` 新增可选输入：

```js
preserveStateCurveFilters
```

默认值为 `false`。默认 runtime point focus 行为不变：进入 runtime 视角、选中 runtime point，并应用 applied-only 状态曲线过滤。

当 `preserveStateCurveFilters: true` 时，plan 仍会：

```js
{
  calculatorScope: 'runtime',
  selectRuntimeStatePoint: true,
  stateCurveFocusMode: 'selected',
  runtimeLogFocusSource
}
```

但不会覆盖当前：

```js
stateCurveLayerFilters
stateCurveTrackFilters
```

`createWorkbenchFlowPlanController().createRuntimePointFocusPlan()` 透传该参数。

`Workbench.vue` 的 `selectStateCurvePoint(pointId)` 现在先判断 `pointId` 是否存在于 `threeValueRuntimeProjection` 的 runtime state point contexts：

```text
runtime point -> createRuntimePointFocusPlan({ source: 'state-curve-point', preserveStateCurveFilters: true })
non-runtime point -> 保持原有 selectedStateCurvePointId 选择逻辑
empty point -> 清空选择并回到 all 视角
```

### 217.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench 主流程路由；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 217.3 验证

- 更新 `src/__tests__/features/workbenchRuntimeFlowPlan.test.js`，确认 runtime point focus 可以在保留曲线过滤的同时进入 runtime point。
- 更新 `src/__tests__/views/Workbench.test.js`，确认点击 applied 时间轴 marker 后进入 selected runtime 视角，并将 runtime focus source 标记为 `state-curve-point`。
- `npm run test -- --run src/__tests__/features/workbenchRuntimeFlowPlan.test.js src/__tests__/features/workbenchFlowPlanController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、64 条测试。
- `npm run test -- --run`：通过，29 个测试文件、171 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 218. UI 主流程能力块：Runtime Result Source Route

本阶段属于 UI 主流程。

### 218.1 结构变化

`createWorkbenchFlowController()` 对以下 action 的 handler payload 新增 `source`：

```js
SELECT_RUNTIME_RESULT
RETURN_RUNTIME_RESULT
```

payload 从：

```js
{
  actionId,
  statePointId
}
```

扩展为：

```js
{
  actionId,
  statePointId,
  source
}
```

`createWorkbenchFlowPlanHandlers()` 创建 `RUNTIME_RESULT_RETURN` plan 时不再强制写死：

```js
source: 'action-result'
```

而是使用：

```js
source: source || 'action-result'
```

新增 `src/features/workbench/runtimeFocusSource.js`，集中维护 runtime result focus source 分类：

```js
isRuntimeResultFocusSource(source)
normalizeRuntimeLogFocusScope(source)
```

当前归为 result focus 的来源包括：

```text
action-result
analysis-action-result
analysis-edit-result
properties-panel
event-log-runtime-detail
runtime-detail
workbench-flow-panel
```

`EventLogPanel` 使用 `normalizeRuntimeLogFocusScope()` 继续把这些来源映射为既有 `action-result` 日志 scope。

`ResourceMonitorPanel` 使用 `isRuntimeResultFocusSource()` 继续把这些来源显示为既有“动作结果定位”语义；`refreshed-edit-result` 仍优先显示为“刷新后结果”。

### 218.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench 主流程路由来源；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 218.3 验证

- 新增 `src/__tests__/features/runtimeFocusSource.test.js`，覆盖结果入口 source 分类与日志 scope 归一。
- 更新 `src/__tests__/features/workbenchFlowController.test.js`，确认 `SELECT_RUNTIME_RESULT` / `RETURN_RUNTIME_RESULT` 的 source 进入 runtime result return plan。
- 更新 `src/__tests__/views/Workbench.test.js`，确认普通结果定位、日志回看和编辑反馈回看分别保留真实 `data-runtime-focus-source`。
- `npm run test -- --run src/__tests__/features/runtimeFocusSource.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、59 条测试。
- `npm run test -- --run`：通过，30 个测试文件、173 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 219. UI 主流程能力块：Runtime Action Edit Source Route

本阶段属于 UI 主流程。

### 219.1 结构变化

`createWorkbenchFlowController()` 对 `FOCUS_RUNTIME_ACTION` 不再直接把 `flowAction.payload` 交给 handler，而是先补齐 runtime action focus payload：

```js
{
  ...payload,
  actionId,
  statePointId,
  source
}
```

`createRuntimeActionEditFocusPlan()` 新增输入：

```js
source
```

并在 `actionEditFocus` 中写入：

```js
focusSource
```

`createEditSourceActionEditFocusPlan()` 也会保留传入 source 上的 `focusSource`，用于最近编辑反馈回到字段时不丢失来源链路。

Workbench 本地 `actionEditSource` / `actionEditFocus` 空状态新增：

```js
focusSource
```

`createActionEditOrigin()` 会在 runtime focus 产生的字段编辑中保留：

```js
{
  editOrigin: 'runtime-focus',
  focusSource,
  originStatePointId,
  originTrackKey,
  originFrameLabel
}
```

`createActionEditResultContext()` 继续把 `focusSource` 传给刷新后结果上下文。

前端派生属性新增：

```html
data-edit-focus-source
```

当前接入位置：

```text
TimelineGridPreview action block
PropertiesPanel action edit controls
AnalysisPanel action edit feedback
```

### 219.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench 主流程前端状态；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 219.3 验证

- 更新 `src/__tests__/features/workbenchActionEditFlowPlan.test.js`，确认 runtime action edit focus 写入 `focusSource`。
- 更新 `src/__tests__/features/workbenchFlowController.test.js` 与 `src/__tests__/features/workbenchFlowPlanController.test.js`，确认 `FOCUS_RUNTIME_ACTION` 的 source 能进入 action edit plan。
- 更新 `src/__tests__/views/Workbench.test.js`，确认主流程面板、运行详情、日志详情、资源曲线回到动作编辑后，时间轴、属性面板和最近编辑反馈保留对应 `data-edit-focus-source`。
- `npm run test -- --run src/__tests__/features/workbenchActionEditFlowPlan.test.js src/__tests__/features/workbenchFlowPlanController.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、62 条测试。
- `npm run test -- --run`：通过，30 个测试文件、173 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 220. UI 主流程能力块：Runtime Action Focus Flow Action Helper

本阶段属于 UI 主流程。

### 220.1 结构变化

新增：

```text
src/features/workbench/runtimeActionFocusFlowAction.js
```

提供统一入口：

```js
createRuntimeActionFocusFlowAction({
  source,
  detail,
  enabled,
  disabledReason
})
```

该 helper 统一生成：

```js
{
  kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
  source,
  actionId,
  statePointId,
  payload: {
    actionId,
    fieldKey,
    frameLabel,
    statePointId,
    trackKey
  },
  enabled,
  disabledReason
}
```

默认规则：

```js
fieldKey = detail?.fieldKey || 'startMs'
frameLabel = detail?.frameLabel ?? `${detail?.timeMs ?? 0}ms`
trackKey = detail?.trackKey ?? ''
enabled = enabled ?? Boolean(actionId)
disabledReason = 'missing-runtime-action'
```

已接入位置：

```text
WorkbenchFlowPanel -> source: workbench-flow-panel
RuntimeSelectedDetailPanel -> source: runtime-detail
EventLogPanel -> source: event-log-runtime-detail
ResourceMonitorPanel -> source: resource-runtime-curve
```

这些入口不再各自手写 `focus-runtime-action` payload，后续 runtime action focus 合同调整时只需要改共享 helper。

### 220.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程 action 拼装；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 220.3 验证

- 新增 `src/__tests__/features/runtimeActionFocusFlowAction.test.js`，覆盖共享 payload 合同、`frameLabel` fallback 和 `enabled` override。
- 更新四个 Workbench 面板，继续使用原有 source，并改为消费共享 `createRuntimeActionFocusFlowAction()`。
- `npm run test -- --run src/__tests__/features/runtimeActionFocusFlowAction.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、59 条测试。
- `npm run test -- --run`：通过，31 个测试文件、175 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有 Windows CRLF 提示。

## 221. UI 主流程能力块：Primary Flow Action Contract

本阶段属于 UI 主流程。

### 221.1 结构变化

`src/features/workbench/workbenchFlowModel.js` 新增：

```js
WORKBENCH_FLOW_PRIMARY_ACTION_KEYS
```

当前主操作 key：

```text
open-runtime-results
focus-runtime-action
return-runtime-result
```

`createWorkbenchFlowModel()` 输出新增：

```js
primaryAction: {
  key,
  kind,
  label,
  actionId,
  statePointId,
  enabled,
  disabledReason
}
```

当前阶段映射：

```text
action-edit / runtime-overview -> open-runtime-results
runtime-result -> focus-runtime-action
edit-result-ready -> return-runtime-result
edit-result-review -> focus-runtime-action
```

`WorkbenchFlowPanel` 根节点新增派生属性：

```html
data-flow-primary-kind
data-flow-primary-action-id
data-flow-primary-state-point-id
```

现有三个主流程按钮新增：

```html
data-primary-action="true|false"
```

并由 `primaryAction.kind` 决定哪一个按钮使用主操作样式。该变化只改变主流程按钮的模型合同和视觉优先级，不新增额外按钮。

### 221.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程状态；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 221.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖四种主流程阶段下的 `primaryAction` 合同。
- 更新 `src/__tests__/views/Workbench.test.js`，确认真实 Workbench 中主操作从 `open-runtime-results` 切到 `focus-runtime-action`，再切到 `return-runtime-result`，并保持原 dispatch 回路。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、58 条测试。
- `npm run test -- --run`：通过，31 个测试文件、175 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 222. UI 主流程能力块：Runtime Result Focus Flow Action Helper

本阶段属于 UI 主流程。

### 222.1 结构变化

新增：

```text
src/features/workbench/runtimeResultFocusFlowAction.js
```

提供两个统一入口。

运行点定位：

```js
createRuntimeStatePointFocusFlowAction({
  source,
  detail,
  actionId,
  statePointId,
  payload,
  enabled,
  disabledReason
})
```

生成：

```js
{
  kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_STATE_POINT,
  source,
  actionId,
  statePointId,
  payload,
  enabled,
  disabledReason
}
```

默认 action 解析顺序：

```js
actionId || detail?.row?.actionId || detail?.actionId || ''
```

默认 state point 解析顺序：

```js
statePointId || detail?.statePointId || detail?.runtimeStatePointId || ''
```

运行结果定位：

```js
createRuntimeResultFocusFlowAction({
  source,
  detail,
  actionId,
  statePointId,
  payload,
  enabled,
  disabledReason
})
```

生成：

```js
{
  kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
  source,
  actionId,
  statePointId,
  payload,
  enabled,
  disabledReason
}
```

已接入位置：

```text
WorkbenchFlowPanel runtime navigation -> createRuntimeStatePointFocusFlowAction()
ResourceMonitorPanel runtime curve point -> createRuntimeStatePointFocusFlowAction()
EventLogPanel runtime log row -> createRuntimeStatePointFocusFlowAction()
AnalysisPanel action result -> createRuntimeResultFocusFlowAction()
AnalysisPanel edit feedback result -> createRuntimeResultFocusFlowAction()
```

搜索确认 `SELECT_RUNTIME_STATE_POINT` / `SELECT_RUNTIME_RESULT` 的前端面板拼装已集中到该 helper。

### 222.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程运行结果定位 action 拼装；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 222.3 验证

- 新增 `src/__tests__/features/runtimeResultFocusFlowAction.test.js`，覆盖曲线/日志运行点定位、显式 statePointId 和刷新结果 disabled 状态。
- 更新 Workbench 主流程导航、资源曲线点、日志行、分析动作结果和刷新结果反馈，改为消费共享 helper。
- `rg -n "kind:\s*WORKBENCH_FLOW_ACTION_KINDS\.(SELECT_RUNTIME_RESULT|SELECT_RUNTIME_STATE_POINT)" src\features\workbench`：只剩 `runtimeResultFocusFlowAction.js` 内的集中生成点。
- `npm run test -- --run src/__tests__/features/runtimeResultFocusFlowAction.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、60 条测试。
- `npm run test -- --run`：通过，32 个测试文件、178 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 223. UI 主流程能力块：Runtime Action Edit Target Contract

本阶段属于 UI 主流程。

### 223.1 结构变化

`src/features/workbench/workbenchFlowModel.js` 新增并导出：

```js
createWorkbenchFlowRuntimeActionEditTarget(runtimeDetail)
```

该函数输出统一的运行结果回改目标：

```js
{
  actionId,
  fieldKey: 'startMs',
  frameLabel,
  statePointId,
  trackKey,
  trackLabel,
  label,
  canFocusAction
}
```

`createWorkbenchFlowModel()` 输出新增：

```js
runtimeActionEditTarget
```

来源为当前 `runtimeDetail`。当当前运行详情为空时，字段保持空值，`canFocusAction` 为 `false`。

已接入位置：

```text
WorkbenchFlowPanel edit runtime action button
RuntimeSelectedDetailPanel action focus button
ResourceMonitorPanel runtime curve selected point action focus
EventLogPanel runtime log action focus
```

这些入口会优先使用 `flowModel.runtimeActionEditTarget`；当状态点不匹配或没有 flow model 时，使用 `createWorkbenchFlowRuntimeActionEditTarget()` 从本地 detail / point / row 构造同形 fallback。

### 223.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程的运行结果回改目标；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 223.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 runtime result 与 edit result review 阶段的 `runtimeActionEditTarget`。
- 更新 WorkbenchFlowPanel、RuntimeSelectedDetailPanel、ResourceMonitorPanel、EventLogPanel，改为优先消费模型层回改目标。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/runtimeActionFocusFlowAction.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、60 条测试。
- `npm run test -- --run`：通过，32 个测试文件、178 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 224. UI 主流程能力块：Runtime Result Return Target Contract

本阶段属于 UI 主流程。

### 224.1 结构变化

`createWorkbenchFlowModel()` 输入新增：

```js
actionEditFocus
```

用于让 flow model 识别当前编辑是否来源于 runtime result focus。

`src/features/workbench/workbenchFlowModel.js` 新增并导出：

```js
createWorkbenchFlowRuntimeResultReturnTarget({
  actionEditFocus,
  editResult,
  runtimeActionEditTarget,
  selectedActionId
})
```

该函数复用既有 `createRuntimeResultReturnContext()`，输出：

```js
{
  status,
  actionId,
  fieldKey,
  label,
  summary,
  originStatePointId,
  statePointId
}
```

`createWorkbenchFlowModel()` 输出新增：

```js
runtimeResultReturnTarget
```

当 `actionEditFocus.editOrigin !== 'runtime-focus'`、action 不匹配、没有 origin state point，或没有刷新后 runtime state point 时，该字段为 `null`。

已接入位置：

```text
Workbench.vue -> createWorkbenchFlowModel({ actionEditFocus })
RuntimeSelectedDetailPanel -> flowModel.runtimeResultReturnTarget
EventLogPanel -> flowModel.runtimeResultReturnTarget
ResourceMonitorPanel -> flowModel.runtimeResultReturnTarget when selected point matches target statePointId
```

PropertiesPanel 保留原本 `allowOriginResult: true` 的本地来源结果 fallback，用于还未产生刷新结果时的“回到来源结果”入口。

### 224.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程的刷新结果回看目标；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 224.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 edit result ready 与 edit result review 阶段的 `runtimeResultReturnTarget`。
- 更新 RuntimeSelectedDetailPanel、EventLogPanel、ResourceMonitorPanel，改为优先消费模型层返回目标。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、61 条测试。
- `npm run test -- --run`：通过，32 个测试文件、178 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 225. UI 主流程能力块：Main Flow State Contract

本阶段属于 UI 主流程。

### 225.1 结构变化

`createWorkbenchFlowModel()` 输出新增：

```js
mainFlowState
```

`src/features/workbench/workbenchFlowModel.js` 新增并导出：

```js
createWorkbenchMainFlowState({
  phase,
  primaryAction,
  runtimeDetail,
  runtimeActionEditTarget,
  editResult,
  runtimeResultReturnTarget
})
```

`mainFlowState` 当前字段：

```js
{
  phase,
  primaryAction,
  runtimeDetail,
  runtimeActionEditTarget,
  editResult,
  runtimeResultReturnTarget,
  resultReturnTarget,
  nextTargetKind,
  currentRuntimeStatePointId,
  refreshedRuntimeStatePointId,
  actionEditStatePointId,
  returnStatePointId,
  canFocusRuntimeAction,
  canReturnRuntimeResult
}
```

`nextTargetKind` 当前映射：

```text
open-runtime-results -> runtime-results
focus-runtime-action -> runtime-action-edit
return-runtime-result -> runtime-result-return
```

`WorkbenchFlowPanel` 改为消费 `mainFlowState` 中的主操作、回改目标和结果返回目标，并暴露以下主流程定位字段：

```html
data-main-flow-next-target-kind
data-main-flow-action-edit-state-point-id
data-main-flow-return-state-point-id
```

### 225.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程状态合同；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 225.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 action edit、runtime result、edit result ready、edit result review 四种阶段的 `mainFlowState`。
- 更新 `src/__tests__/views/Workbench.test.js`，确认主流程面板在编辑、运行结果、刷新结果待回看、刷新结果已回看阶段暴露对应 `mainFlowState` 目标。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、58 条测试。
- `npm run test -- --run`：通过，32 个测试文件、178 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

## 226. UI 主流程能力块：Shared Main Flow Targets

本阶段属于 UI 主流程。

### 226.1 结构变化

`src/features/workbench/workbenchFlowModel.js` 新增并导出：

```js
resolveWorkbenchMainFlowActionEditTarget({
  flowModel,
  fallbackTarget,
  statePointId
})

resolveWorkbenchMainFlowResultReturnTarget({
  flowModel,
  fallbackTarget,
  statePointId
})
```

两个解析函数优先读取：

```js
flowModel.mainFlowState.runtimeActionEditTarget
flowModel.mainFlowState.resultReturnTarget
```

当主流程目标不存在、缺少 `statePointId`，或与传入的 `statePointId` 不匹配时，才回退到调用方传入的 fallback。

已接入位置：

```text
PropertiesPanel -> flowModel.mainFlowState.resultReturnTarget
RuntimeSelectedDetailPanel -> main flow action edit / result return target
ResourceMonitorPanel -> selected curve point action edit / result context
EventLogPanel -> selected log action edit / result return target
```

`Workbench.vue` 传给 `PropertiesPanel` 的 props 新增：

```vue
:flow-model="workbenchFlowModel"
```

### 226.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程目标解析；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 226.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖主流程目标解析、状态点匹配和 fallback。
- 更新 `src/__tests__/views/Workbench.test.js`，确认主流程面板、属性面板、三值详情、资源曲线和日志详情共享同一个刷新结果返回点。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、58 条测试。

## 227. UI 主流程能力块：Shared Main Flow Actions

本阶段属于 UI 主流程。

### 227.1 结构变化

新增文件：

```text
src/features/workbench/workbenchMainFlowActions.js
```

该模块新增并导出：

```js
createWorkbenchOpenRuntimeResultsFlowAction({
  flowModel,
  source,
  enabled
})

createWorkbenchRuntimeStatePointFlowAction(options)

createWorkbenchRuntimeResultFlowAction(options)

createWorkbenchRuntimeActionEditFlowAction({
  source,
  target,
  enabled,
  disabledReason
})

createWorkbenchRuntimeResultReturnFlowAction({
  source,
  target,
  enabled,
  disabledReason
})
```

共享 action builder 统一生成以下 Workbench 主流程 action：

```text
open-runtime-results
select-runtime-state-point
select-runtime-result
focus-runtime-action
return-runtime-result
```

已接入位置：

```text
WorkbenchFlowPanel
PropertiesPanel
RuntimeSelectedDetailPanel
ResourceMonitorPanel
EventLogPanel
AnalysisPanel
```

`runtimeActionFocusFlowAction.js` 与 `runtimeResultFocusFlowAction.js` 仍作为底层 action payload 合同保留，面板层改为通过 `workbenchMainFlowActions.js` 消费。

### 227.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程 action 创建入口；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 227.3 验证

- 新增 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 open runtime、select runtime state point、select runtime result、focus runtime action、return runtime result。
- 继续运行 `src/__tests__/features/workbenchFlowModel.test.js` 与 `src/__tests__/views/Workbench.test.js`，确认主流程闭环行为不变。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、62 条测试。

## 228. UI 主流程能力块：Primary Flow Workspace Layout

本阶段属于 UI 主流程。

### 228.1 结构变化

`src/views/Workbench.vue` 的主界面布局由原先的同级 grid 区域：

```text
actions / timeline / resources / analysis / events
```

调整为：

```text
actions / mainflow / inspector
```

新增主流程容器：

```html
data-testid="workbench-main-flow-workspace"
data-testid="workbench-primary-flow"
data-testid="workbench-runtime-review-stack"
data-testid="workbench-side-inspector"
```

布局语义：

```text
workbench-main-flow-workspace
  actions: ActionLibraryPanel
  mainflow:
    TimelineGridPreview
    runtime-review-stack:
      ResourceMonitorPanel
      EventLogPanel
  inspector:
    PropertiesPanel
    EnemyPanel
    RuntimeSelectedDetailPanel
    AnalysisPanel
```

`workbench-main-flow-workspace` 与 `workbench-primary-flow` 暴露：

```html
data-flow-phase
data-main-flow-next-target-kind
```

`workbench-side-inspector` 暴露：

```html
data-flow-phase
```

### 228.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 布局结构；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 228.3 验证

- 更新 `src/__tests__/views/Workbench.test.js`，覆盖主流程工作区、主流程列、运行回看区域和右侧检查器的结构。
- 页面测试确认 action edit、runtime result、edit result ready、edit result review 阶段的布局状态跟随 `workbenchFlowModel` 更新。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、54 条测试。

## 229. UI 主流程能力块：Primary Flow Selection Contract

本阶段属于 UI 主流程。

### 229.1 结构变化

`src/features/workbench/workbenchFlowModel.js` 新增：

```js
WORKBENCH_MAIN_FLOW_REGIONS
```

当前值：

```js
{
  ACTION_EDIT: 'action-edit',
  RUNTIME_REVIEW: 'runtime-review'
}
```

`createWorkbenchFlowModel()` 输出新增：

```js
mainFlowSelection
```

新增并导出：

```js
createWorkbenchMainFlowSelection({
  phase,
  selectedAction,
  selectedStateCurvePointId,
  runtimeFocusSource,
  runtimeOverviewActive,
  runtimeDetail,
  editResult,
  mainFlowState
})
```

`mainFlowSelection` 当前字段：

```js
{
  phase,
  currentRegion,
  nextRegion,
  inspectorMode,
  selectedActionId,
  selectedActionName,
  selectedStateCurvePointId,
  selectedRuntimeStatePointId,
  pendingRuntimeStatePointId,
  refreshedRuntimeStatePointId,
  runtimeFocusSource,
  runtimeOverviewActive,
  hasRuntimeSelection,
  hasPendingRuntimeResult
}
```

`currentRegion` 表示当前主流程焦点在动作编辑区还是运行回看区。

`nextRegion` 由 `mainFlowState.nextTargetKind` 推导：

```text
runtime-results -> runtime-review
runtime-result-return -> runtime-review
runtime-action-edit -> action-edit
```

`inspectorMode` 当前取值：

```text
action-properties
edit-result
runtime-detail
```

`src/views/Workbench.vue` 的主流程布局容器新增消费字段：

```html
data-main-flow-current-region
data-main-flow-next-region
data-main-flow-selected-action-id
data-main-flow-selected-runtime-state-point-id
data-main-flow-pending-runtime-state-point-id
data-main-flow-inspector-mode
```

### 229.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、导入导出结构或 localStorage 数据。

该变化只影响 Workbench UI 主流程选择状态合同；三值计算、runtime projection 数值结果和草稿保存结构不变。

### 229.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 action edit、runtime result、edit result ready、edit result review 四种阶段的 `mainFlowSelection`。
- 更新 `src/__tests__/views/Workbench.test.js`，确认主流程布局容器同步当前区域、下一目标区域、选中运行点和待回看刷新点。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、58 条测试。

## 230. UI 主流程能力块：Main Flow Selection Consumers

### 230.1 结构变化

本阶段不变更保存数据、导入导出 schema 或 runtime 数值结构，只调整 Workbench 面板消费选择状态的 UI 合同。

`TimelineGridPreview` 新增可选输入：

```js
flowModel
```

当存在 `flowModel.mainFlowSelection` 时，时间轴优先使用：

```js
flowModel.mainFlowSelection.selectedActionId
flowModel.mainFlowSelection.selectedStateCurvePointId
flowModel.mainFlowSelection.runtimeFocusSource
```

缺省时继续回退到旧 props：

```js
selectedActionId
selectedStateCurvePointId
runtimeFocusSource
```

`ResourceMonitorPanel`、`EventLogPanel` 和 `AnalysisPanel` 的运行点选择也改为优先消费 `flowModel.mainFlowSelection.selectedStateCurvePointId`；`AnalysisPanel` 的当前动作判断改为优先消费 `flowModel.mainFlowSelection.selectedActionId`。

`TimelineGridPreview` 根节点新增诊断属性，用于 Workbench 主流程测试确认选择合同已经传入实际时间轴面板：

```html
data-flow-selected-action-id
data-flow-selected-state-curve-point-id
data-flow-runtime-focus-source
```

### 230.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、localStorage 草稿结构或任何游戏数据表结构。

该变化只影响 Workbench UI 面板消费主流程选择状态的方式；三值生成、runtime projection、simLog、stateCurves 和 summary 结果不变。

### 230.3 验证

- 更新 `src/__tests__/features/TimelineGridPreview.test.js`，覆盖时间轴在主流程选择合同与旧 props 冲突时优先采用 `mainFlowSelection`。
- 更新 `src/__tests__/views/Workbench.test.js`，确认 Workbench 中时间轴、资源曲线、事件日志和分析面板在 runtime result 与 edit result review 阶段同步到同一运行点。
- `npm run test -- --run src/__tests__/features/TimelineGridPreview.test.js src/__tests__/views/Workbench.test.js src/__tests__/features/workbenchFlowModel.test.js`：通过，3 个测试文件、60 条测试。
- `npm run test -- --run`：通过，33 个测试文件、183 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 231. UI 主流程能力块：State Curve Flow Entrypoints

### 231.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果，只扩展 Workbench UI flow action 的路由合同。

`select-runtime-state-point` action 的 `payload` 可以携带：

```js
{
  preserveStateCurveFilters: true
}
```

`workbenchFlowController` 在处理 `SELECT_RUNTIME_STATE_POINT` 时会把该字段透传给 `createRuntimePointFocusPlan`，使状态曲线入口可以聚焦运行点但保留当前曲线层/轨筛选。

`TimelineGridPreview` 新增 `dispatch-flow-action` 输出。点击已应用 runtime 状态点时，组件发出：

```js
{
  kind: 'select-runtime-state-point',
  source: 'state-curve-point',
  statePointId,
  payload: {
    preserveStateCurveFilters: true
  }
}
```

`AnalysisPanel` 的状态曲线列表、相邻点导航和同帧分组切换增加 runtime 点识别：当目标 `statePointId` 属于 runtime projection 时走 `select-runtime-state-point` 主流程 action；非 runtime 候选/采样/占位点继续使用原有 `select-state-curve-point` 本地选择事件。

### 231.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、localStorage 草稿结构或任何游戏数据表结构。

该变化只影响 Workbench UI 主流程 action 的入口路由；`simLog`、`stateCurves`、资源曲线、summary 和三值数值结果不变。

### 231.3 验证

- 更新 `src/__tests__/features/workbenchFlowController.test.js`，确认 `SELECT_RUNTIME_STATE_POINT` 可以把 `preserveStateCurveFilters` 送入 runtime point focus plan。
- 更新 `src/__tests__/views/Workbench.test.js`，确认时间轴 runtime 状态点点击发出主流程 action，并保持原有状态曲线导航范围。
- `npm run test -- --run src/__tests__/features/workbenchFlowController.test.js src/__tests__/features/workbenchRuntimeFlowPlan.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、65 条测试。
- `npm run test -- --run`：通过，33 个测试文件、183 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 232. UI 主流程能力块：Main Flow Dispatch Result State

### 232.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果，只在 Workbench UI 层新增主流程 action 执行结果状态。

`src/views/Workbench.vue` 新增本地状态：

```js
workbenchFlowDispatchState
```

当前字段：

```js
{
  sequence,
  handled,
  kind,
  source,
  handlerKey,
  reason,
  actionId,
  statePointId
}
```

`dispatchWorkbenchFlowAction(action)` 现在会返回 `workbenchFlowController.dispatch(action)` 的结果，并把该结果规范化写入 `workbenchFlowDispatchState`。成功和失败都会被记录。

`workbench-main-flow-workspace` 新增诊断属性：

```html
data-main-flow-dispatch-sequence
data-main-flow-dispatch-handled
data-main-flow-dispatch-kind
data-main-flow-dispatch-source
data-main-flow-dispatch-handler-key
data-main-flow-dispatch-reason
data-main-flow-dispatch-action-id
data-main-flow-dispatch-state-point-id
```

### 232.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、localStorage 草稿结构或任何游戏数据表结构。

该变化只影响 Workbench UI 主流程 action 执行结果的运行时状态；`simLog`、`stateCurves`、资源曲线、summary 和三值数值结果不变。

### 232.3 验证

- 更新 `src/__tests__/views/Workbench.test.js`，确认初始状态、成功 action 和失败 action 都会在 Workbench 主流程工作区记录统一 dispatch result。
- `npm run test -- --run src/__tests__/views/Workbench.test.js src/__tests__/features/workbenchFlowController.test.js`：通过，2 个测试文件、58 条测试。
- `npm run test -- --run`：通过，33 个测试文件、184 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 233. UI 主流程能力块：Dispatch Result Flow Model Contract

### 233.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果，只把 Workbench UI 主流程 action 执行结果纳入 `WorkbenchFlowModel`。

`createWorkbenchFlowModel` 新增可选输入：

```js
flowDispatchState
```

模型新增输出：

```js
mainFlowDispatchResult
```

当前字段：

```js
{
  sequence,
  status,
  handled,
  hasResult,
  kind,
  source,
  handlerKey,
  reason,
  actionId,
  statePointId
}
```

`status` 当前取值：

```text
idle
handled
failed
```

`Workbench.vue` 将本地 `workbenchFlowDispatchState` 作为 `flowDispatchState` 输入传给 `createWorkbenchFlowModel`，主流程工作区改为读取 `workbenchFlowModel.mainFlowDispatchResult`。

`WorkbenchFlowPanel` 新增消费 `workbenchFlow.mainFlowDispatchResult`，用于让主流程面板和主流程工作区基于同一模型合同观察 action 执行状态。

### 233.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、localStorage 草稿结构或任何游戏数据表结构。

该变化只影响 Workbench UI 主流程模型的运行时状态；`simLog`、`stateCurves`、资源曲线、summary 和三值数值结果不变。

### 233.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 `mainFlowDispatchResult` 的 idle、handled、failed 规范化输出。
- 更新 `src/__tests__/views/Workbench.test.js`，确认 Workbench 主流程工作区和 `WorkbenchFlowPanel` 消费同一份 dispatch result。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、60 条测试。
- `npm run test -- --run`：通过，33 个测试文件、185 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 234. UI 主流程能力块：Main Flow Loop State Contract

### 234.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果，只在 `WorkbenchFlowModel` 中新增主流程闭环状态。

新增枚举：

```js
WORKBENCH_MAIN_FLOW_LOOP_STATUSES
WORKBENCH_MAIN_FLOW_LOOP_STEPS
```

`createWorkbenchFlowModel` 新增输出：

```js
mainFlowLoopState
```

当前字段：

```js
{
  step,
  status,
  recoveryNeeded,
  currentRegion,
  nextRegion,
  nextActionKind,
  nextTargetKind,
  canRunNextAction,
  targetActionId,
  targetStatePointId,
  lastDispatchStatus,
  lastDispatchKind,
  lastDispatchHandled,
  lastDispatchReason
}
```

`status` 当前取值：

```text
ready
advanced
blocked
```

`step` 当前取值：

```text
action-edit
runtime-overview
runtime-review
edit-result-ready
edit-result-review
```

`mainFlowLoopState` 由 `phase`、`mainFlowState`、`mainFlowSelection` 和 `mainFlowDispatchResult` 派生，用于描述主流程当前步骤、下一 action、下一目标区域和是否需要失败恢复。

`Workbench.vue` 与 `WorkbenchFlowPanel` 新增消费 `mainFlowLoopState` 的诊断属性，后续主流程 UI 可以基于同一模型合同驱动运行回看/回改/刷新回看闭环。

### 234.2 保存与迁移

本阶段不新增项目保存字段，不变更 `Project` schema、localStorage 草稿结构或任何游戏数据表结构。

该变化只影响 Workbench UI 主流程模型的运行时状态；`simLog`、`stateCurves`、资源曲线、summary 和三值数值结果不变。

### 234.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 action edit、edit result ready、edit result review，以及 handled/failed dispatch 下的 loop state。
- 更新 `src/__tests__/views/Workbench.test.js`，确认 Workbench 主流程工作区和 `WorkbenchFlowPanel` 消费同一份 loop state。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、60 条测试。
- `npm run test -- --run`：通过，33 个测试文件、185 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 235. UI 主流程能力块：Loop-Driven Primary Action

### 235.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增 `workbenchMainFlowActions` 导出函数：

```js
createWorkbenchMainFlowNextAction({
  flowModel,
  source,
  enabled
})
```

该函数读取：

```js
flowModel.mainFlowLoopState
flowModel.mainFlowState
```

并根据 `mainFlowLoopState.nextActionKind` 生成当前主流程下一步 action：

```text
open-runtime-results
focus-runtime-action
return-runtime-result
```

目标 action/state point 优先来自：

```js
mainFlowLoopState.targetActionId
mainFlowLoopState.targetStatePointId
```

若 loop state 没有下一步 action，则返回禁用 action：

```js
{
  canRun: false,
  disabledReason: 'missing-main-flow-next-action'
}
```

`WorkbenchFlowPanel` 的主动作按钮现在优先调用 `createWorkbenchMainFlowNextAction`；当按钮不是当前主动作时，仍使用原明确目标工厂，以保留辅助返回/编辑路径。

### 235.2 保存与迁移

本阶段只新增 UI 主流程 action 生成入口，不新增持久字段，不需要数据迁移。

### 235.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖三种主流程下一步 action 均由 loop state 生成。
- 复跑 `src/__tests__/views/Workbench.test.js`，确认主流程页面闭环仍可执行。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、61 条测试。
- `npm run test -- --run`：通过，33 个测试文件、187 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 236. UI 主流程能力块：Loop-Driven Recovery Action

### 236.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增 `workbenchMainFlowActions` 导出函数：

```js
createWorkbenchMainFlowRecoveryAction({
  flowModel,
  source,
  enabled
})
```

该函数读取：

```js
flowModel.mainFlowLoopState.recoveryNeeded
flowModel.mainFlowLoopState.nextActionKind
flowModel.mainFlowLoopState.canRunNextAction
flowModel.mainFlowLoopState.targetActionId
flowModel.mainFlowLoopState.targetStatePointId
```

当 `recoveryNeeded` 为 true 时，恢复 action 复用 `createWorkbenchMainFlowNextAction` 的生成逻辑，因此恢复路径与正常主流程下一步共享同一 action 合同。

当 `recoveryNeeded` 为 false 时，返回禁用 action：

```js
{
  canRun: false,
  disabledReason: 'main-flow-recovery-not-needed'
}
```

`WorkbenchFlowPanel` 新增内部恢复来源：

```js
workbench-flow-recovery
```

当当前按钮是主流程主动作且 `mainFlowLoopState.recoveryNeeded` 为 true 时，面板改用 `createWorkbenchMainFlowRecoveryAction` 派发；非 blocked 状态继续使用 `createWorkbenchMainFlowNextAction`。

### 236.2 保存与迁移

本阶段只新增 UI 主流程恢复 action 生成入口，不新增持久字段，不需要数据迁移。

### 236.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 blocked 状态生成 recovery action，以及非 blocked 状态禁用 recovery action。
- 更新 `src/__tests__/views/Workbench.test.js`，确认失败 dispatch 后可以通过主流程主动作恢复到运行结果，并把 loop state 从 blocked 推进到 advanced。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、63 条测试。
- `npm run test -- --run`：通过，33 个测试文件、189 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 237. UI 主流程能力块：Runtime Review Action Contract

### 237.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增 `workbenchMainFlowActions` 导出枚举：

```js
WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS
```

当前取值映射到既有 flow action kind：

```text
SELECT_STATE_POINT -> select-runtime-state-point
SELECT_RESULT -> select-runtime-result
FOCUS_ACTION -> focus-runtime-action
RETURN_RESULT -> return-runtime-result
```

新增统一入口：

```js
createWorkbenchRuntimeReviewFlowAction({
  kind,
  source,
  detail,
  target,
  context,
  actionId,
  statePointId,
  payload,
  enabled,
  disabledReason
})
```

该入口按 `kind` 分发到既有 action 工厂：

```text
select-runtime-state-point -> createWorkbenchRuntimeStatePointFlowAction
select-runtime-result -> createWorkbenchRuntimeResultFlowAction
focus-runtime-action -> createWorkbenchRuntimeActionEditFlowAction
return-runtime-result -> createWorkbenchRuntimeResultReturnFlowAction
```

不支持的 `kind` 返回禁用 action：

```js
{
  canRun: false,
  disabledReason: 'unsupported-runtime-review-flow-action'
}
```

接入组件：

```text
ResourceMonitorPanel
EventLogPanel
RuntimeSelectedDetailPanel
```

这些组件的曲线点选择、日志行选择、详情动作编辑和返回刷新结果入口现在通过同一 runtime review action 合同派发。

### 237.2 保存与迁移

本阶段只新增 UI 主流程 action 生成入口，不新增持久字段，不需要数据迁移。

### 237.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 review 合同生成四类 action，以及不支持 `kind` 时返回禁用 action。
- 复跑 `src/__tests__/views/Workbench.test.js`，确认现有运行结果查看、曲线/日志/详情定位、回改与返回主流程仍可执行。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、65 条测试。
- `npm run test -- --run`：通过，33 个测试文件、191 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 238. UI 主流程能力块：Runtime Review Selection Model

### 238.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增 `workbenchFlowModel` 枚举：

```js
WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES
```

当前取值：

```text
empty
overview
selected
pending-result
```

`createWorkbenchFlowModel` 新增输出：

```js
runtimeReviewSelection
```

当前字段：

```js
{
  phase,
  status,
  selectedActionId,
  selectedStatePointId,
  pendingActionId,
  pendingStatePointId,
  refreshedStatePointId,
  source,
  sourceKind,
  frameLabel,
  timeMs,
  trackKey,
  trackLabel,
  hasSelection,
  hasPendingResult,
  overviewActive,
  canFocusAction,
  canReturnResult,
  actionEditTargetActionId,
  actionEditTargetStatePointId,
  resultReturnActionId,
  resultReturnStatePointId,
  lastActionKind,
  lastActionSource,
  lastActionHandled,
  lastActionStatePointId
}
```

`runtimeReviewSelection` 由以下运行时输入派生：

```text
runtimeDetail
editResult
selectedStateCurvePointId
runtimeFocusSource
runtimeOverviewActive
runtimeActionEditTarget
runtimeResultReturnTarget
mainFlowDispatchResult
```

接入变化：

```text
Workbench.vue
ResourceMonitorPanel.vue
EventLogPanel.vue
```

Workbench 主工作区和运行结果栈新增 `data-runtime-review-*` 诊断属性；曲线与日志面板从 flow model 读取选择状态时优先消费 `runtimeReviewSelection`。

### 238.2 保存与迁移

本阶段只新增 Workbench UI 主流程模型的运行时选择状态，不新增持久字段，不需要数据迁移。

### 238.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 empty、selected、pending-result 三类 review selection 状态。
- 更新 `src/__tests__/views/Workbench.test.js`，确认初始、打开运行结果、失败恢复等主流程下的 review selection 属性随模型同步变化。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、60 条测试。
- `npm run test -- --run`：通过，33 个测试文件、191 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 241. UI 主流程能力块：Runtime Review Operation Flow Action

### 241.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchMainFlowActions` 新增运行结果 review operation 到 flow action 的统一入口：

```js
createWorkbenchRuntimeReviewOperationFlowAction()
createWorkbenchRuntimeReviewPrimaryOperationFlowAction()
```

`createWorkbenchRuntimeReviewOperationFlowAction()` 当前输入核心字段：

```js
{
  operationKind,
  flowModel,
  source,
  target,
  context,
  enabled
}
```

当 `flowModel.runtimeReviewOperations` 存在时，会优先消费模型里的操作目标：

```text
runtimeReviewOperations.focusAction
runtimeReviewOperations.returnResult
```

当前映射关系：

```text
focus-runtime-action -> createWorkbenchRuntimeActionEditFlowAction()
return-runtime-result -> createWorkbenchRuntimeResultReturnFlowAction()
```

`createWorkbenchRuntimeReviewPrimaryOperationFlowAction()` 读取：

```text
runtimeReviewOperations.primaryOperationKind
runtimeReviewOperations.primaryOperationEnabled
```

并生成当前主操作对应的 flow action。

`runtimeReviewOperations.focusAction` 新增运行点上下文字段：

```js
{
  timeMs,
  trackKey,
  trackLabel
}
```

`runtimeActionFocusFlowAction` 的 payload 新增：

```js
trackLabel
```

`createRuntimeActionEditFocusPlan()` 新增输入与输出上下文：

```js
trackLabel
originTrackLabel
```

当 `trackKey` 缺失但 `trackLabel` 存在时，运行结果定位的编辑焦点摘要会使用 `trackLabel` 保持可读。

`RuntimeSelectedDetailPanel` 现在通过 `createWorkbenchRuntimeReviewOperationFlowAction()` 生成“定位动作”和“回到结果点”的 flow action。

### 241.2 保存与迁移

本阶段只调整 Workbench UI 主流程运行时合同和 action 生成入口，不新增持久字段，不需要数据迁移。

### 241.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 operation state 生成 focus、return、pending primary return action。
- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，确认 `runtimeReviewOperations.focusAction` 保留运行点轨道上下文。
- 更新 `src/__tests__/features/workbenchActionEditFlowPlan.test.js`，覆盖仅有 `trackLabel` 时的编辑焦点摘要。
- `npm run test -- --run src/__tests__/features/workbenchActionEditFlowPlan.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、76 条测试。
- `npm run test -- --run`：通过，33 个测试文件、194 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 242. UI 主流程能力块：Runtime Review Operation Consumers

### 242.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

运行结果 review operation 的消费组件扩展为：

```text
RuntimeSelectedDetailPanel
ResourceMonitorPanel
EventLogPanel
```

以下操作现在统一通过 `createWorkbenchRuntimeReviewOperationFlowAction()` 生成 flow action：

```text
RuntimeSelectedDetailPanel: focus-runtime-action
RuntimeSelectedDetailPanel: return-runtime-result
ResourceMonitorPanel: focus-runtime-action
EventLogPanel: focus-runtime-action
EventLogPanel: return-runtime-result
```

以下选择动作继续通过 `createWorkbenchRuntimeReviewFlowAction()` 生成，因为它们不是 review operation，而是运行点选择：

```text
ResourceMonitorPanel: select-runtime-state-point
EventLogPanel: select-runtime-state-point
```

`createWorkbenchRuntimeReviewOperationFlowAction()` 的消费语义不变：优先读取 `flowModel.runtimeReviewOperations` 中对应 operation 的标准目标，在没有 flow model 目标时回退到调用方传入的 `target` 或 `context`。

### 242.2 保存与迁移

本阶段只调整 Workbench UI 主流程 action 生成入口，不新增持久字段，不需要数据迁移。

### 242.3 验证

- 更新 `src/__tests__/views/Workbench.test.js`，确认日志详情 focus action 保留 `trackKey/trackLabel`，日志详情 return action 保留 `originStatePointId/status`，曲线 focus action 保留 `trackKey/trackLabel`。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、67 条测试。
- `npm run test -- --run`：通过，33 个测试文件、194 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 243. UI 主流程能力块：Runtime Review Primary Dispatch

### 243.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`Workbench.vue` 运行结果 review 区新增主操作执行入口，直接读取：

```text
workbenchFlowModel.runtimeReviewOperations.primaryOperationKind
workbenchFlowModel.runtimeReviewOperations.primaryOperationEnabled
workbenchFlowModel.runtimeReviewOperations.focusAction
workbenchFlowModel.runtimeReviewOperations.returnResult
```

新增 dispatch source：

```text
runtime-review-primary
```

该入口通过以下 helper 生成 flow action：

```js
createWorkbenchRuntimeReviewPrimaryOperationFlowAction()
```

运行结果 review stack 新增诊断属性：

```text
data-runtime-review-primary-operation-kind
data-runtime-review-primary-operation-enabled
```

新增测试锚点：

```text
workbench-runtime-review-primary-bar
workbench-runtime-review-primary-operation
```

这些字段只描述 Workbench UI 主流程运行时状态，不进入草稿保存结构。

### 243.2 保存与迁移

本阶段只新增 Workbench runtime review 主操作 dispatch 入口，不新增持久字段，不需要数据迁移。

### 243.3 验证

- 更新 `src/__tests__/views/Workbench.test.js`，覆盖选中运行结果后从 review 主操作执行 `focus-runtime-action`。
- 更新 `src/__tests__/views/Workbench.test.js`，覆盖 pending 刷新结果后从 review 主操作执行 `return-runtime-result`。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、57 条测试。
- `npm run test -- --run`：通过，33 个测试文件、196 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 244. UI 主流程能力块：Main Flow Uses Review Primary Operation

### 244.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchMainFlowNextAction()` 的主流程 action 生成路径调整：

```text
focus-runtime-action
return-runtime-result
```

当 `flowModel.runtimeReviewOperations.primaryOperationKind` 与下一步 action kind 一致时，改为复用：

```js
createWorkbenchRuntimeReviewPrimaryOperationFlowAction()
```

fallback 规则保持不变：如果没有匹配的 `runtimeReviewOperations.primaryOperationKind`，继续使用：

```js
createWorkbenchRuntimeActionEditFlowAction()
createWorkbenchRuntimeResultReturnFlowAction()
```

因此顶部 `WorkbenchFlowPanel` 主流程按钮和 Workbench runtime review 区主操作现在共享同一套 review operation 目标解析，但 source 仍保留调用入口自身，例如：

```text
workbench-flow-panel
runtime-review-primary
```

### 244.2 保存与迁移

本阶段只调整 Workbench UI 主流程 action 生成路径，不新增持久字段，不需要数据迁移。

### 244.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖主流程 focus / return 在存在 `runtimeReviewOperations` 时复用 review primary operation。
- 更新 `src/__tests__/views/Workbench.test.js`，确认顶部主流程 focus / return dispatch 保留 review primary 的轨道上下文和返回结果上下文。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、70 条测试。
- `npm run test -- --run`：通过，33 个测试文件、197 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 245. UI 主流程能力块：Runtime Review Primary Command Model

### 245.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`runtimeReviewOperations` 新增运行时 UI 合同字段：

```js
primaryOperation
```

当前结构：

```js
{
  kind,
  enabled,
  disabledReason,
  label,
  actionId,
  statePointId,
  sourceKind,
  target
}
```

字段来源：

```text
kind -> runtimeReviewOperations.primaryOperationKind
target -> focusAction 或 returnResult
enabled/actionId/statePointId/sourceKind -> target
label -> kind 映射
```

当前 label 映射：

```text
focus-runtime-action -> 定位动作
return-runtime-result -> 回到结果点
其他/空 -> 主操作
```

`Workbench.vue` 运行结果 review 区现在直接消费：

```text
workbenchFlowModel.runtimeReviewOperations.primaryOperation
```

页面层不再单独计算 primary operation target / label。

### 245.2 保存与迁移

本阶段只新增 Workbench flow model 的运行时 UI 合同字段，不新增持久字段，不需要数据迁移。

### 245.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 empty、selected、pending-result、edit-result-review 下的 `primaryOperation` 合同。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、62 条测试。
- `npm run test -- --run`：通过，33 个测试文件、197 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 239. UI 主流程能力块：Runtime Review Selection Consumers

### 239.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

本阶段继续消费既有运行时模型：

```js
flowModel.runtimeReviewSelection
```

新增消费组件：

```text
RuntimeSelectedDetailPanel
```

补齐同源消费组件：

```text
ResourceMonitorPanel
EventLogPanel
RuntimeSelectedDetailPanel
```

三处面板根节点现在都可以从同一 `runtimeReviewSelection` 暴露以下运行时状态：

```text
data-runtime-review-selection-status
data-runtime-review-selected-action-id
data-runtime-review-selected-state-point-id
data-runtime-review-source
data-runtime-review-source-kind
```

详情面板额外暴露：

```text
data-runtime-review-detail-synced
```

用于表示当前详情 `detail.statePointId` 是否与 `runtimeReviewSelection.selectedStatePointId` 同步。

### 239.2 保存与迁移

本阶段只调整 Workbench UI 主流程的运行时消费关系，不新增持久字段，不需要数据迁移。

### 239.3 验证

- 更新 `src/__tests__/views/Workbench.test.js`，覆盖日志行选择和资源曲线点选择两条路径下，资源面板、日志面板、详情面板消费同一个 `runtimeReviewSelection`。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、55 条测试。
- `npm run test -- --run`：通过，33 个测试文件、191 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 240. UI 主流程能力块：Runtime Review Operation State

### 240.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增 `workbenchFlowModel` 枚举：

```js
WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS
```

当前取值：

```text
FOCUS_ACTION -> focus-runtime-action
RETURN_RESULT -> return-runtime-result
```

`createWorkbenchFlowModel` 新增输出：

```js
runtimeReviewOperations
```

当前字段：

```js
{
  primaryOperationKind,
  primaryOperationEnabled,
  canRunAnyOperation,
  selectionStatus,
  selectedStatePointId,
  pendingStatePointId,
  focusAction,
  returnResult
}
```

`focusAction`：

```js
{
  kind,
  enabled,
  disabledReason,
  actionId,
  statePointId,
  fieldKey,
  frameLabel,
  sourceKind
}
```

`returnResult`：

```js
{
  kind,
  enabled,
  disabledReason,
  actionId,
  statePointId,
  originStatePointId,
  status,
  sourceKind
}
```

`runtimeReviewOperations` 由 `runtimeReviewSelection`、`runtimeActionEditTarget` 和 `mainFlowState.resultReturnTarget` 派生。使用 `mainFlowState.resultReturnTarget` 是为了让直接编辑产生的 `editResult` 和运行点回改产生的 return context 共用同一返回结果操作合同。

`RuntimeSelectedDetailPanel` 现在消费 `flowModel.runtimeReviewOperations` 控制详情面板的定位动作/返回结果操作状态。

### 240.2 保存与迁移

本阶段只新增 Workbench UI 主流程模型的运行时操作状态，不新增持久字段，不需要数据迁移。

### 240.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 empty、selected、pending-result、edit-result-review 下的 operation 状态。
- 更新 `src/__tests__/views/Workbench.test.js`，确认详情面板在 pending 刷新结果、日志选中、曲线选中路径下消费同一 operation 状态。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、60 条测试。
- `npm run test -- --run`：通过，33 个测试文件、191 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 246. UI 主流程能力块：Workbench Flow Panel Primary Operation Consumer

### 246.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`WorkbenchFlowPanel` 顶部主流程按钮新增对以下运行时 UI 合同的消费：

```js
flowModel.runtimeReviewOperations.primaryOperation
```

适用按钮：

```text
workbench-flow-edit-runtime-action
workbench-flow-return-edit-result
```

当按钮对应的 action kind 是当前 `mainFlowState.primaryAction.kind`，且 `primaryOperation.kind` 与按钮 action kind 一致时，按钮的 actionId、statePointId 和 enabled 状态来自 `primaryOperation`。

没有匹配的 `primaryOperation` 时，保持旧 fallback：

```text
mainFlowState.runtimeActionEditTarget
mainFlowState.resultReturnTarget
mainFlowState.canFocusRuntimeAction
mainFlowState.canReturnRuntimeResult
```

新增测试文件：

```text
src/__tests__/features/WorkbenchFlowPanel.test.js
```

### 246.2 保存与迁移

本阶段只调整 Workbench 顶部主流程按钮的运行时 UI 消费关系，不新增持久字段，不需要数据迁移。

### 246.3 验证

- 新增 `src/__tests__/features/WorkbenchFlowPanel.test.js`，覆盖 fallback target 与 primaryOperation target 不一致时，按钮展示和 dispatch 均消费 `primaryOperation`。
- `npm run test -- --run src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、72 条测试。
- `npm run test -- --run`：通过，34 个测试文件、199 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 247. UI 主流程能力块：Runtime Detail Primary Operation Consumer

### 247.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`RuntimeSelectedDetailPanel` 的详情按钮新增对以下运行时 UI 合同的消费：

```js
flowModel.runtimeReviewOperations.primaryOperation
flowModel.runtimeReviewOperations.focusAction
flowModel.runtimeReviewOperations.returnResult
```

适用按钮：

```text
workbench-runtime-selected-detail-action-focus
workbench-runtime-selected-detail-return-result
```

解析顺序：

```text
primaryOperation.target
focusAction / returnResult
旧 fallback target
```

其中 `primaryOperation.target` 只在 `primaryOperation.kind` 与按钮操作类型一致，且 target 有内容时接管。空 operation 对象不会遮住旧 fallback。

同时修正 `runtimeDetailOriginStatePointId` 的空值判断：没有当前详情时，不再因为两个空 origin 值相等而读取空 detail。

新增测试文件：

```text
src/__tests__/features/RuntimeSelectedDetailPanel.test.js
```

### 247.2 保存与迁移

本阶段只调整 Workbench 详情面板的运行时 UI 消费关系，不新增持久字段，不需要数据迁移。

### 247.3 验证

- 新增 `src/__tests__/features/RuntimeSelectedDetailPanel.test.js`，覆盖 fallback target 与 primaryOperation target 不一致时，详情面板 focus / return 按钮展示和 dispatch 均消费 `primaryOperation.target`。
- `npm run test -- --run src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、74 条测试。
- `npm run test -- --run`：通过，35 个测试文件、201 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 248. UI 主流程能力块：Runtime Review Operation Consumer

### 248.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享 UI 消费入口：

```js
createWorkbenchRuntimeReviewOperationConsumer({
  operationKind,
  flowModel,
  source,
  target,
  context,
  enabled,
})
```

输出结构：

```js
{
  operationKind,
  source,
  target,
  context,
  enabled,
  disabledReason,
  action
}
```

解析顺序：

```text
runtimeReviewOperations.primaryOperation.target
runtimeReviewOperations.focusAction / returnResult
调用方 fallback target / context
disabled operation shape
```

接入面板：

```text
ResourceMonitorPanel
EventLogPanel
RuntimeSelectedDetailPanel
```

`createWorkbenchRuntimeReviewOperationFlowAction()` 继续保留，并改为内部复用 `createWorkbenchRuntimeReviewOperationConsumer().action`。

### 248.2 保存与迁移

本阶段只调整 Workbench UI 主流程的 operation 消费层，不新增持久字段，不需要数据迁移。

### 248.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 consumer 优先使用 `primaryOperation.target`，以及空 operation 不遮住 fallback target。
- `npm run test -- --run src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、76 条测试。
- `npm run test -- --run`：通过，35 个测试文件、203 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 249. UI 主流程能力块：Workbench Review Primary Consumer

### 249.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

Workbench 页面层新增运行时主操作 consumer：

```js
runtimeReviewPrimaryOperationConsumer
runtimeReviewPrimaryOperationTarget
runtimeReviewPrimaryOperationKind
```

来源：

```js
createWorkbenchRuntimeReviewOperationConsumer({
  flowModel: workbenchFlowModel.value,
  source: 'runtime-review-primary',
})
```

影响范围：

```text
workbench-runtime-review-primary-bar
workbench-runtime-review-primary-operation
dispatchRuntimeReviewPrimaryOperation()
```

review 主操作按钮的 actionId、statePointId、operationKind、disabled 状态和点击分发 action 现在来自同一份 `runtimeReviewPrimaryOperationConsumer`。

`createWorkbenchRuntimeReviewPrimaryOperationFlowAction()` 仍保留给 helper 和兼容路径使用，但 Workbench 页面主操作分发不再直接调用它。

### 249.2 保存与迁移

本阶段只调整 Workbench 页面层的 UI 主流程消费关系，不新增持久字段，不需要数据迁移。

### 249.3 验证

- 更新 `src/__tests__/views/Workbench.test.js`，补充 review primary bar 的 actionId、operationKind、statePointId 断言。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、72 条测试。
- `npm run test -- --run`：通过，35 个测试文件、203 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 250. UI 主流程能力块：Workbench Review Primary View Model

### 250.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

Workbench 页面层新增主操作 view model：

```js
runtimeReviewPrimaryOperationView
```

输出字段：

```js
{
  visible,
  operationKind,
  enabled,
  isFocusAction,
  actionId,
  statePointId,
  label,
  target,
  action
}
```

来源：

```js
createRuntimeReviewPrimaryOperationView({
  consumer: runtimeReviewPrimaryOperationConsumer.value,
  operations: workbenchFlowModel.value.runtimeReviewOperations,
})
```

影响范围：

```text
workbench-runtime-review-stack
workbench-runtime-review-primary-bar
workbench-runtime-review-primary-operation
dispatchRuntimeReviewPrimaryOperation()
```

模板主操作区域不再直接读取 `runtimeReviewOperations.primaryOperation*`，主操作显示与点击分发统一从 `runtimeReviewPrimaryOperationView` 读取。

### 250.2 保存与迁移

本阶段只调整 Workbench 页面层的 UI view model，不新增持久字段，不需要数据迁移。

### 250.3 验证

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、57 条测试。
- `npm run test -- --run`：通过，35 个测试文件、203 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 251. UI 主流程能力块：Shared Review Primary View Model

### 251.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchRuntimeReviewPrimaryOperationView({
  flowModel,
  source,
  consumer,
  operations,
})
```

输出字段：

```js
{
  visible,
  operationKind,
  enabled,
  isFocusAction,
  actionId,
  statePointId,
  label,
  target,
  action
}
```

默认来源：

```js
createWorkbenchRuntimeReviewOperationConsumer({
  flowModel,
  source,
})
```

Workbench 页面层的 `runtimeReviewPrimaryOperationView` 现在直接调用共享函数：

```js
createWorkbenchRuntimeReviewPrimaryOperationView({
  flowModel: workbenchFlowModel.value,
  source: 'runtime-review-primary',
})
```

### 251.2 保存与迁移

本阶段只把 Workbench 页面层的 review 主操作 view model 下沉到共享模块，不新增持久字段，不需要数据迁移。

### 251.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖共享 view model 的 visible、operationKind、enabled、isFocusAction、actionId、statePointId、label、target 和 action。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、73 条测试。
- `npm run test -- --run`：通过，35 个测试文件、204 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示、chunk size 提示，以及本机 PowerShell `Import-Clixml` 通道噪声。

## 252. UI 主流程能力块：Main Flow Status View Model

### 252.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchMainFlowStatusView({
  flowModel,
  mainFlowDispatchResult,
  mainFlowLoopState,
})
```

输出结构：

```js
{
  dispatch: {
    sequence,
    status,
    handled,
    handledState,
    hasResult,
    hasResultState,
    kind,
    source,
    handlerKey,
    reason,
    actionId,
    statePointId,
  },
  loop: {
    step,
    status,
    recoveryNeeded,
    recoveryNeededState,
    nextActionKind,
    nextTargetKind,
    currentRegion,
    nextRegion,
  },
}
```

Workbench 页面层新增：

```js
mainFlowStatusView
```

来源：

```js
createWorkbenchMainFlowStatusView({
  flowModel: workbenchFlowModel.value,
})
```

`workbench-main-flow-workspace` 根节点的 dispatch/loop data 属性现在从 `mainFlowStatusView` 读取，不再直接拼 `mainFlowDispatchResult.*` 和 `mainFlowLoopState.*`。

### 252.2 保存与迁移

本阶段只调整 Workbench 页面层的主流程状态 view model，不新增持久字段，不需要数据迁移。

### 252.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 handled 与 failed 两种 dispatch/loop 状态下的 `createWorkbenchMainFlowStatusView()` 输出。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、63 条测试。
- `npm run test -- --run`：通过，35 个测试文件、205 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 253. UI 主流程能力块：Flow Panel Status View Consumer

### 253.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`WorkbenchFlowPanel` 新增共享状态 view 消费：

```js
mainFlowStatusView
```

来源：

```js
createWorkbenchMainFlowStatusView({
  flowModel: workbenchFlow.value,
})
```

影响范围：

```text
workbench-flow-panel
data-main-flow-dispatch-*
data-main-flow-loop-*
```

顶部主流程面板的 dispatch/loop data 属性现在从 `mainFlowStatusView` 读取，和 Workbench 主工作区根节点共用同一套状态 view model。

### 253.2 保存与迁移

本阶段只调整 `WorkbenchFlowPanel` 的主流程状态消费关系，不新增持久字段，不需要数据迁移。

### 253.3 验证

- 更新 `src/__tests__/features/WorkbenchFlowPanel.test.js`，覆盖 focus / return 两条 primary operation 路径下的 dispatch/loop data 属性。
- `npm run test -- --run src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、65 条测试。
- `npm run test -- --run`：通过，35 个测试文件、205 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 254. UI 主流程能力块：Main Flow Loop Action Helper

### 254.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchMainFlowLoopAction({
  flowModel,
  source,
  recoverySource,
  enabled,
})
```

行为：

```text
mainFlowLoopState.recoveryNeeded === true -> createWorkbenchMainFlowRecoveryAction({ source: recoverySource || source })
否则 -> createWorkbenchMainFlowNextAction({ source })
```

`WorkbenchFlowPanel` 的 primary action dispatch 现在调用 `createWorkbenchMainFlowLoopAction()`，不再本地判断 recovery 分支。

### 254.2 保存与迁移

本阶段只调整 Workbench 顶部主流程面板的 action 创建 helper，不新增持久字段，不需要数据迁移。

### 254.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 normal source 与 recovery source 两条 loop action 路径。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、76 条测试。
- `npm run test -- --run`：通过，35 个测试文件、206 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 255. UI 主流程能力块：Main Flow Button View Helper

### 255.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchMainFlowButtonView({
  flowModel,
  kind,
  fallbackTarget,
  fallbackEnabled,
  source,
})
```

输出结构：

```js
{
  kind,
  isPrimary,
  enabled,
  actionId,
  statePointId,
  target,
  action,
}
```

行为：

```text
当 kind 是当前 mainFlowState.primaryAction.kind，且 runtimeReviewOperations.primaryOperationKind 与 kind 一致：
  通过 createWorkbenchRuntimeReviewOperationConsumer() 解析 review primary operation target / enabled / action。
否则：
  使用 fallbackTarget 与 fallbackEnabled 生成按钮视图。
```

`WorkbenchFlowPanel` 的查看运行结果、编辑结果动作、回到刷新结果按钮现在消费 `createWorkbenchMainFlowButtonView()`，不再本地解析 primary operation target / enabled。

### 255.2 保存与迁移

本阶段只调整 Workbench 顶部主流程面板的按钮视图 helper，不新增持久字段，不需要数据迁移。

### 255.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 fallback target 与 wrapped review primary operation target 两类 button view。
- 更新 `src/__tests__/features/WorkbenchFlowPanel.test.js`，使用 wrapped target 验证按钮展示和 dispatch 仍能定位到真实 review operation 目标。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、77 条测试。
- `npm run test -- --run`：通过，35 个测试文件、207 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 256. UI 主流程能力块：Runtime Review Primary Command

### 256.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchRuntimeReviewPrimaryOperationCommand({
  flowModel,
  source,
  view,
  consumer,
  operations,
})
```

输出结构：

```js
{
  source,
  visible,
  operationKind,
  enabled,
  actionId,
  statePointId,
  label,
  target,
  view,
  action,
}
```

行为：

```text
通过 createWorkbenchRuntimeReviewPrimaryOperationView() 生成 view。
command.view 用于页面展示。
command.action 直接复用 view.action，作为页面层 dispatch 的唯一 action 来源。
```

Workbench 页面层的运行结果主操作按钮现在消费 `runtimeReviewPrimaryOperationCommand.view` 展示，并通过 `runtimeReviewPrimaryOperationCommand.action` 分发。

### 256.2 保存与迁移

本阶段只调整 Workbench 运行结果主操作的页面消费结构，不新增持久字段，不需要数据迁移。

### 256.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 command 的 view/action 同源关系。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、76 条测试。
- `npm run test -- --run`：通过，35 个测试文件、208 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 257. UI 主流程能力块：Runtime Review Operation Command Consumers

### 257.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchRuntimeReviewOperationCommand({
  operationKind,
  flowModel,
  source,
  target,
  context,
  enabled,
  consumer,
})
```

输出结构：

```js
{
  operationKind,
  source,
  enabled,
  disabledReason,
  actionId,
  statePointId,
  target,
  context,
  action,
  view,
}
```

行为：

```text
通过 createWorkbenchRuntimeReviewOperationConsumer() 解析 operation target/context/enabled/action。
command.target / command.context 保留面板按钮读取的目标数据。
command.action 作为面板 dispatch 的统一 action 来源。
command.view 与 command.action 同源，供后续面板 view model 继续复用。
```

以下面板改为消费 `createWorkbenchRuntimeReviewOperationCommand()`：

```text
RuntimeSelectedDetailPanel：定位动作 / 回到结果点
EventLogPanel：定位动作 / 回到结果点
ResourceMonitorPanel：曲线点定位动作
```

### 257.2 保存与迁移

本阶段只调整运行结果区三个面板的 operation command 消费关系，不新增持久字段，不需要数据迁移。

### 257.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 operation command 的 context/action/view 同源关系。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、79 条测试。
- `npm run test -- --run`：通过，35 个测试文件、209 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 258. UI 主流程能力块：Runtime Review Panel Command View

### 258.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchRuntimeReviewPanelCommandView({
  flowModel,
  source,
  focusTarget,
  returnContext,
  focusCommand,
  returnCommand,
  focusEnabled,
  returnEnabled,
})
```

输出结构：

```js
{
  source,
  focus,
  returnResult,
  focusTarget,
  returnContext,
  canFocus,
  canReturn,
  actions: {
    focus,
    returnResult,
  },
}
```

行为：

```text
focusCommand 未传入时，通过 createWorkbenchRuntimeReviewOperationCommand(FOCUS_ACTION) 生成。
returnCommand 未传入时，通过 createWorkbenchRuntimeReviewOperationCommand(RETURN_RESULT) 生成。
focusTarget / returnContext / actions 均来自同一组 command，供运行结果面板统一消费。
```

以下面板改为消费 `createWorkbenchRuntimeReviewPanelCommandView()`：

```text
RuntimeSelectedDetailPanel：读取 view.focus / view.returnResult
ResourceMonitorPanel：读取 view.focus
EventLogPanel：读取 view.focus / view.returnResult；保留 focus seed command 以维持 return actionId 解析顺序
```

### 258.2 保存与迁移

本阶段只调整运行结果区面板 command view model，不新增持久字段，不需要数据迁移。

### 258.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 panel command view 同时输出 focus / returnResult 两类 command 与 actions。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、80 条测试。
- `npm run test -- --run`：通过，35 个测试文件、210 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 259. UI 主流程能力块：Runtime Review Flow View

### 259.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchRuntimeReviewFlowView({
  flowModel,
  mainFlowSelection,
  mainFlowState,
  runtimeReviewSelection,
  runtimeReviewOperations,
})
```

输出结构：

```js
{
  region: {
    currentRegion,
    nextRegion,
    nextTargetKind,
    inspectorMode,
    selectedActionId,
    selectedRuntimeStatePointId,
    pendingRuntimeStatePointId,
    refreshedRuntimeStatePointId,
  },
  selection: {
    status,
    selectedActionId,
    selectedStatePointId,
    pendingActionId,
    pendingStatePointId,
    refreshedStatePointId,
    source,
    sourceKind,
    lastActionKind,
    lastActionSource,
    hasSelection,
    hasSelectionState,
    hasPendingResult,
    hasPendingResultState,
    overviewActive,
    overviewActiveState,
  },
  operations: {
    primaryOperationKind,
    primaryOperationEnabled,
    primaryOperationEnabledState,
    canRunAnyOperation,
    canRunAnyOperationState,
    primaryActionId,
    primaryStatePointId,
    primaryLabel,
    focusActionEnabled,
    focusActionEnabledState,
    returnResultEnabled,
    returnResultEnabledState,
  },
}
```

`Workbench` 主工作区、primary flow、runtime review stack、side inspector 的运行结果选择和区域 data 属性现在从 `runtimeReviewFlowView` 读取，不再直接散读 `mainFlowSelection` / `runtimeReviewSelection`。

### 259.2 保存与迁移

本阶段只调整 Workbench 页面层的运行结果主流程 view model，不新增持久字段，不需要数据迁移。

### 259.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 selected runtime result 与 pending refreshed result 两种 `createWorkbenchRuntimeReviewFlowView()` 输出。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、64 条测试。
- `npm run test -- --run`：通过，35 个测试文件、211 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 260. UI 主流程能力块：Runtime Review Primary Uses Main Flow Button View

### 260.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchMainFlowButtonView()` 的 primary 判断扩展为：

```text
mainFlowState.primaryAction.kind 存在时：按 primaryAction.kind === kind 判断。
mainFlowState.primaryAction.kind 不存在时：允许 runtimeReviewOperations.primaryOperationKind === kind 的运行结果 primary 场景被识别为 primary。
```

`createWorkbenchRuntimeReviewPrimaryOperationView()` 现在通过 `createWorkbenchMainFlowButtonView()` 解析：

```text
target
enabled
actionId
statePointId
action
```

新增输出字段：

```js
buttonView
```

`createWorkbenchRuntimeReviewPrimaryOperationCommand()` 的 `view.action` 与 `view.buttonView.action` 保持同源。

### 260.2 保存与迁移

本阶段只调整运行结果区 primary operation 与主流程按钮 view 的共享解析关系，不新增持久字段，不需要数据迁移。

### 260.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，确认 runtime review primary view/command 暴露并复用 `buttonView`，且 action 与 button view action 同源。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、80 条测试。
- `npm run test -- --run`：通过，35 个测试文件、211 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 261. UI 主流程能力块：Action Edit Result Return Command View

### 261.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`PropertiesPanel` 的刷新结果回看入口改为消费：

```js
createWorkbenchRuntimeReviewPanelCommandView({
  flowModel,
  source: 'properties-panel',
  returnContext,
})
```

其中 `returnResult` command 继续输出：

```js
{
  context,
  enabled,
  action,
}
```

用于按钮目标、可用状态和 dispatch。侧边栏原有显示 context 继续保留，只把实际 return action 创建收束到共享 runtime review command/view。

### 261.2 保存与迁移

本阶段只调整动作编辑侧边面板的 return command 消费关系，不新增持久字段，不需要数据迁移。

### 261.3 验证

- Workbench 页面测试确认从动作编辑侧边面板返回刷新后结果仍可分发并定位到 refreshed runtime state point。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、78 条测试。
- `npm run test -- --run`：通过，35 个测试文件、211 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 262. UI 主流程能力块：Main Flow Command Surface

### 262.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增共享函数：

```js
createWorkbenchMainFlowCommandSurface({
  flowModel,
  source,
  recoverySource,
  runtimeReviewPrimarySource,
})
```

输出结构：

```js
{
  source,
  recoverySource,
  openRuntimeResults,
  runtimeActionEdit,
  runtimeResultReturn,
  runtimeReviewPrimary,
  buttons: {
    openRuntimeResults,
    runtimeActionEdit,
    runtimeResultReturn,
  },
  actions: {
    openRuntimeResults,
    runtimeActionEdit,
    runtimeResultReturn,
    runtimeReviewPrimary,
  },
}
```

其中 `openRuntimeResults`、`runtimeActionEdit`、`runtimeResultReturn` 是 main flow button command：

```js
{
  ...buttonView,
  view,
  action,
}
```

primary 场景下 `action` 来自 `createWorkbenchMainFlowLoopAction()`；非 primary 场景下 `action` 来自对应 fallback action。`runtimeReviewPrimary` 继续复用 `createWorkbenchRuntimeReviewPrimaryOperationCommand()`，但由同一 command surface 暴露给 Workbench 页面层消费。

`WorkbenchFlowPanel` 与 `Workbench` 页面层现在改为消费 `createWorkbenchMainFlowCommandSurface()`，减少顶部主流程按钮和运行结果区 primary 操作之间的分散 action 创建。

### 262.2 保存与迁移

本阶段只调整主流程 command/view 消费关系，不新增持久字段，不需要数据迁移。

### 262.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 command surface 同时输出顶部按钮 action 与 runtime review primary action，并确认两类入口保持各自 source。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、81 条测试。
- `npm run test -- --run`：通过，35 个测试文件、212 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 263. UI 主流程能力块：FlowPanel Shares Page Command Surface

### 263.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`WorkbenchFlowPanel` 新增可选 prop：

```js
mainFlowCommandSurface: Object | null
```

消费规则：

```text
props.mainFlowCommandSurface 存在时：直接作为顶部主流程按钮的 command surface。
props.mainFlowCommandSurface 不存在时：继续通过 createWorkbenchMainFlowCommandSurface({ flowModel, source, recoverySource }) fallback 创建。
```

`Workbench` 页面层现在将页面级 `mainFlowCommandSurface` 传给 `WorkbenchFlowPanel`：

```vue
<WorkbenchFlowPanel
  :flow-model="workbenchFlowModel"
  :main-flow-command-surface="mainFlowCommandSurface"
/>
```

这样顶部主流程按钮与页面运行结果 primary 操作共享同一份 command surface 来源。

### 263.2 保存与迁移

本阶段只调整组件间 command surface 传递关系，不新增持久字段，不需要数据迁移。

### 263.3 验证

- 更新 `src/__tests__/features/WorkbenchFlowPanel.test.js`，覆盖注入的 command surface，确认按钮 view 和 dispatch action 均来自外部 surface。
- `npm run test -- --run src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、60 条测试。
- `npm run test -- --run`：通过，35 个测试文件、213 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 264. UI 主流程能力块：Runtime Panels Consume Main Flow Command Surface

### 264.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchMainFlowCommandSurface()` 新增两个绑定当前 `flowModel` 的工厂函数：

```js
{
  createRuntimeReviewOperationCommand(options),
  createRuntimeReviewPanelCommandView(options),
}
```

默认行为：

```text
options.flowModel 存在时：使用 options.flowModel。
options.flowModel 不存在时：使用 command surface 创建时绑定的 flowModel。
```

以下面板新增可选 `mainFlowCommandSurface` prop，并优先通过页面级 surface 生成运行结果操作命令：

```text
ResourceMonitorPanel
EventLogPanel
RuntimeSelectedDetailPanel
PropertiesPanel
```

`Workbench` 页面层现在将同一份 `mainFlowCommandSurface` 传给顶部 FlowPanel、资源曲线、日志、运行详情和动作属性面板。

### 264.2 保存与迁移

本阶段只调整主流程 command surface 与运行面板之间的消费关系，不新增持久字段，不需要数据迁移。

### 264.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 command surface 的 panel command view 工厂，并确认 focus/return action 继续按 runtime review operation 优先级解析。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、81 条测试。
- `npm run test -- --run`：通过，35 个测试文件、213 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 265. UI 主流程能力块：Runtime Selection Actions Consume Command Surface

### 265.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchMainFlowCommandSurface()` 新增 runtime selection action 工厂：

```js
{
  createRuntimeReviewFlowAction(options),
  createRuntimeStatePointFlowAction(options),
  createRuntimeResultFlowAction(options),
}
```

消费关系调整：

```text
WorkbenchFlowPanel：上一条/下一条运行结果导航使用 createRuntimeStatePointFlowAction。
ResourceMonitorPanel：曲线点选择使用 createRuntimeReviewFlowAction。
EventLogPanel：日志行选择使用 createRuntimeReviewFlowAction。
Workbench：state curve runtime 点选择使用 createRuntimeStatePointFlowAction。
```

这些入口仍生成原有 `select-runtime-state-point` / `select-runtime-result` 类 action，只是 action 创建入口收束到页面级 command surface。

### 265.2 保存与迁移

本阶段只调整运行结果选择 action 的创建入口，不新增持久字段，不需要数据迁移。

### 265.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 command surface 的 runtime review selection action 与 state point selection action 工厂。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、82 条测试。
- `npm run test -- --run`：通过，35 个测试文件、213 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 266. UI 主流程能力块：Analysis Timeline Selection Uses Command Surface

### 266.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

以下组件新增可选 `mainFlowCommandSurface` prop：

```text
AnalysisPanel
TimelineGridPreview
```

消费关系调整：

```text
AnalysisPanel：动作结果定位、最近编辑结果定位、状态曲线 runtime 点选择优先通过页面级 command surface 创建 action。
TimelineGridPreview：时间轴 runtime state marker 选择优先通过页面级 command surface 创建 action。
Workbench：向 AnalysisPanel 与 TimelineGridPreview 传入同一份 mainFlowCommandSurface。
```

这些入口仍生成原有 `select-runtime-state-point` / `select-runtime-result` action；本阶段只调整 action 创建入口。

### 266.2 保存与迁移

本阶段只调整分析面板和时间轴的 runtime selection action 创建入口，不新增持久字段，不需要数据迁移。

### 266.3 验证

- 更新 `src/__tests__/features/TimelineGridPreview.test.js`，确认注入的 command surface 会接管 runtime state marker 的 action 创建。
- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 command surface 的 runtime result selection action 工厂。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/TimelineGridPreview.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、82 条测试。
- `npm run test -- --run`：通过，35 个测试文件、214 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 267. UI 主流程能力块：Edit Source Actions Consume Command Surface

### 267.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchMainFlowCommandSurface()` 新增：

```js
createFocusEditSourceFlowAction({
  source,
  actionId,
  fieldKey,
  payload,
  enabled,
  disabledReason,
})
```

该工厂生成既有 `focus-edit-source` action。

`AnalysisPanel` 的编辑来源定位入口改为优先通过页面级 `mainFlowCommandSurface` 创建该 action；未传入 surface 时回退到本地 `createWorkbenchFlowAction()`。

### 267.2 保存与迁移

本阶段只调整编辑来源定位 action 的创建入口，不新增持久字段，不需要数据迁移。

### 267.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 command surface 的 edit source action 工厂。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、79 条测试。
- `npm run test -- --run`：通过，35 个测试文件、214 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 268. UI 主流程能力块：Contribution Actions Consume Command Surface

### 268.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchMainFlowCommandSurface()` 新增：

```js
createContributionPointFlowAction({
  source,
  actionId,
  statePointId,
  payload,
  enabled,
  disabledReason,
})
```

该工厂生成既有 `select-contribution-point` action。

`AnalysisPanel` 的动作贡献拆分行选择入口改为优先通过页面级 `mainFlowCommandSurface` 创建该 action；未传入 surface 时回退到本地 `createWorkbenchFlowAction()`。

### 268.2 保存与迁移

本阶段只调整贡献拆分定位 action 的创建入口，不新增持久字段，不需要数据迁移。

### 268.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 command surface 的 contribution point action 工厂。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、79 条测试。
- `npm run test -- --run`：通过，35 个测试文件、214 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过。

## 269. UI 主流程能力块：Contribution Flow Plan Payload

### 269.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`select-contribution-point` 进入 `workbenchFlowController` 后的 handler payload 从裸 `statePointId` 字符串调整为结构化对象：

```js
{
  actionId,
  statePointId,
  source,
  runtimeFocusSource,
  preserveStateCurveFilters,
}
```

`createWorkbenchFlowPlanHandlers()` 的贡献拆分 handler 继续生成既有 runtime point focus plan，其中实际 runtime 日志/曲线聚焦来源保持为 `action-contribution`。

### 269.2 保存与迁移

本阶段只调整 Workbench 主流程 controller 内部 payload 合同，不新增持久字段，不需要数据迁移。

### 269.3 验证

- 更新 `src/__tests__/features/workbenchFlowController.test.js`，覆盖贡献拆分 action 的结构化 payload 分发与 runtime point focus plan 生成。
- `npm run test -- --run src/__tests__/features/workbenchFlowController.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、60 条测试。
- `npm run test -- --run`：通过，35 个测试文件、214 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过。

## 270. UI 主流程能力块：Runtime Point Selection State In Flow Runtime

### 270.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchFlowRuntime()` 新增可选回调：

```js
applyRuntimePointSelectionState(selectionState)
```

并新增运行时方法：

```js
applyRuntimePointSelection({ statePointId })
```

`workbenchFlowRuntime` 现在负责调用 `createWorkbenchFlowRuntimePointSelectionState()` 创建 runtime 点选择状态；Workbench 页面层只接收并应用该状态。

### 270.2 保存与迁移

本阶段只调整 Workbench 主流程 runtime 的内部状态应用入口，不新增持久字段，不需要数据迁移。

### 270.3 验证

- 更新 `src/__tests__/features/workbenchFlowRuntime.test.js`，覆盖 runtime flow plan 选择点时输出共享选择状态，以及直接 `applyRuntimePointSelection()` 路径。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、62 条测试。
- `npm run test -- --run`：通过，35 个测试文件、215 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过。

## 271. UI 主流程能力块：Calculator Scope State In Flow Runtime

### 271.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchFlowRuntime()` 新增可选回调：

```js
getFirstRuntimeStatePointId()
applyCalculatorScopeState(scopeState)
```

并新增运行时方法：

```js
applyCalculatorScope({
  scope,
  selectFirstRuntimePoint,
})
```

`workbenchFlowRuntime` 现在负责调用 `createWorkbenchFlowRuntimeScopeState()` 创建 calculator scope / runtime overview 状态；Workbench 页面层只接收并应用该状态。

### 271.2 保存与迁移

本阶段只调整 Workbench 主流程 runtime 的内部状态应用入口，不新增持久字段，不需要数据迁移。

### 271.3 验证

- 更新 `src/__tests__/features/workbenchFlowRuntime.test.js`，覆盖直接 calculator scope 切换输出共享 scope state，以及 runtime overview plan 的 pulsed scope state 入口。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、63 条测试。
- `npm run test -- --run`：通过，35 个测试文件、216 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过。

## 272. UI 主流程能力块：Runtime View State In Flow Runtime

### 272.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchFlowRuntime()` 新增可选回调：

```js
applyRuntimeViewState(viewState)
```

runtime flow plan 现在会被整理为内部 `RuntimeViewState`：

```js
{
  clearRuntimeSelection,
  stateCurveFocusMode,
  stateCurveLayerFilters,
  stateCurveTrackFilters,
  runtimeLogFocus,
}
```

Workbench 页面层从四个低层回调收束为一个 `applyRuntimeViewState()`；旧回调仍留在 `workbenchFlowRuntime` 内作为 fallback。

### 272.2 保存与迁移

本阶段只调整 Workbench 主流程 runtime 的内部 view state 应用入口，不新增持久字段，不需要数据迁移。

### 272.3 验证

- 更新 `src/__tests__/features/workbenchFlowRuntime.test.js`，覆盖 runtime result return 和 runtime overview plan 输出统一 view state。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、63 条测试。
- `npm run test -- --run`：通过，35 个测试文件、216 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过。

## 273. UI 主流程能力块：Action Edit State In Flow Runtime

### 273.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchFlowRuntime()` 新增可选回调：

```js
applyActionSelectionState(selectionState)
applyActionEditState(editState)
```

runtime flow plan 中的 action selection 会整理为内部 `ActionSelectionState`：

```js
{
  requestedActionId,
  actionId,
  shouldSelectAction,
  syncRuntimeResult,
}
```

action edit flow plan 会整理为内部 `ActionEditState`：

```js
{
  actionId,
  actionSelection,
  actionEditFocus,
}
```

Workbench 页面层从 `selectAction` / `setActionEditFocus` 两个低层回调收束为 `applyActionSelectionState()` / `applyActionEditState()`。

### 273.2 保存与迁移

本阶段只调整 Workbench 主流程 runtime 的内部 action state 应用入口，不新增持久字段，不需要数据迁移。

### 273.3 验证

- 更新 `src/__tests__/features/workbenchFlowRuntime.test.js`，覆盖 action edit plan 输出统一 edit state、runtime flow plan 输出统一 selection state，以及 optional edit-source focus 在动作不存在时仍能应用编辑焦点且不选择动作。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、64 条测试。
- `npm run test -- --run`：通过，35 个测试文件、217 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过。

## 274. UI 主流程能力块：Action Mutation Runtime Sync State

### 274.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchFlowRuntime()` 新增可选回调和状态查询：

```js
applyActionMutationRuntimeSyncState(syncState)
isRuntimeOverviewActive()
isRuntimeStatePointSelected()
```

动作新增、复制、删除、批量移动后的 runtime 回看同步会整理为内部 `ActionMutationRuntimeSyncState`：

```js
{
  requestedActionId,
  actionId,
  actionAvailable,
  shouldSyncRuntimeResult,
  mutationSelectedAction,
  mutationTouchedRuntimeAction,
  force,
}
```

Workbench 页面层新增 `captureActionMutationRuntimeReviewState()`，只负责在动作变更前采集当前回看快照；后续是否同步、同步哪个 action 由 `workbenchFlowRuntime.applyActionMutationRuntimeSync()` 统一处理。

### 274.2 保存与迁移

本阶段只调整 Workbench 主流程 runtime 的内部 action mutation sync state 应用入口，不新增持久字段，不需要数据迁移。

### 274.3 验证

- 更新 `src/__tests__/features/workbenchFlowRuntime.test.js`，覆盖 runtime overview、选中 runtime 点、变更前回看快照和未处于回看时跳过同步四类 action mutation sync 场景。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、68 条测试。
- `npm run test -- --run`：通过，35 个测试文件、221 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 284. UI 主流程能力块：Runtime Selection Action Surface

### 284.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchMainFlowActions` 新增 runtime selection action surface：

```js
createWorkbenchRuntimeSelectionFlowAction(options)
createWorkbenchRuntimeSelectionFlowActionFromSurface(input)
createRuntimeSelectionFlowAction(options)
```

其中 `createRuntimeSelectionFlowAction()` 是 `createWorkbenchMainFlowCommandSurface()` 暴露的面板侧工厂。它生成的 flow action 仍为既有 `select-runtime-state-point`，只是把面板侧“选择运行时点”的语义入口从泛用 runtime review action kind 中抽出来。

`createWorkbenchRuntimeSelectionFlowActionFromSurface()` 的回退顺序为：

```js
mainFlowCommandSurface.createRuntimeSelectionFlowAction(options)
mainFlowCommandSurface.createRuntimeStatePointFlowAction(options)
createWorkbenchRuntimeSelectionFlowAction(options)
```

`ResourceMonitorPanel` 与 `EventLogPanel` 的运行点选择改为消费新的 selection surface，不再直接传 `WORKBENCH_RUNTIME_REVIEW_FLOW_ACTION_KINDS.SELECT_STATE_POINT`。

### 284.2 保存与迁移

本阶段只调整 Workbench UI 主流程 action factory 暴露边界，不新增持久字段，不需要数据迁移。

### 284.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 runtime selection factory、command surface 注入路径和无 surface 回退路径。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、84 条测试。
- `npm run test -- --run`：通过，37 个测试文件、236 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 275. UI 主流程能力块：Result Return Command Surface

### 275.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchMainFlowCommandSurface()` 新增共享命令工厂：

```js
createRuntimeResultReturnCommand({
  source,
  target,
  context,
  enabled,
})
```

该工厂返回现有 runtime review operation command 形态：

```js
{
  operationKind,
  source,
  enabled,
  disabledReason,
  actionId,
  statePointId,
  target,
  context,
  action,
}
```

`createWorkbenchRuntimeReviewPanelCommandView()` 的 `returnResult` 分支改为通过 `createWorkbenchRuntimeResultReturnCommand()` 创建。返回结果命令会优先消费 `flowModel.runtimeReviewOperations.returnResult` / `primaryOperation`，再回退到调用方传入的 `context` 或 `target`。

### 275.2 保存与迁移

本阶段只调整 Workbench 主流程 command surface 的内部命令生成入口，不新增持久字段，不需要数据迁移。

### 275.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 surface 直接创建 return-result command，以及 helper 从共享 review return target 生成 action。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、85 条测试。
- `npm run test -- --run`：通过，35 个测试文件、222 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 276. UI 主流程能力块：Runtime Action Edit Command Surface

### 276.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchMainFlowCommandSurface()` 新增共享命令工厂：

```js
createRuntimeActionEditCommand({
  source,
  target,
  context,
  enabled,
})
```

该工厂返回现有 runtime review operation command 形态：

```js
{
  operationKind,
  source,
  enabled,
  disabledReason,
  actionId,
  statePointId,
  target,
  context,
  action,
}
```

`createWorkbenchRuntimeReviewPanelCommandView()` 的 `focus` 分支改为通过 `createWorkbenchRuntimeActionEditCommand()` 创建。动作编辑命令会优先消费 `flowModel.runtimeReviewOperations.focusAction` / `primaryOperation`，再回退到调用方传入的 `target` 或 `context`。

### 276.2 保存与迁移

本阶段只调整 Workbench 主流程 command surface 的内部动作编辑命令生成入口，不新增持久字段，不需要数据迁移。

### 276.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 surface 直接创建 action-edit command，以及 helper 从共享 review focus target 生成 action。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、86 条测试。
- `npm run test -- --run`：通过，35 个测试文件、223 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 277. UI 主流程能力块：Analysis Flow Action Factories

### 277.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchMainFlowActions` 新增共享 action helper：

```js
createWorkbenchFocusEditSourceFlowAction(options)
createWorkbenchContributionPointFlowAction(options)
```

`createWorkbenchMainFlowCommandSurface()` 的以下工厂改为复用共享 helper：

```js
createFocusEditSourceFlowAction(options)
createContributionPointFlowAction(options)
```

`AnalysisPanel` 的独立 fallback 也改为使用这些 helper，不再直接调用 `createWorkbenchFlowAction()` 或读取底层 `WORKBENCH_FLOW_ACTION_KINDS`。

### 277.2 保存与迁移

本阶段只调整 Workbench UI 主流程 action 工厂边界，不新增持久字段，不需要数据迁移。

### 277.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖编辑来源回跳和贡献定位两个共享 helper。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、82 条测试。
- `npm run test -- --run`：通过，35 个测试文件、224 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 278. UI 主流程能力块：Runtime Selection Surface Resolvers

### 278.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchMainFlowActions` 新增 surface-aware resolver：

```js
createWorkbenchRuntimeReviewFlowActionFromSurface(input)
createWorkbenchRuntimeStatePointFlowActionFromSurface(input)
createWorkbenchRuntimeResultFlowActionFromSurface(input)
createWorkbenchFocusEditSourceFlowActionFromSurface(input)
createWorkbenchContributionPointFlowActionFromSurface(input)
```

输入结构统一为：

```js
{
  mainFlowCommandSurface,
  ...actionOptions
}
```

resolver 会先调用对应的 `mainFlowCommandSurface.create*` 工厂；如果当前组件独立挂载或没有页面级 surface，则回退到 `workbenchMainFlowActions` 内的共享 action helper。

### 278.2 保存与迁移

本阶段只调整 Workbench UI 主流程 action 解析边界，不新增持久字段，不需要数据迁移。

### 278.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖有 command surface 时走 surface、无 command surface 时走共享 fallback 的 runtime selection resolver。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/TimelineGridPreview.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、87 条测试。
- `npm run test -- --run`：通过，35 个测试文件、226 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 279. UI 主流程能力块：Runtime Review Context View

### 279.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchFlowModel()` 新增内部 UI view：

```js
runtimeReviewContextView
```

该 view 统一承载运行结果查看阶段的选择上下文：

```js
{
  status,
  selectedActionId,
  selectedStatePointId,
  pendingActionId,
  pendingStatePointId,
  refreshedStatePointId,
  source,
  sourceKind,
  hasSelection,
  hasSelectionState,
  hasPendingResult,
  hasPendingResultState,
  overviewActive,
  overviewActiveState,
  detailStatePointId,
  detailSynced,
  detailSyncedState,
}
```

`ResourceMonitorPanel`、`EventLogPanel`、`RuntimeSelectedDetailPanel` 改为读取该 view，而不是分别读取 `runtimeReviewSelection` 或自行判断详情同步状态。

### 279.2 保存与迁移

本阶段只调整 Workbench UI 主流程的运行结果查看上下文读取入口，不新增持久字段，不需要数据迁移。

### 279.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖共享 runtime review context view 的选中状态和详情同步状态。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、67 条测试。
- `npm run test -- --run`：通过，35 个测试文件、227 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 280. UI 主流程能力块：Runtime Review Context Consumers

### 280.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchRuntimeReviewContextView()` 的输入兼容范围扩大：当 `runtimeReviewSelection` 未提供完整选中点时，会从 `flowModel.mainFlowSelection` 读取：

```js
mainFlowSelection.selectedStateCurvePointId
mainFlowSelection.selectedRuntimeStatePointId
mainFlowSelection.selectedActionId
mainFlowSelection.runtimeFocusSource
```

`TimelineGridPreview` 与 `AnalysisPanel` 的当前状态点读取改为消费 `runtimeReviewContextView.selectedStatePointId`；时间轴的运行焦点来源改为优先读取 `runtimeReviewContextView.source`。

### 280.2 保存与迁移

本阶段只调整 Workbench UI 主流程消费者的运行结果上下文读取入口，不新增持久字段，不需要数据迁移。

### 280.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 context view 从 `mainFlowSelection` 和独立 `selectedStateCurvePointId` 回退读取。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/TimelineGridPreview.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、68 条测试。
- `npm run test -- --run`：通过，35 个测试文件、227 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 281. UI 主流程能力块：Runtime View State Apply Boundary

### 281.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增内部 UI 状态 helper：

```js
createWorkbenchRuntimePointSelectionApplyState(selectionState, context)
createWorkbenchRuntimeViewApplyState(viewState, context)
createWorkbenchCalculatorScopeApplyState(scopeState, context)
createWorkbenchRuntimeLogFocusState(input)
```

这些 helper 统一生成 Workbench 页面应用运行视图状态时需要的：

```js
selectedStatePointId
stateCurveFocusMode
stateCurveLayerFilters
stateCurveTrackFilters
runtimeLogFocus
```

`Workbench.vue` 的 runtime point selection、runtime view state、calculator scope state 应用逻辑改为消费上述 helper，保持现有 result-return / runtime-log focus 行为不变。

### 281.2 保存与迁移

本阶段只调整 Workbench UI 主流程的页面状态应用边界，不新增持久字段，不需要数据迁移。

### 281.3 验证

- 新增 `src/__tests__/features/workbenchRuntimeViewState.test.js`，覆盖运行点选择、运行视图日志 focus、calculator scope、独立 runtime log focus 的状态生成。
- `npm run test -- --run src/__tests__/features/workbenchRuntimeViewState.test.js src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、72 条测试。
- `npm run test -- --run`：通过，36 个测试文件、231 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 282. UI 主流程能力块：Main Flow Plan Request Boundary

### 282.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增内部 UI 主流程 plan request 模块：

```js
createWorkbenchRuntimeEntryPlanRequest(input)
createWorkbenchRuntimeResultReturnPlanRequest(input)
createWorkbenchRuntimePointFocusPlanRequest(input)
createWorkbenchContributionPointFocusPlanRequest(input)
createWorkbenchRuntimeActionEditPlanRequest(input)
createWorkbenchEditSourceActionEditPlanRequest(input)
createWorkbenchFlowPlanFromRequest(input)
applyWorkbenchFlowPlanRequest(input)
```

Plan request 统一携带：

```js
{
  applicationKind,
  methodKey,
  payload,
}
```

其中 `applicationKind` 决定应用到 runtime flow 还是 action-edit flow；`methodKey` 指向 `createWorkbenchFlowPlanController()` 暴露的 plan 生成方法。

`workbenchFlowController` 的 plan handler 改为消费上述 request helper，不再直接拼 plan controller 方法名和 payload。`SELECT_RUNTIME_RESULT` 与 `RETURN_RUNTIME_RESULT` 均继续生成同一种 runtime-result-return request。

### 282.2 保存与迁移

本阶段只调整 Workbench UI 主流程的 plan request 生成边界，不新增持久字段，不需要数据迁移。

### 282.3 验证

- 新增 `src/__tests__/features/workbenchFlowPlanRequests.test.js`，覆盖 runtime / action-edit request 生成、plan 生成和应用分流。
- `npm run test -- --run src/__tests__/features/workbenchFlowPlanRequests.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/features/workbenchFlowPlanController.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、65 条测试。
- `npm run test -- --run`：通过，37 个测试文件、234 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 283. UI 主流程能力块：Flow Action Plan Request Resolver

### 283.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchFlowPlanRequests` 新增 flow action resolver：

```js
createWorkbenchFlowActionPlanRequest(action)
```

该 resolver 把完整 flow action 统一解析为：

```js
{
  supported,
  reason,
  flowAction,
  handlerKey,
  payload,
  request,
}
```

其中 `request` 仍为上一阶段定义的 plan request：

```js
{
  applicationKind,
  methodKey,
  payload,
}
```

`WORKBENCH_FLOW_CONTROLLER_HANDLERS` 移到 `workbenchFlowPlanRequests` 定义并由 `workbenchFlowController` 继续 re-export，保持外部导入兼容。

`workbenchFlowController.dispatch()` 改为调用 `createWorkbenchFlowActionPlanRequest()`，不再直接按 action kind 拼 handler payload。`createWorkbenchFlowPlanHandlers()` 在 controller dispatch 场景下优先消费 resolver 已生成的 `planRequest`，直接调用 handler 时保留原 fallback。

### 283.2 保存与迁移

本阶段只调整 Workbench UI 主流程的 flow action -> plan request 解析边界，不新增持久字段，不需要数据迁移。

### 283.3 验证

- 更新 `src/__tests__/features/workbenchFlowPlanRequests.test.js`，覆盖 open-runtime-results、return-runtime-result、focus-runtime-action 的 flow action request 解析，以及 disabled / unsupported action 的失败状态。
- `npm run test -- --run src/__tests__/features/workbenchFlowPlanRequests.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、92 条测试。
- `npm run test -- --run`：通过，37 个测试文件、236 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 Git 换行转换提示。

## 285. UI 主流程能力块：Panel Action Surface Binding

### 285.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchMainFlowActions` 新增面板侧 action surface 绑定器：

```js
createWorkbenchMainFlowActionSurface({
  mainFlowCommandSurface,
})
```

该绑定器返回一组已携带 `mainFlowCommandSurface` 的面板 action factory：

```js
{
  createRuntimeReviewFlowAction(options),
  createRuntimeSelectionFlowAction(options),
  createRuntimeStatePointFlowAction(options),
  createRuntimeResultFlowAction(options),
  createFocusEditSourceFlowAction(options),
  createContributionPointFlowAction(options),
}
```

这些 factory 仍复用既有 `createWorkbench*FromSurface()` 回退规则；本阶段只是把面板内重复的 `mainFlowCommandSurface + helper` 包装集中到共享入口。

`AnalysisPanel` 改为通过绑定后的 action surface 创建：

```js
analysis-action-result
analysis-edit-source
analysis-edit-result
analysis-action-contribution
analysis-state-curve / analysis-state-curve-nav / analysis-state-curve-frame-group
```

`TimelineGridPreview` 的 applied runtime state curve marker 选择也改为通过绑定后的 `createRuntimeSelectionFlowAction()` 创建。输出 flow action 类型保持为既有 runtime selection / result / edit-source / contribution point action。

### 285.2 保存与迁移

本阶段只调整 Workbench UI 主流程面板 action factory 消费边界，不新增持久字段，不需要数据迁移。

### 285.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖 panel action surface 对 runtime selection、runtime result、edit-source、contribution point 四类面板动作的 command surface 注入路径。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/TimelineGridPreview.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、88 条测试。
- `npm run test -- --run`：通过，37 个测试文件、237 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 286. UI 主流程能力块：Runtime View Patch Boundary

### 286.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchRuntimeViewState` 新增 runtime view patch helper：

```js
createWorkbenchRuntimePointSelectionViewPatch(selectionState, options)
createWorkbenchRuntimeFlowViewPatch(viewState, options)
createWorkbenchCalculatorScopeViewPatch(scopeState, options)
```

这些 helper 仍复用既有 apply state 规则，统一输出 Workbench 页面可应用的 patch：

```js
{
  changes: {
    selectedStatePointId,
    stateCurveFocusMode,
    stateCurveLayerFilters,
    stateCurveTrackFilters,
    runtimeLogFocus,
    calculatorScope,
  },
  pulseCalculatorFocus,
  selectRuntimeActionStatePointId,
  selectRuntimeStatePointId,
}
```

`changes` 只携带需要应用的字段；`selectRuntimeActionStatePointId` 和 `selectRuntimeStatePointId` 表示页面应用 patch 后需要继续执行的主流程操作。

`Workbench.vue` 新增页面内部 `applyRuntimeViewPatch()`，并将以下入口改为先生成 patch 再统一应用：

```js
applyRuntimePointSelectionState(selectionState)
applyRuntimeViewState(viewState)
applyCalculatorScopeFlowState(scopeState)
```

Calculator scope patch 保持旧行为优先级：当 `selectRuntimeStatePoint` 与 `clearRuntimeSelection` 同时存在时，runtime state point selection 优先，patch 不额外输出 clear selection change。

### 286.2 保存与迁移

本阶段只调整 Workbench UI 主流程 runtime view 状态应用边界，不新增持久字段，不需要数据迁移。

### 286.3 验证

- 更新 `src/__tests__/features/workbenchRuntimeViewState.test.js`，覆盖 runtime point selection patch、runtime flow view patch、calculator scope patch，以及 runtime selection 优先于 clear selection 的边界。
- `npm run test -- --run src/__tests__/features/workbenchRuntimeViewState.test.js src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、76 条测试。
- `npm run test -- --run`：通过，37 个测试文件、241 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 287. UI 主流程能力块：Flow Runtime View Patch Output

### 287.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`createWorkbenchFlowRuntime()` 新增可选回调：

```js
getCurrentRuntimeLogFocus()
applyRuntimeViewPatch(patch)
```

当调用方提供 `applyRuntimeViewPatch()` 时，flow runtime 会优先把以下中间状态转换为 runtime view patch 后输出：

```js
createWorkbenchFlowRuntimePointSelectionState(...)
createRuntimeViewState(...)
createWorkbenchFlowRuntimeScopeState(...)
```

对应转换继续复用上一阶段新增的 patch helper：

```js
createWorkbenchRuntimePointSelectionViewPatch(...)
createWorkbenchRuntimeFlowViewPatch(...)
createWorkbenchCalculatorScopeViewPatch(...)
```

`Workbench.vue` 的 `createWorkbenchFlowRuntime()` 配置改为只提供：

```js
getCurrentRuntimeLogFocus: () => runtimeLogFocus.value
applyRuntimeViewPatch: patch => applyRuntimeViewPatch(patch)
```

页面层不再提供以下三类中间态回调：

```js
applyCalculatorScopeState
applyRuntimePointSelectionState
applyRuntimeViewState
```

`workbenchFlowRuntime` 仍保留上述旧回调作为兼容回退路径，避免影响现有测试和潜在调用方。

### 287.2 保存与迁移

本阶段只调整 Workbench UI 主流程 flow runtime 到页面状态的内部合同，不新增持久字段，不需要数据迁移。

### 287.3 验证

- 更新 `src/__tests__/features/workbenchFlowRuntime.test.js`，覆盖 runtime flow plan 与 direct calculator scope 通过 `applyRuntimeViewPatch()` 输出 patch 的优先路径，并保留旧中间态回调兼容测试。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/features/workbenchRuntimeViewState.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、78 条测试。
- `npm run test -- --run`：通过，37 个测试文件、243 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 288. UI 主流程能力块：Runtime Focus Source Contract

### 288.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchFlowPlanRequests` 的 runtime view 相关 request payload 新增标准字段：

```js
runtimeLogFocusSource
```

适用入口：

```js
createWorkbenchRuntimePointFocusPlanRequest(...)
createWorkbenchRuntimeResultReturnPlanRequest(...)
createWorkbenchContributionPointFocusPlanRequest(...)
```

新增内部归一规则：

```js
createRuntimeViewFocusPlanPayload({
  statePointId,
  source,
  runtimeLogFocusSource,
  defaultRuntimeLogFocusSource,
})
```

该规则会保留调用来源 `source`，并单独计算运行日志/曲线焦点来源 `runtimeLogFocusSource`。当 `statePointId` 为空时，`runtimeLogFocusSource` 会输出为空，避免空结果点驱动日志焦点。

`workbenchFlowPlanController` 将 `runtimeLogFocusSource` 透传给 runtime flow plan：

```js
createRuntimePointFocusFlowPlan({
  statePointId,
  source,
  runtimeLogFocusSource,
  preserveStateCurveFilters,
})

createRuntimeResultReturnFlowPlan({
  actionId,
  statePointId,
  source,
  runtimeLogFocusSource,
})
```

`workbenchRuntimeFlowPlan` 继续兼容旧调用：如果未传 `runtimeLogFocusSource`，会回退使用 `source`，runtime result return 再回退到 `action-result`。

贡献点定位的 request payload 现在可以同时表达：

```js
{
  source: 'analysis-action-contribution',
  runtimeLogFocusSource: 'action-contribution',
}
```

### 288.2 保存与迁移

本阶段只调整 Workbench UI 主流程 request / plan 的内部来源字段，不新增持久字段，不需要数据迁移。

### 288.3 验证

- 更新 `src/__tests__/features/workbenchFlowPlanRequests.test.js`，覆盖 runtime point、runtime result、contribution point request payload 的 `runtimeLogFocusSource`。
- 更新 `src/__tests__/features/workbenchFlowController.test.js`，覆盖 flow action 到 plan request 后的 runtime focus source 透传。
- 更新 `src/__tests__/features/workbenchRuntimeFlowPlan.test.js`，覆盖 `runtimeLogFocusSource` 与 `source` 不一致时的 runtime flow plan 输出。
- `npm run test -- --run src/__tests__/features/workbenchFlowPlanRequests.test.js src/__tests__/features/workbenchFlowController.test.js src/__tests__/features/workbenchFlowPlanController.test.js src/__tests__/features/workbenchRuntimeFlowPlan.test.js src/__tests__/views/Workbench.test.js`：通过，5 个测试文件、77 条测试。
- `npm run test -- --run`：通过，37 个测试文件、245 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 289. UI 主流程能力块：Runtime Focus Source View

### 289.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`runtimeFocusSource` 新增共享 source view：

```js
createRuntimeFocusSourceView(source)
```

输出结构：

```js
{
  source,
  sourceKind,
  runtimeLogScope,
  runtimeLogLabel,
  curveSelectionLabel,
  isRuntimeResultFocus,
  isContributionFocus,
  isRuntimeLogFocusSource,
}
```

同步新增/改造 helper：

```js
isRuntimeLogFocusSource(source)
resolveRuntimeFocusSourceKind(source)
normalizeRuntimeLogFocusScope(source)
```

`workbenchFlowModel` 的 runtime review `sourceKind` 改为通过 `resolveRuntimeFocusSourceKind()` 获取。`action-contribution` 现在会归类为 `action-contribution`，而不是通用 `other`。

`EventLogPanel` 改为消费 `createRuntimeFocusSourceView()` 获取日志 scope 和 label；runtime log focus watcher 改为使用共享 `isRuntimeLogFocusSource()`。

`ResourceMonitorPanel` 的曲线选择来源显示改为消费 `createRuntimeFocusSourceView(source).curveSelectionLabel`。

### 289.2 保存与迁移

本阶段只调整 Workbench UI 主流程 runtime focus source 的内部解释层，不新增持久字段，不需要数据迁移。

### 289.3 验证

- 更新 `src/__tests__/features/runtimeFocusSource.test.js`，覆盖结果定位、贡献定位、曲线/手动来源的 source view。
- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖贡献点来源的 `sourceKind: action-contribution`。
- `npm run test -- --run src/__tests__/features/runtimeFocusSource.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、68 条测试。
- `npm run test -- --run`：通过，37 个测试文件、246 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 290. UI 主流程能力块：Runtime Review Source View Context

### 290.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchFlowModel` 的 runtime review 派生结构新增共享 `sourceView` 引用：

```js
runtimeReviewSelection.sourceView
runtimeReviewContextView.sourceView
runtimeReviewFlowView.selection.sourceView
```

`sourceView` 复用 `createRuntimeFocusSourceView(source)` 的结构：

```js
{
  source,
  sourceKind,
  runtimeLogScope,
  runtimeLogLabel,
  curveSelectionLabel,
  isRuntimeResultFocus,
  isContributionFocus,
  isRuntimeLogFocusSource,
}
```

`runtimeReviewContextView.sourceKind` 与 `runtimeReviewFlowView.selection.sourceKind` 现在从 `sourceView.sourceKind` 派生。`EventLogPanel` 与 `ResourceMonitorPanel` 优先读取 `runtimeReviewContextView.sourceView`，仅在没有 flow model/context view 时回退到 `createRuntimeFocusSourceView(source)`。

### 290.2 保存与迁移

本阶段只调整 Workbench UI 主流程 runtime review 的内部 view model，不新增持久字段，不需要数据迁移。

### 290.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 selection、context view、runtime review flow view 下发 `sourceView`。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/runtimeFocusSource.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、68 条测试。
- `npm run test -- --run`：通过，37 个测试文件、246 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 291. UI 主流程能力块：Runtime Review Panel View Model

### 291.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchFlowModel` 新增运行结果面板级 view model：

```js
runtimeReviewPanelView
```

输出结构：

```js
{
  context,
  operations,
  sourceView,
  status,
  selectedActionId,
  selectedStatePointId,
  source,
  sourceKind,
  detailSyncedState,
  primaryOperationKind,
  primaryOperationEnabled,
  primaryOperationEnabledState,
  focusActionEnabled,
  focusActionEnabledState,
  returnResultEnabled,
  returnResultEnabledState,
  canRunAnyOperation,
  canRunAnyOperationState,
}
```

`context` 复用 `runtimeReviewContextView`，`operations` 复用 `runtimeReviewOperations`，`sourceView` 复用 `createRuntimeFocusSourceView(source)`。`EventLogPanel`、`ResourceMonitorPanel`、`RuntimeSelectedDetailPanel` 改为优先消费 `flowModel.runtimeReviewPanelView`，没有 flow model 时通过 `createWorkbenchRuntimeReviewPanelView()` 生成兼容视图。

### 291.2 保存与迁移

本阶段只调整 Workbench UI 主流程 runtime review 的内部 panel view model，不新增持久字段，不需要数据迁移。

### 291.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 `runtimeReviewPanelView` 的 source view 与 operation 状态。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、67 条测试。
- `npm run test -- --run`：通过，37 个测试文件、246 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 292. UI 主流程能力块：Runtime Review Panel Detail Context

### 292.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`runtimeReviewPanelView` 新增运行结果详情和回看 context 字段：

```js
{
  runtimeDetail,
  selectedDetail,
  selectedDetailStatePointId,
  hasSelectedDetail,
  hasSelectedDetailState,
  resultReturnContext,
  resultReturnActionId,
  resultReturnStatePointId,
  hasResultReturnContext,
  hasResultReturnContextState,
}
```

字段来源：

- `runtimeDetail` 来自 `workbenchFlowModel.runtimeDetail`。
- `selectedDetail` 来自 `runtimeDetail.source`，即完整 `runtimeSelectedDetail`。
- `resultReturnContext` 优先来自 `runtimeResultReturnTarget`；当 review context 处于 `hasPendingResult` 时，可以承接 `mainFlowState.resultReturnTarget`，用于编辑后待回看刷新结果。

消费方变化：

- `EventLogPanel` 优先通过 `runtimeReviewPanelView.selectedDetail` 匹配当前日志行详情，并通过 `runtimeReviewPanelView.resultReturnContext` 获取回看目标。
- `ResourceMonitorPanel` 优先匹配 `runtimeReviewPanelView.resultReturnContext`，仅当 `statePointId` 与当前曲线点一致时复用。
- `RuntimeSelectedDetailPanel` 优先消费 `runtimeReviewPanelView.resultReturnContext`，没有 panel view context 时再回退到本地 `createRuntimeResultReturnContext()`。

### 292.2 保存与迁移

本阶段只调整 Workbench UI 主流程 runtime review 的内部 panel view model，不新增持久字段，不需要数据迁移。

### 292.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 `runtimeReviewPanelView` 下发 selected detail 和 result return context。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、67 条测试。
- `npm run test -- --run`：通过，37 个测试文件、246 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 293. UI 主流程能力块：Runtime Review Panel Command Target View

### 293.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`runtimeReviewPanelView` 新增面板命令目标 view：

```js
{
  commandView: {
    focus: {
      operationKind,
      enabled,
      enabledState,
      actionId,
      statePointId,
      fieldKey,
      target,
    },
    returnResult: {
      operationKind,
      enabled,
      enabledState,
      actionId,
      statePointId,
      context,
      target,
    },
  },
}
```

字段来源：

- `commandView.focus.target` 优先来自 `runtimeActionEditTarget`，再回退到 `mainFlowState.runtimeActionEditTarget`、`flowModel.runtimeActionEditTarget` 或既有 focus operation。
- `commandView.returnResult.context` 只携带真实 `resultReturnContext`；没有回看 context 时保持 `null`，避免把禁用 operation 误当成可回看上下文。
- `commandView.returnResult.target` 保留既有 return-result operation，用于后续 action surface 继续生成实际点击动作。

消费方变化：

- `EventLogPanel`、`ResourceMonitorPanel`、`RuntimeSelectedDetailPanel` 优先从 `runtimeReviewPanelView.commandView.focus.target` 读取动作回改目标，并按 `statePointId` 防止串用其它结果点。
- 三处运行结果面板优先从 `runtimeReviewPanelView.commandView.returnResult.context` 读取回看 context，再回退到 `runtimeReviewPanelView.resultReturnContext` 或本地兼容 context。
- 实际 flow action 仍由既有主流程 command surface / action factory 生成，本阶段只统一 panel view 的命令目标消费边界。

### 293.2 保存与迁移

本阶段只调整 Workbench UI 主流程的内部 panel view model，不新增持久字段，不需要数据迁移。

### 293.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 `runtimeReviewPanelView.commandView` 的 focus / returnResult 启用状态、目标状态点和回看 context。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、67 条测试。
- `npm run test -- --run`：通过，37 个测试文件、246 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 294. UI 主流程能力块：Runtime Review Surface Helpers

### 294.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchMainFlowActions` 新增共享 surface helper：

```js
createWorkbenchRuntimeReviewOperationCommandFromSurface(input)
createWorkbenchRuntimeReviewPanelCommandViewFromSurface(input)
```

输入合同：

```js
{
  mainFlowCommandSurface,
  flowModel,
  source,
  operationKind,
  target,
  context,
  focusTarget,
  returnContext,
  focusCommand,
  returnCommand,
}
```

解析规则：

- 当 `mainFlowCommandSurface` 提供对应方法时，优先调用页面级 command surface。
- 没有页面级 command surface 时，回退到 `createWorkbenchRuntimeReviewOperationCommand()` 或 `createWorkbenchRuntimeReviewPanelCommandView()`。
- `mainFlowCommandSurface` 本身不会传入底层 options；其余字段保持原样传递，方便面板只声明 source / target / context。

消费方变化：

- `EventLogPanel` 改为通过共享 `createWorkbenchRuntimeReviewOperationCommandFromSurface()` 生成日志详情 focus seed command。
- `EventLogPanel`、`ResourceMonitorPanel`、`RuntimeSelectedDetailPanel`、`PropertiesPanel` 改为通过共享 `createWorkbenchRuntimeReviewPanelCommandViewFromSurface()` 生成面板命令视图。
- 各面板不再保留本地 `createRuntimeReviewPanelCommandViewFromSurface()` 包装函数，运行结果区和属性面板的“定位动作 / 回到结果点”入口统一消费同一个 helper。

### 294.2 保存与迁移

本阶段只调整 Workbench UI 主流程 command surface 的内部消费边界，不新增持久字段，不需要数据迁移。

### 294.3 验证

- 更新 `src/__tests__/features/workbenchMainFlowActions.test.js`，覆盖共享 `FromSurface` helper 优先消费页面级 surface 的路径。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/RuntimeSelectedDetailPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、88 条测试。
- `npm run test -- --run`：通过，37 个测试文件、247 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 295. UI 主流程能力块：Workbench Root Action Surface

### 295.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`Workbench.vue` 新增页面级 action surface：

```js
mainFlowActionSurface = createWorkbenchMainFlowActionSurface({
  mainFlowCommandSurface,
})
```

根页面运行点选择路径从直接调用 command surface：

```js
mainFlowCommandSurface.createRuntimeStatePointFlowAction(...)
```

调整为通过 action surface：

```js
mainFlowActionSurface.createRuntimeSelectionFlowAction(...)
```

该变化让 Workbench 根页面与 `AnalysisPanel`、`TimelineGridPreview` 的 runtime state point 选择入口共用同一层 action surface。`source: 'state-curve-point'`、`statePointId` 和 `preserveStateCurveFilters` payload 保持不变。

### 295.2 保存与迁移

本阶段只调整 Workbench UI 主流程的内部 action 生成边界，不新增持久字段，不需要数据迁移。

### 295.3 验证

- 更新 `src/__tests__/views/Workbench.test.js`，覆盖根页面接收 runtime state point `select-state-curve-point` 事件后，通过主流程 dispatch 得到 `select-runtime-state-point`。
- `npm run test -- --run src/__tests__/views/Workbench.test.js src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过，3 个测试文件、89 条测试。
- `npm run test -- --run`：通过，37 个测试文件、247 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 296. UI 主流程能力块：Runtime View Patch Applier

### 296.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchRuntimeViewState` 新增 runtime view patch 应用入口：

```js
applyWorkbenchRuntimeViewPatch(patch, handlers)
```

`patch` 沿用既有结构：

```js
{
  changes,
  pulseCalculatorFocus,
  selectRuntimeActionStatePointId,
  selectRuntimeStatePointId,
}
```

`handlers` 由调用方提供页面状态写入能力：

```js
{
  setSelectedStatePointId,
  setStateCurveFocusMode,
  setStateCurveLayerFilters,
  setStateCurveTrackFilters,
  setCalculatorScope,
  pulseCalculatorFocus,
  setRuntimeLogFocus,
  selectRuntimeActionStatePoint,
  selectRuntimeStatePoint,
}
```

应用规则：

- `changes.selectedStatePointId`、`stateCurveFocusMode`、`stateCurveLayerFilters`、`stateCurveTrackFilters`、`calculatorScope`、`runtimeLogFocus` 由 applier 统一识别后调用对应 handler。
- 对象型 changes 会在传给 handler 前浅拷贝，避免页面状态直接共享 patch 内部对象。
- `pulseCalculatorFocus`、`selectRuntimeActionStatePointId`、`selectRuntimeStatePointId` 保持原有顺序，在字段 changes 之后触发。

消费方变化：

- `Workbench.vue` 的 `applyRuntimeViewPatch()` 改为委托 `applyWorkbenchRuntimeViewPatch()`。
- Workbench 页面层不再直接判断 runtime view patch 的每个字段，只保留 Vue ref setter 和 runtime action / state point selection handler。

### 296.2 保存与迁移

本阶段只调整 Workbench UI 主流程 runtime view patch 的内部应用边界，不新增持久字段，不需要数据迁移。

### 296.3 验证

- 更新 `src/__tests__/features/workbenchRuntimeViewState.test.js`，覆盖共享 patch applier 的字段应用顺序、对象拷贝和选择副作用出口。
- `npm run test -- --run src/__tests__/features/workbenchRuntimeViewState.test.js src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、79 条测试。
- `npm run test -- --run`：通过，37 个测试文件、248 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 297. UI 主流程能力块：Action Mutation Runtime Sync Request

### 297.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`workbenchFlowRuntime` 新增 action mutation 到 runtime sync 的请求构造入口：

```js
createWorkbenchActionMutationRuntimeSyncRequest({
  actionId,
  fallbackActionId,
  runtimeReviewState,
  shouldSyncRuntimeResult,
  selectedActionChanged,
  affectedActionIds,
  mutationTouchedRuntimeAction,
  force,
})
```

输出结构保持为 `applyActionMutationRuntimeSync()` 可直接消费的请求：

```js
{
  actionId,
  shouldSyncRuntimeResult,
  mutationSelectedAction,
  mutationTouchedRuntimeAction,
  force,
}
```

解析规则：

- `shouldSyncRuntimeResult` 未显式传入时，从 `runtimeReviewState.shouldSyncRuntimeResult` 派生。
- `affectedActionIds` 命中 `runtimeReviewState.selectedRuntimeActionId` 时，自动标记 `mutationTouchedRuntimeAction = true`。
- 当未提供 `actionId`，且命中了当前 runtime action 时，优先使用 `selectedRuntimeActionId`；否则回退到 `fallbackActionId`。
- `selectedActionChanged` 映射为既有 `mutationSelectedAction`，保持 flow runtime 内部同步判定不变。

消费方变化：

- `Workbench.vue` 新增本地 `applyActionMutationRuntimeSyncRequest()`，只负责把共享 request 交给 `workbenchFlowRuntime.applyActionMutationRuntimeSync()`。
- 新增、复制、删除、批量删除、批量移动动作改为声明 `affectedActionIds` 和 `selectedActionChanged`，不再在页面层各自手算 `mutationTouchedRuntimeAction`。

### 297.2 保存与迁移

本阶段只调整 Workbench UI 主流程 action mutation runtime sync 的内部请求合同，不新增持久字段，不需要数据迁移。

### 297.3 验证

- 更新 `src/__tests__/features/workbenchFlowRuntime.test.js`，覆盖 action mutation runtime sync request 的新增/复制、批量移动 runtime action 优先、删除 fallback 三类场景。
- `npm run test -- --run src/__tests__/features/workbenchFlowRuntime.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、71 条测试。
- `npm run test -- --run`：通过，37 个测试文件、249 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 298. UI 主流程能力块：Action Edit Source Model

### 298.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增 `workbenchActionEditSource` 模型入口：

```js
createWorkbenchActionEditSource({
  actionId,
  patch,
  previousAction,
  nextAction,
  previousSource,
  focus,
  resolveSkillName,
  resolveCharacterName,
})
```

输出结构保持为既有 UI 主流程消费的 `actionEditSource`：

```js
{
  actionId,
  fieldKey,
  label,
  previousValue,
  nextValue,
  changeSummary,
  editOrigin,
  focusSource,
  originLabel,
  originStatePointId,
  originTrackKey,
  originFrameLabel,
  sequence,
}
```

新增 refreshed edit result context 入口：

```js
createWorkbenchActionEditResultContext({
  source,
  runtimeProjection,
})
```

输出结构保持为既有面板消费的 `actionEditResultContext`：

```js
{
  status: 'refreshed-edit-result',
  actionId,
  fieldKey,
  label,
  changeSummary,
  originStatePointId,
  focusSource,
  originTrackKey,
  originFrameLabel,
  runtimeStatePointId,
  runtimeTrackKey,
}
```

解析规则：

- 字段优先级和中文 label 从 Workbench 页面内移入共享模型。
- `laneId` 仍通过动作的 `actorCharacterId` 归一为角色变化，保持换轨编辑来源语义不变。
- `damageSegmentIndex` 仍优先读取 `actionVariantIndex`，保持动作形态变化语义不变。
- 当 `focus.editOrigin === 'runtime-focus'` 且 action 一致时，编辑来源携带原 runtime 点位和轨道；刷新结果时优先在同一 `originTrackKey` 中寻找新运行时点。

消费方变化：

- `Workbench.vue` 的普通字段编辑、timeline 调时/调长度/换轨继续调用本地 `recordActionEditSource()`，但该函数只委托共享模型生成 `actionEditSource`。
- `Workbench.vue` 的 `actionEditResultContext` 改为委托 `createWorkbenchActionEditResultContext()`，页面层不再直接调用 runtime projection point 查找函数。

### 298.2 保存与迁移

本阶段只调整 Workbench UI 主流程中“动作编辑来源 -> 刷新后结果回看”的内部模型边界，不新增持久字段，不需要数据迁移。

### 298.3 验证

- 新增 `src/__tests__/features/workbenchActionEditSource.test.js`，覆盖时间字段变化、换轨角色名归一、runtime focus origin 透传、字段优先级、无效来源过滤和 preferred track 结果回看。
- `npm run test -- --run src/__tests__/features/workbenchActionEditSource.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、63 条测试。
- `npm run test -- --run`：通过，38 个测试文件、255 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 299. UI 主流程能力块：Main Flow Workspace View

### 299.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

新增 Workbench 主工作区视图入口：

```js
createWorkbenchMainFlowWorkspaceView({
  flowModel,
  mainFlowStatusView,
  runtimeReviewFlowView,
})
```

输出结构：

```js
{
  phase,
  region: {
    currentRegion,
    nextRegion,
    nextTargetKind,
    inspectorMode,
    selectedActionId,
    selectedRuntimeStatePointId,
    pendingRuntimeStatePointId,
    refreshedRuntimeStatePointId,
  },
  dispatch,
  loop,
  runtimeReview: {
    selection,
    operations,
  },
  reviewSelection,
  reviewOperations,
  inspector: {
    mode,
    currentRegion,
    nextRegion,
  },
}
```

聚合规则：

- `dispatch` 和 `loop` 复用 `createWorkbenchMainFlowStatusView()` 的既有输出。
- `region`、`reviewSelection`、`reviewOperations` 复用 `createWorkbenchRuntimeReviewFlowView()` 的既有输出。
- `runtimeReview.selection` 与 `reviewSelection` 指向同一对象；`runtimeReview.operations` 与 `reviewOperations` 指向同一对象，便于根页面和后续面板按完整主工作区视图消费状态。
- `inspector.mode` 使用 `region.inspectorMode`，让右侧编辑/详情/回看面板的主流程模式从同一视图读取。

消费方变化：

- `Workbench.vue` 根页面不再直接创建并消费 `mainFlowStatusView` / `runtimeReviewFlowView`。
- `workbench-main-flow-workspace`、`workbench-primary-flow`、`workbench-runtime-review-stack`、`workbench-side-inspector` 的主流程 data 状态都改为读取 `mainFlowWorkspaceView`。

### 299.2 保存与迁移

本阶段只调整 Workbench UI 主流程视图聚合边界，不新增持久字段，不需要数据迁移。

### 299.3 验证

- 更新 `src/__tests__/features/workbenchFlowModel.test.js`，覆盖 `mainFlowWorkspaceView` 在 runtime result 和 edit result ready 两个关键闭环状态下的区域、dispatch/loop、runtime review selection/operations 和 inspector mode。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、66 条测试。
- `npm run test -- --run`：通过，38 个测试文件、256 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 300. UI 主流程能力块：Analysis Runtime Review Panel View

### 300.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`AnalysisPanel` 的运行结果上下文入口从：

```js
props.flowModel?.runtimeReviewContextView ??
createWorkbenchRuntimeReviewContextView(...)
```

调整为：

```js
props.flowModel?.runtimeReviewPanelView ??
createWorkbenchRuntimeReviewPanelView(...)
```

消费规则：

- 选中运行点继续从 `runtimeReviewPanelView.context.selectedStatePointId` 读取。
- 选中运行结果详情优先从 `runtimeReviewPanelView.selectedDetail` 读取，再回退到 `flowModel.runtimeDetail.source` 和 `props.runtimeSelectedDetail`。
- `AnalysisPanel` 因此与 `ResourceMonitorPanel`、`EventLogPanel`、`RuntimeSelectedDetailPanel` 共享同一 runtime review panel view 入口。

### 300.2 保存与迁移

本阶段只调整 Workbench UI 主流程中分析面板的运行结果上下文消费边界，不新增持久字段，不需要数据迁移。

### 300.3 验证

- `npm run test -- --run src/__tests__/views/Workbench.test.js src/__tests__/features/workbenchFlowModel.test.js`：通过，2 个测试文件、66 条测试。
- `npm run test -- --run`：通过，38 个测试文件、256 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 301. UI 主流程可见闭环：Workbench End-to-End Loop

### 301.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

本阶段只新增 Workbench 可见闭环端到端测试，固定用户路径：

```text
查看运行结果
  -> 点击资源曲线运行点
  -> 点击对应日志行
  -> 在三值详情中回到动作编辑
  -> 修改动作开始时间
  -> 回到刷新后的运行结果
```

### 301.2 保存与迁移

不新增持久字段，不需要数据迁移。

### 301.3 验证

- 新增 `src/__tests__/views/Workbench.test.js` 用例 `supports the visible workbench loop across curve, log, detail, edit, and refreshed result`。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、58 条测试。
- `npm run test -- --run`：通过，38 个测试文件、257 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 302. UI 主流程可见编辑体验：60fps Frame Timing Controls

### 302.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`PropertiesPanel` 新增前端帧级编辑入口：

```text
开始帧 -> startMs = frameToMs(frame)
持续帧 -> durationMs = frameToMs(frame)
```

消费规则：

- 帧控件使用 `WORKBENCH_FPS = 60` 和 `frameToMs()` / `msToFrame()` 与现有毫秒字段互相映射。
- 用户修改开始帧或持续帧后，仍通过现有 `update-action` 事件写回 `startMs` / `durationMs`。
- 动作编辑后的刷新结果定位继续复用既有 `actionEditResultContext` / runtime result return 链路。

### 302.2 保存与迁移

不新增持久字段，不需要数据迁移。现有草稿仍只保存 `startMs`、`durationMs` 等原字段。

### 302.3 验证

- Workbench 可见闭环测试改为通过“开始帧”修改动作后回到刷新后的运行结果。
- 新增 `src/__tests__/views/Workbench.test.js` 用例覆盖 60fps 帧控件将 `30` 帧保存为 `500ms`、`45` 持续帧保存为 `750ms`。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、59 条测试。
- `npm run test -- --run`：通过，38 个测试文件、258 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 303. UI 主流程布局效率：Runtime Detail First Inspector

### 303.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`Workbench.vue` 的右侧检查区为四个既有面板增加外层布局容器：

```text
properties
enemy
runtime-detail
analysis
```

消费规则：

- `mainFlowWorkspaceView.inspector.mode === 'runtime-detail'` 时，`runtime-detail` 容器视觉顺序为 `0`，属性面板顺序为 `1`。
- 其他模式保持属性面板顺序为 `0`，三值详情顺序为 `2`。
- 该顺序只影响 Workbench 右侧检查区布局，不写入项目草稿。

### 303.2 保存与迁移

不新增持久字段，不需要数据迁移。

### 303.3 验证

- 新增 `src/__tests__/views/Workbench.test.js` 用例覆盖动作编辑态属性优先、运行查看态三值详情优先。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、60 条测试。
- `npm run test -- --run`：通过，38 个测试文件、259 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 304. UI 主流程结果详情：Contribution Summary

### 304.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`RuntimeSelectedDetailPanel` 新增前端派生摘要：

```text
runtimeContributionSummary = first active row from detail.contributionRows
```

消费规则：

- 摘要只读取既有 `runtimeSelectedDetail.contributionRows`。
- `active` 的贡献行作为“本点贡献”主显示；原有 HP / 韧性 / 能量三条贡献明细仍保留。
- 该摘要只服务 Workbench 右侧三值详情展示，不写回项目草稿。

### 304.2 保存与迁移

不新增持久字段，不需要数据迁移。

### 304.3 验证

- Workbench 页面测试覆盖资源曲线选中运行点后三值详情显示贡献摘要，且 HP 贡献为当前活跃项。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、60 条测试。
- `npm run test -- --run`：通过，38 个测试文件、259 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 305. UI 主流程结果详情：Detail Navigation

### 305.1 结构变化

本阶段不变更保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

`RuntimeSelectedDetailPanel` 新增前端导航视图：

```text
runtimeDetailNavigation = flowModel.runtimeNavigation
```

消费规则：

- 当 `runtimeNavigation.count > 1` 时，三值详情面板显示上一条/下一条运行结果按钮。
- 点击按钮通过 `createWorkbenchRuntimeSelectionFlowActionFromSurface()` 复用现有 `select-runtime-state-point` 主流程 action。
- 导航来源标记为 `runtime-detail-navigation`，只用于 UI 主流程追踪。

### 305.2 保存与迁移

不新增持久字段，不需要数据迁移。

### 305.3 验证

- Workbench 页面测试覆盖三值详情面板内的上一条/下一条运行结果导航，并确认主流程选中动作和详情状态点同步更新。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、61 条测试。
- `npm run test -- --run`：通过，38 个测试文件、260 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 306. 运行时层标准输出入口：Runtime Outputs Envelope

### 306.1 结构变化

`threeValueRuntimeProjection` 新增只读输出封套：

```text
threeValueRuntimeProjection.runtimeOutputs = {
  outputContract,
  simLog,
  stateCurves,
  resourceCurves,
  resources,
  summary,
  outputs,
  outputSummary
}
```

`projectSimulationResult` 顶层同步暴露：

```text
result.runtimeOutputs = result.threeValueRuntimeProjection.runtimeOutputs
result.summary.runtimeOutputsSummary = result.runtimeOutputs.outputSummary
```

消费规则：

- `runtimeOutputs.simLog` 指向既有 `threeValueRuntimeProjection.simLog`。
- `runtimeOutputs.stateCurves` 指向既有 `threeValueRuntimeProjection.stateCurves`。
- `runtimeOutputs.resourceCurves` 和 `runtimeOutputs.resources` 都指向既有 `threeValueRuntimeProjection.resourceCurves`。
- `runtimeOutputs.summary` 指向既有 `threeValueRuntimeProjection.summary`。
- `runtimeOutputs.outputContract` 指向既有 `threeValueRuntimeProjection.outputContract`。
- `runtimeOutputs.outputAliases.resources = "resourceCurves"`，供后续消费者使用更贴近日常表达的 resources 名称。

### 306.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

旧字段全部保留；新增封套只是运行结果的统一消费入口。

### 306.3 验证

- `threeValueRuntimeProjection.test.js` 覆盖 `runtimeOutputs` 的合同字段、四类输出和 `resources -> resourceCurves` 别名。
- `firstVerticalSliceSimulation.test.js` 覆盖真实项目运行后的顶层 `result.runtimeOutputs`，并确认它与 `threeValueRuntimeProjection.runtimeOutputs` 是同一份输出。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、16 条测试。
- `npm run test -- --run`：通过，38 个测试文件、266 条测试。
- `npm run test:e2e`：通过，4 条浏览器级烟测。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 307. UI 主流程可见闭环：Runtime Outputs Flow Boundary

### 307.1 结构变化

本阶段不新增保存数据、导入导出 schema、runtime projection 输出结构或三值计算结果。

Workbench 主流程消费边界调整为：

```text
createWorkbenchFlowModel({
  runtimeProjection,
  runtimeOutputs
})

flowModel.runtimeProjection = runtimeProjection
flowModel.runtimeOutputs = runtimeOutputs
```

`WorkbenchFlowPanel` 新增只读 prop：

```text
runtimeOutputs
```

消费规则：

- `runtimeProjection` 继续保留完整运行投影，用于追踪 `runtimeInput` 和旧字段 fallback。
- `runtimeOutputs` 作为主流程运行输出读取入口，用于导航点、日志数量、输出摘要和 output contract 上下文。
- `workbenchFlowContractContext` 从完整 projection 读取 runtime input，从 `runtimeOutputs` 读取 runtime output。
- 该边界只影响 Workbench 主流程消费方式，不写入项目草稿。

### 307.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

### 307.3 验证

- 新增 Playwright 场景覆盖：动作编辑进入运行结果、点击资源曲线点、点击日志行、从三值详情回到动作编辑、再查看刷新后的结果定位。
- `WorkbenchFlowPanel.test.js` 覆盖 fallback flow model 从 `runtimeOutputs` 读取运行日志和导航。
- `workbenchFlowModel.test.js` 覆盖 flow model 同时暴露完整 projection 与输出封套。
- `workbenchFlowContractContext.test.js` 覆盖 runtime input 来自完整 projection、runtime output 来自 `runtimeOutputs`。
- `Workbench.test.js` 覆盖主页面向 FlowPanel 传入同一份 `runtimeOutputs`。
- `npm run test -- --run`：通过，38 个测试文件、268 条测试。
- `npm run test:e2e`：通过，5 条浏览器级烟测。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 LF/CRLF 提示。

## 308. 生成层标准输出入口：Generation Outputs Envelope

### 308.1 结构变化

`threeValueGenerationBundle` 新增只读输出封套：

```text
threeValueGenerationBundle.generationOutputs = {
  standardContract,
  actions,
  hits,
  deltas,
  runtimeInputSource,
  runtimeInput,
  outputs,
  summary,
  outputSummary
}
```

`projectSimulationResult` 顶层同步暴露：

```text
result.generationOutputs = result.threeValueGenerationBundle.generationOutputs
result.summary.threeValueGenerationOutputsSummary = result.generationOutputs.outputSummary
```

消费规则：

- `generationOutputs.standardContract` 指向既有 `threeValueGenerationBundle.standardContract`。
- `generationOutputs.actions / hits / deltas` 指向同一份 `Action -> Hit -> ThreeValueDelta` 标准合同内容。
- `generationOutputs.runtimeInputSource` 和 `generationOutputs.runtimeInput` 都指向既有 `threeValueGenerationBundle.runtimeInputSource`。
- `createThreeValueRuntimeProjection()` 可以直接接收 `generationOutputs`，并从其中解析运行时输入源。
- 旧字段全部保留；新增封套只是生成层给运行时和后续 UI 的统一消费入口。

### 308.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段不改变 HP、韧性、自身能量计算结果，不改变公式、倍率或证据字段。

### 308.3 验证

- `threeValueGenerationBuilder.test.js` 覆盖 `generationOutputs` 的标准合同、动作、命中、delta、runtime input source 同源关系。
- `actionHitThreeValueRuntimeInput.test.js` 覆盖只传 `generationOutputs` 时仍能生成 applied delta runtime input。
- `firstVerticalSliceSimulation.test.js` 覆盖真实项目运行后的顶层 `result.generationOutputs`，并确认 runtime input 由该封套接入。
- `npm run test -- --run`：通过，38 个测试文件、269 条测试。
- `npm run test:e2e`：通过，5 条浏览器级烟测。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `git diff --check`：通过；仅有 LF/CRLF 提示。

## 309. 生成层动作/命中三值聚合：Action / Hit Three Value Delta Aggregate

### 309.1 结构变化

`Action -> Hit -> ThreeValueDelta` 标准合同中的 action 与 hit 节点新增只读聚合字段：

```text
action.threeValueDeltaAggregate
hit.threeValueDeltaAggregate
```

字段结构：

```text
threeValueDeltaAggregate = {
  schemaVersion: 1,
  sourceKind: "azpr-action-hit-three-value-delta-aggregate",
  status,
  deltaFields: ["hpDelta", "toughnessDelta", "energyDelta"],
  deltaCount,
  layerKeys,
  trackKeys,
  layers: {
    applied?: { layerKey, runtimeApplied, deltaCount, trackKeys, hpDelta, toughnessDelta, energyDelta },
    candidate?: { ... },
    sampled?: { ... },
    placeholder?: { ... }
  }
}
```

`standardContract` 与 `threeValueGenerationLayer.contract` 同步声明：

```text
aggregateFields = ["hpDelta", "toughnessDelta", "energyDelta"]
aggregateLayerKeys = ["applied", "candidate", "sampled", "placeholder"]
```

消费规则：

- 聚合只按当前 action 或 hit 下已有 delta 求和，不生成新的 delta。
- `layers` 按 `applied / candidate / sampled / placeholder` 分层汇总，避免把候选值、采样值、占位值混入 runtime applied 总值。
- 三值轨道顺序固定为 HP、韧性、自身能量，便于后续 UI 或 runtime 按槽位直接展示。
- `runtimeApplied` 仅在 `applied` 层为 `true`；candidate、sampled、placeholder 仍是诊断层。

### 309.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段不改变 HP、韧性、自身能量计算结果，不改变公式、倍率或证据字段。

### 309.3 验证

- `threeValueGenerationLayer.test.js` 覆盖 action / hit 聚合字段、标准合同聚合字段声明，以及同一 hit 下 applied 与 candidate 分层汇总。
- `npm run test -- --run src/__tests__/simulation/actionHitThreeValueDeltaGeneration.test.js src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/threeValueGenerationLayer.test.js src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，6 个测试文件、24 条测试。
- `npm run test -- --run`：通过，38 个测试文件、272 条测试。
- `npm run test:e2e`：通过，12 条浏览器级烟测。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

- `npx prettier --check PROJECT_MANUAL.md src/simulation/runtime/actionHitThreeValueRuntimeInput.js src/simulation/runtime/threeValueRuntimeProjection.js src/features/workbench/runtimeSelectedDetail.js src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/features/runtimeSelectedDetail.test.js`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。
- `npx prettier --check PROJECT_MANUAL.md src/simulation/generation/threeValueGenerationLayer.js src/__tests__/simulation/threeValueGenerationLayer.test.js`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 310. 运行时消费动作/命中三值聚合：Runtime Aggregate Propagation

### 310.1 结构变化

`createActionHitThreeValueRuntimeInput()` 现在会从标准合同的 `actions[] / hits[]` 查找聚合，并挂到每条 applied delta：

```text
appliedDelta.actionThreeValueDeltaAggregate
appliedDelta.hitThreeValueDeltaAggregate
```

`threeValueRuntimeProjection` 继续把这两个字段透传到：

```text
simLog[].actionThreeValueDeltaAggregate
simLog[].hitThreeValueDeltaAggregate
enemyStateCurve.points[].actionThreeValueDeltaAggregate
enemyStateCurve.points[].hitThreeValueDeltaAggregate
resourceCurves.curvesByActor[].points[].actionThreeValueDeltaAggregate
resourceCurves.curvesByActor[].points[].hitThreeValueDeltaAggregate
```

`outputContract.outputs.simLog` 新增：

```text
aggregateFields = [
  "actionThreeValueDeltaAggregate",
  "hitThreeValueDeltaAggregate"
]
```

`runtimeSelectedDetail` 新增同名字段，并且 `contributionRows` 优先从 `hitThreeValueDeltaAggregate.layers.applied` 读取 HP / 韧性 / 自身能量三值贡献；没有聚合时回退旧的单点 delta 逻辑。

### 310.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段不改变 HP、韧性、自身能量计算结果，不改变公式、倍率或证据字段。

### 310.3 验证

- `actionHitThreeValueRuntimeInput.test.js` 覆盖标准合同 action / hit 聚合进入 runtime applied delta。
- `threeValueRuntimeProjection.test.js` 覆盖 simLog output contract 声明聚合字段，并确认 simLog 与 enemy state point 透传 hit 聚合。
- `runtimeSelectedDetail.test.js` 覆盖三值详情贡献行优先读取 hit applied 聚合。
- `npm run test -- --run src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/features/runtimeSelectedDetail.test.js`：通过，3 个测试文件、7 条测试。
- `npm run test -- --run`：通过，38 个测试文件、272 条测试。
- `npm run test:e2e`：通过，12 条浏览器级烟测。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。

## 311. UI 主流程日志详情消费 hit 三值聚合：Event Log Hit Aggregate Contributions

### 311.1 结构变化

`EventLogPanel` 的模拟日志贡献行现在优先读取：

```text
selectedRuntimeLog.hitThreeValueDeltaAggregate.layers.applied
```

并在每一行贡献上暴露：

```text
data-contribution-key
data-contribution-source
data-value
```

`data-contribution-source` 取值：

- `hit-aggregate`：来自当前日志行的 hit applied 聚合。
- `runtime-row`：没有 hit 聚合时，回退到旧的单条 runtime log row。
- `runtime-selected-detail`：来自右侧三值详情派生结果且没有 hit 聚合。

### 311.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段不改变 HP、韧性、自身能量计算结果，不改变公式、倍率或证据字段。

### 311.3 验证

- 新增 `EventLogPanel.test.js`，覆盖一条 HP runtime log 通过 hit aggregate 显示同一命中的 HP、韧性、自身能量贡献。
- `Workbench.test.js` 更新星鸣技能量日志断言，确认能量日志中的贡献行来自 `hit-aggregate`，并显示同一命中的 HP 与能量变化。
- `npm run test -- --run src/__tests__/features/EventLogPanel.test.js src/__tests__/features/runtimeSelectedDetail.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/views/Workbench.test.js`：通过，4 个测试文件、73 条测试。
- `npm run test -- --run`：通过，39 个测试文件、273 条测试。
- `npm run test:e2e`：通过，12 条浏览器级烟测。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `npx prettier --check PROJECT_MANUAL.md src/features/workbench/EventLogPanel.vue src/__tests__/features/EventLogPanel.test.js src/__tests__/views/Workbench.test.js`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 312. 运行时输出一致性摘要：Runtime Output Consistency Summary

### 312.1 结构变化

`threeValueRuntimeProjection.summary` 新增：

```text
stateCurvePointCount
```

`threeValueRuntimeProjection.stateCurves.summary` 新增：

```text
stateCurvePointCount
```

`threeValueRuntimeProjection.runtimeOutputs` 新增：

```text
outputConsistency = {
  sourceKind: "azpr-runtime-output-consistency",
  status,
  simLogCount,
  enemyStatePointCount,
  resourceCurvePointCount,
  stateCurvePointCount,
  resourceActorPointCount,
  checks,
  consistent,
  applied
}
```

`runtimeOutputs.outputSummary` 新增：

```text
stateCurvePointCount
outputConsistencyStatus
outputConsistent
```

`outputContract.summary` 同步新增：

```text
stateCurvePointCount
```

`outputContract.outputs.stateCurves.summaryFields` 同步声明：

```text
stateCurvePointCount
```

`outputContract.outputs.summary.countFields` 同步声明：

```text
stateCurvePointCount
```

`createWorkbenchFlowContractContext().runtimeOutput` 新增：

```text
enemyStatePointCount
stateCurvePointCount
resourceCurvePointCount
outputConsistencyStatus
outputConsistent
```

### 312.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段不改变 HP、韧性、自身能量计算结果，不改变公式、倍率或证据字段；新增字段只用于 runtime outputs、summary 与 Workbench 主流程合同的同源一致性检查。

### 312.3 验证

- `threeValueRuntimeProjection.test.js` 覆盖 `runtimeOutputs.outputConsistency`、`stateCurvePointCount`、`outputConsistencyStatus`、`outputConsistent`。
- `firstVerticalSliceSimulation.test.js` 覆盖真实纵切结果中的 `threeValueRuntimeProjectionSummary` 与 `runtimeOutputsSummary` 同步暴露状态点计数和一致性状态。
- `workbenchFlowContractContext.test.js` 覆盖 Workbench 主流程合同可读取 runtime output 一致性字段。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/features/workbenchFlowContractContext.test.js`：通过，3 个测试文件、19 条测试。
- `npm run test -- --run`：通过，39 个测试文件、273 条测试。
- `npm run test:e2e`：通过，12 条浏览器级烟测。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `npx prettier --check PROJECT_MANUAL.md src/simulation/runtime/threeValueRuntimeProjection.js src/features/workbench/workbenchFlowContractContext.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/features/workbenchFlowContractContext.test.js`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 313. Workbench 主流程 runtime 输出一致性视图：Workbench Runtime Output Consistency View

### 313.1 结构变化

`createWorkbenchFlowModel()` 新增：

```text
runtimeOutputConsistency = {
  status,
  sourceStatus,
  consistent,
  consistentState,
  simLogCount,
  runtimeSimLogCount,
  simLogCountSynced,
  simLogCountSyncedState,
  enemyStatePointCount,
  stateCurvePointCount,
  resourceCurvePointCount,
  runtimeNavigationPointCount,
  stateCurveNavigationSynced,
  stateCurveNavigationSyncedState
}
```

`createWorkbenchMainFlowStatusView()` 新增：

```text
runtimeOutput
```

该字段复用 `runtimeOutputConsistency`，作为主流程状态视图的 runtime 输出诊断入口。

`WorkbenchFlowPanel` 新增 data 属性：

```text
data-runtime-output-consistency-status
data-runtime-output-consistent
data-runtime-output-sim-log-count
data-runtime-output-state-curve-point-count
data-runtime-output-navigation-synced
```

### 313.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段不改变三值计算结果、公式、倍率、证据字段或 runtime output 原始结构；新增字段只让 Workbench 主流程直接消费上一阶段的 `runtimeOutputs.outputConsistency`。

### 313.3 验证

- `workbenchFlowModel.test.js` 覆盖 `runtimeOutputConsistency` 与主流程模型读取 runtime output 一致性字段。
- `WorkbenchFlowPanel.test.js` 覆盖主流程面板 data 属性暴露一致性状态。
- `workbench-continuous-edit.spec.js` 覆盖真实 Workbench 页面运行结果打开后，主流程面板显示 runtime output consistent 且导航同步。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js`：通过，2 个测试文件、13 条测试。
- `npm run test:e2e -- --grep "runs the visible curve-log-detail edit loop end to end"`：通过，1 条浏览器级主流程测试。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchFlowContractContext.test.js`：通过，3 个测试文件、15 条测试。
- `npm run test -- --run`：通过，39 个测试文件、273 条测试。
- `npm run test:e2e`：通过，12 条浏览器级烟测。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `npx prettier --check PROJECT_MANUAL.md src/features/workbench/workbenchFlowModel.js src/features/workbench/WorkbenchFlowPanel.vue src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js e2e/workbench-continuous-edit.spec.js`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 314. 生成层 generation input 一等输出：Generation Input Output Member

### 314.1 结构变化

`createActionHitThreeValueDeltaGeneration()` 新增：

```text
generationInput
summary.inputPointCount
summary.inputAppliedPointCount
summary.inputCandidatePointCount
summary.inputSampledPointCount
summary.inputPlaceholderPointCount
```

`createThreeValueGenerationBundle()` 新增：

```text
generationInput
summary.generationInputSourceKind
summary.generationInputStatus
summary.generationInputPointCount
```

`generationOutputs` 新增一等输出成员：

```text
generationInput
outputs.generationInput
outputNames += generationInput
summary.generationInputSourceKind
summary.generationInputStatus
summary.generationInputPointCount
summary.generationInputAppliedPointCount
summary.generationInputCandidatePointCount
summary.generationInputSampledPointCount
summary.generationInputPlaceholderPointCount
```

因此 `generationOutputs.summary.outputCount` 从 `6` 增加为 `7`。新增输出成员与既有 `standardContract`、`runtimeInputSource` 指向同一条生成链路；三值结果、runtime applied delta 和保存数据不变。

`createWorkbenchFlowContractContext().generationEntry` 新增：

```text
generationInputSourceKind
generationInputStatus
generationInputPointCount
generationInputAppliedPointCount
generationInputCandidatePointCount
generationInputSampledPointCount
generationInputPlaceholderPointCount
```

### 314.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段只把已有 `threeValueGenerationLayer.generationInput` 暴露为生成层标准输出成员，便于后续真实倍率、削韧、充能接入时追踪输入来源；不改变公式、倍率、证据字段或 runtime 数值。

### 314.3 验证

- `actionHitThreeValueDeltaGeneration.test.js` 覆盖 generation entry 暴露 `generationInput` 引用和输入点数摘要。
- `threeValueGenerationBuilder.test.js` 覆盖 generation bundle / generation outputs 的 `generationInput` 一等输出、outputCount=7 和输入来源摘要。
- `firstVerticalSliceSimulation.test.js` 覆盖真实纵切结果中的 generation input 输出、16 个输入点和 summary 同步。
- `workbenchFlowContractContext.test.js` 覆盖 Workbench 主流程合同可读取 generation input 来源和点数摘要。
- `npm run test -- --run src/__tests__/simulation/actionHitThreeValueDeltaGeneration.test.js src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/features/workbenchFlowContractContext.test.js`：通过，4 个测试文件、17 条测试。
- `npm run test -- --run`：通过，39 个测试文件、273 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提示和 chunk size 提示。
- `npx prettier --check PROJECT_MANUAL.md src/simulation/generation/actionHitThreeValueDeltaGeneration.js src/simulation/generation/threeValueGenerationBuilder.js src/features/workbench/workbenchFlowContractContext.js src/__tests__/simulation/actionHitThreeValueDeltaGeneration.test.js src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/features/workbenchFlowContractContext.test.js`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 315. 运行时输出消费合同：Runtime Output Consumer Contract

### 315.1 结构变化

`runtimeOutputs` 新增：

```text
outputConsumerContract
consumerContract
outputSummary.outputConsumerContractSourceKind
outputSummary.outputConsumerContractStatus
```

`outputConsumerContract` 是 UI/Workbench 消费 runtime 输出的稳定合同，当前包含：

```text
schemaVersion
sourceKind = azpr-three-value-runtime-output-consumer-contract
status
contractSourceKind
contractStatus
canonicalOutputNames = simLog, stateCurves, resourceCurves, summary
aliases.resources = resourceCurves
outputs.simLog
outputs.stateCurves
outputs.resourceCurves
outputs.summary
summary
applied
```

其中 `outputs.*` 记录 canonical output 名称、数据路径、原 output contract 路径、来源状态和关键计数字段；`summary` 记录输出数量、applied delta 数量、日志数量、状态曲线点数、资源曲线点数、三值 delta 汇总和 output consistency 状态。

新增运行时消费工具：

```text
src/simulation/runtime/threeValueRuntimeOutputConsumer.js
```

该工具提供 `createThreeValueRuntimeOutputConsumerView()` 和配套 getter。Workbench 侧的 `runtimeProjectionPoints` 保持原有对外函数名，但内部改为通过该消费视图读取 `simLog`、敌人状态曲线和资源曲线。

`createWorkbenchFlowContractContext().runtimeOutput` 新增：

```text
consumerContractSourceKind
consumerContractStatus
```

### 315.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段只新增 runtime outputs 的消费合同和读取入口；不改变三值计算结果、公式、倍率、证据字段、运行日志行或曲线数值。

### 315.3 验证

- `threeValueRuntimeProjection.test.js` 覆盖 `runtimeOutputs.outputConsumerContract`、canonical output、路径、计数、no-applied-delta 状态和 consistency 状态。
- `runtimeProjectionPoints.test.js` 覆盖 Workbench 运行点解析通过 runtime consumer view 消费 `runtimeOutputs`。
- `workbenchFlowContractContext.test.js` 覆盖主流程合同上下文暴露 consumer contract 来源和状态。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/workbenchFlowContractContext.test.js`：通过，3 个测试文件、12 条测试。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/runtimeSelectedDetail.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、77 条测试。
- `npx prettier --check src/simulation/runtime/threeValueRuntimeOutputConsumer.js src/simulation/runtime/threeValueRuntimeProjection.js src/features/workbench/runtimeProjectionPoints.js src/features/workbench/workbenchFlowContractContext.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/workbenchFlowContractContext.test.js PROJECT_MANUAL.md`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 316. Workbench 运行输出消费视图：Workbench Runtime Output Consumer View

### 316.1 结构变化

`runtimeProjectionPoints` 新增 Workbench-facing view：

```text
createWorkbenchRuntimeOutputConsumerView(runtimeProjection)
```

返回值基于 `createThreeValueRuntimeOutputConsumerView()`，并额外提供：

```text
sourceKind = workbench-runtime-output-consumer-view
runtimeConsumerSourceKind
projectionPoints
pointByDeltaId
statePointContexts
statePointContextByDeltaId
statePointContextById
statePointOrderById
outputPanelSummary
```

其中：

- `projectionPoints` 是敌人状态曲线点与资源曲线点合并后的运行点列表。
- `pointByDeltaId` 是按 `sourceDeltaId` 建立的曲线点索引。
- `statePointContexts` 是模拟日志行与曲线点绑定后的 Workbench 运行点上下文。
- `statePointContextByDeltaId` / `statePointContextById` / `statePointOrderById` 是面板联动、日志定位和曲线导航使用的索引。
- `outputPanelSummary` 在 runtime output summary 基础上补充 `statePointContextCount` 和 `projectionPointCount`。

原有导出函数继续保留：

```text
getRuntimeOutputSummary
getRuntimeSimLogRows
getRuntimeSimLogCount
getRuntimeEnemyStateCurve
getRuntimeResourceCurveRows
createRuntimeProjectionPoints
createRuntimePointByDeltaId
createRuntimeStatePointContexts
findFirstRuntimeStatePointForAction
```

这些函数内部改为复用 `createWorkbenchRuntimeOutputConsumerView()`，作为旧调用方的兼容入口。

### 316.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段只改变 Workbench 前端读取 runtime outputs 的消费视图；不改变 runtime output 原始数据、三值计算结果、公式、倍率、证据字段、运行日志行或曲线数值。

### 316.3 验证

- `runtimeProjectionPoints.test.js` 覆盖 Workbench runtime output view 的 `projectionPoints`、`pointByDeltaId`、`statePointContexts` 和面板摘要。
- `runtimeSelectedDetail.test.js` 覆盖三值详情优先从 `runtimeOutputs` envelope 解析，而不是读取旧 projection 字段。
- `workbenchFlowContractContext.test.js` 继续覆盖主流程合同上下文读取 runtime outputs 状态。
- `Workbench.test.js` 继续覆盖资源曲线、模拟日志、分析面板、三值详情与主流程联动。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/runtimeSelectedDetail.test.js src/__tests__/features/workbenchFlowContractContext.test.js`：通过，3 个测试文件、9 条测试。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、76 条测试。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/runtimeSelectedDetail.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/views/Workbench.test.js`：通过，5 个测试文件、85 条测试。
- `npx prettier --check src/features/workbench/runtimeProjectionPoints.js src/features/workbench/ResourceMonitorPanel.vue src/features/workbench/EventLogPanel.vue src/features/workbench/AnalysisPanel.vue src/features/workbench/runtimeSelectedDetail.js src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/runtimeSelectedDetail.test.js PROJECT_MANUAL.md`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 317. 主流程运行输出一致性：Main Flow Runtime Output Consistency

### 317.1 结构变化

`createWorkbenchFlowModel()` 返回值新增：

```text
runtimeOutputView
```

该字段为 `createWorkbenchRuntimeOutputConsumerView(resolvedRuntimeOutputs)` 的结果。主流程模型内部的运行导航、运行日志计数和 runtime output consistency 均改为读取该 view。

`createWorkbenchRuntimeOutputConsistencyView()` 新增输入：

```text
runtimeOutputView
```

返回值新增：

```text
consumerViewSourceKind
consumerViewReady
consumerViewReadyState
outputConsumerContractStatus
statePointContextCount
statePointContextSynced
statePointContextSyncedState
projectionPointCount
projectionPointCountSynced
projectionPointCountSyncedState
```

同步语义：

- `statePointContextSynced`：`runtimeOutput.simLogCount` 与 Workbench runtime output view 的 `statePointContextCount` 对齐，表示模拟日志行可绑定到 Workbench 运行点上下文。
- `projectionPointCountSynced`：`runtimeOutput.stateCurvePointCount` 与 Workbench runtime output view 的 `projectionPointCount` 对齐，表示 state/resource 曲线点已进入统一 projection point 列表。
- `stateCurveNavigationSynced`：现在由 `statePointContextSynced && projectionPointCountSynced` 得出，替代旧的单一 navigation count 比较。

`WorkbenchFlowPanel` 新增 data 属性：

```text
data-runtime-output-consumer-view-source
data-runtime-output-consumer-ready
data-runtime-output-consumer-contract-status
data-runtime-output-state-point-context-count
data-runtime-output-state-point-context-synced
data-runtime-output-projection-point-count
data-runtime-output-projection-synced
```

`createThreeValueRuntimeOutputConsumerView()` 的 `ready` 判定调整为必须存在 runtime output source；空源不再因为 no-applied-delta 状态字符串包含 `ready` 而被误判为 ready。

### 317.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段只增强 Workbench 主流程对 runtime output view 的一致性判断和验收数据；不改变 runtime output 原始数据、三值计算结果、公式、倍率、证据字段、运行日志行或曲线数值。

### 317.3 验证

- `workbenchFlowModel.test.js` 覆盖 `runtimeOutputView` 被主流程持有，以及 consistency view 新增 consumer/projection 同步字段。
- `WorkbenchFlowPanel.test.js` 覆盖主流程面板新增 data 属性。
- `workbenchFlowContractContext.test.js` 覆盖空 runtime output source 不会被判定 ready。
- `workbench-continuous-edit.spec.js` 覆盖浏览器闭环中 consumer view ready、state point context count/sync、projection point count/sync。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/runtimeSelectedDetail.test.js`：通过，5 个测试文件、22 条测试。
- `npm run test -- --run src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/runtimeSelectedDetail.test.js src/__tests__/views/Workbench.test.js`：通过，6 个测试文件、89 条测试。
- `npx playwright test e2e/workbench-continuous-edit.spec.js -g "runs the visible curve-log-detail edit loop end to end"`：通过，1 条浏览器级闭环测试。
- `npx prettier --check src/simulation/runtime/threeValueRuntimeOutputConsumer.js src/features/workbench/workbenchFlowModel.js src/features/workbench/WorkbenchFlowPanel.vue src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchFlowContractContext.test.js e2e/workbench-continuous-edit.spec.js PROJECT_MANUAL.md`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 318. 结果区主入口：Runtime Review Primary Entry

### 318.1 结构变化

`createWorkbenchRuntimeReviewPrimaryOperationView()` 的视图语义扩展：

```text
isOpenRuntime
```

当 runtime review 当前没有选中结果、也没有刷新结果待返回时，结果区主操作会复用主流程 `primaryAction` 的 `open-runtime-results` 动作，作为结果区的“运行模拟”入口。

`createWorkbenchRuntimeReviewPrimaryOperationCommand()` 的返回结构不改名、不新增持久字段，但在 overview 状态下其 `operationKind` / `action.kind` 可能为：

```text
open-runtime-results
```

选中运行结果时仍使用 `focus-runtime-action`；有刷新结果待返回时仍使用 `return-runtime-result`。

### 318.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段只改变 Workbench 结果区主操作入口；不改变 runtime output 原始数据、三值计算结果、公式、倍率、证据字段、运行日志行或曲线数值。

### 318.3 验证

- `workbenchMainFlowActions.test.js` 覆盖无结果选中时 runtime review primary operation 复用 `open-runtime-results`。
- `Workbench.test.js` 覆盖初始 overview 结果区主操作显示“运行模拟”并可作为主入口。
- `workbench-continuous-edit.spec.js` 的完整曲线-日志-详情-编辑-刷新结果闭环改为从结果区主入口开始。
- `npm run test -- --run src/__tests__/features/workbenchMainFlowActions.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、101 条测试。
- `npx playwright test e2e/workbench-continuous-edit.spec.js -g "runs the visible curve-log-detail edit loop end to end"`：通过，1 条浏览器级闭环测试。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 319. Workbench 会话级编辑历史：Undo / Redo State

### 319.1 结构变化

`Workbench.vue` 新增运行期历史栈：

```text
undoHistoryStack
redoHistoryStack
workbenchHistoryView
```

历史快照覆盖当前会话内的编辑上下文：

```text
selection
enemyConfig
segmentSplitOptions
actionDrafts
selectedActionId
selectedStateCurvePointId
stateCurveFocusMode
stateCurveLayerFilters
stateCurveTrackFilters
calculatorDiagnosticScope
runtimeLogFocus
actionLibraryCharacterId
actionEditSource
actionEditFocus
workbenchFlowDispatchState
```

顶部导航新增 UI 入口：

```text
workbench-undo-edit
workbench-redo-edit
```

### 319.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

撤销/重做历史只存在于当前 Workbench 会话内；保存草稿仍使用 `workbench-draft:v1` 原结构。三值计算结果、公式、倍率、证据字段、运行日志行和曲线数值均不改变。

### 319.3 验证

- `Workbench.test.js` 覆盖导航栏撤销/重做按钮启停，以及技能等级编辑后的撤销/重做恢复。
- `workbench-continuous-edit.spec.js` 覆盖运行结果 -> 编辑动作 -> 撤销 -> 重做 -> 查看刷新结果的浏览器级闭环。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、68 条测试。
- `npx playwright test e2e/workbench-continuous-edit.spec.js -g "keeps undo and redo tied to refreshed runtime results"`：通过，1 条浏览器级闭环测试。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 320. Workbench 键盘编辑快捷键：Keyboard Editing Shortcuts

### 320.1 结构变化

`Workbench.vue` 新增根节点引用与键盘事件处理：

```text
workbenchRoot
handleWorkbenchKeyboardShortcut
copySelectedActionFromShortcut
isWorkbenchKeyboardShortcutTargetEditable
```

当前快捷键：

```text
Ctrl/Meta+Z -> undoWorkbenchEdit
Ctrl/Meta+Y -> redoWorkbenchEdit
Ctrl/Meta+Shift+Z -> redoWorkbenchEdit
Ctrl/Meta+D -> copyAction(selectedActionId)
```

快捷键处理只在当前 Workbench 根节点仍连接到页面时生效，并跳过 `input`、`textarea`、`select`、`contenteditable` 和 `role="textbox"` 目标，避免干扰字段编辑。

顶部撤销/重做按钮补充 `aria-keyshortcuts`，但不新增可见状态字段。

### 320.2 保存与迁移

不新增项目草稿字段，不改变导入导出 schema，不需要数据迁移。

本阶段只新增 Workbench 运行期键盘交互；复制动作仍使用既有 `copyAction()`，撤销/重做仍使用既有会话级历史栈。三值计算结果、公式、倍率、证据字段、运行日志行和曲线数值均不改变。

### 320.3 验证

- `Workbench.test.js` 覆盖 `Ctrl+D -> Ctrl+Z -> Ctrl+Y`，以及输入框内 `Ctrl+D` 不触发动作复制。
- `workbench-continuous-edit.spec.js` 覆盖键盘复制、撤销、重做后继续运行复制动作并进入运行结果复盘。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、69 条测试。
- `npx playwright test e2e/workbench-continuous-edit.spec.js -g "keeps keyboard edit shortcuts tied to runtime review flow"`：通过，1 条浏览器级闭环测试。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 321. Workbench 批次复制：Generated Batch Copy

### 321.1 结构变化

`ActionLibraryPanel.vue` 的批次管理新增 UI 事件：

```text
copy-action-batch(batchId)
```

`Workbench.vue` 新增运行期批次复制入口：

```text
copyActionBatch(batchId)
createCopiedGenerationBatch(sourceBatch, actionCount)
createNextActionIdFromUsedIds(usedActionIds)
```

复制出的动作继续使用 `generationBatch` 记录批次关系，并新增/约定以下批次元数据：

```text
generationBatch.source = "batch-copy"
generationBatch.copiedFromBatchId = 原批次 batchId
```

复制批次会创建新的 `segment-batch-000N`，保留原动作字段、技能动作形态和组内相对时间，并把运行时选中动作切换到新批次第一条动作。

### 321.2 保存与迁移

不新增草稿顶层字段，不改变 `workbench-draft:v1` schema，不需要迁移。

`generationBatch.copiedFromBatchId` 是可选追溯字段；旧草稿没有该字段时保持兼容。三值计算结果、公式、倍率、证据字段、运行日志行和曲线数值均不改变。

### 321.3 验证

- `Workbench.test.js` 覆盖从 runtime view 复制生成批次后，新批次、选中动作、运行详情、曲线选择、日志选择和结果来源行同步到复制出的第一条动作。
- `workbench-continuous-edit.spec.js` 覆盖运行模拟 -> 复制生成批次 -> 定位复制批次结果 -> 编辑动作 -> 回到刷新后的结果定位。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、70 条测试。
- `npx playwright test e2e/workbench-continuous-edit.spec.js -g "keeps runtime result flow usable after copying a generated action batch"`：通过，1 条浏览器级闭环测试。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 322. Workbench 批次结果入口：Batch Runtime Result Entry

### 322.1 结构变化

`Workbench.vue` 新增运行期动作结果映射：

```text
runtimeActionResults
createRuntimeActionResultMap(runtimeProjection)
```

映射结构：

```text
runtimeActionResults[actionId] = {
  actionId,
  statePointId
}
```

`ActionLibraryPanel.vue` 新增 prop：

```text
runtimeActionResults
```

批次摘要在运行期派生以下字段，用于把批次卡片连接到结果复盘：

```text
firstResultActionId
firstResultStatePointId
firstResultStartMs
hasRuntimeResult
```

新增批次结果入口：

```text
workbench-summary-view-action-batch-result
source = "action-batch-summary-result"
kind = "select-runtime-result"
```

### 322.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要迁移。

本阶段只增加 Workbench 运行期 UI 入口和 action -> statePoint 映射。三值计算结果、公式、倍率、证据字段、运行日志行和曲线数值均不改变。

### 322.3 验证

- `Workbench.test.js` 覆盖从批次“查看结果”进入 runtime result 后，再删除该生成批次，结果详情、曲线、日志和贡献拆分回退到可用动作。
- `workbench-continuous-edit.spec.js` 覆盖浏览器级路径：载入批次 -> 批次查看结果 -> 删除批次 -> 查看回退结果 -> 编辑动作 -> 回到刷新后的结果定位。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、70 条测试。
- `npx playwright test e2e/workbench-continuous-edit.spec.js -g "keeps runtime result flow usable after deleting a generated action batch"`：通过，1 条浏览器级闭环测试。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 323. Runtime Output 读取来源诊断：Runtime Output Read Sources

### 323.1 结构变化

`createThreeValueRuntimeOutputConsumerView(runtimeProjection)` 新增运行期诊断字段：

```text
runtimeOutputSourceResolution
outputReadSources
```

`runtimeOutputSourceResolution` 描述本次 runtime 输出根来源：

```text
sourcePath
sourceTier
sourceKind
status
hasRuntimeOutputsEnvelope
directRuntimeOutputs
legacyProjectionFallback
ready
```

`outputReadSources` 描述 `simLog`、`stateCurves`、`resourceCurves`、`summary` 的实际读取来源：

```text
outputReadSources.root
outputReadSources.outputs[outputName].sourceKey
outputReadSources.outputs[outputName].sourcePath
outputReadSources.outputs[outputName].sourceTier
outputReadSources.outputs[outputName].fallback
outputReadSources.outputs[outputName].standardOutputPresent
outputReadSources.outputs[outputName].legacyProjectionFallback
outputReadSources.standardOutputNames
outputReadSources.fallbackOutputNames
outputReadSources.usesLegacyProjectionFallback
```

读取优先级保持为：标准 `runtimeOutputs.outputs.*` 优先，其次兼容 `runtimeOutputs` 直接字段、alias 字段和 legacy projection 字段。`summary` 继续保留既有多来源 merge 逻辑，并记录 `mergeSourcePaths`。

### 323.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只新增运行期诊断结构；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 323.3 验证

- `runtimeProjectionPoints.test.js` 覆盖标准 `runtimeOutputs.outputs.*` 与旧字段冲突时，Workbench 运行输出 view 优先读取标准输出。
- `runtimeProjectionPoints.test.js` 覆盖纯 legacy projection 输入时，`outputReadSources` 标记 `legacy-projection-field` fallback。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/runtimeSelectedDetail.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js`：通过，4 个测试文件、18 条测试。
- `npm run test:e2e:workbench-flow`：通过，5 条浏览器级主流程测试。
- `npx prettier --check src/simulation/runtime/threeValueRuntimeOutputConsumer.js src/__tests__/features/runtimeProjectionPoints.test.js PROJECT_MANUAL.md`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 324. Runtime Input 生成层读取来源诊断：Generation Read Sources

### 324.1 结构变化

`createActionHitThreeValueRuntimeInput()` 返回的 runtime input 新增运行期诊断字段：

```text
generationReadSources
```

`generationReadSources` 描述 runtime input 从生成层读取以下三类输入的实际来源：

```text
generationReadSources.inputs.runtimeInputSource
generationReadSources.inputs.standardContract
generationReadSources.inputs.deltas
```

每个输入来源包含：

```text
inputName
sourceKey
sourcePath
sourceTier
aliasFor
present
fallback
standardOutputPresent
legacyGenerationFallback
```

汇总字段：

```text
generationReadSources.standardOutputNames
generationReadSources.fallbackInputNames
generationReadSources.standardOutputCount
generationReadSources.fallbackInputCount
generationReadSources.usesLegacyGenerationFallback
```

读取优先级调整为：

```text
显式 runtimeInputSource 参数
generationOutputs.outputs.*
generationOutputs 旧直挂字段
runtimeInputSource 内部字段
generation entry / generation layer fallback
```

其中显式 `runtimeInputSource` 参数保持最高优先级；仅传入 `generationOutputs` 时，标准 `generationOutputs.outputs.runtimeInputSource`、`generationOutputs.outputs.standardContract`、`generationOutputs.outputs.deltas` 优先于旧直挂字段。

`createWorkbenchFlowContractContext().runtimeInput` 新增运行期合同字段：

```text
generationReadSourcesStatus
generationReadStandardOutputCount
generationReadFallbackInputCount
generationReadUsesLegacyFallback
generationRuntimeInputSourcePath
generationStandardContractSourcePath
generationDeltasSourcePath
```

### 324.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只新增运行期诊断结构和生成层输入读取优先级；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 324.3 验证

- `actionHitThreeValueRuntimeInput.test.js` 覆盖标准 `generationOutputs.outputs.*` 与旧字段冲突时，runtime input 优先读取标准输出。
- `workbenchFlowContractContext.test.js` 覆盖 Workbench 合同上下文承接 runtime input 的生成层读取来源状态和来源路径。
- `npm run test -- --run src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js`：通过，4 个测试文件、19 条测试。
- `npm run test:e2e:workbench-flow`：通过，5 条浏览器级主流程测试。
- `npx prettier --check src/simulation/runtime/actionHitThreeValueRuntimeInput.js src/features/workbench/workbenchFlowContractContext.js src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/features/workbenchFlowContractContext.test.js PROJECT_MANUAL.md`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 325. Runtime Projection 生成入口摘要：Generation Read Summary

### 325.1 结构变化

runtime projection 的 summary 结构新增生成层读取来源摘要字段：

```text
runtimeInputGenerationReadSourcesStatus
runtimeInputGenerationReadStandardOutputCount
runtimeInputGenerationReadFallbackInputCount
runtimeInputGenerationReadUsesLegacyFallback
runtimeInputGenerationRuntimeInputSourcePath
runtimeInputGenerationStandardContractPath
runtimeInputGenerationDeltasPath
```

这些字段同步出现在：

```text
threeValueRuntimeProjection.summary
threeValueRuntimeProjection.outputContract.summary
threeValueRuntimeProjection.runtimeOutputs.outputSummary
projectSimulationResult.summary.threeValueRuntimeProjectionSummary
projectSimulationResult.summary.runtimeOutputsSummary
```

字段来自 `runtimeInput.generationReadSources`，用于在 projection / output summary 层直接判断 runtime input 是否来自标准 `generationOutputs.outputs.*`，以及是否发生 legacy generation fallback。

### 325.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只新增运行期 summary 诊断字段；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 325.3 验证

- `threeValueRuntimeProjection.test.js` 覆盖标准 `generationOutputs.outputs.*`、旧 generationOutputs 字段和 runtime input source 内部字段冲突时，projection summary 与 runtime output summary 均记录标准 outputs 来源。
- `firstVerticalSliceSimulation.test.js` 覆盖完整 `projectSimulationResult()` 输出的 runtime projection summary 和 runtime outputs summary 承接标准生成入口来源路径。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js`：通过，1 个测试文件、6 条测试。
- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js`：通过，2 个测试文件、11 条测试。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js --pool=threads`：通过，4 个测试文件、30 条测试。
- `npm run test:e2e:workbench-flow`：通过，5 条浏览器级主流程测试。
- `npx prettier --check src/simulation/runtime/threeValueRuntimeProjection.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js PROJECT_MANUAL.md`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 326. Workbench Runtime 合同边界：Runtime Contract Boundary

### 326.1 结构变化

`createWorkbenchFlowContractContext()` 新增顶层运行期诊断对象：

```text
runtimeContractBoundary
```

`runtimeContractBoundary` 将 runtime input 的 generation read source 与 runtime output 的 output read source 合并为一条 Workbench 运行时合同边界：

```text
schemaVersion
sourceKind
status
ready
readyState
standardBoundaryReady
standardBoundaryReadyState
generationStandardReady
generationStandardReadyState
runtimeOutputStandardReady
runtimeOutputStandardReadyState
simLogConnectedToAppliedDeltas
simLogConnectedToAppliedDeltasState
usesLegacyFallback
usesLegacyFallbackState
fallbackCount
generationReadSourcesStatus
runtimeOutputReadSourcesStatus
generationReadStandardOutputCount
runtimeOutputReadStandardOutputCount
generationReadFallbackInputCount
runtimeOutputReadFallbackOutputCount
generationDeltasSourcePath
runtimeSimLogSourcePath
runtimeSummarySourcePath
```

`createWorkbenchFlowContractContext().runtimeOutput` 同步新增 runtime output 读取来源摘要：

```text
outputReadSourcesStatus
outputReadStandardOutputCount
outputReadFallbackOutputCount
outputReadUsesLegacyFallback
outputReadSimLogSourcePath
outputReadStateCurvesSourcePath
outputReadResourceCurvesSourcePath
outputReadSummarySourcePath
```

`createWorkbenchRuntimeOutputConsistencyView()` 新增运行期边界状态字段：

```text
runtimeContractBoundaryStatus
runtimeContractBoundaryReady
runtimeContractBoundaryReadyState
runtimeContractStandardBoundaryReady
runtimeContractStandardBoundaryReadyState
runtimeContractUsesLegacyFallback
runtimeContractUsesLegacyFallbackState
```

### 326.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只新增 Workbench 运行期合同诊断结构；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 326.3 验证

- `workbenchFlowContractContext.test.js` 覆盖标准 generation outputs + 标准 runtime outputs 时，`runtimeContractBoundary.status = workbench-runtime-contract-boundary-standard`。
- `workbenchFlowContractContext.test.js` 覆盖缺少 runtime output 时，`runtimeContractBoundary.status = workbench-runtime-contract-boundary-incomplete`。
- `workbenchFlowModel.test.js` 覆盖主流程模型的 runtime consistency view 承接 runtime contract boundary 状态。
- `npm run test -- --run src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js`：通过，2 个测试文件、11 条测试。
- `npm run test -- --run src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js`：通过，3 个测试文件、15 条测试。
- `npm run test:e2e:workbench-flow`：通过，5 条浏览器级主流程测试。
- `npx prettier --check src/features/workbench/workbenchFlowContractContext.js src/features/workbench/workbenchFlowModel.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js PROJECT_MANUAL.md`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 327. Workbench 主流程合同边界验收：Runtime Contract Boundary E2E Gate

### 327.1 结构变化

`WorkbenchFlowPanel.vue` 根节点新增非可见 data 属性，用于主流程回归验收 runtime contract boundary：

```text
data-runtime-contract-boundary-status
data-runtime-contract-boundary-ready
data-runtime-contract-standard-boundary-ready
data-runtime-contract-uses-legacy-fallback
```

这些属性来自 `createWorkbenchMainFlowStatusView().runtimeOutput`，分别映射：

```text
runtimeContractBoundaryStatus
runtimeContractBoundaryReadyState
runtimeContractStandardBoundaryReadyState
runtimeContractUsesLegacyFallbackState
```

`e2e/workbench-continuous-edit.spec.js` 的 `expectRuntimeOutputConsistent(page)` 新增 runtime contract boundary 验收：

```text
data-runtime-contract-boundary-status = workbench-runtime-contract-boundary-standard
data-runtime-contract-boundary-ready = true
data-runtime-contract-standard-boundary-ready = true
data-runtime-contract-uses-legacy-fallback = false
```

### 327.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只新增 Workbench 主流程非可见验收属性和浏览器级回归断言；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 327.3 验证

- `WorkbenchFlowPanel.test.js` 覆盖面板根节点暴露 runtime contract boundary 的 data 属性。
- `workbench-continuous-edit.spec.js` 覆盖核心 Workbench 主流程中 runtime output consistency 与 runtime contract boundary 同时保持标准状态。
- `npm run test -- --run src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js`：通过，3 个测试文件、15 条测试。
- `npm run test:e2e:workbench-flow`：通过，5 条浏览器级主流程测试。
- `npx prettier --check src/features/workbench/WorkbenchFlowPanel.vue src/__tests__/features/WorkbenchFlowPanel.test.js e2e/workbench-continuous-edit.spec.js`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 提示。

## 328. 生成层标准入口输出：Generation Entry Standard Output

### 328.1 结构变化

`createThreeValueGenerationBundle()` 新增一等生成入口：

```text
generationEntry
```

该入口也会作为标准输出暴露在：

```text
generationOutputs.generationEntry
generationOutputs.outputs.generationEntry
```

`generationEntry` 聚合 `Action -> Hit -> ThreeValueDelta` 的统一生成合同入口：

```text
sourceKind = azpr-action-hit-three-value-delta-standard-generation-entry
status = action-hit-three-value-delta-standard-generation-entry-ready | action-hit-three-value-delta-standard-generation-entry-empty
generationInput
standardContract
actions
hits
deltas
runtimeInputSource
outputs.generationInput
outputs.standardContract
outputs.actions
outputs.hits
outputs.deltas
outputs.runtimeInputSource
```

`generationOutputs.outputNames` 新增 `generationEntry`，`generationOutputs.outputAliases` 新增：

```text
actionHitThreeValueDeltaGeneration -> generationEntry
```

`createActionHitThreeValueRuntimeInput()` 的标准读取路径优先级调整为：

```text
generationOutputs.outputs.generationEntry.runtimeInputSource
generationOutputs.outputs.generationEntry.standardContract
generationOutputs.outputs.generationEntry.deltas
```

旧的直出路径仍保留为兼容后备：

```text
generationOutputs.outputs.runtimeInputSource
generationOutputs.outputs.standardContract
generationOutputs.outputs.deltas
generationOutputs.runtimeInputSource
generationOutputs.standardContract
generationOutputs.deltas
```

### 328.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只改变运行期生成输出结构和 runtime input 的读取优先级；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 328.3 验证

- `threeValueGenerationBuilder.test.js` 覆盖 `generationEntry` 标准输出、别名和 outputCount = 8。
- `actionHitThreeValueRuntimeInput.test.js` 覆盖 runtime input 优先从 `generationOutputs.outputs.generationEntry.*` 读取。
- `threeValueRuntimeProjection.test.js`、`firstVerticalSliceSimulation.test.js`、`workbenchFlowContractContext.test.js` 和 `workbenchFlowModel.test.js` 覆盖投影、纵切和 Workbench 合同上下文仍保持标准边界。

## 329. 生成层标准入口校验：Generation Entry Contract Validation

### 329.1 结构变化

`generationEntry` 新增运行期合同校验对象：

```text
generationEntry.contractValidation
```

结构为：

```text
schemaVersion = 1
sourceKind = azpr-action-hit-three-value-delta-generation-entry-contract-validation
status = generation-entry-contract-valid | generation-entry-contract-invalid
contractName
topology
outputNames
actionCount
hitCount
deltaCount
checkCount
issueCount
issueKeys
checks[]
valid
applied = false
```

`checks[]` 当前覆盖：

```text
contract-name
topology
output-names
standard-contract-actions-reference
standard-contract-hits-reference
standard-contract-deltas-reference
runtime-input-source-contract-reference
runtime-input-source-deltas-reference
outputs-standard-contract-reference
outputs-actions-reference
outputs-hits-reference
outputs-deltas-reference
summary-action-count
summary-hit-count
summary-delta-count
summary-applied-delta-count
delta-required-fields
deltas-linked-to-actions
deltas-linked-to-hits
deltas-listed-by-hits
```

`generationEntry.status` 在校验失败时会进入：

```text
action-hit-three-value-delta-standard-generation-entry-contract-invalid
```

现有 ready / empty 状态保持不变：

```text
action-hit-three-value-delta-standard-generation-entry-ready
action-hit-three-value-delta-standard-generation-entry-empty
```

新增 summary 字段：

```text
generationEntry.summary.contractValidationStatus
generationEntry.summary.contractValidationIssueCount
generationOutputs.summary.generationEntryContractValidationStatus
generationOutputs.summary.generationEntryContractValidationIssueCount
threeValueGenerationBundle.summary.standardGenerationEntryContractValidationStatus
threeValueGenerationBundle.summary.standardGenerationEntryContractValidationIssueCount
```

`src/simulation/index.js` 新增导出：

```text
validateStandardGenerationEntryContract()
```

### 329.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只新增运行期生成入口校验边界；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 329.3 验证

- `threeValueGenerationBuilder.test.js` 覆盖有效 `generationEntry` 的合同校验结果。
- `threeValueGenerationBuilder.test.js` 覆盖故意打散 `generationEntry.deltas` 引用时，校验会在 runtime 消费前报告 contract drift。
- `npm run test -- --run src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/actionHitThreeValueDeltaGeneration.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js`：通过，7 个测试文件、36 条测试。

## 330. 运行时消费生成入口校验：Runtime Generation Entry Validation Boundary

### 330.1 结构变化

`createActionHitThreeValueRuntimeInput()` 的 `generationReadSources.inputs` 从 3 类扩展为 5 类：

```text
generationReadSources.inputs.generationEntry
generationReadSources.inputs.runtimeInputSource
generationReadSources.inputs.standardContract
generationReadSources.inputs.deltas
generationReadSources.inputs.contractValidation
```

标准读取路径新增：

```text
generationOutputs.outputs.generationEntry
generationOutputs.outputs.generationEntry.contractValidation
```

因此标准生成输入满足完整入口时：

```text
generationReadSources.standardOutputNames = [
  generationEntry,
  runtimeInputSource,
  standardContract,
  deltas,
  contractValidation,
]
generationReadSources.standardOutputCount = 5
```

`runtimeInput` 新增字段：

```text
standardGenerationEntrySourceKind
standardGenerationEntryStatus
generationEntryContractValidation
generationEntryContractValidationSourceKind
generationEntryContractValidationStatus
generationEntryContractValidationIssueCount
generationEntryContractValidationValid
```

`runtimeInput.summary` 同步新增：

```text
standardGenerationEntrySourceKind
standardGenerationEntryStatus
generationEntryContractValidationSourceKind
generationEntryContractValidationStatus
generationEntryContractValidationIssueCount
generationEntryContractValidationValid
```

`generationReadSources` 新增：

```text
generationEntryContractValidationStatus
generationEntryContractValidationIssueCount
generationEntryContractValidationValid
generationEntryContractValidationValidState
standardGenerationBoundaryReady
standardGenerationBoundaryReadyState
```

当 `generationEntry.contractValidation.valid = false` 时，runtime input 状态为：

```text
runtime-input-invalid-generation-entry-contract
```

runtime projection summary / runtime output summary 新增：

```text
runtimeInputGenerationStandardBoundaryReady
runtimeInputGenerationEntryContractValidationStatus
runtimeInputGenerationEntryContractValidationIssueCount
runtimeInputGenerationEntryContractValidationValid
runtimeInputGenerationEntryPath
runtimeInputGenerationContractValidationPath
```

Workbench runtime contract boundary 新增：

```text
generationEntryContractValidationStatus
generationEntryContractValidationIssueCount
generationEntryContractValidationValid
generationEntryContractValidationValidState
generationEntrySourcePath
generationContractValidationSourcePath
```

Workbench 的 generation 标准边界现在要求：

```text
generationReadStandardOutputCount >= 5
generationEntryContractValidationValid = true
generationReadUsesLegacyFallback = false
```

### 330.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只改变运行期诊断合同和标准边界判断；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 330.3 验证

- `actionHitThreeValueRuntimeInput.test.js` 覆盖 runtime input 从 5 类标准生成输入读取，并在 `contractValidation.valid = false` 时进入 invalid boundary 状态。
- `threeValueRuntimeProjection.test.js` 和 `firstVerticalSliceSimulation.test.js` 覆盖 runtime projection / runtime output summary 继续传递标准生成入口校验状态。
- `workbenchFlowContractContext.test.js`、`workbenchFlowModel.test.js` 和 `WorkbenchFlowPanel.test.js` 覆盖 Workbench 主流程合同边界仍保持 standard，且标准边界以生成入口校验有效为条件。
- `npm run test -- --run src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js`：通过，6 个测试文件、38 条测试。

## 331. 运行时输出消费边界：Runtime Output Consumer Boundary

### 331.1 结构变化

`createThreeValueRuntimeOutputConsumerView()` 新增：

```text
outputConsumerBoundary
```

结构为：

```text
schemaVersion = 1
sourceKind = azpr-three-value-runtime-output-consumer-boundary
status = runtime-output-consumer-boundary-standard | runtime-output-consumer-boundary-ready-with-fallbacks | runtime-output-consumer-boundary-missing
ready
readyState
standardBoundaryReady
standardBoundaryReadyState
sourcePath
sourceTier
runtimeOutputsSourceKind
runtimeOutputsStatus
outputConsumerContractSourceKind
outputConsumerContractStatus
outputReadSourcesStatus
standardOutputNames
fallbackOutputNames
standardOutputCount
fallbackOutputCount
usesLegacyProjectionFallback
usesLegacyProjectionFallbackState
applied = true
```

标准 runtime output consumer 边界要求：

```text
outputConsumerContract.status contains ready
outputReadSources.standardOutputCount >= 4
outputReadSources.usesLegacyProjectionFallback = false
```

`createThreeValueRuntimeOutputConsumerView().summary` 新增：

```text
outputConsumerBoundaryStatus
outputConsumerBoundaryReady
outputConsumerBoundaryStandardReady
outputConsumerBoundaryUsesLegacyFallback
```

Workbench runtime output context 新增：

```text
outputConsumerBoundaryStatus
outputConsumerBoundaryReady
outputConsumerBoundaryStandardReady
outputConsumerBoundaryUsesLegacyFallback
outputConsumerBoundaryStandardOutputCount
outputConsumerBoundaryFallbackOutputCount
```

Workbench runtime contract boundary 新增：

```text
runtimeOutputConsumerBoundaryStatus
runtimeOutputConsumerBoundaryReady
runtimeOutputConsumerBoundaryReadyState
runtimeOutputConsumerBoundaryStandardReady
runtimeOutputConsumerBoundaryStandardReadyState
runtimeOutputConsumerBoundaryStandardOutputCount
runtimeOutputConsumerBoundaryFallbackOutputCount
```

Workbench 的 runtime output 标准边界现在优先读取：

```text
runtimeOutput.outputConsumerBoundaryStandardReady
```

旧的 `outputReadStandardOutputCount >= 4 && !outputReadUsesLegacyFallback` 保留为兼容后备。

### 331.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只新增运行时输出消费边界和 Workbench 内部合同字段；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值和 UI 文案均不改变。

### 331.3 验证

- `runtimeProjectionPoints.test.js` 覆盖 Workbench runtime output consumer view 从 runtime outputs envelope 生成 `outputConsumerBoundary`，并确认 4 类标准输出全部来自标准边界。
- `workbenchFlowContractContext.test.js` 覆盖 Workbench runtime contract boundary 优先透出 runtime output consumer boundary 状态。
- `workbenchFlowModel.test.js`、`WorkbenchFlowPanel.test.js`、`threeValueRuntimeProjection.test.js` 和 `firstVerticalSliceSimulation.test.js` 覆盖主流程、投影和纵切仍保持 standard runtime output 边界。
- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，6 个测试文件、39 条测试。

## 332. 生成入口聚合校验：Generation Entry Aggregate Validation

### 332.1 结构变化

`generationEntry.contractValidation` 新增聚合一致性校验：

```text
aggregateValidation
```

`aggregateValidation` 结构：

```text
schemaVersion = 1
sourceKind = azpr-action-hit-three-value-delta-generation-entry-aggregate-validation
status = generation-entry-aggregate-valid | generation-entry-aggregate-invalid
actionCount
hitCount
checkCount
issueCount
issueKeys
checks[]
valid
applied = false
```

`generationEntry.contractValidation.checks[]` 新增 4 个检查项：

```text
action-aggregate-delta-counts
hit-aggregate-delta-counts
action-aggregate-layer-fields
hit-aggregate-layer-fields
```

这些检查会从标准 `Action -> Hit -> ThreeValueDelta` 合同中的原始 `deltas` 重新计算 action / hit 两层的 `threeValueDeltaAggregate`：

```text
deltaCount
layerKeys
layers[].deltaCount
layers[].trackKeys
layers[].hpDelta
layers[].toughnessDelta
layers[].energyDelta
```

若 action 或 hit 聚合与底层 deltas 不一致，`contractValidation.status` 会变为：

```text
generation-entry-contract-invalid
```

生成层 summary 新增以下派生字段：

```text
generationEntry.summary.aggregateValidationStatus
generationEntry.summary.aggregateValidationIssueCount
generationOutputs.summary.generationEntryAggregateValidationStatus
generationOutputs.summary.generationEntryAggregateValidationIssueCount
threeValueGenerationBundle.summary.standardGenerationEntryAggregateValidationStatus
threeValueGenerationBundle.summary.standardGenerationEntryAggregateValidationIssueCount
```

### 332.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只增强生成层标准入口的派生合同校验；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值、UI 文案和项目保存结构均不改变。

### 332.3 验证

- `threeValueGenerationBuilder.test.js` 覆盖正常生成入口的 `generation-entry-aggregate-valid` 状态。
- `threeValueGenerationBuilder.test.js` 覆盖篡改 hit aggregate 后，`contractValidation` 在运行时消费前变为 invalid。
- `actionHitThreeValueRuntimeInput.test.js`、`threeValueRuntimeProjection.test.js` 和 `firstVerticalSliceSimulation.test.js` 覆盖运行时输入、投影和纵切仍保持原三值结果。
- `npm run test -- --run src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，4 个测试文件、26 条测试。

## 333. 运行时聚合可信边界：Runtime Aggregate Validation Boundary

### 333.1 结构变化

`createActionHitThreeValueRuntimeInput()` 现在会从 `generationEntry.contractValidation.aggregateValidation` 读取聚合校验，并在 runtime input 顶层透出：

```text
generationEntryAggregateValidation
generationEntryAggregateValidationSourceKind
generationEntryAggregateValidationStatus
generationEntryAggregateValidationIssueCount
generationEntryAggregateValidationValid
```

`runtimeInput.generationReadSources` 新增：

```text
generationEntryAggregateValidationStatus
generationEntryAggregateValidationIssueCount
generationEntryAggregateValidationValid
generationEntryAggregateValidationValidState
standardGenerationAggregateBoundaryReady
standardGenerationAggregateBoundaryReadyState
```

`runtimeInput.summary` 新增：

```text
generationEntryAggregateValidationSourceKind
generationEntryAggregateValidationStatus
generationEntryAggregateValidationIssueCount
generationEntryAggregateValidationValid
```

`threeValueRuntimeProjection.summary`、`runtimeProjection.outputContract.summary` 和 `runtimeOutputs.outputSummary` 新增：

```text
runtimeInputGenerationEntryAggregateValidationStatus
runtimeInputGenerationEntryAggregateValidationIssueCount
runtimeInputGenerationEntryAggregateValidationValid
runtimeInputGenerationAggregateBoundaryReady
runtimeInputGenerationAggregateValidationPath
```

`Workbench` runtime contract context 新增：

```text
runtimeInput.generationAggregateBoundaryReady
runtimeInput.generationEntryAggregateValidationStatus
runtimeInput.generationEntryAggregateValidationIssueCount
runtimeInput.generationEntryAggregateValidationValid
runtimeInput.generationAggregateValidationSourcePath
runtimeContractBoundary.generationAggregateReady
runtimeContractBoundary.generationAggregateReadyState
runtimeContractBoundary.generationEntryAggregateValidationStatus
runtimeContractBoundary.generationEntryAggregateValidationIssueCount
runtimeContractBoundary.generationEntryAggregateValidationValid
runtimeContractBoundary.generationEntryAggregateValidationValidState
runtimeContractBoundary.generationAggregateValidationSourcePath
```

Workbench 标准运行时边界现在要求：

```text
runtimeInput.generationStandardBoundaryReady = true
runtimeInput.generationAggregateBoundaryReady = true
runtimeOutput.outputConsumerBoundaryStandardReady = true
simLog input source connected to applied deltas
```

换句话说，“标准入口有效”和“贡献聚合可信”会被分开记录，但都必须通过，Workbench 才会把运行时合同判定为标准边界。

### 333.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只把生成入口聚合校验继续传递到运行时和 Workbench 合同边界；三值计算结果、公式、倍率、证据字段、运行日志行、曲线数值、UI 文案和项目保存结构均不改变。

### 333.3 验证

- `actionHitThreeValueRuntimeInput.test.js` 覆盖 runtime input 从 generation entry 读取 aggregate validation，并在 aggregate invalid 时降级标准边界。
- `threeValueRuntimeProjection.test.js` 覆盖 runtime projection / output contract / runtime outputs summary 透出 aggregate validation 状态。
- `firstVerticalSliceSimulation.test.js` 覆盖真实纵切路径的 runtime input 具备 `standardGenerationAggregateBoundaryReady`。
- `workbenchFlowContractContext.test.js` 和 `workbenchFlowModel.test.js` 覆盖 Workbench runtime contract boundary 将 aggregate validation 纳入标准边界。
- `npm run test -- --run src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/features/workbenchFlowContractContext.test.js src/__tests__/features/workbenchFlowModel.test.js src/__tests__/features/WorkbenchFlowPanel.test.js`：通过，6 个测试文件、39 条测试。

## 334. 生成层可替换数值来源槽位：Generation Value Source Slots

### 334.1 结构变化

标准 `Action -> Hit -> ThreeValueDelta` 生成层新增 `valueSourceSlots`，用于把 HP / 韧性 / 自身能量三条轨道在 `applied / candidate / sampled / placeholder` 四层中的数值来源固定为可替换槽位。

`threeValueGenerationLayer.contract` 新增：

```text
valueSourceSlotContract
```

该合同描述：

```text
name = ThreeValueReplaceableSourceSlot
keyFields = trackKey, layerKey
runtimeEligibleLayerKey = applied
replaceableLayerKeys = candidate, sampled, placeholder
```

`threeValueGenerationLayer`、`standardContract`、`generationEntry`、`generationOutputs` 和 `runtimeInputSource` 新增：

```text
valueSourceSlots
```

`generationOutputs.outputs` 新增标准输出：

```text
outputs.valueSourceSlots
```

因此 `generationOutputs.outputNames` 从：

```text
generationEntry
generationInput
standardContract
actions
hits
deltas
runtimeInputSource
runtimeInput
```

扩展为：

```text
generationEntry
generationInput
standardContract
actions
hits
deltas
valueSourceSlots
runtimeInputSource
runtimeInput
```

每个 `ThreeValueDelta` 新增：

```text
valueField
valueSourceKey
valueSource
```

`valueSource` 结构包含：

```text
key
trackKey
trackLabel
layerKey
layerLabel
valueField
valueUnit
valueSourceKind
valueSourceStatus
sourceIds
confidence
calculatorKey
calculationStatus
runtimeEligible
replaceable
replacementScope
```

`valueSourceSlots[]` 每项包含：

```text
key
trackKey
trackLabel
layerKey
layerLabel
valueField
valueUnit
inputSourceKind
inputStatus
pointCount
deltaCount
appliedDeltaCount
replaceableDeltaCount
sourceKinds
calculatorKeys
confidenceKeys
runtimeEligible
replaceable
replacementPolicy
```

生成层、标准入口、generation outputs 和 runtime input source 的 summary 新增：

```text
valueSourceSlotCount
runtimeValueSourceSlotCount
replaceableValueSourceSlotCount
readyValueSourceSlotCount
```

其中 `readyValueSourceSlotCount` 只在 `threeValueGenerationLayer.summary` 直接记录。

`validateStandardGenerationEntryContract()` 新增引用一致性检查：

```text
standard-contract-value-source-slots-reference
runtime-input-source-value-source-slots-reference
outputs-value-source-slots-reference
```

### 334.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只增强生成层标准入口的可替换来源合同；三值计算结果、公式、倍率、运行时 applied delta 筛选、运行日志行、曲线数值、UI 文案和项目保存结构均不改变。

### 334.3 验证

- `threeValueGenerationBuilder.test.js` 覆盖 `valueSourceSlots` 标准输出、`ThreeValueDelta.valueSource`、以及 generation entry / generation outputs 的 slot 计数。
- `firstVerticalSliceSimulation.test.js` 覆盖真实纵切路径中 12 个来源槽位、3 个 runtime eligible 槽位、9 个 replaceable 槽位，并确认 `generationOutputs.outputs.valueSourceSlots` 与标准合同同源。
- `actionHitThreeValueRuntimeInput.test.js` 和 `threeValueRuntimeProjection.test.js` 覆盖新增标准输出不改变 runtime applied delta 消费结果。
- `npm run test -- --run src\__tests__\simulation\threeValueGenerationBuilder.test.js`：通过，1 个测试文件、3 条测试。
- `npm run test -- --run src\__tests__\simulation\actionHitThreeValueRuntimeInput.test.js src\__tests__\simulation\threeValueRuntimeProjection.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过，3 个测试文件、24 条测试。
- `npm run test:e2e:workbench-flow`：通过，16 条 `@workbench-main-flow` 主流程回归全部通过。

## 335. 运行时可替换数值来源槽位摘要：Runtime Value Source Slot Summary

### 335.1 字段变化

`threeValueRuntimeInput` 新增标准读取项：

```text
generationReadSources.inputs.valueSourceSlots
```

在新版 generation outputs 中，该项优先读取：

```text
generationOutputs.outputs.generationEntry.valueSourceSlots
```

旧输入或手写测试数据缺少该字段时，可回落到 `runtimeInputSource.valueSourceSlots` 或 `standardContract.valueSourceSlots`，但该项作为可选诊断输入，不会让原本有效的 runtime boundary 失效。

`threeValueRuntimeInput` 新增：

```text
valueSourceSlots
```

`threeValueRuntimeInput.summary`、`threeValueRuntimeProjection.summary`、`runtimeOutputs.summary`、`runtimeOutputs.outputSummary` 和 `runtimeOutputContract.summary` 新增：

```text
valueSourceSlotCount
runtimeValueSourceSlotCount
replaceableValueSourceSlotCount
runtimeInputGenerationValueSourceSlotsPath
runtimeInputGenerationValueSourceSlotsSourceTier
runtimeInputGenerationValueSourceSlotsStandardOutputPresent
```

`runtimeOutputContract.outputs.summary.countFields` 新增：

```text
valueSourceSlotCount
runtimeValueSourceSlotCount
replaceableValueSourceSlotCount
```

`runtimeOutputContract.outputs.summary.sourceFields` 新增：

```text
runtimeInputGenerationValueSourceSlotsPath
runtimeInputGenerationValueSourceSlotsSourceTier
```

### 335.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只把生成层的 `valueSourceSlots` 摘要接入运行时合同；三值计算结果、公式、倍率、applied delta 筛选、运行日志行、曲线数值和 UI 文案均不改变。

### 335.3 验证

- `actionHitThreeValueRuntimeInput.test.js` 覆盖 runtime input 从标准 generation output 读取 `valueSourceSlots`，并把来源 path 与 slot 计数写入 summary。
- `threeValueRuntimeProjection.test.js` 覆盖旧式手写 generation outputs 缺少 `valueSourceSlots` 时不会破坏原本的标准运行时边界。
- `firstVerticalSliceSimulation.test.js` 覆盖真实纵切路径中 runtime input、runtime projection summary、runtime outputs summary 均透出 12 个来源槽位、3 个 runtime eligible 槽位、9 个 replaceable 槽位。
- `npm run test -- --run src\__tests__\simulation\actionHitThreeValueRuntimeInput.test.js src\__tests__\simulation\threeValueRuntimeProjection.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过，3 个测试文件、24 条测试。

## 336. Workbench 来源槽位摘要消费：Workbench Value Source Slot Summary Context

### 336.1 字段变化

`createWorkbenchFlowContractContext()` 的 `runtimeInput` 新增只读摘要字段：

```text
valueSourceSlotCount
runtimeValueSourceSlotCount
replaceableValueSourceSlotCount
generationValueSourceSlotsSourcePath
generationValueSourceSlotsSourceTier
generationValueSourceSlotsStandardOutputPresent
```

这些字段优先来自 `runtimeInput.summary` 和 `runtimeInput.generationReadSources.inputs.valueSourceSlots`，并以 `runtimeProjection.summary` 作为兼容回退。

`createWorkbenchFlowContractContext()` 的 `runtimeOutput` 新增只读摘要字段：

```text
valueSourceSlotCount
runtimeValueSourceSlotCount
replaceableValueSourceSlotCount
valueSourceSlotsSourcePath
valueSourceSlotsSourceTier
valueSourceSlotsStandardOutputPresent
```

这些字段优先来自 `runtimeOutputs.outputSummary`，并以 `runtimeProjection.summary` 作为兼容回退。

`runtimeContractBoundary` 和 `createWorkbenchRuntimeOutputConsistencyView()` 同步透出上述 Workbench 只读字段，供 UI 主流程和诊断视图消费 runtime 边界摘要。

### 336.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只改变 Workbench 对 runtime summary / output summary 的只读消费边界；三值计算结果、公式、倍率、applied delta 筛选、运行日志行、曲线数值和 UI 文案均不改变。

### 336.3 验证

- `workbenchFlowContractContext.test.js` 覆盖 runtime input、runtime output 和 contract boundary 从 runtime summary / generation read sources 读取来源槽位摘要。
- `workbenchFlowModel.test.js` 覆盖 runtime output consistency view 继续透出来源槽位摘要，供 Workbench 后续诊断消费。
- `npm run test -- --run src\__tests__\features\workbenchFlowContractContext.test.js src\__tests__\features\workbenchFlowModel.test.js`：通过，2 个测试文件、11 条测试。

## 337. 生成层标准输出边界：Generation Standard Output Boundary

### 337.1 字段变化

`createThreeValueGenerationBundle()` 产出的 `generationOutputs` 新增只读边界对象：

```text
generationOutputs.standardOutputBoundary
generationOutputs.outputBoundary
```

其中 `outputBoundary` 是 `standardOutputBoundary` 的别名，不新增额外数据源。边界对象用于固定 `Action -> Hit -> ThreeValueDelta` 标准生成入口，核心字段包括：

```text
sourceKind = azpr-action-hit-three-value-generation-output-boundary
status
ready
entryPath
runtimeInputSourcePath
standardContractPath
deltasPath
valueSourceSlotsPath
contractValidationPath
aggregateValidationPath
standardOutputNames
standardOutputCount
issueCount
issueKeys
checks[]
usesLegacyFallback
```

`generationOutputs.summary` / `generationOutputs.outputSummary` 新增：

```text
generationOutputBoundaryStatus
generationOutputBoundaryReady
generationOutputBoundaryPath
generationOutputBoundaryEntryPath
generationOutputBoundaryRuntimeInputSourcePath
generationOutputBoundaryStandardContractPath
generationOutputBoundaryDeltasPath
generationOutputBoundaryValueSourceSlotsPath
generationOutputBoundaryContractValidationPath
generationOutputBoundaryStandardOutputCount
generationOutputBoundaryIssueCount
```

`threeValueGenerationBundle.summary` 新增：

```text
generationOutputBoundaryStatus
generationOutputBoundaryReady
generationOutputBoundaryIssueCount
```

`threeValueRuntimeInput` 顶层与 `summary` 新增同名只读字段：

```text
generationOutputBoundary
generationOutputBoundarySourceKind
generationOutputBoundaryStatus
generationOutputBoundaryReady
generationOutputBoundaryPath
generationOutputBoundaryEntryPath
generationOutputBoundaryRuntimeInputSourcePath
generationOutputBoundaryStandardContractPath
generationOutputBoundaryDeltasPath
generationOutputBoundaryValueSourceSlotsPath
generationOutputBoundaryContractValidationPath
generationOutputBoundaryStandardOutputCount
generationOutputBoundaryIssueCount
```

`threeValueRuntimeInput.generationReadSources` 新增：

```text
generationOutputBoundaryStatus
generationOutputBoundaryReady
generationOutputBoundaryReadyState
generationOutputBoundaryPath
generationOutputBoundaryEntryPath
generationOutputBoundaryRuntimeInputSourcePath
generationOutputBoundaryStandardContractPath
generationOutputBoundaryDeltasPath
generationOutputBoundaryValueSourceSlotsPath
generationOutputBoundaryContractValidationPath
generationOutputBoundaryStandardOutputCount
generationOutputBoundaryIssueCount
```

`threeValueRuntimeProjection.summary` / `runtimeOutputs.summary` 继续透出为：

```text
runtimeInputGenerationOutputBoundaryStatus
runtimeInputGenerationOutputBoundaryReady
runtimeInputGenerationOutputBoundaryPath
runtimeInputGenerationOutputBoundaryEntryPath
runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath
runtimeInputGenerationOutputBoundaryStandardContractPath
runtimeInputGenerationOutputBoundaryDeltasPath
runtimeInputGenerationOutputBoundaryValueSourceSlotsPath
runtimeInputGenerationOutputBoundaryContractValidationPath
runtimeInputGenerationOutputBoundaryStandardOutputCount
runtimeInputGenerationOutputBoundaryIssueCount
```

### 337.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只让生成层标准入口、runtime input 和 projection summary 可明确报告同一条 `generationOutputs.outputs.generationEntry -> runtimeInputSource -> standardContract/deltas/valueSourceSlots` 边界；三值计算结果、公式、倍率、applied delta 筛选、运行日志行、曲线数值和 UI 文案均不改变。

### 337.3 验证

- `threeValueGenerationBuilder.test.js` 覆盖 `standardOutputBoundary` ready 状态、标准 path、引用自检和 `outputBoundary` 别名。
- `actionHitThreeValueRuntimeInput.test.js` 覆盖 runtime input 从 `generationOutputs.standardOutputBoundary` 读取边界摘要，并继续确认不使用旧回退。
- `threeValueRuntimeProjection.test.js` 覆盖 runtime projection 保持标准 generation outputs 消费路径。
- `firstVerticalSliceSimulation.test.js` 覆盖真实纵切路径中 generation outputs、generation bundle summary 和 runtime summary 均透出标准输出边界。
- `npm run test -- --run src\__tests__\simulation\threeValueGenerationBuilder.test.js src\__tests__\simulation\actionHitThreeValueRuntimeInput.test.js src\__tests__\simulation\threeValueRuntimeProjection.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过，4 个测试文件、27 条测试。

## 338. 运行时与 Workbench 标准生成边界消费：Runtime Generation Boundary Consumption

### 338.1 字段变化

`runtimeOutputs.outputSummary` 现在直接透出 runtime projection summary 中的生成边界字段：

```text
runtimeInputGenerationOutputBoundaryStatus
runtimeInputGenerationOutputBoundaryReady
runtimeInputGenerationOutputBoundaryPath
runtimeInputGenerationOutputBoundaryEntryPath
runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath
runtimeInputGenerationOutputBoundaryStandardContractPath
runtimeInputGenerationOutputBoundaryDeltasPath
runtimeInputGenerationOutputBoundaryValueSourceSlotsPath
runtimeInputGenerationOutputBoundaryContractValidationPath
runtimeInputGenerationOutputBoundaryStandardOutputCount
runtimeInputGenerationOutputBoundaryIssueCount
```

`runtimeOutputContract.outputs.summary.countFields` 新增：

```text
runtimeInputGenerationOutputBoundaryStandardOutputCount
runtimeInputGenerationOutputBoundaryIssueCount
```

`runtimeOutputContract.outputs.summary.sourceFields` 新增：

```text
runtimeInputGenerationOutputBoundaryStatus
runtimeInputGenerationOutputBoundaryPath
runtimeInputGenerationOutputBoundaryEntryPath
runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath
runtimeInputGenerationOutputBoundaryStandardContractPath
runtimeInputGenerationOutputBoundaryDeltasPath
runtimeInputGenerationOutputBoundaryValueSourceSlotsPath
runtimeInputGenerationOutputBoundaryContractValidationPath
```

`createThreeValueRuntimeOutputConsumerContract().summary` 新增同名字段，用于 runtime output consumer view 的标准输出摘要。

`createWorkbenchFlowContractContext()` 的 `runtimeInput` 新增只读字段：

```text
generationOutputBoundaryStatus
generationOutputBoundaryReady
generationOutputBoundaryPath
generationOutputBoundaryEntryPath
generationOutputBoundaryRuntimeInputSourcePath
generationOutputBoundaryStandardContractPath
generationOutputBoundaryDeltasPath
generationOutputBoundaryValueSourceSlotsPath
generationOutputBoundaryContractValidationPath
generationOutputBoundaryStandardOutputCount
generationOutputBoundaryIssueCount
```

`createWorkbenchFlowContractContext()` 的 `runtimeOutput` 和 `runtimeContractBoundary` 新增同名只读字段。`runtimeContractBoundary.standardBoundaryReady` 在存在 generation output boundary 时会要求该 boundary ready；旧 runtime summary 没有该字段时仍按原兼容逻辑判断。

`createWorkbenchRuntimeOutputConsistencyView()` 新增：

```text
runtimeContractGenerationOutputBoundaryStatus
runtimeContractGenerationOutputBoundaryReady
runtimeContractGenerationOutputBoundaryReadyState
runtimeContractGenerationOutputBoundaryPath
runtimeContractGenerationOutputBoundaryEntryPath
runtimeContractGenerationOutputBoundaryRuntimeInputSourcePath
runtimeContractGenerationOutputBoundaryStandardContractPath
runtimeContractGenerationOutputBoundaryDeltasPath
runtimeContractGenerationOutputBoundaryValueSourceSlotsPath
runtimeContractGenerationOutputBoundaryContractValidationPath
runtimeContractGenerationOutputBoundaryStandardOutputCount
runtimeContractGenerationOutputBoundaryIssueCount
```

### 338.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只让 runtime output 与 Workbench contract context 消费上一阶段生成的标准输出边界摘要；三值计算结果、公式、倍率、applied delta 筛选、运行日志行、曲线数值和 UI 文案均不改变。

### 338.3 验证

- `workbenchFlowContractContext.test.js` 覆盖 runtime input、runtime output 和 Workbench runtime contract boundary 对 generation output boundary 的消费。
- `workbenchFlowModel.test.js` 覆盖 runtime output consistency view 继续透出 generation output boundary。
- `threeValueRuntimeProjection.test.js` 覆盖 runtime projection / runtime outputs 标准摘要仍可正常构建。
- `npm run test -- --run src\__tests__\features\workbenchFlowContractContext.test.js src\__tests__\features\workbenchFlowModel.test.js src\__tests__\simulation\threeValueRuntimeProjection.test.js`：通过，3 个测试文件、17 条测试。

## 339. 生成层标准入口边界：Generation Entry Boundary

### 339.1 字段变化

`generationEntry` 新增标准入口边界摘要：

```text
generationEntry.standardEntryBoundary
generationEntry.entryBoundary
```

其中 `entryBoundary` 是 `standardEntryBoundary` 的别名。边界对象用于固定 `Action -> Hit -> ThreeValueDelta` 标准入口本体的输入输出合同，核心字段包括：

```text
sourceKind = azpr-action-hit-three-value-delta-standard-generation-entry-boundary
status = standard-generation-entry-boundary-ready | standard-generation-entry-boundary-invalid
entryPath
generationInputPath
standardContractPath
actionsPath
hitsPath
deltasPath
valueSourceSlotsPath
runtimeInputSourcePath
contractValidationPath
aggregateValidationPath
standardOutputNames
standardOutputCount
checkCount
issueCount
issueKeys
checks
ready
```

`generationEntry.summary` 新增：

```text
entryBoundaryStatus
entryBoundaryReady
entryBoundaryIssueCount
```

`generationOutputs.summary` 新增：

```text
generationEntryBoundaryStatus
generationEntryBoundaryReady
generationEntryBoundaryIssueCount
```

`threeValueGenerationBundle.summary` 新增：

```text
standardGenerationEntryBoundaryStatus
standardGenerationEntryBoundaryReady
standardGenerationEntryBoundaryIssueCount
```

### 339.2 保存与迁移

不新增草稿字段，不改变 `workbench-draft:v1` schema，不需要数据迁移。

本阶段只让生成层标准入口本体可直接报告 `generationInput -> standardContract/actions/hits/deltas/valueSourceSlots -> runtimeInputSource -> contractValidation` 是否完整且引用一致；三值计算结果、公式、倍率、applied delta 筛选、运行日志行、曲线数值和 UI 文案均不改变。

### 339.3 验证

- `threeValueGenerationBuilder.test.js` 覆盖 `standardEntryBoundary` ready 状态、标准 path、引用自检和 `entryBoundary` 别名。
- `threeValueGenerationBuilder.test.js` 覆盖 bundle summary、generation entry summary 和 generation outputs summary 均透出标准入口边界状态。
- `npm run test -- src/__tests__/simulation/threeValueGenerationBuilder.test.js src/__tests__/simulation/actionHitThreeValueDeltaGeneration.test.js src/__tests__/simulation/actionHitThreeValueRuntimeInput.test.js src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，5 个测试文件、28 条测试。
- `npx prettier --check src/simulation/generation/threeValueGenerationBuilder.js src/__tests__/simulation/threeValueGenerationBuilder.test.js PROJECT_MANUAL.md`：通过。

## 340. Workbench JSON 项目文件：Workbench Project File

### 340.1 字段变化

`src/domain/workbenchDraftStorage.js` 新增 Workbench 项目文件导出/导入 helper：

```text
WORKBENCH_PROJECT_FILE_TYPE = workbench-project
WORKBENCH_PROJECT_FILE_EXTENSION = promilia-workbench.json
createWorkbenchProjectFileSnapshot()
serializeWorkbenchProjectFile()
parseWorkbenchProjectFile()
createWorkbenchProjectFileName()
```

Workbench JSON 项目文件复用 `workbench-draft:v1` 的主体结构：

```text
schemaVersion = 1
game = azur-promilia
type = workbench-project
exportedAt
savedAt
selection
enemyConfig
segmentSplitOptions
actionDrafts
selectedActionId
```

导入时会把 `workbench-project` 规范化为现有 `workbench-draft` 快照；同时兼容导入旧的 `type = workbench-draft` 文件。

### 340.2 保存与迁移

不改变 `workbench-draft:v1` localStorage schema，不需要迁移现有草稿。

Workbench 导入 JSON 后会复用 `saveWorkbenchDraft()` 写回当前草稿，以保证导入后刷新页面仍能恢复同一项目。

### 340.3 验证

- `workbenchDraftStorage.test.js` 覆盖 `workbench-project` 文件序列化、导入为 draft、旧 `workbench-draft` 文件兼容和文件名生成。
- `workbench-continuous-edit.spec.js` 覆盖真实浏览器导出 JSON、重置、从文件导入、恢复敌人配置/动作轴/当前选中动作，并重新运行模拟。

## 341. Workbench 项目分享码：Workbench Project Share Code

### 341.1 字段变化

`src/domain/workbenchDraftStorage.js` 新增 Workbench 项目分享 helper：

```text
WORKBENCH_PROJECT_SHARE_PARAM = workbenchProject
createWorkbenchProjectShareCode()
parseWorkbenchProjectShareCode()
```

分享码内容为 `workbench-project` JSON 文件快照的 base64url 编码结果，不新增独立项目
schema。

Workbench 分享 URL 使用 hash route query：

```text
#/workbench?workbenchProject=<base64url workbench-project snapshot>
```

### 341.2 保存与迁移

不改变 `workbench-draft:v1` localStorage schema，不需要迁移现有草稿。

打开分享链接后会把分享码解析为 `workbench-draft` 快照，并复用
`saveWorkbenchDraft()` 写回当前草稿；URL 中的 `workbenchProject` 参数会在成功导入后移除。

### 341.3 验证

- `workbenchDraftStorage.test.js` 覆盖分享码 round-trip 和非法分享码拒绝。
- `workbench-continuous-edit.spec.js` 覆盖真实浏览器生成分享链接、重置、从 URL 恢复项目并重新运行模拟。

## 342. Workbench v2 参战角色配置：Actor Config And Loadout

### 342.1 草稿字段

`workbench-draft` / `workbench-project` 从 `schemaVersion = 1` 升级为 `schemaVersion = 2`，新增：

```text
actorConfigs[]
  characterId
  level
  loadout
    kiboId
    equipment.weapon
    equipment.top
    equipment.bottom
    equipment.earring
    equipment.ring
    soulessenceId
```

`actorConfigs` 始终按当前主角色、次角色规范化为两个配置项。培养项 ID 来自本地生成的 `kibos.json`、`equipment.json` 和 `soulessences.json`；装备 ID 同时校验槽位类型。

### 342.2 项目与运行时边界

`createWorkbenchProject()` 把 `actorConfigs` 投影到 `actors[].level`、`actors[].loadout` 和 `project.loadouts`。编译后的 scenario 保留这些字段，但当前三值 calculator 不读取培养项；项目 metadata 使用 `loadoutCalculationStatus = project-config-only` 固定该边界。

角色、敌人和角色数值面板继续参与当前模拟。奇波、装备和魂灵当前属于可保存、可分享、可追溯的项目配置，不改变现有 HP、韧性和自身能量结果。

### 342.3 迁移

- 当前 localStorage key 为 `promilia-axis-tool:workbench-draft:v2`。
- 读取仍兼容 `promilia-axis-tool:workbench-draft:v1`、v1 JSON 项目和 v1 分享快照；缺少 `actorConfigs` 时按当前两名角色补空 loadout。
- 重置草稿会同时清理 v2 和旧 v1 key。

### 342.4 验证

- `workbenchProjectFactory.test.js` 覆盖真实 AzPr 培养项投影、双角色规范化和装备槽位错误。
- `workbenchDraftStorage.test.js` 覆盖 v2 round-trip、v1 文件/本地草稿迁移和双 key 清理。
- `Workbench.test.js` 与 Workbench E2E 覆盖培养配置保存、导出、重置和导入恢复。

## 343. Workbench v3 敌人韧性基线：Enemy Toughness Baseline

### 343.1 数据源与项目字段

Workbench 敌人访问层从早期 `workbench-seed.json` 裁剪列表切到完整 `enemies.json` 生成表。当前生成表 208 个敌人中，198 个存在有效 `WEAKNESS_POINT_MAX`，其余敌人保持缺失状态。

`createEnemyFromData()` 新增项目配置字段：

```text
enemy.toughnessMultiplier
enemy.initialToughnessRatio
```

编译后的 scenario 新增：

```text
enemy.stats.maxToughness
enemy.stats.initialToughness
enemy.toughness
  sourceKind = azpr-enemy-WEAKNESS_POINT_MAX
  sourceStatus
  sourcePath
  baseMax
  maxMultiplier
  initialRatio
  maxValue
  initialValue
  applied
```

计算关系仅用于状态基线：

```text
maxToughness = WEAKNESS_POINT_MAX * toughnessMultiplier
initialToughness = maxToughness * initialToughnessRatio
remainingToughness = max(0, initialToughness - appliedToughnessDelta)
```

这不确认或改变 `appliedToughnessDelta` 的生成公式。

### 343.2 草稿迁移

`workbench-draft` / `workbench-project` 升级为 `schemaVersion = 3`，`enemyConfig` 新增：

```text
toughnessMultiplier
initialToughnessRatio
```

- 当前 localStorage key 为 `promilia-axis-tool:workbench-draft:v3`。
- 读取兼容 v1、v2 本地草稿、JSON 项目和分享快照；旧快照缺少字段时迁移为 `1` 和 `1`。
- 重置草稿同时清理 v3、v2 和 v1 key。

### 343.3 运行时状态

有真实表值时，韧性 baseline status 为 `baseline-derived-from-scenario-enemy-WEAKNESS_POINT_MAX`，runtime state metric 输出 `initialValue`、`maxValue`、`currentValue` 和 `remainingValue`。缺少表值时使用 `baseline-pending-missing-WEAKNESS_POINT_MAX`，状态值保持 `null`。

### 343.4 验证

- `workbenchProjectFactory.test.js` 覆盖真实表值与项目配置编译。
- `threeValueRuntimeProjection.test.js` 覆盖韧性 delta 扣减后的剩余状态。
- `workbenchDraftStorage.test.js` 覆盖 v1/v2 到 v3 迁移。
- `Workbench.test.js` 与 Workbench E2E 覆盖用户编辑、保存、导出、重置和导入恢复。

## 344. Workbench v4 敌人元素伤害减免配置：Enemy Element Defense Config

### 344.1 数据源与映射

Workbench 元素访问层切到完整 `elements.json` 生成表。敌人 `baseAttributes` 中以下 10 项按元素 ID 映射：

```text
0  NORMAL_DEFENSE
1  FIRE_DEFENSE
2  WIND_DEFENSE
3  EARTH_DEFENSE
4  WOOD_DEFENSE
5  ICE_DEFENSE
6  WATER_DEFENSE
7  ELEC_DEFENSE
8  LIGHT_DEFENSE
9  DARK_DEFENSE
```

当前 `enemies.json` 的 208 个敌人中，198 个具有完整字段，10 个缺失；当前可见实际表值均为 `0`。字段标记为 `isRatio`，Workbench 以百分比编辑，项目内部继续保存原始比例值。

### 344.2 项目与编译结构

`enemyConfig` 和项目敌人新增：

```text
elementDefenseOverrides
  [attributeKey]: ratioValue
```

未覆盖的 key 不写入对象。编译后的 scenario 新增：

```text
enemy.elementDefenses[]
  elementId
  elementName
  elementAbbrName
  color
  attributeId
  attributeKey
  attributeName
  isRatio
  baseValue
  overrideValue
  effectiveValue
  sourceStatus
  appliedToDamage = false

enemy.elementDefenseConfig
  sourceKind = azpr-enemy-element-defense-base-attributes
  sourceStatus
  sourcePath
  overrideCount
  formulaStatus = project-config-only
  appliedToDamage = false
```

`effectiveValue = overrideValue ?? baseValue`。当前 damage calculator 不读取 `effectiveValue`；元素绑定、抗性公式和计算顺序留给 P3 adapter，P2-C 不改变三值结果。

### 344.3 草稿迁移

`workbench-draft` / `workbench-project` 升级为 `schemaVersion = 4`：

- 当前 localStorage key 为 `promilia-axis-tool:workbench-draft:v4`。
- 读取兼容 v1、v2、v3 本地草稿、JSON 项目和分享快照；缺少字段时迁移为空对象。
- 重置草稿同时清理 v4、v3、v2 和 v1 key。

### 344.4 验证

- `projectSchema.test.js` 覆盖非法 key 和非有限值拒绝。
- `workbenchProjectFactory.test.js` 覆盖实际表值、项目覆盖值、有效值和公式未应用边界。
- `workbenchDraftStorage.test.js` 覆盖 v3 到 v4 迁移以及 JSON/分享 round-trip。
- `Workbench.test.js` 与 Workbench E2E 覆盖显示、编辑、保存、导出、重置和导入恢复。

## 345. Workbench v5 项目队伍槽位：Project Team Slots

### 345.1 草稿与项目字段

`workbench-draft` / `workbench-project` 升级为 `schemaVersion = 5`，新增：

```text
teamSlots[]
  slotId
  position
  characterId
```

当前固定提供两个稳定槽位：

```text
team-slot-1 / position 0
team-slot-2 / position 1
```

`selection.characterId` 和 `selection.secondaryCharacterId` 继续输出，作为旧 Workbench 代码与 v1-v4 快照的兼容镜像；v5 规范化时由 `teamSlots` 决定这两个值，不再把 selection 作为队伍事实标准。

内部项目新增：

```text
project.team.slots[]
  slotId
  position
  characterId
```

编译场景新增：

```text
scenario.team.slots[]
  slotId
  position
  characterId
  actorId
  actorName
```

项目校验要求槽位 ID 唯一、角色 ID 唯一、每个槽位角色存在对应 actor，并且槽位数与 actor 数一致。

### 345.2 编辑行为

- 槽位替换：该槽位原角色的技能、资源和切换动作改绑到新角色，并按新角色技能表规范化；旧角色培养配置不会错误转移给新角色。
- 槽位互换：选择另一槽位当前角色时交换两个槽位；动作按槽位同步互换角色归属，角色培养配置继续跟随角色本身。
- 槽位变化进入 Workbench 撤销/重做历史，并随草稿、JSON 项目和分享链接持久化。

### 345.3 迁移

- 当前 localStorage key 为 `promilia-axis-tool:workbench-draft:v5`。
- v1-v4 快照缺少 `teamSlots` 时，从兼容 selection 的两个角色 ID 生成稳定槽位。
- 重置草稿同时清理 v5、v4、v3、v2 和 v1 key。

### 345.4 验证

- `projectSchema.test.js` 覆盖槽位角色缺少对应 actor 的拒绝路径。
- `workbenchProjectFactory.test.js` 覆盖槽位唯一化、项目 team 与编译场景 team 投影。
- `workbenchDraftStorage.test.js` 覆盖 v4 到 v5 迁移以及 JSON/分享 round-trip。
- `Workbench.test.js` 覆盖槽位互换、动作重绑定和草稿保存。
- Workbench E2E 覆盖替换队员、导出、重置、导入恢复和重新运行模拟。

## 346. 标准三值机制上下文：AzPrThreeValueMechanismContext

### 346.1 合同结构

`ThreeValueDelta` 与 calculator result 新增同一份 `mechanismContext`：

```text
mechanismContext
  schemaVersion = 1
  contractName = AzPrThreeValueMechanismContext
  sourceKind
  status
  ready
  formulaStatus
  action
    actionId
    actionType
    skillId
    actorId
    targetId
  hit
    hitKey
    hitIndex
    hitSkillId
    frameIndex
    timeMs
    elementConfigIds[]
  timing
    source
    needsTimingData
    accuracy
    animationTimeMs
    pointFrameSource
  sourceActor
    actorId
    characterId
    teamSlotId
    teamPosition
    level
    stats
    statsSource
    energy
  targetEnemy
    targetId
    enemyId
    level
    stats
    toughness
    elementDefenses[]
    elementDefenseFormulaStatus
  ownership
    valueTargetKind
    valueTargetId
    energyOwnerActorId
    targetEnemyId
  sourcePaths
```

`sourceActor.stats` 只投影 calculator 需要的角色面板字段；`targetEnemy.stats`、`toughness` 和 `elementDefenses` 来自编译后的 scenario。角色当前/初始 SP 在 P3-A 保持 `null`，状态为 `initial-current-sp-baseline-pending`，由后续运行时状态阶段补齐。

### 346.2 生成与运行时传递

- 标准生成合同与 calculator 合同升级为 v2。
- generation layer 为每个 delta 创建机制上下文，并把同一对象传给 calculator adapter。
- generation builder 新增 `delta-mechanism-context-contract` 校验，要求合同名正确，且 delta 与 calculator 引用同一上下文对象。
- runtime input 和 runtime projection 原样携带上下文，并在 summary 统计 ready/missing 数量与状态。
- 缺少来源角色或目标敌人时输出缺失状态，不伪造机制输入。

### 346.3 计算边界

本结构只统一公式输入来源、作用对象与时序元数据。P3-A 不改变现有 HP、韧性、自身能量 delta，也不应用敌人元素减免或未确认的防御公式；calculator 继续标记为可替换。

### 346.4 验证

- generation layer 测试覆盖完整/缺失机制上下文与合同 v2 摘要。
- first vertical slice 测试覆盖角色面板、敌人防御、元素减免、韧性基线和三值所有权。
- runtime input/projection 测试覆盖上下文从 generation 到 runtime 的无损传递。
- generation builder 校验保证 calculator 不使用另一份复制或临时上下文。

## 347. 运行时三值状态快照：AzPrThreeValueRuntimeStateSnapshot

### 347.1 快照结构

每个 runtime applied delta 生成一个状态快照：

```text
stateSnapshot
  schemaVersion = 1
  contractName = AzPrThreeValueRuntimeStateSnapshot
  sourceDeltaId
  runtimeSequenceIndex
  actionId
  hitKey
  frameIndex
  timeMs
  trackKey
  primaryMetricKey
  changedMetricKeys[]
  energyOwnerActorId
  targetEnemyId
  mechanismContextStatus
  baselineConfirmed
  before
    enemyHp
    enemyToughness
    selfEnergy
  delta
    enemyHp
    enemyToughness
    selfEnergy
  after
    enemyHp
    enemyToughness
    selfEnergy
```

`before` / `after` 的每项状态包含：

```text
actorId
initialValue
maxValue
currentValue
rawCurrentValue
cumulativeDelta
overrunValue
baselineConfirmed
baselineStatus
```

HP 与韧性按 decrease 方向推进并在 `currentValue` 下限裁剪到 `0`，`rawCurrentValue` / `overrunValue` 保留溢出信息；SP 按 increase 方向推进。该方向只描述已有 delta 如何作用于状态，不改变 delta 的生成公式。

### 347.2 baseline 与所有权

- 敌人 HP baseline 继续来自 `scenario.enemy.stats.maxHp * hpMultiplier`。
- 敌人韧性 baseline 继续来自 `scenario.enemy.stats.initialToughness` 与 P2-B 韧性配置。
- 每个角色建立独立 SP state；初始值读取 scenario actor 已有的 `initialSp` / `initialEnergy` / resource state，最大值读取 `MAXSP`。
- 能量所有者优先读取 `mechanismContext.ownership.energyOwnerActorId`，再兼容旧 delta 的 `actorId`。
- 初始 SP 缺失时，绝对 `currentValue` 保持 `null`，但 `cumulativeDelta` 继续累计，状态为 pending。

### 347.3 runtime 输出关系

```text
runtimeProjection.runtimeStateSnapshots
runtimeOutputs.stateSnapshots
stateCurves.snapshots
```

以上三处引用同一快照集合；`runtimeOutputs.stateSnapshots` 是 `stateCurves.snapshots` 的别名，不增加 canonical runtime output 数量。每条 sim log、敌人曲线点和角色资源曲线点的 `stateSnapshot` 都引用对应 `sourceDeltaId` 的同一对象。

summary 新增：

```text
stateSnapshotCount
stateSnapshotReadyCount
stateSnapshotPendingBaselineCount
```

输出一致性检查会验证日志和曲线没有复制、错配或遗漏快照。

### 347.4 验证

- runtime projection 测试覆盖敌人 HP/韧性逐条推进、两名角色 SP 独立累计与最终 summary。
- pending SP baseline 测试覆盖 `currentValue = null` 时仍保留累计 delta。
- output consistency 测试覆盖 sim log、敌人曲线和资源曲线共享同一快照引用。
- Workbench 全量单元测试、构建和浏览器主流程保持通过，现有三值结果不变。

## 348. 运行时 calculator 调用：ThreeValueRuntimeCalculatorInvocation

### 348.1 调用合同

每个 runtime applied delta 在状态推进前新增一次调用：

```text
runtimeCalculatorInvocation
  schemaVersion = 1
  contractName = ThreeValueRuntimeCalculatorInvocation
  status
  sourceDeltaId
  trackKey
  outputField
  adapter
    key
    version
    sourceKind
    custom
    replaceable
  input
    sourceDeltaId
    trackKey
    outputField
    generatedDelta
      delta
      hpDelta
      toughnessDelta
      energyDelta
    mechanismContext
    stateBefore
    sourceCalculatorResult
    sourceDelta
  output
    delta
    hpDelta
    toughnessDelta
    energyDelta
    status
    sourceKind
    sourceCalculationStatus
    fallbackReason
  validation
  changed
  preservesGeneratedDelta
  fallbackReason
```

`input.mechanismContext` 与 generation delta 的 P3-A 上下文保持同一引用；`input.stateBefore` 与对应 P3-B snapshot 的 `before` 保持同一引用。adapter 因此可以在不读取 UI 的情况下获得来源、目标和当前运行时状态。

### 348.2 默认与替换行为

- 默认 adapter 按 track 使用透传模式，output 与 generation delta 相同。
- `createThreeValueRuntimeProjection` 可通过 `runtimeCalculatorAdapters[trackKey]` 注入函数或带 `calculate` 的 adapter 定义。
- adapter 只能替换当前 track 对应的 delta 字段；generation input 保持不变。
- 非有限输出或 adapter 异常会回退到 generation delta，并记录 `runtime-calculator-invocation-ready-with-fallback`。

runtime 新增：

```text
runtimeProjection.runtimeAppliedDeltas[]
  runtimeCalculatorInvocation
  runtimeCalculatorAdapterKey
  runtimeCalculatorInvocationStatus
  runtimeCalculationChanged
```

### 348.3 输出传递与摘要

同一 invocation 引用进入：

```text
stateSnapshot.runtimeCalculatorInvocation
simLog[].runtimeCalculatorInvocation
enemyStateCurve.points[].runtimeCalculatorInvocation
resourceCurves.curvesByActor[].points[].runtimeCalculatorInvocation
```

summary 新增 invocation 总数、透传数、替换数、fallback 数、自定义 adapter 调用数、adapter keys 和状态集合。output consistency 验证日志、曲线点与快照没有复制或错配 invocation。

### 348.4 计算边界

P3-C 只建立 runtime 公式调用和替换边界。默认 adapter 不改变 HP、韧性或自身能量值；测试 adapter 仅用于证明状态感知替换能力，不进入生产默认配置。

### 348.5 验证

- 独立 invocation 测试覆盖默认透传、非法输出回退和异常回退。
- runtime projection 测试覆盖自定义 HP adapter 读取敌人变更前 HP、替换 runtime delta 并保持 generation delta 不变。
- 日志、状态曲线、资源曲线和 summary 测试覆盖 invocation 引用与数量一致性。

## 349. Workbench v6 角色初始 SP：Actor Initial SP

### 349.1 项目字段

Workbench actor config 新增可空字段：

```text
actorConfigs[]
  characterId
  level
  initialSp = number | null
  loadout
```

该值投影到：

```text
project.actors[].initialSp
scenario.actors[].initialSp
mechanismContext.sourceActor.energy.initialValue
runtimeStateSnapshots.baseline.selfEnergyByActor[].baseline.initialValue
```

`initialSp = null` 表示项目没有确认初始 SP；系统不会自动写入 `0`。有限数值按角色 `baseAttributes[MAXSP]` 限制在 `0..MAXSP`，project schema 同时拒绝绕过 Workbench 规范化写入的非法值。

### 349.2 机制上下文与 runtime

已配置时，P3-A energy context 输出：

```text
initialValue = actor.initialSp
currentValue = null
status = initial-sp-project-configured-runtime-current-pending
```

`currentValue` 不在 generation context 中冒充运行时状态；实际逐命中当前值继续来自 P3-B `stateSnapshot.before/after.selfEnergy`。runtime baseline 状态为 `baseline-derived-from-scenario-actor-self-energy`，并按角色独立推进。

### 349.3 Workbench 与持久化

- `TeamLoadoutPanel` 为每个参战角色提供初始 SP 数值输入，使用 scenario actor 的 `stats.maxSp` 作为上限。
- 修改进入 Workbench 历史，可撤销/重做。
- `workbench-draft` / `workbench-project` 升级为 `schemaVersion = 6`。
- 当前 localStorage key 为 `promilia-axis-tool:workbench-draft:v6`。
- v1-v5 草稿、JSON 项目和分享快照缺少 `initialSp` 时迁移为 `null`。
- 重置草稿同时清理 v6 以及 v1-v5 storage keys。

### 349.4 验证

- project factory 测试覆盖两名角色独立初始 SP 进入 project、scenario、机制上下文和 runtime baseline。
- project schema 测试覆盖 `MAXSP` 越界拒绝。
- draft storage 测试覆盖 v5 到 v6 迁移、JSON 与分享 round-trip。
- Workbench 单元测试覆盖输入约束、撤销/重做、保存、恢复和重置。
- Workbench E2E 覆盖真实浏览器编辑、JSON 导出、重置、导入恢复和继续模拟。

## 350. RuntimeSelectedDetail 三值状态投影

### 350.1 详情来源

Workbench 选中曲线点或日志行后，`createRuntimeSelectedDetail` 直接读取该结果点共享的 `stateSnapshot`，不再从累计曲线临时推导完整三值状态。详情新增：

```text
RuntimeSelectedDetail
  stateSnapshot
  threeValueStateRows[]
    key = enemyHp | enemyToughness | selfEnergy
    label
    unit
    actorId
    actorName
    beforeValue
    rawDelta
    delta
    afterValue
    initialValue
    maxValue
    baselineConfirmed
    baselineStatus
    primary
    changed
```

### 350.2 显示语义

- `rawDelta` 保留 runtime 合同中的原始应用值。
- `delta` 是状态变化方向：HP 与韧性用 `after - before` 显示为减少，自身能量保留实际增减方向。
- baseline 已确认时优先由 snapshot 的 `before.currentValue` / `after.currentValue` 得到变化；baseline 未确认时按该状态既有的 increase/decrease 方向投影，不把空值转为 `0`。
- 自身能量行通过 `energyOwnerActorId` 和 runtime 角色资源行解析所属角色名称。

本节只新增 Workbench 详情 view model；`AzPrThreeValueRuntimeStateSnapshot`、逐 delta 结果、曲线和计算公式均未改变。

## 351. 运行时命中事务：AzPrThreeValueRuntimeHitTransaction

### 351.1 命中级合同

runtime 新增版本化命中事务：

```text
AzPrThreeValueRuntimeHitTransaction
  schemaVersion = 1
  transactionId
  actionId / actionName / actionType
  actorId / actorName
  hitKey / hitIndex
  frameIndex / frameLabel / timeMs
  runtimeSequenceStart / runtimeSequenceEnd
  sourceDeltaIds[]
  trackKeys[]
  affectedMetricKeys[]
  changedMetricKeys[]
  energyOwnerActorId / energyOwnerActorIds[]
  targetEnemyId / targetEnemyIds[]
  before
  delta
    enemyHp
    enemyToughness
    selfEnergy
  stateChange
    enemyHp
    enemyToughness
    selfEnergy
  after
  baselineConfirmed
  baselineConfirmedByMetric
  stateSnapshots[]
  runtimeCalculatorInvocations[]
  actionThreeValueDeltaAggregate
  hitThreeValueDeltaAggregate
  validation
```

事务身份由 `actionId + hitKey + frameIndex + timeMs` 构成。同一事务按 `runtimeSequenceIndex` 排序，`before` 引用首条快照的变更前状态，`after` 引用末条快照的变更后状态；`delta` 保留 runtime 原始应用值，`stateChange` 表示状态实际增减方向。

### 351.2 输出与共享引用

```text
runtimeProjection.hitTransactions
runtimeOutputs.hitTransactions
runtimeOutputs.outputs.hitTransactions
outputContract.outputs.hitTransactions
runtime output consumer view.hitTransactions
```

以上命中事务集合共享同一对象。每条 `simLog[]`、敌人曲线点和角色资源曲线点新增 `hitTransaction`，按 `sourceDeltaId` 引用所属事务；事务内 `stateSnapshots[]` 继续引用 P3-B 的 canonical snapshot。

runtime output contract 与 runtime outputs 升级为 `schemaVersion = 2`，标准输出名变为：

```text
simLog
hitTransactions
stateCurves
resourceCurves
summary
```

consumer 根据 output contract 的 `outputNames` 识别 v1 四输出或 v2 五输出；旧 runtime projection 不需要伪造空事务即可继续读取。

### 351.3 完整性校验

`runtimeOutputs.outputConsistency.checks` 新增：

```text
summaryHitTransactionCount
outputContractSummaryHitTransactionCount
hitTransactionSourceDeltasComplete
simLogHitTransactionsShared
stateCurveHitTransactionsShared
hitTransactionStateSnapshotsShared
hitTransactionDeltaTotalsMatch
```

事务自身校验 delta 是否连续、快照数量是否匹配、能量所有者和目标敌人是否唯一。校验异常只改变 transaction status，不改写已有 delta、快照、日志或曲线数值。

## 352. Workbench 命中级复盘投影

### 352.1 RuntimeHitReviewRow

Workbench 新增从 P3-E transaction 到日志交互行的派生模型：

```text
RuntimeHitReviewRow
  eventType = THREE_VALUE_HIT_TRANSACTION_APPLIED
  reviewUnit = hit-transaction
  transactionId
  sourceDeltaId
  sourceDeltaIds[]
  statePointId
  statePointIds[]
  actionId / actionName / actionType
  actorId / actorName
  energyOwnerActorId
  targetEnemyId
  hitKey / hitIndex
  frameIndex / frameLabel / timeMs
  trackKey = hitTransaction
  trackKeys[]
  deltaCount
  delta
  stateChange
  hpDelta / toughnessDelta / energyDelta
  hitTransaction
  anchorRow
  anchorPoint
```

`statePointId` 使用事务首条 delta 作为默认选择锚点；当曲线或明细日志已选择事务内其他 delta 时，命中行使用 `statePointIds[]` 保留该状态点，不把选择强制跳回首条 delta。

### 352.2 日志复盘模式

EventLog 新增两个非持久化显示模式：

```text
hit   -> runtimeHitReviewRows
delta -> runtimeStatePointContexts[].row
```

命中模式按 `trackKeys[]` 参与 HP、韧性、能量筛选；明细模式继续按单条 `trackKey` 筛选。模式切换不改变 runtime output、project schema、草稿或选择合同。

### 352.3 RuntimeSelectedDetail 事务字段

详情新增：

```text
reviewUnit = hit-transaction | delta
reviewStatus
hitTransaction
transactionId
transactionDeltaCount
sourceDeltaIds[]
transactionDelta
transactionStateChange
```

存在 `hitTransaction` 时，`threeValueStateRows[]` 使用事务的 `before / delta / stateChange / after`；`status` 继续保留原 delta 的 calculator/result 诊断，`reviewStatus` 单独记录事务状态。旧 projection 没有 transaction 时仍回退到 P3-B 单快照详情。

## 353. 标准状态效果运行时合同

### 353.1 项目动作 effectCommands

项目 action 新增可选字段；空数组不会写入 action，因此旧项目结构保持不变：

```text
action.effectCommands[]
  id
  effectId
  effectName
  operation = apply | refresh | remove
  targetKind = actor | enemy
  targetId = string | null
  offsetMs
  durationMs = number | null
  stackMode = refresh | stack | replace
  stackDelta
  maxStacks
  tags[]
  sourceStatus
  modifiers[]
  appliedToCalculators = false
```

`targetId = null` 时，编译器按 `targetKind` 使用动作来源角色或动作目标敌人。编译后 command 新增来源动作/角色、目标名称、绝对 `timeMs` 和 `commandIndex`。

项目 schema 仍为 v1；该字段为向后兼容的可选扩展。校验器检查 effect/command 身份、目标、操作、时序、叠层和 modifiers，并拒绝 `appliedToCalculators = true`。

### 353.2 ActionEffectRuntimeInput

```text
ActionEffectRuntimeInput
  schemaVersion = 1
  contractName = AzPrActionEffectCommand
  commands[]
    commandId
    sourceActionId / sourceActionName
    sourceActorId / sourceActorName
    effectId / effectName
    operation
    targetKind / targetId / targetName
    instanceKey
    timeMs / frameIndex
    durationMs
    stackMode / stackDelta / maxStacks
    tags[] / modifiers[]
    appliedToCalculators = false
  validation
  summary
```

效果实例身份为 `targetKind + targetId + effectId`。输入按绝对时间、动作顺序和 command 顺序稳定排序；非法 command 留在 validation issues，不进入状态推进。

### 353.3 EffectRuntimeTimeline

```text
EffectRuntimeTimeline
  schemaVersion = 1
  contractName = AzPrEffectRuntimeTimeline
  input
  events[]
    eventId
    type = EFFECT_APPLIED | EFFECT_REFRESHED | EFFECT_REMOVED | EFFECT_EXPIRED
    timeMs / frameIndex / runtimeSequenceIndex
    actionId / actorId
    targetKind / targetId
    effectId / effectName / instanceKey
    stackBefore / stackAfter / stackChange
    before / after
    ownership
    modifiers[]
    appliedToCalculators = false
  activeEffects[]
  summary
```

刷新可以续时，`stack` 按 `maxStacks` 累加，`replace` 重置层数，`refresh` 保留层数。到期事件在同一时刻的新 command 之前结算；永久效果 `expiresAtMs = null`，场景结束后仍保留在 `activeEffects[]`。

### 353.4 runtime output v3

runtime output contract 升级为 `schemaVersion = 3`，标准输出为：

```text
simLog
hitTransactions
effectTimeline
stateCurves
resourceCurves
summary
```

新增 summary 字段：`effectCommandCount`、`effectEventCount`、各事件类型数量、`activeEffectCount`、`peakActiveEffectCount` 和 `effectCalculatorAppliedCount`。output consistency 校验 timeline 事件/active 数量与 summary、contract 一致，并确保全部 effect event 未接入 calculator。

## 354. Workbench 状态效果配置与复盘

### 354.1 WorkbenchEffectCommandDraft

`actionDrafts[]` 新增持久化字段：

```text
actionDraft.effectCommands[]
  id
  effectId / effectName
  operation
  targetKind / targetId
  offsetMs / durationMs
  stackMode / stackDelta / maxStacks
  tags[] / modifiers[]
  sourceStatus
  appliedToCalculators = false
```

Workbench 规范化层补齐稳定 command ID、非空 effect ID/名称、合法操作/目标/叠层枚举和 calculator 隔离字段。生成 project action 时，敌人目标统一解析为当前 enemy instance；角色目标不存在于当前队伍时回退到动作来源角色。

### 354.2 Workbench 草稿 v7

```text
WORKBENCH_DRAFT_SCHEMA_VERSION = 7
WORKBENCH_DRAFT_STORAGE_KEY = promilia-axis-tool:workbench-draft:v7
```

v7 将 `actionDraft.effectCommands[]` 纳入草稿快照，因此本地保存、撤销/重做、JSON 项目和 URL 分享使用同一份效果配置。`v1-v6` 存储键与项目文件继续通过现有规范化入口迁移；旧动作缺少该字段时规范化为 `effectCommands = []`。

### 354.3 RuntimeEffectReview

Workbench 从标准 `EffectRuntimeTimeline` 派生只读复盘模型：

```text
RuntimeEffectReview
  status
  reviewTimeMs
  selectedEventId
  selectedEvent
  events[]
  activeEffects[]
  summary
    eventCount
    activeEffectCount
    reviewEventIndex
    followsRuntimeStatePoint
    appliedToCalculators = false
```

复盘器按 `runtimeSequenceIndex` 重放事件：`event.after` 写入 active map，移除/到期事件删除实例。用户选择效果事件时返回该事件后的状态；选择三值状态点时包含该时间点及以前的全部效果事件。效果复盘选择仅为组件本地视图状态，不写入项目、草稿或 runtime output。

## 355. 统一排轴规则诊断合同

### 355.1 ActionRuleDiagnostics

模拟引擎在处理动作事件前建立独立规则结果：

```text
ActionRuleDiagnostics
  schemaVersion = 1
  contractName = AzPrActionRuleDiagnostics
  sourceKind = azpr-scenario-action-rule-diagnostics
  status
  executable
  diagnostics[]
  summary
  appliedToSimulationResults = false
```

`projectSimulationResult` 新增顶层 `actionRuleDiagnostics`，并把同一对象暴露为 `diagnostics.actionRules`；`summary.actionRuleDiagnosticsSummary` 引用其 summary。规则结果不进入三值 canonical runtime outputs，也不改变 event、delta、curve 或 calculator 数值。

### 355.2 ActionRuleDiagnostic

```text
ActionRuleDiagnostic
  id
  code
  ruleKey
  status = violated | unresolved
  severity = error | warning
  actionId / actionIds[] / actionName
  actorId / actorName
  blockingActionId / blockingActionName
  timeMs
  message
  suggestedStartMs = number | null
  editFieldKey
  source
  appliedToSimulationResults = false
```

当前规则代码：

```text
action-lane-overlap
skill-cooldown-active
skill-sp-precondition-unresolved
```

`action-lane-overlap` 只检查有角色所有权且会占用动作时间的 `skill / switch`。`skill-cooldown-active` 使用 `action.logicModel.logic.cooldownMs / cooldownCount` 和对应 `skillsub_logic` field path，以可用次数和按时间排序的 recharge queue 推进技能状态；可用次数耗尽时使用最早恢复项生成 `readyAtMs`，违反冷却的动作不进入队列。`skill-sp-precondition-unresolved` 保留原始 `spCost`、角色 `initialSp / maxSp` 和单位缺口，不生成资源不足错误。

### 355.3 Workbench 规则修正入口

Workbench 新增只读 `ActionRuleDiagnosticsPanel`，以 `actionId` 关联动作选择，以 `editFieldKey` 定位属性编辑控件。存在 `suggestedStartMs` 时，面板通过现有 `updateAction({ startMs })` 入口应用修正，因此撤销/重做、草稿脏状态和运行结果同步沿用既有主流程，不引入第二套动作修改协议。

动作库的冷却/SP 展示优先读取 `action.logicModel.logic`，冷却同时显示可用次数；模拟事件 `COOLDOWN_START` 同样优先使用逻辑层冷却。SP 消耗事件仍保持原有应用边界，直到资源单位 adapter 可确认换算关系。

## 356. 动作可执行状态与冷却窗口合同

### 356.1 AzPrActionReadinessTimeline

`ActionRuleDiagnostics` 新增 `readinessTimeline`，`projectSimulationResult` 同时暴露顶层 `actionReadinessTimeline` 和对应 summary：

```text
ActionReadinessTimeline
  schemaVersion = 1
  contractName = AzPrActionReadinessTimeline
  sourceKind = azpr-action-readiness-timeline
  status
  actions[]
  cooldownWindows[]
  summary
  appliedToSimulationResults = false
```

逐动作状态行结构为：

```text
ActionReadinessState
  sourceKind = azpr-action-readiness-state
  status = ready | blocked | ready-with-unresolved-conditions
  executable
  actionId / actionName / actionType / actionIndex
  actorId / actorName / skillId
  startMs / frameIndex
  diagnosticIds[]
  violationCodes[]
  unresolvedCodes[]
  cooldown = ActionCooldownReadiness | null
  appliedToSimulationResults = false
```

确定违反规则的动作状态为 `blocked`；仅有 SP 单位等未确认条件时为 `ready-with-unresolved-conditions`，仍保持 `executable = true`。

### 356.2 ActionCooldownReadiness 与 cooldown window

每个带逻辑冷却的技能动作记录施放时的 charge 快照：

```text
ActionCooldownReadiness
  sourceKind = azpr-action-cooldown-readiness
  status = cooldown-charge-consumed | blocked-no-charge-ready
  cooldownMs / cooldownCount
  availableBefore / availableAfter
  consumedChargeIndex
  nextReadyAtMs
  chargesBefore[] / chargesAfter[]
  windowId
  source
  appliedToSimulationResults = false
```

每个 charge slot 独立保存 `chargeIndex / readyAtMs / sourceActionId / sourceActionName`。合法施放选择当前可用的最低 charge index，更新该 slot 并生成：

```text
SkillCooldownWindow
  sourceKind = azpr-skill-cooldown-window
  windowId
  actionId / actionName
  actorId / actorName
  skillId / chargeIndex / cooldownCount
  startMs / endMs / durationMs
  source
  appliedToSimulationResults = false
```

没有可用 charge 的动作只生成 `blocked-no-charge-ready` 快照和规则诊断，不创建冷却窗口，也不改变任一 slot 的恢复时间。

### 356.3 Workbench 消费边界

动作库按 `actionId` 展示 readiness 和执行前后可用次数；时间轴按 `actorId + actionId` 绘制冷却窗口；运行详情按当前 runtime action 读取同一 readiness 行。三处均为标准合同消费者，不重复计算技能冷却。

P5-B 仍不把规则状态应用到 generation/runtime 数值。下一阶段 P5-C 将新增规则驱动执行计划，明确区分确定阻塞动作和仍允许执行的待确认动作，再由生成层与运行时统一消费。

## 357. 规则驱动动作执行计划

### 357.1 AzPrActionExecutionPlan

模拟引擎在规则诊断和 readiness 时间线之后生成：

```text
ActionExecutionPlan
  schemaVersion = 1
  contractName = AzPrActionExecutionPlan
  sourceKind = azpr-action-execution-plan
  status
  actions[]
  executedActionIds[]
  skippedActionIds[]
  unresolvedExecutedActionIds[]
  summary
  appliedToSimulationResults = true
```

动作条目结构为：

```text
ActionExecutionPlanEntry
  sourceKind = azpr-action-execution-plan-entry
  status = scheduled
         | scheduled-with-unresolved-conditions
         | skipped-rule-blocked
  execute
  actionId / actionName / actionType
  actionIndex / executionIndex
  actorId / actorName / skillId
  startMs / durationMs
  readinessStatus
  diagnosticIds[]
  violationCodes[]
  unresolvedCodes[]
  skipReason = confirmed-action-rule-violation | null
  readiness
  appliedToSimulationResults = true
```

`executionIndex` 只对实际执行动作连续编号。`blocked` readiness 变成 `skipped-rule-blocked`；`ready-with-unresolved-conditions` 保持 `execute = true`，避免在 SP 单位未闭合时伪造资源不足。

### 357.2 引擎与效果边界

模拟引擎对跳过动作只生成：

```text
ACTION_SKIPPED
  actionId / actorId / timeMs
  payload.reason
  payload.executionStatus
  payload.readinessStatus
  payload.diagnosticIds[]
  payload.violationCodes[]
```

跳过动作不生成 `ACTION_START`、`RESOURCE_CHANGE`、`COOLDOWN_START`、`DAMAGE_PROJECTED` 或 `DAMAGE_SKIPPED`。`ActionEffectRuntimeInput` 先按执行计划过滤 command，并新增 `executableInputCommandCount / blockedCommandCount`；被阻塞 command 不进入效果状态机。

### 357.3 Generation 与 Runtime 消费

`buildActionResultTimeline` 只为 `execute = true` 的动作创建结果，并为结果附加：

```text
executionStatus
readinessStatus
executionPlanEntry
```

Generation layer 再次按 `executedActionIds[]` 约束 scenario action、ActionResult、候选点和 fallback state point，作为标准入口的防御性边界。生成 summary 新增执行计划总数、执行数和跳过数。

Runtime projection 保留同一 `actionExecutionPlan` 引用，summary、output contract summary 和 output consistency 同步检查执行总数。由于被阻塞动作没有 Generation delta，其 sim log、hit transaction、状态曲线和资源曲线自然不存在对应点，不需要 UI 二次过滤。

### 357.4 Workbench 可见语义

`ScenarioHeader` 在 `skippedActionCount > 0` 时显示 `executedActionCount/actionCount`，没有跳过动作时保持原总数显示。动作库和时间轴继续使用 P5-B readiness；分析结果、运行导航、曲线和日志只展示执行计划中实际运行的动作。修正规则会重建整个计划并恢复对应结果。

下一阶段 P6-A 转向 PNG 项目快照与元数据回导，不继续增加规则状态碎片；执行计划后续扩展只在确认新的蓝色星原规则时增加 adapter 或规则来源。

## 358. PNG 项目快照与元数据合同

### 358.1 PNG tEXt chunk

新增通用 `pngMetadata` 工具，接受 `Blob / ArrayBuffer / Uint8Array`，写入标准 PNG `tEXt` chunk：

~~~text
PNG signature
IHDR / IDAT / other chunks
tEXt
  key = PromiliaAxisToolData
  separator = 0x00
  value = Latin-1-safe JSON envelope
IEND
~~~

读取和写入均验证 PNG 签名、chunk 长度边界、IEND 位置和每个 chunk 的 CRC32。元数据在 IEND 前插入，不修改已有图像 chunk。`isPngSource()` 允许导入入口在文件名和 MIME 不可靠时通过签名识别。

### 358.2 WorkbenchProjectPngMetadata

~~~text
WorkbenchProjectPngMetadata
  schemaVersion = 1
  game = azur-promilia
  type = workbench-project-png
  exportedAt
  projectSchemaVersion
  actionCount
  payloadEncoding = base64url-json
  payload
~~~

`payload` 由现有 `createWorkbenchProjectShareCode()` 生成，内部仍是 Workbench v7 project snapshot。PNG 反导入通过 `parseWorkbenchProjectShareCode()` 回到同一规范化入口，不复制角色、敌人、动作、效果或培养配置 schema。

文件命名为：

~~~text
promilia-workbench-YYYY-MM-DD-{actionCount}actions.png
~~~

### 358.3 Workbench 快照渲染

新增 `@zumer/snapdom` 作为运行依赖，与 Endaxis 的图片导出技术路线一致。导出时临时渲染固定 1600px 的只读快照面，包含项目摘要和现有 `TimelineGridPreview`；交互控件在快照模式隐藏，原 Workbench DOM 和选中状态不被改写。

生成顺序为：

~~~text
Workbench draft state
  -> WorkbenchProjectPngMetadata
Timeline export surface
  -> snapdom PNG Blob
PNG Blob + metadata
  -> CRC-valid tEXt chunk
  -> downloadable PNG project
~~~

### 358.4 导入边界

统一文件入口按 MIME、扩展名或 PNG 签名识别图片。PNG 解析成功后调用现有 `applyImportedProjectDraft()`，因此会：

~~~text
normalize selection/team/actor/enemy/action/effect
clear runtime selection and transient filters
clear undo/redo history
save normalized draft
rebuild project/compiler/simulation/runtime
~~~

无元数据、错误 envelope、损坏 share payload 或 CRC 不匹配时返回 `null`，不会应用部分状态。Workbench draft schema 保持 v7。

下一阶段 P7-A 回到真实机制适配：优先让标准 Hit 的韧性和角色能量 delta 消费可追溯的 AzPr 本地数据或 runtime sample，不继续扩展导出层。

## 359. P7-A ValidatedRuntimeSample 机制 adapter

### 359.1 标准 adapter 输出

新增 `threeValueMechanismSampleAdapter`：

```text
ValidatedRuntimeSample -> ThreeValueDelta
  key = azpr-three-value-mechanism-sample-adapter
  version = 1
  trackKey
  status
  pointCount
  promotedEventKeys[]
  points[]
```

Generation input 为每条三值轨调用同一 adapter。验证通过的 point 并入既有 `applied` layer，使用 `azpr-validated-runtime-mechanism-sample` 来源；`promotedEventKeys[]` 用于从 `sampled` layer 排除同一事件，避免 runtime 重复计数。

### 359.2 RecoverSP 晋级合同

能量采样必须先由 action result 中既有 `runtimeSamplingProbe` 判定为 `offline-runtime-sample-validated`，再满足：

```text
eventType = recover-sp-applied
actionId / actorId 与动作结果一致
captureSessionId 属于已验证匹配
elementConfigId 或 pathId 与候选一致
roleEntityId 与 finalSpCurve 一致
recoverTagType = 0
frameIndex 或 timeMs 存在
spAfter - spBefore = spDeltaApplied = validated finalSpCurve delta
```

晋级点使用 `recover-sp-runtime-sample-confirmed` 和 `runtime-final-confirmed-recover-sp-sample`；该次采样 delta 固定为不可替换的实测结果，但不会把它反推成其他动作可复用的最终公式。

### 359.3 削韧晋级合同

新增离线事件 `toughness-damage-applied`，字段为：

```text
actionId
actorId
targetId
targetEntityId
sourceElementConfigId 或 pathId
frameIndex / timeMs
toughnessBefore
toughnessAfter
toughnessDeltaApplied
```

仅当动作、角色、敌人实例、来源和时间完整，且 `toughnessBefore - toughnessAfter = toughnessDeltaApplied > 0` 时晋级。验证失败但含可读 delta 的事件保留为 `runtime-toughness-damage-applied-sample` 诊断点，固定 `applied = false`。

### 359.4 Runtime 消费边界

晋级点继续走现有标准链：

```text
Generation applied layer
  -> ThreeValueDelta calculator
  -> runtime input
  -> state snapshot
  -> enemyStateCurve / selfEnergyCurveByActor
  -> resourceCurves / simLog / summary
```

静态 `weakBreakDamageRate`、`recoverSP`、未验证 capture 和手工 fixture 不会直接改变默认项目。fixture 只用于验证合同，不能作为蓝色星原真实数值证据。

下一阶段 P7-B 增加独立 capture JSON 导入、合并、项目持久化和动作/实体映射；P7-A adapter 本身保持纯数据入口，不读取 UI 临时状态。

## 360. P7-B Workbench runtime capture 文件与持久化合同

### 360.1 RuntimeSampleCaptureFile

新增标准 envelope：

```text
RuntimeSampleCaptureFile
  schemaVersion = 1
  game = azur-promilia
  type = runtime-sample-captures
  captures[]
  summary
    captureCount
    eventCount
    captureSessionIds[]
    eventTypes[]
```

解析器同时接受单个含 `events[]` 的 capture、capture 数组和 `runtimeSampleCaptures[]` 包装。每个 capture 必须有 `captureSessionId` 和至少一个事件；每个事件必须有 `eventType` 或兼容字段 `type`。任一 capture/事件无效时返回 `null`，不导入可用子集。

### 360.2 Workbench 绑定结构

导入后 capture 增加：

```text
capture.actionId
capture.workbenchBinding
  status = bound-to-workbench-project
  actionId
  actorId
  targetId
  skillId
  sourceActionIds[]
  sourceSkillIds[]
```

每个事件写入当前项目 `actionId / actorId / targetId`，原值保存在：

```text
event.sourceWorkbenchBinding
  actionId
  actorId
  targetId
```

一个 capture 只允许绑定一个 Workbench 动作。精确匹配当前 action ID 时直接绑定；单个外部 action ID 回退到所选动作；多个未知 action ID、多个已知 Workbench 动作或 `args.skillId` 与所选技能不一致时拒绝。

### 360.3 Draft schema v8

Workbench draft 从 v7 升级为 v8：

```text
WorkbenchDraftV8
  ...V7 fields
  runtimeSampleCaptures[]
```

存储键更新为 `promilia-axis-tool:workbench-draft:v8`，v7 加入 legacy key 列表。`createWorkbenchDraftSnapshot()` 统一规范化采样，因此本地草稿、历史快照、项目 JSON、分享码和 PNG `PromiliaAxisToolData` 继续复用同一项目载荷。v1-v7 缺少字段时规范化为 `[]`。

相同 `captureSessionId` 再次导入会原位替换；新 session 追加。导入绑定若包含任何拒绝 capture，Workbench 不应用整批内容。

### 360.4 Runtime 刷新与数值精度

`createWorkbenchProject()` 把 draft capture 写入 `project.metadata.runtimeSampleCaptures`，编译器和 P7-A adapter 沿用既有入口。导入成功后记录撤销快照、清理 transient runtime selection、重建 simulation，并持久化 v8 草稿。

实测 SP 可能是小数，Workbench runtime 摘要、命中日志和详情的有符号数值改为最多 6 位小数；hit transaction 内部聚合精度也由 3 位提高到 6 位。HP/韧性现有整数展示不变。

下一阶段 P7-C 建立实际 hook/Extractor JSON 或 JSONL 到 `RuntimeSampleCaptureFile` 的产出与规范化链，并用非 fixture 样本验证来源元数据、事件关联和最终曲线。

## 361. P7-C 受控 runtime capture 产出合同

### 361.1 RuntimeCaptureHookManifest

新增生成文件 `src/data/generated/runtime-capture-hook-manifest.json`：

```text
RuntimeCaptureHookManifest
  schemaVersion = 1
  game = azur-promilia
  kind = runtime-capture-hook-manifest
  manifestId
  source
    path / size / lastWriteTime / sha256
    clientRegion / clientSnapshot
    moduleName / imageBase
    module
      path / size / lastWriteTime / sha256
  methods[]
    key / className / methodName
    hookMoments[] / eventTypes[]
    rva / offset / va / signature
  fields[]
    key / className / fieldName / fieldType / offset / declaration
  eventContracts[]
  runtimeRequirements
```

生成器从 TC `dump.cs` 流式提取 9 个目标方法和 27 个字段，覆盖 RecoverSP 的两个修正属性读取入口、三个充能入口、两个最终状态写入口和两个削韧入口；字段覆盖 BaseElement 来源 element/skill/entity 身份、RecoverSPArgs、DamageElement、SPSystem 以及 AliveProperty 的 `m_sp/m_weaknessPoint`。属性入口通过 `captureWhen.id = 105/228` 限定为 `SPGETUP / SPGETUP_ATK`。生成时任一目标缺失即失败；manifest 同时固定 `dump.cs` 与实际 `GameAssembly.dll` SHA-256，客户端更新后旧地址不得继续使用。

### 361.2 RuntimeCaptureJsonLines

JSONL 接受两类记录：

```text
CaptureSessionRecord
  recordType = capture-session
  captureSessionId
  clientRegion / clientBuild / source
  captureTool

CaptureEventRecord
  recordType = event
  captureSessionId
  eventType
  frameIndex 或 timeMs
  sourceElementConfigId 或 pathId
  ...event payload
```

解析器按首次出现顺序归并 `captureSessionId`，会话元数据合入对应 capture，事件保持文件顺序。重复会话头、未知 `recordType`、无 session ID 或无效 JSON 行会使整份输入失败；成功后转换为既有 `RuntimeSampleCaptureFile`，因此不新增第二套 Workbench 项目结构。

### 361.3 ProductionCaptureAudit

规范化输出新增：

```text
provenanceAudit
  schemaVersion = 1
  status
  captureCount
  productionEligibleCaptureCount
  realCaptureClaimAllowed
  captureAudits[]
    source / clientRegion / clientBuild
    eventTypes[] / requiredEventTypes[] / missingEventTypes[]
    recoverSpSequenceOrdered
    checks
    productionEligible
  applied = false
```

生产资格要求来源不是 fixture/synthetic/template/mock/example/manual/self-test，且包含客户端区域、build、采集工具版本、hook manifest 标识、事件时间和 DamageElement/PathID 身份。RecoverSP 的五类必需事件必须齐全，并按“modifier -> args -> OnTransmit -> applied -> share”保持调用先后顺序；削韧至少包含 `toughness-damage-applied`。审计只声明来源合同是否完整，不会把采样反推为通用公式。

### 361.4 规范化与消费边界

`runtime-capture:normalize` 支持 JSON/JSONL 输入，输出标准 envelope、输入文件路径/大小/SHA-256 和审计结果。`--require-production` 在审计失败时以退出码 2 停止且不写输出。

Workbench 文件入口新增 `.jsonl/.ndjson` MIME/扩展名，解析后继续走 P7-B 绑定、v8 草稿和 P7-A adapter。当前没有非 fixture capture；manifest 的 `realRuntimeCaptureAvailable = false`，P7-C 真实数据验收仍未完成。

下一阶段继续 P7-C：在明确授权、人工控制且不绕过反作弊的客户端环境中产出首份真实 JSONL，并通过 production audit、adapter、三值曲线、日志和项目回导验收。

## 362. P7-C 显式受控 Frida capture host

### 362.1 Host 启动合同

新增 `scripts/capture-azpr-runtime.py`，游戏采集必须显式提供：

```text
--pid
--output
--action-id
--actor-id
--target-id
--confirm-controlled-session
```

缺少确认标志时在调用 `frida.attach()` 前失败。host 不寻找或启动游戏，不提供关闭/绕过反作弊的选项；`--duration 0` 只表示由操作者按 Ctrl+C 结束已确认会话。

附加后 host 先通过 agent RPC 读取进程内 `GameAssembly.dll` 路径，对文件大小和 SHA-256 与 manifest 做严格匹配；验证成功后才安装 Interceptor。session header 自动写入 manifest ID/hash、模块路径/hash、客户端区域/build 和进程 ID，每个 event 写入后立即 flush。

### 362.2 Agent runtime correlation

新增 `runtime-capture/frida/azpr-runtime-capture-agent.js`，按线程维护四类嵌套上下文：

```text
DamageElement.RecoverSP source stack
SPSystem.OnTransmit stack
SPSystem.RecoverSP stack
FormulaUtility.WeaknessPointChange stack
```

能量链读取 BaseElement `elementId/skillId/entityId/uniqueId`、DamageElement 三个 recover 字段、两个 modifier 的 MyFloat 返回值、RecoverSPArgs 全字段，并在 `AliveProperty.SetSp` 前后读取 `m_sp`。削韧链在 `WeaknessPointChange` 上下文中拦截 `AliveProperty.SetWeaknessPoint`，读取 `m_weaknessPoint` 前后值。MyFloat 按 IL2CPP `int64 / 65536` 转换，同时保留 raw 值。

### 362.3 受控 transport 自检

`--self-test` 只启动仓库控制的 Python 子进程并拦截 `kernel32!Sleep`，不读取 manifest、不接触游戏。当前自检捕获 4 个 native 调用，证明 PID attach、agent RPC、Interceptor、消息回传和 JSONL flush 可工作。

self-test session 使用 `source = controlled-frida-self-test`；production audit 明确拒绝 `self-test` 标记，测试数据不能晋级为真实游戏证据。

当前没有运行中的游戏进程，也没有非 fixture capture；本节证明采集执行端已经就绪，不证明游戏内 hook 已执行。下一阶段仍需人工启动获准客户端并完成第一份真实 capture 验收。

## 363. WorkbenchPresetLibrary v1

### 363.1 本地持久化合同

新增本地键 `promilia-axis-tool:workbench-presets:v1`：

```text
WorkbenchPresetLibrary
  schemaVersion = 1
  game = azur-promilia
  type = workbench-preset-library
  updatedAt
  presets[]
  summary
    presetCount / readyCount / migratedCount / incompatibleCount
    tags[]

WorkbenchPreset
  schemaVersion = 1
  id / name / description / tags[]
  createdAt / updatedAt
  sourceProjectSchemaVersion
  compatibilityStatus
  summary
    actionCount / characterIds[] / actorNames[]
    enemyId / enemyName / durationMs
    effectCommandCount / runtimeSampleCaptureCount
  projectFile: WorkbenchProjectFile
```

`projectFile` 始终复用当前 Workbench 项目快照，不复制 selection、team/loadout、enemy、action/effect 或 runtime capture 字段定义。保存预设不会提升 Workbench draft schema；当前仍为 v8。

### 363.2 兼容与迁移

读取时同时识别旧键 `promilia_presets` 的数组结构。能够由 `parseWorkbenchProjectFile` 读取的 v1-v7 项目会重新生成 v8 快照并标记 `migrated-project-schema`；当前 v8 标记 `ready`；无法解析的条目标记 `incompatible-project-schema`，保留名称、标签和摘要，但禁止加载和复制。

新增、复制或删除后只写入 v1 新键，后续读取优先使用新键。预设加载继续调用 Workbench 现有导入恢复入口，因此草稿保存、临时复盘状态清理和运行时重算保持与 JSON、PNG、分享链接一致。

## 364. 发布审计报告合同

### 364.1 ProductionImportAudit v1

`reports/production-import-audit.json` 记录：

```text
schemaVersion = 1
kind = production-import-audit
entrypoints
  production[] / tests[]
summary
  sourceCodeFileCount
  productionReachableCount
  testOnlyCount / allowedTestOnlyCount / unexpectedTestOnlyCount
  unreferencedCount
  *ByArea
productionReachableFiles[]
testOnlyFiles[] / allowedTestOnlyFiles[] / unexpectedTestOnlyFiles[]
unreferencedFiles[]
limitations[]
```

审计解析相对路径和 `@/` 别名的静态或字符串动态 import。领域 fixture、runtime sample fixture 与无 UI `src/simulation/index.js` 是明确允许的 test-only 模块；其他 test-only 或无引用源码会使 `audit:production-imports:check` 失败。

### 364.2 WorkbenchLongAxisBenchmark v1

`reports/long-axis-benchmark.json` 记录固定动作规模、环境、迭代次数、预算、数量一致性验证、compile/simulation/total 的 min/median/p95/max、峰值 heap 和每次样本。

编译测量包含 Workbench draft -> Project -> Scenario；模拟测量包含执行计划、generation、calculator runtime、状态曲线、日志和 projection。报告不改变项目或运行时 schema，只作为发布性能守门；`--assert-budget` 在数量不一致或 p95 超预算时失败。

## 365. BundleCompositionAudit v1

`reports/bundle-composition.json` 记录一次 Vite 生产构建的模块组成：

```text
schemaVersion = 1
kind = bundle-composition-audit
budgets
  initialEntryGzipBytes
  workbenchGzipBytes
  totalJavaScriptGzipBytes
budgetStatus
projectionGuard
  workbenchUsesProductionDataProjection
  skillDiagnosticsLazyChunkPresent
  forbiddenModules[] / detectedForbiddenModules[]
  skillDiagnosticsChunk
summary
  javaScriptChunkCount / assetCount
  totalJavaScriptBytes / totalJavaScriptGzipBytes
  totalAssetBytes / totalAssetGzipBytes
javaScriptChunks[]
  fileName / name / facadeModuleId
  isEntry / isDynamicEntry
  imports[] / dynamicImports[]
  bytes / gzipBytes / moduleCount
  modules[]
assets[]
topModules[]
packageTotals[]
```

模块路径统一为仓库相对路径，第三方依赖按 package 聚合。当前默认 gzip 预算为首屏入口 120KB、Workbench 370KB、全部 JavaScript 740KB；`audit:bundle:check` 在入口缺失、任一预算超限、诊断数据没有形成独立动态 chunk，或 Workbench 重新引入完整目录/技能证据表时失败。该报告不改变 Workbench 项目、生成数据或运行时 schema。

## 366. WorkbenchProductionDataProjection v2

`src/data/generated/workbench-seed.json` 从编辑样例 seed 升级为生产目录投影：

```text
schemaVersion = 2
purpose = workbench-production-data-projection
generatedAt / source
sources
  characters / skills / enemies / elements
  equipment / kibos / soulessences
defaults
  characterId / skillId / enemyId
counts
  characters / skills / enemies / elements
  equipment / kibos / soulessences
gameData
  characters[] / skills[] / enemies[] / elements[]
  equipment[] / kibos[] / soulessences[]
```

投影保持 20 个角色、120 个技能、208 个敌人、10 个元素、137 件装备、122 个奇波和 62 个魂灵与完整生成目录一一对应。敌人只保留身份、元素、图标、HP/攻击/双防、`WEAKNESS_POINT_MAX` 和 10 类元素防御；装备保留 `id/name/type/rarity`，奇波保留 `id/name/element/stage`，魂灵保留 `id/name/rarity`。字段集合覆盖当前选择、项目校验、配置记录、Scenario 编译和三值运行时，不承载图鉴说明或完整诊断证据。

`workbenchProjectFactory.js` 只消费该 v2 合同，完整拆表继续由 `azprGenerated.js` 暴露给数据审计。单元守门会比较投影 ID、数量和关键字段与完整目录；项目保存 schema 仍为 v8，本节不改变 JSON/PNG/分享/预设格式。

## 367. WorkbenchSkillRuntimeProjection v1

本合同已由第 369 节的核心/诊断拆分合同取代；本节保留为从单文件投影迁移的历史记录。

`src/data/generated/workbench-skill-runtime.json` 由四份完整审计数据生成：

```text
schemaVersion = 1
kind = workbench-skill-runtime-projection
generatedAt / sourceKind
sources
counts
skillLogicIndex
  sourceKind / source / summary / items[]
skillLevelCrossCheck
  sourceKind / source / summary / items[]
valueParamIndex
  sourceKind / source / summary / params[]
skillAssetEvidence
  externalElementObjectEvidence
  summonTargetSkillEvidence
  damageElementFieldMappingEvidence
  currentSkillControlEvidence[]
```

逻辑项保留每级 display/elementValue、子技能 logic 和诊断；等级校验保留每级标签、倍率、语言 ID、匹配状态和来源；valueParam 保留 runtime 描述需要的语义字段。Skill Control 证据只保留 HP lane、行为引用摘要、动作状态/事件桥控制和普通攻击命中链，DamageElement 映射、外部对象与召唤目标关系保持完整。

`skillLogicModel.js`、`skillLevelCrossCheck.js` 和 `projectSimulationResult.js` 统一消费该合同。完整 `skill-logic-index.json`、`skill-level-crosscheck.json`、`value-param-index.json` 和 `skill-asset-evidence.json` 继续用于审计，不再进入 Workbench 生产 chunk；本节不修改 calculator 或三值结果合同。

## 368. WorkbenchProductionDataAudit v1

本报告合同已升级为第 370 节的 v2；本节保留 v1 字段和迁移来源。

`reports/workbench-production-data-audit.json` 记录：

```text
schemaVersion = 1
kind = workbench-production-data-audit
status
  seedProjectionMatches
  skillRuntimeProjectionMatches
  manifestMatches
seedAudit
  checks / counts
skillRuntimeAudit
  checks / counts / size
manifestAudit
gameCatalogSize
```

审计从完整生成 JSON 重建 v2 目录投影和 v1 技能运行投影，并做深度结构比较；同时核对 manifest 注册、完整/投影字节数和缩减比例。当前目录投影相对完整目录减少 77.12%，技能运行投影相对四份完整证据减少 33.83%；`audit:workbench-data:check` 在任一映射不一致时失败。

## 369. WorkbenchSkillRuntimeProjection v2

原 `workbench-skill-runtime.json` 拆分为两个生成合同：

```text
workbench-skill-core.json
  schemaVersion = 1
  kind = workbench-skill-core-projection
  sources / counts
  skillLogicIndex
  skillLevelCrossCheck
  valueParamIndex

workbench-skill-diagnostics.json
  schemaVersion = 1
  kind = workbench-skill-diagnostics-projection
  sources / counts
  skillAssetEvidence
```

domain、compiler 和首轮 simulation 只静态消费核心合同。`workbenchSkillDiagnosticsLoader.js` 动态读取诊断合同，`installProjectSimulationSkillDiagnostics()` 将候选证据安装到结果投影；打开运行复盘、导入原始 runtime capture，或恢复包含 capture 的 JSON/PNG/分享/预设/草稿时才触发加载。诊断安装前后，已应用 HP、韧性、角色能量、状态快照和日志数值保持一致；候选层与来源诊断允许由空变为完整。

## 370. WorkbenchProductionDataAudit v2

`reports/workbench-production-data-audit.json` 的 `schemaVersion` 升级为 2，状态拆为：

```text
status
  seedProjectionMatches
  skillCoreProjectionMatches
  skillDiagnosticsProjectionMatches
  manifestMatches
```

审计从四份完整技能证据分别重建核心与诊断投影，逐字段比较两个生成文件，并核对 manifest 的 `workbenchSkillCore` / `workbenchSkillDiagnostics` 注册。`skillRuntimeAudit.size` 额外记录 `coreBytes`、`diagnosticsBytes` 和合计体积；任一映射或注册不一致都会使 `audit:workbench-data:check` 失败。

## 371. ProductionPreviewAcceptance v1

`reports/production-preview-acceptance.json` 由 production Playwright reporter 生成：

```text
schemaVersion = 1
kind = production-preview-acceptance
generatedAt
environment
  platform / node / server / source
commands
decision
  status = trial-ready | blocked
  trialReady / reason
summary
  requiredCapabilityCount / passedCapabilityCount
  testCount / passedTestCount / playwrightStatus / durationMs
capabilities[]
  capability / status / testCount
tests[]
  capability / title / status / durationMs / retry / errors[]
limitations[]
```

必需能力固定为 production 路由与哈希资源、诊断动态加载、JSON 项目交换、PNG 项目交换、多动作编辑、动作关系交换、状态效果区间复盘、方案对比、循环区段复盘、多方案工作区和 390px 窄屏主流程。只有 Playwright 整体通过且十一项能力全部存在并通过时，报告才输出 `trial-ready`；缺项或失败均输出 `blocked`。该报告只证明本地 `dist` + Vite preview 可试用，不代表远程 CDN/托管、最终蓝原公式或非 fixture 真实采样已验收。

## 372. WorkbenchActionClipboard v1（仅编辑会话）

`workbenchActionClipboard.js` 定义 Workbench 内存动作剪贴板：

```text
schemaVersion = 1
kind = promilia-workbench-action-clipboard
sourceActionIds[]
baseStartMs / baseEndMs / durationMs
actions[]
relations[]
nextPasteStartMs
```

`actions[]` 是所选动作的深拷贝，`relations[]` 只包含两个端点都在所选组内的关系。粘贴时按 `baseStartMs` 还原相对帧差，按动作组总跨度限制时间轴边界，重建 action、effect command 与 relation ID，并清除旧 `insertion` / `generationBatch`。多选状态由 `selectedActionIds[] + primaryActionId + actionSelectionAnchorId` 表示，历史快照会保存这些字段以恢复撤销/重做。

该合同严格属于 Workbench transient editing state：不会写入 `WorkbenchDraftSnapshot v11`、项目 JSON、分享链接、PNG 元数据或预设。持久化的是每条方案自身的 `actionRelations[]`，不是剪贴板；导入、重置和方案切换会清理剪贴板，避免跨方案携带失效动作来源。

## 373. WorkbenchProjectFile v9 / ActionRelation v1

Workbench 草稿与项目文件从 v8 升级为 v9，新增：

```text
actionRelations[]
  id
  kind = sequence
  fromActionId / toActionId
  sourceAnchor = end
  targetAnchor = start
  gapMs
```

`workbenchActionRelations.js` 负责规范化关系、剔除失效端点和重复边、阻止有向环，并按 `to.startMs - (from.startMs + from.durationMs)` 重新计算帧对齐的 `gapMs`。关系随动作组复制、粘贴、移动、删除、批次复制和撤销/重做保持一致；删除动作时清理所有关联边。

`actionRelations[]` 与 `actionDrafts[]` 一同写入本地草稿、JSON、分享链接、PNG 元数据和预设项目。v1-v8 文件继续由同一解析器接受并迁移为空关系数组。当前关系只表达编辑器中的前后编排语义，simulation 和 `Action -> Hit -> ThreeValueDelta` 不读取该字段，因此三值结果合同没有变化。

## 374. EffectIntervalProjection v1（仅运行时投影）

`projectEffectIntervals.js` 从 `AzPrEffectRuntimeTimeline.events[]` 生成：

```text
schemaVersion = 1
sourceKind = azpr-effect-interval-projection
contractName = AzPrEffectIntervalProjection
durationMs / frameRate
intervals[]
  intervalId / instanceKey
  effectId / effectName
  targetKind / targetId / targetName
  startMs / endMs / durationMs
  startFrame / endFrame
  sourceActionId / sourceActionIds[] / sourceActorIds[]
  lifecycleEventIds[] / lifecycleEvents[] / selectionEventId
  terminationEventId / terminationType
  initialStacks / finalStacks / peakStacks / maxStacks / refreshCount
  activeAtScenarioEnd / persistent
  appliedToCalculators = false
summary
```

同一 effect instance 从 `EFFECT_APPLIED` 开始，`EFFECT_REFRESHED` 继续写入当前区间，`EFFECT_REMOVED` 或 `EFFECT_EXPIRED` 结束区间；场景结束仍生效的实例裁切到项目时长并保留 active/persistent 状态。重复施加生成递增但稳定的 `interval-N`，便于动作时间变化后维持 UI 选择。

该合同不写入 WorkbenchProjectFile，也不新增项目迁移。角色目标由时间轴投影到对应角色轨，敌人目标进入独立敌人效果轨；区间、生命周期事件和来源动作只服务可见复盘，现有 effect command、runtime event、active snapshot 和 `appliedToCalculators = false` 边界均未改变。

## 375. WorkbenchScenarioComparison v1（仅编辑会话投影）

`projectScenarioComparison.js` 接收当前与基准两套独立 simulation 结果：

```text
schemaVersion = 1
sourceKind = azpr-workbench-scenario-comparison
contractName = AzPrWorkbenchScenarioComparison
status = scenario-comparison-awaiting-baseline | scenario-comparison-ready
current / baseline
  label / sourceKind / projectId / projectName
  metrics
    enemyHpDelta / enemyToughnessDelta / selfEnergyDelta
    durationMs / effectCoverageMs
  actors[]
  actions[]
  effects[]
metrics[]
  key / label / unit
  current / baseline / delta / changed
actors[]
  currentActorId / baselineActorId / name
  currentValue / baselineValue / delta / changed
actions[]
  currentActionId / baselineActionId
  currentName / baselineName / actorName
  metrics / changed
effects[]
  name / targetName / duration / intervals / changed
summary
  metricCount / actorCount / actionCount / changedActionCount
  effectCount / changedEffectCount
  readsRuntimeOutputsOnly = true
  appliedToCalculators = false
```

总 HP、韧性和能量直接读取各方案 `runtimeOutputs.summary`；角色能量读取 `resourceCurves.curvesByActor`；动作贡献聚合 `hitTransactions.transactions` 并读取 `effectTimeline.events`；效果覆盖读取各方案的 `AzPrEffectIntervalProjection`。排轴时长只取 Scenario 动作的最晚结束时间。该投影不调用 calculator，也不建立第二套三值公式。

基准可来自其他工作区方案、WorkbenchPreset、JSON/PNG 项目或当前草稿快照，但 `comparisonBaselineDraft`、当前选择的基准来源和投影结果都属于 Workbench transient state，不写入 WorkbenchProjectFile v11、本地草稿、分享链接、PNG 元数据或预设。工作区方案自身作为 `scenarioWorkspace` 持久化；选择它作基准只创建第二套 Project/Scenario/simulation，不覆盖当前编辑或历史栈。

## 376. WorkbenchProjectFile v10 / CycleBoundary v1

Workbench 草稿与项目文件从 v9 升级为 v10，新增：

```text
cycleBoundaries[]
  id
  timeMs
```

`workbenchCycleBoundaries.js` 负责把边界吸附到 60fps，限制在 `(0, project.durationMs)` 内，并清理重复 ID、重复时间和无效值。边界按 `timeMs` 稳定排序，新增时使用递增 `cycle-boundary-NNNN` ID；拖动只提交松手后的最终帧，删除和选中状态进入 Workbench 历史快照。

`cycleBoundaries[]` 与动作和关系一同写入本地草稿、JSON、分享链接、PNG 元数据和预设项目。v1-v9 文件继续由同一解析器接受并迁移为空边界数组。compiler 只把边界复制到 Scenario 供投影读取；execution plan、generation 和 calculator 不读取边界，因此现有三值结果不变。

## 377. CycleSectionProjection v1（仅运行时投影）

`projectCycleSections.js` 从 Scenario 边界和现有 runtime output 生成：

```text
schemaVersion = 1
sourceKind = azpr-cycle-section-projection
contractName = AzPrCycleSectionProjection
durationMs / frameRate / boundaries[]
sections[]
  sectionId / label
  startMs / endMs / durationMs
  startBoundaryId / endBoundaryId
  metrics
    enemyHpDelta / enemyToughnessDelta / selfEnergyDelta
    effectCoverageMs
  actors[]
  actions[]
  effects[]
summary
  readsRuntimeOutputsOnly = true
  appliedToCalculators = false
```

命中 transaction 和 effect lifecycle event 按发生时间进入区段，恰好位于边界的事件进入后一区段；效果覆盖按 interval 与区段的实际重叠时长聚合。动作行只聚合已经存在的 HP、韧性、能量、命中和效果事件，角色行只聚合现有 self-energy transaction。该投影不写入项目文件，不调用 calculator，不复制动作，也不自动推算循环次数。

## 378. WorkbenchProjectFile v11 / ScenarioWorkspace v1

Workbench 草稿与项目文件从 v10 升级为 v11，新增：

```text
scenarioWorkspace
  schemaVersion = 1
  activeScenarioId
  scenarios[] (max 14)
    id
    name
    draft
      selection / teamSlots / actorConfigs / enemyConfig
      segmentSplitOptions
      actionDrafts / actionRelations / cycleBoundaries
      runtimeSampleCaptures / selectedActionId
```

根级 Workbench 草稿字段始终镜像 `activeScenarioId` 指向的方案，继续作为 `createWorkbenchProject()` 和全部 simulation 的唯一输入；inactive scenario 只保存在工作区合同中，不并行运行。`workbenchScenarioWorkspace.js` 负责稳定 ID、48 字符名称、深拷贝、14 方案上限、至少保留一个方案，以及新增、复制、重命名、切换和删除。

切换前把当前活动草稿写回方案，切换后加载目标 draft 并清理跨方案临时焦点、动作剪贴板和撤销/重做栈。完整工作区随本地草稿、JSON、分享链接、PNG 元数据和预设交换；v1-v10 文件迁移为 `scenario-0001 / 方案 1`。工作区结构不进入 Project schema、compiler、generation 或 calculator，因此不改变三值结果。

## 379. WorkbenchProjectFile v12 / InitialRuntimeState v1 / CycleBoundaryInheritanceProjection v1

Workbench 草稿与项目文件从 v11 升级为 v12；根级活动草稿与每条 `scenarioWorkspace.scenarios[].draft` 新增：

```text
initialRuntimeState
  schemaVersion = 1
  sourceKind = azpr-initial-runtime-state
  contractName = AzPrInitialRuntimeState
  source
    sourceScenarioId / sourceScenarioName
    boundaryId / boundaryTimeMs
  enemy
    enemyId
    hp.currentValue / maxValue
    toughness.currentValue / maxValue
  selfEnergyByActor[]
    actorId / characterId / actorName
    currentValue / maxValue
  activeEffects[]
    instanceKey / effectId / targetKind / targetId
    remainingDurationMs / stacks / maxStacks
    tags[] / modifiers[]
```

`Project` 和编译后的 `Scenario` 显式携带规范化初始状态。三值 runtime 仅在敌人实例、角色身份匹配时使用继承 HP、韧性和自身能量作为 baseline；效果 runtime 把合法目标的继承效果转换为 0 帧 `EFFECT_INHERITED`，按剩余时长继续刷新、移除或到期。`EffectIntervalProjection` 将继承事件视为新区间起点，calculator 仍不读取效果修正。

`AzPrCycleBoundaryInheritanceProjection` 读取 `runtimeOutputs.stateSnapshots` 与 `effectTimeline.events`。只有 `timeMs < boundaryTimeMs` 的三值快照进入继承状态；恰好在边界发生的 apply/refresh 与动作留给新方案，恰好在边界到期或移除的效果不继承。边界后动作整体平移，只有两端均保留的关系进入新方案，后续边界同步平移，runtime sample capture 清空以避免绝对帧误用。

v1-v11 项目继续由统一解析器接收并迁移为 `initialRuntimeState = null`。v12 状态随本地草稿、JSON、分享链接、PNG 元数据和预设交换；没有新增倍率、伤害/削韧/充能公式或自动循环外推。

## 380. WorkbenchLayout v1（独立浏览器偏好）

阶段 8-H 新增独立工作区布局合同：

```text
schemaVersion = 1
mode = balanced | edit | review | custom
leftPanelWidth / rightPanelWidth
leftPanelCollapsed / rightPanelCollapsed
```

`src/domain/workbenchLayout.js` 负责默认值、边界约束、模式切换、折叠、指针拖动、键盘步进和 localStorage 读写；`WorkbenchLayoutBar.vue` 只发送布局命令，`Workbench.vue` 将结果映射为 CSS grid 轨道。持久化 key 为 `promilia-axis-tool:workbench-layout:v1`。

该合同不属于 WorkbenchProjectFile v12，也不写入当前草稿、方案工作区、JSON、分享链接、PNG 元数据、预设或撤销历史。Project、Scenario、generation、runtime 和 calculator 均不读取布局状态，因此项目交换与三值结果保持不变。760px 以下由 CSS 强制显示全部面板，避免桌面折叠偏好造成窄屏内容缺失。

## 381. WorkbenchProjectFileReceiveResult v1（临时导入合同）

阶段 8-I 新增统一文件接收结果：

```text
kind = project | runtime-capture | invalid
sourceKind = json | png
fileName
draft? / captures?
reason? / statusText
```

`workbenchProjectFileReceiver.js` 先按 PNG MIME、扩展名或文件签名识别 PNG，并复用 `parseWorkbenchProjectPng()` 校验 `PromiliaAxisToolData`；文本文件复用 `parseWorkbenchProjectFile()`，必要时再尝试 `parseWorkbenchRuntimeSampleCaptureFile()`。文件选择入口允许对浏览器临时无扩展名文件做内容解析回退，外部拖放严格限制 JSON/JSONL/NDJSON 或 PNG。窗口拖放控制器只在 `dataTransfer.types` 含 `Files` 时接管事件，并向 Workbench 提交一次文件列表。

合法项目仍由 `applyImportedProjectDraft()` 负责规范化、历史清理、草稿保存和 runtime 刷新；runtime capture 仍走既有绑定与 adapter。无效结果、多文件和解析异常只更新导入状态，不应用 draft。该合同不改变 WorkbenchProjectFile v12、Project、Scenario、generation、runtime 或 calculator。

## 382. WorkbenchProjectFile v13 / ConfigurationLibrary v1 / ConfigurationSelection v1

Workbench 草稿与项目文件从 v12 升级为 v13。项目根级新增共享配置库：

```text
configurationLibrary
  schemaVersion = 1
  actorInstances[] (max 48)
    id / name / characterId
    actorConfig
  enemyInstances[] (max 24)
    id / name / enemyId
    enemyConfig
```

根级活动草稿与每条 `scenarioWorkspace.scenarios[].draft` 新增：

```text
configurationSelection
  schemaVersion = 1
  actorInstanceIds[]
    characterId / instanceId
  enemyInstanceId
```

`workbenchConfigurationLibrary.js` 负责实例 ID、名称、上限、复制、重命名、选择、删除和方案解析。角色实例直接保存既有 `normalizeWorkbenchActorConfig()` 结果，敌人实例直接保存既有 `normalizeWorkbenchEnemyConfig()` 结果；选择配置或切换方案后，所选实例解析回活动草稿的 `actorConfigs` / `enemyConfig`。Project、Scenario、generation、runtime 和 calculator 仍只消费解析后的既有配置字段，不读取实例库，也没有新增公式或平行培养模型。

v1-v12 项目继续由统一解析器接收。迁移时从活动方案及各非活动方案现有 `actorConfigs` / `enemyConfig` 建立或复用配置实例，并为每条方案写入对应选择；相同实体和配置内容共用实例，不同内容保留为独立实例。v13 配置库与选择随本地草稿、JSON、分享链接、PNG 元数据、预设和撤销/重做交换。

## 383. ThreeValueMechanismConfiguration v1 / MechanismContext v2 / Calculator v3

阶段 8-K 在编译后的 Scenario 新增运行时来源合同：

```text
mechanismConfiguration
  schemaVersion = 1
  sourceKind / contractName / status / ready
  actors[]
    actorId / characterId / configurationInstanceId
    sourceStatus / sourcePaths / ready
    level / initialSp / loadout
    application.stats / initialEnergy / loadout
  enemy
    targetId / enemyId / configurationInstanceId
    sourceStatus / sourcePaths / ready
    level / hpMultiplier / defenseMultiplier
    toughnessMultiplier / initialToughnessRatio
    elementDefense.overrides
    application.hpBaseline / defensePreview / toughnessBaseline
    application.level / elementDefense
  policy / summary
```

Workbench Project metadata 新增规范化 `configurationSelection` 镜像，只包含活动方案的 actor/enemy 实例 ID；它不是第二份配置值，也不会携带整个 `configurationLibrary`。compiler 继续以 Project actor/enemy 和 metadata 中已解析的 `actorConfigs` / `enemyConfig` 为数值输入，实例 ID 只用于来源追踪。

`AzPrThreeValueMechanismContext` 从 v1 升级为 v2，新增 `configuration`、`configurationReady` 和 `configurationStatus`。`Action -> Hit -> ThreeValueDelta` 及 `ThreeValueDeltaCalculator` 从 v2 升级为 v3；delta/calculator summary 新增配置 readiness、状态、来源类型和实例 ID。`ThreeValueRuntimeCalculatorInvocation` 从 v1 升级为 v2，新增显式 `input.mechanismConfiguration` 及引用保持校验，runtime state/projection summary 同步汇总调用次数和实例 ID。

这些字段只声明来源身份和当前应用策略。已有 HP、韧性、能量 delta、baseline、曲线和日志保持不变；loadout 效果、敌人等级公式和元素防御公式仍标记为 unconfirmed/unapplied。该合同不写回 WorkbenchProjectFile v13，也不新增项目迁移。

## 384. ThreeValueMechanicsAdapter v1 / Action-Hit-Delta v4 / RuntimeInvocation v3

阶段 8-L 新增统一三轨机制调用合同：

```text
mechanicsAdapterRequest
  schemaVersion = 1
  contractName = AzPrThreeValueMechanicsAdapter
  contractVersion = 1
  trackKey / outputField
  action
  hit
  mechanismConfiguration
  sourceValue
    value
    hpDelta / toughnessDelta / energyDelta
    sourceKind / sourceIds / confidence / status
  stateBefore = null
  bindingStatus = generation-inputs-bound-runtime-state-pending

runtimeCalculatorInvocation.input
  contractName = AzPrThreeValueMechanicsAdapter
  action / hit
  mechanismConfiguration
  sourceValue
  stateBefore
  generationRequest
  mechanismContext / sourceDelta
```

`Action -> Hit -> ThreeValueDelta` 从 v3 升级为 v4，并把 `mechanicsAdapterRequest` 加入必需 delta 字段；generation entry validation 校验 action、hit、配置引用和 source value 与原 delta 一致。`ThreeValueRuntimeCalculatorInvocation` 从 v2 升级为 v3，统一由 mechanics registry 解析三轨或 `default` 注册项，再注入 runtime snapshot 的前状态。

`createThreeValueMechanicsAdapterRegistry()` 和 `registerThreeValueMechanicsAdapter()` 返回无 UI 注册表；`simulateScenario(scenario, { threeValueMechanicsAdapterRegistry })` 是顶层注入边界。旧 `runtimeCalculatorAdapters` 参数继续作为兼容来源。默认 adapter、异常回退、HP/韧性/能量 delta、曲线、日志和 summary 数值保持不变；本阶段没有新增真实公式或启用未确认培养效果。

## 385. ThreeValueMechanicsOperands v1 / Adapter v2 / Action-Hit-Delta v5

阶段 8-M 在 `mechanicsAdapterRequest.sourceValue` 下新增可计算 operands：

```text
sourceValue.operands
  schemaVersion = 1
  contractName = AzPrThreeValueMechanicsOperands
  contractVersion = 1
  trackKey / sourceKind
  kind / operation / status / ready
  expectedDelta
  inputs

kind = hp-raw-preview-product
  operation = round-clamped-product
  inputs.baseAttack / actionMultiplier / minimum

kind = explicit-self-energy-event-sum
  operation = sum
  inputs.eventDeltas[]

kind = validated-toughness-before-after
  operation = before-minus-after
  inputs.before / after / reportedDelta

kind = validated-self-energy-before-after
  operation = after-minus-before
  inputs.before / after / reportedDelta

kind = source-value-identity
  operation = identity
  inputs.value
```

`AzPrThreeValueMechanicsAdapter` 从 v1 升级为 v2，内置 adapter 不再默认返回 `sourceValue.value`，而是调用 `calculateThreeValueMechanicsOperands()`。runtime invocation 同时保存 `operandsCalculation`，校验 operands 是否存在、可算并与 `expectedDelta` 一致；runtime state、projection 和 consumer summary 汇总 ready、missing、mismatch、calculated 数量及 kinds。无效计算仍回退 generation delta。

`Action -> Hit -> ThreeValueDelta` 从 v4 升级为 v5，generation entry validation 要求每条 source value 携带 operands 合同且 `expectedDelta` 与 delta 一致；`ThreeValueRuntimeCalculatorInvocation` 从 v3 升级为 v4。HP raw preview、显式能量变化和已验证削韧/能量样本现在由内置 adapter 从原操作数重算；本阶段没有新增公式、启用候选值或改变三值结果。

## 386. AzPrMechanicsProfile v1 / Adapter v3 / Action-Hit-Delta v6

阶段 8-N 在编译后的 Scenario 新增 profile 选择：

```text
scenario.mechanicsProfile
  schemaVersion = 1
  contractName = AzPrMechanicsProfile
  contractVersion = 1
  profileId / profileVersion
  sourceKind / status / ready
  operandKinds[kind]
    operation
    trackKeys[]
    status / applied
  supportedOperandKinds[]
  tracks[trackKey]
    outputField
    appliedLayers[]
    unappliedLayers[]
  policy
  summary

scenario.mechanicsProfileSelection
  requestedProfileId
  resolvedProfileId / resolvedProfileVersion
  fallback / fallbackReason
```

默认 profile ID 为 `azpr-three-value-preview-v1`，支持 HP raw product、显式能量求和、已验证削韧/能量前后值和兼容 identity。它只把当前已有层标记 applied；敌人防御、抗性、暴击、增伤、动作削韧、充能、培养项和等级机制继续列为 unapplied。

`compileProject(project, gameData, { threeValueMechanicsProfile })` 可以绑定其他合法 profile。`AzPrThreeValueMechanismContext` 从 v2 升级为 v3，generation request 与 runtime input 保持同一 profile 引用；`AzPrThreeValueMechanicsAdapter` 从 v2 升级为 v3，operands evaluator 通过 profile capability 的 operation 分派计算，不再按 operand kind 写死计算分支。unsupported kind、轨道或 operation 会记录 capability fallback 并使用 generation delta。

`Action -> Hit -> ThreeValueDelta` 从 v5 升级为 v6，`ThreeValueRuntimeCalculatorInvocation` 从 v4 升级为 v5。runtime state、projection 和 consumer summary 新增 profile IDs、versions、statuses、profile fallback 数和 capability ready/missing 数。默认 profile 与上一阶段三值结果完全一致，本阶段没有启用任何未确认机制层。

## 387. MechanicsLayerInputs v1 / Adapter v4 / Action-Hit-Delta v7

阶段 8-O 为每种 profile operand capability 增加 `layerKeys[]`，并在 generation request 新增版本化 `AzPrThreeValueMechanicsLayerInputs v1`：

```text
mechanicsAdapterRequest.mechanicsLayerInputs
  contractName / contractVersion
  layers
    applied[] / unapplied[] / required[]
    inputKeys[layerKey] -> inputs key
  inputs[inputKey]
    value / source / ready
  missingRequiredCount

inputs
  actorStats
  actionMultiplier
  enemyDefense
  enemyElementDefense
  cultivationConfiguration
  operands
  initialEnergy
  stateBefore
```

generation 绑定除 `stateBefore` 外的全部实际值与来源；runtime 以同一合同副本绑定当前 snapshot 的 `stateBefore`。`required[]` 只包含当前 operand capability 真正使用的 applied 层，其他 profile applied 层保持非本次必需，unapplied 层只追踪输入、不参与计算。runtime invocation 校验 `missingRequiredCount === 0`，但默认 adapter 仍按既有 profile operation 与 operands 计算。

`AzPrThreeValueMechanicsAdapter` 从 v3 升级为 v4，`Action -> Hit -> ThreeValueDelta` 从 v6 升级为 v7，`ThreeValueRuntimeCalculatorInvocation` 从 v5 升级为 v6。默认 HP、韧性、角色能量、曲线、日志和 summary 数值不变；本阶段没有启用防御、元素防御、暴击、培养或等级公式。

## 388. MechanicsEvaluation v1 / Adapter v5 / Action-Hit-Delta v8

阶段 8-P 新增 runtime 主计算结果：

```text
runtimeCalculatorInvocation.mechanicsEvaluation
  contractName = AzPrThreeValueMechanicsEvaluation
  contractVersion = 1
  status / ready
  operandsKind / operation
  requiredLayerKeys[]
  usedLayers[]
    layerKey / inputKey / source / ready
  allRequiredInputsReady
  intermediate
  delta / expectedDelta / matchesExpected
  profileId / profileVersion / capabilityStatus
```

内置 adapter 不再调用独立 operands calculator，而是从 `mechanicsLayerInputs` 解析 required 层并执行当前 profile operation。operands 仍保存在 generation source value 和 layer inputs 的来源槽中，用于来源追溯、expected delta 比较及 evaluation 失败时的 generation fallback；runtime 不再保存 `operandsCalculation`、`calculatedFromOperands` 或 operands ready/mismatch/calculated 汇总。

`AzPrThreeValueMechanicsAdapter` 从 v4 升级为 v5，`Action -> Hit -> ThreeValueDelta` 从 v7 升级为 v8，`ThreeValueRuntimeCalculatorInvocation` 从 v6 升级为 v7。旧 `runtimeCalculatorAdapters` 参数从 projection、state snapshot、invocation 和 adapter resolver 删除，替换调用只接受 `threeValueMechanicsAdapterRegistry`。默认三值结果不变，缺失 required layer、unsupported capability 和 adapter 无效输出继续回退 generation delta。

## 389. MechanicsEvaluation v2 / Adapter v6 / Action-Hit-Delta v9

阶段 8-Q 把 profile capability 的单个 `operation / layerKeys` 改为有序步骤：

```text
mechanicsProfile.operandKinds[kind].steps[]
  key
  operation
  layerKeys[]

runtimeCalculatorInvocation.mechanicsEvaluation
  contractName = AzPrThreeValueMechanicsEvaluation
  contractVersion = 2
  status / ready / capabilityReady / delta
  stepResults[]
    key / operation
    usedLayers[]
      layerKey / inputKey / source / ready
    delta / ready / status
```

`AzPrThreeValueMechanicsAdapterRegistry` 新增纯函数 `operationHandlers` 注册入口。evaluation 按 profile 顺序执行 step，向后续 handler 提供 `previousDelta`；默认 product、sum、before-minus-after、after-minus-before 与 identity 已全部迁入内置 handler。handler 缺失、异常或 layer input 不完整时停止步骤链，并继续使用 generation delta 回退。

operands v1 不再携带重复的 operation；operation 只由 profile step 决定。`AzPrThreeValueMechanicsAdapter` 从 v5 升级为 v6，`Action -> Hit -> ThreeValueDelta` 从 v8 升级为 v9，`ThreeValueRuntimeCalculatorInvocation` 从 v7 升级为 v8。默认 HP、韧性、角色能量、曲线和日志结果不变，本阶段没有启用未确认机制层。

## 390. StateEffectProposal v1 / MechanicsProfile v2 / RuntimeSnapshot v2

阶段 8-R 为 profile track 增加标准状态作用描述，step 只声明负责的轨道：

```text
mechanicsProfile.tracks[trackKey].stateEffect
  readMetric / writeMetric
  target = targetEnemy | energyOwner
  applyMode = decrease | increase

mechanicsProfile.operandKinds[kind].steps[].stateEffectTrackKeys[]

runtimeCalculatorInvocation.stateEffectProposal
  contractName = AzPrThreeValueStateEffectProposal
  contractVersion = 1
  status / ready / failureReason
  sourceStepKey / trackKey
  readMetric / writeMetric
  targetKind / targetId
  applyMode / delta
  hitKey / frameIndex
```

`AzPrThreeValueMechanicsEvaluation v3` 输出实际负责 state effect 的 step key。runtime invocation 用受信任的 track 定义校验目标、读取状态和最终 delta；`AzPrThreeValueRuntimeStateSnapshot v2` 只把 ready proposal 写入对应 accumulator。HP/韧性固定作用于目标敌人，能量固定作用于 energy owner；无目标或未知轨道不会修改状态。

`AzPrMechanicsProfile` 从 v1 升级为 v2，`AzPrThreeValueMechanicsAdapter` 从 v6 升级为 v7，`Action -> Hit -> ThreeValueDelta` 从 v9 升级为 v10，`ThreeValueRuntimeCalculatorInvocation` 从 v8 升级为 v9。旧三值字段继续供曲线、日志与兼容消费，默认三值结果不变；本阶段没有新增伤害、防御、抗性或培养公式。

## 391. ConfigurationSource v1 / MechanismConfiguration v2 / RuntimeBinding v1

阶段 8-S 在 Workbench Project 构建边界新增派生合同：

```text
project.metadata.configurationSourceContract
  contractName = AzPrWorkbenchConfigurationSource
  schemaVersion = 1
  status / ready / sourceKind
  replayIdentity
  actors[] / enemy
    entityKind / entityId
    requestedInstanceId / configurationInstanceId
    sourceStatus / ready / selectionVerified
    resolvedConfig
    resolvedConfigFingerprint / instanceConfigFingerprint
  selectionIntegrity
    ready
    requestedInstanceCount / verifiedInstanceCount / issueCount
  policy / summary
```

来源合同同时读取活动方案选择、共享配置库和已解析模拟配置。实例必须匹配实体且实例配置 fingerprint 与 resolved config fingerprint 一致，才能写入正式 `configurationInstanceId`；缺失或错配只保留 requested ID 和诊断状态。`replayIdentity` 由选中实例身份与实际模拟配置稳定生成，排除配置显示名称和导出时间，因此本地草稿、JSON、分享码与 PNG 可以独立重建并比较。

`AzPrThreeValueMechanismConfiguration` 从 v1 升级为 v2，新增 `sourceContract / configurationReplayIdentity / runtimeBinding`：

```text
scenario.mechanismConfiguration.runtimeBinding
  contractName = AzPrThreeValueConfigurationRuntimeBinding
  schemaVersion = 1
  status / ready
  configurationSource
    contractName / schemaVersion / replayIdentity / replaceable
  mechanicsProfile
    profileId / profileVersion / replaceable
  runtimeConsumer = ThreeValueRuntimeCalculatorInvocation
```

runtime context、invocation summary、snapshot summary 和 projection summary 均传播 replay identity 与 binding ready/missing 数。四载体集成测试会对重新 compile/simulate 后的来源合同、binding、state effect proposals 及完整 `runtimeOutputs` 做等价比较。本阶段不改变 WorkbenchProjectFile v13，不新增公式，也不让未确认培养字段参与计算。

## 392. WorkbenchProjectFile v14 / MechanicsProfileSelection v1

阶段 8-T 将 Workbench 草稿与项目文件从 v13 升级为 v14，每条 `WorkbenchScenarioDraft` 新增：

```text
mechanicsProfileSelection
  contractName = AzPrWorkbenchMechanicsProfileSelection
  schemaVersion = 1
  profileId
  profileVersion
```

根级字段继续镜像活动方案；本地草稿、JSON、分享码、PNG、预设、方案复制与撤销/重做均通过统一 draft snapshot 交换。v1-v13 项目或缺失该字段的方案自动迁移到 `azpr-three-value-preview-v1@1`，当前本地 storage key 更新为 `promilia-axis-tool:workbench-draft:v14`，v13 key 进入兼容读取列表。

compiler 新增 `threeValueMechanicsProfiles` 受控 registry 输入，按持久化 ID 与版本精确匹配 profile。Scenario 的 `AzPrScenarioMechanicsProfileSelection v1` 和 `AzPrThreeValueConfigurationRuntimeBinding v1` 同时记录：

```text
selectionSourceKind
requestedProfileId / requestedProfileVersion
resolvedProfileId / resolvedProfileVersion
fallback / fallbackReason
```

未注册或无效 profile 不会从项目载荷执行任意逻辑，而是回退内置默认 profile；合法注册 profile 继续是纯数据，operation 只能通过既有受控 handler registry 执行。四种项目载体的集成测试同时重放两个选择不同 profile 的方案，并比较 binding、proposal、曲线与日志。

为恢复发布余量，skill core 生产投影对 `matches.labels/values = true` 的交叉校验行省略重复 labels/values，读取端从角色技能表恢复同值；不匹配行仍保留原值与 diagnostics。空 diagnostics 不再落盘。该变化由 projection audit 守门，不改变技能逻辑或三值结果。

## 393. MechanicsProfileCatalog v1 / ProfileCompatibilityReport v1

阶段 8-U 新增只包含受信任 profile 的生产 catalog：

```text
AzPrThreeValueMechanicsProfileCatalog v1
  catalogId / catalogVersion
  status / ready / issues[]
  defaultSelection
  entries[]
    profileId / profileVersion / sourceKind
    valid / validationStatus / validationIssues[]
  profiles[]
  summary
```

只有 `validateThreeValueMechanicsProfile()` 通过的 profile 会进入可解析 `profiles[]`；重复键、无效 profile 或默认 profile 缺失会使 catalog invalid。项目载荷只提供 `mechanicsProfileSelection`，不能把 profile 对象、operation handler 或函数注入生产 catalog。compiler 默认消费生产 catalog，兼容的 `threeValueMechanicsProfiles` 参数会先构造受校验的临时 catalog。

项目级报告覆盖工作区全部方案：

```text
AzPrWorkbenchProfileCompatibilityReport v1
  status / compatible / importAllowed
  catalog
    catalogId / catalogVersion / ready
  scenarios[]
    scenarioId / scenarioName
    status = exact | missing | invalid
    resolutionStatus = exact | fallback
    requestedProfileId / requestedProfileVersion
    resolvedProfileId / resolvedProfileVersion
    fallback / fallbackReason
  summary
    scenarioCount / exactCount / fallbackCount
    missingCount / invalidCount
```

所有方案都 exact 且 catalog ready 时才允许导入。Workbench 本地恢复、分享链接、JSON/PNG、预设和对比基准在修改当前状态前执行同一门禁；不兼容导入保留当前项目。Scenario 顶层输出 catalog 与 compatibility 摘要，`AzPrThreeValueConfigurationRuntimeBinding` 同步记录 catalog ID/版本和兼容性状态。production preview 将 `profile-compatibility-gate` 列为必需能力。本阶段不新增 profile 公式或 UI 控件。

## 394. WorkbenchProjectFile v15 / GameDataCatalog 与 GameDataReference v1

阶段 8-V 将 Workbench 草稿和项目文件从 v14 升级到 v15，根级新增：

```text
gameDataBinding
  contractName = AzPrWorkbenchGameDataBinding
  schemaVersion = 1
  catalogId / catalogVersion
  dataVersion
  sourceKind
```

`AzPrWorkbenchGameDataCatalog v1` 以 `workbench-seed.json` 为生产来源，统一索引 characters、enemies、equipment、kibos 和 soulessences，并为每张表保留本地 source、记录数与同一生成数据版本。项目兼容性报告覆盖工作区全部方案及共享配置库：

```text
AzPrWorkbenchGameDataCompatibilityReport v1
  status / compatible / importAllowed
  catalog / binding
  scenarios[]
    status = exact | missing | invalid
    references[]
      tableName / kind / requestedId / id
      expectedType / resolvedType
      status / compatible / path / source
      catalogId / catalogVersion / dataVersion
  configurationLibrary
  summary
```

解析器在 draft normalizer 之前生成报告，避免未知 ID 被回退或置空后丢失诊断。当前 binding 必须精确匹配；无 binding 的 v1-v14 项目在所有引用可解析时以 `legacy` 状态迁移；stale、missing 或 invalid 项目不能替换当前 Workbench。本地草稿、JSON、分享码、PNG、预设和对比基准共用该规则。

活动配置另生成 `AzPrWorkbenchGameDataReference v1`，角色、敌人和 loadout 引用包含实际 catalog `record`、来源、版本与稳定 `referenceIdentity`。`AzPrThreeValueMechanismConfiguration` 从 v2 升级为 v3，`AzPrThreeValueConfigurationRuntimeBinding` 从 v1 升级为 v2，并新增 `gameData` binding。已解析的装备、奇波和灵子记录仅用于来源追溯，`loadoutEffectsAppliedToCalculators=false`，不改变现有三值结果。

## 395. ActionSkillReference / MechanismContext v4 / GenerationContract v7

阶段 8-W 将 skills 加入 `AzPrWorkbenchGameDataCatalog v1`。每条 skill action 在兼容性报告和活动引用合同中新增：

```text
AzPrWorkbenchGameDataReference.actions[]
  actionId
  skillId / actorCharacterId / actionVariantIndex
  status / ready / failureReason
  skill
    record
    source / catalogId / catalogVersion / dataVersion
    expectedCharacterId / allowedCharacterIds / resolvedCharacterId
    variantCount
    variant
      index / kind / label / displayLabel / source
```

导入前按原始 action draft 区分 `skill-not-found`、`skill-actor-character-missing`、`skill-actor-character-not-in-team`、`skill-actor-character-mismatch` 和 `skill-action-variant-invalid`。这些问题不会先经 `normalizeWorkbenchActionDrafts()` 回退为默认技能或合法索引；兼容性报告保留原始 requested 值并禁止替换当前 Workbench。

compiler 把引用绑定到 `scenario.actions[].gameDataReference`，并用引用中的技能 record 构造 action source。`AzPrThreeValueMechanismContext` 从 v3 升级为 v4，标准 `Action -> Hit -> ThreeValueDelta` generation contract 从 v6 升级为 v7；generation Action、Hit、Delta 与 adapter request 传播相同引用，并汇总 skill reference ready/missing action 数。项目 schema 继续为 v15，现有倍率、动作时长、命中帧和三值结果不变。

## 396. GameDataReference v2 / HpOperandSourceBinding v1 / MechanicsOperands v2

阶段 8-X 为每个已解析技能动作增加两个稳定身份：`referenceIdentity` 标识动作实例与施放角色，`skillVariantReferenceIdentity` 标识 catalog、数据版本、技能、动作变体、倍率原始值和来源字段。`AzPrWorkbenchGameDataReference` 从 v1 升级为 v2，动作 variant 现在保留 `rawValue / multiplier / source`。

compiler 为可计算技能动作生成：

```text
AzPrHpOperandSourceBinding v1
  action
    actionId / skillId / actorId / actorCharacterId / actionVariantIndex
  skillVariantReference
    identity / actionReferenceIdentity / ready
    catalogId / catalogVersion / dataVersion
    skillId / characterId / actionVariantIndex
    rawValue / multiplier / sourceIdentity
  operands
    baseAttack
      value / source / actorId / characterId
    actionMultiplier
      value / rawValue / actionVariantIndex / sourceIdentity
  validation
    ready / status / issueCodes / issues
```

`AzPrThreeValueMechanicsOperands` 从 v1 升级为 v2。`hp-raw-preview-product` 保存 `sourceBindingRequired / sourceBindingReady / sourceBindingStatus / sourceBinding / sourceBindingValidation`；generation delta 和 runtime summary 汇总 ready/invalid 数。adapter evaluation 从 v3 升级为 v4，adapter 从 v7 升级为 v8，runtime invocation 从 v9 升级为 v10，标准 generation contract 从 v7 升级为 v8。

正常 binding 仍执行原 `round(baseAttack * actionMultiplier)` 并保持同一 HP delta。skill/variant identity、角色、倍率、来源字段、layer input 或 expected delta 漂移时，evaluation 保留明确 issue code，invocation validation 标记无效，但不会静默改用另一技能或倍率来源。项目 schema 继续为 v15，未接入防御、抗性、暴击、装备、奇波或灵子公式。

## 397. ThreeValueAppliedSourceBinding v1 / MechanicsOperands v3

阶段 8-Y 新增 `AzPrThreeValueAppliedSourceBinding v1`，用于 HP 之外的已应用来源：

```text
AzPrThreeValueAppliedSourceBinding v1
  kind = explicit-self-energy-events | validated-runtime-sample
  trackKey / sourceKind / identity / expectedDelta
  sources
    events[]
      eventIndex / eventType / actionId / actorId / timeMs
      resource / change / reason / confidence
    sample
      runtimeSampleEventKey / captureSessionId / eventIndex / eventType
      actionId / actorId / targetId
      roleEntityId / targetEntityId
      sourceElementConfigId / elementConfigId / pathId
      frameIndex / timeMs / before / after / delta
  ready / status / issueCodes / issues
```

`RESOURCE_CHANGE` 投影保留动作、角色、时间和事件序号；validated sample binding 直接来自已经通过 `threeValueMechanismSampleAdapter` 的 point。`AzPrThreeValueMechanicsOperands` 从 v2 升级为 v3，四类已应用 operand kind 共用 `sourceBindingRequired / Ready / Status / Kind / Identity / Validation`。

generation delta 新增 `appliedSourceBindingState`，取值为 `bound-ready / compatible-unbound / bound-drift`，并在 generation、runtime invocation、state snapshot 和 projection summary 汇总 ready、invalid、compatible-unbound 与 binding kinds。正式 binding 的事件、capture、作用实体、Element/path、帧位、before/after 或 delta 漂移会留下 issue code；旧 fixture 没有新身份时明确进入兼容未绑定，不误报为正式 binding 漂移。

`AzPrThreeValueMechanicsAdapter` 从 v8 升级为 v9，evaluation 从 v4 升级为 v5，runtime invocation 从 v10 升级为 v11，标准 generation contract 从 v8 升级为 v9。项目 schema 继续为 v15，现有 HP、韧性、角色能量、曲线和日志结果不变；没有新增倍率、公式或培养效果。

## 398. Applied source production guard / compact source ID ranges

阶段 8-Z 没有升级项目 schema 或三值合同版本。新增 `applied-source-binding-audit` 报告，按 applied delta 记录 `trackKey / state / kind / identity / status / issueCodes`，并把三轨缺失、`bound-drift` 和无法解释的 `compatible-unbound` 作为生产阻断条件。

`workbench-skill-core.json` 中连续的 `labelIds[] / valueIds[]` 改为紧凑投影：

```text
labelIdRange = [firstId, count]
valueIdRange = [firstId, count]
```

`resolveSkillLevelCrossCheck()` 在领域访问层恢复原字符串 ID 数组；非连续或旧投影仍兼容原数组字段。完整 `skill-level-crosscheck.json` 不变，动作倍率来源、skill variant source identity 和运行结果不变。

## 399. WorkbenchTimelineTopology v1 / fixed three-slot team

Stage 9-A 新增派生合同 `AzPrWorkbenchTimelineTopology v1`。项目 schema 继续为 v15，拓扑存放在运行时 Project 的 `metadata.timelineTopology`，无需为持久化文件复制一份可漂移结构；本地草稿、JSON、分享链接和 PNG 仍持久化 `teamSlots / actorConfigs / enemyConfig`，回导后重新生成并比较同一拓扑。

```text
timelineTopology
  actorGroups[3]
    slotId / position / characterId / actorId
    actionLane { laneId, kind = actor-action, editable }
    kiboLane { laneId, kind = actor-kibo, kiboId, appliedToCalculators = false }
    energyCurve { laneId, kind = actor-energy-curve, trackKey, actorId }
  enemyGroup
    eventLane { laneId = enemy-events, kind = enemy-event }
    hpCurve { laneId = enemy-hp-curve, trackKey = enemyHpDamage }
    toughnessCurve { laneId = enemy-toughness-curve, trackKey = enemyToughnessDamage }
  policy / summary
```

`normalizeWorkbenchTeamSlots()` 与 `normalizeWorkbenchActorConfigs()` 现在固定输出 3 个唯一、可解析角色；旧双角色项目在导入时补齐第三槽和对应空配置实例，现有主副角色 selection 字段继续兼容。敌人事件的冲突轨道从 `system` 改为 `enemy-events`，annotation 仍保留在 `system`。奇波配置只决定关联轨的显示与来源边界，未确认效果仍不参与三值计算。

## 400. Runtime state curves to timeline step geometry

Stage 9-B 不升级项目 schema 或 runtime 合同。`TimelineGridPreview` 新增只读 `runtimeStateCurves` 输入，Workbench 和 PNG 导出都传入既有 `simulationResult.runtimeOutputs.stateCurves`；曲线几何是运行时派生视图，不进入本地草稿、JSON、分享链接或 PNG 元数据，因此项目载体仍只保存动作和配置来源，回放后由标准 runtime 重建同一结果。

```text
runtimeStateCurves
  enemy
    stateMetrics.hp / stateMetrics.toughness
    points[] { trackKey, timeMs, frameIndex, stateSnapshot.after }
  resources.curvesByActor[]
    actorId / stateMetric
    points[] { trackKey, timeMs, frameIndex, stateSnapshot.after.selfEnergy }

timeline curve view
  initialValue / currentValue / maxValue
  breakpoints[] { actionId, timeMs, frameIndex, currentValue, xPercent, yPercent }
  stepPoints = 0 -> event horizontal -> event vertical -> ... -> 100
```

只有 runtime 的 applied points 参与阶跃线；候选、采样诊断和 placeholder marker 继续使用原有独立图层，不改变实际状态。HP/韧性使用 runtime 已有的零值下限，角色能量保留 runtime 当前值；三者不新增公式。刻度 viewport 与轨道 viewport 共享 zoom width 并同步 `scrollLeft`，所以动作、命中、断点和网格使用同一横向坐标。

## 401. Workbench timeline-first layout contract

Stage 9-C 不升级项目 schema、timeline topology 或 runtime 合同。Workbench 的可见布局改为两层：`primary-flow` 独占全宽首行并持续承载 `TimelineGridPreview`，`review-workspace` 与动作库、检查区位于第二行；运行结果阶段不再改变时间轴与复盘区的先后顺序。1180px 以下切为两列，760px 以下依次展开 `primary-flow -> review-workspace -> action-library -> side-stack`。

轨道高度仍是派生视图状态：角色动作轨默认 64px，奇波轨 36px，状态曲线 40px，轨间距 4px；动作重叠槽、效果区间和候选诊断会通过现有 lane layout 计算增加高度。该密度信息不写入本地草稿、JSON、分享链接或 PNG 元数据，因此不同载体仍由同一动作、配置、`timelineTopology` 和 `runtimeStateCurves` 重建布局与结果。

## 402. Project schema v16 / WorkbenchTimelineEntry v1 / KiboEvent

Stage 10-A 将 Workbench 项目 schema 从 v15 升级为 v16，并新增 tracking-only `kiboEvent` 动作。旧 v15 本地草稿继续作为迁移输入读取，新草稿使用 `promilia-axis-tool:workbench-draft:v16`；JSON、分享链接和 PNG 元数据统一输出 v16。

```text
kiboEvent action
  type = kiboEvent
  actorCharacterId / actorId
  kiboId
  eventType / note
  appliedToCalculators = false

WorkbenchTimelineEntry v1
  actionType / label / source
  legalLaneKind
    skill | switch | resource -> actor-action
    kiboEvent -> actor-kibo
    enemyEvent -> enemy-event
```

`workbenchTimelineEntry` 是时间轴编排源和合法落轨判断的统一领域入口。角色动作只可在角色动作轨之间重绑，奇波事件只可在奇波轨之间重绑并随目标角色解析当前 `kiboId`，敌人事件只进入敌人事件轨。compiler 和 runtime 会保留奇波事件的角色、奇波和来源身份，并输出 `KIBO_EVENT` 日志；该事件不生成 Hit 或 `ThreeValueDelta`，所以不会改变角色能量、敌人 HP 或敌人韧性。五种项目载体仍以持久化动作和配置重建 `timelineTopology` 与 runtime curves，不持久化 UI 拖放状态。

## 403. WorkbenchTimelineBatchLaneMovePlan / atomic multi-track edits

Stage 10-B 不升级项目 schema、runtime 或三值合同。`workbenchTimelineEntry` 新增派生的批量换轨计划：

```text
WorkbenchTimelineBatchLaneMovePlan
  actionIds / primaryActionId
  sourceOwnerId / targetOwnerId / changesOwner
  targetLaneId / targetLaneKind
  entries[]
    actionId / laneKind / sourceOwnerId

move-selected-actions request
  actionIds / primaryActionId
  offsetMs / targetLaneId
```

换轨计划要求所有选中动作都属于同一个角色，且每项都为 `actor-action` 或 `actor-kibo`；目标轨种类必须匹配主拖动动作。这样角色动作和奇波事件可一起迁移到目标角色的配对轨道，而敌人事件、多来源角色选择和 system 动作不会被误重绑。水平偏移和角色重绑在 Workbench 中一次提交并只生成一个历史快照；动作关系由现有 gap synchronizer 在提交后重建相同相对间隔。

批量计划与框选状态均为 UI/领域派生状态，不进入持久化格式。剪贴板继续保存选中动作和组内关系，方案复制、本地草稿、JSON、分享链接和 PNG 回放从 v16 动作与配置重建同一拓扑、关系和 runtime outputs。奇波事件仍为 tracking-only，批量换轨不会使装备、奇波、灵子或其他未确认效果进入 calculator。

## 404. Timeline frame cursor / runtime point review

Stage 10-C 不升级项目 schema、runtime 或三值合同。Workbench 新增受控的瞬态 `timelineCursorFrameIndex`，并由 60fps 帧索引派生 `timeMs`。该状态不写入本地草稿、JSON、分享链接或 PNG 元数据，项目回放仍由持久化动作、配置和标准 runtime outputs 重建。

```text
timeline cursor view
  frameIndex / timeMs
  source = grid | cursor | action | state-point | runtime-log
  stateAtFrame
    actorEnergy[3]
    enemyHp
    enemyToughness
```

`TimelineGridPreview` 消费既有 `runtimeStateCurves` 和 state point context，将每条曲线的 initial value 与 `frameIndex <= cursorFrameIndex` 的最后一个 applied point 合成为该帧状态。动作选择定位动作起始帧，曲线断点和 runtime 日志通过 state point identity 定位准确事件帧；空白网格和游标拖动只改变瞬态帧位置，并清除不再匹配的 runtime point 选中状态。编辑动作后 runtime outputs 更新，帧游标位置不变，五条曲线按新的事件位置重新求值。

游标、动作块、命中/状态点、曲线断点和时间网格继续使用同一个 track width 与帧百分比坐标。缩放和横向滚动只改变派生视图，未改变动作、状态点或项目载体内容；候选值、未应用奇波效果及其他诊断层不参与该帧状态计算。

## 405. Timeline playback view state / cycle range

Stage 10-D 不升级项目 schema、runtime 或三值合同。Workbench 在既有 `timelineCursorFrameIndex` 上增加纯瞬态播放状态：

```text
timeline playback view
  running
  rate = 0.5 | 1 | 2
  rangeMode = axis | section
  range
    startFrame
    endFrame
    lastFrame
    loop
    sectionId
```

全轴范围为 `0..durationFrame`，抵达 `durationFrame` 后暂停。区段范围由既有 `AzPrCycleSectionProjection` 的 `startMs/endMs` 转换为 `[startFrame, endFrame)`，逐帧和连续播放使用同一正模运算回绕。时钟通过 `requestAnimationFrame` 按 `elapsedMs * scenario.fps * rate` 累计完整帧，并保留不足一帧的余数；任何手动游标定位都会暂停播放。

`EventLogPanel` 仅按 `cursorFrameIndex` 派生 `data-cursor-current`，不会改写 runtime 选中点或 sim log。播放状态在项目应用、重置与组件卸载时清除，不进入本地草稿、JSON、分享链接、PNG 或预设；cycle boundaries 仍是唯一持久化范围来源，五条状态曲线继续只消费 applied runtime outputs。

## 406. Workbench skill core projection v2 / implied defaults

Stage 10-E 只升级生产内部 `workbench-skill-core.json` 为 schema v2，不改变 Workbench 项目、runtime 或三值合同。完整生成源表保持原结构；core 投影对规范等级行省略可无歧义恢复的默认字段：

```text
skillLogicIndex.items[].levels[index]
  level       := index + 1
  levelIndex  := index
  subSkillId  := items[].subSkills[0].subSkillId when exactly one exists

skillLevelCrossCheck.items[].levels[index]
  level       := index + 1
  levelIndex  := index
  status      := matched
  matches     := { labels: true, values: true }
```

非规范 level/index、多 subSkill 映射、非 matched 状态和任一 false match 继续显式写入。`skillLogicModel` 与 `skillLevelCrossCheck` 是唯一默认恢复入口；下游仍获得原有 `level/levelIndex/subSkillId/status/matches`，字段路径、倍率、HP operands、诊断和 runtime outputs 不变。数据投影审计从完整源文件重新生成 v2 并要求深度一致，bundle audit 的总 JS gzip 硬门槛从 740,000B 收紧到 735,000B。

长轴浏览器报告新增播放守门字段：`playback.startFrame/endFrame/advancedFrames`、滚动起止与差值、速度、推进预算，以及 rAF requested/canceled/active。它们是测试报告，不进入任何项目或运行时合同。

## 407. Contribution window projection v2 / runtime point anchors

Stage 11-A 将内部 `AzPrCycleSectionProjection` 升级为 schema v2，并声明共享的 `AzPrContributionWindowProjection`。项目 schema、runtime output 和三值 calculator 合同不变；窗口分析只筛选和分组现有 applied hit transactions。

```text
AzPrCycleSectionProjection v2
  fullAxis
  sections[]
  windows = [fullAxis, ...sections]

ContributionWindow
  windowId / kind = axis | section
  startMs / endMs / durationMs
  metrics
    enemyHpDelta / enemyToughnessDelta / selfEnergyDelta
  actors[]
    actorId / characterId
    enemyHpDelta / enemyToughnessDelta / selfEnergyDelta
    transactionCount / actionCount
  actions[]
    actionId / actorId
    enemyHpDelta / enemyToughnessDelta / selfEnergyDelta
    hitCount / effectEventCount
    statePointId / frameIndex / timeMs
```

HP 与韧性贡献归属 transaction actor；能量贡献归属 `energyOwnerActorId`，缺失时回退到 transaction actor。动作的 `statePointId` 由 transaction `sourceDeltaIds` 与既有 runtime state point contexts 关联，用于统一帧游标、曲线、日志和动作编辑定位。这些窗口、聚合与锚点均为响应式派生视图，不写入本地草稿、JSON、分享链接、PNG 或预设；回放后由同一项目与 runtime outputs 重建。

## 408. Scenario comparison v2 / paired contribution windows

Stage 11-B 将内部 `AzPrWorkbenchScenarioComparison` 升级为 schema v2。Workbench 项目仍为 v16，runtime outputs、三值 calculator、本地草稿和交换载体均不升级；比较结果由两份 `AzPrContributionWindowProjection` 派生。

```text
AzPrWorkbenchScenarioComparison v2
  requestedWindowId / windowId
  windows[]
    windowId / kind / label
    currentAvailable / baselineAvailable / comparable
    currentRange / baselineRange
  current / baseline
    sourceKind / sourceId
    window
    metrics / actors / actions / effects
  actors[].metrics
    enemyHpDelta / enemyToughnessDelta / selfEnergyDelta
      current / baseline / delta / changed
  actions[]
    currentActionId / baselineActionId
    currentStatePointId / baselineStatePointId
    currentFrameIndex / baselineFrameIndex
    metrics
```

可选窗口取两侧窗口 identity 的并集，只有双方都存在时 `comparable=true`；请求不可比较窗口时回退到双方共有的全轴。无 cycle boundary 的 `AzPrContributionWindowProjection.windows` 现在只包含 `full-axis`，内部 `sections[0]` 仍保留供 cycle playback 兼容，但不再暴露为重复的“循环 1”分析窗口。

当前侧定位继续使用活动项目；工作区基准侧通过既有 scenario switch 恢复其持久化 draft，快照/预设/导入基准则通过 `addWorkbenchScenarioFromDraft` 形成独立方案。切换后 state point identity 和 frame 由目标方案自己的标准 runtime 重建，不把比较结果写回项目，也不把 candidate/unapplied 数据升级为 applied 输入。

## 409. Workbench skill core projection v3 / inter-level ID series

Stage 11-C 只升级生产内部 `workbench-skill-core.json`。Workbench 项目继续使用 v16，runtime output、三值 calculator、完整 `skill-level-crosscheck.json` 与诊断证据均不改变。对于跨等级呈稳定等差变化的 ID 范围，core v3 在技能项上保存序列定义：

```text
skillLevelCrossCheck.items[]
  labelIdSeries = [baseId, stride, defaultCount?]
  valueIdSeries = [baseId, stride, defaultCount?]

skillLevelCrossCheck.items[].levels[]
  labelIdCount?  # 仅当该级数量偏离序列默认值
  valueIdCount?  # 仅当该级数量偏离序列默认值
```

读取层按等级位置恢复 `labelIdRange/valueIdRange`；单等级技能和不能由等差序列表达的范围继续保留直接 range。v2 的直接 `labelIdRange/valueIdRange` 仍可读取，生成审计从完整源重新投影并深比较等级 1、等级 12 与 mismatch 结果。该压缩不进入本地草稿、JSON、分享链接、PNG 或预设，也不改变任何 applied delta、状态曲线或来源绑定。

## 410. Workbench analysis report v1 / frozen applied runtime snapshot

Stage 12-A 新增独立交换合同 `workbench-analysis-report` v1。它不是 Workbench 项目 schema，也不会写入本地草稿、分享链接、项目 PNG 或 runtime output；报告通过统一文件接收器单独分流。

```text
WorkbenchAnalysisReport v1
  game = azur-promilia
  type = workbench-analysis-report
  analysisKind = contribution-window | scenario-comparison
  exportedAt / title
  project
    schemaVersion / id / name / fps / durationMs
  calculationBoundary
    sourceKind = applied-runtime-outputs
    readsRuntimeOutputsOnly = true
    appliedToCalculators = false
    excludedSourceKinds = [candidate, unapplied]
  sources[]
    role = current | baseline
    label / sourceKind / sourceId
    projectId / projectName / windowId
    scenarioDraft
  appliedSourceBindings[]
    role
    transactions[]
      transactionId / actionId / hitId
      actorId / energyOwnerActorId
      frameIndex / timeMs
      sourceDeltaIds[]
      delta.enemyHp / enemyToughness / selfEnergy
  analysis
    window | comparison
  summary
```

创建器只复制既有贡献窗口、方案比较和 applied hit transactions，不重新聚合或计算三值。解析器要求角色来源唯一且完整，规范化嵌入的 `scenarioDraft`，并验证分析动作与每条 transaction 的 `actionId` 均存在于对应来源草稿、`sourceDeltaIds` 非空且 transaction/source-delta identity 不重复；任一引用漂移都会拒绝整个报告。合法报告的来源通过 `addWorkbenchScenarioFromDraft` 加入当前工作区，再由标准 compiler/runtime 重建 state point 与曲线，冻结报告本身不作为 calculator 输入。

## 411. Workbench analysis report PNG metadata v1

Stage 12-B 新增独立 PNG 元数据类型 `workbench-analysis-report-png` v1，使用 tEXt key `PromiliaAxisAnalysisReport`。它与项目 PNG 的 `PromiliaAxisToolData` 并存但不共享类型判定；统一文件接收器先尝试项目元数据，再尝试分析报告元数据。

```text
WorkbenchAnalysisReportPngMetadata v1
  game = azur-promilia
  type = workbench-analysis-report-png
  exportedAt
  reportSchemaVersion = 1
  reportType = workbench-analysis-report
  analysisKind = contribution-window | scenario-comparison
  sourceCount / actionReferenceCount
  payloadEncoding = base64url-json
  payload
```

`payload` 是经 UTF-8 base64url 编码的完整、已规范化 `WorkbenchAnalysisReport` v1。读取 PNG 时先验证 PNG signature、chunk 边界和 CRC，再验证元数据 envelope，解码 payload 后重新调用 `validateWorkbenchAnalysisReport`；任一环节失败都返回无效文件，不恢复部分来源。项目分享码与报告 PNG 现共用 `src/utils/base64Url.js` 的 UTF-8 编解码实现，但各自 schema、metadata key 和解析入口保持独立。PNG 画面只是报告的可视交付层，不进入项目、runtime 或 calculator 合同。

## 412. Workbench analysis report reproducibility audit v1

Stage 12-C 新增只读 `AzPrWorkbenchAnalysisReportReproducibilityAudit v1`。它不是报告 schema 的新版本，也不写回 JSON/PNG 元数据；每次打开报告时由当前生产游戏数据、profile catalog、compiler、runtime 和窗口投影即时生成。

```text
AzPrWorkbenchAnalysisReportReproducibilityAudit v1
  status = exact | drift | incompatible
  analysisKind / reportSchemaVersion
  reasonCode / reason / failedRole
  sources[]
    role / sourceId / windowId
    requestedProfileId / resolvedProfileId
    profileStatus / gameDataStatus
    actionCount / appliedTransactionCount
  differences[]
    path
    kind = value-changed | type-changed | missing-current | unexpected-current
    expected / actual
  summary
    sourceCount
    differenceCount / reportedDifferenceCount / omittedDifferenceCount
    frozenAppliedTransactionCount / replayedAppliedTransactionCount
  calculationBoundary
    readsEmbeddedSourceDrafts = true
    readsCurrentRuntimeOutputs = true
    writesProjectState = false
    overwritesFrozenReport = false
    appliedToCalculators = false
```

审计先重新验证 `WorkbenchAnalysisReport v1`，再对每个来源执行 profile/game-data exact 门禁和标准 compile/runtime。贡献报告重建相同 `windowId` 的 `ContributionWindow`；方案比较重建双方同一比较窗口。仅比较冻结 `analysis`、`appliedSourceBindings` 与派生 `summary`，完全一致为 `exact`；可重放但字段不同为 `drift`，记录完整差异计数并最多返回 12 条最小路径；来源、profile、游戏数据或窗口无法精确解析时为 `incompatible`，不接受 fallback 结果。审计对象不进入项目载体、runtime state 或 calculator 输入。

## 413. Workbench timeline topology v2 / six independent energy owners

M1-B 将派生的 `AzPrWorkbenchTimelineTopology` 升级到 v2。Workbench 项目继续使用 v16；角色、奇波和敌人选择仍由既有 `teamSlots / actorConfigs / selection` 持久化，拓扑在项目构建时重建，因此旧项目不需要迁移。

```text
timelineTopology.actorGroups[]
  actionLane
  energyCurve
    trackKey = selfEnergyChange
    actorId
  kiboLane
    kiboId / kiboName
  kiboEnergyCurve
    trackKey = kiboEnergyChange
    slotId / actorId / characterId
    kiboId / kiboName
    trackingOnly = true
    appliedToCalculators = false

runtimeOutputs.resources
  curvesByActor[]  # 3 role energy owners
  curvesByKibo[]   # 3 kibo energy owners
  summary
    actorCount / kiboCount
    energyCurveCount = 6
```

`curvesByKibo` 当前由 `AzPrKiboEnergyRuntimeCurves v1` 生成独立零值基线。未确认奇波机制不会生成 applied point，也不会进入三值 calculator、state snapshot 或 sim log；时间轴仍绘制从 0 到轴末的完整平线。敌人 HP 与韧性沿用既有独立曲线，因此 Workbench 当前总状态曲线数为 8。五载体回放测试比较同一 topology、奇波所有者和 runtime resource curves。

## 414. Action library pointer drag / existing timeline entry contract

M1-C 没有升级 Workbench 项目 v16，也没有新增持久化或 calculator 字段。动作库拖拽先把技能、资源、奇波事件或敌人事件规范化为既有 `WorkbenchTimelineEntry`，Workbench 仅在一次指针操作期间保存临时拖拽状态：

```text
ActionLibraryPointerDrag (transient only)
  entry: WorkbenchTimelineEntry
  pointerId / startX / startY
  active / targetLaneId
```

落点继续由 `resolveWorkbenchTimelineLaneTarget` 和 `isWorkbenchTimelineEntryAllowedInLane` 校验，再调用既有 `insertTimelineEntry({ entry, laneId, startMs })`。`startMs` 使用 60fps 帧吸附；后续动作草稿、runtime outputs、六条能量轴、敌人 HP/韧性、日志和项目交换均沿用原合同。因此本阶段不需要 schema migration，指针状态也不会进入本地草稿、JSON、分享链接或 PNG。

## 415. Built-in M1 demo / existing Workbench v16 contracts

M1-D 没有升级 Workbench 项目 schema。`createDefaultWorkbenchDemoDraftState()` 使用现有 v16 草稿、方案工作区、动作、角色配置和 runtime sample capture 合同生成首次打开时的示例；重置或新建方案仍使用基础草稿，不会重复注入示例。

```text
DefaultWorkbenchDemoDraft (Workbench v16)
  scenario name = 示例方案 · 预览数据
  actorConfigs[3].loadout.kiboId
  actionDrafts
    actor skill actions
    explicit actor resource action
    kibo event
    enemy event
  runtimeSampleCaptures
    built-in preview toughness event
```

示例资源动作只写入所属角色的既有 `selfEnergyChange`；3 条奇波能量轴继续来自 `curvesByKibo` 的 tracking-only 零值基线。内置韧性事件的来源明确包含 `example/preview`，因此不能通过 production capture 真实性门禁，也不会成为新的机制证据。方案复制、本地草稿、JSON、分享链接和 PNG 直接序列化现有字段，无新增迁移或兼容分支。

## 416. Six-energy runtime point accounting

M1 后置一致性收口没有升级项目或运行时 schema，只为既有可选 summary 增加角色/奇波事件点数拆分：

```text
runtimeOutputs.resourceCurves.summary
  actorPointCount
  kiboPointCount
  pointCount = actorPointCount + kiboPointCount

runtimeOutputs.summary / outputContract.summary / consumer.summary
  resourceCurveActorPointCount
  resourceCurveKiboPointCount
  resourceCurvePointCount
```

`outputConsistency` 现在分别核对角色与奇波点数，并把 `curvesByKibo[].points` 纳入统一状态点引用审计。旧载体没有这些拆分字段时仍由 consumer 从两组曲线计算，不需要迁移；当前 tracking-only 奇波曲线的 `kiboPointCount` 为 0。

## 417. Kibo energy runtime semantics v2

`AzPrKiboEnergyRuntimeCurves` 从 v1 升级为 v2，但项目仍为 Workbench v16，数值与曲线点不变。每条奇波曲线新增只读来源语义：

```text
curvesByKibo[]
  resource = kibo-energy
  semanticResource = pet-ultimate-readiness
  sourceSemantics
    sourceKind = azpr-pet-ultimate-cooldown-observation
    status = observable-contract-confirmed-values-unresolved
    observation
      api = PetUltimateCdTime
      remainingValue = cdTime
      totalValue = totalTime
      readyWhen = cdTime <= 0
      uiFillExpression = cdTime / totalTime
      valueUnit = seconds
    initialValueSourceStatus = unresolved
    totalValueSourceStatus = unresolved
    eventValueSourceStatus = unresolved
    trackingOnly = true
    appliedToCalculators = false
```

时间轴拓扑的 `kiboEnergyCurve` 同步记录 `semanticResource` 与 `valueSourceStatus`，但不持久化新的战斗数值。旧项目重建拓扑和 runtime 时会自动获得这些字段，无需迁移；在真实 `totalTime` 与事件来源接入前，奇波轴仍保持 0 基线、0 点和平线。

## 418. Workbench kibo action catalog v1

生成层从 `pet.json` 与 AzPr Extractor 导出的 Skill Control root 建立完整奇波动作映射。`kibos.json` 保留来源审计所需的原始技能集合、源帧数、源帧率、源时长、60fps 规范时长和提取文件；生产 Workbench 使用独立静态目录，避免把完整审计字段打进主 JS：

```text
workbench-seed.json schema v3
  catalogs.kiboActions = workbench-kibo-action-catalog.json

workbench-kibo-action-catalog.json v1
  kind = workbench-kibo-action-catalog
  items[]
    kiboId
    actions[3]
      skillId
      kind = signature | active | break
      name
      durationFrames  # normalized to Workbench 60fps

WorkbenchActionDraft v16-compatible optional fields
  name
  timingSource
  needsTimingData
```

Workbench 项目 schema 仍为 v16；新增动作字段均为可选字段，旧项目缺失时继续按原奇波事件回退。新目录只负责动作身份与已确认时长，不提供能量或战斗效果；`createKiboEventAction`、compiler 和 sim log 只有在存在 `timingSource` 时才携带真实 `skillId`。因此目录加载失败不会把未知时序伪装成已确认数据，奇波动作仍保持 `appliedToCalculators = false`，六条能量轴结果不变。

## 419. Unified Workbench action visual identity

动作目录与运行时动作新增可选视觉身份字段，项目仍为 Workbench v16，无 schema migration：

```text
workbench-kibo-action-catalog.json v1
  items[].actions[]
    icon  # official Texture2D filename

WorkbenchActionDraft / RuntimeSkillAction / WorkbenchTimelineEntry
  icon?       # kibo drafts persist this field; role actions derive it from skill data
  actionKind? # role action semantic kind

WorkbenchActionVisualIdentity (derived, not persisted as a second model)
  name
  typeLabel
  durationFrames
  iconUrl = /assets/actions/{icon}
```

`scripts/sync-workbench-action-icons.mjs` 从 AzPr Extractor 的官方 `SkillIcon` 目录把生成数据实际引用的文件复制到 `public/assets/actions/`；文件名必须是不含路径分隔符的 `.png`，避免项目载体写入任意资源路径。奇波动作在复制、本地草稿、JSON、分享链接和 PNG 中保留可选 `icon`，旧载体缺失时使用通用动作图标；角色动作从正式技能目录按 `skillId` 重新获得图标和类型。该合同只影响展示身份，不进入 compiler/calculator，不改变六条能量轴、敌人 HP/韧性或 applied/unapplied 结果。

## 420. Runtime timeline event projection

本阶段没有修改 Workbench v16 schema，也没有新增 runtime output contract。时间轴只从现有 `runtimeStatePointContexts` 派生瞬态事件投影：

```text
RuntimeTimelineEventMarker (derived, not persisted)
  actionId
  kind = hit | resource
  frameIndex
  statePointIds[]
  title
```

同一动作、同一准确帧的 HP、韧性与能量 state point 按 `actionId + frameIndex` 聚合为一个命中节点；独立资源 state point 继续按自身 identity 形成资源节点。点击节点复用既有 `select-runtime-state-point` 主流程，统一驱动帧游标、曲线断点选中和检查器详情，不引入第二套选择状态或帧归一化。

`AnalysisPanel` 不再显示重复的逐段 `damageTimeline` 原始列表，但 simulation 仍保留该输出供兼容 consumer 和 summary 使用。`runtimeOutputs.resourceCurves` 的 3 条角色能量曲线与 3 条奇波能量曲线均未变化；本阶段没有新增 mechanics、calculator 或 applied delta。

## 421. Runtime event collision layout

`RuntimeTimelineEventMarker` 仍是非持久化投影，字段和 runtime contract 均未变化。仅布局阶段由“同帧计数”改为按准确帧百分比与当前 `timelineZoom` 分配最低可用层级：默认缩放下像素可能重叠的相邻事件进入不同 `timelineEventSlot`，放大后间距足够则复用同一层级。

该布局只影响事件按钮的 `top` 与轨道所需显示高度，不改变 `frameIndex`、`statePointIds`、曲线点、日志、项目交换或 6 条能量轴。点击仍通过既有 `select-runtime-state-point` 合同选择准确 state point。

## 422. Workbench viewport-preserving runtime review

本阶段没有修改 Workbench v16、runtime output、选择状态或项目交换 schema。`EventLogPanel` 在同步选中日志时只调整 `.runtime-log-list.scrollTop`；Workbench 侧边检查器只调整自身滚动位置。动作编辑仍复用既有 `workbenchActionEditSource` 与 runtime sync request，但定位编辑控件后恢复文档原滚动坐标，避免复盘流程离开时间轴主视口。

该变化只约束 UI 容器的滚动所有权，不改变 `statePointId`、`frameIndex`、日志顺序、曲线断点、五载体回放或 6 条能量轴。

## 423. Fixed-slot character identity migration

本阶段没有升级 Workbench v16 或新增持久化字段。`teamSlots[]` 继续以 `slotId = team-slot-1/2/3` 作为稳定位置身份；用户替换或交换角色时，Workbench 从变更前后槽位建立瞬态 `oldCharacterId -> newCharacterId` 映射，并统一迁移：

```text
actionDraft.actorCharacterId
switchAction.targetCharacterId
actionLibraryCharacterId
```

迁移后的动作继续进入既有 `normalizeWorkbenchActionDrafts(actionDrafts, selection, teamSlots)`，因此技能、轨道与 runtime 均按新角色合法化。映射不写入项目文件；本地草稿、JSON、分享链接和 PNG 仍只保存现有 `teamSlots` 与 action draft。3 条角色能量轴和 3 条奇波能量轴继续从槽位拓扑派生，总数与所有者合同不变。

## 424. Explicit empty action list

Workbench v16 项目 schema 未升级，但草稿归一化现在区分“显式空列表”与“旧数据缺失字段”：

```text
actionDrafts = []              # 合法空方案，原样保留
actionDrafts = missing/non-array # 兼容旧草稿，生成一个默认动作
selectedActionId = ""          # 空方案无选中动作
```

`createWorkbenchProject()` 接受 `actions: []`，compiler 与 runtime 输出零动作、零事件以及完整初始状态曲线。删除单个动作、多选动作或整个生成批次都可以产生空列表；无选中动作时，新增入口从当前动作库角色与方案选择推导首个动作的默认上下文。

本地草稿、JSON、分享链接和 PNG 继续使用现有字段，因此无需迁移。3 条角色能量轴、3 条奇波能量轴与敌人 HP/韧性在空方案中均保持全长初始平线；奇波能量仍为 `tracking-only / unapplied`。

## 425. Controlled actor state and runtime timeline

`AzPrInitialRuntimeState` 从 v1 升级为 v2，新增显式初始前台；旧草稿或导入项目缺失该字段时，由固定队伍槽位 1 合成兼容值：

```text
initialRuntimeState.controlledActor
  actorId
  characterId
  actorName
  baselineStatus = baseline-project-initial-controlled-actor
                 | baseline-inherited-from-cycle-boundary
```

运行时新增补充合同 `AzPrControlledActorTimeline` v1：

```text
controlledActorTimeline
  initialActor / finalActor
  transitions[]
    actionId
    frameIndex / timeMs
    sourceActor / beforeActor / targetActor / afterActor
    status
    applied
  intervals[]
    actorId / characterId
    startFrameIndex / endFrameIndex
    sourceTransitionId
```

`AzPrThreeValueRuntimeOutputs` 从 v3 升级为 v4，并通过 `supplementalOutputNames = [controlledActorTimeline]` 暴露该时间状态；既有六项 canonical output、三值 delta、6 条能量轴和 output count 均不改变。切人只更新控制身份，不写入 HP、韧性或能量轨道。

循环边界使用 `strictlyBefore` 读取边界前一刻的受控角色，避免把恰好位于边界的切人同时应用到上下游。方案复制、本地草稿、JSON、分享链接和 PNG 继续序列化现有 `initialRuntimeState` 与 action draft，旧载体由 normalization 自动迁移，无需新增项目 schema 版本。

## 426. Action/effect relation graph v1

Workbench 项目仍为 v16；没有新增持久化关系字段。compiler 现把既有 `project.actionRelations` 带入 scenario，运行时再把它与 `actions[].effectCommands`、效果时间线和动作执行计划组合为统一补充输出：

```text
AzPrActionEffectRelationGraph v1
  nodes[]
    endpointKind = action | effect
    actionId? / instanceKey? / effectId? / targetKind? / targetId?
  edges[]
    edgeId
    kind = sequence | effect-trigger | effect-refresh | effect-consume
    sourceEndpoint / targetEndpoint
    commandActionId? / effectCommandId? / runtimeEventId?
    sourceActionIds[]
    sourceTimeMs / targetTimeMs
    status = satisfied | unsatisfied | blocked | invalid
    diagnosticCode
    appliedToCalculators = false
```

`AzPrThreeValueRuntimeOutputs` 与 consumer schema 从 v4 升级为 v5，并把 `actionEffectRelationGraph` 加入 `supplementalOutputNames`；既有 canonical outputs、项目载体和 calculator 输入不变。效果事件携带 `relationId / relationKind`，时间轴、效果复盘和日志因此可以共享同一选择身份。

关系图是从现有项目字段确定性派生的，不作为第二份持久化真相。本地草稿、JSON、分享链接和 PNG 恢复后会重建同一 sequence/trigger/refresh/consume 图；旧关系缺失 `kind` 时继续按 `sequence` 兼容。3 条角色能量曲线和 3 条奇波能量曲线仍分别位于 `resourceCurves.curvesByActor / curvesByKibo`，总计 6 条，关系图不会写入任何能量、HP 或韧性轨道。

## 427. Kibo readiness runtime observations

`AzPrKiboEnergyRuntimeCurves` 从 v2 升级为 v3。项目 schema 与持久化字段不变；既有 `metadata.runtimeSampleCaptures[].events[]` 可新增以下观测事件：

```text
eventType = pet-ultimate-cooldown-observed
slotId / actorId / kiboId
petEntityId / petEntityPointer
api = PetUltimateCdTime
frameIndex? / timeMs?
cdTime / totalTime / ready
```

运行时只接受与当前 `timelineTopology.actorGroups[]` 完全匹配、具有实际 PetEntity 身份且冷却值自洽的事件；同一帧保留最后一次观测。曲线点使用 `trackKey = kiboEnergyChange`，保存原始冷却，并通过 `stateSnapshot.after.kiboEnergy.currentValue = totalTime - clamp(cdTime, 0, totalTime)` 给时间轴提供绝对状态。观测只应用于 tracking 曲线，`appliedToCalculators = false`；`RecoverSPArgs.petDelta` 不会被转换为奇波曲线点。

受控 hook manifest 从 v1 升级为 v2，新增 `PetEntity.PetUltimateCdTime`、`PetEntity.data`、`BaseData.configId/entityId`。旧 runtime capture 仍可导入；没有新事件时三条奇波曲线保持原有零值 tracking baseline。

## 428. Resource-owner locked runtime sample binding

`bindWorkbenchRuntimeSampleCaptures()` 的持久化输入格式不变。包含 `pet-ultimate-cooldown-observed` 的 capture 在动作身份重绑定前，必须与 `project.metadata.timelineTopology.actorGroups[]` 的 `slotId / actorId / kiboId` 完全一致，且绑定动作必须属于同一角色。

拒绝结果可新增 `reason = runtime-sample-resource-owner-mismatch | runtime-sample-resource-owner-topology-missing` 与 `resourceOwnerIssues[]`，用于指出 `slot-not-found / actor-mismatch / kibo-mismatch / action-owner-mismatch / timeline-topology-missing`。这些字段只属于导入结果，不写入项目载体；没有奇波观测的旧角色 SP capture 继续沿用原兼容绑定行为。

## 429. Six-resource capture batch binding

已绑定 capture 的 `workbenchBinding` 可新增 `resolutionKind = source-action-id | resource-owner-action | selected-action-fallback`。旧 capture 缺少该字段时继续兼容；项目 schema 与 `runtime-sample-captures` schemaVersion 不升级。绑定汇总可新增 `bindingKinds[]`，拒绝项可新增 `resourceOwnerActorIds[] / candidateActionIds[]`，用于区分唯一 owner 绑定与动作歧义。

`runtime-capture:normalize` 标识升级为 `promilia-axis-tool/runtime-capture-normalizer-v2`。重复 `--input` 时，输出按输入顺序合并 `captures[]` 并新增 `sourceFiles[]`；单输入同时保留旧 `sourceFile`。任何重复 `captureSessionId` 都会拒绝生成，不执行覆盖或去重。以上来源字段不参与 runtime 计算。

## 430. Controlled runtime capture scope

`capture-session` 元数据可新增 `captureKind = all | role-sp | kibo-energy | toughness` 与 `binding`。`binding` 保存采集时显式传入的 `actionId / actorId / targetId / slotId / kiboId / sourceElementConfigId`，只用于来源追溯和 owner 核对，不直接写入三值。旧 JSONL 缺少两字段时继续按 `all` 兼容导入，但不能通过新版 `--require-production`。

Frida agent 的 `startcapture` 配置同步新增 `captureKind`。`role-sp` 只安装 RecoverSP 链，`kibo-energy` 只安装 `PetEntity.PetUltimateCdTime`，`toughness` 只安装 WeaknessPoint 链；`all` 保留旧行为。该变化不升级 `runtime-sample-captures` 或 Workbench 项目 schema，也不改变已导入 capture 的数值计算。

Production provenance audit 新增 `captureScopeDeclared / captureScopeMatchesEvents / captureBindingComplete`。生产声明必须使用单一范围、完整 owner binding，并且事件只能来自对应资源族；`all`、范围缺失或跨资源污染均保持可查看但不可声明为真实生产采样。

## 431. Six-resource runtime capture plan v1

新增独立于 Workbench 项目 schema 的离线编排文件：

```text
six-resource-runtime-capture-plan v1
  planId / targetId / durationSeconds / outputDirectory
  template
  projectBinding?
    projectType / projectSchemaVersion / savedAt
    selectedCharacterIds[3] / selectedKiboIds[3] / selectedEnemyId
  sessions[6]
    captureSessionId
    captureKind = role-sp | kibo-energy
    slotId = team-slot-1 | team-slot-2 | team-slot-3
    actionId / actorId / outputFile
    kiboId? / sourceElementConfigId? / durationSeconds?
```

计划固定每个槽位恰好一份 `role-sp` 与一份 `kibo-energy`，同槽双方必须使用同一 `actorId`；会话、动作、输出文件和奇波身份不得重复。`outputFile` 只能是单层 `.jsonl` 文件名，防止计划越过指定输出目录。计划只生成命令并检查已有 capture，不持久化到项目、不进入 runtime/calculator，也不改变六条能量轴结果。

已有文件只有在单会话解析、production provenance、`captureKind` 以及 `binding.actionId / actorId / targetId / slotId / kiboId / sourceElementConfigId` 全部匹配时才标记为完成。六份完成后，计划 CLI 调用既有 normalizer v2 与 `--require-production` 生成批次；任一 owner drift 或来源缺口都会阻断，不覆盖原采样文件。

`--from-project` 接受当前支持的 Workbench project/draft v1-v16，从 `teamSlots`、`actorConfigs[].loadout.kiboId`、`selection.enemyId` 和 `actionDrafts` 生成同一计划格式。角色会话优先使用 skill，只有没有 skill 时才使用 resource；奇波会话只使用同角色且 `kiboId` 兼容的 `kiboEvent`。候选不是唯一时必须通过 `--role-action / --kibo-action team-slot-N=ACTION_ID` 显式选择，不能按数组顺序静默绑定。该桥接只复制项目身份，不读取模拟结果或改变项目 schema。

## 432. Workbench loadout detail catalog v1

新增独立生成文件 `workbench-loadout-detail-catalog.json`，`kind = workbench-loadout-detail-catalog`、`schemaVersion = 1`。它按设备、奇波和灵子 ID 提供真实名称、静态图标文件名及数据源可直接支持的展示摘要，并固定声明 `loadoutEffectsAppliedToCalculators = false`、`displayValuesAreSourceRecords = true`。Workbench 通过独立静态资源按需读取该目录；它不并入 `workbench-seed.json`，不改变 calculator、runtime 或六条能量轴合同。

项目敌人实例可选新增 `enemy.icon`，值直接来自既有敌人目录，用于配置面板显示真实身份图。旧项目缺少该字段时继续兼容，重新按敌人 ID 构建项目即可恢复；Workbench project/draft schemaVersion 不升级。角色、奇波、五件装备与灵子仍使用既有 `teamSlots` 和 `actorConfigs[].loadout` 持久化字段，因此本地草稿、JSON、分享链接和 PNG 无需迁移即可恢复 M2 配置。

## 433. Action status generation catalog v1

新增生成文件 `workbench-action-status-catalog.json`，只保存真实动作目录中可结构化确认的 CD、效果身份、动作变体绑定、触发帧、生命周期和来源 identity。目录策略禁止描述文本推断；证据不足的候选保持 tracking-only，叠层未知时只声明 `unconfirmed-single-instance-runtime-projection`，所有自动效果固定 `appliedToCalculators = false`。

Workbench v16 动作可选新增 `statusGeneration`；自动 `effectCommands[]` 可选携带 `icon / confidence / trackingStatus / sourceIdentity`。这些字段由动作 ID、技能、变体与生成目录确定性重建，不形成第二套 UI 真相。compiler、effect runtime、`AzPrEffectIntervalProjection` 和 `AzPrActionEffectRelationGraph` 透传同一来源字段；循环边界的 `initialRuntimeState.activeEffects[]` 也保留它们及剩余时长。

项目 schemaVersion 不升级。旧项目缺少 `statusGeneration` 时在 normalization 中自动生成；动作变体改变、复制、移动、删除或载体回放后都会重建生成命令并移除旧 identity。手工 `effectCommands` 继续兼容，且不会被误标为目录生成项。该新增不改变 HP、韧性、3 条角色资源或 3 条奇波资源的 calculator 输入。
