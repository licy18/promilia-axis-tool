import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

export const OPTIMIZATION_OBJECT_ALIAS_SELECTION_CONTRACT_NAME =
  'AzPrOptimizationObjectSourceAliasSelection';
export const OPTIMIZATION_OBJECT_ALIAS_BUNDLE_CONTRACT_NAME =
  'AzPrOptimizationObjectAliasAcceptanceBundle';

export function inspectOptimizationObjectSourceAliasSelection({
  configuration,
  fixture,
  profile,
} = {}) {
  const issues = [];
  const expected = configuration ?? {};
  const optimizationObject = profile?.optimizationObject ?? {};
  const selection =
    fixture?.metadata?.optimizationObjectSourceAliasSelection ?? null;
  const requiredSourceCharacterIds = uniqueIntegers(
    expected.requiredSourceCharacterIds
  );
  const selectedSourceCharacterId = Number(expected.sourceCharacterId);
  const expectedValues = {
    contractName: OPTIMIZATION_OBJECT_ALIAS_SELECTION_CONTRACT_NAME,
    optimizationObjectId: String(expected.optimizationObjectId ?? ''),
    sourceCharacterId: selectedSourceCharacterId,
    sourceAliasIdentity: String(expected.sourceAliasIdentity ?? ''),
    profileIdentity: String(profile?.profileIdentity ?? ''),
    profileHash: String(profile?.profileHash ?? ''),
    sourceContractHash: String(
      profile?.runtimeCompilation?.sourceCompilation?.ownerContractHash ?? ''
    ),
    sourceIdentity: String(optimizationObject.sourceIdentity ?? ''),
    status: 'verified-single-source-alias-selected',
  };

  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    addIssue(
      issues,
      'optimization-object-source-alias-selection-missing',
      'fixture.metadata.optimizationObjectSourceAliasSelection'
    );
  } else {
    for (const [key, expectedValue] of Object.entries(expectedValues)) {
      if (!Object.is(selection[key], expectedValue)) {
        addIssue(
          issues,
          'optimization-object-source-alias-selection-mismatch',
          'fixture.metadata.optimizationObjectSourceAliasSelection.' + key,
          selection[key] ?? null,
          expectedValue
        );
      }
    }
  }

  if (
    optimizationObject.optimizationObjectId !==
      expectedValues.optimizationObjectId ||
    Number(optimizationObject.sourceCharacterId) !==
      selectedSourceCharacterId ||
    optimizationObject.sourceAliasIdentity !==
      expectedValues.sourceAliasIdentity ||
    optimizationObject.applied !== true
  ) {
    addIssue(
      issues,
      'optimization-object-profile-source-alias-mismatch',
      'profile.optimizationObject',
      optimizationObject,
      {
        optimizationObjectId: expectedValues.optimizationObjectId,
        sourceCharacterId: selectedSourceCharacterId,
        sourceAliasIdentity: expectedValues.sourceAliasIdentity,
        applied: true,
      }
    );
  }

  if (
    requiredSourceCharacterIds.length === 0 ||
    !requiredSourceCharacterIds.includes(selectedSourceCharacterId)
  ) {
    addIssue(
      issues,
      'optimization-object-required-source-alias-set-invalid',
      'configuration.requiredSourceCharacterIds',
      requiredSourceCharacterIds,
      selectedSourceCharacterId
    );
  }

  const selectedTeamAliases = (fixture?.scenario?.team ?? [])
    .map(member => Number(member.characterId))
    .filter(characterId => requiredSourceCharacterIds.includes(characterId));
  if (
    selectedTeamAliases.length !== 1 ||
    selectedTeamAliases[0] !== selectedSourceCharacterId
  ) {
    addIssue(
      issues,
      'optimization-object-axis-source-alias-cardinality-invalid',
      'fixture.scenario.team',
      selectedTeamAliases,
      [selectedSourceCharacterId]
    );
  }

  const otherSourceCharacterIds = requiredSourceCharacterIds.filter(
    characterId => characterId !== selectedSourceCharacterId
  );
  const actionText = JSON.stringify(fixture?.actions ?? []);
  const contaminatedActionSourceIds = otherSourceCharacterIds.filter(
    characterId => actionText.includes(String(characterId))
  );
  if (contaminatedActionSourceIds.length > 0) {
    addIssue(
      issues,
      'optimization-object-axis-cross-alias-action-contamination',
      'fixture.actions',
      contaminatedActionSourceIds,
      []
    );
  }

  return {
    identity: 'optimization-object-source-alias-selection',
    passed: issues.length === 0,
    issues,
    actual: {
      optimizationObjectId: expectedValues.optimizationObjectId,
      requiredSourceCharacterIds,
      selectedSourceCharacterId,
      selectedSourceAliasIdentity: expectedValues.sourceAliasIdentity,
      selectedTeamAliases,
      contaminatedActionSourceIds,
      profileIdentity: expectedValues.profileIdentity,
      profileHash: expectedValues.profileHash,
      sourceContractHash: expectedValues.sourceContractHash,
      sourceIdentity: expectedValues.sourceIdentity,
      selectionHash: selection ? hashCanonicalValue(selection) : null,
    },
  };
}

export function validateOptimizationObjectAliasAcceptanceBundle({
  recipe,
  sources,
} = {}) {
  const issues = [];
  const optimizationObjectId = String(recipe?.optimizationObjectId ?? '');
  const requiredSourceCharacterIds = uniqueIntegers(
    recipe?.requiredSourceCharacterIds
  );
  const sourceRecords = Array.isArray(sources) ? sources : [];
  const suppliedSourceCharacterIds = sourceRecords
    .map(source => Number(source?.sourceCharacterId))
    .filter(Number.isInteger);

  if (!optimizationObjectId) {
    addIssue(
      issues,
      'optimization-object-id-missing',
      'recipe.optimizationObjectId'
    );
  }
  if (
    requiredSourceCharacterIds.length === 0 ||
    !sameIntegerSet(requiredSourceCharacterIds, suppliedSourceCharacterIds)
  ) {
    addIssue(
      issues,
      'optimization-object-source-alias-coverage-incomplete',
      'sources',
      uniqueIntegers(suppliedSourceCharacterIds),
      requiredSourceCharacterIds
    );
  }
  if (new Set(suppliedSourceCharacterIds).size !== sourceRecords.length) {
    addIssue(
      issues,
      'optimization-object-source-alias-duplicate',
      'sources',
      suppliedSourceCharacterIds
    );
  }

  const aliasSummaries = [];
  for (const source of sourceRecords) {
    const sourceCharacterId = Number(source?.sourceCharacterId);
    const definition = (recipe?.sourceAliases ?? []).find(
      alias => Number(alias.sourceCharacterId) === sourceCharacterId
    );
    if (!definition) {
      addIssue(
        issues,
        'optimization-object-source-alias-definition-missing',
        `recipe.sourceAliases[${sourceCharacterId}]`
      );
      continue;
    }

    const selectionInspection = inspectOptimizationObjectSourceAliasSelection({
      configuration: {
        optimizationObjectId,
        requiredSourceCharacterIds,
        sourceCharacterId,
        sourceAliasIdentity: definition.sourceAliasIdentity,
      },
      fixture: source.fixture,
      profile: source.profile,
    });
    for (const selectionIssue of selectionInspection.issues) {
      issues.push({
        ...selectionIssue,
        path: `sources.${sourceCharacterId}.${selectionIssue.path}`,
      });
    }

    const manifest = source.manifest ?? {};
    const matrix = manifest.matrix?.summary ?? {};
    const ledger = manifest.ledger?.summary ?? {};
    const scenarioSummary = source.scenarioCases?.summary ?? {};
    const machineScenario = (source.scenarioCases?.records ?? []).find(
      record => record.runnerKind === 'machine-axis'
    );
    if (
      Number(manifest.owner?.ownerId) !== sourceCharacterId ||
      manifest.validation?.status !== 'character-acceptance-manifest-valid'
    ) {
      addIssue(
        issues,
        'optimization-object-source-alias-acceptance-manifest-invalid',
        `sources.${sourceCharacterId}.manifest`
      );
    }
    if (
      Number(matrix.requiredCount) !== Number(matrix.passedCount) ||
      Number(matrix.blockedCount) !== 0 ||
      Number(ledger.sourceGapCount) !== 0 ||
      Number(ledger.acceptanceGapCount) !== 0 ||
      Number(ledger.uniqueBlockingCount) !== 0
    ) {
      addIssue(
        issues,
        'optimization-object-source-alias-acceptance-incomplete',
        `sources.${sourceCharacterId}.manifest.matrix`,
        { matrix, ledger }
      );
    }
    if (
      Number(scenarioSummary.scenarioCount) !==
        Number(scenarioSummary.executionPassedCount) ||
      Number(scenarioSummary.assertionCount) !==
        Number(scenarioSummary.assertionPassedCount)
    ) {
      addIssue(
        issues,
        'optimization-object-source-alias-scenario-incomplete',
        `sources.${sourceCharacterId}.scenarioCases.summary`,
        scenarioSummary
      );
    }
    if (!machineScenario) {
      addIssue(
        issues,
        'optimization-object-source-alias-machine-scenario-missing',
        `sources.${sourceCharacterId}.scenarioCases.records`
      );
    }

    const otherSourceCharacterIds = requiredSourceCharacterIds.filter(
      characterId => characterId !== sourceCharacterId
    );
    const traceText = JSON.stringify(machineScenario?.traceProjection ?? {});
    const contracts = source.profile?.contracts ?? {};
    const runtimeIsolationView = {
      publicActions: contracts.publicActions,
      actionForms: contracts.actionForms,
      attackInputChains: contracts.attackInputChains,
      variantEdges: contracts.variantEdges,
      inputVariantSelectors: contracts.inputVariantSelectors,
      runtimeEffectBindings: contracts.runtimeEffectBindings,
      resourceProfiles: contracts.resourceProfiles,
      resourceTransactions: contracts.resourceTransactions,
      stateMachines: contracts.stateMachines,
      targetStateProfiles: contracts.targetStateProfiles,
      targetStateTransactions: contracts.targetStateTransactions,
      conditionalHitGroups: contracts.conditionalHitGroups,
      tuningMarkConditionalDamageGroups:
        contracts.tuningMarkConditionalDamageGroups,
      passives: contracts.passives,
      switchTriggers: contracts.switchTriggers,
    };
    const runtimeContractText = JSON.stringify(runtimeIsolationView);
    const contaminatedTraceSourceIds = otherSourceCharacterIds.filter(
      characterId => traceText.includes(String(characterId))
    );
    const contaminatedRuntimeContractSourceIds = otherSourceCharacterIds.filter(
      characterId => runtimeContractText.includes(String(characterId))
    );
    if (
      contaminatedTraceSourceIds.length > 0 ||
      contaminatedRuntimeContractSourceIds.length > 0
    ) {
      addIssue(
        issues,
        'optimization-object-cross-alias-trace-contamination',
        `sources.${sourceCharacterId}`,
        {
          contaminatedTraceSourceIds,
          contaminatedRuntimeContractSourceIds,
        },
        {
          contaminatedTraceSourceIds: [],
          contaminatedRuntimeContractSourceIds: [],
        }
      );
    }

    aliasSummaries.push({
      sourceCharacterId,
      sourceAliasIdentity: definition.sourceAliasIdentity,
      profileIdentity: source.profile?.profileIdentity ?? null,
      profileHash: source.profile?.profileHash ?? null,
      sourceContractHash:
        source.profile?.runtimeCompilation?.sourceCompilation
          ?.ownerContractHash ?? null,
      selectionHash: selectionInspection.actual.selectionHash,
      qualificationSubjectHash: manifest.qualificationSubjectHash ?? null,
      manifestHash: manifest.manifestHash ?? null,
      requirementCount: Number(matrix.requirementCount) || 0,
      requiredCount: Number(matrix.requiredCount) || 0,
      passedCount: Number(matrix.passedCount) || 0,
      notApplicableCount: Number(matrix.notApplicableCount) || 0,
      blockedCount: Number(matrix.blockedCount) || 0,
      sourceGapCount: Number(ledger.sourceGapCount) || 0,
      acceptanceGapCount: Number(ledger.acceptanceGapCount) || 0,
      scenarioCount: Number(scenarioSummary.scenarioCount) || 0,
      scenarioPassedCount: Number(scenarioSummary.executionPassedCount) || 0,
      assertionCount: Number(scenarioSummary.assertionCount) || 0,
      assertionPassedCount: Number(scenarioSummary.assertionPassedCount) || 0,
      canonicalHashes: structuredClone(
        machineScenario?.execution?.canonicalHashes ?? {}
      ),
      traceProjectionHash: machineScenario?.traceProjectionHash ?? null,
      productVisualAcceptance:
        manifest.evidence?.productVisualAcceptance?.status ?? null,
      optimizationReady: manifest.maturity?.optimizationReady === true,
    });
  }

  for (const hashKey of [
    'profileHash',
    'sourceContractHash',
    'selectionHash',
    'qualificationSubjectHash',
    'manifestHash',
    'traceProjectionHash',
  ]) {
    requireDistinctAliasValues(aliasSummaries, hashKey, issues);
  }
  for (const hashKey of ['input', 'data', 'trace', 'build']) {
    requireDistinctAliasValues(
      aliasSummaries,
      `canonicalHashes.${hashKey}`,
      issues
    );
  }

  const summary = aliasSummaries.reduce(
    (result, alias) => {
      for (const key of [
        'requirementCount',
        'requiredCount',
        'passedCount',
        'notApplicableCount',
        'blockedCount',
        'sourceGapCount',
        'acceptanceGapCount',
        'scenarioCount',
        'scenarioPassedCount',
        'assertionCount',
        'assertionPassedCount',
      ]) {
        result[key] += Number(alias[key]) || 0;
      }
      return result;
    },
    {
      optimizationObjectCount: optimizationObjectId ? 1 : 0,
      sourceAliasCount: aliasSummaries.length,
      requirementCount: 0,
      requiredCount: 0,
      passedCount: 0,
      notApplicableCount: 0,
      blockedCount: 0,
      sourceGapCount: 0,
      acceptanceGapCount: 0,
      scenarioCount: 0,
      scenarioPassedCount: 0,
      assertionCount: 0,
      assertionPassedCount: 0,
    }
  );
  const sortedAliasSummaries = aliasSummaries
    .slice()
    .sort((left, right) => left.sourceCharacterId - right.sourceCharacterId);
  const acceptanceSubjectHash = hashCanonicalValue({
    schemaVersion: 1,
    contractName: 'AzPrOptimizationObjectProductAcceptanceSubject',
    optimizationObjectId,
    requiredSourceCharacterIds,
    sourceAliases: sortedAliasSummaries,
    summary,
  });
  const requestedProductAcceptance = recipe?.productVisualAcceptance ?? {};
  const productVisualAcceptanceStatus = String(
    requestedProductAcceptance.status ?? 'pending'
  );
  const acceptanceCommit = String(
    requestedProductAcceptance.acceptanceCommit ?? ''
  );
  const acceptanceRecordIdentity = String(
    requestedProductAcceptance.recordIdentity ?? ''
  );
  const requestedAcceptanceSubjectHash = String(
    requestedProductAcceptance.acceptanceSubjectHash ?? ''
  );
  const expectedAcceptanceRecordIdentity =
    `optimization-object-product-acceptance:${optimizationObjectId}:` +
    `${acceptanceCommit}:${acceptanceSubjectHash}`;
  const productAcceptanceRequested =
    productVisualAcceptanceStatus === 'accepted' ||
    requestedProductAcceptance.formalAdmission === true ||
    requestedProductAcceptance.optimizationReady === true ||
    acceptanceCommit !== '' ||
    acceptanceRecordIdentity !== '' ||
    requestedAcceptanceSubjectHash !== '';
  const productAcceptanceTupleComplete =
    productVisualAcceptanceStatus === 'accepted' &&
    requestedProductAcceptance.formalAdmission === true &&
    requestedProductAcceptance.optimizationReady === true;
  const productAcceptanceBindingComplete =
    /^[0-9a-f]{40}$/.test(acceptanceCommit) &&
    requestedAcceptanceSubjectHash === acceptanceSubjectHash &&
    acceptanceRecordIdentity === expectedAcceptanceRecordIdentity;
  const everySourceAliasProductReady =
    aliasSummaries.length === requiredSourceCharacterIds.length &&
    aliasSummaries.every(
      alias =>
        alias.productVisualAcceptance === 'accepted' &&
        alias.optimizationReady === true
    );

  if (!['pending', 'accepted'].includes(productVisualAcceptanceStatus)) {
    addIssue(
      issues,
      'optimization-object-product-acceptance-status-invalid',
      'recipe.productVisualAcceptance.status',
      productVisualAcceptanceStatus,
      ['pending', 'accepted']
    );
  }
  if (productAcceptanceRequested && !productAcceptanceTupleComplete) {
    addIssue(
      issues,
      'optimization-object-product-acceptance-inconsistent',
      'recipe.productVisualAcceptance',
      requestedProductAcceptance,
      {
        status: 'accepted',
        formalAdmission: true,
        optimizationReady: true,
      }
    );
  }
  if (productAcceptanceTupleComplete && !productAcceptanceBindingComplete) {
    addIssue(
      issues,
      'optimization-object-product-acceptance-binding-invalid',
      'recipe.productVisualAcceptance',
      {
        acceptanceCommit: acceptanceCommit || null,
        recordIdentity: acceptanceRecordIdentity || null,
        acceptanceSubjectHash: requestedAcceptanceSubjectHash || null,
      },
      {
        acceptanceCommit: '40-character-lowercase-git-sha',
        recordIdentity: expectedAcceptanceRecordIdentity,
        acceptanceSubjectHash,
      }
    );
  }
  if (productAcceptanceTupleComplete && !everySourceAliasProductReady) {
    addIssue(
      issues,
      'optimization-object-source-alias-product-acceptance-incomplete',
      'sourceAliases',
      aliasSummaries.map(alias => ({
        sourceCharacterId: alias.sourceCharacterId,
        productVisualAcceptance: alias.productVisualAcceptance,
        optimizationReady: alias.optimizationReady,
      }))
    );
  }

  const productAccepted =
    issues.length === 0 &&
    productAcceptanceTupleComplete &&
    productAcceptanceBindingComplete &&
    everySourceAliasProductReady;
  const status =
    issues.length === 0
      ? productAccepted
        ? 'optimization-ready'
        : 'runtime-integrated-product-visual-pending'
      : 'blocked';
  const bundle = {
    schemaVersion: 1,
    contractName: OPTIMIZATION_OBJECT_ALIAS_BUNDLE_CONTRACT_NAME,
    kind: 'azpr-optimization-object-alias-acceptance-bundle',
    optimizationObjectId,
    status,
    formalAdmission: productAccepted,
    optimizationReady: productAccepted,
    productVisualAcceptance: productAccepted ? 'accepted' : 'pending',
    productAcceptanceBinding: {
      status: productAccepted
        ? 'verified'
        : productAcceptanceRequested
          ? 'invalid'
          : 'not-requested',
      acceptanceCommit: acceptanceCommit || null,
      recordIdentity: acceptanceRecordIdentity || null,
      acceptanceSubjectHash: requestedAcceptanceSubjectHash || null,
    },
    requiredSourceCharacterIds,
    sourceAliases: sortedAliasSummaries,
    summary,
    validation: {
      status:
        issues.length === 0
          ? 'optimization-object-alias-acceptance-bundle-valid'
          : 'optimization-object-alias-acceptance-bundle-invalid',
      issues,
    },
  };
  return {
    valid: issues.length === 0,
    issues,
    bundle: {
      ...bundle,
      bundleHash: hashCanonicalValue(bundle),
    },
  };
}

function requireDistinctAliasValues(records, valuePath, issues) {
  if (records.length < 2) return;
  const values = records.map(record => readPath(record, valuePath));
  if (values.some(value => value == null || value === '')) {
    addIssue(
      issues,
      'optimization-object-alias-hash-missing',
      `sourceAliases.${valuePath}`,
      values
    );
    return;
  }
  if (new Set(values).size !== values.length) {
    addIssue(
      issues,
      'optimization-object-alias-hash-merge',
      `sourceAliases.${valuePath}`,
      values
    );
  }
}

function addIssue(issues, code, path, actual = null, expected = null) {
  issues.push({ code, path, actual, expected });
}

function readPath(value, valuePath) {
  return String(valuePath)
    .split('.')
    .reduce(
      (current, segment) => (current == null ? undefined : current[segment]),
      value
    );
}

function uniqueIntegers(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : []).map(Number).filter(Number.isInteger)
    ),
  ].sort((left, right) => left - right);
}

function sameIntegerSet(left, right) {
  return (
    JSON.stringify(uniqueIntegers(left)) ===
    JSON.stringify(uniqueIntegers(right))
  );
}
