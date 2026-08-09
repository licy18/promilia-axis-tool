# M12-B3 / 112001 姬瑟贝露：并行只读证据侧车

## 冻结坐标

- 基线：`140eefcd233cd9c1d136728f1c94b91aff632278`
- 工作树：`C:\Codex\AzPr Axis\.worktrees\promilia-m12-b3-112001-evidence`
- 分支：`research/m12-b3-112001-evidence`
- 产品场景：`m12c-zero-distance-passive-boss-v1`
- 场景约束：距离 0、投射物立即命中、Boss 静止且不攻击。
- 正式 roster 分母仍为 9；`Kibo DNA=[]`；`hero_rank` 仍是未实装死配置。

本目录只交付来源账本、资源/consumer 图、验收反例和后续实现规格。它没有修改 production runtime/compiler、112001 正式 recipe、`src/data/generated/**`、全局报告或正式资格状态，也不构成 formal admission、optimization-ready 或 M12-C 解锁声明。

## 交付物

- [SOURCE_LEDGER.md](SOURCE_LEDGER.md)：来源快照、证据等级、已闭合与仍开放的事实。
- [RESOURCE_CONSUMER_GRAPH.md](RESOURCE_CONSUMER_GRAPH.md)：主动派生窗口、重击释放、印记消费、CD 恢复、星决观察器和 `11200162` 孤立文案裁决。
- [ACCEPTANCE_COUNTEREXAMPLES.md](ACCEPTANCE_COUNTEREXAMPLES.md)：右开边界、未命中/中断、同帧、资源不足和 scenario-out-of-scope N/A 反例。
- [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md)：集成线可直接执行的分阶段 recipe/compiler/runtime/test 规格，以及必须等待客户端韧性证据的部分。

## 结论摘要

| 主题 | 证据结论 | 集成状态 |
| --- | --- | --- |
| 特殊重击 2 主动入口 | 普攻 A2/A3、星鸣技、星鸣协战后的重击输入可进入 `11200110/sub1` 或 `sub2`；请求核心入口均有 Unity `EventBridgeBehaviorData` 半开窗口 | 可进入 recipe/compiler 阶段 |
| 特殊重击 3 主动入口 | 普攻 A4/A5、星决技后的重击输入可进入 `11200110/sub3` 或 `sub4` | 可进入 recipe/compiler 阶段 |
| 蓄力释放 | 重击 2 的提前/完全释放分别进入 `11200141/sub0`、`sub1`；重击 3 分别进入 `sub2`、`sub3`。阈值处存在一帧重叠，且正式动作调度可精确落在 `59F/67F` | 主路径可建模；客户端 Charging evaluator 顺序闭合前，精确阈值保持 `112001-charge-threshold-overlap-order-open`、稳定 fail-closed |
| 星鸣印记 | 星鸣首次碰撞在 `27F` 落地时给自己 `+1` 雷印记 `250`，不是 action-start 事务 | 可实现 landed-hit 事务 |
| 重击 3 消耗 | 完全重击 3 在 `32F/39F/46F` 执行三个独立的一层 consumer，因而最多消耗 3 层；每次按 `250 -> 450` 优先选首个满足条件的候选 | 可实现资源选择和跨包顺序 |
| consumer 顺序 | TC 客户端 `Execute` 的顺序为 `CalculateConsumeCount -> DoConsume -> DoInject`；`DoInject` 先注入普通/强化伤害分支，再注入所选印记的超限包 | 可实现跨包顺序；单伤害包内部 HP/韧性顺序仍等待客户端证据 |
| 星决消费与效率 | 星决最终 consumer 要求同一种候选印记达到 2 层；普通/强化伤害的 `weakBreakDamageRate` 为 `16000/19000`，成功消费后再发所选印记超限包；同次落地另给 12 秒属性 wrapper | 资源分支可实现；wrapper 与当前命中包的同帧先后不得猜测 |
| 星决后破韧增益 | 首次命中落地时挂 8 秒、一次性破韧观察器；命中破韧后给全队暴伤 `+10%` 持续 11 秒 | 必须等待 optimizer toughness 的客户端结算事件合同后才可实现 |
| 重击减星鸣 CD | 重击 2/3 的指定首个碰撞落地才触发 `112001267`，目标槽位为 3，值为 `-3s`；重击 3 在进入释放分支前的 charge-control 首碰撞已经触发 | 可实现 landed-hit CD 恢复 |
| `11200162` 孤立文案 | NewTable row `2193` 与 CHS `9418863283712` 确实写有星鸣末击 1 层 `焰火`、15 秒；当前客户端 `11200162` 只连接 `112001133 -> 112001134` 上场暴击率 `+8%/8s`，星鸣 `62F` 末碰撞无 consumer，可达图也无唯一对应元素 | `current-client-orphan/stale-description`；结构化 N/A，`runtimeGenerationMode=none`、`required=false`、`blocksReadiness=false` |
| 敌攻派生动作 | 闪击/闪避、跃击/下落、极限反击、完美闪避/格挡/招架/反击及需要 Boss 攻击或受击事件的分支 | 结构化 `scenario-out-of-scope` N/A，永不进入本场景调度 |

## 最小集成原则

1. 每个时间窗统一使用 `[startFrame,endFrame)`；不能把右边界当作可输入帧。
2. action-start、hit-created、hit-landed、effect-applied 和 settlement-complete 必须是不同事件游标。
3. 同帧先后使用来源序列或客户端结算游标；时间相等本身不能裁决。
4. 当前 `verifiedCombatRuntime` 的 HP/韧性顺序只是 `m12-enemy-settlement-runtime-v1` 诊断实现，不得反向当作客户端证据。
5. open blocker 包括 Charging `59F/67F` evaluator 顺序，以及客户端 HP/韧性/break 和星决同包 wrapper/watcher 顺序；都必须保留稳定 fail-closed reason。
6. 孤立/过期描述只能保留为来源事实；不得生成 gameplay/runtime 合同、不得进入 required，也不得阻断 readiness。该 N/A 裁决不改变其他真实未闭合边界。
