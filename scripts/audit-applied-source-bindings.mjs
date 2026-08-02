import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const outputPath = path.resolve(
  repositoryRoot,
  readArgument('--output') ?? 'reports/applied-source-binding-audit.json'
);
const assertClean = process.argv.includes('--assert-clean');
const vite = await createServer({
  root: repositoryRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const drafts = await vite.ssrLoadModule(
    '/src/domain/workbenchDraftStorage.js'
  );
  const factory = await vite.ssrLoadModule(
    '/src/domain/workbenchProjectFactory.js'
  );
  const compiler = await vite.ssrLoadModule(
    '/src/simulation/compiler/compileProject.js'
  );
  const engine = await vite.ssrLoadModule(
    '/src/simulation/engine/simulateScenario.js'
  );
  const fixtures = await vite.ssrLoadModule(
    '/src/simulation/fixtures/toughnessRuntimeSampleFixture.js'
  );
  const draft = createAuditDraft(drafts, fixtures);
  const project = factory.createWorkbenchProject(draft.selection, {
    teamSlots: draft.teamSlots,
    actorConfigs: draft.actorConfigs,
    enemyConfig: draft.enemyConfig,
    configurationLibrary: draft.configurationLibrary,
    configurationSelection: draft.configurationSelection,
    gameDataBinding: draft.gameDataBinding,
    actions: draft.actionDrafts,
    actionRelations: draft.actionRelations,
    cycleBoundaries: draft.cycleBoundaries,
    initialRuntimeState: draft.initialRuntimeState,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
  });
  const scenario = compiler.compileProject(
    project,
    factory.getWorkbenchGameData()
  );
  const result = engine.simulateScenario(scenario);
  const soulEssenceCatalog = JSON.parse(
    await readFile(
      path.join(
        repositoryRoot,
        'src',
        'data',
        'generated',
        'soulessence-effect-mechanics.json'
      ),
      'utf8'
    )
  );
  const mechanicsPackage = JSON.parse(
    await readFile(
      path.join(
        repositoryRoot,
        'src',
        'data',
        'generated',
        'verified-combat-mechanics-package.json'
      ),
      'utf8'
    )
  );
  const loadoutPropertyTagAudit = await createLoadoutPropertyTagAudit(
    soulEssenceCatalog,
    mechanicsPackage
  );
  const deltas = result.threeValueGenerationLayer.deltas
    .filter(delta => delta.layerKey === 'applied')
    .map(delta => ({
      deltaId: delta.deltaId,
      actionId: delta.actionId,
      trackKey: delta.trackKey,
      state: delta.appliedSourceBindingState,
      kind: delta.appliedSourceBindingKind,
      identity: delta.appliedSourceBindingIdentity,
      status: delta.appliedSourceBindingStatus,
      issueCodes:
        delta.mechanicsAdapterRequest?.sourceValue?.operands
          ?.sourceBindingValidation?.issueCodes ?? [],
    }));
  const boundDrift = deltas.filter(delta => delta.state === 'bound-drift');
  const compatibleUnbound = deltas.filter(
    delta => delta.state === 'compatible-unbound'
  );
  const unexplainedCompatibleUnbound = compatibleUnbound.filter(
    delta =>
      delta.status !== 'applied-source-binding-compatible-unbound' ||
      (!delta.kind && delta.issueCodes.length === 0)
  );
  const requiredTracks = [
    'enemyHpDamage',
    'enemyToughnessDamage',
    'selfEnergyChange',
  ];
  const missingTracks = requiredTracks.filter(
    trackKey => !deltas.some(delta => delta.trackKey === trackKey)
  );
  const passed =
    deltas.length > 0 &&
    boundDrift.length === 0 &&
    unexplainedCompatibleUnbound.length === 0 &&
    missingTracks.length === 0 &&
    loadoutPropertyTagAudit.summary.driftCount === 0;
  const reportBody = {
    schemaVersion: 1,
    kind: 'applied-source-binding-audit',
    decision: {
      status: passed ? 'passed' : 'blocked',
      passed,
      reason: passed
        ? 'all-applied-deltas-have-a-valid-or-explained-source-binding'
        : 'applied-source-binding-drift-unexplained-compatibility-or-track-gap',
    },
    summary: {
      appliedDeltaCount: deltas.length,
      boundReadyCount: deltas.filter(delta => delta.state === 'bound-ready')
        .length,
      boundDriftCount: boundDrift.length,
      compatibleUnboundCount: compatibleUnbound.length,
      unexplainedCompatibleUnboundCount: unexplainedCompatibleUnbound.length,
      missingTrackCount: missingTracks.length,
      loadoutPropertyTagSourceCount:
        loadoutPropertyTagAudit.summary.sourceCount,
      loadoutPropertyTagDriftCount: loadoutPropertyTagAudit.summary.driftCount,
      loadoutTuningConditionCount:
        loadoutPropertyTagAudit.summary.tuningConditionCount,
      loadoutTuningConditionDriftCount:
        loadoutPropertyTagAudit.summary.tuningConditionDriftCount,
      tuningConsumePriorityGroupCount:
        loadoutPropertyTagAudit.summary.tuningConsumePriorityGroupCount,
      tuningConsumePriorityDriftCount:
        loadoutPropertyTagAudit.summary.tuningConsumePriorityDriftCount,
    },
    requiredTracks,
    missingTracks,
    deltas,
    loadoutPropertyTags: loadoutPropertyTagAudit,
  };
  const previousReport = await readJsonIfExists(outputPath);
  const semanticUnchanged = reportsHaveSameSemanticContent(
    previousReport,
    reportBody
  );
  const report = {
    schemaVersion: reportBody.schemaVersion,
    kind: reportBody.kind,
    generatedAt:
      semanticUnchanged && previousReport?.generatedAt
        ? previousReport.generatedAt
        : new Date().toISOString(),
    decision: reportBody.decision,
    summary: reportBody.summary,
    requiredTracks: reportBody.requiredTracks,
    missingTracks: reportBody.missingTracks,
    deltas: reportBody.deltas,
    loadoutPropertyTags: reportBody.loadoutPropertyTags,
  };
  const serializedReport = `${JSON.stringify(report, null, 2)}\n`;

  if (!assertClean) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    if ((await readTextIfExists(outputPath)) !== serializedReport) {
      await writeFile(outputPath, serializedReport, 'utf8');
    }
  }
  process.stdout.write(
    `${report.decision.status}: ${deltas.length} applied deltas, ${boundDrift.length} drift, ${compatibleUnbound.length} compatible unbound\n`
  );
  if (assertClean && (!passed || !semanticUnchanged)) {
    if (!semanticUnchanged) {
      process.stderr.write(
        `stale: ${path.relative(repositoryRoot, outputPath)} differs from the deterministic audit result\n`
      );
    }
    process.exitCode = 1;
  }
} finally {
  await vite.close();
}

function createAuditDraft(drafts, fixtures) {
  const draft = drafts.createDefaultWorkbenchDraftState();
  draft.actionDrafts.push({
    id: 'audit-resource-action',
    type: 'resource',
    actorCharacterId: draft.selection.characterId,
    startMs: 1200,
    durationMs: 1,
    resource: 'sp',
    change: 0.25,
    reason: 'production-source-binding-audit',
  });
  draft.runtimeSampleCaptures = [
    fixtures.createToughnessRuntimeSampleFixture({
      actionId: draft.actionDrafts[0].id,
      toughnessDeltaApplied: 70,
    }),
  ];
  return draft;
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function createLoadoutPropertyTagAudit(catalog, mechanicsPackage) {
  const sourcePath = catalog?.sourceSnapshot?.battleElements?.path;
  const expectedSourceSha256 =
    catalog?.sourceSnapshot?.battleElements?.sha256 ?? null;
  const sourceBytes = await readFile(sourcePath);
  const actualSourceSha256 = createHash('sha256')
    .update(sourceBytes)
    .digest('hex');
  const definitions = (catalog?.definitions ?? []).filter(
    definition =>
      definition.runtimeStatus === 'runtime-applied' &&
      definition.trigger != null &&
      definition.effect != null
  );
  const persistentDefinitions = [
    ...(catalog?.definitions ?? [])
      .filter(
        definition =>
          definition.runtimeStatus === 'runtime-applied' &&
          definition.persistentRoot?.status === 'runtime-applied'
      )
      .map(definition => ({
        ownerKind: 'soulessence',
        ownerId: Number(definition.soulEssenceId),
        skillId: Number(definition.effectSkillId),
        definition,
      })),
    ...(catalog?.setSkillDefinitions ?? [])
      .filter(
        definition =>
          definition.runtimeStatus === 'runtime-applied' &&
          definition.persistentRoot?.status === 'runtime-applied'
      )
      .map(definition => ({
        ownerKind: 'set-skill',
        ownerId: `${definition.setId}:${definition.pieces}`,
        skillId: Number(definition.skillId),
        definition,
      })),
  ];
  const tuningConsumePriorityGroups =
    collectTuningConsumePriorityGroups(mechanicsPackage);
  const requestedElementIds = new Set([
    ...definitions.flatMap(definition => [
      Number(definition.effect?.elementId),
      Number(definition.trigger?.elementId),
      ...(definition.sourceClosure?.wrapperElementIds ?? []).map(Number),
      ...(definition.sourceClosure?.removalPaths ?? []).flatMap(path => [
        Number(path.triggerElementId),
        Number(path.removerElementId),
        ...(path.removedElementIds ?? []).map(Number),
      ]),
      ...(definition.trigger?.condition?.conditions ?? []).flatMap(condition =>
        (condition.tuningProfiles ?? []).flatMap(profile => [
          Number(profile.markId),
          Number(profile.overlimitPacketElementId),
          Number(profile.damageElementId),
        ])
      ),
    ]),
    ...persistentDefinitions.flatMap(({ definition }) => [
      Number(definition.persistentRoot?.installation?.rootElementId),
      Number(definition.persistentRoot?.unload?.triggerElementId),
      ...(definition.persistentRoot?.effects ?? []).map(effect =>
        Number(effect.elementId)
      ),
      ...(definition.persistentRoot?.unload?.removalPaths ?? []).flatMap(path =>
        (path.elementIds ?? []).map(Number)
      ),
    ]),
    ...tuningConsumePriorityGroups.flatMap(group => [
      Number(group.contract.judgmentElementId),
      ...(group.contract.judgmentCandidates ?? []).map(candidate =>
        Number(candidate.packetElementId)
      ),
    ]),
  ]);
  const requestedPathIds = new Set(
    tuningConsumePriorityGroups.flatMap(group =>
      (group.contract.judgmentCandidates ?? []).map(candidate =>
        String(candidate.packetPathId)
      )
    )
  );
  const sourceRowsByElementId = new Map();
  const sourceRowsByElementIdAll = new Map();
  const sourceRowsByPathId = new Map();
  for (const line of sourceBytes.toString('utf8').split(/\r?\n/u)) {
    if (!line) continue;
    const match = line.match(/"elementConfigId"\s*:\s*(\d+)/u);
    const elementId = Number(match?.[1]);
    const pathId = line.match(/"path_id"\s*:\s*(-?\d+)/u)?.[1] ?? null;
    if (
      !requestedElementIds.has(elementId) &&
      !requestedPathIds.has(String(pathId))
    ) {
      continue;
    }
    const row = JSON.parse(
      line.replace(/("m_PathID"\s*:\s*)(-?\d+)/gu, '$1"$2"')
    );
    if (Number(row?.typetree?.elementConfigId) === elementId) {
      sourceRowsByElementId.set(elementId, row);
      const rows = sourceRowsByElementIdAll.get(elementId) ?? [];
      rows.push(row);
      sourceRowsByElementIdAll.set(elementId, rows);
    }
    if (pathId != null) sourceRowsByPathId.set(String(pathId), row);
  }
  const supportedPropertyTags = new Set(
    (catalog?.propertyTagContract?.bindings ?? [])
      .filter(binding => binding.status === 'applied')
      .map(binding => Number(binding.propertyTag))
  );
  const tuningProfiles =
    mechanicsPackage?.tuningMechanicsCatalog?.profiles ?? [];
  const records = definitions.map(definition => {
    const elementId = Number(definition.effect?.elementId);
    const sourceRow = sourceRowsByElementId.get(elementId);
    const triggerElementId = Number(definition.trigger?.elementId);
    const triggerSourceRow = sourceRowsByElementId.get(triggerElementId);
    const triggerTree = triggerSourceRow?.typetree ?? {};
    const sourcePropertyTags = normalizeIntegerTags(
      sourceRow?.typetree?.defaultPropertyTags
    );
    const generatedPropertyTags = normalizeIntegerTags(
      definition.effect?.propertyTags
    );
    const expectedMatchMode =
      sourcePropertyTags.length === 0
        ? 'unscoped'
        : sourcePropertyTags.length === 1 &&
            supportedPropertyTags.has(sourcePropertyTags[0])
          ? 'single-exact'
          : null;
    const sourceConditionLogic = Number(triggerTree.triggerConditionType);
    const generatedConditionLogic = Number(
      definition.trigger?.condition?.logicValue
    );
    const sourceTriggerEventId = Number(triggerTree.triggerParam1);
    const generatedTriggerEventId = Number(definition.trigger?.eventId);
    const triggerEventBinding = catalog.triggerContract?.eventBindings?.find(
      binding => Number(binding.value) === sourceTriggerEventId
    );
    const sourceTriggerTargetType = Number(triggerTree.triggerTargetType);
    const generatedTriggerTargetType = Number(
      definition.trigger?.triggerTarget?.triggerTargetType
    );
    const sourceConditions = normalizeTriggerConditions(
      triggerTree.triggerConditionList
    );
    const generatedConditions = normalizeTriggerConditions(
      definition.trigger?.condition?.conditions?.map(condition => ({
        conditionParam1: condition.conditionType,
        conditionParam2: condition.conditionValue,
      }))
    );
    const generatedTargetPathId = Number(
      definition.trigger?.target?.targetElementPathId
    );
    const sourceTargetEffect = (triggerTree.triggerEffectList ?? []).find(
      effect =>
        Number(effect?.targetElement?.m_PathID) === generatedTargetPathId
    );
    const sourceTargetPathId = Number(
      sourceTargetEffect?.targetElement?.m_PathID
    );
    const sourceTargetType = Number(sourceTargetEffect?.targetType);
    const generatedTargetType = Number(
      definition.trigger?.target?.effectTargetType
    );
    const sourceCommonFunctionId = Number(
      sourceRow?.typetree?.formulaParams?.function_1 ??
        sourceRow?.typetree?.baseIntParams?.[0]
    );
    const sourceBaseFunctionId = Number(
      sourceRow?.typetree?.formulaParams?.function_2 ??
        sourceRow?.typetree?.baseIntParams?.[1]
    );
    const generatedCommonFunctionId = Number(
      definition.effect?.formula?.commonFunctionId
    );
    const generatedBaseFunctionId = Number(
      definition.effect?.formula?.baseFunctionId
    );
    const lifecycle = definition.effect?.lifecycle ?? null;
    const wrapper = lifecycle?.wrapper ?? null;
    const wrapperSourceRow = wrapper
      ? sourceRowsByElementId.get(Number(wrapper.elementId))
      : null;
    const wrapperTree = wrapperSourceRow?.typetree ?? null;
    const wrapperInjectedPathIds = normalizePathIds(
      wrapperTree?.injectElementDataList
    );
    const removalPaths = definition.sourceClosure?.removalPaths ?? [];
    const removalSourceRowsPresent = removalPaths.every(
      path =>
        sourceRowsByElementId.has(Number(path.triggerElementId)) &&
        sourceRowsByElementId.has(Number(path.removerElementId))
    );
    const tuningConditions = createTuningConditionAuditRows({
      conditions: definition.trigger?.condition?.conditions ?? [],
      triggerEventId: Number(definition.trigger?.eventId),
      tuningProfiles,
      sourceRowsByElementId,
      sourceRowsByElementIdAll,
    });
    const tuningConditionIssueCodes = tuningConditions.flatMap(condition =>
      condition.issueCodes.map(
        code =>
          `${code}:condition-${condition.conditionType}-${condition.conditionValue}`
      )
    );
    const issueCodes = [
      ...(sourceRow ? [] : ['loadout-property-tag-source-row-missing']),
      ...(triggerSourceRow ? [] : ['loadout-trigger-source-row-missing']),
      ...(actualSourceSha256 === expectedSourceSha256
        ? []
        : ['loadout-property-tag-source-hash-drift']),
      ...(JSON.stringify(sourcePropertyTags) ===
      JSON.stringify(generatedPropertyTags)
        ? []
        : ['loadout-property-tag-generated-value-drift']),
      ...(expectedMatchMode === definition.effect?.propertyTagMatchMode
        ? []
        : ['loadout-property-tag-match-mode-drift']),
      ...(String(definition.effect?.propertyTagSourceIdentity ?? '').includes(
        `elementId=${elementId}.defaultPropertyTags`
      )
        ? []
        : ['loadout-property-tag-source-identity-missing']),
      ...(sourceConditionLogic === generatedConditionLogic
        ? []
        : ['loadout-trigger-condition-logic-drift']),
      ...(sourceTriggerEventId === generatedTriggerEventId &&
      triggerEventBinding?.status === 'applied' &&
      String(triggerEventBinding?.sourceIdentity ?? '').includes(
        `EElementTriggerEventType.${triggerEventBinding?.enumName}=${sourceTriggerEventId}`
      )
        ? []
        : ['loadout-trigger-event-enum-drift']),
      ...(sourceTriggerTargetType === generatedTriggerTargetType &&
      String(definition.trigger?.triggerTarget?.sourceIdentity ?? '').includes(
        `EElementTriggerTargetType.${definition.trigger?.triggerTarget?.triggerTargetTypeName}=${sourceTriggerTargetType}`
      )
        ? []
        : ['loadout-trigger-source-target-drift']),
      ...(JSON.stringify(sourceConditions) ===
      JSON.stringify(generatedConditions)
        ? []
        : ['loadout-trigger-condition-list-drift']),
      ...(Number.isInteger(sourceTargetType) &&
      sourceTargetType === generatedTargetType
        ? []
        : ['loadout-trigger-effect-target-drift']),
      ...(sourceTargetPathId === generatedTargetPathId
        ? []
        : ['loadout-trigger-effect-target-path-drift']),
      ...(sourceCommonFunctionId === generatedCommonFunctionId &&
      sourceBaseFunctionId === generatedBaseFunctionId
        ? []
        : ['loadout-effect-formula-function-drift']),
      ...((definition.trigger?.condition?.conditions ?? []).every(condition =>
        String(condition.sourceIdentity ?? '').includes('dump.cs#')
      )
        ? []
        : ['loadout-trigger-condition-enum-source-identity-missing']),
      ...(String(definition.trigger?.target?.sourceIdentity ?? '').includes(
        '.triggerEffectList['
      ) &&
      String(definition.trigger?.target?.sourceIdentity ?? '').includes(
        'ETriggerEffectTargetType.'
      )
        ? []
        : ['loadout-trigger-effect-target-source-identity-missing']),
      ...(String(definition.effect?.formula?.sourceIdentity ?? '').includes(
        `elementId=${elementId}.formulaParams|functionParams`
      )
        ? []
        : ['loadout-effect-formula-source-identity-missing']),
      ...(wrapper == null || wrapperSourceRow
        ? []
        : ['loadout-effect-wrapper-source-row-missing']),
      ...(wrapper == null ||
      (Number(wrapperTree?.time) === Number(wrapper.durationMs) &&
        Number(lifecycle?.durationMs) === Number(wrapper.durationMs))
        ? []
        : ['loadout-effect-wrapper-duration-drift']),
      ...(wrapper == null ||
      wrapperInjectedPathIds.includes(Number(definition.effect?.pathId))
        ? []
        : ['loadout-effect-wrapper-injected-leaf-drift']),
      ...(wrapper == null ||
      String(definition.sourceIdentity ?? '').includes(
        `elementId=${Number(wrapper.elementId)}`
      )
        ? []
        : ['loadout-effect-wrapper-source-identity-missing']),
      ...(removalPaths.length === 0 || removalSourceRowsPresent
        ? []
        : ['loadout-effect-removal-source-row-missing']),
      ...tuningConditionIssueCodes,
    ];
    return {
      soulEssenceId: Number(definition.soulEssenceId),
      effectElementId: elementId,
      sourcePropertyTags,
      generatedPropertyTags,
      propertyTagMatchMode: definition.effect?.propertyTagMatchMode ?? null,
      propertyTagSourceIdentity:
        definition.effect?.propertyTagSourceIdentity ?? null,
      triggerCondition: {
        sourceLogicValue: sourceConditionLogic,
        generatedLogicValue: generatedConditionLogic,
        sourceConditions,
        generatedConditions,
        sourceIdentity: definition.trigger?.condition?.sourceIdentity ?? null,
        tuningConditions,
      },
      triggerEvent: {
        sourceEventId: sourceTriggerEventId,
        generatedEventId: generatedTriggerEventId,
        enumName: triggerEventBinding?.enumName ?? null,
        frameAnchor: triggerEventBinding?.frameAnchor ?? null,
        sourceIdentity: triggerEventBinding?.sourceIdentity ?? null,
      },
      triggerSourceTarget: {
        sourceTriggerTargetType,
        generatedTriggerTargetType,
        sourceKind: definition.trigger?.triggerTarget?.kind ?? null,
        sourceIdentity:
          definition.trigger?.triggerTarget?.sourceIdentity ?? null,
      },
      triggerEffectTarget: {
        sourceTargetType,
        generatedTargetType,
        sourceTargetPathId,
        generatedTargetPathId,
        targetKind: definition.trigger?.target?.kind ?? null,
        sourceIdentity: definition.trigger?.target?.sourceIdentity ?? null,
      },
      formula: {
        sourceCommonFunctionId,
        generatedCommonFunctionId,
        sourceBaseFunctionId,
        generatedBaseFunctionId,
        formulaIdentity: definition.effect?.formula?.formulaIdentity ?? null,
        sourceIdentity: definition.effect?.formula?.sourceIdentity ?? null,
      },
      lifecycle: {
        sourceKind: lifecycle?.sourceKind ?? null,
        durationMs: lifecycle?.durationMs ?? null,
        leafDurationMs: lifecycle?.leafDurationMs ?? null,
        wrapper,
        wrapperInjectedPathIds,
        removalPaths,
      },
      sourceIdentity: definition.effect?.sourceIdentity ?? null,
      status:
        issueCodes.length === 0
          ? 'applied-source-property-tags-ready'
          : 'applied-source-property-tags-drift',
      issueCodes,
    };
  });
  const tuningConsumePriority = await createTuningConsumePriorityAudit({
    groups: tuningConsumePriorityGroups,
    sourceRowsByElementId,
    sourceRowsByPathId,
  });
  const persistentRecords = persistentDefinitions.flatMap(owner =>
    createPersistentLoadoutPropertyAuditRecords({
      ...owner,
      sourceRowsByElementId,
      supportedPropertyTags,
    })
  );
  const allRecords = [...records, ...persistentRecords];
  const propertyDriftCount = allRecords.filter(
    record => record.issueCodes.length > 0
  ).length;
  return {
    source: {
      path: sourcePath,
      expectedSha256: expectedSourceSha256,
      actualSha256: actualSourceSha256,
      propertyTagContractHash:
        catalog?.propertyTagContract?.contractHash ?? null,
      triggerContractHash: catalog?.triggerContract?.contractHash ?? null,
    },
    summary: {
      sourceCount: allRecords.length,
      triggeredSourceCount: records.length,
      persistentSourceCount: persistentRecords.length,
      driftCount: propertyDriftCount + tuningConsumePriority.summary.driftCount,
      propertyTagDriftCount: propertyDriftCount,
      tuningConditionCount: records.reduce(
        (sum, record) =>
          sum + Number(record.triggerCondition.tuningConditions?.length ?? 0),
        0
      ),
      tuningConditionDriftCount: records.reduce(
        (sum, record) =>
          sum +
          (record.triggerCondition.tuningConditions ?? []).filter(
            condition => condition.issueCodes.length > 0
          ).length,
        0
      ),
      tuningConsumePriorityGroupCount: tuningConsumePriority.summary.groupCount,
      tuningConsumePriorityDriftCount: tuningConsumePriority.summary.driftCount,
    },
    records: allRecords,
    tuningConsumePriority,
  };
}

function createPersistentLoadoutPropertyAuditRecords({
  ownerKind,
  ownerId,
  skillId,
  definition,
  sourceRowsByElementId,
  supportedPropertyTags,
}) {
  const root = definition.persistentRoot;
  const installationSourceRow = sourceRowsByElementId.get(
    Number(root.installation?.rootElementId)
  );
  const unloadSourceRow = sourceRowsByElementId.get(
    Number(root.unload?.triggerElementId)
  );
  const expectedEffectElementIds = [
    ...new Set((definition.sourceClosure?.propertyElementIds ?? []).map(Number)),
  ].sort((left, right) => left - right);
  const generatedEffectElementIds = [
    ...new Set((root.effects ?? []).map(effect => Number(effect.elementId))),
  ].sort((left, right) => left - right);
  const closureIssueCodes =
    JSON.stringify(expectedEffectElementIds) ===
    JSON.stringify(generatedEffectElementIds)
      ? []
      : ['persistent-property-effect-closure-incomplete'];
  const effects = root.effects?.length ? root.effects : [null];
  return effects.map(effect => {
    const sourceRow = sourceRowsByElementId.get(Number(effect?.elementId));
    const tree = sourceRow?.typetree ?? {};
    const sourcePropertyTags = normalizeIntegerTags(tree.defaultPropertyTags);
    const generatedPropertyTags = normalizeIntegerTags(effect?.propertyTags);
    const sourceCommonFunctionId = Number(
      tree.formulaParams?.function_1 ?? tree.baseIntParams?.[0]
    );
    const sourceBaseFunctionId = Number(
      tree.formulaParams?.function_2 ?? tree.baseIntParams?.[1]
    );
    const expectedMatchMode =
      sourcePropertyTags.length === 0
        ? 'unscoped'
        : sourcePropertyTags.length === 1 &&
            supportedPropertyTags.has(sourcePropertyTags[0])
          ? 'single-exact'
          : null;
    const removalPaths = root.unload?.removalPaths ?? [];
    const issueCodes = [
      ...closureIssueCodes,
      ...(sourceRow ? [] : ['persistent-property-source-row-missing']),
      ...(installationSourceRow
        ? []
        : ['persistent-property-installation-root-source-row-missing']),
      ...(unloadSourceRow
        ? []
        : ['persistent-property-unload-source-row-missing']),
      ...(JSON.stringify(sourcePropertyTags) ===
      JSON.stringify(generatedPropertyTags)
        ? []
        : ['persistent-property-tag-drift']),
      ...(expectedMatchMode === effect?.propertyTagMatchMode
        ? []
        : ['persistent-property-tag-match-mode-drift']),
      ...(Number(tree.attributeID) === Number(effect?.attributeId) &&
      Number(tree.calculateType) === Number(effect?.calculateType)
        ? []
        : ['persistent-property-attribute-bucket-drift']),
      ...(Number(tree.time) === Number(effect?.durationMs) &&
      Number(tree.combineType) === Number(effect?.combineType) &&
      Number(tree.combineNumber) === Number(effect?.combineNumber) &&
      Number(tree.executeTargetType) === Number(effect?.executeTargetType) &&
      Number(tree.inheritType) === Number(effect?.inheritType)
        ? []
        : ['persistent-property-lifecycle-drift']),
      ...(sourceCommonFunctionId ===
        Number(effect?.formula?.commonFunctionId) &&
      sourceBaseFunctionId === Number(effect?.formula?.baseFunctionId)
        ? []
        : ['persistent-property-formula-drift']),
      ...(Number(root.installation?.frame) === 0 &&
      Number(root.installation?.directInjectTargetType) === 0 &&
      root.installation?.removeElementOnEnd === false &&
      Array.isArray(root.installation?.sourceSequencePath) &&
      root.installation.sourceSequencePath.length > 0
        ? []
        : ['persistent-property-installation-contract-drift']),
      ...(root.lifecycle?.durationMode === 'until-loadout-uninstall' &&
      Number(root.lifecycle?.leafDurationMs) === -1 &&
      root.lifecycle?.combineMode === 'cover-by-source-identity' &&
      Number(root.lifecycle?.inheritType) === 0
        ? []
        : ['persistent-property-native-lifecycle-contract-drift']),
      ...(Number(root.unload?.eventId) === 36 && removalPaths.length > 0
        ? []
        : ['persistent-property-unload-contract-drift']),
      ...(String(effect?.sourceIdentity ?? '').includes(
        `elementId=${Number(effect?.elementId)}`
      ) &&
      String(root.installation?.sourceIdentity ?? '').includes(
        `elementId=${Number(root.installation?.rootElementId)}`
      ) &&
      String(root.unload?.sourceIdentity ?? '').includes(
        `elementId=${Number(root.unload?.triggerElementId)}`
      )
        ? []
        : ['persistent-property-source-identity-drift']),
    ];
    return {
      kind: 'persistent-loadout-property-source-binding',
      ownerKind,
      ownerId,
      skillId,
      effectElementId:
        effect?.elementId == null ? null : Number(effect.elementId),
      installationRootElementId: Number(root.installation?.rootElementId),
      unloadTriggerElementId: Number(root.unload?.triggerElementId),
      sourcePropertyTags,
      generatedPropertyTags,
      propertyTagMatchMode: effect?.propertyTagMatchMode ?? null,
      attribute: {
        sourceAttributeId: Number(tree.attributeID),
        generatedAttributeId: Number(effect?.attributeId),
        sourceCalculateType: Number(tree.calculateType),
        generatedCalculateType: Number(effect?.calculateType),
      },
      formula: {
        sourceCommonFunctionId,
        generatedCommonFunctionId: Number(effect?.formula?.commonFunctionId),
        sourceBaseFunctionId,
        generatedBaseFunctionId: Number(effect?.formula?.baseFunctionId),
      },
      lifecycle: structuredClone(root.lifecycle),
      installation: structuredClone(root.installation),
      unload: structuredClone(root.unload),
      sourceIdentity: effect?.sourceIdentity ?? null,
      status:
        issueCodes.length === 0
          ? 'applied-source-persistent-property-ready'
          : 'applied-source-persistent-property-drift',
      issueCodes,
    };
  });
}

function collectTuningConsumePriorityGroups(mechanicsPackage) {
  const groups = new Map();
  for (const binding of mechanicsPackage?.controlBindings ?? []) {
    for (const effect of binding.effects ?? []) {
      const contract = effect.tuningOverlimit;
      if (
        contract?.runtimeSelectionMode !==
          'priority-first-sufficient-candidate' ||
        !contract.judgmentGroupIdentity
      ) {
        continue;
      }
      const identity = String(contract.judgmentGroupIdentity);
      const group = groups.get(identity) ?? {
        judgmentGroupIdentity: identity,
        controlSkillId: Number(binding.controlSkillId),
        mapIndex: Number(effect.mapIndex),
        contract,
        effects: [],
      };
      group.effects.push({
        markId: Number(contract.markId),
        packetElementId: Number(contract.packetElementId),
        effectIdentity: effect.effectIdentity,
        sourceIdentity: effect.sourceIdentity,
      });
      groups.set(identity, group);
    }
  }
  return [...groups.values()].sort((left, right) =>
    left.judgmentGroupIdentity.localeCompare(right.judgmentGroupIdentity)
  );
}

async function createTuningConsumePriorityAudit({
  groups,
  sourceRowsByElementId,
  sourceRowsByPathId,
}) {
  if (groups.length === 0) {
    return {
      summary: { groupCount: 0, driftCount: 0 },
      evidence: null,
      rows: [],
    };
  }
  const evidence = groups[0].contract.priorityRuntimeEvidence ?? {};
  const binary = await readFile(evidence.binaryPath);
  const dumpSource = await readFile(evidence.dumpPath, 'utf8');
  const evidenceIssueCodes = [
    ...(hashBytes(binary) === evidence.binarySha256
      ? []
      : ['tuning-consume-priority-binary-hash-drift']),
    ...(hashBytes(
      readPortableExecutableRvaRange(binary, evidence.candidateLoopRange)
    ) === evidence.candidateLoopSha256
      ? []
      : ['tuning-consume-priority-candidate-loop-drift']),
    ...(hashBytes(
      readPortableExecutableRvaRange(binary, evidence.selectedPacketLookupRange)
    ) === evidence.selectedPacketLookupSha256
      ? []
      : ['tuning-consume-priority-packet-lookup-drift']),
    ...((evidence.dumpRequiredDeclarations ?? []).every(declaration =>
      dumpSource.includes(declaration)
    )
      ? []
      : ['tuning-consume-priority-dump-declaration-drift']),
    ...(dumpSource.includes(
      `// RVA: 0x${String(evidence.consumerMethodRva).slice(2).toUpperCase()}`
    ) &&
    dumpSource.includes(
      `// RVA: 0x${String(evidence.injectMethodRva).slice(2).toUpperCase()}`
    )
      ? []
      : ['tuning-consume-priority-method-rva-drift']),
    ...(evidence.candidateOrder === 'element-arr-index-ascending' &&
    evidence.selectionRule ===
      'first-candidate-with-layer-count-greater-than-or-equal-to-consume-layer-num' &&
    evidence.fallbackRule ===
      'continue-to-next-candidate-when-current-layer-count-is-insufficient' &&
    evidence.packetRule ===
      'lookup-inject-element-data-dict-by-selected-consume-element-id'
      ? []
      : ['tuning-consume-priority-runtime-semantics-drift']),
  ];
  const rows = groups.map(group => {
    const contract = group.contract;
    const sourceRow = sourceRowsByElementId.get(
      Number(contract.judgmentElementId)
    );
    const sourceTree = sourceRow?.typetree ?? {};
    const sourceMarkIds = normalizeOrderedIntegers(sourceTree.elementArr);
    const sourceCandidates = sourceMarkIds.map((markId, priorityIndex) => {
      const mapping = sourceTree.injectElementDataEffects?.[priorityIndex];
      const packetPathIds = normalizeExactPathIds(mapping?.elements);
      const packetRow = sourceRowsByPathId.get(packetPathIds[0]);
      return {
        priorityIndex,
        markId,
        mappedMarkId: Number(mapping?.elementAttr),
        packetPathId: packetPathIds[0] ?? null,
        packetElementId: Number(packetRow?.typetree?.elementConfigId) || null,
      };
    });
    const generatedCandidates = (contract.judgmentCandidates ?? []).map(
      candidate => ({
        priorityIndex: Number(candidate.priorityIndex),
        markId: Number(candidate.markId),
        mappedMarkId: Number(candidate.markId),
        packetPathId: String(candidate.packetPathId),
        packetElementId: Number(candidate.packetElementId),
      })
    );
    const generatedEffectPairs = [
      ...new Map(
        group.effects.map(effect => [
          `${effect.markId}:${effect.packetElementId}`,
          {
            markId: effect.markId,
            packetElementId: effect.packetElementId,
          },
        ])
      ).values(),
    ].sort((left, right) => {
      const leftIndex = generatedCandidates.findIndex(
        candidate => candidate.markId === left.markId
      );
      const rightIndex = generatedCandidates.findIndex(
        candidate => candidate.markId === right.markId
      );
      return leftIndex - rightIndex;
    });
    const expectedEffectPairs = generatedCandidates.map(candidate => ({
      markId: candidate.markId,
      packetElementId: candidate.packetElementId,
    }));
    const issueCodes = [
      ...evidenceIssueCodes,
      ...(sourceRow ? [] : ['tuning-consume-priority-source-row-missing']),
      ...(Number(sourceTree.consumeMode) === 0
        ? []
        : ['tuning-consume-priority-source-mode-drift']),
      ...(JSON.stringify(sourceMarkIds) ===
      JSON.stringify(contract.judgmentCandidateMarkIds ?? [])
        ? []
        : ['tuning-consume-priority-element-arr-order-drift']),
      ...(JSON.stringify(sourceCandidates) ===
      JSON.stringify(generatedCandidates)
        ? []
        : ['tuning-consume-priority-candidate-packet-map-drift']),
      ...(JSON.stringify(generatedEffectPairs) ===
      JSON.stringify(expectedEffectPairs)
        ? []
        : ['tuning-consume-priority-runtime-effect-membership-drift']),
      ...(String(group.judgmentGroupIdentity).includes(
        `:${contract.judgmentElementId}:${contract.judgmentPathId}`
      )
        ? []
        : ['tuning-consume-priority-group-identity-drift']),
      ...(group.effects.every(
        effect =>
          effect.markId !== 0 &&
          effect.packetElementId !== 0 &&
          effect.sourceIdentity
      )
        ? []
        : ['tuning-consume-priority-effect-source-identity-missing']),
      ...(contract.runtimeSelectionMode ===
        'priority-first-sufficient-candidate' &&
      contract.priorityDirection === 'element-arr-index-ascending'
        ? []
        : ['tuning-consume-priority-generated-selection-mode-drift']),
    ];
    return {
      judgmentGroupIdentity: group.judgmentGroupIdentity,
      controlSkillId: group.controlSkillId,
      mapIndex: group.mapIndex,
      judgmentElementId: Number(contract.judgmentElementId),
      judgmentPathId: String(contract.judgmentPathId),
      sourceConsumeMode: Number(sourceTree.consumeMode),
      sourceMarkIds,
      generatedMarkIds: contract.judgmentCandidateMarkIds,
      sourceCandidates,
      generatedCandidates,
      generatedEffectPairs,
      runtimeSelectionMode: contract.runtimeSelectionMode,
      priorityDirection: contract.priorityDirection,
      sourceIdentity: contract.judgmentSourceIdentity,
      runtimeEvidenceSourceIdentity: evidence.sourceIdentity,
      status:
        issueCodes.length === 0
          ? 'tuning-consume-priority-source-ready'
          : 'tuning-consume-priority-source-drift',
      issueCodes,
    };
  });
  return {
    summary: {
      groupCount: rows.length,
      driftCount: rows.filter(row => row.issueCodes.length > 0).length,
    },
    evidence: {
      sourceIdentity: evidence.sourceIdentity,
      binaryPath: evidence.binaryPath,
      binarySha256: evidence.binarySha256,
      consumerMethod: evidence.consumerMethod,
      consumerMethodRva: evidence.consumerMethodRva,
      candidateLoopRange: evidence.candidateLoopRange,
      candidateLoopSha256: evidence.candidateLoopSha256,
      fallbackRule: evidence.fallbackRule,
      injectMethod: evidence.injectMethod,
      injectMethodRva: evidence.injectMethodRva,
      selectedPacketLookupRange: evidence.selectedPacketLookupRange,
      selectedPacketLookupSha256: evidence.selectedPacketLookupSha256,
      packetRule: evidence.packetRule,
      issueCodes: evidenceIssueCodes,
    },
    rows,
  };
}

function normalizeExactPathIds(value) {
  const result = [];
  visit(value);
  return [...new Set(result)];

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (/^-?\d+$/u.test(String(node.m_PathID ?? ''))) {
      result.push(String(node.m_PathID));
      return;
    }
    for (const child of Object.values(node)) visit(child);
  }
}

function normalizeOrderedIntegers(value) {
  return (Array.isArray(value) ? value : [])
    .map(Number)
    .filter(Number.isInteger);
}

function readPortableExecutableRvaRange(binary, range) {
  const match = String(range).match(/^0x([0-9a-f]+)-0x([0-9a-f]+)$/iu);
  if (!match) throw new Error(`invalid PE RVA range: ${range}`);
  const startRva = Number.parseInt(match[1], 16);
  const endRva = Number.parseInt(match[2], 16);
  const peOffset = binary.readUInt32LE(0x3c);
  const sectionCount = binary.readUInt16LE(peOffset + 6);
  const optionalHeaderSize = binary.readUInt16LE(peOffset + 20);
  const sectionTableOffset = peOffset + 24 + optionalHeaderSize;
  const resolveOffset = rva => {
    for (let index = 0; index < sectionCount; index += 1) {
      const offset = sectionTableOffset + index * 40;
      const virtualSize = binary.readUInt32LE(offset + 8);
      const virtualAddress = binary.readUInt32LE(offset + 12);
      const rawSize = binary.readUInt32LE(offset + 16);
      const rawOffset = binary.readUInt32LE(offset + 20);
      if (
        rva >= virtualAddress &&
        rva < virtualAddress + Math.max(virtualSize, rawSize)
      ) {
        return rawOffset + rva - virtualAddress;
      }
    }
    throw new Error(`PE RVA outside sections: 0x${rva.toString(16)}`);
  };
  return binary.subarray(resolveOffset(startRva), resolveOffset(endRva));
}

function hashBytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createTuningConditionAuditRows({
  conditions,
  triggerEventId,
  tuningProfiles,
  sourceRowsByElementId,
  sourceRowsByElementIdAll,
}) {
  const fixedConditionContract = new Map([
    [8, { kind: 'event-element-type', name: 'CheckElementType' }],
    [10, { kind: 'held-element-id', name: 'HasElementId' }],
    [12, { kind: 'target-element-id', name: 'CheckTargetElementId' }],
    [13, { kind: 'event-element-id', name: 'CheckElementId' }],
  ]);
  return conditions
    .filter(condition =>
      fixedConditionContract.has(Number(condition.conditionType))
    )
    .map(condition => {
      const conditionType = Number(condition.conditionType);
      const conditionValue = Number(condition.conditionValue);
      const contract = fixedConditionContract.get(conditionType);
      const expectedProfiles = tuningProfiles
        .filter(profile => {
          if (conditionType === 8) {
            const sourceTypes = [9, 10].includes(triggerEventId)
              ? (profile.markContainer?.elementTypes ?? [])
              : (profile.overlimitDamage?.template?.elementTypes ?? []);
            return sourceTypes.map(Number).includes(conditionValue);
          }
          if (conditionType === 10) {
            return Number(profile.markId) === conditionValue;
          }
          if (conditionType === 13) {
            if (triggerEventId === 1 || triggerEventId === 2) {
              return (
                Number(profile.overlimitDamage?.template?.elementConfigId) ===
                conditionValue
              );
            }
            if (triggerEventId === 9 || triggerEventId === 10) {
              return Number(profile.markId) === conditionValue;
            }
            return false;
          }
          return Number(profile.overlimitPacket?.elementId) === conditionValue;
        })
        .map(profile =>
          normalizeTuningConditionProfile({
            profile,
            sourceRowsByElementId,
            sourceRowsByElementIdAll,
            useMarkContainerTypes:
              conditionType === 8 && [9, 10].includes(triggerEventId),
          })
        )
        .sort(compareTuningConditionProfiles);
      const generatedProfiles = (condition.tuningProfiles ?? [])
        .map(profile => ({
          profileKey: String(profile.profileKey),
          markId: Number(profile.markId),
          overlimitPacketElementId: Number(profile.overlimitPacketElementId),
          damageElementId: Number(profile.damageElementId),
          elementTypes: normalizeIntegerTags(profile.elementTypes),
          elementTypeSourceKind: profile.elementTypeSourceKind ?? null,
        }))
        .sort(compareTuningConditionProfiles);
      const rawSourceRowsPresent = expectedProfiles.every(
        profile =>
          profile.markSourcePresent &&
          profile.packetSourcePresent &&
          profile.damageSourcePresent
      );
      const expectedGeneratedProfiles = expectedProfiles.map(profile => ({
        profileKey: profile.profileKey,
        markId: profile.markId,
        overlimitPacketElementId: profile.overlimitPacketElementId,
        damageElementId: profile.damageElementId,
        elementTypes: profile.elementTypes,
        elementTypeSourceKind: profile.elementTypeSourceKind,
      }));
      const issueCodes = [
        ...(condition.kind === contract.kind
          ? []
          : ['loadout-tuning-condition-kind-drift']),
        ...(condition.conditionTypeName === contract.name
          ? []
          : ['loadout-tuning-condition-enum-name-drift']),
        ...(String(condition.sourceIdentity ?? '').includes(
          `EElementTriggerFixedConditionType.${contract.name}=${conditionType}`
        )
          ? []
          : ['loadout-tuning-condition-enum-source-identity-missing']),
        ...(rawSourceRowsPresent
          ? []
          : ['loadout-tuning-condition-raw-source-row-missing']),
        ...(JSON.stringify(generatedProfiles) ===
        JSON.stringify(expectedGeneratedProfiles)
          ? []
          : ['loadout-tuning-condition-profile-drift']),
      ];
      return {
        conditionType,
        conditionTypeName: condition.conditionTypeName ?? null,
        conditionValue,
        triggerEventId,
        kind: condition.kind ?? null,
        expectedProfiles,
        generatedProfiles,
        sourceIdentity: condition.sourceIdentity ?? null,
        status:
          issueCodes.length === 0
            ? 'applied-source-tuning-condition-ready'
            : 'applied-source-tuning-condition-drift',
        issueCodes,
      };
    });
}

function normalizeTuningConditionProfile({
  profile,
  sourceRowsByElementId,
  sourceRowsByElementIdAll,
  useMarkContainerTypes,
}) {
  const markId = Number(profile.markId);
  const overlimitPacketElementId = Number(profile.overlimitPacket?.elementId);
  const damageElementId = Number(
    profile.overlimitDamage?.template?.elementConfigId
  );
  const damageSourceRow = sourceRowsByElementId.get(damageElementId);
  const markSourceRow = (sourceRowsByElementIdAll.get(markId) ?? []).find(
    row =>
      Number(row?.typetree?.combineType) === 4 &&
      Number(row?.typetree?.combineNumber) === 5 &&
      Array.isArray(row?.typetree?.types)
  );
  return {
    profileKey: String(profile.key),
    markId,
    overlimitPacketElementId,
    damageElementId,
    elementTypes: normalizeIntegerTags(
      useMarkContainerTypes
        ? markSourceRow?.typetree?.types
        : damageSourceRow?.typetree?.types
    ),
    elementTypeSourceKind: useMarkContainerTypes
      ? 'mark-container'
      : 'damage-template',
    markSourcePresent: Boolean(markSourceRow),
    packetSourcePresent: sourceRowsByElementId.has(overlimitPacketElementId),
    damageSourcePresent: Boolean(damageSourceRow),
  };
}

function compareTuningConditionProfiles(left, right) {
  return String(left.profileKey).localeCompare(String(right.profileKey), 'en');
}

function normalizeIntegerTags(values) {
  return [...new Set((values ?? []).map(Number))]
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
}

function normalizePathIds(values) {
  return [...new Set((values ?? []).map(value => Number(value?.m_PathID)))]
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
}

function normalizeTriggerConditions(values) {
  return (values ?? [])
    .map(condition => ({
      conditionType: Number(condition?.conditionParam1),
      conditionValue: Number(condition?.conditionParam2),
    }))
    .filter(
      condition =>
        Number.isInteger(condition.conditionType) &&
        Number.isInteger(condition.conditionValue)
    )
    .sort(
      (left, right) =>
        left.conditionType - right.conditionType ||
        left.conditionValue - right.conditionValue
    );
}

async function readJsonIfExists(filePath) {
  const text = await readTextIfExists(filePath);
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function reportsHaveSameSemanticContent(previousReport, nextReportBody) {
  if (!previousReport || typeof previousReport !== 'object') return false;
  const { generatedAt: _generatedAt, ...previousBody } = previousReport;
  return JSON.stringify(previousBody) === JSON.stringify(nextReportBody);
}
