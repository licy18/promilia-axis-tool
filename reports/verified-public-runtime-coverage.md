# M9-D 公开动作运行时覆盖

- 包：`azpr-tc-2026-07-18`
- 固定产品分母：648 个公开动作 / 20 名角色 / 122 只奇波
- 场景可运行：612
- 来源静态可应用：463
- 来源运行时依赖：173
- 零距离场景补全：568
- 来源静态证据缺口：12
- 明确零：0
- 未解析：36（未分类 0）
- 角色核心动作：56/60 可运行
- 奇波 active / break / signature：448/448 可运行

## 未解析边界

- not-applicable: 17
- runtime-and-evidence-gap: 6
- static-evidence-gap: 13

## 非零命中回能元素

- 当前公开动作已应用：202
- 当前公开动作因动作证据缺口未应用：35
- 仅属于公开动作未选 control 变体：30
- 不属于当前公开动作目录：400

## Owner / 动作类型

| Owner | 动作类型 | 分母 | 可运行 | 运行时依赖 | 证据缺口 | 混合缺口 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| actor | charged-attack | 20 | 15 | 0 | 3 | 2 |
| actor | dodge-attack | 20 | 13 | 0 | 1 | 2 |
| actor | limit-counter | 20 | 15 | 0 | 0 | 1 |
| actor | normal-attack | 20 | 16 | 0 | 2 | 1 |
| actor | perfect-parry | 20 | 13 | 0 | 3 | 0 |
| actor | plunging-attack | 20 | 16 | 0 | 0 | 0 |
| actor | star-carry | 20 | 16 | 0 | 4 | 0 |
| actor | star-combo | 20 | 20 | 0 | 0 | 0 |
| actor | star-skill | 20 | 20 | 0 | 0 | 0 |
| actor | ultimate | 20 | 20 | 0 | 0 | 0 |
| kibo | active | 82 | 82 | 0 | 0 | 0 |
| kibo | break | 122 | 122 | 0 | 0 | 0 |
| kibo | normal-attack | 122 | 122 | 0 | 0 | 0 |
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
