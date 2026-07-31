# M11 外部审计整改答复

## 答复对象

- 原审计对象提交：`290da378944dde1f8e477022710044a74805b7fb`
- 原审计结论：`Request changes`，P1 5 项、P2 4 项
- R1 整改提交：`62273af158c7a1c303b6768a1ab409d5dd5a7b80`
- R2 固定基线：`6601ebd1d53748fc4eaeea3ecf3dec9fc891cce6`
- R2 实现提交：`2c5aaf6a46a0e5ea31d996fcfcd44f1729e084ed`
- R2 复审输入：`doc/promilia-axis-m11-headless-rereview-6601ebd1d537-20260731.md`
- 当前内部结论：M11-01～08 保持外部关闭；M11-09、CLI 取值参数和 warning path 已完成短整改
- 外部审批状态：等待外部短复审，本文不宣称 M11 已获外部批准

项目接受原审计报告的九项发现，没有争议项。旧审计包继续作为被拒快照保留；本次只提交角色与奇波合并后的无头核心，不包含 UI、原始游戏包体、切片或二进制。

## 逐项答复

| ID | 答复 | 整改结果 | 包内复核入口 |
| --- | --- | --- | --- |
| M11-01～08 | 外部已关闭 | R2 未重做这些合同；critical roll、raw Schema、排程/horizon、证据状态、统计守恒及同名奇波运行实体隔离均保持原结果。 | 原 R1 回归和本包复跑 |
| M11-09 | R2 已整改，待短复审 | 原始 Machine Axis `actions` 数组在 project/compile 前获得 `sourceSequenceIndex`，并贯穿派生、诊断、执行块、runtime descriptor 与 canonical trace。ID 只作身份；输入数组顺序是场景显式顺序。 | `source/src/domain/actionSourceSequence.js`；`source/src/simulation/compiler/compileProject.js`；外部 ID 重命名反例 |
| R2-P2 | 已整改，待短复审 | 所有取值参数拒绝缺值、空值和下一 flag；`--frame` 必须是有限整数，枚举在 CLI 层校验。参数错误在任何 stdin/服务调用前返回 `machine-axis-cli-usage`、exit 2。 | `source/src/machine-axis/machineAxisCli.js`；真实子进程回归 |
| R2-P3 | 已整改，待短复审 | unresolved warning 使用 canonical execution plan 的真实数组索引；标准轴 `a3-inherit` 指向 `.1`，`ruby-enhanced-e1-intent` 指向 `.15`。 | `source/src/machine-axis/machineAxisService.js`；边界回归 |

完整机器可读 disposition 位于 `audit/remediation-dispositions.json`。

## 行为与哈希变化

R1 修正同帧运行时顺序后，R2 进一步移除了上游 compile 的 action-ID 排序。R2 新增的 source sequence 是 canonical 输入与 trace 元数据，因此 input/trace hash 更新；data/evaluation 和业务数值保持不变。外部反例两份输入都保持“奇波在前、角色在后”，只重命名 ID，现均得到：

- execution semantic order：奇波 → 角色；
- frame 80 数值与 Break 顺序相同；
- 总 HP 伤害：`468 / 468`，不再出现 `486 / 468` 分叉；
- 同名奇波跨角色仍允许，CD 与资源继续按 `actorId+kiboId` 隔离。

本包标准 120 秒轴的 canonical hashes 应为：

- input：`c91f9da64e02ef84`
- data：`4e36871189392dc1`
- trace：`d10c45fb73dc7c6f`
- evaluation：`0b410dc9255d2654`

## 内部独立验收

- 无头验收回归：22 文件、212 测试通过。
- `axisBoundary` 隔离复跑：23/23 通过。
- Machine Axis boundary/CLI 三文件：40/40 通过，包含真实进程四个缺值/非法值反例。
- character combat、verified combat、character acceptance、kibo headless、production imports、Workbench data、action status、applied source bindings 八道审计全部 clean。
- 原始 Schema 校验器覆盖当前公开 Schema 使用的全部约束关键字；未发现静默 default/coercion 旁路。
- 三角色仍为 `runtime-integrated`，`visuallyAcceptedCount=0`、`optimizationReadyCount=0`。

机器可读内部验收记录位于 `audit/internal-acceptance.json`。测试源码作为复核材料收录在 `audit/regressions/`；包内无需安装测试依赖，正式可执行入口仍是 standalone CLI。

### 独立验收补充

对 `2c5aaf6a46a0...` 的独立验收首次得到 21/22 文件、208/212 测试通过；四个失败均来自 `characterCombatHeadlessMigration.test.js` 仍引用 R2 确定性重生成前的 trace/replay/summary hash。权威 M10 golden、角色验收 manifest、运行时和玩法数值彼此一致。验收 follow-up 仅同步该测试中的 10 个引用，未修改运行时或 golden；随后迁移回放 4/4、完整无头集合 22/212 与八道审计全部通过。

## 未随整改消失的边界

- 角色仍有 887 条功能阻断，不得进入正式优化器。
- 合并缺口分类仍有 350 条 `currently-evidence-blocked`；该状态不表示永久无法解析。
- 奇波公开动作仍有 53 条 scenario assumptions 和 181 条 unresolved。
- 客户端全局 RNG 消费序列仍需运行证据。
- 客户端未知的跨 owner 同帧优先级仍为 evidence-open；Machine Axis 数组顺序是当前场景的显式顺序，运行时不会用 action ID 猜胜者。
- M12、配队搜索、末音最优轴和 UI 工作均未启动。

## 请求复审

请先运行：

```powershell
node audit/verify-package.mjs
node audit/run-smoke.mjs
```

随后重点复测 `M11-09`、CLI 取值参数和 warning path；M11-01～08 已在 `6601ebd1d537...` 复审中关闭。若发现新问题，请给出最小 Machine Axis 输入、命令、实际/预期结构或 hash，以及包内源码和 evidence identity。
