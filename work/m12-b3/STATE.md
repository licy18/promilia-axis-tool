# M12-B3 Optimization Qualification

## Goal

Build a recomputable qualification boundary for the wind/thunder roster, STARBORN aliases, Kibo, soul essence, equipment, set skills, and their binding matrix. This stage does not run formal optimization. M12-C remains locked.

## Baseline

- Accepted M12-B2 implementation: `76530074f6c2fb1d2b88b4eee1d2fd558d01ce2b`.
- M12-B2 closeout commit: `db8c0506aa4dca9e9a4ef20ae34ca1920011f4c9`.
- Branch: `feature/m12-b3-optimization-qualification`.
- Worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m12-b3`.
- B3-A-R1 repair baseline: `c16954f79eabc392b9e8667b7faed3fa89de6d06`.
- B3-A-R1 product acceptance baseline: `f902de10c42c2c4dc750be2316fabe3bc026f8cc`.
- B3-B-R1 repair baseline: `96d1df271c4026857c70549b4d7a82c6c1821e7a`.
- B3-B-R1 product acceptance baseline: `f846161c4a71bbc2de2b5bed3f598f03344fc692`.
- B3-C-R1 product acceptance baseline: `2804f201ac2a6ea4eebc1339703a9d40c0aba5a5`.
- B3-C2 implementation baseline: `942639f07d5a417f8145f8c11aadf006646dfbee`.
- B3-C2-R1 product acceptance baseline: `ba3422c722f8640857fa8fd9d19040e755c8484a`.
- B3-C3 product acceptance baseline: `e05b10fd27a6c723a773a7680169a9180031c48e`.
- B3-C4 reviewed implementation baseline: `307daae3ca819c30f69153f108c9a3163a72729e`.
- B3-C4-R1 product acceptance baseline: `8bf0b3a77538102c1995dd5943e4a7275664ca0a`.
- B3-C5 product acceptance baseline: `5c713e55ffdc46e5e75e9a4a4dcc1d0366201be0`.
- B3-C6 product acceptance baseline: `5c5a33a21cce05fbf090af72c783bad475b55656`.
- B3-C7 reviewed implementation baseline: `5647f1a74d74cb63b763ed06367ac8198084cab1`; C7-R1 reviewed baseline: `8760b14b448ff22290895736a6f7b19c077fe589`; C7-R2 reviewed baseline: `bea37f42b273e57e11ca248fbd37764babfcc98d`; C7-R3 product acceptance baseline: `f73b0ac6a457719ad0e24b98415f2f9d67c3e8a5`.
- B3-C8 reviewed implementation baseline: `1b16f2ddcbc3594a2c5de964ff11933d1da37c63`.
- B3-C8-R1 product acceptance baseline: `26a8125b2ca262777ff11b12f37e7d32b68eac91`.
- B3-C9 product acceptance baseline: `bd812d64226a371a55a01981a239e33c318c9e98`.
- B3-C10 production mechanics baseline: `785cc9b8c20b1cb995b4fe4f565a6e94101f8531`; C10-R1 product acceptance baseline: `ad27e7762fcc8ac96a47d00361cef08fe6dbc959`.
- B3-C11-R1 product acceptance baseline: `8f01dba447106b03783582d58e80badb8a571b8e`.
- B3-C12-R1 product acceptance baseline: `5537e5a59f9776d7045b0ce8ad9915738715a9a4`.
- B3-C13 product acceptance baseline: `36217387c9197702088dfe15244569f86c6e43c5`.
- B3-C14 product acceptance baseline: `a5434a1e0b01c2d70db1832064e34f63fb44e279`.
- The B3 contract was selectively synchronized from the dirty main-workspace plan on 2026-08-01; the main workspace was not modified.

## Frozen Plan Snapshot

- Character optimization objects: `11`, including one `STARBORN` object with source aliases `199001` and `199002`.
- Kibo: `43` (`22` wind/thunder single-element and `21` dual-element containing wind or thunder).
- Soul essence: `62`.
- Public equipment: `137`.
- Set-skill threshold records: `12`.
- Current known blockers include `20/62` soul-essence effect skills and `1/12` set skill classified as `dynamic-unapplied`; `42/62` source-closed soul effects and `11/12` set skills are runtime-integrated but still lack complete qualification.
- Kibo DNA is outside the current product scope. The only canonical value is `dnaFactors: []`; omitted input normalizes to empty, non-empty input is rejected before compile/validate/search, and DNA evidence does not count as a qualification gap.

## Current Status

- B2 product acceptance is closed.
- B3-A-R1 is product-accepted at `f902de10c42c2c4dc750be2316fabe3bc026f8cc`. B3-B-R1 is product-accepted at `f846161c4a71bbc2de2b5bed3f598f03344fc692`; B3-C-R1 is product-accepted at `2804f201ac2a6ea4eebc1339703a9d40c0aba5a5`.
- B3-C10-R1 through C15 are product-accepted; C15 acceptance baseline is `aafb6aa6c645b7b7490fdba0f71b8941da311f6e`. Current generated hashes are source `661271d99b9e9b9e`, roster `93b5f932243f030b`, manifests `0700d78f431be1b9`, ledger `81dc3cbf160a4132`, catalog `fd4eb4442b914a17`, binding matrix `e2680052cfb8ea87`, dynamic census `637c622f607c7593`, and soul/set mechanics `9c5eba7a4694f5b6`.
- C11 functionality at `02935223e914af18cb0bf10abf324edbdd373e17` is the reviewed R1 base. C11-R1 closes native actionless periodic AfterHeal: accepted events and commands retain `actionId/sourceActionId=null`, one verified root source, the healed target, calculator settlement, stable event identity and stable source sequence. Action-linked direct healing stays single-fire; actionless healing cannot satisfy `10176` NormalAttack provenance.
- C11-R1 is product-accepted at `8f01dba447106b03783582d58e80badb8a571b8e`. C12 source-closes `set-skill:1:4` through `before-skill-composite-runtime-evidence.json` (`10538B / 165b87b2d5ea01f1a2f7f72a828b6a1eeeca19ef1f429003b2dccca457686212`); C12-R1 separates direct Kibo target identity from source-owner Kibo routing and is product-accepted at `5537e5a59f9776d7045b0ce8ad9915738715a9a4`.
- C13 source-closes `set-skill:6:4` through `after-damage-target-property-runtime-evidence.json` (`12185B / c60a582cda07b5e017cb47751a323f8958a6b1e292dc1a7f5bb34e7904374447`). The executable graph resolves the conflicting 30%/8s and 30%/24s text to attr202/203 +20% for 24 seconds. The triggering AfterDamage packet does not self-benefit; later packets do, Cover refreshes one target instance, unload removes only source roots, and `triggerCounter=999999` is a finite occurrence lifetime persisted in cycle state.
- C14 audits `set-skill:3:4` through `set-three-source-identity-evidence.json` (`12455B / 9e8e92d38a1924293aea7b772f7ba2c704913a27db8c5b22df2bb04f76c29418`) and is product-accepted at `a5434a1e0b01c2d70db1832064e34f63fb44e279`. The sole current graph conflicts with the formal localization and no 12-second/max-10 target graph exists, so runtime remains fail-closed.
- C15 closes the periodic persistent-root family through `periodic-persistent-property-runtime-evidence.json` (`13603B / da295df64cfde1d6770e19b542b9fd1cca35c559606ccf31f65b2b0273b68461`). `10084/10152/10197` use native tick cadence, finite Cover leaves, stable loadout provenance and cycle phase; `10078` remains evidence-insufficient because native matching for `[302,303]` is not closed.
- C12-R1 verification passes focused source/runtime `7 / 179`, complete optimization qualification `8 / 60`, three-character profile/golden/migration `4 / 38`, canonical/runtime/cycle `5 / 167`, Machine Axis `12 / 158`, nine deterministic audits and the 1875-module production build. The standard Machine Axis hashes remain `ed57d06444210db0 / 5c21e09cba3bab55 / 416b4a015702f1b2 / 0b410dc9255d2654`.
- C13 verification passes focused source/runtime `6 / 178`, complete optimization qualification `9 / 63`, three-character profile/golden/migration `4 / 38`, canonical/runtime/cycle `6 / 190`, Machine Axis `12 / 159`, nine deterministic audits, and the 1875-module production build. The standard Machine Axis hashes remain unchanged.
- Generated roster, consolidated manifests, gap ledger, binding matrix, summary, and runtime catalog are deterministic under `npm run audit:optimization-qualification`.
- Strict cultivation profile v1 is wired into Machine Axis, canonical input hashing, and direct Workbench adapter round-trip. The frozen profile hash is `c432bd0a3f2d6415`: character `80 / star gift 7 / completed attributes through 6 / all current nodes / level breakthrough 3`; Kibo `80 / four talents 10 => 120 / bond 1 => 900 basis points / dnaFactors []`; soul essence `80 / rank 6 / star 1`; equipment `4-star / +9 / tuning 110 / starborn`.
- Formal qualification derives one whole-stage gate from the `11/43/62/137/12` records, admissions, set-skill thresholds, actor-Kibo/soul/equipment bindings, equipment slots, and source hashes. Partial green catalogs are rejected before project/search; research scenarios remain compatible.
- Static cultivation applies character level, completed star-gift attributes strictly through `selectedRank - 1`, current/prior eligible nodes, Kibo level/talents/bond, soul-essence level/rank, equipment enhancement, and source-backed tuning. `hero_rank` currently contributes only level/rank legality and auditable table declarations. Its attributes remain in `unappliedStaticSources`, and skill declarations do not imply availability or effect runtime.
- The reviewed `GameAssembly.dll` is `222485544B / c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`. Exact bindings include `HeroData.Populate(HeroAttrInfo)@0x2458520`, `RefreshAttributes@0x2458C00`, `RefreshHeroSkill@0x2458F50`, `AttrModuleInfo..ctor@0x244EE60`, `RefreshModules@0x244E9F0`, and `GameUtil.PackAttrInfoByFightAttr@0x39714F0`. These calls do not establish whether server-provided `HeroAttrInfo` already includes `hero_rank.attribute`; no adjacent-rank final-panel capture exists, so attribute application remains `runtime-evidence-required`.
- All 12 source character identities have six `hero_rank` rows. Owner `112001` has two source unlock IDs that disagree with its passive slots; the mismatch remains evidence-blocked. Existing runtime passive effects are recorded separately and do not prove breakthrough availability.
- Equipment instances preserve raw and resolved `instanceTier`, `bGoldSide`, and `maxValue`. Normal instances accept at most 100 tuning; starborn instances require the source-backed fixed maximum 110. Main and sub attributes use the same segmented `ceil` formula, and cultivation differences enter canonical input/build hashes without expanding search dimensions.
- Runtime-applied soul effects now include `10176 温柔的照护`. C11 binds its AfterHeal Self observer and NormalAttack condition to native event provenance, routes Target(1) to the healed actor, and applies Block(5): an active same-config duplicate is discarded without stack or refresh, while the expiry-frame trigger can create a new 15-second instance. `10169/10170` remain blocked.
- C8-R1 derives direct-SP/heal/shield ordering from action and effect-graph provenance. Same-frame generated heals remain 100 before acquisition and 111 after acquisition even with 30 out-of-horizon descriptors inserted; missing-path legacy direct effects fail closed rather than using a global ordinal. The verified package is `20498c0f436fdcc3f0e86ebb6308ea75586d4b2379127d23ec4d971e81bb88e9` with file SHA-256 `b84aaca9cd3fe1384df62cbdde5db531a0339e1c6a988f3fb6c9088d7953a971`.
- C9 compiles direct persistent loadout properties through one source-driven contract. C15 separately handles periodic roots with finite leaves; `10084/10152/10197` are now runtime-applied while `10078` remains blocked only by its unresolved multi-PropertyTag matching semantics.
- C10 compiles `set-skill:2:4` and `set-skill:4:4` through one source-driven BeforeDamage stacking contract. `four-piece-set-stack-runtime-evidence.json` is `6868B / ae357c59a494f724c9ce36fde79df3fd505f1434c01c4b87697d5770f9cc98dc`; it binds five binary ranges plus `ChangePropertyElement.Combine`, `CombineLayer/DecreaseLayer` and `BaseElement.endTime` against GameAssembly `222485544B / c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`. Overlying uses one capped aggregate layer count with a refreshed shared absolute expiry; current-packet BeforeDamage ordering, Self isolation, miss/block suppression, unload and replay boundaries are covered.
- C11 extends the same source-driven runtime with `set-skill:5:4`: four or five valid set pieces install one AfterHeal binding, Source(2) observes the healer, Target(1) receives +7% attack for 6 seconds, full-health executed healing still dispatches, and wrong-source or rejected settlements do not. The reviewed evidence artifact is `10853B / 70035b60930cc755abbff484494c370abbdb306f0af05895f7479f59c050f1e6` and binds 12 exact binary ranges plus the reviewed dump identity.
- The public schema requires `levelBreakthroughRank`; legacy `ascensionRank` is rejected. Previous completed star-gift ranks apply all nodes, while the current rank applies only explicit node IDs. All 12 source character identities have 7 star-gift ranks, 6 level-breakthrough rows, and no missing rune source identity.
- C2-R1 separates source event semantics: BeforeSkill/AfterSkill require only `execute=true` and fire once even with no hits or all misses; BeforeDamage/AfterDamage still require landed hits; blocked actions fire neither. It is product-accepted at `ba3422c722f8640857fa8fd9d19040e755c8484a`.
- C3 preserves EntrySkill trigger provenance, wrapper duration, unload paths, refresh/right-open expiry and replay inheritance. It is product-accepted at `e05b10fd27a6c723a773a7680169a9180031c48e`.
- C4 verification covers held-mark start/expiry, actual mark consume and landed overlimit packets, thunder/dark hidden branches, wind template element types, final skill tag, miss suppression, right-open expiry, refresh, same-packet no-self-benefit, numeric critical/toughness consequences and replay/cycle state.
- C4-R1 binds Priority mode to `ConsumePackElement.CalculateConsumeCount@0x1385260` and `DoInject@0x1386950`; it is product-accepted at `8bf0b3a77538102c1995dd5943e4a7275664ca0a`. C5 and C6 are product-accepted at `5c713e55ffdc46e5e75e9a4a4dcc1d0366201be0` and `5c5a33a21cce05fbf090af72c783bad475b55656`. C7 freezes switch, shield, heal and trigger interval consumers; direct/Kibo/tuning periodic heals share one event transaction without borrowing stale action tags.
- C8-R1 verification passes focused source/runtime `8 files / 148 tests`, three-character profile/migration `4 / 26`, canonical/package boundary `3 / 27`, Machine Axis `12 / 157` with a 30-second process-heavy test budget, nine deterministic audits, and production build.
- C9 verification passes persistent-source/runtime `5 files / 125 tests`, three-character profile/migration `4 / 38`, canonical/runtime/cycle `5 / 52`, Machine Axis `12 / 157`, nine deterministic audits, production build, and `git diff --check`.
- C10-R1 verification passes focused source/protocol/runtime `5 files / 121 tests`, the complete optimization-qualification directory `6 / 53`, three-character profile/migration `4 / 34`, canonical/runtime/cycle `5 / 88`, Machine Axis `12 / 157`, nine deterministic audits, production build, and `git diff --check`.
- C10-R1 replaces the stale count-only set-skill assertion with exact remaining gap keys `set-skill:1:4/3:4/5:4/6:4`, exact runtime-integrated keys `set-skill:2:4/4:4`, and guards for the 12-item denominator, 8 runtime-applied set skills, `386 = 368 + 18`, empty formal admissions, `dnaFactors: []` and the M12-C lock. Its focused command passes `5 / 121`, and the complete optimization-qualification directory passes `6 / 53`.
- C11 verification passes focused source/protocol/runtime `6 files / 139 tests`, the complete optimization-qualification directory `7 / 56`, three-character profile/golden/migration `4 / 38`, canonical/runtime/cycle `5 / 87`, Machine Axis `12 / 157`, nine deterministic audits, production build, and `git diff --check`.
- C11-R1 verification passes focused source/protocol/runtime `7 files / 162 tests`, the complete optimization-qualification directory `7 / 56`, three-character profile/golden/migration `4 / 38`, canonical/runtime/cycle `5 / 87`, Machine Axis `12 / 157` with the established 30-second process-test budget, nine deterministic audits and production build. The default Machine Axis run had one 5.19-second timeout after 156 passing assertions; the same test passed alone in 1.47 seconds with no assertion mismatch.
- The current standard Machine Axis canonical hashes are `ed57d06444210db0 / 5c21e09cba3bab55 / 416b4a015702f1b2 / 0b410dc9255d2654`. C11 changes trace metadata through the dynamic loadout catalog while input, data, evaluation and authoritative numeric assertions remain unchanged.
- Current optimization-ready counts are zero for all five object kinds. M12-C remains locked.
- Current maturity is `188 extracted / 77 runtime-integrated`; all five optimization-ready counts remain zero. Blocking gaps are `375` unique (`354 not-implemented`, `21 evidence-insufficient`). Souls are `42/62` runtime-applied; set skills are `11/12`, with only `set-skill:3:4` still dynamic-unapplied.
- C7-R1 resource parity covers manual resource, auto SP, direct SP, landed-hit actor/Kibo recovery and tuning overlimit direct SP. The projection emits direct heal/shield and periodic heal events only after the same resource cost gate as full runtime; it emits no damage/toughness events and consumes no critical samples.
- C7-R2 binds the shared recovery gate to action execution, contextual occupancy, parseable DamageElement recovery fields, exact landed transaction/context identities and recover interval. `DamageElement.RecoverSP@0x138EEE0` is called independently from `AliveElementSystem.ExecuteDamageElement` at `0x1319594` (remote branch `0x1318E52`), so formula-input gaps keep damage unresolved without suppressing verified recovery. Missing/drifted identities, misses, blocked actions and recovery-source gaps fail closed in both runtimes.
- C7-R3 stores the recovery fields, local/remote callsites, executor/source `isMainControl` gates, `EPlayerNetworkState` semantics, SPSystem dispatch and 11 exact binary ranges in a versioned artifact. The generator revalidates its binary/dump/range hashes and the acceptance report reference. `isMainControl` is local network authority, not the active actor timeline, so production runtime remains unchanged.
- R3 verification passed: focused evidence/runtime `5 / 119`, three-character profile/migration `4 / 38`, Machine Axis `12 / 157`, nine deterministic audits, and production build. The accepted R2 canonical/runtime `6 / 72` remains applicable with zero production runtime diff.
- C14 verification and product acceptance are complete. C15 passes focused source/census/runtime/cycle `5 / 179`, complete optimization qualification `11 / 71`, three-character profile/golden/migration `4 / 38`, canonical/runtime/cycle `6 / 187`, Machine Axis `12 / 160`, nine deterministic audits, and the 1875-module production build. Standard Machine Axis hashes remain unchanged.
- Status: `B3-E4 implemented`（2026-08-05 用户恢复执行，E1-E4 已收口提交）。
- Next step: E5（剩余结构差异/混合分支项）；M12-C 与正式搜索保持锁定。

## B3 恢复执行计划（2026-08-05，用户已明确恢复）

排序原则：先易后难。每批以「源证据 + 生成器/运行时 + 测试 + 聚焦验证 + 提交」收口，逐批把 `source-indexed-runtime-unapplied` 与 `dynamic-unapplied` 转绿；五类 formal admission 与 M12-C 保持锁定直至全分母通过。

### 批次拆解（易 -> 难）

- **E1（已完成，2026-08-05）**：AfterDamage 空条件语义 —— `10101 归来 (1900200)` 已转绿。新增证据 `soulessence-after-damage-empty-condition-runtime-evidence.json`（`TriggerElement.CheckCondition@0x13B58F0` 空列表分支 + `OnAfterAttack`/`InvokeTriggerElement_DamageHandle` 派发路径，range `0x13B58F0-0x13B5950` 字节哈希固定）；生成器在 `compileSoulEffectDefinition` 对 AfterDamage 事件传入 `emptyConditionEvidence`（事件绑定字段为 `value`，非 `eventId`）；重生成机制/census/gaps。结果：runtime-applied 53→54（10101 条件 `always`、runtimeGaps 空），阻断 375→373（not-implemented 354→352）。验收报告推进至 `M12-B3-E1 / b3-e1-implemented`。
- **E1 验证**：优化资格套件 12 文件/74 测试、灵魂效果运行时 105/105（新增 10101 真实回放用例：首段不生效、后续段按 190 基数叠层、unscoped 标签）、Machine Axis 12/160、`audit:optimization-qualification` 幂等通过、`git diff --check` 通过。
- **E1 产出**：证据 JSON + `soulessence-after-damage-empty-condition-evidence.mjs` 校验模块 + 单测；生成器接线（sources/FROZEN hash/sourceSnapshot 嵌入/验收报告 sourceClosure 断言）；`dynamicLoadoutEffectCensus.test.js`、`optimizationQualificationProtocol.test.js`、`verifiedSoulEssenceEffectGeneration.test.js`、`beforeSkillCompositeEvidence.test.js` 同步。
- **E2（已完成，2026-08-05）**：激活前置条件 —— `10018 飞行试验 (1900400)` 已转绿。语义经二进制+表数据闭环：`conditionParam1=10000` 是**元素公式条件**，`ConditionalSelectionElement.CheckCondition@0x137E810` 对 `param1>=0x1388(5000)` 走 `BattleConfigManager.get_elementFormulaConfig → ElementFormulaData.GetId(param2) → FormulaUtility.Calculate`（`FormulaUtility.Calculate@0x187C840`，self/source/executor 实体，结果非零即真）；`param2` 是 `NewTable/element_formula.json` 公式 ID。19004001 绑定公式 1007 = `IF(self.ELEMENT_LAYERS[J]>K,G,0)`，functionParams 映射 J=250（调谐印记）、K=1、G=10000 → **装备角色印记 250 层数 > 1 时激活**。证据 `soulessence-activation-element-formula-condition-runtime-evidence.json`（5 段二进制范围 + element_formula 行 209/211/225/1007）；生成器把 activationPrerequisites 编译为 `activationConditions[{kind:'element-formula-layer-gt', formulaId, markId, minLayers, valueRaw}]`；运行时按 `tuningGeneration` 层数快照门控（`soulessence-effect-activation-condition-not-matched` suppression）。结果：runtime-applied 55/19，阻断 373→371（not-implemented 352→350）。验收报告推进至 `M12-B3-E2 / b3-e2-implemented`。
- **E2 验证**：优化资格套件 13 文件/76 测试、灵魂效果运行时 108/108（新增 10018 门控用例：无印记/错误印记 750/单层 250 均抑制，双层 250 触发 AllHero 12s attr58 加成）、Machine Axis 12/160、`audit:optimization-qualification` 幂等、`git diff --check` 通过。
- **E3（E3a/E3b/E3c 已完成，2026-08-05）**：composite 家族 —— E3a 多触发器单叶（10008/10071/10146）；E3b 多叶 `effectLeaves` 逐叶编译 + 触发器→叶 target 解析 + 事件元素条件校验（10121/10122/10170/10196）；E3c：`soulessence-before-damage-runtime-evidence.json` 扩展 BeforeDamage 空条件语义（event 1，`TriggerElement.CheckCondition@0x13B58F0` 空列表分支，`emptyConditionEvents:[1]`，conclusion 含 OnBeforeAttack 派发链），生成器/buildSoulTriggerEntry 对 event 1 注入 `emptyConditionEvidence`，triggerContract.beforeDamageRuntime 暴露 emptyConditionEvents。已关闭 **10132 暗中观察**（BeforeDamage/AfterHeal 双空条件 2 叶；runtime-applied 63/11，阻断 355，not-implemented 334）。E3c 验证：灵魂运行时 113/113、资格套件 13/76、Machine Axis 12/160、审计通过。E3 剩余（证据/源缺口，归 E5）：10076（元素类型 32 无档案）、10095（叶 19003206 缺星级数值源）、10063（event32+damage）、10011（event25+wrapper）、10198（tag5/14 动作映射证据）。
- **E4（已完成，2026-08-05）**：即时资源/治疗分支 —— `10107 药草大丰收 (1900350)`（AfterSkill tag3，direct-sp 18 + direct-heal 5% MAXHP，AllHero）与 `10216 耕种之时 (1900780)`（BeforeSkill tag14 PetUltraSkill，direct-sp 100000，ControllingHero）已转绿。契约新增 dump.cs 枚举绑定：`ESkillTagType.PetCommandSkill=5 / PetUltraSkill=14`（actionKinds 空，运行时按 `skillTagIds` 匹配）、`EElementTriggerTargetType.Pet=12`（pet-actor）、`ETriggerEffectTargetType.ControllingHero=3`（controlling-hero）。生成器：damageRows 排除 heal 行（base 104/108）避免误归伤害分支；即时效果按 `recoverType`/heal 公式行编译 `immediateEffects`（mechanismFamily `equipped-actor-immediate-resource-heal-effect`）；属性/持久分支遇到未编译即时行加 `effect-immediate-effect-unapplied` 守卫（10032 唤灵=属性+治疗混合，保持诚实 unapplied）。运行时：`resolveSoulImmediateEffectTargets` 支持 `controlling-hero`（按 `eventContext.controlledActorId` 解析，缺失 fail-closed）。结果：soul 级 runtime-applied 52→54（census 记录 63→65/11→9），阻断 355→351（not-implemented 334→330），dynamic-unapplied 10→8。验收报告推进至 `M12-B3-E4 / b3-e4-implemented`。
- **E4 验证**：优化资格套件 13 文件/76 测试、灵魂效果运行时 115/115（新增 10107 全队 SP+5%MAXHP 治疗、10216 宠物大招回 SP 两条真实回放用例）、Machine Axis 12 文件/160 测试、`audit:optimization-qualification` 幂等、`audit:applied-source-bindings:check` 通过、生产构建通过、`git diff --check` 通过。
- **E5**：剩余结构差异/混合分支项 —— `10032 唤灵`（属性+即时治疗混合，待组合编译）、`10011`（event25+wrapper）、`10063`（event32+damage）、`10076`（元素类型 32 无档案）、`10095`（叶 19003206 缺星级数值源）、`10198`（tag5/14 已绑定但第二触发器 SelfPet=9 目标仍未解析）、`10169`（shield refresh/replacement，证据项）、`10078`（多 PropertyTag，证据项归 E6）。
- **E6**：证据硬项 —— `10169 软软棉花肉 (1900750)` shield refresh/replacement、`10078 星晚的追忆 (1900460)` 多 PropertyTag、`set-skill:3:4` source identity、4 个 kibo passive evidence（500082/500185/500231/500360）、`112001` 解锁来源 mismatch、hero_rank final-panel 证据（11 角色 + STARBORN）、STARBORN 静态 profile。
- **E7**：视觉/产品验收 —— 137 装备、62 灵魂、43 奇波、11 角色、12 套装逐对象走四态链与 Workbench 签收；全绿后才解锁 M12-C（不在此阶段执行正式搜索）。

### 硬边界（沿用）

- 不执行正式队伍/装配/轴搜索；不启动 M12-C；不动主 checkout 的脏 reports；不扩张搜索维度。

## Remaining Blockers

- Not implemented: `330` unique blockers, including 8 unresolved soul-essence dynamic skills, remaining runtime/visual qualification, and one missing STARBORN static actor profile. DNA contributes zero source or acceptance gaps.
- Evidence insufficient: `21` unique blockers, including the existing character/Kibo boundaries, the source-bound shield refresh/replacement gaps, `set-skill:3:4`, and the `10078` multi-PropertyTag contract.
- Formal admission remains empty. B3-B-R1 keeps the static equipment foundation but does not claim `hero_rank` attribute or skill-availability closure, and it does not qualify characters, Kibo, soul essence, equipment, set skills, or their binding matrix for optimization.

## Hard Boundaries

- Do not run formal team/loadout/action-axis optimization.
- Do not start M12-C until the full `11/43/62/137/12` denominator and binding matrix qualify.
- Do not modify the dirty main workspace, UI, package size, performance, or unrelated character/Kibo mechanics.

## 预存外部漂移（非 E2 引入，等待决策）

- `audit:verified-combat` 在已提交基线上即失败：`C:/PC2/Codex/AzPr/BWiki/data/combat-formula-knowledge.json` 外部源已从 v3.1.1（sha256 `ba27896e…`、66263B）漂移到 v3.1.2（`8671ad36…`、87062B）；重生成会改写 verified-combat 包、M10 报告与角色战斗档案，并使 Machine Axis canonical hashes 全部漂移。按规则不静默重定基线，保持已提交基线不动；是否重定基线/重验收由用户决策。
- E2 仅更新了 `reports/applied-source-binding-audit.json`（loadoutPropertyTagSourceCount 49→51，对应 10101/10018 两个新 runtime-applied 灵魂），单独提交。
