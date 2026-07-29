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
```

Use `-` for stdin. `--format jsonl` reads and writes one contract/result per line. `--critical-policy` and `--seed` are explicit input overrides and therefore change the canonical input hash.

```powershell
Get-Content -Raw -LiteralPath fixtures/machine-axis/m11-b-three-actor-120s.json | node scripts/run-machine-axis-cli.mjs validate -
```

Machine JSON is written only to stdout or `--output`. Diagnostics are written to stderr.

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
