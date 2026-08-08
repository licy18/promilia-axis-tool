# Vitest performance state

## Goal

Reduce full-suite memory pressure and resource-contention timeouts without dropping test files or weakening assertions.

## Final design

- `core`: Node environment, thread pool, default maximum 2 workers.
- `dom`: jsdom environment, fork pool, default maximum 2 workers, scheduled after core.
- `VITEST_MAX_WORKERS` overrides the default for explicit local or CI tuning.
- `test:full`, `test:core`, `test:dom`, and `test:changed` expose clear entry points.
- The set-three reverse reference scan reads files with bounded concurrency 32 and sorts results before hashing.

## Coverage

- Git-tracked test files: 191.
- Vitest-listed test files: 191 total / 191 unique / 0 duplicates.
- Core partition: 141 files / 1101 tests.
- DOM partition: 50 files / 352 tests.

## Benchmarks

- Existing unconstrained all-jsdom/forks run: about 306 seconds, but process-heavy tests timed out under contention.
- Existing stable serial M12-B3 run: 192 files / 1472 tests in 1520.62 seconds.
- Core with 2 threads: 489 seconds, observed peak about 5.3 GiB.
- Core with 3 threads: 377 seconds; rejected as the default after full process-tree sampling showed excessive memory.
- Mixed core and DOM with 3 threads: 524 seconds / 8.24 GiB and a Workbench module-identity failure.
- Sequenced projects sharing the same 3-thread pool: 420 seconds / 9.36 GiB and the same identity failure.
- Final DOM isolation with 2 forks: 50 files / 352 tests passed in 70 seconds.
- Final cross-project smoke: Machine Axis service plus full Workbench, 2 files / 122 tests passed.
- Reverse reference scan focused test: passed in 46 seconds versus about 244 seconds under the old contended run.

The final default full run is expected to take about 9.3 minutes (core plus DOM) while staying near the measured 2-worker memory class. This is slower than the unstable unconstrained run but about 2.7 times faster than the stable serial gate.

## Known baseline drift

The isolated branch starts at `8ced55eb0135b1edf3fd014bdaf4a2f0b03c79cf`. Core runs with both 2 and 3 workers produced the same 19 semantic failures in stale optimization-evidence/generated baselines. They are not scheduler, environment, timeout, or file-loss failures. DOM is fully green under the final isolated pool.

## Next integration

Cherry-pick the performance commit onto the current M12-B3 baseline, regenerate its already-changed evidence artifacts there, then run `npm run test:full`. Do not copy benchmark JSON/log files.
