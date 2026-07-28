import crypto from 'node:crypto';
import path from 'node:path';
import { createServer } from 'vite';
import { validateCharacterCombatGoldenRuntime } from './character-combat-golden-validation.mjs';

const DEFAULT_FRAME_RATE = 60;

export async function createCharacterCombatGoldenRuntime({
  repositoryRoot,
  mechanicsPackage,
  recipe,
} = {}) {
  const scenarioRecipe = recipe?.goldenScenario;
  if (!scenarioRecipe) {
    throw new Error(`golden scenario missing for ${recipe?.ownerId}`);
  }
  const root = path.resolve(repositoryRoot ?? process.cwd());
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });

  try {
    const packageModule = await vite.ssrLoadModule(
      '/src/data/verifiedCombatMechanicsPackage.js'
    );
    const factory = await vite.ssrLoadModule(
      '/src/domain/workbenchProjectFactory.js'
    );
    const mechanicsSelection = await vite.ssrLoadModule(
      '/src/domain/workbenchMechanicsProfileSelection.js'
    );
    const contextScheduling = await vite.ssrLoadModule(
      '/src/domain/verifiedActionContextScheduling.js'
    );
    const compiler = await vite.ssrLoadModule(
      '/src/simulation/compiler/compileProject.js'
    );
    const engine = await vite.ssrLoadModule(
      '/src/simulation/engine/simulateScenario.js'
    );

    packageModule.installVerifiedCombatMechanicsPackage(
      createRuntimeInstallPackage(mechanicsPackage)
    );
    const primary = runGoldenScenario({
      mechanicsPackage,
      recipe,
      scenarioRecipe,
      factory,
      mechanicsSelection,
      contextScheduling,
      compiler,
      engine,
    });
    const comparison = runGoldenComparison({
      mechanicsPackage,
      recipe,
      scenarioRecipe,
      primary,
      factory,
      mechanicsSelection,
      contextScheduling,
      compiler,
      engine,
    });
    const actual = createGoldenActualProjection({
      ownerId: Number(recipe.ownerId),
      recipe,
      scenarioRecipe,
      result: primary.result,
      project: primary.project,
      comparison,
    });
    const validation = validateCharacterCombatGoldenRuntime({
      actual,
      expected: scenarioRecipe.expectedRuntime,
    });
    return {
      schemaVersion: 1,
      kind: 'azpr-character-combat-authoritative-golden-runtime',
      status: validation.passed
        ? 'authoritative-golden-runtime-verified'
        : 'authoritative-golden-runtime-expectation-failed',
      ownerId: Number(recipe.ownerId),
      scenarioIdentity: scenarioRecipe.scenarioIdentity,
      durationMs: Number(primary.project.time?.durationMs),
      frameRate: Number(scenarioRecipe.frameRate) || DEFAULT_FRAME_RATE,
      sourcePackageHash: mechanicsPackage.packageHash,
      compilerPath: 'src/simulation/compiler/compileProject.js',
      simulatorPath: 'src/simulation/engine/simulateScenario.js',
      actual,
      expected: scenarioRecipe.expectedRuntime ?? null,
      validation,
      replayHash: sha256Json(actual),
    };
  } finally {
    await vite.close();
  }
}

function runGoldenScenario({
  mechanicsPackage,
  recipe,
  scenarioRecipe,
  omittedActionKeys = [],
  clearLoadoutCharacterIds = [],
  factory,
  mechanicsSelection,
  contextScheduling,
  compiler,
  engine,
}) {
  const omitted = new Set(omittedActionKeys);
  const teamSlots = createTeamSlots(scenarioRecipe);
  const selection = {
    ...factory.DEFAULT_WORKBENCH_SELECTION,
    characterId: Number(scenarioRecipe.initialControlledCharacterId),
    secondaryCharacterId:
      Number(
        scenarioRecipe.teamCharacterIds.find(
          value =>
            Number(value) !==
            Number(scenarioRecipe.initialControlledCharacterId)
        )
      ) || Number(scenarioRecipe.teamCharacterIds[1]),
  };
  const kiboByCharacterId = Object.fromEntries(
    Object.entries(scenarioRecipe.kiboByCharacterId ?? {}).map(
      ([characterId, kiboId]) => [Number(characterId), Number(kiboId)]
    )
  );
  const clearedLoadoutOwners = new Set(clearLoadoutCharacterIds.map(Number));
  const actorConfigs = factory
    .normalizeWorkbenchActorConfigs([], selection, teamSlots)
    .map(config => ({
      ...config,
      initialSp: finiteNumber(
        scenarioRecipe.initialActorSp?.[config.characterId],
        config.initialSp
      ),
      loadout: {
        ...config.loadout,
        ...(clearedLoadoutOwners.has(Number(config.characterId))
          ? {
              equipment: {},
              soulessenceId: null,
              soulessenceLevel: null,
              soulessenceRank: null,
            }
          : (scenarioRecipe.loadoutByCharacterId?.[config.characterId] ?? {})),
        kiboId:
          kiboByCharacterId[Number(config.characterId)] ??
          config.loadout?.kiboId ??
          null,
      },
    }));
  const actionRows = [
    ...(scenarioRecipe.actions ?? []),
    ...(scenarioRecipe.switchEvents ?? []).map(event => ({
      ...event,
      actionKey: event.actionKey ?? event.eventKey,
      type: 'switch',
      actorCharacterId: event.sourceCharacterId,
      targetCharacterId: event.targetCharacterId,
    })),
  ]
    .filter(action => !omitted.has(action.actionKey))
    .sort(
      (left, right) =>
        Number(left.startFrame) - Number(right.startFrame) ||
        String(left.actionKey).localeCompare(String(right.actionKey))
    );
  const actions = actionRows.map(action =>
    createGoldenActionDraft({
      action,
      ownerId: Number(recipe.ownerId),
      mechanicsPackage,
      factory,
      contextScheduling,
      frameRate: Number(scenarioRecipe.frameRate) || DEFAULT_FRAME_RATE,
    })
  );
  const initialRuntimeState = {
    specialResourcesByActor: (scenarioRecipe.initialSpecialResources ?? []).map(
      resource => ({
        ...resource,
        actorId:
          resource.actorId ??
          `actor-${Number(resource.characterId ?? recipe.ownerId)}`,
      })
    ),
    kiboEnergyBySlot: teamSlots
      .filter(slot =>
        Number.isInteger(kiboByCharacterId[Number(slot.characterId)])
      )
      .map(slot => ({
        slotId: slot.slotId,
        actorId: `actor-${slot.characterId}`,
        characterId: Number(slot.characterId),
        kiboId: kiboByCharacterId[Number(slot.characterId)],
        currentValue: finiteNumber(
          scenarioRecipe.initialKiboSp?.[slot.characterId],
          100
        ),
        maxValue: 100,
      })),
  };
  const project = factory.createWorkbenchProject(selection, {
    durationMs: frameToMs(
      Number(scenarioRecipe.durationFrames),
      Number(scenarioRecipe.frameRate) || DEFAULT_FRAME_RATE
    ),
    teamSlots,
    actorConfigs,
    actions,
    enemyConfig: {
      level: 80,
      hpMultiplier: 100,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
      ...(scenarioRecipe.enemyConfig ?? {}),
    },
    initialRuntimeState,
    mechanicsProfileSelection:
      mechanicsSelection.createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  const compiledScenario = compiler.compileProject(
    project,
    factory.getWorkbenchGameData()
  );
  const result = engine.simulateScenario(compiledScenario);
  return {
    project,
    compiledScenario,
    result,
  };
}

function runGoldenComparison({
  mechanicsPackage,
  recipe,
  scenarioRecipe,
  primary,
  factory,
  mechanicsSelection,
  contextScheduling,
  compiler,
  engine,
}) {
  const comparisonRecipe = scenarioRecipe.comparison;
  if (!comparisonRecipe) return null;
  const baseline = runGoldenScenario({
    mechanicsPackage,
    recipe,
    scenarioRecipe,
    omittedActionKeys: comparisonRecipe.omitActionKeys,
    clearLoadoutCharacterIds: comparisonRecipe.clearLoadoutCharacterIds,
    factory,
    mechanicsSelection,
    contextScheduling,
    compiler,
    engine,
  });
  const actionKey = String(comparisonRecipe.compareActionKey ?? '');
  const primaryDamage = sumActionDamage(primary.result, actionKey);
  const baselineDamage = sumActionDamage(baseline.result, actionKey);
  return {
    comparisonIdentity: comparisonRecipe.comparisonIdentity,
    compareActionKey: actionKey,
    omittedActionKeys: [...(comparisonRecipe.omitActionKeys ?? [])],
    clearLoadoutCharacterIds: [
      ...(comparisonRecipe.clearLoadoutCharacterIds ?? []),
    ],
    primaryDamage,
    baselineDamage,
    damageDelta: primaryDamage - baselineDamage,
    primaryDynamicPropertySources: collectDynamicPropertySources(
      primary.result,
      actionKey
    ),
    baselineDynamicPropertySources: collectDynamicPropertySources(
      baseline.result,
      actionKey
    ),
    baselineReplayHash: sha256Json(
      createCompactReplaySignature(baseline.result)
    ),
  };
}

function createGoldenActionDraft({
  action,
  ownerId,
  mechanicsPackage,
  factory,
  contextScheduling,
  frameRate,
}) {
  const actionId = String(action.actionKey);
  const actorCharacterId = Number(action.actorCharacterId ?? ownerId);
  const startMs = frameToMs(Number(action.startFrame), frameRate);
  if (action.type === 'switch') {
    return factory.createWorkbenchActionDraft({
      id: actionId,
      type: 'switch',
      actorCharacterId,
      targetCharacterId: Number(action.targetCharacterId),
      startMs,
      durationMs: 0,
    });
  }

  const actionKind = String(action.actionKind);
  const ownerKind = action.type === 'kiboEvent' ? 'kibo' : 'actor';
  const mappingOwnerId =
    ownerKind === 'kibo' ? Number(action.kiboId) : actorCharacterId;
  const mapping = resolveActionMapping({
    mechanicsPackage,
    ownerKind,
    ownerId: mappingOwnerId,
    actionKind,
    actionVariantIndex: action.actionVariantIndex,
  });
  if (!mapping) {
    throw new Error(
      `golden action mapping missing: ${actionId}/${mappingOwnerId}/${actionKind}`
    );
  }
  if (action.attackInputChainIdentity) {
    return createAttackInputDraft({
      action,
      actionId,
      actorCharacterId,
      startMs,
      mapping,
      mechanicsPackage,
      factory,
      contextScheduling,
      frameRate,
    });
  }
  const selectedSubSkillIndex =
    action.controlSubSkillIndex ?? action.selectedSubSkillIndex ?? null;
  const durationFrames = resolveMappingDurationFrames(
    mapping,
    selectedSubSkillIndex,
    mechanicsPackage,
    action.attackInputControlSkillId
  );
  const attackInputFields = createGoldenAttackInputFields({
    action,
    actionId,
    mapping,
    selectedSubSkillIndex,
    durationFrames,
  });
  return factory.createWorkbenchActionDraft({
    id: actionId,
    type: ownerKind === 'kibo' ? 'kiboEvent' : 'skill',
    actorCharacterId,
    kiboId: ownerKind === 'kibo' ? mappingOwnerId : null,
    skillId: Number(action.skillId ?? mapping.sourceSkillId),
    eventType: ownerKind === 'kibo' ? actionKind : 'phase',
    actionVariantIndex: Number(
      action.actionVariantIndex ?? mapping.actionVariantIndex
    ),
    variantInputSelection: action.variantInputSelection ?? null,
    controlSubSkillIndex: selectedSubSkillIndex,
    startMs,
    durationMs: frameToMs(durationFrames, frameRate),
    durationFrames,
    timingSource: mapping.actionTiming?.occupancy?.sourceKind ?? null,
    timingStatus: mapping.timingStatus ?? 'applied',
    timingSourceIdentity:
      mapping.actionTiming?.occupancy?.sourceIdentity ?? null,
    needsTimingData: false,
    ...attackInputFields,
  });
}

function createGoldenAttackInputFields({
  action,
  actionId,
  mapping,
  selectedSubSkillIndex,
  durationFrames,
}) {
  if (mapping.actionKind !== 'normal-attack') return {};
  const segments = mapping.attackInputSegments ?? [];
  const controlSkillId = Number(
    action.attackInputControlSkillId ?? mapping.controlSkillId
  );
  const segment =
    segments.find(
      candidate =>
        Number(candidate.controlSkillId) === controlSkillId &&
        Number(candidate.selectedSubSkillIndex ?? selectedSubSkillIndex) ===
          Number(selectedSubSkillIndex)
    ) ??
    segments.find(
      candidate => Number(candidate.controlSkillId) === controlSkillId
    );
  if (!segment) {
    throw new Error(
      `golden normal attack input missing: ${actionId}/${controlSkillId}/${selectedSubSkillIndex}`
    );
  }
  const sequenceIndex = Number(
    action.attackSequenceIndex ?? segment.sequenceIndex ?? 1
  );
  const sequenceTotal = Number(
    action.attackSequenceTotal ?? segment.sequenceTotal ?? segments.length
  );
  return {
    attackGroupId: action.attackGroupId ?? `golden-${actionId}`,
    attackSequenceIndex: sequenceIndex,
    attackSequenceTotal: sequenceTotal,
    attackInput: {
      ...segment,
      sequenceIndex,
      sequenceTotal,
      selectedSubSkillIndex,
      effectiveDurationFrames: durationFrames,
      durationFrames,
      durationStatus: 'applied',
    },
  };
}

function createAttackInputDraft({
  action,
  actionId,
  actorCharacterId,
  startMs,
  mapping,
  mechanicsPackage,
  factory,
  contextScheduling,
  frameRate,
}) {
  const chain = mechanicsPackage.actionVariantGraph?.attackInputChains?.find(
    item =>
      item.chainIdentity === action.attackInputChainIdentity &&
      Number(item.ownerId) === actorCharacterId
  );
  const sequenceIndex = Number(action.attackSequenceIndex);
  const chainSegment = chain?.segments?.find(
    segment => Number(segment.sequenceIndex) === sequenceIndex
  );
  const sourceSegment = mapping.attackInputSegments?.find(
    segment =>
      Number(segment.controlSkillId) === Number(chainSegment?.controlSkillId)
  );
  const attackInput = contextScheduling.projectVerifiedAttackInputChainSegment(
    sourceSegment,
    chainSegment,
    sequenceIndex,
    chain?.segments?.length
  );
  if (!attackInput) {
    throw new Error(
      `golden attack input missing: ${actionId}/${action.attackInputChainIdentity}/A${sequenceIndex}`
    );
  }
  const durationFrames = Number(attackInput.durationFrames);
  return factory.createWorkbenchActionDraft({
    id: actionId,
    type: 'skill',
    actorCharacterId,
    skillId: Number(action.skillId ?? mapping.sourceSkillId),
    actionVariantIndex: Number(mapping.actionVariantIndex),
    startMs,
    durationMs: frameToMs(durationFrames, frameRate),
    durationFrames,
    timingSource: attackInput.durationBasis ?? 'verified-attack-input-chain',
    timingStatus: 'applied',
    timingSourceIdentity: attackInput.durationSourceIdentity,
    needsTimingData: false,
    attackGroupId:
      action.attackGroupId ?? `golden-${action.attackInputChainIdentity}`,
    attackSequenceIndex: sequenceIndex,
    attackSequenceTotal: Number(chain.segments.length),
    attackInput: {
      ...attackInput,
      attackInputChainIdentity: action.attackInputChainIdentity,
    },
  });
}

function createGoldenActualProjection({
  ownerId,
  recipe,
  scenarioRecipe,
  result,
  project,
  comparison,
}) {
  const specialRuntime = result.verifiedCombatRuntime?.specialResourceRuntime;
  const actionSelections = [...(specialRuntime?.selectionByActionId ?? [])]
    .map(([actionId, selection]) => {
      const isGoldenOwner = Number(selection.ownerId) === ownerId;
      return {
        actionId,
        semanticName: selection.semanticName ?? null,
        controlSkillId: numberOrNull(
          selection.executionControlSkillId ?? selection.controlSkillId
        ),
        subSkillIndex: numberOrNull(selection.selectedSubSkillIndex),
        actualDurationFrames: numberOrNull(
          isGoldenOwner
            ? selection.actualDurationFrames
            : (selection.animationDurationFrames ??
                selection.actualDurationFrames)
        ),
        sourceKind: selection.sourceKind ?? null,
      };
    })
    .sort(compareIdentity);
  const executedActionIds = (result.actionExecutionPlan?.actions ?? [])
    .filter(action => action.execute)
    .map(action => action.actionId)
    .sort();
  const blockedActionIds = (result.actionExecutionPlan?.actions ?? [])
    .filter(action => !action.execute)
    .map(action => action.actionId)
    .sort();
  const damageTrace = (result.verifiedCombatRuntime?.damageEvents ?? []).map(
    event => ({
      eventId: event.id ?? event.eventId ?? null,
      eventType: event.type ?? null,
      actionId: event.actionId,
      frame: msToFrame(event.timeMs, scenarioRecipe.frameRate),
      hitIdentity: event.payload?.hitIdentity ?? null,
      rawDamage: numberOrNull(event.payload?.rawDamage),
      hpDamage: numberOrNull(
        event.payload?.hpDamage ?? event.payload?.rawDamage
      ),
      toughnessDamage: numberOrNull(event.payload?.toughnessDamage),
      actorSpRecovery: numberOrNull(event.payload?.actorSpRecovery),
      kiboSpRecovery: numberOrNull(event.payload?.kiboSpRecovery),
    })
  );
  const specialResourceTrace = [
    ...(specialRuntime?.resourceEvents ?? []).map(event => ({
      stream: 'resource',
      event,
    })),
    ...(specialRuntime?.stateEvents ?? []).map(event => ({
      stream: 'state',
      event,
    })),
  ]
    .map(({ stream, event }) => ({
      stream,
      eventId: event.id ?? event.eventId ?? null,
      actionId: event.actionId ?? null,
      frame: msToFrame(event.timeMs, scenarioRecipe.frameRate),
      operation: event.payload?.operation ?? null,
      resourceIdentity: event.payload?.resourceIdentity ?? null,
      stateElementId: numberOrNull(event.payload?.stateElementId),
      beforeValue: numberOrNull(event.payload?.beforeValue),
      change: numberOrNull(event.payload?.change),
      afterValue: numberOrNull(event.payload?.afterValue),
      durationMs: numberOrNull(event.payload?.stateDurationMs),
    }))
    .sort(compareFrameThenIdentity);
  const tuningMarkTrace = (
    result.verifiedTuningMarkGeneration?.events ??
    result.verifiedCombatRuntime?.tuningMarkRuntime?.events ??
    []
  )
    .map(event => ({
      eventIdentity: event.eventIdentity ?? event.id ?? null,
      actionId: event.actionId ?? null,
      frame: numberOrNull(
        event.frameIndex ?? msToFrame(event.timeMs, scenarioRecipe.frameRate)
      ),
      kind: event.kind ?? null,
      profileKey: event.profileKey ?? null,
      markId: numberOrNull(event.markId),
      before: numberOrNull(event.before),
      delta: numberOrNull(event.delta),
      after: numberOrNull(event.after),
      maximum: numberOrNull(event.maximum),
    }))
    .sort(compareFrameThenIdentity);
  const tuningMarkAcquireByActionId = Object.fromEntries(
    [
      ...new Set(
        tuningMarkTrace
          .filter(event => event.kind === 'acquire' && event.actionId)
          .map(event => event.actionId)
      ),
    ]
      .sort()
      .map(actionId => {
        const events = tuningMarkTrace.filter(
          event => event.kind === 'acquire' && event.actionId === actionId
        );
        return [
          actionId,
          {
            eventCount: events.length,
            totalDelta: roundNumber(
              events.reduce((sum, event) => sum + (Number(event.delta) || 0), 0)
            ),
          },
        ];
      })
  );
  const targetStateRuntime = specialRuntime?.targetStateRuntime;
  const targetStateTrace = (targetStateRuntime?.events ?? [])
    .map(event => ({
      eventId: event.id ?? event.eventId ?? null,
      actionId: event.actionId ?? null,
      frame: msToFrame(event.timeMs, scenarioRecipe.frameRate),
      stateIdentity: event.payload?.stateIdentity ?? null,
      stateName: event.payload?.stateName ?? null,
      operation: event.payload?.operation ?? null,
      beforeValue: numberOrNull(event.payload?.beforeValue),
      change: numberOrNull(event.payload?.change),
      afterValue: numberOrNull(event.payload?.afterValue),
      maxValue: numberOrNull(event.payload?.maxValue),
    }))
    .sort(compareFrameThenIdentity);
  const conditionalHitGroups = (targetStateRuntime?.groupResults ?? [])
    .map(result => ({
      actionId: result.actionId ?? null,
      groupIdentity: result.groupIdentity ?? null,
      frame: msToFrame(result.timeMs, scenarioRecipe.frameRate),
      stateIdentity: result.stateIdentity ?? null,
      beforeStacks: numberOrNull(result.beforeStacks),
      consumedStacks: numberOrNull(result.consumedStacks),
      afterStacks: numberOrNull(result.afterStacks),
      status: result.status ?? null,
      applied: result.applied === true,
    }))
    .sort(compareFrameThenIdentity);
  const selectedEffectIds = new Set([
    ...(recipe.goldenScenario?.traceSelectors?.passiveEffectIds ?? []),
    ...(recipe.goldenScenario?.traceSelectors?.stateEffectIds ?? []),
  ]);
  const effectTrace = (result.effectTimeline?.events ?? [])
    .filter(event => {
      const targetId = String(event.targetId ?? '');
      const sourceElementId = numberOrNull(event.sourceIdentity?.elementId);
      const sourceElementEffectId =
        sourceElementId == null ? null : `battle-element:${sourceElementId}`;
      return (
        Number(event.ownerId) === ownerId ||
        targetId === `actor-${ownerId}` ||
        selectedEffectIds.has(String(event.effectId ?? '')) ||
        selectedEffectIds.has(sourceElementEffectId)
      );
    })
    .map(event => {
      const sourceElementId = numberOrNull(event.sourceIdentity?.elementId);
      return {
        eventId: event.eventId ?? event.id ?? null,
        actionId: event.actionId ?? null,
        frame: msToFrame(event.timeMs, scenarioRecipe.frameRate),
        effectId:
          sourceElementId == null
            ? (event.effectId ?? null)
            : `battle-element:${sourceElementId}`,
        runtimeEffectId: event.effectId ?? null,
        sourceElementId,
        effectName: event.effectName ?? null,
        targetKind: event.targetKind ?? null,
        targetId: event.targetId ?? null,
        operation: event.operation ?? event.kind ?? null,
        beforeStacks: numberOrNull(event.before?.stacks),
        afterStacks: numberOrNull(event.after?.stacks),
        stackChange: numberOrNull(event.stackChange),
        expiresAtMs: numberOrNull(event.after?.expiresAtMs),
        modifiers: (event.modifiers ?? []).map(modifier => ({
          kind: modifier.kind ?? null,
          attributeId: numberOrNull(modifier.attributeId),
          bucket: modifier.bucket ?? null,
          valueRaw: numberOrNull(modifier.valueRaw),
          formulaFamily: modifier.formulaResult?.family ?? null,
          formulaValue: numberOrNull(modifier.formulaResult?.value),
        })),
      };
    })
    .sort(compareFrameThenIdentity);
  const combatRuntime = result.verifiedCombatRuntime ?? {};
  const actorSp = summarizeVerifiedEnergyRuntime({
    initialRows: combatRuntime.initialState?.actorEnergy,
    finalRows: combatRuntime.finalState?.actorEnergy,
    events: combatRuntime.resourceEvents,
    identityField: 'actorId',
    kind: 'actor',
  });
  const kiboSp = summarizeVerifiedEnergyRuntime({
    initialRows: combatRuntime.initialState?.kiboEnergy,
    finalRows: combatRuntime.finalState?.kiboEnergy,
    events: combatRuntime.kiboResourceEvents,
    identityField: 'slotId',
    kind: 'kibo',
  });
  const enemy = summarizeEnemyState({
    initial: combatRuntime.initialState?.enemy,
    final: combatRuntime.finalState?.enemy,
    pointCount: result.runtimeOutputs?.stateCurves?.enemy?.pointCount ?? 0,
  });
  const ownerActionIds = new Set(
    (project.actions ?? [])
      .filter(
        action =>
          String(action.actorId ?? '') === `actor-${ownerId}` ||
          Number(action.actor?.characterId) === ownerId
      )
      .map(action => action.id)
  );
  const dynamicPropertyActionKeys =
    recipe.goldenScenario?.traceSelectors?.dynamicPropertyActionKeys ?? [];
  const dynamicPropertyActionIds =
    dynamicPropertyActionKeys.length > 0
      ? new Set(dynamicPropertyActionKeys)
      : ownerActionIds;
  const ownerDamageEvents = damageTrace.filter(event =>
    ownerActionIds.has(event.actionId)
  );
  const ownerHitEvents = ownerDamageEvents.filter(
    event => event.eventType === 'VERIFIED_COMBAT_HIT'
  );
  const ownerHitCountByActionId = Object.fromEntries(
    [...new Set(ownerHitEvents.map(event => event.actionId))]
      .sort()
      .map(actionId => [
        actionId,
        ownerHitEvents.filter(event => event.actionId === actionId).length,
      ])
  );
  const ownerActorSp = actorSp.find(row => row.actorId === `actor-${ownerId}`);
  const ownerDirectSpTransactions = (
    ownerActorSp?.actionTransactions ?? []
  ).filter(transaction => transaction.reason === 'verified-direct-sp');
  const passiveEffectIds = new Set(
    recipe.goldenScenario?.traceSelectors?.passiveEffectIds ?? [
      'battle-element:101010206',
    ]
  );
  const stateEffectIds = new Set(
    recipe.goldenScenario?.traceSelectors?.stateEffectIds ?? [
      'battle-element:101010129',
    ]
  );
  const passiveTrace = effectTrace.filter(event =>
    passiveEffectIds.has(String(event.effectId ?? ''))
  );
  const passiveMaxStacks = Math.max(
    0,
    ...passiveTrace.map(event => Number(event.afterStacks) || 0)
  );
  const burstTrace = effectTrace.filter(event =>
    stateEffectIds.has(String(event.effectId ?? ''))
  );
  const selectedEffectSummaryByElementId =
    summarizeSelectedEffectsByElementId(effectTrace);
  const ownerDynamicPropertySources = collectDynamicPropertySources(
    result,
    null,
    ownerId,
    dynamicPropertyActionIds
  );

  const actual = {
    project: {
      durationMs: Number(project.time?.durationMs),
      actionCount: project.actions?.length ?? 0,
      teamCharacterIds: project.actors.map(actor => Number(actor.characterId)),
    },
    actions: {
      executedActionIds,
      blockedActionIds,
      selections: actionSelections,
      selectionByActionId: Object.fromEntries(
        actionSelections.map(selection => [
          selection.actionId,
          {
            semanticName: selection.semanticName,
            controlSkillId: selection.controlSkillId,
            subSkillIndex: selection.subSkillIndex,
            actualDurationFrames: selection.actualDurationFrames,
            sourceKind: selection.sourceKind,
          },
        ])
      ),
    },
    combat: {
      damageEventCount: damageTrace.length,
      ownerDamageEventCount: ownerDamageEvents.length,
      ownerHitEventCount: ownerHitEvents.length,
      ownerHitCountByActionId,
      totalHpDamage: sumNumbers(damageTrace, 'hpDamage'),
      totalToughnessDamage: sumNumbers(damageTrace, 'toughnessDamage'),
      ownerTotalHpDamage: sumNumbers(ownerDamageEvents, 'hpDamage'),
      ownerTotalToughnessDamage: sumNumbers(
        ownerDamageEvents,
        'toughnessDamage'
      ),
      enemy,
    },
    resources: {
      actorSp,
      kiboSp,
      actorSpByActorId: Object.fromEntries(
        actorSp.map(row => [row.actorId, row])
      ),
      kiboSpBySlotId: Object.fromEntries(kiboSp.map(row => [row.slotId, row])),
      specialResourceTrace,
      tuningMarkTrace,
      tuningMarkAcquireByActionId,
      targetStateTrace,
      conditionalHitGroups,
      targetStateSummary: targetStateRuntime?.summary ?? null,
      ownerDirectSp: {
        eventCount: ownerDirectSpTransactions.length,
        totalChange: roundNumber(
          ownerDirectSpTransactions.reduce(
            (sum, transaction) => sum + (Number(transaction.change) || 0),
            0
          )
        ),
      },
      thresholdClearCount: specialResourceTrace.filter(
        event =>
          event.stream === 'resource' && event.operation === 'threshold-clear'
      ).length,
      transformCount: specialResourceTrace.filter(
        event => event.stream === 'state' && event.operation === 'transform'
      ).length,
      refreshCount: specialResourceTrace.filter(
        event => event.stream === 'state' && event.operation === 'refresh'
      ).length,
    },
    effects: {
      passiveTrace,
      passiveMaxStacks,
      firstPassiveMaxStackFrame:
        passiveTrace.find(
          event => Number(event.afterStacks) === passiveMaxStacks
        )?.frame ?? null,
      burstTrace,
      selectedEffectSummaryByElementId,
      burstTransitions: burstTrace.map(event => ({
        actionId: event.actionId,
        frame: event.frame,
        operation: event.operation,
        expiresAtMs: event.expiresAtMs,
      })),
    },
    dynamicProperties: {
      ownerSources: ownerDynamicPropertySources,
      maxPercentRawByAttributeId: Object.fromEntries(
        [...new Set(ownerDynamicPropertySources.map(row => row.attributeId))]
          .filter(Number.isFinite)
          .map(attributeId => [
            attributeId,
            Math.max(
              ...ownerDynamicPropertySources
                .filter(row => row.attributeId === attributeId)
                .map(row => Number(row.dynamicPercentRaw) || 0)
            ),
          ])
      ),
      maxExtraRawByAttributeId: Object.fromEntries(
        [...new Set(ownerDynamicPropertySources.map(row => row.attributeId))]
          .filter(Number.isFinite)
          .map(attributeId => [
            attributeId,
            Math.max(
              ...ownerDynamicPropertySources
                .filter(row => row.attributeId === attributeId)
                .map(row => Number(row.dynamicExtraRaw) || 0)
            ),
          ])
      ),
    },
    comparison,
    trace: {
      damage: damageTrace,
      specialResources: specialResourceTrace,
      tuningMarks: tuningMarkTrace,
      targetStates: targetStateTrace,
      conditionalHitGroups,
      effects: effectTrace,
    },
  };
  actual.summaryHash = sha256Json({
    project: actual.project,
    actions: actual.actions,
    combat: actual.combat,
    resources: actual.resources,
    effects: actual.effects,
    dynamicProperties: actual.dynamicProperties,
    comparison: actual.comparison,
  });
  return actual;
}

function summarizeSelectedEffectsByElementId(effectTrace) {
  const byElementId = new Map();
  for (const event of effectTrace) {
    const elementId = numberOrNull(event.sourceElementId);
    if (elementId == null) continue;
    const rows = byElementId.get(elementId) ?? [];
    rows.push(event);
    byElementId.set(elementId, rows);
  }
  return Object.fromEntries(
    [...byElementId.entries()]
      .sort(([left], [right]) => left - right)
      .map(([elementId, rows]) => {
        const appliedRows = rows.filter(row => row.operation !== 'expire');
        const expiredRows = rows.filter(row => row.operation === 'expire');
        const modifierRows = appliedRows.flatMap(row => row.modifiers ?? []);
        return [
          String(elementId),
          {
            effectId: `battle-element:${elementId}`,
            effectNames: [...new Set(rows.map(row => row.effectName))]
              .filter(Boolean)
              .sort(),
            targetKinds: [...new Set(rows.map(row => row.targetKind))]
              .filter(Boolean)
              .sort(),
            targetIds: [...new Set(rows.map(row => row.targetId))]
              .filter(Boolean)
              .sort(),
            appliedEventCount: appliedRows.length,
            expiredEventCount: expiredRows.length,
            firstAppliedFrame: appliedRows[0]?.frame ?? null,
            firstExpiredFrame: expiredRows[0]?.frame ?? null,
            maxStacks: Math.max(
              0,
              ...appliedRows.map(row => Number(row.afterStacks) || 0)
            ),
            attributeIds: [
              ...new Set(
                modifierRows
                  .map(row => numberOrNull(row.attributeId))
                  .filter(Number.isFinite)
              ),
            ].sort((left, right) => left - right),
            formulaFamilies: [
              ...new Set(
                modifierRows.map(row => row.formulaFamily).filter(Boolean)
              ),
            ].sort(),
            formulaValues: [
              ...new Set(
                modifierRows
                  .map(row => numberOrNull(row.formulaValue))
                  .filter(Number.isFinite)
              ),
            ].sort((left, right) => left - right),
          },
        ];
      })
  );
}

function summarizeVerifiedEnergyRuntime({
  initialRows = [],
  finalRows = [],
  events = [],
  identityField,
  kind,
}) {
  const initialByIdentity = new Map(
    (initialRows ?? []).map(row => [String(row[identityField]), row])
  );
  const finalByIdentity = new Map(
    (finalRows ?? []).map(row => [String(row[identityField]), row])
  );
  const eventGroups = new Map();
  for (const event of events ?? []) {
    const identity = String(
      event[identityField] ??
        event.payload?.[identityField] ??
        (identityField === 'slotId' ? event.payload?.slotId : event.actorId)
    );
    const rows = eventGroups.get(identity) ?? [];
    rows.push(event);
    eventGroups.set(identity, rows);
  }
  const identities = new Set([
    ...initialByIdentity.keys(),
    ...finalByIdentity.keys(),
    ...eventGroups.keys(),
  ]);
  return [...identities]
    .map(identity => {
      const initial = initialByIdentity.get(identity) ?? {};
      const final = finalByIdentity.get(identity) ?? {};
      const rows = eventGroups.get(identity) ?? [];
      const autoRecovery = aggregateEnergyEvents(
        rows.filter(event =>
          String(event.payload?.reason ?? '').startsWith('verified-auto-sp-')
        )
      );
      const actionTransactions = rows
        .filter(
          event =>
            !String(event.payload?.reason ?? '').startsWith('verified-auto-sp-')
        )
        .map(event => ({
          timeMs: numberOrNull(event.timeMs),
          actionId: event.actionId ?? null,
          reason: event.payload?.reason ?? null,
          beforeValue: numberOrNull(event.payload?.beforeValue),
          change: numberOrNull(event.payload?.change),
          afterValue: numberOrNull(event.payload?.afterValue),
        }));
      return {
        kind,
        [identityField]: identity,
        actorId: final.actorId ?? initial.actorId ?? null,
        kiboId: numberOrNull(final.kiboId ?? initial.kiboId),
        initialValue: numberOrNull(initial.currentValue),
        currentValue: numberOrNull(final.currentValue),
        maxValue: numberOrNull(final.maxValue ?? initial.maxValue),
        eventCount: rows.length,
        autoRecovery,
        actionTransactions,
      };
    })
    .sort((left, right) =>
      String(left[identityField]).localeCompare(String(right[identityField]))
    );
}

function aggregateEnergyEvents(events) {
  const byReason = new Map();
  for (const event of events) {
    const reason = String(event.payload?.reason ?? 'unknown');
    const current = byReason.get(reason) ?? {
      reason,
      count: 0,
      totalChange: 0,
      firstTimeMs: null,
      lastTimeMs: null,
    };
    current.count += 1;
    current.totalChange += Number(event.payload?.change ?? 0);
    current.firstTimeMs =
      current.firstTimeMs == null
        ? Number(event.timeMs)
        : Math.min(current.firstTimeMs, Number(event.timeMs));
    current.lastTimeMs =
      current.lastTimeMs == null
        ? Number(event.timeMs)
        : Math.max(current.lastTimeMs, Number(event.timeMs));
    byReason.set(reason, current);
  }
  return [...byReason.values()]
    .map(row => ({
      ...row,
      totalChange: roundNumber(row.totalChange),
    }))
    .sort((left, right) => left.reason.localeCompare(right.reason));
}

function summarizeEnemyState({ initial = {}, final = {}, pointCount = 0 }) {
  return {
    pointCount,
    initialHp: numberOrNull(initial.hp),
    finalHp: numberOrNull(final.hp),
    maxHp: numberOrNull(final.maxHp ?? initial.maxHp),
    initialToughness: numberOrNull(initial.toughness),
    finalToughness: numberOrNull(final.toughness),
    maxToughness: numberOrNull(final.maxToughness ?? initial.maxToughness),
  };
}

function collectDynamicPropertySources(
  result,
  actionId = null,
  ownerId = null,
  ownerActionIds = null
) {
  const sources = (result.verifiedCombatRuntime?.damageEvents ?? [])
    .filter(
      event =>
        (!actionId || event.actionId === actionId) &&
        (!ownerId ||
          ownerActionIds?.has(event.actionId) ||
          Number(event.payload?.ownerId) === ownerId)
    )
    .flatMap(event => event.payload?.dynamicPropertyTrace?.source ?? [])
    .map(source => ({
      attributeId: numberOrNull(source.attributeId),
      dynamicBaseRaw: numberOrNull(source.dynamicBaseRaw),
      dynamicPercentRaw: numberOrNull(source.dynamicPercentRaw),
      dynamicExtraRaw: numberOrNull(source.dynamicExtraRaw),
      effectIds: (source.effects ?? [])
        .map(effect => effect.effectId)
        .filter(Boolean)
        .sort(),
    }));
  const deduped = new Map();
  for (const source of sources) {
    deduped.set(JSON.stringify(source), source);
  }
  return [...deduped.values()].sort(
    (left, right) =>
      Number(left.attributeId) - Number(right.attributeId) ||
      JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

function createCompactReplaySignature(result) {
  return {
    executedActionIds: (result.actionExecutionPlan?.actions ?? [])
      .filter(action => action.execute)
      .map(action => action.actionId)
      .sort(),
    damage: (result.verifiedCombatRuntime?.damageEvents ?? []).map(event => [
      event.actionId,
      event.timeMs,
      event.payload?.rawDamage,
      event.payload?.toughnessDamage,
    ]),
    specialResources: (
      result.verifiedCombatRuntime?.specialResourceRuntime?.resourceEvents ?? []
    ).map(event => [
      event.actionId,
      event.timeMs,
      event.payload?.operation,
      event.payload?.beforeValue,
      event.payload?.afterValue,
    ]),
  };
}

function createTeamSlots(scenarioRecipe) {
  return scenarioRecipe.teamCharacterIds.map((characterId, position) => ({
    slotId: `team-slot-${position + 1}`,
    position,
    characterId: Number(characterId),
  }));
}

function createRuntimeInstallPackage(mechanicsPackage) {
  const value = JSON.parse(JSON.stringify(mechanicsPackage));
  value.characterCombatProfileCatalog = {
    schemaVersion: 1,
    kind: 'azpr-character-combat-profile-catalog',
    status: 'character-combat-profile-catalog-ready',
    sourcePackageHash: value.packageHash,
    profileSchema: 'azpr://schemas/character-combat-profile/v1',
    profiles: [],
    coverageManifestHash: sha256Json({
      kind: 'golden-runtime-transient-profile-catalog',
      sourcePackageHash: value.packageHash,
    }),
    summary: {
      publicCharacterCount: 20,
      compiledProfileCount: 0,
      runtimeAppliedProfileCount: 0,
      uiVerifiedProfileCount: 0,
      characterCompleteCount: 0,
    },
  };
  value.summary = {
    ...value.summary,
    characterCombatProfileCount: 0,
    characterCombatRuntimeAppliedProfileCount: 0,
    characterCombatUiVerifiedProfileCount: 0,
    characterCombatCompleteProfileCount: 0,
  };
  return value;
}

function resolveActionMapping({
  mechanicsPackage,
  ownerKind,
  ownerId,
  actionKind,
  actionVariantIndex,
}) {
  const candidates = mechanicsPackage.actionMappings.filter(
    mapping =>
      mapping.ownerKind === ownerKind &&
      Number(mapping.ownerId) === Number(ownerId) &&
      mapping.actionKind === actionKind
  );
  if (actionVariantIndex == null) return candidates[0] ?? null;
  return (
    candidates.find(
      mapping =>
        Number(mapping.actionVariantIndex) === Number(actionVariantIndex)
    ) ?? null
  );
}

function resolveMappingDurationFrames(
  mapping,
  selectedSubSkillIndex,
  mechanicsPackage,
  explicitControlSkillId = null
) {
  const timing =
    selectedSubSkillIndex == null
      ? mapping.actionTiming
      : mapping.actionTiming?.variantTimings?.find(
          variant =>
            Number(variant.subSkillIndex) === Number(selectedSubSkillIndex)
        );
  let value = Number(timing?.occupancy?.durationFrames);
  if (!Number.isInteger(value) || value <= 0) {
    const controlSkillId = Number(
      explicitControlSkillId ?? mapping.controlSkillId
    );
    const controlContract =
      mechanicsPackage.actionVariantGraph?.derivedControlContracts?.find(
        contract =>
          contract.ownerKind === mapping.ownerKind &&
          Number(contract.ownerId) === Number(mapping.ownerId) &&
          Number(contract.controlSkillId) === controlSkillId
      );
    const resolvedSubSkillIndex =
      selectedSubSkillIndex ??
      controlContract?.selectedSubSkillIndex ??
      controlContract?.defaultSelection?.subSkillIndex ??
      0;
    value = Number(
      controlContract?.variants?.find(
        variant =>
          Number(variant.subSkillIndex) === Number(resolvedSubSkillIndex)
      )?.durationFrames
    );
  }
  if (!Number.isInteger(value) || value <= 0) {
    const actionForm =
      mechanicsPackage.actionVariantGraph?.publicActionForms?.find(
        form =>
          Number(form.ownerId) === Number(mapping.ownerId) &&
          form.publicActionKind === mapping.actionKind &&
          Number(form.publicControlSkillId) ===
            Number(mapping.controlSkillId) &&
          (selectedSubSkillIndex == null ||
            Number(form.executionSubSkillIndex) ===
              Number(selectedSubSkillIndex)) &&
          form.applied === true
      );
    value = Number(actionForm?.executionTiming?.occupancy?.durationFrames);
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `golden action duration missing: ${mapping.identity}/${selectedSubSkillIndex}`
    );
  }
  return value;
}

function sumActionDamage(result, actionId) {
  return (result.verifiedCombatRuntime?.damageEvents ?? [])
    .filter(event => event.actionId === actionId)
    .reduce((sum, event) => sum + Number(event.payload?.rawDamage ?? 0), 0);
}

function sumNumbers(rows, field) {
  return roundNumber(
    rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0)
  );
}

function compareIdentity(left, right) {
  return String(left.actionId ?? left.eventId ?? '').localeCompare(
    String(right.actionId ?? right.eventId ?? '')
  );
}

function compareFrameThenIdentity(left, right) {
  return (
    Number(left.frame ?? 0) - Number(right.frame ?? 0) ||
    String(left.eventId ?? left.actionId ?? '').localeCompare(
      String(right.eventId ?? right.actionId ?? '')
    )
  );
}

function frameToMs(frame, frameRate = DEFAULT_FRAME_RATE) {
  return (Number(frame) * 1000) / Number(frameRate);
}

function msToFrame(timeMs, frameRate = DEFAULT_FRAME_RATE) {
  return Math.round((Number(timeMs) * Number(frameRate)) / 1000);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function numberOrNull(value) {
  const number = Number(value);
  return value != null && Number.isFinite(number) ? number : null;
}

function roundNumber(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function sha256Json(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}
