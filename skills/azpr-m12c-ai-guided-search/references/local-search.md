# AI 粗轴 + 有界多核局部搜索

当完整内层动作枚举仍然过大时，不要先继续增加 beam width 或 maxDepth。改用两阶段内层流程：

1. AI 依据当前角色/装配、目标、资源循环和动作权威，先写出少量完整宏观轴。
2. 优化器只对 AI 明确开放的局部变量做确定性枚举，并把候选拆成多个小分片交给独立 Node 子进程。

## 合同

入口合同是 `AzPrMachineAxisCoarsePlan`：

- `contractTemplate`：固定数据 identity、队伍、敌人、目标和场景；`actions` 必须为空。
- `seeds[]`：每条 AI 粗轴的完整 `actions`、`rationale`、`variables`、`maxChangedVariables` 和 `maxCandidates`。
- `provenance.authority`：必须是 `ai-authored-coarse-axis`。
- `budget`：总候选/总分片/总墙钟，以及每片候选、evaluation、simulation、墙钟硬上限。
- `parallelism`：worker 数与每进程 V8 heap 上限。
- `planHash`：可选；一旦提供，必须等于归一化完整合同的 canonical hash。

示例：`fixtures/machine-axis/m12-ai-local-example.json`。

## 局部变量

当前只允许：

- `schedule-frame-offset`：对指定动作做小范围帧偏移；`cascade:"suffix"` 会保持后缀相对排布。
- `charging-release-frame`：只调整已指定蓄力动作的 release frame。
- `adjacent-frame-swap`：只交换 AI 明确点名的相邻动作帧位。

每条 seed 最多 24 个变量，每变量最多 9 个值，组合深度最多 2。硬上限为每 seed 128 个候选、每次 run 512 个候选、每 shard 8 个候选/8 次 evaluation/32 次 simulation/120 秒；超限合同直接 fail closed。若仍需扩大覆盖，应由 AI 增加新的宏观 seed 或拆成下一次 run，不得放大单进程搜索面。

宏观动作增删、角色替换、技能种类替换由 AI 通过新增独立 seed 表达；不要把这些宏观变化塞进一个局部 shard。

## 重击与场景边界

- 重击必须消费当前 installed-client static physical-input authority：250ms Press(1)、失败逐 input Update retry、允许前一动作内预蓄、成功清状态、下一次必须 release→repress。
- 不得把 250ms 简化为固定 15 动画帧。
- `108003` 必须按 Press+250ms wrapper 与 source-order-first 三档释放建模：轻蓄 `[0,29)`、中蓄 `[29,67)`、满蓄 `[67,209)`；满蓄在 release 0F 锁定标记分组、3F 追加两箭、4F 清标记。不得恢复旧的 25F/52F 阈值，也不得把静态闭合冒充实机 `clientParityReady`。
- 112001 的 59F/67F overlap 使用 client-proven source-order-first；不得恢复 greatest-start-frame。
- 零距离、Boss 不攻击场景不生成闪避攻击、极限反击、完美格挡和下落攻击。
- STARBORN 仍是一个优化对象；一条轴只能选择 199001/199002 其中一个 source alias，不能混用状态、资源或动作。

## 运行

```powershell
npm run search:ai-local -- `
  --plan work/m12-c/<run>/coarse-plan.json `
  --output work/m12-c/<run>/local-search
```

恢复已完成分片：

```powershell
npm run search:ai-local -- `
  --plan work/m12-c/<run>/coarse-plan.json `
  --output work/m12-c/<run>/local-search `
  --resume
```

默认建议为 4 个 worker（硬上限 8）；32GB 主机上总声明 heap 不得超过 16GB。每个 shard 使用独立子进程，父进程在硬墙钟到期时终止该 shard，继续汇总其他结果。进度和 checkpoint 原子写入 output 目录；resume 只复用 hash 完整且状态为 `complete` 的 shard，截断或损坏结果会重算。

## 结果边界

- `bounded-complete` 只表示声明的 seed/局部邻域全部跑完。
- `bounded-truncated` 表示枚举、分片或预算触发有界停止。
- `no-valid-candidates` 和 worker hard failure 返回非零。
- Top-N 会保留 cutoff 同分候选。
- `aggregateHash` 排除墙钟元数据，因此同一 checkpoint resume 的聚合 hash 稳定。
- 任何该流程结果都固定为 `formalRankingReady=false`、`clientParityReady=false`。它可作为下一轮 AI seed 或产品候选，但不是全局最优证明。
