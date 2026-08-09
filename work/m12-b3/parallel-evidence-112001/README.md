# M12-B3 / 112001 姬瑟贝露：assumption-v1 权威证据入口

本目录记录 112001 在 `m12c-zero-distance-passive-boss-v1` 下的来源、版本化无头假设、实现规格与反例。旧“必须等待 controlled client capture 才能实现”的冻结已被用户产品决策替代；当前功能闭合可以消费 `m12-112001-assumption-runtime-v1`，但这些选择不是客户端事实，`clientParityReady=false` 始终成立。

权威合同：

- identity：`m12-112001-assumption-runtime-v1`
- version：`1.0.0`
- hash algorithm：`sha256-canonical-json-v1`
- assumption hash：`3ae5e3bf22fabf052d07cb005f3575395c6abcb135942f5bf24dbdc8735e3e71`
- authority：`user-approved-headless-assumption`
- settlement dependency：`m12-enemy-settlement-runtime-v2@2e3095db4b8c9232`
- future evidence policy：未来客户端证据若不同，必须升版并作废、重算所有受影响的 profile/input/data/trace/build/acceptance binding/formal score。

配套材料：

- [SOURCE_LEDGER.md](SOURCE_LEDGER.md)：来源层级、四条原 open 的保留与产品假设裁决。
- [RESOURCE_CONSUMER_GRAPH.md](RESOURCE_CONSUMER_GRAPH.md)：动作、印记、consumer、watcher、wrapper、CD 与属性图。
- [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md)：已执行的分阶段 production/acceptance 合同。
- [ACCEPTANCE_COUNTEREXAMPLES.md](ACCEPTANCE_COUNTEREXAMPLES.md)：正式 v1、alternate 敏感性与 failure-to-pass。

## 当前裁决

| 主题 | 来源事实 | assumption-v1 可执行语义 |
| --- | --- | --- |
| 特殊重击入口 | A2/A3、星鸣、星鸣协战派生重击2；A4/A5、星决派生重击3 | 7 条 `EventBridge` 入口均保留右开输入窗；随后组合 charge-control 与 release-control |
| Charging 阈值 | 重击2 `[0,60)`/`[59,239)`；重击3 `[0,68)`/`[67,134/135)` | `greatest-start-frame`：`59F -> 11200141/sub1`，`67F -> sub3`；同 startFrame 语义冲突仍 fail closed |
| 星鸣印记 | 27F 首碰撞 landed 后 toOwn 雷印记 `250` | landed `+1`，miss/blocked/中断不加；右开生命周期 |
| 完全重击3 | 32/39/46F 三个独立 consumer | 每个只从首个满足的同一候选取 1 层，候选 `250 -> 450`；最多 3 层 |
| 星决 consumer | 191F 要求同候选 2 层 | `(1,1)` 不拼；`(2,2)` 选 250；`(0,2)` 选 450；消费后分支 damage，再发所选印记 overlimit |
| damage/toughness/break | 客户端同包顺序仍未证实 | 消费中央 v2：当前破韧包 HP 读 pre-break，随后 toughness/break，再提交 HP；后续 canonical packet 读 post-break |
| 128F watcher | landed 后挂 8s 一次性观察器，破韧后全队暴伤 `+10%/11s` | `hit-then-arm`；128F 自身 break 不触发，新观察器从后续独立 packet 起生效；右开、一次性 |
| 191F wrapper | toOwn `112001255`，属性 113 raw99、222 raw3000，12s | target consumer 先结算，wrapper 后应用；191F 自身不受益，196F 起可受益；右开 |
| 星鸣 CD | 四个指定首碰撞 toOwn `112001267`，槽3，`-3s` | 仅 landed 后应用：重击2 release sub0/sub1 与重击3 charge sub3/sub4 |
| `11200162` 实际链 | `112001133 -> 112001134` | 受控角色上场时暴击率 `+8%/8s`，refresh、右开 |
| `焰火` 文案 | NewTable 2193 / CHS 9418863283712 的确存在 | `current-client-orphan/stale-description`；N/A、`gameplayMechanic=false`、`runtimeGenerationMode=none`、`required=false`、`blocksReadiness=false` |
| 敌攻/受击派生 | 来源保留 | Boss 不攻击的冻结场景下结构化 scenario-out-of-scope N/A；不进入调度 |

## R4 节点级来源等值闭合

R2 已删除 owner recipe 的 `sourceClosureSupersedesResolvedRawCandidateGaps` 开关与 pipeline 的五维 blanket promotion，但它仍把“编译器没识别到该维输出”误当 structured N/A。R3 进一步把该次编译实际使用的 compact `nodeClassifications` 固化到启用 `selected-root-source-closure-v1` 的 owner control root；raw 图审计仍原样保留 `hp/toughness = 22 applied + 45 unresolved`、`actorSp/kiboSp = 14 applied + 8 verified-zero + 45 unresolved`，每个 candidate 再逐 node、逐 dimension 绑定 source status 与 closure disposition。

R3 仍留下一个来源伪造口：`runtime-applied` closure 只要写非空 source，且 candidate 中存在任意 conditional/semantic identity，就可能通过。R4 要求生成器为每个 runtime node 记录精确 `sourceClosureBindingIdentities`、`sourceClosureRelationIdentities` 与来源串；validator 从 profile 的 group/effect 合同重新筛选当前 control/subSkill/root/graph/node/source dimension，并与三者完全等值。任意非空 source、删一条真实来源、加无关来源、互换 authority 或嫁接同 owner 另一 graph 均 fail closed。

星决 graph 中 4 个 raw-unresolved/runtime-applied hp node 的实际绑定为：

| node | authority | 精确 binding |
| --- | --- | --- |
| `element:-2511185242952603503` / `112001265` | conditional | `gisele-ultimate-consumer-191f` 的 `baseTemplate` |
| `element:1403965050569036408` / `112001261` | conditional | 同 group 的 `enhancedTemplate` |
| `element:-5022202969777715803` / `296` | semantic | 同 path 的 `semantic-effect:11200113...-5022202969777715803...:191` |
| `element:2085743462064840077` / `498` | semantic | 同 path 的 `semantic-effect:11200113...2085743462064840077...:191` |

67 个 selected-root candidate 共引用 94 个 graph node，其中 50 个 node 的总分类仍是 `unresolved`；这 50 个不能被整体改名。它们只有在具体 `damage/toughness/sp` source dimension 是 `verified-zero`、有真实 runtime hit/semantic/conditional consumer、被明确冻结场景排除，或命中两个精确 branch-template root policy 时才逐维闭合。最终没有未闭合的 node dimension：

| coverage dimension | runtime-applied | verified-zero | structured N/A | unresolved | status |
| --- | ---: | ---: | ---: | ---: | --- |
| hpDamage | 17 | 30 | 20 | 0 | applied |
| toughnessDamage | 16 | 31 | 20 | 0 | applied |
| actorSp | 9 | 38 | 20 | 0 | applied |
| kiboSp | 9 | 38 | 20 | 0 | applied |
| buffsAndDebuffs | 28 | 0 | 4 | 0 | applied |

中央给出的精确 root `11200103|0|elements|1|-7394849788543465206` 仍如实记录 `unresolvedNodeCount=1`、无 hit/semantic/conditional；其节点 `112001008` 的 `damage/toughness/sp` source dimensions 均是独立 `verified-zero`，因此四维终态是 `verified-zero`，不是 N/A。`buffsAndDebuffs` 仍由 31 个 effect candidate（27 runtime-applied、4 structured N/A）加 1 个 passive candidate 构成。任何 graph node snapshot 缺失或漂移、closure disposition/source identity 缺失或不等值、泛化 N/A、跨 graph binding、candidate/aggregate 不守恒，或 applied coverage 仍有 unresolved，都会 fail closed。

假设 hash 也不再只校验格式：compiler 与 runtime validator 对同一唯一 canonical payload 重算 SHA-256；改 selected/alternate/sensitivity、删除或重排 assumption、改 version/authority/parity 等 canonical 字段，都会使旧 binding 失效。hit-gated effect 统一消费 scenario `defaultWillHit` 与 action override；watcher suppression 只可来自本次 generation 显式绑定且与 action resolution 的 package id/hash 一致的 mechanics package，不一致直接拒绝。

当前 owner acceptance 为 `248 total / 191 required passed / 57 source-backed N/A / 0 blocked`，`sourceGap=0`、`acceptanceGap=0`、`functionalFailure=0`，canonical replay 与 Workbench round-trip 均稳定。自动截图 SHA-256 为 `ca0e8df4693c141c586f178506d3e9c5cfb76004d73892779935f92faad059a7`；它仍不等于产品视觉签收。

四条原 open identity 没有删除、改名或降为 N/A；它们以 `resolved-by-product-assumption` 保留原 provenance 与 failure-to-pass。当前 functional blocker 为 0，产品视觉仍停在 `product-visual-manual-review-pending`，不得据此宣称客户端一致、optimization-ready 或 formal admission。
