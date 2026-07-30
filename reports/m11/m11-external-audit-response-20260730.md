# M11 外部审计整改答复

## 答复对象

- 原审计对象提交：`290da378944dde1f8e477022710044a74805b7fb`
- 原审计结论：`Request changes`，P1 5 项、P2 4 项
- 代码整改提交：`62273af158c7a1c303b6768a1ab409d5dd5a7b80`
- 当前内部结论：整改验收通过，可以提交外部复审
- 外部审批状态：仍为等待复审，本文不宣称 M11 已获外部批准

项目接受原审计报告的九项发现，没有争议项。旧审计包继续作为被拒快照保留；本次只提交角色与奇波合并后的无头核心，不包含 UI、原始游戏包体、切片或二进制。

## 逐项答复

| ID | 答复 | 整改结果 | 包内复核入口 |
| --- | --- | --- | --- |
| M11-01 | 接受 | captured `criticalRoll` 明确为 `0..9999` basis points；legacy normalized roll 只按显式来源解析，不再按数值大小猜单位。 | `source/src/simulation/mechanics/verifiedCombatRuntime.js`；`audit/regressions/axisBoundary.test.js` |
| M11-02 | 接受 | 公共 CLI 在 normalize/default/coercion 前严格校验原始 JSON Schema；required、额外字段、错误类型和字符串 `"false"` 均结构化拒绝。 | `source/src/machine-axis/machineAxisSchemaValidation.js`；`audit/regressions/machineAxisCliProcess.test.js` |
| M11-03 | 接受 | 绝对和相对负帧、越过 horizon 的起点、跨越 horizon 的动作均拒绝；下游不再静默钳到 0。 | `source/src/machine-axis/machineAxisContract.js`；`audit/regressions/axisBoundary.test.js` |
| M11-04 | 接受 | 调度改为有界两阶段求解：先按上下文预解析实际 variant/effective occupancy，再解析依赖动作结束点的相对轴；无法确定真实时长时返回 unresolved，不回退 public template。 | `source/src/machine-axis/machineAxisService.js`；Ruby E1 与小玉爆发形态反例见边界测试 |
| M11-05 | 接受 | 动作、效果和终态统一使用闭区间 `[0,T]`；T 时刻事件保留，T 后 descriptor 在 apply 前过滤。 | `source/src/simulation/runtime/effectRuntimeTimeline.js`；`audit/regressions/axisBoundary.test.js` |
| M11-06 | 接受 | `schemaStatus`、`runnabilityStatus`、`evidenceStatus` 分离；scenario assumption、动作条件未闭合及未知同帧顺序进入结构化 warnings。 | `source/src/machine-axis/machineAxisService.js` |
| M11-07 | 接受 | totals、byAction、byActor 使用同一 combat-hit 过滤；命中、状态事件、实际削韧、韧性恢复与净变化分开统计。 | `source/src/simulation/headless/canonicalHeadlessCombatCore.js`；合并 120 秒轴守恒测试 |
| M11-08 | 接受并澄清产品合同 | 不同角色允许装备同 species 奇波；资源与 CD 以 `actorId + kiboId` 标识运行实体。两个 `500001` 实例可分别执行并各自从 `100` 消耗到 `0`。 | `source/src/simulation/runtime/actionRuleDiagnostics.js`；双实例边界测试 |
| M11-09 | 接受 | 事件顺序改为整数 `absoluteFrame -> phase -> priority -> source sequence`；`timeMs` 只用于展示，action ID 不再决定同帧胜者。跨 owner 且未声明顺序的输入保持 evidence-open。 | `source/src/simulation/mechanics/verifiedCombatRuntime.js`；`0+20F` 与 `6+14F` 反例 |

完整机器可读 disposition 位于 `audit/remediation-dispositions.json`。

## 行为与哈希变化

M11-09 修正了此前由浮点路径或 action ID 决定的同帧顺序，因此旧 trace/golden 不能原样沿用。三处业务变化均已定位到事件级：

- 寒悠悠：切人帧先转移主控继承 Buff，随后结算退场派生攻击。
- 涂山小玉：A5 派生特殊重击在同帧按来源顺序实际结算。
- 红宝石：2484F 普通命中先结算 `212 HP / 148 韧性`，调谐伤害随后结算，移除了旧顺序产生的额外 Break 放大。

本包标准 120 秒轴的 canonical hashes 应为：

- input：`a8dd9bfcdf4fad86`
- data：`4e36871189392dc1`
- trace：`75fd655bba918b53`
- evaluation：`0b410dc9255d2654`

## 内部独立验收

- 无头验收回归：17 文件、144 测试通过。
- 原审计边界套件隔离复跑：21/21 通过。
- character combat、verified combat、character acceptance、kibo headless、production imports、Workbench data、action status、applied source bindings 八道审计全部 clean。
- 原始 Schema 校验器覆盖当前公开 Schema 使用的全部约束关键字；未发现静默 default/coercion 旁路。
- 三角色仍为 `runtime-integrated`，`visuallyAcceptedCount=0`、`optimizationReadyCount=0`。

机器可读内部验收记录位于 `audit/internal-acceptance.json`。测试源码作为复核材料收录在 `audit/regressions/`；包内无需安装测试依赖，正式可执行入口仍是 standalone CLI。

## 未随整改消失的边界

- 角色仍有 887 条功能阻断，不得进入正式优化器。
- 合并缺口分类仍有 350 条 `currently-evidence-blocked`；该状态不表示永久无法解析。
- 奇波公开动作仍有 53 条 scenario assumptions 和 181 条 unresolved。
- 客户端全局 RNG 消费序列仍需运行证据。
- 未提供显式顺序的跨 owner 同帧输入仍为 evidence-open，运行时不会用 action ID 猜胜者。
- M12、配队搜索、末音最优轴和 UI 工作均未启动。

## 请求复审

请先运行：

```powershell
node audit/verify-package.mjs
node audit/run-smoke.mjs
```

随后按原报告的 M11-01 至 M11-09 最小反例逐项复测，并在复审意见中沿用原编号标记 `closed`、`partially closed` 或 `open`。若发现新问题，请给出最小 Machine Axis 输入、命令、实际/预期结构或 hash，以及包内源码和 evidence identity。
