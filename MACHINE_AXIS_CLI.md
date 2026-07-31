# Machine Axis CLI

Machine Axis is the versioned, semantic timeline contract for the canonical headless combat core. Its JSON Schema is `schemas/azpr-machine-axis-v1.schema.json`; the complete three-actor fixture is `fixtures/machine-axis/m11-b-three-actor-120s.json`.

## Commands

Build explicitly when packaging or validating a source checkout:

```powershell
npm run machine-axis:build
```

The stable launcher rebuilds only when its source inputs are newer than the cached local bundle. It loads the verified mechanics package at runtime and does not embed that generated package in the CLI bundle.

```powershell
node scripts/run-machine-axis-cli.mjs catalog
node scripts/run-machine-axis-cli.mjs validate fixtures/machine-axis/m11-b-three-actor-120s.json
node scripts/run-machine-axis-cli.mjs simulate fixtures/machine-axis/m11-b-three-actor-120s.json --output work/m11-b/run.json
node scripts/run-machine-axis-cli.mjs compare --left fixtures/machine-axis/m11-b-three-actor-120s.json --right fixtures/machine-axis/m11-b-three-actor-120s.json
node scripts/run-machine-axis-cli.mjs explain fixtures/machine-axis/m11-b-three-actor-120s.json --action a3-sampled
node scripts/run-machine-axis-cli.mjs batch fixtures/machine-axis/m12-batch-example.json --jobs 4 --output work/m12/batch-report.json
```

Use `-` for stdin. `--format jsonl` reads and writes one contract/result per line. `--critical-policy` and `--seed` are explicit input overrides and therefore change the canonical input hash.

```powershell
Get-Content -Raw -LiteralPath fixtures/machine-axis/m11-b-three-actor-120s.json | node scripts/run-machine-axis-cli.mjs validate -
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
- `contributions.byActor` / `byAction` / `byHit` (hit rows keyed `actionId|hitIdentity`)
- `hashes.input` / `data` / `trace` per run for reproducibility

Sampled runs (`seeds` with one or more seeds) run each seed under `policy: sampled` and report `sampling.metrics` with `count`, `mean`, sample `variance`, `stdDev`, `min`, `max`, and `p5`/`p25`/`p50`/`p75`/`p95` quantiles. `expected` is the deterministic comparison default for pure-damage hits; forced `critical`/`non-critical`, and `expected` on hits with critical state effects, are rejected in favor of explicit seeded sampling unless an exact weighted-branch policy is proven.

Batch failures are row-level: invalid contracts, sampled-policy misuse, and runtime errors are reported per run while the rest of the batch continues. The batch report is a single JSON document; `batch` does not accept `--format jsonl`.

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
