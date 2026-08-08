# M12-B3 / 102001 莉莉来源账本

## 边界与状态

- 实现基线：`140eefcd233cd9c1d136728f1c94b91aff632278`。
- 角色：`102001` 莉莉；仅处理 M12-B3 缩减动作面。
- 产品场景：`m12c-zero-distance-passive-boss-v1`，距离 0、投射物立即命中、Boss 静止且不攻击。
- 本线只产出角色 recipe/profile/owner contract/角色报告和聚焦验收，不声称 formal admission 或 optimization-ready。
- 正式 roster 分母仍为 9；`Kibo DNA=[]`；`hero_rank` 保留为未实装死配置 N/A。

## 原始资源根

- 角色文本、等级数值与公开技能 CD：`C:\PC2\Codex\AzPr\BWiki\data\hero-modules\local-all\102001.hero-module.local.json`。
- 技能控制、行为线和元素资源：`C:\Codex\AzPr Extractor\ExtractedAssets\Unity\default_package\ResourcesAssets\Config\Battle\SkillList` 与 `...\Battle\Element`。
- 角色技能槽：`C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\NewTable\hero.json#rows[id=102001]`。
- 技能逻辑表：`NewTable/skillsub_logic.rows[skillId=*]`；属性初值：`NewTable/template_value` + `NewTable/template_hero`。
- 当前声明合同：`scripts/character-combat/profile-recipes/102001.json`。
- 编译后完整来源链：`src/data/generated/character-combat-owner-contracts/102001.json`、`src/data/generated/character-combat-profiles/102001.json`和 `reports/m10/102001/source-manifest.json`。

## 缩减动作面 inventory

| 动作     | 执行控制 / 子技能 | 命中帧                                            | 占用 / 门                                                 | 主要派生                                                                                  |
| -------- | ----------------- | ------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 普攻 A1  | `10200101/sub0`   | `6,11,16`                                         | `19F`                                                     | 基础 HP/韧性/角色 SP/Kibo SP 结算                                                         |
| 普攻 A2  | `10200102/sub0`   | `8,11,15,24`                                      | `32F`                                                     | 同上                                                                                      |
| 普攻 A3  | `10200103/sub0`   | `4,8,12,16,20,30`                                 | `40F`                                                     | 同上                                                                                      |
| 普攻 A4  | `10200104/sub0`   | `13,18,23,29,34`                                  | `42F`                                                     | 同上                                                                                      |
| 普攻 A5  | `10200105/sub0`   | `20,24,28,32,36`                                  | `56F`                                                     | `20F` 的精准防御 SP/风印路径需精准防御/霸体前置，在冻结场景 N/A                           |
| 重击     | `10200110/sub0`   | `5,22,26,30,34`                                   | 按住阈值 `250ms`，原表 CD/SP 为 0                         | 基础命中结算；其他 sub 不混入公开重击                                                     |
| 星鸣技   | `10200112/sub0`   | `32,37,42,48,54`                                  | 公开 CD `24000ms`，SP 消耗 0                              | 每个实际命中独立刷新 `+4% ATK / 6000ms`；每 hit `+0.5 SP`；`1F` 获得意志                  |
| 星结合击 | `10200126/sub0`   | `40`                                              | 原表 CD/SP 为 0                                           | 外部 Kibo break 事件验证主动派生，不新增角色 Kibo DNA                                     |
| 星决技   | `10200113/sub0`   | `150,172,182,193,206,211,216,220,226,230,236,241` | 公开技能 CD `10000ms`，SP 消耗 `100`；实际选择占用 `276F` | 仅 `211/216/220F` 三次风墙命中各生成 1 层风印 `750`；`243F` 获得意志                      |
| 离场星携 | `10200122/sub0`   | 无直接伤害 hit                                    | `on-exit`，执行占用 `81F`；选中控制原表 CD `24000ms`      | `51F` 召唤 `480122`，向入场受控角色施加守护 `6000ms`，属性 22 值按技能等级为 `1900..3000` |

注：`10200113` 在控制行的原始 `skillsub_logic` 投影为 `cooldownMs=0`，但角色公开技能模块 `skillsub_logic.coolDown=10000`。产品运行时使用后者：权威 golden 中第二次星决在首次后 5 秒被唯一 `skill-cooldown-active` 拦截，首次后约 10.017 秒的反例已越过 CD，只被 `verified-resource-cost-unavailable` 拦截。

## `10200112` 星鸣命中与数值链

| hit |  帧 | 伤害 element / path               | behavior path          | 同行为派生                                                   |
| --- | --: | --------------------------------- | ---------------------- | ------------------------------------------------------------ |
| 1   |  32 | `102001043 / 1596977191652035373` | `-3535188980622617154` | `102001137 -> 102001119`，ATK `dynamicPercent=400`，`6000ms` |
| 2   |  37 | `102001043 / 1596977191652035373` | `-6626411584729639490` | 同上                                                         |
| 3   |  42 | `102001043 / 1596977191652035373` | `-2647497593602370114` | 同上                                                         |
| 4   |  48 | `102001043 / 1596977191652035373` | `-8795270998137760322` | 同上                                                         |
| 5   |  54 | `102001115 / 609786774220013544`  | `7555307119572358590`  | 同上                                                         |

- `102001137` 向自身注入 `102001119`；`ast_102001119` 为属性 1、`dynamicPercent=400`、持续 6000ms。
- `10200162` 文本与等级值明确为“星鸣技每下伤害命中额外 0.5 星决蓄能”；其被动 control 本身为空容器，因此用文本常量 + 上表 5 个精确 hit selector 绑定通用 landed-hit runtime。
- 正例：5 hit 全命中产生 5 次 `+0.5`和 5 次 4% 攻击刷新；只最后一击命中时各产生 1 次。
- 反例：全 miss 为 0；在 `44F` 中断只结算 `32/37/42F` 三击；SP 已封顶时 runtime 仍生成 5 个命中条件，但资源结算不产生超上限交易。

## `10200113` 风墙 / 风印 `750`

星决的 12 个伤害 hit 中，只有以下 3 个 behavior 路径同时携带 `102001134 -> 750`：

| 星决 hit |  帧 | 伤害 element / path               | behavior path          | cardinality |
| -------- | --: | --------------------------------- | ---------------------- | ----------: |
| 6        | 211 | `102001059 / 8236903294079356132` | `5790785966890863275`  |           1 |
| 7        | 216 | `102001059 / 8236903294079356132` | `1384799686497127083`  |           1 |
| 8        | 220 | `102001059 / 8236903294079356132` | `-6639102421339288917` |           1 |

- 每个风印 effect 都使用 `same-action-hit-landed`绑定自己的 hit identity，不是“星决执行就给 3 层”。
- 全命中 / 只命中最后一击 / 三击全 miss / `218F` 中断的 cardinality 分别为 `3 / 1 / 0 / 2`，因而单次星决最多 3 层。
- golden 绝对帧为 `411/416/420F`，层数 `0->1->2->3`；同帧伤害的 source path 为 `[2,6,0] / [2,7,0] / [2,8,0]`。`411F` 事件序列为先 `acquire`、后 `held-trigger`，锁定了同帧获得印记后再进入持有命中派生的顺序。
- 运行门：星决需 100 SP，公开技能 CD 为 10s；不满足时动作不 execute，不可产生 hit 或印记。

## 意志与冻结 N/A

- `ast_102001135`：`time=7000`、`combineNumber=1`，实现为 `lily-will` 单层状态，到容量时刷新旧层。
- 真实可达主动入口：星鸣 `10200112@1F`；星决 `10200113@243F`。golden 中三段 gain/expire 为 `1->421`、`443->863`、`1801->2221`，均恰好 420F = 7s。
- 意志内嵌 `102001110` 的“受敌击后触发精准防御”需要 Boss 攻击事件，保留来源并标记 `enemy-hit-driven-perfect-defense-branch-not-applicable-in-passive-boss-scenario`。
- A5 `20F` 精准防御路径、`10200127` 精准防御以及 `10200161` 反击印记都需防御/敌击刺激，本场景不伪造刺激，也不删除来源。
- 专用闪击/闪避、跃击/跳跃/下落、完美闪避/格挡/招架/极限反击统一保留为 `scenario-out-of-scope-not-applicable`。

## 离场星携与物件派生

- `10200122` 为 `slot=201` 的 `on-exit` 星携技；控制资源在 `51F` 召唤 `unit=480122`。
- `battlefield_item[480122].skillList = [48012201, 48012202]`。
- `48012201` 主控制资源 `skill_control_48012201__6159323496239606617.json` 在 `0F/23F` 施加 `ast_480122002`，在 `360F` 施加 `ast_480122006`。
- `ast_480122002 -> ast_480122004`；`ast_480122004` 为属性 22 `dynamicExtra`，角色等级 1..12 的实际值是 `1900,2000,...,3000`，持续 6000ms。runtime 目标是离场后的 `controlled-actor`，不是离场的莉莉。
- `ast_480122005` 的受伤触发条件为 `480122002`，触发 `48012202`；`skill_control_48012202__-8686295835454375553.json` 在 `0F` 施加 `ast_480122006`、`95F` 事件收口；`ast_480122006` 清理 `480122002/004/005`。
- 因 Boss 不攻击，“下一次受伤减伤并消耗守护”分支保留上述完整源链并标记 N/A；可达主动部分只实现守护的施加、目标、持续时间和等级数值。

## 通用 runtime / 反例约束

- landed-hit 触发、命中覆写、上下文占用中断、逐 hit source sequence、直接 SP、按技能等级取属性值、`controlled-actor` 目标和 `scenario-roster` owner 隔离均是声明式通用操作，无 `102001` 特判。
- 通用正例：不同角色 ID 的合成合同可使用同一 landed-hit 与等级缩放 runtime。
- 通用反例：miss 不产生效果/SP；超出动作有效占用的 hit 不产生；未在场景 roster 中的 owner 合同不泄漏；只有与公开 action form 的同一 execution control/subskill 匹配的 runtime binding 才能让零 hit 动作就绪。

## R1 正式动作等级合同

- 正式来源字段固定为 Machine Axis `actions[].intent.level`；Workbench draft 与 canonical core 均保存为 `action.level`。通用 `resolveVerifiedActionLevel` 由 target-state 和 action-variant 两个 runtime 共用，优先读取 `action.level`；只有 canonical 字段缺失时才允许 legacy `action.skillLevel` fallback，并返回明确的来源状态。
- 两字段同时存在且数值冲突时以 `verified-action-level-conflict` fail closed；显式非整数、非 number 或超出 `1..12` 时以 `verified-action-level-invalid` fail closed；两字段都缺失或 canonical 为 `null` 时按既有合同默认 1 级。
- 正式 Machine Axis / Workbench / canonical / service 正例使用同一 scenario ID，仅改变 `intent.level`：1 级守护为 `1900`，12 级为 `3000`；输入 hash、120F active-effect search hash 与 cycle effect boundary 都能区分两级，JSON export/import 后 hash 与数值保持一致。测试不向核心动作手工注入 `skillLevel`。
- search/cycle 在 canonical effect intervals 缺席时从事件重建“有明确到期时间”的 active effect，并把归一化 modifiers 纳入状态；无到期时间的持久效果继续使用既有专用 boundary-state 路径，本线不改其全局 acceptance/hash 语义。
- owner golden 继续锁定离场派生的 1 级守护：`2051F` 施加到入场小玉，`2411F` 到期，值为 `1900` 且持续精确 `360F = 6000ms`。12 级 `3000` 由独立正式 Machine Axis service E2E 锁定，不改 owner profile hash，也不要求支线刷新全局 integrated baseline。
- 通用 action-variant 反例把同一资源操作的 `amountByLevel[1/12]` 设为 `5/11`，核心动作仅使用 `action.level` 即分别结算 `5/11`，锁定两个 verified runtime 不再出现等级语义分叉。

## 验收与集成边界

- 角色聚焦验收：`src/__tests__/machine-axis/lilyQualification.test.js`。
- 正式等级链验收：`src/__tests__/machine-axis/lilyActionLevelIntegration.test.js`。
- 通用 runtime 验收：`src/__tests__/simulation/verifiedTargetStateRuntime.test.js`。
- 通用边界/反例：`src/__tests__/data/characterCombatProductBoundaries.test.js`、`characterCombatProductionOrchestrator.test.js`、`verifiedCombatMechanicsPackage.test.js`。
- 本支线不提交全局 verified package/catalog/qualification/binding matrix/summary/index。中央集成线 cherry-pick 后需按顺序统一重生：`data:sync-verified-combat` -> `data:sync-character-combat -- --all` -> `data:generate-optimization-scenario-policy` -> `data:generate-character-acceptance` -> `data:generate-optimization-qualification` -> `data:generate-visual-acceptance`。
