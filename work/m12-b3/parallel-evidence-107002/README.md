# M12-B3 107002 米砂证据基线与 R2 重击吸收实现侧车

本目录继承已接受证据基线 `b900801af15ddf66378939dc3e00b3849512cacd`，并在中央 R2 集成基线 `1a56e0a295f31298da6c3ddb5d70db90183971fb` 上记录用户对 S1 自动拾取推断的产品纠正。R2 production 变更仅含通用声明式吸收 primitive、pickup 场景 policy、107002 owner recipe/profile/fixture/测试与 owner reports；不承载全局生成，也不声明 visual/formal admission 或 optimization-ready。旧产品视觉签收已因机制/trace 漂移重开为 pending。

## 文件导航

| 文件 | 用途 |
|---|---|
| `resource-graph-excerpt.json` | 角色投影、NewTable、Unity control/battle element、战场物件图和既有 mark priority 二进制证据的定向摘录 |
| `runtime-evidence-excerpt.json` | `10700261` 外链被动 track、运行时 enum、`ConsumePackElement.Execute` 反汇编调用顺序 |
| `mechanism-contract.json` | required/N/A、逐机制精确帧/路径/路由/边界、primitive 与冲突的机器契约 |
| `SOURCE_LEDGER.md` | 人读来源链、结论、冲突和未闭合项 |
| `IMPLEMENTATION_SPEC.md` | 可直接下发的通用 primitive / 角色 recipe 实现分包 |
| `COUNTEREXAMPLES.md` | action/hit/effect/control/resource/cooldown/mark/overlimit/heal/debuff 的正负例、同帧与右开边界 |
| `extract-107002-evidence.mjs` | 确定性重建资源图核心摘录；支持 `--assert-clean` |
| `extract-107002-runtime-evidence.py` | 确定性重建外链 track/enum/反汇编核心摘录；支持 `--assert-clean` |
| `validate-107002-evidence.mjs` | 默认以 post-commit byte-clean 门校验核心摘录、基线、路径边界、来源值、顺序和禁止声明 |
| `validate-107002-workbench-roundtrip.mjs` | 从当前源码只读构建 mechanics package，验证 107002 Machine Axis 两轮 replay 与 Workbench import/export roundtrip |
| `IMPLEMENTATION_RESULT.md` | R2 机制到代码/测试的映射、保留边界、冲突面与中央统一重生成清单 |

## 机制结论速览

- A3 只有 40–70F 六个 qualifying hit 造 HP 生成物；普通池 `SummonTempData` 上限 6。生成后不自动领取。
- A4 84F / charged 76F 成功 hit 的序列均为 damage -> energy -> DEF debuff；当前 hit 不吃 -10%，后续 hit 吃，持续 `[t,t+24000)`。
- 星鸣 82F 按 `[木550,风750]` 选择；二进制顺序是 `CalculateConsumeCount -> CastPassiveSkill -> DoConsume -> DoInject`。90F 的独立 +1 风印记在消费之后，不能支付当前施放。
- 星鸣 SP 生成物由米砂重击吸收后对米砂 Target +1，再按 SP `ShareAll` 分享；30s 木/风伤 +5% 的 raw route 是 Source。
- 星决 135F 按 `skillTrackDatas[20]` HP×3、`[21]` SP×3 创建；143/155/167/181/193F 五次显式 AllHero 治疗。星携 46/61/79/98F 四次显式 AllHero 治疗。
- 距离0不产生隐式移动；实体保留到米砂 `10700210/sub0` 重击 70F 吸收或 15s 过期。召唤物侧 track source order15 先于同帧敌方聚拢 order16；miss 仍吸收，blocked 不吸收。
- 吸收者固定为动作 owner 米砂。HP Target-only、SP ShareAll；marker gate 后每个实体尝试 +6% 调谐强度，最多4层、每层24s，满层 ignore-new/no-refresh。
- 闪击/闪避、跃击/跳跃/下落、极限反击、完美格挡/招架/专注闪避保留来源，但在冻结 Boss 场景结构化为 `scenario-out-of-scope` N/A。

## 核心摘录的确定性模型

两份核心摘录把两个概念分开建模：`140eefcd233cd9c1d136728f1c94b91aff632278` 是继承的原始 production 来源证据基线，`1a56e0a295f31298da6c3ddb5d70db90183971fb` 是本批固定的 R2 集成/范围基线。产物只绑定这两个固定身份、外部原始资源身份和固定的 R2 实现路径 allowlist，不嵌入承载侧车的当前/未来 commit、branch、生成时钟或实际变更清单。生成前会检查 `1a56e0a..HEAD`、index、working tree 与 untracked 路径；只要出现证据目录和固定 allowlist 之外的漂移就拒绝生成。

核心 JSON 固定为 UTF-8、2 空格缩进、LF、末尾换行。目录内 `.gitattributes` 也固定 LF，避免 Windows checkout 把 byte-clean 比较改成 CRLF。正常生成采用 write-if-changed；相同来源连续执行不会改写文件。

## 聚焦复验：核心摘录

在本 worktree 根目录运行：

```powershell
node work\m12-b3\parallel-evidence-107002\extract-107002-evidence.mjs
python work\m12-b3\parallel-evidence-107002\extract-107002-runtime-evidence.py
```

提交后的 clean HEAD 使用两条严格门；它们都在内存中重算、同时逐字节比较 working artifact 与 `HEAD` artifact，且绝不写文件：

```powershell
node work\m12-b3\parallel-evidence-107002\extract-107002-evidence.mjs --assert-clean
python work\m12-b3\parallel-evidence-107002\extract-107002-runtime-evidence.py --assert-clean
node work\m12-b3\parallel-evidence-107002\validate-107002-evidence.mjs
```

开发中的未提交核心摘录可分别用 `--assert-current` 检查，或运行 `node ...\validate-107002-evidence.mjs --allow-dirty-sidecar`；该兼容命名的模式只允许证据目录与固定 R2 allowlist 内的脏文件，不可替代提交后的严格门。

## 动态冲突快照边界

中央基线未携带 `integration-conflict-snapshot.json` 或刷新脚本，本批也不新增动态快照。validator 只在该文件实际存在时把它作为可选、非核心时点数据校验；其缺席不影响两份核心摘录的 byte-reproducible / `--assert-clean` 声明。并行冲突面以本账本的静态文件清单交接，中央合并前必须重新读取各分支状态。不要在本支线运行 `test:full`、`test:core`、build、全量生成或 M12-C 搜索。

## R2 聚焦复验

owner 产物只能定向生成 107002；不要省略 `--owner`：

```powershell
node scripts\sync-character-combat-profile.mjs --owner 107002 --output-root . --assert-clean
node scripts\generate-character-acceptance.mjs --owner 107002 --assert-clean
node work\m12-b3\parallel-evidence-107002\validate-107002-workbench-roundtrip.mjs
```

聚焦 Vitest 范围由 `IMPLEMENTATION_RESULT.md` 固化；禁止替换为 `test:full`、`test:core` 或全局生成。

## 中央集成线待办

1. 语义合并米蒂/107001/102001 的并行 shared runtime/compiler；不得直接 cherry-pick 这些角色提交覆盖本实现。
2. 统一重生成 `src/data/generated/verified-combat-mechanics-package.json`、character-combat 全局 catalog 与全局 coverage/qualification/acceptance 汇总；本分支只发布 107002 owner 产物。
3. 继续把 A5/完整普攻 occupancy、隐藏传播、满池 replacement、满层 refresh 保留为来源缺口或 conservative policy。
4. visual/formal admission 与 optimization-ready 继续走独立产品验收，本分支的 false/absent 状态不得自动升级。
