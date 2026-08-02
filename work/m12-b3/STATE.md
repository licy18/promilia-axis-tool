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
- B3-C7 reviewed implementation baseline: `5647f1a74d74cb63b763ed06367ac8198084cab1`; C7-R1 repairs its non-damage projection resource ledger.
- The B3 contract was selectively synchronized from the dirty main-workspace plan on 2026-08-01; the main workspace was not modified.

## Frozen Plan Snapshot

- Character optimization objects: `11`, including one `STARBORN` object with source aliases `199001` and `199002`.
- Kibo: `43` (`22` wind/thunder single-element and `21` dual-element containing wind or thunder).
- Soul essence: `62`.
- Public equipment: `137`.
- Set-skill threshold records: `12`.
- Current known blockers include `37/62` soul-essence effect skills and `12/12` set skills classified as `dynamic-unapplied`; `25/62` source-closed soul effects are runtime-integrated but still lack complete qualification.
- Kibo DNA is outside the current product scope. The only canonical value is `dnaFactors: []`; omitted input normalizes to empty, non-empty input is rejected before compile/validate/search, and DNA evidence does not count as a qualification gap.

## Current Status

- B2 product acceptance is closed.
- B3-A-R1 is product-accepted at `f902de10c42c2c4dc750be2316fabe3bc026f8cc`. B3-B-R1 is product-accepted at `f846161c4a71bbc2de2b5bed3f598f03344fc692`; B3-C-R1 is product-accepted at `2804f201ac2a6ea4eebc1339703a9d40c0aba5a5`.
- B3-C7 source and denominator recomputation is complete: source `bad3205a3460c9d5`, roster `641261e69a1be33b`, manifests `9cf36adbb69c70e0`, ledger `9beae8053233eeda`, catalog `00fa04e110e78c23`, binding matrix `4568dc485d378145`. The non-damage evidence contract is `5872B / 1465c750e146825b4f4716e38051dcf06b1b897cefae0e55fb7cd6348b080552` against GameAssembly `222485544B / c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`.
- Generated roster, consolidated manifests, gap ledger, binding matrix, summary, and runtime catalog are deterministic under `npm run audit:optimization-qualification`.
- Strict cultivation profile v1 is wired into Machine Axis, canonical input hashing, and direct Workbench adapter round-trip. The frozen profile hash is `c432bd0a3f2d6415`: character `80 / star gift 7 / completed attributes through 6 / all current nodes / level breakthrough 3`; Kibo `80 / four talents 10 => 120 / bond 1 => 900 basis points / dnaFactors []`; soul essence `80 / rank 6 / star 1`; equipment `4-star / +9 / tuning 110 / starborn`.
- Formal qualification derives one whole-stage gate from the `11/43/62/137/12` records, admissions, set-skill thresholds, actor-Kibo/soul/equipment bindings, equipment slots, and source hashes. Partial green catalogs are rejected before project/search; research scenarios remain compatible.
- Static cultivation applies character level, completed star-gift attributes strictly through `selectedRank - 1`, current/prior eligible nodes, Kibo level/talents/bond, soul-essence level/rank, equipment enhancement, and source-backed tuning. `hero_rank` currently contributes only level/rank legality and auditable table declarations. Its attributes remain in `unappliedStaticSources`, and skill declarations do not imply availability or effect runtime.
- The reviewed `GameAssembly.dll` is `222485544B / c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`. Exact bindings include `HeroData.Populate(HeroAttrInfo)@0x2458520`, `RefreshAttributes@0x2458C00`, `RefreshHeroSkill@0x2458F50`, `AttrModuleInfo..ctor@0x244EE60`, `RefreshModules@0x244E9F0`, and `GameUtil.PackAttrInfoByFightAttr@0x39714F0`. These calls do not establish whether server-provided `HeroAttrInfo` already includes `hero_rank.attribute`; no adjacent-rank final-panel capture exists, so attribute application remains `runtime-evidence-required`.
- All 12 source character identities have six `hero_rank` rows. Owner `112001` has two source unlock IDs that disagree with its passive slots; the mismatch remains evidence-blocked. Existing runtime passive effects are recorded separately and do not prove breakthrough availability.
- Equipment instances preserve raw and resolved `instanceTier`, `bGoldSide`, and `maxValue`. Normal instances accept at most 100 tuning; starborn instances require the source-backed fixed maximum 110. Main and sub attributes use the same segmented `ceil` formula, and cultivation differences enter canonical input/build hashes without expanding search dimensions.
- Runtime-applied soul effects now also include `10048 璇枢` and `10175 一点都不痛`. C7 projects `SwitchEnter(34)`, `OnGotShield(40)`, and `AfterHeal(44)` from canonical switch/vital settlements; Self observes the native event subject and Target(1) resolves to the healed actor. `10169` remains evidence-insufficient because native shield refresh/replacement dispatch is open, and `10176` remains unapplied because combineType 5 is unresolved.
- The public schema requires `levelBreakthroughRank`; legacy `ascensionRank` is rejected. Previous completed star-gift ranks apply all nodes, while the current rank applies only explicit node IDs. All 12 source character identities have 7 star-gift ranks, 6 level-breakthrough rows, and no missing rune source identity.
- C2-R1 separates source event semantics: BeforeSkill/AfterSkill require only `execute=true` and fire once even with no hits or all misses; BeforeDamage/AfterDamage still require landed hits; blocked actions fire neither. It is product-accepted at `ba3422c722f8640857fa8fd9d19040e755c8484a`.
- C3 preserves EntrySkill trigger provenance, wrapper duration, unload paths, refresh/right-open expiry and replay inheritance. It is product-accepted at `e05b10fd27a6c723a773a7680169a9180031c48e`.
- C4 verification covers held-mark start/expiry, actual mark consume and landed overlimit packets, thunder/dark hidden branches, wind template element types, final skill tag, miss suppression, right-open expiry, refresh, same-packet no-self-benefit, numeric critical/toughness consequences and replay/cycle state.
- C4-R1 binds Priority mode to `ConsumePackElement.CalculateConsumeCount@0x1385260` and `DoInject@0x1386950`; it is product-accepted at `8bf0b3a77538102c1995dd5943e4a7275664ca0a`. C5 and C6 are product-accepted at `5c713e55ffdc46e5e75e9a4a4dcc1d0366201be0` and `5c5a33a21cce05fbf090af72c783bad475b55656`. C7 freezes switch, shield, heal and trigger interval consumers; direct/Kibo/tuning periodic heals share one event transaction without borrowing stale action tags.
- Verification passed: focused mechanics `3 files / 82 tests`, three-character profile/migration `4 / 38`, Machine Axis `12 / 157`, canonical/runtime `6 / 87`, nine deterministic audits, and production build.
- The current Machine Axis canonical hashes are `c8bfd28dcb890f4f / 98deb78db6293f88 / 8586fe2ee148b0fe / 0b410dc9255d2654`. Identity changed because ordered judgment groups and candidate-to-packet mappings became package data; evaluation, cycle evaluation `412605349bbf2fe3`, and all authoritative numeric assertions are unchanged.
- Current optimization-ready counts are zero for all five object kinds. M12-C remains locked.
- Current maturity is `216 extracted / 49 runtime-integrated`; all five optimization-ready counts remain zero. Blocking gaps are `420` unique (`402 not-implemented`, `18 evidence-insufficient`).
- C7-R1 resource parity covers manual resource, auto SP, direct SP, landed-hit actor/Kibo recovery and tuning overlimit direct SP. The projection emits direct heal/shield and periodic heal events only after the same resource cost gate as full runtime; it emits no damage/toughness events and consumes no critical samples.
- Verification passed: focused mechanics `3 / 100`, three-character profile/migration `4 / 38`, Machine Axis `12 / 157`, canonical/runtime `6 / 69`, nine deterministic audits, and production build.
- Status: `B3-C7-R1 verification-complete-awaiting-product-acceptance`.

## Remaining Blockers

- Not implemented: `402` unique blockers, including 37 unresolved soul-essence dynamic skills, 12 set skills, remaining runtime/visual qualification, and one missing STARBORN static actor profile. DNA contributes zero source or acceptance gaps.
- Evidence insufficient: `18` unique blockers, including the existing character/Kibo boundaries plus the source-bound shield refresh/replacement and combineType 5 runtime gaps.
- Formal admission remains empty. B3-B-R1 keeps the static equipment foundation but does not claim `hero_rank` attribute or skill-availability closure, and it does not qualify characters, Kibo, soul essence, equipment, set skills, or their binding matrix for optimization.

## Hard Boundaries

- Do not run formal team/loadout/action-axis optimization.
- Do not start M12-C until the full `11/43/62/137/12` denominator and binding matrix qualify.
- Do not modify the dirty main workspace, UI, package size, performance, or unrelated character/Kibo mechanics.
