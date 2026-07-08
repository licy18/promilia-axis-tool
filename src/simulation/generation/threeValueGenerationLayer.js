import {
  createThreeValueCalculatorResult,
  getThreeValueCalculatorKeys,
  summarizeThreeValueCalculators,
} from '../threeValueCalculatorAdapters';

const AZPR_TIMELINE_FRAME_RATE = 60;
const AZPR_TIMELINE_FRAME_MS = 1000 / AZPR_TIMELINE_FRAME_RATE;
const THREE_VALUE_GENERATION_TRACK_ORDER = [
  'enemyHpDamage',
  'enemyToughnessDamage',
  'selfEnergyChange',
];

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

export function createThreeValueGenerationLayer({ scenario, stateCurves }) {
  const actionsById = new Map(
    (scenario?.actions ?? []).map(action => [action.id, action])
  );
  const deltas = createThreeValueGenerationDeltas({
    actionsById,
    stateCurves,
  });
  const actions = createThreeValueGenerationActions({
    actionsById,
    deltas,
  });
  const summary = summarizeThreeValueGenerationLayer({ actions, deltas });

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-standard-three-value-generation-layer',
    status:
      deltas.length > 0
        ? 'standard-three-value-generation-layer-ready'
        : 'standard-three-value-generation-layer-empty',
    contract: {
      name: 'Action -> Hit -> ThreeValueDelta',
      version: 1,
      frameRate: AZPR_TIMELINE_FRAME_RATE,
      frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
      deltaFields: THREE_VALUE_DELTA_FIELDS,
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
      ],
      calculatorContract: {
        name: 'ThreeValueDeltaCalculator',
        version: 1,
        outputFields: THREE_VALUE_DELTA_FIELDS,
        requiredOutputs: [
          'delta',
          'status',
          'sourceIds',
          'confidence',
          'replaceable',
        ],
        calculatorKeys: getThreeValueCalculatorKeys(),
        policy:
          'current HP/toughness/self-energy formulas are adapter outputs and remain replaceable until final AzPr formulas are confirmed',
      },
    },
    inputSources: [
      'threeValueCurveFramework.stateCurves.applied',
      'threeValueCurveFramework.stateCurves.candidate',
      'threeValueCurveFramework.stateCurves.sampled',
      'threeValueCurveFramework.stateCurves.placeholder',
    ],
    replacementPolicy:
      'candidate, sampled and placeholder deltas can be replaced by later confirmed formulas without changing action/hit/track keys',
    actions,
    deltas,
    summary,
    applied: false,
  };
}

function createThreeValueGenerationDeltas({ actionsById, stateCurves }) {
  const deltas = [];
  for (const track of stateCurves?.tracks ?? []) {
    for (const layer of track.layers ?? []) {
      for (const [pointIndex, point] of (layer.points ?? []).entries()) {
        const delta = createThreeValueGenerationDelta({
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
  });
  const hitIndex = numberOrNull(point.hitIndex);
  const hitKey = createThreeValueGenerationHitKey({
    point,
    layerKey,
    frameIndex,
    pointIndex,
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
    valueUnit: layer.valueUnit ?? track.valueUnit,
    delta: deltaValue,
    ...deltaFields,
    sourceKind,
    sourceIds,
    confidence,
    sourceStatus,
    resultStatus,
    calculator,
    calculatorKey: calculator.key,
    calculatorVersion: calculator.version,
    calculationKind: calculator.kind,
    calculationStatus: calculator.status,
    calculationReplaceable: calculator.replaceable,
    candidateCount: numberOrNull(point.candidateCount),
    sequenceIndex: numberOrNull(point.sequenceIndex) ?? pointIndex,
    stateCurveSequenceIndex: numberOrNull(point.sequenceIndex) ?? pointIndex,
    applied,
    replaceable: !applied,
  };
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
        .map(hit => ({
          ...hit,
          layerKeys: [...hit.layerKeys].sort(),
          trackKeys: [...hit.trackKeys].sort(),
          deltaCount: hit.deltas.length,
          deltas: hit.deltas.sort(compareThreeValueGenerationDeltas),
        }))
        .sort(compareThreeValueGenerationHits);
      return {
        actionId: group.actionId,
        actionName: group.actionName,
        actionType: group.actionType,
        actorId: group.actorId,
        actorName: group.actorName,
        startMs: group.startMs,
        hitCount: hits.length,
        deltaCount: hits.reduce((sum, hit) => sum + hit.deltaCount, 0),
        hits,
      };
    })
    .sort(compareThreeValueGenerationActions);
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

function summarizeThreeValueGenerationLayer({ actions, deltas }) {
  const countLayer = layerKey =>
    deltas.filter(delta => delta.layerKey === layerKey).length;
  const calculatorSummary = summarizeThreeValueCalculators(deltas);
  return {
    contractName: 'Action -> Hit -> ThreeValueDelta',
    actionCount: actions.length,
    actionWithDeltaCount: actions.filter(action => action.deltaCount > 0)
      .length,
    hitCount: actions.reduce((sum, action) => sum + action.hitCount, 0),
    deltaCount: deltas.length,
    trackCount: new Set(deltas.map(delta => delta.trackKey)).size,
    appliedDeltaCount: countLayer('applied'),
    candidateDeltaCount: countLayer('candidate'),
    sampledDeltaCount: countLayer('sampled'),
    placeholderDeltaCount: countLayer('placeholder'),
    replaceableDeltaCount: deltas.filter(delta => delta.replaceable).length,
    calculatorCount: calculatorSummary.calculatorCount,
    calculatorKeys: calculatorSummary.calculatorKeys,
    calculatorReplaceableDeltaCount:
      calculatorSummary.calculatorReplaceableDeltaCount,
    calculatorStatuses: calculatorSummary.statuses,
    calculatorSummary,
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
