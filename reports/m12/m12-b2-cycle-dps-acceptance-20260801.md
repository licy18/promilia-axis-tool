# M12-B2 可持续循环 DPS 验收说明

状态：实现完成，等待产品验收。M12-C 未启动。

## 合同

- 输入使用 `AzPrMachineAxisCycleDps` v1，并显式声明非空半开循环区间 `[loopStartFrame, loopEndFrame)`。
- evaluator 强制无限 HP、关闭韧性/击破/死亡截断；纯伤害默认使用 `expected`，`sampled` 必须提供显式 seed 集。
- HP 伤害按 canonical trace 的实际 hit 帧归属，`loopEndFrame` 上的事件只属于下一轮。
- 闭环同时校验角色 SP、奇波能量、特殊资源、队伍印记、主控角色、CD、持续效果、待结算事件和最终动作形态。
- 调谐印记层数由资源不劣门判断；同层时共享衰减余量不得缩短，多层时衰减相位视为不劣；5 秒就绪等待独立要求结束余量不大于开始余量，两端零层时计时器规范化忽略。
- 同一语义循环会由 canonical core 连续执行两次；第二轮动作不可被资源、CD、条件、重叠或派生规则阻断，且两轮伤害必须一致。

## 权威示例

- 输入：`fixtures/machine-axis/m12-cycle-dps-example.json`
- 输出：`reports/m12/m12-b2-cycle-dps-example-20260801.json`
- 命令：`npm run machine-axis -- cycle --input fixtures/machine-axis/m12-cycle-dps-example.json --output reports/m12/m12-b2-cycle-dps-example-20260801.json`
- 暖机：`[0,60)`；循环：`[60,360)`，300F / 5s。
- 循环动作：红宝石普通攻击 A1、A2、A3。
- 首轮与第二轮均为 `22.44996643` HP 伤害、4 个 combat hit；`cycleDps=4.48999329`。
- actor/action/hit 三层贡献各自合计 `22.44996643`。
- canonical hash：input `06083e73632e9e4d`，data `7b865d8e1825995a`，trace `db903427dcd1ecac`，evaluation `412605349bbf2fe3`；cycle `65c9b0958a65fd5f`。
- 两轮结束于 `660F`，replay horizon 保留原合同 `900F`，用于检查第二轮尾部仍待结算的延迟事件。
- 红宝石投射物仍保留 `scenario-assumed-zero-distance` 与 `evidence-open`，循环 evaluator 没有把场景假设提升为实机证据闭合。

## 阻断反例

- 缺失或空循环区间：拒绝。
- 红宝石 A1-A3 后 E1 使弹药 `6 -> 5`：以 `machine-axis-cycle-resource-deficit` 拒绝。
- 芃芃星鸣技第二轮仍在 CD：拒绝。
- 寒悠悠一次性大招 Buff 仅抬高首轮伤害：以两轮伤害不稳定拒绝。
- 延迟 hit 在半开边界按实际帧只计一次。
- 0F 循环起点使用 canonical `[0,boundary)` 前缀状态，不读取未来资源或 CD。

## 验证

- 循环合同单测：`1 文件 / 22 测试`；Machine Axis、canonical core、搜索边界及奇波能量聚焦回归：`11 文件 / 145 测试`。
- 小玉、红宝石、寒悠悠 golden/profile 回归：`4 文件 / 38 测试`。
- `character-combat`、`verified-combat`、production imports、Workbench data、action status、applied source、character acceptance、Kibo headless 八道审计均为 clean。
- production build 通过；既有 Sass、循环 chunk 和大 chunk 提示只作为发布风险记录。性能与包体不作为本阶段阻断。
