# M12-C 末音 AI Top-5 正式搜索 v1

> **INVALIDATED / 仅保留历史证据（2026-08-12）**
>
> 本目录既有 run、checkpoint、aggregate、finalization 与 closeout 产生于 verified normal-attack combo authority 接入之前。旧搜索把 112001 A1 错当作可按 18F 周期重复的独立动作，未携带 successor/recovery/reopen/special-continuation 状态，也未绑定 `normalAttackInputAuthority.contractHash`。因此既有候选与榜单全部不得评分、恢复、最终化或用于 closeout；文件原地保留，不删除、不覆盖。下一次正式搜索必须使用新 run ID，并由 canonical generator 逐步生成已验证 continuation。固定 cadence greedy 入口已永久 fail closed。

本目录是从 `master@baeb03489aa823d59981d60255af5b418aa48178` 新建的正式搜索链，与两份准入前污染证据完全分离。`run-contract.json` 冻结三个 objective、敌人、初始状态、raw identity/tie 规则和 bounded 停止条件；任何结果都只标记为 `AI-guided heuristic Top-N`，`formalRankingReady=false`。

## 权威边界

- release record：`5ae44c228b24bca4a2b8de189307547ea1252a8c21104edbf7bcb0af1fca0a24`
- Formal Search Admission：READY `14/14`，0 blockers
- runtime score authority：`formal-for-current-runtime-contract`
- Client Parity：`PENDING` / `clientParityReady=false`，不阻断当前 runtime-baseline scoring，也不随搜索提升
- 敌人：`310054 雷冠牦`，80 级；profile/hash 由正式 bind 路径解析并进入每条 axis
- STARBORN：一个 optimization object，`199001/199002` 为互斥 source alias
- Kibo：自主 `normal-attack/active` 仍为 product-deferred；只保留 signature、joint attack 与 verified passive

禁止把下列文件读入、复制或作为续跑基础：

- `work/m12-c/guidance.m12c4.round1.cycle-no-toughness.json`
- `work/m12-c/m12c4-search-template.json`

## 分片与恢复

入口：

```powershell
node work/m12-c/formal-search-v1/scripts/run-round.mjs --config <round-config.json>
```

编排器在每个 objective/round 下按权威 `sourceConfigIdentity` 稳定排序；每片原子写入 `input.json`、`guidance.json`、`result.json`、`feedback.json`、`checkpoint.json`。完成片只在 input/guidance/orchestrator/result hash 与 `normalAttackInputAuthority.contractHash` 全部一致时复用；缺失 combo authority 的旧 checkpoint/result 一律作为 invalid artifact 单列，不转成零分。失败、运行中断或缺失片同样单列。每片完成后重建 `aggregate.json`，聚合按 raw candidate identity 去重，并把 cutoff 同分候选保留在 `cutoffTies`。

编排与聚合测试：

```powershell
node --check work/m12-c/formal-search-v1/scripts/run-round.mjs
node --test work/m12-c/formal-search-v1/scripts/formal-search-artifacts.test.mjs
```

## 目录

- `contracts/`：全新正式 Machine Axis 模板
- `config/`：每 objective/round 的冻结请求
- `guidance/`：递增 iteration 的 guidance/provenance 链
- `scripts/`：仅负责分片、原子持久化、恢复与确定性聚合，不改 gameplay 合同
- `runs/`：正式分片、feedback、checkpoint 与 aggregate
- `smoke/`：编排器 one-source 实证；明确不进入三个正式榜单
- `verification/`：最终候选独立复算、Workbench 导入、回放与视觉检查证据

## 停止语义

停止条件是预算边界：完成 35/35 覆盖后，连续 3 个精炼轮 Top-5 raw identity 稳定、cycle cutoff 相对改善低于 `0.25%`（kill 低于 1 frame / `16.66666667ms`）、独立策略没有发现新 Top-5 family。它不是全局最优、穷举闭合或客户端一致性证明。
