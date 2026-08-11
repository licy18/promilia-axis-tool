import { GATE_DEFINITIONS } from '../../../../scripts/gates/gate-definitions.mjs';
import { matchesAnyPattern } from '../../../../scripts/gates/gate-fingerprint.mjs';
import { createEmptyLedger } from '../../../../scripts/gates/gate-ledger.mjs';

export const TEST_AUTHORITY = Object.freeze({
  fingerprintSchemaVersion: 2,
  dependencyMapVersion: 2,
  dependencyMapHash: 'map-hash',
  runnerHash: 'runner-hash',
});

export function createAuthorityLedger({ includeGatePasses = true } = {}) {
  const ledger = createEmptyLedger('2026-08-11T00:00:00.000Z');
  ledger.records.push(
    record({
      gate: 'release-verify',
      dependencyFingerprint: 'release-fingerprint',
      summary: { smartCacheAuthority: TEST_AUTHORITY },
    })
  );
  if (includeGatePasses) {
    for (const definition of GATE_DEFINITIONS) {
      if (definition.name === 'release-verify') continue;
      ledger.records.push(
        record({
          gate: definition.name,
          dependencyFingerprint: `stable:${definition.name}`,
          gateDefinitionVersion: definition.version,
        })
      );
    }
  }
  return ledger;
}

export function createSyntheticFingerprints(changedFiles) {
  return new Map(
    GATE_DEFINITIONS.map(definition => [
      definition.name,
      {
        gate: definition.name,
        dependencyFingerprint: changedFiles.some(file =>
          matchesAnyPattern(file, definition.dependencies)
        )
          ? `changed:${definition.name}`
          : `stable:${definition.name}`,
        dependencyCount: definition.dependencies.length,
      },
    ])
  );
}

export function record({
  gate,
  dependencyFingerprint,
  status = 'pass',
  mode = 'executed',
  exitCode = status === 'pass' ? 0 : 1,
  summary = null,
  gateDefinitionVersion = 1,
  recordId = `${gate}-${status}-${dependencyFingerprint}`,
} = {}) {
  return {
    recordId,
    gate,
    status,
    mode,
    head: '0123456789abcdef',
    workingTreeFingerprint: 'working-tree',
    dependencyFingerprint,
    gateDefinitionVersion,
    command: `test ${gate}`,
    startedAt: '2026-08-11T00:00:00.000Z',
    finishedAt: '2026-08-11T00:00:01.000Z',
    durationMs: 1000,
    exitCode,
    stdoutComplete: true,
    reportParseStatus: 'complete',
    summary,
  };
}

export function createInventory(entries) {
  const normalized = entries.map(entry => ({
    state: 'working-tree',
    bytes: 1,
    ...entry,
  }));
  return {
    entries: normalized,
    byPath: new Map(normalized.map(entry => [entry.path, entry])),
  };
}
