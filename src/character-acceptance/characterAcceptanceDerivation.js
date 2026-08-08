import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

export const CHARACTER_ACCEPTANCE_DERIVATION_SCHEMA_VERSION = 1;
export const CHARACTER_ACCEPTANCE_SCENARIO_CASE_SCHEMA_VERSION = 1;

const NON_GAMEPLAY_SOURCE_REASONS = new Set([
  'semantic-condition-not-standalone-gameplay-effect',
  'semantic-wrapper-not-gameplay-effect',
  'resource-root-wrapper-reference-not-a-runtime-transaction',
  'window-does-not-select-an-action-control',
  'unnamed-secondary-passive-not-implemented-current-client',
]);

export function deriveCharacterAcceptanceArtifacts({
  requirementInventory,
  sourceGapInventory,
  scenarioCases,
  denominator = {},
  runtimeCoverageSummary = {},
}) {
  const normalizedRequirementInventory = finalizeRequirementInventory(
    requirementInventory?.records ?? requirementInventory ?? []
  );
  const normalizedSourceGapInventory = finalizeSourceGapInventory(
    sourceGapInventory?.records ?? sourceGapInventory ?? []
  );
  const normalizedScenarioCases = finalizeScenarioCases(
    scenarioCases?.records ?? scenarioCases ?? []
  );
  const coverage = deriveCoverageEdges(
    normalizedRequirementInventory,
    normalizedScenarioCases,
    { denominator, runtimeCoverageSummary }
  );
  const matrix = deriveAcceptanceMatrix(
    normalizedRequirementInventory,
    coverage
  );
  const ledger = deriveAcceptanceLedger(normalizedSourceGapInventory, matrix);
  const notApplicableRecords = deriveNotApplicableRecords(
    normalizedRequirementInventory,
    normalizedSourceGapInventory
  );
  return {
    requirementInventory: normalizedRequirementInventory,
    sourceGapInventory: normalizedSourceGapInventory,
    scenarioCases: normalizedScenarioCases,
    coverage,
    matrix,
    ledger,
    notApplicableRecords,
  };
}

export function finalizeRequirementInventory(records = []) {
  const normalized = dedupeBy(
    records.map((record, index) => {
      const sourceDisposition = normalizeSourceDisposition(record);
      const base = {
        requirementIdentity: String(
          record?.requirementIdentity ?? `requirement:${index}`
        ),
        dimension: String(record?.dimension ?? 'unknown'),
        subjectIdentity: String(
          record?.subjectIdentity ?? record?.requirementIdentity ?? index
        ),
        sourceDisposition,
        contractStatus: record?.contractStatus ?? null,
        impactClassification:
          record?.impactClassification ??
          (sourceDisposition === 'not-applicable'
            ? 'not-applicable'
            : 'gameplay-impacting'),
        coverageSelector: normalizeSelector(record?.coverageSelector),
        sourceIdentities: uniqueStrings(record?.sourceIdentities ?? []),
        ...(record?.optimizationScenario == null
          ? {}
          : {
              optimizationScenario: structuredClone(
                record.optimizationScenario
              ),
            }),
        ...(record?.scenarioScope == null
          ? {}
          : {
              scenarioScope: structuredClone(record.scenarioScope),
            }),
        ...(record?.sourceGapDisposition == null
          ? {}
          : {
              sourceGapDisposition: structuredClone(
                record.sourceGapDisposition
              ),
            }),
        ...(record?.productBoundaryEvidence == null
          ? {}
          : {
              productBoundaryEvidence: structuredClone(
                record.productBoundaryEvidence
              ),
            }),
        reasons: uniqueStrings(record?.reasons ?? []),
      };
      return {
        ...base,
        sourceRecordHash: hashCanonicalValue(base),
      };
    }),
    record => record.requirementIdentity
  ).sort((left, right) =>
    left.requirementIdentity.localeCompare(right.requirementIdentity)
  );
  const value = {
    schemaVersion: CHARACTER_ACCEPTANCE_DERIVATION_SCHEMA_VERSION,
    kind: 'character-acceptance-requirement-inventory',
    records: normalized,
    summary: {
      recordCount: normalized.length,
      appliedCount: normalized.filter(
        record => record.sourceDisposition === 'applied'
      ).length,
      gapCount: normalized.filter(record => record.sourceDisposition === 'gap')
        .length,
      notApplicableCount: normalized.filter(
        record => record.sourceDisposition === 'not-applicable'
      ).length,
      dimensionCounts: countBy(normalized, record => record.dimension),
    },
  };
  return { ...value, inventoryHash: hashCanonicalValue(value) };
}

export function finalizeSourceGapInventory(records = []) {
  const normalized = records.map((record, index) => {
    const reasons = uniqueStrings([...(record?.reasons ?? []), record?.reason]);
    const nonGameplay =
      record?.impactClassification !== 'gameplay-impacting' ||
      reasons.some(reason => NON_GAMEPLAY_SOURCE_REASONS.has(reason));
    const status = nonGameplay
      ? 'not-applicable'
      : normalizeBlockingStatus(record?.status, reasons);
    const sourceIdentities = uniqueStrings([
      ...(record?.sourceIdentities ?? []),
      record?.sourceIdentity,
      ...(record?.rawRecordIdentities ?? []),
    ]);
    const uniqueGapIdentity =
      'source-gap:' +
      hashCanonicalValue({
        status,
        reason: reasons.join('|') || 'source-evidence-gap',
        sourceKind: record?.sourceKind ?? null,
        sourceIdentities,
      });
    const base = {
      uniqueGapIdentity,
      sourceRecordIdentities: uniqueStrings([
        ...(record?.sourceRecordIdentities ?? []),
        record?.recordIdentity ??
          (record?.sourceRecordIdentities?.length
            ? null
            : `source-gap:${index}`),
        ...(record?.rawRecordIdentities ?? []),
      ]),
      status,
      reason: reasons.join('|') || 'source-evidence-gap',
      sourceKind: record?.sourceKind ?? null,
      sourceIdentities,
      impactClassification: nonGameplay
        ? 'not-applicable'
        : 'gameplay-impacting',
      blocking: !nonGameplay,
      ...(record?.acceptanceDisposition == null
        ? {}
        : {
            acceptanceDisposition: structuredClone(
              record.acceptanceDisposition
            ),
          }),
      ...(record?.scenarioScope == null
        ? {}
        : {
            scenarioScope: structuredClone(record.scenarioScope),
          }),
    };
    return { ...base, sourceRecordHash: hashCanonicalValue(base) };
  });
  const deduped = [
    ...normalized
      .reduce((map, record) => {
        const previous = map.get(record.uniqueGapIdentity);
        if (!previous) {
          map.set(record.uniqueGapIdentity, record);
          return map;
        }
        const merged = {
          ...previous,
          sourceRecordIdentities: uniqueStrings([
            ...previous.sourceRecordIdentities,
            ...record.sourceRecordIdentities,
          ]),
        };
        merged.sourceRecordHash = hashCanonicalValue(
          withoutKey(merged, 'sourceRecordHash')
        );
        map.set(record.uniqueGapIdentity, merged);
        return map;
      }, new Map())
      .values(),
  ].sort((left, right) =>
    left.uniqueGapIdentity.localeCompare(right.uniqueGapIdentity)
  );
  const value = {
    schemaVersion: CHARACTER_ACCEPTANCE_DERIVATION_SCHEMA_VERSION,
    kind: 'character-acceptance-source-gap-inventory',
    records: deduped,
    summary: {
      uniqueGapCount: deduped.length,
      blockingCount: deduped.filter(record => record.blocking).length,
      nonBlockingCount: deduped.filter(record => !record.blocking).length,
      statusCounts: countBy(deduped, record => record.status),
      reasonCounts: countBy(deduped, record => record.reason),
    },
  };
  return { ...value, inventoryHash: hashCanonicalValue(value) };
}

export function finalizeScenarioCases(records = []) {
  const normalized = dedupeBy(
    records.map((record, index) => finalizeScenarioCase(record, index)),
    record => record.scenarioIdentity
  ).sort((left, right) =>
    left.scenarioIdentity.localeCompare(right.scenarioIdentity)
  );
  const value = {
    schemaVersion: CHARACTER_ACCEPTANCE_DERIVATION_SCHEMA_VERSION,
    kind: 'character-acceptance-scenario-case-set',
    records: normalized,
    summary: {
      scenarioCount: normalized.length,
      executionPassedCount: normalized.filter(
        record => record.execution.status === 'passed'
      ).length,
      assertionCount: normalized.reduce(
        (sum, record) => sum + record.assertions.length,
        0
      ),
      assertionPassedCount: normalized.reduce(
        (sum, record) =>
          sum +
          record.assertions.filter(assertion => assertion.status === 'passed')
            .length,
        0
      ),
      runnerKindCounts: countBy(normalized, record => record.runnerKind),
    },
  };
  return { ...value, scenarioSetHash: hashCanonicalValue(value) };
}

export function deriveCoverageEdges(
  requirementInventory,
  scenarioCases,
  { denominator = {}, runtimeCoverageSummary = {} } = {}
) {
  const edges = [];
  for (const requirement of requirementInventory.records) {
    if (
      requirement.sourceDisposition !== 'applied' ||
      !requirement.coverageSelector
    ) {
      continue;
    }
    for (const scenario of scenarioCases.records) {
      if (scenario.execution.status !== 'passed') continue;
      for (const assertion of scenario.assertions) {
        if (
          assertion.status !== 'passed' ||
          !selectorMatches(requirement.coverageSelector, assertion.selector)
        ) {
          continue;
        }
        const base = {
          requirementIdentity: requirement.requirementIdentity,
          scenarioIdentity: scenario.scenarioIdentity,
          assertionIdentity: assertion.assertionIdentity,
          selector: requirement.coverageSelector,
          assertionHash: assertion.assertionHash,
          traceProjectionHash: scenario.traceProjectionHash,
          status: 'verified',
        };
        edges.push({
          ...base,
          edgeIdentity: 'coverage-edge:' + hashCanonicalValue(base),
        });
      }
    }
  }
  const deduped = dedupeBy(edges, edge => edge.edgeIdentity).sort(
    (left, right) => left.edgeIdentity.localeCompare(right.edgeIdentity)
  );
  const value = {
    schemaVersion: CHARACTER_ACCEPTANCE_DERIVATION_SCHEMA_VERSION,
    kind: 'character-acceptance-coverage-edge-set',
    edges: deduped,
    denominator: structuredClone(denominator ?? {}),
    runtimeCoverageSummary: structuredClone(runtimeCoverageSummary ?? {}),
    summary: {
      edgeCount: deduped.length,
      coveredRequirementCount: new Set(
        deduped.map(edge => edge.requirementIdentity)
      ).size,
      scenarioCounts: countBy(deduped, edge => edge.scenarioIdentity),
    },
  };
  return { ...value, coverageHash: hashCanonicalValue(value) };
}

export function deriveAcceptanceMatrix(requirementInventory, coverage) {
  const edgesByRequirement = groupBy(
    coverage.edges,
    edge => edge.requirementIdentity
  );
  const requirements = requirementInventory.records.map(source => {
    const edges = edgesByRequirement.get(source.requirementIdentity) ?? [];
    const notApplicable = source.sourceDisposition === 'not-applicable';
    const passed = source.sourceDisposition === 'applied' && edges.length > 0;
    return {
      requirementIdentity: source.requirementIdentity,
      dimension: source.dimension,
      subjectIdentity: source.subjectIdentity,
      required: !notApplicable,
      status: notApplicable ? 'not-applicable' : passed ? 'passed' : 'blocked',
      contractStatus: source.contractStatus,
      sourceDisposition: source.sourceDisposition,
      sourceRecordHash: source.sourceRecordHash,
      coverageSelector: source.coverageSelector,
      coverageEdgeIds: edges.map(edge => edge.edgeIdentity),
      evidenceScenarioIds: uniqueStrings(
        edges.map(edge => edge.scenarioIdentity)
      ),
      sourceIdentities: source.sourceIdentities,
      ...(source.optimizationScenario == null
        ? {}
        : {
            optimizationScenario: structuredClone(source.optimizationScenario),
          }),
      ...(source.scenarioScope == null
        ? {}
        : {
            scenarioScope: structuredClone(source.scenarioScope),
          }),
      ...(source.sourceGapDisposition == null
        ? {}
        : {
            sourceGapDisposition: structuredClone(source.sourceGapDisposition),
          }),
      reasons: notApplicable
        ? source.reasons.length
          ? source.reasons
          : ['source-confirmed-not-applicable']
        : passed
          ? []
          : source.sourceDisposition === 'gap'
            ? source.reasons.length
              ? source.reasons
              : ['source-evidence-gap']
            : [
                source.coverageSelector
                  ? 'acceptance-scenario-coverage-missing'
                  : 'acceptance-selector-unavailable',
              ],
    };
  });
  const value = {
    schemaVersion: CHARACTER_ACCEPTANCE_DERIVATION_SCHEMA_VERSION,
    kind: 'character-acceptance-derived-matrix',
    requirements,
    summary: summarizeRequirements(requirements),
  };
  return { ...value, matrixHash: hashCanonicalValue(value) };
}

export function deriveAcceptanceLedger(sourceGapInventory, matrix) {
  const sourceGaps = sourceGapInventory.records
    .filter(record => record.blocking)
    .map(record => ({
      recordIdentity: record.uniqueGapIdentity,
      uniqueGapIdentity: record.uniqueGapIdentity,
      category: 'upstream-source-gap',
      status: record.status,
      reason: record.reason,
      sourceKind: record.sourceKind,
      sourceIdentities: record.sourceIdentities,
      sourceRecordIdentities: record.sourceRecordIdentities,
      blocking: true,
    }));
  const acceptanceGaps = matrix.requirements
    .filter(
      requirement =>
        requirement.required &&
        requirement.status === 'blocked' &&
        requirement.sourceDisposition === 'applied'
    )
    .map(requirement => {
      const base = {
        category: 'acceptance-scenario-gap',
        requirementIdentity: requirement.requirementIdentity,
        status: 'static-evidence-gap',
        reason:
          requirement.reasons[0] ?? 'acceptance-scenario-coverage-missing',
        sourceIdentities: requirement.sourceIdentities,
        blocking: true,
      };
      const uniqueGapIdentity =
        'acceptance-gap:' +
        hashCanonicalValue({
          requirementIdentity: base.requirementIdentity,
          reason: base.reason,
        });
      return {
        ...base,
        recordIdentity: uniqueGapIdentity,
        uniqueGapIdentity,
      };
    });
  const records = dedupeBy(
    [...sourceGaps, ...acceptanceGaps],
    record => record.uniqueGapIdentity
  ).sort((left, right) =>
    left.uniqueGapIdentity.localeCompare(right.uniqueGapIdentity)
  );
  const nonBlockingRecords = sourceGapInventory.records
    .filter(record => !record.blocking)
    .map(record => ({
      recordIdentity: record.uniqueGapIdentity,
      uniqueGapIdentity: record.uniqueGapIdentity,
      category: 'non-gameplay-source-record',
      status: record.status,
      reason: record.reason,
      sourceKind: record.sourceKind,
      sourceIdentities: record.sourceIdentities,
      sourceRecordIdentities: record.sourceRecordIdentities,
      blocking: false,
    }));
  const value = {
    schemaVersion: CHARACTER_ACCEPTANCE_DERIVATION_SCHEMA_VERSION,
    kind: 'character-acceptance-derived-ledger',
    sourceGaps,
    acceptanceGaps,
    records,
    nonBlockingRecords,
    summary: {
      uniqueBlockingCount: records.length,
      sourceGapCount: sourceGaps.length,
      acceptanceGapCount: acceptanceGaps.length,
      nonBlockingCount: nonBlockingRecords.length,
      statusCounts: countBy(records, record => record.status),
      reasonCounts: countBy(records, record => record.reason),
      categoryCounts: countBy(records, record => record.category),
    },
  };
  return { ...value, ledgerHash: hashCanonicalValue(value) };
}

export function deriveNotApplicableRecords(
  requirementInventory,
  sourceGapInventory
) {
  const requirementRecords = requirementInventory.records
    .filter(record => record.sourceDisposition === 'not-applicable')
    .map(record => ({
      recordIdentity: 'not-applicable:' + record.requirementIdentity,
      status: 'not-applicable',
      reason: record.reasons[0] ?? 'source-confirmed-not-applicable',
      sourceKind: 'requirement-inventory',
      sourceIdentities: record.sourceIdentities,
      sourceRecordHash: record.sourceRecordHash,
      ...(record.optimizationScenario == null
        ? {}
        : {
            optimizationScenario: structuredClone(record.optimizationScenario),
          }),
      ...(record.scenarioScope == null
        ? {}
        : {
            scenarioScope: structuredClone(record.scenarioScope),
          }),
      ...(record.sourceGapDisposition == null
        ? {}
        : {
            sourceGapDisposition: structuredClone(record.sourceGapDisposition),
          }),
    }));
  const sourceRecords = sourceGapInventory.records
    .filter(record => !record.blocking)
    .map(record => ({
      recordIdentity: 'not-applicable:' + record.uniqueGapIdentity,
      status: 'not-applicable',
      reason: record.reason,
      sourceKind: record.sourceKind,
      sourceIdentities: record.sourceIdentities,
      sourceRecordHash: record.sourceRecordHash,
      ...(record.acceptanceDisposition == null
        ? {}
        : {
            acceptanceDisposition: structuredClone(
              record.acceptanceDisposition
            ),
          }),
      ...(record.scenarioScope == null
        ? {}
        : {
            scenarioScope: structuredClone(record.scenarioScope),
          }),
    }));
  return dedupeBy(
    [...requirementRecords, ...sourceRecords],
    record => record.recordIdentity
  ).sort((left, right) =>
    left.recordIdentity.localeCompare(right.recordIdentity)
  );
}

function finalizeScenarioCase(record, index) {
  const scenarioIdentity = String(
    record?.scenarioIdentity ?? `scenario:${index}`
  );
  const traceProjection = normalizeTraceProjection(record?.traceProjection);
  const traceProjectionHash = hashCanonicalValue(traceProjection);
  const assertionDefinitions = [
    ...createProjectionAssertionDefinitions(traceProjection),
    ...(record?.assertionDefinitions ??
      record?.assertionResults ??
      record?.assertions ??
      []),
  ];
  const assertions = dedupeBy(
    assertionDefinitions.map((assertion, assertionIndex) => {
      const selector = normalizeSelector(assertion?.selector);
      const matches = selector
        ? resolveSelectorMatches(traceProjection, selector)
        : [];
      const passed = selector
        ? evaluateSelectorExpectation(matches, assertion?.expectation)
        : assertion?.status === 'passed' || assertion?.passed === true;
      const base = {
        assertionIdentity: String(
          assertion?.assertionIdentity ??
            assertion?.identity ??
            `assertion:${assertionIndex}`
        ),
        selector,
        expectation: normalizeExpectation(assertion?.expectation),
        status: passed ? 'passed' : 'blocked',
        actualProjectionIdentities: matches.map(
          match => match.projectionIdentity
        ),
        reasons: passed
          ? []
          : uniqueStrings([
              ...(assertion?.reasons ?? []),
              assertion?.reason,
              'scenario-assertion-not-satisfied',
            ]),
      };
      return { ...base, assertionHash: hashCanonicalValue(base) };
    }),
    assertion => assertion.assertionIdentity
  ).sort((left, right) =>
    left.assertionIdentity.localeCompare(right.assertionIdentity)
  );
  const execution = {
    status: record?.execution?.status ?? record?.status ?? 'blocked',
    stableReplay:
      record?.execution?.stableReplay ?? record?.stableReplay ?? false,
    workbenchRoundTrip:
      record?.execution?.workbenchRoundTrip ??
      record?.workbenchRoundTrip ??
      'not-applicable',
    canonicalHashes: structuredClone(
      record?.execution?.canonicalHashes ?? record?.canonicalHashes ?? null
    ),
  };
  const base = {
    schemaVersion: CHARACTER_ACCEPTANCE_SCENARIO_CASE_SCHEMA_VERSION,
    scenarioIdentity,
    runnerKind: String(record?.runnerKind ?? 'machine-axis'),
    inputReference: structuredClone(record?.inputReference ?? {}),
    execution,
    traceProjection,
    traceProjectionHash,
    assertions,
  };
  return { ...base, scenarioCaseHash: hashCanonicalValue(base) };
}

function createProjectionAssertionDefinitions(projection) {
  const definitions = [];
  const selectorKeys = new Set();
  const add = (assertionIdentity, selector) => {
    const selectorKey = JSON.stringify(selector);
    if (selectorKeys.has(selectorKey)) return;
    selectorKeys.add(selectorKey);
    definitions.push({
      assertionIdentity,
      selector,
      expectation: { minimumCount: 1 },
    });
  };
  for (const row of projection.actionForms) {
    add('trace-action-form:' + row.projectionIdentity, {
      kind: 'action-form',
      ownerId: row.ownerId,
      controlSkillId: row.controlSkillId,
      subSkillIndex: row.subSkillIndex,
      actionId: row.actionId,
    });
  }
  for (const row of projection.hits) {
    add('trace-hit:' + row.projectionIdentity, {
      kind: 'hit',
      hitIdentity: row.hitIdentity,
      actionId: row.actionId,
    });
  }
  for (const row of projection.effects) {
    add('trace-effect:' + row.projectionIdentity, {
      kind: 'effect',
      effectIdentity: row.effectIdentity,
      actionId: row.actionId,
      operation: row.operation,
    });
  }
  for (const row of projection.resources) {
    add('trace-resource:' + row.projectionIdentity, {
      kind: 'resource',
      resourceIdentity: row.resourceIdentity,
      actionId: row.actionId,
      operation: row.operation,
    });
  }
  for (const row of projection.states) {
    add('trace-state:' + row.projectionIdentity, {
      kind: 'state',
      stateIdentity: row.stateIdentity,
      actionId: row.actionId,
      operation: row.operation,
    });
  }
  for (const row of projection.attackInputChains) {
    add('trace-attack-input-chain:' + row.projectionIdentity, {
      kind: 'attack-input-chain',
      chainIdentity: row.chainIdentity,
    });
  }
  for (const row of projection.controlWindows) {
    add('trace-control-window:' + row.projectionIdentity, {
      kind: 'control-window',
      windowIdentity: row.windowIdentity,
      controlSkillId: row.controlSkillId,
      subSkillIndex: row.subSkillIndex,
    });
  }
  for (const row of projection.variantEdges) {
    add('trace-variant-edge:' + row.projectionIdentity, {
      kind: 'variant-edge',
      edgeIdentity: row.edgeIdentity,
      sourceControlSkillId: row.sourceControlSkillId,
      sourceSubSkillIndex: row.sourceSubSkillIndex,
    });
  }
  for (const row of projection.variantWindows) {
    add('trace-variant-window:' + row.projectionIdentity, {
      kind: 'variant-window',
      bindingIdentity: row.bindingIdentity,
      sourceControlSkillId: row.sourceControlSkillId,
      sourceSubSkillIndex: row.sourceSubSkillIndex,
    });
  }
  for (const row of projection.conditionalHitGroups) {
    add('trace-conditional-hit-group:' + row.projectionIdentity, {
      kind: 'conditional-hit-group',
      groupIdentity: row.groupIdentity,
      controlSkillId: row.controlSkillId,
      subSkillIndex: row.subSkillIndex,
    });
  }
  for (const row of projection.passives) {
    add('trace-passive:' + row.projectionIdentity, {
      kind: 'passive',
      passiveIdentity: row.passiveIdentity,
      effectId: row.effectId,
    });
  }
  for (const row of projection.switchTriggers) {
    add('trace-switch-trigger:' + row.projectionIdentity, {
      kind: 'switch-trigger',
      profileIdentity: row.profileIdentity,
      triggerPhase: row.triggerPhase,
      controlSkillId: row.controlSkillId,
    });
  }
  for (const row of projection.criticalDecisions) {
    add('trace-critical-decision:' + row.projectionIdentity, {
      kind: 'critical-effective-threshold',
      expectedBasisPoints: row.effectiveThresholdBasisPoints,
      actionId: row.actionId,
      hitIdentity: row.hitIdentity,
    });
  }
  for (const [factIdentity] of Object.entries(projection.facts)) {
    add('scenario-fact:' + factIdentity, {
      kind: 'scenario-fact',
      factIdentity,
      expectedValue: true,
    });
  }
  return definitions;
}

function normalizeTraceProjection(projection = {}) {
  return {
    actionForms: normalizeProjectionRows(projection.actionForms),
    hits: normalizeProjectionRows(projection.hits),
    effects: normalizeProjectionRows(projection.effects),
    resources: normalizeProjectionRows(projection.resources),
    states: normalizeProjectionRows(projection.states),
    attackInputChains: normalizeProjectionRows(projection.attackInputChains),
    controlWindows: normalizeProjectionRows(projection.controlWindows),
    variantEdges: normalizeProjectionRows(projection.variantEdges),
    variantWindows: normalizeProjectionRows(projection.variantWindows),
    conditionalHitGroups: normalizeProjectionRows(
      projection.conditionalHitGroups
    ),
    passives: normalizeProjectionRows(projection.passives),
    switchTriggers: normalizeProjectionRows(projection.switchTriggers),
    diagnostics: normalizeProjectionRows(projection.diagnostics),
    criticalDecisions: normalizeProjectionRows(projection.criticalDecisions),
    facts: Object.fromEntries(
      Object.entries(projection.facts ?? {}).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
  };
}

function normalizeProjectionRows(rows = []) {
  return dedupeBy(
    (rows ?? []).map((row, index) => {
      const base = structuredClone(row ?? {});
      delete base.projectionIdentity;
      return {
        ...base,
        projectionIdentity:
          row?.projectionIdentity ?? hashCanonicalValue({ index, ...base }),
      };
    }),
    row => row.projectionIdentity
  ).sort((left, right) =>
    left.projectionIdentity.localeCompare(right.projectionIdentity)
  );
}

function resolveSelectorMatches(projection, selector) {
  if (selector.kind === 'scenario-fact') {
    const value = projection.facts?.[selector.factIdentity];
    return value === selector.expectedValue
      ? [
          {
            projectionIdentity: 'fact:' + selector.factIdentity,
            value,
          },
        ]
      : [];
  }
  const collectionName = {
    'action-form': 'actionForms',
    hit: 'hits',
    effect: 'effects',
    resource: 'resources',
    state: 'states',
    'attack-input-chain': 'attackInputChains',
    'control-window': 'controlWindows',
    'variant-edge': 'variantEdges',
    'variant-window': 'variantWindows',
    'conditional-hit-group': 'conditionalHitGroups',
    passive: 'passives',
    'switch-trigger': 'switchTriggers',
    diagnostic: 'diagnostics',
    'critical-effective-threshold': 'criticalDecisions',
  }[selector.kind];
  if (!collectionName) return [];
  const selectorFields = Object.entries(selector).filter(
    ([key]) => !['kind', 'expectedBasisPoints'].includes(key)
  );
  return (projection[collectionName] ?? []).filter(row => {
    if (
      selector.kind === 'critical-effective-threshold' &&
      Number(row.effectiveThresholdBasisPoints) !==
        Number(selector.expectedBasisPoints)
    ) {
      return false;
    }
    return selectorFields.every(([key, value]) => sameScalar(row[key], value));
  });
}

function evaluateSelectorExpectation(matches, expectation = {}) {
  const minimumCount = Number(expectation?.minimumCount ?? 1);
  const maximumCount = Number(expectation?.maximumCount ?? Infinity);
  return matches.length >= minimumCount && matches.length <= maximumCount;
}

function selectorMatches(requiredSelector, assertionSelector) {
  if (!requiredSelector || !assertionSelector) return false;
  if (requiredSelector.kind !== assertionSelector.kind) return false;
  return Object.entries(requiredSelector).every(([key, value]) =>
    sameScalar(assertionSelector[key], value)
  );
}

function normalizeSelector(selector) {
  if (!selector || typeof selector !== 'object') return null;
  return Object.fromEntries(
    Object.entries(structuredClone(selector))
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function normalizeExpectation(expectation) {
  return {
    minimumCount: Number(expectation?.minimumCount ?? 1),
    ...(Number.isFinite(Number(expectation?.maximumCount))
      ? { maximumCount: Number(expectation.maximumCount) }
      : {}),
  };
}

function normalizeSourceDisposition(record) {
  const reasons = uniqueStrings([...(record?.reasons ?? []), record?.reason]);
  if (
    record?.sourceDisposition === 'not-applicable' ||
    record?.status === 'not-applicable' ||
    record?.impactClassification === 'not-applicable' ||
    reasons.some(reason => NON_GAMEPLAY_SOURCE_REASONS.has(reason))
  ) {
    return 'not-applicable';
  }
  if (
    record?.sourceDisposition === 'applied' ||
    record?.applied === true ||
    record?.runtimeReady === true ||
    record?.classification === 'applied' ||
    record?.mechanicsClassification === 'applied' ||
    record?.sourceEvidenceStatus === 'applied' ||
    String(record?.status ?? '') === 'applied' ||
    String(record?.status ?? '').startsWith('verified-') ||
    String(record?.status ?? '').endsWith('-ready')
  ) {
    return 'applied';
  }
  return 'gap';
}

function normalizeBlockingStatus(status, reasons) {
  if (reasons.some(reason => reason.includes('formula'))) {
    return 'unknown-formula';
  }
  return status === 'runtime-evidence-required'
    ? 'runtime-evidence-required'
    : 'static-evidence-gap';
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

function sameScalar(left, right) {
  if (typeof right === 'number') return Number(left) === right;
  return left === right;
}

function withoutKey(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return copy;
}

function uniqueStrings(values) {
  return [
    ...new Set((values ?? []).filter(value => value != null).map(String)),
  ].sort();
}

function dedupeBy(rows, selector) {
  return [...new Map(rows.map(row => [selector(row), row])).values()];
}

function groupBy(rows, selector) {
  const map = new Map();
  for (const row of rows) {
    const key = selector(row);
    const values = map.get(key) ?? [];
    values.push(row);
    map.set(key, values);
  }
  return map;
}

function countBy(rows, selector) {
  return Object.fromEntries(
    [
      ...rows.reduce((map, row) => {
        const key = String(selector(row));
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map()),
    ].sort(([left], [right]) => left.localeCompare(right))
  );
}
