import { hashCanonicalValue } from '../../src/simulation/headless/canonicalSerialization.js';
import {
  CHARACTER_ACCEPTANCE_CONTRACT_NAME,
  CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY,
  CHARACTER_ACCEPTANCE_SCHEMA_VERSION,
  UNNAMED_SECONDARY_PASSIVE_REASON,
  finalizeCharacterAcceptanceManifest,
} from '../../src/character-acceptance/characterAcceptanceProtocol.js';

const CONTRACT_DIMENSIONS = Object.freeze([
  ['public-action', 'publicActions'],
  ['action-form', 'actionForms'],
  ['input-timing', 'timingInputEdges'],
  ['control-window', 'controlTransitionWindows'],
  ['variant-edge', 'variantEdges'],
  ['variant-window', 'variantWindowBindings'],
  ['attack-input-chain', 'attackInputChains'],
  ['hit', 'hits'],
  ['resource-profile', 'resourceProfiles'],
  ['resource-transaction', 'resourceTransactions'],
  ['state-machine', 'stateMachines'],
  ['effect', 'effects'],
  ['action-effect-binding', 'actionEffectBindings'],
  ['runtime-effect-binding', 'runtimeEffectBindings'],
  ['target-state-profile', 'targetStateProfiles'],
  ['target-state-transaction', 'targetStateTransactions'],
  ['conditional-hit-group', 'conditionalHitGroups'],
  ['passive', 'passives'],
  ['switch-trigger', 'switchTriggers'],
  ['stat-dependency', 'statDependencies'],
]);

export function createCharacterAcceptanceManifest({
  recipe,
  profile,
  runtimeCoverage,
  unresolvedLedger,
  goldens,
  visualScenario,
}) {
  const goldenEvidence = goldens.map(({ path, report }) =>
    createGoldenEvidence(path, report)
  );
  const evidence = {
    canonicalGoldens: goldenEvidence,
    machineScenarios: [toPublicVisualScenarioEvidence(visualScenario)],
    productVisualAcceptance: {
      status: recipe.productVisualAcceptance?.status ?? 'pending',
      scenarioIdentities: [visualScenario.scenarioIdentity],
      acceptanceCommit:
        recipe.productVisualAcceptance?.acceptanceCommit ?? null,
      recordIdentity: recipe.productVisualAcceptance?.recordIdentity ?? null,
      automatedEvidence: structuredClone(
        recipe.productVisualAcceptance?.automatedEvidence ?? []
      ),
    },
  };
  const matrix = createCharacterAcceptanceMatrix({
    profile,
    runtimeCoverage,
    goldens,
    visualScenario,
  });
  const notApplicableRecords = createNotApplicableRecords(unresolvedLedger);
  const ledger = createCharacterAcceptanceLedger({
    unresolvedLedger,
    matrix,
  });
  const coverage = createCharacterAcceptanceCoverage(matrix, {
    profile,
    runtimeCoverage,
    notApplicableRecords,
  });
  const input = {
    schemaVersion: CHARACTER_ACCEPTANCE_SCHEMA_VERSION,
    contractName: CHARACTER_ACCEPTANCE_CONTRACT_NAME,
    kind: 'azpr-character-acceptance-manifest',
    protocolIdentity: CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY,
    owner: {
      ownerId: Number(profile.owner?.ownerId),
      ownerName: String(profile.owner?.ownerName ?? ''),
    },
    source: {
      profileIdentity: String(profile.profileIdentity),
      profileHash: String(profile.profileHash),
      profileValidationStatus: String(profile.validation?.status),
      sourcePackageHash: String(profile.sourcePackage?.packageHash ?? ''),
      pipelineMaturity: profile.pipelineMaturity,
      combatCoverageState: profile.combatCoverageState,
      characterComplete: profile.characterComplete === true,
      zeroDistanceSimulationComplete:
        profile.zeroDistanceSimulationComplete === true,
      realClientEvidenceComplete: profile.realClientEvidenceComplete === true,
    },
    evidence,
    matrix,
    coverage,
    ledger,
    notApplicableRecords,
  };
  return finalizeCharacterAcceptanceManifest(input);
}

export function createCharacterAcceptanceMatrix({
  profile,
  runtimeCoverage,
  goldens,
  visualScenario,
}) {
  const requirements = [];
  const executedForms = collectExecutedForms(goldens, visualScenario);
  const searchableEvidence = [
    ...goldens.map(({ report }) => JSON.stringify(report.actual ?? {})),
    JSON.stringify(visualScenario.traceProjection ?? {}),
  ].join('|');
  const runtimeRows = runtimeCoverage?.actionRows ?? [];

  for (const [dimension, contractKey] of CONTRACT_DIMENSIONS) {
    const records = flattenContractRecords(
      profile.contracts?.[contractKey],
      contractKey
    );
    records.forEach((record, index) => {
      const subjectIdentity = resolveContractIdentity(
        record,
        dimension,
        index
      );
      const contractApplied = isAppliedRecord(record);
      const notApplicable = isNotApplicableRecord(record);
      const scenarioCovered = isRecordCoveredByScenario({
        record,
        dimension,
        executedForms,
        searchableEvidence,
        runtimeRows,
        visualScenario,
      });
      requirements.push({
        requirementIdentity: 'contract:' + dimension + ':' + subjectIdentity,
        dimension,
        subjectIdentity,
        required: !notApplicable,
        status: notApplicable
          ? 'not-applicable'
          : contractApplied && scenarioCovered
            ? 'passed'
            : 'blocked',
        contractStatus: record.status ?? (record.applied ? 'applied' : null),
        evidenceScenarioIds: scenarioCovered
          ? collectEvidenceScenarioIds(goldens, visualScenario)
          : [],
        sourceIdentities: collectSourceIdentities(record),
        reasons: notApplicable
          ? record.reasons ?? ['not-applicable']
          : contractApplied
            ? scenarioCovered
              ? []
              : ['acceptance-scenario-evidence-missing']
            : normalizeReasons(record),
      });
    });
  }

  const semanticRequirements = [
    ...new Map(
      requirements.map(requirement => [
        requirement.requirementIdentity,
        requirement,
      ])
    ).values(),
    ...createProtocolRequirements({
      profile,
      goldens,
      visualScenario,
    }),
  ].sort((left, right) =>
    left.requirementIdentity.localeCompare(right.requirementIdentity)
  );
  return {
    requirements: semanticRequirements,
    summary: summarizeRequirements(semanticRequirements),
  };
}

export function createCharacterAcceptanceLedger({
  unresolvedLedger,
  matrix,
}) {
  const records = [];
  for (const record of unresolvedLedger?.records ?? []) {
    if (record.impactClassification !== 'gameplay-impacting') continue;
    records.push({
      recordIdentity: 'source-gap:' + record.recordIdentity,
      status: normalizeLedgerStatus(record),
      reason: normalizeReasons(record).join('|') || 'source-evidence-gap',
      sourceKind: record.sourceKind ?? null,
      sourceIdentities: uniqueStrings([
        ...(record.sourceIdentities ?? []),
        record.sourceIdentity,
      ]),
      blocking: true,
    });
  }
  for (const requirement of matrix.requirements) {
    if (!requirement.required || requirement.status !== 'blocked') continue;
    records.push({
      recordIdentity:
        'acceptance-gap:' + hashCanonicalValue(requirement.requirementIdentity),
      status: 'static-evidence-gap',
      reason:
        requirement.reasons[0] ?? 'acceptance-scenario-evidence-missing',
      requirementIdentity: requirement.requirementIdentity,
      sourceIdentities: requirement.sourceIdentities,
      blocking: true,
    });
  }
  const deduped = [...new Map(records.map(record => [record.recordIdentity, record])).values()]
    .sort((left, right) => left.recordIdentity.localeCompare(right.recordIdentity));
  return {
    records: deduped,
    summary: {
      recordCount: deduped.length,
      statusCounts: countBy(deduped, record => record.status),
      reasonCounts: countBy(deduped, record => record.reason),
    },
  };
}

export function createNotApplicableRecords(unresolvedLedger) {
  return (unresolvedLedger?.records ?? [])
    .filter(
      record =>
        record.status === 'not-applicable' ||
        record.impactClassification === 'not-applicable'
    )
    .map(record => ({
      recordIdentity: 'not-applicable:' + record.recordIdentity,
      status: 'not-applicable',
      reason: normalizeReasons(record)[0] ?? 'not-applicable',
      sourceKind: record.sourceKind ?? null,
      sourceIdentities: uniqueStrings([
        ...(record.sourceIdentities ?? []),
        record.sourceIdentity,
        ...(record.rawRecordIdentities ?? []),
      ]),
    }))
    .sort((left, right) => left.recordIdentity.localeCompare(right.recordIdentity));
}

export function createCharacterAcceptanceCoverage(
  matrix,
  { profile, runtimeCoverage, notApplicableRecords }
) {
  const dimensions = {};
  for (const requirement of matrix.requirements) {
    const summary = dimensions[requirement.dimension] ?? {
      total: 0,
      passed: 0,
      blocked: 0,
      notApplicable: 0,
    };
    summary.total += 1;
    if (requirement.status === 'passed') summary.passed += 1;
    if (requirement.status === 'blocked') summary.blocked += 1;
    if (requirement.status === 'not-applicable') summary.notApplicable += 1;
    dimensions[requirement.dimension] = summary;
  }
  return {
    denominator: structuredClone(profile.denominator ?? {}),
    runtimeCoverageSummary: structuredClone(runtimeCoverage?.summary ?? {}),
    dimensions,
    unnamedSecondaryPassive: {
      reason: UNNAMED_SECONDARY_PASSIVE_REASON,
      recordCount: notApplicableRecords.filter(
        record => record.reason === UNNAMED_SECONDARY_PASSIVE_REASON
      ).length,
      records: notApplicableRecords
        .filter(record => record.reason === UNNAMED_SECONDARY_PASSIVE_REASON)
        .map(record => record.recordIdentity),
    },
  };
}

export function createCharacterAcceptanceCatalog(manifests) {
  const entries = [...manifests]
    .sort((left, right) => Number(left.owner.ownerId) - Number(right.owner.ownerId))
    .map(manifest => ({
      ownerId: Number(manifest.owner.ownerId),
      ownerName: manifest.owner.ownerName,
      maturityState: manifest.maturity.currentState,
      earnedStates: manifest.maturity.earnedStates,
      optimizationReady: manifest.maturity.optimizationReady,
      blockers: manifest.maturity.blockers,
      blockingLedgerCount: manifest.maturity.facts.blockingLedgerCount,
      matrixRequiredCount: manifest.maturity.facts.matrixRequiredCount,
      matrixPassedCount: manifest.maturity.facts.matrixPassedCount,
      manifestHash: manifest.manifestHash,
      profileHash: manifest.source.profileHash,
      visualScenarioIds:
        manifest.evidence.productVisualAcceptance.scenarioIdentities,
    }));
  const value = {
    schemaVersion: 1,
    contractName: 'AzPrCharacterAcceptanceCatalog',
    kind: 'azpr-character-acceptance-catalog',
    protocolIdentity: CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY,
    entries,
    summary: {
      ownerCount: entries.length,
      maturityCounts: countBy(entries, entry => entry.maturityState),
      optimizationReadyCount: entries.filter(entry => entry.optimizationReady).length,
    },
  };
  return { ...value, catalogHash: hashCanonicalValue(value) };
}

export function validateUnnamedSecondaryPassiveBoundary(
  manifest,
  expectedSkillId
) {
  const skillToken = String(expectedSkillId);
  const matching = manifest.notApplicableRecords.filter(
    record =>
      record.reason === UNNAMED_SECONDARY_PASSIVE_REASON &&
      record.sourceIdentities.some(identity => identity.includes(skillToken))
  );
  const leaked = manifest.ledger.records.filter(
    record =>
      record.reason === UNNAMED_SECONDARY_PASSIVE_REASON ||
      record.sourceIdentities.some(identity => identity.includes(skillToken))
  );
  return {
    valid: matching.length === 1 && leaked.length === 0,
    matchingCount: matching.length,
    leakedCount: leaked.length,
  };
}

function createGoldenEvidence(reportPath, report) {
  return {
    evidenceIdentity: report.scenarioIdentity,
    reportPath,
    status: report.validation?.passed ? 'passed' : 'failed',
    replayHash: report.replayHash,
    summaryHash: report.actual?.summaryHash,
    canonicalHashes: {
      input: report.headlessCore?.inputHash,
      data: report.headlessCore?.dataHash,
      trace: report.headlessCore?.traceHash,
      evaluation: null,
    },
    assertionCount: Number(report.validation?.assertionCount ?? 0),
  };
}

function toPublicVisualScenarioEvidence(scenario) {
  return {
    scenarioIdentity: scenario.scenarioIdentity,
    fixturePath: scenario.fixturePath,
    status: scenario.status,
    stableReplay: scenario.stableReplay,
    workbenchRoundTrip: scenario.workbenchRoundTrip,
    canonicalHashes: scenario.canonicalHashes,
    actionCount: scenario.actionCount,
    executedActionCount: scenario.executedActionCount,
    traceIndex: scenario.traceIndex,
    assertionSummary: scenario.assertionSummary,
  };
}

function createProtocolRequirements({ profile, goldens, visualScenario }) {
  const ownerId = Number(profile.owner?.ownerId);
  const goldenTexts = goldens.map(({ report }) => JSON.stringify(report.actual ?? {}));
  const combinedGolden = goldenTexts.join('|');
  const effectOperations = new Set(
    goldens.flatMap(({ report }) =>
      (report.actual?.trace?.effects ?? []).map(effect => effect.operation)
    )
  );
  const allScenarioIds = collectEvidenceScenarioIds(goldens, visualScenario);
  const critical = visualScenario.criticalMatrix ?? {};
  const rows = [];
  const add = (identity, dimension, passed, reasons = []) => {
    rows.push({
      requirementIdentity: 'protocol:' + ownerId + ':' + identity,
      dimension,
      subjectIdentity: identity,
      required: true,
      status: passed ? 'passed' : 'blocked',
      evidenceScenarioIds: passed ? allScenarioIds : [],
      sourceIdentities: passed
        ? [visualScenario.fixturePath, ...goldens.map(golden => golden.path)]
        : [],
      reasons: passed ? [] : reasons,
    });
  };

  add(
    'normal-trigger-positive',
    'scenario-positive',
    goldens.every(({ report }) => report.validation?.passed === true),
    ['authoritative-positive-scenario-missing']
  );
  add(
    'condition-insufficient-negative',
    'scenario-negative',
    goldens.some(({ report }) =>
      (report.actual?.actions?.blockedActionIds ?? []).length > 0
    ),
    ['insufficient-condition-negative-scenario-missing']
  );
  add(
    'input-window-inside-outside-boundaries',
    'window-boundary',
    false,
    ['exact-window-boundary-scenario-matrix-missing']
  );
  add(
    'resource-exact-and-insufficient',
    'resource-boundary',
    /threshold|beforeValue|afterValue|blockedActionIds/.test(combinedGolden),
    ['resource-boundary-scenario-missing']
  );
  add(
    'buff-apply-refresh-stack-expire',
    'buff-lifecycle',
    ['apply', 'expire'].every(operation => effectOperations.has(operation)) &&
      (effectOperations.has('refresh') || effectOperations.has('stack')),
    ['complete-buff-lifecycle-scenario-missing']
  );
  add(
    'hit-landed-and-miss',
    'hit-override',
    critical.missSuppressesHit === true,
    ['hit-miss-scenario-missing']
  );
  add(
    'foreground-background-switch',
    'controlled-actor',
    combinedGolden.includes('verified-auto-sp-background') &&
      combinedGolden.includes('verified-auto-sp-foreground') &&
      combinedGolden.includes('switch'),
    ['foreground-background-switch-scenario-missing']
  );
  add(
    'save-import-replay',
    'persistence-replay',
    visualScenario.workbenchRoundTrip === 'passed' &&
      visualScenario.stableReplay === true,
    ['machine-axis-workbench-round-trip-failed']
  );
  add(
    'critical-sampled-same-seed',
    'critical',
    critical.sameSeedReplay === true,
    ['critical-sampled-replay-missing']
  );
  add(
    'critical-integer-threshold-boundary',
    'critical',
    critical.integerThresholdBoundary === true,
    ['critical-integer-threshold-boundary-missing']
  );
  add(
    'critical-per-hit-modes',
    'critical',
    critical.perHitModes === true,
    ['critical-per-hit-mode-matrix-missing']
  );
  add(
    'critical-miss-coexistence',
    'critical',
    critical.missSuppressesHit === true,
    ['critical-miss-coexistence-missing']
  );
  add(
    'critical-expected-no-random-side-effect',
    'critical',
    critical.expectedNoCriticalEvent === true,
    ['critical-expected-side-effect-guard-missing']
  );
  add(
    'critical-rate-zero',
    'critical',
    false,
    ['critical-zero-rate-scenario-missing']
  );
  add(
    'critical-rate-one-hundred-percent',
    'critical',
    false,
    ['critical-full-rate-scenario-missing']
  );
  add(
    'critical-pre-hit-attribute-change',
    'critical',
    false,
    ['critical-pre-hit-attribute-change-scenario-missing']
  );
  add(
    'critical-non-crittable-rejection',
    'critical',
    false,
    ['critical-non-crittable-negative-scenario-missing']
  );
  return rows;
}

function collectExecutedForms(goldens, visualScenario) {
  const keys = new Set();
  for (const { report } of goldens) {
    for (const selection of Object.values(
      report.actual?.actions?.selectionByActionId ?? {}
    )) {
      addExecutedForm(keys, selection?.controlSkillId, selection?.subSkillIndex);
    }
  }
  for (const selection of visualScenario.traceProjection?.variantSelections ?? []) {
    addExecutedForm(keys, selection?.controlSkillId, selection?.subSkillIndex);
  }
  return keys;
}

function addExecutedForm(keys, controlSkillId, subSkillIndex) {
  const control = Number(controlSkillId);
  const sub = Number(subSkillIndex);
  if (Number.isInteger(control) && Number.isInteger(sub)) {
    keys.add(control + '|' + sub);
  }
}

function isRecordCoveredByScenario({
  record,
  dimension,
  executedForms,
  searchableEvidence,
  runtimeRows,
  visualScenario,
}) {
  const control = firstInteger(
    record.executionControlSkillId,
    record.controlSkillId,
    record.sourceControlSkillId,
    record.publicControlSkillId
  );
  const sub = firstInteger(
    record.executionSubSkillIndex,
    record.subSkillIndex,
    record.sourceSubSkillIndex,
    record.selectedSubSkillIndex
  );
  if (control != null && sub != null && executedForms.has(control + '|' + sub)) {
    return true;
  }
  if (
    control != null &&
    sub == null &&
    ['public-action', 'switch-trigger'].includes(dimension) &&
    [...executedForms].some(identity => identity.startsWith(control + '|'))
  ) {
    return true;
  }
  if (
    control != null &&
    (record.trigger?.subSkillIndexes ?? []).some(index =>
      executedForms.has(control + '|' + Number(index))
    )
  ) {
    return true;
  }
  if (
    dimension === 'hit' &&
    visualScenario.traceProjection?.hitIdentities?.includes(record.hitIdentity)
  ) {
    return true;
  }
  if (dimension === 'public-action') {
    const identity = record.actionIdentity ?? record.publicActionIdentity;
    const runtimeRow = runtimeRows.find(
      row =>
        (identity && row.actionIdentity === identity) ||
        (record.sourceSkillId != null &&
          Number(row.sourceSkillId) === Number(record.sourceSkillId))
    );
    if (!runtimeRow?.runtimeReady) return false;
  }
  return evidenceTokens(record).some(token => searchableEvidence.includes(token));
}

function evidenceTokens(record) {
  const elementId = Number(record.elementId);
  const battleIdentities = [
    ...(record.battleIdentities ?? []),
    ...(record.rootBattleIdentities ?? []),
  ];
  return uniqueStrings([
    record.formIdentity,
    record.actionIdentity,
    record.publicActionIdentity,
    record.hitIdentity,
    record.resourceIdentity,
    record.transitionIdentity,
    record.effectId,
    record.effectIdentity,
    record.semanticIdentity,
    record.passiveIdentity,
    record.profileIdentity,
    record.groupIdentity,
    record.stateIdentity,
    Number.isInteger(elementId) ? String(elementId) : null,
    Number.isInteger(elementId) ? 'battle-element:' + elementId : null,
    Number.isInteger(elementId) ? 'tuning-mark:' + elementId : null,
    ...battleIdentities.map(identity => 'battle-element:' + identity),
  ]).filter(token => token.length >= 6);
}

function flattenContractRecords(value, contractKey) {
  if (Array.isArray(value)) {
    return value.filter(record => record && typeof record === 'object');
  }
  if (!value || typeof value !== 'object') return [];
  if (contractKey === 'effects') {
    return Array.isArray(value.semantic) ? value.semantic : [];
  }
  return looksLikeContractRecord(value) ? [value] : [];
}

function looksLikeContractRecord(value) {
  return Boolean(
    value.applied != null ||
      value.status ||
      value.sourceIdentity ||
      value.formIdentity ||
      value.hitIdentity ||
      value.profileIdentity ||
      value.transitionIdentity
  );
}

function resolveContractIdentity(record, dimension, index) {
  const candidates = [
    record.formIdentity,
    record.actionIdentity,
    record.publicActionIdentity,
    record.hitIdentity,
    record.resourceIdentity,
    record.transitionIdentity,
    record.transactionIdentity,
    record.effectIdentity,
    record.bindingIdentity,
    record.passiveIdentity,
    record.profileIdentity,
    record.groupIdentity,
    record.stateIdentity,
    record.dependencyIdentity,
    record.identity,
  ];
  return (
    candidates.find(value => String(value ?? '').trim()) ??
    dimension + ':' + index + ':' + hashCanonicalValue(record)
  ).toString();
}

function isAppliedRecord(record) {
  const status = String(record.status ?? '');
  return (
    record.applied === true ||
    record.runtimeReady === true ||
    record.classification === 'applied' ||
    record.mechanicsClassification === 'applied' ||
    record.sourceEvidenceStatus === 'applied' ||
    status === 'applied' ||
    status.startsWith('verified-') ||
    status.endsWith('-ready')
  );
}

function isNotApplicableRecord(record) {
  return (
    record.status === 'not-applicable' ||
    record.impactClassification === 'not-applicable'
  );
}

function normalizeLedgerStatus(record) {
  const reasons = normalizeReasons(record);
  if (reasons.some(reason => reason.includes('formula'))) {
    return 'unknown-formula';
  }
  return record.status === 'runtime-evidence-required'
    ? 'runtime-evidence-required'
    : 'static-evidence-gap';
}

function normalizeReasons(record) {
  return uniqueStrings([
    ...(record.reasons ?? []),
    record.reason,
  ]);
}

function collectSourceIdentities(record) {
  return uniqueStrings([
    ...(record.sourceIdentities ?? []),
    record.sourceIdentity,
  ]);
}

function collectEvidenceScenarioIds(goldens, visualScenario) {
  return uniqueStrings([
    visualScenario.scenarioIdentity,
    ...goldens.map(({ report }) => report.scenarioIdentity),
  ]);
}

function summarizeRequirements(requirements) {
  const required = requirements.filter(row => row.required);
  return {
    requirementCount: requirements.length,
    requiredCount: required.length,
    passedCount: required.filter(row => row.status === 'passed').length,
    blockedCount: required.filter(row => row.status === 'blocked').length,
    notApplicableCount: requirements.filter(
      row => row.status === 'not-applicable'
    ).length,
    statusCounts: countBy(requirements, row => row.status),
    dimensionCounts: countBy(requirements, row => row.dimension),
  };
}

function firstInteger(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isInteger(number)) return number;
  }
  return null;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(value => value != null).map(String))].sort();
}

function countBy(rows, selector) {
  return Object.fromEntries(
    [...rows.reduce((map, row) => {
      const key = String(selector(row));
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right))
  );
}
