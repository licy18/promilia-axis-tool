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
- The B3 contract was selectively synchronized from the dirty main-workspace plan on 2026-08-01; the main workspace was not modified.

## Frozen Plan Snapshot

- Character optimization objects: `11`, including one `STARBORN` object with source aliases `199001` and `199002`.
- Kibo: `43` (`22` wind/thunder single-element and `21` dual-element containing wind or thunder).
- Soul essence: `62`.
- Public equipment: `137`.
- Set-skill threshold records: `12`.
- Current known blockers include `23/62` soul-essence effect skills and `1/12` set skill classified as `dynamic-unapplied`; `39/62` source-closed soul effects and `11/12` set skills are runtime-integrated but still lack complete qualification.
- Kibo DNA is outside the current product scope. The only canonical value is `dnaFactors: []`; omitted input normalizes to empty, non-empty input is rejected before compile/validate/search, and DNA evidence does not count as a qualification gap.

## Current Status

- B2 product acceptance is closed.
- B3-A-R1 is product-accepted at `f902de10c42c2c4dc750be2316fabe3bc026f8cc`. B3-B-R1 is product-accepted at `f846161c4a71bbc2de2b5bed3f598f03344fc692`; B3-C-R1 is product-accepted at `2804f201ac2a6ea4eebc1339703a9d40c0aba5a5`.
- B3-C10-R1 is product-accepted at `ad27e7762fcc8ac96a47d00361cef08fe6dbc959`; C10 production mechanics remain frozen at `785cc9b8c20b1cb995b4fe4f565a6e94101f8531`. C11-R1 and C12-R1 are product-accepted; C13 is limited to `set-skill:6:4` and awaits product acceptance. Current generated hashes are source `52aefbcdd3136e43`, roster `fd752ae90abcb097`, manifests `6eedb0da6923c0c1`, ledger `afad67326a28035d`, catalog `64a821822e0362fa`, binding matrix `4eccbccddb161a51`, dynamic census `59553fb7be3d86fb`, and soul/set mechanics `1648903a7e038e2c`.
- C11 functionality at `02935223e914af18cb0bf10abf324edbdd373e17` is the reviewed R1 base. C11-R1 closes native actionless periodic AfterHeal: accepted events and commands retain `actionId/sourceActionId=null`, one verified root source, the healed target, calculator settlement, stable event identity and stable source sequence. Action-linked direct healing stays single-fire; actionless healing cannot satisfy `10176` NormalAttack provenance.
- C11-R1 is product-accepted at `8f01dba447106b03783582d58e80badb8a571b8e`. C12 source-closes `set-skill:1:4` through `before-skill-composite-runtime-evidence.json` (`10538B / 165b87b2d5ea01f1a2f7f72a828b6a1eeeca19ef1f429003b2dccca457686212`); C12-R1 separates direct Kibo target identity from source-owner Kibo routing and is product-accepted at `5537e5a59f9776d7045b0ce8ad9915738715a9a4`.
- C13 source-closes `set-skill:6:4` through `after-damage-target-property-runtime-evidence.json` (`12185B / c60a582cda07b5e017cb47751a323f8958a6b1e292dc1a7f5bb34e7904374447`). The executable graph resolves the conflicting 30%/8s and 30%/24s text to attr202/203 +20% for 24 seconds. The triggering AfterDamage packet does not self-benefit; later packets do, Cover refreshes one target instance, unload removes only source roots, and `triggerCounter=999999` is a finite occurrence lifetime persisted in cycle state.
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
- C9 compiles persistent loadout properties through one source-driven contract. Twelve soul roots and six two-piece set roots install once with actor/loadout/control/map/element sequence provenance; `10133` keeps both leaves. `10078/10084/10152/10197` remain blocked because their graph contains conditional wrappers or finite duration and does not satisfy the persistent-root contract.
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
- Current maturity is `191 extracted / 74 runtime-integrated`; all five optimization-ready counts remain zero. Blocking gaps are `381` unique (`363 not-implemented`, `18 evidence-insufficient`). Souls remain `39/62` runtime-applied; set skills are `11/12`, with only `set-skill:3:4` still dynamic-unapplied.
- C7-R1 resource parity covers manual resource, auto SP, direct SP, landed-hit actor/Kibo recovery and tuning overlimit direct SP. The projection emits direct heal/shield and periodic heal events only after the same resource cost gate as full runtime; it emits no damage/toughness events and consumes no critical samples.
- C7-R2 binds the shared recovery gate to action execution, contextual occupancy, parseable DamageElement recovery fields, exact landed transaction/context identities and recover interval. `DamageElement.RecoverSP@0x138EEE0` is called independently from `AliveElementSystem.ExecuteDamageElement` at `0x1319594` (remote branch `0x1318E52`), so formula-input gaps keep damage unresolved without suppressing verified recovery. Missing/drifted identities, misses, blocked actions and recovery-source gaps fail closed in both runtimes.
- C7-R3 stores the recovery fields, local/remote callsites, executor/source `isMainControl` gates, `EPlayerNetworkState` semantics, SPSystem dispatch and 11 exact binary ranges in a versioned artifact. The generator revalidates its binary/dump/range hashes and the acceptance report reference. `isMainControl` is local network authority, not the active actor timeline, so production runtime remains unchanged.
- R3 verification passed: focused evidence/runtime `5 / 119`, three-character profile/migration `4 / 38`, Machine Axis `12 / 157`, nine deterministic audits, and production build. The accepted R2 canonical/runtime `6 / 72` remains applicable with zero production runtime diff.
- Status: `B3-C13 verification-complete-awaiting-product-acceptance`.

## Remaining Blockers

- Not implemented: `363` unique blockers, including 23 unresolved soul-essence dynamic skills, the remaining `set-skill:3:4` identity conflict, remaining runtime/visual qualification, and one missing STARBORN static actor profile. DNA contributes zero source or acceptance gaps.
- Evidence insufficient: `18` unique blockers, including the existing character/Kibo boundaries plus the source-bound shield refresh/replacement gaps.
- Formal admission remains empty. B3-B-R1 keeps the static equipment foundation but does not claim `hero_rank` attribute or skill-availability closure, and it does not qualify characters, Kibo, soul essence, equipment, set skills, or their binding matrix for optimization.

## Hard Boundaries

- Do not run formal team/loadout/action-axis optimization.
- Do not start M12-C until the full `11/43/62/137/12` denominator and binding matrix qualify.
- Do not modify the dirty main workspace, UI, package size, performance, or unrelated character/Kibo mechanics.
