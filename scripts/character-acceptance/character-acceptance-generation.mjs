import { hashCanonicalValue } from '../../src/simulation/headless/canonicalSerialization.js';
import { deriveCharacterAcceptanceArtifacts } from '../../src/character-acceptance/characterAcceptanceDerivation.js';
import {
  createOptimizationScenarioRequirementClassifier,
  getOptimizationCandidateRosterPolicy,
  getOptimizationScenarioPolicy,
} from '../../src/optimization-scenario/optimizationScenarioPolicy.js';
import {
  CHARACTER_ACCEPTANCE_CONTRACT_NAME,
  CHARACTER_ACCEPTANCE_MANIFEST_INDEX_CONTRACT_NAME,
  CHARACTER_ACCEPTANCE_MANIFEST_INDEX_SCHEMA_VERSION,
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
  const requirementInventory = {
    records: createCharacterAcceptanceRequirementSources({
      profile,
      sourceGapRecords: unresolvedLedger?.records ?? [],
    }),
  };
  const sourceGapInventory = {
    records: structuredClone(unresolvedLedger?.records ?? []),
  };
  const scenarioCases = {
    records: createCharacterAcceptanceScenarioCaseSources({
      goldens,
      visualScenario,
      profile,
    }),
  };
  const evidence = {
    canonicalGoldens: goldenEvidence,
    machineScenarios: [toPublicVisualScenarioEvidence(visualScenario)],
    productVisualAcceptance: {
      status: recipe.productVisualAcceptance?.status ?? 'pending',
      scenarioIdentities: [visualScenario.scenarioIdentity],
      acceptanceCommit:
        recipe.productVisualAcceptance?.acceptanceCommit ?? null,
      recordIdentity: recipe.productVisualAcceptance?.recordIdentity ?? null,
      qualificationSubjectHash:
        recipe.productVisualAcceptance?.qualificationSubjectHash ?? null,
      scenarioSetHash: recipe.productVisualAcceptance?.scenarioSetHash ?? null,
      automatedEvidence: structuredClone(
        recipe.productVisualAcceptance?.automatedEvidence ?? []
      ),
    },
  };
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
      optimizationScenarioPolicy: {
        policyId: getOptimizationScenarioPolicy().policyId,
        policyHash: getOptimizationScenarioPolicy().policyHash,
        rosterPolicyId: getOptimizationCandidateRosterPolicy().rosterPolicyId,
        rosterHash: getOptimizationCandidateRosterPolicy().rosterHash,
        reason: getOptimizationScenarioPolicy().reason,
      },
    },
    evidence,
    requirementInventory,
    sourceGapInventory,
    scenarioCases,
    coverageContext: {
      denominator: structuredClone(profile.denominator ?? {}),
      runtimeCoverageSummary: structuredClone(runtimeCoverage?.summary ?? {}),
    },
  };
  return finalizeCharacterAcceptanceManifest(input);
}

export function createCharacterAcceptanceMatrix({
  profile,
  runtimeCoverage,
  goldens,
  visualScenario,
}) {
  return deriveCharacterAcceptanceArtifacts({
    requirementInventory: {
      records: createCharacterAcceptanceRequirementSources({ profile }),
    },
    sourceGapInventory: { records: [] },
    scenarioCases: {
      records: createCharacterAcceptanceScenarioCaseSources({
        goldens,
        visualScenario,
        profile,
      }),
    },
    denominator: profile.denominator ?? {},
    runtimeCoverageSummary: runtimeCoverage?.summary ?? {},
  }).matrix;
}

export function createCharacterAcceptanceRequirementSources({
  profile,
  sourceGapRecords = [],
}) {
  const ownerId = Number(profile.owner?.ownerId);
  const requirements = [];
  const classifyOptimizationScope =
    createOptimizationScenarioRequirementClassifier(profile);
  const classifyNonBlockingSourceRecord =
    createNonBlockingSourceRecordClassifier(sourceGapRecords);
  for (const [dimension, contractKey] of CONTRACT_DIMENSIONS) {
    const records = flattenContractRecords(
      profile.contracts?.[contractKey],
      contractKey
    );
    records.forEach((record, index) => {
      const subjectIdentity = resolveContractIdentity(record, dimension, index);
      const optimizationScenario = classifyOptimizationScope(record);
      const sourceGapDisposition =
        classifyNonBlockingSourceRecord(record);
      const productBoundaryEvidence = createProductBoundaryEvidence({
        ownerId,
        profile,
        record,
        sourceGapDisposition,
      });
      const aggregateStatDependency =
        dimension === 'stat-dependency' &&
        Array.isArray(record.static) &&
        Array.isArray(record.dynamic);
      const notApplicable =
        isNotApplicableRecord(record) ||
        isUnwiredControlWindowRequirement(record, dimension, profile) ||
        optimizationScenario != null ||
        sourceGapDisposition != null ||
        aggregateStatDependency;
      requirements.push({
        requirementIdentity: 'contract:' + dimension + ':' + subjectIdentity,
        dimension,
        subjectIdentity,
        sourceDisposition: notApplicable
          ? 'not-applicable'
          : isAppliedRecord(record)
            ? 'applied'
            : 'gap',
        contractStatus: record.status ?? (record.applied ? 'applied' : null),
        impactClassification:
          record.impactClassification ??
          (notApplicable ? 'not-applicable' : 'gameplay-impacting'),
        coverageSelector: createContractCoverageSelector({
          record,
          dimension,
          ownerId,
        }),
        sourceIdentities: collectSourceIdentities(record),
        ...(optimizationScenario == null
          ? {}
          : { optimizationScenario }),
        ...(sourceGapDisposition == null
          ? {}
          : { sourceGapDisposition }),
        ...(productBoundaryEvidence == null
          ? {}
          : { productBoundaryEvidence }),
        reasons: notApplicable
          ? [
              ...(optimizationScenario?.reason
                ? [optimizationScenario.reason]
                : []),
              ...(sourceGapDisposition?.reasons ?? []),
              ...(aggregateStatDependency
                ? ['aggregate-stat-dependency-index-not-standalone-requirement']
                : []),
              ...(normalizeReasons(record).length
                ? normalizeReasons(record)
                : ['source-confirmed-not-applicable']),
              ...(isUnwiredControlWindowRequirement(record, dimension, profile)
                ? ['client-internal-unwired-control-window']
                : []),
            ]
          : isAppliedRecord(record)
            ? []
            : normalizeReasons(record),
      });
    });
  }
  return [
    ...new Map(
      requirements.map(requirement => [
        requirement.requirementIdentity,
        requirement,
      ])
    ).values(),
    ...createProtocolRequirementSources(ownerId),
  ].sort((left, right) =>
    left.requirementIdentity.localeCompare(right.requirementIdentity)
  );
}

export function createCharacterAcceptanceScenarioCaseSources({
  goldens,
  visualScenario,
  profile,
}) {
  return [
    ...goldens.map(golden =>
      createGoldenScenarioCaseSource({ ...golden, profile })
    ),
    createVisualScenarioCaseSource(visualScenario),
  ];
}

function createProductBoundaryEvidence({
  ownerId,
  profile,
  record,
  sourceGapDisposition,
}) {
  if (Number(ownerId) !== 109001 || Number(record?.elementId) !== 799) {
    return null;
  }
  const rootPathId = String(
    record.relationPath?.[0]?.from ?? ''
  ).replace(/^element:/, '');
  const rootRecord = flattenContractRecords(
    profile?.contracts?.effects,
    'effects'
  ).find(
    candidate =>
      Number(candidate?.controlSkillId) === Number(record.controlSkillId) &&
      Number(candidate?.mapIndex) === Number(record.mapIndex) &&
      String(candidate?.pathId) === rootPathId
  );
  return {
    schemaVersion: 1,
    evidenceIdentity: 'm12-b3-e20-2-109001-s3:m23:element-799-orphan',
    evidenceKind: 'client-resource-graph-native-consumer-boundary',
    disposition: 'not-applicable',
    reason: 'm23-client-orphan-no-reachable-native-consumer',
    resourceGraph: {
      controlSkillId: Number(record.controlSkillId),
      mapIndex: Number(record.mapIndex),
      triggerFrame: Number(record.trigger?.startFrame),
      rootElementId: Number(rootRecord?.elementId),
      rootPathId,
      childElementId: Number(record.elementId),
      childPathId: String(record.pathId),
      relationPath: structuredClone(record.relationPath ?? []),
      sourceIdentity: record.sourceIdentity ?? null,
      rootSourceIdentities: structuredClone(
        rootRecord?.sourceIdentities ?? []
      ),
    },
    nativeConsumer: {
      reachable: false,
      rootJudgmentIdentity: String(rootRecord?.semanticIdentity ?? ''),
      sourceRecordIdentities: structuredClone(
        sourceGapDisposition?.sourceRecordIdentities ?? []
      ),
      rawRecordIdentities: structuredClone(
        sourceGapDisposition?.rawRecordIdentities ?? []
      ),
      reasons: structuredClone(sourceGapDisposition?.reasons ?? []),
      conclusion:
        'reference-edge-present-but-root-judgment-has-no-native-current-packet-candidate',
    },
    runtimeBoundary: {
      synthesizedProjectionAllowed: false,
      manualRuntimeRetained: true,
      formalOptimizationRequired: false,
    },
  };
}

function createNonBlockingSourceRecordClassifier(records) {
  const byRawIdentity = new Map();
  const byControlAndElementPath = new Map();
  for (const source of records ?? []) {
    if (source?.impactClassification === 'gameplay-impacting') continue;
    for (const rawIdentity of source?.rawRecordIdentities ?? []) {
      const rows = byRawIdentity.get(String(rawIdentity)) ?? [];
      rows.push(source);
      byRawIdentity.set(String(rawIdentity), rows);
    }
    for (const sourceIdentity of source?.sourceIdentities ?? []) {
      const match = String(sourceIdentity).match(
        /^battle-effect:(\d+):\d+:([^:]+):/
      );
      if (!match) continue;
      const key = `${Number(match[1])}|${match[2]}`;
      const rows = byControlAndElementPath.get(key) ?? [];
      rows.push(source);
      byControlAndElementPath.set(key, rows);
    }
  }
  return record => {
    const rawIdentities = uniqueStrings(record?.rawEffectIdentities ?? []);
    const controlAndElementKeys = uniqueStrings(
      [
        ...rawIdentities.flatMap(identity => {
          const match = String(identity).match(
            /^(\d+)\|\d+\|.*\|element:([^|]+)\|/
          );
          return match ? [`${Number(match[1])}|${match[2]}`] : [];
        }),
        ...(record?.rootBattleIdentities ?? []).map(
          identity => `${Number(record.controlSkillId)}|${identity}`
        ),
      ]
    );
    const matches = [
      ...new Map(
        [
          ...rawIdentities.flatMap(
            identity => byRawIdentity.get(identity) ?? []
          ),
          ...controlAndElementKeys.flatMap(
            key => byControlAndElementPath.get(key) ?? []
          ),
        ]
          .map(source => [String(source.recordIdentity), source])
      ).values(),
    ];
    if (matches.length === 0) return null;
    return {
      disposition: 'not-applicable',
      sourceRecordIdentities: uniqueStrings(
        matches.map(source => source.recordIdentity)
      ),
      rawRecordIdentities: rawIdentities,
      controlAndElementKeys,
      impactClassifications: uniqueStrings(
        matches.map(source => source.impactClassification)
      ),
      reasons: uniqueStrings(
        matches.flatMap(source => [
          'nonblocking-source-record-projection',
          ...(source.reasons ?? []),
        ])
      ),
    };
  };
}

export function createScenarioProfileProjectionRows({
  profile,
  exercisedControls,
  observedEffectIds,
  exercisedFromHitAndEffectIdentities = [],
  scenarioId,
  prefix,
}) {
  const exercised = new Set(
    [
      ...(exercisedControls ?? []).map(
        ([controlSkillId, subSkillIndex]) =>
          `${controlSkillId}|${subSkillIndex}`
      ),
      ...(exercisedFromHitAndEffectIdentities ?? []).flatMap(identity => {
        const match = String(identity ?? '').match(/^(\d+)\|(\d+)\|/);
        return match ? [`${Number(match[1])}|${Number(match[2])}`] : [];
      }),
    ]
  );
  const observed = new Set((observedEffectIds ?? []).map(String));
  const contracts = profile?.contracts ?? {};
  const index = { controlWindows: 0, variantEdges: 0, variantWindows: 0, conditionalHitGroups: 0, passives: 0, switchTriggers: 0 };
  const rows = {
    controlWindows: [],
    variantEdges: [],
    variantWindows: [],
    conditionalHitGroups: [],
    passives: [],
    switchTriggers: [],
  };
  const add = (collection, base) => {
    const sequence = (index[collection] += 1);
    rows[collection].push({
      ...base,
      projectionIdentity:
        `${prefix}-${collection}-${scenarioId}-${sequence}`,
    });
  };
  for (const window of contracts.controlTransitionWindows ?? []) {
    if (
      exercised.has(
        `${window.sourceControlSkillId}|${window.sourceSubSkillIndex}`
      )
    ) {
      add('controlWindows', {
        controlSkillId: window.sourceControlSkillId,
        subSkillIndex: window.sourceSubSkillIndex,
        windowIdentity: window.windowIdentity,
      });
    }
  }
  for (const edge of contracts.variantEdges ?? []) {
    if (
      exercised.has(
        `${edge.sourceControlSkillId}|${edge.sourceSubSkillIndex}`
      )
    ) {
      add('variantEdges', {
        sourceControlSkillId: edge.sourceControlSkillId,
        sourceSubSkillIndex: edge.sourceSubSkillIndex,
        edgeIdentity: edge.edgeIdentity,
      });
    }
  }
  for (const binding of contracts.variantWindowBindings ?? []) {
    if (
      exercised.has(
        `${binding.sourceControlSkillId}|${binding.sourceSubSkillIndex}`
      )
    ) {
      add('variantWindows', {
        sourceControlSkillId: binding.sourceControlSkillId,
        sourceSubSkillIndex: binding.sourceSubSkillIndex,
        bindingIdentity: binding.bindingIdentity,
      });
    }
  }
  for (const group of contracts.conditionalHitGroups ?? []) {
    if (exercised.has(`${group.controlSkillId}|${group.subSkillIndex}`)) {
      add('conditionalHitGroups', {
        controlSkillId: group.controlSkillId,
        subSkillIndex: group.subSkillIndex,
        groupIdentity: group.groupIdentity,
      });
    }
  }
  for (const passive of contracts.passives ?? []) {
    if (passive.effectId && observed.has(String(passive.effectId))) {
      add('passives', {
        passiveIdentity: passive.passiveIdentity,
        effectId: passive.effectId,
      });
    }
  }
  for (const trigger of contracts.switchTriggers ?? []) {
    const exercisedControl = exercised.has(
      `${trigger.controlSkillId}|${trigger.subSkillIndex ?? 0}`
    );
    const starCarryExercised =
      trigger.starCarryActionIdentity &&
      exercised.has(
        `${trigger.sourceSkillId ?? trigger.controlSkillId}|0`
      );
    if (exercisedControl || starCarryExercised) {
      add('switchTriggers', {
        profileIdentity: trigger.profileIdentity,
        triggerPhase: trigger.triggerPhase,
        controlSkillId: trigger.controlSkillId,
      });
    }
  }
  return rows;
}

export function createCharacterAcceptanceManifestIndex(manifests) {
  const entries = [...manifests]
    .sort(
      (left, right) => Number(left.owner.ownerId) - Number(right.owner.ownerId)
    )
    .map(manifest => ({
      ownerId: Number(manifest.owner.ownerId),
      manifestHash: manifest.manifestHash,
      qualificationSubjectHash: manifest.qualificationSubjectHash,
      sourceOfTruthHash: manifest.derivation.sourceOfTruthHash,
      requirementInventoryHash: manifest.requirementInventory.inventoryHash,
      scenarioSetHash: manifest.scenarioCases.scenarioSetHash,
      profileHash: manifest.source.profileHash,
      catalogEntryHash: hashCanonicalValue(
        createCharacterAcceptanceCatalogEntry(manifest)
      ),
    }));
  const value = {
    schemaVersion: CHARACTER_ACCEPTANCE_MANIFEST_INDEX_SCHEMA_VERSION,
    contractName: CHARACTER_ACCEPTANCE_MANIFEST_INDEX_CONTRACT_NAME,
    kind: 'azpr-character-acceptance-manifest-index',
    protocolIdentity: CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY,
    entries,
  };
  return { ...value, indexHash: hashCanonicalValue(value) };
}

export function createCharacterAcceptanceCatalog(
  manifests,
  manifestIndex = createCharacterAcceptanceManifestIndex(manifests)
) {
  const entries = [...manifests]
    .sort(
      (left, right) => Number(left.owner.ownerId) - Number(right.owner.ownerId)
    )
    .map(createCharacterAcceptanceCatalogEntry);
  const value = {
    schemaVersion: 1,
    contractName: 'AzPrCharacterAcceptanceCatalog',
    kind: 'azpr-character-acceptance-catalog',
    protocolIdentity: CHARACTER_ACCEPTANCE_PROTOCOL_IDENTITY,
    manifestIndexHash: manifestIndex.indexHash,
    optimizationScenarioPolicy: {
      policyId: getOptimizationScenarioPolicy().policyId,
      policyHash: getOptimizationScenarioPolicy().policyHash,
    },
    optimizationCandidateRoster: structuredClone(
      getOptimizationCandidateRosterPolicy()
    ),
    productScenarioExcludedCharacters: structuredClone(
      getOptimizationCandidateRosterPolicy().productScenarioExcludedCharacters
    ),
    entries,
    summary: {
      ownerCount: entries.length,
      formalCharacterDenominator:
        getOptimizationCandidateRosterPolicy().formalDenominator,
      productScenarioExcludedCharacterCount:
        getOptimizationCandidateRosterPolicy().productScenarioExcludedCharacters
          .length,
      maturityCounts: countBy(entries, entry => entry.maturityState),
      optimizationReadyCount: entries.filter(entry => entry.optimizationReady)
        .length,
    },
  };
  return { ...value, catalogHash: hashCanonicalValue(value) };
}

function createCharacterAcceptanceCatalogEntry(manifest) {
  return {
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
    qualificationSubjectHash: manifest.qualificationSubjectHash,
    sourceOfTruthHash: manifest.derivation.sourceOfTruthHash,
    profileHash: manifest.source.profileHash,
    visualScenarioIds:
      manifest.evidence.productVisualAcceptance.scenarioIdentities,
  };
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

function createProtocolRequirementSources(ownerId) {
  const sourceIdentity =
    'protocol:m11-d-character-acceptance-v1:owner:' + ownerId;
  const definitions = [
    [
      'normal-trigger-positive',
      'scenario-positive',
      {
        kind: 'scenario-fact',
        factIdentity: 'normal-trigger-positive',
        expectedValue: true,
      },
      'authoritative-positive-scenario-missing',
    ],
    [
      'condition-insufficient-negative',
      'scenario-negative',
      {
        kind: 'scenario-fact',
        factIdentity: 'condition-insufficient-negative',
        expectedValue: true,
      },
      'insufficient-condition-negative-scenario-missing',
    ],
    [
      'input-window-inside-outside-boundaries',
      'window-boundary',
      {
        kind: 'scenario-fact',
        factIdentity: 'input-window-inside-outside-boundaries',
        expectedValue: true,
      },
      'exact-window-boundary-scenario-matrix-missing',
    ],
    [
      'resource-exact-and-insufficient',
      'resource-boundary',
      {
        kind: 'scenario-fact',
        factIdentity: 'resource-exact-and-insufficient',
        expectedValue: true,
      },
      'resource-boundary-scenario-missing',
    ],
    [
      'buff-apply-refresh-stack-expire',
      'buff-lifecycle',
      {
        kind: 'scenario-fact',
        factIdentity: 'buff-apply-refresh-stack-expire',
        expectedValue: true,
      },
      'complete-buff-lifecycle-scenario-missing',
    ],
    [
      'hit-landed-and-miss',
      'hit-override',
      {
        kind: 'scenario-fact',
        factIdentity: 'critical:missSuppressesHit',
        expectedValue: true,
      },
      'hit-miss-scenario-missing',
    ],
    [
      'foreground-background-switch',
      'controlled-actor',
      {
        kind: 'scenario-fact',
        factIdentity: 'foreground-background-switch',
        expectedValue: true,
      },
      'foreground-background-switch-scenario-missing',
    ],
    [
      'save-import-replay',
      'persistence-replay',
      {
        kind: 'scenario-fact',
        factIdentity: 'workbench-import-export-round-trip',
        expectedValue: true,
      },
      'machine-axis-workbench-round-trip-failed',
    ],
    [
      'critical-sampled-same-seed',
      'critical',
      {
        kind: 'scenario-fact',
        factIdentity: 'critical:sameSeedReplay',
        expectedValue: true,
      },
      'critical-sampled-replay-missing',
    ],
    [
      'critical-integer-threshold-boundary',
      'critical',
      {
        kind: 'scenario-fact',
        factIdentity: 'critical:integerThresholdBoundary',
        expectedValue: true,
      },
      'critical-integer-threshold-boundary-missing',
    ],
    [
      'critical-per-hit-modes',
      'critical',
      {
        kind: 'scenario-fact',
        factIdentity: 'critical:perHitModes',
        expectedValue: true,
      },
      'critical-per-hit-mode-matrix-missing',
    ],
    [
      'critical-miss-coexistence',
      'critical',
      {
        kind: 'scenario-fact',
        factIdentity: 'critical:missSuppressesHit',
        expectedValue: true,
      },
      'critical-miss-coexistence-missing',
    ],
    [
      'critical-expected-no-random-side-effect',
      'critical',
      {
        kind: 'scenario-fact',
        factIdentity: 'critical:expectedNoCriticalEvent',
        expectedValue: true,
      },
      'critical-expected-side-effect-guard-missing',
    ],
    [
      'critical-rate-zero',
      'critical',
      { kind: 'critical-effective-threshold', expectedBasisPoints: 0 },
      'critical-zero-rate-scenario-missing',
    ],
    [
      'critical-rate-one-hundred-percent',
      'critical',
      { kind: 'critical-effective-threshold', expectedBasisPoints: 10000 },
      'critical-full-rate-scenario-missing',
    ],
    [
      'critical-pre-hit-attribute-change',
      'critical',
      {
        kind: 'scenario-fact',
        factIdentity: 'critical:preHitAttributeChange',
        expectedValue: true,
      },
      'critical-pre-hit-attribute-change-scenario-missing',
    ],
    [
      'critical-non-crittable-rejection',
      'critical',
      {
        kind: 'scenario-fact',
        factIdentity: 'critical:nonCrittableRejection',
        expectedValue: true,
      },
      'critical-non-crittable-negative-scenario-missing',
    ],
  ];
  return definitions.map(([identity, dimension, selector, reason]) => ({
    requirementIdentity: 'protocol:' + ownerId + ':' + identity,
    dimension,
    subjectIdentity: identity,
    sourceDisposition: 'applied',
    contractStatus: 'protocol-required',
    impactClassification: 'gameplay-impacting',
    coverageSelector: selector,
    sourceIdentities: [sourceIdentity],
    reasons: [reason],
  }));
}

function createContractCoverageSelector({ record, dimension, ownerId }) {
  const controlSkillId = firstInteger(
    record.executionControlSkillId,
    record.controlSkillId,
    record.sourceControlSkillId,
    record.publicControlSkillId
  );
  const subSkillIndex = firstInteger(
    record.executionSubSkillIndex,
    record.subSkillIndex,
    record.sourceSubSkillIndex,
    record.selectedSubSkillIndex
  );
  if (
    ['public-action', 'action-form', 'switch-trigger'].includes(dimension) &&
    controlSkillId != null &&
    subSkillIndex != null
  ) {
    return {
      kind: 'action-form',
      ownerId,
      controlSkillId,
      subSkillIndex,
    };
  }
  if (dimension === 'hit' && record.hitIdentity) {
    return { kind: 'hit', hitIdentity: String(record.hitIdentity) };
  }
  if (
    ['effect', 'action-effect-binding', 'runtime-effect-binding'].includes(
      dimension
    )
  ) {
    const effectIdentity = resolveEffectIdentity(record);
    return effectIdentity ? { kind: 'effect', effectIdentity } : null;
  }
  if (
    ['resource-profile', 'resource-transaction'].includes(dimension) &&
    record.resourceIdentity
  ) {
    return {
      kind: 'resource',
      resourceIdentity: String(record.resourceIdentity),
    };
  }
  if (
    ['target-state-profile', 'target-state-transaction'].includes(dimension) &&
    record.stateIdentity
  ) {
    return { kind: 'state', stateIdentity: String(record.stateIdentity) };
  }
  if (dimension === 'control-window' && record.windowIdentity) {
    return {
      kind: 'control-window',
      windowIdentity: String(record.windowIdentity),
    };
  }
  if (dimension === 'variant-edge' && record.edgeIdentity) {
    return {
      kind: 'variant-edge',
      edgeIdentity: String(record.edgeIdentity),
    };
  }
  if (dimension === 'variant-window' && record.bindingIdentity) {
    return {
      kind: 'variant-window',
      bindingIdentity: String(record.bindingIdentity),
    };
  }
  if (dimension === 'conditional-hit-group' && record.groupIdentity) {
    return {
      kind: 'conditional-hit-group',
      groupIdentity: String(record.groupIdentity),
    };
  }
  if (dimension === 'passive' && record.passiveIdentity) {
    return {
      kind: 'passive',
      passiveIdentity: String(record.passiveIdentity),
    };
  }
  if (dimension === 'switch-trigger' && record.profileIdentity) {
    return {
      kind: 'switch-trigger',
      profileIdentity: String(record.profileIdentity),
    };
  }
  return null;
}

function createGoldenScenarioCaseSource({ path, report, profile }) {
  const exercisedControls = Object.entries(
    report.actual?.actions?.selectionByActionId ?? {}
  ).map(([, selection]) => [
    Number(selection.controlSkillId),
    Number(selection.subSkillIndex),
  ]);
  const observedEffectIds = (report.actual?.trace?.effects ?? []).map(
    effect => effect.effectId
  );
  const profileRows = createScenarioProfileProjectionRows({
    profile,
    exercisedControls,
    observedEffectIds,
    exercisedFromHitAndEffectIdentities: [
      ...(report.actual?.trace?.damage ?? []).map(event => event.hitIdentity),
      ...(report.actual?.trace?.effects ?? []).map(event => event.effectId),
    ],
    scenarioId: report.scenarioIdentity,
    prefix: 'golden',
  });
  return {
    scenarioIdentity: report.scenarioIdentity,
    runnerKind: 'canonical-character-golden',
    inputReference: {
      reportPath: path,
      reportHash: hashCanonicalValue(report),
      replayCommand:
        'node scripts/sync-character-combat-profile.mjs --owner ' +
        Number(report.ownerId) +
        ' --assert-clean',
    },
    execution: {
      status: report.validation?.passed ? 'passed' : 'failed',
      stableReplay: Boolean(report.replayHash),
      workbenchRoundTrip: 'not-applicable',
      canonicalHashes: {
        input: report.headlessCore?.inputHash ?? null,
        data: report.headlessCore?.dataHash ?? null,
        trace: report.headlessCore?.traceHash ?? null,
        evaluation: null,
      },
    },
    traceProjection: {
      ...createGoldenTraceProjection(report),
      ...profileRows,
    },
    assertionDefinitions: [],
  };
}

function createVisualScenarioCaseSource(visualScenario) {
  const profileRowKeys = [
    'controlWindows',
    'variantEdges',
    'variantWindows',
    'conditionalHitGroups',
    'passives',
    'switchTriggers',
  ];
  const profileRows = Object.fromEntries(
    profileRowKeys.map(key => [
      key,
      visualScenario.traceProjection?.[key] ?? [],
    ])
  );
  return {
    scenarioIdentity: visualScenario.scenarioIdentity,
    runnerKind: 'machine-axis',
    inputReference: {
      fixturePath: visualScenario.fixturePath,
      inputHash: visualScenario.canonicalHashes?.input ?? null,
      replayCommand:
        'node scripts/machine-axis-cli.mjs simulate --input ' +
        visualScenario.fixturePath,
    },
    execution: {
      status: visualScenario.status,
      stableReplay: visualScenario.stableReplay,
      workbenchRoundTrip: visualScenario.workbenchRoundTrip,
      canonicalHashes: visualScenario.canonicalHashes,
    },
    traceProjection: {
      ...createVisualTraceProjection(visualScenario),
      ...profileRows,
    },
    assertionDefinitions: structuredClone(
      visualScenario.assertionResults ?? []
    ),
  };
}

function createGoldenTraceProjection(report) {
  const selections = Object.entries(
    report.actual?.actions?.selectionByActionId ?? {}
  );
  const effects = report.actual?.trace?.effects ?? [];
  const resourceEvents = report.actual?.trace?.specialResources ?? [];
  const tuningMarkEvents = report.actual?.trace?.tuningMarks ?? [];
  const targetStates = report.actual?.trace?.targetStates ?? [];
  const stateOperations = new Set(
    targetStates.map(event => event.operation).filter(Boolean)
  );
  const effectOperations = new Set(
    effects.map(effect => effect.operation).filter(Boolean)
  );
  const actorSpRows = Object.values(
    report.actual?.resources?.actorSpByActorId ?? {}
  );
  const autoRecoveryReasons = new Set(
    actorSpRows.flatMap(row =>
      (row.autoRecovery ?? []).map(event => event.reason)
    )
  );
  const hasSwitch = selections.some(([actionId]) =>
    actionId.startsWith('switch-')
  );
  return {
    actionForms: selections.map(([actionId, selection]) => ({
      projectionIdentity:
        'golden-action-form:' + report.scenarioIdentity + ':' + actionId,
      actionId,
      ownerId: Number(selection.ownerId),
      controlSkillId: Number(selection.controlSkillId),
      subSkillIndex: Number(selection.subSkillIndex),
      semanticName: selection.semanticName ?? null,
    })),
    hits: (report.actual?.trace?.damage ?? [])
      .filter(event => event.hitIdentity)
      .map((event, index) => ({
        projectionIdentity:
          'golden-hit:' + report.scenarioIdentity + ':' + index,
        actionId: event.actionId ?? null,
        hitIdentity: event.hitIdentity,
        frame: event.frame ?? null,
      })),
    effects: effects.map((event, index) => ({
      projectionIdentity:
        'golden-effect:' + report.scenarioIdentity + ':' + index,
      actionId: event.actionId ?? null,
      effectIdentity: event.effectId ?? event.runtimeEffectId ?? null,
      operation: event.operation ?? null,
      targetId: event.targetId ?? null,
    })),
    resources: resourceEvents.map((event, index) => ({
      projectionIdentity:
        'golden-resource:' + report.scenarioIdentity + ':' + index,
      actionId: event.actionId ?? null,
      resourceIdentity: event.resourceIdentity ?? null,
      operation: event.operation ?? null,
      beforeValue: event.beforeValue ?? null,
      afterValue: event.afterValue ?? null,
    })),
    states: targetStates.map((event, index) => ({
      projectionIdentity:
        'golden-state:' + report.scenarioIdentity + ':' + index,
      actionId: event.actionId ?? null,
      stateIdentity: event.stateIdentity ?? null,
      operation: event.operation ?? null,
      beforeValue: event.beforeValue ?? null,
      afterValue: event.afterValue ?? null,
    })),
    diagnostics: (report.actual?.actions?.blockedActionIds ?? []).map(
      actionId => ({
        projectionIdentity:
          'golden-blocked:' + report.scenarioIdentity + ':' + actionId,
        actionId,
        code: 'golden-action-blocked',
      })
    ),
    criticalDecisions: [],
    facts: {
      'normal-trigger-positive': report.validation?.passed === true,
      'condition-insufficient-negative':
        (report.actual?.actions?.blockedActionIds ?? []).length > 0,
      'resource-exact-and-insufficient':
        (resourceEvents.length > 0 || tuningMarkEvents.length > 0) &&
        (report.actual?.actions?.blockedActionIds ?? []).length > 0,
      'buff-apply-refresh-stack-expire':
        (effectOperations.has('apply') || stateOperations.has('gain')) &&
        (effectOperations.has('expire') || stateOperations.has('expire')) &&
        (effectOperations.has('refresh') ||
          effectOperations.has('stack') ||
          stateOperations.has('refresh')),
      'foreground-background-switch':
        hasSwitch &&
        autoRecoveryReasons.has('verified-auto-sp-background') &&
        autoRecoveryReasons.has('verified-auto-sp-foreground'),
    },
  };
}

function createVisualTraceProjection(visualScenario) {
  const projection = visualScenario.traceProjection ?? {};
  const facts = Object.fromEntries(
    (visualScenario.assertionResults ?? []).map(assertion => [
      assertion.assertionIdentity ?? assertion.identity,
      assertion.status === 'passed' || assertion.passed === true,
    ])
  );
  return {
    actionForms: structuredClone(
      projection.actionForms ?? projection.variantSelections ?? []
    ),
    hits: structuredClone(
      projection.hits ??
        (projection.hitIdentities ?? []).map(hitIdentity => ({ hitIdentity }))
    ),
    effects: structuredClone(
      projection.effects ?? projection.effectOperations ?? []
    ),
    resources: structuredClone(
      projection.resources ?? projection.resourceEvents ?? []
    ),
    states: structuredClone(projection.states ?? []),
    diagnostics: structuredClone(projection.diagnostics ?? []),
    criticalDecisions: structuredClone(projection.criticalDecisions ?? []),
    facts: {
      ...structuredClone(projection.facts ?? {}),
      ...facts,
    },
  };
}

function resolveEffectIdentity(record) {
  const value =
    record.effectId ??
    record.effectIdentity ??
    record.runtimeEffectId ??
    record.elementId ??
    record.battleIdentity ??
    null;
  if (value == null) return null;
  if (/^battle-element:/.test(String(value))) return String(value);
  const numeric = Number(value);
  return Number.isInteger(numeric)
    ? 'battle-element:' + numeric
    : String(value);
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

function isUnwiredControlWindowRequirement(record, dimension, profile) {
  if (dimension !== 'control-window') return false;
  const controlSkillId = Number(
    record.sourceControlSkillId ?? record.controlSkillId
  );
  const subSkillIndex = Number(
    record.sourceSubSkillIndex ?? record.subSkillIndex
  );
  if (!Number.isInteger(controlSkillId)) return false;
  const control = (profile?.contracts?.controls ?? []).find(
    candidate => Number(candidate.controlSkillId) === controlSkillId
  );
  if (!control) return false;
  const hasAppliedHit = (control.hits ?? []).some(
    hit =>
      Number(hit.mapIndex ?? hit.subSkillIndex) === subSkillIndex &&
      ['applied', 'source-verified'].includes(hit.sourceEvidenceStatus)
  );
  const hasAppliedEffect = (control.effects ?? []).some(
    effect =>
      Number(effect.mapIndex ?? effect.subSkillIndex) === subSkillIndex &&
      effect.classification === 'applied'
  );
  if (hasAppliedHit) return false;
  const subEffects = (control.effects ?? []).filter(
    effect =>
      Number(effect.mapIndex ?? effect.subSkillIndex) === subSkillIndex &&
      effect.classification === 'applied'
  );
  if (subEffects.length === 0) return true;
  return subEffects.every(
    effect =>
      effect.kind === 'pack' &&
      /基础触发器|基础.*触发/.test(String(effect.name ?? ''))
  );
}

function normalizeReasons(record) {
  return uniqueStrings([...(record.reasons ?? []), record.reason]);
}

function collectSourceIdentities(record) {
  return uniqueStrings([
    ...(record.sourceIdentities ?? []),
    record.sourceIdentity,
  ]);
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
    [
      ...rows.reduce((map, row) => {
        const key = String(selector(row));
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map()),
    ].sort(([left], [right]) => left.localeCompare(right))
  );
}
