# M11 外部审计整改对照

R2 基线为 `6601ebd1d53748fc4eaeea3ecf3dec9fc891cce6`，原始合并审计基线为 `290da378944dde1f8e477022710044a74805b7fb`。M11-01～08 已由外部复审关闭；本轮只收口 M11-09、CLI 取值参数和 warning path。M12、UI、包体、性能和新增角色均未启动。旧被拒包全部保留；当前状态为等待外部短复审，不宣称 M11 已通过。

## 九项结论

| ID | 结论 | 实现与守门 | 剩余证据边界 |
| --- | --- | --- | --- |
| M11-01～08 | 外部已关闭 | R2 保持 raw Schema、critical roll、排程/horizon、证据状态、统计守恒及同名奇波运行实体隔离，不重开全量证据审计。 | 原有 evidence-open 边界不变。 |
| M11-09 | R2 已整改 | 原始 actions 数组在 compile 前写入 source sequence，并贯穿派生动作、诊断、执行块、runtime descriptor 与 trace；action ID 不参与战斗顺序。外部 ID 重命名反例两份均按奇波→角色执行，总伤均为 468。 | 客户端跨 owner 同帧优先级仍为 evidence-open；数组顺序是场景显式顺序。 |
| R2-P2 | 已整改 | 取值型 CLI 参数统一检查缺值、空值、下一 flag、整数 frame 与枚举；错误在 I/O 前返回 exit 2 / `machine-axis-cli-usage`。 | 无。 |
| R2-P3 | 已整改 | unresolved warning 使用 canonical plan 实际索引；`a3-inherit=.1`，`ruby-enhanced-e1-intent=.15`。 | 无。 |

## R2 数值守恒

- 外部反例只交换 action ID 字典序，actions 数组始终为奇波在前、角色在后；两份执行语义、frame 80 Break、HP/韧性和资源均相同，总伤为 `468 / 468`。
- 标准 120 秒轴 data/evaluation 保持 `4e36871189392dc1 / 0b410dc9255d2654`；input/trace 因新增 source sequence 元数据更新。
- 三角色 golden 与验收场景已由同一 canonical runner 重生成；断言数与 evaluation 业务语义不变。

## 当前资格

- 三角色均保持 `runtime-integrated`；合并后旧 visual acceptance 不继承，`visuallyAcceptedCount=0`、`optimizationReadyCount=0`。
- 角色缺口仍为 181 个 source gap、706 个 acceptance gap、887 个功能阻断，没有因整改被静默标绿。
- 奇波分母保持 122 只/366 个公开动作；同名奇波跨角色重复允许，实例资源与 CD 相互隔离。

## 验证

- 无头聚焦回归：22 文件 / 195 测试通过；`axisBoundary` 23/23，Machine Axis boundary/CLI 三文件 40/40。
- 漂移与来源审计：character combat、verified combat、character acceptance、kibo headless、production imports、Workbench data、action status、applied source bindings 全部 clean。
- Production build 通过；既有 Sass、循环 chunk 和大 chunk 警告仅记录，不属于本轮整改。
- 标准 120 秒轴 canonical hash：`c91f9da64e02ef84 / 4e36871189392dc1 / d10c45fb73dc7c6f / 0b410dc9255d2654`。

本对照表会随新的 merged-only 审计包一并交付。包生成后必须执行干净解压 manifest 校验、`catalog / validate / simulate / explain / compare` 五命令冒烟，并在解压包上执行 `recheck-m11-6601.mjs`。旧包不会覆盖。正式逐项答复见包根目录 `AUDIT_RESPONSE.md`。
