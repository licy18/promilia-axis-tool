# Machine Axis CLI

Machine Axis is the versioned, semantic timeline contract for the canonical headless combat core. Its JSON Schema is `schemas/azpr-machine-axis-v1.schema.json`; the current three-actor fixture under verified normal-input authority is `fixtures/machine-axis/m11-b-three-actor-authority.json`.

## Commands

Build explicitly when packaging or validating a source checkout:

```powershell
npm run machine-axis:build
```

The stable launcher rebuilds only when its source inputs are newer than the cached local bundle. It loads the verified mechanics package at runtime and does not embed that generated package in the CLI bundle.

```powershell
node scripts/run-machine-axis-cli.mjs catalog
node scripts/run-machine-axis-cli.mjs validate fixtures/machine-axis/m11-b-three-actor-authority.json
node scripts/run-machine-axis-cli.mjs simulate fixtures/machine-axis/m11-b-three-actor-authority.json --output work/m11-b/run.json
node scripts/run-machine-axis-cli.mjs compare --left fixtures/machine-axis/m11-b-three-actor-authority.json --right fixtures/machine-axis/m11-b-three-actor-authority.json
node scripts/run-machine-axis-cli.mjs explain fixtures/machine-axis/m11-b-three-actor-authority.json --action plunging-sampled
node scripts/run-machine-axis-cli.mjs batch fixtures/machine-axis/m12-batch-example.json --jobs 4 --output work/m12/batch-report.json
node scripts/run-machine-axis-cli.mjs search fixtures/machine-axis/m12-search-example.json --beam-width 2 --top-n 3 --output work/m12/search-report.json
```

Use `-` for stdin. `--format jsonl` reads and writes one contract/result per line. `--critical-policy` and `--seed` are explicit input overrides and therefore change the canonical input hash.

```powershell
Get-Content -Raw -LiteralPath fixtures/machine-axis/m11-b-three-actor-authority.json | node scripts/run-machine-axis-cli.mjs validate -
```

Machine JSON is written only to stdout or `--output`. Diagnostics are written to stderr.

## Batch Evaluation

`batch` evaluates many axes through the same canonical core, runs them with bounded concurrency, and aggregates metrics per axis and per hit. Each run is simulated independently through `createMachineAxisService().simulate`, so the batch shares the M11 headless core without duplicating combat logic.

Envelope shape:

```json
{
  "kind": "azpr-machine-axis-batch",
  "runs": [
    {
      "label": "axis-a",
      "axis": { "...": "full machine axis contract" },
      "options": { "criticalPolicy": "expected" }
    },
    {
      "label": "axis-b-sampled",
      "axis": { "...": "full machine axis contract" },
      "seeds": ["seed-1", "seed-2"]
    }
  ]
}
```

Run-level `options.criticalPolicy` / `seeds` / `burstWindowMs` are normalized by the evaluator; direct run keys (`criticalPolicy`, `seeds`, `burstWindowMs`) are accepted as shorthand. A run without `axis` is treated as a raw machine axis contract.

CLI overrides apply to every run and take precedence over per-run options:

```powershell
node scripts/run-machine-axis-cli.mjs batch fixtures/machine-axis/m12-batch-example.json --jobs 8 --burst-window-ms 5000
node scripts/run-machine-axis-cli.mjs batch - --critical-policy expected --seeds seed-a,seed-b
```

Per-run report fields:

- `metrics.hpDamage` / `metrics.dps` (over the declared scenario duration), `toughnessDamage`, `netToughnessDamage`, `combatHitCount`, `stateEventCount`
- `metrics.burst`: best sliding-window total damage (`burstWindowMs`, default 10000 ms), its `startMs`/`endMs`, `hitCount`, and per-actor damage inside that window
- `metrics.resourceSurplus`: final SP per actor, final kibo energy per kibo, initial values from the contract, and deltas; plus `selfEnergyDelta`
- `metrics.idle`: team and per-actor busy/idle time derived from executed action occupancy
- `metrics.nonExecutableActions` with `skipReason`, `violationCodes`, `unresolvedCodes`; `unresolvedActionCount` for conditionally executed actions
- `metrics.optimizationDiagnostics`: LLM-facing damage composition, element distribution, tuning/overlimit share, actor/kibo resource utilization, tuning-mark utilization/coverage, and bounded recommendations
- `contributions.byActor` / `byAction` / `byHit` (hit rows keyed `actionId|hitIdentity`)
- `hashes.input` / `data` / `trace` per run for reproducibility

Sampled runs (`seeds` with one or more seeds) run each seed under `policy: sampled` and report `sampling.metrics` with `count`, `mean`, sample `variance`, `stdDev`, `min`, `max`, and `p5`/`p25`/`p50`/`p75`/`p95` quantiles. `expected` is the deterministic comparison default for pure-damage hits; forced `critical`/`non-critical`, and `expected` on hits with critical state effects, are rejected in favor of explicit seeded sampling unless an exact weighted-branch policy is proven.

Batch failures are row-level: invalid contracts, sampled-policy misuse, and runtime errors are reported per run while the rest of the batch continues. The batch report is a single JSON document; `batch` does not accept `--format jsonl`.

### Optimization diagnostics

`simulate` publishes top-level `optimizationDiagnostics`; `batch` mirrors it under each run's `metrics`, while `cycle` limits it to the first half-open loop interval and `kill` limits it to the first lethal runtime cursor. The projection includes:

- `damage.byActor/byAction/bySourceKind/byElement`: raw/effective HP damage, toughness damage, hit count, and share of total effective HP damage;
- `damage.tuning`: overlimit damage/share, held-tuning damage/share, total tuning share, and DoT share;
- `energy.actors/kibos`: scope-start value, applied recovery, spend, end value, utilization ratio, cap uptime, per-reason recovery/spend, and cap-hit count;
- `energy.insufficientActions`: actions rejected for actor/kibo resource insufficiency;
- `tuningMarks.profiles`: start/acquired/consumed/expired/end stacks, consumption ratio, expiry-waste ratio, time coverage, cap coverage, average/max stacks, and refresh-at-cap count;
- `tuningMarks.overall`: any-mark coverage, average total stacks, overlimit damage/share, and overlimit damage per consumed stack;
- `recommendations[]`: deterministic information/warning codes for high cap uptime, low resource utilization, resource-insufficient actions, high mark expiry waste, held-but-unconsumed marks, and low overlimit share after consumption.

`utilizationRatio = spent / (scopeStart + appliedRecovery)`. It intentionally uses applied recovery, not a guessed theoretical maximum. `capUptimeRatio` is the separate waste-pressure signal. Mark coverage is time-weighted; equal stack counts with different decay timers remain a cycle-closure concern rather than being treated as equivalent.

## Search

`search` runs event-boundary beam search over candidate output axes and returns an interpretable Top-N. The engine reuses the canonical core: every candidate is evaluated through `createMachineAxisService().simulate` and the M12-A critical-policy safety gate is preserved; the search never enumerates frame by frame and never invents derived actions.

Input is a search envelope:

```json
{
  "kind": "azpr-machine-axis-search",
  "contract": { "...": "full machine axis contract" },
  "options": {
    "beamWidth": 8,
    "topN": 5,
    "maxDepth": 24,
    "objective": "damage",
    "maxActionsPerOwner": 6,
    "maxKiboActions": 3,
    "includeKibo": true,
    "includeSwitch": true,
    "includeNormalAttacks": true
  }
}
```

CLI options override envelope options and take precedence: `--beam-width`, `--top-n`, `--max-depth`, `--objective` (`damage` | `burst` | `toughness`), `--max-actions-per-owner`, `--max-kibo-actions`, plus shared `--burst-window-ms`, `--jobs`, `--critical-policy`, `--seed`, `--seeds`, `--output`.

```powershell
node scripts/run-machine-axis-cli.mjs search fixtures/machine-axis/m12-search-example.json --output work/m12/search-report.json
node scripts/run-machine-axis-cli.mjs search - --objective burst --top-n 3
```

Every result row contains:

- `rank`, `score`, and `deltaVsRank1`
- `team` (slot/character/kibo/initial SP), full `axis` contract (directly importable into the Workbench), and `hashes` (`input`/`data`/`trace`)
- `legality` (`valid`, issues, warnings, classification, invalid action count)
- `criticalPolicy` and the scenario assumptions (enemy, critical policy/seed, initial energy, duration, objective)
- `coverageTrust`: counts of assumption/evidence-open warnings with a note that official conclusions require M12-C accepted characters
- `metrics` (damage, DPS, burst window, toughness, resource surplus, idle, non-executable actions) and `contributions` by actor/action
- `causalExplanation`: the generated action sequence with frames and the end state (resources, cooldowns, enemy)

`search` reports a single JSON document and does not accept `--format jsonl`. Exit codes follow the same contract: `0` success, `2` usage, `3` input read/parse, `4` invalid search envelope.

## Exit Codes

| Code | Meaning                                    |
| ---: | ------------------------------------------ |
|    0 | Command completed successfully             |
|    2 | CLI usage error                            |
|    3 | Input read or JSON parse error             |
|    4 | Machine Axis validation error              |
|    5 | Canonical core or unexpected runtime error |

Validation issues include stable `code`, `path`, `actionId`, `hitIdentity`, and related identities where available. Invalid or non-executable actions are rejected as diagnostics; the CLI does not return a failed occupancy block.

## Boundaries

The CLI calls `WORKBENCH_HEADLESS_COMBAT_CORE` through `createMachineAxisService`. It has no Vue, DOM, drag, pixel, localStorage, or browser dependency. Public action identities and semantic selectors are resolved against the installed verified mechanics package; stale hit or variant identities fail instead of being rebound by list position.
