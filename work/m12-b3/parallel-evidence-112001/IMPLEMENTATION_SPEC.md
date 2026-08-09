# 112001 分阶段实现规格

## 1. 目标与停止条件

本规格供集成线在本侧车合入后执行。本分支不执行这些生产改动。

完成定义分两档：

- `evidence-integrated`：主动控制、landed-hit 事务、印记 consumer 和 scenario N/A 均有 recipe/compiler/runtime 聚焦测试；所有开放项仍稳定 fail-closed。
- `formal-candidate`：还必须闭合 Charging `59F/67F` 的客户端 evaluator 顺序，合入 optimizer toughness 的客户端结算证据、闭合星决观察器/同包 wrapper 顺序，并完成集成线统一生成与资格审核。`11200162` 孤立文案不属于完成门槛。

在第二档完成前不得宣称 formal admission、optimization-ready、正式搜索或 M12-C 解锁。

## 2. 推荐数据合同

### 2.1 控制入口合同

在 `scripts/character-combat/profile-recipes/112001.json` 的 `compiler.variantWindowBindings` 中建立以下 7 条主动 binding；使用现有 `evidenceKind="control-transition-window"`，并增加/保留来源 predicate 校验：

```json
[
  ["giselle-a2-to-heavy2", 11200102, 0, 55, 320, 11200110, 1],
  ["giselle-a3-to-heavy2", 11200103, 0, 63, 243, 11200110, 2],
  ["giselle-a4-to-heavy3", 11200104, 0, 36, 266, 11200110, 3],
  ["giselle-a5-to-heavy3", 11200105, 0, 59, 179, 11200110, 4],
  ["giselle-star-to-heavy2", 11200112, 0, 67, 298, 11200110, 1],
  ["giselle-ultimate-to-heavy3", 11200113, 0, 216, 461, 11200110, 3],
  ["giselle-star-carry-to-heavy2", 11200121, 0, 112, 377, 11200110, 1]
]
```

每条记录还必须含：

```json
{
  "inputCommand": "heavy-attack",
  "condition": { "kind": "always" },
  "expectedBridgeType": 3,
  "expectedAllowSkill1": true,
  "windowSemantics": "half-open",
  "scenarioApplicability": "active-reachable"
}
```

当前 `compileControlTransitionWindowBinding` 只按 source/sub/window/target 匹配。集成时应扩展为同时核对 recipe 声明的 `expectedBridgeType`、allowed input 和 `interruptBehavior/frameIndex`（声明时才校验），并把这些字段复制到 owner contract。这样可防止同帧同 target 的错误 behavior 被静默绑定。

`11200125/27` 的相似入口不得放入主动 binding；它们进入第 2.6 节的 scenario N/A。

### 2.2 Charging release 合同

为 `11200110/sub1..4 -> 11200141/sub0..3` 建立 `charging-release` binding：

```json
{
  "kind": "charging-release",
  "inputCommand": "release-heavy",
  "expectedBridgeType": 4,
  "windowSemantics": "half-open",
  "overlapPolicy": "fail-closed-with-client-order-required"
}
```

具体窗口使用 `RESOURCE_CONSUMER_GRAPH.md` 第 1.2 节。运行时选择规则：

1. 只匹配当前 `sourceControlSkillId + sourceSubSkillIndex`。
2. 只匹配 `bridgeType=4`。
3. 非重叠帧选择唯一目标。
4. `59F` 或 `67F` 同时命中两窗且没有客户端 evaluator 顺序证据时，返回 `112001-charge-threshold-overlap-order-open`，不得用数组先后裁决。除非用户以后明确冻结精确阈值排除政策，否则该 open 必须进入 unresolved/readiness。

若现有 `inputVariantSelectors` 不能表达“入口 subskill 已由前序动作决定，再由 release window 决定 execution subskill”，不要把 112001 压成一个全局 holdRange；应新增专用 `chargingReleaseBindings` 编译路径或为 `variantWindowBindings` 保留 `sourceSubSkillIndex + bridgeType`。

### 2.3 landed-hit effect 合同

现有 `actionEffectBindings` 以 action frame 为主要定位，不足以表达本角色的 miss/interruption gate。新增或复用等价的 `landedHitEffectBindings`：

```json
{
  "bindingIdentity": "giselle-star-first-hit-thunder-mark",
  "triggerKind": "action-hit-landed",
  "controlSkillId": 11200112,
  "subSkillIndex": 0,
  "collisionFrame": 27,
  "collisionBehaviorPathId": "5182973323990506066",
  "effectElementPathId": "-3809486317990090417",
  "targetDamageElementId": 112001056,
  "effectTarget": "team-tuning-mark-container",
  "effect": {
    "kind": "tuning-mark-stack",
    "elementId": 250,
    "profileKey": "thunder",
    "stackDelta": 1
  },
  "rollbackPolicy": "never-after-effect-applied"
}
```

CD 恢复使用 4 条 binding：

```json
[
  ["giselle-heavy2-early-star-cd", 11200141, 0, 26, "-1951771389325363148"],
  ["giselle-heavy2-full-star-cd", 11200141, 1, 21, "-2221402581055835730"],
  ["giselle-heavy3-a4-ultimate-star-cd", 11200110, 3, 17, "-6246824455983816836"],
  ["giselle-heavy3-a5-star-cd", 11200110, 4, 17, "2145608153295598680"]
]
```

每条 effect 固定为：

```json
{
  "kind": "cooldown-recovery",
  "elementId": 112001267,
  "targetSlot": 3,
  "seconds": -3,
  "passiveMarkerElementId": 112001132,
  "maxApplicationsPerCollision": 1,
  "requiresLanded": true
}
```

编译器必须核对 collision 上真实存在该 toOwn element/path；runtime 在 `hit-landed` 后应用，`hit-missed/hit-cancelled` 不应用，effect-applied 后中断不回滚。同帧事件通过稳定 `runtimeSequenceIndex` 或更强客户端游标排序。

### 2.4 tuning consumer 合同

新增/复用 `tuningConsumeBindings`，不要把 consumer 展平为 action 开始时的一次资源扣除。

完全重击 3：

```json
{
  "bindingIdentity": "giselle-full-heavy3-three-consumers",
  "controlSkillId": 11200141,
  "subSkillIndex": 3,
  "consumers": [
    {
      "frame": 32,
      "elementId": 112001258,
      "consumeLayerNum": 1,
      "consumeLayerMaxNum": 0,
      "failureDamageElementId": 112001264,
      "successDamageElementId": 112001259
    },
    {
      "frame": 39,
      "elementId": 112001268,
      "consumeLayerNum": 1,
      "consumeLayerMaxNum": 1,
      "failureDamageElementId": 112001196,
      "successDamageElementId": 112001270
    },
    {
      "frame": 46,
      "elementId": 112001268,
      "consumeLayerNum": 1,
      "consumeLayerMaxNum": 1,
      "failureDamageElementId": 112001196,
      "successDamageElementId": 112001270
    }
  ]
}
```

星决：

```json
{
  "bindingIdentity": "giselle-ultimate-two-mark-consumer",
  "controlSkillId": 11200113,
  "subSkillIndex": 0,
  "frame": 191,
  "elementId": 112001260,
  "consumeLayerNum": 2,
  "consumeLayerMaxNum": 2,
  "failureDamageElementId": 112001265,
  "successDamageElementId": 112001261
}
```

所有 consumer 共享下面的已验证规则：

```json
{
  "consumeMode": "priority",
  "candidateMarkElementIds": [250, 450],
  "candidateRule": "first-single-candidate-with-sufficient-stacks",
  "candidateOverlimitPackets": { "250": 299, "450": 499 },
  "executionOrder": [
    "calculate-consume-count",
    "consume-selected-mark",
    "inject-failure-or-success-damage",
    "inject-selected-mark-overlimit"
  ],
  "resourceReadPolicy": "read-current-state-per-consumer",
  "interruptionPolicy": "preserve-settled-prior-consumers"
}
```

编译时逐项核对 Battle Element 的 `consumeMode/elementArr/consumeLayerNum/consumeLayerMaxNum/list_1/list_2/injectElementDataEffects`；运行时为 consume、branch damage、overlimit 分配不同 packet identity 和递增 sequence cursor。

### 2.5 星决 wrapper 与 observer 的暂存合同

先在 recipe 中建立 source-backed unresolved records，不先接 production effect：

```json
[
  {
    "recordIdentity": "112001-ultimate-wrapper-same-packet-order-open",
    "controlSkillId": 11200113,
    "frame": 191,
    "wrapperElementId": 112001255,
    "durationMs": 12000,
    "sourceChildElements": [112001257, 112001256],
    "status": "client-order-required"
  },
  {
    "recordIdentity": "112001-ultimate-watcher-same-packet-order-open",
    "controlSkillId": 11200113,
    "frame": 128,
    "watcherElementId": 112001271,
    "durationMs": 8000,
    "triggerCount": 1,
    "teamBuffElementId": 112001272,
    "teamBuffDurationMs": 11000,
    "status": "client-order-required"
  }
]
```

直到第 3 节客户端 settlement 合同合入，这两条不能转为 applied runtime effect。

### 2.6 scenario N/A 合同

在 owner recipe/场景策略中加入 `scenarioApplicabilityRecords`，覆盖 `ACCEPTANCE_COUNTEREXAMPLES.md` 第 7.2 节全部 identity。编译器输出必须保留：

```text
classification=scenario-out-of-scope
applicability=not-applicable
schedulable=false
optimizationEligible=false
reason=<stable reason>
sourceIdentity=<real source>
```

场景策略匹配必须精确到边/事务，不能把整个 `11200121` 判 N/A；其星鸣协战主动入口保留。N/A 不应计入 unresolved，也不应计入 runtime-ready 覆盖分子。

### 2.7 `11200162` 孤立/过期描述 N/A 合同

只在来源 provenance 层保留下列结构化 N/A；若 owner contract 没有非运行时 provenance 容器，则仅留在证据索引，不得放入 recipe unresolved：

```json
{
  "recordIdentity": "112001-current-client-orphan-skill-level-2193",
  "skillId": 11200162,
  "classification": "current-client-orphan",
  "descriptionStatus": "stale-description",
  "applicability": "not-applicable",
  "gameplayMechanic": false,
  "runtimeGenerationMode": "none",
  "required": false,
  "blocksReadiness": false,
  "sourceIdentity": [
    "NewTable/skill_level.rows[id=2193,skillId=11200162]",
    "CHS/lang_skill_level[id=9418863283712]"
  ],
  "currentClientEvidence": {
    "skillControlElementPaths": ["-1181925444607214156", "1138707259999444314"],
    "resolvedChain": [112001133, 112001134],
    "finalCollisionConsumer": "absent"
  }
}
```

这不是待补 consumer 的 semantic contract。编译器不得从该记录生成 trigger、element、stack、duration、target state 或 effect transaction；`112001133/134`、`101003*`、`480xxx` 均不得作为 fallback。它不进入 required、readiness gate 或未来实现阶段。

## 3. 与 optimizer toughness 任务的接口合同

### 3.1 当前状态不得作为客户端事实

当前 `work/m12-optimizer-objectives/STATE.md` 指定：

- runtime contract：`m12-enemy-settlement-runtime-v1`。
- 稳定排序 tuple：`(absoluteFrame,runtimePhasePriority,runtimePriority,runtimeSequenceIndex)`。
- 当前诊断实现先读取 `inBreakForHpDamage`、计算 HP，再处理 toughness 并产生 `breakTriggered`。
- 客户端原生顺序仍开放，正式阻断为 `machine-axis-enemy-settlement-client-order-open`。

112001 集成只能消费未来的客户端证据合同，不能通过调用当前实现“验证”客户端顺序。

### 3.2 optimizer toughness 必须提供的版本化结果

建议合同 identity：`m12-enemy-settlement-client-evidence-v1`。每个输入 damage/overlimit packet 返回：

```json
{
  "contractIdentity": "m12-enemy-settlement-client-evidence-v1",
  "evidenceReference": {
    "path": "<repo evidence artifact>",
    "bytes": 0,
    "sha256": "<64 hex>",
    "clientBinarySha256": "c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b"
  },
  "packetIdentity": "<stable identity>",
  "source": {
    "ownerId": 112001,
    "actionId": "<stable action identity>",
    "controlSkillId": 11200141,
    "subSkillIndex": 3,
    "hitIdentity": "<collision identity>",
    "elementId": 112001259,
    "elementPathId": "<decimal string>",
    "packetKind": "branch-damage|tuning-overlimit"
  },
  "order": {
    "absoluteFrame": 32,
    "runtimePhasePriority": 0,
    "runtimePriority": 0,
    "runtimeSequenceIndex": 0,
    "clientSettlementCursor": "<opaque monotonic cursor>",
    "sourceSequencePath": ["consumer:112001258", "success-damage", "overlimit:299"]
  },
  "stateBefore": {
    "hp": 0,
    "toughness": 0,
    "inBreak": false,
    "activeEffectCursors": []
  },
  "hpSettlement": {
    "inBreakForHpDamage": false,
    "requested": 0,
    "effective": 0,
    "settlementCursor": "<cursor>"
  },
  "toughnessSettlement": {
    "weakBreakDamageRate": 25000,
    "requested": 0,
    "effective": 0,
    "before": 0,
    "after": 0,
    "settlementCursor": "<cursor>"
  },
  "breakEvent": {
    "triggered": false,
    "cursor": null,
    "absoluteTimeMs": null
  },
  "stateAfter": {
    "hp": 0,
    "toughness": 0,
    "inBreak": false
  }
}
```

字段可以采用等价命名，但以下信息不可丢失：packet 身份、来源 element/path、跨包 source sequence、客户端 settlement cursor、HP 使用的 break 状态、toughness before/delta/after、break event cursor/time、state after、证据哈希。

### 3.3 112001 对接口的额外要求

1. 对成功 consumer，必须能证明 `branch-damage cursor < selected-overlimit cursor`，同时分别报告两个包的 HP/toughness/break。
2. 同帧多个 consumer/包必须按客户端游标稳定排序，不能只按 frame 聚合。
3. 191F 的 toOwn `112001255` 必须有 `effectAppliedCursor`，并能回答 branch damage 在该 cursor 前还是后。
4. 128F 的 toOwn `112001271` 必须有 `observerAppliedCursor`；同 collision break 必须返回 `observerWasActiveAtBreak`，而不是让 112001 runtime 自己根据相同时间猜测。
5. watcher 的后续合法 break event 必须携带唯一 cursor；触发一次后 observer consumed。
6. 客户端证据引用不匹配、缺字段或哈希漂移时，必须退回 `machine-axis-enemy-settlement-client-order-open` 与对应 112001 owner reason，不能降级到当前 runtime 顺序。

### 3.4 星决观察器接线算法

只有接口合同通过验证后实现：

```text
on collision 128 landed:
  receive authoritative observerAppliedCursor/time
  create one-shot observer with right-open expiry +8000ms

on authoritative breakEvent:
  eligible = settlement says observerWasActiveAtBreak
             AND breakEvent.time < observer.expiry
             AND observer.notConsumed
  if eligible:
    consume observer
    apply team element 112001272 at breakEvent.cursor
    active interval = [breakEvent.time, breakEvent.time + 11000ms)
```

对 128F 同包 break，`observerWasActiveAtBreak` 是必要输入；不能仅套上述时间比较。对不同后续包，时间右开和游标顺序都必须满足。

## 4. 分阶段执行顺序

### 阶段 A：owner recipe 骨架与 N/A（可立即做）

1. 新增 `scripts/character-combat/profile-recipes/112001.json`。
2. 保持 roster 分母 9、`Kibo DNA=[]`，不要读取/实现 `hero_rank`。
3. 声明 reachable controls、public actions、普通五段 chain、7 条主动派生和所有 scenario N/A。
4. 加入 4 条稳定 unresolved：Charging overlap、damage/toughness order、watcher same-packet、wrapper same-packet。
5. 只把 `11200162` 记为第 2.7 节 provenance N/A，保持 `required=false`、`blocksReadiness=false`；不得把 Charging overlap 混入该 N/A。
6. owner-staging 生成，不写全局 generated：

```powershell
node scripts/sync-character-combat-profile.mjs --owner 112001 --output-root work/m12-b3/integration-staging-112001 --write
```

验收：主动入口精确；N/A 不可调度；owner 仍非 formal。

### 阶段 B：landed-hit 与 Charging（可立即做，精确阈值保持 open）

1. 扩展 compiler contract 以保留/校验 bridge predicate。
2. 实现 `landedHitEffectBindings`，接入星鸣 `250 +1` 和四条 CD `-3s`。
3. 实现非重叠帧 Charging release；精确 `59F/67F` 返回 `112001-charge-threshold-overlap-order-open`，直到客户端 evaluator 证据闭合。
4. 运行第 6 节聚焦测试。

验收：action-start/miss/interruption 反例全部通过；不改 UI、包体或性能路径。

### 阶段 C：consumer 跨包顺序（可立即做）

1. 编译 `112001258/268/260` 结构，逐 consumer 读取当前资源。
2. 实现候选 `250 -> 450`、单候选充分层数、普通/强化 damage、随后 `299/499` 超限包。
3. 每个 packet 保留独立 identity/sequence，不实现猜测的包内 HP/toughness 顺序。
4. toughness 输出仍携带 `machine-axis-enemy-settlement-client-order-open`。

验收：资源状态、分支 element、weakBreak 原始系数和跨包序列通过；不产生 formal toughness score。

### 阶段 D：客户端 toughness 合同（必须等待外部证据合入）

前置：optimizer toughness 任务提供第 3.2 节合同、匹配二进制/证据哈希，并关闭全局 `machine-axis-enemy-settlement-client-order-open`。

之后才能：

1. 把每个 branch/overlimit packet 接入客户端原生 HP/toughness/break 顺序。
2. 裁决 191F wrapper 是否影响同包。
3. 裁决 128F 首包 break 是否能触发 observer。
4. 启用 8 秒一次性 observer 与 11 秒全队暴伤。
5. 重新评估 toughness-cycle/fastest-kill 资格，但仍不自动 formal admission。

### 阶段 E：集成线统一生成与资格复核

阶段 E 可按两档进入：`evidence-integrated` 要求 A-C 可实现部分完成且 4 条 open 稳定传播；`formal-candidate` 还要求 Charging evaluator 与阶段 D 客户端证据均闭合。两档都只由单一集成任务顺序执行；并行侧车不得争用这些目录：

```powershell
npm run data:sync-verified-combat
npm run data:sync-character-combat -- --all
npm run data:generate-optimization-scenario-policy
npm run data:generate-character-acceptance
npm run data:generate-optimization-qualification
npm run data:generate-visual-acceptance
```

随后按实际 drift 执行只读审计：

```powershell
npm run audit:verified-combat
npm run audit:character-combat
npm run audit:optimization-scenario-policy
npm run audit:character-acceptance
npm run audit:optimization-qualification
npm run audit:visual-acceptance
git diff --check
```

这些命令属于集成线清单，不是本侧车的测试记录；仍禁止 `npm run test:full`。

## 5. 必须等待外部客户端证据后才能实现的清单

| identity | 等待原因 | 允许提前完成的部分 |
| --- | --- | --- |
| `112001-charge-threshold-overlap-order-open` | `59F/67F` 同时命中提前/完全释放窗，客户端 evaluator 顺序未知 | 非重叠帧 Charging release、原始窗口与 bridge predicate |
| `112001-damage-toughness-client-order-open` | 单 damage/overlimit 包内 HP、toughness、break 顺序未知 | element、weakBreak 原始系数、跨包 source order |
| `112001-ultimate-wrapper-same-packet-order-open` | 191F target consumer 与 toOwn wrapper 同碰撞先后未知 | wrapper element/属性/12000ms 来源记录 |
| `112001-ultimate-watcher-same-packet-order-open` | 128F damage 与 observer apply 同碰撞先后未知 | observer/buff element、8000/11000ms、一次性、全队目标 |
| `112001-ultimate-break-team-crit-runtime` | 必须消费权威 break event 和 observer-active-at-break | 语义 contract 与反例 |
| `112001-toughness-cycle-formal-score` | 全局 formal gate 仍是 client order open | 资源模拟与诊断 trace |
| `112001-fastest-kill-formal-score` | lethal/break 同帧 cutoff 依赖客户端 settlement cursor | 稳定 packet identity/source sequence |

除 Charging evaluator 和客户端 break/toughness 同包顺序项外，没有因 `11200162` 描述产生的等待项；其结构化 N/A 不参与 readiness。

## 6. 聚焦测试清单

集成阶段新增建议：

- `src/__tests__/data/verified112001ControlContracts.test.js`
- `src/__tests__/simulation/verified112001LandedEffects.test.js`
- `src/__tests__/simulation/verified112001TuningConsumeRuntime.test.js`
- `src/__tests__/simulation/verified112001UltimateObserver.test.js`（阶段 D 才启用 applied cases；此前只测 fail-closed）
- `src/__tests__/optimization-qualification/verified112001ScenarioApplicability.test.js`

阶段 A-C 的聚焦命令：

```powershell
npx vitest run src/__tests__/data/verifiedDerivedControlContracts.test.js src/__tests__/domain/verifiedActionContextScheduling.test.js src/__tests__/simulation/verifiedActionVariantRuntime.test.js src/__tests__/simulation/verifiedTuningMarkRuntime.test.js src/__tests__/optimization-qualification/landedHitRecoveryEvidence.test.js src/__tests__/data/verified112001ControlContracts.test.js src/__tests__/simulation/verified112001LandedEffects.test.js src/__tests__/simulation/verified112001TuningConsumeRuntime.test.js src/__tests__/optimization-qualification/verified112001ScenarioApplicability.test.js
```

阶段 D 追加：

```powershell
npx vitest run src/__tests__/simulation/verifiedCombatRuntime.test.js src/__tests__/simulation/verified112001UltimateObserver.test.js
```

每次都补 `git diff --check`，不得运行 `test:full`。owner staging 生成物放 `work/`，完成核对后由集成任务统一决定是否纳入/清理，侧车不操作全局 generated。

## 7. 资格输出约束

owner/report 输出必须明确：

```text
roster denominator = 9
Kibo DNA = []
hero_rank = dead-config / not implemented
scenario = m12c-zero-distance-passive-boss-v1
formalAdmission = false until all required gates close
optimizationReady = not asserted by this sidecar; central integration decides after Charging and client toughness gates close; orphan descriptions add no gate
M12-C = locked
```

若阶段 A-C 的可实现部分已完成，但 Charging evaluator 或阶段 D 尚未闭合，正确状态是“部分 runtime evidence-ready、正式资格 fail-closed”，不能用“112001 已完成”省略开放项；也不得把孤立描述重新计为开放项。
