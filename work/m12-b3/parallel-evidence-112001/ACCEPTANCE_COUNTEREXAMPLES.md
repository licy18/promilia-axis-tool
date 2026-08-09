# 112001 验收反例与 scenario N/A

## 1. 统一判定词汇

测试与生成物必须区分下列事件：

```text
action-start
input-window-open / input-window-close
hit-created
hit-landed | hit-missed | hit-cancelled
effect-applied
damage-settled
toughness-settled
break-triggered
interrupt-applied
```

所有时间窗使用 `[start,end)`。若两个事件同帧，必须比较稳定事件游标；只比较 `absoluteFrame` 或毫秒时间不合格。

## 2. 派生与蓄力窗口反例

### AX112001-WIN-001：右边界不能输入

对每条主动派生分别断言：

| source | 接受 | 拒绝 |
| --- | --- | --- |
| A2 `[55,320)` | `55F`、`319F` | `54F`、`320F` |
| A3 `[63,243)` | `63F`、`242F` | `62F`、`243F` |
| A4 `[36,266)` | `36F`、`265F` | `35F`、`266F` |
| A5 `[59,179)` | `59F`、`178F` | `58F`、`179F` |
| 星鸣 `[67,298)` | `67F`、`297F` | `66F`、`298F` |
| 星决 `[216,461)` | `216F`、`460F` | `215F`、`461F` |

反例目标：发现把 `endFrame` 当可输入帧、把 window duration 当绝对结束帧、或用 action 总时长替代 EventBridge 窗口的实现。

### AX112001-WIN-002：默认重击 sub0 不能冒充特殊重击

设置普通 action-start 后直接使用默认重击，不满足任何派生窗口；预期执行 `11200110/sub0`，不得获得特殊重击 2/3 的碰撞、CD 恢复或印记 consumer。仅因 public action kind 同为 `charged-attack` 而选 sub1/sub3 应失败。

### AX112001-WIN-003：主动入口不得依赖敌攻

Boss 保持静止且不攻击，依次调度 A2/A3/A4/A5、星鸣、星决并在合法窗输入重击；预期均能进入对应 special subskill。若调度器把这些入口和 `11200125/27` 一起标为“反击限定”，测试失败。

### AX112001-CHARGE-001：Charging 与 countermeasures 字段不能混淆

在 `11200110/sub1..4` 中，release transition 必须由 `bridge=Charging(4)` 驱动。仅见 `allowCountermeasuresSkill=1` 就要求敌方反击事件的实现应失败。

### AX112001-CHARGE-002：阈值重叠保持 fail-closed open

- 特殊重击 2 的 `59F` 同时落入 `[0,60)` 与 `[59,239)`。
- 特殊重击 3 的 `67F` 同时落入 `[0,68)` 与 `[67,134/135)`。

正式动作调度可以精确输入 `59F/67F`。在没有客户端 Charging evaluator 顺序证据、且没有用户冻结场景政策排除这些帧时，精确阈值必须返回 `112001-charge-threshold-overlap-order-open`，而不是静默选提前或完全释放。`58F/60F` 与 `66F/68F` 则应分别稳定落到唯一分支。

## 3. landed-hit 被动反例

### AX112001-MARK-001：星鸣 action-start 不给印记

执行星鸣但在 27F 前中断；预期雷印记 `250` 不变。action-start 就 `+1` 的实现失败。

### AX112001-MARK-002：首碰撞 miss 后不能由后续 hit 补发

令 27F collision miss，33F collision landed；预期 `250` 不变。将公开文本“技能命中”泛化为任意一 hit 补发印记的实现失败。

### AX112001-MARK-003：落地后中断不回滚

27F collision landed 并应用 `250 +1`，同帧稍后或 28F 中断；预期印记保留。中断 action 时回滚已落地资源事务的实现失败。

### AX112001-CD-001：重击 2 未命中不减 CD

分别执行 `11200141/sub0@26F` 与 `sub1@21F`，让 collision miss；预期星鸣 CD 不变。按 charged action-start 或 release-start 直接 `-3s` 的实现失败。

### AX112001-CD-002：重击 3 的恢复发生在 charge 首碰撞

执行 `11200110/sub3` 或 `sub4`：

1. 17F collision landed，随后在 release 前中断；预期星鸣 CD 已减少 3 秒。
2. 17F collision miss，随后完全释放并命中；预期不得在 release 阶段补发 3 秒。

把恢复挂到 `11200141/sub2/sub3` 或只在完全重击 3 发放的实现失败。

### AX112001-CD-003：同帧 landed/interrupt 使用事件游标

构造同一 `absoluteFrame` 的两条 replay：

- `hit-landed cursor < interrupt cursor`：恢复生效且不回滚。
- `interrupt cursor < hit-landed cursor`：hit 被取消，恢复不生效。

两条 replay 只凭 frame/time 得到相同结果时测试失败。

## 4. 完全重击 3 consumer 反例

### AX112001-CA3-001：最多三层，不得预扣

初始雷印记 3 层：

- 31F 前仍为 3。
- 32F consumer 成功后为 2。
- 39F 成功后为 1。
- 46F 成功后为 0。

action-start、19F 初始 damage 或 32F 一次性扣 3 层的实现失败。

### AX112001-CA3-002：每一 consumer 重读资源

初始 `(雷=1,暗=2)`：预期 32F 消耗雷、39F/46F 各消耗暗。若三次都使用 action-start 快照并继续选择雷，测试失败。

### AX112001-CA3-003：Priority 不等于跨元素合并

初始 `(雷=0,暗=2)`：32F/39F 消耗暗，46F 普通分支。初始 `(雷=1,暗=1)`：32F 先雷、39F 再暗、46F 普通分支。任何单次 consumer 同时从雷和暗各扣一部分的实现失败。

### AX112001-CA3-003B：没有候选仍执行 list 1 damage

初始 `(雷=0,暗=0)` 时，三个 consumer 都不消费、也不发 `299/499` 所选印记包，但分别执行 `injectElementDataList_1` 的普通 damage。把已有 selection 证据中的 `no-consume-and-no-inject` 扩大解释成“整个 consumer 无伤害”的实现失败；直接客户端 `DoInject` 的 `m_consumeCount<=0` 分支已证明 list 1 会执行。

### AX112001-CA3-004：普通/强化 toughness 系数跟随本次选择

对 32F：无消费分支必须绑定 damage `112001264`/`weakBreak=22000`，成功分支绑定 `112001259`/`25000`。对 39F/46F：普通 `112001196`/`22000`，成功 `112001270`/`25000`。用 action 全局布尔值让所有三 hit 一起强化的实现失败。

### AX112001-CA3-005：超限包在分支 damage 之后

成功消费雷时，稳定事件游标应满足：

```text
consume(250) < branch-damage < overlimit(299)
```

成功消费暗时：

```text
consume(450) < branch-damage < overlimit(499)
```

先发超限再消费、先发超限再 branch damage、或把二者折成无身份的单包均失败。branch damage 内部 HP/韧性顺序在客户端证据合入前应返回 open，而非由本测试猜测。

### AX112001-CA3-006：中断截断后续 consumer

- 32F landed 后、39F 前中断：只消费 1 层。
- 39F landed 后、46F 前中断：只消费 2 层。
- 46F landed 后中断：三次既有事务均保留。

action-start 预扣或 action 中断回滚既有消费的实现失败。

## 5. 星决反例

### AX112001-ULT-001：两层必须来自同一候选

| 初始 `(雷,暗)` | 预期 |
| --- | --- |
| `(2,0)` | 消耗雷 2，强化 damage `112001261`，随后超限 `299` |
| `(1,1)` | 没有候选达到 2；不得把两种印记拼接消费 |
| `(2,2)` | 因 Priority 先选雷 2 |
| `(0,2)` | 消耗暗 2，强化 damage，随后超限 `499` |

### AX112001-ULT-002：消费发生在 191F consumer，而非施法或首 hit

128F 首 hit landed 后、191F 前中断：观察器可被挂载，但印记层数不变。施法开始或 128F 就扣两层的实现失败。

### AX112001-ULT-003：12 秒 wrapper 需要 191F 落地

191F consumer collision miss 时不应用 `112001255`；landed 后生命周期为 `[appliedTime,appliedTime+12000ms)`。恰好在结束时间的后续 damage 不得获得该 wrapper。

### AX112001-ULT-004：当前包是否吃 wrapper 必须等待客户端游标

在 optimizer toughness 客户端 settlement 合同未闭合前，查询 191F branch damage 的 active modifiers 必须返回 `112001-ultimate-wrapper-same-packet-order-open`。把“同帧”直接解释为生效前或生效后都不合格。

### AX112001-ULT-005：观察器只在首碰撞落地后挂载

128F 首 collision miss、140F 后续 collision landed：不得仅因星决 action 已开始就创建 8 秒观察器。128F landed 后即使 191F 前中断，观察器不因 action 结束而回滚。

### AX112001-ULT-006：8 秒右开、11 秒右开、一次性

对一个已权威激活的观察器：

- `armTime + 7999ms` 的 break 可触发。
- `armTime + 8000ms` 的 break 不触发。
- 首次合法 break 触发后，观察器消费；窗口内第二次 break 不重复发 buff。
- buff 在 `breakTime + 10999ms` 有效，在 `breakTime + 11000ms` 无效。

### AX112001-ULT-007：首 hit 同包破韧保持开放

128F target damage 与 toOwn watcher 在同一 collision。只给出相同 `absoluteFrame` 的 replay 不足以判定该 damage 造成的 break 是否触发观察器；缺少客户端 order cursor 时必须返回 `112001-ultimate-watcher-same-packet-order-open`。

### AX112001-ULT-008：全队目标与数值

合法 break 触发 `112001272` 后：全队 actor 获得 attribute `8` raw `1000`，持续 11000ms；不是仅主控、不是攻击力、不是暴击率、不是 +1000%。

## 6. `11200162` 孤立文案反例与 failure-to-pass

### AX112001-ORPHAN-001：原始描述来源必须保留

只读断言必须命中 NewTable `skill_level id=2193`、`skillId=11200162`、description `9418863283712` 与 value `9418863284480="1"`，并保留 CHS 原文中的 1 层、15 秒。删除或改写这条来源事实，测试失败；命中来源不等于存在 gameplay 机制。

### AX112001-ORPHAN-002：当前客户端机制边界优先

`skill_control_11200162` 必须只引用 path `-1181925444607214156` 与 `1138707259999444314`，并解析为 `112001133 -> 112001134` 上场暴击率 `+8%/8s`；星鸣 62F collision 必须没有对应 toOwn/toTarget consumer。任一断言不成立时重新取证，不能回退到描述推断。

### AX112001-ORPHAN-003：禁止生成不存在的正向事务

无论 62F final collision 是 landed、miss、被中断还是与中断同帧，112001 runtime 都不得因此创建 `焰火` stack、duration、target state 或 effect cursor。出现任一正向事务即以 `stale-description-promoted-to-mechanic` 失败。

### AX112001-ORPHAN-004：禁止跨角色借用

如果 recipe/compiler 使用 `112001133`、`112001134`、`101003*` 或 `480xxx` 伪造描述中的机制，测试失败。前两者是另一条 112001 暴击率链，后两组属于其他角色；它们只用于证明孤立文案不能被拼装成机制。

### AX112001-ORPHAN-005：N/A 不得阻塞 readiness

记录必须同时满足 `classification=current-client-orphan`、`descriptionStatus=stale-description`、`applicability=not-applicable`、`gameplayMechanic=false`、`runtimeGenerationMode=none`、`required=false`、`blocksReadiness=false`。它不得进入 unresolved、runtime-ready 覆盖分母或 optimization readiness gate。

### Failure-to-pass：旧 evidence 的误升格必须被捕获

以 accepted commit `e13a87bad900c03164b2beb9d5db12e76cba986c` 的旧记录为 failure fixture；只要出现以下任一形状，R1 文档/合同校验必须失败：

```text
recordIdentity = 112001-firework-consumer-source-open
runtimeGenerationMode = unresolved-source-only
存在“等待补 consumer”或“阶段 E 实现焰火”
存在末击 landed/miss/interruption 的正向效果生命周期合同
optimizationReady 依赖 firework provenance
```

失败原因分别归一为 `stale-description-promoted-to-mechanic`、`orphan-description-counted-as-required` 或 `nonexistent-mechanic-runtime-positive-contract`。只有原始文案仍可追溯、当前客户端缺席证据完整，且结构化 N/A 的 `required=false`、`blocksReadiness=false`、`runtimeGenerationMode=none` 同时成立时才 pass。

## 7. 结构化 scenario-out-of-scope N/A

### 7.1 必须输出的统一形状

```json
{
  "scenarioId": "m12c-zero-distance-passive-boss-v1",
  "ownerId": 112001,
  "controlSkillId": 11200125,
  "classification": "scenario-out-of-scope",
  "applicability": "not-applicable",
  "schedulable": false,
  "optimizationEligible": false,
  "reason": "requires-enemy-attack-derived-counter-window",
  "sourceIdentity": "NewTable/skill.rows[id=11200121]|skill_control_11200125.asset"
}
```

`sourceIdentity` 必须保留真实来源；N/A 不是“来源不存在”，也不是 unresolved。

### 7.2 N/A 清单

| identity | 资源/动作 | 必要前置 | reason |
| --- | --- | --- | --- |
| `112001-scenario-na-evade-attack` | `11200115` 闪击/闪避攻击 | 闪避/专用闪击上下文 | `requires-evade-context` |
| `112001-scenario-na-plunge` | `11200111` 跃击/跳跃/下落 | aerial/plunge 状态 | `requires-aerial-or-fall-context` |
| `112001-scenario-na-limit-counter` | `11200125` 极限反击 | 敌方攻击触发极限闪避/反击窗 | `requires-enemy-attack-derived-counter-window` |
| `112001-scenario-na-limit-counter-heavy` | `11200125 -> 11200110/sub1` | 上述反击已发生再输入重击 | `requires-enemy-attack-derived-counter-window` |
| `112001-scenario-na-limit-counter-normal` | `11200125 -> normal A2` | 上述反击已发生再输入普攻 | `requires-enemy-attack-derived-counter-window` |
| `112001-scenario-na-perfect-parry` | `11200127` 完美闪避/格挡/招架反击 | 敌方攻击与成功防御事件 | `requires-enemy-attack-and-perfect-defense-event` |
| `112001-scenario-na-perfect-parry-heavy` | `11200127 -> 11200110/sub3` | 上述成功防御再输入重击 | `requires-enemy-attack-and-perfect-defense-event` |
| `112001-scenario-na-receive-hit` | 所有受击 listener/effect | Boss 伤害命中角色 | `requires-boss-hit-event` |
| `112001-scenario-na-block` | 所有格挡 listener/effect | Boss 攻击与 block success | `requires-boss-attack-and-block-event` |
| `112001-scenario-na-counter` | 所有反击 listener/effect | Boss 攻击派生 counter window | `requires-boss-attack-derived-counter-window` |

### 7.3 N/A 验收

产品场景生成后应满足：

```text
all N/A records remain source-backed
all N/A records schedulable=false
all N/A records optimizationEligible=false
no N/A action appears in golden action sequence
no N/A transaction changes damage/resource/cooldown/buff state
N/A does not increase unresolved count
```

星鸣协战 `11200121` 不是敌攻专属，不能误列为整体 N/A；只把它内部需要反击前置的派生边单独 N/A。星鸣连携 `11200126` 本侧车未判定为 N/A，也未将其纳入重击核心实现范围。

## 8. 资格与错误传播反例

1. 仅有默认 `11200110/sub0` binding 时，特殊重击仍必须 unresolved；不得以“charged action 已有 timing”宣称覆盖。
2. `sp-formula-not-literal-function-5` 不能把 `112001267` 数值默认为 0；应由显式 landed-hit evidence override 闭合。
3. owner 级 unresolved/fail-closed 必须传播 `112001-charge-threshold-overlap-order-open`，以及 `112001-damage-toughness-client-order-open`、`112001-ultimate-watcher-same-packet-order-open`、`112001-ultimate-wrapper-same-packet-order-open` 三条客户端 break/toughness 同包顺序未知，共 4 条。
4. 只有 `112001-current-client-orphan-skill-level-2193` 为 `required=false`、`blocksReadiness=false`；把 Charging overlap 降级为 N/A/excluded 或从 unresolved 删除即失败。
5. optimizer toughness 尚有 `machine-axis-enemy-settlement-client-order-open` 时，不得给 112001 toughness-cycle/fastest-kill 正式分数。
6. N/A 分支不得计为 runtime-ready 覆盖，也不得计为 unresolved；它们是有来源、场景或当前客户端机制边界确定不适用。
7. 本侧车通过不等于 roster 第 10 人、formal admission、optimization-ready 或 M12-C 解锁。
