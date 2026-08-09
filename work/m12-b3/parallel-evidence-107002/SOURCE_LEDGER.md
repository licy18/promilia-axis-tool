# 107002 米砂 M12-B3 来源账本

## 1. 账本边界

- 状态：`r2-owner-implementation-candidate`；产品视觉仍为 `pending`。
- 继承来源证据基线：`140eefcd233cd9c1d136728f1c94b91aff632278`。
- 固定 R2 集成/范围基线：`1a56e0a295f31298da6c3ddb5d70db90183971fb`。
- 产品场景：`m12c-zero-distance-passive-boss-v1`，距离 0、投射物立即命中、Boss 静止且不攻击。
- 正式 roster 分母保持 9；`Kibo DNA=[]`；`hero_rank` 仅是未实装死配置。
- 本账本不声明 formal admission、optimization-ready，也不进入 M12-C 或正式搜索。
- 两份机器账本是本文件的审计底座：
  - `resource-graph-excerpt.json`：角色投影、NewTable、Unity control/element/战场物件图及已有 mark-priority 证据。
  - `runtime-evidence-excerpt.json`：外链被动轨道、枚举和 `ConsumePackElement.Execute` 反汇编调用顺序。

来源优先级为：运行时二进制/枚举 > 原始 Unity control 与 battle element > NewTable 运行时表 > 当前编译器投影 > 公示技能文本。低优先级来源与高优先级来源冲突时，保留冲突，不用公示文本补造运行时传播。

## 2. 可复现来源快照

两份核心机器摘录采用同一双基线模型：原始 production 来源身份继承并固定为 `140eefcd233cd9c1d136728f1c94b91aff632278`，本批 production 漂移审计的固定起点为中央 R2 集成提交 `1a56e0a295f31298da6c3ddb5d70db90183971fb`。侧车当前 commit 只承载证据，不写入产物。生成器会把 `1a56e0a..HEAD`、index、working tree、untracked 的路径取并集，并拒绝固定 R2 allowlist 之外的任何漂移；因此后续侧车提交不会污染产物，中央基线以后的 production 变更也不能暗中越界。

核心产物不含 `generatedAt`、当前 HEAD、`headAtExtraction` 或 `trackedChangesSinceBaseline`。它们固定按 UTF-8 / 2-space / LF / final newline 序列化；当前确定性 SHA-256 分别为：

- `resource-graph-excerpt.json`: `e2455070684172a0dd5e8fdaf86be0abd8aeb63716c145f7fbe2e6f1d6eb8c34`
- `runtime-evidence-excerpt.json`: `068bc52253d539bb77487742f60f0f75dbb0d118705683b75b5779742efa528f`

中央 R2 基线没有携带 `integration-conflict-snapshot.json` 或其刷新脚本，本批不新增该动态产物。validator 仅在文件存在时把它当作可选、非核心时点快照；缺席不会进入上述核心来源证据的字节可复现声明。

| 来源 | 字节数 | SHA-256 | 用途 |
|---|---:|---|---|
| `src/data/generated/character-combat-mechanics.json` | 113293076 | `2fc58e7e84d8c42f3382f8022330049b768aa9e6d75c99318162004558709543` | 当前角色动作、hit/effect/resource 投影 |
| `src/data/generated/characters.json` | 由机器账本记录 | `eddd0616c72711bf45c56020768e52f656d41ed596bcc6a7c1528aae5b0c61a0` | 角色公示字段 |
| `src/data/generated/skills.json` | 由机器账本记录 | `1559a822f84f4232490bf7aaecde9d3474d477752ca7eb9172ac10d16cc045f3` | 公示技能描述 |
| `battle-element-assets.jsonl` | 43759616 | `059535b45b7b64db59e5cdc49eb6f60bf9fc4b1bb547aaa74f773f2752406346` | battle element typetree/pathId 闭包 |
| `NewTable/hero.json` | 由机器账本记录 | `22eccaf0c62e15c2333d95af0537c6be0f60eb542c95bce75d7be2d5f73418d4` | 角色原始表 |
| `NewTable/skill.json` | 由机器账本记录 | `3b0d134cbe7528eb48d0b3a467778a6115c4fa18c9f48875ae9c3a42c4f3b21a` | 技能主表 |
| `NewTable/skill_level.json` | 由机器账本记录 | `6f661653182ddf7a36a64534c7a1a6c20b42a96d73baa1e9455649340c7881bf` | 技能等级值 |
| `NewTable/skillsub_logic.json` | 由机器账本记录 | `ca6da39f122466a32b229b9599ecfc34dbdbbf6e10a157c529d43d1043b8f4b7` | SP、CD、输入触发 |
| `NewTable/skillsub_ele_value.json` | 由机器账本记录 | `836178c72056b4946005cb9d48dc372627ee415f19f0fb73b55809fb1641c1ba` | element 等级值 |
| `NewTable/element_formula.json` | 由机器账本记录 | `ebbdb6b9bd8117015f596be3055674d32963a68f3abe0a8865fef4373012515e` | 公式 104、1006 |
| `NewTable/battlefield_item.json` | 由机器账本记录 | `9da21e06caf025f6c57c76696d3b5baf3b433ae6c18482ae746a89d26e6761fb` | 480041/480042 图和 slot |
| `ResourcesLang/...` | 由机器账本记录 | `f7e85a63b159320da6cad13dd9f8f0556d21e7b009e692d49515ca77850a59f7` | 物件名/描述文本 |
| `tuning-consume-priority-runtime-evidence.json` | 1908 | `102de0686bab70718cffd5ac238499d4c43024929d35b2592a37a09eb39e4680` | `[550,750]` 优先消费的已验二进制证据 |
| TC default-package manifest | 43244677 | `b72e1835d4dacd21589bc22d1a6afef871e43239e567ead5d061ca67b14fc513` | 外链被动 track 切片定位 |
| `dump.cs` | 97428254 | `0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a` | enum、RVA 和方法声明 |
| `GameAssembly.dll` | 222485544 | `c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b` | `ConsumePackElement.Execute` 调用序列 |

绝对源路径、字节数及全部文件身份在机器账本的 `sourceFiles` / `sources` 中，避免这里手抄时丢失路径细节。

## 3. 动作面 required / N/A

### Required

| 机制面 | control | 来源结论 |
|---|---|---|
| 普攻链壳 | `10700201..10700205` | A3/A4 为本次机制核心；A1/A2/A5 是动作入口依赖。A5 variant 与完整普攻排程仍未闭合。 |
| 蓄力 | `10700210` | 330F，hold 250ms，runtime CD 100ms；76F hit 附 DEF debuff。 |
| 星鸣 | `10700212` | 336F，runtime CD 24000ms；74/82/90/99F 造 SP 拾取，82F 判断/消费，90F 独立 +1 风印记。 |
| 星鸣后段 | `10700226/sub0` | 实际 action 映射的星鸣 combo，218F。`10700212/sub1` 的 28F 拾取仅保留为未选 alternate。 |
| 星决 | `10700213` | 298F，SP 100；五次 AllHero 治疗、3+3 拾取、两层木印记。 |
| 星携 | `10700222` | 150F，runtime CD 24000ms；四次 AllHero 治疗。 |
| 拾取物 | `48004101/02`, `48004201/02` | 创建、碰撞、一次性奖励、销毁、过期及被动调谐强度。 |
| 被动标记 | `10700261` | 外链 track 注入永久 marker，供拾取物公式 1006 检查。 |

### `scenario-out-of-scope` N/A

| control | 动作 | 结构化 N/A 原因 |
|---:|---|---|
| `10700215` | 闪击/闪避 | 专用闪避状态不属于冻结产品场景。 |
| `10700211` | 跃击/跳跃/下落 | 需要空中/下落状态。 |
| `10700225` | 极限反击 | 必须消费 Boss 攻击事件，而冻结 Boss 不攻击。 |
| `10700227` | 完美格挡/招架/专注闪避 | 必须消费 Boss 攻击事件；其专注闪避 DEF debuff 只保留来源。 |

N/A 只表示在该产品场景中不参与优化面，不表示来源被删除，也不表示动作在游戏内不存在。

## 4. 普攻 A3 种子与治疗拾取

### 创建

- A3 control `10700203/sub0` hit：`40,46,52,58,64,70,76,82,88,94,100F`。
- 仅前六个 hit 的 `toOwnElementBaseDatas` 包含召唤 `pathId=3434452943307337244`, `elementId=107002220`；因此创建帧是 `40..70F`，后五 hit 不创建。
- 召唤参数：`unitId=480042`、`count=1`、`lifeTime=15000ms`、`maxCount=6`、`countType=2/SummonTempData`、`summonPointType=2`、`positionType=1`。
- 创建绑定 hit：miss 时不得创建。在距离 0、立即命中场景中，六个 qualifying hit 可以请求六个实体。
- 静态配置只证明池上限 6，没有证明第七次请求是替换旧物还是拒绝新物。实现规格采用 fail-closed `reject-new-at-cap`，且未创建实体绝不能发奖励；这是保守策略，不伪装成运行时实证。

### 拾取

- HP 物件 `480042` 的碰撞 TargetType 是 `2/Ally`，`toOwnMaxCount=1`。
- HP reward 是 `elementId=107002216/pathId=-8742085360987801148`，公式 104：`(self.MAXHP[0]*A)/10000`，`A=300`，即来源角色最大生命的 3%。
- 原始注入路由没有 `AllHero`，也没有 `ShareAll`；碰撞 `Target` 才是治疗接收者。
- 公示文本“全队治疗”与原始路由冲突。集成实现不得仅凭文本广播；若未来拿到隐藏传播的运行时 trace，再升级路由。
- HP 同次碰撞的序列化 reward 顺序：空 FX -> 被动调谐强度 gate -> 3% HP heal。

## 5. A4/蓄力命中后的 DEF -10% / 24s

### A4

- hit 帧：`49,56,63,70,77,84,90,96,102F`。
- 84F behavior `pathId=-1291223460462752175` 的 `elementBaseDatas` 顺序：
  1. damage `1159803510611510720`
  2. energy `-5490397539017617711`
  3. DEF wrapper `7790264186762117375`
- 所以 84F 触发 hit 自身先按旧 DEF 结算；90/96/102F 后续 hit 才观察到 debuff。

### 蓄力

- hit 帧：`48,51,63,69,76,83,90F`。
- 76F behavior `pathId=6704838959614714036` 的 `elementBaseDatas` 顺序：damage `-1320777497519764210` -> energy `-1211965369219084289` -> DEF wrapper。
- 83/90F 后续 hit 观察 debuff。

### 效果

- wrapper `elementId=107002256`, `pathId=7790264186762117375`, `combineType=3/Cover`, `lifecycle=24000ms`。
- 物理 DEF：`elementId=107002258`, `pathId=-3902053340404252506`, `attr=3`, `calculateType=2`, `value=-1000bp`。
- 法术 DEF：`elementId=107002257`, `pathId=1466117413664505892`, `attr=4`, `calculateType=2`, `value=-1000bp`。
- 只有命中才应用；miss 不应用。区间采用 `[apply, apply+24000)`，右端点恰好失效；Cover 重施刷新/覆盖 wrapper。

## 6. 星鸣：SP 拾取、印记、overlimit 与真实顺序

### 创建帧与 action 映射

- 主星鸣 hit：`74,82,90,99,107,114F`。
- 只有 `74,82,90,99F` 的 `toOwn` 创建 SP 拾取：`elementId=107002214`, `pathId=513582975064864872`, `unitId=480041`, `life=15s`, `max=6`, `countType=2`。
- `107/114F` 不创建。
- `10700212/sub1` 确实有 28F alternate 创建，但当前 action 选中的后段是 `10700226/sub0`；不得把 alternate 28F 并入主星鸣。

### 82F 消费链

82F hit behavior `3929844140260263526` 的序列是：

1. damage `6857014326835818730`
2. energy `-3883846112050479707`
3. 不消费的 availability judgment `-2174275479014567856`
4. 消费 judgment `-6104701335743815286`

两次 judgment 都按数组 `[550(木), 750(风)]` 查找，消费 judgment 的 `consumeLayerNum=1`、mode=`Priority`。已有二进制证据证明按数组下标升序选择首个层数足够的候选；当前候选不足就继续下一个；所有候选都不足则不消费、不注入。

`ConsumePackElement.Execute` 的反汇编直接调用顺序为：

1. `CalculateConsumeCount`
2. `CastPassiveSkill`
3. `DoConsume`
4. `DoInject`

所以成功选择时，先确定候选，再触发被动，再扣一层，再按所选元素注入 overlimit packet。木 packet 是 `elementId=599/pathId=2120617582505955581`，风 packet 是 `elementId=799/pathId=4731523060341306954`。

不消费 judgment 注入 `elementId=107002265/pathId=3375530858005333853` 的 30s wrapper，子效果为木伤 `attr=55,+5%` 与风伤 `attr=53,+5%`。原始 `executeTarget=Source`，不是 `AllHero`；公示“全队”与原始路由冲突，不得无证据广播。

### 90F 独立风印记

90F hit behavior `304217500998239846` 的 `toOwnElementBaseDatas` 顺序是：

1. 风印记 `elementId=750/pathId=1474042154774785480`
2. SP 拾取召唤 `pathId=513582975064864872`

它发生在 82F 消费之后，不能给本次施放的 82F 判断“垫付”印记。标准风印记上限 5、每个独立层 20s。

### SP 生成物实际路由

- child reward 原始目标仍为 `TargetType=2/Ally`；这只定义 reward 注入目标，不证明实体会自动移动或自动发生碰撞。
- SP element `107002215/pathId=-5003344262624947112` 的值为 1，`shareType=2/ShareAll`。
- 产品裁决后，Target 由米砂合法重击吸收事务显式绑定为该重击 owner 米砂；米砂先收到 SP，SP element 再将资源完整分享给后台英雄。`ShareAll` 只属于 SP 路由，不泛化为 HP heal、调谐强度或 30s 伤害 buff。

## 7. 星决与星携治疗

### 星决 `10700213`

- 五个独立 heal 事件：`143,155,167,181,193F`。
- heal `elementId=107002022/pathId=-3930384060379573910`，公式 104，等级值 `600..1260bp`，`directInjectTarget=3/AllHero`。
- 两个木印记 `550`：144F、150F，各 +1；它们位于第一段与第二段治疗之间。
- 135F 同帧按原 control 的 `skillTrackDatas` 数组顺序创建：
  1. 数组下标 20（内部 `trackIndex=23`）：3 个 HP `480042`，`pathId=5308513824935950819`
  2. 数组下标 21（内部 `trackIndex=24`）：3 个 SP `480041`，`pathId=-2302479272537638429`
- 两者 `life=15s`, `maxCount=6`, `countType=1/SummonId`。这解释了“不计入普通上限”：它们与普通 `SummonTempData` 池分离；并不表示星决池没有自己的 6 个上限。
- child collision 轨虽在创建后 2F 开启，但产品裁决明确禁止把它解释为冻结场景中的自动收取；135F 生成物留在场景，只有后续米砂重击 70F 吸收事件才会结算奖励。

### 星携 `10700222`

- heal `elementId=107002240/pathId=3069733526995086666`。
- 四个独立事件：`46,61,79,98F`。
- 公式 104，等级值 `200..420bp`，`directInjectTarget=3/AllHero`。

只有这里的显式 `AllHero` 可直接实现为团队治疗；不要拿它反推 HP 拾取物也是 AllHero。

## 8. 生成物生命周期、重击吸收、调谐强度与零距离边界

### R2 产品裁决与旧结论 failure-to-pass

旧 S1 把 `projectile.targetDistance=0`、物件图的最近友方定位和 child collision +2F 合并为“零距离自动拾取可达”。该 trace 会在无重击时于 `spawn+2F` 立刻发 HP/SP/调谐奖励，现已由用户产品裁决明确推翻。距离 0 只约束米砂与 Boss 的固定距离及投射物立即命中；角色、召唤物、生成物均无隐式移动。`autoCollect` 默认和本场景显式值都为 `false`。

原 collision 轨仍作为 child 图来源保留，但不再是产品收取触发。无重击时实体从 spawn 留存到 15s 自然过期，奖励始终为 0；切换当前受控角色也不能收取。

### 重击吸收来源与准确时序

- 指引表 `lang_guide_pic.json`：重击聚拢召唤物和敌人，并“吸收所有召唤物恢复生命和星决蓄能”。`lang_words.json`：长按普攻使用重击，吸收周围召唤物。
- 唯一产品重击 control 为 `10700210/sub0`，`subSkillUniqueId=17340006214530000`。
- `skillTrackDatas[15]` 指向 parent `pathId=4813059941072756916`，`trackIndex=92`，轨道“元素(自己”，窗口 `[70,71)F`；behavior `pathId=3637962353715634356` 在 70F Self 注入 `elementDataList=-2816437001102957180`。
- 该 path 对应 `107002233`：`displacementType=2,targetType=2,entityFilterData=64,radius=9`，即召唤物侧聚拢/吸收来源。
- 同帧下一条 `skillTrackDatas[16]` 才是 `107002230`（parent `492007593651855540`、behavior `5068420164240990388`，`targetType=1,entityFilterData=18752,radius=12`）的敌方聚拢。稳定来源顺序为召唤物侧 15 -> 敌方侧 16。
- 70F 是独立的 Self element track；重击 damage hit 在 48/51/63/69/76/83/90F。故吸收 gate 是“重击成功 execute”，不是 `damage landed`：所有 hit miss 仍在 70F 吸收；blocked/未执行重击不产生吸收尝试。

### 实体和同帧合同

- 战场物件 480041/480042 与原 pool、15s=900F、max6、`SummonTempData`/`SummonId` 分池证据不变。
- 每个实体仅奖励一次；已吸收/已过期实体不可重复。一次重击吸收当刻所有属于该米砂、列入 binding 且仍 live 的实体，按 `sourceOrder -> entityId` 稳定逐个结算。
- exact `spawn+900F` 先自然过期，再处理吸收。
- 同帧 spawn/absorb 的客户端细序未得到直接来源；R2 最窄 fail-closed 合同为 `exclude-same-frame-spawn`，该实体留存到后续重击或过期，不依赖队列插入偶然性。
- 普通池和星决 `SummonId` 池继续分离；满池 replacement 未证，仍 `reject-new-conservative`。

### reward、marker 与调谐强度

- 合法吸收者固定为触发重击的 source owner 米砂，不读取当前前台 actor；其他角色重击、普通攻击、星鸣、星决、星携和切人都不能劫持实体。
- HP 生成物按 formula104 使用米砂 MAXHP×3%，仅注入该吸收 Target 米砂；不是 AllHero。
- SP 生成物对米砂 direct +1，再按 raw `shareType=2/ShareAll` 分享后台英雄。
- `107002271` 永久 marker 与公式1006 gate 不变；每个成功吸收实体独立尝试注入 `480041002`：+600bp、24s、max4、Overlying。满层继续 `ignore-new/no-refresh` conservative policy；层区间右开。

### 零距离被动 Boss 可达性

生成机制本身 required 且可创建实体；收取可达性只来自玩家主动执行米砂重击，不来自 Boss、距离 0 或物件自动移动。Boss 静止不攻击不妨碍重击，但“零距离且不操作”必须保持实体与零奖励。

## 9. 证据冲突与未闭合项

| 主题 | 高优先级来源 | 低优先级冲突 | 本次下发规则 |
|---|---|---|---|
| 星鸣 CD | `skillsub_logic=24000ms` | public projection 12000ms | runtime 24000ms |
| 星决 CD | `skillsub_logic=0ms`, SP=100 | public projection 30000ms | runtime 0ms + SP gate |
| HP 生成物治疗路由 | reward Target，无 ShareAll/AllHero；重击 owner 吸收 | 文本“全队” | 只给吸收者米砂 |
| 调谐强度路由 | reward Target，无 ShareAll/AllHero；重击 owner 吸收 | 文本“全队” | 只给吸收者米砂 |
| 30s 元素伤害 buff | raw executeTarget=Source | 文本“全队” | 只给 Source；待 trace 升级 |
| 星鸣后段 | action 映射 `10700226/sub0` | `10700212/sub1` 存在 28F alternate | 不混入主 action |
| 第七拾取物 | 只证明 cap=6 | replacement 未知 | 保守 reject-new |
| 第五调谐层 | 只证明 cap=4/Overlying | replacement/refresh 未知 | 保守 ignore-new/no-refresh |
| 零距离自动收取 | 用户裁决 no implicit movement + 10700210 70F 吸收轨 | 旧 S1 `spawn+2F` collision 推断 | 旧 trace failure-to-pass；仅重击吸收 |

未闭合项不允许被“合理猜测”转成 verified。A5、完整普攻排程、隐藏团队传播、满池替换和满层刷新都必须继续保持 unresolved。

## 10. 现有 primitive 审计

> 时点说明：本节记录 `b900801` 证据验收时对当时 production 基线的缺口审计，不回写成事后来源。S1 已实现的通用 primitive、仍保守关闭的边界与验收结果，以 `mechanism-contract.json` 和 `IMPLEMENTATION_RESULT.md` 为准。

### 可复用

- compiler 的 action/effect/resource binding 与 `targetStateTransactions.requiresHitElementId`。
- `verifiedTargetStateRuntime.js` + `effectRuntimeTimeline.js` 的 hit-confirmed state、Cover/expiry 时间线。
- `verifiedTuningMarkGeneration.js` 的印记获取、优先消费、overlimit 与层过期框架。
- `verifiedBattleEffectGeneration.js` / `verifiedCombatRuntime.js` 的 direct event、Target/AllHero 目标展开、SP/HP event 与 heal-up modifier 框架。
- `actionCooldownEvaluation.js` / `actionExecutionPlan.js` 的 cooldown/resource gate。

### R2 通用 primitive 结论

1. 复用 S1 entity ledger 的 pool/cap/expiry/稳定 identity；新增通用 `pickupAbsorbBindings`，角色 ID、control、帧和 profile 列表只在 recipe。
2. 新增 owner-action absorb 事务：`successful-action-execute` gate、固定 action owner、全 live 列表吸收、一次奖励、稳定实体序。
3. scheduler 固定 `expiry -> spawn -> absorb`，并用显式 `exclude-same-frame-spawn-fail-closed` 过滤避免数组偶然性。
4. formula104、HP Target、SP ShareAll、调谐层 effect 继续复用 S1 已实现 primitive；R2 只改变领取触发和 collector 解析，不改变数值路由。
5. collision ledger API 仅保留为通用显式碰撞能力和原始 child 来源验证；默认 policy 不再排队 collision，且缺少显式 pickup distance 时不得从 projectile distance 回退。

## 11. 并行集成冲突面

本批没有可复用的动态 worktree 快照；以下仅是由实际 R2 diff 得到的静态语义冲突面，中央集成前必须重新读取米蒂/107001/102001 分支状态：

- compiler/profile：`character-combat-contract-compiler.mjs`、`character-combat-profile-pipeline.mjs`、`character-combat-golden-runtime.mjs`。
- scenario/Workbench：`optimization-scenario-policy-source.mjs`、`combatScenario.js`、Machine Axis schema/contract/service/adapter。
- acceptance：`generate-character-acceptance.mjs` 及 owner-only acceptance overlay。
- runtime：`verifiedPickupEntityGeneration.js` 的通用声明式 absorb primitive。

角色唯一 recipe、fixture、owner contract/profile 与 `reports/m10/107002/**` 通常不产生路径级冲突；共享文件必须按 primitive 语义合并，不能用任一角色分支整文件覆盖。全局 mechanics package、catalog、qualification/binding/summary 和 character-acceptance index/summary 一律由中央合并后统一重生成。
