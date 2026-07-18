import {
  createThreeValueCalculatorResult,
  getThreeValueCalculatorKeys,
  summarizeThreeValueCalculators,
} from '../threeValueCalculatorAdapters';
import {
  AZPR_TIMELINE_FRAME_MS,
  AZPR_TIMELINE_FRAME_RATE,
  createThreeValueDeltaGenerationInput,
} from './threeValueDeltaGenerationInput';
import {
  THREE_VALUE_MECHANISM_CONTEXT_CONTRACT_NAME,
  THREE_VALUE_MECHANISM_CONTEXT_CONTRACT_VERSION,
  createThreeValueMechanismContext,
} from '../mechanics/threeValueMechanismContext';
import {
  THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
  THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
  THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_NAME,
  THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_VERSION,
  THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME,
  THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_VERSION,
  createThreeValueMechanicsAdapterRequest,
  createThreeValueMechanicsOperands,
} from '../mechanics/threeValueMechanicsAdapter';
import {
  THREE_VALUE_MECHANICS_PROFILE_CONTRACT_NAME,
  THREE_VALUE_MECHANICS_PROFILE_CONTRACT_VERSION,
} from '../mechanics/threeValueMechanicsProfile';
import { createThreeValueMechanicsLayerInputs } from '../mechanics/threeValueMechanicsLayerInputs';

const THREE_VALUE_GENERATION_TRACK_ORDER = [
  'enemyHpDamage',
  'enemyToughnessDamage',
  'selfEnergyChange',
];
const THREE_VALUE_GENERATION_LAYER_ORDER = [
  'applied',
  'candidate',
  'sampled',
  'placeholder',
];
export const ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME =
  'Action -> Hit -> ThreeValueDelta';

export const THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY = {
  enemyHpDamage: 'hpDelta',
  enemyToughnessDamage: 'toughnessDelta',
  selfEnergyChange: 'energyDelta',
};

export const THREE_VALUE_DELTA_FIELDS = [
  'hpDelta',
  'toughnessDelta',
  'energyDelta',
];

export function createThreeValueGenerationLayer({
  scenario,
  actionResultTimeline,
  candidateValueSeries,
  runtimeSampleContext,
  stateCurves,
  actionExecutionPlan,
}) {
  const executionScope = createGenerationExecutionScope({
    scenario,
    actionResultTimeline,
    candidateValueSeries,
    stateCurves,
    actionExecutionPlan,
  });
  const actionsById = new Map(
    (executionScope.scenario?.actions ?? []).map(action => [action.id, action])
  );
  const generationInput = createThreeValueDeltaGenerationInput({
    scenario: executionScope.scenario,
    actionResultTimeline: executionScope.actionResultTimeline,
    candidateValueSeries: executionScope.candidateValueSeries,
    runtimeSampleContext,
    stateCurves: executionScope.stateCurves,
  });
  const deltas = createThreeValueGenerationDeltas({
    scenario: executionScope.scenario,
    actionsById,
    tracks: generationInput.tracks,
  });
  const valueSourceSlots = createThreeValueGenerationValueSourceSlots({
    generationInput,
    deltas,
  });
  const actions = createThreeValueGenerationActions({
    actionsById,
    deltas,
  });
  const hits = createThreeValueGenerationHits(actions);
  const summary = {
    ...summarizeThreeValueGenerationLayer({
      actions,
      hits,
      deltas,
      valueSourceSlots,
    }),
    executionPlanActionCount: executionScope.summary.actionCount,
    executionPlanExecutedActionCount:
      executionScope.summary.executedActionCount,
    executionPlanSkippedActionCount: executionScope.summary.skippedActionCount,
  };
  const standardContract = createActionHitThreeValueDeltaStandardContract({
    actions,
    hits,
    deltas,
    valueSourceSlots,
    summary,
  });

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-standard-three-value-generation-layer',
    status:
      deltas.length > 0
        ? 'standard-three-value-generation-layer-ready'
        : 'standard-three-value-generation-layer-empty',
    contract: {
      name: ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
      version: 10,
      frameRate: AZPR_TIMELINE_FRAME_RATE,
      frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
      deltaFields: THREE_VALUE_DELTA_FIELDS,
      aggregateFields: THREE_VALUE_DELTA_FIELDS,
      aggregateLayerKeys: THREE_VALUE_GENERATION_LAYER_ORDER,
      requiredDeltaFields: [
        'actionId',
        'hitKey',
        'frameIndex',
        'timeMs',
        'trackKey',
        'layerKey',
        'delta',
        'sourceKind',
        'sourceIds',
        'confidence',
        'mechanismContext',
        'mechanicsAdapterRequest',
      ],
      mechanicsAdapterContract: {
        name: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
        version: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
        requiredInputs: [
          'action',
          'hit',
          'mechanismConfiguration',
          'mechanicsProfile',
          'mechanicsLayerInputs',
          'sourceValue',
          'stateBefore',
        ],
        generationBoundInputs: [
          'action',
          'hit',
          'mechanismConfiguration',
          'mechanicsProfile',
          'mechanicsLayerInputs',
          'sourceValue',
        ],
        runtimeBoundInputs: ['stateBefore'],
        registrationKeys: THREE_VALUE_GENERATION_TRACK_ORDER,
        sourceOperandsContract: {
          name: THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME,
          version: THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_VERSION,
          requiredFields: ['trackKey', 'kind', 'inputs', 'expectedDelta'],
          hpRawPreviewRequiredFields: [
            'sourceBinding',
            'sourceBindingValidation',
          ],
          appliedSourceBindingFields: [
            'sourceBindingRequired',
            'sourceBindingReady',
            'sourceBindingStatus',
            'sourceBindingKind',
            'sourceBindingIdentity',
          ],
        },
        mechanicsProfileContract: {
          name: THREE_VALUE_MECHANICS_PROFILE_CONTRACT_NAME,
          version: THREE_VALUE_MECHANICS_PROFILE_CONTRACT_VERSION,
          selectionPath: 'scenario.mechanicsProfile',
        },
        evaluationContract: {
          name: THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_NAME,
          version: THREE_VALUE_MECHANICS_EVALUATION_CONTRACT_VERSION,
          input: 'mechanicsLayerInputs',
        },
        policy:
          'all applied HP, toughness and self-energy deltas use the same registrable mechanics adapter invocation contract',
      },
      calculatorContract: {
        name: 'ThreeValueDeltaCalculator',
        version: 3,
        requiredInputs: ['trackKey', 'delta', 'mechanismContext'],
        outputFields: THREE_VALUE_DELTA_FIELDS,
        requiredOutputs: [
          'delta',
          'status',
          'sourceIds',
          'confidence',
          'replaceable',
          'mechanismContextStatus',
          'mechanismConfigurationStatus',
        ],
        calculatorKeys: getThreeValueCalculatorKeys(),
        policy:
          'current HP/toughness/self-energy formulas are adapter outputs and remain replaceable until final AzPr formulas are confirmed',
      },
      mechanismContextContract: {
        name: THREE_VALUE_MECHANISM_CONTEXT_CONTRACT_NAME,
        version: THREE_VALUE_MECHANISM_CONTEXT_CONTRACT_VERSION,
        requiredSections: [
          'action',
          'hit',
          'timing',
          'sourceActor',
          'targetEnemy',
          'configuration',
          'ownership',
        ],
        policy:
          'mechanism context provides stable sources, targets and state baselines without applying unconfirmed formulas',
      },
      executionPlanContract: {
        name: actionExecutionPlan?.contractName ?? 'none',
        version: actionExecutionPlan?.schemaVersion ?? 0,
        policy:
          'confirmed blocked actions are excluded; unresolved conditions remain executable',
      },
      valueSourceSlotContract: {
        name: 'ThreeValueReplaceableSourceSlot',
        version: 1,
        keyFields: ['trackKey', 'layerKey'],
        runtimeEligibleLayerKey: 'applied',
        replaceableLayerKeys: ['candidate', 'sampled', 'placeholder'],
        policy:
          'each track/layer slot is a stable replacement point for future confirmed AzPr formula, toughness, or energy sources',
      },
    },
    generationInput,
    actionExecutionPlan,
    executionScope: executionScope.summary,
    inputSources: generationInput.inputSources,
    inputSourceKind: generationInput.sourceKind,
    inputStatus: generationInput.status,
    replacementPolicy:
      'candidate, sampled and placeholder deltas can be replaced by later confirmed formulas without changing action/hit/track keys',
    valueSourceSlots,
    standardContract,
    actions,
    hits,
    deltas,
    summary,
    applied: false,
  };
}

function createGenerationExecutionScope({
  scenario,
  actionResultTimeline,
  candidateValueSeries,
  stateCurves,
  actionExecutionPlan,
}) {
  if (!actionExecutionPlan) {
    const actionCount = scenario?.actions?.length ?? 0;
    return {
      scenario,
      actionResultTimeline,
      candidateValueSeries,
      stateCurves,
      summary: {
        actionCount,
        executedActionCount: actionCount,
        skippedActionCount: 0,
      },
    };
  }

  const executableActionIds = new Set(
    actionExecutionPlan.executedActionIds ?? []
  );
  const includePoint = point =>
    !point?.actionId || executableActionIds.has(point.actionId);
  const filterSeries = series => ({
    ...series,
    points: (series?.points ?? []).filter(includePoint),
  });
  const scopedCandidateValueSeries = candidateValueSeries
    ? {
        ...candidateValueSeries,
        series: (candidateValueSeries.series ?? []).map(filterSeries),
        chart: candidateValueSeries.chart
          ? {
              ...candidateValueSeries.chart,
              series: (candidateValueSeries.chart.series ?? []).map(
                filterSeries
              ),
            }
          : candidateValueSeries.chart,
      }
    : candidateValueSeries;
  const scopedStateCurves = stateCurves
    ? {
        ...stateCurves,
        tracks: (stateCurves.tracks ?? []).map(track => ({
          ...track,
          layers: (track.layers ?? []).map(layer => ({
            ...layer,
            points: (layer.points ?? []).filter(includePoint),
          })),
        })),
      }
    : stateCurves;

  return {
    scenario: {
      ...scenario,
      actions: (scenario?.actions ?? []).filter(action =>
        executableActionIds.has(action.id)
      ),
    },
    actionResultTimeline: (actionResultTimeline ?? []).filter(includePoint),
    candidateValueSeries: scopedCandidateValueSeries,
    stateCurves: scopedStateCurves,
    summary: {
      actionCount: actionExecutionPlan.summary?.actionCount ?? 0,
      executedActionCount:
        actionExecutionPlan.summary?.executedActionCount ?? 0,
      skippedActionCount: actionExecutionPlan.summary?.skippedActionCount ?? 0,
    },
  };
}

function createThreeValueGenerationDeltas({ scenario, actionsById, tracks }) {
  const deltas = [];
  for (const track of tracks ?? []) {
    for (const layer of track.layers ?? []) {
      for (const [pointIndex, point] of (layer.points ?? []).entries()) {
        const delta = createThreeValueGenerationDelta({
          scenario,
          actionsById,
          track,
          layer,
          point,
          pointIndex,
        });
        if (delta) {
          deltas.push(delta);
        }
      }
    }
  }
  return deltas.sort(compareThreeValueGenerationDeltas);
}

function createThreeValueGenerationDelta({
  scenario,
  actionsById,
  track,
  layer,
  point,
  pointIndex,
}) {
  const deltaValue = numberOrNull(point.delta);
  if (!Number.isFinite(deltaValue)) {
    return null;
  }

  const action = actionsById.get(point.actionId);
  const frameIndex =
    numberOrNull(point.frameIndex) ?? msToTimelineFrame(point.timeMs ?? 0);
  const timeMs =
    numberOrNull(point.timeMs) ??
    roundTimelineMs(frameIndex * AZPR_TIMELINE_FRAME_MS);
  const trackKey = track.trackKey;
  const layerKey = layer.key;
  const valueField = THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY[trackKey] ?? null;
  const deltaFields = createThreeValueDeltaFields(trackKey, deltaValue);
  const sourceKind = point.sourceKind ?? layer.sourceKind;
  const sourceIds = createThreeValueGenerationSourceIds(point);
  const confidence = createThreeValueGenerationConfidence({
    point,
    layerKey,
  });
  const sourceStatus = point.sourceStatus ?? point.resultStatus ?? null;
  const resultStatus = point.resultStatus ?? null;
  const applied = Boolean(point.applied && layer.applied);
  const hitIndex = numberOrNull(point.hitIndex);
  const hitKey = createThreeValueGenerationHitKey({
    point,
    layerKey,
    frameIndex,
    pointIndex,
  });
  const mechanismContext = createThreeValueMechanismContext({
    scenario,
    action,
    point,
    trackKey,
    hitKey,
    frameIndex,
    timeMs,
    sourceIds,
  });
  const calculator = createThreeValueCalculatorResult({
    trackKey,
    layerKey,
    point,
    layer,
    delta: deltaValue,
    deltaFields,
    sourceKind,
    sourceIds,
    confidence,
    sourceStatus,
    resultStatus,
    applied,
    mechanismContext,
  });
  const sourceValue = {
    value: deltaValue,
    ...deltaFields,
    sourceKind,
    sourceIds,
    confidence,
    status: calculator.status,
    operands:
      point.mechanicsOperands ??
      createThreeValueMechanicsOperands({
        trackKey,
        sourceKind,
        value: deltaValue,
      }),
  };
  const mechanicsAdapterRequest = createThreeValueMechanicsAdapterRequest({
    trackKey,
    outputField: valueField,
    action: mechanismContext.action,
    hit: mechanismContext.hit,
    mechanismConfiguration: mechanismContext.configuration,
    mechanicsProfile: mechanismContext.mechanicsProfile,
    mechanicsLayerInputs: createThreeValueMechanicsLayerInputs({
      trackKey,
      mechanicsProfile: mechanismContext.mechanicsProfile,
      mechanismContext,
      sourceValue,
    }),
    sourceValue,
  });
  const valueSource = createThreeValueGenerationDeltaValueSource({
    trackKey,
    trackLabel: track.label,
    layerKey,
    layerLabel: layer.label,
    valueField,
    valueUnit: layer.valueUnit ?? track.valueUnit,
    sourceKind,
    sourceStatus,
    resultStatus,
    sourceIds,
    confidence,
    mechanismContext,
    calculator,
    applied,
  });

  return {
    id: createThreeValueGenerationDeltaId({
      actionId: point.actionId,
      hitKey,
      trackKey,
      layerKey,
      frameIndex,
      pointIndex,
    }),
    actionId: point.actionId ?? null,
    actionName: point.actionName ?? action?.name ?? null,
    actionType: action?.type ?? null,
    gameDataReference: action?.gameDataReference ?? null,
    skillReferenceRequired: action?.type === 'skill',
    skillReferenceReady:
      action?.type === 'skill'
        ? action?.gameDataReference?.ready === true
        : null,
    actorId: point.actorId ?? action?.actorId ?? null,
    actorName: point.actorName ?? action?.actor?.name ?? null,
    hitKey,
    hitIndex: Number.isFinite(hitIndex) ? hitIndex : null,
    hitSkillId: numberOrNull(point.hitSkillId),
    frameIndex,
    frameLabel: point.frameLabel ?? formatTimelineFrame(frameIndex),
    timeMs: roundTimelineMs(timeMs),
    trackKey,
    trackLabel: track.label,
    layerKey,
    layerLabel: layer.label,
    valueField,
    valueUnit: layer.valueUnit ?? track.valueUnit,
    delta: deltaValue,
    ...deltaFields,
    sourceKind,
    sourceIds,
    confidence,
    sourceStatus,
    resultStatus,
    mechanismContext,
    mechanismContextStatus: mechanismContext.status,
    mechanismContextReady: mechanismContext.ready,
    mechanismConfigurationStatus: mechanismContext.configurationStatus,
    mechanismConfigurationReady: mechanismContext.configurationReady,
    mechanicsAdapterRequest,
    appliedSourceBindingState: !applied
      ? null
      : sourceValue.operands?.sourceBindingRequired === true
        ? sourceValue.operands?.sourceBindingReady === true
          ? 'bound-ready'
          : 'bound-drift'
        : 'compatible-unbound',
    appliedSourceBindingKind: sourceValue.operands?.sourceBindingKind ?? null,
    appliedSourceBindingIdentity:
      sourceValue.operands?.sourceBindingIdentity ?? null,
    appliedSourceBindingRequired:
      applied && sourceValue.operands?.sourceBindingRequired === true,
    appliedSourceBindingReady:
      applied && sourceValue.operands?.sourceBindingRequired === true
        ? sourceValue.operands?.sourceBindingReady === true
        : null,
    appliedSourceBindingStatus:
      sourceValue.operands?.sourceBindingStatus ?? null,
    hpOperandSourceBindingRequired:
      sourceValue.operands?.sourceBindingRequired === true,
    hpOperandSourceBindingReady:
      sourceValue.operands?.sourceBindingRequired === true
        ? sourceValue.operands?.sourceBindingReady === true
        : null,
    hpOperandSourceBindingStatus:
      sourceValue.operands?.sourceBindingStatus ?? null,
    calculator,
    calculatorKey: calculator.key,
    calculatorVersion: calculator.version,
    calculationKind: calculator.kind,
    calculationStatus: calculator.status,
    calculationReplaceable: calculator.replaceable,
    valueSourceKey: valueSource.key,
    valueSource,
    candidateCount: numberOrNull(point.candidateCount),
    sequenceIndex: numberOrNull(point.sequenceIndex) ?? pointIndex,
    runtimeSequenceIndex:
      numberOrNull(point.runtimeSequenceIndex) ??
      numberOrNull(point.sequenceIndex) ??
      pointIndex,
    stateCurveSequenceIndex: numberOrNull(point.sequenceIndex) ?? pointIndex,
    applied,
    replaceable: !applied,
  };
}

function createThreeValueGenerationDeltaValueSource({
  trackKey,
  trackLabel,
  layerKey,
  layerLabel,
  valueField,
  valueUnit,
  sourceKind,
  sourceStatus,
  resultStatus,
  sourceIds,
  confidence,
  mechanismContext,
  calculator,
  applied,
}) {
  const replaceable = !applied;
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-delta-value-source',
    key: createThreeValueGenerationValueSourceSlotKey({
      trackKey,
      layerKey,
    }),
    trackKey,
    trackLabel,
    layerKey,
    layerLabel,
    valueField,
    valueUnit,
    valueSourceKind: sourceKind ?? '',
    valueSourceStatus: sourceStatus ?? resultStatus ?? '',
    sourceIds,
    confidence: confidence ?? '',
    mechanismContextStatus: mechanismContext?.status ?? '',
    mechanismContextReady: mechanismContext?.ready === true,
    calculatorKey: calculator?.key ?? '',
    calculationStatus: calculator?.status ?? '',
    runtimeEligible: Boolean(applied),
    replaceable,
    replacementScope: applied ? 'runtime-applied' : 'diagnostic-replaceable',
    applied: Boolean(applied),
  };
}

function createThreeValueGenerationValueSourceSlots({
  generationInput,
  deltas,
}) {
  const deltasBySlotKey = new Map();
  for (const delta of deltas ?? []) {
    const key = createThreeValueGenerationValueSourceSlotKey(delta);
    if (!deltasBySlotKey.has(key)) {
      deltasBySlotKey.set(key, []);
    }
    deltasBySlotKey.get(key).push(delta);
  }

  return (generationInput?.tracks ?? []).flatMap(track =>
    (track.layers ?? []).map(layer => {
      const key = createThreeValueGenerationValueSourceSlotKey({
        trackKey: track.trackKey,
        layerKey: layer.key,
      });
      const slotDeltas = deltasBySlotKey.get(key) ?? [];
      const runtimeEligible = Boolean(layer.applied);
      const replaceable = !runtimeEligible;
      return {
        schemaVersion: 1,
        sourceKind: 'azpr-three-value-replaceable-source-slot',
        status:
          slotDeltas.length > 0
            ? 'value-source-slot-ready'
            : 'value-source-slot-empty',
        key,
        trackKey: track.trackKey,
        trackLabel: track.label,
        layerKey: layer.key,
        layerLabel: layer.label,
        valueField: THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY[track.trackKey] ?? '',
        valueUnit: layer.valueUnit ?? track.valueUnit ?? '',
        inputSourceKind: layer.sourceKind ?? '',
        inputStatus: layer.status ?? '',
        pointCount: numberOrNull(layer.pointCount) ?? 0,
        deltaCount: slotDeltas.length,
        appliedDeltaCount: slotDeltas.filter(delta => delta.applied).length,
        replaceableDeltaCount: slotDeltas.filter(delta => delta.replaceable)
          .length,
        sourceKinds: uniqueStrings(slotDeltas.map(delta => delta.sourceKind)),
        calculatorKeys: uniqueStrings(
          slotDeltas.map(delta => delta.calculatorKey)
        ),
        confidenceKeys: uniqueStrings(
          slotDeltas.map(delta => delta.confidence)
        ),
        runtimeEligible,
        replaceable,
        replacementPolicy: runtimeEligible
          ? 'runtime consumes this slot now; later confirmed formulas may replace the upstream applied value before runtime input is built'
          : 'diagnostic slot stays outside runtime totals until promoted or replaced by a confirmed source',
        applied: false,
      };
    })
  );
}

function createThreeValueGenerationValueSourceSlotKey({ trackKey, layerKey }) {
  return [trackKey ?? 'unknown-track', layerKey ?? 'unknown-layer']
    .map(createThreeValueGenerationIdPart)
    .join(':');
}

function createThreeValueDeltaFields(trackKey, delta) {
  return Object.fromEntries(
    THREE_VALUE_DELTA_FIELDS.map(field => [
      field,
      THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY[trackKey] === field ? delta : null,
    ])
  );
}

function createThreeValueGenerationHitKey({
  point,
  layerKey,
  frameIndex,
  pointIndex,
}) {
  if (point.hitKey) {
    return String(point.hitKey);
  }
  const hitIndex = numberOrNull(point.hitIndex);
  if (Number.isFinite(hitIndex)) {
    return `hit-${hitIndex}`;
  }
  if (point.eventType) {
    return `event-${point.eventType}-${point.eventIndex ?? pointIndex}`;
  }
  return `${layerKey}-frame-${frameIndex}-point-${point.sequenceIndex ?? pointIndex}`;
}

function createThreeValueGenerationDeltaId({
  actionId,
  hitKey,
  trackKey,
  layerKey,
  frameIndex,
  pointIndex,
}) {
  return [
    actionId ?? 'system',
    hitKey,
    trackKey,
    layerKey,
    frameIndex,
    pointIndex,
  ]
    .map(createThreeValueGenerationIdPart)
    .join('|');
}

function createThreeValueGenerationIdPart(value) {
  return String(value ?? 'none').replace(/\|/g, '/');
}

function createThreeValueGenerationSourceIds(point) {
  return {
    skillIds: uniqueNumbers([point.skillId, point.hitSkillId]),
    elementConfigIds: uniqueNumbers([
      ...(point.elementConfigIds ?? []),
      point.sourceElementConfigId,
      point.elementConfigId,
    ]),
    captureSessionIds: uniqueStrings([point.captureSessionId]),
    pathIds: uniqueStrings([point.pathId]),
  };
}

function createThreeValueGenerationConfidence({ point, layerKey }) {
  if (point.confidence) {
    return point.confidence;
  }
  if (layerKey === 'sampled') {
    return 'sampled';
  }
  if (layerKey === 'candidate') {
    return 'candidate';
  }
  if (layerKey === 'placeholder') {
    return 'placeholder';
  }
  return 'unknown';
}

function createThreeValueGenerationActions({ actionsById, deltas }) {
  const actionGroups = new Map();
  for (const delta of deltas) {
    const actionKey = delta.actionId ?? 'system';
    if (!actionGroups.has(actionKey)) {
      const action = actionsById.get(delta.actionId);
      actionGroups.set(actionKey, {
        actionId: delta.actionId,
        actionName: delta.actionName ?? action?.name ?? '系统',
        actionType: delta.actionType ?? action?.type ?? 'system',
        actorId: delta.actorId ?? action?.actorId ?? null,
        actorName: delta.actorName ?? action?.actor?.name ?? null,
        startMs: numberOrNull(action?.startMs),
        gameDataReference: action?.gameDataReference ?? null,
        skillReferenceRequired: action?.type === 'skill',
        skillReferenceReady:
          action?.type === 'skill'
            ? action?.gameDataReference?.ready === true
            : null,
        hitGroups: new Map(),
      });
    }
    const actionGroup = actionGroups.get(actionKey);
    const hitGroupKey = createThreeValueGenerationHitGroupKey(delta);
    if (!actionGroup.hitGroups.has(hitGroupKey)) {
      actionGroup.hitGroups.set(hitGroupKey, {
        hitKey: delta.hitKey,
        hitIndex: delta.hitIndex,
        hitSkillId: delta.hitSkillId,
        frameIndex: delta.frameIndex,
        frameLabel: delta.frameLabel,
        timeMs: delta.timeMs,
        layerKeys: new Set(),
        trackKeys: new Set(),
        deltas: [],
      });
    }
    const hitGroup = actionGroup.hitGroups.get(hitGroupKey);
    hitGroup.layerKeys.add(delta.layerKey);
    hitGroup.trackKeys.add(delta.trackKey);
    hitGroup.deltas.push(delta);
  }

  return [...actionGroups.values()]
    .map(group => {
      const hits = [...group.hitGroups.values()]
        .map(hit => {
          const deltas = hit.deltas.sort(compareThreeValueGenerationDeltas);
          return {
            ...hit,
            layerKeys: sortThreeValueLayerKeys([...hit.layerKeys]),
            trackKeys: sortThreeValueTrackKeys([...hit.trackKeys]),
            deltaCount: deltas.length,
            threeValueDeltaAggregate:
              createThreeValueGenerationDeltaAggregate(deltas),
            deltas,
          };
        })
        .sort(compareThreeValueGenerationHits);
      const actionDeltas = hits.flatMap(hit => hit.deltas ?? []);
      return {
        actionId: group.actionId,
        actionName: group.actionName,
        actionType: group.actionType,
        actorId: group.actorId,
        actorName: group.actorName,
        startMs: group.startMs,
        gameDataReference: group.gameDataReference,
        skillReferenceRequired: group.skillReferenceRequired,
        skillReferenceReady: group.skillReferenceReady,
        hitCount: hits.length,
        deltaCount: actionDeltas.length,
        threeValueDeltaAggregate:
          createThreeValueGenerationDeltaAggregate(actionDeltas),
        hits,
      };
    })
    .sort(compareThreeValueGenerationActions);
}

function createThreeValueGenerationHits(actions) {
  return actions
    .flatMap(action =>
      (action.hits ?? []).map(hit => ({
        actionId: action.actionId,
        actionName: action.actionName,
        actionType: action.actionType,
        actorId: action.actorId,
        actorName: action.actorName,
        gameDataReference: action.gameDataReference,
        skillReferenceRequired: action.skillReferenceRequired,
        skillReferenceReady: action.skillReferenceReady,
        hitKey: hit.hitKey,
        hitIndex: hit.hitIndex,
        hitSkillId: hit.hitSkillId,
        frameIndex: hit.frameIndex,
        frameLabel: hit.frameLabel,
        timeMs: hit.timeMs,
        layerKeys: hit.layerKeys,
        trackKeys: hit.trackKeys,
        deltaCount: hit.deltaCount,
        threeValueDeltaAggregate: hit.threeValueDeltaAggregate,
        deltaIds: hit.deltas.map(delta => delta.id),
        deltas: hit.deltas,
      }))
    )
    .sort(compareThreeValueGenerationHits);
}

function createThreeValueGenerationDeltaAggregate(deltas) {
  const normalizedDeltas = deltas ?? [];
  const layerGroups = new Map();
  for (const delta of normalizedDeltas) {
    const layerKey = delta.layerKey ?? 'unknown';
    if (!layerGroups.has(layerKey)) {
      layerGroups.set(layerKey, []);
    }
    layerGroups.get(layerKey).push(delta);
  }

  const layerKeys = sortThreeValueLayerKeys([...layerGroups.keys()]);
  const layers = Object.fromEntries(
    layerKeys.map(layerKey => [
      layerKey,
      createThreeValueGenerationDeltaAggregateLayer(
        layerKey,
        layerGroups.get(layerKey)
      ),
    ])
  );

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
    status:
      normalizedDeltas.length > 0
        ? 'three-value-delta-aggregate-ready'
        : 'three-value-delta-aggregate-empty',
    deltaFields: THREE_VALUE_DELTA_FIELDS,
    deltaCount: normalizedDeltas.length,
    layerKeys,
    trackKeys: sortThreeValueTrackKeys(
      uniqueStrings(normalizedDeltas.map(delta => delta.trackKey))
    ),
    layers,
  };
}

function createThreeValueGenerationDeltaAggregateLayer(layerKey, deltas) {
  return {
    layerKey,
    runtimeApplied: layerKey === 'applied',
    deltaCount: deltas.length,
    trackKeys: sortThreeValueTrackKeys(
      uniqueStrings(deltas.map(delta => delta.trackKey))
    ),
    ...Object.fromEntries(
      THREE_VALUE_DELTA_FIELDS.map(field => [
        field,
        sumThreeValueDeltaField(deltas, field),
      ])
    ),
  };
}

function sumThreeValueDeltaField(deltas, field) {
  return roundTimelineMs(
    deltas.reduce((sum, delta) => {
      const value = numberOrNull(delta[field]);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0)
  );
}

function createActionHitThreeValueDeltaStandardContract({
  actions,
  hits,
  deltas,
  valueSourceSlots,
  summary,
}) {
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
    status:
      deltas.length > 0
        ? 'action-hit-three-value-delta-contract-ready'
        : 'action-hit-three-value-delta-contract-empty',
    name: ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
    version: 9,
    topology: ['Action', 'Hit', 'ThreeValueDelta'],
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
    keyFields: {
      action: ['actionId'],
      hit: ['actionId', 'hitKey', 'frameIndex', 'timeMs'],
      delta: ['id'],
    },
    deltaFields: THREE_VALUE_DELTA_FIELDS,
    aggregateFields: THREE_VALUE_DELTA_FIELDS,
    aggregateLayerKeys: THREE_VALUE_GENERATION_LAYER_ORDER,
    mechanismContextContract: {
      name: THREE_VALUE_MECHANISM_CONTEXT_CONTRACT_NAME,
      version: THREE_VALUE_MECHANISM_CONTEXT_CONTRACT_VERSION,
      required: true,
    },
    mechanicsAdapterContract: {
      name: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME,
      version: THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_VERSION,
      requiredInputs: [
        'action',
        'hit',
        'mechanismConfiguration',
        'mechanicsProfile',
        'sourceValue',
        'stateBefore',
      ],
      generationBoundInputs: [
        'action',
        'hit',
        'mechanismConfiguration',
        'mechanicsProfile',
        'sourceValue',
      ],
      runtimeBoundInputs: ['stateBefore'],
      registrationKeys: THREE_VALUE_GENERATION_TRACK_ORDER,
      sourceOperandsContract: {
        name: THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_NAME,
        version: THREE_VALUE_MECHANICS_OPERANDS_CONTRACT_VERSION,
        requiredFields: [
          'trackKey',
          'kind',
          'operation',
          'inputs',
          'expectedDelta',
        ],
        hpRawPreviewRequiredFields: [
          'sourceBinding',
          'sourceBindingValidation',
        ],
        appliedSourceBindingFields: [
          'sourceBindingRequired',
          'sourceBindingReady',
          'sourceBindingStatus',
          'sourceBindingKind',
          'sourceBindingIdentity',
        ],
      },
      mechanicsProfileContract: {
        name: THREE_VALUE_MECHANICS_PROFILE_CONTRACT_NAME,
        version: THREE_VALUE_MECHANICS_PROFILE_CONTRACT_VERSION,
        selectionPath: 'scenario.mechanicsProfile',
      },
    },
    runtimeDeltaPolicy: 'runtime consumes only deltas with applied=true',
    diagnosticDeltaPolicy:
      'candidate, sampled and placeholder deltas stay in the same contract for traceability but do not change runtime totals',
    valueSourceSlots,
    actions,
    hits,
    deltas,
    summary: {
      contractName: ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
      actionCount: summary.actionCount,
      hitCount: summary.hitCount,
      deltaCount: summary.deltaCount,
      appliedDeltaCount: summary.appliedDeltaCount,
      candidateDeltaCount: summary.candidateDeltaCount,
      sampledDeltaCount: summary.sampledDeltaCount,
      placeholderDeltaCount: summary.placeholderDeltaCount,
      valueSourceSlotCount: summary.valueSourceSlotCount,
      runtimeValueSourceSlotCount: summary.runtimeValueSourceSlotCount,
      replaceableValueSourceSlotCount: summary.replaceableValueSourceSlotCount,
      calculatorCount: summary.calculatorCount,
      mechanismContextReadyDeltaCount: summary.mechanismContextReadyDeltaCount,
      mechanismContextMissingDeltaCount:
        summary.mechanismContextMissingDeltaCount,
      mechanismConfigurationReadyDeltaCount:
        summary.mechanismConfigurationReadyDeltaCount,
      mechanismConfigurationMissingDeltaCount:
        summary.mechanismConfigurationMissingDeltaCount,
      mechanicsAdapterRequestCount: summary.mechanicsAdapterRequestCount,
      appliedMechanicsAdapterRequestCount:
        summary.appliedMechanicsAdapterRequestCount,
      mechanicsOperandsReadyDeltaCount:
        summary.mechanicsOperandsReadyDeltaCount,
      appliedMechanicsOperandsReadyDeltaCount:
        summary.appliedMechanicsOperandsReadyDeltaCount,
      mechanicsOperandsKinds: summary.mechanicsOperandsKinds,
      mechanicsProfileReadyDeltaCount: summary.mechanicsProfileReadyDeltaCount,
      mechanicsProfileMissingDeltaCount:
        summary.mechanicsProfileMissingDeltaCount,
      mechanicsProfileIds: summary.mechanicsProfileIds,
      skillReferenceActionCount: summary.skillReferenceActionCount,
      skillReferenceReadyActionCount: summary.skillReferenceReadyActionCount,
      skillReferenceMissingActionCount:
        summary.skillReferenceMissingActionCount,
      hpOperandSourceBindingRequiredDeltaCount:
        summary.hpOperandSourceBindingRequiredDeltaCount,
      hpOperandSourceBindingReadyDeltaCount:
        summary.hpOperandSourceBindingReadyDeltaCount,
      hpOperandSourceBindingInvalidDeltaCount:
        summary.hpOperandSourceBindingInvalidDeltaCount,
      appliedSourceBindingRequiredDeltaCount:
        summary.appliedSourceBindingRequiredDeltaCount,
      appliedSourceBindingReadyDeltaCount:
        summary.appliedSourceBindingReadyDeltaCount,
      appliedSourceBindingInvalidDeltaCount:
        summary.appliedSourceBindingInvalidDeltaCount,
      appliedSourceBindingCompatibleUnboundDeltaCount:
        summary.appliedSourceBindingCompatibleUnboundDeltaCount,
      appliedSourceBindingKinds: summary.appliedSourceBindingKinds,
      applied: false,
    },
    applied: false,
  };
}

function createThreeValueGenerationHitGroupKey(delta) {
  return [delta.hitKey, delta.frameIndex, delta.timeMs]
    .map(createThreeValueGenerationIdPart)
    .join('|');
}

function compareThreeValueGenerationActions(left, right) {
  return (
    compareNullableTimelineNumber(left.startMs, right.startMs) ||
    String(left.actionId ?? '').localeCompare(String(right.actionId ?? ''))
  );
}

function compareThreeValueGenerationHits(left, right) {
  return (
    compareNullableTimelineNumber(left.frameIndex, right.frameIndex) ||
    compareNullableTimelineNumber(left.hitIndex, right.hitIndex) ||
    String(left.hitKey ?? '').localeCompare(String(right.hitKey ?? ''))
  );
}

export function compareThreeValueGenerationDeltas(left, right) {
  return (
    compareNullableTimelineNumber(left.frameIndex, right.frameIndex) ||
    compareNullableTimelineNumber(left.timeMs, right.timeMs) ||
    compareNullableTimelineNumber(
      left.runtimeSequenceIndex,
      right.runtimeSequenceIndex
    ) ||
    compareNullableTimelineNumber(left.hitIndex, right.hitIndex) ||
    String(left.actionId ?? '').localeCompare(String(right.actionId ?? '')) ||
    compareThreeValueTrackOrder(left.trackKey, right.trackKey) ||
    String(left.layerKey ?? '').localeCompare(String(right.layerKey ?? '')) ||
    compareNullableTimelineNumber(left.sequenceIndex, right.sequenceIndex)
  );
}

function compareThreeValueTrackOrder(leftTrackKey, rightTrackKey) {
  return (
    getThreeValueTrackOrder(leftTrackKey) -
    getThreeValueTrackOrder(rightTrackKey)
  );
}

function getThreeValueTrackOrder(trackKey) {
  const index = THREE_VALUE_GENERATION_TRACK_ORDER.indexOf(trackKey);
  return index >= 0 ? index : 99;
}

function sortThreeValueTrackKeys(trackKeys) {
  return [...trackKeys].sort(
    (left, right) =>
      compareThreeValueTrackOrder(left, right) ||
      String(left ?? '').localeCompare(String(right ?? ''))
  );
}

function sortThreeValueLayerKeys(layerKeys) {
  return [...layerKeys].sort(
    (left, right) =>
      getThreeValueLayerOrder(left) - getThreeValueLayerOrder(right) ||
      String(left ?? '').localeCompare(String(right ?? ''))
  );
}

function getThreeValueLayerOrder(layerKey) {
  const index = THREE_VALUE_GENERATION_LAYER_ORDER.indexOf(layerKey);
  return index >= 0 ? index : 99;
}

function summarizeThreeValueGenerationLayer({
  actions,
  hits,
  deltas,
  valueSourceSlots,
}) {
  const countLayer = layerKey =>
    deltas.filter(delta => delta.layerKey === layerKey).length;
  const calculatorSummary = summarizeThreeValueCalculators(deltas);
  return {
    contractName: ACTION_HIT_THREE_VALUE_DELTA_CONTRACT_NAME,
    actionCount: actions.length,
    actionWithDeltaCount: actions.filter(action => action.deltaCount > 0)
      .length,
    skillReferenceActionCount: actions.filter(
      action => action.skillReferenceRequired
    ).length,
    skillReferenceReadyActionCount: actions.filter(
      action => action.skillReferenceRequired && action.skillReferenceReady
    ).length,
    skillReferenceMissingActionCount: actions.filter(
      action => action.skillReferenceRequired && !action.skillReferenceReady
    ).length,
    hpOperandSourceBindingRequiredDeltaCount: deltas.filter(
      delta => delta.hpOperandSourceBindingRequired
    ).length,
    hpOperandSourceBindingReadyDeltaCount: deltas.filter(
      delta =>
        delta.hpOperandSourceBindingRequired &&
        delta.hpOperandSourceBindingReady
    ).length,
    hpOperandSourceBindingInvalidDeltaCount: deltas.filter(
      delta =>
        delta.hpOperandSourceBindingRequired &&
        !delta.hpOperandSourceBindingReady
    ).length,
    appliedSourceBindingRequiredDeltaCount: deltas.filter(
      delta => delta.appliedSourceBindingRequired
    ).length,
    appliedSourceBindingReadyDeltaCount: deltas.filter(
      delta =>
        delta.appliedSourceBindingRequired && delta.appliedSourceBindingReady
    ).length,
    appliedSourceBindingInvalidDeltaCount: deltas.filter(
      delta =>
        delta.appliedSourceBindingRequired && !delta.appliedSourceBindingReady
    ).length,
    appliedSourceBindingCompatibleUnboundDeltaCount: deltas.filter(
      delta => delta.appliedSourceBindingState === 'compatible-unbound'
    ).length,
    appliedSourceBindingKinds: uniqueStrings(
      deltas.map(delta => delta.appliedSourceBindingKind)
    ),
    hitCount: hits.length,
    deltaCount: deltas.length,
    trackCount: new Set(deltas.map(delta => delta.trackKey)).size,
    appliedDeltaCount: countLayer('applied'),
    candidateDeltaCount: countLayer('candidate'),
    sampledDeltaCount: countLayer('sampled'),
    placeholderDeltaCount: countLayer('placeholder'),
    replaceableDeltaCount: deltas.filter(delta => delta.replaceable).length,
    valueSourceSlotCount: valueSourceSlots.length,
    runtimeValueSourceSlotCount: valueSourceSlots.filter(
      slot => slot.runtimeEligible
    ).length,
    replaceableValueSourceSlotCount: valueSourceSlots.filter(
      slot => slot.replaceable
    ).length,
    readyValueSourceSlotCount: valueSourceSlots.filter(
      slot => slot.status === 'value-source-slot-ready'
    ).length,
    calculatorCount: calculatorSummary.calculatorCount,
    calculatorKeys: calculatorSummary.calculatorKeys,
    calculatorReplaceableDeltaCount:
      calculatorSummary.calculatorReplaceableDeltaCount,
    calculatorStatuses: calculatorSummary.statuses,
    calculatorSummary,
    mechanismContextReadyDeltaCount: deltas.filter(
      delta => delta.mechanismContextReady
    ).length,
    mechanismContextMissingDeltaCount: deltas.filter(
      delta => !delta.mechanismContextReady
    ).length,
    mechanismContextStatuses: uniqueStrings(
      deltas.map(delta => delta.mechanismContextStatus)
    ),
    mechanismConfigurationReadyDeltaCount: deltas.filter(
      delta => delta.mechanismConfigurationReady
    ).length,
    mechanismConfigurationMissingDeltaCount: deltas.filter(
      delta => !delta.mechanismConfigurationReady
    ).length,
    mechanismConfigurationStatuses: uniqueStrings(
      deltas.map(delta => delta.mechanismConfigurationStatus)
    ),
    mechanicsAdapterRequestCount: deltas.filter(
      delta =>
        delta.mechanicsAdapterRequest?.contractName ===
        THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME
    ).length,
    appliedMechanicsAdapterRequestCount: deltas.filter(
      delta =>
        delta.applied &&
        delta.mechanicsAdapterRequest?.contractName ===
          THREE_VALUE_MECHANICS_ADAPTER_CONTRACT_NAME
    ).length,
    mechanicsOperandsReadyDeltaCount: deltas.filter(
      delta => delta.mechanicsAdapterRequest?.sourceValue?.operands?.ready
    ).length,
    appliedMechanicsOperandsReadyDeltaCount: deltas.filter(
      delta =>
        delta.applied &&
        delta.mechanicsAdapterRequest?.sourceValue?.operands?.ready
    ).length,
    mechanicsOperandsKinds: uniqueStrings(
      deltas.map(
        delta => delta.mechanicsAdapterRequest?.sourceValue?.operands?.kind
      )
    ),
    mechanicsProfileReadyDeltaCount: deltas.filter(
      delta => delta.mechanismContext?.mechanicsProfileReady
    ).length,
    mechanicsProfileMissingDeltaCount: deltas.filter(
      delta => !delta.mechanismContext?.mechanicsProfileReady
    ).length,
    mechanicsProfileIds: uniqueStrings(
      deltas.map(
        delta => delta.mechanicsAdapterRequest?.mechanicsProfile?.profileId
      )
    ),
    frameMin: minNumber(deltas.map(delta => delta.frameIndex)),
    frameMax: maxNumber(deltas.map(delta => delta.frameIndex)),
    applied: false,
  };
}

function msToTimelineFrame(value) {
  const timeMs = numberOrNull(value) ?? 0;
  return Math.max(0, Math.round(timeMs / AZPR_TIMELINE_FRAME_MS));
}

function roundTimelineMs(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}

function formatTimelineFrame(frameIndex) {
  const frame = Math.max(0, Math.round(Number(frameIndex) || 0));
  const seconds = Math.floor(frame / AZPR_TIMELINE_FRAME_RATE);
  const remainFrames = frame % AZPR_TIMELINE_FRAME_RATE;
  return `${seconds}s${remainFrames}f`;
}

function compareNullableTimelineNumber(left, right) {
  const leftNumber = numberOrNull(left);
  const rightNumber = numberOrNull(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  if (Number.isFinite(leftNumber)) {
    return -1;
  }
  if (Number.isFinite(rightNumber)) {
    return 1;
  }
  return 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function finiteValues(values) {
  return values.map(numberOrNull).filter(Number.isFinite);
}

function minNumber(values) {
  const finite = finiteValues(values);
  return finite.length > 0 ? Math.min(...finite) : null;
}

function maxNumber(values) {
  const finite = finiteValues(values);
  return finite.length > 0 ? Math.max(...finite) : null;
}

function uniqueNumbers(values) {
  return [
    ...new Set(values.map(value => Number(value)).filter(Number.isFinite)),
  ].sort((left, right) => left - right);
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .filter(value => value != null && String(value).trim() !== '')
        .map(value => String(value))
    ),
  ];
}
