# 112001 来源账本

## 1. 账本规则

本账本把来源分成四级：

- `PUBLIC`：NewTable/本地化对玩家公开的描述，只回答“文案写了什么”；不能单独建立当前可执行机制。
- `ASSET`：Unity SkillControl/Battle Element 的控制帧、碰撞挂载和 consumer 资源图，回答“从哪里、何时、携带什么发生”。
- `CLIENT`：`GameAssembly.dll` 与匹配的 IL2CPP dump，回答引擎 consumer 的运行顺序。
- `RUNTIME-CURRENT`：本仓库当前模拟器与 optimizer 状态，只用于描述已有接口/缺口，不能替代客户端事实。

状态词：

- `closed`：来源足以驱动精确实现与聚焦测试。
- `boundary-closed`：触发时机/窗口已闭合，但 effect consumer 身份或内部结算仍开放。
- `open`：不能据此实现生产语义。
- `scenario-n/a`：来源真实存在，但产品场景不会提供其必要前置事件。
- `current-client-orphan/stale-description`：公开描述行真实存在，但当前可执行客户端没有对应机制；只保留来源，结构化 N/A，不进入 runtime、required 或 readiness blocker。

所有帧窗均按 `[startFrame,endFrame)` 解释。毫秒持续时间也使用右开区间。

## 2. 来源快照

| 等级 | 来源 | 本侧车使用内容 | 状态 |
| --- | --- | --- | --- |
| PUBLIC | `src/data/generated/skills.json`，角色 `112001` | 技能 01/12/13/21/61/62 的玩家描述快照 | closed（只读快照；`11200162` 仍按孤立文案裁决） |
| PUBLIC | `C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\NewTable\skill.json` | `11200101/12/13/21/61/62` 技能行 | closed |
| PUBLIC | `C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\NewTable\skill_level.json` | `skillId=11200162`、row `2193`、description/value 文本 ID | closed（只证明描述行存在） |
| PUBLIC | `C:\PC2\Codex\AzPr\Assets\ResourcesLang\chs\Table\lang_skill_level.json` | description `9418863283712` 与 value `9418863284480="1"`，原文写星鸣末击 1 层 `焰火`、15 秒 | current-client-orphan/stale-description（非机制） |
| PUBLIC | `C:\PC2\Codex\AzPr\BWiki\data\hero-modules\local-all\112001.hero-module.local.json` | 技能槽位与 passive 装配关系 | closed |
| ASSET | `C:\Codex\AzPr Extractor\ExtractedAssets\Unity\default_package\ResourcesAssets\Config\Battle\SkillList\skill_control_112001*.asset` | 控制树、subskill、碰撞帧、EventBridge、元素挂载；`11200162` 仅有两个资源路径且 62F 无对应 consumer | closed（含孤立文案的缺席裁决） |
| ASSET | `C:\PC2\Codex\AzPr\work\combat-formulas\battle-element-assets.jsonl` | `112001255..272`、`250/450`、超限映射、属性与持续时间；`112001133 -> 112001134` 为上场暴击率链 | closed（当前客户端机制边界） |
| CLIENT | `C:\PC2\Codex\AzPr\outputs\il2cpp-tc-catch-20260709\dump.cs` | `ConsumePackElement` 布局、`EConsumeMode.Priority=0`、方法 RVA | closed |
| CLIENT | `C:\AP\AzurPromilia_TC\AzurPromilia_game\GameAssembly.dll` | consumer 选择、消费、注入及分支顺序 | closed（绑定哈希见下） |
| CLIENT | `scripts/evidence/tuning-consume-priority-runtime-evidence.json` | `250 -> 450` 候选顺序和“首个层数满足 consumeLayerNum 的候选”规则 | closed |
| RUNTIME-CURRENT | `work/m12-optimizer-objectives/STATE.md` | 现有 toughness 任务的开放项、同帧 tuple 与正式阻断原因 | open（客户端顺序） |
| RUNTIME-CURRENT | `src/simulation/mechanics/verifiedCombatRuntime.js` | 当前诊断实现的 HP/韧性/break 顺序 | 非客户端证据 |

### 2.1 客户端二进制绑定

- 文件：`C:\AP\AzurPromilia_TC\AzurPromilia_game\GameAssembly.dll`
- bytes：`222485544`
- SHA-256：`c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`
- `ConsumePackElement.Execute` 已核对调用点：
  - `CalculateConsumeCount`：`0x1387013`
  - `DoConsume`：`0x13870E4`
  - `DoInject`：`0x13870EE`
  - 复核范围 `[0x138700E,0x13870F3)` SHA-256：`27968b87631758ee7ba46601855eb9efb5b78a533bd3579a54cd9ce42b595769`
- `DoInject`：
  - 普通分支（`injectElementDataList_1`）位于 `0x1386A16..0x1386A59`
  - 消费成功分支（`injectElementDataList_2`）位于 `0x1386A76..0x1386AB5`
  - 所选印记超限包查表/注入位于 `0x1386AD2..0x1386B52`
  - 复核范围 `[0x1386A05,0x1386B57)` SHA-256：`bff4e6eda0b6f47e8647a4a35df849d37c3a165e0b57edc39276ecda1eac765d`
  - 已有证据所绑定的 selected-packet 范围 `[0x1386AD2,0x1386B65)` SHA-256：`ae7cd17a10c4b798c6eb4712b5d39a28dff9d440c111038e006b78ecc1aca291`

该绑定只闭合 consumer 跨包顺序；没有闭合单个 damage element 内部的 HP、韧性扣减、破韧事件与弱点倍率先后。

`scripts/evidence/tuning-consume-priority-runtime-evidence.json` 中的 `noCandidateRule="no-consume-and-no-inject"` 只能用于“没有所选候选，因此不消费、也不注入所选印记专属包”的范围，不能解释成整个 `DoInject` 不执行。对匹配二进制的直接复核显示：`m_consumeCount<=0` 明确进入 `0x1386A16..0x1386A59` 的 `injectElementDataList_1` 普通 damage 分支；`m_consumeCount>0` 才进入 list 2，随后再查所选印记超限包。本侧车以后者作为 112001 普通/强化分支的精确来源。

## 3. 玩家语义账本

| skillId | 来源语义 | 证据判断 |
| --- | --- | --- |
| `11200101` | 普攻最多 5 段；A2/A3 后重击派生特殊重击 2；A4/A5 后派生特殊重击 3；完全重击 3 最多消耗 3 层雷/暗印记并造成超限及更高韧性伤害 | 与 Unity 控制/consumer 图一致 |
| `11200112` | 星鸣命中使全队获得 1 层雷印记；技能后重击派生特殊重击 2 | `250@27F` 与 `EventBridge -> 11200110/sub1` 闭合 |
| `11200113` | 消耗 2 层雷/暗印记造成超限和更高韧性伤害；技能后重击派生特殊重击 3；命中后 12 秒破韧效率提升；8 秒内破韧后全队暴伤 +10%/11 秒 | 消费、派生、wrapper、观察器资源均找到；观察器 settlement 顺序仍开放 |
| `11200121` | 星鸣协战后重击派生特殊重击 2；极限反击/完美格挡反击另有派生 | 星鸣协战主动路径闭合；敌攻分支为 scenario-n/a |
| `11200161` | 特殊重击 2/3 命中减少星鸣 CD 3 秒 | `112001267` 与四个 landed collision 挂载闭合 |
| `11200162` | NewTable/CHS 描述行写星鸣末次伤害命中施加 1 层 `焰火`，持续 15 秒 | 描述来源事实闭合；当前可执行客户端无对应机制，分类为 `current-client-orphan/stale-description`、N/A |

`焰火` 只作为原始孤立描述原文保留；“烟花”只作为检索别名。二者均不得被提升为 112001 effect identity。

## 4. 装配与枚举证据

`112001.hero-module.local.json` 的关键槽位：

```text
2#11200110 | 3#11200112 | 4#11200113
203#11200121 | 204#11200115 | 207#11200125
208#11200126 | 209#11200127 | 301#11200111
passive: 11200161, 11200162
```

IL2CPP dump 的辅助枚举/结构：

- `ESkillEventType.InterruptSkill=3`、`Charging=4`。
- `ESkillSlotType.Attack=1`、重击槽 `Skill1=2`、星鸣 `Skill2=3`、星决 `Ultra=4`、闪击 `EvadeAttack=204`、极限反击 `EvadeBoostAttack=207`。
- `EventBridgeBehaviorData` 明示 `allowSkill1`、`bridge`、`skillId`、`skillIndex`、`frameIndex`、`baseOnInput`、`inputToIndex`、`interruptBehavior` 字段。

因此 `allowCountermeasuresSkill=1` 不能被单独解释成“反击专属”；对 `11200110` 的提前/完全释放，决定性字段是 `bridge=Charging(4)` 与目标 subskill。

## 5. 已闭合事实

1. 请求核心的普攻、星鸣、星决入口在无敌攻场景中均主动可达。
2. 派生输入窗、蓄力释放窗及所有已列碰撞窗均采用右开边界。
3. 星鸣印记、重击减 CD、星决观察器和 12 秒 wrapper 都是碰撞挂载，不是 action-start 无条件事务。
4. 完全重击 3 是三个独立 consumer，不是一次 `consume(max=3)` 聚合事务。
5. 每个 consumer 先选候选、再消费、再选择普通/强化伤害，最后才注入所选印记超限包。
6. 星决 consumer 要求单个候选印记达到 2 层；不能把雷 1 层和暗 1 层拼成 2 层。
7. 星决破韧观察器为 8 秒、一次性，目标 effect `112001272` 为全队暴伤属性 `8`、raw `1000`、11 秒。
8. `11200162` 的 PUBLIC 文本与当前 112001 Unity consumer 图不一致；当前客户端资源是机制权威边界，因此该文本是 `current-client-orphan/stale-description`，不是待补 consumer 的机制。
9. `skill_control_11200162` 只引用 path `-1181925444607214156` 与 `1138707259999444314`，对应 `112001133 -> 112001134` 上场暴击率 `+8%/8s`；星鸣 62F 末碰撞没有对应 toOwn/toTarget consumer。
10. 跨角色 `101003/480xxx` 的 `焰火` 元素没有 112001 来源资格；它们只作为“不得把孤立文案伪造成机制”的负例。

## 6. `11200162` 结构化 current-client N/A

`11200162` 的来源保留记录必须使用以下非阻塞形状；若集成合同不能承载此类 provenance N/A，则只留在证据索引，不得塞入 recipe unresolved：

```json
{
  "recordIdentity": "112001-current-client-orphan-skill-level-2193",
  "skillId": 11200162,
  "classification": "current-client-orphan",
  "descriptionStatus": "stale-description",
  "applicability": "not-applicable",
  "gameplayMechanic": false,
  "runtimeGenerationMode": "none",
  "required": false,
  "blocksReadiness": false,
  "sourceIdentity": [
    "NewTable/skill_level.rows[id=2193,skillId=11200162]",
    "CHS/lang_skill_level[id=9418863283712]"
  ]
}
```

## 7. 必须保持开放的事实

| open identity | 缺失证据 | 禁止的替代推断 |
| --- | --- | --- |
| `112001-charge-threshold-overlap-order-open` | `59F`（重击 2）与 `67F`（重击 3）提前/完全释放窗各重叠一帧；正式调度可命中精确阈值，但没有客户端 Charging evaluator 同帧裁决 | 不得用数组顺序、最长按住时间、“完全蓄力优先”或未冻结的场景政策猜测 |
| `112001-damage-toughness-client-order-open` | 单 damage element 内 HP、韧性、break 事件的客户端顺序 | 不得把当前 `verifiedCombatRuntime` 顺序升级为客户端事实 |
| `112001-ultimate-watcher-same-packet-order-open` | 首击 damage 与 `toOwn 112001271` 在同一碰撞中的客户端先后 | 不得仅凭相同 frame/time 判定本包破韧是否能触发观察器 |
| `112001-ultimate-wrapper-same-packet-order-open` | 最终 consumer 与 `toOwn 112001255` 的客户端先后 | 不得让 +30% wrapper 反向作用于当前包，也不得武断排除，须等游标证据 |

这四条 open identity（Charging evaluator 一条，加客户端 break/toughness 同包顺序三条）都必须进入 recipe unresolvedRecords/资格 fail-closed 传播链；本侧车没有为其写 production fallback。`11200162` 孤立文案 N/A 不在此表，也不增加 unresolved 数量。
