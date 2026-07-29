# M11 暴击采样证据与建模决策

日期：2026-07-29

## 结论

- 当前客户端采用逐伤害元素的运行时伪随机暴击采样。它不是按暴击率预排的确定性命中序列，也不是直接按期望值结算。
- 对普通可暴击伤害，`DamageElement.BeforeExecute` 取得 `[0, 10000)` 整数并保存为该元素的 `criticalRandom`；公式按 `criticalRandom < 有效暴击阈值` 判定。
- 当前构建的 `RandomUtility.Range(int, int)` 正常分支调用 `UnityEngine.Random.Range(int, int)`。这是 PRNG，不是物理真随机；从玩家与排轴语义看，每个 eligible hit 是一次随机伯努利试验。
- 排轴工具的 `sampled` 模式应使用显式 seed 的自有 PRNG，以保证同输入可重放。它复原游戏的分布和判定尺度，但不能仅凭战斗轴声称还原客户端全局 Unity RNG 的精确序列，因为其他系统也可能消费该全局状态。

## 上游证据

| 证据 | 位置 | 含义 |
| --- | --- | --- |
| `DamageElement.criticalRandom` 字段 | `C:\PC2\Codex\AzPr\outputs\il2cpp-tc-catch-20260709\dump.cs`，字段偏移 `0x250` | 暴击 roll 属于单个伤害元素，不是动作级共享布尔值 |
| `DamageElement.BeforeExecute` | `GameAssembly.dll` RVA `0x138BA10`；`0x138C128..0x138C137` | 调用 `RandomUtility.Range(0, 10000)`，随后写入 `[this+0x250]` |
| `RandomUtility.Range(int,int)` | `GameAssembly.dll` RVA `0x18AF1B0`；正常出口 `0x18AF20A` | 转入 `UnityEngine.Random.Range(int,int)` |
| 暴击比较公式 | `C:\PC2\Codex\AzPr\outputs\combat-formulas-readable-20260718.md` | 判定为 `randomRoll < CRI - CRI_DEFENSE`，暴击倍率另行进入伤害公式 |
| 公式入口 | `FormulaUtility.GetOutput/GetOutputDamage`，见同批 `dump.cs` | `criticalRandom` 作为显式整数传入公式 |

`MyRandom` 的确是带种子的 MT19937 风格 PRNG，`BuffService` 也存在 `RandomSeedSync`；但本构建中写入 `DamageElement.criticalRandom` 的整数 Range 路径并未调用它，而是调用 Unity 全局 PRNG。不能把这两条随机路径混为“暴击固定种子序列”。

## M11 合同

1. 场景级暴击策略：`sampled | expected | critical | non-critical`。
2. 单 hit 独立保存 `landed: inherit | hit | miss` 与 `criticalMode: inherit | sampled | expected | critical | non-critical`。
3. `sampled` trace 记录 seed、流序号、roll、有效阈值和判定。
4. `expected` 使用命中时刻的实际概率与暴伤，只生成概率加权伤害；不得伪造“已暴击”事件。
5. 暴击会改变后续状态时，期望模式必须做带权分支或明确阻断，不能只平均伤害后沿用任一状态分支。
6. 高级实机复盘可直接输入捕获的单 hit `criticalRoll`；它优先于采样并进入输入哈希。

## 证据边界

- 上述结论来自当前台服客户端静态 IL2CPP 反汇编，足以确定抽样位置、范围与调用目标。
- 尚未捕获运行中 Unity RNG state，也没有证据证明客户端为战斗单独隔离了随机流。因此 M11 的 seed 用于模拟器确定性和统计复现，不标注为“同 seed 必然复刻实机同一串暴击”。
