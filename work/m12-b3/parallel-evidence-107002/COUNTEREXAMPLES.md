# 107002 米砂：正负例与边界反例设计

## 1. 使用约定

每个 case 都是后续实现的聚焦测试规格，不是本支线已运行的生产测试。默认场景均为 `m12c-zero-distance-passive-boss-v1`；另有说明时才改变角色层数、命中结果或时间。

统一断言：

- 时间区间右开：`[start,end)`。
- 同帧按序列化 element list、track order、entity source order 执行。
- miss 的 hit-bound 子事务全部回滚；不能只取消 damage 却仍造拾取物/加 debuff/消费印记。
- `Target`、SP `ShareAll`、`AllHero` 是三条独立路由。
- 标注 `conservative-policy` 的期望是 fail-closed 实现约束，不冒充已证客户端行为。

## 2. action / control / resource / cooldown

| ID | 面 | 前置与输入 | 期望 | 反例意图 |
|---|---|---|---|---|
| `ACT-P-01` | action | charged，hold 满 250ms，CD ready | action 启动，occupancy 330F，安排 48/51/63/69/76/83/90F hit | 证明 hold 与排程正例 |
| `ACT-N-01` | action | charged，hold 249ms | 不启动 charged，不提交任何 hit/debuff | 防止按键按下即误触发 |
| `ACT-P-02` | action | star，`nowMs == readyAtMs` | 启动，CD 写入 `now+24000` | CD 左闭正例 |
| `ACT-N-02` | cooldown | star，`nowMs == readyAtMs-1` | 拒绝，不能生成 hit/拾取/consume | CD 右侧未到的负例 |
| `ACT-N-03` | cooldown source | public 值 12000ms 已到，runtime 24000ms 未到 | 仍拒绝 | 防止 public CD 覆盖 runtime |
| `ACT-P-03` | resource | ultimate，SP=100 | 扣 100 并启动；CD 0ms | 精确资源边界 |
| `ACT-N-04` | resource | ultimate，SP=99 | 拒绝；SP 不变；无 135F spawn/143F heal | 资源不足事务原子性 |
| `ACT-P-04` | cooldown source | ultimate 刚完成、SP 又达到 100 | 不受 public 30000ms CD 阻挡 | runtime CD=0 |
| `ACT-P-05` | action mapping | star 后段选择 | 只选择 `10700226/sub0` | 实际映射正例 |
| `ACT-N-05` | control alternate | 存在 `10700212/sub1` 28F seed | 不把 28F seed 并入主 star timeline | 防止 alternate 双算 |
| `ACT-N-06` | unresolved | 生成完整普攻循环 | A5 unresolved 时不得标 ready，不得用 generic fallback 声称已闭合 | 防止 A5 缺口被吞掉 |

## 3. hit 与拾取物创建

| ID | 前置与输入 | 期望 | 反例意图 |
|---|---|---|---|
| `HIT-P-01` | A3 的 40F hit 成功 | damage/energy 后请求 1 个 HP 480042 | qualifying hit 正例 |
| `HIT-N-01` | A3 的 40F miss | 无 damage、energy、summon | miss 全事务负例 |
| `HIT-P-02` | A3 的 40/46/52/58/64/70F 全命中 | 成功请求 6 个普通 HP entity | 六个创建帧 |
| `HIT-N-02` | A3 的 76/82/88/94/100F 命中 | 有 hit，但不创建 HP entity | 防止 11 hit 全造种子 |
| `HIT-N-03` | 普通 HP 池已有 6 个，再发生 qualifying hit | 第七请求 `capacity-rejected`，实体数仍 6，无幽灵 reward | `conservative-policy` 满池反例 |
| `HIT-P-03` | star 的 74/82/90/99F 命中 | 各请求 1 个 SP entity | 四个创建帧 |
| `HIT-N-04` | star 的 107/114F 命中 | 不创建 SP entity | 防止所有 hit 都造 SP |
| `HIT-N-05` | star 82F miss、90F hit | 82F 不 consume/buff/overlimit；90F +1 风并造 SP | 拆开两帧 gate |
| `HIT-N-06` | star 82F hit、90F miss | 82F 可 consume/buff/overlimit；90F 不加风、不造 SP | 反向拆帧 gate |
| `HIT-P-04` | ultimate 到 135F | `skillTrackDatas[20]` 的 HP×3 先于 `[21]` 的 SP×3；两类 `SummonId` 池分开 | 同帧 source array order |
| `HIT-N-07` | 普通 `SummonTempData` HP 池已满 6，ultimate 135F | ultimate HP `SummonId` 池仍可创建 3 | 防止跨 countType 混池 |

## 4. 生成物生命周期、重击吸收与零距离

设实体 `spawnFrame=100`、`expiresFrameExclusive=1000`。child collision open=102 仅是原图事实，不是默认 collection gate。

| ID | 输入 | 期望 | 反例意图 |
|---|---|---|---|
| `ABSORB-FAIL-OLD-01` | 距离0、无重击，旧 S1 trace | 旧实现会在 spawn+2F 自动奖励，R2 必须 failure-to-pass | 用户裁决推翻旧自动领取 |
| `ABSORB-N-01` | 距离0、无重击、一直不移动 | reward=0；实体留存到 frame1000 自然过期 | 0距离不等于 pickup 碰撞 |
| `ABSORB-N-02` | 普攻/星鸣/星决/星携执行 | 只生成各自实体/效果，不产生 absorb attempt | 非重击不能吸收 |
| `ABSORB-N-03` | 其他角色重击或切换当前前台 actor | 不吸收米砂实体；collector 不被前台劫持 | owner binding |
| `ABSORB-P-01` | 米砂 `10700210/sub0` 成功 execute，到动作70F | 吸收当时所有 owner live、listed entities | 精确 control/subskill/frame |
| `ABSORB-P-02` | 重击所有 damage hit miss | 70F 仍吸收 | 独立 Self element track，不依赖 landed |
| `ABSORB-N-04` | 重击 blocked/未执行 | 无 absorb attempt、无 reward、实体不变 | execute gate |
| `ABSORB-P-03` | 普通池 HP/SP 与星决 `SummonId` HP/SP 同时 live | 按 sourceOrder/entityId 逐个各结算一次 | 跨池稳定全量吸收 |
| `ABSORB-N-05` | 同一实体后续再重击 | rewardCount 仍1；第二次 count0 | once-only |
| `ABSORB-N-06` | 无实体重击 | 留一条 eligible=0 attempt，不造幽灵 reward | 可审计 no-op |
| `ABSORB-N-07` | exact frame1000 重击 | 先过期，吸收数0 | 右开到期 |
| `ABSORB-N-08` | frame100 同帧 spawn+absorb | 新实体显式排除并留存 | fail-closed，不靠数组顺序 |
| `ABSORB-N-09` | 满池第七次 spawn 后重击 | 被拒绝请求无实体、无 reward；既有6个可吸收 | conservative capacity |

## 5. HP / SP / AllHero 路由

测试 roster：米砂 owner `M`、后台 `B1/B2`、可切为前台的友方 `A`。合法 collector 始终为执行来源重击的 `M`。

| ID | 输入 | 期望 | 明确不应发生 |
|---|---|---|---|
| `ROUTE-P-01` | A 当前前台，M 重击吸收 HP；M maxHP=10000 | 仅 M heal=300；A/B1/B2 不因该 reward 被 heal | collector 固定 M、不广播 |
| `ROUTE-N-01` | marker107002271 不存在，M 吸收 HP | M 仍 heal=300；不加调谐层 | marker 只 gate 被动，不 gate HP heal |
| `ROUTE-P-02` | M 有 marker，吸收 HP | M heal=300 且 M +1 调谐层 | reward list 两种效果都执行 |
| `ROUTE-P-03` | M 吸收 SP，roster M/B1/B2 | M +1，B1/B2 按 ShareAll +1 | SP 独有 ShareAll |
| `ROUTE-N-02` | M 吸收 HP 或获得调谐层 | A/B1/B2 不变化 | 禁止把 SP ShareAll 泛化 |
| `ROUTE-P-04` | ultimate 143F heal | M/B1/B2 各收到一个独立 AllHero heal event | 不是前台单收再 ShareAll |
| `ROUTE-P-05` | star-carry 四个 heal 帧 | 每帧 M/B1/B2 各有一个事件，共四批 | 不折叠为一次总治疗 |
| `ROUTE-N-03` | star 82F 有印记 | 30s 木/风伤 +5% 只施给 raw Source | 不因公示文本广播 roster |

## 6. mark consume / overlimit / 30s buff

| ID | 82F 前层数 | 82F 期望 | 90F 命中后 | 反例焦点 |
|---|---|---|---|---|
| `MARK-N-01` | 木0 风0 | 无 buff、无 consume、无 overlimit | 风1 | 90F 新层不能回填 82F |
| `MARK-P-01` | 木1 风0 | 先施 Source buff，再消费木，注入木 overlimit | 木0 风1 | 木单候选 |
| `MARK-P-02` | 木0 风1 | 先施 Source buff，再消费风，注入风 overlimit | 风1 | 风单候选；先消费再补回 |
| `MARK-P-03` | 木1 风1 | 优先消费木；风保留；注入木 overlimit | 木0 风2 | `[550,750]` 优先级 |
| `MARK-P-04` | 木层不足、风1 | 跳过不足木，选择风 | 风在 82F 变0，90F 变1 | insufficient fallback |
| `MARK-N-02` | 两者都不足 | no-consume/no-inject | 90F 独立处理 | 无候选 rule |
| `MARK-N-03` | 82F miss，木1 | 木仍1；无 buff/overlimit | 90F 命中则风+1 | miss 不得扣层 |
| `MARK-N-04` | 82F hit，90F miss，风1 | 风被消费、buff/overlimit 成功 | 仍风0 | miss 不得补风 |
| `MARK-P-05` | 风已5，82F 不消费，90F hit | 风仍5；SP entity 仍创建 | mark cap 不阻断同 list 后续 summon |

### 82F 同帧序列断言

`MARK-ORDER-01` 必须记录：damage -> energy -> availability judgment -> consuming judgment。成功候选的 consuming Execute 内必须记录：`CalculateConsumeCount -> CastPassiveSkill -> DoConsume -> DoInject`。

若实现先给 90F 风印记、再回头处理 82F consume，或者把 `DoInject` 放在 `DoConsume` 前，测试必须失败。

## 7. debuff 与 effect 顺序

| ID | 输入 | 期望 | 反例焦点 |
|---|---|---|---|
| `DEF-P-01` | A4 84F hit | 当前 hit 先按旧 DEF damage；之后物/法 DEF 各 -10% | 同帧先伤害后 debuff |
| `DEF-P-02` | A4 后续 90/96/102F hit | 按 debuffed DEF | 后续 hit 生效 |
| `DEF-N-01` | A4 84F miss | 不施 debuff；90F 若命中仍按原 DEF | requiresHit |
| `DEF-P-03` | charged 76F hit | 当前 hit 按旧 DEF；83/90F 按 debuffed DEF | charged 对应序列 |
| `DEF-N-02` | charged 76F miss | 无 debuff | charged miss |
| `DEF-P-04` | `applyMs+23999` | debuff active | 右边界前 |
| `DEF-N-03` | `applyMs+24000` | debuff inactive | 右开边界 |
| `DEF-P-05` | active 期间再次成功施加 | Cover 保持单实例，expiry 刷新到新 apply+24000 | 不叠 -20% |
| `DEF-N-04` | active 期间再次 miss | 不刷新 expiry | miss 不能续期 |

## 8. heal 多段、公式与顺序

| ID | 输入 | 期望 | 反例焦点 |
|---|---|---|---|
| `HEAL-P-01` | ultimate 完整 timeline | 143/155/167/181/193F 五次独立 AllHero heal | 多段不合并 |
| `HEAL-P-02` | ultimate 135F 生成物在 distance0、无后续重击 | 生成物不奖励；143F 才是第一段显式 AllHero heal | 防自动领取混入团队治疗 |
| `HEAL-P-03` | ultimate 144/150F | 每帧来源米砂 +1 木印记 | 与 heal 事件交错 |
| `HEAL-P-04` | star-carry | 46/61/79/98F 四次独立 AllHero heal | 星携多段 |
| `HEAL-P-05` | M maxHP=10000，HP pickup A=300 | 每个成功 reward 的 base heal=300，再进入既有 heal-up modifier/rounding | 通用公式104正例 |
| `HEAL-N-01` | HP collector 的 maxHP 与 M 不同 | heal 仍按来源 M 的 maxHP 3% | 防止用 Target maxHP |
| `HEAL-N-02` | HP 生成物未被合法重击吸收/已过期 | 不 heal、不加层、不 destroy（过期除外） | absorb gate 原子性 |
| `HEAL-N-03` | 公式104尚未接通，却把 raw A=300 当 heal=300 | 当 M maxHP≠10000 时测试失败；不得 literal-A fallback | 防止掩盖 `unsupported-1-104` |

## 9. 调谐强度层与右开边界

| ID | 输入 | 期望 | 证据状态 |
|---|---|---|---|
| `TUNE-P-01` | marker 有，首次合法吸收实体 | +600bp，expiry=`t+24000` | 源值已证 |
| `TUNE-P-02` | t0/t1/t2/t3 四个不同 entity | 四个独立层，总 +2400bp，各自 expiry | 独立层实现规格 |
| `TUNE-N-01` | marker 无 | 公式1006=0，不加层；主 reward 照常 | gate 已证 |
| `TUNE-N-02` | 同一 entity 后续重击再次吸收 | 不重复加层 | once-only |
| `TUNE-N-03` | 已4层，第五个 entity | ignore new，不刷新任何 expiry | `conservative-policy` |
| `TUNE-P-03` | 最早层 `expiry-1ms` | 仍有该层 | 右开前 |
| `TUNE-N-04` | 恰好最早层 `expiry` | 该层先过期 | 右开端点 |
| `TUNE-P-04` | 恰好 expiry 同刻合法重击吸收新实体 | 先过期，再成功添加新层；保持最多4层 | 同刻 phase order |
| `TUNE-P-05` | 一次重击吸收六 entity | source order 前4层成功，后2层 capacity-ignored | stable order + 保守 cap |

## 10. 30s buff / 24s层 / 15s实体的右开交叉例

| ID | 时间点 | 期望 |
|---|---|---|
| `TIME-P-01` | buff apply+29999ms | 木/风伤 +5% active |
| `TIME-N-01` | buff apply+30000ms | buff inactive |
| `TIME-P-02` | wind mark apply+19999ms | mark 可被 consume |
| `TIME-N-02` | wind mark apply+20000ms | mark 已过期，不能被 consume |
| `TIME-P-03` | pickup spawn+14999ms 且合法重击70F触发 | 可吸收 |
| `TIME-N-03` | pickup spawn+15000ms 同刻触发 | 已先过期，不可吸收 |
| `TIME-P-04` | tuning layer expiry 与吸收新 entity 同毫秒 | 先 expire，再 apply 新层 |

## 11. scenario-out-of-scope N/A 反例

| ID | 输入 | 期望 |
|---|---|---|
| `NA-P-01` | 构造 frozen optimizer action set | 不包含 10700215/11/25/27；每项都有 `scenario-out-of-scope` 原因 |
| `NA-N-01` | Boss 不攻击，却尝试极限反击/完美格挡 | 无可达 action；不得伪造 Boss attack event |
| `NA-N-02` | 因 N/A 删除其 source ledger | 测试失败；N/A 必须保留 control/source 身份 |
| `NA-N-03` | 用专注闪避的 DEF debuff 补齐 required DEF 机制 | 测试失败；required 只用 A4/charged，专注闪避保持 N/A |

## 12. 最小聚焦测试文件建议

集成实现建议新增或扩展以下聚焦测试，不运行 `test:full`：

- pickup entity ledger：创建/池/cap/lifecycle/duplicate/right-open
- pickup reward routing：Target/ShareAll/AllHero 分离
- target state runtime：hit-confirmed DEF、Cover、同帧先伤害后效果
- tuning mark runtime：priority/no-candidate/consume-before-inject/90F 独立风层
- 107002 recipe：action mapping、具体帧、ultimate/star-carry 多段事件、N/A 分类

测试名必须把 `runtime-verified` 与 `conservative-policy` 区分开，避免未来证据升级时不知道哪些断言可被替换。

## 13. R1 核心证据确定性 failure-to-pass

中央在提交 `b2ee7224451fef8af661160eb50c6a3b3572c1e2` 的 clean HEAD 按旧 README 重跑两份生成器后，得到以下已复现失败：

| ID | 旧行为输入 | 旧错误结果 | R1 必须断言 |
|---|---|---|---|
| `DET-FAIL-01` | 重跑资源生成器 | 每次改写 `generatedAt`，并把 `frozenBaseline.actualCommit` 从 production baseline 改成侧车 HEAD | 产物无时钟、无侧车 SHA；连续两次 SHA 相同 |
| `DET-FAIL-02` | 重跑 runtime 生成器 | `headAtExtraction` 改成侧车 HEAD，并把侧车自身 12 个文件写入 `trackedChangesSinceBaseline` | 只记录冻结 production baseline；不嵌入侧车提交或侧车变更清单 |
| `DET-FAIL-03` | 两份 artifact 已被上述命令改脏 | 旧 validator 仍返回 `status=ok` | 默认 validator 必须在机制断言前调用两份 `--assert-clean` 并失败 |

R1 实际 failure-to-pass 门已命中：中央复现留下的旧 artifact 与 `HEAD` blob 不同，严格 validator 返回非零，核心错误为 `working artifact differs from committed artifact`。这证明 validator 不再在 artifact 被重写后误报通过。

## 14. R2 自动领取 failure-to-pass

在 R2 修改 compiler/runtime 后、更新 golden 期望前，owner 只读构建真实失败 27 条旧断言；首组精确失败是 `misa-a3` 在 42/48/54/60/66/72F 的 6 次 direct heal 不再存在。这不是快照手改，而是旧 `spawn+2F` 自动 collision trace 被新 policy 拒绝后的预期红灯。

新通过条件：A3 实体在 40–70F 创建，直到后续米砂重击动作的 70F 才由该重击一次吸收；无重击场景奖励为0并自然过期。两轮相同输入必须得到相同 entity order、trace hash 与 Workbench roundtrip hash。

后续聚焦断言：

| ID | 输入 | 期望 |
|---|---|---|
| `DET-P-01` | clean HEAD 连续两次正常运行两份核心生成器 | 两次均 `wrote=false`，SHA 不变，`git status --porcelain` 为空 |
| `DET-P-02` | clean HEAD 连续两次运行两份 `--assert-clean` | 全部退出 0，不写 artifact，`git status --porcelain` 为空 |
| `DET-N-01` | 手工改一字节核心 artifact 后运行对应 `--assert-clean` | 非零退出，报告 working/committed byte mismatch；不得自愈式重写 |
| `DET-N-02` | artifact 中注入 `generatedAt`、当前侧车 SHA、旧 `headAtExtraction` 或 tracked sidecar list | 重算 bytes 与 committed bytes 不同，生成器及 validator 均失败 |
| `DET-N-03` | 相对 baseline 在允许前缀外制造 tracked/index/working/untracked 漂移 | 两份生成器在读取/写入 artifact 前拒绝 |
| `DET-P-03` | 中央基线不含动态冲突快照 | validator 报告 `dynamicConflictSnapshotPresent=false` 但核心门仍严格通过；不得虚构刷新命令或把缺席混入核心 artifact |

`--assert-current` / `--allow-dirty-sidecar` 只用于提交前核对候选 artifact；它们不能作为 post-commit clean 验收结果。

## 15. S1/R2 实现 failure-to-pass 记录

以下反例均在本实现线先得到错误结果、再由聚焦门转为通过；它们用于说明最终 contract 不是只匹配 happy path。

| ID | 初始错误实现/轴 | 可观察失败 | 最终门 |
|---|---|---|---|
| `S1-FAIL-01` | target-state 只发 tracking command | A4/charged 的状态计数变化，但 calculator 看不到物/法 DEF `-1000bp` | target-state command 必须带两个 modifier、package source identity，且 `appliedToCalculators=true` |
| `S1-FAIL-02` | 把 raw AllHero heal 与完整 semantic subtree 同时执行 | 星决/星携同一来源帧被重复治疗 | raw-direct binding 只启用明确的五帧/四帧，golden 固定为 15/12 个 team actor event |
| `S1-FAIL-03` | 用 2639F 作为 star “CD 前 1F” | 前一施放 occupancy 与探针重叠，失败原因不是 cooldown；边界证据失真 | 独立探针放到 2100F；2340F 精确右开执行，仅前者产生 `skill-cooldown-active` |
| `S1-FAIL-04` | effect summary 把 `EFFECT_BLOCKED` 也算 applied | 满四层后的 no-refresh 反例被误报为成功加层 | R2 六实体 golden 固定 `appliedEventCount=4`、`blockedEventCount=2`，满层不刷新 expiry |
| `S1-FAIL-05` | target-state 自然到期同时再发显式 remove | 2116F 出现重复 remove/expire，状态和 effect ledger 双重结算 | 自然 expiry 只由 duration timeline 关闭；显式 consume 才生成 remove |
| `S1-FAIL-06` | 第三次星鸣没有结构化无候选投影 | validator 只看到无 consume，却无法区分漏实现与合法 no-candidate | 6000F 星鸣在 6082F 固定 `tuning-consume-no-sufficient-priority-candidate`，6090F 独立 `+750` 仍执行 |
| `S1-FAIL-07` | 消费成功效果没有 strict source sequence | 82F 成功 buff 可能被触发 hit 反向读取，且 trace 无法证明 `consume -> inject` | success effect 的 path 排在 consume 后，并以 `strict-source-sequence` 对同帧 settlement 可见性做门控 |
| `R2-FAIL-01` | compiler/runtime 改为 owner 重击吸收但仍使用旧 golden | 27 条旧 `spawn+2F` heal/SP/tuning 断言失败 | 更新为实体留存及 70F 重击逐实体吸收；旧 trace 留作 failure-to-pass |
| `R2-FAIL-02` | 只在 fixture 写 `scenario.pickups`，未扩展通用 Machine Axis schema | acceptance 报 `scenario.pickups` additional property | schema/contract/service/Workbench adapter 以无角色特判的可选 pickup policy roundtrip |
| `R2-FAIL-03` | 新重击探针与既有 critical/A4 lane 重叠 | blocked reason 被 occupancy 覆盖，无法证明目标 gate | cooldown probe 移到 2100F；blocked absorb probe 保留在 3000F A4 lane overlap，并分别断言无 pickup reward |
| `R2-FAIL-04` | R2 scope guard 仍从原始 `140eef...` 计算变更 | 把中央已集成 production 文件误报为本支线越界漂移 | 来源证据仍固定 `140eef...`，scope guard 独立固定 `1a56e0a...`，禁止 carrier SHA |

S1 仍保留而不伪造的边界：A5/完整普攻 occupancy、隐藏团队传播、满池 replacement、满层 refresh 的客户端真实策略。它们只允许 `N/A` 或 conservative/fail-closed，不得因为本实现线聚焦 golden 通过而升级为已证来源。
