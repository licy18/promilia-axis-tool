# M12-B2 可持续循环 DPS 验收说明

状态：M12-B2-R2 历史验收完成；权威示例已在 M12-B3 重新绑定并复验。M12-C 仍锁定。

## 合同

- 输入使用 `AzPrMachineAxisCycleDps` v1，并显式声明非空半开循环区间 `[loopStartFrame, loopEndFrame)`。
- evaluator 强制无限 HP、关闭韧性/击破/死亡截断；纯伤害默认使用 `expected`，`sampled` 必须提供显式 seed 集。
- HP 伤害按 canonical trace 的实际 hit 帧归属，`loopEndFrame` 上的事件只属于下一轮。
- 闭环同时校验角色 SP、奇波能量、特殊资源、队伍印记、主控角色、CD、持续效果、待结算事件和最终动作形态。
- 调谐印记层数由资源不劣门判断；同层时共享衰减余量不得缩短，多层时衰减相位视为不劣；5 秒就绪等待独立要求结束余量不大于开始余量，两端零层时计时器规范化忽略。
- 同一语义循环会由 canonical core 连续执行两次；第二轮动作不可被资源、CD、条件、重叠或派生规则阻断。`expected` 要求两轮伤害逐值一致；`sampled` 用同一语义 hit 的 cycle-local 共同随机数证明状态闭环，独立 seed run 仍用于统计真实伤害波动。
- 无限 HP 在公式入口禁用有限当前 HP 的 minimum-HP 截断，覆盖普通、调谐/超限和真实伤害；护盾仍按原合同吸收或阻挡。
- 奇波被动的内置 CD、累计触发次数与有限触发寿命作为 canonical 状态输出；生成层将 `-1` 与 `9999999` 明确归为 unlimited、小正整数归为 finite、未知值归为 evidence-open。闭环比较相对剩余 CD 与真实有限寿命，不能用固定多跑几轮代替状态建模。
- sampled 报告结构化输出样本数、均值、样本方差、p5/p25/p50/p75/p95，以及 actor/action/hit 聚合贡献与样本均值的守恒差。

## 权威示例

- 输入：`fixtures/machine-axis/m12-cycle-dps-example.json`
- 输出：`reports/m12/m12-b2-cycle-dps-example-20260801.json`
- 命令：`npm run machine-axis -- cycle --input fixtures/machine-axis/m12-cycle-dps-example.json --output reports/m12/m12-b2-cycle-dps-example-20260801.json`
- 暖机：`[0,60)`；循环：`[60,360)`，300F / 5s。
- 循环动作：红宝石普通攻击 A1、A2、A3。
- 当前正例不装备奇波，不为未闭合的 AI 出手时序猜测 cadence；带自动奇波的变体继续以 `kibo-auto-cast-schedule-unresolved` 阻断。
- 首轮与第二轮均为 `212.19998169` HP 伤害、4 个 combat hit；`cycleDps=42.43999634`。
- actor/action/hit 三层贡献各自合计 `212.19998169`。
- canonical hash：input `ea0d6b7fa005c8aa`，data `171fec0161c9e7f4`，trace `5de57a208abe98d1`，evaluation `6eafa465898dbceb`；cycle `c3a9478c0c5a4ccf`，build `fb7f489e9ac64e97`。
- 两轮结束于 `660F`，replay horizon 保留原合同 `900F`，用于检查第二轮尾部仍待结算的延迟事件。
- 红宝石投射物仍保留 `scenario-assumed-zero-distance` 与 `evidence-open`，循环 evaluator 没有把场景假设提升为实机证据闭合。

## Sampled 64-seed 证明（M12-B2-R2 历史基线）

- seed 集：`seed-0..seed-63`；64/64 均通过资源、CD、状态、动作形态和连续重放门，没有 `machine-axis-cycle-damage-not-stable` 误拒绝。
- 循环伤害：均值 `22.59375`、样本方差 `1.07043651`、范围 `22..26`，p5/p25/p50/p75/p95 为 `22/22/22/24/24`。
- cycle DPS：均值 `4.51875`、样本方差 `0.04281746`、范围 `4.4..5.2`，p5/p25/p50/p75/p95 为 `4.4/4.4/4.4/4.8/4.8`。
- actor/action/hit 三层聚合贡献均为 `22.59375`，与样本均值差均为 `0`。
- sampled CLI hash：input `af496a2fa7032bd6`，data `a4b048471cc0a97d`，trace `679999f36cb2a38d`，evaluation `13fc3bf3db5aeb9d`，cycle `44241b3daf282045`。

## 阻断反例

- 缺失或空循环区间：拒绝。
- 红宝石 A1-A3 后 E1 使弹药 `6 -> 5`：以 `machine-axis-cycle-resource-deficit` 拒绝。
- 芃芃星鸣技第二轮仍在 CD：拒绝。
- 寒悠悠一次性大招 Buff 仅抬高首轮伤害：以两轮伤害不稳定拒绝。
- 延迟 hit 在半开边界按实际帧只计一次。
- 0F 循环起点使用 canonical `[0,boundary)` 前缀状态，不读取未来资源或 CD。
- 无限目标将初始 HP 改为 1 后，normal、stack-over-limit、real 三类伤害、逐 hit 贡献和 cycle DPS 与基准精确一致。
- 红宝石装备驮驮龙（500206）并触发 520008 后，`[540,840)` 短循环虽然前两轮伤害相同，仍因 15 秒内置 CD 相位不闭合而以 `kiboPassiveRuntime` 拒绝；有限触发次数减少同样拒绝。
- 红宝石装备河狸仔（500261）后，520082 的 `9999999` 哨兵不再作为有限余量递减；`[420,780)` 两轮均为 `39.08999634`、3 hit，资源和状态闭环通过。
- 520087 已由真实七次触发生成测试锁住六层上限与刷新，再由 canonical 边界测试证明 unlimited 计数不制造寿命差；520083 的真实一次性触发仍保持拒绝。

## 验证

- R2 阻断聚焦：`3 文件 / 57 测试`；完整 Machine Axis `12 文件 / 157 测试`；canonical/critical/Kibo `9 文件 / 82 测试`。
- 小玉、红宝石、寒悠悠 golden/profile 回归：`7 文件 / 58 测试`。数值断言、input/data、profile 与通过数不变；canonical trace hash 因 unlimited 生命周期元数据确定性更新。
- 更新后的角色 canonical trace hash：小玉 `04b5be4588776815`、红宝石 `0a73ff9507f643b7`、寒悠悠主场景 `dca80f3e3439a43d`、寒悠悠切人场景 `688ca4efcac33fa5`。
- `character-combat`、`verified-combat`、production imports、Workbench data、action status、applied source、character acceptance、Kibo headless 八道审计均为 clean。
- production build 通过；既有 Sass、循环 chunk 和大 chunk 提示只作为发布风险记录。性能与包体不作为本阶段阻断。
