# 107002 米砂：可直接下发的实现规格

> R2 状态说明：用户产品裁决已推翻 S1 的零距离自动碰撞领取；本文按 `10700210/sub0@70F` 重击吸收来源给出当前可直接实现合同。旧推断只作为 failure-to-pass 保留在反例，不再是有效规格。

## 0. 下发结论

本规格对应 R2 实现线：复用 S1 entity/formula/routing primitive，新增无角色特判的 owner-action absorb binding，并仅生成 107002 owner 产物。它不构成 visual/formal admission 或 optimization-ready；A5/完整普攻排程、隐藏团队传播、满池替换和满层刷新仍是明确缺口。

冻结输入：

- inherited source-evidence baseline：`140eefcd233cd9c1d136728f1c94b91aff632278`
- fixed R2 integration/scope baseline：`1a56e0a295f31298da6c3ddb5d70db90183971fb`
- scenario：`m12c-zero-distance-passive-boss-v1`
- roster denominator：9
- Kibo DNA：`[]`
- `hero_rank`：未实装死配置，不参与任何 gate

## 1. 建议实现包与依赖

```text
P0 source guards / scenario policy
 ├─ P1 pickup entity ledger + same-frame scheduler
 │   └─ P2 owner charged-action absorb + reward routing
 │       ├─ P3 generic source-MAXHP formula 104
 │       └─ P4 pickup passive gate + tuning layers
 ├─ P5 reusable hit-confirmed DEF state
 ├─ P6 reusable mark consume / overlimit / buff
 ├─ P7 explicit AllHero multi-heal
 └─ P8 107002 recipe + focused tests
       └─ P9 integration-line regeneration only
```

P1/P3/P4/P5/P6/P7 复用 S1；R2 的新增通用面只有 P0 pickup policy normalization、P2 declarative absorb binding 和相应 trace/acceptance 投影。角色限定只在 107002 recipe。

## 2. P0：来源 guard 与 schema

### 2.1 recipe 身份

新增角色专用 recipe 时使用唯一文件：

`scripts/character-combat/profile-recipes/107002.json`

必须包含并校验：

```json
{
  "characterId": 107002,
  "sourceBaseline": "140eefcd233cd9c1d136728f1c94b91aff632278",
  "productScenario": "m12c-zero-distance-passive-boss-v1",
  "formalAdmissionClaim": false,
  "optimizationReadyClaim": false
}
```

`sourceBaseline` 表示 recipe 继承的原始来源身份；R2 证据生成器和 `mechanism-contract.json` 另以 `1a56e0a295f31298da6c3ddb5d70db90183971fb` 作为固定 production scope guard。两者不得折叠为当前侧车 HEAD。

### 2.2 来源选择 guard

- cooldown/SP 采用 `skillsub_logic`：charged 100ms；star 24000ms；ultimate 0ms + SP100；star-carry 24000ms。
- 不允许 public projection 的 star 12000ms / ultimate 30000ms 覆盖 runtime 值。
- 星鸣主 action 的后段 control 是 `10700226/sub0`；`10700212/sub1` 只留审计，不进入 action timeline。
- HP 拾取、调谐强度、30s 元素伤害 buff 不得因公示“全队”自动升级为 AllHero/ShareAll。
- SP 拾取的 `ShareAll` 只绑定 SP element `107002215`。
- `projectile.targetDistance=0` 不得解释为 pickup distance；默认 `autoCollect=false`，没有显式移动。

### 2.3 未闭合 guard

- A5 variant/duration 未解析时，编译器必须保持 `unresolved`，不得 generic fallback 后标 ready。
- 完整普攻循环不能把 A3 100F 或 A4 最后 hit 102F 当成已证的全链 occupancy。
- 不把 N/A action 纳入产品场景动作集合，但保留 source binding 和结构化原因。

### 2.4 场景政策扩展

`m12c-pickup-owner-source-action-absorb-v1` 必须随 fixture/Workbench roundtrip 保留：`autoCollect=false`、`movementPolicy=no-implicit-movement`、`collectionPolicy=owner-source-action-absorb-only`、同帧新生排除、同帧到期先清理。该扩展不改写已冻结的 M12-C 主 policy hash；中央线统一生成时再决定是否折入下一版全局 policy。

## 3. P1：通用 `summoned pickup entity ledger`

### 3.1 建议数据模型

```ts
type PickupEntity = {
  entityId: string;
  ownerActorId: string;
  unitId: 480041 | 480042;
  poolKey: string;
  countType: "SkillOrElement" | "SummonId" | "SummonTempData";
  spawnFrame: number;
  collisionOpenFrame: number;
  expiresFrameExclusive: number;
  collected: boolean;
  absorbed: boolean;
  absorbedByActorId: string | null;
  absorbSourceActionId: string | null;
  rewardCount: 0 | 1;
  destroyed: boolean;
  sourceOrder: number;
};
```

`poolKey` 必须按 `ESummonCountType` 生成，不能只用 `unitId`：

- `SummonTempData`：普通 A3/星鸣各自按召唤临时数据归池。
- `SummonId`：星决 HP 480042 与 SP 480041 按 unit/summon id 分池。
- 星决池与普通池分离，但每个池自己的 `maxCount=6` 仍生效。

### 3.2 创建事务

输入：owner、summon element、请求 count、action frame、serialized source order。

输出：稳定排序的新实体列表与拒绝原因列表。

规则：

1. 只有 hit-confirmed 的 summon request 才进入创建事务。
2. 同帧按 control track / `elementBaseDatas` / `toOwnElementBaseDatas` 的序列化顺序排队。
3. 为每个成功创建实体分配稳定 `entityId`；实体 ID 不得依赖 JS object iteration。
4. 上限内创建；达到 6 时采用 `reject-new-at-cap`。
5. `reject-new-at-cap` 是保守实现策略；诊断中写 `conservative-cap-policy`，不要写 `runtime-verified-replacement`。
6. 被拒绝请求不能进入后续 absorb candidate，也不能发 reward。

### 3.3 生命周期

- 所有米砂生成物寿命 15000ms，即 60Hz 下 900F；无重击时一直留存至自然过期。
- child collision `[spawn+2,spawn+902)` 只保留为原图证据，默认不排队自动领取。
- exact `spawn+900` 先过期；过期实体不进入同帧吸收。
- 首次吸收立即把 `rewardCount` 锁为 1 并销毁逻辑实体；自然过期无 reward。

### 3.4 同帧 scheduler

同一 simulation time 的 phase 固定为：

1. action hit/effect 的 serialized list
2. 到期清理
3. summon requests 的 source/track order 与 entity creation
4. owner-action absorb attempt
5. eligible entity 按 `sourceOrder` / `entityId` 稳定逐个 reward
6. destroy/trace

在星决 135F 创建 3 HP + 3 SP 时，仍先 `[20]` HP 后 `[21]` SP。同帧 spawn/absorb 细序未直接取证，故显式排除同帧新生实体；这不是数组插入顺序的副作用。

## 4. P2：owner 重击吸收与奖励路由

### 4.1 declarative absorb contract

```ts
absorbOwnerPickups({
  nowFrame,
  action,
  binding: {
    controlSkillId,
    subSkillIndex,
    triggerFrame,
    pickupIdentities,
    collector: "action-owner",
    settlementGate: "successful-action-execute",
    requiresHit: false,
    sameFrameSpawnPolicy: "exclude-same-frame-fail-closed",
    sameFrameExpiryPolicy: "expire-before-absorb"
  }
})
```

107002 recipe 固定：`control=10700210/sub0`、`triggerFrame=70`、source track order 15、element `107002233`。compiler 必须核对 control root 与 element 的 `displacementType=2,targetType=2,entityFilterData=64,radius=9`，runtime 不含角色 ID/名称特判。

成功 execute 的合法动作在 70F 吸收所有满足下列条件的实体：owner 等于 action owner、identity 在 binding 列表、`spawnFrame < nowFrame < expiresFrameExclusive`、未吸收且 `rewardCount=0`。blocked action 不排队；damage miss 不阻断。普通攻击、星鸣、星决、星携、其他角色重击和受控角色切换均无匹配 binding。

连续第二次或无实体重击仍可留下 count=0 的 absorb-attempt trace，但不产生 reward。已吸收/已过期实体不能复活或重复结算。

### 4.2 三种路由必须分开

| 路由 | 原始语义 | 米砂用途 |
|---|---|---|
| absorb reward `Target` | 只注入 binding collector=重击 owner 米砂 | HP 3% heal；passive gate；调谐强度 |
| SP `ShareAll` | 米砂获得 SP，并完整分享给后台英雄 | SP 生成物 +1 |
| `DirectInject AllHero` | 对玩家所有英雄分别执行事件 | 星决五段 heal；星携四段 heal |

禁止用一个 `teamWide=true` 布尔值合并三种路由；否则会把 HP heal/调谐层错误广播，或把多段 AllHero heal 错误折叠为一次 shared event。

### 4.3 来源角色属性

HP reward 公式 104 使用 `self.MAXHP`。R2 collector 与 source owner 都固定为执行重击的米砂，但 trace 仍需分别记录以防未来泛化时劫持：

- `sourceActorId`
- `collectorTargetId`
- `pickupSourceActionId`
- `absorbActionId`
- `sourceMaxHp`
- `formulaId=104`
- `formulaA=300`
- `healAmount`

## 5. P3：通用 direct-heal 公式 104

### 5.1 已核验的现有缺口

这不是 recipe 能解决的字段接线：

- `verifiedBattleEffectFormulaRuntime.js` 当前只分类 5、11、2、3、2008 和若干 tuning formula，`baseFunctionId=104` 会落入 `unsupported-1-104`。
- `verifiedCombatRuntime.js#resolveDirectHealFormula` 只对 `baseFunctionId=108` 做 MAXHP ratio 特判；其他 formula 依赖 `directEvent.value`。当生成层对 104 返回 unresolved 时，这里无法得到米砂治疗值。
- Kibo periodic-heal 路径已有 104 的 schedule-specific 计算，但不是通用 direct battle-effect evaluator，不能假定 HP pickup、星决和星携会自动复用。

因此必须新增或抽取一个通用 primitive，并在 battle-effect 公式注册表、direct-heal runtime 和聚焦测试中接通。

### 5.2 公式 contract

米砂原始公式 104：

```text
(self.MAXHP[0] * A) / 10000
```

这里 `self` 必须绑定 effect 的来源 actor（米砂），不是任意前台 actor 或 AllHero 中逐个目标。公示技能文本也明确写“米砂最大生命值”。输出再按显式 route 注入：

- HP 生成物：同一个 source-MAXHP 结果注入重击 absorb Target 米砂。
- 星决/星携：同一个 source-MAXHP 结果分别形成各 AllHero target 的 direct heal event。

建议通用分类：

```ts
{
  family: 'source-max-hp-ratio-heal',
  commonFunctionId: 1,
  baseFunctionId: 104,
  evaluator: 'q16.16-source-max-hp-times-a-per-10000'
}
```

计算和 trace 必须记录：

1. `sourceActorId` 与 source MAXHP attribute 5；
2. 等级对应 `A`；
3. common `G=10000`（如注册表统一应用 common function）；
4. Q16.16 中间值和既有 direct-heal rounding policy；
5. `targetActorId`、route kind 与 heal-up modifiers；
6. formula identity / element pathId。

### 5.3 三类调用值

- HP pickup `107002216`：`A=300`，即米砂 MAXHP 3%。
- 星决 `107002022`：等级 `A=600..1260`，五个独立事件。
- 星携 `107002240`：等级 `A=200..420`，四个独立事件。

不得把 `A` 当固定 HP 点数，也不得使用 Target MAXHP。`COUNTEREXAMPLES.md#HEAL-N-01` 必须覆盖 source/target MAXHP 不同的情况。

## 6. P4：被动 gate 与调谐强度

### 5.1 永久 marker

角色初始化或 battle-enter 时，`10700261` 对 Self 注入 `107002271`：

- `combineType=Cover`
- `time=-1`
- marker 只作为 pickup gate，不直接当调谐层。

只有 absorb Target 米砂的 marker 层数 `>0` 时，公式 1006 才返回 10000 并允许注入 `480041002`。

### 5.2 调谐层 profile

```json
{
  "stateId": "misa-tuning-intensity",
  "attributeId": 229,
  "basisPointsPerLayer": 600,
  "maxLayers": 4,
  "durationMsPerLayer": 24000,
  "stacking": "independent-layer",
  "atCapacityPolicy": "ignore-new",
  "refreshAtCapacity": false,
  "evidenceStatus": "conservative-policy-for-unproven-overlying-replacement"
}
```

每层区间 `[applyMs, applyMs+24000)`；恰好右端点先过期，再处理同刻新拾取。层排序需按 `(expiresAtMs, applySequence)` 稳定。

同一个实体重复吸收永不重复加层；不同实体每个可尝试加一层。一次重击吸收六个实体时，稳定序前四个加层，后两个得到 `capacity-ignored`，且不刷新前四层。

## 7. P5：复用 hit-confirmed target state 实现 DEF debuff

不要新增角色专用 debuff engine。用现有：

- compiler `targetStateProfiles`
- `targetStateTransactions.requiresHitElementId`
- `verifiedTargetStateRuntime.js`
- `effectRuntimeTimeline.js`

建议 profile：

```json
{
  "stateId": "misa-def-down",
  "combineType": "Cover",
  "durationMs": 24000,
  "effects": [
    {"attributeId": 3, "basisPoints": -1000},
    {"attributeId": 4, "basisPoints": -1000}
  ]
}
```

两条 transaction：

- A4 84F hit behavior `-1291223460462752175`
- charged 76F hit behavior `6704838959614714036`

事务必须以对应 hit 成功为 gate。序列是 current-hit damage/energy 后才 apply debuff，故 triggering hit 不吃 debuff；同 action 的后续 hit 吃 debuff。有效区间 `[t,t+24000)`；恰好 `t+24000` 不生效。Cover 再施刷新 wrapper，不叠两份 -10%。

## 8. P6：复用 mark runtime 实现星鸣

复用 `verifiedTuningMarkGeneration.js` 的：

- mark acquisition
- priority consume
- overlimit packet
- layer lifetime/expiry

### 7.1 82F 正序

命中后按以下顺序执行：

1. damage
2. energy
3. availability judgment：按 `[550,750]` 检查是否有任一层，成功则对 raw Source 应用 30s 木/风伤 +5%
4. consuming judgment：按 `[550,750]` 选择首个足够候选
5. `CastPassiveSkill`
6. 消耗所选印记 1 层
7. 注入所选 overlimit packet（木 599 或风 799）

没有候选：步骤 3 的 availability 失败；步骤 4-7 无消费、无 packet。不得进入负层。

若木、风各 1 层：先选并消费木，风保留。该优先级来自二进制循环，不是 ID 排序猜测。

### 7.2 30s buff 路由

- wrapper `107002265`, `[t,t+30000)`。
- 木伤 +5% `attr=55`，风伤 +5% `attr=53`。
- raw target 是 Source；只给 Source，不向 roster 广播。

### 7.3 90F 独立风印记

90F hit 成功后先 `+1 wind mark 750`，再请求创建 SP pickup。它不能回填 82F 消费：

- 初始 0 层：82F 无 consume/buff/overlimit；90F 后风=1。
- 初始风=1：82F 风 ->0 并 overlimit/buff；90F 后风=1。
- 初始木=1：82F 木 ->0；90F 后风=1。
- 初始木=1、风=1：82F 木 ->0，风仍1；90F 后风=2（受上限 5 约束）。

## 9. P7：复用 direct routing 实现多段治疗

本包复用 AllHero event routing，但数值必须依赖 P3 的通用公式 104；没有 P3 时不得把 raw `A` 当作固定治疗量。

### 8.1 星决

每个帧点生成一个独立 AllHero heal event，不能把五段合并：

`143,155,167,181,193F`

heal element `107002022`，公式 104，等级 bp：

`600,660,720,780,840,900,960,1020,1080,1140,1200,1260`

144F、150F 各给来源米砂 +1 木印记。它们与 heal 独立，miss 概念不适用于 direct self/AllHero control event。

### 8.2 星携

四个独立 AllHero heal event：`46,61,79,98F`。

heal element `107002240`，等级 bp：

`200,220,240,260,280,300,320,340,360,380,400,420`

星携 control 的 runtime CD 24000ms。

## 10. P8：107002 recipe 机制族

recipe 至少拆成以下高内聚块，不把所有语义塞进单个 action override：

1. `actionSchedulingAndResources`
2. `hitConfirmedDefDebuff`
3. `normalHpPickupSpawns`
4. `starSpPickupSpawns`
5. `starPriorityConsumeAndOverlimit`
6. `starIndependentWindMark`
7. `ultimatePickupSpawns`
8. `ultimateTeamHealAndWoodMarks`
9. `starCarryTeamHeal`
10. `pickupLifecycleAndRouting`
11. `pickupPassiveTuningIntensity`
12. `scenarioOutOfScopeActions`

所有 source identity 使用稳定的 control/subIndex/frame/pathId，不使用中文名字作唯一键。

## 11. Required / N/A 的测试准入面

### Required 必测

- action：charged/star/ultimate/star-carry 的 occupancy、CD、SP gate；A3/A4 hit timeline。
- hit：qualifying hit 与 miss。
- effect/control：A4/charged debuff、star consume、ultimate/star-carry heal。
- resource：ultimate SP=100；SP pickup ShareAll；资源不足无 action 事务。
- cooldown：`readyAt-1` 失败、`readyAt` 成功。
- mark consume/overlimit：0、木、风、木+风；82F miss / 90F miss 分离。
- heal：HP Target-only；星决/星携 AllHero；多段不折叠。
- pickup：创建、上限、900F 过期、无重击零奖励、仅 owner 重击吸收、一次性奖励、稳定跨池顺序、同帧新生排除、同帧到期先清理；child `+2F` collision 只验原图事实，不是产品 collection gate。
- tuning layer：marker 有/无、1..4 层、第五次、独立过期、右开边界。

### 结构化 N/A 只测分类

`10700215/10700211/10700225/10700227` 在 frozen scenario 的 optimizer action set 中不存在，理由必须是 `scenario-out-of-scope`，不能是 source-missing。

## 12. P9：并行冲突与集成策略

### 高冲突共享文件

- `scripts/character-combat/character-combat-contract-compiler.mjs`
- `scripts/character-combat/character-combat-product-boundaries.mjs`
- `scripts/sync-verified-combat-mechanics.mjs`
- `src/simulation/mechanics/verifiedActionVariantRuntime.js`
- `src/simulation/mechanics/verifiedTargetStateRuntime.js`
- `src/simulation/mechanics/verifiedTuningMarkGeneration.js`
- `src/simulation/mechanics/verifiedBattleEffectGeneration.js`
- `src/simulation/mechanics/verifiedBattleEffectFormulaRuntime.js`
- `src/simulation/mechanics/verifiedCombatRuntime.js`
- `src/simulation/mechanics/verifiedDamageEventGeneration.js`
- `src/simulation/runtime/effectRuntimeTimeline.js`
- `src/simulation/runtime/actionCooldownEvaluation.js`
- `src/simulation/engine/actionExecutionPlan.js`
- `src/__tests__/simulation/verifiedBattleEffectFormulaRuntime.test.js`
- 对应 compiler/product-boundary/target-state/runtime 测试

这些文件与米蒂 `108003`、西芙莉雅 `107001`、莉莉 `102001` 的并行提交最可能冲突。应由集成线先合并/统一设计通用 pickup primitive，再让各角色 recipe 只声明数据。

### 低冲突角色文件

`scripts/character-combat/profile-recipes/107002.json` 文件名唯一，但其 schema 仍取决于共享 compiler，不能先用角色专用字段绕过通用设计。

### 只能在集成线统一重生成

- `src/data/generated/**`
- 全局 qualification/binding matrix/summary/catalog
- 全局 character-acceptance summary/index
- 任何由 compiler 输入聚合而来的 reports

侧分支不得各自生成后互相覆盖。集成线在共享 runtime/compiler 与所有角色 recipe 合并后执行一次聚焦生成，再按主线计划决定是否运行更大测试；本证据侧车不授权全量测试。

## 13. 完成定义

实现任务只有在以下条件同时满足时，才能从“已下发”变成“机制实现完成”；即便如此，也仍需独立的正式资格流程：

1. P1/P2/P3/P4 通用 pickup、routing、formula104 与 passive-layer primitive 有聚焦单测。
2. 107002 recipe 没有公示文本覆盖 raw route/CD。
3. `COUNTEREXAMPLES.md` 的全部 required 正负例有对应测试名或 trace。
4. N/A 动作保留来源与结构化原因。
5. A5/隐藏团队传播/满池或满层 runtime 行为仍被显式列为 unresolved 或有新的二进制证据。
6. 集成线统一重生成，且没有侧分支覆盖全局产物。
7. 没有任何 formal admission / optimization-ready 声明从本侧车自动产生。
