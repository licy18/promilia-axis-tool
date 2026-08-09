# 112001 assumption-v1 验收反例与 failure-to-pass

## 1. 通用判定

所有测试区分：

```text
action-start
input-window-open / input-window-close
hit-created
hit-landed | hit-missed | hit-cancelled
consume-judged / mark-consumed
damage-settled / toughness-settled / break-triggered
effect-applied / watcher-armed / watcher-consumed
interrupt-applied
```

所有时间窗为 `[start,end)`；同帧必须比较 canonical `sourceSequencePath/eventIdentity`。只比较绝对帧或毫秒时间不合格。

## 2. 派生入口与 Charging

### AX112001-WIN-001：右开入口

| 来源 | 接受 | 拒绝 |
| --- | --- | --- |
| A2 `[55,320)` | 55、319 | 54、320 |
| A3 `[63,243)` | 63、242 | 62、243 |
| A4 `[36,266)` | 36、265 | 35、266 |
| A5 `[59,179)` | 59、178 | 58、179 |
| 星鸣 `[67,298)` | 67、297 | 66、298 |
| 星决 `[216,461)` | 216、460 | 215、461 |
| 星鸣协战 `[112,377)` | 112、376 | 111、377 |

用 action 总时长、闭区间或 duration 当绝对结束帧均失败。

### AX112001-WIN-002：默认重击不能冒充特殊重击

没有合法 predecessor/contextAction 时，默认 charged mapping 不得得到 `11200110/sub1..4` 的来源效果、CD 或 consumer。

### AX112001-WIN-003：主动入口不得依赖敌攻

Boss 不攻击时，A2/A3/A4/A5、星鸣、星决、星鸣协战仍可派生重击。把它们与 `11200125/27` 一起标成反击限定应失败。

### AX112001-CHARGE-001：v1 阈值

```text
heavy2: 58F -> sub0, 59F -> sub1, 60F -> sub1
heavy3: 66F -> sub2, 67F -> sub3, 68F -> sub3
```

59F/67F trace 必须带：

```text
appliedAssumptionIdentity = 112001-charge-threshold-overlap-order-open
assumptionVersion = 1.0.0
assumptionHashAlgorithm = sha256-canonical-json-v1
assumptionHash = 3ae5e3bf...5e3e71
precedence = greatest-start-frame
```

按 JSON 数组偶然顺序、最长窗口或角色特判选档失败。

### AX112001-CHARGE-002：同 startFrame 冲突仍 fail closed

构造两个相同 startFrame、不同 execution control/sub 或 semantic identity 的候选；预期 `charging-release-same-threshold-semantic-conflict`。stable source identity 只能打破“语义等价”平局。

### AX112001-CHARGE-SENS-001：alternate 必须有差异

old-tier precedence 必须展示 `59F -> sub0`、`67F -> sub2`。若 v1 与 alternate 的选择/trace hash 无差异，除非提供逐项“无差异”证明，否则敏感性失败。

## 3. landed 印记与 CD

### AX112001-MARK-001：action-start 不给雷印记

星鸣在 27F 前中断：`250` 不变。

### AX112001-MARK-002：首碰撞 miss 不补发

27F miss、33F landed：`250` 不变。任意后续 hit 补发 `+1` 失败。

### AX112001-MARK-003：landed 后中断不回滚

27F landed 后中断：`250 +1` 保留。

### AX112001-CD-001：重击2 miss

`11200141/sub0@26F` 或 `sub1@21F` miss：星鸣 CD 不变。按 action/release start 直接减 3 秒失败。

### AX112001-CD-002：重击3在 charge 17F恢复

- `11200110/sub3/sub4@17F` landed 后在 release 前中断：CD 已 `-3s`。
- 17F miss、release landed：不得补发。
- release-control 再次发放：重复事务失败。

### AX112001-CD-003：同帧 landed/interrupt 游标

`landed cursor < interrupt cursor` 时提交并保留；反向时 hit cancelled、无恢复。两条 replay 仅凭同帧得到同结果失败。

## 4. 重击3 consumer

### AX112001-CA3-001：不得预扣

初始雷3：31F 仍3；32F 后2；39F 后1；46F 后0。action-start 或 32F 一次扣3失败。

### AX112001-CA3-002：每次重读候选

初始 `(雷1,暗2)`：32F选雷，39F选暗，46F选暗。复用 action-start 快照失败。

### AX112001-CA3-003：不跨元素拼层

每个 one-layer consumer 只从一个候选取一层。初始 `(雷0,暗2)`：前两次选暗、第三次 normal；不得在单 consumer 同时扣两种印记。

### AX112001-CA3-004：无候选仍有 list1

初始 `(0,0)`：三次均不消费、不发299/499，但分别结算 base damage。把 `no-consume-and-no-inject` 扩大成“无伤害”失败。

### AX112001-CA3-005：分支与 weakBreak 跟本次 judgment

| consumer | base | enhanced |
| --- | --- | --- |
| 32F | `112001264`, weakBreak22000 | `112001259`, 25000 |
| 39/46F | `112001196`, 22000 | `112001270`, 25000 |

用 action 全局布尔值让三包一起强化失败。

### AX112001-CA3-006：跨包顺序

成功雷：`consume(250) < branch damage < overlimit(299)`；成功暗同理 450/499。中断只截断尚未发生的后续 consumer，不回滚已提交事务。

## 5. 星决消费与 settlement

### AX112001-ULT-001：两层同候选

| 初始 `(雷,暗)` | v1结果 |
| --- | --- |
| `(2,0)` | 雷2、enhanced、299 |
| `(1,1)` | normal；不得拼层 |
| `(2,2)` | 优先雷2、enhanced、299 |
| `(0,2)` | 暗2、enhanced、499 |

### AX112001-ULT-002：191F前中断

128F landed、191F 前中断：观察器可保留，但印记不消费，wrapper 不应用。

### AX112001-SETTLE-001：破韧包自身 pre-break

构造 packet P 使 toughness 从正数降至0：

```text
P HP multiplier reads pre-break
P settles toughness/break
P commits HP
later canonical packet Q reads post-break
```

P 自身吃 break multiplier 失败；Q 仍读 pre-break 也失败。

### AX112001-SETTLE-002：同帧 packet 顺序绑定

同帧 P/Q 必须按 canonical sourceSequencePath/eventIdentity。交换路径要么改变 input/data/trace/build hash，要么因不稳定 identity 被拒绝；静默保留旧 hash 失败。

### AX112001-SETTLE-SENS-001：alternate

`break-before-current-packet-hp-output` 应改变触发包 HP 输出。若没有差异，必须给出由数值为零或 multiplier=1 导致的可审计“无差异”证明。

## 6. 128F watcher

### AX112001-WATCH-001：本包不追溯

128F packet 自身造成 break：本包先结算，此时 watcher 尚未 arm；预期无 `112001272`。128F landed 后才出现 `WATCHER_ARMED`。

### AX112001-WATCH-002：后续包触发一次

128F landed 后的独立 packet 在 8 秒内造成 break：触发一次，全队 actor 应用 attribute8 raw1000/11000ms。窗口内第二次 break 不重复。

### AX112001-WATCH-003：miss、中断与右边界

- 128F miss：不 arm。
- 128F landed 后、191F 前中断：arm 不回滚。
- `arm+7999ms` break：可触发。
- `arm+8000ms` break：不触发。
- buff `break+10999ms` 有效，`break+11000ms` 失效。

### AX112001-WATCH-SENS-001：alternate

arm-before-hit 会让 128F 自身 break 触发；v1 不触发。二者结果必须可查询并绑定同一 assumption identity 的不同语义。

## 7. 191F wrapper

### AX112001-WRAP-001：当前包不受益

191F target consumer/branch/overlimit 先结算；同碰撞 landed 后才应用 wrapper。191F 的 damage/weakBreak 查询不得包含 `112001255`。

### AX112001-WRAP-002：196F及以后受益

196F 独立 packet 位于 wrapper `[apply,apply+12000ms)` 时应读取 attribute113 raw99、attribute222 raw3000。

### AX112001-WRAP-003：miss和右边界

191F miss 不应用。恰好 `apply+12000ms` 的 packet 不受益。

### AX112001-WRAP-SENS-001：alternate

wrapper-before-current-packet 会改变 191F 输出；正式 v1 不得悄悄采用该结果。

## 8. assumption 合同防伪

以下任一情况必须失败：

1. 删除 `m12-112001-assumption-runtime-v1`。
2. 删除或改名四条原 open identity。
3. 把任一原 open 改成 N/A、source closed 或 client-proven。
4. 改 `assumptionVersion`/selected semantics 后 hash 不变。
5. `clientParityReady=true`。
6. fixture/trace/build/acceptance 未携带相同 assumption version/hash。
7. 改 sourceSequencePath 后旧 acceptance binding 仍有效。

正确行为是升版、生成新 hash、使旧 binding 失效，并重算受影响的 profile/input/data/trace/build/formal score。

### AX112001-HASH-001：semantic tamper 必须重算

对合法合同依次执行下列任一变更并保留旧 hash，validator 都必须报告 `headless-assumption-contract-invalid`：

- 改任一 `selectedSemantics` 或 ordering policy；
- 删除 assumption；
- 交换 assumptions 数组顺序；
- 改 alternate/sensitivity/preserved failure-to-pass；
- 改 version/authority/parity/settlement dependency/future evidence policy。

把旧任意 64 位字符串（包括 `'a'.repeat(64)`）填入合同不得通过。合法重算 hash 后，若 charging/watcher/acceptance 仍复用旧 binding，也必须失败；全部合法重绑后才通过。

### AX112001-HASH-002：旧 acceptance binding 实际失效

R2 canonical hash 更新后，保留 5 个 `3c4a1fb...010743` probe 的单角色重放实测为：

```text
required=191
passed=86
blocked=105
sourceGap=105
acceptanceGap=105
functionalFailure=105
```

改为 `3ae5e3bf...5e3e71` 后恢复 191/191；若旧 binding 仍通过，此反例失败。

### AX112001-COVERAGE-001：禁止 recipe 开关式伪覆盖

raw provenance 必须继续可见：

```text
hp/toughness = 22 applied + 45 unresolved
actorSp/kiboSp = 14 applied + 8 verified-zero + 45 unresolved
```

删除 candidate records 后必须暴露 gap。逐 node/逐维闭合后的 67 个 settlement candidate 才允许得到 `hp 17/30/20/0`、`toughness 16/31/20/0`、`actorSp 9/38/20/0`、`kiboSp 9/38/20/0`；31 effect + 1 passive 得到 buffs `28/0/4/0`。伪造 owner switch、删 candidate、N/A 缺逐 node 权威、或 applied coverage 带 unresolved 均失败。

### AX112001-COVERAGE-002：中央精确 root 不得 absence-as-N/A

固定 fixture：

```text
candidateIdentity=settlement-coverage:actor|112001|11200101|0|11200103|normal-attack:11200103|0|elements|1|-7394849788543465206
graphIdentity=11200103|0|elements|1|-7394849788543465206
nodeCatalogIdentity=11200103|element:-7394849788543465206
rootElementId=112001008
source=skill_control_11200103...#skillResourceMaps[0].elements[1]
raw applied/zero/unresolved=0/0/1
hit/semantic/conditional=[]
```

raw node 总分类必须继续是 unresolved；但该 node source 对 `damage/toughness/sp` 都明确给出 `verified-zero`，所以 hp/toughness/actorSp/kiboSp 四维终态均为 zero。若写成 `reachable-graph-has-no-output-for-coverage-dimension` N/A，即复现 R2 假阳性并失败。

### AX112001-COVERAGE-003：删除节点 disposition

删除上述 node 任一维的 `sourceClosureDisposition` 或 `sourceClosureSourceIdentity`，即使 candidate status 与所有聚合计数不变，也必须得到 `settlement-coverage-node-source-closure-invalid`。

### AX112001-COVERAGE-004：计数自洽的泛化 N/A 仍失败

把上述 hp candidate、action summary 与 coverage summary 同时从 zero 改成 N/A，使数量完全自洽；再伪造 `fixture:blanket-na` policy 或只附 scenario identity。validator 仍必须报 `settlement-coverage-node-source-closure-invalid` 与 `settlement-coverage-not-applicable-authority-invalid`，且不能仅靠 aggregate mismatch 才失败。

### AX112001-COVERAGE-005：精确 branch policy 不可删除

星决 `elements[8]=112001265` 与 `elements[9]=112001261` 是 conditional consumer 的 base/enhanced branch template，没有独立 behavior trigger。删除以下任一精确 graph/node/dimension policy 后，对应 node 必须重新 unresolved：

- `gisele-ultimate-base-branch-template-root-no-independent-settlement`
- `gisele-ultimate-enhanced-branch-template-root-no-independent-settlement`

不得用一个 owner-wide 或“没找到 output”policy 代替。

### AX112001-COVERAGE-006：runtime source 必须逐节点等值

中央精确 forged fixture：

```text
candidate=settlement-coverage:actor|112001|11200113|0|11200113|ultimate:11200113|0|elements|7|-7212963066810547935
graph=11200113|0|elements|7|-7212963066810547935
node=11200113|element:-2511185242952603503
dimension=hp
authority=source-driven-conditional-damage-contract
tamper sourceClosureSourceIdentity=fixture:forged-nonempty-source
expected=settlement-coverage-node-source-closure-invalid
```

合法的 4 个 raw-unresolved/runtime-applied hp node 必须逐一为：

| node | binding relation |
| --- | --- |
| `-2511185242952603503 / 112001265` | `gisele-ultimate-consumer-191f -> baseTemplate` |
| `1403965050569036408 / 112001261` | `gisele-ultimate-consumer-191f -> enhancedTemplate` |
| `-5022202969777715803 / 296` | exact same-path semantic effect，`damage=applied` |
| `2085743462064840077 / 498` | exact same-path semantic effect，`damage=applied` |

以下变体分别都必须 fail closed：

- 把来源改成任意非空字符串；
- 从合法来源串删除一个真实 source；
- 加入 `fixture:unrelated-source`；
- 把 conditional authority 改为 semantic；
- 把 `gisele-heavy3-consumer-32f` 或另一 graph 的 semantic effect identity/source 嫁接到该 candidate/closure。

validator 必须从 profile 的 conditional group / semantic effect 原始记录重算 exact graph、control、subSkill、root/judgment、node path/element、source dimension、binding identity、relation identity 与 source identity；仅检查 candidate 数组非空或 closure source 非空即复现 R3 假阳性。

### AX112001-HITGATE-001：scenario 默认与 override 一致

对同一 conditional hit 与 landed-action-hit effect：

- `defaultWillHit=false` 且无 override：damage 不 landed，effect/watcher/wrapper 也不应用；
- 默认 miss + 显式 hit：damage 与 effect 同时 landed/applied；
- 默认 hit + 显式 miss：damage 与 effect 同时抑制。

conditional 分支硬编码 true，或 landed 分支只因 resolution 中“存在 hit”就应用，均失败。

### AX112001-WATCH-PACKAGE-001：suppression package authority

构造 package A 只 suppress watcher A、package B 只 suppress watcher B：各自 generation 必须只消费自己的集合。把 package A 的 action resolution 与 package B 的 effect generation 混用时，必须抛出 `verified-battle-effect-generation-mechanics-package-binding-mismatch`；读取进程全局 package 作为旁路失败。

## 9. “焰火” orphan failure-to-pass

### AX112001-ORPHAN-001：原始描述必须保留

NewTable row2193、skillId11200162、CHS id9418863283712、1层/15秒原文均可追溯；来源存在不等于 gameplay mechanism。

### AX112001-ORPHAN-002：当前客户端边界

`skill_control_11200162` 两 path 必须解析为 `112001133 -> 112001134` 暴击率 +8%/8s；星鸣62F无对应 consumer。

### AX112001-ORPHAN-003：禁止正向 runtime

无论62F landed/miss/中断/同帧，均不得创建“焰火” stack、duration、effect 或 cursor。借用 `101003/480xxx` 失败。

### AX112001-ORPHAN-004：结构化 N/A

必须同时满足：

```text
classification=current-client-orphan
descriptionStatus=stale-description
applicability=not-applicable
gameplayMechanic=false
runtimeGenerationMode=none
required=false
blocksReadiness=false
```

### ORPHAN 历史 failure fixture

accepted evidence `e13a87bad900c03164b2beb9d5db12e76cba986c` 的以下旧形状必须失败：

```text
112001-firework-consumer-source-open
unresolved-source-only
等待补 consumer / 阶段 E 实现焰火
末击 landed/miss/interruption 正向生命周期
optimization readiness 依赖该文案
```

失败码归一为 `stale-description-promoted-to-mechanic`、`orphan-description-counted-as-required` 或 `nonexistent-mechanic-runtime-positive-contract`。

## 10. scenario-out-of-scope N/A

以下记录保留来源，但必须 `schedulable=false`、`optimizationEligible=false`：

| identity | control/分支 | reason |
| --- | --- | --- |
| `112001-scenario-na-evade-attack` | `11200115` | `requires-evade-context` |
| `112001-scenario-na-plunge` | `11200111` | `requires-aerial-or-fall-context` |
| `112001-scenario-na-limit-counter` | `11200125` | `requires-enemy-attack-derived-counter-window` |
| `112001-scenario-na-perfect-parry` | `11200127` | `requires-enemy-attack-and-perfect-defense-event` |
| receive-hit/block/counter listeners | 来源对应分支 | requires Boss attack/hit/success event |

N/A 不得出现在 golden action sequence，不改变 damage/resource/CD/buff，也不增加 blocking gap。星鸣协战/星携主动链不得整体误列 N/A。

## 11. acceptance 最终断言

```text
all required rows = passed
all other rows = source-backed not-applicable
requirementCount = 248
required/passed/notApplicable = 191/191/57
sourceGapCount = 0
acceptanceGapCount = 0
blockedCount = 0
functionalFailureCount = 0
two canonical replays = identical hashes
Workbench import/export replay = identical hashes
automated screenshot file/hash = verified
productVisualAcceptance = pending
optimizationReady = false
clientParityReady = false
```

自动 Workbench 截图只证明 fixture 可导入、可展示和 round-trip；不得自签产品视觉、optimization-ready、formal admission 或 M12-C。
