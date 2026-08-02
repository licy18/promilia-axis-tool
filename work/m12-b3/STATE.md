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
- B3-C-R1 product acceptance and C2 implementation baseline: `2804f201ac2a6ea4eebc1339703a9d40c0aba5a5`.
- B3-C2-R1 repair baseline: `942639f07d5a417f8145f8c11aadf006646dfbee`.
- The B3 contract was selectively synchronized from the dirty main-workspace plan on 2026-08-01; the main workspace was not modified.

## Frozen Plan Snapshot

- Character optimization objects: `11`, including one `STARBORN` object with source aliases `199001` and `199002`.
- Kibo: `43` (`22` wind/thunder single-element and `21` dual-element containing wind or thunder).
- Soul essence: `62`.
- Public equipment: `137`.
- Set-skill threshold records: `12`.
- Current known blockers include `50/62` soul-essence effect skills and `12/12` set skills classified as `dynamic-unapplied`; `12/62` source-closed soul effects are runtime-integrated but still lack complete qualification.
- Kibo DNA is outside the current product scope. The only canonical value is `dnaFactors: []`; omitted input normalizes to empty, non-empty input is rejected before compile/validate/search, and DNA evidence does not count as a qualification gap.

## Current Status

- B2 product acceptance is closed.
- B3-A-R1 is product-accepted at `f902de10c42c2c4dc750be2316fabe3bc026f8cc`. B3-B-R1 is product-accepted at `f846161c4a71bbc2de2b5bed3f598f03344fc692`; B3-C-R1 is product-accepted at `2804f201ac2a6ea4eebc1339703a9d40c0aba5a5`.
- B3-C2 source and denominator recomputation is complete: source `fcf7e135b22019c8`, roster `ab1fe6bdba580f21`, manifests `ddd8540432f737bc`, ledger `44943aece7e05da0`, catalog `ca1a9dae97651348`, binding matrix `ef739ad3c350c724`; dynamic census `d67e16da316ccb87`, soul effect catalog `b3fd516e07fd6424`, trigger contract `3ea277c2d63e2d6d`, PropertyTag contract `146e6a9a7db86606`.
- Generated roster, consolidated manifests, gap ledger, binding matrix, summary, and runtime catalog are deterministic under `npm run audit:optimization-qualification`.
- Strict cultivation profile v1 is wired into Machine Axis, canonical input hashing, and direct Workbench adapter round-trip. The frozen profile hash is `c432bd0a3f2d6415`: character `80 / star gift 7 / completed attributes through 6 / all current nodes / level breakthrough 3`; Kibo `80 / four talents 10 => 120 / bond 1 => 900 basis points / dnaFactors []`; soul essence `80 / rank 6 / star 1`; equipment `4-star / +9 / tuning 110 / starborn`.
- Formal qualification derives one whole-stage gate from the `11/43/62/137/12` records, admissions, set-skill thresholds, actor-Kibo/soul/equipment bindings, equipment slots, and source hashes. Partial green catalogs are rejected before project/search; research scenarios remain compatible.
- Static cultivation applies character level, completed star-gift attributes strictly through `selectedRank - 1`, current/prior eligible nodes, Kibo level/talents/bond, soul-essence level/rank, equipment enhancement, and source-backed tuning. `hero_rank` currently contributes only level/rank legality and auditable table declarations. Its attributes remain in `unappliedStaticSources`, and skill declarations do not imply availability or effect runtime.
- The reviewed `GameAssembly.dll` is `222485544B / c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`. Exact bindings include `HeroData.Populate(HeroAttrInfo)@0x2458520`, `RefreshAttributes@0x2458C00`, `RefreshHeroSkill@0x2458F50`, `AttrModuleInfo..ctor@0x244EE60`, `RefreshModules@0x244E9F0`, and `GameUtil.PackAttrInfoByFightAttr@0x39714F0`. These calls do not establish whether server-provided `HeroAttrInfo` already includes `hero_rank.attribute`; no adjacent-rank final-panel capture exists, so attribute application remains `runtime-evidence-required`.
- All 12 source character identities have six `hero_rank` rows. Owner `112001` has two source unlock IDs that disagree with its passive slots; the mismatch remains evidence-blocked. Existing runtime passive effects are recorded separately and do not prove breakthrough availability.
- Equipment instances preserve raw and resolved `instanceTier`, `bGoldSide`, and `maxValue`. Normal instances accept at most 100 tuning; starborn instances require the source-backed fixed maximum 110. Main and sub attributes use the same segmented `ceil` formula, and cultivation differences enter canonical input/build hashes without expanding search dimensions.
- Runtime-applied soul effects are `10001 汁石就是力量`, `10002 家书`, `10037 厨房的秘密`, `10055 远古秘钥`, `10060 宵祝`, `10093 无法思考`, `10094 陪伴`, `10097 玫瑰色午后`, `10098 此身为枪`, `10125 高手在此！`, `10154 月下秘仪`, and `10155 恶作剧前奏`. Leaf `defaultPropertyTags` remain source-bound. `10055/10093` use an OR of verified UltraSkill slot/tag selectors, expand `triggerEffectList.targetType=AllHero` into one command per hero at action-end, and retain the carrier as formula/effect source. `10097` uses the real `10101025/sub0` limit-counter binding at action-start. Formula base 3 is evaluated as `A/10000` dynamic-extra points through the shared Q16.16 registry; base 5 remains A points. `10018 飞行试验` remains blocked by its outer two-thunder-mark prerequisite.
- The public schema requires `levelBreakthroughRank`; legacy `ascensionRank` is rejected. Previous completed star-gift ranks apply all nodes, while the current rank applies only explicit node IDs. All 12 source character identities have 7 star-gift ranks, 6 level-breakthrough rows, and no missing rune source identity.
- C2-R1 separates source event semantics: BeforeSkill/AfterSkill require only `execute=true` and fire once even with no hits or all misses; BeforeDamage/AfterDamage still require landed hits; blocked actions fire neither. A real non-source teammate tuning packet proves active mastery/rawDamage gain and exact expiry to the no-soul baseline.
- Current C2-R1 verification: focused formula/census/runtime `5 files / 83 tests`, Machine Axis `12 files / 157 tests`, three-character profile/golden `3 files / 34 tests`, and canonical migration/combat runtime `3 files / 39 tests` passed. Optimization qualification, production imports, Workbench data, action status, applied-source, character acceptance, character combat, verified combat, and Kibo headless audits are clean. Production build passed with only pre-existing Sass/circular-chunk/large-chunk warnings.
- Current optimization-ready counts are zero for all five object kinds. M12-C remains locked.
- Current maturity is `229 extracted / 36 runtime-integrated`; all five optimization-ready counts remain zero. Blocking gaps are `446` unique (`430 not-implemented`, `16 evidence-insufficient`).
- Status: `B3-C2-R1 verification-complete-awaiting-product-acceptance`.

## Remaining Blockers

- Not implemented: `430` unique object-scoped blockers, including 50 unresolved soul-essence dynamic skills, 12 set skills, remaining runtime/visual qualification, and one missing STARBORN static actor profile. DNA contributes zero source or acceptance gaps.
- Evidence insufficient: `16` unique blockers: 11 character cultivation runtime boundaries, 4 selected Kibo passive gaps, and the owner `112001` level-breakthrough skill-unlock mismatch.
- Formal admission remains empty. B3-B-R1 keeps the static equipment foundation but does not claim `hero_rank` attribute or skill-availability closure, and it does not qualify characters, Kibo, soul essence, equipment, set skills, or their binding matrix for optimization.

## Hard Boundaries

- Do not run formal team/loadout/action-axis optimization.
- Do not start M12-C until the full `11/43/62/137/12` denominator and binding matrix qualify.
- Do not modify the dirty main workspace, UI, package size, performance, or unrelated character/Kibo mechanics.
