# 112001 assumption-v1 production/acceptance 实现规格

## 1. 完成定义

本实现线以 `m12-112001-assumption-runtime-v1@1.0.0` 闭合当前无头产品机制。完成条件：

```text
policyAuthority = user-approved-headless-assumption
assumptionHashAlgorithm = sha256-canonical-json-v1
assumptionHash = 3ae5e3bf22fabf052d07cb005f3575395c6abcb135942f5bf24dbdc8735e3e71
four original open identities = resolved-by-product-assumption
clientParityReady = false
required -> passed or source-backed N/A
sourceGap = 0
acceptanceGap = 0
blocked = 0
functionalFailure = 0
canonical replay = stable
Workbench import/export = passed
product visual = pending manual review
```

不得把 `realClientEvidenceComplete`、产品视觉、optimization-ready 或 formal admission 与“assumption-v1 可执行”混成同一状态。

## 2. 阶段 A：版本化假设合同

### 2.1 recipe 输入

`scripts/character-combat/profile-recipes/112001.json` 必须声明：

- identity/version/authority/`clientParityReady=false`
- 中央 settlement v2 identity/hash
- 四条原 open identity、source identity、selected、alternate、sensitivity、preserved failure-to-pass
- future client evidence 升版/作废/重算策略

compiler 对 canonical payload 计算 64 位十六进制 SHA-256；recipe 不手写可漂移 hash。合同及 hash 必须进入：

```text
owner contract -> profile -> owner source manifest
runtime overlay data identity
Machine Axis input/data/trace/build identity
M10 golden replay
M11 acceptance manifest / scenario binding
```

删除合同、改 identity/version、改 selected semantics、把 parity 设 true，均必须校验失败或生成不同 hash，使旧 acceptance binding 失效。

canonical payload 只能由共享 helper 构造，保持 assumptions 数组顺序并完整包含 selected/alternate/sensitivity/preserved failure-to-pass；validator 必须重算 SHA-256 并与合同自报 hash 对拍。仅检查 `/^[a-f0-9]{64}$/` 或 binding 字符串相等不合格。合法重生成后所有 charging release binding、break watcher、profile/input/data/trace/build/acceptance binding 必须一起改用新 hash。

## 3. 阶段 B：通用来源驱动 primitive

共享 production 代码只能读取 recipe/profile 合同，禁止出现 `112001`、角色名或专属分支。

### 3.1 Charging release selector

- 输入：right-open windows、releaseFrame、precedence。
- precedence：`greatest-start-frame`。
- 等 startFrame 且语义等价：stable source identity tie-break。
- 等 startFrame 且语义冲突：fail closed。
- runtime 组合 source charge segment 与 shifted release segment；source 在 releaseFrame 之前的 hit/effect 保留，release 的 hit/effect 整体平移。
- action selection trace 写入 assumption identity/version/hash、候选窗和所选窗。

### 3.2 consumer 同结果分支

- judgment 支持来源声明的 `judgmentType=4/5`、`canConsume=0/1`，不能硬编码另一角色形状。
- `same-consume-judgment-outcome` 使本次 consume 成功与否唯一决定 list1/list2。
- priority consumer 只选择一个满足的候选，不跨候选拼层。
- 无候选执行 base list1，但不注入 selected-mark overlimit。
- 稳定顺序：consume、branch damage、selected overlimit。

### 3.3 landed hit effect 与 CD

- action effect 可用 `behaviorPathId` 消除同 frame/element 的来源歧义。
- `landed-action-hit` 与 conditional hit gate 必须读取与 damage/tuning generation 相同的 scenario `defaultWillHit`，再统一调用 `resolveActionHitWillHit`；默认 miss、显式 hit override、显式 miss override 均与实际 landed packet 一致。
- `landed-action-hit` 使用匹配 resolution hit 的唯一 hit identity；`conditional-damage-group-hit` 使用规范 conditional identity。在 miss/blocked/cancelled 时抑制 effect。
- cooldown evaluator 消费 action variant runtime 的最终 composite resolution，不能重新退回默认 charged mapping。

### 3.4 break watcher

- watcher arm 作为命中 settlement 后的独立 descriptor。
- miss 不创建 arm descriptor；landed 后即使 action 后续中断也不回滚。
- 所有会产生真实 break transition 的普通、tuning、周期或反击 damage packet 统一进入 watcher trigger helper。
- 同一 watcher `triggerCount=1`；右开 expiry；全队 actor routing。
- 动态 buff 必须参与后续 packet 属性计算，并记录 applied assumption identity/version/hash。
- watcher suppression authority 必须由本次 generation 显式传入的 mechanics package 提供，且其 `packageId/packageHash` 与 action resolution 完全相同；不一致 fail closed，禁止读取进程全局 package 后消费另一 package 的 resolution。

### 3.5 post-hit wrapper 与受控入场 passive

- effect 的 strict source sequence path 必须位于同碰撞 target settlement 之后。
- 191F 本包查询不到 wrapper，后续独立 packet 可查询；miss 不应用。
- `controlled-entry-property-runtime` 在每次受控角色进入时应用/刷新 8 秒属性链，不得误作永久 battle-start passive。

### 3.6 逐 candidate coverage closure

- 删除 owner 的 `sourceClosureSupersedesResolvedRawCandidateGaps`；配置开关不能成为机制来源。
- raw dimension summary 作为 provenance 原样保留，selected-root candidate 才是 coverage 分母。
- 67 个 settlement candidate 对四个输出维分别裁决；31 个 effect candidate 与 1 个 passive candidate 裁决 buff/effect 维。
- 启用 `selected-root-source-closure-v1` 的 recipe 以通用 opt-in 方式要求 published control root 携带 compact `nodeClassifications`；不得从可能缺 support control 或已漂移的全局 Battle Effect catalog 回查。
- 每个 candidate 必须按 `graph -> node -> damage/toughness/sp source dimension -> product dimension closure` 保留 identity、classification、source field、disposition 与 source identity。
- `runtime-applied` 必须指向真实 hit/semantic effect/conditional consumer；`verified-zero` 必须由具体 node source dimension 证明；`not-applicable` 只能来自精确冻结场景排除或精确 graph/node/dimension policy。“未识别到输出”与 scenario identity 本身均不足。
- conditional runtime closure 必须携带 exact group/template/node relation；semantic runtime closure 必须携带 exact effect/graph/node/source-dimension relation。validator 从 profile 合同独立重算 binding identities、relation identities 与 source identity，并逐项完全等值；非空字符串或 candidate 自报 identity 不能作为证明。
- raw `unresolvedNodeCount > 0` 默认继续 unresolved；只有每个未解析 node 对具体 dimension 都有可审计 closure 时才能闭合。
- candidate 缺失/重复/source 为空、graph compact node snapshot 缺失或漂移、raw/node 数量不守恒、closure disposition/source 缺失或不等值、跨 graph group/effect 嫁接、action/coverage aggregate 不一致均 fail closed。
- 任一 coverage dimension 的 `unresolvedCount > 0` 时，status 必须不是 `applied`。

## 4. 阶段 C：112001 owner 数据

owner recipe/profile 必须完整承载：

1. 10 个公开动作与可达 control；反应式动作以结构化 scenario N/A 计入，不删除来源。
2. 7 条主动 context input edge。
3. 4 条 Charging source binding 与 8 个 right-open release windows。
4. 星鸣 27F landed 雷印记 `250 +1`。
5. 四条 landed `112001267` 星鸣 CD `-3s`。
6. 重击3 32/39/46F 三个独立 one-layer consumer。
7. 星决 191F same-candidate two-layer consumer。
8. `CalculateConsumeCount -> DoConsume -> DoInject` 的 normal/enhanced/overlimit 顺序。
9. 128F `hit-then-arm` watcher、8s one-shot、全队暴伤 raw1000/11s。
10. 191F `target-consumer-then-post-hit-wrapper`、raw99/raw3000/12s。
11. `112001133 -> 112001134` 受控入场暴击率 `+8%/8s`。
12. `11200162` “焰火” orphan/stale N/A，runtime generation 为 none。

owner M10 输出范围仅为：

- `src/data/generated/character-combat-owner-contracts/112001.json`
- `src/data/generated/character-combat-profiles/112001.json`
- `reports/m10/112001/**`

不写全局 verified package、coverage manifest、qualification、binding matrix、summary 或 index。

## 5. 阶段 D：Machine Axis 与 acceptance

### 5.1 canonical fixture

`fixtures/character-acceptance/112001-visual.json` 固定：

- scenario `m12c-zero-distance-passive-boss-v1`
- team `112001,101010,103002`
- Kibo loadout 为空，`kiboDnaFactors=[]`
- hero_rank 不存在
- 初始 tuning marks 雷3、暗2
- Boss 静止、不攻击；距离0；投射物立即命中；不自动拾取
- 主动动作覆盖 A1/A2/A4、59F 重击2、67F 重击3、星鸣、星决、切换入场星携

fixture `verifiedMechanicsPackageHash` 必须绑定 owner profile 所记录的完整 overlay package hash；导入、导出、两次 replay 的 input/data/trace/evaluation hash 必须一致。

### 5.2 acceptance recipe

`scripts/character-acceptance/acceptance-recipes/112001.json`：

- `runtimeProfileOverlay=true`
- golden report 指向 `reports/m10/112001/golden-trace.json`
- visual screenshot 及 SHA-256 可自动校验
- `productVisualAcceptance.status=pending`
- acceptance commit/record identity/qualification binding 均为空
- probes 查询 Charging selection、assumption binding、mark/consume/watcher/wrapper/CD 与 N/A

owner M11 输出只允许 `reports/m11/character-acceptance/112001/**`。自动截图证明 Workbench 可导入和展示，不等于产品视觉签收。

## 6. 阶段 E：敏感性与 failure-to-pass

每条 assumption 都要同时可查询 formal v1 与 alternate：

| assumption | v1 | alternate 差异 |
| --- | --- | --- |
| Charging | 59F sub1、67F sub3 | old-tier 变 sub0/sub2，选择与下游 trace 改变 |
| settlement | break packet 读 pre-break | break-before-HP 改变本包 HP 输出 |
| watcher | 128F break 不触发，后续 packet 触发一次 | arm-before-hit 会触发 128F 本包 |
| wrapper | 191F 不受益，196F 可受益 | wrapper-before-current 会改变 191F 输出 |

必须保留两类历史 failure fixture：

- 未声明 precedence/settlement cursor 时四条原 open fail closed。
- accepted evidence `e13a87b...` 曾把孤立“焰火”文案误升格为 source-open blocker；出现 `112001-firework-consumer-source-open`、等待补 consumer、正向生命周期或 readiness blocker 即失败。

R2/R3/R4 还必须保留五类 failure-to-pass：

- 删除逐 candidate records 后，旧 raw `22/45`、`14+8/45` gap 必须重新暴露；不得用 owner switch 或 blanket N/A 维持 applied。
- 精确 root `11200103|0|elements|1|-7394849788543465206` 的 raw node 仍是 unresolved；删除 node disposition、伪造“无 output”N/A、删除精确 policy，或把 aggregate 调到自洽但让 node 语义未闭合，validator 必须失败。其真实四维 closure 是 node-source `verified-zero`。
- semantic tamper、删除/reorder assumption、改 version/parity/ordering 后，保留旧 hash 或旧 binding 必须失败；合法重算才可通过。旧 hash `3c4a1fb...010743` 留在 5 个 acceptance probe 时实测产生 105 blocked，重绑新 hash 后才恢复。
- scenario 默认 miss 时 hit-gated effect 必须为零；显式 hit/miss override 必须与 damage landed 一致。mechanics package 与 action resolution package 不一致必须失败。
- 对星决 `elements[7]` 的 `112001265` hp closure，把 source 改成 `fixture:forged-nonempty-source`、删除任一真实 source、加入无关 source、把 conditional authority 改成 semantic，或嫁接同 owner 另一 graph 的 group/effect identity，均须得到 `settlement-coverage-node-source-closure-invalid`；candidate 的 graph binding 也必须独立失败。4 个 raw-unresolved/runtime-applied hp node 必须保持 2 条 conditional template + 2 条 exact semantic effect 绑定。

当前 coverage 终态为：`hp 17/30/20/0`、`toughness 16/31/20/0`、`actorSp 9/38/20/0`、`kiboSp 9/38/20/0`（顺序为 applied/zero/N/A/unresolved），`buffsAndDebuffs 28/0/4/0`。94 个 candidate node reference 中有 50 个 raw unresolved node、0 个未闭合 node dimension。owner acceptance 为 `191/191 required pass`、57 N/A、0 blocked/gap/functional failure。

## 7. 聚焦验证

允许：

```powershell
node --check <changed-js/mjs>
jq empty <recipe/fixture>
npx vitest run <focused-files>
node scripts/sync-character-combat-profile.mjs --owner 112001 --write --output-root .
node scripts/generate-character-acceptance.mjs --owner 112001 --write
git diff --check
```

禁止 `test:full`、全量 build、全量 owner sync、正式 M12-C 搜索或全局重型生成。

## 8. 中央串行集成清单

本分支完成后，中央线必须审查与 STARBORN/轴合法性并行改动的语义冲突，再统一：

1. cherry-pick 本 owner commit。
2. 串行合并 compiler/runtime/acceptance overlay primitive。
3. 重生成全局 verified package 与 character-combat catalog/manifest。
4. 重生成全局 acceptance catalog/index、qualification、binding matrix、summary 与 visual acceptance 索引。
5. 跑中央允许的审计与聚焦回归。
6. 由人工产品视觉验收任务决定是否签收；本分支停在 `product-visual-manual-review-pending`。

当前不存在“必须等待真实客户端 capture 才能实现”的剩余项；未来证据只会触发 assumption 升版/作废流程，而不是让 v1 冒充 client parity。
