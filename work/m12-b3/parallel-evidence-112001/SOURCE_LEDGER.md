# 112001 来源账本与 assumption-v1 裁决

## 1. 权威层级

本账本严格区分五类权威：

- `PUBLIC`：NewTable/本地化公开描述，只证明文案存在。
- `ASSET`：SkillControl 与 Battle Element 的控制帧、碰撞、元素图和 consumer。
- `CLIENT`：匹配客户端二进制中的 consumer 跨包顺序。
- `CENTRAL-RUNTIME`：中央已经版本化的通用无头合同。
- `PRODUCT-ASSUMPTION`：用户批准的无头产品选择；可供当前 production/acceptance 使用，但不是客户端事实。

所有帧窗、毫秒生命周期均为右开 `[start,end)`。当前合同固定为：

```text
contractIdentity = m12-112001-assumption-runtime-v1
assumptionVersion = 1.0.0
assumptionHashAlgorithm = sha256-canonical-json-v1
assumptionHash = 3ae5e3bf22fabf052d07cb005f3575395c6abcb135942f5bf24dbdc8735e3e71
policyAuthority = user-approved-headless-assumption
clientParityReady = false
settlementContract = m12-enemy-settlement-runtime-v2@2e3095db4b8c9232
```

未来客户端证据若不同，必须升版并作废、重算所有受影响的 profile、input、data、trace、build、acceptance binding 与 formal score；不能静默改写 v1。

## 2. 来源快照

| 等级 | 来源 | 使用内容 | 裁决 |
| --- | --- | --- | --- |
| PUBLIC | `src/data/generated/skills.json`、NewTable `skill.json` | 112001 的公开动作语义 | source-backed |
| PUBLIC | NewTable `skill_level.json` row `2193`、CHS `lang_skill_level.json` id `9418863283712` | `11200162` 文案写星鸣末击 1 层“焰火”、15 秒 | 原文保留；current-client orphan |
| PUBLIC | `112001.hero-module.local.json` | 技能槽、星携、passive 装配 | source-backed |
| ASSET | `skill_control_112001*.asset` | 7 条主动派生、Charging 窗、碰撞与 toOwn/toTarget 挂载 | source-backed |
| ASSET | `battle-element-assets.jsonl` | `250/450`、`112001255..272`、CD、watcher、wrapper、属性与时长 | source-backed |
| CLIENT | IL2CPP dump + `GameAssembly.dll` | `CalculateConsumeCount -> DoConsume -> DoInject`、普通/强化/overlimit 跨包顺序 | source-backed |
| CENTRAL-RUNTIME | `m12-enemy-settlement-runtime-v2` | 单包 HP/toughness/break 的无头结算次序 | product-approved headless dependency；非 client parity |
| PRODUCT-ASSUMPTION | 用户决策 M12-B3-112001-S1 | Charging、settlement、128F watcher、191F wrapper 四项选择 | `resolved-by-product-assumption` |

### 2.1 客户端二进制绑定

- 文件：`C:\AP\AzurPromilia_TC\AzurPromilia_game\GameAssembly.dll`
- SHA-256：`c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`
- `ConsumePackElement.Execute`：
  - `CalculateConsumeCount` RVA `0x1387013`
  - `DoConsume` RVA `0x13870E4`
  - `DoInject` RVA `0x13870EE`
  - `[0x138700E,0x13870F3)` SHA-256 `27968b87631758ee7ba46601855eb9efb5b78a533bd3579a54cd9ce42b595769`
- `DoInject`：
  - list 1：`0x1386A16..0x1386A59`
  - list 2：`0x1386A76..0x1386AB5`
  - selected-mark overlimit：`0x1386AD2..0x1386B52`
  - `[0x1386A05,0x1386B57)` SHA-256 `bff4e6eda0b6f47e8647a4a35df849d37c3a165e0b57edc39276ecda1eac765d`
  - `[0x1386AD2,0x1386B65)` SHA-256 `ae7cd17a10c4b798c6eb4712b5d39a28dff9d440c111038e006b78ecc1aca291`

二进制闭合的是跨包 consumer 顺序。没有候选时不消费、不发 selected-mark overlimit，但仍执行 list 1 普通 damage；成功时执行 list 2，再注入所选印记 overlimit。单包 HP/toughness/break 由中央 v2 的产品无头合同闭合，不宣称来自上述二进制范围。

## 3. 来源机制事实

| 机制 | 事实 |
| --- | --- |
| 主动派生 | A2/A3、星鸣、星鸣协战可派生特殊重击2；A4/A5、星决可派生特殊重击3，共 7 条无需敌攻的入口 |
| Charging | 重击2 early `[0,60)`、full `[59,239)`；重击3 early `[0,68)`、full `[67,134/135)` |
| 星鸣印记 | 27F 首碰撞 path `5182973323990506066` landed 后向队伍 tuning 容器加雷印记 `250 +1` |
| 重击3消费 | 完全重击3 在 32F、39F、46F 各有一个独立 consumer；每个最多消费一层 |
| 星决消费 | 191F consumer 要求同一候选达到 2 层；`250 -> 450` 优先，不能把 `(1,1)` 拼成 2 |
| consumer 顺序 | `CalculateConsumeCount -> DoConsume -> DoInject`；无候选走 list1，成功走 list2，随后 selected-mark overlimit |
| CD 被动 | `112001267`、槽3、`-3s`；仅四个指定碰撞 landed 后执行 |
| watcher | 128F landed 挂 `112001271` 8 秒一次性观察器；break 后 `112001272` 全队属性8 raw1000，11秒 |
| wrapper | 191F landed 后挂 `112001255`，子元素属性113 raw99、属性222 raw3000，12秒 |
| 实际 `11200162` | `112001133 -> 112001134`，受控角色上场暴击率 `+8%/8s` |

印记消费的固定反例：

```text
重击3每个 consumer：只从当前首个满足候选取 1 层；每次重读容器
星决：(1,1) -> normal；(2,2) -> 250；(0,2) -> 450
无候选：normal list1 仍结算；不得解释成整个 consumer 无输出
```

## 4. 四条原 open 的保留与产品裁决

原 identity、provenance 与 failure-to-pass 均保留；状态从 fail-closed open 转成 `resolved-by-product-assumption`，不是删除、N/A 或客户端已证实。

| 原 open identity | v1 选择 | alternate 与敏感性 |
| --- | --- | --- |
| `112001-charge-threshold-overlap-order-open` | 多个右开窗同时命中时取 `startFrame` 最大；等 startFrame 仅对语义等价候选按稳定 source identity 排序，语义冲突仍 fail closed | old-tier 优先会使 `59F` 从 sub1 变 sub0、`67F` 从 sub3 变 sub2，并改变后续 packet/trace |
| `112001-damage-toughness-client-order-open` | 消费中央 v2：HP 输出先读 pre-break，后结算 toughness/break，再提交本包 HP；后续 canonical packet 读 post-break | break-before-current-HP 会改变破韧包自身输出 |
| `112001-ultimate-watcher-same-packet-order-open` | `hit-then-arm`；128F 本包先结算，landed 后才 arm，不追溯触发 | arm-before-hit 会让 128F 自身 break 触发 buff |
| `112001-ultimate-wrapper-same-packet-order-open` | 191F target consumer/branch/overlimit 先结算，随后 post-hit wrapper；本包不受益 | wrapper-before-current-packet 会改变 191F damage/weakBreak；v1 从后续独立 packet（含196F）生效 |

原 failure-to-pass 继续有效：没有显式产品合同，59F/67F 重叠、单包结算游标、128F arm 游标和 191F wrapper 游标都必须 fail closed。v1 的价值是把选择、alternate 和受影响哈希显式绑定，而不是伪造客户端结论。

### 4.1 canonical hash 与旧 binding 作废记录

canonical payload 唯一包含 schema/owner/contract/authority/parity/version/hash-algorithm、完整 settlement dependency、保持数组顺序的四条 assumptions、future evidence policy 与合同 source identity。compiler 生成 hash，runtime validator 用同一实现重算；不得信任 recipe 或 package 内自报的 64 位字符串。

R2 将 hash 从旧实现的 `3c4a1fb62d48c80e5dca5a55cc01fde37ff2437bba1d8c0ec45a272afe010743` 更新为当前 `3ae5e3bf22fabf052d07cb005f3575395c6abcb135942f5bf24dbdc8735e3e71`。在 acceptance recipe 仍保留 5 个旧 hash probe 时，owner 重放得到 `105 blocked / sourceGap 105 / acceptanceGap 105 / functionalFailure 105`；仅在 5 个 probe 合法重绑新 hash 后恢复 `191/191 required pass`。这是“语义或 canonical 合同变化必须使旧 acceptance binding 失效”的实际 failure-to-pass，不是机制回归。

## 5. 逐 candidate coverage 来源裁决

raw 图分类继续作为 provenance 保留，不能直接被 recipe 开关提升：

| raw dimension | applied | verified-zero | unresolved |
| --- | ---: | ---: | ---: |
| hp | 22 | 0 | 45 |
| toughness | 22 | 0 | 45 |
| actorSp | 14 | 8 | 45 |
| kiboSp | 14 | 8 | 45 |

`selected-root-source-closure-v1` 对 67 个 settlement candidate 分别读取 selected graph、该次编译实际发布的 compact node snapshot、hit、semantic effect、conditional consumer 与 scenario-out-of-scope record。R2 的失败点是把“没有识别到 output”加 graph/scenario identity 当作 N/A；R3 明确规定 scenario identity 与 absence of recognized output 均不是来源证明。

每个 node 的 `damage/toughness/sp` source dimension 必须保留原 `applied/verified-zero/unresolved`，并为四个产品维分别给出 `sourceClosureDisposition` 与 `sourceClosureSourceIdentity`。只有以下来源可以闭合：

- source node dimension 自身为 `verified-zero`；
- 真实 hit、semantic runtime 或 conditional consumer；
- 精确 scenario-out-of-scope record 排除该 control；
- 精确 graph + node + dimension 的 branch-template policy。

R4 对其中 `runtime-applied` 增加独立可重算的等值合同：

- conditional authority 必须同时匹配 group 的 `controlSkillId/subSkillIndex/judgmentElementId` 与当前 graph 的 control/subSkill/root，并由 `baseTemplate` 或 `enhancedTemplate` 的 `pathId + elementConfigId` 精确命中当前 node；
- semantic authority 必须匹配当前 graph identity、control/subSkill、node path/element、具体 source dimension=`applied` 与 effect classification=`applied`；
- closure 的 binding identities、node relation identities 和 source identity 必须与上述筛选结果完全相等，不得仅检查非空，也不得混入 candidate/scenario/无关 graph 来源。

当前 4 个 raw-unresolved/runtime-applied node dimension 均属于星决 hp：`112001265/-251118...` 与 `112001261/140396...` 分别绑定 `gisele-ultimate-consumer-191f` 的 base/enhanced template；`296/-502220...` 与 `498/208574...` 分别绑定各自同 path semantic effect。前两条来源串来自 conditional group 的 judgment/base/enhanced 资产链，后两条来自 191F behavior、`elements[7]` root 与对应 Battle Element path；不存在 graph 级 blanket runtime。

重击3/星决 raw semantic subtree 继续由三个已有 policy identity 负责：

- `gisele-ultimate-consumer-raw-subtree-source-closure`
- `gisele-heavy3-consumer-32f-raw-subtree-source-closure`
- `gisele-heavy3-consumer-39f-46f-raw-subtree-source-closure`

星决直接列出的两个 branch-template root 没有独立行为 trigger，只能由以下节点级 policy 裁决 N/A：

- `gisele-ultimate-base-branch-template-root-no-independent-settlement`
- `gisele-ultimate-enhanced-branch-template-root-no-independent-settlement`

67 个 candidate 共引用 94 个 node；50 个 node 的总分类仍为 unresolved，但所有具体维均由上述来源闭合，未闭合 node dimension 为 0。中央精确反例 `11200103|0|elements|1|-7394849788543465206` / root `112001008` 保持 `0 applied / 0 verified-zero / 1 unresolved` 的 raw node 计数；其 node source 的 `damage/toughness/sp` 均明确为 `verified-zero`，所以四个 coverage 维是 zero，而不是 N/A。

最终账本为：

| dimension | total | runtime-applied | verified-zero | structured N/A | unresolved |
| --- | ---: | ---: | ---: | ---: | ---: |
| hpDamage | 67 | 17 | 30 | 20 | 0 |
| toughnessDamage | 67 | 16 | 31 | 20 | 0 |
| actorSp | 67 | 9 | 38 | 20 | 0 |
| kiboSp | 67 | 9 | 38 | 20 | 0 |
| buffsAndDebuffs | 32 | 28 | 0 | 4 | 0 |

不存在 owner coverage blanket promotion。validator 不只复核聚合数：它还逐一对拍 root `nodeIdentities`、compact node snapshot、raw classification counts、candidate node core/source dimensions、disposition、policy 与 source identity，并从 profile 原始 group/effect 合同独立重算 runtime binding。删除 disposition、伪造非空 source、删/增 source、替换 authority、跨 graph 嫁接、伪造“无输出”泛化 N/A、把计数改到自洽但保留未闭合 node，或让 applied dimension 含 unresolved，均必须失败。

## 6. `11200162` 孤立文案的结构化 N/A

原文来源必须保留，但当前可执行客户端边界为：

- `skill_control_11200162` 只引用 path `-1181925444607214156`、`1138707259999444314`。
- 两者解析为 `112001133 -> 112001134` 上场暴击率链。
- 星鸣 62F collision 无对应 toOwn/toTarget consumer。
- 112001 可达 Battle Element 图无唯一“焰火”元素。
- `101003/480xxx` 同名元素属于他角，只用于防止跨角色误借。

权威记录：

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
  "blocksReadiness": false
}
```

不得恢复末击 landed/miss/中断的“焰火”正向合同，不得把该记录混入四条 assumption，也不得以它阻断 readiness。

## 7. 冻结场景与 N/A

`m12c-zero-distance-passive-boss-v1` 固定距离 0、默认不移动、投射物立即命中、Boss 静止不攻击、生成物不自动拾取。以下来源保留但结构化 `scenario-out-of-scope`：

- `11200115` 闪避/专用闪击：`requires-evade-context`
- `11200111` 跃击/下落：`requires-aerial-or-fall-context`
- `11200125` 极限反击及其普攻/重击派生：`requires-enemy-attack-derived-counter-window`
- `11200127` 完美闪避/格挡/招架反击及重击派生：`requires-enemy-attack-and-perfect-defense-event`
- 所有受击、格挡、反击 listener：对应 Boss attack/hit/success event 不存在

N/A 必须 `schedulable=false`、`optimizationEligible=false`，但不能删除 source identity。星鸣协战 `11200121` 是主动入口，不属于敌攻 N/A。

## 8. 产品边界

- 四项 assumption 已能被 headless production/acceptance 消费，functional blocker 为 0。
- owner acceptance 为 `248 total / 191 required pass / 57 source-backed N/A / 0 blocked`；`sourceGap=0`、`acceptanceGap=0`。
- `clientParityReady=false`，真实 capture 未被声称。
- `Kibo DNA=[]`；`hero_rank` 不进入输入。
- 产品视觉保持 `product-visual-manual-review-pending`。
- 不宣称 optimization-ready、formal admission 或 M12-C 解锁。
