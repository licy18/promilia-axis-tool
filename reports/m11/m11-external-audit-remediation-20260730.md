# M11 外部审计整改对照

基线为 `290da378944dde1f8e477022710044a74805b7fb`。本轮只修复无头核心与 Machine Axis 边界，M12、UI、包体、性能和新增角色均未启动。旧被拒审计包保留原状；当前状态为等待外部复审，不宣称 M11 已通过。

## 九项结论

| ID | 结论 | 实现与守门 | 剩余证据边界 |
| --- | --- | --- | --- |
| M11-01 | 已整改 | Machine Axis `criticalRoll` 固定为 `0..9999` basis points；legacy 归一化 roll 仅走显式 legacy 来源。`axisBoundary` 锁定 `0/1/2/499/500/9999`。 | 客户端全局 RNG 消费序列仍属运行证据；工具只复原已验证分布和阈值。 |
| M11-02 | 已整改 | 原始 JSON 在 normalize/default/coercion 前按公开 Schema 校验；缺 required、额外字段、错误类型与字符串 `"false"` 均返回结构化 issue。 | 内部可信 project 继续走独立 adapter，不冒充公共 CLI 文档。 |
| M11-03 | 已整改 | 负起点、超出 horizon 的起点与跨终点动作全部拒绝；`0F` 合法，下游不钳零。 | 无。 |
| M11-04 | 已整改 | 先 canonical compile + variant preflight 得到实际形态与 effective occupancy，再稳定求解相对排程；Ruby E1 为 24F。 | 实际形态仍无来源时返回 `machine-axis-schedule-duration-unresolved`，不回退模板时长。 |
| M11-05 | 已整改 | 动作和效果统一使用 `[0,duration]`；T 时刻保留，T 后 descriptor 在 apply 前过滤，终态只表达 T。 | 无。 |
| M11-06 | 已整改 | `schemaStatus / runnabilityStatus / evidenceStatus` 分离；assumption、unresolved 与同帧未知顺序进入 warnings。 | `runnable-with-assumptions` 明确不等于 `evidence-closed`。 |
| M11-07 | 已整改 | totals/byAction/byActor 使用同一 combat-hit 过滤；拆分 combat hit、state event、实际削韧、韧性恢复和净变化。 | 无。 |
| M11-08 | 已整改 | 产品确认不同角色可携带同名奇波；CD 与资源 owner 改为 `actorId + kiboId`，同 species 两个实例可独立执行。 | 无。 |
| M11-09 | 已整改 | 事件按整数 `absoluteFrame -> phase -> priority -> source sequence` 排序，不再由浮点或 action ID 决胜。 | 未提供顺序的同帧角色/奇波输入仍标为 evidence-open，不猜胜者。 |

## 业务修正

- 寒悠悠：切人帧先迁移主控继承 Buff，再结算退场派生动作；76 条 golden 通过。
- 涂山小玉：同帧特殊重击按源序实际结算；golden 增至 118 条强断言。
- 红宝石：2484F 普通命中先结算 `212 HP / 148 韧性`，随后调谐伤害结算 `49024 HP / 1922 韧性`；旧 action-ID 排序产生的额外 212 HP Break 放大被移除，golden 增至 129 条。
- 寒悠悠切人专用 golden 的业务 replay/summary hash 不变。

## 当前资格

- 三角色均保持 `runtime-integrated`；合并后旧 visual acceptance 不继承，`visuallyAcceptedCount=0`、`optimizationReadyCount=0`。
- 角色缺口仍为 181 个 source gap、706 个 acceptance gap、887 个功能阻断，没有因整改被静默标绿。
- 奇波分母保持 122 只/366 个公开动作；同名奇波跨角色重复允许，实例资源与 CD 相互隔离。

## 验证

- 无头聚焦回归：18 文件 / 138 测试通过。
- 漂移与来源审计：character combat、verified combat、character acceptance、kibo headless、production imports、Workbench data、action status、applied source bindings 全部 clean。
- Production build 通过；既有 Sass、循环 chunk 和大 chunk 警告仅记录，不属于本轮整改。
- 标准 120 秒轴 canonical hash：`a8dd9bfcdf4fad86 / 4e36871189392dc1 / 75fd655bba918b53 / 0b410dc9255d2654`。

本对照表会随 merged-only 审计包一并交付。包生成后必须执行干净解压 manifest 校验及 `catalog / validate / simulate / explain / compare` 五命令冒烟；旧包不会覆盖。正式逐项答复见包根目录 `AUDIT_RESPONSE.md`。
