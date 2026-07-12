import {
  createRuntimeSampleEventKey,
  createThreeValueMechanismSampleAdapterOutput,
} from '../mechanics/threeValueMechanismSampleAdapter';
import { createThreeValueMechanicsOperands } from '../mechanics/threeValueMechanicsAdapter';
import { createValidatedRuntimeSampleSourceBinding } from '../mechanics/threeValueAppliedSourceBinding';

export const AZPR_TIMELINE_FRAME_RATE = 60;
export const AZPR_TIMELINE_FRAME_MS = 1000 / AZPR_TIMELINE_FRAME_RATE;

export const THREE_VALUE_DELTA_GENERATION_TRACK_DEFINITIONS = [
  {
    key: 'enemyHpDamage',
    label: '敌人HP伤害',
    resultField: 'hpDamage',
    candidateSeriesKey: 'hpDamageFormulaParamCandidate',
    ownerScope: 'enemy',
    valueUnit: 'raw-damage',
  },
  {
    key: 'enemyToughnessDamage',
    label: '敌人韧性削减',
    resultField: 'toughnessDamage',
    candidateSeriesKey: 'toughnessDamageCandidate',
    ownerScope: 'enemy',
    valueUnit: 'raw-field',
  },
  {
    key: 'selfEnergyChange',
    label: '自身能量变化',
    resultField: 'selfEnergyChange',
    candidateSeriesKey: 'selfEnergyCandidate',
    ownerScope: 'actor',
    valueUnit: 'sp',
  },
];

const STANDARD_GENERATION_INPUT_SOURCES = [
  'actionResultTimeline.hpDamage',
  'actionResultTimeline.toughnessDamage',
  'actionResultTimeline.selfEnergyChange',
  'candidateValueSeries.chart.series',
  'runtimeSampleContext.events',
  'actionResultTimeline.placeholders',
];

const STATE_CURVE_FALLBACK_INPUT_SOURCES = [
  'threeValueCurveFramework.stateCurves.applied',
  'threeValueCurveFramework.stateCurves.candidate',
  'threeValueCurveFramework.stateCurves.sampled',
  'threeValueCurveFramework.stateCurves.placeholder',
];

export function createThreeValueDeltaGenerationInput({
  scenario,
  actionResultTimeline,
  candidateValueSeries,
  runtimeSampleContext,
  stateCurves,
}) {
  const hasStandardInputs =
    Array.isArray(actionResultTimeline) ||
    Boolean(candidateValueSeries) ||
    Boolean(runtimeSampleContext);
  const tracks = hasStandardInputs
    ? createStandardGenerationInputTracks({
        scenario,
        actionResultTimeline: actionResultTimeline ?? [],
        candidateValueSeries,
        runtimeSampleContext,
      })
    : (stateCurves?.tracks ?? []);
  const summary = summarizeThreeValueDeltaGenerationInput(tracks);

  return {
    schemaVersion: 1,
    sourceKind: hasStandardInputs
      ? 'azpr-action-hit-three-value-delta-generation-input'
      : 'azpr-state-curve-three-value-delta-generation-input',
    status:
      summary.pointCount > 0
        ? 'three-value-delta-generation-input-ready'
        : 'three-value-delta-generation-input-empty',
    contractName: 'Action -> Hit -> ThreeValueDelta',
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
    inputSources: hasStandardInputs
      ? STANDARD_GENERATION_INPUT_SOURCES
      : STATE_CURVE_FALLBACK_INPUT_SOURCES,
    sourcePriority: [
      'applied action results drive runtime totals',
      'validated runtime samples are promoted to applied deltas',
      'candidate hit values remain unapplied diagnostics',
      'unvalidated runtime samples remain sampled diagnostics',
      'placeholder points keep action/track coverage stable',
    ],
    tracks,
    summary,
    applied: false,
  };
}

function createStandardGenerationInputTracks({
  scenario,
  actionResultTimeline,
  candidateValueSeries,
  runtimeSampleContext,
}) {
  const chartSeriesByKey = new Map(
    (candidateValueSeries?.chart?.series ?? []).map(series => [
      series.key,
      series,
    ])
  );

  return THREE_VALUE_DELTA_GENERATION_TRACK_DEFINITIONS.map(definition => {
    const mechanismSampleAdapterOutput =
      createThreeValueMechanismSampleAdapterOutput({
        trackKey: definition.key,
        actionResultTimeline,
        runtimeSampleContext,
      });
    const appliedLayer = createAppliedGenerationInputLayer({
      definition,
      actionResultTimeline,
      mechanismSampleAdapterOutput,
    });
    const candidateLayer = createCandidateGenerationInputLayer({
      definition,
      chartSeries: chartSeriesByKey.get(definition.candidateSeriesKey),
    });
    const sampledLayer = createSampledGenerationInputLayer({
      definition,
      scenario,
      runtimeSampleContext,
      promotedEventKeys: mechanismSampleAdapterOutput.promotedEventKeys,
    });
    const occupiedActionIds = new Set([
      ...appliedLayer.points.map(point => point.actionId).filter(Boolean),
      ...candidateLayer.points.map(point => point.actionId).filter(Boolean),
      ...sampledLayer.points.map(point => point.actionId).filter(Boolean),
    ]);
    const placeholderLayer = createPlaceholderGenerationInputLayer({
      definition,
      actionResultTimeline,
      occupiedActionIds,
    });
    const layers = [
      appliedLayer,
      candidateLayer,
      sampledLayer,
      placeholderLayer,
    ];
    const pointCount = layers.reduce((sum, layer) => sum + layer.pointCount, 0);

    return {
      trackKey: definition.key,
      label: definition.label,
      ownerScope: definition.ownerScope,
      valueUnit: definition.valueUnit,
      status:
        pointCount > 0
          ? 'generation-input-track-ready'
          : 'generation-input-track-waiting-for-points',
      pointCount,
      layers,
      mechanismSampleAdapter: {
        key: mechanismSampleAdapterOutput.key,
        version: mechanismSampleAdapterOutput.version,
        contractName: mechanismSampleAdapterOutput.contractName,
        status: mechanismSampleAdapterOutput.status,
        pointCount: mechanismSampleAdapterOutput.pointCount,
        promotedEventKeys: mechanismSampleAdapterOutput.promotedEventKeys,
      },
      applied: false,
    };
  });
}

function createAppliedGenerationInputLayer({
  definition,
  actionResultTimeline,
  mechanismSampleAdapterOutput,
}) {
  const actionResultPoints = actionResultTimeline
    .map((entry, index) => {
      const result = entry[definition.resultField];
      const delta = numberOrNull(result?.value);
      if (!result?.applied || !Number.isFinite(delta)) {
        return null;
      }

      const timeMs = numberOrNull(entry.timeMs) ?? 0;
      const frameIndex = msToTimelineFrame(timeMs);
      return {
        sourceKind: 'action-result-applied-value',
        actionId: entry.actionId,
        actionName: entry.actionName,
        actionType: entry.actionType,
        actorId: entry.actorId,
        actorName: entry.actorName,
        targetId: entry.targetId,
        targetName: entry.targetName,
        skillId: numberOrNull(entry.skillId),
        sequenceIndex: index,
        timeMs: roundTimelineMs(timeMs),
        frameIndex,
        frameLabel: formatTimelineFrame(frameIndex),
        delta,
        mechanicsOperands: createThreeValueMechanicsOperands({
          trackKey: definition.key,
          sourceKind: 'action-result-applied-value',
          value: delta,
          formulaBreakdown: result.formulaBreakdown,
        }),
        elementConfigIds: createAppliedGenerationInputElementConfigIds(result),
        resultStatus: result.status ?? null,
        sourceStatus: result.sourceEvidence?.status ?? null,
        confidence: result.confidence ?? null,
        precision: result.precision ?? null,
        applied: true,
      };
    })
    .filter(Boolean);
  const mechanismSamplePoints = (
    mechanismSampleAdapterOutput?.points ?? []
  ).map((point, index) => {
    const sourceBinding = createValidatedRuntimeSampleSourceBinding({
      trackKey: definition.key,
      sourceKind: point.sourceKind,
      point,
      sampleValidation: point.validation,
    });
    return {
      ...point,
      sequenceIndex:
        numberOrNull(point.sequenceIndex) ?? actionResultPoints.length + index,
      timeMs: roundTimelineMs(numberOrNull(point.timeMs) ?? 0),
      frameIndex:
        numberOrNull(point.frameIndex) ?? msToTimelineFrame(point.timeMs ?? 0),
      frameLabel: formatTimelineFrame(
        numberOrNull(point.frameIndex) ?? msToTimelineFrame(point.timeMs ?? 0)
      ),
      elementConfigIds: uniqueNumbers([
        numberOrNull(point.sourceElementConfigId),
        numberOrNull(point.elementConfigId),
      ]),
      mechanicsOperands: createThreeValueMechanicsOperands({
        trackKey: definition.key,
        sourceKind: point.sourceKind,
        value: point.delta,
        sampleValidation: point.validation,
        sourceBinding,
      }),
      applied: true,
    };
  });
  const points = [...actionResultPoints, ...mechanismSamplePoints].sort(
    compareGenerationInputPoints
  );

  return createGenerationInputLayer({
    key: 'applied',
    label: '已应用结果',
    sourceKind:
      mechanismSamplePoints.length > 0
        ? 'applied-results-and-validated-runtime-samples'
        : 'action-result-applied-values',
    statusWhenEmpty: 'no-applied-result-points',
    valueUnit: definition.valueUnit,
    points,
    applied: true,
  });
}

function createAppliedGenerationInputElementConfigIds(result) {
  const sourceEvidence = result?.sourceEvidence;
  return uniqueNumbers([
    ...(sourceEvidence?.matchedElementConfigIds ?? []),
    ...(sourceEvidence?.logicElementIds ?? []),
    ...(sourceEvidence?.candidates ?? []).map(candidate =>
      numberOrNull(candidate.elementConfigId)
    ),
  ]);
}

function createCandidateGenerationInputLayer({ definition, chartSeries }) {
  const points = (chartSeries?.points ?? [])
    .map((point, index) => {
      const delta = numberOrNull(point.value);
      if (!Number.isFinite(delta)) {
        return null;
      }

      const frameIndex =
        numberOrNull(point.displayFrameIndex) ??
        msToTimelineFrame(point.displayTimeMs ?? point.sourceTimeMs ?? 0);
      const timeMs =
        numberOrNull(point.displayTimeMs) ??
        roundTimelineMs(frameIndex * AZPR_TIMELINE_FRAME_MS);

      return {
        sourceKind: 'candidate-chart-point',
        actionId: point.actionId,
        actionName: point.actionName,
        actorId: point.actorId ?? null,
        actorName: point.actorName ?? null,
        skillId: point.skillId,
        hitSkillId: point.hitSkillId,
        hitIndex: point.hitIndex,
        sequenceIndex: point.sequenceIndex ?? index,
        timeMs: roundTimelineMs(timeMs),
        frameIndex,
        frameLabel: formatTimelineFrame(frameIndex),
        sourceFrameIndex: numberOrNull(point.sourceFrameIndex),
        displayFrameIndex: numberOrNull(point.displayFrameIndex),
        localFrameIndex: numberOrNull(point.localFrameIndex),
        chainStartFrame: numberOrNull(point.chainStartFrame),
        delta,
        valueSamples: point.valueSamples ?? [],
        candidateCount: point.candidateCount ?? null,
        elementConfigIds: point.elementConfigIds ?? [],
        sourceStatus: point.sourceStatus ?? null,
        triggerTimingStatus: point.triggerTimingStatus ?? null,
        timeAdjustmentStatus: point.timeAdjustmentStatus ?? null,
        applied: false,
      };
    })
    .filter(Boolean);

  return createGenerationInputLayer({
    key: 'candidate',
    label: '候选值',
    sourceKind: 'candidate-value-chart-points',
    statusWhenEmpty: 'no-candidate-points',
    valueUnit: chartSeries?.unit ?? definition.valueUnit,
    points,
    applied: false,
  });
}

function createSampledGenerationInputLayer({
  definition,
  scenario,
  runtimeSampleContext,
  promotedEventKeys = [],
}) {
  const runtimeSampleCount =
    runtimeSampleContext?.captureCount ??
    scenario?.runtimeSampleCaptures?.length ??
    0;
  const points = createSampledGenerationInputPoints({
    definition,
    runtimeSampleContext,
    promotedEventKeys,
  });

  return createGenerationInputLayer({
    key: 'sampled',
    label: '真实采样',
    sourceKind: 'runtime-sample-captures',
    statusWhenEmpty:
      runtimeSampleCount > 0
        ? 'runtime-samples-present-mapping-pending'
        : 'runtime-samples-not-imported',
    valueUnit: definition.valueUnit,
    points,
    applied: false,
    extra: {
      runtimeSampleCount,
      importedRuntimeSampleCount:
        runtimeSampleContext?.importedRuntimeSampleCount ?? 0,
      mappingStatus:
        points.length > 0
          ? 'runtime-samples-mapped-to-generation-input'
          : runtimeSampleCount > 0
            ? 'sample-to-generation-input-mapping-pending'
            : 'waiting-for-runtime-samples',
    },
  });
}

function createSampledGenerationInputPoints({
  definition,
  runtimeSampleContext,
  promotedEventKeys = [],
}) {
  const promotedEventKeySet = new Set(promotedEventKeys);

  if (definition.key === 'enemyToughnessDamage') {
    return (runtimeSampleContext?.events ?? [])
      .filter(event => event.eventType === 'toughness-damage-applied')
      .filter(
        event => !promotedEventKeySet.has(createRuntimeSampleEventKey(event))
      )
      .map((event, index) => {
        const before = numberOrNull(event.toughnessBefore);
        const after = numberOrNull(event.toughnessAfter);
        const delta =
          numberOrNull(event.toughnessDeltaApplied) ??
          (before == null || after == null ? null : before - after);
        if (!Number.isFinite(delta)) {
          return null;
        }
        const frameIndex =
          numberOrNull(event.frameIndex) ??
          msToTimelineFrame(event.timeMs ?? 0);
        const timeMs =
          numberOrNull(event.timeMs) ??
          roundTimelineMs(frameIndex * AZPR_TIMELINE_FRAME_MS);

        return {
          sourceKind: 'runtime-toughness-damage-applied-sample',
          captureSessionId: event.captureSessionId ?? null,
          eventIndex: numberOrNull(event.eventIndex) ?? index,
          eventType: event.eventType,
          actionId: event.actionId,
          actorId: event.actorId,
          targetId: event.targetId,
          targetEntityId: event.targetEntityId,
          sourceElementConfigId: numberOrNull(event.sourceElementConfigId),
          elementConfigId: numberOrNull(event.elementConfigId),
          pathId: event.pathId ?? null,
          timeMs: roundTimelineMs(timeMs),
          frameIndex,
          frameLabel: formatTimelineFrame(frameIndex),
          delta,
          toughnessBefore: before,
          toughnessAfter: after,
          calculationKind: 'toughness-runtime-sample',
          calculationStatus: 'toughness-runtime-sample-unapplied',
          applied: false,
        };
      })
      .filter(Boolean);
  }

  if (definition.key !== 'selfEnergyChange') {
    return [];
  }

  return (runtimeSampleContext?.events ?? [])
    .filter(event => event.eventType === 'recover-sp-applied')
    .filter(
      event => !promotedEventKeySet.has(createRuntimeSampleEventKey(event))
    )
    .map((event, index) => {
      const delta =
        numberOrNull(event.spDeltaApplied) ??
        numberOrNull(event.delta) ??
        numberOrNull(event.args?.delta);
      if (!Number.isFinite(delta)) {
        return null;
      }
      const frameIndex =
        numberOrNull(event.frameIndex) ?? msToTimelineFrame(event.timeMs ?? 0);
      const timeMs =
        numberOrNull(event.timeMs) ??
        roundTimelineMs(frameIndex * AZPR_TIMELINE_FRAME_MS);

      return {
        sourceKind: 'runtime-recover-sp-applied-sample',
        captureSessionId: event.captureSessionId ?? null,
        eventIndex: numberOrNull(event.eventIndex) ?? index,
        eventType: event.eventType,
        actionId: event.actionId,
        actorId: event.actorId,
        roleEntityId: event.roleEntityId,
        ownerEntityId: event.ownerEntityId,
        receiverEntityId: event.receiverEntityId,
        sourceElementConfigId: numberOrNull(event.sourceElementConfigId),
        elementConfigId: numberOrNull(event.elementConfigId),
        pathId: event.pathId ?? null,
        timeMs: roundTimelineMs(timeMs),
        frameIndex,
        frameLabel: formatTimelineFrame(frameIndex),
        delta,
        spBefore: numberOrNull(event.spBefore),
        spAfter: numberOrNull(event.spAfter),
        baseDelta: numberOrNull(event.baseDelta ?? event.args?.baseDelta),
        argsDelta: numberOrNull(event.args?.delta),
        recoverTagType: numberOrNull(event.recoverTagType),
        applied: false,
      };
    })
    .filter(Boolean);
}

function createPlaceholderGenerationInputLayer({
  definition,
  actionResultTimeline,
  occupiedActionIds,
}) {
  const points = actionResultTimeline
    .filter(entry => !occupiedActionIds.has(entry.actionId))
    .map((entry, index) => {
      const timeMs = numberOrNull(entry.timeMs) ?? 0;
      const frameIndex = msToTimelineFrame(timeMs);
      return {
        sourceKind: 'action-result-placeholder',
        actionId: entry.actionId,
        actionName: entry.actionName,
        actorId: entry.actorId,
        actorName: entry.actorName,
        sequenceIndex: index,
        timeMs: roundTimelineMs(timeMs),
        frameIndex,
        frameLabel: formatTimelineFrame(frameIndex),
        delta: 0,
        resultStatus: entry[definition.resultField]?.status ?? null,
        applied: false,
      };
    });

  return createGenerationInputLayer({
    key: 'placeholder',
    label: '占位',
    sourceKind: 'action-result-placeholders',
    statusWhenEmpty: 'no-placeholder-points-needed',
    valueUnit: definition.valueUnit,
    points,
    applied: false,
  });
}

function createGenerationInputLayer({
  key,
  label,
  sourceKind,
  statusWhenEmpty,
  valueUnit,
  points,
  applied,
  extra = {},
}) {
  const integratedPoints = integrateGenerationInputPoints(points);
  const cumulativeValues = integratedPoints.map(point => point.cumulative);

  return {
    key,
    label,
    sourceKind,
    status:
      integratedPoints.length > 0
        ? 'delta-generation-input-points-built'
        : statusWhenEmpty,
    valueUnit,
    pointCount: integratedPoints.length,
    frameMin: minNumber(integratedPoints.map(point => point.frameIndex)),
    frameMax: maxNumber(integratedPoints.map(point => point.frameIndex)),
    deltaMin: minNumber(integratedPoints.map(point => point.delta)),
    deltaMax: maxNumber(integratedPoints.map(point => point.delta)),
    cumulativeMin: minNumber(cumulativeValues),
    cumulativeMax: maxNumber(cumulativeValues),
    finalCumulative:
      integratedPoints.length > 0
        ? integratedPoints[integratedPoints.length - 1].cumulative
        : 0,
    points: integratedPoints,
    ...extra,
    applied,
  };
}

function integrateGenerationInputPoints(points) {
  let cumulative = 0;
  return [...points].sort(compareGenerationInputPoints).map((point, index) => {
    const delta = numberOrNull(point.delta) ?? 0;
    cumulative = roundCurveValue(cumulative + delta);
    return {
      ...point,
      sequenceIndex: point.sequenceIndex ?? index,
      delta,
      cumulative,
    };
  });
}

function compareGenerationInputPoints(left, right) {
  return (
    compareNullableTimelineNumber(left.frameIndex, right.frameIndex) ||
    compareNullableTimelineNumber(left.sequenceIndex, right.sequenceIndex)
  );
}

function summarizeThreeValueDeltaGenerationInput(tracks) {
  const layers = tracks.flatMap(track => track.layers ?? []);
  const pointCount = layers.reduce(
    (sum, layer) => sum + (layer.pointCount ?? layer.points?.length ?? 0),
    0
  );
  const countLayerPoints = key =>
    layers
      .filter(layer => layer.key === key)
      .reduce(
        (sum, layer) => sum + (layer.pointCount ?? layer.points?.length ?? 0),
        0
      );

  return {
    trackCount: tracks.length,
    layerCount: layers.length,
    pointCount,
    appliedPointCount: countLayerPoints('applied'),
    candidatePointCount: countLayerPoints('candidate'),
    sampledPointCount: countLayerPoints('sampled'),
    placeholderPointCount: countLayerPoints('placeholder'),
    actionCount: new Set(
      tracks
        .flatMap(track => track.layers ?? [])
        .flatMap(layer => layer.points ?? [])
        .map(point => point.actionId)
        .filter(Boolean)
    ).size,
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

function roundCurveValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : 0;
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
