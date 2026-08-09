# 112001 资源图、consumer 与时序合同

本图绑定 `m12-112001-assumption-runtime-v1@1.0.0`、`sha256-canonical-json-v1:3ae5e3bf22fabf052d07cb005f3575395c6abcb135942f5bf24dbdc8735e3e71`；四条 assumption 仍是 `resolved-by-product-assumption`，不是客户端事实。

## 1. 主动动作图

以下 EventBridge 均采用右开输入窗，且不需要 Boss 攻击、角色受击、闪避或格挡事件。

| 来源 | 输入窗 | 执行 control/sub | 语义 | pathId |
| --- | --- | --- | --- | ---: |
| A2 `11200102/sub0` | `[55,320)` | `11200110/sub1` | 特殊重击2 | `3680827837063640949` |
| A3 `11200103/sub0` | `[63,243)` | `11200110/sub2` | 特殊重击2 | `6793272662003117501` |
| A4 `11200104/sub0` | `[36,266)` | `11200110/sub3` | 特殊重击3 | `-1628043982540349619` |
| A5 `11200105/sub0` | `[59,179)` | `11200110/sub4` | 特殊重击3 | `-8216854629522320996` |
| 星鸣 `11200112/sub0` | `[67,298)` | `11200110/sub1` | 特殊重击2 | `5434729759590619730` |
| 星决 `11200113/sub0` | `[216,461)` | `11200110/sub3` | 特殊重击3 | `-7179768813052977291` |
| 星鸣协战 `11200121/sub0` | `[112,377)` | `11200110/sub1` | 特殊重击2 | `5933815741903944333` |

入口窗回答“何时可切入 charge-control”；入口不要求前一伤害命中。印记、CD、watcher 和 wrapper 仍分别受对应碰撞 landed gate 控制。

### 1.1 Charging 组合

```text
source action/input window
  -> 11200110/sub1..4 charge segment [0, releaseFrame)
  -> 11200141 selected release segment shifted by releaseFrame
  -> final occupancy = releaseFrame + release-control duration
```

| charge source | early | full | release control 时长 |
| --- | --- | --- | --- |
| `11200110/sub1,sub2` | `[0,60) -> 11200141/sub0` | `[59,239) -> sub1` | sub0 `274F`；sub1 `265F` |
| `11200110/sub3` | `[0,68) -> 11200141/sub2` | `[67,134) -> sub3` | sub2 `236F`；sub3 `258F` |
| `11200110/sub4` | `[0,68) -> 11200141/sub2` | `[67,135) -> sub3` | sub2 `236F`；sub3 `258F` |

assumption A `112001-charge-threshold-overlap-order-open` 的 v1 选择是 `greatest-start-frame`：

```text
58F -> sub0   59F -> sub1   60F -> sub1
66F -> sub2   67F -> sub3   68F -> sub3
```

选择器不能依赖 JSON 数组顺序。等 startFrame 的候选只有执行 control/sub 与 semantic identity 均一致时，才按稳定 source identity 决胜；语义冲突返回 `charging-release-same-threshold-semantic-conflict`。

## 2. 星鸣雷印记

`11200112/sub0` 碰撞帧为 `27/33/39/49/55/62F`。27F 首碰撞：

```text
hit element 112001056
behavior path 5182973323990506066
landed
  -> toOwn tuning mark 250 +1
miss/cancelled/blocked
  -> no mark
```

雷印记进入共享队伍 tuning 容器，不是普通 actor buff。27F miss 后，33F 以后 landed 没有“补发首碰撞印记”的来源。

62F 末碰撞没有“焰火” consumer；它不能生成任何 stack、duration 或 effect cursor。`11200162` 实际可执行链另见第 7 节。

## 3. 特殊重击 CD 被动

Battle Element `112001267`：槽3、`recoverType=3`、`cdRecoveryType=0`、formula `G=-3`。四个唯一 landed 入口：

| 形态 | control/sub | 碰撞 | hit element | behavior pathId |
| --- | --- | --- | ---: | ---: |
| 重击2 early | `11200141/sub0` | `[26,27)` | `112001163` | `-1951771389325363148` |
| 重击2 full | `11200141/sub1` | `[21,22)` | `112001207` | `-2221402581055835730` |
| 重击3 source3 | `11200110/sub3` | `[17,18)` | `112001180` | `-6246824455983816836` |
| 重击3 source4 | `11200110/sub4` | `[17,18)` | `112001180` | `2145608153295598680` |

```text
hit-landed -> star cooldown -3000ms
hit-missed/cancelled -> no cooldown change
landed then interrupted -> keep committed recovery
```

重击3 的恢复发生在 charge-control 17F，不在 release-control 补发；同一次动作只触发一次。

## 4. 完全重击3：三次独立消费

`11200141/sub3` 的关键图：

```text
19F: damage 112001190, weakBreak 22000, no consumer
32F: judgment 112001258 -> base 112001264 / enhanced 112001259
39F: judgment 112001268 -> base 112001196 / enhanced 112001270
46F: judgment 112001268 -> base 112001196 / enhanced 112001270
```

每个 judgment 均为同一通用事务：

```text
1. CalculateConsumeCount：按 Priority [250,450] 找首个至少 1 层的单一候选
2. DoConsume：从选中候选扣 1 层
3. DoInject：
   - 无候选 -> list1 普通 damage，weakBreak 22000
   - 成功 -> list2 强化 damage，weakBreak 25000
4. 成功时在 branch damage 后发所选印记 overlimit：250->299，450->499
```

三个 consumer 每次重读当前资源，所以初始 `(雷1,暗2)` 会依次选择 `250,450,450`。不得 action-start 预扣三层，也不得一次 consumer 跨元素拼层。

稳定 source sequence 必须满足：

```text
consume(selected mark) < branch damage < selected-mark overlimit
32F packet < 39F packet < 46F packet
```

## 5. 星决 191F consumer 与 wrapper

### 5.1 两层消费

`11200113/sub0 @191F`：judgment `112001260`，候选 `[250,450]`，同一候选需要 2 层。

```text
无候选 -> list1 112001265
成功 -> consume 2 -> list2 112001261 -> selected overlimit 299/499
```

| 初始 `(250,450)` | 结果 |
| --- | --- |
| `(1,1)` | 无候选、normal list1、不发 overlimit |
| `(2,2)` | 选 250、扣2、enhanced、发299 |
| `(0,2)` | 选 450、扣2、enhanced、发499 |

### 5.2 assumption D：post-hit wrapper

同碰撞还挂 `112001255`，其子元素为：

- `112001257`：attribute `113` raw `99`
- `112001256`：attribute `222` raw `3000`
- lifecycle：`[applyTime,applyTime+12000ms)`

v1 固定顺序：

```text
191F target consumer -> consume -> normal/enhanced damage -> overlimit
191F landed
  -> post-hit apply 112001255 wrapper
196F and later independent packet
  -> may read wrapper
```

191F 自身不受益；191F miss 不应用；恰好 `+12000ms` 不可见。alternate `wrapper-before-current-packet` 会改变 191F 输出，作为敏感性负例保留。

## 6. 星决 128F break watcher

来源图：

```text
128F hit element 112001241
landed -> arm 112001271 for 8000ms, triggerCount=1
first eligible enemy-break -> consume watcher
  -> team actors apply 112001272
  -> attribute 8 raw 1000, duration 11000ms
```

assumption C `hit-then-arm-no-retroactive-trigger` 的时序：

```text
128F damage/toughness/break settlement
  -> if landed, arm watcher after packet
  -> 128F packet cannot trigger the watcher it creates
later canonical packet in [armTime, armTime+8000ms)
  -> first break triggers once
```

128F miss 不 arm；128F landed 后在 191F 前中断不回滚；恰好 `armTime+8000ms` 不触发；buff 恰好 `breakTime+11000ms` 失效。alternate `arm-before-current-hit` 只用于证明敏感性。

## 7. 单包 enemy settlement

assumption B 直接引用中央 `m12-enemy-settlement-runtime-v2@2e3095db4b8c9232`，不得建立 112001 专属排序：

```text
1. HP damage output/multiplier 读取 packet 前 break state
2. 结算 toughness 并产生 break transition
3. 提交当前 packet 的 HP mutation
4. 后续同帧 packet 按 canonical sourceSequencePath/eventIdentity 读取新 break state
```

因此破韧触发包自身不吃 break multiplier，后续独立包可吃。改动 sourceSequencePath 顺序必须改变 input/data/trace/build hash，或在不具备稳定身份时 fail closed。

## 8. `11200162` 实际链与 orphan 防线

当前资源只闭合：

```text
controlled actor enters
  -> 112001133 (8000ms wrapper)
  -> 112001134 attribute 7 raw 800
  -> crit rate +8%, refresh, right-open
```

NewTable row 2193/CHS 9418863283712 的“焰火”描述继续保留为 `current-client-orphan/stale-description`：`gameplayMechanic=false`、`runtimeGenerationMode=none`、`required=false`、`blocksReadiness=false`。`101003/480xxx` 同名图仅为“禁止把孤立文案伪造成机制”的负例。

## 9. 场景路由

冻结场景只调度主动动作面：普攻链、特殊重击2/3、星鸣、星决、星鸣协战/星携。以下控制保留来源但 N/A：

| control | 结构化原因 |
| --- | --- |
| `11200115` | `requires-evade-context` |
| `11200111` | `requires-aerial-or-fall-context` |
| `11200125` | `requires-enemy-attack-derived-counter-window` |
| `11200127` | `requires-enemy-attack-and-perfect-defense-event` |

受击、闪避、格挡、反击专属 listener 同样不得出现在 golden 调度或改变资源状态。

## 10. R4 generation authority 与 coverage 图

### 10.1 hit-gated effect 必须与 landed packet 同源

```text
scenario.combatScenario.projectile.defaultWillHit
  ?? scenario.projectile.defaultWillHit
  -> resolveActionHitWillHit(action, exactHitIdentity, defaultWillHit)
  -> damage/tuning/effect use the same landed decision
```

`conditional-damage-group-hit` 使用 `conditional-damage:<groupIdentity>:<hitIndex>`；`landed-action-hit` 先按 element/frame/behaviorPath 找到 resolution hit，再使用该 hit 的 source identity。scenario 默认 miss 时不得应用 wrapper/watcher/effect；显式 hit 可覆盖默认 miss，显式 miss 可覆盖默认 hit。

### 10.2 watcher suppression authority

```text
explicit mechanics package (packageId + packageHash)
  == action resolution package binding
  -> read only this package.breakTriggerWatchers[].suppressedEffectIdentities
  -> suppress matching semantic/raw watcher effect
otherwise
  -> fail closed: verified-battle-effect-generation-mechanics-package-binding-mismatch
```

不得从进程全局 installed package 偷读 suppression 后再消费另一 package/hash 的 action resolution。这样 formal 与 alternate/sensitivity replay 各自使用自己的 watcher 集合。

### 10.3 coverage candidate 映射

```text
recipe candidateResolutionMode opt-in
  -> published control root compact nodeClassifications
  -> exact graph.nodeIdentities + raw counts
  -> each node damage/toughness/sp source status
  -> each product dimension sourceClosureDisposition
  -> exact runtime binding identity + node relation identity + source identity
  -> candidate result
  -> action summary / coverage summary
```

67 个 selected-root graph 各映射为一个 settlement candidate，并对 `hp/toughness/actorSp/kiboSp` 分别裁决；31 个 semantic effect 各映射为 effect candidate，另加 1 个 passive。compact node snapshot 必须来自本次 owner 编译实际使用的 control graph，不能用缺少 support control 或版本不同的全局 catalog 代替。

94 个 candidate node reference 中，50 个 node 的总分类仍是 unresolved；逐维 closure 后未闭合数为 0。终态只能是：

- `runtime-applied`：真实 hit、semantic runtime 或 conditional consumer；
- `verified-zero`：具体 node source dimension 明确为 zero；
- `not-applicable`：精确冻结场景排除，或两个星决 branch-template graph/node/dimension policy；
- `unresolved`：任何其余情况，包括“没找到 output”。

runtime node 不允许共享 graph 级来源集合。星决 root `112001260` 的 base/enhanced damage node 只可分别通过 conditional group 的 `baseTemplate(path=-251118..., element=112001265)` / `enhancedTemplate(path=140396..., element=112001261)` 闭合；overlimit node `-502220.../296` 与 `208574.../498` 只可通过同 graph、同 path、同 element、`damage=applied` 的各自 semantic effect 闭合。validator 从 `contracts.tuningMarkConditionalDamageGroups` 与 `contracts.effects.semantic` 重算这四条关系，并要求 closure 三组字段完全等值。

最终 settlement 分布为 `hp 17/30/20/0`、`toughness 16/31/20/0`、`actorSp 9/38/20/0`、`kiboSp 9/38/20/0`（applied/zero/N/A/unresolved）。只要任一 node closure unresolved，所属 candidate 与 coverage dimension 都不得是 applied。

中央精确 root `11200103|0|elements|1|-7394849788543465206` 的 root `112001008` 没有 edge/hit/semantic/conditional，raw node 总分类仍为 unresolved；其 source node 的 `damage/toughness/sp` 各自明确 zero，因此四个产品维均为 `verified-zero`。该例证明“总分类 unresolved”不能整体提升，也证明“无识别输出”不能变成 N/A。
