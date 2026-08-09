# 103002 红宝石 M12-B3 来源账本

## 边界与基线

- 实现基线：`ee5c4cf817521165186f438f274893c91dfb1280`。
- 产品场景：`m12c-zero-distance-passive-boss-v1`。距离为 0，投射物立即命中；Boss 静止且不攻击。
- 来源 inventory 固定为 696：variant-edge 301、control-window 159、hit 124、semantic effect 46、action-effect binding 3、critical 9、variant-window 4，其余为 action/public/resource/stat/chain 协议行。
- 闭合前矩阵：required/pass/N/A/blocked=`335/168/361/167`；sourceGap=71、acceptanceGap=161、blocking ledger=232。
- 闭合保留 696 条 requirement/source 语义记录。星技 `10300212/sub0` 的 action-form identity 从旧的 Workbench 合成标识 `actor|103002|10300212|0|10300212|star-skill:default` 规范化为来源化标识 `actor:103002:star-skill:ruby-artistic-dance`；两者动作坐标相同，这是唯一 identity 迁移，不是删减 requirement。场景不可达行只允许精确、来源化 N/A；主动可达行必须由 canonical trace 证明。

主要来源为：

- `scripts/character-combat/profile-recipes/103002.json`
- `src/data/generated/character-combat-owner-contracts/103002.json`
- `reports/m10/103002/source-manifest.json`
- `reports/m10/103002/golden-trace.json`
- `reports/m10/103002/reachable-graph.json`
- `reports/m10/103002/action-phase-coverage.json`
- `reports/m10/103002/action-transition-coverage.json`
- `reports/m10/103002/unresolved-ledger.json`
- `scripts/character-acceptance/acceptance-recipes/103002.json`
- `fixtures/character-acceptance/103002-visual.json`

## 主动可达动作面

| 动作          | control/sub                                            | 来源结论与真实验收                                                                                                                                                                    |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 普攻 A1/A2/A3 | 10300201/0、10300202/0、10300203/0                     | 0 距离 projectile 在 11F、13F、18F/23F landed；4 条 runtime-dependent projectile hit 为 applied，不得 N/A。                                                                           |
| 强化 E1-E12   | 10300201/1-3、10300202/1-3、10300203/1-3、10300204/0-2 | 星技填充 12 弹药后逐段消费 1；覆盖全部 hit/window/edge。每段 3F 的 element 103002279 产生 4s 标记，需 apply/refresh/expire、同帧旧 expire 在新 acquire 前、右开边界与中断后自然到期。 |
| 装填          | 10300210/0                                             | 24F +6 弹药；quick-enhanced 为 `[24,264)`，锁 start-1/start/end-1/end。                                                                                                               |
| 星技          | 10300212/0                                             | 37/44/49/54/59/64/69F 七 hit；0F 弹药设为 12、fire mark 150/151；binding 必须绑定本 control/sub。                                                                                     |
| 星鸣派生      | 10300226/0                                             | 与来源 Kibo break 同帧调度，40F 命中；不能以 `facts=true` 代替。                                                                                                                      |
| 星决          | 10300213/0                                             | 117-325F 共 25 hit；113F 弹药设为 12，114F 红热 +6，quick-enhanced `[329,537)`。雷印 250 的 judgment element 103002273 在 173F/237F 逐次执行。                                        |
| 离场星携      | 10300221/0                                             | 切出再切回主动派生；58/64/70/76/82F 五 hit，54F thunder mark 250 与 252/253 暴击属性效果。direct-enhanced 为 `[80,112)`。                                                             |
| 被动红热      | 10300261/0                                             | max 6、15s、attr229 dynamicExtra raw20；强化链与星决真实 trace 覆盖叠层、刷新和右开到期。                                                                                             |

三条 action-effect binding 分别由真实动作坐标闭合：星技 10300212/0 -> fire mark 150；星决 10300213/0 -> 红热 103002276；星携 10300221/0 -> thunder/critical 250、252、253。仅 effect ID 相同而 control/sub 不同不得串证。

## 来源差距裁决

1. **duplicate window**：raw edge `10300213/sub0 -> 10300201/sub1`、path `-315085305908719333`、297F 的重复 export 保留 identity 并以 `duplicate-variant-window-normalized:ruby-ultimate-end-quick-enhanced-entry` N/A。正式 4s binding `[329,537)` 仍 applied；path `-4356077336397377105` 的独立 2s battle-effect edge 也保留，不能合并删除。
2. **re-exported container**：仅 `actor:103002:internal-control:10300253` 以 `reexported-subskill-container-unreachable-from-current-skill-list` N/A。同一 `ast_17387500135400000` 子树对其他来源仍有效。
3. **resource-root wrapper**：path `3663436943335475859` / element 103002047 的 19 条 root wrapper 为 `resource-root-wrapper-reference-not-a-runtime-transaction` N/A；派生 typed transaction（强化 consume1、装填 gain6、星技/星决 set12）必须分别 applied。
4. **current-client unreachable**：legacy elements 103002252/103002253、未命名第二被动 10300262、零 incoming closure 的 backup/re-exported controls（含 10300241/43/44）按各自 source closure 精确 N/A；不得与主动的全局 elements 252/253 混淆。
5. raw children 103002047/103002087 是弹药 wrapper 子节点，按 element path 精确 N/A；不能把同 control 的 103002279 一起吸收。103002279 在 E1-E12 主动可达，必须由真实 lifecycle trace applied；仅不可达 internal 10300244 来源 N/A。
6. root judgment 103002273/103002274 由同 graph、同 trigger、带 `judgmentElementId` 指针的 applied child contract 结算。103002273 的 173F 与 237F identity 必须按 behaviorPath 分开：一层雷印时前者 `before=1 -> after=0`，后者仍 executed 但 `insufficient-marks`；两层时两次均消费；零层时两次均不得生成 consume/damage。canonical trace 必须保留 `applied=false` 的执行判断。

## 冻结场景 N/A

以下来源保留，但产品 Boss 不提供所需刺激，因此不得排程或伪造敌击：

- 10300215 dodge attack；
- 10300211 plunging；
- 10300225 limit counter；
- 10300227 perfect parry 及派生 10300249 focus counter；
- 依赖精准闪避、受击、完美防御或 Boss 攻击事件的 effect/window/resource 分支。

这些行统一携带 `m12c-zero-distance-passive-boss-out-of-scope` 场景原因，并保留原 source identity。历史 M10 golden 中直接调度 `ruby-limit-counter` 只作为旧 trace 来源，不能作为本产品场景可达证据。

## 验收停点

- 正例必须与 miss、blocked、资源不足、全 miss、中断前/后、右开到期、同帧排序形成成对 trace。
- Workbench import/export、Machine Axis canonical replay、JSON round-trip 与 hash 均应稳定。
- 既有截图 `reports/m11-d-character-acceptance-103002-desktop.png` 保留；产品视觉状态保持 `pending`。
- 本支线不签 visual、formal admission 或 optimization-ready；全局 catalog/index/qualification/binding/hash 由中央集成后统一重生成。
