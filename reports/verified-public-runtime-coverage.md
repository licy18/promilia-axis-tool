# M9-D 公开动作运行时覆盖

- 包：`azpr-tc-2026-07-18`
- 固定产品分母：646 个公开动作 / 20 名角色 / 122 只奇波
- 场景可运行：631
- 来源静态可应用：461
- 来源运行时依赖：173
- 零距离场景补全：585
- 来源静态证据缺口：12
- 明确零：0
- 未解析：15（未分类 0）
- 角色核心动作：59/60 可运行
- 奇波 active / break / signature：448/448 可运行

## 未解析边界

- runtime-and-evidence-gap: 7
- static-evidence-gap: 8

## 非零命中回能元素

- 当前公开动作已应用：203
- 当前公开动作因动作证据缺口未应用：35
- 仅属于公开动作未选 control 变体：30
- 不属于当前公开动作目录：399

## Owner / 动作类型

| Owner | 动作类型 | 分母 | 可运行 | 运行时依赖 | 证据缺口 | 混合缺口 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| actor | charged-attack | 20 | 15 | 0 | 3 | 2 |
| actor | dodge-attack | 20 | 16 | 0 | 1 | 3 |
| actor | limit-counter | 20 | 19 | 0 | 0 | 1 |
| actor | normal-attack | 20 | 19 | 0 | 0 | 1 |
| actor | perfect-parry | 20 | 17 | 0 | 3 | 0 |
| actor | plunging-attack | 20 | 20 | 0 | 0 | 0 |
| actor | star-carry | 18 | 17 | 0 | 1 | 0 |
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
