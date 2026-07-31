# M12-B Search Benchmark

- 时间：2026-07-31T13:29:33.396Z
- 环境：Node v24.16.0 / win32-x64
- 场景：`m12-search-example`（120s，beam/深度变体，topN=3，maxActionsPerOwner=2，maxKiboActions=1，includeSwitch=false，objective=damage）
- 说明：仅记录真实基线；Top-N 分数与 trace hash 按变体确定，墙钟随负载波动

## 基准

| variant | beam | depth | wall ms | cpu user ms | candidates | invalid | merged | pruned | top1 score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| beam2-depth2 | 2 | 2 | 13099.43 | 17375 | 11 | 8 | 0 | 0 | 414 |
| beam3-depth2 | 3 | 2 | 15061.42 | 19172 | 14 | 11 | 1 | 0 | 414 |

## worker 并行评审

Candidate simulation is synchronous CPU-bound work (per-run ~0.8-0.9s). In-process async jobs do not add throughput; real parallelism would require worker threads/child processes that re-instantiate the verified mechanics package per worker. Not implemented in M12-B: search correctness and determinism take priority, and current scope (functional validation on 3 runtime-integrated characters) is within single-process time budgets. Revisit before M12-C scale-up.

完整数据：`C:\Codex\AzPr Axis\.worktrees\promilia-m12\reports\m12\benchmark-machine-axis-search-2026-07-31T13-29-33-336Z.json`
