import { createHash } from 'node:crypto';
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
  MACHINE_TRACE_EVIDENCE_KIND,
  PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND,
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
  additionalVisualScenarios = [],
}) {
  const sourceGapRecords = applyCharacterAcceptanceSourceGapDispositions(
    unresolvedLedger?.records ?? [],
    recipe.sourceGapDispositions ?? [],
    recipe.scenarioScope
  );
  const goldenEvidence = goldens.map(({ path, report }) =>
    createGoldenEvidence(path, report)
  );
  const visualScenarios = [visualScenario, ...additionalVisualScenarios];
  const visualScenarioById = new Map(
    visualScenarios.map(scenario => [scenario.scenarioIdentity, scenario])
  );
  const requirementInventory = {
    records: createCharacterAcceptanceRequirementSources({
      profile,
      sourceGapRecords,
      sourceNotApplicableControlSubskills:
        recipe.sourceNotApplicableControlSubskills ?? [],
      recipe,
    }),
  };
  const sourceGapInventory = {
    records: sourceGapRecords,
  };
  const scenarioCases = {
    records: createCharacterAcceptanceScenarioCaseSources({
      goldens,
      visualScenario,
      additionalVisualScenarios,
      profile,
    }),
  };
  const evidence = {
    canonicalGoldens: goldenEvidence,
    machineScenarios: visualScenarios.map(toPublicVisualScenarioEvidence),
    machineEvidence: createMachineEvidence(
      recipe.machineEvidence ?? [],
      visualScenarioById
    ),
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
        (recipe.productVisualAcceptance?.automatedEvidence ?? []).map(
          evidence => ({
            ...evidence,
            evidenceKind:
              evidence.evidenceKind ?? PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND,
          })
        )
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
  sourceNotApplicableControlSubskills = [],
  recipe = {},
}) {
  const ownerId = Number(profile.owner?.ownerId);
  const requirements = [];
  const classifyOptimizationScope =
    createOptimizationScenarioRequirementClassifier(profile);
  const classifyNonBlockingSourceRecord =
    createNonBlockingSourceRecordClassifier(sourceGapRecords);
  const classifySourceNotApplicableControlSubskill =
    createSourceNotApplicableControlSubskillClassifier({
      profile,
      boundaries: sourceNotApplicableControlSubskills,
    });
  const classifyScenarioScope = createScenarioScopeRequirementClassifier(
    recipe.scenarioScope
  );
  const classifyUnselectedControlVariant =
    createUnselectedControlVariantClassifier({ profile, recipe });
  for (const [dimension, contractKey] of CONTRACT_DIMENSIONS) {
    const records = flattenContractRecords(
      profile.contracts?.[contractKey],
      contractKey
    );
    records.forEach((record, index) => {
      const subjectIdentity = resolveContractIdentity(record, dimension, index);
      const optimizationScenario = classifyOptimizationScope(record);
      const scenarioScope =
        createDeclaredScenarioScopeDisposition(record) ??
        classifyScenarioScope(record);
      const sourceGapDisposition = classifyNonBlockingSourceRecord(record);
      const sourceNotApplicableControlSubskill =
        classifySourceNotApplicableControlSubskill(record, dimension);
      const unselectedControlVariant = classifyUnselectedControlVariant(
        record,
        dimension
      );
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
        scenarioScope != null ||
        sourceNotApplicableControlSubskill != null ||
        sourceGapDisposition?.disposition === 'not-applicable' ||
        unselectedControlVariant != null ||
        aggregateStatDependency;
      requirements.push({
        requirementIdentity: 'contract:' + dimension + ':' + subjectIdentity,
        dimension,
        subjectIdentity,
        sourceDisposition: notApplicable
          ? 'not-applicable'
          : sourceGapDisposition?.disposition === 'applied' ||
              isAppliedRecord(record)
            ? 'applied'
            : 'gap',
        contractStatus: record.status ?? (record.applied ? 'applied' : null),
        impactClassification:
          record.impactClassification ??
          (notApplicable
            ? 'not-applicable'
            : sourceGapDisposition?.disposition === 'applied'
              ? 'source-runtime-resolved'
              : 'gameplay-impacting'),
        coverageSelector: createContractCoverageSelector({
          record,
          dimension,
          ownerId,
        }),
        sourceIdentities: uniqueStrings([
          ...collectSourceIdentities(record),
          sourceNotApplicableControlSubskill?.sourceIdentity,
        ]),
        ...(optimizationScenario == null ? {} : { optimizationScenario }),
        ...(scenarioScope == null ? {} : { scenarioScope }),
        ...(sourceGapDisposition == null ? {} : { sourceGapDisposition }),
        ...(sourceNotApplicableControlSubskill == null
          ? {}
          : { sourceNotApplicableControlSubskill }),
        ...(unselectedControlVariant == null
          ? {}
          : { unselectedControlVariant }),
        ...(productBoundaryEvidence == null ? {} : { productBoundaryEvidence }),
        reasons: notApplicable
          ? [
              ...(optimizationScenario?.reason
                ? [optimizationScenario.reason]
                : []),
              ...(scenarioScope?.reason ? [scenarioScope.reason] : []),
              ...(sourceGapDisposition?.reasons ?? []),
              ...(sourceNotApplicableControlSubskill?.reasons ?? []),
              ...(unselectedControlVariant?.reasons ?? []),
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
    ...createProtocolRequirementSources(
      ownerId,
      recipe.protocolRequirementDispositions ?? []
    ),
  ].sort((left, right) =>
    left.requirementIdentity.localeCompare(right.requirementIdentity)
  );
}

export function applyCharacterAcceptanceSourceGapDispositions(
  records,
  dispositions = [],
  scenarioScope = null
) {
  const byIdentity = indexDeclaredDispositions(
    dispositions,
    'recordIdentity',
    'source-gap'
  );
  const matched = new Set();
  const projected = (records ?? []).map(record => {
    const identity = String(record?.recordIdentity ?? '');
    const disposition = byIdentity.get(identity);
    const inheritedScenarioScope = createSourceGapScenarioScope(
      record,
      scenarioScope
    );
    if (!disposition) {
      return {
        ...structuredClone(record),
        ...(inheritedScenarioScope == null
          ? {}
          : { scenarioScope: inheritedScenarioScope }),
      };
    }
    matched.add(identity);
    if (disposition.status !== 'not-applicable') {
      throw new Error(
        'Character acceptance source-gap disposition must be not-applicable: ' +
          identity
      );
    }
    return {
      ...structuredClone(record),
      status: 'not-applicable',
      impactClassification: 'not-applicable',
      sourceIdentities: uniqueStrings([
        ...(record?.sourceIdentities ?? []),
        disposition.sourceIdentity,
      ]),
      reasons: uniqueStrings([
        ...(record?.reasons ?? []),
        record?.reason,
        disposition.reason,
      ]),
      acceptanceDisposition: {
        status: 'not-applicable',
        policyIdentity: String(disposition.policyIdentity),
        reason: String(disposition.reason),
        sourceIdentity: String(disposition.sourceIdentity),
        originalStatus: record?.status ?? null,
        originalImpactClassification: record?.impactClassification ?? null,
      },
      scenarioScope: {
        disposition: 'not-applicable',
        policyIdentity: String(disposition.policyIdentity),
        reason: String(disposition.reason),
        sourceIdentity: String(disposition.sourceIdentity),
      },
    };
  });
  assertEveryDispositionMatched(byIdentity, matched, 'source-gap');
  return projected;
}

function createSourceGapScenarioScope(record, scenarioScope) {
  if (scenarioScope == null || record?.status !== 'not-applicable') {
    return null;
  }
  const reasons = uniqueStrings([...(record?.reasons ?? []), record?.reason]);
  const scenarioReason = reasons.find(
    reason =>
      reason !== 'scenario-out-of-scope-not-applicable' &&
      (reason.includes('passive-boss') || reason.includes('not-applicable-in-'))
  );
  if (!scenarioReason) return null;
  return {
    disposition: 'not-applicable',
    policyIdentity: requireNonEmptyString(
      scenarioScope.policyIdentity,
      'source-gap-scenario-scope-policy-identity'
    ),
    reason: scenarioReason,
    sourceIdentity:
      uniqueStrings([
        record?.sourceIdentity,
        ...(record?.sourceIdentities ?? []),
        scenarioScope.sourceIdentity,
      ])[0] ??
      requireNonEmptyString(
        scenarioScope.sourceIdentity,
        'source-gap-scenario-scope-source-identity'
      ),
  };
}

function createScenarioScopeRequirementClassifier(scope) {
  if (scope == null) return () => null;
  const policyIdentity = requireNonEmptyString(
    scope.policyIdentity,
    'scenario-scope-policy-identity'
  );
  const reason = requireNonEmptyString(scope.reason, 'scenario-scope-reason');
  const sourceIdentity = requireNonEmptyString(
    scope.sourceIdentity,
    'scenario-scope-source-identity'
  );
  const included = new Set(
    (scope.includedControlSubskills ?? []).map((entry, index) => {
      const controlSkillId = Number(entry?.controlSkillId);
      const subSkillIndex = Number(entry?.subSkillIndex ?? 0);
      if (
        !Number.isInteger(controlSkillId) ||
        !Number.isInteger(subSkillIndex)
      ) {
        throw new Error(
          'Character acceptance scenario scope control invalid at index ' +
            index
        );
      }
      return controlSkillId + '|' + subSkillIndex;
    })
  );
  if (included.size === 0) {
    throw new Error('Character acceptance scenario scope is empty');
  }
  return record => {
    const controlSkillId = firstInteger(
      record?.executionControlSkillId,
      record?.controlSkillId,
      record?.sourceControlSkillId,
      record?.publicControlSkillId
    );
    if (controlSkillId == null) return null;
    const subSkillIndex =
      firstInteger(
        record?.executionSubSkillIndex,
        record?.subSkillIndex,
        record?.sourceSubSkillIndex,
        record?.selectedSubSkillIndex,
        record?.mapIndex
      ) ?? 0;
    const controlSubskillIdentity = controlSkillId + '|' + subSkillIndex;
    const sourceIncluded = included.has(controlSubskillIdentity);
    const targetControlSkillId = firstInteger(record?.targetControlSkillId);
    const targetSubSkillIndex = firstInteger(record?.targetSubSkillIndex) ?? 0;
    const targetIncluded =
      targetControlSkillId == null ||
      included.has(targetControlSkillId + '|' + targetSubSkillIndex);
    if (sourceIncluded && targetIncluded) return null;
    return {
      disposition: 'not-applicable',
      policyIdentity,
      reason,
      sourceIdentity,
      controlSkillId,
      subSkillIndex,
      ...(targetControlSkillId == null
        ? {}
        : { targetControlSkillId, targetSubSkillIndex }),
    };
  };
}

function createDeclaredScenarioScopeDisposition(record) {
  const declared = record?.scenarioOutOfScope;
  if (
    declared?.status !== 'scenario-out-of-scope-not-applicable' &&
    record?.bindingKind !== 'scenario-out-of-scope'
  ) {
    return null;
  }
  return {
    disposition: 'not-applicable',
    policyIdentity: String(declared?.policyIdentity ?? ''),
    reason: String(
      declared?.reason ?? 'declared-scenario-out-of-scope-not-applicable'
    ),
    sourceIdentity: String(declared?.sourceIdentity ?? record?.sourceIdentity),
  };
}

export function createCharacterAcceptanceScenarioCaseSources({
  goldens,
  visualScenario,
  additionalVisualScenarios = [],
  profile,
}) {
  return [
    ...goldens.map(golden =>
      createGoldenScenarioCaseSource({ ...golden, profile })
    ),
    createVisualScenarioCaseSource(visualScenario),
    ...additionalVisualScenarios.map(createVisualScenarioCaseSource),
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
  const rootPathId = String(record.relationPath?.[0]?.from ?? '').replace(
    /^element:/,
    ''
  );
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
      rootSourceIdentities: structuredClone(rootRecord?.sourceIdentities ?? []),
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
    if (
      source?.impactClassification === 'gameplay-impacting' &&
      source?.sourceClosureDisposition == null
    ) {
      continue;
    }
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
    const directIdentities = uniqueStrings([
      record?.identity,
      record?.actionIdentity,
      record?.publicActionIdentity,
      record?.formIdentity,
      record?.hitIdentity,
      record?.windowIdentity,
      ...(record?.hitIdentity ? [`hit:${record.hitIdentity}`] : []),
      ...(record?.effectIdentity ? [`effect:${record.effectIdentity}`] : []),
      record?.edgeIdentity,
      record?.bindingIdentity,
      record?.profileIdentity,
    ]);
    const rawIdentities = uniqueStrings([
      ...(record?.rawEffectIdentities ?? []),
      ...directIdentities.flatMap(identity =>
        identity.endsWith(':default')
          ? [identity, identity.slice(0, -':default'.length)]
          : [identity]
      ),
    ]);
    const controlAndElementKeys = uniqueStrings([
      ...rawIdentities.flatMap(identity => {
        const match = String(identity).match(
          /^(\d+)\|\d+\|.*\|element:([^|]+)\|/
        );
        return match ? [`${Number(match[1])}|${match[2]}`] : [];
      }),
      ...(record?.rootBattleIdentities ?? []).map(
        identity => `${Number(record.controlSkillId)}|${identity}`
      ),
    ]);
    const matches = [
      ...new Map(
        [
          ...rawIdentities.flatMap(
            identity => byRawIdentity.get(identity) ?? []
          ),
          ...controlAndElementKeys.flatMap(
            key => byControlAndElementPath.get(key) ?? []
          ),
        ].map(source => [String(source.recordIdentity), source])
      ).values(),
    ];
    if (matches.length === 0) return null;
    const dispositions = uniqueStrings(
      matches.map(source => source.sourceClosureDisposition)
    );
    const disposition = dispositions.includes('applied')
      ? 'applied'
      : 'not-applicable';
    return {
      disposition,
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
          disposition === 'applied'
            ? 'source-closure-applied-to-runtime-projection'
            : 'nonblocking-source-record-projection',
          ...(source.sourceClosureReasons ?? []),
          ...(source.reasons ?? []),
        ])
      ),
    };
  };
}

function createSourceNotApplicableControlSubskillClassifier({
  profile,
  boundaries,
}) {
  const reachable = collectRuntimeReachableControlSubskills(profile);
  const normalized = (boundaries ?? []).map((boundary, index) => {
    const controlSkillId = Number(boundary?.controlSkillId);
    const subSkillIndex = Number(boundary?.subSkillIndex);
    const dimensions = uniqueStrings(boundary?.dimensions ?? []).sort();
    const identity = String(boundary?.identity ?? '').trim();
    const reason = String(boundary?.reason ?? '').trim();
    const sourceIdentity = String(boundary?.sourceIdentity ?? '').trim();
    if (
      !identity ||
      !Number.isInteger(controlSkillId) ||
      !Number.isInteger(subSkillIndex) ||
      dimensions.length === 0 ||
      dimensions.some(
        dimension => !['control-window', 'hit'].includes(dimension)
      ) ||
      !reason ||
      !sourceIdentity
    ) {
      throw new Error(
        'Invalid source not-applicable control boundary at index ' + index
      );
    }
    const pairIdentity = `${controlSkillId}|${subSkillIndex}`;
    if (reachable.has(pairIdentity)) {
      throw new Error(
        'Source not-applicable control boundary is runtime reachable: ' +
          identity
      );
    }
    return {
      identity,
      controlSkillId,
      subSkillIndex,
      dimensions,
      reason,
      sourceIdentity,
      scenarioPolicyId: boundary.scenarioPolicyId ?? null,
    };
  });
  return (record, dimension) => {
    const pair = resolveRecordControlSubskill(record, dimension);
    if (!pair) return null;
    const boundary = normalized.find(
      candidate =>
        candidate.dimensions.includes(dimension) &&
        candidate.controlSkillId === pair.controlSkillId &&
        candidate.subSkillIndex === pair.subSkillIndex
    );
    if (!boundary) return null;
    if (collectSourceIdentities(record).length === 0) {
      throw new Error(
        'Source not-applicable requirement lacks source evidence: ' +
          boundary.identity
      );
    }
    return {
      boundaryIdentity: boundary.identity,
      disposition: 'not-applicable',
      controlSkillId: boundary.controlSkillId,
      subSkillIndex: boundary.subSkillIndex,
      dimensions: [...boundary.dimensions],
      scenarioPolicyId: boundary.scenarioPolicyId,
      sourceIdentity: boundary.sourceIdentity,
      reasons: [boundary.reason],
    };
  };
}

function createUnselectedControlVariantClassifier({ profile, recipe }) {
  if (
    recipe?.requirementPolicies?.unselectedControlVariantsFromActionForms !==
    true
  ) {
    return () => null;
  }
  const selectedByControl = new Map();
  for (const form of flattenContractRecords(
    profile?.contracts?.actionForms,
    'actionForms'
  )) {
    if (!isAppliedRecord(form)) continue;
    const controlSkillId = firstInteger(
      form.executionControlSkillId,
      form.controlSkillId,
      form.sourceControlSkillId
    );
    const subSkillIndex = firstInteger(
      form.executionSubSkillIndex,
      form.subSkillIndex,
      form.selectedSubSkillIndex
    );
    if (controlSkillId == null || subSkillIndex == null) continue;
    const selected = selectedByControl.get(controlSkillId) ?? new Set();
    selected.add(subSkillIndex);
    selectedByControl.set(controlSkillId, selected);
  }
  const eligibleDimensions = new Set([
    'control-window',
    'hit',
    'effect',
    'variant-edge',
    'variant-window',
  ]);
  return (record, dimension) => {
    if (!eligibleDimensions.has(dimension)) return null;
    const controlSkillId = firstInteger(
      record.controlSkillId,
      record.sourceControlSkillId,
      record.executionControlSkillId
    );
    const subSkillIndex = firstInteger(
      record.subSkillIndex,
      record.sourceSubSkillIndex,
      record.executionSubSkillIndex,
      ...(record.trigger?.subSkillIndexes ?? [])
    );
    const selected = selectedByControl.get(controlSkillId);
    if (!selected || subSkillIndex == null || selected.has(subSkillIndex)) {
      return null;
    }
    return {
      disposition: 'not-applicable',
      controlSkillId,
      subSkillIndex,
      selectedSubSkillIndexes: [...selected].sort(
        (left, right) => left - right
      ),
      reasons: [
        'source-verified-control-variant-not-selected-by-public-action-form',
      ],
    };
  };
}

function collectRuntimeReachableControlSubskills(profile) {
  const pairs = new Set();
  const add = (controlSkillId, subSkillIndex) => {
    const control = Number(controlSkillId);
    const sub = Number(subSkillIndex);
    if (Number.isInteger(control) && Number.isInteger(sub)) {
      pairs.add(`${control}|${sub}`);
    }
  };
  for (const form of profile?.contracts?.actionForms ?? []) {
    if (!isAppliedRecord(form)) continue;
    add(form.executionControlSkillId, form.executionSubSkillIndex);
    add(form.sourceControlSkillId, form.sourceSubSkillIndex);
    add(form.publicControlSkillId, form.executionSubSkillIndex);
  }
  for (const action of profile?.contracts?.publicActions ?? []) {
    if (action.runtimeReady !== true) continue;
    add(action.controlSkillId, action.selectedSubSkillIndex);
    for (const identity of action.selectedHitIdentities ?? []) {
      const match = String(identity).match(/^(\d+)\|(\d+)\|/);
      if (match) add(match[1], match[2]);
    }
  }
  for (const chain of profile?.contracts?.attackInputChains ?? []) {
    for (const segment of chain.segments ?? []) {
      add(segment.controlSkillId, segment.subSkillIndex);
    }
  }
  for (const edge of profile?.contracts?.variantEdges ?? []) {
    if (!isAppliedRecord(edge)) continue;
    add(edge.sourceControlSkillId, edge.sourceSubSkillIndex);
    add(edge.executionControlSkillId, edge.executionSubSkillIndex);
    add(edge.targetControlSkillId, edge.targetSubSkillIndex);
  }
  return pairs;
}

function resolveRecordControlSubskill(record, dimension) {
  if (dimension === 'hit') {
    const match = String(record?.hitIdentity ?? '').match(/^(\d+)\|(\d+)\|/);
    if (match) {
      return {
        controlSkillId: Number(match[1]),
        subSkillIndex: Number(match[2]),
      };
    }
  }
  if (dimension === 'control-window') {
    const controlSkillId = Number(
      record?.sourceControlSkillId ?? record?.controlSkillId
    );
    const subSkillIndex = Number(
      record?.sourceSubSkillIndex ?? record?.subSkillIndex
    );
    if (Number.isInteger(controlSkillId) && Number.isInteger(subSkillIndex)) {
      return { controlSkillId, subSkillIndex };
    }
  }
  return null;
}

export function createScenarioProfileProjectionRows({
  profile,
  exercisedControls,
  observedEffectIds,
  observedResourceEvents = [],
  observedVariantSelections = [],
  exercisedFromHitAndEffectIdentities = [],
  scenarioId,
  prefix,
}) {
  const exercised = new Set([
    ...(exercisedControls ?? []).map(
      ([controlSkillId, subSkillIndex]) => `${controlSkillId}|${subSkillIndex}`
    ),
    ...(exercisedFromHitAndEffectIdentities ?? []).flatMap(identity => {
      const match = String(identity ?? '').match(/^(\d+)\|(\d+)\|/);
      return match ? [`${Number(match[1])}|${Number(match[2])}`] : [];
    }),
  ]);
  const observed = new Set((observedEffectIds ?? []).map(String));
  const contracts = profile?.contracts ?? {};
  const index = {
    attackInputChains: 0,
    stateMachines: 0,
    controlWindows: 0,
    variantEdges: 0,
    variantWindows: 0,
    conditionalHitGroups: 0,
    passives: 0,
    switchTriggers: 0,
  };
  const rows = {
    attackInputChains: [],
    stateMachines: [],
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
      projectionIdentity: `${prefix}-${collection}-${scenarioId}-${sequence}`,
    });
  };
  for (const chain of contracts.attackInputChains ?? []) {
    const segments = chain.segments ?? [];
    if (
      segments.length > 0 &&
      segments.every(segment =>
        exercised.has(`${segment.controlSkillId}|${segment.subSkillIndex}`)
      )
    ) {
      add('attackInputChains', {
        chainIdentity: chain.chainIdentity,
        ownerId: chain.ownerId,
        segmentCount: segments.length,
        controlSkillIds: segments.map(segment => segment.controlSkillId),
      });
    }
  }
  for (const machine of contracts.stateMachines ?? []) {
    const thresholdObserved = observedResourceEvents.some(event => {
      const resourceIdentity =
        event.resourceIdentity ?? event.payload?.resourceIdentity;
      const operation =
        event.operation ?? event.payload?.operation ?? event.type;
      return (
        String(resourceIdentity ?? '') === String(machine.resourceIdentity) &&
        ['threshold-clear', 'transform', 'transform-remove'].includes(
          String(operation ?? '')
        )
      );
    });
    const stateObserved = observed.has(
      `battle-element:${Number(machine.stateElementId)}`
    );
    if (thresholdObserved && stateObserved) {
      add('stateMachines', {
        transitionIdentity: machine.transitionIdentity,
        resourceIdentity: machine.resourceIdentity,
        threshold: machine.threshold,
      });
    }
  }
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
      exercised.has(`${edge.sourceControlSkillId}|${edge.sourceSubSkillIndex}`)
    ) {
      add('variantEdges', {
        sourceControlSkillId: edge.sourceControlSkillId,
        sourceSubSkillIndex: edge.sourceSubSkillIndex,
        edgeIdentity: edge.edgeIdentity,
      });
    }
  }
  const observedTimingEdges = new Map(
    (observedVariantSelections ?? [])
      .filter(
        selection =>
          selection?.edgeIdentity &&
          selection?.contextualInputScheduling?.applied === true
      )
      .map(selection => [String(selection.edgeIdentity), selection])
  );
  for (const edge of contracts.timingInputEdges ?? []) {
    const observedSelection = observedTimingEdges.get(
      String(edge.edgeIdentity)
    );
    if (!observedSelection) continue;
    add('variantEdges', {
      sourceControlSkillId: edge.sourceControlSkillId,
      sourceSubSkillIndex: edge.sourceSubSkillIndex,
      edgeIdentity: edge.edgeIdentity,
      contextActionId: observedSelection.contextActionId ?? null,
      actionId: observedSelection.actionId ?? null,
      inputFrame:
        observedSelection.contextualInputScheduling?.inputFrame ?? null,
      executionStartFrame:
        observedSelection.contextualInputScheduling?.executionStartFrame ??
        null,
      predecessorEffectiveEndFrame:
        observedSelection.contextualInputScheduling
          ?.predecessorEffectiveEndFrame ?? null,
    });
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
      exercised.has(`${trigger.sourceSkillId ?? trigger.controlSkillId}|0`);
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

function createMachineEvidence(records, scenarioByIdentity) {
  return structuredClone(records).map(evidence => {
    const scenario = scenarioByIdentity.get(evidence.scenarioIdentity);
    const canonicalTraceHash = String(scenario?.canonicalHashes?.trace ?? '');
    return {
      ...evidence,
      evidenceKind: evidence.evidenceKind ?? MACHINE_TRACE_EVIDENCE_KIND,
      canonicalTraceHash,
      traceSha256: createHash('sha256')
        .update(canonicalTraceHash)
        .digest('hex'),
    };
  });
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
    mechanismProbes: toJsonCompatible(scenario.mechanismProbes ?? {}),
    probeResults: toJsonCompatible(scenario.probeResults ?? []),
  };
}

function toJsonCompatible(value) {
  return JSON.parse(JSON.stringify(value));
}

function createProtocolRequirementSources(ownerId, dispositions = []) {
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
  const byIdentity = indexDeclaredDispositions(
    dispositions,
    'subjectIdentity',
    'protocol-requirement'
  );
  const matched = new Set();
  const requirements = definitions.map(
    ([identity, dimension, selector, reason]) => {
      const disposition = byIdentity.get(identity);
      if (!disposition) {
        return {
          requirementIdentity: 'protocol:' + ownerId + ':' + identity,
          dimension,
          subjectIdentity: identity,
          sourceDisposition: 'applied',
          contractStatus: 'protocol-required',
          impactClassification: 'gameplay-impacting',
          coverageSelector: selector,
          sourceIdentities: [sourceIdentity],
          reasons: [reason],
        };
      }
      matched.add(identity);
      if (disposition.status !== 'not-applicable') {
        throw new Error(
          'Character acceptance protocol disposition must be not-applicable: ' +
            identity
        );
      }
      return {
        requirementIdentity: 'protocol:' + ownerId + ':' + identity,
        dimension,
        subjectIdentity: identity,
        sourceDisposition: 'not-applicable',
        contractStatus: 'scenario-out-of-scope',
        impactClassification: 'not-applicable',
        coverageSelector: selector,
        sourceIdentities: uniqueStrings([
          sourceIdentity,
          disposition.sourceIdentity,
        ]),
        scenarioScope: {
          disposition: 'not-applicable',
          policyIdentity: String(disposition.policyIdentity),
          reason: String(disposition.reason),
          sourceIdentity: String(disposition.sourceIdentity),
        },
        reasons: [String(disposition.reason)],
      };
    }
  );
  assertEveryDispositionMatched(byIdentity, matched, 'protocol-requirement');
  return requirements;
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
    dimension === 'public-action' &&
    Array.isArray(record.attackInputSegments) &&
    record.attackInputSegments.length > 0
  ) {
    const segment =
      record.attackInputSegments.find(candidate =>
        isAppliedRecord(candidate)
      ) ?? record.attackInputSegments[0];
    return {
      kind: 'action-form',
      ownerId,
      controlSkillId: Number(segment.controlSkillId),
      subSkillIndex: Number(
        segment.selectedSubSkillIndex ?? segment.subSkillIndex
      ),
    };
  }
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
  if (dimension === 'attack-input-chain' && record.chainIdentity) {
    return {
      kind: 'attack-input-chain',
      chainIdentity: String(record.chainIdentity),
    };
  }
  if (
    dimension === 'state-machine' &&
    record.transitionIdentity &&
    record.resourceIdentity
  ) {
    return {
      kind: 'state-machine',
      transitionIdentity: String(record.transitionIdentity),
      resourceIdentity: String(record.resourceIdentity),
    };
  }
  if (
    dimension === 'action-effect-binding' &&
    record.landedHitActivationCondition?.hitIdentity
  ) {
    return {
      kind: 'hit',
      hitIdentity: String(record.landedHitActivationCondition.hitIdentity),
    };
  }
  if (
    dimension === 'attack-input-chain' &&
    Number.isInteger(Number(record.segments?.[0]?.controlSkillId))
  ) {
    return {
      kind: 'action-form',
      ownerId,
      controlSkillId: Number(record.segments[0].controlSkillId),
      subSkillIndex: Number(record.segments[0].subSkillIndex ?? 0),
    };
  }
  if (
    ['effect', 'action-effect-binding', 'runtime-effect-binding'].includes(
      dimension
    )
  ) {
    const effectIdentity = resolveEffectIdentity(record);
    if (!effectIdentity) return null;
    if (
      dimension === 'effect' &&
      record.tuningOverlimit != null &&
      Number.isInteger(Number(record.trigger?.startFrame)) &&
      record.trigger?.behaviorPathId != null
    ) {
      const semanticControlSkillId = firstInteger(
        controlSkillId,
        record.controlSkillId
      );
      const semanticSubSkillIndex = firstInteger(
        subSkillIndex,
        record.mapIndex,
        ...(record.trigger?.subSkillIndexes ?? [])
      );
      if (semanticControlSkillId != null && semanticSubSkillIndex != null) {
        return {
          kind: 'effect',
          effectIdentity,
          controlSkillId: semanticControlSkillId,
          subSkillIndex: semanticSubSkillIndex,
          triggerFrame: Number(record.trigger.startFrame),
          behaviorPathId: String(record.trigger.behaviorPathId),
        };
      }
    }
    return dimension === 'action-effect-binding' &&
      controlSkillId != null &&
      subSkillIndex != null
      ? {
          kind: 'effect',
          effectIdentity,
          controlSkillId,
          subSkillIndex,
        }
      : { kind: 'effect', effectIdentity };
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
  if (dimension === 'attack-input-chain' && record.chainIdentity) {
    return {
      kind: 'attack-input-chain',
      chainIdentity: String(record.chainIdentity),
    };
  }
  if (dimension === 'control-window' && record.windowIdentity) {
    return {
      kind: 'control-window',
      windowIdentity: String(record.windowIdentity),
    };
  }
  if (
    ['input-timing', 'variant-edge'].includes(dimension) &&
    record.edgeIdentity
  ) {
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
    observedResourceEvents: report.actual?.trace?.specialResources ?? [],
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
    'attackInputChains',
    'stateMachines',
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

export function hasRepeatedApplyRefreshLifecycle(effects = []) {
  const lifecycleByEffectTarget = new Map();
  for (const event of effects) {
    const effectIdentity = event?.effectId ?? event?.runtimeEffectId;
    if (!effectIdentity) continue;
    const key = String(effectIdentity) + '|' + String(event?.targetId ?? '');
    const current = lifecycleByEffectTarget.get(key) ?? {
      active: false,
      refreshed: false,
      expiresAtMs: null,
    };
    const operation = String(event?.operation ?? '');
    if (operation === 'apply') {
      const rawExpiresAtMs = event?.expiresAtMs;
      const expiresAtMs = Number(rawExpiresAtMs);
      const hasExpiry =
        rawExpiresAtMs !== null &&
        rawExpiresAtMs !== undefined &&
        rawExpiresAtMs !== '' &&
        Number.isFinite(expiresAtMs);
      current.refreshed =
        current.refreshed ||
        (current.active &&
          hasExpiry &&
          Number.isFinite(current.expiresAtMs) &&
          expiresAtMs > current.expiresAtMs);
      current.active = true;
      current.expiresAtMs = hasExpiry ? expiresAtMs : null;
    } else if (operation === 'expire') {
      if (current.active && current.refreshed) return true;
      current.active = false;
      current.refreshed = false;
      current.expiresAtMs = null;
    } else if (operation === 'remove' || operation === 'consume') {
      current.active = false;
      current.refreshed = false;
      current.expiresAtMs = null;
    }
    lifecycleByEffectTarget.set(key, current);
  }
  return false;
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
  const hasSwitch = (report.actual?.actions?.executedActionIds ?? []).some(
    actionId => String(actionId).includes('switch')
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
    effects: [
      ...effects.map((event, index) => ({
        projectionIdentity:
          'golden-effect:' + report.scenarioIdentity + ':' + index,
        actionId: event.actionId ?? null,
        effectIdentity: event.effectId ?? event.runtimeEffectId ?? null,
        operation: event.operation ?? null,
        targetId: event.targetId ?? null,
      })),
      ...(report.actual?.trace?.damage ?? [])
        .filter(event => Number.isInteger(Number(event.elementId)))
        .map((event, index) => ({
          projectionIdentity:
            'golden-damage-effect:' + report.scenarioIdentity + ':' + index,
          actionId: event.actionId ?? null,
          effectIdentity: 'battle-element:' + Number(event.elementId),
          operation: 'damage',
          targetId: event.targetId ?? null,
          sourceSequencePath: Array.isArray(event.sourceSequencePath)
            ? [...event.sourceSequencePath]
            : null,
        })),
    ],
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
          stateOperations.has('refresh') ||
          hasRepeatedApplyRefreshLifecycle(effects)),
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
    record.impactClassification === 'not-applicable' ||
    record.scenarioOutOfScope?.status ===
      'scenario-out-of-scope-not-applicable' ||
    record.bindingKind === 'scenario-out-of-scope'
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
  return uniqueStrings([
    ...(record.reasons ?? []),
    record.reason,
    record.scenarioOutOfScope?.reason,
  ]);
}

function collectSourceIdentities(record) {
  return uniqueStrings([
    ...(record.sourceIdentities ?? []),
    record.sourceIdentity,
    record.scenarioOutOfScope?.sourceIdentity,
  ]);
}

function indexDeclaredDispositions(dispositions, identityKey, label) {
  const result = new Map();
  for (const disposition of dispositions ?? []) {
    const identity = requireNonEmptyString(
      disposition?.[identityKey],
      label + '-' + identityKey
    );
    if (result.has(identity)) {
      throw new Error(
        'Character acceptance ' + label + ' disposition duplicated: ' + identity
      );
    }
    requireNonEmptyString(
      disposition?.policyIdentity,
      label + '-policy-identity'
    );
    requireNonEmptyString(disposition?.reason, label + '-reason');
    requireNonEmptyString(
      disposition?.sourceIdentity,
      label + '-source-identity'
    );
    result.set(identity, disposition);
  }
  return result;
}

function assertEveryDispositionMatched(byIdentity, matched, label) {
  const unknown = [...byIdentity.keys()].filter(
    identity => !matched.has(identity)
  );
  if (unknown.length > 0) {
    throw new Error(
      'Character acceptance ' +
        label +
        ' disposition did not match source: ' +
        unknown.join(', ')
    );
  }
}

function requireNonEmptyString(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error('Character acceptance ' + label + ' is required');
  }
  return normalized;
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
