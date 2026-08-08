# M12-B3-E20-2-108003-S1 状态

## 目标与硬边界

- 目标：在 `m12c-zero-distance-passive-boss-v1 / 967b0667f315db5b` 下闭合米蒂（108003）的完整来源账本、canonical/Machine Axis 运行时和角色验收；实现完成后停在产品视觉签收点。
- worktree：`C:\Codex\AzPr Axis\.worktrees\promilia-m12-b3`；branch=`feature/m12-b3-optimization-qualification`；起始 HEAD=`140eefcd233cd9c1d136728f1c94b91aff632278`。
- 不开始其他角色、E20-3、M12-C 或正式搜索；Kibo DNA=`[]`；`hero_rank` 不进入运行时。
- 起始 tracked/index clean、untracked=`281`。既有 debug/disasm/staging 产物不删除、不移动、不整批暂存。
- 反应/位移/空中专用动作保留来源行并按 `m12c-zero-distance-passive-boss-out-of-scope` 生成结构化 N/A；普通、短蓄/满蓄重击、星鸣、星决、离场星携及主动派生进入正式动作面。

## 当前状态

- 阶段：`M12-B3-E20-2-108003-S1` 已由中央产品验收通过；接受实现基线=`fdaad80c9839ac8c9768427a9f48b1dcd2138cee`。
- 108003 source/acceptance gap=`0/0`；requirement=`225`；required/pass/N/A/blocked=`139/139/86/0`；scenario=`2/2`，assertion=`1035/1035`；maturity=`optimization-ready`；blocker=`[]`。
- 来源清单共 `510` 个 identity：battle-element `25`、client-code `3`、NewTable `50`、other `54`、runtime-contract `25`、skill-control `353`。语义 ledger 的 `92` 条剩余记录全部 non-blocking、unreachable/not-applicable，gameplay-impacting=`0`；原始来源行没有删除。
- 108003 `qualificationSubjectHash=c5b361402a77ce3e`、运行场景 `scenarioSetHash=f96b380402aee6c1`、产品签收场景 `scenarioSetHash=20afc5b55b18557d`、`manifestHash=8abf4e3d3794ce24`。截图 `reports/m11-d-character-acceptance-108003-desktop.png` SHA-256=`3b346bbb606b74878c5011fdf18293d7a23879b672d83337aa574206c5342292`。
- verified mechanics package hash=`72301ce690c866fdcff7fc8df4d375333f810ff22e372c1eecd33a963fe2b287`；108003 source package hash=`f1ab6bbbcbef6b9514261ed763d911b19d4340977627f4dfbcdb03f8ddb6cfc2`；profile=`54a68a920749a851ef5bf7466b8dffad74e861e4fd8f86af08b4a13d628e6b14`；recipe=`91c364d081ed4e4e955db984746e28133c09dfbe40b97c1e91264cd1529faa8f`；golden replay=`2b5f91377e4252ff2d451b4a92507eef4712aab918a81f0d7880ec1659b472c1`。

## 109001 产品签收同步

- 用户下发本阶段已授权接受末音 S3-R1。生成器把接受记录绑定到已集成提交 `4a5030a52bd51a118f579957bc449efa0c38cf3b`，没有手改汇总数字。
- 109001 当前 `qualificationSubjectHash=c369c5382ad3b812`、`scenarioSetHash=ec1be9f950fe0e50`、`manifestHash=8371d55c1a8195d1`，record=`character-product-acceptance:109001:4a5030a52bd51a118f579957bc449efa0c38cf3b:c369c5382ad3b812`；required/pass=`138/138`、blocker=`0`、maturity=`optimization-ready`。

## 108003 产品签收记录与范围边界

- acceptance record=`character-product-acceptance:108003:fdaad80c9839ac8c9768427a9f48b1dcd2138cee:c5b361402a77ce3e`；acceptance commit=`fdaad80c9839ac8c9768427a9f48b1dcd2138cee`；binding status=`verified`。
- `reports/m10/108003` 的 `pipelineMaturity=runtime-applied / combatCoverage=partial / runtimeReadyActionCount=7/10 / runtimeCapture=10` 是**完整通用机制档案**状态：它持续追踪所有场景、隐藏/反应分支与仍需原生捕获的证据，未因本次签收改写或伪装成 full-profile complete。
- M12 的 `optimization-ready` 只表示 `m12c-zero-distance-passive-boss-v1` 缩减动作面已经全部 pass 或有来源的 scenario N/A；它不宣称 M10 全场景档案已经 complete。两者分母和问题域不同，不构成状态冲突。

## 已真实闭合的米蒂机制

- 普攻三段按真实发生数结算为 `2/3/4` 个 landed hit。
- 短蓄为 `1` 箭 + 弱球 `6` pulse；普通满蓄为 `1` 箭 + 强球 `12` pulse；蓄电满蓄为 `3` 箭 + `36` pulse。通用 `sourceBindingIdentity + hitActivation` 让每条球体流只在对应父箭 landed 后生成：短蓄全 miss、蓄电三箭全 miss、星决全 miss 均为零派生包；单箭 miss 只压制该箭对应的 `12` pulse。
- 蓄电由星鸣/星决给予，持续 10 秒，重击事务在实际执行后消费一次。golden 为 frame `380` gain、`614` refresh、`724` consume；第二轮 frame `1820` gain、`2420` 右开到期。failed/blocked 不消费，刷新、同帧到期和连续重击由 canonical/Machine Axis 覆盖。
- 星决在单 Boss、零距离场景只结算实际可达的 `5` 个 packet（golden frame `642/646/653/663/674`），没有按文本“最多 18 次”直接乘算；`bulletElements/elements` 的镜像 250 根在 142F 只物化一次 `+2`，golden frame `642` 为 `0→2`。
- 蓄电满蓄在 golden frame `723` 以两个真实事务 `2→3→5`；满层重施 frame `973`、离场星携 37F 根对应 golden frame `1137` 都只刷新、净变化 `0`。随后共享 250 容器在 frame `2337/3537/4737/5937/7137` 每 20 秒右开只减一层，`5→4→3→2→1→0`。
- 离场星携正式分支实际结算 `11` 击，golden frame `1149..1269`、cadence=`12F`；37F 的 250 根只应用一次 `+2`。极限反击/集中闪避分支保留来源并结构化 N/A，不混入候选面。
- 10800361：每次合法星鸣产生 10 个 1 秒 tick；Machine Axis 第二次星鸣对三名队员共 `30` 个事务，各 actor frame=`3391+60*n (n=0..9)`、每次 `+2 SP`。108003143 的全队攻击 Buff 按三个 actor 独立应用、持续 24 秒；精确 `56516.667ms` 先到期三份旧实例、再应用三份新实例。切人后 source actor 的后台 tick 与主控归属保持可重放。
- 10800362：只在星鸣最后一击 landed 后给 source actor `+5 SP`；正例 frame `2068/3508`，`miti-star-3-final-miss` 不产生该事务。
- critical 0/100%、整数边界、不可暴击拒绝、pre-hit 属性变化、miss 抑制与逐 hit mode 均由优化面内主动普攻真实 settlement 覆盖。星结合击输入窗同帧合法；把奇波动作移出一帧会在 formal validate 前以 `joint-attack-frame-mismatch` 拒绝。

## 通用实现变化

- character combat compiler 对 action hit binding 做确定性两阶段绑定，发布稳定 `sourceBindingIdentity` 与来源驱动 `hitActivation`；canonical runtime、Machine Axis、cycle replay、Workbench 同消费，不写 108003 动作 ID 特判。
- 生成器对相同 selector/assertion 做确定性去重，保留所有真实事务，避免重复来源引用造成二次计数或二次方报告膨胀。
- optimization scenario policy 保持产品冻结的 policy/roster hash；当前更强的 108003 `+2@142F/+2@37F` 来源证据另进入 package/data/build/qualification hash，政策缺失或漂移仍 fail-closed。
- Workbench/动作分析/资源轨迹只展示 applied transaction；miss、条件未满足与产品场景 N/A 保持独立结构化状态。

## 确定性与资格

- 108003 Machine Axis：input/data/trace/evaluation/build=`ff0e5cfeb6204398/9e1c2699347eea59/9f2b9badd29cf1f2/3c2fb1d6fda5e7b9/320ddf8446ee4c92`；同输入两轮 replay、descriptor 重排、cycle boundary、Workbench import/export 均稳定。
- 全局正式分母保持 `9/43/62/137/12`；qualification source/roster/manifests/ledger/binding/catalog=`26db4986bce695fe/b3bb274e638433c1/f6aab7de4accdba6/3f1ee6e8e0af5ec4/6cba81d337120c35/b8810086de37175e`。
- 全局唯一 blocker=`13`，全部为 character/not-implemented：`actor-static-profile-missing=1`、`character-acceptance-not-published=5`、`character-not-optimization-ready=7`。character acceptance 已有 `2` 个 optimization-ready owner；formal object-kind count 在九人全绿前仍为 `0`。M12-C/formal search 保持 locked。

## 测试与审计

- 迭代期聚焦测试覆盖 profile/runtime/golden、hit activation、target state、250 tuning mark、critical、acceptance、Machine Axis candidate/cycle、qualification、Workbench。一次且仅一次 `npm run test:full` 得到 `1511 passed / 16 failed`（10 个文件，均为本轮重生成后陈旧锁值/已验收敌人数值边界）；没有为刷绿重复全量。
- 上述 10 个失败文件更新后聚焦复跑最终 `242/242` 通过；有限 HP 精确边界另隔离 `1/1` 通过。完整 DOM 分区无失败；Miti Workbench E2E import/edit/undo/reject 与截图通过。
- `audit:verified-combat`、`audit:character-combat`、scenario policy、character acceptance、optimization qualification、applied-source、production imports、Workbench data、action status 全部 clean。
- production build `1885 modules / 13.05s` 通过；仅保留既有 Sass import、circular chunk、large chunk warning。`git diff --check` 通过。

## 下一步

1. 只提交 acceptance record、生成器派生报告和四份权威状态文档；不改 runtime/gameplay/UI。
2. 提交后确认 tracked/index clean、`281 + 14` 个未跟踪产物全部原样存在。
3. 向中央验收任务回报 closeout commit 后停住；不开始下一角色或中央集成。
