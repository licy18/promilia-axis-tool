# M12-B3-C11 AfterHeal Source-to-Target and Native Block

- Status: `verification-complete-awaiting-product-acceptance`
- Base: C10 production mechanics `785cc9b8c20b1cb995b4fe4f565a6e94101f8531`; C10-R1 product acceptance `ad27e7762fcc8ac96a47d00361cef08fe6dbc959`.
- Scope: `set-skill:5:4` and soul essence `10176`; no C12, M12-C, formal search, UI, package, performance, character, Kibo, or other loadout-effect work.

## Evidence Contract

The versioned evidence artifact is `scripts/optimization-qualification/evidence/soulessence-non-damage-runtime-evidence.json`, `10853B`, SHA-256 `70035b60930cc755abbff484494c370abbdb306f0af05895f7479f59c050f1e6`. It binds 12 exact ranges to GameAssembly `222485544B / c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b` and dump `97428254B / 0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a`.

`TriggerElement.GetTriggerTarget@0x13BBF50` routes Self to `self+0x28`, Target to `target+0x20`, and Source to `source+0x18`. `DamageUtility.OnAfterHeal@0x1872130` dispatches after settlement with distinct heal source and actual healed target. `TriggerElement.CheckCondition@0x13B58F0` proves empty OR is true. `AliveElementSystem.OnExecuteNormalElement.Block@0x131A545` proves an active same-config Block(5) duplicate is freed without stack or refresh; a later instance can apply after removal or the right-open expiry.

## Runtime Contract

Four or five valid set-5 pieces install `set-skill:5:4` once; three pieces and cross-set mixtures do not. An executed direct or periodic AfterHeal from the wearer applies attr1 `dynamicPercent +700` to the actual healed actor for `[apply, apply+6000ms)`. Full-health zero-effective healing still dispatches; rejected settlement, wrong source, or missing owner does not. A real teammate hit gains damage inside the interval and returns to baseline at the exact expiry frame.

Soul `10176` observes AfterHeal from its wearer only when the verified source skill tag is NormalAttack. It applies attr5 for 15000ms with star raw values `1460/1940/2430/2910`. Repeated healing while active is blocked without refreshing; the expiry-frame trigger starts a new instance. Periodic healing has no action provenance and cannot borrow a stale NormalAttack tag.

## Qualification

The denominator remains `11/43/62/137/12`. Runtime integration is `39/62` soul essences and `9/12` set skills. The unique ledger is `383 = 365 not-implemented + 18 evidence-insufficient`; remaining four-piece set gaps are exactly `set-skill:1:4`, `set-skill:3:4`, and `set-skill:6:4`. All five formal admission counts remain zero, `dnaFactors=[]`, and M12-C remains locked.

Final qualification hashes are source `132db3813d6f0e30`, roster `ee9c2f26717eb9a9`, manifests `b09e331ee024d724`, ledger `d2ee3867d75ddf13`, binding `aa6b08a6d79712e3`, and catalog `fc2623a2ba726407`. Dynamic census/catalog/source hashes are `6d37f034f4f64ea0 / 0a5b0311ef1281f4 / 4ef729b9b56d4f9e`.

## Verification

- C11 focused: `6 files / 139 tests`.
- Complete optimization qualification: `7 / 56`.
- Three-character profile/golden/migration: `4 / 38`; replay/profile hashes and gameplay assertions unchanged.
- Canonical/runtime/cycle: `5 / 87`; Machine Axis: `12 / 157`.
- Nine deterministic audits, production build, generation assert-clean, and `git diff --check`: passed.
- Standard Machine Axis hashes: `ed57d06444210db0 / 5c21e09cba3bab55 / 416b4a015702f1b2 / 0b410dc9255d2654`.
- C11 catalog metadata updates canonical trace hashes, including the B2 cycle report; input/data/evaluation, cycle damage, and authoritative replay semantics remain unchanged.
- Existing Sass deprecation, circular chunk, large chunk, package-size, and performance warnings remain non-blocking and were not worked on.
