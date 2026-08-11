import { GATE_DEFINITIONS } from './gate-definitions.mjs';
import { matchesAnyPattern } from './gate-fingerprint.mjs';
import {
  findLatestExecutedRecord,
  findReusablePass,
  hasSmartCacheAuthority,
} from './gate-ledger.mjs';
import { classifyChangedFiles } from './git-change-classifier.mjs';

const SMART_EXCLUDED_GATES = new Set([
  'formal-search-admission',
  'release-verify',
  'trial-release',
]);
const UNKNOWN_FORCE_RUN = new Set([
  'determinism',
  'production-imports',
  'test-full',
]);

export function planSmartGates({
  definitions = GATE_DEFINITIONS,
  changedFiles,
  fingerprints,
  ledger,
  authority,
  integration = false,
  classification = classifyChangedFiles(changedFiles),
} = {}) {
  const cacheAuthorityReady = hasSmartCacheAuthority({ ledger, authority });
  const unknownEscalation = classification.failClosedEscalation;
  const executableChanges = classification.classifications.filter(
    entry =>
      !entry.domains.every(domain => domain === 'docs' || domain === 'evidence')
  );
  const decisions = definitions
    .filter(definition => !SMART_EXCLUDED_GATES.has(definition.name))
    .sort((left, right) => left.order - right.order)
    .map(definition => {
      const fingerprint = fingerprints.get(definition.name);
      if (!fingerprint) {
        throw new Error(`Missing fingerprint for gate ${definition.name}`);
      }
      const dependencyChanges = changedFiles.filter(file =>
        matchesAnyPattern(file, definition.dependencies)
      );
      const triggerChanges = changedFiles.filter(file =>
        matchesAnyPattern(file, definition.smartTriggers)
      );
      const previous = findLatestExecutedRecord(ledger, definition.name);
      const forcedByUnknown =
        unknownEscalation && UNKNOWN_FORCE_RUN.has(definition.name);
      const forcedByIntegration =
        integration &&
        definition.integrationGate === true &&
        executableChanges.length > 0;
      const required =
        definition.command != null &&
        (triggerChanges.length > 0 || forcedByUnknown || forcedByIntegration);
      const reusable =
        forcedByUnknown || !cacheAuthorityReady
          ? null
          : findReusablePass({
              ledger,
              gate: definition.name,
              dependencyFingerprint: fingerprint.dependencyFingerprint,
              authority,
            });
      const fingerprintChanged =
        previous != null &&
        previous.dependencyFingerprint !== fingerprint.dependencyFingerprint;
      let decision;
      if (required && reusable) decision = 'reuse';
      else if (required) decision = 'run';
      else if (reusable) decision = 'reuse';
      else if (dependencyChanges.length > 0 || fingerprintChanged) {
        decision = 'invalidated';
      } else {
        decision = 'unavailable';
      }
      const reasons = [];
      if (triggerChanges.length) {
        reasons.push(`smart trigger changed: ${triggerChanges.join(', ')}`);
      }
      if (dependencyChanges.length) {
        reasons.push(`dependency changed: ${dependencyChanges.join(', ')}`);
      }
      if (forcedByUnknown) {
        reasons.push('unclassified change: fail-closed escalation');
      }
      if (forcedByIntegration) {
        reasons.push('integration checkpoint requested');
      }
      if (!cacheAuthorityReady) {
        reasons.push('smart cache bootstrap authority not established');
      }
      if (fingerprintChanged) {
        reasons.push(
          'dependency fingerprint differs from previous executed record'
        );
      }
      if (reusable) {
        reasons.push(
          `matching executed PASS: ${reusable.recordId} @ ${reusable.head}`
        );
      }
      if (!reasons.length) reasons.push('no matching executed evidence');
      return {
        gate: definition.name,
        definition,
        decision,
        required,
        dependencyFingerprint: fingerprint.dependencyFingerprint,
        dependencyCount: fingerprint.dependencyCount,
        dependencyChanges,
        triggerChanges,
        previous,
        reusable,
        reasons,
      };
    });

  applyCoverage(decisions);
  return {
    kind: 'azpr-smart-gate-plan',
    schemaVersion: 1,
    integration,
    cacheAuthorityReady,
    cacheAuthority: authority,
    classification,
    unknownEscalation,
    releaseStatus: 'not-evaluated',
    formalSearchStatus: 'unchanged-not-authoritative',
    decisions,
    summary: summarize(decisions),
  };
}

function applyCoverage(decisions) {
  const byName = new Map(decisions.map(decision => [decision.gate, decision]));
  for (const parent of decisions) {
    if (parent.decision !== 'run') continue;
    for (const coveredName of parent.definition.covers ?? []) {
      const covered = byName.get(coveredName);
      if (!covered || covered.decision !== 'run') continue;
      covered.decision = 'covered';
      covered.coveredBy = parent.gate;
      covered.reasons.push(
        `executed by ${parent.gate}; duplicate standalone command suppressed`
      );
    }
  }
}

function summarize(decisions) {
  return Object.fromEntries(
    ['run', 'reuse', 'covered', 'invalidated', 'unavailable'].map(decision => [
      decision,
      decisions
        .filter(entry => entry.decision === decision)
        .map(entry => entry.gate),
    ])
  );
}
