---
name: azpr-m12c-ai-guided-search
description: 用 AI 引导协议控制蓝色星原 AzPr Machine Axis 优化搜索的参数与剪枝（beam width、深度、动作过滤、奇波/切人/等待策略、预算与启发式），运行受引导搜索并依据反馈迭代。适用于 M12-C 正式搜索、搜索空间剪枝、候选动作筛选、Top-N 调参、以及任何需要 AI 介入减少枚举规模的 AzPr 排轴/配队搜索任务。
---

# AzPr M12-C AI 引导搜索

## 概述

搜索空间（外层队伍/装配枚举 + 内层动作轴束搜索）太大，不能纯枚举。本技能让 Agent 通过结构化 guidance 协议介入：

- 输入：`AzPrMachineAxisSearchGuidance`（预算、动作过滤、奇波/切人/等待策略、剪枝、启发式、provenance），带 SHA-256 `guidanceHash`。
- 输出：`AzPrMachineAxisSearchFeedback`（预算用量、剪枝/拒绝分布、Top-N 分数、外层预留状态），供下一轮迭代。

代码入口：`src/machine-axis/machineAxisSearchGuidance.js`；CLI：`scripts/run-ai-guided-search.mjs`（npm：`npm run search:ai-guided -- <args>`）。

## 快速开始

1. 读取当前搜索基线：`reports/m12/m12-b3-binding-matrix.json`、`work/m12-c/STATE.md`、上一轮 `feedback`。
2. 写 guidance JSON（示例见 [examples/guidance.example.json](examples/guidance.example.json)）。
3. 运行：
   ```bash
   node scripts/run-ai-guided-search.mjs \
     --contract fixtures/machine-axis/m12-cycle-dps-example.json \
     --guidance-file work/m12-c/guidance.sample.json \
     --feedback-output work/m12-c/feedback.round1.json
   ```
4. 读 feedback，分析 `budgetUsage` / `rejectionBreakdown` / `topResults`，把下一轮建议写入 `recommendations` 并产出新 guidance（`provenance.iteration += 1`）。

## 工作流

### 1. 建立基线

- 先跑一次无 guidance 或最小 guidance 搜索，拿到 `guidanceHash`、`candidatesEvaluated`、`prunedCandidates`、`rejectionBreakdown`。
- 目标/合同选择：三个主目标 `cycle-dps-no-toughness` / `cycle-dps-with-toughness` / `fastest-kill` 共用同一引擎；最快击杀用 `service.evaluateKill` 信封。

### 2. 写 guidance

- 只用协议字段，完整 schema 见 [references/protocol.md](references/protocol.md)。
- 典型介入点：
  - **预算**：`budget.beamWidth/topN/maxDepth/maxActionsPerOwner/maxKiboActions/maxWaitCandidates/maxDamagePerMsBound`。
  - **动作过滤**：`actionFilters`（全局 kind/ID + `perOwner`）——这是领域知识介入的主要手段（例如禁掉冻结场景不可达的闪避/下劈派生）。
  - **奇波/切人/等待**：`kiboPolicy.allowedKiboIds/blockedKiboIds`、`switchPolicy.includeSwitch`、`waitPolicy.includeWait`。
  - **启发式**：`heuristic.criticalPolicy`、`heuristic.seeds`。
  - **provenance**：必须 `authority:"ai-agent"`，写明 `agentId/sessionId/iteration/rationale`。
- 不要写 guidance 里不存在的字段；`normalizeSearchGuidance` 会 fail closed。

### 3. 运行与反馈

- CLI 会应用 guidance 并把 `guidanceHash + appliedRules` 写入搜索结果 `summary.guidance`。
- `--feedback-output` 写出反馈报告；`recommendations` 是留给 AI 填下一轮建议的数组。
- 外层（队伍/装配 build 池）尚未实现：`feedback.outer.implemented=false`，外层字段只校验、不消费，不得声称外层枚举已生效。

### 4. 迭代

- 观察 `rejectionBreakdown` 的 top code：如果是 `machine-axis-action-not-executable` / `controlled-actor-action-unavailable`，优先缩小 `actionFilters`；如果是 `kibo-auto-cast-schedule-unresolved`，用 `kiboPolicy.blockedKiboIds` 或 `budget.includeKibo=false`。
- 观察 `prunedCandidates` 占比：过大说明 `maxDamagePerMsBound` 或深度设置过紧；过小说明搜索面仍太宽。
- 每轮必须保留 `guidanceHash` 与上一轮 feedback 的对应关系；改任何字段都产生新 hash。

## 约束

- 诚实：主目标只有在 closed cycle / killed proof 通过时才有 `formalScore`；搜索中间候选的 `score/heuristicScore` 不等于正式评分，不得冒充。
- `formalStatus=formal-score-ready-runtime-baseline` 表示 `clientParityReady=false`，不宣称客户端一致。
- M12-C 冻结规则（队伍 28/35、固定培养 profile、初始前台不进入 buildHash 等）见 `work/m12-c/STATE.md`，引导不能绕过。
- 全量测试中的存量失败与本次协议无关时不要顺手修。

## 资源

- [references/protocol.md](references/protocol.md)：guidance/feedback 完整 schema、字段说明、迭代启发、CLI 参数。
- [examples/guidance.example.json](examples/guidance.example.json)：最小可用 guidance。
- [examples/feedback.example.json](examples/feedback.example.json)：反馈输出示例。
