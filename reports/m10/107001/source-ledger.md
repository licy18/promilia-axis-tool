# 107001 西芙莉雅 M12-B3 来源账本

本账本只覆盖 `m12c-zero-distance-passive-boss-v1` 的缩减动作面：距离 0、投射物立即命中、Boss 静止且不攻击。它记录角色级 `extracted -> runtime-integrated` 工程证据，不代表产品视觉签收、formal admission 或 optimization-ready。

## 来源根与结论

| 机制              | 原始来源                                                                                                                      | 已核对结论                                                                                                                                                                   | 运行时合同                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 普攻箭与风语      | `skill_control_10700101.asset`、`skill_control_10700102.asset`、`skill_control_10700103.asset`、对应 Bullet collision element | A1 为 1 箭（12F），A2 为 2 箭（7/17F），A3 为 3 箭（31F 同帧三弹）；只有实际 landed 的每支箭各加 1 风语                                                                      | `landed-action-hit` 门控的 6 个 source-driven resource operation；miss 与 blocked action 不得增加     |
| 风语阈值          | `ast_107001006.asset`、`ast_107001133.asset`                                                                                  | `combineType=4`、`combineNumber=10`；第 10 层先达到阈值再清零，获得 12s 的 107001133，在该状态内后续风语 gain 被抑制；星鸣 53F 的 107001134 清除此状态，可再次累积并重复触发 | 通用 threshold transition：`at-least -> clear -> state/effect/companion grants`                       |
| Lumi 召唤与归属   | `ast_107001100.asset`、`battlefield_item[id=480056]`                                                                          | unit 480056，`life=12000`、最多 1、随 owner 死亡、切人离场；`bornSkillSlot#4` 对应 48005601..48005604；目标继承 owner 当前敌方目标                                           | 通用 companion profile，记录 owner/actor/target；自然到期、星鸣响应离场、切人离场分别可观察           |
| Lumi 周期攻击     | `skillsub_logic[48005601]`、`skill_control_48005601.asset`                                                                    | `aiTokenResetCD=5`，召唤后 5s 首次、之后每 5s；每次 24/29/34F 三段。107001154 判断 3 层风印记，基础 107001099、增强 107001155，不消费印记                                    | source-driven cadence 与 conditional damage group；切人/离场后不再排程                                |
| Lumi 重击联动     | `skill_control_48005602.asset`、107001156/137/157                                                                             | owner 重击触发；23F 发射 5 枚，延迟 0/100/200/300/400ms；3 层风印记选择增强分支且不消费                                                                                      | action response 与五个 child transaction；不因 `endsCompanionAtFrame=null` 误离场                     |
| Lumi 星鸣联动     | `skill_control_48005603.asset`、107001158/138/159                                                                             | 星鸣启动时取消周期攻击，80/85/90/95/100F 五段，105F 离场                                                                                                                     | action response，显式 `cancelPeriodicOnStart=true`、`endsCompanionAtFrame=105`                        |
| 星结合击          | `skill_control_10700126.asset`、107001148                                                                                     | 公开默认 `sub0` 在 40F 结算 1 次来源命中；未选 `sub1` 仍保留在 control 来源，不进入默认公开动作结算                                                                          | 原始 source hit；反例证明不会误套 tuning-mark conditional damage group                                |
| 星携技            | `skill_control_10700121.asset`、`ast_bullet_107001154.asset`、107001209                                                       | 入场技能在 60F 由三个发射行为射出 `3+1+1` 共 5 箭；零距离 Boss 命中分支每箭注入 107001209；地面碰撞分支不在该命中场景                                                        | 5 个独立 source-driven hit identity，保留同帧多弹，不被按帧去重                                       |
| 星鸣风印记与伤害  | `skill_control_10700112.asset`、107001218/220/222/224/226、750                                                                | 首击 10F 与 750 同帧；队列顺序为到期 0、获得 1、条件伤害 4，因此原 2 层时首击先到 3 层再选择增强伤害。后续 21/39/57F，末段 90F 三弹延迟 0/15/30ms                            | 5 个 conditional damage group + 命中门控 acquire；miss 不加印记也不结算该 hit；90F 中断会移除末段三弹 |
| 星决风印记与伤害  | `skill_control_10700113.asset`、107001149/204/152、750                                                                        | 首击 133F 先加 1 层风印记，再结算条件分支；141/147/153/159F 四段，165F 末段                                                                                                  | 3 个 conditional damage group + 命中门控 acquire；需要 100 SP，资源不足时整动作阻断且无派生事务       |
| 风印记生命周期    | `ast_750.asset` 与调谐运行时来源                                                                                              | 最大 5 层；满层再次获得的净增量为 0，但刷新共享衰减时钟；每 20s 逐层衰减；精确到期同帧先过期再获得                                                                           | 通用 FIFO/shared-decay 队列，正例覆盖 5 层刷新与逐层衰减，反例覆盖 exact-boundary/miss/blocked        |
| 10 层风语重击增益 | `ast_107001262.asset`                                                                                                         | attr 21、`dynamicExtra=3000`、tag 301、持续 24s；再次触发采用 Cover/refresh；右开区间，精确到期时先过期再 APPLY                                                              | threshold `effectGrants`；正例验证 24199ms 为 REFRESH，24200ms 为 APPLY                               |
| 被动 10700161     | hero skill 10700161、`ast_107001162.asset`                                                                                    | 风印记至少 3 层时 ATK `dynamicPercent=1600`，低于 3 层移除，不消费印记                                                                                                       | `tuning-mark-threshold-property-runtime`，由印记增减/衰减统一驱动                                     |

## 资源、CD 与动作边界

- 星鸣技 10700112 的来源 CD 为 18000ms；星决技 10700113 消耗 100 SP；重击由 250ms hold 入口选择 10700110；入场星携技 10700121 的来源 CD 为 24000ms。
- 条件派生只在父动作 `ready && executed` 时建立。父动作因 SP/CD/Charge 阻断时不产生风语、风印记、Lumi 或条件伤害。
- 命中 override 的 `miss` 会同时关闭该 hit 的伤害与绑定获得；不存在独立 blocked-hit 来源，blocked 负例使用动作预检拒绝。动作中断按半开执行区间裁剪末 hit，有效占用在星鸣 90F 处右开截断时末段三弹均不出现。

## 场景外与未实装边界

- 移动同时普攻的额外箭、专用闪击/闪避、跃击/跳跃/下落、完美闪避、格挡/招架、极限反击，以及任何必须消费 Boss 攻击事件的动作，保留来源但标为 `scenario-out-of-scope` N/A。
- `hero_rank` 是当前客户端未实装死配置，不进入运行时或培养输入。
- 10700162 是无名第二被动，当前按未实装 N/A。
- 本轮没有奇波输入；`dnaFactors` 规范值固定为 `[]`。

## 角色级验证边界

- 权威角色产物：`scripts/character-combat/profile-recipes/107001.json`、owner contract/profile、`reports/m10/107001/*`。
- 聚焦正负例：`src/__tests__/simulation/sifliya107001Runtime.test.js`。
- 角色 Machine Axis fixture 与 acceptance recipe 已提供，但产品视觉签收仍为 `pending`；全局 mechanics package、acceptance manifest/index、资格/binding/summary/catalog 只由中央集成线统一重生成。
- owner profile 的 `zeroDistance` 场景闸门已全部通过；这只表示本缩减场景可模拟，仍不等于 formal admission、产品视觉验收或 optimization-ready。
