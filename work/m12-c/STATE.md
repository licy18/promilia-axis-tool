# M12-C 末音配队、装配与动作轴优化计划

状态：`M12-C0` 至 `M12-C3`、中央串行集成和全量 release 门禁已完成；正式搜索仍未启动。

已验证实现基线：`master@777af8f790986efab42de398fd2ef394610a9a77`。本文件的状态提交不改变实现语义。

本文件是 M12-C 的实施合同。`DEVELOPMENT_PLAN.md` 保留阶段摘要，实际实现、测试和产品复验均以本文件为准。实现与优化资格全绿不等于客户端一致性或产品视觉自动签收；未满足对应产品边界前，不得把 M12-C 搜索结果声明为已获产品验收。

## 0. 2026-08-11 中央集成快照

- `M12-C1/C2` 已接入生产路径：28 个队伍对象、35 个来源配置、STARBORN 单一优化对象/双互斥别名、lazy build generator、固定培养/装配资格投影、`buildHash`、headless service 和 CLI 均已实现并通过回归。
- `M12-C3` 已实现 objective-scoped initial-state preset、canonical hash 和 formal authority 校验；循环轴与击杀轴白名单均 fail closed。
- STARBORN 最终合同为：星决技对 action-start 已存在的每一种印记分别 `+1`，星携同样 `+1`，逐种 cap 5；无印记不创建，`199001/199002` 不双计。`+2` 仅保留为必须失败的负向测试。
- M12-B3 optimization qualification 为 263/263：角色 9/9、奇波 43/43、灵子 62/62、装备 137/137、套装 12/12；`blockingUniqueGapCount=0`，`m12cLocked=false`。E22 binding matrix 为 22/22。
- 当前权威 hash：verified mechanics package `fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58`；roster `6e4843984a9f435d`；manifests `d08e4a0bc73b464f`；ledger `7b7cb20e220da974`；qualification binding matrix `bd4084ac0882820f`；qualification catalog `b26dede46b58f714`；E22 report `88b98cf6195e27c4`。
- 全量门禁：`test:full` 228/228 files、1877/1877 tests；确定性聚焦集 16 files、166/166 tests；Workbench production preview 64/64；最终 `test:trial-release` exit 0。production build、Workbench data、action status、applied-source、Kibo headless、production imports、bundle、binding matrix 和确定性审计均通过。
- `clientParityReady=false` 仍由已验证 mechanics/profile evidence 明确保留；它与 optimization qualification 全绿是两条独立状态，禁止混同。
- 本轮没有自动签署任何产品视觉记录。既有角色级 accepted 记录保持原样；STARBORN optimization-object 仍为 `productVisualAcceptance=pending`、`formalAdmission=false`、`optimizationReady=false`。
- 正式 M12-C 搜索、三个 objective 的 Top-N 和产品结论均尚未运行/生成；下一实施阶段仍是 `M12-C4`，不得把上述门禁通过数冒充搜索结果。

## 1. 目标与结果身份

M12-C 在同一无头核心中联合优化队伍、装配、初始前台和动作轴，但必须把身份分层：

1. `teamIdentity`：三个优化对象及 STARBORN 的单一来源别名选择。
2. `buildHash`：队伍、别名、每个角色的奇波/灵子/五件装备、固定培养 profile、合法实例档、派生套装效果及全部资格/来源/binding hash。
3. `axisHash`：`buildHash`、初始前台、初始状态 preset、动作序列、连段/切人/奇波/合击状态和敌人场景。
4. `resultKey`：`axisHash`、`objectiveId`、敌人 profile/hash、暴击策略、时域或循环证明策略及运行时合同 hash。

初始前台不是队伍变体，也不进入 `buildHash`。优化器在内层动作轴搜索中尝试合法的初始前台；不同初始前台属于不同 `axisHash`。正式输入必须显式声明初始受控角色，禁止回退为队伍数组第一个角色，也不得在 0F 免费触发入场或离场星携效果。

## 2. 配队范围与合法性

- 每队恰好三个优化对象，必须包含 `109001 末音`。
- 另外两人从 `101010`、`102001`、`103002`、`107001`、`107002`、`108003`、`112001`、`STARBORN` 中选择，角色对象不得重复。
- `108001`、`111001` 不进入本阶段正式 roster。
- 队伍顺序 canonical 化；UI 槽位排列不形成新队伍。
- `STARBORN` 是一个优化对象。每条队伍/轴必须显式且只能选择一个来源别名 `199001` 或 `199002`，两个别名不得同时存在、共享资源或重复计数。
- 对象队伍共有 `C(8,2)=28` 种：不含 STARBORN 的 21 种，加含 STARBORN 的 7 种。计入 STARBORN 两个互斥别名后，共 35 个来源配置；它们仍只对应 28 个队伍对象身份。

## 3. 固定培养与装配搜索

培养条件是场景常量，不是搜索维度：

- 角色：80 级；星赐第 7 层，应用第 1..6 层已取得属性并全选第 7 层节点；`hero_rank` 不作为输入或数值来源。
- 奇波：80 级；四项天赋均 10 级并解析为 `120`；羁绊 1 级，按 9% 继承；`dnaFactors=[]`。
- 灵子：80 级、`rank=6`、`star=1`。
- 装备：四星、`+9`、同调 110，只生成来源合法的缘星实例。

每个角色恰好装配：

- 1 只来自 43 只 M12-B3 合格目录的奇波；
- 1 个来自 62 个合格目录、职业兼容或通用的灵子；
- 5 件装备，部位固定为武器、上装、下装、耳环和戒指。

全局装备资格分母仍是 137；在本阶段固定的四星 `+9/同调110` 缘星条件下，合法搜索池为 53 个四星基础 ID：武器 17 个，其余四个部位各 9 个。该 53 是 M12-C 固定培养条件下的候选投影，不得反向改写全局 137 件资格分母。

当前没有账号库存约束，因此：

- 不同角色可使用同一个灵子或装备基础 ID，视为相互独立的合法实例；
- 同种奇波可跨角色重复，运行时 CD、SP、被动和资源必须按 `actorSlotId+kiboId` 隔离；
- 单个角色内部仍必须满足部位、职业、实例档和唯一装配槽约束。

套装效果只能由五件已选装备派生，不能作为独立候选直接勾选：

- 2 件同套装启用一次两件套；
- 4 件或 5 件同套装启用一次两件套和一次四件套；
- `2+2+1` 可分别启用两个两件套；
- 5 件同套装没有两件套加四件套之外的额外层数。

跨角色同名灵子效果共享同一目标/effect identity，不因携带者不同而复制实例：

- `refresh`：层数保持 1，重复触发刷新绝对到期时间；
- `stack`：共享一个层数池和同一个上限；
- `block`：已有实例时拒绝重复应用，也不刷新持续时间。

正式搜索前必须保留跨携带者触发、切人、到期边界和保存重放的回归，证明手动排轴、批量评估和自动优化消费同一效果状态机。

装配层先生成并裁剪合法 build 池，再为每个 build 搜索动作轴。不得先按静态面板贪心选出一个装配后才排轴，也不得让非法或未闭合 build 进入评分；`illegal` 与 `unscoreable` 分开报告，但二者都没有分数。

## 4. 固定敌人与场景

三个目标都使用同一个标准敌人：`310054 雷冠牦`，80 级，标准模板 3。不得误用奇波 `500082`，也不得切换到高难或双 Boss 变体。

共同场景为 `m12c-zero-distance-passive-boss-v1`：

- 角色与敌人固定距离 0，默认不移动；
- 投射物按已冻结零距离规则立即命中；
- 敌人静止且不攻击；
- 所有倍率为 1.0，候选不得覆盖敌人属性；
- 三个结果族绑定同一个敌人来源和 profile hash，仅目标侧 HP/韧性政策不同。

## 5. 三个独立目标与 Top-N

三个目标分别运行并分别输出 Top-N，禁止合成权重分数或用一个榜单替代另两个榜单。`N` 是运行参数。

| objectiveId | 正式目标 | 敌人状态 | 截止/闭环 |
| --- | --- | --- | --- |
| `cycle-dps-no-toughness` | 最大化闭环循环 HP DPS | 无限 HP；保留等级、防御和元素抗性；关闭韧性、Break 与其增益 | 非空半开循环区间和连续重放闭环 |
| `cycle-dps-with-toughness` | 最大化正常韧性结算下的闭环循环 HP DPS | 无限 HP；正常韧性、Break 与恢复 | 非空半开循环区间和连续重放闭环 |
| `fastest-kill` | 最小化首次致死完整 settlement cursor | 有限 HP 与韧性；正常 Break | 首次致死 cursor，之后事件截断或仅记诊断 |

排名候选是完整的“队伍 + 装配 + 初始前台 + 初始状态 + 动作轴”。同一 build 可以合法出现在三个榜单中；任何 UI 分组或同 build 折叠都不得改变正式 Top-N 顺序与结果集合。

候选只有在动作轴 legality proof、目标 proof、资格、来源和 binding 全部通过时才可评分。`illegal`、`skipped`、`unresolved`、`blocked` 均在评分前剪除，不能先算伤害再扣分。

## 6. 循环轴初始状态

循环轴允许用版本化 `initialStatePreset` 跳过重复暖机，但 preset 是一次运行的外部固定输入，不是优化器按候选自行挑选的变量。两个循环目标在同一比较批次必须使用同一个 preset；不同 preset 生成不同 hash 和独立榜单，结果不得混排。

循环 preset 可声明：

- 每个入队角色的初始 SP；
- 每个已装备奇波的初始 SP；
- 按来源化印记 ID 声明的队伍调谐印记层数；
- profile 中明确 `scenarioConfigurable=true` 的角色专属数值资源；
- 若未来允许有时限的角色专属状态，必须同时声明来源化状态身份和剩余时长，不能只凭一个资源数值推断状态已激活。

所有值必须属于当前 build，满足来源上限和 `inputStep`，越界直接拒绝，禁止静默 clamp。只给印记数量时，M12-C 规定这些印记在 0F 视为刚获得并拥有完整正常持续时间；改变该时钟语义必须升级 preset 合同。当前不允许把任意 Buff、召唤物、已生效场地、冷却进度或 pending event 当作暖机输入。

初始资源不得成为不可再生的一次性循环收益。循环 proof 必须至少闭合受控角色、角色/奇波 SP、印记层数与逐层到期、角色专属资源/状态、CD/充能/内部 CD、持续效果、pending event 和敌人边界；连续重放第二轮仍须合法且维持同一闭环状态。

## 7. 击杀轴初始状态

### 7.1 通用理论定义

击杀轴可带入战斗的初始资源，严格定义为：**允许所有在非战斗状态下能持久化保留、且不会随时间自行过期的资源，作为初始状态进入战斗。**

这一定义描述未来可扩展的资格原则，不等于本阶段要为每一种角色资源补做客户端证据。临时 Buff、调谐印记、倒计时状态、召唤物、场地效果、冷却进度和 pending event 不满足该定义。

### 7.2 M12-C 当前产品白名单

为控制证据与实现范围，M12-C v1 只开放以下字段：

1. SP：入队角色和其已装备奇波的 SP。允许使用满 SP preset；具体 preset 对整次运行固定并进入 hash，不能由单个候选自行选择。
2. 红宝石弹药：仅当 `103002` 入队时，可配置 `actor:103002:element:103002047`，合法范围为 `0..12`、步长 1。它是一次性的入场持久资源，切走再切回不得重填。

击杀轴的所有调谐印记固定为 0。除上述 SP 和红宝石弹药外，其他角色专属资源、形态、Buff、召唤物、场地、冷却和 pending event 全部固定为 0/未激活；M12-C v1 不为它们搜索客户端持久化证据。

白名单只限制可出现的字段，不允许候选偷选更有利的值。每次正式 run 必须先冻结统一的 `initialStatePreset`；不同 SP 或弹药值属于不同 preset/hash 和不同榜单。未来若要纳入其他符合通用定义的持久资源，必须由产品显式批准、升级初始状态政策版本并重跑全部结果，不能悄悄扩列。

## 8. 动作轴共同合法性

手动排轴、Workbench 导入、CLI、batch、三个目标的自动搜索和 replay 必须经过同一个无头 legality gate：

- 只有当前前台受控角色响应玩家输入；后台角色不能开始新的输入动作；
- 普攻后段必须由同 actor、同 chain 的已接受前段在右开输入窗 `[start,end)` 内派生；exact end、跳段、倒序、重复、跨 actor、切人后续接、blocked predecessor 和 context conflict 均拒绝；
- 切人后旧角色所属奇波不再开始新动作；只有已经物化的投射物或场地 tail 可按来源继续，未物化尾包无证据时 fail closed；
- 奇波自动出手机会与精确 AI cadence 分开；未知 cadence 以 `kibo-auto-cast-schedule-unresolved` 阻断，不能猜 earliest-ready 或 active-first；
- 合击必须原子生成完整双方动作，禁止半边合击、generic break、同帧或名字匹配冒充 trigger；
- 合击的当前产品合同是：有韧性敌人视为可合击目标；合击伤害本身不翻倍；同帧先结算伤害，再以附带削韧清空剩余架势并进入 Break；米砂相关触发由其奇波 40F 命中造成的破韧驱动；
- STARBORN 星决技必须对队伍当前已拥有的每一种印记分别增加 1 层，并逐种执行各自上限/刷新规则；没有的印记类型不得凭空创建，也不得跨别名双计。

上述合法性合同已由聚焦回归、canonical replay、Workbench production preview 和全量 trial-release 覆盖；产品视觉签收与 `clientParityReady` 仍按各自证据状态独立判断。

## 9. 实施顺序

1. `M12-C0`：冻结本计划、敌人 profile、三目标合同和 initial-state policy/version/hash。
2. `M12-C1`：实现并验证 28 个队伍对象、35 个来源配置、STARBORN 单别名和初始前台轴身份。
3. `M12-C2`：生成合法 build 池，闭合灵子职业、奇波隔离、五部位装备、套装派生、同名效果刷新/叠层/阻断及 build hash。
4. `M12-C3`：实现 objective-scoped 初始状态 validator；循环资源白名单与击杀轴 SP/红宝石弹药白名单必须有正反例。
5. `M12-C4`：为三个 objective 分别运行内层动作轴搜索并输出独立 Top-N、proof、hash、贡献与拒绝原因。
6. `M12-C5`：Top-N 自动导入 Workbench，逐条人工复验动作、派生、资源、Buff、印记、Break 与伤害曲线。
7. `M12-C6`：固定输入重复运行、保存导入、batch/CLI/Workbench parity、cycle replay、trial-release、production build 与确定性审计全绿后，才允许形成正式结论。

## 10. Admission 与当前边界

正式搜索前至少满足：

- 正式 roster 9/9、奇波 43/43、灵子 62/62、装备 137/137、套装技能 12/12 和 E22 binding matrix 22/22 已全部通过，formal admission 与核心 hash 一致；
- `101010`、`103002`、`107002`、`STARBORN`、`112001` 的产品视觉不得由自动化代签；本轮只保留已有记录，STARBORN optimization-object 仍明确 pending；
- STARBORN 每种既有印记 `+1` 与合击结算合同已合入主线并通过无头、Workbench 和全量回归；
- objective-scoped initial-state validator 已落实，通用 scenario 字段不能绕过循环/击杀白名单；
- 三个 objective 的雷冠牦 profile、初始 preset、暴击政策和 runtime settlement 合同必须进入未来结果 hash；
- `clientParityReady=false` 不回锁已经通过的 optimization qualification，但也不能被 formal scoring 或测试通过自动提升；
- 正式搜索尚未启动。进入 `M12-C4` 后仍须分别产出三个 objective 的 Top-N、proof、hash、贡献和拒绝原因，再进入人工 Workbench 复验。
