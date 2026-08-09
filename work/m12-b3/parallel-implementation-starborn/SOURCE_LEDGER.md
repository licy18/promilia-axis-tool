# STARBORN source ledger

## Frozen scenario scope

`m12c-zero-distance-passive-boss-v1`: actor and stationary passive Boss at distance 0; projectiles settle immediately; no default movement; pickups require a source-backed active absorb; the Boss emits no attack/received-hit stimulus for player defense reactions.

Source rows are retained even when the scenario cannot stimulate them. Boss-attack, received-hit, dodge/parry/counter, movement, airborne and distance-change requirements are structured `scenario-out-of-scope` N/A, never deleted or treated as runtime facts.

## Required source set

| Source | Female alias | Male alias | Initial decision |
| --- | --- | --- | --- |
| Generated actor catalog | `characters.items[id=199001]` | `characters.items[id=199002]` | independent static profiles |
| BWiki hero module | `199001.hero-module.local.json` SHA-256 `C6A3CE6FE3971ACFD1055B52C9256F6D540B7402FEE9816D859F770DF2817B4F` | `199002.hero-module.local.json` SHA-256 `C37DFD05E73082E09B17A09FF64ECC83B42806DEFE6BC78457C632309823CF25` | descriptions are discovery evidence, not frame truth |
| NewTable hero | `hero.rows[id=199001]`, unit `104001` | `hero.rows[id=199002]`, unit `112001` | distinct alias identity |
| NewTable public skills | suffixes `01,12,13,22,61,62` | suffixes `01,12,13,22,61,62` | normalized text/value/CD/SP equivalent |
| Skill controls | 32 asset suffixes | same 32 plus `42` | separate timing/hit/effect contracts |
| Passive marker | `ast_199001214`, path `-8155119979656171371` | `ast_199002343`, path `8072606077914887740` | persistent source marker |
| IL2CPP | TC dump enum/formula/target/share/switch paths | same runtime consumer | enum/formula semantics only when linked by asset source |

## Public surface

Both aliases expose the same normalized public labels, but not the same execution trace:

- normal attack: five input segments;
- charged attack: default plus derived form and follow-up thrust chain;
- star skill plus thrust follow-up;
- star combo;
- ultimate;
- switch/star-carry;
- dodge attack and plunging attack (scenario N/A);
- limit counter and perfect parry (scenario N/A);
- passive 1 marker-gated 20s team attack/target defense effects;
- passive 2 charged-derived self attack effect, sourced from the charged tree rather than the empty passive container.

## Proven shared semantics and differences

Shared after ID normalization:

- hero rarity/weapon/position/element/cost/battle tags;
- base combat attribute vector;
- six public skill descriptions, labels, twelve-level values and CD/SP;
- passive marker semantics and star-skill conditional effect values;
- ultimate semantic: add one layer to each already-present elemental tuning mark;
- switch semantic: add one layer to existing marks and apply a 24s inheritable team attack state.

Not shared:

- actor unit and asset identities;
- control path IDs, animation resources, timing, hit frames/counts and element IDs;
- source hashes;
- male-only empty control `19900242` versus missing female asset `19900142`.

Consequently, semantic equivalence may be reported only as a normalized mechanism comparison. Profile, input, data, trace and build identity must retain the selected alias and remain different.

## Baseline blockers

The current global qualification record is one object (`STARBORN`) with both source identities and exactly three blockers: missing static profile, unpublished acceptance, and not optimization-ready. This branch will provide static/mechanism/acceptance candidate artifacts for both aliases but will not sign product visual or optimization readiness.

## Closed source decisions

- Every compiled action/effect/hit/resource/control-window row retains its source identity. Final blocking source gaps are zero for both aliases; non-blocking records are source-retained policy exclusions or dead/empty controls.
- The star-skill passive is not inferred from prose. First-landed-hit action-effect bindings at 16F link the alias-specific hit subtree to the 20s team attack and enemy defense effects (`199001211/215`, `199002340/344`). Miss/blocked paths do not activate them.
- Charged-derived and star-skill action effects use alias-specific landed-hit activation subtrees and trigger frames. Interruption at the follow-up left boundary proves late hits/effects are suppressed.
- Star-carry uses distinct Battle Elements and timing: female `199001049` self 37F / allies 44F with replace semantics; male `199002266` self 38F / allies 44F with refresh semantics. Both use the verified formula `(self.ATK[4]*A)/10000`, 24s lifetime and `[start,end)` expiry. At 1440F cooldown, expiry precedes same-frame reapply; 1439F is rejected.
- Ultimate resource boundary is 100 SP. A real baseline action executes at exactly 100; an isolated 99-SP case rejects with `machine-axis-action-resource-insufficient`.
- Ultimate tuning-mark behavior is limited to existing elemental marks. Machine projections retain the acquired mark component source; no missing mark is invented.
- Female/male execution is not normalized into one trace: star skill duration is 190F vs 270F, ultimate 322F vs 268F, and hit/control assets remain alias-specific.
- Male control `19900242` is retained as an empty 150F source control; female `19900142` has only a NewTable/backup row and no current-client control asset. The dormant male cross-alias link to female `19900115` is retained as source N/A and is never executable.
- Boss-attack, received-hit, dodge/parry/counter, movement, airborne and distance-change rows remain structured `scenario-out-of-scope` N/A. No unreachable client behavior was implemented.

## Alias identity and contamination verdict

- `STARBORN` is one denominator object with two mandatory source aliases. Both alias manifests must be present and valid.
- A candidate input carries exactly one `sourceCharacterId`, `sourceAliasIdentity`, profile hash and source-contract hash. These feed selection/profile/input/data/trace/build identity.
- Female and male canonical hashes are all distinct:
  - `199001`: input `9eded05a6488fd76`, data `8be27e5495eb9abe`, trace `b7c29675c117c971`, evaluation `857cdbfa08476399`, build `d1f5cd80effbbdee`.
  - `199002`: input `1930161382b73937`, data `4c59f88c86a971bf`, trace `225c19109d05fe83`, evaluation `a196830192a2aa28`, build `4a781a934130686b`.
- Negative tests reject: only one alias, two aliases in one axis, opposite-alias action/runtime contract, cross-alias trace continuation, copied profile/contract hashes, or any action/resource/state/chain/switch carry across alias selection.

## Visual evidence verdict

Workbench adapter import/round-trip is machine-verified for both fixtures, but a real product screenshot could not be captured because the Browser tool blocked the localhost reload by URL policy. The recipe therefore declares `scenarioIdentities=[]` and `automatedEvidence=[]` while pending. The generic protocol permits an empty visual set only while pending and rejects an accepted empty set; trace hashes cannot substitute for screenshot bytes.
