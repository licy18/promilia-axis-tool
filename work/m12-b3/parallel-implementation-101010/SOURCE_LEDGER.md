# M12-B3 101010 涂山小玉来源账本

## 边界与结论

- 基线：`ee5c4cf817521165186f438f274893c91dfb1280`。
- 产品场景：`m12c-zero-distance-passive-boss-v1`，距离 0、投射物立即命中、Boss 静止且不攻击。
- 本账本只裁决缩减动作面内 101010 的来源与运行证据；不签产品视觉、formal admission 或 optimization-ready。
- 初始 acceptance 为 382 total、255 required、149 pass、127 N/A、106 blocked，sourceGap=72、acceptanceGap=56、ledger blocking=128。
- 最终 owner 输出为 383 total、239 required、239 pass、144 N/A、0 blocked，sourceGap=0、acceptanceGap=0、ledger blocking=0。新增的 1 条库存是来源声明后的 `10101021` 星携技 public action；16 条原 required 按冻结政策结构化转为 N/A，另有新增行同样属于 N/A，因此 N/A 净增 17。

## 原始来源层

| 来源层 | 采用的身份 | 裁决 |
| --- | --- | --- |
| hero / public catalog | `characters.items[id=101010].skillSlots[...]`、`NewTable/hero.json#rows[id=101010]` | 保留公开动作与 skill slot 身份；补齐 `10101021` 星携技声明，但不替换原 hero-direct binding。 |
| skill / skill logic | `NewTable/skill.json`、`NewTable/skillsub_logic.rows[skillId=...]` | 输入类型、CD/Charge 与公开技能身份沿用权威表；未从缺失字段推造动作。 |
| skill_control | `skill_control_10101001/02/03/04/05/10/12/13/21/26/42/61.asset` 及其 behavior/resource maps | 动作形态、hit 帧、control window、source-to-execution context edge 和 effect 触发以原始 player/subskill 结构为准。 |
| battle element / bullet | `ast_101010106/107/115/129/205/206/207/209/210.asset`、`ast_750.asset`、`ast_bullet_101010001/002/211/212.asset` | 资源 combine、状态时长、A4 命中回能、风雷印记 consume packet/judgment 与零距离投射物碰撞路径均保留原 identity。 |
| talent / property tables | `talent_rank`、`talent_rune`、hero/property authoritative source package | 已纳入 source manifest 审计；没有证据要求在本缩减动作面新增独立 talent runtime，故不凭表存在性制造行为。 |
| client code | `dump.cs#ModuleChargingSkill101010._accElementId|_burstElementId`、`client-runtime:EventBridgeBehavior.Start/OnEvent/Update` | 只用于确认资源/状态字段与 source-to-execution 桥接；具体结算仍要求 canonical/Machine Axis trace。 |

`reports/m10/101010/source-manifest.json` 最终索引 1123 个 source identity：battle-element 37、client-code 4、new-table 55、runtime-contract 20、skill-control 826、other 181。

## 机制裁决

### 动作与派生

- `10101001` 普攻链、`10101010` 普通/连续/强化重击、`10101042` 特殊/强化特殊重击、`10101012` 星鸣技、`10101013` 星决技、`10101021` 星携技、`10101026` 星结合击均由真实 action-form selection 进入 canonical trace。
- source control 与 execution control 分离：A5、星鸣技、星决技等来源动作通过 context edge 选择 `10101042` 派生重击；input-timing 的场景范围按 source control 判定，variant/action settlement 按 execution control 判定。
- `10101010/0` 的连续重击输入窗为 `[75,100)`：74F 与 100F 均保持普通重击，75F 与 99F 选择 `10101010/1`。Workbench JSON 往返保留显式 `contextActionId`；缺失或与 public action/action kind 不匹配的保留元数据不会恢复 attack input。
- raw switch wrapper 不作为第二个公开动作：21 条原始 switch edge 由 canonical context input edge、action form 与 state machine 语义覆盖并结构化为 `superseded-by-semantic-transition-closure`。

### 爆发资源与状态

- `101010115`：`combineType=4`、`combineNumber=100`，作为容量 100 的特殊资源。
- `101010129`：`combineType=5`、`time=10000`，状态生命周期采用刷新语义与右开区间。
- 达到阈值的同帧顺序为先 `gain 95→100`，再 `threshold-clear`/`transform`；不足阈值的对照不会产生 transition。
- `101010129.notDelElementDataList` 指向风印记 `750` 两次；阈值 transition 真实取得 2 层风印记，刷新状态不删除声明的印记列表。
- 主场景中 refresh/transform 到 expire 均精确相差 10000ms；到期帧之后状态才失效。

### A4 落地命中回能

- `skill_control_10101004` 的四条零距离 projectile impact 位于 10F、14F、18F、22F，命中元素为 `101010107`。
- `ast_101010106` 给出 `function_2=3; A=6000; shareType=1; stopSharing=0`，运行绑定据此产生每次 `0.6` direct SP，目标为 source actor。
- 正例：四次 landed hit 产生四次 `verified-direct-sp`，绝对帧为 2410/2414/2418/2422。
- miss/blocked 反例：隔离 A1→A4 链仍选中 `10101004/0`，但四击分别 miss/blocked 后 combat hit=0、direct SP=0。
- interruption 反例：A4 在右开有效占用 18F 截断时，仅 10F/14F 两击各回 0.6 SP；18F/22F 的 landed-hit binding 均记录 `withinOccupancy=false`。

### 风雷印记与主动派生

- 风印记 `750` 的成功消费路径绑定 packet `799`、judgment `101010210` 与 tuning damage `796`；雷/光印记 `950` 的成功消费路径绑定 packet `999`、judgment `101010209`、主伤害 `997` 与真实伤害 `996`。
- 投影只在同一 action 上同时存在：已应用的 tuning-mark consume、完全相同的 `battle-effect:...` 来源、profile 中对应 `tuningOverlimit` 合同、以及正数已结算 `VERIFIED_TUNING_DAMAGE` 时生成 packet/judgment 证据。任一条件缺失均不投影。
- 主场景分别证明星鸣技的雷/光消费、特殊重击的风消费、星携技的风消费、星决技的风消费；`10101021` 不再借用其他 action 的 tuning trace。
- 独立 `m12-b3-101010-light-ultimate` 场景证明星决技在 272/278/284F 按 `3→2→1→0` 消费三层雷/光印记，每次同时结算 `997` 与 `996`；同场没有风印记，风 consume=0。
- 条件不足反例：无足够风印记的派生重击不会产生 `796` tuning damage。

### 被动与客户端视觉

- `10101061` 通过 `101010205→101010206→101010207` 来源链投影属性 modifier；选中动作的被动应用由 source-driven passive contract 结算。
- `101010211` 相机 effect 只属于客户端产品视觉，不在 headless runtime 合成。现有 Workbench Playwright 截图 SHA-256 为 `73ff96230b426eaf1d23026f0764199c054f522352fb10adc7ee1a2ea8526928`，但 recipe 与 manifest 保持 `productVisualAcceptance.status=pending`。

## 14 个 source-closure policy

| policy | 数量 | disposition | 证据裁决 |
| --- | ---: | --- | --- |
| `xiaoyu-raw-switch-edges-superseded-by-semantic-transitions` | 21 | N/A | raw wrapper 被 context edge/action form/state machine 语义覆盖。 |
| `xiaoyu-zero-distance-selected-projectile-hits` | 11 | applied | 选中动作在距离 0 的真实 projectile impact trace。 |
| `xiaoyu-selected-tuning-consume-success-branches` | 9 | applied | consume + source effect + packet/judgment + settled damage 交叉验证。 |
| `xiaoyu-selected-zero-distance-effect-frames` | 13 | applied | 碰撞提供 effect trigger frame，不把静态缺帧继续当 blocker。 |
| `xiaoyu-selected-passive-property-effects` | 7 | applied | 10101061/205/206/207 被动属性链由 canonical trace 覆盖。 |
| `xiaoyu-reactive-effect-frame-out-of-scope` | 4 | N/A | 完美招架 effect 要求敌方攻击事件。 |
| `xiaoyu-resource-state-tuning-mark-relations` | 3 | applied | 101010129 的风印记双重关系由 state machine 与 trace 闭合。 |
| `xiaoyu-reactive-projectile-hits-out-of-scope` | 2 | N/A | 完美招架 projectile 在被动 Boss 场景不可达。 |
| `xiaoyu-reactive-tuning-consume-out-of-scope` | 2 | N/A | 完美招架 tuning 分支要求敌方攻击事件。 |
| `xiaoyu-resource-state-combine-semantics` | 2 | applied | combineType 4 容量阈值与 combineType 5 十秒刷新。 |
| `xiaoyu-burst-camera-client-visual-only` | 1 | N/A | 相机行为只留产品视觉来源。 |
| `xiaoyu-frozen-movement-and-reactive-wrappers` | 3 | N/A | 空中、极限反击、完美招架属于冻结动作面外。 |
| `xiaoyu-selected-resource-state-and-passive-wrappers` | 5 | applied | source-driven resource/state/passive contract 覆盖 raw marker wrapper。 |
| `xiaoyu-reactive-passive-property-effect-out-of-scope` | 1 | N/A | 完美招架触发被动要求敌方攻击事件。 |

84 条被 policy 直接裁决的记录均保留 `sourceClosurePolicyIdentity`、`sourceClosureSourceIdentity` 与非空理由；其余非阻断 source records 保留原 record/source identity，没有删行或把 `facts=true` 当结算证据。

## Owner 验收证据

- canonical golden：`m10-a:101010:120s-three-actor-golden`。
- Machine Axis：`m11-d-101010-visual-acceptance`、`m12-b3-101010-light-ultimate`。
- 三场均 stable replay；两个 Machine Axis fixture 均 Workbench round-trip passed。
- 最终 3/3 scenarios、1189/1189 assertions；9 条 critical requirement 全部由执行断言闭合。
- 仍存在且唯一保留的成熟度 blocker：`acceptance-product-visual-signoff-pending`。
