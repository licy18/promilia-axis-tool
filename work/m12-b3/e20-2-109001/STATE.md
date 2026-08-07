# E20-2-109001 末音 验收状态

更新：2026-08-07（全量机制矩阵 v1）

## 目标

109001 末音：`extracted -> runtime-integrated -> visually-accepted -> optimization-ready`，独立提交并产品签收。

## 管线要求（已确认）

- 战斗 profile recipe：`scripts/character-combat/profile-recipes/109001.json`
  - mechanicsDiscovery：normalAttack=10900101、重击=10900110、星鸣=10900112、星决=10900113、星携=10900121（203 槽）、极限反击=10900125、完美招架=10900127、被动=10900161/10900162，以及元素资源 ID（待发现）
  - compiler：reachableControlSkillIds / publicActionDeclarations / publicActionForms / attackInputChains / variantWindowBindings / actionEffectBindings / actionHitBindings / specialResources / thresholdTransitions / passiveEffects
  - goldenScenario + expected（golden runtime 输入）
- 编译输出：`character-combat-profiles/109001.json`、`character-combat-owner-contracts/109001.json`、`reports/m10/109001/*`
- 验收：`scripts/character-acceptance/acceptance-recipes/109001.json` + fixture + 截图 + `reports/m11-d-character-acceptance-109001-desktop.png`
- 成熟度门：runtime-integrated=profile 有效+golden 全过+headless 稳定；visually-accepted=+workbench 往返+产品签收；optimization-ready=+矩阵全绿+零阻断账本

## 当前进度

- [x] 确认 109001 槽位/技能结构（hero module）
- [x] recipe 编写（mechanicsDiscovery + reachable + 120s golden；publicActionForms 空，避免覆盖自动时序）
- [x] 编译迭代（profile valid / runtime-applied / partial，golden 通过）
- [x] acceptance manifest（runtime-integrated，4/4）
- [x] 截图与验收 recipe（productVisualAcceptance pending）
- [ ] 视觉验收 + 产品签收（待用户）
- [ ] 时序窗口验证（星鸣/重击/闪击等当前未验证占位）→ optimization-ready
- [ ] 验收矩阵全绿 + 阻断账本清零 → optimization-ready

## 最终结果（本轮）

- 109001 `extracted -> runtime-integrated`；资格缺口 23->22；`m12cLocked` true
- verified 包 hash `79f8e8df…`；FROZEN verifiedMechanics `9b44e1f9…`
- 全套 Vitest 单独全过；审计/构建 clean
- 提交：9f1d37ae（基础闭合，**未验收**）

## E20 验收规则（2026-08-07 用户确认）

每个角色必须把全部机制完全拆解并还原后才能验收（任何签收均以此为前提）；用户只举了部分例子，其余机制（璀璨普攻变体等）需自行全量补齐。109001 当前 runtime-integrated 仅是中间状态，不得作为验收结论。

## 全量机制矩阵 v1（2026-08-07，客户端数据+技能文案交叉核对）

来源：`battle-element-assets.jsonl`（342 个 109001* 元素）、`skill_control_109001*.asset` 行为轨、`workbench-seed.json` 技能文案、`hero-module 109001`。

| # | 机制 | 客户端落点 | 当前状态 |
|---|---|---|---|
| M1 | 璀璨状态 8s（晶石buff） | 109001270；极限反击 10900125@31F、追击 10900143@10F、普攻控制 10900101 sub1@0F（璀璨普攻形态自续） | 已接入 targetStateProfile/Transaction（R1） |
| M2 | 二段星鸣追击 | 星鸣 10900112[40,77) 与星携 10900121[108,145) → 10900143；追击后可衔接普攻4（10900143→10900104） | variantWindow 已接入（R1）；普攻4衔接待 golden 覆盖 |
| M3 | 追击伤害+璀璨+超限 | 109001302 hit1~3（13/18/23F）、109001270、109001359 消耗1雷 | conditionalHitGroup 已接入（R1）；运行时消费已激活（R2，待重编译） |
| M4 | 普攻 A5 得 2 雷印记 | 10900105@47F → 109001049 注入 250×2 | actionEffectBinding 已接入（R1） |
| M5 | 璀璨下普攻4可耗 1 雷超限 | 10900104@29F → 109001362 判断 + 296 overdrive 伤害 | conditionalHitGroup 已接入（R1）；运行时消费已激活（R2，待重编译） |
| M6 | 璀璨普攻变体（晶石形态） | 10900101 sub1（playerSkillId 109001011，230F）@0F 注入 109001270；晶石攻击 109001122-124/318/325；晶石注入 109001282-284 | 控制/变体存在，输入选择语义待还原（变体窗/形态选择证据） |
| M7 | 重击：有雷印记每击 +1 星决蓄能 | 10900110 重击检测雷残响 109001286（@5/20/60F，elementArr 250）+ 重击检测回能量 109001287 | 未接入（judgment-condition-runtime-unimplemented / nested） |
| M8 | 重击注入雷残响 | 109001232/240（201） | 未接入（残响资源/注入） |
| M9 | 星鸣技 2 次充能 | skillsub_logic cooldownCount=2 | 待核对 machine-axis 充能语义 |
| M10 | E技能（星鸣）3 雷印记升级命中 | 109001345/347 检测 [250,250,250] → 109001346/348 雷残响60层 hit | 未接入（检测条件运行时） |
| M11 | E技能（星鸣）3 风残响暴击 buff | 109001351 检测 [701,701,701] → 109001352/353（暴击 +3%/8s） | 未接入 |
| M12 | 星决技@0F 减星鸣 CD | 109001171 减少CD（-20） | 效果已 applied 但运行时无 cooldownReduction 消费 |
| M13 | 星决技@183F 消耗 3 雷+3 风超限 | 109001360/361 消耗判断 → 296/796 overdrive 伤害、799 风 inject、793 回能 | 消耗契约已激活（R2，待重编译）；793/796 嵌套/回能仍缺口 |
| M14 | 星决技大伤害 | 109001173 必杀技-大伤害 | 待核对 hit 绑定 |
| M15 | 必杀注入雷/风残响 | 109001289（201）/109001354（701） | 未接入（残响资源/注入） |
| M16 | 星携入场技：1 雷印记升级命中 | 109001355/357 检测 [250] → 109001356/358 | 未接入（检测条件运行时） |
| M17 | 极限反击附加璀璨 | 10900125@31F → 109001270 | targetStateTransaction 已接入（R1） |
| M18 | 完美招架：璀璨下可耗 1 雷超限 | 10900127 反击链（10900149 弹反 + 109001362 判断 + 296） | 10900149 的 conditionalHit 已接入（R1）；10900127 链路待核对 |
| M19 | 被动1：超限伤害 +54% | 10900161@0F 直接注入 109001316（attr21 +5400，defaultPropertyTags[307] Overdrive） | 效果已编译 applied；运行时需 Overdrive tag 307 命中路径 + 被动持久生成 |
| M20 | 被动1：暴击率 +3% | 109001296/297/298（孤儿子树，hero-module level 文案确认） | 未接入（需产品声明/证据登记） |
| M21 | 被动2：璀璨下普攻3/5/重击 +1 星决蓄能 | 109001299/300/301（孤儿子树，hero-module 文案确认） | 未接入（需产品声明 + 星决蓄能资源） |
| M22 | 资源：雷/风调谐印记 | 250/750（max 3） | 调谐资源曲线已存在；消耗已激活（R2） |
| M23 | 资源：雷/风残响 | 201/701 | 未接入资源曲线/事务 |
| M24 | 资源：星决蓄能 | 星决技阈值资源（重击/被动2 累积，星决技消费） | 未接入 |
| M25 | 星决技资源门槛 | 星决蓄能 100 触发/消费语义 | 未核对（技能文案：星决技消耗星决蓄能） |

### 待办顺序（先易后难）

1. 重跑 sync-verified-combat + sync-character-combat，确认 R2 消耗契约基线（账本 30→26 等）。
2. M19+M20 被动1：Overdrive tag 307 命中路径 + 持久被动生成（attr21+5400 tags[307]、attr7+300）。
3. M24+M21 星决蓄能资源 + 被动2 事务（A3/A5/重击 @璀璨 +1）。
4. M7 重击检测回能（有 250 印记时 +1 星决蓄能）。
5. M12 减CD 运行时消费（109001171/241/281/293/295）。
6. M10/M11/M16/M18 检测条件门控（3 雷印记、3 风残响、1 雷印记、璀璨）。
7. M6 璀璨普攻变体选择语义；M8/M15/M23 残响注入与曲线。
8. Golden 覆盖全部机制 → 重编译/全量测试/哈希/提交。

## 109001 机制拆解（已从客户端数据确认）

| 机制 | 客户端落点 |
|---|---|
| 璀璨状态 8s | buff 109001270「晶石buff」；由极限反击 10900125@31F、二段星鸣追击 10900143@10-23F 附加 |
| 二段星鸣追击 | 星鸣 10900112 追击输入窗（40..77F/60..248F bridge=3）→ 10900143（109001302 追击 hit1~3 + 璀璨） |
| 大招减 CD | 星决 10900113@0F → 109001171「减少CD」 |
| 大招消耗印记超限 | 星决 10900113@183F → 109001360 至多3雷 + 109001361 至多3风 + 109001173 大伤害；雷 overdrive 296/风 overdrive 793-799 |
| 印记/残响注入 | A5 109001049/221、普攻3 109001206、重击 109001232/240/286、晶石变体 109001282-284、必杀 109001289/354 |
| overdrive 触发/增伤 | 109001314 触发判断、109001316 超限+54%（被动1）、109001345-348 E技能检测、109001355-358 入场检测 |
| 被动2 蓄能 | 109001299/300/301：璀璨下普攻3/5/重击每击 +1 星决蓄能 |

## R1 实现计划（进行中）

1. specialResources：雷/风调谐印记（max 3）、星决蓄能；resourceTransactions 注入/消耗
2. targetStateProfile/transaction：璀璨 109001270（8s）
3. variantWindowBinding：10900112 追击窗 -> 10900143
4. actionEffectBinding：10900113@0F 减CD；10900113@183F 消耗印记+超限
5. passiveEffects：10900161/10900162
6. golden 扩展覆盖机制 -> 重编译/验收/测试/提交

## R1 进度（2026-08-07 已编译验证）

- 编译器扩展：targetStateProfile 支持容量声明（combineNumber=-1 的 buff 元素可用 expectedMaxStacks 覆盖）
- 已进入 109001 owner contract（全部 applied）：
  - targetStateProfiles：璀璨 109001270（8000ms / 1 层 / self）
  - targetStateTransactions：极限反击@31F、追击@10F 附加璀璨
  - variantWindowBindings：星鸣追击 10900112[40,77)->10900143、星携追击 10900121[108,145)->10900143
  - actionEffectBindings：A5@47F +2 雷调谐（250）
  - conditionalHitGroups×2 + actionHitBindings×2：A4 璀璨超限（10900104@29F 消耗1雷）、追击超限（10900143@13/18/23F 消耗1雷）
  - hitCount 74->78；runtime coverage targetState/conditional 从 0 变 1/2
- 101003 golden 全局 targetStateSummary.profileCount 1->2 同步

## R1-R2 进度（2026-08-07 消耗机制激活）

- 运行时/同步扩展：消耗判断元素（judgment + consume=1 + elementArr 标记）解析到调谐档案（250/750），构建自包含消耗契约（自身层数 min/max + 候选包），无 inject 配对时不再依赖祖先 inject；判断节点维度 applied。
- 效果：109001 A4（109001362）、二段追击（109001359）、大招雷（109001360 max3）、大招风（799 inject + 109001361 max3）全部 consume-bound applied；缺口账本 30->26，judgment-condition-runtime-unimplemented 从多条降到 1（非消耗判断）。
- 全局影响：该机制同样激活了其他角色的调谐消耗（101010/103002），101010 golden 按新实际值重基线 7 条（damageEventCount 423->522、ownerHitTotalHpDamage 9992->9822、ownerHitTotalToughnessDamage 1766->1093 等）；owner 编译与全部 golden 通过。
- 剩余：被动 10900161/62、大招减CD（109001171 运行时消费路径）、SubSkill 注入证据（effect-trigger-frame-missing）、golden 覆盖扩展、全量发布/验收/测试/提交。

## R1 剩余（真实缺口，未伪造）

- 运行时缺口（judgment-condition-runtime-unimplemented / tuning-consume-current-packet-not-in-candidate-map / effect-trigger-frame-missing）：
  - 消耗类元素（109001359/360/361/362）的 consume 判定运行时不消费
  - SubSkill 资产注入（普攻3/重击等）无 trigger frame 证据（需导出 Program/.../SubSkill 资产）
  - 大招减CD（109001171@0F）运行时不处理
- passiveEffects 10900161/62 未接入
- golden 尚未覆盖璀璨/追击/印记/超限（需 attackInputChains 支持 A1-A5 + 极限反击 + 追击动作）
- 全量发布/验收/测试/提交待机制闭合后执行

## R3 进度（2026-08-07，被动1 + Overdrive tag 307 已闭合）

### 已实现

- **被动1（10900161 哈库茵之耀）持久化运行时**：新增编译器模式 `persistent-property-runtime`（`character-combat-contract-compiler.mjs`），从被动控制直接注入的元素推导 modifiers，并在 variant runtime 战前（timeMs=0）生成持久效果命令。10900161 编译为 attr21 +5400（tags[307]，超限伤害+54%）+ attr7 +300（暴击率+3%，hero-module level 文案 + ast_109001296 证据）。
- **Overdrive property tag 307 命中路径**：`verifiedTuningMarkGeneration` 为 overlimit-* 战斗事件写入 `eventContext.propertyTags=[307]`；`verifiedDamageEventGeneration` 对 tuning 事务取“事件自带 tags ∪ 技能 tag 解析结果”（保留星鸣/星决等技能 tag，避免破坏 10123/10150 等灵魂加成）；`verifiedCombatRuntime` 超限结算按该 tags 应用 attr21 被动乘区。
- **验收/哈希基线同步**：新包 hash `c87fb71b…`（file sha `e7b18d90…`）；FROZEN verifiedMechanics 更新；9 个 machine-axis/character-acceptance fixture、m11 integrated baseline、cycle acceptance report、dynamic-loadout acceptance report、全套单测期望（migration/pipeline/ruby/han/tuning/coverage/package/workbench/canonicalTraceView）按新实际值重基线。
- **109001 临界矩阵适配**：被动暴击使 109001 暴击阈值 500→800；fixture sampled 捕获 roll 改 799/800，`inspectCriticalMatrix` 按 owner 边界（109001=799/800，其余 499/500）校验。

### 验证

- 新增 2 组单测：variant runtime 战前被动命令（attr21/attr7 modifiers）；tuning 事件 propertyTags=[307] 且事务保留技能 tag 并集。
- 全套 Vitest 1443/1445（仅 2 条已知 process-heavy `setThreeSourceIdentityEvidence` 并行超时，单独 4/4 通过）；11 项审计 clean；production build 待最终提交前复跑。
- 109001 回到 `runtime-integrated`（4/4）；资格缺口 22、`m12cLocked` true。

### 下一阶段（按先易后难）

1. M24+M21：星决蓄能资源 + 被动2（璀璨下普攻3/5/重击 +1 星决蓄能）。
2. M7：重击检测回能（有雷印记每击 +1 星决蓄能）。
3. M12：大招减CD（109001171/241/281/293/295）运行时消费 + 星鸣技 2 充能语义。
4. M10/M11/M16：E技能/入场检测条件门控（3 雷印记、3 风残响、1 雷印记）。
5. M6/M8/M15/M23：璀璨普攻变体选择语义、残响注入与曲线。
6. Golden 覆盖全部机制 → 重编译/全量测试/哈希/提交。

### R3 阶段结论：星决蓄能 = 角色 SP 条（2026-08-07 核对）

`skillsub_logic[10900113]` 的 `spCost=100`，golden 场景 `initialActorSp[109001]=100`——星决技在现有管线中消费角色 SP（MAXSP=1，即 100 点满条）。技能文案的“星决蓄能”即该 SP 条，无需新建独立资源曲线：

- 重击检测回能 109001287（sp，functionParams[0]=10000）+ 判断 109001286（有雷印记 250）＝重击每击 +1 SP。
- 被动2 晶石回能 109001300（sp，functionParams[0]=10000）+ 判断 109001301（有璀璨 109001270）＝璀璨下普攻3/5/重击 +1 SP。
- 两者当前阻断均为 `sp-formula-not-literal-function-5`（formula function 1007 包/判断门控，非字面 function 5）；实现方向＝sync 编译器把“判断门控的 direct-sp”按判断条件编译（复用 consume-judgment 模式），运行时在 250/109001270 条件满足时发 directSp +1。

## R4 进度（2026-08-08，被动2 + 重击回能已闭合）

### 已实现

- **M21 被动2（10900162）**：新增 runtimeEffectBindings 触发类型 `action-frame-with-state`（compiler + target-state runtime）。璀璨（109001270）≥1 层时，普攻第三段（10900103@0F）、第五段（10900105@0F）、重击（10900110@0F）各发 +1 SP（109001300 直连 SP，raw 10000→1.0）。条件不满足时记录 `VERIFIED_RUNTIME_EFFECT_STATE_CONDITION_NOT_MET`，不伪造回能。
- **M7 重击回能**：sync 编译器为“判断门控 direct-SP”新增 `directSpPresence` 契约（judgmentType=1、elementArr=[250]、consume=0、成功分支 sp 子元素 → markId=250/minStacks=1/value=1.0）；tuningGeneration 在效果帧（重击 5/20/60F）按 250 印记层数门控，满足时发 `conditional-direct-sp` combat event；combat runtime 按 `tuning-conditional-direct-sp` 结算 +1 SP（每击）。
- **10900162 由无名第二被动转为已实现**：product-boundary 支持 `implementedPassiveSkillIds`（从 recipe passiveEffects/runtimeEffectBindings 推导）；10900162 不再归类 N/A，验收清单不再要求其保持 not-applicable；三个 passive2 绑定以 `acceptance-scenario-coverage-missing` 诚实登记（待场景覆盖后放行）。
- **哈希/期望重基线**：新包 hash `a47d98f5…`（file sha `632180f3…`）；fixtures/baseline/cycle/loadout 验收报告、FROZEN、migration/replay/package/coverage/workbench/canonicalTrace 单测期望全部同步。

### 验证

- 新增 2 组单测：variant runtime 璀璨门控 SP（极限反击→璀璨→重击 +1，无璀璨 0）；tuning runtime 印记门控 SP（250 印记下 3 次重击命中各 +1，无印记 0）。
- 全套 Vitest 1445/1447（仅 2 条已知 process-heavy 并行超时，单独通过）；11 项审计 clean；production build 通过；109001 保持 `runtime-integrated`（4/4）。

### 下一阶段

1. M12：大招减CD（109001171/241/281/293/295）+ 星鸣技 2 充能语义。
2. M10/M11/M16：E技能/入场检测门控（3 雷印记、3 风残响、1 雷印记 → 升级命中/暴击 buff）。
3. M6/M8/M15/M23：璀璨普攻变体选择语义、残响注入与曲线。
4. Golden/验收场景覆盖被动2/重击回能（消除 3 条 scenario-coverage 阻断）→ 全量测试/哈希/提交。

## R5 进度（2026-08-08，大招减CD + 星鸣充能重置已闭合）

### 已实现

- **M12 大招重置星鸣充能冷却**：`actionRuleDiagnostics` 新增冷却缩减事件收集（`collectCooldownReductionEvents`，从动作 resolution effects 读取 `cooldownReduction`，单位=秒，109001171 value=-20 → 20000ms）+ 按 owner/星鸣技能 ID 应用（`applyCooldownChargeReductions`，把最远未就绪的充能提前，clamp ≥0）。星鸣技本身 cooldownCount=2 来自 `skillsub_logic`，两个充能独立就绪。
- 未触碰其他 CD 元素（109001241/281/293/295 不在当前 profile 效果中，保持诚实未编译）。

### 验证

- 新增单测：3 次星鸣 + 1 次星决，第三次星鸣在星决后立即可用（`skill-cooldown-active` 0 条，readiness=ready）。
- 全套 Vitest 1446/1448（仅 2 条已知 process-heavy 并行超时，单独通过）；11 项审计 clean；build 通过。

### 下一阶段

1. M10/M11/M16：E技能/入场检测门控（3 雷印记、3 风残响、1 雷印记 → 升级命中/暴击 buff）。
2. M6/M8/M15/M23：璀璨普攻变体选择语义、残响注入与曲线。
3. Golden/验收场景覆盖被动2/重击回能/大招重置（消除 scenario-coverage 阻断）→ 全量测试/哈希/提交。

## R6 分析（2026-08-08，检测门控/招架/残响接线核对）

### M10/M11/M16：E技能/入场检测元素为客户端孤儿（未接线）

- 109001345/346/347/348/351/352/353/355/356/357/358 在全部 `skill_control_109001*` 资源图中**无任何引用边**（全量扫描 0 命中）。
- 技能文案（涌雷动之跃/凝飓风之旋）**未描述** 3 雷印记升级命中、3 风残响暴击 buff、1 雷印记入场升级命中。
- 处置：按“客户端未接线 + 文案未描述”登记，不建模为产品行为（与 hero_rank/500081044 同口径）。不会产生 ledger 阻断（元素不在任何 control effects 中）。

### M18：完美招架璀璨超限未进入 action resolution

- 10900149（弹反链：109001362 消耗1雷 + 296 overdrive）已编译 applied，但完美招架 action mapping 只解析 control 10900127（基础反击），**未链入 10900149**；实测完美招架+1雷印记无 overlimit。
- 需补：perfect-parry 派生链（10900127 → 10900149 反击执行）接入 action resolution（参考 10101049 小玉完美招架反击的 derived-control 接线）。

### 下一步（按依赖）

1. M18：完美招架派生链接线 + 璀璨超限单测。
2. M6：10900101 sub1（璀璨普攻变体）选择语义核对/接线。
3. M8/M15/M23：残响（201/701）注入与曲线（需确认残响是否仅为内部状态，不进三值）。
4. Golden/验收场景覆盖 M7/M21/M12/M18 → 消除 scenario-coverage 阻断 → 全量测试/哈希/提交。

## R7 进度（2026-08-08，M18 完美招架弹反链已闭合）

### 已实现

- **M18 完美招架璀璨超限**：sync 构建新增 `applyHeroParryRuntimeChainMerge`，把 10900149/sub1 弹反链的 applied 效果（109001362 消耗1雷判断，带 tuningOverlimit）并入完美招架公开控制 10900127/sub0；完美招架 action resolution 现在同时携带基础反击与弹反超限链。实测：完美招架 + 1 雷印记 → 29F（483ms）消耗印记并触发雷 overlimit 伤害。
- 新增单测：`fires a thunder overlimit on perfect parry when a mark is held`（consume 1→0 + overlimit-damage@483ms）。
- 包 hash `44ddb7ef…`（file sha `f2065b2e…`）；fixtures/baseline/cycle/loadout 验收报告、FROZEN、replay/migration/package/coverage/workbench/canonicalTrace 单测期望全部重基线。

### 验证

- 全套 Vitest 1447/1449（仅 2 条已知 process-heavy 并行超时，单独通过）；11 项审计 clean；build 通过。

### 已知细化项（记录，不阻塞）

- 弹反链的“璀璨”门控：当前 consume 仅检查雷印记存在，未检查璀璨状态；A4 条件组同款语义待统一核对（跨 target-state/tuning 两系统的状态门控）。

### 下一步

1. M6：10900101 sub1（璀璨普攻变体）选择语义核对/接线。
2. M8/M15/M23：残响（201/701）注入与曲线。
3. Golden/验收场景覆盖 M7/M21/M12/M18 → 消除 scenario-coverage 阻断 → 全量测试/哈希/提交。

## R9 进度（2026-08-08，golden 机制覆盖 + 消耗语义修正已闭合）

### 已实现

- **golden 覆盖全部已还原机制**：109001 golden 场景扩为 8 动作（星决→星鸣→A5→极限反击→重击→完美招架→星鸣×2），断言：8 动作全部执行（M12 第三次星鸣不被充能阻断）、完美招架消耗 1 雷印记（M18）、重击 SP 总变化 >3（M7×3+M21×1）、总伤害>0。golden runtime 新增 `initialTuningMarks` 播种与 `tuningMarkConsumeByActionId` 投影；normal-attack 分段时长回退到 attackInputSegments。
- **消耗语义修正**：`applyMarkConsumption` 的默认消耗量改为 `maximum ?? minimum`（consumeLayerMaxNum 缺省=0 时只消耗 consumeLayerNum=1 层），修复 109001362 类判断在持有 2 层时误耗全部的问题（A4/追击/招架同族修正）。
- 包 hash `b9a2b9a4…`（file sha `b0f108ca…`）；fixtures/baseline/cycle/loadout 验收报告、FROZEN、migration/replay/package/coverage/workbench/canonicalTrace 单测期望全部重基线；功能阻断 1204→1197（golden 覆盖生效）。

### 验证

- 全套 Vitest 1445/1449（仅 4 条已知 process-heavy 并行超时，单独通过）；11 项审计 clean；build 通过。

### 下一步

1. M6：10900101 sub1（璀璨普攻变体）选择语义（待产品确认）。
2. M8/M15/M23：残响（201/701）登记为客户端未接线中间状态（与 M10/M11/M16 同口径）。
3. 待产品确认后走 M12-C 前置验收（视觉签收/optimization-ready）。

## R8 分析（2026-08-08，M6 璀璨普攻变体核对）

### 现状

- 普攻控制 10900101 有两个变体：sub0（playerSkillId 10900101，270F，A1 命中 109001081/109001306@12/13F）与 sub1（playerSkillId 109001011，230F，@0F 注入 109001270 晶石buff；hits 引用 109001251 极限反击hit1~3 @12/13/16/19F）。
- 当前 machine axis 普攻链（A1-A5）只选 sub0；没有任何 variant edge / attack input chain 在璀璨下选择 sub1。
- sub1 的 hits 引用 109001251（极限反击元素），语义与“璀璨普攻变体”文案不直接对应，疑似极限反击后的普攻形态或未完成的客户端变体。
- A4 璀璨超限（109001135 hit + 109001362 消耗）已通过 conditionalHitGroup 接通（R1），这是“璀璨下普攻变体”已还原的部分。

### 处置

- M6 的“璀璨普攻变体选择语义”登记为待产品/实机确认项：需要明确 10900101 sub1 是否确为璀璨普攻形态、其触发条件与命中选择；当前不猜测接线。
- 不阻塞已有验收（A4 超限、追击衔接普攻4 已生效）；等待用户/产品给出 sub1 语义后接线。

## 关键事实

- 109001 末音：element=4（雷），position 详见 characters.json；普攻=10900101 哈库茵剑舞、星鸣=10900112 涌雷动之跃、星决=10900113 绽华章之舞、星携=10900121 凝飓风之旋（203 入场型）、被动=10900161 哈库茵之耀 + 10900162 无名第二被动（按 10101062/10300262 先例 N/A）
- 参考模板：103002（红宝石）recipe 已复制到 `reference-103002.json`
- SkillList 资产可读：`skill_control_109001XX.asset/MonoBehaviour/*.json`（skillControlData 1 份 + behaviorlineControl 多份）

## 坑

- 顶层 `skill_control_<id>.json` 不存在；可读 JSON 在 `<id>.asset/MonoBehaviour/` 子目录，且多数文件是行为切片，只有一份含 skillControlData
