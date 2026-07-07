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
