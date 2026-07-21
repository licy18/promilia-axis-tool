# M9-D 公开动作运行时覆盖

- 包：`azpr-tc-2026-07-18`
- 固定产品分母：562 个公开动作 / 20 名角色 / 122 只奇波
- 可运行：373
- 明确零：0
- 未解析：189（未分类 0）
- 角色核心动作：38/60 可运行
- 奇波 active / break / signature：254/366 可运行

## 未解析边界

- runtime-and-evidence-gap: 118
- static-evidence-gap: 71

## 非零命中回能元素

- 当前公开动作已应用：153
- 当前公开动作因动作证据缺口未应用：38
- 仅属于公开动作未选 control 变体：76
- 不属于当前公开动作目录：400

## Owner / 动作类型

| Owner | 动作类型 | 分母 | 可运行 | 运行时依赖 | 证据缺口 | 混合缺口 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| actor | charged-attack | 19 | 4 | 0 | 14 | 1 |
| actor | dodge-attack | 20 | 15 | 0 | 1 | 4 |
| actor | limit-counter | 20 | 15 | 0 | 3 | 2 |
| actor | normal-attack | 20 | 6 | 0 | 11 | 3 |
| actor | perfect-parry | 20 | 0 | 0 | 20 | 0 |
| actor | plunging-attack | 20 | 20 | 0 | 0 | 0 |
| actor | star-carry | 17 | 9 | 0 | 6 | 2 |
| actor | star-combo | 20 | 18 | 0 | 2 | 0 |
| actor | star-skill | 20 | 14 | 0 | 5 | 1 |
| actor | ultimate | 20 | 18 | 0 | 2 | 0 |
| kibo | active | 122 | 22 | 0 | 5 | 95 |
| kibo | break | 122 | 110 | 0 | 2 | 10 |
| kibo | signature | 122 | 122 | 0 | 0 | 0 |

## 发布守门

- 通过：publicActionDenominator
- 通过：actorOwnerDenominator
- 通过：kiboOwnerDenominator
- 通过：everyPublicActionClassified
- 通过：requiredActorCoreActionsPresent
- 通过：requiredKiboActionsPresent
- 通过：everyUnresolvedActionExplained
- 通过：everyNonzeroRecoveryElementScoped

> 目录外 DamageElement 与未选 control 变体不再计入当前公开动作产品缺口；逐动作、逐维和逐来源 identity 见同名 JSON。
