# AzPr AI 引导搜索协议（v1）

## 目录

- [1. Guidance schema](#1-guidance-schema)
- [2. Feedback schema](#2-feedback-schema)
- [3. CLI](#3-cli)
- [4. 迭代启发](#4-迭代启发)
- [5. 诚实性边界](#5-诚实性边界)

## 1. Guidance schema

合同：`AzPrMachineAxisSearchGuidance` / `azpr-machine-axis-search-guidance` / schemaVersion 1。所有字段可选，校验 fail closed；`provenance.authority` 只接受 `ai-agent`。

```json
{
  "schemaVersion": 1,
  "contractName": "AzPrMachineAxisSearchGuidance",
  "kind": "azpr-machine-axis-search-guidance",
  "guidanceVersion": "1.0.0",
  "objective": "cycle-dps-no-toughness | cycle-dps-with-toughness | fastest-kill",
  "layer": "inner | outer | both",
  "budget": {
    "beamWidth": 8,
    "topN": 5,
    "maxDepth": 24,
    "maxActionsPerOwner": 6,
    "maxKiboActions": 3,
    "maxWaitCandidates": 6,
    "maxDamagePerMsBound": 10,
    "includeKibo": true,
    "includeSwitch": true,
    "includeNormalAttacks": true,
    "includeWait": true
  },
  "actionFilters": {
    "allowedActionKinds": ["normal-attack", "star-skill"],
    "blockedActionKinds": ["dodge-attack", "plunging-attack"],
    "allowedPublicActionIds": [],
    "blockedPublicActionIds": [],
    "perOwner": {
      "101010": { "allowedPublicActionIds": [], "blockedPublicActionIds": [] }
    }
  },
  "kiboPolicy": { "allowedKiboIds": [], "blockedKiboIds": [] },
  "switchPolicy": { "includeSwitch": true },
  "waitPolicy": { "includeWait": true, "maxWaitFrames": null },
  "pruning": { "earlyTerminationScore": null, "aggressive": null },
  "heuristic": { "criticalPolicy": null, "seeds": null },
  "outer": null,
  "provenance": {
    "authority": "ai-agent",
    "agentId": "codex-m12c-advisor",
    "sessionId": "session-1",
    "iteration": 1,
    "rationale": "为什么这样剪"
  }
}
```

语义：

- `budget`：直接映射引擎 `normalizeSearchOptions`；`include*` 同时进入生成器。
- `actionFilters`：作用于生成器的角色动作候选；`perOwner` 的 key 是 characterId 字符串。全局与 per-owner 是 AND 关系。
- `kiboPolicy`：`allowedKiboIds` 非空时只保留这些奇波；`blockedKiboIds` 直接排除。
- `switchPolicy/waitPolicy`：仅 `includeSwitch/includeWait` 被引擎消费；`maxWaitFrames` 保留给未来实现（appliedRules 会标 `(reserved)`）。
- `pruning.heuristic`：`criticalPolicy/seeds/earlyTerminationScore` 写入引擎 options；`aggressive` 预留。
- `outer`：外层 build 池枚举（M12-C1）字段预留，当前不消费。
- `guidanceHash`：对归一化 guidance 的 stable JSON 做 SHA-256（64 hex），不包含 provenance 之外的运行时间信息。

## 2. Feedback schema

合同：`AzPrMachineAxisSearchFeedback` / `azpr-machine-axis-search-feedback`。

```json
{
  "schemaVersion": 1,
  "contractName": "AzPrMachineAxisSearchFeedback",
  "kind": "azpr-machine-axis-search-feedback",
  "guidanceHash": "…64 hex…",
  "guidanceVersion": "1.0.0",
  "objective": "cycle-dps-no-toughness",
  "budgetUsage": {
    "beamWidth": 4,
    "topN": 3,
    "maxDepth": 3,
    "steps": 3,
    "wallTimeMs": 1234,
    "candidatesEvaluated": 20,
    "prunedCandidates": 5,
    "mergedCandidates": 2,
    "invalidCandidates": 1,
    "completedCandidates": 12,
    "formalSurfaceRejectedCandidates": 3
  },
  "rejectionBreakdown": [{ "code": "machine-axis-action-not-executable", "count": 4 }],
  "topResults": [
    { "chainLength": 3, "score": null, "heuristicScore": 123.4, "hashes": {} }
  ],
  "outer": {
    "implemented": false,
    "status": "planned-m12-c1-not-implemented",
    "guidanceReserved": true
  },
  "recommendations": []
}
```

`recommendations` 是 AI 回填区：每轮结束把下一轮建议（要改的字段、理由、预期影响）写入，作为持久化迭代记录。

## 3. CLI

```bash
node scripts/run-ai-guided-search.mjs \
  --contract <fixture-or-contract-json> \
  [--objective <id>] \
  [--guidance '<json>'] \
  [--guidance-file <path>] \
  [--options '<json>'] \
  [--feedback-output <path>]
```

- `--contract`：可以是 `{contract, loop, ...}` 信封（自动解包）或裸 `AzPrMachineAxis`。
- `--guidance` 与 `--guidance-file` 二选一；`--options` 是额外引擎 options。
- 输出：JSON（objective、guidanceHash、appliedRules、summary、topScores、issueCount、feedbackOutput）。

## 4. 迭代启发

| 观察 | 建议 |
| --- | --- |
| `rejectionBreakdown` 顶部是 `machine-axis-action-not-executable` | 收窄 `actionFilters`（blocked kinds / perOwner blocked ids） |
| `kibo-auto-cast-schedule-unresolved` 高频 | `kiboPolicy.blockedKiboIds` 或 `budget.includeKibo=false` |
| `prunedCandidates` 占比 > 60% | 放宽 `maxDamagePerMsBound` 或降 `maxDepth`，避免误剪 |
| `candidatesEvaluated` 过大且 wallTime 超预算 | 降 `beamWidth/maxDepth/maxActionsPerOwner/maxWaitCandidates` |
| Top-N 全是半成品（score=0/null、heuristicScore 高） | 提高 `maxDepth` 或 `maxWaitCandidates`，让 closed cycle / kill 成形 |
| `mergedCandidates` 高 | 候选冗余多，可加 per-owner 过滤减少等价展开 |

## 5. 诚实性边界

- 主目标正式分只在 closed cycle（`status=closed`）或 killed（`status=killed`）时存在；搜索中间态只有 `heuristicScore`。
- `formalStatus=formal-score-ready-runtime-baseline` 表示评分对当前 runtime 合同正式，但 `clientParityReady=false`。
- 外层未实现：不得在报告或结论里声称 build 池枚举已完成或已受 AI 引导。
- 所有 guidance 变更必须带新 `guidanceHash`，且与上一轮 feedback 保持引用链。
