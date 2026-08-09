# 112001 资源图与 consumer 证据

## 1. 主动可达控制图

### 1.1 特殊重击入口

`EventBridgeBehaviorData` 的 `startFrame + frameCount` 被规范化为右开窗。下表的核心入口均不需要敌方攻击、受击、闪避成功、格挡成功或反击事件，因此在 `m12c-zero-distance-passive-boss-v1` 中主动可达。

| 来源动作 | source control/sub | 重击输入窗 | target control/sub | 特殊重击 | behavior pathId | 主动可达 |
| --- | --- | --- | --- | --- | ---: | --- |
| 普攻 A2 | `11200102/sub0` | `[55,320)` | `11200110/sub1` | 2 | `3680827837063640949` | 是 |
| 普攻 A3 | `11200103/sub0` | `[63,243)` | `11200110/sub2` | 2 | `6793272662003117501` | 是 |
| 普攻 A4 | `11200104/sub0` | `[36,266)` | `11200110/sub3` | 3 | `-1628043982540349619` | 是 |
| 普攻 A5 | `11200105/sub0` | `[59,179)` | `11200110/sub4` | 3 | `-8216854629522320996` | 是 |
| 星鸣技 | `11200112/sub0` | `[67,298)` | `11200110/sub1` | 2 | `5434729759590619730` | 是 |
| 星决技 | `11200113/sub0` | `[216,461)` | `11200110/sub3` | 3 | `-7179768813052977291` | 是 |
| 星鸣协战 | `11200121/sub0` | `[112,377)` | `11200110/sub1` | 2 | `5933815741903944333` | 是；作为相邻主动入口记录 |
| 极限反击 | `11200125/sub0` | `[24,194)` | `11200110/sub1` | 2 | `2313703050033028770` | 否；scenario-n/a |
| 完美格挡/招架反击 | `11200127` | 来源存在 | `11200110/sub3` | 3 | 见该 control 资源 | 否；scenario-n/a |

核心 `bridge=3 (InterruptSkill)` 窗口同时给出 `allowSkill1=1`；星鸣入口的 `frameIndex=0`，普攻 A2/A3 与星决入口记录的 `frameIndex=8`。实现必须匹配 control、subskill、input command 与右开窗，不能只凭公开文本在任意时间切入。

主动调度最小前置：

```text
normal A2/A3 + heavy in window -> 11200110/sub1 or sub2
normal A4/A5 + heavy in window -> 11200110/sub3 or sub4
star landed or action-progress + heavy in [67,298) -> 11200110/sub1
ultimate action-progress + heavy in [216,461) -> 11200110/sub3
```

入口窗口是动作控制窗口，不要求前一个伤害包命中；由入口之后产生的印记、CD 恢复、observer/buff 等效果仍各自要求对应碰撞落地。

### 1.2 重击控制与 Charging 释放

`skill_control_11200110__-3020379679137028416.json` 含五个 subskill：

| sub | 含义 | control 时长 |
| ---: | --- | ---: |
| 0 | 默认重击；不是本任务的特殊重击 2/3 | 309F |
| 1 | 由 A2/星鸣/协战进入的特殊重击 2 charge | 294F |
| 2 | 由 A3 进入的特殊重击 2 charge | 294F |
| 3 | 由 A4/星决进入的特殊重击 3 charge | 156F |
| 4 | 由 A5 进入的特殊重击 3 charge | 156F |

Charging bridge（`ESkillEventType.Charging=4`）进入 `11200141`：

| source | 提前释放 | 完全释放 | 重叠点 |
| --- | --- | --- | --- |
| `11200110/sub1` | `[0,60) -> 11200141/sub0` | `[59,239) -> 11200141/sub1` | `59F` |
| `11200110/sub2` | `[0,60) -> 11200141/sub0` | `[59,239) -> 11200141/sub1` | `59F` |
| `11200110/sub3` | `[0,68) -> 11200141/sub2` | `[67,134) -> 11200141/sub3` | `67F` |
| `11200110/sub4` | `[0,68) -> 11200141/sub2` | `[67,135) -> 11200141/sub3` | `67F` |

`11200141` 的 release subskill 时长：提前重击 2 `sub0=274F`、完全重击 2 `sub1=265F`、提前重击 3 `sub2=236F`、完全重击 3 `sub3=258F`。

注意：两个 release window 在阈值各重叠一帧。`allowCountermeasuresSkill=1` 只是该 behavior 的一个许可字段，不能覆盖 `bridge=Charging` 并把它误判为反击入口。实现必须保留原始 bridge predicate 和来源顺序；正式动作调度可以精确落在 `59F/67F`，而当前既没有客户端 Charging evaluator 的同帧裁决，也没有冻结场景政策排除这些帧，因此必须返回 `112001-charge-threshold-overlap-order-open` 并拒绝 formal scheduling，不得按数组顺序猜测。

## 2. 星鸣：雷印记与末击

`11200112/sub0` 总长 271F，碰撞帧为：

```text
27F, 33F, 39F, 49F, 55F, 62F
```

### 2.1 雷印记 250

首次碰撞 `[27,28)` 的 collision behavior pathId 为 `5182973323990506066`，target damage 为 `112001056`；同一 collision 的 `toOwnElementBaseDatas` 挂载 element pathId `-3809486317990090417`，向现有队伍调谐印记容器执行：

```text
elementConfigId = 250
stackDelta = +1
profile = thunder tuning mark
```

所以正确事务为：

```text
star action -> hit-created@27F -> hit-landed -> team tuning mark 250 +1
```

它不是 `action-start` 事务。Unity 的注入路径是 source actor 的 `toOwn`，PUBLIC 语义是队伍获得印记；集成时应进入现有共享 tuning-mark 容器，而不是新造普通 actor buff。若 27F 首碰撞未命中，即使 33F 之后的伤害命中，也没有来源允许补发这 1 层印记。距离 0/投射物立即命中只使产品 golden 场景可稳定得到 landed，不得删除通用 runtime 的 miss gate。

### 2.2 `11200162` current-client-orphan / stale-description 裁决

原始来源事实必须原样保留：NewTable `skill_level` row `2193`、`skillId=11200162` 指向 CHS `9418863283712`，描述确实写有星鸣技末次伤害命中施加 1 层 `焰火`、持续 15 秒。这只证明描述行存在。

当前可执行客户端给出的机制边界是：

- 星鸣最后 collision 是 `[62,63)`，target damage `112001064`，但该 collision 没有与描述对应的 toOwn/toTarget consumer。
- `skill_control_11200162__-3629621280326451238.json` 的 `skillResourceMaps.elements` 只有 path `-1181925444607214156` 与 `1138707259999444314`。
- 两个 path 实际对应 `112001133 -> 112001134`：上场触发、暴击率 `+8%`、持续 8 秒；它不是描述中的机制。
- 112001 可达 Battle Element 图没有能与该描述唯一绑定的元素。
- 全局搜索得到的 `101003/480xxx` `焰火` 元素属于其他角色链，只能作为防止跨角色误借的负例。

当前客户端资源是权威机制边界。因此这里不是“consumer 尚待补齐”，也不建立末击 landed/miss/interruption 生命周期。统一记录为：

```json
{
  "recordIdentity": "112001-current-client-orphan-skill-level-2193",
  "classification": "current-client-orphan",
  "descriptionStatus": "stale-description",
  "applicability": "not-applicable",
  "gameplayMechanic": false,
  "runtimeGenerationMode": "none",
  "required": false,
  "blocksReadiness": false
}
```

任何把 62F landed、miss、中断或同帧游标映射成该描述效果的正向合同都没有客户端来源，必须拒绝。该记录不进入 production recipe/runtime、不进入 required、不阻断 readiness，也没有后续“等待 consumer”实现阶段。

## 3. 被动 11200161：落地重击减少星鸣 CD

Battle Element `112001267`（pathId `3549516589720748751`）：

- 名称/描述：`减少CD`。
- `recoverType=3`、`slot=3`、`cdRecoveryType=0`。
- formula 值 `G=-3`，由永久 passive marker `112001132` 门控。
- 目标槽位 3 对应星鸣技。

四个实际落地入口：

| 重击形态 | control/sub | collision window | target damage | collision behavior pathId | 结果 |
| --- | --- | --- | --- | ---: | --- |
| 提前重击 2 | `11200141/sub0` | `[26,27)` | `112001163` | `-1951771389325363148` | landed 后星鸣 CD `-3s` |
| 完全重击 2 | `11200141/sub1` | `[21,22)` | `112001207` | `-2221402581055835730` | landed 后星鸣 CD `-3s` |
| 重击 3（由 sub3 charge） | `11200110/sub3` | `[17,18)` | `112001180` | `-6246824455983816836` | landed 后星鸣 CD `-3s` |
| 重击 3（由 sub4 charge） | `11200110/sub4` | `[17,18)` | `112001180` | `2145608153295598680` | landed 后星鸣 CD `-3s` |

重击 3 的 CD 恢复发生在 charge control 的首个落地碰撞，早于提前/完全 release 选择。它对该次重击 3 只能触发一次，不能在 `11200141/sub2/sub3` 再补发。action 被启动但首碰撞未命中时不得减 CD；命中后再中断不回滚。

当前通用生成器能识别 cooldownReduction 字段，但会把该公式归入 `sp-formula-not-literal-function-5`；集成时需要显式 passive/landed-hit override，不能把 unresolved generic parse 当作数值 0。

## 4. 完全重击 3：三次逐层消费

以下图只描述 `11200141/sub3`（完全重击 3）：

```text
19F: damage 112001190, weakBreakDamageRate=22000, no mark consumer
32F: screen/freeze + consumer 112001258
39F: consumer 112001268
46F: consumer 112001268
```

### 4.1 consumer 结构

| frame | consumer | consume mode | candidates | required/max | 无成功消费 damage | 成功消费 damage | weakBreak 普通/强化 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 32 | `112001258` path `-3467106530063546693` | `Priority=0` | `[250,450]` | `1 / 0` | `112001264` | `112001259` | `22000 / 25000` |
| 39 | `112001268` path `4468850874124785724` | `Priority=0` | `[250,450]` | `1 / 1` | `112001196` | `112001270` | `22000 / 25000` |
| 46 | `112001268` path `4468850874124785724` | `Priority=0` | `[250,450]` | `1 / 1` | `112001196` | `112001270` | `22000 / 25000` |

三次都是一层 transaction，所以总消费量是 `min(3, 每次执行时可满足条件的印记层数)`，并且每一击都重新读取消费后的状态。不能在 32F 一次性预扣 3 层，也不能把三击的资源选择快照固定为 action-start 状态。

### 4.2 每个 consumer 的客户端顺序

对每个 32F/39F/46F consumer：

```text
1. CalculateConsumeCount
   - 按 elementArr 索引升序检查 250，再检查 450
   - 选择首个当前层数 >= consumeLayerNum 的候选
2. DoConsume
   - 从所选的单一候选扣 1 层
3. DoInject
   - 无成功消费走 list_1 普通伤害；成功消费走 list_2 强化伤害
   - 随后按所选 element id 查表并注入超限包：250 -> 299，450 -> 499
```

可据此得到以下确定顺序：

```text
consume mark -> branch damage (HP + weakBreak payload) -> selected-mark overlimit packet
```

其中“branch damage 的 HP 与 toughness 谁先结算、它自身触发 break 的游标位置”仍是 optimizer toughness 客户端证据任务的责任；本侧车只保证 branch damage 在所选超限包之前。

### 4.3 资源示例

| 32F 前状态 `(雷250,暗450)` | 32F | 39F | 46F | 总消费 |
| --- | --- | --- | --- | ---: |
| `(3,0)` | 雷 | 雷 | 雷 | 3 |
| `(2,2)` | 雷 | 雷 | 暗 | 3 |
| `(1,2)` | 雷 | 暗 | 暗 | 3 |
| `(0,2)` | 暗 | 暗 | 无 | 2 |
| `(0,0)` | 无 | 无 | 无 | 0 |

“无”只表示没有成功选择/消费印记且没有所选印记超限包；普通 damage 分支仍由 `injectElementDataList_1` 表达。

## 5. 星决：两层消费、属性 wrapper 与破韧观察器

`11200113/sub0` 的关键碰撞：

| frame | 资源 | 结论 |
| ---: | --- | --- |
| 128 | target damage `112001241` + toOwn `112001271` | 首次碰撞落地时挂 8 秒破韧观察器 |
| 140/147 | 后续 target damage | 继续星决伤害序列 |
| 191 | target consumer `112001260` + toOwn wrapper `112001255` | 两层印记消费/普通强化分支；命中后 12 秒属性 wrapper |
| 196 | 后续 target damage | consumer 后仍有伤害包 |

### 5.1 两层消费

`112001260`（pathId `-7212963066810547935`）：

```text
consumeMode = Priority(0)
elementArr = [250,450]
consumeLayerNum = 2
consumeLayerMaxNum = 2
list_1 = 112001265, weakBreakDamageRate=16000
list_2 = 112001261, weakBreakDamageRate=19000
selected overlimit = 250 -> 299, 450 -> 499
```

选择条件是“同一个候选至少 2 层”。状态 `(1,1)` 不能拼接消费；状态 `(2,2)` 选雷 `250`；状态 `(0,2)` 选暗 `450`。成功时顺序与重击 3 相同：先扣 2 层，再发强化 damage，最后发对应超限包。

### 5.2 命中后 12 秒 wrapper

同一 191F collision 的 toOwn `112001255` 持续 `12000ms`，子属性为：

- `112001257`：attribute `113`，raw `99`。
- `112001256`：attribute `222`，raw `3000`。

PUBLIC 语义将该命中后 bundle 描述为破韧效率 `+30%/12s`。正确生命周期是 191F 对应碰撞 landed 后才激活，结束为右开边界。当前证据没有闭合 target consumer 与 toOwn wrapper 的同帧客户端先后，所以不能让 wrapper 在没有游标证据时影响 191F 自身 damage/weakBreak，也不能用时间相等强行排除；这项由 settlement 接口返回权威 active-state cursor。

### 5.3 8 秒破韧观察器与 11 秒全队暴伤

`112001271`（pathId `-4310182546344143382`）：

- 在 128F 首次 collision 的 `toOwnElementBaseDatas` 上。
- `duration=8000`。
- `triggerCounter=1`，一次性。
- condition tuple `(conditionParam1=12, conditionParam2=40)`；结合 PUBLIC 文本与 elementName `burst伤害命中break敌人时`，目标事件是星决后破韧。
- trigger target type `15`，注入 `112001272`。

`112001272`（pathId `8180705944172128032`）：

- attribute `8`（暴击伤害）。
- raw `1000`，即 `+10%`。
- `time=11000`。
- 全队目标。

对于 128F 同一 collision：damage 与观察器挂载孰先尚无客户端证据。实现不得写成 `event.time >= armTime` 就自动让本包破韧触发；必须由 optimizer toughness 合同返回该 break 发生时观察器是否已激活。对之后的独立事件，观察窗为 `[authoritativeArmTime, authoritativeArmTime+8000ms)`；触发后的团队 buff 为 `[breakEventTime, breakEventTime+11000ms)`。

## 6. 场景 N/A 边界

以下资源保留来源，但不进入产品场景调度：

- `11200115` 闪击/闪避攻击。
- `11200111` 跃击、跳跃或下落派生。
- `11200125` 极限反击，以及其重击转特殊重击 2/普通攻击接续。
- `11200127` 完美闪避/格挡/招架反击，以及其重击转特殊重击 3。
- 所有要求敌方攻击、角色受击、闪避成功、格挡成功、招架成功、反击窗口或 Boss 主动事件的 listener/transaction。

`11200121` 星鸣协战本身不依赖敌攻，其 `[112,377)` 特殊重击 2 入口作为相邻主动路径保留。`11200126` 星鸣连携未在本侧车被判为敌攻专属，也没有被扩大到本任务的重击核心范围。
