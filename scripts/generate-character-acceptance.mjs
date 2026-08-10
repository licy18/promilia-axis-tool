import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  createCharacterAcceptanceCatalog,
  createCharacterAcceptanceManifest,
  createCharacterAcceptanceManifestIndex,
  createScenarioProfileProjectionRows,
  validateUnnamedSecondaryPassiveBoundary,
} from './character-acceptance/character-acceptance-generation.mjs';
import { verifyProductVisualEvidenceFiles } from './character-acceptance/visual-evidence-verification.mjs';
import {
  validateCharacterAcceptanceManifest,
  validateCharacterAcceptanceManifestIndex,
} from '../src/character-acceptance/characterAcceptanceProtocol.js';
import { selectConfiguredCriticalProbeEvents } from './character-acceptance/critical-probe-acceptance.mjs';
import { validateRightOpenLifecycleMatches } from './character-acceptance/effect-lifecycle-acceptance.mjs';
import { inspectOptimizationObjectSourceAliasSelection } from '../src/character-acceptance/optimizationObjectAliasProtocol.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const recipeRoot = path.join(
  projectRoot,
  'scripts',
  'character-acceptance',
  'acceptance-recipes'
);
const generatedCatalogPath = path.join(
  projectRoot,
  'src',
  'data',
  'generated',
  'character-acceptance-catalog.json'
);
const generatedManifestIndexPath = path.join(
  projectRoot,
  'src',
  'data',
  'generated',
  'character-acceptance-manifest-index.json'
);
const verifiedMechanicsPackagePath = path.join(
  projectRoot,
  'src',
  'data',
  'generated',
  'verified-combat-mechanics-package.json'
);
const reportRoot = path.join(
  projectRoot,
  'reports',
  'm11',
  'character-acceptance'
);
const writeMode = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');
const requestedOwnerId = readRequestedOwnerId(process.argv.slice(2));
const runtimeOverlayOutput = readOptionalPathArgument(
  process.argv.slice(2),
  '--runtime-overlay-output'
);
if (runtimeOverlayOutput && requestedOwnerId == null) {
  throw new Error('--runtime-overlay-output requires one --owner');
}
const runtimePackageOutputPath = readRuntimePackageOutputPath(
  process.argv.slice(2)
);

const recipes = (await loadRecipes()).filter(
  recipe =>
    requestedOwnerId == null || Number(recipe.ownerId) === requestedOwnerId
);
if (requestedOwnerId != null && recipes.length !== 1) {
  throw new Error(
    'Character acceptance recipe missing for owner: ' + requestedOwnerId
  );
}
for (const recipe of recipes) {
  if (!runtimePackageOutputPath) {
    await verifyProductVisualEvidenceFiles(recipe, { projectRoot });
  }
}
const mechanicsPackage = await readJson(verifiedMechanicsPackagePath);
const vite = await createServer({
  root: projectRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const packageModule = await vite.ssrLoadModule(
    '/src/data/verifiedCombatMechanicsPackage.js'
  );
  const serviceModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisService.js'
  );
  const adapterModule = await vite.ssrLoadModule(
    '/src/machine-axis/workbenchMachineAxisAdapter.js'
  );
  const traceIndexModule = await vite.ssrLoadModule(
    '/src/features/workbench/canonicalTraceViewIndex.js'
  );
  const targetStateRuntimeModule = await vite.ssrLoadModule(
    '/src/simulation/mechanics/verifiedTargetStateRuntime.js'
  );
  const tuningMarkGenerationModule = await vite.ssrLoadModule(
    '/src/simulation/mechanics/verifiedTuningMarkGeneration.js'
  );
  const verifiedActionLevelModule = await vite.ssrLoadModule(
    '/src/domain/verifiedActionLevel.js'
  );
  const manifests = [];
  const visualRuns = [];
  let exportedRuntimePackage = null;

  for (const recipe of recipes) {
    const ownerId = Number(recipe.ownerId);
    const additionalScenarioDefinitions = recipe.additionalScenarios ?? [];
    const loaded = await Promise.all([
      readJson(
        path.join(
          projectRoot,
          'src',
          'data',
          'generated',
          'character-combat-profiles',
          ownerId + '.json'
        )
      ),
      readJson(
        path.join(
          projectRoot,
          'reports',
          'm10',
          String(ownerId),
          'runtime-coverage.json'
        )
      ),
      readJson(
        path.join(
          projectRoot,
          'reports',
          'm10',
          String(ownerId),
          'unresolved-ledger.json'
        )
      ),
      readJson(path.join(projectRoot, recipe.fixturePath)),
      ...recipe.goldenReports.map(reportPath =>
        readJson(path.join(projectRoot, reportPath))
      ),
      ...additionalScenarioDefinitions.map(definition =>
        readJson(path.join(projectRoot, definition.fixturePath))
      ),
    ]);
    const profile = loaded[0];
    const runtimeCoverage = loaded[1];
    const unresolvedLedger = loaded[2];
    const fixture = loaded[3];
    const goldenReports = loaded.slice(4, 4 + recipe.goldenReports.length);
    const additionalFixtures = loaded.slice(4 + recipe.goldenReports.length);
    const goldens = recipe.goldenReports.map((reportPath, index) => ({
      path: reportPath,
      report: goldenReports[index],
    }));
    const runtimePackage = recipe.runtimeProfileOverlay
      ? createRuntimeProfileOverlay(
          mechanicsPackage,
          profile,
          fixture.dataIdentity?.verifiedMechanicsPackageHash
        )
      : mechanicsPackage;
    if (runtimePackageOutputPath) {
      if (recipes.length !== 1 || requestedOwnerId == null) {
        throw new Error(
          '--runtime-package-output requires exactly one explicit --owner'
        );
      }
      await fs.mkdir(path.dirname(runtimePackageOutputPath), {
        recursive: true,
      });
      await fs.writeFile(
        runtimePackageOutputPath,
        jsonText(runtimePackage),
        'utf8'
      );
      exportedRuntimePackage = {
        ownerId,
        packageId: runtimePackage.packageId,
        packageHash: runtimePackage.packageHash,
        outputPath: runtimePackageOutputPath,
      };
      continue;
    }
    const packageValidation =
      packageModule.validateVerifiedCombatMechanicsPackage(runtimePackage);
    if (!packageValidation.valid) {
      throw new Error(
        'Character acceptance runtime package invalid for ' +
          ownerId +
          ': ' +
          packageValidation.issues.join(', ')
      );
    }
    if (runtimeOverlayOutput) {
      const outputPath = path.resolve(projectRoot, runtimeOverlayOutput);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, jsonText(runtimePackage), 'utf8');
    }
    packageModule.installVerifiedCombatMechanicsPackage(runtimePackage);
    const service = serviceModule.createMachineAxisService();
    const adapter = adapterModule.createWorkbenchMachineAxisAdapter({
      service,
    });
    const visualScenario = executeVisualScenario({
      recipe,
      fixture,
      service,
      adapter,
      traceIndexModule,
      targetStateRuntimeModule,
      tuningMarkGenerationModule,
      verifiedActionLevelModule,
      profile,
      runtimePackage,
    });
    const additionalVisualScenarios = additionalScenarioDefinitions.map(
      (definition, index) =>
        executeVisualScenario({
          recipe: {
            ...recipe,
            ...definition,
            fixturePath: definition.fixturePath,
            probes: definition.probes ?? [],
            buffLifecycle: definition.buffLifecycle ?? null,
            inputWindowBoundary: definition.inputWindowBoundary ?? null,
            skipCriticalMatrix: definition.skipCriticalMatrix !== false,
          },
          fixture: additionalFixtures[index],
          service,
          adapter,
          traceIndexModule,
          targetStateRuntimeModule,
          tuningMarkGenerationModule,
          verifiedActionLevelModule,
          profile,
          runtimePackage,
        })
    );
    const manifest = toJsonCompatible(
      createCharacterAcceptanceManifest({
        recipe,
        profile,
        runtimeCoverage,
        unresolvedLedger,
        goldens,
        visualScenario,
        additionalVisualScenarios,
      })
    );
    const validation = validateCharacterAcceptanceManifest(manifest, {
      checkPublication: false,
    });
    if (!validation.valid) {
      throw new Error(
        'Character acceptance manifest invalid for ' +
          ownerId +
          ': ' +
          validation.issues.join(', ')
      );
    }
    const passiveBoundary = recipe.unnamedSecondaryPassiveSkillId
      ? validateUnnamedSecondaryPassiveBoundary(
          manifest,
          recipe.unnamedSecondaryPassiveSkillId
        )
      : { valid: true };
    if (!passiveBoundary.valid) {
      throw new Error(
        'Unnamed secondary passive boundary invalid for ' +
          ownerId +
          ': ' +
          JSON.stringify(passiveBoundary)
      );
    }
    manifests.push(manifest);
    visualRuns.push(visualScenario);
  }

  if (runtimePackageOutputPath) {
    console.log(JSON.stringify(exportedRuntimePackage, null, 2));
  } else {
    const result =
      requestedOwnerId == null
        ? createPublishedAcceptanceResult(manifests, visualRuns)
        : createOwnerAcceptanceResult(manifests, visualRuns);
    const { report, outputs } = result;
    if (writeMode) await writeOutputs(outputs);
    if (assertClean) await assertOutputsClean(outputs);
    console.log(JSON.stringify(report.summary, null, 2));
  }
} finally {
  await vite.close();
}

function createPublishedAcceptanceResult(manifests, visualRuns) {
  const manifestIndex = createCharacterAcceptanceManifestIndex(manifests);
  const indexValidation =
    validateCharacterAcceptanceManifestIndex(manifestIndex);
  if (!indexValidation.valid) {
    throw new Error(
      'Character acceptance manifest index invalid: ' +
        indexValidation.issues.join(', ')
    );
  }
  for (const manifest of manifests) {
    const publishedValidation = validateCharacterAcceptanceManifest(manifest, {
      publishedManifestIndex: manifestIndex,
      checkPublication: true,
    });
    if (!publishedValidation.valid) {
      throw new Error(
        'Published character acceptance manifest invalid for ' +
          manifest.owner.ownerId +
          ': ' +
          publishedValidation.issues.join(', ')
      );
    }
  }
  const catalog = createCharacterAcceptanceCatalog(manifests, manifestIndex);
  const report = createAcceptanceReport(
    manifests,
    visualRuns,
    catalog,
    manifestIndex
  );
  return {
    report,
    outputs: createOutputs(manifests, catalog, manifestIndex, report),
  };
}

function createOwnerAcceptanceResult(manifests, visualRuns) {
  if (manifests.length !== 1 || visualRuns.length !== 1) {
    throw new Error('Owner acceptance generation requires exactly one owner');
  }
  const manifest = manifests[0];
  const visualRun = visualRuns[0];
  return {
    report: {
      summary: {
        ownerId: manifest.owner.ownerId,
        requirementCount: manifest.matrix.summary.requirementCount,
        requiredCount: manifest.matrix.summary.requiredCount,
        passedCount: manifest.matrix.summary.passedCount,
        notApplicableCount: manifest.matrix.summary.notApplicableCount,
        blockedCount: manifest.matrix.summary.blockedCount,
        sourceGapCount: manifest.ledger.summary.sourceGapCount,
        acceptanceGapCount: manifest.ledger.summary.acceptanceGapCount,
        functionalFailureCount: manifest.ledger.summary.uniqueBlockingCount,
        headlessReplayPassed: visualRun.status === 'passed',
        canonicalReplayStable: visualRun.stableReplay === true,
        workbenchRoundTripPassed: visualRun.workbenchRoundTrip === 'passed',
        productVisualAcceptance:
          manifest.evidence.productVisualAcceptance.status,
        optimizationReady: manifest.maturity.optimizationReady,
      },
    },
    outputs: createOwnerOutputs(manifests),
  };
}

function createRuntimeProfileOverlay(
  basePackage,
  profile,
  expectedFullPackageHash
) {
  const result = structuredClone(basePackage);
  if (!/^[a-f0-9]{64}$/.test(String(expectedFullPackageHash ?? ''))) {
    throw new Error(
      'Runtime profile overlay requires the fixture full package hash'
    );
  }
  // Owner-only acceptance overlays deliberately avoid writing the global
  // package. The dedicated Workbench validator independently recomputes this
  // full-package hash from source before the fixture may be accepted.
  result.packageHash = String(expectedFullPackageHash);
  result.actionMappings = upsertRows(
    result.actionMappings,
    profile.contracts?.publicActions,
    row =>
      [
        row?.ownerKind ?? 'actor',
        Number(row?.ownerId),
        Number(row?.sourceSkillId),
        Number(row?.controlSkillId),
        Number(row?.subSkillIndex ?? row?.selectedSubSkillIndex ?? 0),
        String(row?.actionKind ?? ''),
      ].join('|')
  );
  const profileAttackInputSegments = (
    profile.contracts?.attackInputChains ?? []
  ).flatMap(chain =>
    (chain.segments ?? []).map(segment => ({
      ...structuredClone(segment),
      identity:
        segment.identity ??
        `${String(chain.chainIdentity)}:segment:${Number(segment.sequenceIndex)}`,
      sourceSkillId: Number(chain.sourceSkillId),
      attackInputChainIdentity: String(chain.chainIdentity),
      chainSequenceIndex: Number(segment.sequenceIndex),
      sequenceTotal: Number(segment.sequenceTotal ?? chain.segments.length),
    }))
  );
  const profileVariantWindowBindings = structuredClone(
    profile.contracts?.variantWindowBindings ?? []
  );
  const profileContextAttackInputSegments = (
    profile.contracts?.actionForms ?? []
  )
    .filter(
      form =>
        form.publicActionKind === 'normal-attack' &&
        form.selectionKind === 'input-context-derived' &&
        form.executionTiming?.occupancy?.status === 'applied'
    )
    .map(form => {
      const publicAction = (profile.contracts?.publicActions ?? []).find(
        action => action.actionKind === form.publicActionKind
      );
      const durationFrames = Number(
        form.executionTiming.occupancy.durationFrames
      );
      const selectedSubSkillIndex = Number(form.executionSubSkillIndex ?? 0);
      const selectedHitIdentities = (form.executionTiming?.hits ?? [])
        .map(hit => hit.hitIdentity)
        .filter(Boolean);
      return {
        identity: `${String(form.formIdentity)}:context-segment`,
        sourceSkillId: Number(publicAction?.sourceSkillId),
        attackInputChainIdentity: `context-form:${String(form.formIdentity)}`,
        chainSequenceIndex: 1,
        sequenceIndex: 1,
        sequenceTotal: 1,
        controlSkillId: Number(
          form.publicControlSkillId ?? form.executionControlSkillId
        ),
        executionControlSkillId: Number(form.executionControlSkillId),
        subSkillIndex: selectedSubSkillIndex,
        selectedSubSkillIndex,
        durationFrames,
        effectiveDurationFrames: durationFrames,
        durationStatus: 'applied',
        effectiveDurationStatus: 'applied',
        durationSourceIdentity: form.sourceIdentity,
        sourceIdentity: form.sourceIdentity,
        sourceEvidenceStatus: 'applied',
        scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        runtimeReady: true,
        schedulable: true,
        selectedHitIdentities,
        hitCount: selectedHitIdentities.length,
        executionTiming: structuredClone(form.executionTiming),
        actionScheduling: {
          status: 'exact',
          kind: 'exact-selected-variant-occupancy',
          durationFrames,
          planningDurationFrames: null,
          selectedSubSkillIndex,
          sourceIdentity: form.sourceIdentity,
          sourceStatus: 'verified-input-occupancy',
          variantModelStatus: 'resolved',
          reasons: [],
        },
      };
    });
  result.actionMappings = result.actionMappings.map(mapping => {
    const chainSegments = [
      ...profileAttackInputSegments,
      ...profileContextAttackInputSegments,
    ]
      .filter(
        segment =>
          Number(segment.sourceSkillId) === Number(mapping.sourceSkillId) &&
          Number(mapping.ownerId) === Number(profile.owner?.ownerId)
      )
      .map(segment => {
        const existing = (mapping.attackInputSegments ?? []).find(
          candidate =>
            String(candidate.attackInputChainIdentity ?? '') ===
              String(segment.attackInputChainIdentity) &&
            Number(candidate.sequenceIndex) === Number(segment.sequenceIndex)
        );
        if (existing) {
          return {
            ...segment,
            ...structuredClone(existing),
            attackInputChainIdentity: segment.attackInputChainIdentity,
          };
        }
        const durationFrames = Number(segment.durationFrames);
        const selectedSubSkillIndex = Number(segment.subSkillIndex ?? 0);
        const selectedHitIdentities = (segment.executionTiming?.hits ?? [])
          .map(hit => hit.hitIdentity)
          .filter(Boolean);
        return {
          ...segment,
          selectedSubSkillIndex,
          effectiveDurationFrames: durationFrames,
          durationStatus: 'applied',
          effectiveDurationStatus: 'applied',
          durationSourceIdentity: segment.sourceIdentity,
          sourceEvidenceStatus: 'applied',
          scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
          runtimeReady: true,
          schedulable: true,
          selectedHitIdentities,
          hitCount: selectedHitIdentities.length,
          actionScheduling: {
            status: 'exact',
            kind: 'exact-selected-variant-occupancy',
            durationFrames,
            planningDurationFrames: null,
            selectedSubSkillIndex,
            sourceIdentity: segment.sourceIdentity,
            sourceStatus: 'verified-input-occupancy',
            variantModelStatus: 'resolved',
            reasons: [],
          },
        };
      });
    if (mapping.actionKind !== 'normal-attack' || chainSegments.length === 0) {
      return mapping;
    }
    return {
      ...mapping,
      profileAttackInputSegments: chainSegments,
      profileVariantWindowBindings: profileVariantWindowBindings.filter(
        binding => Number(binding.ownerId) === Number(mapping.ownerId)
      ),
    };
  });
  result.summary.candidateActionCount = result.actionMappings.length;
  result.controlBindings = upsertRows(
    result.controlBindings,
    profile.contracts?.controls,
    row =>
      [
        row?.ownerKind ?? 'actor',
        Number(row?.ownerId ?? profile.owner?.ownerId),
        Number(row?.controlSkillId),
      ].join('|')
  );
  const runtimeFormulaIdentities = new Set(
    result.semanticEffectCatalog.formulas.map(entry => entry.formulaIdentity)
  );
  const overlaySemanticEffects = (
    profile.contracts?.effects?.semantic ?? []
  ).filter(
    effect =>
      effect.role === 'gameplay-effect' &&
      effect.classification === 'applied' &&
      effect.placementResolution === 'static-resolved' &&
      runtimeFormulaIdentities.has(effect.formulaIdentity)
  );
  result.semanticEffectCatalog.semanticEffects = upsertRows(
    result.semanticEffectCatalog.semanticEffects,
    overlaySemanticEffects,
    row => String(row?.semanticIdentity ?? '')
  );
  result.semanticEffectCatalog.summary = {
    ...(result.semanticEffectCatalog.summary ?? {}),
    runtimeEffectCount:
      result.semanticEffectCatalog.semanticEffects.length,
    runtimeFormulaCount: result.semanticEffectCatalog.formulas.length,
  };
  const graph = result.actionVariantGraph;
  graph.publicActionForms = upsertRows(
    graph.publicActionForms,
    profile.contracts?.actionForms,
    row => String(row?.formIdentity ?? '')
  );
  graph.contextEdges = upsertRows(
    graph.contextEdges,
    profile.contracts?.timingInputEdges,
    row => String(row?.edgeIdentity ?? '')
  );
  graph.headlessAssumptionContracts = upsertRows(
    graph.headlessAssumptionContracts,
    profile.contracts?.headlessAssumptionContract
      ? [profile.contracts.headlessAssumptionContract]
      : [],
    row => Number(row?.ownerId)
  );
  graph.chargingReleaseBindings = upsertRows(
    graph.chargingReleaseBindings,
    profile.contracts?.chargingReleaseBindings,
    row => `${Number(row?.ownerId)}|${String(row?.bindingIdentity ?? '')}`
  );
  graph.breakTriggerWatchers = upsertRows(
    graph.breakTriggerWatchers,
    profile.contracts?.breakTriggerWatchers,
    row => `${Number(row?.ownerId)}|${String(row?.watcherIdentity ?? '')}`
  );
  graph.edges = upsertRows(graph.edges, profile.contracts?.variantEdges, row =>
    String(row?.edgeIdentity ?? '')
  );
  graph.attackInputChains = upsertRows(
    graph.attackInputChains,
    profile.contracts?.attackInputChains,
    row => String(row?.chainIdentity ?? '')
  );
  graph.attackInputMechanicWindows = upsertRows(
    graph.attackInputMechanicWindows,
    profile.contracts?.attackInputMechanicWindows,
    row => String(row?.windowIdentity ?? row?.identity ?? '')
  );
  graph.tuningMarkConditionalDamageGroups = upsertRows(
    graph.tuningMarkConditionalDamageGroups,
    profile.contracts?.tuningMarkConditionalDamageGroups,
    row => String(row?.groupIdentity ?? '')
  );
  graph.runtimeEffectBindings = upsertRows(
    graph.runtimeEffectBindings,
    profile.contracts?.runtimeEffectBindings,
    row => String(row?.bindingIdentity ?? '')
  );
  graph.derivedControlContracts = applyProfileInputVariantSelectors(
    graph.derivedControlContracts,
    profile.contracts?.inputVariantSelectors
  );
  const acceptanceTargetStateProfiles = (
    profile.contracts?.acceptanceTargetStateProfiles ?? []
  ).map(definition => ({
    ...structuredClone(definition),
    ownerId: Number(definition.ownerId ?? profile.owner?.ownerId),
    durationMs: Number(definition.durationMs ?? definition.expectedDurationMs),
    maxStacks: Number(definition.maxStacks ?? definition.expectedMaxStacks),
    runtimeOwnerScope: definition.runtimeOwnerScope ?? 'scenario-roster',
    expiryMode: definition.expiryMode ?? 'independent-layer',
    activationScope: definition.activationScope ?? 'owner-actions-only',
    modifiers: structuredClone(definition.modifiers ?? []),
    status: 'verified-acceptance-target-state-profile-ready',
    applied: true,
  }));
  const acceptanceTargetStateProfileByIdentity = new Map(
    acceptanceTargetStateProfiles.map(definition => [
      definition.stateIdentity,
      definition,
    ])
  );
  const acceptanceTargetStateTransactions = (
    profile.contracts?.acceptanceTargetStateTransactions ?? []
  ).map(definition => {
    const state = acceptanceTargetStateProfileByIdentity.get(
      definition.stateIdentity
    );
    return {
      ...structuredClone(definition),
      ownerId: Number(definition.ownerId ?? profile.owner?.ownerId),
      frameRate: Number(definition.frameRate ?? 60),
      operation: definition.operation ?? 'gain',
      amount: Number(definition.amount ?? 1),
      durationMs: Number(definition.durationMs ?? state?.durationMs),
      requiresHitElementId: definition.requiresHitElementId ?? null,
      hitSettlementOrder: definition.hitSettlementOrder ?? null,
      passiveSkillId: definition.passiveSkillId ?? null,
      priority: Number(definition.priority ?? 0),
      status: 'verified-acceptance-target-state-transaction-ready',
      applied: true,
    };
  });
  graph.pickupProfiles = upsertRows(
    graph.pickupProfiles,
    profile.contracts?.pickupProfiles,
    row => `${Number(row?.ownerId)}|${String(row?.pickupIdentity ?? '')}`
  );
  graph.pickupSpawnBindings = upsertRows(
    graph.pickupSpawnBindings,
    profile.contracts?.pickupSpawnBindings,
    row => `${Number(row?.ownerId)}|${String(row?.bindingIdentity ?? '')}`
  );
  graph.pickupAbsorbBindings = upsertRows(
    graph.pickupAbsorbBindings,
    profile.contracts?.pickupAbsorbBindings,
    row => `${Number(row?.ownerId)}|${String(row?.bindingIdentity ?? '')}`
  );
  graph.targetStateProfiles = upsertRows(
    graph.targetStateProfiles,
    [
      ...(profile.contracts?.targetStateProfiles ?? []),
      ...acceptanceTargetStateProfiles,
    ],
    row => String(row?.stateIdentity ?? '')
  );
  graph.targetStateTransactions = upsertRows(
    graph.targetStateTransactions,
    [
      ...(profile.contracts?.targetStateTransactions ?? []),
      ...acceptanceTargetStateTransactions,
    ],
    row => String(row?.transactionIdentity ?? '')
  );
  graph.conditionalHitGroups = upsertRows(
    graph.conditionalHitGroups,
    profile.contracts?.conditionalHitGroups,
    row => String(row?.groupIdentity ?? '')
  );
  result.specialResourceCatalog.profiles = upsertRows(
    result.specialResourceCatalog.profiles,
    profile.contracts?.resourceProfiles,
    row => String(row?.resourceIdentity ?? '')
  );
  result.specialResourceCatalog.operationBindings = upsertRows(
    result.specialResourceCatalog.operationBindings,
    profile.contracts?.resourceTransactions,
    row => String(row?.operationIdentity ?? '')
  );
  result.specialResourceCatalog.thresholdTransitions = upsertRows(
    result.specialResourceCatalog.thresholdTransitions,
    profile.contracts?.stateMachines,
    row => String(row?.transitionIdentity ?? '')
  );
  result.specialResourceCatalog.passiveEffects = upsertRows(
    result.specialResourceCatalog.passiveEffects,
    profile.contracts?.passives,
    row => String(row?.passiveIdentity ?? '')
  );
  result.switchTriggerCatalog.profiles = upsertRows(
    result.switchTriggerCatalog.profiles,
    profile.contracts?.switchTriggers,
    row => String(row?.profileIdentity ?? '')
  );
  const switchProfiles = result.switchTriggerCatalog.profiles;
  const appliedSwitchProfiles = switchProfiles.filter(
    row => row.applied === true
  );
  const onEnterSwitchProfiles = switchProfiles.filter(
    row => row.triggerPhase === 'on-enter'
  );
  const onExitSwitchProfiles = switchProfiles.filter(
    row => row.triggerPhase === 'on-exit'
  );
  result.switchTriggerCatalog.summary = {
    profileCount: switchProfiles.length,
    appliedProfileCount: appliedSwitchProfiles.length,
    unresolvedProfileCount:
      switchProfiles.length - appliedSwitchProfiles.length,
    onEnterProfileCount: onEnterSwitchProfiles.length,
    onExitProfileCount: onExitSwitchProfiles.length,
    appliedOnEnterProfileCount: onEnterSwitchProfiles.filter(
      row => row.applied === true
    ).length,
    appliedOnExitProfileCount: onExitSwitchProfiles.filter(
      row => row.applied === true
    ).length,
    switchTriggeredOnlyCount: switchProfiles.filter(
      row => row.manualReleaseStatus === 'switch-trigger-only'
    ).length,
    reasonCounts: countValues(switchProfiles.flatMap(row => row.reasons ?? [])),
  };
  result.summary.switchTriggerProfileCount = switchProfiles.length;
  result.summary.appliedSwitchTriggerProfileCount =
    appliedSwitchProfiles.length;
  result.summary.unresolvedSwitchTriggerProfileCount =
    switchProfiles.length - appliedSwitchProfiles.length;
  graph.summary = {
    ...(graph.summary ?? {}),
    pickupProfileCount: graph.pickupProfiles.length,
    pickupSpawnBindingCount: graph.pickupSpawnBindings.length,
    pickupAbsorbBindingCount: graph.pickupAbsorbBindings.length,
  };
  return result;
}

function upsertRows(existing = [], additions = [], identity) {
  const result = structuredClone(existing ?? []);
  const indexByIdentity = new Map(
    result.map((row, index) => [identity(row), index])
  );
  for (const row of additions ?? []) {
    const key = identity(row);
    const previousIndex = indexByIdentity.get(key);
    if (previousIndex == null) {
      indexByIdentity.set(key, result.length);
      result.push(structuredClone(row));
    } else {
      result[previousIndex] = structuredClone(row);
    }
  }
  return result;
}

function applyProfileInputVariantSelectors(existing = [], bindings = []) {
  const result = structuredClone(existing ?? []);
  for (const binding of bindings ?? []) {
    const index = result.findIndex(
      contract =>
        Number(contract.ownerId) === Number(binding.ownerId) &&
        Number(contract.controlSkillId) === Number(binding.publicControlSkillId)
    );
    if (index < 0) {
      throw new Error(
        'Runtime profile overlay input selector has no source control contract: ' +
          `${binding.ownerId}/${binding.publicControlSkillId}`
      );
    }
    const current = result[index];
    result[index] = {
      ...current,
      actionKinds: [
        ...new Set([
          ...(current.actionKinds ?? []),
          ...(binding.actionKinds ?? []),
        ]),
      ],
      controlSource: 'input-controlled',
      candidateControlSources: [
        ...new Set([
          ...(current.candidateControlSources ?? []),
          'input-controlled',
        ]),
      ],
      decisionFrame: Number(binding.decisionFrame) || 0,
      inputSelector: structuredClone(binding.inputSelector),
      chargeTier: structuredClone(binding.options ?? []),
      selectedSubSkillIndex: null,
      sourceIdentity: [
        ...(Array.isArray(current.sourceIdentity)
          ? current.sourceIdentity
          : [current.sourceIdentity].filter(Boolean)),
        binding.sourceIdentity,
      ],
      resolutionStatus: 'applied',
      reasons: [],
    };
  }
  return result;
}

function countValues(values) {
  return Object.fromEntries(
    [...(values ?? [])].sort().reduce((counts, value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map())
  );
}

function executeVisualScenario({
  recipe,
  fixture,
  service,
  adapter,
  traceIndexModule,
  targetStateRuntimeModule,
  tuningMarkGenerationModule,
  verifiedActionLevelModule,
  profile,
  runtimePackage,
}) {
  const validation = service.validate(fixture);
  if (!validation.valid) {
    throw new Error(
      'Machine Axis fixture invalid for ' +
        recipe.ownerId +
        ': ' +
        JSON.stringify(validation.issues)
    );
  }
  const first = service.simulate(fixture);
  const second = service.simulate(fixture);
  const imported = adapter.importContract(fixture);
  const exported = adapter.exportProject(imported.project, {
    metadata: fixture.metadata,
  });
  const roundTrip = service.simulate(exported);
  const traceIndex = traceIndexModule.createCanonicalTraceViewIndex(
    imported.canonicalRun
  );
  const stableReplay = sameHashes(first.hashes, second.hashes);
  const workbenchRoundTrip = sameHashes(first.hashes, roundTrip.hashes);
  const criticalMatrix = recipe.skipCriticalMatrix
    ? {}
    : inspectCriticalMatrix(
        Number(recipe.ownerId),
        first,
        second,
        recipe.criticalProbe
      );
  const buffLifecycle = recipe.buffLifecycle
    ? inspectEffectLifecycle(first, recipe.buffLifecycle)
    : inspectThunderLifecycle(first);
  const thunderLifecycle = inspectThunderLifecycle(first);
  const configuredInputWindowBoundaries = recipe.inputWindowProbe
    ? inspectConfiguredInputWindowBoundaries({
        fixture,
        run: first,
        profile,
        probe: recipe.inputWindowProbe,
      })
    : null;
  const declaredInputWindowBoundaries = recipe.inputWindowBoundary
    ? inspectInputWindowBoundaries(fixture, first, recipe.inputWindowBoundary)
    : null;
  const inputWindowBoundaries =
    configuredInputWindowBoundaries ??
    declaredInputWindowBoundaries ??
    (Number(recipe.ownerId) === 108003
      ? inspectMitiInputWindowBoundaries(fixture, first, service)
      : inspectInputWindowBoundaries(fixture, first));
  const foregroundBackgroundSwitch =
    Number(recipe.ownerId) === 108003
      ? inspectMitiForegroundBackgroundSwitch(first)
      : null;
  const negativeActionCases = (recipe.negativeActionCases ?? []).map(
    negativeCase => inspectNegativeActionCase(service, fixture, negativeCase)
  );
  const configuredIsolatedActionCases = [
    ...(recipe.isolatedActionCases ?? []),
    ...createExistingTuningMarkAcceptanceCases(
      recipe.existingTuningMarkAcceptance
    ),
  ];
  const isolatedActionCases = configuredIsolatedActionCases.map(
    isolatedCase =>
      inspectIsolatedActionCase(service, fixture, isolatedCase, profile)
  );
  const runtimeInterruptionCases = (recipe.runtimeInterruptionCases ?? []).map(
    interruptionCase =>
      inspectRuntimeInterruptionCase({
        interruptionCase,
        fixture,
        profile,
        runtimePackage,
        targetStateRuntimeModule,
        tuningMarkGenerationModule,
      })
  );
  const actionLevelCases = (recipe.actionLevelCases ?? []).map(levelCase =>
    inspectActionLevelCase(verifiedActionLevelModule, levelCase)
  );
  const probeResults = recipe.probes.map(probe =>
    inspectRecipeProbe(first, probe)
  );
  const resourceBackedEffects = projectResourceBackedEffects(
    first,
    fixture.scenario.id
  );
  const appliedEffectSourceElements = projectAppliedEffectSourceElements(
    first,
    fixture.scenario.id
  );
  const tuningComponentEffects = projectVerifiedTuningComponentEffects(
    first,
    fixture.scenario.id
  );
  const tuningJudgmentEffects = projectVerifiedTuningJudgmentEffects(
    first,
    profile,
    fixture.scenario.id
  );
  const verifiedDirectEffectSources = projectVerifiedDirectEffectSources(
    first,
    fixture.scenario.id
  );
  const tuningMarkResourceEffects = projectTuningMarkResourceEffects(
    first,
    profile,
    fixture.scenario.id
  );
  const sourceActionBindingForms = projectSourceActionBindingForms(
    first,
    fixture.scenario.id
  );
  const sourceHitAliases = projectSourceHitAliases(first, fixture.scenario.id);
  const isolatedTraceProjections = isolatedActionCases.flatMap(result =>
    result.actual?.traceProjection ? [result.actual.traceProjection] : []
  );
  const collectIsolatedProjectionRows = key =>
    isolatedTraceProjections.flatMap(projection => projection[key] ?? []);
  const baseAssertionResults = [
    {
      identity: 'machine-axis-validation',
      passed: validation.valid,
    },
    { identity: 'canonical-same-input-replay', passed: stableReplay },
    {
      identity: 'workbench-import-export-round-trip',
      passed: workbenchRoundTrip,
    },
    ...(recipe.optimizationObjectAcceptance
      ? [
          inspectOptimizationObjectSourceAliasSelection({
            configuration: recipe.optimizationObjectAcceptance,
            fixture,
            profile,
          }),
        ]
      : []),
    ...Object.entries(criticalMatrix)
      .filter(([key]) => key !== 'details')
      .map(([key, passed]) => ({ identity: 'critical:' + key, passed })),
    ...(Number(recipe.ownerId) === 109001 || recipe.buffLifecycle
      ? [
          {
            identity: 'buff-apply-refresh-stack-expire',
            passed: buffLifecycle.passed,
            actual: buffLifecycle.details,
          },
        ]
      : []),
    ...(Number(recipe.ownerId) === 109001 || recipe.inputWindowBoundary
      ? [
          {
            identity: 'input-window-inside-outside-boundaries',
            passed: inputWindowBoundaries.passed,
            actual: inputWindowBoundaries.details,
          },
        ]
      : []),
    ...(Number(recipe.ownerId) === 108003
      ? [
          {
            identity: 'input-window-inside-outside-boundaries',
            passed: inputWindowBoundaries.passed,
            actual: inputWindowBoundaries.details,
          },
          {
            identity: 'foreground-background-switch',
            passed: foregroundBackgroundSwitch.passed,
            actual: foregroundBackgroundSwitch.details,
          },
        ]
      : []),
    ...(configuredInputWindowBoundaries
      ? [
          {
            identity: 'input-window-inside-outside-boundaries',
            passed: configuredInputWindowBoundaries.passed,
            actual: configuredInputWindowBoundaries.details,
          },
        ]
      : []),
    ...negativeActionCases,
    ...isolatedActionCases,
    ...runtimeInterruptionCases,
    ...actionLevelCases,
    ...probeResults,
  ];
  const baseAssertionByIdentity = new Map(
    baseAssertionResults.map(result => [String(result.identity), result])
  );
  if (baseAssertionByIdentity.size !== baseAssertionResults.length) {
    throw new Error(
      'Duplicate base assertion identity in character acceptance recipe for ' +
        recipe.ownerId
    );
  }
  const scenarioFactAliases = (recipe.scenarioFactAliases ?? []).map(alias => {
    const factIdentity = String(alias?.factIdentity ?? '').trim();
    const sourceAssertionIdentities = (alias?.allOfAssertionIdentities ?? []).map(
      identity => String(identity).trim()
    );
    if (!factIdentity || sourceAssertionIdentities.length === 0) {
      throw new Error(
        'Invalid scenario fact alias in character acceptance recipe for ' +
          recipe.ownerId
      );
    }
    const sourceStatuses = sourceAssertionIdentities.map(identity => {
      const source = baseAssertionByIdentity.get(identity);
      return {
        assertionIdentity: identity,
        status:
          source == null ? 'missing' : source.passed ? 'passed' : 'blocked',
      };
    });
    return {
      identity: factIdentity,
      passed: sourceStatuses.every(source => source.status === 'passed'),
      actual: {
        derivation: 'all-source-assertions-passed',
        sourceAssertionIdentities,
        sourceStatuses,
      },
    };
  });
  const assertionResults = [
    ...baseAssertionResults,
    ...scenarioFactAliases,
  ];
  if (
    new Set(assertionResults.map(result => String(result.identity))).size !==
    assertionResults.length
  ) {
    throw new Error(
      'Duplicate assertion or scenario fact identity in character acceptance recipe for ' +
        recipe.ownerId
    );
  }
  const failed = assertionResults.filter(result => !result.passed);
  const selectionRows = first.trace?.variants?.selections ?? [];
  const selectionByActionId = new Map(
    selectionRows.map(selection => [String(selection.actionId), selection])
  );
  const withActionCoordinate = row => {
    const selection = selectionByActionId.get(String(row?.actionId ?? ''));
    if (!selection) return row;
    return {
      ...row,
      controlSkillId: selection.controlSkillId,
      subSkillIndex: selection.subSkillIndex,
    };
  };
  const runtimeEffectEvidence = projectCharacterRuntimeEffectEvidence(
    first,
    profile,
    fixture.scenario.id
  );
  const profileRows = createScenarioProfileProjectionRows({
    profile,
    exercisedControls: collectRuntimeExercisedControls(first),
    exercisedFromHitAndEffectIdentities: [
      ...(first.trace?.damage ?? []).map(event => event.hitIdentity),
      ...(first.trace?.effects?.events ?? []).map(event => event.effectId),
    ],
    observedEffectIds: [
      ...(first.trace?.effects?.events ?? []).map(event => event.effectId),
      ...resourceBackedEffects.map(event => event.effectIdentity),
      ...appliedEffectSourceElements.map(event => event.effectIdentity),
      ...tuningComponentEffects.map(event => event.effectIdentity),
      ...tuningJudgmentEffects.map(event => event.effectIdentity),
      ...verifiedDirectEffectSources.map(event => event.effectIdentity),
      ...tuningMarkResourceEffects.map(event => event.effectIdentity),
      ...runtimeEffectEvidence.map(event => event.effectIdentity),
    ],
    observedResourceEvents: first.trace?.variants?.resourceEvents ?? [],
    observedVariantSelections: selectionRows,
    scenarioId: fixture.scenario?.id,
    prefix: 'machine',
  });
  return {
    scenarioIdentity: String(fixture.scenario?.id),
    fixturePath: recipe.fixturePath,
    status: failed.length ? 'failed' : 'passed',
    stableReplay,
    workbenchRoundTrip: workbenchRoundTrip ? 'passed' : 'failed',
    canonicalHashes: first.hashes,
    actionCount: fixture.actions.length,
    executedActionCount:
      first.trace?.executionPlan?.actions?.length ??
      first.trace?.actions?.length ??
      selectionRows.length,
    traceIndex: {
      traceHash: traceIndex.traceHash,
      actionCount: traceIndex.summary.actionCount,
      hitCount: traceIndex.summary.hitCount,
      effectEventCount: traceIndex.summary.effectEventCount,
      effectIntervalCount: traceIndex.summary.effectIntervalCount,
      resourceTransactionCount: traceIndex.summary.resourceTransactionCount,
    },
    assertionSummary: {
      assertionCount: assertionResults.length,
      passedCount: assertionResults.length - failed.length,
      failedCount: failed.length,
      failedIdentities: failed.map(result => result.identity),
    },
    criticalMatrix,
    mechanismProbes: {
      buffLifecycle,
      inputWindowBoundaries,
      foregroundBackgroundSwitch,
      negativeActionCases,
      isolatedActionCases,
      runtimeInterruptionCases,
      actionLevelCases,
    },
    probeResults,
    assertionResults: assertionResults.map(result => ({
      assertionIdentity: result.identity,
      status: result.passed ? 'passed' : 'blocked',
      selector: {
        kind: 'scenario-fact',
        factIdentity: result.identity,
        expectedValue: true,
      },
      ...(result.actual === undefined
        ? {}
        : { actual: structuredClone(result.actual) }),
      reasons: result.passed ? [] : ['canonical-scenario-assertion-failed'],
    })),
    traceProjection: {
      actionForms: [
        ...selectionRows.map(selection => ({
          projectionIdentity:
            'machine-action-form:' +
            fixture.scenario.id +
            ':' +
            selection.actionId,
          actionId: selection.actionId,
          ownerId: selection.ownerId,
          semanticName: selection.semanticName,
          controlSkillId: selection.controlSkillId,
          subSkillIndex: selection.subSkillIndex,
          actualDurationFrames: selection.actualDurationFrames,
        })),
        ...sourceActionBindingForms,
        ...collectIsolatedProjectionRows('actionForms'),
      ],
      hits: [
        ...(first.trace?.damage ?? [])
          .filter(event => event.hitIdentity)
          .map((event, index) => ({
            projectionIdentity:
              'machine-hit:' + fixture.scenario.id + ':' + index,
            actionId: event.actionId ?? null,
            hitIdentity: event.hitIdentity,
            frame: event.frame ?? null,
            absoluteFrame: event.absoluteFrame ?? null,
            sourceSequencePath: event.sourceSequencePath ?? null,
          })),
        ...sourceHitAliases,
        ...collectIsolatedProjectionRows('hits'),
      ],
      resources: [
        ...(first.trace?.variants?.resourceEvents ?? []).map(
          (event, index) => ({
            projectionIdentity:
              'machine-resource:' + fixture.scenario.id + ':' + index,
            actionId: event.actionId ?? null,
            resourceIdentity: event.payload?.resourceIdentity ?? null,
            operation: event.payload?.operation ?? event.type ?? null,
            absoluteFrame: event.absoluteFrame ?? null,
            beforeValue: event.payload?.beforeValue ?? null,
            change: event.payload?.change ?? null,
            afterValue: event.payload?.afterValue ?? null,
          })
        ),
        ...collectIsolatedProjectionRows('resources'),
      ],
      states: (first.trace?.state?.targetEvents ?? []).map((event, index) => ({
        projectionIdentity:
          'machine-state:' + fixture.scenario.id + ':' + index,
        actionId: event.actionId ?? null,
        stateIdentity:
          event.payload?.stateIdentity ?? event.stateIdentity ?? null,
        operation: event.payload?.operation ?? event.type ?? null,
        absoluteFrame: event.absoluteFrame ?? event.frameIndex ?? null,
        payload: structuredClone(event.payload ?? {}),
      })),
      effects: [
        ...(first.trace?.effects?.events ?? []).map((event, index) => ({
          projectionIdentity:
            'machine-effect:' + fixture.scenario.id + ':' + index,
          actionId: event.actionId ?? null,
          effectIdentity: event.effectId ?? event.runtimeEffectId ?? null,
          operation: event.operation ?? null,
          targetId: event.targetId ?? null,
          absoluteFrame: event.absoluteFrame ?? null,
          frameIndex:
            event.frameIndex ?? event.absoluteFrame ?? event.frame ?? null,
          timeMs: event.timeMs ?? null,
          expiresAtMs: event.expiresAtMs ?? null,
          durationFrames: event.durationFrames ?? null,
          expiresAtFrame: event.expiresAtFrame ?? event.expireFrame ?? null,
          sourceIdentity: event.sourceIdentity ?? null,
          modifiers: structuredClone(event.modifiers ?? []),
        })),
        ...(first.trace?.damage ?? [])
          .filter(event => Number.isInteger(Number(event.elementId)))
          .map((event, index) => ({
            projectionIdentity:
              'machine-damage-effect:' + fixture.scenario.id + ':' + index,
            actionId: event.actionId ?? null,
            effectIdentity: 'battle-element:' + Number(event.elementId),
            operation: 'damage',
            targetId: event.targetId ?? null,
            sourceSequencePath: Array.isArray(event.sourceSequencePath)
              ? [...event.sourceSequencePath]
              : null,
          })),
        ...tuningComponentEffects,
        ...tuningJudgmentEffects,
        ...resourceBackedEffects,
        ...appliedEffectSourceElements,
        ...verifiedDirectEffectSources,
        ...tuningMarkResourceEffects,
        ...runtimeEffectEvidence,
        ...collectIsolatedProjectionRows('effects'),
      ].map(withActionCoordinate),
      diagnostics: [
        ...(first.trace?.diagnostics?.validationWarnings ?? []),
        ...(first.trace?.diagnostics?.actionRules?.diagnostics ?? []),
      ].map((diagnostic, index) => ({
        projectionIdentity:
          'machine-diagnostic:' + fixture.scenario.id + ':' + index,
        actionId: diagnostic.actionId ?? null,
        code: diagnostic.code ?? null,
        status: diagnostic.status ?? null,
      })),
      criticalDecisions: [
        ...(first.trace?.damage ?? [])
          .filter(event => event.formula?.randomBranch)
          .map((event, index) => ({
          projectionIdentity:
            'machine-critical:' + fixture.scenario.id + ':' + index,
          actionId: event.actionId ?? null,
          hitIdentity: event.hitIdentity ?? null,
          mode: event.formula.randomBranch.mode ?? null,
          sourceCriticalBasisPoints:
            event.formula.randomBranch.sourceCriticalBasisPoints ?? null,
          targetCriticalDefenseBasisPoints:
            event.formula.randomBranch.targetCriticalDefenseBasisPoints ?? null,
          effectiveThresholdBasisPoints:
            event.formula.randomBranch.criticalThreshold ?? null,
          criticalRoll: event.formula.randomBranch.criticalRoll ?? null,
            critical: event.formula.randomBranch.critical ?? null,
          })),
        ...collectIsolatedProjectionRows('criticalDecisions'),
      ],
      attackInputChains: [
        ...profileRows.attackInputChains,
        ...collectIsolatedProjectionRows('attackInputChains'),
      ],
      stateMachines: [
        ...profileRows.stateMachines,
        ...collectIsolatedProjectionRows('stateMachines'),
      ],
      controlWindows: [
        ...profileRows.controlWindows,
        ...collectIsolatedProjectionRows('controlWindows'),
      ],
      variantEdges: [
        ...profileRows.variantEdges,
        ...collectIsolatedProjectionRows('variantEdges'),
      ],
      variantWindows: [
        ...profileRows.variantWindows,
        ...collectIsolatedProjectionRows('variantWindows'),
      ],
      conditionalHitGroups: [
        ...profileRows.conditionalHitGroups,
        ...collectIsolatedProjectionRows('conditionalHitGroups'),
      ],
      passives: [
        ...profileRows.passives,
        ...collectIsolatedProjectionRows('passives'),
      ],
      switchTriggers: [
        ...profileRows.switchTriggers,
        ...collectIsolatedProjectionRows('switchTriggers'),
      ],
      facts: Object.fromEntries(
        assertionResults.map(result => [result.identity, result.passed])
      ),
    },
  };
}

function inspectCriticalMatrix(ownerId, first, second, probe) {
  const prefix = String(ownerId) + '-critical-';
  const configuredBoundary = probe?.integerThresholdBoundary ?? null;
  const boundary = configuredBoundary
    ? {
        low: Number(configuredBoundary.low),
        threshold: Number(configuredBoundary.threshold),
      }
    : { low: 499, threshold: 500 };
  const validBoundary =
    Number.isInteger(boundary.low) &&
    Number.isInteger(boundary.threshold) &&
    boundary.low >= 0 &&
    boundary.threshold <= 10000 &&
    boundary.low + 1 === boundary.threshold;
  const damageEvents = first.trace?.damage ?? [];
  const capturedSample = damageEvents.find(
    event =>
      event.actionId === prefix + 'sampled-low' &&
      event.eventType === 'VERIFIED_COMBAT_HIT' &&
      event.formula?.randomBranch?.mode === 'captured-critical-roll'
  );
  const overriddenHitIdentity = capturedSample?.hitIdentity ?? null;
  const findHit = suffix =>
    damageEvents.find(
      event =>
        event.actionId === prefix + suffix &&
        event.eventType === 'VERIFIED_COMBAT_HIT' &&
        event.hitIdentity === overriddenHitIdentity
    ) ?? null;
  const sampledLow = findHit('sampled-low');
  const sampledBoundary = findHit('sampled-boundary');
  const expected = findHit('expected');
  const critical = findHit('critical');
  const nonCritical = findHit('non-critical');
  const miss = findHit('miss-critical');
  const rateZero = findHit('rate-zero');
  const rateOneHundred = findHit('rate-one-hundred');
  const configuredPreHit = probe?.preHitAttributeChange ?? null;
  const configuredProbeEvents = selectConfiguredCriticalProbeEvents(
    damageEvents,
    probe,
    overriddenHitIdentity
  );
  const preHitBefore = configuredPreHit
    ? configuredProbeEvents.preHitBefore
    : ownerId === 109001
      ? (first.trace?.damage ?? []).find(
          event =>
            event.actionId === 'moyin-lifecycle-a5-1' &&
            event.eventType === 'VERIFIED_COMBAT_HIT' &&
            String(event.hitIdentity ?? '').endsWith('|47|6')
        )
      : ownerId === 108003
        ? sampledLow
        : rateZero;
  const preHitAfter = configuredPreHit
    ? configuredProbeEvents.preHitAfter
    : ownerId === 109001
      ? (first.trace?.damage ?? []).find(
          event =>
            event.actionId === 'moyin-lifecycle-a5-1' &&
            event.eventType === 'VERIFIED_COMBAT_HIT' &&
            String(event.hitIdentity ?? '').endsWith('|56|7')
        )
      : ownerId === 108003
        ? (first.trace?.damage ?? []).find(
            event =>
              event.actionId === 'miti-pre-hit-after-mark' &&
              event.eventType === 'VERIFIED_COMBAT_HIT' &&
              event.hitIdentity === sampledLow?.hitIdentity
          )
        : rateOneHundred;
  const configuredNonCrittable = probe?.nonCrittable ?? null;
  const nonCrittable = configuredNonCrittable
    ? configuredProbeEvents.nonCrittable
    : damageEvents.find(event => {
        if (ownerId === 109001) {
          return (
            event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
            Number(event.elementId) === 251
          );
        }
        return (
          event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
          event.formula?.randomBranch == null &&
          event.formula?.status === 'verified-tuning-formula-applied' &&
          Number(event.rawDamage) > 0
        );
      });
  const nonCrittablePeer = configuredNonCrittable
    ? configuredProbeEvents.nonCrittablePeer
    : (first.trace?.damage ?? []).find(
        event =>
          event.actionId === nonCrittable?.actionId &&
          event.eventType === 'VERIFIED_COMBAT_HIT' &&
          event.formula?.randomBranch
      );
  const expectedResult = expected?.formula?.verifiedResult?.expectedCritical;
  return {
    sameSeedReplay: sameHashes(first.hashes, second.hashes),
    integerThresholdBoundary:
      validBoundary &&
      sampledLow?.formula?.randomBranch?.criticalRoll === boundary.low &&
      sampledLow?.formula?.randomBranch?.criticalThreshold ===
        boundary.threshold &&
      sampledLow?.formula?.randomBranch?.critical === true &&
      sampledBoundary?.formula?.randomBranch?.criticalRoll ===
        boundary.threshold &&
      sampledBoundary?.formula?.randomBranch?.criticalThreshold ===
        boundary.threshold &&
      sampledBoundary?.formula?.randomBranch?.critical === false,
    perHitModes:
      sampledLow?.formula?.randomBranch?.mode === 'captured-critical-roll' &&
      expected?.formula?.randomBranch?.mode === 'expected' &&
      critical?.formula?.randomBranch?.mode === 'critical' &&
      nonCritical?.formula?.randomBranch?.mode === 'non-critical',
    expectedNoCriticalEvent:
      expectedResult?.criticalEventMaterialized === false &&
      expectedResult?.weightedValue === expected?.rawDamage,
    missSuppressesHit: miss == null,
    ...([109001, 108003].includes(ownerId) ||
    probe ||
    rateZero ||
    rateOneHundred
      ? {
          rateZero:
            rateZero?.formula?.randomBranch?.criticalThreshold === 0 &&
            rateZero?.formula?.randomBranch?.criticalRoll === 0 &&
            rateZero?.formula?.randomBranch?.critical === false,
          rateOneHundredPercent:
            rateOneHundred?.formula?.randomBranch?.criticalThreshold ===
              10000 &&
            rateOneHundred?.formula?.randomBranch?.criticalRoll === 9999 &&
            rateOneHundred?.formula?.randomBranch?.critical === true,
          preHitAttributeChange:
            criticalAttributeIncreased(
              preHitBefore,
              preHitAfter,
              'sourceCriticalRateBasisPoints'
            ) &&
            (!([109001, 108003].includes(ownerId) || probe) ||
              criticalAttributeIncreased(
                preHitBefore,
                preHitAfter,
                'sourceCriticalDamageBasisPoints'
              )),
          nonCrittableRejection:
            nonCrittable?.formula?.status ===
              'verified-tuning-formula-applied' &&
            nonCrittable?.formula?.randomBranch == null &&
            hasPositiveSettledDamage(nonCrittable) &&
            Boolean(nonCrittablePeer?.formula?.randomBranch),
        }
      : {}),
    details: {
      sampledLow: projectCriticalHit(sampledLow),
      sampledBoundary: projectCriticalHit(sampledBoundary),
      expected: projectCriticalHit(expected),
      critical: projectCriticalHit(critical),
      nonCritical: projectCriticalHit(nonCritical),
      rateZero: projectCriticalHit(rateZero),
      rateOneHundred: projectCriticalHit(rateOneHundred),
      preHitBefore: projectCriticalHit(preHitBefore),
      preHitAfter: projectCriticalHit(preHitAfter),
      nonCrittable: projectCriticalHit(nonCrittable),
      nonCrittablePeer: projectCriticalHit(nonCrittablePeer),
    },
  };
}

function hasPositiveSettledDamage(event) {
  return Number(event?.rawDamage) > 0 || Number(event?.requestedHpDamage) > 0;
}

function criticalAttributeIncreased(before, after, field) {
  const beforeValue = Number(before?.formula?.randomBranch?.[field]);
  const afterValue = Number(after?.formula?.randomBranch?.[field]);
  return (
    Number.isFinite(beforeValue) &&
    Number.isFinite(afterValue) &&
    afterValue > beforeValue
  );
}

function inspectEffectLifecycle(run, configuration) {
  const eventPath = configuration.eventPath ?? 'effects.events';
  const operationPath = configuration.operationPath ?? 'operation';
  const timePath = configuration.timePath ?? null;
  const effectIdentity =
    configuration.effectIdentity == null
      ? null
      : String(configuration.effectIdentity);
  const targetId =
    configuration.targetId == null ? null : String(configuration.targetId);
  const collection = readPath(run.trace, eventPath);
  const events = (Array.isArray(collection) ? collection : []).filter(
    event =>
      (effectIdentity == null ||
        String(event.effectId ?? event.runtimeEffectId ?? '') ===
          effectIdentity) &&
      (targetId == null || String(event.targetId ?? '') === targetId) &&
      matchesProbeWhere(event, configuration.where ?? {})
  );
  const requiredOperations = configuration.requiredOperations ?? [
    'apply',
    'refresh',
    'expire',
  ];
  const operations = new Set(
    events.map(event => String(readPath(event, operationPath) ?? ''))
  );
  const durationValue = Number(
    timePath == null ? configuration.durationFrames : configuration.durationMs
  );
  const startOperations = configuration.startOperations ?? ['apply', 'refresh'];
  const expirationOperation = configuration.expirationOperation ?? 'expire';
  const resolvePosition = event =>
    timePath == null
      ? resolveTraceFrame(event)
      : Number(readPath(event, timePath));
  const rightOpenMatches = [];
  if (
    configuration.rightOpenExpiry === true &&
    Number.isFinite(durationValue)
  ) {
    for (const [expirationIndex, expiration] of events.entries()) {
      if (readPath(expiration, operationPath) !== expirationOperation) continue;
      const expirationPosition = resolvePosition(expiration);
      const priorStarts = events
        .slice(0, expirationIndex)
        .filter(
          event =>
            startOperations.includes(readPath(event, operationPath)) &&
            resolvePosition(event) <= expirationPosition
        )
        .sort((left, right) => resolvePosition(right) - resolvePosition(left));
      const start = priorStarts[0] ?? null;
      const startPosition = resolvePosition(start);
      rightOpenMatches.push({
        startOperation: readPath(start, operationPath) ?? null,
        startPosition,
        expirationPosition,
        duration: durationValue,
        unit: timePath == null ? 'frame' : 'millisecond',
        passed:
          Number.isFinite(startPosition) &&
          Number.isFinite(expirationPosition) &&
          Math.abs(expirationPosition - startPosition - durationValue) <= 1e-6,
      });
    }
  }
  const rightOpenPassed = validateRightOpenLifecycleMatches(rightOpenMatches, {
    required: configuration.rightOpenExpiry === true,
  });
  return {
    passed:
      requiredOperations.every(operation => operations.has(operation)) &&
      rightOpenPassed,
    details: {
      eventPath,
      operationPath,
      timePath,
      effectIdentity,
      targetId,
      where: structuredClone(configuration.where ?? {}),
      requiredOperations,
      observedOperations: [...operations].sort(),
      rightOpenMatches,
      events: events.map(event => ({
        actionId: event.actionId ?? null,
        operation: readPath(event, operationPath) ?? null,
        position: resolvePosition(event),
        targetId: event.targetId ?? null,
      })),
    },
  };
}

function resolveTraceFrame(event) {
  if (!event) return Number.NaN;
  const value = event.frameIndex ?? event.absoluteFrame ?? event.frame;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function inspectThunderLifecycle(run) {
  const marks = (run.trace?.resources?.tuningMarks ?? []).filter(
    event => Number(event.markId) === 250
  );
  const targetEvents = run.trace?.state?.targetEvents ?? [];
  const findMark = (actionId, predicate = () => true) =>
    marks.find(event => event.actionId === actionId && predicate(event)) ??
    null;
  const suppressedOffAcquire = findMark(
    'moyin-a5-brilliant-off',
    event => event.kind === 'acquire'
  );
  const suppressedOffCondition = targetEvents.find(
    event =>
      event.actionId === 'moyin-a5-brilliant-off' &&
      event.type === 'VERIFIED_ACTION_EFFECT_STATE_CONDITION_EVALUATED' &&
      event.payload?.stateIdentity === 'moyin-brilliant' &&
      event.payload?.applied === false
  );
  const apply = findMark(
    'moyin-lifecycle-a5-1',
    event => event.kind === 'acquire'
  );
  const stack = findMark(
    'moyin-lifecycle-a5-2',
    event => event.kind === 'acquire'
  );
  const cap = findMark(
    'moyin-lifecycle-a5-3',
    event => event.kind === 'acquire'
  );
  const refresh = findMark(
    'moyin-lifecycle-a5-4-refresh',
    event => event.kind === 'acquire'
  );
  const expire = marks.find(event => event.kind === 'expire') ?? null;
  const firstHeldDamage = (run.trace?.damage ?? []).find(
    event =>
      event.actionId === 'moyin-lifecycle-a5-1' &&
      event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
      Number(event.elementId) === 251
  );
  const nextHeldDamage = (run.trace?.damage ?? []).find(
    event =>
      event.actionId === 'moyin-held-boundary-hit' &&
      event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
      Number(event.elementId) === 251
  );
  const heldDamageInsideCooldown = (run.trace?.damage ?? []).find(
    event =>
      event.actionId === 'moyin-lifecycle-a5-2' &&
      event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
      Number(event.elementId) === 251
  );
  const persistentEffect = (run.trace?.effects?.events ?? []).find(
    event =>
      event.actionId === 'moyin-lifecycle-a5-1' &&
      event.effectId === 'tuning-mark:250:persistent' &&
      event.operation === 'apply' &&
      event.targetId === 'actor-109001'
  );
  const expiryBoundaryHit = (run.trace?.damage ?? []).find(
    event =>
      event.actionId === 'moyin-expiry-boundary-hit' &&
      event.eventType === 'VERIFIED_COMBAT_HIT' &&
      String(event.hitIdentity ?? '').endsWith('|12|1')
  );
  const modifierByAttribute = new Map(
    (persistentEffect?.modifiers ?? []).map(modifier => [
      Number(modifier.attributeId),
      Number(modifier.valueRaw),
    ])
  );
  const passed =
    suppressedOffAcquire == null &&
    suppressedOffCondition != null &&
    apply?.before === 0 &&
    apply?.after === 2 &&
    apply?.delta === 2 &&
    stack?.before === 2 &&
    stack?.after === 4 &&
    cap?.before === 3 &&
    cap?.after === 5 &&
    cap?.delta === 2 &&
    refresh?.before === 5 &&
    refresh?.after === 5 &&
    refresh?.delta === 0 &&
    expire?.before === 5 &&
    expire?.after === 4 &&
    expire?.delta === -1 &&
    expire?.frameIndex === expiryBoundaryHit?.absoluteFrame &&
    expiryBoundaryHit?.formula?.randomBranch?.sourceCriticalRateBasisPoints ===
      672 &&
    firstHeldDamage?.formula?.status === 'verified-tuning-formula-applied' &&
    Number(firstHeldDamage?.rawDamage) > 0 &&
    firstHeldDamage?.absoluteFrame === apply?.frameIndex &&
    heldDamageInsideCooldown == null &&
    nextHeldDamage?.formula?.status === 'verified-tuning-formula-applied' &&
    Number(nextHeldDamage?.rawDamage) > Number(firstHeldDamage?.rawDamage) &&
    Math.abs(
      Number(nextHeldDamage?.timeMs) - Number(firstHeldDamage?.timeMs) - 5000
    ) < 0.001 &&
    modifierByAttribute.get(7) === 43 &&
    modifierByAttribute.get(8) === 86;
  return {
    passed,
    details: {
      suppressedOffAcquire,
      suppressedOffCondition,
      apply,
      stack,
      cap,
      refresh,
      expire,
      firstHeldDamage: projectCriticalHit(firstHeldDamage),
      nextHeldDamage: projectCriticalHit(nextHeldDamage),
      heldDamageInsideCooldown: projectCriticalHit(heldDamageInsideCooldown),
      persistentEffect,
      expiryBoundaryHit: projectCriticalHit(expiryBoundaryHit),
    },
  };
}

function inspectInputWindowBoundaries(fixture, run, configuration = null) {
  const selections = new Map(
    (run.trace?.variants?.selections ?? []).map(selection => [
      selection.actionId,
      selection,
    ])
  );
  const actions = new Map(
    (fixture.actions ?? []).map(action => [action.id, action])
  );
  const definitions = configuration?.cases ?? [
    {
      actionId: 'window-outside-before',
      expectedOffset: 39,
      expectedControlSkillId: 10900101,
    },
    {
      actionId: 'window-inside-start',
      expectedOffset: 41,
      expectedControlSkillId: 10900143,
    },
    {
      actionId: 'window-inside-end',
      expectedOffset: 76,
      expectedControlSkillId: 10900143,
    },
    {
      actionId: 'window-outside-after',
      expectedOffset: 78,
      expectedControlSkillId: 10900101,
    },
  ];
  const cases = definitions.map(definition => {
    const {
      actionId,
      expectedOffset,
      expectedControlSkillId,
      expectedSubSkillIndex,
    } = definition;
    const action = actions.get(actionId);
    const contextAction = actions.get(
      action?.intent?.attackInput?.contextActionId
    );
    const actualOffset =
      Number(action?.schedule?.frame) - Number(contextAction?.schedule?.frame);
    const selection = selections.get(actionId) ?? null;
    return {
      actionId,
      expectedOffset,
      actualOffset,
      expectedControlSkillId,
      actualControlSkillId: Number(selection?.controlSkillId),
      expectedSubSkillIndex: expectedSubSkillIndex ?? null,
      actualSubSkillIndex: Number(selection?.subSkillIndex),
      passed:
        actualOffset === expectedOffset &&
        Number(selection?.controlSkillId) === expectedControlSkillId &&
        (expectedSubSkillIndex == null ||
          Number(selection?.subSkillIndex) === expectedSubSkillIndex),
      selection,
    };
  });
  return {
    passed: cases.every(entry => entry.passed),
    details: {
      sourceControlSkillId: configuration?.sourceControlSkillId ?? 10900112,
      transitionControlSkillId:
        configuration?.transitionControlSkillId ?? 10900143,
      sourceWindow: configuration?.sourceWindow ?? '(40,77] source frames',
      cases,
    },
  };
}

function inspectConfiguredInputWindowBoundaries({
  fixture,
  run,
  profile,
  probe,
}) {
  if (probe.kind !== 'focused-mechanic-window') {
    return {
      passed: false,
      details: { reason: 'configured-input-window-probe-kind-unsupported' },
    };
  }
  const window = (profile.contracts?.attackInputMechanicWindows ?? []).find(
    candidate => candidate.bindingIdentity === probe.bindingIdentity
  );
  const action = (fixture.actions ?? []).find(
    candidate => candidate.id === probe.actionId
  );
  const selection = (run.trace?.variants?.selections ?? []).find(
    candidate => candidate.actionId === probe.actionId
  );
  const actionFrame = Number(action?.schedule?.frame);
  const durationFrames = Number(window?.durationFrames);
  const lastCoveredHitFrame = Number(window?.lastCoveredHitFrame);
  const hitPrefix = `${Number(window?.controlSkillId)}|${Number(
    window?.subSkillIndex
  )}|`;
  const relativeHitFrames = (run.trace?.damage ?? [])
    .filter(
      event =>
        event.actionId === probe.actionId &&
        event.eventType === 'VERIFIED_COMBAT_HIT' &&
        String(event.hitIdentity ?? '').startsWith(hitPrefix)
    )
    .map(event => Number(event.absoluteFrame) - actionFrame)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const leftOutsideClear = relativeHitFrames.every(frame => frame >= 0);
  const rightInsideObserved = relativeHitFrames.includes(lastCoveredHitFrame);
  const rightOutsideClear = relativeHitFrames.every(
    frame => frame < durationFrames
  );
  const passed =
    Boolean(window) &&
    Boolean(action) &&
    Boolean(selection) &&
    window.status === 'verified-attack-input-mechanic-window-ready' &&
    window.applied === true &&
    window.interval === '[0,durationFrames)' &&
    Number(selection.controlSkillId) === Number(window.controlSkillId) &&
    Number(selection.subSkillIndex) === Number(window.subSkillIndex) &&
    Number.isInteger(actionFrame) &&
    Number.isInteger(durationFrames) &&
    durationFrames === lastCoveredHitFrame + 1 &&
    relativeHitFrames.length > 0 &&
    leftOutsideClear &&
    rightInsideObserved &&
    rightOutsideClear;
  return {
    passed,
    details: {
      probeKind: probe.kind,
      bindingIdentity: probe.bindingIdentity,
      sourceIdentity: window?.sourceIdentity ?? null,
      interval: window?.interval ?? null,
      actionId: probe.actionId,
      actionFrame: Number.isInteger(actionFrame) ? actionFrame : null,
      controlSkillId: window?.controlSkillId ?? null,
      subSkillIndex: window?.subSkillIndex ?? null,
      durationFrames: Number.isInteger(durationFrames) ? durationFrames : null,
      lastCoveredHitFrame: Number.isInteger(lastCoveredHitFrame)
        ? lastCoveredHitFrame
        : null,
      relativeHitFrames,
      boundaries: {
        leftOutsideFrame: -1,
        leftInsideFrame: 0,
        rightInsideFrame: Number.isInteger(durationFrames)
          ? durationFrames - 1
          : null,
        rightOutsideFrame: Number.isInteger(durationFrames)
          ? durationFrames
          : null,
        leftOutsideClear,
        rightInsideObserved,
        rightOutsideClear,
      },
    },
  };
}

function inspectMitiInputWindowBoundaries(fixture, run, service) {
  const activeActionId = 'miti-star-combo-active';
  const pairedKiboActionId = 'miti-star-combo-kibo-break';
  const insideActor = (run.trace?.executionPlan?.actions ?? []).find(
    action => action.actionId === activeActionId
  );
  const insideKibo = (run.trace?.executionPlan?.actions ?? []).find(
    action => action.actionId === pairedKiboActionId
  );
  const outsideFixture = structuredClone(fixture);
  const outsideKiboAction = (outsideFixture.actions ?? []).find(
    action => action.id === pairedKiboActionId
  );
  outsideKiboAction.schedule.frame += 1;
  const outsideValidation = service.validate(outsideFixture);
  const outsideDiagnostics = (outsideValidation.issues ?? []).filter(issue =>
    [activeActionId, pairedKiboActionId].includes(String(issue.actionId))
  );
  const expectedDiagnosticCodes = new Set([
    'joint-attack-frame-mismatch',
    'joint-attack-pair-missing',
  ]);
  const rejectedActionIds = new Set(
    outsideDiagnostics
      .filter(issue =>
        (issue.violationCodes ?? []).some(code =>
          expectedDiagnosticCodes.has(code)
        )
      )
      .map(issue => String(issue.actionId))
  );
  return {
    passed:
      insideActor?.execute !== false &&
      insideKibo?.execute !== false &&
      outsideValidation.valid === false &&
      rejectedActionIds.has(activeActionId) &&
      rejectedActionIds.has(pairedKiboActionId),
    details: {
      sourceContract: 'azpr-joint-attack-input-contract',
      inside: {
        actorFrame: Number(
          fixture.actions.find(action => action.id === activeActionId)?.schedule
            ?.frame
        ),
        kiboFrame: Number(
          fixture.actions.find(action => action.id === pairedKiboActionId)
            ?.schedule?.frame
        ),
        actorExecute: insideActor?.execute ?? null,
        kiboExecute: insideKibo?.execute ?? null,
      },
      outside: {
        actorFrame: Number(
          outsideFixture.actions.find(action => action.id === activeActionId)
            ?.schedule?.frame
        ),
        kiboFrame: Number(outsideKiboAction.schedule.frame),
        validationValid: outsideValidation.valid,
        rejectedActionIds: [...rejectedActionIds].sort(),
        diagnosticCodes: outsideDiagnostics.flatMap(
          issue => issue.violationCodes ?? [issue.code]
        ),
      },
    },
  };
}

function inspectMitiForegroundBackgroundSwitch(run) {
  const controlledActorAt = timeMs => {
    const switches = (run.trace?.events ?? [])
      .filter(
        event => event.type === 'SWITCH' && Number(event.timeMs) <= timeMs
      )
      .sort((left, right) => Number(left.timeMs) - Number(right.timeMs));
    return switches.at(-1)?.payload?.targetActorId ?? 'actor-108003';
  };
  const periodicSpEvents = (run.trace?.resources?.actors ?? []).filter(
    event => Number(event.elementId) === 108003164 && Number(event.change) === 2
  );
  const backgroundTicks = periodicSpEvents.filter(
    event => controlledActorAt(Number(event.timeMs)) !== 'actor-108003'
  );
  const targets = [
    ...new Set(periodicSpEvents.map(event => String(event.actorId ?? ''))),
  ].sort();
  const switchEvents = (run.trace?.events ?? []).filter(
    event => event.type === 'SWITCH'
  );
  return {
    passed:
      switchEvents.length >= 2 &&
      backgroundTicks.length > 0 &&
      ['actor-101010', 'actor-103002', 'actor-108003'].every(actorId =>
        targets.includes(actorId)
      ),
    details: {
      switchEvents: switchEvents.map(event => ({
        timeMs: event.timeMs,
        fromActorId: event.payload?.fromActorId ?? null,
        toActorId: event.payload?.targetActorId ?? null,
      })),
      periodicSpEventCount: periodicSpEvents.length,
      periodicSpTargets: targets,
      backgroundTickCount: backgroundTicks.length,
      backgroundTicks: backgroundTicks.map(event => ({
        timeMs: event.timeMs,
        actorId: event.actorId ?? null,
        controlledActorId: controlledActorAt(Number(event.timeMs)),
      })),
    },
  };
}

function projectVerifiedTuningComponentEffects(run, scenarioId) {
  const profiles = mechanicsPackage.tuningMechanicsCatalog?.profiles ?? [];
  const damageComponents = new Map(
    profiles.flatMap(profile =>
      (profile.heldDamageTemplates ?? []).map(template => [
        Number(template.elementConfigId),
        { profile, template },
      ])
    )
  );
  const rows = [];
  for (const [index, event] of (run.trace?.damage ?? []).entries()) {
    if (
      event.eventType !== 'VERIFIED_TUNING_DAMAGE' ||
      !damageComponents.has(Number(event.elementId)) ||
      event.formula?.status !== 'verified-tuning-formula-applied'
    ) {
      continue;
    }
    rows.push({
      projectionIdentity:
        'machine-tuning-damage-effect:' + scenarioId + ':' + index,
      actionId: event.actionId ?? null,
      effectIdentity: 'battle-element:' + Number(event.elementId),
      operation: 'settle-damage',
      targetId: event.targetId ?? null,
      sourceIdentity: event.formula?.sourceIdentity ?? null,
      rawDamage: event.rawDamage ?? null,
    });
  }
  for (const [index, event] of (run.trace?.effects?.events ?? []).entries()) {
    const match = String(event.effectId ?? '').match(
      /^tuning-mark:(\d+):persistent$/
    );
    if (!match) continue;
    const profile = profiles.find(
      candidate => Number(candidate.markId) === Number(match[1])
    );
    if (!profile) continue;
    for (const modifier of event.modifiers ?? []) {
      const verified = (profile.persistentModifiers ?? []).find(
        candidate =>
          Number(candidate.attributeId) === Number(modifier.attributeId) &&
          Number(candidate.valueRaw) === Number(modifier.valueRaw)
      );
      if (!verified) continue;
      rows.push({
        projectionIdentity:
          'machine-tuning-modifier-effect:' +
          scenarioId +
          ':' +
          index +
          ':' +
          verified.componentId,
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + Number(verified.componentId),
        operation: event.operation ?? null,
        targetId: event.targetId ?? null,
        sourceIdentity: verified.sourceIdentity ?? null,
        attributeId: Number(verified.attributeId),
        valueRaw: Number(verified.valueRaw),
      });
    }
  }
  for (const [index, event] of (run.trace?.events ?? []).entries()) {
    if (
      event.type !== 'VERIFIED_TUNING_PERIODIC_HEAL' ||
      event.payload?.applied !== true ||
      event.payload?.appliedToCalculators !== true
    ) {
      continue;
    }
    const sourceText = String(event.payload?.sourceIdentity ?? '');
    const profile = profiles.find(candidate =>
      sourceText.includes(
        `markContainers[elementConfigId=${Number(candidate.markId)}]`
      )
    );
    for (const componentId of profile?.heldEffect?.componentIds ?? []) {
      rows.push({
        projectionIdentity:
          'machine-tuning-periodic-heal-component:' +
          scenarioId +
          ':' +
          index +
          ':' +
          Number(componentId),
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + Number(componentId),
        operation: 'periodic-heal',
        targetId: event.targetId ?? null,
        sourceIdentity: event.payload?.sourceIdentity ?? null,
        requestedChange: event.payload?.requestedChange ?? null,
      });
    }
  }
  return rows;
}

function projectVerifiedTuningJudgmentEffects(run, profile, scenarioId) {
  const semanticEffects = profile?.contracts?.effects?.semantic ?? [];
  const judgments = run.trace?.state?.tuningConsumeJudgments ?? [];
  const acceptedStatuses = new Set([
    'verified-tuning-consume-applied',
    'verified-tuning-consume-insufficient-marks',
    'verified-tuning-consume-no-sufficient-priority-candidate',
  ]);
  const rows = [];
  for (const [index, judgment] of judgments.entries()) {
    if (judgment.executed !== true || !acceptedStatuses.has(judgment.status)) {
      continue;
    }
    if (
      judgment.applied === true &&
      judgment.status === 'verified-tuning-consume-applied'
    ) {
      const delegatedEffects = semanticEffects.filter(effect => {
        const delegation = effect.formulaRuntime?.delegation;
        const semanticSubSkillIndex = firstInteger(
          effect.subSkillIndex,
          effect.selectedSubSkillIndex,
          effect.mapIndex,
          ...(effect.trigger?.subSkillIndexes ?? [])
        );
        return (
          delegation?.kind ===
            'verified-tuning-overlimit-consumption-runtime' &&
          delegation.applied === true &&
          Number(effect.controlSkillId) === Number(judgment.controlSkillId) &&
          semanticSubSkillIndex === Number(judgment.subSkillIndex) &&
          String(delegation.judgmentGroupIdentity ?? '') ===
            String(judgment.judgmentGroupIdentity ?? '')
        );
      });
      for (const delegatedEffect of delegatedEffects) {
        rows.push({
          projectionIdentity:
            'machine-delegated-tuning-effect:' +
            scenarioId +
            ':' +
            index +
            ':' +
            delegatedEffect.semanticIdentity,
          actionId: judgment.actionId ?? null,
          controlSkillId: judgment.controlSkillId,
          subSkillIndex: judgment.subSkillIndex,
          effectIdentity: 'battle-element:' + Number(delegatedEffect.elementId),
          operation: 'delegated-tuning-consume-runtime',
          absoluteFrame: judgment.absoluteFrame ?? null,
          triggerFrame: judgment.triggerFrame ?? null,
          behaviorPathId: judgment.behaviorPathId ?? null,
          applied: true,
          status: judgment.status,
          sourceIdentity:
            delegatedEffect.formulaRuntime?.delegation?.sourceIdentity ??
            judgment.sourceIdentity ??
            null,
        });
      }
    }
    const semanticEffect = semanticEffects.find(effect => {
      const semanticSubSkillIndex = firstInteger(
        effect.subSkillIndex,
        effect.selectedSubSkillIndex,
        effect.mapIndex,
        ...(effect.trigger?.subSkillIndexes ?? [])
      );
      const expectedRuntimeSourceIdentity = [
        'battle-effect:' + Number(effect.controlSkillId),
        Number(judgment.subSkillIndex),
        String(effect.pathId ?? ''),
        String(effect.trigger?.behaviorPathId ?? ''),
        Number(effect.trigger?.startFrame),
      ].join(':');
      return (
        effect.classification === 'applied' &&
        effect.tuningOverlimit != null &&
        Number(effect.controlSkillId) === Number(judgment.controlSkillId) &&
        semanticSubSkillIndex === Number(judgment.subSkillIndex) &&
        Number(effect.elementId) === Number(judgment.judgmentElementId) &&
        String(effect.pathId ?? '') === String(judgment.judgmentPathId ?? '') &&
        String(effect.trigger?.behaviorPathId ?? '') ===
          String(judgment.behaviorPathId ?? '') &&
        matchesRuntimeSourceIdentity(
          judgment.sourceIdentity,
          expectedRuntimeSourceIdentity
        )
      );
    });
    if (!semanticEffect) continue;
    rows.push({
      projectionIdentity:
        'machine-tuning-judgment-effect:' +
        scenarioId +
        ':' +
        index +
        ':' +
        semanticEffect.semanticIdentity,
      actionId: judgment.actionId ?? null,
      controlSkillId: judgment.controlSkillId,
      subSkillIndex: judgment.subSkillIndex,
      effectIdentity: 'battle-element:' + Number(semanticEffect.elementId),
      operation: 'evaluate',
      absoluteFrame: judgment.absoluteFrame ?? null,
      triggerFrame: judgment.triggerFrame ?? null,
      behaviorPathId: judgment.behaviorPathId ?? null,
      markId: judgment.markId ?? null,
      markCountAtJudgment: judgment.markCountAtJudgment ?? null,
      consumedCount: judgment.consumedCount ?? 0,
      applied: judgment.applied === true,
      status: judgment.status ?? null,
      sourceIdentity:
        judgment.sourceIdentity ?? semanticEffect.sourceIdentities?.[0] ?? null,
    });
  }
  return rows;
}

function projectResourceBackedEffects(run, scenarioId) {
  return (run.trace?.events ?? [])
    .filter(
      event =>
        event.type === 'VERIFIED_RESOURCE_CHANGE' &&
        Number.isInteger(Number(event.payload?.elementId)) &&
        Number(event.payload?.change) !== 0
    )
    .map((event, index) => ({
      projectionIdentity:
        'machine-resource-backed-effect:' + scenarioId + ':' + index,
      actionId: event.actionId ?? null,
      effectIdentity: 'battle-element:' + Number(event.payload.elementId),
      operation: 'resource-change',
      targetId: event.actorId ?? event.targetId ?? null,
      sourceIdentity: event.payload?.sourceIdentity ?? null,
      beforeValue: event.payload?.beforeValue ?? null,
      afterValue: event.payload?.afterValue ?? null,
      change: event.payload?.change ?? null,
    }));
}

function projectAppliedEffectSourceElements(run, scenarioId) {
  const rows = [];
  for (const [eventIndex, event] of (
    run.trace?.effects?.events ?? []
  ).entries()) {
    const sourceText = String(event.sourceIdentity?.identity ?? '');
    const elementIds = [
      ...new Set(
        [...sourceText.matchAll(/ast_(\d+)\.asset/g)].map(match =>
          Number(match[1])
        )
      ),
    ];
    for (const [elementIndex, elementId] of elementIds.entries()) {
      rows.push({
        projectionIdentity:
          'machine-applied-effect-source-element:' +
          scenarioId +
          ':' +
          eventIndex +
          ':' +
          elementIndex,
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + elementId,
        operation: event.operation ?? null,
        targetId: event.targetId ?? null,
        sourceIdentity: event.sourceIdentity ?? null,
      });
    }
  }
  for (const [eventIndex, event] of (
    run.trace?.state?.targetEvents ?? []
  ).entries()) {
    const elementId = Number(event.payload?.elementId);
    if (
      event.type !== 'VERIFIED_ACTION_EFFECT_LANDED_HIT_CONDITION_EVALUATED' ||
      event.payload?.applied !== true ||
      !Number.isInteger(elementId)
    ) {
      continue;
    }
    rows.push({
      projectionIdentity:
        'machine-landed-hit-effect-source-element:' +
        scenarioId +
        ':' +
        eventIndex,
      actionId: event.actionId ?? null,
      effectIdentity: 'battle-element:' + elementId,
      operation: 'landed-hit-condition-applied',
      targetId: event.targetId ?? event.payload?.targetId ?? null,
      sourceIdentity: event.payload?.sourceIdentity ?? null,
      hitIdentity: event.payload?.hitIdentity ?? null,
    });
  }
  return rows;
}

function projectCharacterRuntimeEffectEvidence(run, profile, scenarioId) {
  const selectionsByActionId = new Map(
    (run.trace?.variants?.selections ?? []).map(selection => [
      selection.actionId,
      selection,
    ])
  );
  const directSpTransactions = (run.trace?.resources?.actors ?? []).filter(
    event => event.reason === 'verified-direct-sp'
  );
  const rows = [];
  for (const binding of profile.contracts?.runtimeEffectBindings ?? []) {
    if (!binding.directSp || !binding.effectId) continue;
    for (const [index, event] of directSpTransactions.entries()) {
      const selection = selectionsByActionId.get(event.actionId);
      if (
        Number(selection?.controlSkillId) !== Number(binding.controlSkillId) ||
        Number(selection?.subSkillIndex) !== Number(binding.subSkillIndex)
      ) {
        continue;
      }
      rows.push({
        projectionIdentity:
          'machine-runtime-direct-sp-effect:' +
          scenarioId +
          ':' +
          binding.bindingIdentity +
          ':' +
          index,
        actionId: event.actionId,
        effectIdentity: binding.effectId,
        operation: event.reason,
        targetId: event.actorId ?? null,
        value: event.change ?? null,
        absoluteFrame: event.absoluteFrame ?? null,
        beforeValue: event.beforeValue ?? null,
        afterValue: event.afterValue ?? null,
        sourceIdentity: binding.sourceIdentity ?? null,
      });
    }
  }
  const effectEvents = run.trace?.effects?.events ?? [];
  for (const binding of profile.contracts?.actionEffectBindings ?? []) {
    if (
      !binding.assumptionIdentity ||
      !Number.isInteger(Number(binding.elementId))
    ) {
      continue;
    }
    const seenActions = new Set();
    for (const event of effectEvents) {
      if (
        !['apply', 'refresh'].includes(String(event.operation)) ||
        String(event.appliedAssumptionIdentity ?? '') !==
          String(binding.assumptionIdentity)
      ) {
        continue;
      }
      const selection = selectionsByActionId.get(event.actionId);
      if (
        Number(selection?.controlSkillId) !== Number(binding.controlSkillId) ||
        Number(selection?.subSkillIndex) !== Number(binding.subSkillIndex) ||
        seenActions.has(String(event.actionId))
      ) {
        continue;
      }
      seenActions.add(String(event.actionId));
      rows.push({
        projectionIdentity:
          'machine-runtime-assumption-container-effect:' +
          scenarioId +
          ':' +
          binding.bindingIdentity +
          ':' +
          event.actionId,
        actionId: event.actionId ?? null,
        controlSkillId: binding.controlSkillId,
        subSkillIndex: binding.subSkillIndex,
        effectIdentity: 'battle-element:' + Number(binding.elementId),
        operation: event.operation,
        targetId: event.targetId ?? null,
        absoluteFrame: event.absoluteFrame ?? null,
        sourceIdentity: binding.sourceIdentity ?? event.sourceIdentity ?? null,
        appliedAssumptionIdentity: binding.assumptionIdentity,
      });
    }
  }
  for (const [eventIndex, event] of (run.trace?.events ?? []).entries()) {
    if (event.type !== 'VERIFIED_BREAK_TRIGGER_WATCHER_TRIGGERED') continue;
    const appliedEffectIdentities = event.payload?.effectId
      ? [event.payload.effectId]
      : (event.payload?.appliedEffectIdentities ?? []).map(identity =>
          String(identity).replace(/:actor-[^:]+$/, '')
        );
    for (const [effectIndex, effectIdentity] of [
      ...new Set(appliedEffectIdentities),
    ].entries()) {
      rows.push({
        projectionIdentity:
          'machine-runtime-break-watcher-effect:' +
          scenarioId +
          ':' +
          eventIndex +
          ':' +
          effectIndex,
        actionId: event.actionId ?? null,
        effectIdentity: String(effectIdentity),
        operation: 'watcher-trigger-apply',
        targetId: event.targetId ?? null,
        absoluteFrame: event.absoluteFrame ?? null,
        sourceIdentity: event.payload?.sourceIdentity ?? null,
        appliedAssumptionIdentity:
          event.payload?.appliedAssumptionIdentity ?? null,
      });
    }
  }
  for (const passive of profile.contracts?.passives ?? []) {
    for (const [triggerIndex, trigger] of (
      passive.triggerBindings ?? []
    ).entries()) {
      const activation = trigger.landedHitActivationCondition;
      if (!activation?.hitIdentity) continue;
      const event = (run.trace?.state?.targetEvents ?? []).find(
        candidate =>
          candidate.type ===
            'VERIFIED_ACTION_EFFECT_LANDED_HIT_CONDITION_EVALUATED' &&
          candidate.payload?.applied === true &&
          candidate.payload?.hitIdentity === activation.hitIdentity &&
          Number(
            selectionsByActionId.get(candidate.actionId)?.controlSkillId
          ) === Number(trigger.controlSkillId)
      );
      if (!event) continue;
      rows.push({
        projectionIdentity:
          'machine-runtime-passive-effect:' +
          scenarioId +
          ':' +
          passive.passiveIdentity +
          ':' +
          triggerIndex,
        actionId: event.actionId ?? null,
        effectIdentity: passive.effectId,
        operation: 'landed-hit-passive-trigger',
        targetId: event.targetId ?? event.payload?.targetId ?? null,
        sourceIdentity:
          trigger.sourceIdentity ?? passive.sourceIdentity ?? null,
        hitIdentity: activation.hitIdentity,
      });
    }
  }
  return rows;
}

function projectVerifiedDirectEffectSources(run, scenarioId) {
  const rows = [];
  for (const [eventIndex, event] of (run.trace?.events ?? []).entries()) {
    if (
      event.type !== 'VERIFIED_DIRECT_HEAL' ||
      event.payload?.applied !== true ||
      event.payload?.appliedToCalculators !== true ||
      !(Number(event.payload?.requestedChange) > 0)
    ) {
      continue;
    }
    const sourceText = String(event.payload?.sourceIdentity ?? '');
    const elementIds = extractBattleElementIds(sourceText);
    for (const [elementIndex, elementId] of elementIds.entries()) {
      rows.push({
        projectionIdentity:
          'machine-verified-direct-effect-source:' +
          scenarioId +
          ':' +
          eventIndex +
          ':' +
          elementIndex,
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + elementId,
        operation: 'direct-heal',
        targetId: event.targetId ?? null,
        sourceIdentity: event.payload?.sourceIdentity ?? null,
        effectSourceIdentity: event.payload?.effectIdentity ?? null,
        requestedChange: event.payload?.requestedChange ?? null,
      });
    }
  }
  return rows;
}

function projectTuningMarkResourceEffects(run, profile, scenarioId) {
  const profiles = mechanicsPackage.tuningMechanicsCatalog?.profiles ?? [];
  const profileByMarkId = new Map(
    profiles.map(tuningProfile => [Number(tuningProfile.markId), tuningProfile])
  );
  const sourceEffects = (profile.contracts?.controls ?? []).flatMap(control =>
    (control.effects ?? []).filter(
      effect =>
        effect.tuningOverlimit != null &&
        Number(effect.tuningOverlimit?.minimumStacks) > 0 &&
        Number.isInteger(Number(effect.tuningOverlimit?.judgmentElementId))
    )
  );
  const controlEffects = (profile.contracts?.controls ?? []).flatMap(
    control => control.effects ?? []
  );
  const tuningDamageEvents = (run.trace?.damage ?? []).filter(
    event => event.eventType === 'VERIFIED_TUNING_DAMAGE'
  );
  const directSpEvents = (run.trace?.resources?.actors ?? []).filter(
    event => event.reason === 'tuning-overlimit-direct-sp'
  );
  const rows = [];
  for (const [index, event] of (
    run.trace?.resources?.tuningMarks ?? []
  ).entries()) {
    const markId = Number(event.markId);
    if (
      !['acquire', 'consume'].includes(String(event.kind)) ||
      !Number.isInteger(markId) ||
      Number(event.delta) === 0 ||
      event.applied === false
    ) {
      continue;
    }
    rows.push({
      projectionIdentity:
        'machine-tuning-mark-resource-effect:' + scenarioId + ':' + index,
      actionId: event.actionId ?? null,
      effectIdentity: 'battle-element:' + markId,
      operation: event.kind,
      targetId: event.targetId ?? event.actorId ?? null,
      sourceIdentity: event.sourceIdentity ?? null,
      beforeValue: event.before ?? null,
      afterValue: event.after ?? null,
      change: event.delta ?? null,
    });
    const eventSourceIdentity =
      typeof event.sourceIdentity === 'string'
        ? event.sourceIdentity
        : (event.sourceIdentity?.identity ?? null);
    const acquiredMarkSourceEffect = controlEffects.find(
      effect =>
        eventSourceIdentity != null &&
        String(effect.sourceIdentity) === String(eventSourceIdentity) &&
        Number(effect.tuningMark?.markId) === markId
    );
    if (event.kind === 'acquire' && acquiredMarkSourceEffect) {
      for (const componentId of [
        ...new Set(
          (acquiredMarkSourceEffect.tuningMark?.additionalHitComponentIds ?? [])
            .map(Number)
            .filter(Number.isInteger)
        ),
      ]) {
        rows.push({
          projectionIdentity:
            'machine-tuning-mark-component-activation:' +
            scenarioId +
            ':' +
            index +
            ':' +
            componentId,
          actionId: event.actionId ?? null,
          effectIdentity: 'battle-element:' + componentId,
          operation: 'activate-tuning-mark-component',
          targetId: event.targetId ?? event.actorId ?? null,
          sourceIdentity: [
            eventSourceIdentity,
            acquiredMarkSourceEffect.tuningMark?.sourceIdentity,
          ]
            .filter(Boolean)
            .join('|'),
          beforeValue: event.before ?? null,
          afterValue: event.after ?? null,
          change: event.delta ?? null,
        });
      }
    }
    if (event.kind !== 'consume' || Number(event.delta) >= 0) continue;

    const tuningProfile = profileByMarkId.get(markId);
    const sourceEffect = sourceEffects.find(
      effect =>
        eventSourceIdentity != null &&
        matchesRuntimeSourceIdentity(
          eventSourceIdentity,
          effect.sourceIdentity
        ) &&
        Number(effect.tuningOverlimit?.markId) === markId
    );
    const overlimitDamageElementIds = new Set(
      [
        tuningProfile?.overlimitDamage?.primaryComponentId,
        ...(tuningProfile?.overlimitDamage?.extraDamageComponentIds ?? []),
      ]
        .map(Number)
        .filter(Number.isInteger)
    );
    const consumeFrame = resolveTraceFrame(event);
    const matchingDamage = tuningDamageEvents.find(candidate => {
      const damageFrame = resolveTraceFrame(candidate);
      return (
        Number.isFinite(consumeFrame) &&
        Number.isFinite(damageFrame) &&
        damageFrame === consumeFrame &&
        String(candidate.actionId) === String(event.actionId) &&
        overlimitDamageElementIds.has(Number(candidate.elementId)) &&
        (Number(candidate.rawDamage) > 0 ||
          Number(candidate.requestedHpDamage) > 0)
      );
    });
    if (!tuningProfile || !sourceEffect || !matchingDamage) continue;

    const sourceControlSkillId = Number(sourceEffect.controlSkillId);
    const sourceSubSkillIndex = Number(
      sourceEffect.subSkillIndex ??
        sourceEffect.mapIndex ??
        sourceEffect.trigger?.subSkillIndexes?.[0]
    );
    const sourceTriggerFrame = Number(sourceEffect.trigger?.startFrame);
    const sourceBehaviorPathId = sourceEffect.trigger?.behaviorPathId;
    const sourceCoordinate = {
      ...(Number.isInteger(sourceControlSkillId)
        ? { controlSkillId: sourceControlSkillId }
        : {}),
      ...(Number.isInteger(sourceSubSkillIndex)
        ? { subSkillIndex: sourceSubSkillIndex }
        : {}),
      ...(Number.isInteger(sourceTriggerFrame)
        ? { triggerFrame: sourceTriggerFrame }
        : {}),
      ...(sourceBehaviorPathId == null
        ? {}
        : { behaviorPathId: String(sourceBehaviorPathId) }),
    };

    const packetElementId = Number(
      sourceEffect.tuningOverlimit?.packetElementId
    );
    if (Number.isInteger(packetElementId)) {
      rows.push({
        projectionIdentity:
          'machine-tuning-consume-packet-effect:' +
          scenarioId +
          ':' +
          index +
          ':' +
          packetElementId,
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + packetElementId,
        operation: 'tuning-consume-packet',
        targetId: matchingDamage.targetId ?? event.targetId ?? null,
        sourceIdentity: [
          event.sourceIdentity,
          sourceEffect.sourceIdentity,
          tuningProfile.overlimitPacket?.sourceIdentity,
          matchingDamage.formula?.sourceIdentity?.identity ??
            matchingDamage.formula?.sourceIdentity,
        ]
          .filter(Boolean)
          .join('|'),
        beforeValue: event.before ?? null,
        afterValue: event.after ?? null,
        change: event.delta ?? null,
        ...sourceCoordinate,
      });
    }

    const judgmentElementId = Number(
      sourceEffect.tuningOverlimit?.judgmentElementId
    );
    if (Number.isInteger(judgmentElementId)) {
      rows.push({
        projectionIdentity:
          'machine-tuning-consume-judgment-effect:' +
          scenarioId +
          ':' +
          index +
          ':' +
          judgmentElementId,
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + judgmentElementId,
        operation: 'tuning-consume-judgment',
        targetId: matchingDamage.targetId ?? event.targetId ?? null,
        sourceIdentity: [
          event.sourceIdentity,
          sourceEffect.tuningOverlimit?.judgmentGroupIdentity,
          sourceEffect.tuningOverlimit?.judgmentSourceIdentity,
          matchingDamage.formula?.sourceIdentity?.identity ??
            matchingDamage.formula?.sourceIdentity,
        ]
          .filter(Boolean)
          .join('|'),
        beforeValue: event.before ?? null,
        afterValue: event.after ?? null,
        change: event.delta ?? null,
        ...sourceCoordinate,
      });
    }

    const extraComponentId = Number(tuningProfile.overlimitExtra?.componentId);
    if (
      tuningProfile.overlimitExtra?.kind === 'sp_recovery' &&
      Number.isInteger(extraComponentId)
    ) {
      const matchingDirectSp = directSpEvents.find(
        candidate =>
          String(candidate.actionId) === String(event.actionId) &&
          (Number.isFinite(Number(candidate.timeMs)) &&
          Number.isFinite(Number(event.timeMs))
            ? Number(candidate.timeMs) === Number(event.timeMs)
            : Number(candidate.absoluteFrame) === Number(event.absoluteFrame))
      );
      if (matchingDirectSp) {
        rows.push({
          projectionIdentity:
            'machine-tuning-consume-extra-effect:' +
            scenarioId +
            ':' +
            index +
            ':' +
            extraComponentId,
          actionId: event.actionId ?? null,
          effectIdentity: 'battle-element:' + extraComponentId,
          operation: matchingDirectSp.reason,
          targetId: matchingDirectSp.actorId ?? event.actorId ?? null,
          sourceIdentity:
            matchingDirectSp.sourceIdentity ??
            tuningProfile.sourceIdentity ??
            null,
          beforeValue: matchingDirectSp.beforeValue ?? null,
          afterValue: matchingDirectSp.afterValue ?? null,
          change: matchingDirectSp.change ?? null,
        });
      }
    }
  }
  return rows;
}

function projectSourceActionBindingForms(run, scenarioId) {
  const rows = [];
  const seen = new Set();
  for (const evidence of collectActionBindingEvidence(run)) {
    const binding = parseActionBindingIdentity(evidence.sourceIdentity);
    if (
      !binding ||
      binding.controlSkillId === binding.executionControlSkillId
    ) {
      continue;
    }
    const key = `${evidence.actionId}|${binding.ownerId}|${binding.controlSkillId}|${binding.subSkillIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      projectionIdentity:
        'machine-source-action-form:' + scenarioId + ':' + rows.length,
      actionId: evidence.actionId,
      ownerId: binding.ownerId,
      semanticName: binding.actionKind,
      controlSkillId: binding.controlSkillId,
      subSkillIndex: binding.subSkillIndex,
      executionControlSkillId: binding.executionControlSkillId,
      sourceIdentity: evidence.sourceIdentity,
    });
  }
  return rows;
}

function projectSourceHitAliases(run, scenarioId) {
  const rows = [];
  for (const [index, event] of (run.trace?.damage ?? []).entries()) {
    if (
      event.eventType !== 'VERIFIED_COMBAT_HIT' ||
      !event.hitIdentity ||
      typeof event.formula?.sourceIdentity !== 'string'
    ) {
      continue;
    }
    const binding = parseActionBindingIdentity(event.formula.sourceIdentity);
    if (
      !binding ||
      binding.controlSkillId === binding.executionControlSkillId
    ) {
      continue;
    }
    const executionPrefix = `${binding.executionControlSkillId}|${binding.subSkillIndex}|`;
    if (!String(event.hitIdentity).startsWith(executionPrefix)) continue;
    rows.push({
      projectionIdentity:
        'machine-source-hit-alias:' + scenarioId + ':' + index,
      actionId: event.actionId ?? null,
      hitIdentity:
        `${binding.controlSkillId}|${binding.subSkillIndex}|` +
        String(event.hitIdentity).slice(executionPrefix.length),
      executionHitIdentity: event.hitIdentity,
      frame: event.frame ?? null,
      sourceIdentity: event.formula.sourceIdentity,
    });
  }
  return rows;
}

function collectRuntimeExercisedControls(run) {
  const pairs = new Map();
  const add = (controlSkillId, subSkillIndex) => {
    const control = Number(controlSkillId);
    const sub = Number(subSkillIndex);
    if (!Number.isInteger(control) || !Number.isInteger(sub)) return;
    pairs.set(`${control}|${sub}`, [control, sub]);
  };
  for (const selection of run.trace?.variants?.selections ?? []) {
    add(selection.controlSkillId, selection.subSkillIndex);
  }
  for (const event of run.trace?.damage ?? []) {
    const match = String(event.hitIdentity ?? '').match(/^(\d+)\|(\d+)\|/);
    if (match) add(match[1], match[2]);
  }
  for (const evidence of collectActionBindingEvidence(run)) {
    const binding = parseActionBindingIdentity(evidence.sourceIdentity);
    if (!binding) continue;
    add(binding.controlSkillId, binding.subSkillIndex);
    add(binding.executionControlSkillId, binding.subSkillIndex);
  }
  return [...pairs.values()].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1]
  );
}

function collectActionBindingEvidence(run) {
  return [
    ...(run.trace?.damage ?? []).map(event => ({
      actionId: event.actionId ?? null,
      sourceIdentity: event.formula?.sourceIdentity ?? null,
    })),
    ...(run.trace?.events ?? []).map(event => ({
      actionId: event.actionId ?? null,
      sourceIdentity:
        typeof event.payload?.sourceIdentity === 'string'
          ? event.payload.sourceIdentity
          : (event.payload?.sourceIdentity?.actionBindingIdentity ?? null),
    })),
    ...(run.trace?.effects?.events ?? []).map(event => ({
      actionId: event.actionId ?? null,
      sourceIdentity: event.sourceIdentity?.actionBindingIdentity ?? null,
    })),
  ].filter(
    evidence =>
      evidence.actionId != null && typeof evidence.sourceIdentity === 'string'
  );
}

function parseActionBindingIdentity(value) {
  const match = String(value ?? '').match(
    /^actor\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|([^|]+)\|execution-control:(\d+)\|sub:(\d+)$/
  );
  if (!match) return null;
  return {
    ownerId: Number(match[1]),
    publicActionId: Number(match[2]),
    publicVariantIndex: Number(match[3]),
    controlSkillId: Number(match[4]),
    actionKind: match[5],
    executionControlSkillId: Number(match[6]),
    subSkillIndex: Number(match[7]),
  };
}

function matchesRuntimeSourceIdentity(actual, expected) {
  const actualText = String(actual ?? '');
  const expectedText = String(expected ?? '');
  return (
    actualText === expectedText ||
    actualText.startsWith(expectedText + '|charging-release:')
  );
}

function extractBattleElementIds(sourceText) {
  return [
    ...new Set(
      [
        ...String(sourceText).matchAll(/ast_(\d+)\.asset/g),
        ...String(sourceText).matchAll(/elementConfigId=(\d+)/g),
        ...String(sourceText).matchAll(/(?:^|[;|])heal=(\d+)/g),
      ].map(match => Number(match[1]))
    ),
  ].filter(Number.isInteger);
}

function projectCriticalHit(event) {
  if (!event) return null;
  return {
    actionId: event.actionId,
    hitIdentity: event.hitIdentity,
    rawDamage: event.rawDamage,
    randomBranch: event.formula?.randomBranch ?? null,
    expectedCritical: event.formula?.verifiedResult?.expectedCritical ?? null,
  };
}

function inspectRecipeProbe(run, probe) {
  const identity = fallback => probe.assertionIdentity ?? fallback;
  if (probe.kind === 'variant-selection') {
    const selection = (run.trace?.variants?.selections ?? []).find(
      row => row.actionId === probe.actionId
    );
    return {
      identity: identity('probe:variant-selection:' + probe.actionId),
      passed:
        Number(selection?.controlSkillId) === Number(probe.controlSkillId) &&
        Number(selection?.subSkillIndex) === Number(probe.subSkillIndex),
      actual: selection ?? null,
    };
  }
  if (probe.kind === 'special-resource-change') {
    const event = (run.trace?.variants?.resourceEvents ?? []).find(
      row =>
        row.actionId === probe.actionId &&
        row.payload?.resourceIdentity === probe.resourceIdentity &&
        Number(row.payload?.beforeValue) === Number(probe.beforeValue) &&
        Number(row.payload?.afterValue) === Number(probe.afterValue) &&
        Number(row.payload?.change) === Number(probe.change)
    );
    return {
      identity: identity('probe:special-resource-change:' + probe.actionId),
      passed: Boolean(event),
      actual: event ?? null,
    };
  }
  if (probe.kind === 'conditional-hit-group') {
    const group = (run.trace?.state?.conditionalHitGroups ?? []).find(
      row =>
        row.actionId === probe.actionId &&
        row.groupIdentity === probe.groupIdentity
    );
    return {
      identity: identity('probe:conditional-hit-group:' + probe.actionId),
      passed:
        Boolean(group) &&
        Number(group.beforeStacks) === Number(probe.beforeStacks) &&
        Number(group.consumedStacks) === Number(probe.consumedStacks) &&
        Number(group.afterStacks) === Number(probe.afterStacks) &&
        group.applied === probe.applied,
      actual: group ?? null,
    };
  }
  if (probe.kind === 'trace-query') {
    const collection = readPath(run.trace, probe.path);
    const matches = Array.isArray(collection)
      ? collection.filter(row => matchesProbeWhere(row, probe.where ?? {}))
      : [];
    const expectation = probe.expectation ?? {};
    const countPassed =
      (expectation.count == null ||
        matches.length === Number(expectation.count)) &&
      (expectation.minCount == null ||
        matches.length >= Number(expectation.minCount)) &&
      (expectation.maxCount == null ||
        matches.length <= Number(expectation.maxCount));
    const orderedValuesPassed = Object.entries(
      expectation.orderedValues ?? {}
    ).every(
      ([valuePath, expected]) =>
        JSON.stringify(matches.map(row => readPath(row, valuePath))) ===
        JSON.stringify(expected)
    );
    const everyPassed =
      expectation.every == null ||
      matches.every(row => matchesProbeWhere(row, expectation.every));
    const containsPassed = (expectation.contains ?? []).every(expected =>
      matches.some(row => matchesProbeWhere(row, expected))
    );
    const selectedPaths = uniqueStrings([
      ...(probe.select ?? []),
      ...Object.keys(probe.where ?? {}),
      ...Object.keys(expectation.orderedValues ?? {}),
    ]);
    return {
      identity:
        probe.assertionIdentity ??
        'probe:trace-query:' + String(probe.identity),
      passed:
        countPassed && orderedValuesPassed && everyPassed && containsPassed,
      actual: {
        count: matches.length,
        rows: matches.map(row =>
          Object.fromEntries(
            selectedPaths.map(valuePath => [
              valuePath,
              readPath(row, valuePath) ?? null,
            ])
          )
        ),
      },
    };
  }
  if (probe.kind === 'trace-duration') {
    const collection = readPath(run.trace, probe.path);
    const rows = Array.isArray(collection) ? collection : [];
    const starts = rows.filter(row =>
      matchesProbeWhere(row, probe.startWhere ?? {})
    );
    const ends = rows.filter(row =>
      matchesProbeWhere(row, probe.endWhere ?? {})
    );
    const start = probe.startSelection === 'last' ? starts.at(-1) : starts[0];
    const timePath = probe.timePath ?? 'timeMs';
    const startTime = Number(readPath(start, timePath));
    const end = ends.find(row => {
      const endTime = Number(readPath(row, timePath));
      return Number.isFinite(endTime) && endTime >= startTime;
    });
    const endTime = Number(readPath(end, timePath));
    const actualDurationMs = endTime - startTime;
    return {
      identity:
        probe.assertionIdentity ??
        'probe:trace-duration:' + String(probe.identity),
      passed:
        starts.length > 0 &&
        Boolean(end) &&
        Number.isFinite(actualDurationMs) &&
        Math.abs(actualDurationMs - Number(probe.expectedDurationMs)) <= 1e-6,
      actual: {
        startMatchCount: starts.length,
        endMatchCount: ends.length,
        startTimeMs: Number.isFinite(startTime) ? startTime : null,
        endTimeMs: Number.isFinite(endTime) ? endTime : null,
        durationMs: Number.isFinite(actualDurationMs) ? actualDurationMs : null,
      },
    };
  }
  if (probe.kind === 'tuning-hit-gate') {
    const gate = (run.trace?.resources?.tuningAcquisitionGates ?? []).find(
      row =>
        row.actionId === probe.actionId &&
        (probe.groupIdentity == null ||
          row.groupIdentity === probe.groupIdentity)
    );
    const judgment = (run.trace?.state?.tuningConditionalHitGroups ?? []).find(
      row =>
        row.actionId === probe.actionId &&
        row.groupIdentity === probe.groupIdentity &&
        (probe.hitIndex == null ||
          Number(row.hitIndex) === Number(probe.hitIndex))
    );
    const acquisitions = (run.trace?.resources?.tuningMarks ?? []).filter(
      row =>
        row.actionId === probe.actionId &&
        row.kind === 'acquire' &&
        (probe.markId == null || Number(row.markId) === Number(probe.markId))
    );
    const acquisition = acquisitions[0] ?? null;
    const checks = [
      gate != null,
      judgment != null,
      matchesExpected(gate?.passed, probe.expectedGatePassed),
      matchesExpected(gate?.landedCount, probe.expectedLandedCount),
      matchesExpected(judgment?.landed, probe.expectedLanded),
      matchesExpected(judgment?.applied, probe.expectedApplied),
      matchesExpected(judgment?.selectedBranch, probe.expectedBranch),
      matchesExpected(
        judgment?.markCountAtJudgment,
        probe.expectedMarkCountAtJudgment
      ),
      matchesExpected(acquisitions.length, probe.expectedAcquisitionCount),
      matchesExpected(acquisition?.before, probe.expectedBefore),
      matchesExpected(acquisition?.after, probe.expectedAfter),
      matchesExpected(acquisition?.delta, probe.expectedDelta),
      probe.sameFrame !== true ||
        (acquisition != null && acquisition.timeMs === judgment?.timeMs),
    ];
    return {
      identity: identity('probe:tuning-hit-gate:' + probe.actionId),
      passed: checks.every(Boolean),
      actual: { gate, judgment, acquisitions },
    };
  }
  if (probe.kind === 'existing-tuning-mark-acquisition') {
    const gates = (
      run.trace?.resources?.tuningAcquisitionGates ?? []
    ).filter(
      row =>
        row.actionId === probe.actionId &&
        row.gateKind === 'existing-tuning-mark-at-action-start'
    );
    const acquisitions = (run.trace?.resources?.tuningMarks ?? []).filter(
      row => row.actionId === probe.actionId && row.kind === 'acquire'
    );
    const expectedAcquisitions = probe.expectedAcquisitions ?? [];
    const expectedRowsMatch = expectedAcquisitions.every(expected =>
      acquisitions.some(
        row =>
          Number(row.markId) === Number(expected.markId) &&
          Number(row.before) === Number(expected.before) &&
          Number(row.after) === Number(expected.after) &&
          Number(row.delta) === Number(expected.delta)
      )
    );
    const absentRows = acquisitions.filter(row =>
      (probe.absentMarkIds ?? []).some(
        markId => Number(markId) === Number(row.markId)
      )
    );
    const passedGates = gates.filter(row => row.passed === true);
    const failedGates = gates.filter(row => row.passed === false);
    return {
      identity: identity(
        'probe:existing-tuning-mark-acquisition:' + probe.actionId
      ),
      passed:
        expectedRowsMatch &&
        acquisitions.length === expectedAcquisitions.length &&
        absentRows.length === 0 &&
        matchesExpected(
          passedGates.length,
          probe.expectedPassedConditionCount
        ) &&
        matchesExpected(
          failedGates.length,
          probe.expectedFailedConditionCount
        ) &&
        gates.length ===
          Number(probe.expectedPassedConditionCount ?? passedGates.length) +
            Number(probe.expectedFailedConditionCount ?? failedGates.length),
      actual: {
        gates,
        acquisitions,
        absentRows,
      },
    };
  }
  if (probe.kind === 'resource-boundary') {
    const events = run.trace?.variants?.resourceEvents ?? [];
    const exactGain = events.find(
      row =>
        row.actionId === probe.exactActionId &&
        row.payload?.resourceIdentity === probe.resourceIdentity &&
        row.payload?.operation === 'gain' &&
        Number(row.payload?.beforeValue) === Number(probe.beforeValue) &&
        Number(row.payload?.afterValue) === Number(probe.afterValue)
    );
    const threshold = events.find(
      row =>
        row.actionId === probe.exactActionId &&
        row.payload?.resourceIdentity === probe.resourceIdentity &&
        row.payload?.operation === 'threshold-clear'
    );
    const missAction = (run.trace?.actions ?? []).find(
      action => action.id === probe.missActionId
    );
    const missOverride =
      missAction?.hitOverrides?.[probe.missHitIdentity] ?? null;
    const missEvents = events.filter(
      row =>
        row.actionId === probe.missActionId &&
        row.payload?.resourceIdentity === probe.resourceIdentity
    );
    const blockedAction = (run.trace?.actions ?? []).find(
      action => action.id === probe.blockedActionId
    );
    const blockedOverride =
      blockedAction?.hitOverrides?.[probe.blockedHitIdentity] ?? null;
    const blockedEvents = events.filter(
      row =>
        row.actionId === probe.blockedActionId &&
        row.payload?.resourceIdentity === probe.resourceIdentity
    );
    const blockedDamage = (run.trace?.damage ?? []).filter(
      row =>
        row.actionId === probe.blockedActionId &&
        row.hitIdentity === probe.blockedHitIdentity
    );
    const blockedPassed =
      probe.blockedActionId == null ||
      (blockedOverride?.willHit === false &&
        blockedOverride?.landingStatus === 'blocked' &&
        blockedEvents.length === 0 &&
        blockedDamage.length === 0);
    return {
      identity: identity('probe:resource-boundary:' + probe.resourceIdentity),
      passed:
        exactGain != null &&
        threshold != null &&
        missOverride?.willHit === false &&
        missEvents.length === 0 &&
        blockedPassed,
      actual: {
        exactGain,
        threshold,
        missOverride,
        missEvents,
        blockedOverride,
        blockedEvents,
        blockedDamage,
      },
    };
  }
  if (probe.kind === 'special-resource-threshold-boundary') {
    const events = run.trace?.variants?.resourceEvents ?? [];
    const payloadOf = row => row?.payload ?? row ?? {};
    const forAction = actionId =>
      events.filter(row => {
        const payload = payloadOf(row);
        return (
          row.actionId === actionId &&
          payload.resourceIdentity === probe.resourceIdentity
        );
      });
    const exactEvents = forAction(probe.exactActionId);
    const exactGain = exactEvents.find(row => {
      const payload = payloadOf(row);
      return (
        payload.operation === 'gain' &&
        Number(payload.beforeValue) === Number(probe.beforeValue) &&
        Number(payload.afterValue) === Number(probe.afterValue)
      );
    });
    const threshold = exactEvents.find(
      row => payloadOf(row).operation === 'threshold-clear'
    );
    const exactGainIndex = events.indexOf(exactGain);
    const thresholdIndex = events.indexOf(threshold);
    const exactSameFrame =
      exactGain != null &&
      threshold != null &&
      Number(exactGain.timeMs) === Number(threshold.timeMs);
    const insufficientEvents = forAction(probe.insufficientActionId);
    const insufficientGains = insufficientEvents.filter(
      row => payloadOf(row).operation === 'gain'
    );
    const insufficientThresholds = insufficientEvents.filter(
      row => payloadOf(row).operation === 'threshold-clear'
    );
    const thresholdValue = Number(probe.thresholdValue ?? probe.afterValue);
    const insufficientBelowThreshold =
      insufficientGains.length > 0 &&
      insufficientGains.every(
        row => Number(payloadOf(row).afterValue) < thresholdValue
      );
    return {
      identity: identity(
        'probe:special-resource-threshold-boundary:' + probe.resourceIdentity
      ),
      passed:
        exactGain != null &&
        threshold != null &&
        exactGainIndex >= 0 &&
        thresholdIndex > exactGainIndex &&
        exactSameFrame &&
        insufficientBelowThreshold &&
        insufficientThresholds.length === 0,
      actual: {
        exactGain,
        threshold,
        exactGainIndex,
        thresholdIndex,
        exactSameFrame,
        insufficientGains,
        insufficientThresholds,
        thresholdValue,
      },
    };
  }
  if (probe.kind === 'tuning-mark-expiry-boundary') {
    const events = (run.trace?.resources?.tuningMarks ?? []).filter(
      row => Number(row.markId) === Number(probe.markId)
    );
    const acquisition = events.find(
      row => row.actionId === probe.actionId && row.kind === 'acquire'
    );
    const sameFrame = acquisition
      ? events.filter(row => row.timeMs === acquisition.timeMs)
      : [];
    const expiryIndex = sameFrame.findIndex(row => row.kind === 'expire');
    const acquisitionIndex = sameFrame.findIndex(row => row === acquisition);
    const expiry = expiryIndex >= 0 ? sameFrame[expiryIndex] : null;
    const eventOrdinal = row => {
      const match = String(row?.eventIdentity ?? '').match(/\|(\d+)$/);
      return match ? Number(match[1]) : null;
    };
    const expiryOrdinal = eventOrdinal(expiry);
    const acquisitionOrdinal = eventOrdinal(acquisition);
    const expiryPrecedesAcquisition =
      Number.isInteger(expiryOrdinal) && Number.isInteger(acquisitionOrdinal)
        ? expiryOrdinal < acquisitionOrdinal
        : acquisitionIndex > expiryIndex;
    return {
      identity: identity('probe:tuning-mark-expiry-boundary:' + probe.actionId),
      passed:
        acquisition != null &&
        Number(acquisition.frameIndex) === Number(probe.expectedFrame) &&
        expiryIndex >= 0 &&
        expiryPrecedesAcquisition &&
        Number(expiry?.before) === Number(probe.expectedExpireBefore) &&
        Number(expiry?.after) === Number(probe.expectedExpireAfter) &&
        Number(acquisition.before) === Number(probe.expectedAcquireBefore) &&
        Number(acquisition.after) === Number(probe.expectedAcquireAfter),
      actual: {
        expiry,
        acquisition,
        sameFrame,
        expiryOrdinal,
        acquisitionOrdinal,
        expiryPrecedesAcquisition,
      },
    };
  }
  if (probe.kind === 'controlled-actor-companion-switch') {
    const transition = (run.trace?.controlledActors?.transitions ?? []).find(
      row => row.actionId === probe.switchActionId && row.applied === true
    );
    const despawn = (run.trace?.variants?.companionEvents ?? []).find(
      row =>
        row.type === 'VERIFIED_COMPANION_DESPAWN' &&
        row.actionId === probe.switchActionId &&
        row.payload?.reason === 'controlled-character-switched'
    );
    const revision = despawn?.payload?.companionRevision;
    const attacksAfter = (run.trace?.variants?.companionAttacks ?? []).filter(
      row =>
        Number(row.companionRevision) === Number(revision) &&
        Number(row.timeMs) >= Number(despawn?.timeMs)
    );
    return {
      identity: identity(
        'probe:controlled-actor-companion-switch:' + probe.switchActionId
      ),
      passed:
        transition != null &&
        despawn != null &&
        transition.timeMs === despawn.timeMs &&
        matchesExpected(transition.beforeActorId, probe.beforeActorId) &&
        matchesExpected(transition.afterActorId, probe.afterActorId) &&
        attacksAfter.length === 0,
      actual: { transition, despawn, attacksAfter },
    };
  }
  if (probe.kind === 'tuning-conditional-group') {
    const groups = (run.trace?.state?.tuningConditionalHitGroups ?? []).filter(
      row =>
        row.actionId === probe.actionId &&
        row.groupIdentity === probe.groupIdentity
    );
    return {
      identity: identity('probe:tuning-conditional-group:' + probe.actionId),
      passed:
        matchesExpected(groups.length, probe.expectedCount) &&
        groups.every(
          row =>
            matchesExpected(row.selectedBranch, probe.expectedBranch) &&
            matchesExpected(
              row.markCountAtJudgment,
              probe.expectedMarkCountAtJudgment
            ) &&
            matchesExpected(row.landed, probe.expectedLanded) &&
            matchesExpected(row.companionUnitId, probe.companionUnitId) &&
            matchesExpected(row.ownership, probe.ownership)
        ),
      actual: groups,
    };
  }
  if (probe.kind === 'companion-lifecycle') {
    const events = run.trace?.variants?.companionEvents ?? [];
    const summon = events.find(
      row =>
        row.type === 'VERIFIED_COMPANION_SUMMON' &&
        row.actionId === probe.summonActionId
    );
    const revision = summon?.payload?.companionRevision;
    const periodic = events.filter(
      row =>
        row.type === 'VERIFIED_COMPANION_PERIODIC' &&
        Number(row.payload?.companionRevision) === Number(revision)
    );
    const despawn = events.find(
      row =>
        row.type === 'VERIFIED_COMPANION_DESPAWN' &&
        Number(row.payload?.companionRevision) === Number(revision)
    );
    const attacks = (run.trace?.variants?.companionAttacks ?? []).filter(
      row =>
        Number(row.companionRevision) === Number(revision) &&
        row.attackKind === 'periodic'
    );
    const periodicTimes = periodic.map(row => Number(row.timeMs));
    const cadenceMatches = periodicTimes
      .slice(1)
      .every(
        (timeMs, index) =>
          timeMs - periodicTimes[index] === Number(probe.cadenceMs)
      );
    return {
      identity: identity('probe:companion-lifecycle:' + probe.summonActionId),
      passed:
        summon != null &&
        matchesExpected(
          Number(summon.payload?.endsAtMs) - Number(summon.timeMs),
          probe.durationMs
        ) &&
        matchesExpected(periodic.length, probe.periodicCount) &&
        cadenceMatches &&
        matchesExpected(attacks.length, probe.attackCount) &&
        attacks.every(
          row =>
            matchesExpected(row.companionUnitId, probe.companionUnitId) &&
            matchesExpected(row.ownership, probe.ownership) &&
            matchesExpected(row.targetKind, probe.targetKind)
        ) &&
        despawn?.payload?.reason === 'duration-expired' &&
        Number(despawn?.timeMs) === Number(summon.payload?.endsAtMs) &&
        attacks.every(row => Number(row.timeMs) < Number(despawn.timeMs)),
      actual: { summon, periodic, attacks, despawn },
    };
  }
  if (probe.kind === 'companion-action-response') {
    const action = (run.trace?.actions ?? []).find(
      row => row.id === probe.actionId
    );
    const attacks = (run.trace?.variants?.companionAttacks ?? []).filter(
      row =>
        row.actionId === probe.actionId &&
        row.attackIdentity === probe.attackIdentity
    );
    const revision = attacks[0]?.companionRevision;
    const events = run.trace?.variants?.companionEvents ?? [];
    const despawn = events.find(
      row =>
        row.type === 'VERIFIED_COMPANION_DESPAWN' &&
        row.actionId === probe.actionId &&
        Number(row.payload?.companionRevision) === Number(revision)
    );
    const periodicDuringResponse = events.filter(
      row =>
        row.type === 'VERIFIED_COMPANION_PERIODIC' &&
        Number(row.payload?.companionRevision) === Number(revision) &&
        Number(row.timeMs) >= Number(action?.startMs) &&
        Number(row.timeMs) <= Number(despawn?.timeMs)
    );
    const expectedOffsetMs =
      Number(probe.despawnOffsetFrames) *
      (1000 / Number(run.trace?.scenario?.frameRate ?? 60));
    return {
      identity: identity('probe:companion-action-response:' + probe.actionId),
      passed:
        action != null &&
        matchesExpected(attacks.length, probe.attackCount) &&
        despawn?.payload?.reason === probe.despawnReason &&
        Math.abs(
          Number(despawn?.timeMs) - Number(action.startMs) - expectedOffsetMs
        ) < 0.000001 &&
        periodicDuringResponse.length === 0,
      actual: { action, attacks, despawn, periodicDuringResponse },
    };
  }
  if (probe.kind === 'conditional-group-interruption') {
    const groups = (run.trace?.state?.tuningConditionalHitGroups ?? []).filter(
      row => row.actionId === probe.actionId
    );
    return {
      identity: identity(
        'probe:conditional-group-interruption:' + probe.actionId
      ),
      passed:
        matchesExpected(groups.length, probe.expectedCount) &&
        !groups.some(row => row.groupIdentity === probe.forbiddenGroupIdentity),
      actual: groups,
    };
  }
  return {
    identity: identity('probe:unsupported:' + String(probe.kind)),
    passed: false,
    actual: null,
  };
}

function matchesExpected(actual, expected) {
  return expected === undefined || actual === expected;
}

function createAcceptanceReport(manifests, visualRuns, catalog, manifestIndex) {
  const value = {
    schemaVersion: 1,
    kind: 'm11-d-character-acceptance-protocol-report',
    baselineCommit: '308dd07fbbb8fe0759062e9dcc02c65b0fd46115',
    status: 'r1-implementation-complete-awaiting-product-acceptance',
    protocolIdentity: 'm11-d-character-acceptance-v1',
    optimizationScenarioPolicy: structuredClone(
      catalog.optimizationScenarioPolicy
    ),
    optimizationCandidateRoster: structuredClone(
      catalog.optimizationCandidateRoster
    ),
    productScenarioExcludedCharacters: structuredClone(
      catalog.productScenarioExcludedCharacters
    ),
    r1: {
      baseCommit: '5add67feb2a0ced22453df78d1408312a9e33fdb',
      status: 'implementation-complete-awaiting-product-acceptance',
      trustModel: 'repo-local-derived-source-of-truth',
      derivation: {
        requirementInventory: 'source-contract-derived',
        scenarioCases: 'canonical-replay-derived',
        coverageEdges: 'selector-and-assertion-derived',
        ledger: 'deduplicated-source-and-acceptance-gaps',
        publication: 'committed-manifest-index-bound',
      },
      verification: {
        focusedVitest: '4 files / 28 tests passed',
        characterAcceptanceAudit: 'clean',
        existingSixAudits: 'clean',
        productionBuild: 'passed',
        focusedProductionE2E: '1/1 passed',
      },
    },
    owners: manifests.map(manifest => {
      const visualRun = visualRuns.find(run =>
        run.fixturePath.includes(String(manifest.owner.ownerId))
      );
      return {
        ownerId: manifest.owner.ownerId,
        ownerName: manifest.owner.ownerName,
        maturityState: manifest.maturity.currentState,
        optimizationReady: manifest.maturity.optimizationReady,
        blockers: manifest.maturity.blockers,
        blockingLedgerCount: manifest.ledger.summary.uniqueBlockingCount,
        sourceGapCount: manifest.ledger.summary.sourceGapCount,
        acceptanceGapCount: manifest.ledger.summary.acceptanceGapCount,
        nonBlockingSourceCount: manifest.ledger.summary.nonBlockingCount,
        matrix: manifest.matrix.summary,
        manifestHash: manifest.manifestHash,
        sourceOfTruthHash: manifest.derivation.sourceOfTruthHash,
        machineScenario: visualRun?.canonicalHashes ?? null,
      };
    }),
    catalogHash: catalog.catalogHash,
    manifestIndexHash: manifestIndex.indexHash,
    summary: {
      ownerCount: manifests.length,
      formalCharacterDenominator: catalog.summary.formalCharacterDenominator,
      productScenarioExcludedCharacterCount:
        catalog.summary.productScenarioExcludedCharacterCount,
      runtimeIntegratedCount: manifests.filter(manifest =>
        manifest.maturity.earnedStates.includes('runtime-integrated')
      ).length,
      visuallyAcceptedCount: manifests.filter(manifest =>
        manifest.maturity.earnedStates.includes('visually-accepted')
      ).length,
      optimizationReadyCount: manifests.filter(
        manifest => manifest.maturity.optimizationReady
      ).length,
      machineScenarioPassCount: visualRuns.filter(
        run => run.status === 'passed'
      ).length,
      workbenchRoundTripPassCount: visualRuns.filter(
        run => run.workbenchRoundTrip === 'passed'
      ).length,
      sourceGapCount: manifests.reduce(
        (sum, manifest) => sum + manifest.ledger.summary.sourceGapCount,
        0
      ),
      acceptanceGapCount: manifests.reduce(
        (sum, manifest) => sum + manifest.ledger.summary.acceptanceGapCount,
        0
      ),
      nonBlockingSourceCount: manifests.reduce(
        (sum, manifest) => sum + manifest.ledger.summary.nonBlockingCount,
        0
      ),
      functionalBlockers: manifests.reduce(
        (sum, manifest) => sum + manifest.ledger.summary.uniqueBlockingCount,
        0
      ),
      performanceAndBundleRisksBlocking: false,
    },
  };
  return value;
}

function createOutputs(
  manifests,
  catalog,
  manifestIndex,
  report,
  { ownerOnly = false } = {}
) {
  const outputs = new Map();
  outputs.set(generatedCatalogPath, jsonText(catalog));
  outputs.set(generatedManifestIndexPath, jsonText(manifestIndex));
  outputs.set(path.join(reportRoot, 'summary.json'), jsonText(report));
  outputs.set(
    path.join(reportRoot, 'summary.md'),
    createMarkdownReport(report)
  );
  addOwnerOutputs(outputs, manifests);
  return outputs;
}

function createOwnerOutputs(manifests) {
  const outputs = new Map();
  addOwnerOutputs(outputs, manifests);
  return outputs;
}

function addOwnerOutputs(outputs, manifests) {
  for (const manifest of manifests) {
    const ownerRoot = path.join(reportRoot, String(manifest.owner.ownerId));
    outputs.set(path.join(ownerRoot, 'manifest.json'), jsonText(manifest));
    outputs.set(
      path.join(ownerRoot, 'requirement-inventory.json'),
      jsonText(manifest.requirementInventory)
    );
    outputs.set(
      path.join(ownerRoot, 'source-gap-inventory.json'),
      jsonText(manifest.sourceGapInventory)
    );
    outputs.set(
      path.join(ownerRoot, 'scenario-cases.json'),
      jsonText(manifest.scenarioCases)
    );
    outputs.set(
      path.join(ownerRoot, 'scenario-matrix.json'),
      jsonText(manifest.matrix)
    );
    outputs.set(
      path.join(ownerRoot, 'coverage.json'),
      jsonText(manifest.coverage)
    );
    outputs.set(
      path.join(ownerRoot, 'ledger.json'),
      jsonText({
        ...manifest.ledger,
        notApplicableRecords: manifest.notApplicableRecords,
      })
    );
  }
}

async function writeOutputs(outputs) {
  for (const [outputPath, content] of outputs) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
  }
}

async function assertOutputsClean(outputs) {
  const stale = [];
  for (const [outputPath, expected] of outputs) {
    let actual = null;
    try {
      actual = await fs.readFile(outputPath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (actual !== expected)
      stale.push(path.relative(projectRoot, outputPath).replaceAll('\\', '/'));
  }
  if (stale.length)
    throw new Error(
      'Character acceptance outputs are stale: ' + stale.join(', ')
    );
}

async function loadRecipes(ownerId = null) {
  const names = (await fs.readdir(recipeRoot))
    .filter(name => name.endsWith('.json'))
    .sort();
  const recipes = await Promise.all(
    names.map(name => readJson(path.join(recipeRoot, name)))
  );
  const selected =
    ownerId == null
      ? recipes
      : recipes.filter(recipe => Number(recipe.ownerId) === ownerId);
  if (ownerId != null && selected.length !== 1) {
    throw new Error(
      'Character acceptance owner recipe must match exactly once: ' + ownerId
    );
  }
  return selected;
}

function inspectNegativeActionCase(service, fixture, negativeCase) {
  const contract = structuredClone(fixture);
  for (const resourceOverride of negativeCase.initialActorResources ?? []) {
    const member = contract.scenario?.team?.find(
      candidate =>
        String(candidate.slotId ?? '') === String(resourceOverride.slotId ?? '')
    );
    if (!member) continue;
    if (Number.isFinite(Number(resourceOverride.initialSp))) {
      member.initialSp = Number(resourceOverride.initialSp);
    }
  }
  if (Array.isArray(negativeCase.actions)) {
    contract.actions = structuredClone(negativeCase.actions);
  } else {
    contract.actions.push(structuredClone(negativeCase.action));
  }
  if (Number.isInteger(Number(negativeCase.durationFrames))) {
    contract.scenario.durationFrames = Number(negativeCase.durationFrames);
  }
  contract.scenario.id += '--negative--' + String(negativeCase.identity);
  const validation = service.validate(contract);
  const expected = negativeCase.expectedIssue ?? {};
  const issue = (validation.issues ?? []).find(actual =>
    Object.entries(expected).every(([key, value]) => {
      if (key === 'violationCode') {
        return (actual.violationCodes ?? []).includes(value);
      }
      return Object.is(actual[key], value);
    })
  );
  const requiredExecutableActionIds = new Set(
    (negativeCase.requiredExecutableActionIds ?? []).map(String)
  );
  const prerequisiteIssues = (validation.issues ?? []).filter(actual =>
    requiredExecutableActionIds.has(String(actual.actionId ?? ''))
  );
  const baselineRequiredExecutableActionIds = new Set(
    (negativeCase.baselineRequiredExecutableActionIds ?? []).map(String)
  );
  const baselineValidation = service.validate(fixture);
  const baselinePrerequisiteIssues = (baselineValidation.issues ?? []).filter(
    actual =>
      baselineRequiredExecutableActionIds.has(String(actual.actionId ?? ''))
  );
  const baselineMissingActionIds = [
    ...baselineRequiredExecutableActionIds,
  ].filter(
    actionId =>
      !(fixture.actions ?? []).some(
        action => String(action.id ?? '') === actionId
      )
  );
  return {
    identity:
      negativeCase.assertionIdentity ??
      'negative:' + String(negativeCase.identity),
    passed:
      validation.valid === false &&
      Boolean(issue) &&
      prerequisiteIssues.length === 0 &&
      baselineValidation.valid === true &&
      baselinePrerequisiteIssues.length === 0 &&
      baselineMissingActionIds.length === 0 &&
      validation.hashes?.trace != null,
    actual: {
      issue: issue ?? null,
      initialActorResources: structuredClone(
        negativeCase.initialActorResources ?? []
      ),
      requiredExecutableActionIds: [...requiredExecutableActionIds],
      prerequisiteIssues,
      baselineRequiredExecutableActionIds: [
        ...baselineRequiredExecutableActionIds,
      ],
      baselinePrerequisiteIssues,
      baselineMissingActionIds,
      baselineCanonicalHashes: baselineValidation.hashes,
      canonicalHashes: validation.hashes,
      classification: validation.classification,
    },
  };
}

function inspectIsolatedActionCase(service, fixture, isolatedCase, profile) {
  const contract = structuredClone(fixture);
  contract.actions = structuredClone(isolatedCase.actions ?? []);
  contract.scenario.id += '--isolated--' + String(isolatedCase.identity);
  contract.scenario.durationFrames = Number(
    isolatedCase.durationFrames ?? fixture.scenario.durationFrames
  );
  for (const key of [
    'team',
    'initialRuntimeState',
    'enemy',
    'target',
    'critical',
    'projectile',
  ]) {
    if (isolatedCase[key] != null) {
      contract.scenario[key] = structuredClone(isolatedCase[key]);
    }
  }
  const validation = service.validate(contract);
  if (!validation.valid) {
    return {
      identity:
        isolatedCase.assertionIdentity ??
        'isolated:' + String(isolatedCase.identity),
      passed: false,
      actual: { validation },
    };
  }
  const first = service.simulate(contract);
  const second = service.simulate(contract);
  const probeResults = (isolatedCase.probes ?? []).map(probe =>
    inspectRecipeProbe(first, probe)
  );
  return {
    identity:
      isolatedCase.assertionIdentity ??
      'isolated:' + String(isolatedCase.identity),
    passed:
      sameHashes(first.hashes, second.hashes) &&
      probeResults.every(result => result.passed),
    actual: {
      canonicalHashes: first.hashes,
      stableReplay: sameHashes(first.hashes, second.hashes),
      probeResults,
      traceProjection: createIsolatedMachineTraceProjection({
        run: first,
        profile,
        scenarioId: contract.scenario.id,
      }),
    },
  };
}

function createExistingTuningMarkAcceptanceCases(definition) {
  if (definition == null) return [];
  const profiles = (definition.markProfiles ?? []).map(profile => ({
    markId: Number(profile.markId),
    profileKey: String(profile.profileKey ?? ''),
    elementName: String(profile.elementName ?? ''),
  }));
  const expectedProfileCount = Number(definition.expectedProfileCount);
  const maximumStacks = Number(definition.maximumStacks);
  const ownerId = Number(definition.ownerId);
  const sourceActorId = String(definition.sourceActorId ?? '');
  const ultimatePublicActionId = Number(
    definition.ultimate?.publicActionId
  );
  const ultimateStackDelta = Number(definition.ultimate?.stackDelta);
  const starCarryStackDelta = Number(definition.starCarry?.stackDelta);
  const switchTargetSlotId = String(
    definition.starCarry?.switchTargetSlotId ?? ''
  );
  const sourceIdentity = String(definition.sourceIdentity ?? '').trim();
  const profileKeySet = new Set(profiles.map(profile => profile.profileKey));
  const profileIdSet = new Set(profiles.map(profile => profile.markId));
  if (
    !Number.isInteger(ownerId) ||
    ownerId <= 0 ||
    sourceActorId !== `actor-${ownerId}` ||
    !Number.isInteger(expectedProfileCount) ||
    expectedProfileCount <= 0 ||
    profiles.length !== expectedProfileCount ||
    profileKeySet.size !== expectedProfileCount ||
    profileIdSet.size !== expectedProfileCount ||
    profiles.some(
      profile =>
        !Number.isInteger(profile.markId) ||
        profile.markId <= 0 ||
        !profile.profileKey ||
        !profile.elementName
    ) ||
    !Number.isInteger(maximumStacks) ||
    maximumStacks <= 0 ||
    !Number.isInteger(ultimatePublicActionId) ||
    ultimatePublicActionId <= 0 ||
    !Number.isInteger(ultimateStackDelta) ||
    ultimateStackDelta <= 0 ||
    !Number.isInteger(starCarryStackDelta) ||
    starCarryStackDelta <= 0 ||
    !switchTargetSlotId ||
    !sourceIdentity
  ) {
    throw new Error(
      `existing tuning mark acceptance definition invalid: ${ownerId || 'missing'}`
    );
  }
  const normalizeCounts = rawCounts => {
    const counts = Object.fromEntries(
      profiles.map(profile => [profile.profileKey, 0])
    );
    for (const [profileKey, rawCount] of Object.entries(rawCounts ?? {})) {
      const count = Number(rawCount);
      if (
        !profileKeySet.has(profileKey) ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > maximumStacks
      ) {
        throw new Error(
          `existing tuning mark acceptance count invalid: ${ownerId}/${profileKey}`
        );
      }
      counts[profileKey] = count;
    }
    return counts;
  };
  const createInitialRuntimeState = rawCounts => {
    const counts = normalizeCounts(rawCounts);
    return {
      specialResourcesByActor: [],
      kiboEnergyBySlot: [],
      tuningMarks: profiles.flatMap(profile => {
        const count = counts[profile.profileKey];
        if (count === 0) return [];
        return [
          {
            markId: profile.markId,
            profileKey: profile.profileKey,
            elementName: profile.elementName,
            decayRemainingMs: 30_000,
            heldReadyRemainingMs: 0,
            layers: Array.from({ length: count }, (_, index) => ({
              sourceActionId:
                `existing-mark-fixture-${ownerId}-${profile.profileKey}-${index + 1}`,
              sourceActorId,
              sourceIdentity: {
                contract: sourceIdentity,
                profileKey: profile.profileKey,
                layer: index + 1,
              },
            })),
          },
        ];
      }),
      activeEffects: [],
    };
  };
  const createProbe = ({ actionId, rawCounts, stackDelta }) => {
    const counts = normalizeCounts(rawCounts);
    const present = profiles.filter(profile => counts[profile.profileKey] > 0);
    return {
      kind: 'existing-tuning-mark-acquisition',
      assertionIdentity: `existing-tuning-mark-acquisition:${actionId}`,
      actionId,
      expectedAcquisitions: present.map(profile => {
        const before = counts[profile.profileKey];
        const after = Math.min(maximumStacks, before + stackDelta);
        return {
          markId: profile.markId,
          before,
          after,
          delta: after - before,
        };
      }),
      absentMarkIds: profiles
        .filter(profile => counts[profile.profileKey] === 0)
        .map(profile => profile.markId),
      expectedPassedConditionCount: present.length,
      expectedFailedConditionCount: profiles.length - present.length,
    };
  };
  const createUltimateAction = (actionId, frame = 0) => ({
    id: actionId,
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId: ultimatePublicActionId,
      actionKind: 'ultimate',
      level: 1,
    },
    schedule: { mode: 'absolute', frame },
  });
  const createSwitchAction = ({ actionId, ownerSlotId, targetSlotId, frame }) =>
    ({
      id: actionId,
      owner: { kind: 'actor', slotId: ownerSlotId },
      intent: { kind: 'switch', targetSlotId },
      schedule: { mode: 'absolute', frame },
    });
  const derivedStarCarryActionId = switchActionId =>
    `${switchActionId}--on-exit--${sourceActorId}--star-carry`;
  const mixedCounts = normalizeCounts(definition.mixedInitialCounts);
  const allPresentCounts = Object.fromEntries(
    profiles.map(profile => [profile.profileKey, 1])
  );
  const capProfileKey = String(definition.capProfileKey ?? '');
  if (!profileKeySet.has(capProfileKey)) {
    throw new Error(
      `existing tuning mark acceptance cap profile invalid: ${ownerId}/${capProfileKey}`
    );
  }
  const capCounts = { [capProfileKey]: maximumStacks };
  const zeroUltimateActionId = `${ownerId}-existing-mark-ultimate-zero`;
  const zeroSwitchActionId = `${ownerId}-existing-mark-star-carry-zero-switch`;
  const mixedUltimateActionId = `${ownerId}-existing-mark-ultimate-mixed`;
  const mixedSwitchActionId = `${ownerId}-existing-mark-star-carry-mixed-switch`;
  const allPresentSwitchActionId = `${ownerId}-existing-mark-all-present-switch`;
  const allPresentUltimateActionId = `${ownerId}-existing-mark-all-present-ultimate`;
  const capSwitchActionId = `${ownerId}-existing-mark-cap-switch`;
  const capReturnActionId = `${ownerId}-existing-mark-cap-return`;
  const capUltimateActionId = `${ownerId}-existing-mark-cap-ultimate`;
  return [
    {
      identity: 'existing-tuning-mark-ultimate-all-zero',
      durationFrames: 400,
      initialRuntimeState: createInitialRuntimeState({}),
      actions: [createUltimateAction(zeroUltimateActionId)],
      probes: [
        createProbe({
          actionId: zeroUltimateActionId,
          rawCounts: {},
          stackDelta: ultimateStackDelta,
        }),
      ],
    },
    {
      identity: 'existing-tuning-mark-star-carry-all-zero',
      durationFrames: 400,
      initialRuntimeState: createInitialRuntimeState({}),
      actions: [
        createSwitchAction({
          actionId: zeroSwitchActionId,
          ownerSlotId: 'slot-1',
          targetSlotId: switchTargetSlotId,
          frame: 0,
        }),
      ],
      probes: [
        createProbe({
          actionId: derivedStarCarryActionId(zeroSwitchActionId),
          rawCounts: {},
          stackDelta: starCarryStackDelta,
        }),
      ],
    },
    {
      identity: 'existing-tuning-mark-ultimate-mixed-and-cap-four',
      durationFrames: 400,
      initialRuntimeState: createInitialRuntimeState(mixedCounts),
      actions: [createUltimateAction(mixedUltimateActionId)],
      probes: [
        createProbe({
          actionId: mixedUltimateActionId,
          rawCounts: mixedCounts,
          stackDelta: ultimateStackDelta,
        }),
      ],
    },
    {
      identity: 'existing-tuning-mark-star-carry-mixed',
      durationFrames: 400,
      initialRuntimeState: createInitialRuntimeState(mixedCounts),
      actions: [
        createSwitchAction({
          actionId: mixedSwitchActionId,
          ownerSlotId: 'slot-1',
          targetSlotId: switchTargetSlotId,
          frame: 0,
        }),
      ],
      probes: [
        createProbe({
          actionId: derivedStarCarryActionId(mixedSwitchActionId),
          rawCounts: mixedCounts,
          stackDelta: starCarryStackDelta,
        }),
      ],
    },
    {
      identity: 'existing-tuning-mark-all-nine-present-star-carry',
      durationFrames: 400,
      initialRuntimeState: createInitialRuntimeState(allPresentCounts),
      actions: [
        createSwitchAction({
          actionId: allPresentSwitchActionId,
          ownerSlotId: 'slot-1',
          targetSlotId: switchTargetSlotId,
          frame: 0,
        }),
      ],
      probes: [
        createProbe({
          actionId: derivedStarCarryActionId(allPresentSwitchActionId),
          rawCounts: allPresentCounts,
          stackDelta: starCarryStackDelta,
        }),
      ],
    },
    {
      identity: 'existing-tuning-mark-all-nine-present-ultimate',
      durationFrames: 400,
      initialRuntimeState: createInitialRuntimeState(allPresentCounts),
      actions: [createUltimateAction(allPresentUltimateActionId)],
      probes: [
        createProbe({
          actionId: allPresentUltimateActionId,
          rawCounts: allPresentCounts,
          stackDelta: ultimateStackDelta,
        }),
      ],
    },
    {
      identity: 'existing-tuning-mark-cap-five-both-actions',
      durationFrames: 700,
      initialRuntimeState: createInitialRuntimeState(capCounts),
      actions: [
        createSwitchAction({
          actionId: capSwitchActionId,
          ownerSlotId: 'slot-1',
          targetSlotId: switchTargetSlotId,
          frame: 0,
        }),
        createSwitchAction({
          actionId: capReturnActionId,
          ownerSlotId: switchTargetSlotId,
          targetSlotId: 'slot-1',
          frame: 100,
        }),
        createUltimateAction(capUltimateActionId, 200),
      ],
      probes: [
        createProbe({
          actionId: derivedStarCarryActionId(capSwitchActionId),
          rawCounts: capCounts,
          stackDelta: starCarryStackDelta,
        }),
        createProbe({
          actionId: capUltimateActionId,
          rawCounts: capCounts,
          stackDelta: ultimateStackDelta,
        }),
      ],
    },
  ];
}

function createIsolatedMachineTraceProjection({ run, profile, scenarioId }) {
  const selectionRows = run.trace?.variants?.selections ?? [];
  const selectionByActionId = new Map(
    selectionRows.map(selection => [String(selection.actionId), selection])
  );
  const withActionCoordinate = row => {
    const selection = selectionByActionId.get(String(row?.actionId ?? ''));
    return selection
      ? {
          ...row,
          controlSkillId: selection.controlSkillId,
          subSkillIndex: selection.subSkillIndex,
        }
      : row;
  };
  const resourceBackedEffects = projectResourceBackedEffects(run, scenarioId);
  const appliedEffectSourceElements = projectAppliedEffectSourceElements(
    run,
    scenarioId
  );
  const tuningComponentEffects = projectVerifiedTuningComponentEffects(
    run,
    scenarioId
  );
  const tuningJudgmentEffects = projectVerifiedTuningJudgmentEffects(
    run,
    profile,
    scenarioId
  );
  const verifiedDirectEffectSources = projectVerifiedDirectEffectSources(
    run,
    scenarioId
  );
  const tuningMarkResourceEffects = projectTuningMarkResourceEffects(
    run,
    profile,
    scenarioId
  );
  const runtimeEffectEvidence = projectCharacterRuntimeEffectEvidence(
    run,
    profile,
    scenarioId
  );
  const observedEffectIds = [
    ...(run.trace?.effects?.events ?? []).map(event => event.effectId),
    ...resourceBackedEffects.map(event => event.effectIdentity),
    ...appliedEffectSourceElements.map(event => event.effectIdentity),
    ...tuningComponentEffects.map(event => event.effectIdentity),
    ...tuningJudgmentEffects.map(event => event.effectIdentity),
    ...verifiedDirectEffectSources.map(event => event.effectIdentity),
    ...tuningMarkResourceEffects.map(event => event.effectIdentity),
    ...runtimeEffectEvidence.map(event => event.effectIdentity),
  ];
  const profileRows = createScenarioProfileProjectionRows({
    profile,
    exercisedControls: collectRuntimeExercisedControls(run),
    exercisedFromHitAndEffectIdentities: [
      ...(run.trace?.damage ?? []).map(event => event.hitIdentity),
      ...(run.trace?.effects?.events ?? []).map(event => event.effectId),
    ],
    observedEffectIds,
    observedResourceEvents: run.trace?.variants?.resourceEvents ?? [],
    observedVariantSelections: selectionRows,
    scenarioId,
    prefix: 'machine-isolated',
  });
  return {
    actionForms: selectionRows.map(selection => ({
      projectionIdentity:
        'machine-isolated-action-form:' +
        scenarioId +
        ':' +
        selection.actionId,
      actionId: selection.actionId,
      ownerId: selection.ownerId,
      semanticName: selection.semanticName,
      controlSkillId: selection.controlSkillId,
      subSkillIndex: selection.subSkillIndex,
      actualDurationFrames: selection.actualDurationFrames,
    })),
    hits: (run.trace?.damage ?? [])
      .filter(event => event.hitIdentity)
      .map((event, index) => ({
        projectionIdentity:
          'machine-isolated-hit:' + scenarioId + ':' + index,
        actionId: event.actionId ?? null,
        hitIdentity: event.hitIdentity,
        frame: event.frame ?? null,
        absoluteFrame: event.absoluteFrame ?? null,
        sourceSequencePath: event.sourceSequencePath ?? null,
      })),
    effects: [
      ...(run.trace?.effects?.events ?? []).map((event, index) => ({
        projectionIdentity:
          'machine-isolated-effect:' + scenarioId + ':' + index,
        actionId: event.actionId ?? null,
        effectIdentity: event.effectId ?? event.runtimeEffectId ?? null,
        operation: event.operation ?? null,
        targetId: event.targetId ?? null,
        absoluteFrame: event.absoluteFrame ?? null,
        frameIndex:
          event.frameIndex ?? event.absoluteFrame ?? event.frame ?? null,
        timeMs: event.timeMs ?? null,
        expiresAtMs: event.expiresAtMs ?? null,
        durationFrames: event.durationFrames ?? null,
        expiresAtFrame: event.expiresAtFrame ?? event.expireFrame ?? null,
        sourceIdentity: event.sourceIdentity ?? null,
        modifiers: structuredClone(event.modifiers ?? []),
      })),
      ...(run.trace?.damage ?? [])
        .filter(event => Number.isInteger(Number(event.elementId)))
        .map((event, index) => ({
          projectionIdentity:
            'machine-isolated-damage-effect:' + scenarioId + ':' + index,
          actionId: event.actionId ?? null,
          effectIdentity: 'battle-element:' + Number(event.elementId),
          operation: 'damage',
          targetId: event.targetId ?? null,
          sourceSequencePath: Array.isArray(event.sourceSequencePath)
            ? [...event.sourceSequencePath]
            : null,
        })),
      ...tuningComponentEffects,
      ...tuningJudgmentEffects,
      ...resourceBackedEffects,
      ...appliedEffectSourceElements,
      ...verifiedDirectEffectSources,
      ...tuningMarkResourceEffects,
      ...runtimeEffectEvidence,
    ].map(withActionCoordinate),
    resources: (run.trace?.variants?.resourceEvents ?? []).map(
      (event, index) => ({
        projectionIdentity:
          'machine-isolated-resource:' + scenarioId + ':' + index,
        actionId: event.actionId ?? null,
        resourceIdentity: event.payload?.resourceIdentity ?? null,
        operation: event.payload?.operation ?? event.type ?? null,
        absoluteFrame: event.absoluteFrame ?? null,
        beforeValue: event.payload?.beforeValue ?? null,
        change: event.payload?.change ?? null,
        afterValue: event.payload?.afterValue ?? null,
      })
    ),
    criticalDecisions: (run.trace?.damage ?? [])
      .filter(event => event.formula?.randomBranch)
      .map((event, index) => ({
        projectionIdentity:
          'machine-isolated-critical:' + scenarioId + ':' + index,
        actionId: event.actionId ?? null,
        hitIdentity: event.hitIdentity ?? null,
        mode: event.formula.randomBranch.mode ?? null,
        sourceCriticalBasisPoints:
          event.formula.randomBranch.sourceCriticalBasisPoints ?? null,
        targetCriticalDefenseBasisPoints:
          event.formula.randomBranch.targetCriticalDefenseBasisPoints ?? null,
        effectiveThresholdBasisPoints:
          event.formula.randomBranch.criticalThreshold ?? null,
        criticalRoll: event.formula.randomBranch.criticalRoll ?? null,
        critical: event.formula.randomBranch.critical ?? null,
      })),
    ...profileRows,
  };
}

function inspectActionLevelCase(verifiedActionLevelModule, levelCase) {
  let resolution = null;
  let failure = null;
  try {
    resolution = verifiedActionLevelModule.resolveVerifiedActionLevel(
      structuredClone(levelCase.action ?? {})
    );
  } catch (error) {
    failure = {
      name: error?.name ?? null,
      code: error?.code ?? null,
      details: error?.details ?? null,
    };
  }
  const expectedResult = levelCase.expectedResult ?? null;
  const expectedErrorCode = levelCase.expectedErrorCode ?? null;
  const passed = expectedErrorCode
    ? failure?.code === expectedErrorCode && resolution == null
    : failure == null &&
      expectedResult != null &&
      Object.entries(expectedResult).every(([key, value]) =>
        Object.is(resolution?.[key], value)
      );
  return {
    identity: 'action-level:' + String(levelCase.identity),
    passed,
    actual: {
      action: structuredClone(levelCase.action ?? {}),
      resolution,
      failure,
    },
  };
}

function inspectRuntimeInterruptionCase({
  interruptionCase,
  fixture,
  profile,
  runtimePackage,
  targetStateRuntimeModule,
  tuningMarkGenerationModule,
}) {
  const ownerId = Number(profile.owner?.ownerId);
  const controlSkillId = Number(interruptionCase.controlSkillId);
  const subSkillIndex = Number(interruptionCase.subSkillIndex ?? 0);
  const frameRate = Number(interruptionCase.frameRate ?? 60);
  const effectiveEndFrame = Number(interruptionCase.effectiveEndFrame);
  const control = (profile.contracts?.controls ?? []).find(
    candidate => Number(candidate.controlSkillId) === controlSkillId
  );
  if (
    !control ||
    !Number.isInteger(effectiveEndFrame) ||
    effectiveEndFrame < 0
  ) {
    return {
      identity: 'runtime-interruption:' + String(interruptionCase.identity),
      passed: false,
      actual: { reason: 'runtime-interruption-case-invalid' },
    };
  }
  const actionId = 'runtime-interruption--' + interruptionCase.identity;
  const actorId = String(interruptionCase.actorId ?? `actor-${ownerId}`);
  const actor = {
    id: actorId,
    characterId: ownerId,
    name: profile.owner?.name ?? String(ownerId),
  };
  const hits = (control.hits ?? []).filter(
    hit =>
      Number(hit.mapIndex) === subSkillIndex ||
      (hit.trigger?.subSkillIndexes ?? []).some(
        value => Number(value) === subSkillIndex
      )
  );
  const effects = (control.effects ?? []).filter(effect => {
    if (Number(effect.mapIndex) !== subSkillIndex) return false;
    if (interruptionCase.effectSelection === 'tuning-mark') {
      return effect.tuningMark?.applied === true;
    }
    if (interruptionCase.effectSelection === 'landed-hit-conditioned') {
      return effect.landedHitActivationCondition?.applied === true;
    }
    if (
      interruptionCase.effectSelection?.kind === 'element-id' &&
      (interruptionCase.effectSelection.elementIds ?? []).some(
        elementId => Number(elementId) === Number(effect.elementId)
      )
    ) {
      return (
        interruptionCase.effectSelection.classification == null ||
        effect.classification ===
          interruptionCase.effectSelection.classification
      );
    }
    return false;
  });
  const action = {
    id: actionId,
    name: actionId,
    startMs: 0,
    sourceSequenceIndex: 0,
    sourceSequencePath: [0],
    actorId,
    actor,
    type: String(interruptionCase.actionType ?? 'skill'),
    contextualEffectiveEndMs: (effectiveEndFrame * 1000) / frameRate,
  };
  const actionResolutionById = new Map([
    [
      actionId,
      {
        ready: true,
        packageId: runtimePackage.packageId,
        actionBinding: {
          identity: `runtime-interruption-${controlSkillId}-${subSkillIndex}`,
          ownerId,
          controlSkillId,
          selectedSubSkillIndex: subSkillIndex,
        },
        controlBinding: {
          controlSkillId,
          selectedSubSkillIndex: subSkillIndex,
          frameRate,
        },
        hits: structuredClone(hits),
        effects: structuredClone(effects),
      },
    ],
  ]);
  const runtimeScenario = {
    time: {
      durationMs:
        (Number(interruptionCase.durationFrames ?? 600) * 1000) / frameRate,
    },
    policy: {
      defaultWillHit: fixture.scenario?.projectile?.defaultWillHit !== false,
    },
    projectile: structuredClone(fixture.scenario?.projectile ?? {}),
    combatScenario: {
      projectile: structuredClone(fixture.scenario?.projectile ?? {}),
    },
    initialRuntimeState: structuredClone(
      interruptionCase.initialRuntimeState ?? {}
    ),
    actors: [actor],
    enemy: { id: 'enemy-1', name: 'Passive Boss' },
    actions: [action],
  };
  const runtime = targetStateRuntimeModule.applyVerifiedTargetStateRuntime({
    scenario: runtimeScenario,
    actionResolutionById,
    mechanicsPackage: runtimePackage,
  });
  const tuningRuntime =
    tuningMarkGenerationModule.createVerifiedTuningMarkGeneration({
      scenario: runtimeScenario,
      actionExecutionPlan: {
        actions: [{ actionId, execute: true }],
      },
      effectGeneration: {
        actionResolutionById: runtime.actionResolutionById,
      },
      actionVariantRuntime: {
        actionResolutionById: runtime.actionResolutionById,
        tuningMarkTransactions: [],
      },
    });
  const resolved = runtime.actionResolutionById.get(actionId);
  const effectCommandCountById = countValues(
    runtime.effectCommands.map(command => command.effectId)
  );
  const targetStateChangeCountByIdentityAndOperation = countValues(
    runtime.events
      .filter(event => event.type === 'VERIFIED_TARGET_STATE_CHANGE')
      .map(
        event =>
          String(event.payload?.stateIdentity) +
          ':' +
          String(event.payload?.operation)
      )
  );
  const seededTuningMarkIds = (
    runtimeScenario.initialRuntimeState.tuningMarks ?? []
  )
    .map(row => Number(row.markId))
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
  const actual = {
    effectiveEndFrame,
    directSpCount: runtime.directSpEvents.length,
    effectCommandCountById,
    targetStateChangeCountByIdentityAndOperation,
    remainingTuningMarkFrames: (resolved?.effects ?? [])
      .filter(effect => effect.tuningMark?.applied === true)
      .map(effect => Number(effect.trigger?.startFrame))
      .sort((left, right) => left - right),
    conditionResults: runtime.actionHitActivationResults.map(result => ({
      triggerFrame: Number(result.condition?.triggerFrame),
      applied: result.applied,
      reason: result.reason,
    })),
    landedHitRuntimeMisses: runtime.events
      .filter(
        event =>
          event.type === 'VERIFIED_RUNTIME_EFFECT_LANDED_HIT_CONDITION_NOT_MET'
      )
      .map(event => ({
        bindingIdentity: event.payload?.bindingIdentity,
        triggerFrame: Number(event.payload?.triggerFrame),
        withinOccupancy: event.payload?.withinOccupancy,
      })),
    tuningConsumeEvents: tuningRuntime.events
      .filter(event => event.actionId === actionId && event.kind === 'consume')
      .map(event => ({
        frameIndex: event.frameIndex,
        markId: event.markId,
        before: event.before,
        delta: event.delta,
        after: event.after,
      })),
    tuningUnresolved: structuredClone(tuningRuntime.unresolved ?? []),
    finalTuningMarkStacksById: Object.fromEntries(
      seededTuningMarkIds.map(markId => [
        String(markId),
        Number(
          tuningRuntime.finalState.find(
            state => Number(state.markId) === markId
          )?.currentValue ?? 0
        ),
      ])
    ),
    trace: {
      events: runtime.events
        .filter(event => event.actionId === actionId)
        .map(event => ({
          type: event.type,
          timeMs: event.timeMs,
          actionId: event.actionId,
          payload: {
            bindingIdentity: event.payload?.bindingIdentity ?? null,
            effectIdentity: event.payload?.effectIdentity ?? null,
            stateIdentity: event.payload?.stateIdentity ?? null,
            operation: event.payload?.operation ?? null,
            hitIdentity: event.payload?.hitIdentity ?? null,
            triggerFrame: event.payload?.triggerFrame ?? null,
            withinOccupancy: event.payload?.withinOccupancy ?? null,
            beforeValue: event.payload?.beforeValue ?? null,
            afterValue: event.payload?.afterValue ?? null,
            reason: event.payload?.reason ?? null,
            applied: event.payload?.applied ?? null,
          },
        })),
      directSpEvents: runtime.directSpEvents.map(event => ({
        timeMs: event.timeMs,
        actionId: event.actionId,
        triggerHitIdentity: event.triggerHitIdentity,
        triggerHitIndex: event.triggerHitIndex,
        value: event.value,
        sourceSequencePath: event.sourceSequencePath,
      })),
      effectCommands: runtime.effectCommands.map(command => ({
        sourceActionId: command.sourceActionId,
        effectId: command.effectId,
        operation: command.operation,
        timeMs: command.timeMs,
        durationMs: command.durationMs,
        modifiers: command.modifiers,
      })),
      tuningConsumeJudgments: structuredClone(
        tuningRuntime.consumeJudgmentResults
      ),
    },
  };
  const expectation = interruptionCase.expectation ?? {};
  const passed = Object.entries(expectation).every(([key, value]) =>
    Array.isArray(value) || (value && typeof value === 'object')
      ? JSON.stringify(actual[key]) === JSON.stringify(value)
      : Object.is(actual[key], value)
  );
  return {
    identity: 'runtime-interruption:' + String(interruptionCase.identity),
    passed,
    actual,
  };
}

function matchesProbeWhere(value, where) {
  return Object.entries(where ?? {}).every(([valuePath, expected]) => {
    const actual = readPath(value, valuePath);
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected) {
        return expected.$in.some(candidate => Object.is(actual, candidate));
      }
      if ('$not' in expected) return !Object.is(actual, expected.$not);
    }
    return Object.is(actual, expected);
  });
}

function readPath(value, valuePath) {
  return String(valuePath ?? '')
    .split('.')
    .filter(Boolean)
    .reduce(
      (current, segment) => (current == null ? undefined : current[segment]),
      value
    );
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).map(String))].sort();
}

function firstInteger(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const number = Number(value);
    if (Number.isInteger(number)) return number;
  }
  return null;
}

function readRequestedOwnerId(args) {
  const index = args.indexOf('--owner');
  if (index < 0) return null;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Invalid --owner value: ' + String(args[index + 1]));
  }
  return value;
}

function readOptionalPathArgument(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = String(args[index + 1] ?? '').trim();
  if (!value) throw new Error(`Invalid ${name} value`);
  return value;
}

function readRuntimePackageOutputPath(args) {
  const index = args.indexOf('--runtime-package-output');
  if (index < 0) return null;
  const value = String(args[index + 1] ?? '').trim();
  if (!value) {
    throw new Error('--runtime-package-output requires a path');
  }
  const outputPath = path.resolve(projectRoot, value);
  if (outputPath === path.resolve(verifiedMechanicsPackagePath)) {
    throw new Error(
      '--runtime-package-output cannot overwrite the global generated package'
    );
  }
  return outputPath;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function parseOwnerId(argv) {
  const index = argv.indexOf('--owner');
  if (index < 0) return null;
  const ownerId = Number(argv[index + 1]);
  if (!Number.isInteger(ownerId)) {
    throw new Error('Invalid --owner value: ' + String(argv[index + 1]));
  }
  return ownerId;
}

function sameHashes(left, right) {
  return ['input', 'data', 'trace', 'evaluation'].every(
    key => left?.[key] === right?.[key]
  );
}

function toJsonCompatible(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonText(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function createMarkdownReport(report) {
  const lines = [
    '# M11-D-R1 角色机制验收协议',
    '',
    '- 初始基线：' + report.baselineCommit,
    '- R1 基线：' + report.r1.baseCommit,
    '- 状态：可信派生收口完成，等待产品复验',
    '- 规则：requirement、scenario case、coverage edge、ledger 与成熟度均从 committed source-of-truth 和 canonical replay 派生。',
    '- 性能、包体和外部 CPU 抖动仅记录，不参与功能资格判定。',
    '',
    '| 角色 | 成熟度 | 矩阵通过/必需 | source gap | acceptance gap | optimization-ready |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const owner of report.owners) {
    lines.push(
      '| ' +
        owner.ownerName +
        ' (' +
        owner.ownerId +
        ') | ' +
        owner.maturityState +
        ' | ' +
        owner.matrix.passedCount +
        '/' +
        owner.matrix.requiredCount +
        ' | ' +
        owner.sourceGapCount +
        ' | ' +
        owner.acceptanceGapCount +
        ' | ' +
        (owner.optimizationReady ? '是' : '否') +
        ' |'
    );
  }
  lines.push(
    '',
    '三份 Machine Axis 场景继续由唯一 canonical core 重放并通过 Workbench 导入/导出；产品可视签收仍为 pending，真实 source gap 与尚缺场景覆盖继续阻断优化资格。',
    ''
  );
  return lines.join('\n');
}
