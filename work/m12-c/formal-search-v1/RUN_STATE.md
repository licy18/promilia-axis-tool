# M12-C4 正式 AI Top-5 搜索运行状态

更新时间：2026-08-12（北京时间）

## 目标

分别产出并验证：

1. `cycle-dps-no-toughness` Top-5
2. `cycle-dps-with-toughness` Top-5
3. `fastest-kill` Top-5

全部结果固定声明 `rankingClaim="AI-guided heuristic Top-N"`、`formalRankingReady=false`，不宣称全局最优、穷举完整或 client parity。

## 已完成

- 已完整读取并执行 `azpr-m12c-ai-guided-search` skill、`references/protocol.md`、`references/pruning-strategy.md`。
- 已读取 `work/m12-c/STATE.md`、`DEVELOPMENT_PLAN.md` 的 M12/M12-C 合同、最新 release/admission report 与 gate ledger。
- 已确认 `HEAD == origin/master == baeb03489aa823d59981d60255af5b418aa48178`，tracked tree clean，`stash@{0}` object `900e193bf710b8f894b50e0bc966db70cbd7e717` 未变化。
- 已确认 release record `5ae44c228b24bca4a2b8de189307547ea1252a8c21104edbf7bcb0af1fca0a24` 为 executed PASS；Formal Search Admission READY 14/14、0 blockers；`clientParityReady=false/PENDING` 单列。
- 已确认权威 pool `f9740b8fe17d178e`：28 teams、35 source configs、43 Kibo、62 soul essences、137 global equipment、53 M12-C equipment projections、12 set thresholds。
- 已实现独立、可恢复、原子 shard orchestration；不修改 `src/` gameplay/runtime。确定性测试 5/5、脚本语法检查通过。
- one-source smoke v2 已真实处理 1 build / 3 initial fronts：23 candidates evaluated、3 个合法 closed-cycle 结果；第二次运行只复用完成 shard，aggregate hash 稳定为 `d93a8e1fd9ecd0ee8238c56a2e11011976a58a93754f2516c1a191263907cbe7`。
- `cycle-dps-no-toughness/round1-coverage` 已完成 35/35 source configs，0 failed、0 missing、110 个不同合法 closed-cycle 候选；Top-5 cutoff=`19083.46928913`，另完整保留 3 个 cutoff ties；aggregate hash=`c0e92734f9c593ae520f59d51461e1a620bd6164b93da6022e4e499e3778c1d6`。
- 无韧性首轮 feedback aggregate 已落盘，hash=`2da55b60e54d3a522da789746037fd0917a64a6089e9e26ba389b785f2a400df`；共 105 steps、808 candidates evaluated，主要拒绝为 `joint-attack-breakable-toughness-required`/`machine-axis-action-not-executable` 各 210 次，资源不足/成本不可用各 105 次。
- 有韧性首轮第一次外部启动因 Windows `Start-Process` 未给含空格的绝对参数加引号而在进入 orchestrator 前失败；原始 stdout/stderr 保留。第二次改用仓库相对参数启动成功，未修改任何 gameplay/search 合同。
- `cycle-dps-with-toughness/round1-coverage` 已完成 35/35，0 failed、0 missing、16 个合法 closed-cycle 候选；Top-5 与 11 个 cutoff ties 均为 0，明确是“闭环/准入有效但优化未成形”，aggregate hash=`a8bb3613eb19f0a6d40066d7c7b1b15879fca85635808ffaaac26ba781674837`。
- 有韧性首轮 feedback aggregate hash=`2cae9cb276c8b2f32ec6779c974156285df6b5a3466aa0133635391484716b7b`；105 steps、808 candidates evaluated，主要拒绝为 `joint-attack-threshold-not-reached`/`machine-axis-action-not-executable` 各 210 次。
- 新增跨轮 finalization 层及测试：直接重读原子 shard result/checkpoint、核验 canonical hash、修正 shard-local rank、按目标方向稳定排序、raw identity 去重、完整保留 cutoff ties、缺失/失败 fail closed；测试 3/3。
- `fastest-kill/round1-coverage` 已完成 35/35，0 failed、0 missing、0 killed candidate，Top-N 未成形；aggregate hash=`e4711191d37c028cfee499cdf5ad257c274005931cdeabab32057e751da11976`。
- kill 首轮 feedback aggregate hash=`0170898fa84050ccf2eed0358a3965fd063441c132465b27ec9008b58e358d39`；210 steps、2407 candidates evaluated、0 completed killed proof，主要拒绝为不可执行 746、合击阈值未达 630、cooldown 140。
- 三目标 Round 1 均已达到 35/35 source-config coverage；所有 coverage round 合计 105 completed shards、0 failed shards、0 missing shards。
- 有韧性 `round2-depth-probe` 已完成 1/1、0 failed：depth 8 / beam 4 / 1 build / 3 fronts，耗时 1666970ms、815 candidates evaluated、29 个合法正分 closed-cycle 候选；Top-5=`430.81340599, 430.76830343, 383.0596302, 383.01452764, 381.27432251`，aggregate hash=`ef20e319f4824f4de8b6fee5dc520d844f12055aa73cfab7bee1bc683af9e8d0`，feedback hash=`bd3172bd9be772c65cfb5a7c3f51317b7d6c164d6c3d267ad297fd2930be3f05`。
- 有韧性探针 Top-5 均为 112001 前台，使用已验证 `star-skill`/`normal-attack` 链并等待至 7200 帧韧性恢复边界；下一轮按真实动作面做独立限制策略，不引入 Kibo autonomous cadence。
- 无韧性 `round2-ring-probe` 已完成 1/1、0 failed：9 个 ring build × 3 fronts，216 candidates evaluated；ring `1350211` 将 incumbent 从 `19083.46928913` 提升到 `20797.9953003` DPS，aggregate hash=`cb30ad2ff03faf84f2ede752659b3dad2b80aa0a90cbc891f69933ebd928ff93`，feedback hash=`529be2e04e331f1acc9fa7b80c0c5cdc56d36de38ca2fa79bc9052cf28305c7c`。
- 无韧性 `round3-ring-propagation` 已完成 8/8、0 failed、0 missing：固定 112001 ring `1350211` 后覆盖全部八个 112001 source configs 与三种 initial front；28 个合法去重候选，Top-5 cutoff=`20797.9953003`，3 个完整 ties、5 个 Top-5 family；aggregate hash=`d0edefb363136e68e74e5d9a1affa9f14c48ce98a2435f6e50a79dee89cfb55e`，feedback hash=`5e36337b7586a439b5a8c2cbd9087fa035568f7adb4dfa750abe5fa6d5c72120`。
- 无韧性独立 normal-only `round4` 与 beam-1 `round5` 均完成 8/8、0 failed、0 missing；均复现同一五-family Top-5 集合、`20797.9953003` cutoff 与 3 个 ties，cutoff 相对改善 0%。round4 aggregate/feedback=`8c8517874742663c0793c6f943c57ec950180944e1813469487be6835b9b20b2`/`06cb99a1b6dd15590fd7da7214856820639cfb6125581a1984754ac4df9bc7a0`；round5 aggregate/feedback=`9223e78b80292190268cba68b31f4395103bfe8fb752da2d14cb26a183f61f6b`/`ffd56efacb51daa6603a9ac79b59f45ae5e3cc627a98b1d0fbb061bee1135c3a`。
- 无韧性已满足预写 bounded stop：完成 35/35 首轮覆盖；round3/4/5 三轮稳定五-family Top-5；cutoff 改善 0% < 0.25%；独立 normal-only/beam-1 策略未发现新 Top-5 family。该停止条件不构成全局最优性或穷举完整证明。
- `fastest-kill/round2-depth-probe` 已完成 1/1、0 shard failed：depth 8 / beam 4 / 912 candidates evaluated，仍无 killed proof；aggregate hash=`4aeaff300533bd4bbfe67fc417048135eeeff4c65b1cc50453a654bb69e9549b`，feedback hash=`9fa52f0b2a977af0b75c5042b2136f87906d659a0dae2478d3bfae077b5352c1`。未杀死变体不作为零分候选进入聚合。

## 当前状态

- 阶段：incumbent 精炼与 bounded 停止判定。
- 三目标首轮 35/35 均已完成；无韧性搜索已达到 bounded stop，待最终跨轮聚合/复验；kill 下一轮为 depth-16 + ring-1350211；有韧性下一轮为反馈驱动的 normal/star/wait 受限独立策略。
- 正式搜索尚未消费 smoke 结果；`smoke/` 永不进入正式 aggregate。
- tracked runtime 仍保持准入 HEAD 字节；本目录当前为全新 untracked evidence，最终统一版本化提交。

## 冻结策略

- critical policy：`expected`
- cycle preset：`m12c-cycle-cold-zero-state-v1`（actor/Kibo SP 0、印记 0、专属资源 0）
- kill preset：`m12c-kill-full-sp-ruby12-zero-marks-v1`（入队 actor/Kibo SP 100；仅 103002 入队时弹药 12；印记 0；其他资源 0）
- raw identity：build/source/front/preset/input/trace；尚无正式 `semanticBuildHash`，不合并疑似等价 build
- tie：显示 rank 用 raw identity SHA-256 稳定排序；cutoff ties 完整保留
- Round 1：每 source config 1 build、3 initial fronts；cycle depth 1，kill depth 2

## 下一步

1. 运行 kill depth-16 ring 精炼；若不足 5 个 killed proof，按实际 rejection feedback 加深，不把缺失结果记零分。
2. 运行有韧性受限动作独立策略，并传播/验证有提升的 source family，直至满足预写 bounded stop。
3. 修正跨轮最终化层的稳定候选身份：每轮 raw input identity 原样保留，停止/去重使用 build/source/front/preset/trace evidence identity，不使用尚不存在的 `semanticBuildHash`。
4. 达到三个目标的 bounded 停止规则后，跨轮确定性聚合最终 Top-5。
5. 对 15 个最终候选逐条独立复算、Workbench 导入/回放、截图与人工视觉检查。
6. 更新 `work/m12-c/STATE.md`、运行 Smart Gate 影响域、提交并 push。
