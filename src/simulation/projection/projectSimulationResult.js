import skillAssetEvidence from '../../data/generated/skill-asset-evidence.json';

const SKILL_ASSET_EVIDENCE_PATH =
  'src/data/generated/skill-asset-evidence.json';
const DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE =
  skillAssetEvidence.damageElementFieldMappingEvidence ?? {};
const DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE_KIND =
  DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE.sourceKind ??
  'azpr-damage-element-field-mapping-evidence';
const DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID = new Map(
  (DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE.skills ?? [])
    .map(skill => [Number(skill.skillId), skill])
    .filter(([skillId]) => Number.isFinite(skillId))
);
const CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID = new Map(
  (skillAssetEvidence.currentSkillControlEvidence ?? [])
    .map(skill => [Number(skill.skillId), skill])
    .filter(([skillId]) => Number.isFinite(skillId))
);
const AZPR_TIMELINE_FRAME_RATE = 60;
const AZPR_TIMELINE_FRAME_MS = 1000 / AZPR_TIMELINE_FRAME_RATE;

export function projectSimulationResult({
  scenario,
  eventLog,
  damageEvents,
  resourceEvents,
}) {
  const actionResultTimeline = buildActionResultTimeline({
    scenario,
    damageEvents,
    resourceEvents,
  });
  const candidateValueSeries = buildCandidateValueSeries(
    actionResultTimeline,
    scenario.time.durationMs
  );
  const damageTimeline = damageEvents.map(event => ({
    timeMs: event.timeMs,
    actionId: event.actionId,
    actorId: event.actorId,
    targetId: event.targetId,
    attack: event.payload.attack,
    attackSource: event.payload.attackSource,
    rawDamage: event.payload.rawDamage,
    formulaVersion: event.payload.formulaVersion,
    formulaBreakdown: event.payload.formulaBreakdown,
    segmentLabel: event.payload.segment.label,
    multiplier: event.payload.segment.multiplier,
    segment: event.payload.segment,
    confidence: event.payload.confidence,
    precision: event.payload.precision,
    timingAccuracy: event.payload.timingAccuracy,
  }));

  const resourceTimeline = resourceEvents.map(event => ({
    timeMs: event.timeMs,
    actionId: event.actionId,
    actorId: event.actorId,
    resource: event.payload.resource,
    change: event.payload.change,
    reason: event.payload.reason,
    confidence: event.payload.confidence,
  }));

  const totalRawDamage = damageTimeline.reduce(
    (sum, entry) => sum + entry.rawDamage,
    0
  );
  const totalProjectedToughnessDamage = actionResultTimeline.reduce(
    (sum, entry) => sum + entry.toughnessDamage.value,
    0
  );
  const totalSelfEnergyDelta = actionResultTimeline.reduce(
    (sum, entry) => sum + entry.selfEnergyChange.value,
    0
  );
  const selfEnergyDeltaByActor = summarizeSelfEnergyByActor(
    scenario,
    actionResultTimeline
  );
  const formulaCandidatePatternSummary =
    summarizeFormulaCandidatePatterns(actionResultTimeline);
  const formulaExecutionMatrixSummary =
    summarizeFormulaExecutionMatrices(actionResultTimeline);
  const timingMissingActionIds = scenario.diagnostics.missingTimingActionIds;

  return {
    schemaVersion: 1,
    scenario: {
      projectId: scenario.sourceProject.id,
      projectName: scenario.sourceProject.name,
      durationMs: scenario.time.durationMs,
      actorCount: scenario.actors.length,
      actionCount: scenario.actions.length,
      enemyId: scenario.enemy.id,
      enemyName: scenario.enemy.name,
      enemyLevel: scenario.enemy.level,
      enemyHpMultiplier: scenario.enemy.hpMultiplier,
      enemyDefenseMultiplier: scenario.enemy.defenseMultiplier,
    },
    eventLog,
    actionResultTimeline,
    candidateValueSeries,
    damageTimeline,
    resourceTimeline,
    summary: {
      totalRawDamage,
      totalProjectedToughnessDamage,
      totalSelfEnergyDelta,
      selfEnergyDeltaByActor,
      projectedHitCount: damageTimeline.length,
      resourceEventCount: resourceTimeline.length,
      actionResultCount: actionResultTimeline.length,
      actionCount: scenario.actions.length,
      candidateValueSeriesSummary: candidateValueSeries.summary,
      formulaVersion: damageEvents[0]?.payload.formulaVersion ?? null,
      formulaCandidatePatternSummary,
      formulaExecutionMatrixSummary,
      confidence: damageTimeline.some(entry => entry.confidence === 'low')
        ? 'low'
        : 'medium',
      timingMissingActionCount: timingMissingActionIds.length,
      timingMissingActionIds,
    },
    diagnostics: {
      validationWarnings: scenario.diagnostics.validationWarnings,
      limitations: [
        'Raw damage projection only; final AzPr formula is not implemented yet.',
        'Every action result tracks HP damage, toughness damage, and self energy delta; toughness and charge formulas remain unmapped until skill/effect nodes are parsed.',
        'Formula breakdown exposes unapplied layers before they are confirmed.',
        'Skill timing is placeholder when timingMissingActionCount is greater than 0.',
      ],
    },
  };
}

function summarizeSelfEnergyByActor(scenario, actionResultTimeline) {
  const summaries = new Map(
    scenario.actors.map(actor => [
      actor.id,
      {
        actorId: actor.id,
        actorName: actor.name,
        resource: 'sp',
        delta: 0,
      },
    ])
  );

  for (const entry of actionResultTimeline) {
    if (!entry.actorId) {
      continue;
    }
    if (!summaries.has(entry.actorId)) {
      summaries.set(entry.actorId, {
        actorId: entry.actorId,
        actorName: entry.actorName,
        resource: entry.selfEnergyChange.resource,
        delta: 0,
      });
    }
    const summary = summaries.get(entry.actorId);
    summary.delta += entry.selfEnergyChange.value;
    summary.resource = entry.selfEnergyChange.resource ?? summary.resource;
  }

  return [...summaries.values()];
}

function buildCandidateValueSeries(actionResultTimeline, durationMs) {
  const hitCandidates = actionResultTimeline.flatMap(entry =>
    (entry.hitCandidates ?? []).map((hitCandidate, index) => ({
      ...hitCandidate,
      sequenceIndex: index,
    }))
  );
  const series = [
    createCandidateSeries({
      key: 'hpDamageFormulaParamCandidate',
      label: 'HP参数候选',
      valueKind: 'TDamageElementParams.formulaParamValues',
      unit: 'raw-param',
      hitCandidates,
      getValues: createHpCandidateSeriesValues,
    }),
    createCandidateSeries({
      key: 'toughnessDamageCandidate',
      label: '削韧候选',
      valueKind: 'TDamageElementParams.weakBreakDamageRate',
      unit: 'raw-field',
      hitCandidates,
      getValues: hitCandidate =>
        hitCandidate.toughnessDamage?.weakBreakDamageRates ?? [],
    }),
    createCandidateSeries({
      key: 'selfEnergyCandidate',
      label: '能量候选',
      valueKind: 'TDamageElementParams.recoverSP',
      unit: 'raw-field',
      hitCandidates,
      getValues: hitCandidate =>
        hitCandidate.selfEnergyChange?.recoverSPValues ?? [],
    }),
  ];
  const activeSeries = series.filter(item => item.pointCount > 0);
  const pointCount = activeSeries.reduce(
    (sum, item) => sum + item.pointCount,
    0
  );
  const chart = buildCandidateValueChart(activeSeries, durationMs);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-action-result-candidate-value-series',
    status:
      pointCount > 0
        ? 'candidate-value-series-found-unapplied'
        : 'candidate-value-series-missing',
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    summary: {
      seriesCount: activeSeries.length,
      pointCount,
      hitCandidateCount: hitCandidates.length,
      actionCount: new Set(hitCandidates.map(item => item.actionId)).size,
      chartPointCount: chart.summary.pointCount,
      displayFrameAdjustmentCount: chart.summary.displayFrameAdjustmentCount,
      timeOrderStatus: chart.summary.timeOrderStatus,
      applied: false,
    },
    series,
    chart,
    applied: false,
  };
}

function buildCandidateValueChart(series, durationMs) {
  const normalizedDurationMs = Math.max(0, numberOrNull(durationMs) ?? 0);
  const chartSeries = series
    .map(item => createCandidateChartSeries(item, normalizedDurationMs))
    .filter(item => item.pointCount > 0);
  const pointCount = chartSeries.reduce(
    (sum, item) => sum + item.pointCount,
    0
  );
  const displayFrameAdjustmentCount = chartSeries.reduce(
    (sum, item) => sum + item.displayFrameAdjustmentCount,
    0
  );

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-candidate-value-series-chart',
    status:
      pointCount > 0
        ? 'candidate-chart-found-unapplied'
        : 'candidate-chart-missing',
    durationMs: normalizedDurationMs,
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    frameMs: roundTimelineMs(AZPR_TIMELINE_FRAME_MS),
    frameCount: Math.max(
      1,
      Math.round(normalizedDurationMs / AZPR_TIMELINE_FRAME_MS)
    ),
    summary: {
      seriesCount: chartSeries.length,
      pointCount,
      displayFrameAdjustmentCount,
      timeOrderStatus:
        displayFrameAdjustmentCount > 0
          ? 'source-times-non-monotonic-display-adjusted'
          : pointCount > 0
            ? 'source-times-monotonic'
            : 'no-candidate-points',
      applied: false,
    },
    series: chartSeries,
    applied: false,
  };
}

function createCandidateChartSeries(series, durationMs) {
  let previousDisplayFrameIndex = -1;
  let displayFrameAdjustmentCount = 0;
  const points = (series.points ?? [])
    .map((point, index) => {
      const chartPoint = createCandidateChartPoint({
        point,
        index,
        series,
        durationMs,
        previousDisplayFrameIndex,
      });
      if (!chartPoint) {
        return null;
      }
      previousDisplayFrameIndex = chartPoint.displayFrameIndex;
      if (chartPoint.displayFrameIndex !== chartPoint.sourceFrameIndex) {
        displayFrameAdjustmentCount += 1;
      }
      return chartPoint;
    })
    .filter(Boolean);

  return {
    key: series.key,
    label: series.label,
    valueKind: series.valueKind,
    unit: series.unit,
    status:
      points.length > 0
        ? 'candidate-chart-points-found-unapplied'
        : 'candidate-chart-points-missing',
    pointCount: points.length,
    valueMin: series.valueMin,
    valueMax: series.valueMax,
    valueRange: series.valueRange,
    frameMin: minNumber(points.map(point => point.displayFrameIndex)),
    frameMax: maxNumber(points.map(point => point.displayFrameIndex)),
    displayFrameAdjustmentCount,
    timeOrderStatus:
      displayFrameAdjustmentCount > 0
        ? 'source-times-non-monotonic-display-adjusted'
        : points.length > 0
          ? 'source-times-monotonic'
          : 'no-candidate-points',
    polylinePoints: points
      .map(point => `${point.xPercent},${point.yPercent}`)
      .join(' '),
    points,
    applied: false,
  };
}

function createCandidateChartPoint({
  point,
  index,
  series,
  durationMs,
  previousDisplayFrameIndex,
}) {
  const sourceTimeMs = numberOrNull(point.timeMs);
  if (!Number.isFinite(sourceTimeMs)) {
    return null;
  }

  const sourceFrameIndex = Math.max(
    0,
    Math.round(sourceTimeMs / AZPR_TIMELINE_FRAME_MS)
  );
  const displayFrameIndex = Math.max(
    sourceFrameIndex,
    previousDisplayFrameIndex + 1
  );
  const displayTimeMs = roundTimelineMs(
    displayFrameIndex * AZPR_TIMELINE_FRAME_MS
  );
  const value = Number(point.value);
  const valueMin = numberOrNull(series.valueMin) ?? value;
  const valueMax = numberOrNull(series.valueMax) ?? valueMin;
  const valueRange = Math.max(1, valueMax - valueMin);
  const yPercent =
    valueMax === valueMin
      ? 50
      : roundChartPercent(100 - ((value - valueMin) / valueRange) * 100);

  return {
    actionId: point.actionId,
    actionName: point.actionName,
    actionVariantLabel: point.actionVariantLabel,
    skillId: point.skillId,
    hitSkillId: point.hitSkillId,
    hitIndex: point.hitIndex,
    sequenceIndex: point.sequenceIndex ?? index,
    localFrameIndex: numberOrNull(point.primaryFrame),
    chainStartFrame: numberOrNull(point.chainStartFrame),
    absoluteFrameIndex: numberOrNull(point.absolutePrimaryFrame),
    sequenceTimingStatus: point.sequenceTimingStatus ?? null,
    sequenceTimingSourceStatus: point.sequenceTimingSourceStatus ?? null,
    sourceFrameIndex,
    sourceTimeMs: roundTimelineMs(sourceTimeMs),
    displayFrameIndex,
    displayFrameLabel: formatTimelineFrame(displayFrameIndex),
    displayTimeMs,
    timeAdjustmentStatus:
      displayFrameIndex !== sourceFrameIndex
        ? 'sequence-display-frame-adjusted'
        : point.sequenceTimingStatus === 'absolute-hit-frame-candidate-found'
          ? 'event-bridge-absolute-time-kept'
          : 'source-time-kept',
    xPercent: roundChartPercent(
      durationMs > 0 ? (displayTimeMs / durationMs) * 100 : 0
    ),
    yPercent,
    value: point.value,
    valueMin: point.valueMin,
    valueMax: point.valueMax,
    valueSamples: point.valueSamples ?? [],
    candidateCount: point.candidateCount,
    elementConfigIds: point.elementConfigIds ?? [],
    elementDetails: point.elementDetails ?? [],
    sourceStatus: point.sourceStatus,
    applied: false,
  };
}

function createCandidateSeries({
  key,
  label,
  valueKind,
  unit,
  hitCandidates,
  getValues,
}) {
  const points = hitCandidates
    .map((hitCandidate, index) =>
      createCandidateSeriesPoint(hitCandidate, index, getValues(hitCandidate))
    )
    .filter(Boolean);
  const values = points.map(point => point.value).filter(Number.isFinite);
  const valueMin = minNumber(values);
  const valueMax = maxNumber(values);

  return {
    key,
    label,
    valueKind,
    unit,
    status:
      points.length > 0
        ? 'candidate-points-found-unapplied'
        : 'candidate-points-missing',
    pointCount: points.length,
    valueMin,
    valueMax,
    valueRange: numberRange(valueMin, valueMax),
    points,
    applied: false,
  };
}

function createCandidateSeriesPoint(hitCandidate, sequenceIndex, rawValues) {
  const valueSamples = uniqueNumbers(rawValues);
  if (valueSamples.length === 0) {
    return null;
  }
  const valueMin = minNumber(valueSamples);
  const valueMax = maxNumber(valueSamples);

  return {
    actionId: hitCandidate.actionId,
    actionName: hitCandidate.actionName,
    actionVariantLabel: hitCandidate.actionVariantLabel,
    skillId: numberOrNull(hitCandidate.skillId),
    hitSkillId: numberOrNull(hitCandidate.hitSkillId),
    hitIndex: numberOrNull(hitCandidate.hitIndex),
    sequenceIndex,
    frameRate: hitCandidate.frameRate ?? AZPR_TIMELINE_FRAME_RATE,
    primaryFrame: numberOrNull(hitCandidate.primaryFrame),
    localCandidateTimeMs: numberOrNull(hitCandidate.localCandidateTimeMs),
    absolutePrimaryFrame: numberOrNull(hitCandidate.absolutePrimaryFrame),
    absoluteCandidateTimeMs: numberOrNull(hitCandidate.absoluteCandidateTimeMs),
    chainStartFrame: numberOrNull(hitCandidate.chainStartFrame),
    sequenceTimingStatus: hitCandidate.sequenceTimingStatus ?? null,
    sequenceTimingSourceStatus: hitCandidate.sequenceTimingSourceStatus ?? null,
    timeMs: numberOrNull(hitCandidate.candidateTimeMs),
    value: valueMax,
    valueMin,
    valueMax,
    valueSamples,
    candidateCount: valueSamples.length,
    elementConfigIds: hitCandidate.damageElementElementConfigIds ?? [],
    elementDetails: createCandidateElementDetails(hitCandidate),
    sourceStatus: hitCandidate.status,
    applied: false,
  };
}

function createHpCandidateSeriesValues(hitCandidate) {
  const rawFormulaParamValues = (hitCandidate.candidates ?? []).flatMap(
    candidate => candidate.hpDamage?.rawFormulaParamValues ?? []
  );
  return rawFormulaParamValues
    .map(numberOrNull)
    .filter(value => Number.isFinite(value) && value > 0 && value !== 10000);
}

function createCandidateElementDetails(hitCandidate) {
  return (hitCandidate.candidates ?? []).map(candidate => ({
    elementConfigId: numberOrNull(candidate.elementConfigId),
    elementName: candidate.elementName ?? null,
    pathId: candidate.pathId ?? null,
    hpDamage: candidate.hpDamage
      ? {
          status: candidate.hpDamage.status ?? null,
          rawFormulaParamValues: createHpCandidateSeriesValues({
            candidates: [candidate],
          }),
          formulaFunctionIds: uniqueNumbers(
            Object.values(candidate.hpDamage.formulaFunctionIds ?? {})
              .map(numberOrNull)
              .filter(Number.isFinite)
          ),
          formulaFunctionMatchedIds: uniqueNumbers(
            candidate.hpDamage.formulaFunctionMatchedIds ?? []
          ),
          formulaFunctionRefs: createCandidateFormulaFunctionRefs(
            candidate.hpDamage.formulaFunctionEvidence
          ),
          formulaFunctionEvidence:
            candidate.hpDamage.formulaFunctionEvidence ?? null,
        }
      : null,
    toughnessDamage: candidate.toughnessDamage
      ? {
          status: candidate.toughnessDamage.status ?? null,
          weakBreakDamageRate: numberOrNull(
            candidate.toughnessDamage.weakBreakDamageRate
          ),
          hitType: numberOrNull(candidate.toughnessDamage.hitType),
          interruptPriority: numberOrNull(
            candidate.toughnessDamage.interruptPriority
          ),
          useOneBreak: numberOrNull(candidate.toughnessDamage.useOneBreak),
        }
      : null,
    selfEnergyChange: candidate.selfEnergyChange
      ? {
          status: candidate.selfEnergyChange.status ?? null,
          recoverSP: numberOrNull(candidate.selfEnergyChange.recoverSP),
          petRecoverSP: numberOrNull(candidate.selfEnergyChange.petRecoverSP),
          recoverInterval: numberOrNull(
            candidate.selfEnergyChange.recoverInterval
          ),
          ownerScope: candidate.selfEnergyChange.ownerScope ?? null,
        }
      : null,
    skillLevelBridge: compactCandidateSkillLevelBridge(
      candidate.skillLevelBridge
    ),
    applied: false,
  }));
}

function createCandidateFormulaFunctionRefs(evidence) {
  return (evidence?.functionRefs ?? []).map(ref => ({
    field: ref.field ?? null,
    functionId: numberOrNull(ref.functionId),
    functionOutput: ref.elementFormulaRow?.functionOutput ?? null,
    variables: ref.elementFormulaRow?.variables ?? [],
    variableInputs: (ref.variableInputs ?? []).map(input => ({
      variable: input.variable ?? null,
      paramId: numberOrNull(input.paramId),
      formulaParamSlot: numberOrNull(input.formulaParamSlot),
      formulaParamValue: numberOrNull(input.formulaParamValue),
      slotStatus: input.slotStatus ?? null,
    })),
    applied: ref.applied === true,
  }));
}

function compactCandidateSkillLevelBridge(bridge) {
  if (!bridge) {
    return null;
  }
  return {
    status: bridge.status ?? null,
    levelRows: numberOrNull(bridge.levelRows) ?? 0,
    parameterIds: bridge.parameterIds ?? [],
    varyingParameterIds: bridge.varyingParameterIds ?? [],
    formulaSlotAlignment:
      bridge.formulaSlotAlignment ??
      compactFormulaSlotAlignment(bridge.formulaParamAlignment),
    firstLevel: bridge.firstLevel
      ? {
          level: numberOrNull(bridge.firstLevel.level),
          valueParam: bridge.firstLevel.valueParam ?? null,
        }
      : null,
    lastLevel: bridge.lastLevel
      ? {
          level: numberOrNull(bridge.lastLevel.level),
          valueParam: bridge.lastLevel.valueParam ?? null,
        }
      : null,
  };
}

const PREFERRED_FORMULA_CANDIDATE_STRATEGY =
  'function_2-current-level-value-param';

function summarizeFormulaCandidatePatterns(actionResultTimeline) {
  const baseActionSummaries = actionResultTimeline
    .map(createFormulaCandidatePatternActionSummary)
    .filter(Boolean);

  if (baseActionSummaries.length === 0) {
    return {
      status: 'no-comparable-formula-candidate-patterns',
      actionCount: actionResultTimeline.length,
      comparableActionCount: 0,
      preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
      strategies: [],
      skillControlBehaviorCorrelations: [],
      actionSummaries: [],
      applied: false,
      note: 'Formula candidate pattern summary is evidence-only until the runtime DamageElement execution chain is confirmed.',
    };
  }

  const skillControlBehaviorCorrelations =
    createSkillControlBehaviorCorrelations(baseActionSummaries);
  const skillControlBehaviorCorrelationBySkillId = new Map(
    skillControlBehaviorCorrelations.map(correlation => [
      Number(correlation.skillId),
      correlation,
    ])
  );
  const actionSummaries = baseActionSummaries.map(summary => ({
    ...summary,
    skillControlBehaviorCorrelation:
      compactSkillControlBehaviorCorrelationForAction(
        skillControlBehaviorCorrelationBySkillId.get(Number(summary.skillId)),
        summary
      ),
  }));

  const requiredScales = finiteValues(
    actionSummaries.map(item => item.requiredScaleToRaw)
  );
  const requiredPerHitScales = finiteValues(
    actionSummaries.map(item => item.requiredPerHitScaleToRaw)
  );
  const actionMultipliers = finiteValues(
    actionSummaries.map(item => item.actionMultiplier)
  );
  const rawProjectionValues = finiteValues(
    actionSummaries.map(item => item.rawProjectionValue)
  );
  const previewRoundedValues = finiteValues(
    actionSummaries.map(item => item.previewRoundedValue)
  );
  const requiredScaleMin = minNumber(requiredScales);
  const requiredScaleMax = maxNumber(requiredScales);
  const actionMultiplierMin = minNumber(actionMultipliers);
  const actionMultiplierMax = maxNumber(actionMultipliers);
  const uniquePreviewRoundedValues = uniqueNumbers(previewRoundedValues);

  return {
    status:
      actionSummaries.length > 1
        ? 'formula-candidate-patterns-found'
        : 'single-formula-candidate-pattern',
    actionCount: actionResultTimeline.length,
    comparableActionCount: actionSummaries.length,
    preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
    strategies: uniqueStrings(actionSummaries.map(item => item.strategy)),
    requiredScaleMin,
    requiredScaleMax,
    requiredScaleRange: numberRange(requiredScaleMin, requiredScaleMax),
    requiredPerHitScaleMin: minNumber(requiredPerHitScales),
    requiredPerHitScaleMax: maxNumber(requiredPerHitScales),
    actionMultiplierMin,
    actionMultiplierMax,
    actionMultiplierRange: numberRange(
      actionMultiplierMin,
      actionMultiplierMax
    ),
    rawProjectionMin: minNumber(rawProjectionValues),
    rawProjectionMax: maxNumber(rawProjectionValues),
    previewRoundedValueCount: uniquePreviewRoundedValues.length,
    previewRoundedValues: uniquePreviewRoundedValues,
    scaleSpreadStatus: createScaleSpreadStatus(requiredScales),
    previewValueStatus:
      uniquePreviewRoundedValues.length <= 1
        ? 'same-preview-across-actions'
        : 'preview-varies-by-action',
    behaviorCorrelationStatus: inferBehaviorCorrelationStatus(
      skillControlBehaviorCorrelations
    ),
    missingRuntimeScaleStatus: inferMissingRuntimeScaleStatus({
      actionSummaries,
      actionMultiplierMin,
      actionMultiplierMax,
      uniquePreviewRoundedValues,
    }),
    skillControlBehaviorCorrelations,
    actionSummaries,
    applied: false,
    note: 'Formula candidate patterns compare unconfirmed DamageElement previews against current raw HP projection; they are diagnostics only.',
  };
}

function createFormulaCandidatePatternActionSummary(entry) {
  const sourceEvidence = entry.hpDamage?.sourceEvidence;
  const preview = selectComparableFormulaCombinationPreview(
    sourceEvidence?.formulaCandidatePreview?.combinationPreviews ?? []
  );
  const comparison = preview?.comparison;
  if (
    !preview ||
    comparison?.status !== 'compared-to-raw-projection' ||
    !Number.isFinite(numberOrNull(comparison.requiredScaleToRaw))
  ) {
    return null;
  }

  const rawProjection =
    sourceEvidence?.formulaCandidatePreview?.rawProjection ?? {};
  const candidate = (sourceEvidence?.candidates ?? []).find(
    item => Number(item.elementConfigId) === Number(preview.elementConfigId)
  );

  return {
    actionId: entry.actionId,
    actionName: entry.actionName,
    actionType: entry.actionType,
    actorId: entry.actorId,
    actorName: entry.actorName,
    skillId: entry.skillId,
    actionVariantIndex: numberOrNull(sourceEvidence?.actionVariantIndex),
    actionVariantLabel: sourceEvidence?.actionVariantLabel ?? null,
    elementConfigId: numberOrNull(preview.elementConfigId),
    strategy: preview.strategy,
    expression: preview.expression,
    inputSource: preview.inputSource,
    rawProjectionValue: numberOrNull(comparison.rawProjectionValue),
    previewRoundedValue: numberOrNull(comparison.previewRoundedValue),
    ratioToRawProjection: numberOrNull(comparison.ratioToRawProjection),
    requiredScaleToRaw: numberOrNull(comparison.requiredScaleToRaw),
    requiredPerHitScaleToRaw: numberOrNull(comparison.requiredPerHitScaleToRaw),
    actionMultiplier: numberOrNull(rawProjection.actionMultiplier),
    rawMultiplier: rawProjection.rawMultiplier ?? null,
    hitCount: numberOrNull(preview.hitCount),
    damageFields: compactDamageFieldPatternValues(
      candidate?.fieldCandidate?.damageFields
    ),
    status: 'formula-candidate-pattern-comparable',
    applied: false,
  };
}

function selectComparableFormulaCombinationPreview(previews) {
  return (
    previews.find(
      preview =>
        preview.strategy === PREFERRED_FORMULA_CANDIDATE_STRATEGY &&
        preview.comparison?.status === 'compared-to-raw-projection'
    ) ??
    previews.find(
      preview => preview.comparison?.status === 'compared-to-raw-projection'
    ) ??
    null
  );
}

function summarizeFormulaExecutionMatrices(actionResultTimeline) {
  const actionSummaries = actionResultTimeline
    .map(createFormulaExecutionMatrixActionSummary)
    .filter(Boolean);
  const rows = actionSummaries.flatMap(summary => summary.rows ?? []);

  if (rows.length === 0) {
    return {
      status: 'no-formula-execution-matrices',
      actionCount: actionResultTimeline.length,
      matrixActionCount: 0,
      rowCount: 0,
      elementCount: 0,
      preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
      actionSummaries: [],
      elementSummaries: [],
      applied: false,
      note: 'Formula execution matrix summary is evidence-only until DamageElement runtime execution is confirmed.',
    };
  }

  const requiredScales = finiteValues(rows.map(row => row.requiredScaleToRaw));
  const requiredPerHitScales = finiteValues(
    rows.map(row => row.requiredPerHitScaleToRaw)
  );
  const previewRoundedValues = finiteValues(
    rows.map(row => row.previewRoundedValue)
  );
  const rawProjectionValues = finiteValues(
    rows.map(row => row.rawProjectionValue)
  );
  const rowsWithLargeDifference = rows.filter(
    row => row.differenceStatus === 'large-difference'
  ).length;
  const rowsWithSlotOverrideCandidates = rows.filter(
    row => row.slotOverrideCandidateCount > 0
  ).length;
  const rowsWithDirectSlotMatches = rows.filter(
    row => row.directSlotMatchCount > 0
  ).length;
  const rowsWithHitBindings = rows.filter(row => row.boundHitCount > 0).length;
  const elementSummaries = createFormulaExecutionElementSummaries(rows);
  const requiredScaleMin = minNumber(requiredScales);
  const requiredScaleMax = maxNumber(requiredScales);
  const requiredPerHitScaleMin = minNumber(requiredPerHitScales);
  const requiredPerHitScaleMax = maxNumber(requiredPerHitScales);

  return {
    status:
      actionSummaries.length > 1
        ? 'formula-execution-matrices-found'
        : 'single-formula-execution-matrix',
    actionCount: actionResultTimeline.length,
    matrixActionCount: actionSummaries.length,
    actionVariantCount: uniqueStrings(
      actionSummaries.map(summary => summary.actionVariantLabel)
    ).length,
    actionVariantLabels: uniqueStrings(
      actionSummaries.map(summary => summary.actionVariantLabel)
    ),
    rowCount: rows.length,
    elementCount: elementSummaries.length,
    preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
    requiredScaleMin,
    requiredScaleMax,
    requiredScaleRange: numberRange(requiredScaleMin, requiredScaleMax),
    requiredPerHitScaleMin,
    requiredPerHitScaleMax,
    requiredPerHitScaleRange: numberRange(
      requiredPerHitScaleMin,
      requiredPerHitScaleMax
    ),
    rawProjectionMin: minNumber(rawProjectionValues),
    rawProjectionMax: maxNumber(rawProjectionValues),
    previewRoundedValueCount: uniqueNumbers(previewRoundedValues).length,
    previewRoundedValues: uniqueNumbers(previewRoundedValues),
    scaleSpreadStatus: createScaleSpreadStatus(requiredScales),
    perHitScaleSpreadStatus: createScaleSpreadStatus(requiredPerHitScales),
    hitBindingCoverageStatus: createFormulaMatrixCoverageStatus({
      matchedCount: rowsWithHitBindings,
      totalCount: rows.length,
      allStatus: 'all-rows-have-hit-bindings',
      partialStatus: 'some-rows-missing-hit-bindings',
      noneStatus: 'no-rows-have-hit-bindings',
    }),
    slotOverrideCoverageStatus: createFormulaMatrixCoverageStatus({
      matchedCount: rowsWithSlotOverrideCandidates,
      totalCount: rows.length,
      allStatus: 'all-rows-have-slot-override-candidates',
      partialStatus: 'some-rows-missing-slot-override-candidates',
      noneStatus: 'no-rows-have-slot-override-candidates',
    }),
    rowsWithLargeDifference,
    rowsWithSlotOverrideCandidates,
    rowsWithDirectSlotMatches,
    rowsWithHitBindings,
    unresolved: uniqueStrings(rows.flatMap(row => row.unresolved ?? [])),
    diagnostics: {
      functionCombinationOrderStatus: 'unconfirmed',
      levelOverrideApplicationStatus: 'unconfirmed',
      perHitMultiplierAllocationStatus: 'unconfirmed',
      crossActionMatrixStatus:
        actionSummaries.length > 1
          ? 'cross-action-matrix-summary-built'
          : 'needs-more-action-samples',
      scaleSpreadStatus: createScaleSpreadStatus(requiredScales),
      hitBindingCoverageStatus: createFormulaMatrixCoverageStatus({
        matchedCount: rowsWithHitBindings,
        totalCount: rows.length,
        allStatus: 'all-rows-have-hit-bindings',
        partialStatus: 'some-rows-missing-hit-bindings',
        noneStatus: 'no-rows-have-hit-bindings',
      }),
    },
    actionSummaries,
    elementSummaries,
    applied: false,
    note: 'Formula execution matrices aggregate unconfirmed per-action DamageElement diagnostics; they do not define final HP/toughness/energy formulas.',
  };
}

function createFormulaExecutionMatrixActionSummary(entry) {
  const matrix = entry.hpDamage?.sourceEvidence?.formulaExecutionEvidenceMatrix;
  if (!matrix || matrix.rowCount <= 0) {
    return null;
  }

  const rawProjection =
    entry.hpDamage?.sourceEvidence?.formulaCandidatePreview?.rawProjection ??
    {};
  const rows = (matrix.rows ?? [])
    .map(row =>
      compactFormulaExecutionMatrixSummaryRow({
        entry,
        matrix,
        rawProjection,
        row,
      })
    )
    .filter(Boolean);
  const requiredScales = finiteValues(rows.map(row => row.requiredScaleToRaw));
  const requiredPerHitScales = finiteValues(
    rows.map(row => row.requiredPerHitScaleToRaw)
  );
  const rowsWithLargeDifference = rows.filter(
    row => row.differenceStatus === 'large-difference'
  ).length;
  const rowsWithHitBindings = rows.filter(row => row.boundHitCount > 0).length;

  return {
    actionId: entry.actionId,
    actionName: entry.actionName,
    actionType: entry.actionType,
    actorId: entry.actorId,
    actorName: entry.actorName,
    skillId: entry.skillId,
    actionVariantIndex: matrix.actionVariantIndex,
    actionVariantLabel: matrix.actionVariantLabel,
    rawMultiplier: rawProjection.rawMultiplier ?? null,
    actionMultiplier: numberOrNull(rawProjection.actionMultiplier),
    rowCount: rows.length,
    elementConfigIds: uniqueNumbers(rows.map(row => row.elementConfigId)),
    requiredScaleMin: minNumber(requiredScales),
    requiredScaleMax: maxNumber(requiredScales),
    requiredPerHitScaleMin: minNumber(requiredPerHitScales),
    requiredPerHitScaleMax: maxNumber(requiredPerHitScales),
    rowsWithLargeDifference,
    rowsWithHitBindings,
    slotOverrideCandidateCount: rows.reduce(
      (sum, row) => sum + row.slotOverrideCandidateCount,
      0
    ),
    directSlotMatchCount: rows.reduce(
      (sum, row) => sum + row.directSlotMatchCount,
      0
    ),
    hitBindingCoverageStatus: createFormulaMatrixCoverageStatus({
      matchedCount: rowsWithHitBindings,
      totalCount: rows.length,
      allStatus: 'all-rows-have-hit-bindings',
      partialStatus: 'some-rows-missing-hit-bindings',
      noneStatus: 'no-rows-have-hit-bindings',
    }),
    unresolved: uniqueStrings(rows.flatMap(row => row.unresolved ?? [])),
    rows,
    status: 'formula-execution-matrix-action-summary',
    applied: false,
  };
}

function compactFormulaExecutionMatrixSummaryRow({
  entry,
  matrix,
  rawProjection,
  row,
}) {
  const preferred = row.preferredFunctionOrderCandidate;
  if (!preferred) {
    return null;
  }

  const gap = row.perHitScaleGap ?? {};
  const slotOverrideCandidateVariables = uniqueStrings(
    (row.slotOverrideCandidates ?? []).map(slot => slot.variable)
  );
  const directSlotMatchVariables = uniqueStrings(
    (row.directSlotMatches ?? []).map(slot => slot.variable)
  );

  return {
    actionId: entry.actionId,
    actionName: entry.actionName,
    actionVariantIndex: matrix.actionVariantIndex,
    actionVariantLabel: matrix.actionVariantLabel,
    skillId: entry.skillId,
    elementConfigId: row.elementConfigId,
    pathId: row.pathId ?? null,
    hitIndexes: row.hitIndexes ?? [],
    hitBindingStatus: row.hitBindingStatus,
    preferredStrategy: preferred.strategy ?? null,
    expression: preferred.expression ?? null,
    inputSource: preferred.inputSource ?? null,
    rawMultiplier: rawProjection.rawMultiplier ?? null,
    actionMultiplier: numberOrNull(rawProjection.actionMultiplier),
    rawProjectionValue: numberOrNull(gap.rawProjectionValue),
    previewRoundedValue: numberOrNull(gap.previewRoundedValue),
    ratioToRawProjection: numberOrNull(gap.ratioToRawProjection),
    requiredScaleToRaw: numberOrNull(gap.requiredScaleToRaw),
    requiredPerHitScaleToRaw: numberOrNull(gap.requiredPerHitScaleToRaw),
    hitCount: numberOrNull(gap.hitCount),
    boundHitCount: numberOrNull(gap.boundHitCount) ?? 0,
    differenceStatus: gap.differenceStatus ?? null,
    functionOrderCandidateCount: row.functionOrderCandidates?.length ?? 0,
    slotOverrideCandidateCount: row.slotOverrideCandidates?.length ?? 0,
    slotOverrideCandidateVariables,
    directSlotMatchCount: row.directSlotMatches?.length ?? 0,
    directSlotMatchVariables,
    unresolved: row.unresolved ?? [],
    applied: false,
  };
}

function createFormulaExecutionElementSummaries(rows) {
  const byElement = new Map();

  for (const row of rows) {
    if (!byElement.has(row.elementConfigId)) {
      byElement.set(row.elementConfigId, []);
    }
    byElement.get(row.elementConfigId).push(row);
  }

  return [...byElement.entries()]
    .map(([elementConfigId, elementRows]) => {
      const requiredScales = finiteValues(
        elementRows.map(row => row.requiredScaleToRaw)
      );
      const requiredPerHitScales = finiteValues(
        elementRows.map(row => row.requiredPerHitScaleToRaw)
      );
      const rowsWithHitBindings = elementRows.filter(
        row => row.boundHitCount > 0
      ).length;
      const requiredScaleMin = minNumber(requiredScales);
      const requiredScaleMax = maxNumber(requiredScales);
      const requiredPerHitScaleMin = minNumber(requiredPerHitScales);
      const requiredPerHitScaleMax = maxNumber(requiredPerHitScales);

      return {
        elementConfigId,
        actionCount: uniqueStrings(elementRows.map(row => row.actionId)).length,
        actionIds: uniqueStrings(elementRows.map(row => row.actionId)),
        actionVariantLabels: uniqueStrings(
          elementRows.map(row => row.actionVariantLabel)
        ),
        hitIndexes: uniqueNumbers(elementRows.flatMap(row => row.hitIndexes)),
        rowCount: elementRows.length,
        requiredScaleMin,
        requiredScaleMax,
        requiredScaleRange: numberRange(requiredScaleMin, requiredScaleMax),
        requiredPerHitScaleMin,
        requiredPerHitScaleMax,
        requiredPerHitScaleRange: numberRange(
          requiredPerHitScaleMin,
          requiredPerHitScaleMax
        ),
        scaleSpreadStatus: createScaleSpreadStatus(requiredScales),
        slotOverrideCandidateVariables: uniqueStrings(
          elementRows.flatMap(row => row.slotOverrideCandidateVariables)
        ),
        directSlotMatchVariables: uniqueStrings(
          elementRows.flatMap(row => row.directSlotMatchVariables)
        ),
        rowsWithLargeDifference: elementRows.filter(
          row => row.differenceStatus === 'large-difference'
        ).length,
        rowsWithHitBindings,
        hitBindingCoverageStatus: createFormulaMatrixCoverageStatus({
          matchedCount: rowsWithHitBindings,
          totalCount: elementRows.length,
          allStatus: 'all-rows-have-hit-bindings',
          partialStatus: 'some-rows-missing-hit-bindings',
          noneStatus: 'no-rows-have-hit-bindings',
        }),
        unresolved: uniqueStrings(
          elementRows.flatMap(row => row.unresolved ?? [])
        ),
        applied: false,
      };
    })
    .sort(
      (left, right) =>
        Number(left.elementConfigId) - Number(right.elementConfigId)
    );
}

function createFormulaMatrixCoverageStatus({
  matchedCount,
  totalCount,
  allStatus,
  partialStatus,
  noneStatus,
}) {
  if (totalCount <= 0 || matchedCount <= 0) {
    return noneStatus;
  }
  return matchedCount >= totalCount ? allStatus : partialStatus;
}

function attachFormulaExecutionEvidenceMatrix(hpDamage, action, hitCandidates) {
  const sourceEvidence = hpDamage?.sourceEvidence;
  const formulaCandidatePreview = sourceEvidence?.formulaCandidatePreview;
  if (!sourceEvidence || !formulaCandidatePreview) {
    return hpDamage;
  }

  return {
    ...hpDamage,
    sourceEvidence: {
      ...sourceEvidence,
      formulaExecutionEvidenceMatrix: createFormulaExecutionEvidenceMatrix({
        action,
        sourceEvidence,
        formulaCandidatePreview,
        hitCandidates,
      }),
    },
  };
}

function createFormulaExecutionEvidenceMatrix({
  action,
  sourceEvidence,
  formulaCandidatePreview,
  hitCandidates,
}) {
  const rows = (sourceEvidence?.candidates ?? [])
    .map(candidate =>
      createFormulaExecutionEvidenceMatrixRow({
        action,
        candidate,
        formulaCandidatePreview,
        hitCandidates,
      })
    )
    .filter(Boolean);
  const unresolved = uniqueStrings(rows.flatMap(row => row.unresolved ?? []));
  const rowsWithLargeDifference = rows.filter(
    row => row.perHitScaleGap?.differenceStatus === 'large-difference'
  ).length;
  const rowsWithSlotOverrideCandidates = rows.filter(
    row => row.slotOverrideCandidates.length > 0
  ).length;
  const rowsWithHitBindings = rows.filter(
    row => row.hitIndexes.length > 0
  ).length;

  return {
    status:
      rows.length > 0
        ? 'evidence-matrix-built-execution-unconfirmed'
        : 'no-formula-execution-evidence',
    actionId: action?.id ?? null,
    actionName: action?.name ?? null,
    actionType: action?.type ?? null,
    actorId: action?.actorId ?? null,
    actorName: action?.actor?.name ?? null,
    skillId: numberOrNull(action?.skillId),
    actionVariantIndex: numberOrNull(sourceEvidence?.actionVariantIndex),
    actionVariantLabel: sourceEvidence?.actionVariantLabel ?? null,
    hitCount:
      numberOrNull(formulaCandidatePreview?.rawProjection?.hitCount) ??
      hitCandidates.length,
    elementCount: uniqueNumbers(rows.map(row => row.elementConfigId)).length,
    rowCount: rows.length,
    preferredStrategy: PREFERRED_FORMULA_CANDIDATE_STRATEGY,
    rows,
    diagnostics: {
      functionCombinationOrderStatus: 'unconfirmed',
      levelOverrideApplicationStatus: 'unconfirmed',
      perHitMultiplierAllocationStatus: 'unconfirmed',
      rowsWithLargeDifference,
      rowsWithSlotOverrideCandidates,
      rowsWithHitBindings,
      unresolved,
      note: 'Function order, level-value override point and per-hit multiplier allocation remain unconfirmed.',
    },
    unresolved,
    applied: false,
    note: 'DamageElement execution matrix is evidence-only and must not be used as the final HP/toughness/energy formula until runtime execution is confirmed.',
  };
}

function createFormulaExecutionEvidenceMatrixRow({
  action,
  candidate,
  formulaCandidatePreview,
  hitCandidates,
}) {
  const elementConfigId = numberOrNull(candidate.elementConfigId);
  if (!Number.isFinite(elementConfigId)) {
    return null;
  }

  const functionOrderCandidates = prioritizeFormulaExecutionCandidates(
    (formulaCandidatePreview.combinationPreviews ?? [])
      .filter(preview => Number(preview.elementConfigId) === elementConfigId)
      .map(compactFormulaExecutionCombinationCandidate)
  );
  const preferredFunctionOrderCandidate =
    selectComparableFormulaExecutionCandidate(functionOrderCandidates);
  const slotSummaries =
    candidate.skillLevelBridge?.formulaSlotAlignment?.parameterSummaries ?? [];
  const slotOverrideCandidates = slotSummaries
    .filter(
      summary => summary.relationStatus === 'level-scaling-override-candidate'
    )
    .map(compactFormulaExecutionSlotSummary);
  const directSlotMatches = slotSummaries
    .filter(summary => summary.relationStatus === 'constant-direct-slot-match')
    .map(compactFormulaExecutionSlotSummary);
  const hitIndexes = collectFormulaExecutionHitIndexes(
    hitCandidates,
    elementConfigId
  );

  return {
    actionId: action?.id ?? null,
    actionName: action?.name ?? null,
    actionVariantLabel:
      action?.selectedActionVariant?.label ??
      action?.selectedDamageSegment?.label ??
      null,
    skillId: numberOrNull(action?.skillId),
    elementConfigId,
    pathId: candidate.pathId ?? null,
    hitIndexes,
    hitBindingStatus:
      hitIndexes.length > 0
        ? 'per-hit-candidate-bound'
        : 'per-hit-candidate-not-found',
    functionOrderCandidates,
    preferredFunctionOrderCandidate,
    slotOverrideCandidates,
    directSlotMatches,
    perHitScaleGap: createFormulaExecutionPerHitScaleGap({
      preferredFunctionOrderCandidate,
      hitIndexes,
    }),
    unresolved: [
      'function-combination-order-unconfirmed',
      'level-override-application-point-unconfirmed',
      'per-hit-multiplier-allocation-unconfirmed',
    ],
    applied: false,
  };
}

function prioritizeFormulaExecutionCandidates(candidates) {
  return [...candidates].sort((left, right) => {
    const preferredDelta =
      Number(right.strategy === PREFERRED_FORMULA_CANDIDATE_STRATEGY) -
      Number(left.strategy === PREFERRED_FORMULA_CANDIDATE_STRATEGY);
    if (preferredDelta !== 0) {
      return preferredDelta;
    }

    const comparableDelta =
      Number(right.comparisonStatus === 'compared-to-raw-projection') -
      Number(left.comparisonStatus === 'compared-to-raw-projection');
    if (comparableDelta !== 0) {
      return comparableDelta;
    }

    return String(left.strategy).localeCompare(String(right.strategy));
  });
}

function compactFormulaExecutionCombinationCandidate(preview) {
  const comparison = preview.comparison ?? {};
  return {
    strategy: preview.strategy ?? null,
    expression: preview.expression ?? null,
    inputSource: preview.inputSource ?? null,
    functionValues: Object.fromEntries(
      Object.entries(preview.functionValues ?? {}).map(([key, value]) => [
        key,
        numberOrNull(value),
      ])
    ),
    value: numberOrNull(preview.value),
    roundedValue: numberOrNull(preview.roundedValue),
    hitCount: numberOrNull(preview.hitCount),
    comparisonStatus: comparison.status ?? null,
    rawProjectionValue: numberOrNull(comparison.rawProjectionValue),
    previewRoundedValue: numberOrNull(comparison.previewRoundedValue),
    ratioToRawProjection: numberOrNull(comparison.ratioToRawProjection),
    requiredScaleToRaw: numberOrNull(comparison.requiredScaleToRaw),
    requiredPerHitScaleToRaw: numberOrNull(comparison.requiredPerHitScaleToRaw),
    differenceStatus: comparison.differenceStatus ?? null,
    status: preview.status ?? null,
    applied: preview.applied === true,
  };
}

function selectComparableFormulaExecutionCandidate(candidates) {
  return (
    candidates.find(
      candidate =>
        candidate.strategy === PREFERRED_FORMULA_CANDIDATE_STRATEGY &&
        candidate.comparisonStatus === 'compared-to-raw-projection'
    ) ??
    candidates.find(
      candidate => candidate.comparisonStatus === 'compared-to-raw-projection'
    ) ??
    null
  );
}

function compactFormulaExecutionSlotSummary(summary) {
  return {
    id: numberOrNull(summary.id),
    variable: summary.variable ?? null,
    relationStatus: summary.relationStatus ?? null,
    formulaParamValue: numberOrNull(summary.formulaParamValue),
    firstLevelValue: numberOrNull(summary.firstLevelValue),
    lastLevelValue: numberOrNull(summary.lastLevelValue),
    minValue: numberOrNull(summary.minValue),
    maxValue: numberOrNull(summary.maxValue),
    levelRows: numberOrNull(summary.levelRows) ?? 0,
    progression: summary.progression
      ? {
          status: summary.progression.status ?? null,
          step: numberOrNull(summary.progression.step),
          isArithmetic: summary.progression.isArithmetic === true,
        }
      : null,
    applied: false,
  };
}

function collectFormulaExecutionHitIndexes(hitCandidates, elementConfigId) {
  return uniqueNumbers(
    (hitCandidates ?? [])
      .filter(hitCandidate =>
        (hitCandidate.candidates ?? []).some(
          candidate => Number(candidate.elementConfigId) === elementConfigId
        )
      )
      .map(hitCandidate => hitCandidate.hitIndex)
  );
}

function createFormulaExecutionPerHitScaleGap({
  preferredFunctionOrderCandidate,
  hitIndexes,
}) {
  if (!preferredFunctionOrderCandidate) {
    return {
      status: 'no-comparable-function-order-candidate',
      hitCount: hitIndexes.length,
      boundHitCount: hitIndexes.length,
      applied: false,
    };
  }

  return {
    status: Number.isFinite(preferredFunctionOrderCandidate.requiredScaleToRaw)
      ? 'requires-runtime-scale-or-hit-allocation'
      : 'missing-comparable-scale',
    rawProjectionValue: preferredFunctionOrderCandidate.rawProjectionValue,
    previewRoundedValue: preferredFunctionOrderCandidate.previewRoundedValue,
    ratioToRawProjection: preferredFunctionOrderCandidate.ratioToRawProjection,
    requiredScaleToRaw: preferredFunctionOrderCandidate.requiredScaleToRaw,
    requiredPerHitScaleToRaw:
      preferredFunctionOrderCandidate.requiredPerHitScaleToRaw,
    hitCount: preferredFunctionOrderCandidate.hitCount ?? hitIndexes.length,
    boundHitCount: hitIndexes.length,
    differenceStatus: preferredFunctionOrderCandidate.differenceStatus,
    applied: false,
  };
}

function compactDamageFieldPatternValues(damageFields = {}) {
  return {
    amp: numberOrNull(damageFields.amp),
    physicalRatio: numberOrNull(damageFields.physicalRatio),
    elementCalFactor: numberOrNull(damageFields.elementCalFactor),
    formulaParamsCount: Array.isArray(damageFields.formulaParams)
      ? damageFields.formulaParams.length
      : 0,
  };
}

function createSkillControlBehaviorCorrelations(actionSummaries) {
  const skillIds = uniqueNumbers(actionSummaries.map(item => item.skillId));
  return skillIds.map(skillId =>
    createSkillControlBehaviorCorrelation(
      skillId,
      actionSummaries.filter(item => Number(item.skillId) === Number(skillId))
    )
  );
}

function createSkillControlBehaviorCorrelation(skillId, actionSummaries = []) {
  const evidence = CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID.get(
    Number(skillId)
  );
  if (!evidence) {
    return {
      status: 'no-skill-control-evidence',
      scope: 'skill-level',
      skillId: numberOrNull(skillId),
      correlationStatus: 'skill-control-evidence-missing',
      applied: false,
    };
  }

  if (evidence.status !== 'found') {
    return {
      status: evidence.status ?? 'skill-control-evidence-unavailable',
      scope: 'skill-level',
      skillId: numberOrNull(skillId),
      characterId: numberOrNull(evidence.characterId),
      skillName: evidence.skillName ?? null,
      expectedDirectory: evidence.expectedDirectory ?? null,
      correlationStatus: 'skill-control-evidence-missing',
      applied: false,
    };
  }

  const hpLaneCandidates =
    evidence.effectLaneCandidatesByLane?.hpDamage ??
    (evidence.effectLaneCandidates ?? []).filter(chain =>
      (chain.laneHints ?? []).includes('hpDamage')
    );
  const hpBehaviorChains = (
    evidence.effectLaneBehaviorChainsByLane?.hpDamage ??
    evidence.effectLaneBehaviorChains ??
    []
  ).filter(chain => (chain.laneHints ?? []).includes('hpDamage'));
  const actionVariantBindingCandidates = createActionVariantBindingCandidates(
    actionSummaries,
    hpBehaviorChains,
    Number(skillId)
  );
  const actionVariantBindingSummary = summarizeActionVariantBindings(
    actionVariantBindingCandidates
  );
  const stateTimingEvidence = compactSkillStateTimingEvidence(
    evidence.stateTimingEvidence
  );
  const sampledResolvedHpBehaviors = hpBehaviorChains.flatMap(chain =>
    (chain.resolvedBehaviors ?? []).map(behavior => ({
      ...behavior,
      sourceName: chain.sourceName ?? null,
      sourceStartFrame: numberOrNull(chain.sourceStartFrame),
      sourceEndFrame: numberOrNull(chain.sourceEndFrame),
    }))
  );
  const resourceBindings = summarizeSkillControlResourceBindings(
    sampledResolvedHpBehaviors
  );

  return {
    status:
      (evidence.effectLaneCandidateSummary?.hpDamage?.count ?? 0) > 0
        ? 'skill-level-hp-behavior-candidates-found'
        : 'skill-level-hp-behavior-candidates-missing',
    sourceKind: 'azpr-skill-control-behavior-chain-evidence',
    file: SKILL_ASSET_EVIDENCE_PATH,
    scope: 'skill-level-not-action-variant-bound',
    skillId: numberOrNull(skillId),
    characterId: numberOrNull(evidence.characterId),
    skillName: evidence.skillName ?? null,
    hpLaneCandidateCount:
      numberOrNull(evidence.effectLaneCandidateSummary?.hpDamage?.count) ?? 0,
    behaviorListRefCount:
      numberOrNull(evidence.behaviorReferenceSummary?.behaviorListRefs) ?? 0,
    resolvedBehaviorListRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.resolvedBehaviorListRefs
      ) ?? 0,
    resolvedHpBehaviorRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.resolvedBehaviorRefsByLane?.hpDamage
      ) ?? 0,
    scriptTypeCandidateBehaviorRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.scriptTypeCandidateBehaviorRefs
      ) ?? 0,
    externalElementBaseRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.externalElementBaseRefs
      ) ?? 0,
    resourceMapMatchedElementBaseRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.resourceMapMatchedElementBaseRefs
      ) ?? 0,
    resourceMapUnmatchedElementBaseRefCount:
      numberOrNull(
        evidence.behaviorReferenceSummary?.resourceMapUnmatchedElementBaseRefs
      ) ?? 0,
    sampledHpBehaviorChainCount: hpBehaviorChains.length,
    sampledHpLaneCandidateCount: hpLaneCandidates.length,
    sampledResolvedHpBehaviorCount: sampledResolvedHpBehaviors.length,
    stateTimingEvidence,
    actionVariantBindingSummary,
    actionVariantBindingCandidates,
    hitFrameStartFrames: uniqueNumbers(
      sampledResolvedHpBehaviors.map(behavior => behavior.startFrame)
    ),
    hitFrameWindows: createSkillControlHitFrameWindows(hpBehaviorChains),
    resourceBindings,
    sampledBehaviorChains: hpBehaviorChains
      .slice(0, 5)
      .map(compactSkillControlBehaviorChain),
    correlationStatus: 'skill-level-only-action-variant-binding-unresolved',
    actionVariantBindingStatus:
      actionVariantBindingSummary.boundCandidateCount > 0
        ? 'action-variant-binding-candidates-generated-unconfirmed'
        : 'action-variant-binding-candidates-missing',
    stateTimingEvidenceStatus:
      stateTimingEvidence?.status ?? 'state-timing-evidence-missing',
    applied: false,
    note: 'Skill control behavior evidence is linked at skill level only; action-variant and per-hit runtime binding remain unconfirmed.',
  };
}

function createActionVariantBindingCandidates(
  actionSummaries,
  hpBehaviorChains,
  skillId
) {
  const compactChains = hpBehaviorChains.map(compactBehaviorChainForBinding);
  return actionSummaries.map(actionSummary => {
    const candidates = compactChains
      .map(chain =>
        scoreBehaviorChainForActionVariant(actionSummary, chain, skillId)
      )
      .filter(candidate => candidate.score > 0)
      .sort(compareActionVariantBindingCandidates)
      .slice(0, 5);

    return {
      actionId: actionSummary.actionId,
      actionVariantIndex: actionSummary.actionVariantIndex,
      actionVariantLabel: actionSummary.actionVariantLabel,
      rawMultiplier: actionSummary.rawMultiplier,
      status:
        candidates.length > 0
          ? 'action-variant-binding-candidates-found'
          : 'action-variant-binding-candidates-missing',
      confidence: candidates[0]?.confidence ?? 'none',
      candidateCount: candidates.length,
      candidates,
      applied: false,
    };
  });
}

function summarizeActionVariantBindings(bindings) {
  const bound = bindings.filter(item => item.candidateCount > 0);
  return {
    actionVariantCount: bindings.length,
    boundCandidateCount: bound.length,
    confidenceLevels: uniqueStrings(bound.map(item => item.confidence)),
    statuses: uniqueStrings(bindings.map(item => item.status)),
  };
}

function compactBehaviorChainForBinding(chain) {
  const resolvedBehaviors = chain.resolvedBehaviors ?? [];
  const refs = resolvedBehaviors.flatMap(
    behavior => behavior.elementBaseDataRefs ?? []
  );
  const matches = refs.flatMap(ref => ref.resourceMapMatches ?? []);

  return {
    sourceName: chain.sourceName ?? null,
    sourceTrackName: chain.sourceTrackName ?? null,
    sourceStartFrame: numberOrNull(chain.sourceStartFrame),
    sourceEndFrame: numberOrNull(chain.sourceEndFrame),
    behaviorStartFrames: uniqueNumbers(
      resolvedBehaviors.map(behavior => behavior.startFrame)
    ),
    behaviorFrameCounts: uniqueNumbers(
      resolvedBehaviors.map(behavior => behavior.frameCount)
    ),
    resolvedBehaviorPathIds: uniqueStrings(
      resolvedBehaviors.map(behavior => behavior.pathId)
    ),
    scriptClassNames: uniqueStrings(
      resolvedBehaviors.map(behavior => behavior.scriptTypeCandidate?.className)
    ),
    elementBaseRefCount: refs.length,
    subSkillIds: uniqueNumbers(matches.flatMap(match => match.subSkillIds)),
    stateNames: uniqueStrings(matches.flatMap(match => match.stateNames)),
    hitEffects: uniqueStrings(matches.flatMap(match => match.hitEffects)),
    elementRoundedPathIds: uniqueStrings(refs.map(ref => ref.roundedPathId)),
    elementPathIds: uniqueStrings(refs.map(ref => ref.pathId)),
  };
}

function scoreBehaviorChainForActionVariant(actionSummary, chain, skillId) {
  const label = normalizeBindingText(actionSummary.actionVariantLabel);
  const sourceName = normalizeBindingText(chain.sourceName);
  const isNormalAction = label === '普攻' || label === '普通攻击';
  const isExplicitNormalChain = sourceName.includes('普通');
  const expectedDerivedSubSkillId = Number.isFinite(skillId)
    ? skillId * 10 + 1
    : null;
  let score = 0;
  const reasons = [];

  if (isNormalAction && isExplicitNormalChain) {
    score += 60;
    reasons.push('normal-action-name-match');
  }
  if (
    isNormalAction &&
    (chain.stateNames.includes('Skill0_1') ||
      chain.subSkillIds.includes(Number(skillId)))
  ) {
    score += 35;
    reasons.push('normal-action-state-or-subskill-match');
  }
  if (!isNormalAction && !isExplicitNormalChain) {
    score += 20;
    reasons.push('non-normal-shared-chain-name-candidate');
  }
  if (
    !isNormalAction &&
    (chain.stateNames.includes('Skill0_6') ||
      chain.subSkillIds.includes(expectedDerivedSubSkillId))
  ) {
    score += 35;
    reasons.push('non-normal-shared-state-or-derived-subskill-candidate');
  }
  if (chain.scriptClassNames.includes('InjectToTargetKeyFrameBehaviorData')) {
    score += 10;
    reasons.push('inject-to-target-keyframe-behavior');
  }
  if (chain.elementBaseRefCount > 0) {
    score += 5;
    reasons.push('element-base-data-linked');
  }

  return {
    ...chain,
    score,
    confidence: createActionVariantBindingConfidence(score),
    bindingStatus: createActionVariantBindingStatus({
      isNormalAction,
      isExplicitNormalChain,
      score,
    }),
    reasons,
    applied: false,
  };
}

function createActionVariantBindingConfidence(score) {
  if (score >= 90) {
    return 'medium';
  }
  if (score >= 60) {
    return 'low';
  }
  if (score > 0) {
    return 'weak';
  }
  return 'none';
}

function createActionVariantBindingStatus({
  isNormalAction,
  isExplicitNormalChain,
  score,
}) {
  if (score <= 0) {
    return 'not-a-candidate';
  }
  if (isNormalAction && isExplicitNormalChain) {
    return 'normal-action-name-state-candidate-unconfirmed';
  }
  return 'shared-action-family-candidate-unconfirmed';
}

function compareActionVariantBindingCandidates(left, right) {
  return (
    right.score - left.score ||
    (left.sourceStartFrame ?? 0) - (right.sourceStartFrame ?? 0) ||
    String(left.sourceName).localeCompare(String(right.sourceName))
  );
}

function normalizeBindingText(value) {
  return String(value ?? '').trim();
}

function summarizeSkillControlResourceBindings(behaviors) {
  const refs = behaviors.flatMap(
    behavior => behavior.elementBaseDataRefs ?? []
  );
  const matches = refs.flatMap(ref => ref.resourceMapMatches ?? []);

  return {
    sampledElementBaseRefCount: refs.length,
    sampledMatchedElementBaseRefCount: refs.filter(
      ref => (ref.resourceMapMatchCount ?? 0) > 0
    ).length,
    subSkillIds: uniqueNumbers(matches.flatMap(match => match.subSkillIds)),
    stateNames: uniqueStrings(matches.flatMap(match => match.stateNames)),
    effects: uniqueStrings(matches.flatMap(match => match.effects)),
    hitEffects: uniqueStrings(matches.flatMap(match => match.hitEffects)),
    elementRoundedPathIds: uniqueStrings(refs.map(ref => ref.roundedPathId)),
    elementPathIds: uniqueStrings(refs.map(ref => ref.pathId)),
  };
}

function compactSkillStateTimingEvidence(evidence) {
  if (!evidence) {
    return null;
  }
  return {
    status: evidence.status ?? 'state-timing-evidence-missing',
    scope: evidence.scope ?? 'skill-level-action-state-candidates',
    bindingStatus:
      evidence.bindingStatus ?? 'state-timing-evidence-candidates-unconfirmed',
    hpStateWindowCount: numberOrNull(evidence.hpStateWindowCount) ?? 0,
    timingControlChainCount:
      numberOrNull(evidence.timingControlChainCount) ?? 0,
    animationStateControlCount:
      numberOrNull(evidence.animationStateControlCount) ?? 0,
    eventBridgeControlCount:
      numberOrNull(evidence.eventBridgeControlCount) ?? 0,
    hpStateNames: evidence.hpStateNames ?? [],
    animationStateNames: evidence.animationStateNames ?? [],
    eventBridgeSkillIds: evidence.eventBridgeSkillIds ?? [],
    eventBridgeTypes: evidence.eventBridgeTypes ?? [],
    eventBridgeValues: evidence.eventBridgeValues ?? [],
    eventBridgeTargetSkillControlEvidence:
      compactEventBridgeTargetSkillControlEvidence(
        evidence.eventBridgeTargetSkillControlEvidence
      ),
    stateFindings: (evidence.stateFindings ?? []).slice(0, 6).map(item => ({
      stateName: item.stateName ?? null,
      status: item.status ?? null,
      hpWindowCount: numberOrNull(item.hpWindowCount) ?? 0,
      hpStartFrames: item.hpStartFrames ?? [],
      subSkillIds: item.subSkillIds ?? [],
      hitEffects: item.hitEffects ?? [],
      animationControlCount: numberOrNull(item.animationControlCount) ?? 0,
      animationFrameWindows: (item.animationFrameWindows ?? [])
        .slice(0, 3)
        .map(window => ({
          sourceName: window.sourceName ?? null,
          sourceStartFrame: numberOrNull(window.sourceStartFrame),
          sourceEndFrame: numberOrNull(window.sourceEndFrame),
          aniStartFrame: numberOrNull(window.aniStartFrame),
          aniEndFrame: numberOrNull(window.aniEndFrame),
          aniLength: numberOrNull(window.aniLength),
        })),
      overlappingEventBridgeCount:
        numberOrNull(item.overlappingEventBridgeCount) ?? 0,
      overlappingEventBridgeNames: item.overlappingEventBridgeNames ?? [],
      applied: false,
    })),
    animationStateControls: (evidence.animationStateControls ?? [])
      .slice(0, 4)
      .map(item => ({
        sourceName: item.sourceName ?? null,
        sourceStartFrame: numberOrNull(item.sourceStartFrame),
        sourceEndFrame: numberOrNull(item.sourceEndFrame),
        selectedStateName: item.selectedStateName ?? null,
        behaviorStartFrame: numberOrNull(item.behaviorStartFrame),
        behaviorFrameCount: numberOrNull(item.behaviorFrameCount),
        timelineGroupIndex: numberOrNull(item.timelineGroupIndex),
        aniLength: numberOrNull(item.aniLength),
        aniStartFrame: numberOrNull(item.aniStartFrame),
        aniEndFrame: numberOrNull(item.aniEndFrame),
      })),
    eventBridgeControls: (evidence.eventBridgeControls ?? [])
      .slice(0, 5)
      .map(item => ({
        sourceName: item.sourceName ?? null,
        sourceStartFrame: numberOrNull(item.sourceStartFrame),
        sourceEndFrame: numberOrNull(item.sourceEndFrame),
        skillId: numberOrNull(item.skillId),
        bridge: numberOrNull(item.bridge),
        type: numberOrNull(item.type),
        frameIndex: numberOrNull(item.frameIndex),
        allowAttack: numberOrNull(item.allowAttack),
        allowMove: numberOrNull(item.allowMove),
        allowJump: numberOrNull(item.allowJump),
        allowDodge: numberOrNull(item.allowDodge),
        allowedInputs: item.allowedInputs ?? [],
      })),
    applied: false,
  };
}

function compactEventBridgeTargetSkillControlEvidence(evidence) {
  if (!evidence) {
    return null;
  }
  return {
    status: evidence.status ?? 'event-bridge-target-skill-controls-missing',
    directTargetSkillIds: evidence.directTargetSkillIds ?? [],
    targetSkillIds: evidence.targetSkillIds ?? [],
    targetSkillControlCount:
      numberOrNull(evidence.targetSkillControlCount) ?? 0,
    foundTargetSkillControlCount:
      numberOrNull(evidence.foundTargetSkillControlCount) ?? 0,
    missingTargetSkillControlCount:
      numberOrNull(evidence.missingTargetSkillControlCount) ?? 0,
    childSkillTargetIds: evidence.childSkillTargetIds ?? [],
    chainDepthMax: numberOrNull(evidence.chainDepthMax),
    targetAnimationStateNames: evidence.targetAnimationStateNames ?? [],
    targetHpTrackNames: evidence.targetHpTrackNames ?? [],
    normalAttackChainCandidate: evidence.normalAttackChainCandidate
      ? {
          status: evidence.normalAttackChainCandidate.status ?? null,
          chainSkillIds:
            evidence.normalAttackChainCandidate.chainSkillIds ?? [],
          chainLength:
            numberOrNull(evidence.normalAttackChainCandidate.chainLength) ?? 0,
          animationStateNames:
            evidence.normalAttackChainCandidate.animationStateNames ?? [],
          hpTimelineCandidateCount:
            numberOrNull(
              evidence.normalAttackChainCandidate.hpTimelineCandidateCount
            ) ?? 0,
          hpTrackNames: evidence.normalAttackChainCandidate.hpTrackNames ?? [],
          bridgeTargetSkillIds:
            evidence.normalAttackChainCandidate.bridgeTargetSkillIds ?? [],
          applied: false,
        }
      : null,
    normalAttackHitChainCandidate: evidence.normalAttackHitChainCandidate
      ? compactNormalAttackHitChainCandidate(
          evidence.normalAttackHitChainCandidate
        )
      : null,
    targetSkillControls: (evidence.targetSkillControls ?? [])
      .slice(0, 6)
      .map(item => ({
        skillId: numberOrNull(item.skillId),
        status: item.status ?? null,
        skillTableStatus: item.skillTableStatus ?? null,
        parentSkill: numberOrNull(item.parentSkill),
        relationToSourceSkill: item.relationToSourceSkill ?? null,
        discoveryDepth: numberOrNull(item.discoveryDepth),
        discoveredFromSkillId: numberOrNull(item.discoveredFromSkillId),
        animationStateControlCount:
          numberOrNull(item.animationStateControlCount) ?? 0,
        animationStateNames: item.animationStateNames ?? [],
        hpTimelineCandidateCount:
          numberOrNull(item.hpTimelineCandidateCount) ?? 0,
        hpTimelineCandidates: (item.hpTimelineCandidates ?? [])
          .slice(0, 4)
          .map(candidate => ({
            name: candidate.name ?? null,
            trackName: candidate.trackName ?? null,
            startFrame: numberOrNull(candidate.startFrame),
            endFrame: numberOrNull(candidate.endFrame),
          })),
        eventBridgeSkillIds: item.eventBridgeSkillIds ?? [],
      })),
    applied: false,
  };
}

function compactNormalAttackHitChainCandidate(candidate) {
  return {
    status: candidate.status ?? null,
    bindingStatus: candidate.bindingStatus ?? null,
    expectedHitCount: numberOrNull(candidate.expectedHitCount),
    expectedHitCountSource: candidate.expectedHitCountSource ?? null,
    descriptionSectionTitle: candidate.descriptionSectionTitle ?? null,
    candidateHitGroupCount: numberOrNull(candidate.candidateHitGroupCount) ?? 0,
    coverageStatus: candidate.coverageStatus ?? null,
    chainSkillIds: candidate.chainSkillIds ?? [],
    animationStateNames: candidate.animationStateNames ?? [],
    hpTimelineCandidateCount:
      numberOrNull(candidate.hpTimelineCandidateCount) ?? 0,
    hpTrackNames: candidate.hpTrackNames ?? [],
    damageElementFieldMappingStatus:
      candidate.damageElementFieldMappingStatus ?? null,
    damageElementMappedHitGroupCount:
      numberOrNull(candidate.damageElementMappedHitGroupCount) ?? 0,
    damageElementFieldMappingCount:
      numberOrNull(candidate.damageElementFieldMappingCount) ?? 0,
    damageElementElementConfigIds:
      candidate.damageElementElementConfigIds ?? [],
    damageElementPathIds: candidate.damageElementPathIds ?? [],
    hitGroups: (candidate.hitGroups ?? []).slice(0, 6).map(group => ({
      hitIndex: numberOrNull(group.hitIndex),
      label: group.label ?? null,
      candidateSource: group.candidateSource ?? null,
      skillId: numberOrNull(group.skillId),
      discoveryDepth: numberOrNull(group.discoveryDepth),
      discoveredFromSkillId: numberOrNull(group.discoveredFromSkillId),
      animationStateNames: group.animationStateNames ?? [],
      hpTimelineCandidateCount:
        numberOrNull(group.hpTimelineCandidateCount) ?? 0,
      candidateCountStatus: group.candidateCountStatus ?? null,
      hpFrameStartFrames: group.hpFrameStartFrames ?? [],
      hpTrackNames: group.hpTrackNames ?? [],
      subSkillIds: group.subSkillIds ?? [],
      hitEffects: group.hitEffects ?? [],
      behaviorChainCandidateCount:
        numberOrNull(group.behaviorChainCandidateCount) ?? 0,
      resolvedBehaviorCount: numberOrNull(group.resolvedBehaviorCount) ?? 0,
      externalElementBaseRefCount:
        numberOrNull(group.externalElementBaseRefCount) ?? 0,
      resourceMapMatchedElementBaseRefCount:
        numberOrNull(group.resourceMapMatchedElementBaseRefCount) ?? 0,
      resourceMapUnmatchedElementBaseRefCount:
        numberOrNull(group.resourceMapUnmatchedElementBaseRefCount) ?? 0,
      elementBaseDataRefs: (group.elementBaseDataRefs ?? [])
        .slice(0, 12)
        .map(compactNormalAttackHitElementBaseDataRef),
      damageElementFieldMappingStatus:
        group.damageElementFieldMappingStatus ?? null,
      damageElementFieldMappingCount:
        numberOrNull(group.damageElementFieldMappingCount) ?? 0,
      damageElementElementConfigIds: group.damageElementElementConfigIds ?? [],
      damageElementPathIds: group.damageElementPathIds ?? [],
      damageElementFieldMappings: (group.damageElementFieldMappings ?? [])
        .slice(0, 6)
        .map(compactNormalAttackHitDamageElementFieldMapping),
      confidence: group.confidence ?? null,
      bindingStatus: group.bindingStatus ?? null,
      hpTimelineCandidates: (group.hpTimelineCandidates ?? [])
        .slice(0, 12)
        .map(item => ({
          name: item.name ?? null,
          trackName: item.trackName ?? null,
          startFrame: numberOrNull(item.startFrame),
          endFrame: numberOrNull(item.endFrame),
          stateNames: item.stateNames ?? [],
          subSkillIds: item.subSkillIds ?? [],
          hitEffects: item.hitEffects ?? [],
        })),
      applied: false,
    })),
    applied: false,
  };
}

function compactNormalAttackHitElementBaseDataRef(ref) {
  return {
    fileId: numberOrNull(ref.fileId),
    pathId: ref.pathId ?? null,
    roundedPathId: ref.roundedPathId ?? null,
    status: ref.status ?? null,
    resourceMapMatchCount: numberOrNull(ref.resourceMapMatchCount) ?? 0,
    resourceMapMatches: (ref.resourceMapMatches ?? [])
      .slice(0, 3)
      .map(match => ({
        stateNames: match.stateNames ?? [],
        subSkillIds: match.subSkillIds ?? [],
        hitEffects: match.hitEffects ?? [],
      })),
  };
}

function compactNormalAttackHitDamageElementFieldMapping(mapping) {
  return {
    elementConfigId: numberOrNull(mapping.elementConfigId),
    pathId: mapping.pathId ?? null,
    elementName: mapping.elementName ?? null,
    scriptTypeCandidate: mapping.scriptTypeCandidate
      ? {
          status: mapping.scriptTypeCandidate.status,
          confidence: mapping.scriptTypeCandidate.confidence,
          className: mapping.scriptTypeCandidate.className,
        }
      : null,
    hpDamage: {
      status: mapping.hpDamage?.status ?? null,
      formulaFunctionIds: mapping.hpDamage?.formulaFunctionIds ?? {},
      formulaFunctionStatus: mapping.hpDamage?.formulaFunctionStatus ?? null,
      formulaFunctionMatchedIds:
        mapping.hpDamage?.formulaFunctionMatchedIds ?? [],
      formulaFunctionEvidence: compactFormulaFunctionEvidence(
        mapping.hpDamage?.formulaFunctionEvidence
      ),
      rawFormulaParamValues: mapping.hpDamage?.rawFormulaParamValues ?? [],
      damageFields: compactDamageFieldPatternValues(
        mapping.hpDamage?.damageFields
      ),
    },
    toughnessDamage: {
      status: mapping.toughnessDamage?.status ?? null,
      weakBreakDamageRate: numberOrNull(
        mapping.toughnessDamage?.weakBreakDamageRate
      ),
      hitType: numberOrNull(mapping.toughnessDamage?.hitType),
      interruptPriority: numberOrNull(
        mapping.toughnessDamage?.interruptPriority
      ),
      useOneBreak: numberOrNull(mapping.toughnessDamage?.useOneBreak),
    },
    selfEnergyChange: {
      status: mapping.selfEnergyChange?.status ?? null,
      recoverSP: numberOrNull(mapping.selfEnergyChange?.recoverSP),
      petRecoverSP: numberOrNull(mapping.selfEnergyChange?.petRecoverSP),
      recoverInterval: numberOrNull(mapping.selfEnergyChange?.recoverInterval),
      ownerScope: mapping.selfEnergyChange?.ownerScope ?? null,
    },
    skillLevelBridge: {
      status: mapping.skillLevelBridge?.status ?? null,
      levelRows: numberOrNull(mapping.skillLevelBridge?.levelRows) ?? 0,
      parameterIds: mapping.skillLevelBridge?.parameterIds ?? [],
      varyingParameterIds: mapping.skillLevelBridge?.varyingParameterIds ?? [],
      formulaSlotAlignment:
        mapping.skillLevelBridge?.formulaSlotAlignment ??
        compactFormulaSlotAlignment(
          mapping.skillLevelBridge?.formulaParamAlignment
        ),
      firstLevel: mapping.skillLevelBridge?.firstLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.firstLevel.level),
            valueParam: mapping.skillLevelBridge.firstLevel.valueParam ?? null,
          }
        : null,
      lastLevel: mapping.skillLevelBridge?.lastLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.lastLevel.level),
            valueParam: mapping.skillLevelBridge.lastLevel.valueParam ?? null,
          }
        : null,
    },
    applied: false,
  };
}

function createSkillControlHitFrameWindows(hpBehaviorChains) {
  return hpBehaviorChains
    .map(chain => ({
      sourceName: chain.sourceName ?? null,
      sourceStartFrame: numberOrNull(chain.sourceStartFrame),
      sourceEndFrame: numberOrNull(chain.sourceEndFrame),
      resolvedBehaviorCount: (chain.resolvedBehaviors ?? []).length,
      behaviorStartFrames: uniqueNumbers(
        (chain.resolvedBehaviors ?? []).map(behavior => behavior.startFrame)
      ),
      behaviorFrameCounts: uniqueNumbers(
        (chain.resolvedBehaviors ?? []).map(behavior => behavior.frameCount)
      ),
      elementBaseRefCount: (chain.resolvedBehaviors ?? []).reduce(
        (sum, behavior) => sum + (behavior.externalElementBaseRefCount ?? 0),
        0
      ),
    }))
    .sort(
      (left, right) =>
        (left.sourceStartFrame ?? 0) - (right.sourceStartFrame ?? 0) ||
        String(left.sourceName).localeCompare(String(right.sourceName))
    );
}

function compactSkillControlBehaviorChain(chain) {
  return {
    laneHints: chain.laneHints ?? [],
    sourceName: chain.sourceName ?? null,
    sourceStartFrame: numberOrNull(chain.sourceStartFrame),
    sourceEndFrame: numberOrNull(chain.sourceEndFrame),
    behaviorRefCount: (chain.behaviorRefs ?? []).length,
    resolvedBehaviorCount: (chain.resolvedBehaviors ?? []).length,
    resolvedBehaviors: (chain.resolvedBehaviors ?? [])
      .slice(0, 3)
      .map(compactSkillControlResolvedBehavior),
  };
}

function compactSkillControlResolvedBehavior(behavior) {
  const refs = behavior.elementBaseDataRefs ?? [];
  const matches = refs.flatMap(ref => ref.resourceMapMatches ?? []);
  return {
    pathId: behavior.pathId ?? null,
    scriptTypeCandidate: behavior.scriptTypeCandidate
      ? {
          status: behavior.scriptTypeCandidate.status,
          confidence: behavior.scriptTypeCandidate.confidence,
          className: behavior.scriptTypeCandidate.className,
        }
      : null,
    startFrame: numberOrNull(behavior.startFrame),
    frameCount: numberOrNull(behavior.frameCount),
    externalElementBaseRefCount:
      numberOrNull(behavior.externalElementBaseRefCount) ?? 0,
    resourceMapMatchedElementBaseRefCount:
      numberOrNull(behavior.resourceMapMatchedElementBaseRefCount) ?? 0,
    elementBaseDataRefs: refs.slice(0, 5).map(ref => ({
      pathId: ref.pathId ?? null,
      roundedPathId: ref.roundedPathId ?? null,
      resourceMapMatchCount: numberOrNull(ref.resourceMapMatchCount) ?? 0,
    })),
    resourceBindings: {
      subSkillIds: uniqueNumbers(matches.flatMap(match => match.subSkillIds)),
      stateNames: uniqueStrings(matches.flatMap(match => match.stateNames)),
      hitEffects: uniqueStrings(matches.flatMap(match => match.hitEffects)),
    },
  };
}

function compactSkillControlBehaviorCorrelationForAction(
  correlation,
  actionSummary
) {
  if (!correlation) {
    return null;
  }
  const bindingCandidate = correlation.actionVariantBindingCandidates?.find(
    item => item.actionId === actionSummary.actionId
  );
  const primaryBindingCandidates = (bindingCandidate?.candidates ?? []).filter(
    item => item.confidence === bindingCandidate.confidence
  );
  const bindingStateNames = uniqueStrings(
    primaryBindingCandidates.flatMap(item => item.stateNames ?? [])
  );
  const stateTimingFindings = (
    correlation.stateTimingEvidence?.stateFindings ?? []
  ).filter(item => bindingStateNames.includes(item.stateName));
  return {
    status: correlation.status,
    scope: correlation.scope,
    hpLaneCandidateCount: correlation.hpLaneCandidateCount ?? 0,
    resolvedHpBehaviorRefCount: correlation.resolvedHpBehaviorRefCount ?? 0,
    sampledHpBehaviorChainCount: correlation.sampledHpBehaviorChainCount ?? 0,
    hitFrameStartFrames: correlation.hitFrameStartFrames ?? [],
    stateNames: correlation.resourceBindings?.stateNames ?? [],
    hitEffects: correlation.resourceBindings?.hitEffects ?? [],
    correlationStatus: correlation.correlationStatus,
    actionVariantBindingStatus: correlation.actionVariantBindingStatus,
    stateTimingEvidenceStatus: correlation.stateTimingEvidenceStatus,
    stateTimingFindings,
    actionVariantBindingCandidate: bindingCandidate
      ? {
          status: bindingCandidate.status,
          confidence: bindingCandidate.confidence,
          candidateCount: bindingCandidate.candidateCount,
          candidates: (bindingCandidate.candidates ?? [])
            .slice(0, 3)
            .map(item => ({
              sourceName: item.sourceName,
              sourceStartFrame: item.sourceStartFrame,
              sourceEndFrame: item.sourceEndFrame,
              stateNames: item.stateNames,
              subSkillIds: item.subSkillIds,
              hitEffects: item.hitEffects,
              score: item.score,
              confidence: item.confidence,
              bindingStatus: item.bindingStatus,
              reasons: item.reasons,
            })),
        }
      : null,
    applied: false,
  };
}

function inferBehaviorCorrelationStatus(correlations) {
  if (correlations.length === 0) {
    return 'no-skill-control-correlation';
  }
  if (
    correlations.some(
      correlation =>
        correlation.status === 'skill-level-hp-behavior-candidates-found'
    )
  ) {
    return 'skill-level-behavior-candidates-found-action-binding-unresolved';
  }
  return 'skill-level-behavior-candidates-missing';
}

function inferMissingRuntimeScaleStatus({
  actionSummaries,
  actionMultiplierMin,
  actionMultiplierMax,
  uniquePreviewRoundedValues,
}) {
  if (actionSummaries.length < 2) {
    return 'needs-more-action-samples';
  }
  if (
    uniquePreviewRoundedValues.length <= 1 &&
    Number.isFinite(actionMultiplierMin) &&
    Number.isFinite(actionMultiplierMax) &&
    Math.abs(actionMultiplierMax - actionMultiplierMin) > 0.01
  ) {
    return 'tracks-description-multiplier-before-runtime-hit-mapping';
  }
  return 'needs-runtime-hit-node-correlation';
}

function createScaleSpreadStatus(values) {
  const min = minNumber(values);
  const max = maxNumber(values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || values.length < 2) {
    return 'single-sample';
  }
  return Math.abs(max - min) > 0.1
    ? 'varies-by-action-variant'
    : 'stable-across-action-variants';
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

function numberRange(min, max) {
  return Number.isFinite(min) && Number.isFinite(max) ? max - min : null;
}

function buildActionResultTimeline({ scenario, damageEvents, resourceEvents }) {
  const damageByActionId = groupEventsByActionId(damageEvents);
  const resourcesByActionId = groupEventsByActionId(resourceEvents);

  return scenario.actions.map(action => {
    const actionDamageEvents = damageByActionId.get(action.id) ?? [];
    const actionResourceEvents = resourcesByActionId.get(action.id) ?? [];
    const primaryDamageEvent = actionDamageEvents[0] ?? null;
    const damageElementSource = createActionDamageElementSource(action);
    const hitCandidateResult = createActionHitCandidateResult({
      action,
      damageElementSource,
    });
    const hitCandidates = hitCandidateResult.hitCandidates;
    const hpDamage = attachFormulaExecutionEvidenceMatrix(
      createHpDamageResult(action, primaryDamageEvent, damageElementSource),
      action,
      hitCandidates
    );

    return {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
      timeMs: action.startMs,
      durationMs: action.durationMs,
      actorId: action.actorId ?? null,
      actorName: action.actor?.name ?? null,
      targetId: action.targetId ?? null,
      targetName: action.target?.name ?? null,
      skillId: action.skillId ?? null,
      hpDamage,
      toughnessDamage: createToughnessDamageResult(
        action,
        primaryDamageEvent,
        damageElementSource
      ),
      selfEnergyChange: createSelfEnergyChangeResult(
        action,
        actionResourceEvents,
        damageElementSource
      ),
      hitCandidateSummary: summarizeActionHitCandidates(
        hitCandidates,
        hitCandidateResult.sequenceTimingEvidence
      ),
      hitCandidates,
      sourceEventTypes: [
        ...actionDamageEvents.map(event => event.type),
        ...actionResourceEvents.map(event => event.type),
      ],
    };
  });
}

function createActionHitCandidateResult({ action, damageElementSource }) {
  if (!isNormalAttackAction(action)) {
    return {
      hitCandidates: [],
      sequenceTimingEvidence: null,
    };
  }

  const hitChain = getActionNormalAttackHitChainCandidate(action);
  if (!hitChain?.hitGroups?.length) {
    return {
      hitCandidates: [],
      sequenceTimingEvidence: null,
    };
  }
  const sequenceTimingEvidence = createNormalAttackSequenceTimingEvidence(
    action,
    hitChain
  );

  return {
    sequenceTimingEvidence,
    hitCandidates: hitChain.hitGroups.map(hitGroup =>
      createHitCandidatePreview({
        action,
        hitGroup,
        damageElementSource,
        hitChain,
        sequenceTimingEvidence,
      })
    ),
  };
}

function isNormalAttackAction(action) {
  if (!isSkillAction(action)) {
    return false;
  }

  const hitModel = action.selectedActionVariant?.hitModel;
  const label =
    action.selectedActionVariant?.label ??
    action.selectedDamageSegment?.label ??
    action.name;
  return (
    hitModel?.kind === 'normal-attack' ||
    normalizeBindingText(label) === '普攻' ||
    normalizeBindingText(label) === '普通攻击'
  );
}

function getActionNormalAttackHitChainCandidate(action) {
  const evidence = CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID.get(
    Number(action.skillId)
  );
  return (
    evidence?.stateTimingEvidence?.eventBridgeTargetSkillControlEvidence
      ?.normalAttackHitChainCandidate ?? null
  );
}

function createNormalAttackSequenceTimingEvidence(action, hitChain) {
  const sourceSkillId = numberOrNull(action.skillId);
  const evidence = CURRENT_SKILL_CONTROL_EVIDENCE_BY_SKILL_ID.get(
    Number(sourceSkillId)
  );
  const stateTimingEvidence = evidence?.stateTimingEvidence ?? null;
  const targetEvidence =
    stateTimingEvidence?.eventBridgeTargetSkillControlEvidence ?? null;
  const hitGroups = [...(hitChain.hitGroups ?? [])].sort(
    (left, right) => Number(left.hitIndex) - Number(right.hitIndex)
  );
  if (!sourceSkillId || hitGroups.length === 0 || !stateTimingEvidence) {
    return {
      status: 'normal-attack-sequence-timing-missing',
      sourceKind: 'azpr-normal-attack-sequence-timing-candidate',
      frameRate: AZPR_TIMELINE_FRAME_RATE,
      transitionCount: Math.max(0, hitGroups.length - 1),
      resolvedTransitionCount: 0,
      hitTimingCount: 0,
      hitTimings: [],
      transitions: [],
      applied: false,
    };
  }

  const controlsBySkillId = createSkillTimingControlsBySkillId({
    sourceSkillId,
    stateTimingEvidence,
    targetSkillControls: targetEvidence?.targetSkillControls ?? [],
  });
  const chainStartFrames = new Map([[sourceSkillId, 0]]);
  const transitions = [];

  for (let index = 1; index < hitGroups.length; index += 1) {
    const previousSkillId = numberOrNull(hitGroups[index - 1].skillId);
    const skillId = numberOrNull(hitGroups[index].skillId);
    const previousStartFrame = chainStartFrames.get(previousSkillId);
    const transition = findNormalAttackSequenceTransition({
      fromSkillId: previousSkillId,
      toSkillId: skillId,
      controlsBySkillId,
    });
    const chainStartFrame =
      Number.isFinite(previousStartFrame) && transition
        ? previousStartFrame + transition.bridgeStartFrame
        : null;

    if (Number.isFinite(chainStartFrame)) {
      chainStartFrames.set(skillId, chainStartFrame);
    }

    transitions.push({
      fromSkillId: previousSkillId,
      toSkillId: skillId,
      status: transition
        ? 'event-bridge-target-transition-found'
        : 'event-bridge-target-transition-missing',
      bridgeStartFrame: transition?.bridgeStartFrame ?? null,
      bridgeFrameIndex: transition?.bridgeFrameIndex ?? null,
      bridgeEndFrame: transition?.bridgeEndFrame ?? null,
      sourceBehaviorFrameCount: transition?.sourceBehaviorFrameCount ?? null,
      allowedInputs: transition?.allowedInputs ?? [],
      chainStartFrame,
      applied: false,
    });
  }

  const hitTimings = hitGroups.map(hitGroup => {
    const skillId = numberOrNull(hitGroup.skillId);
    const localFrameStartFrames = uniqueNumbers(
      hitGroup.hpFrameStartFrames ?? []
    );
    const localPrimaryFrame = localFrameStartFrames[0] ?? null;
    const chainStartFrame = chainStartFrames.get(skillId);
    const absoluteFrameStartFrames = Number.isFinite(chainStartFrame)
      ? localFrameStartFrames.map(frame => chainStartFrame + frame)
      : [];
    const absolutePrimaryFrame =
      Number.isFinite(chainStartFrame) && Number.isFinite(localPrimaryFrame)
        ? chainStartFrame + localPrimaryFrame
        : null;
    const animationSummary = summarizeSequenceAnimationControls(
      controlsBySkillId.get(skillId)?.animationStateControls ?? []
    );

    return {
      hitIndex: numberOrNull(hitGroup.hitIndex),
      skillId,
      status: Number.isFinite(absolutePrimaryFrame)
        ? 'absolute-hit-frame-candidate-found'
        : 'absolute-hit-frame-candidate-missing',
      chainStartFrame: Number.isFinite(chainStartFrame)
        ? chainStartFrame
        : null,
      localPrimaryFrame,
      localFrameStartFrames,
      absolutePrimaryFrame,
      absoluteFrameStartFrames,
      absoluteCandidateTimeMs: Number.isFinite(absolutePrimaryFrame)
        ? roundTimelineMs(
            action.startMs + frameToTimelineMs(absolutePrimaryFrame)
          )
        : null,
      animationStateNames: hitGroup.animationStateNames ?? [],
      animationControlCount: animationSummary.animationControlCount,
      animationFrameStartMin: animationSummary.animationFrameStartMin,
      animationFrameEndMax: animationSummary.animationFrameEndMax,
      applied: false,
    };
  });
  const resolvedTransitionCount = transitions.filter(
    transition => transition.status === 'event-bridge-target-transition-found'
  ).length;
  const absoluteFrames = hitTimings
    .map(hitTiming => hitTiming.absolutePrimaryFrame)
    .filter(Number.isFinite);

  return {
    status:
      resolvedTransitionCount === Math.max(0, hitGroups.length - 1) &&
      absoluteFrames.length === hitGroups.length
        ? 'normal-attack-sequence-absolute-frame-candidates-found'
        : resolvedTransitionCount > 0
          ? 'normal-attack-sequence-absolute-frame-candidates-partial'
          : 'normal-attack-sequence-absolute-frame-candidates-missing',
    sourceKind: 'azpr-normal-attack-sequence-timing-candidate',
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    sourceSkillId,
    transitionCount: Math.max(0, hitGroups.length - 1),
    resolvedTransitionCount,
    hitTimingCount: hitTimings.length,
    absoluteFrameStatus: isStrictlyIncreasing(absoluteFrames)
      ? 'absolute-hit-frames-strictly-increasing'
      : 'absolute-hit-frames-not-strictly-increasing',
    absolutePrimaryFrames: absoluteFrames,
    transitions,
    hitTimings,
    applied: false,
  };
}

function createSkillTimingControlsBySkillId({
  sourceSkillId,
  stateTimingEvidence,
  targetSkillControls,
}) {
  const controlsBySkillId = new Map();
  controlsBySkillId.set(sourceSkillId, {
    skillId: sourceSkillId,
    animationStateControls: stateTimingEvidence.animationStateControls ?? [],
    eventBridgeControls: stateTimingEvidence.eventBridgeControls ?? [],
  });
  for (const target of targetSkillControls ?? []) {
    const skillId = numberOrNull(target.skillId);
    if (!Number.isFinite(skillId)) {
      continue;
    }
    controlsBySkillId.set(skillId, {
      skillId,
      animationStateControls: target.animationStateControls ?? [],
      eventBridgeControls: target.eventBridgeControls ?? [],
    });
  }
  return controlsBySkillId;
}

function findNormalAttackSequenceTransition({
  fromSkillId,
  toSkillId,
  controlsBySkillId,
}) {
  if (!Number.isFinite(fromSkillId) || !Number.isFinite(toSkillId)) {
    return null;
  }
  const controls =
    controlsBySkillId.get(fromSkillId)?.eventBridgeControls ?? [];
  const candidates = controls
    .filter(control => numberOrNull(control.skillId) === toSkillId)
    .map(control => ({
      bridgeStartFrame: numberOrNull(
        control.behaviorStartFrame ?? control.sourceStartFrame
      ),
      bridgeFrameIndex: numberOrNull(control.frameIndex) ?? 0,
      sourceBehaviorFrameCount: numberOrNull(control.behaviorFrameCount),
      allowedInputs: control.allowedInputs ?? [],
      bridgeEndFrame:
        numberOrNull(control.behaviorStartFrame ?? control.sourceStartFrame) !=
          null && numberOrNull(control.behaviorFrameCount) != null
          ? numberOrNull(
              control.behaviorStartFrame ?? control.sourceStartFrame
            ) + numberOrNull(control.behaviorFrameCount)
          : null,
    }))
    .filter(candidate => Number.isFinite(candidate.bridgeStartFrame))
    .sort((left, right) => left.bridgeStartFrame - right.bridgeStartFrame);

  return candidates[0] ?? null;
}

function summarizeSequenceAnimationControls(animationStateControls) {
  const starts = (animationStateControls ?? [])
    .map(control =>
      numberOrNull(
        control.behaviorStartFrame ??
          control.sourceStartFrame ??
          control.aniStartFrame
      )
    )
    .filter(Number.isFinite);
  const ends = (animationStateControls ?? [])
    .map(control => {
      const start = numberOrNull(
        control.behaviorStartFrame ??
          control.sourceStartFrame ??
          control.aniStartFrame
      );
      const frameCount = numberOrNull(
        control.behaviorFrameCount ?? control.aniLength
      );
      const explicitEnd = numberOrNull(
        control.sourceEndFrame ?? control.aniEndFrame
      );
      if (Number.isFinite(start) && Number.isFinite(frameCount)) {
        return start + frameCount;
      }
      return explicitEnd;
    })
    .filter(Number.isFinite);

  return {
    animationControlCount: animationStateControls?.length ?? 0,
    animationFrameStartMin: minNumber(starts),
    animationFrameEndMax: maxNumber(ends),
  };
}

function isStrictlyIncreasing(values) {
  if (values.length <= 1) {
    return values.length === 1;
  }
  return values.every(
    (value, index) => index === 0 || value > values[index - 1]
  );
}

function createHitCandidatePreview({
  action,
  hitGroup,
  damageElementSource,
  hitChain,
  sequenceTimingEvidence,
}) {
  const mappings = hitGroup.damageElementFieldMappings ?? [];
  const actionLevelCandidateByElementId = new Map(
    (damageElementSource?.candidates ?? [])
      .map(candidate => [Number(candidate.elementConfigId), candidate])
      .filter(([elementConfigId]) => Number.isFinite(elementConfigId))
  );
  const mergedMappings = mappings.map(mapping =>
    mergeHitCandidateMappingEvidence(
      mapping,
      actionLevelCandidateByElementId.get(Number(mapping.elementConfigId))
    )
  );
  const frameStartFrames = uniqueNumbers(hitGroup.hpFrameStartFrames ?? []);
  const primaryFrame = frameStartFrames[0] ?? null;
  const localCandidateTimeMs =
    primaryFrame == null
      ? null
      : roundTimelineMs(action.startMs + frameToTimelineMs(primaryFrame));
  const hitTiming = (sequenceTimingEvidence?.hitTimings ?? []).find(
    timing => Number(timing.hitIndex) === Number(hitGroup.hitIndex)
  );
  const absolutePrimaryFrame = numberOrNull(hitTiming?.absolutePrimaryFrame);
  const absoluteCandidateTimeMs = numberOrNull(
    hitTiming?.absoluteCandidateTimeMs
  );
  const candidateTimeMs = Number.isFinite(absoluteCandidateTimeMs)
    ? absoluteCandidateTimeMs
    : localCandidateTimeMs;
  const actionLevelMatchedElementIds =
    damageElementSource?.matchedElementConfigIds ?? [];
  const actionLevelElementMatchCount = mappings.filter(mapping =>
    actionLevelMatchedElementIds.includes(Number(mapping.elementConfigId))
  ).length;

  return {
    sourceKind: 'azpr-normal-attack-per-hit-damage-element-candidate',
    file: SKILL_ASSET_EVIDENCE_PATH,
    actionId: action.id,
    actionName: action.name,
    actionVariantIndex: numberOrNull(
      action.actionVariantIndex ?? action.damageSegmentIndex
    ),
    actionVariantLabel:
      action.selectedActionVariant?.label ??
      action.selectedDamageSegment?.label ??
      null,
    skillId: numberOrNull(action.skillId),
    expectedHitCount: numberOrNull(hitChain.expectedHitCount),
    hitIndex: numberOrNull(hitGroup.hitIndex),
    label: hitGroup.label ?? null,
    candidateSource: hitGroup.candidateSource ?? null,
    hitSkillId: numberOrNull(hitGroup.skillId),
    animationStateNames: hitGroup.animationStateNames ?? [],
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    frameStartFrames,
    primaryFrame,
    localCandidateTimeMs,
    absolutePrimaryFrame,
    absoluteFrameStartFrames: hitTiming?.absoluteFrameStartFrames ?? [],
    absoluteCandidateTimeMs,
    chainStartFrame: numberOrNull(hitTiming?.chainStartFrame),
    sequenceTimingStatus: hitTiming?.status ?? null,
    sequenceTimingSourceStatus: sequenceTimingEvidence?.status ?? null,
    timeMsCandidates: frameStartFrames.map(frame =>
      roundTimelineMs(action.startMs + frameToTimelineMs(frame))
    ),
    candidateTimeMs,
    hpTimelineCandidateCount:
      numberOrNull(hitGroup.hpTimelineCandidateCount) ?? 0,
    behaviorChainCandidateCount:
      numberOrNull(hitGroup.behaviorChainCandidateCount) ?? 0,
    resolvedBehaviorCount: numberOrNull(hitGroup.resolvedBehaviorCount) ?? 0,
    externalElementBaseRefCount:
      numberOrNull(hitGroup.externalElementBaseRefCount) ?? 0,
    resourceMapMatchedElementBaseRefCount:
      numberOrNull(hitGroup.resourceMapMatchedElementBaseRefCount) ?? 0,
    damageElementFieldMappingStatus:
      hitGroup.damageElementFieldMappingStatus ?? null,
    damageElementFieldMappingCount: mappings.length,
    actionLevelElementMatchCount,
    actionLevelElementMatchStatus:
      actionLevelElementMatchCount > 0
        ? 'some-hit-elements-bridge-to-action-element-values'
        : 'hit-elements-not-bridged-to-action-element-values',
    damageElementElementConfigIds: uniqueNumbers(
      mappings.map(mapping => mapping.elementConfigId)
    ),
    hpDamage: summarizeHitCandidateHpDamage(mergedMappings),
    toughnessDamage: summarizeHitCandidateToughnessDamage(mergedMappings),
    selfEnergyChange: summarizeHitCandidateSelfEnergyChange(mergedMappings),
    candidates: mergedMappings.map(compactHitCandidateDamageElementMapping),
    sequenceTiming: hitTiming
      ? {
          status: hitTiming.status,
          chainStartFrame: hitTiming.chainStartFrame,
          localPrimaryFrame: hitTiming.localPrimaryFrame,
          absolutePrimaryFrame: hitTiming.absolutePrimaryFrame,
          localFrameStartFrames: hitTiming.localFrameStartFrames,
          absoluteFrameStartFrames: hitTiming.absoluteFrameStartFrames,
          absoluteCandidateTimeMs: hitTiming.absoluteCandidateTimeMs,
          animationControlCount: hitTiming.animationControlCount,
          animationFrameStartMin: hitTiming.animationFrameStartMin,
          animationFrameEndMax: hitTiming.animationFrameEndMax,
          applied: false,
        }
      : null,
    status:
      mappings.length > 0
        ? 'per-hit-candidate-fields-found-formula-unapplied'
        : 'per-hit-candidate-fields-missing',
    unresolved: [
      'damage-element-execution-order',
      'multi-candidate-combination-rule',
      'per-hit-scale-or-hit-count-weight',
      'enemy-defense-and-resistance-application',
      'self-energy-owner-and-interval-rule',
    ],
    applied: false,
  };
}

function mergeHitCandidateMappingEvidence(mapping, actionLevelCandidate) {
  if (!actionLevelCandidate) {
    return mapping;
  }

  return {
    ...mapping,
    hpDamage: mapping.hpDamage
      ? {
          ...actionLevelCandidate.hpDamage,
          ...mapping.hpDamage,
          formulaFunctionEvidence:
            mapping.hpDamage.formulaFunctionEvidence ??
            actionLevelCandidate.hpDamage?.formulaFunctionEvidence ??
            null,
          formulaSlotCandidates:
            mapping.hpDamage.formulaSlotCandidates ??
            actionLevelCandidate.hpDamage?.formulaSlotCandidates ??
            [],
        }
      : mapping.hpDamage,
    skillLevelBridge: {
      ...actionLevelCandidate.skillLevelBridge,
      ...mapping.skillLevelBridge,
      formulaParamAlignment:
        mapping.skillLevelBridge?.formulaParamAlignment ??
        actionLevelCandidate.skillLevelBridge?.formulaParamAlignment ??
        actionLevelCandidate.skillLevelBridge?.formulaSlotAlignment ??
        null,
      formulaSlotAlignment:
        mapping.skillLevelBridge?.formulaSlotAlignment ??
        actionLevelCandidate.skillLevelBridge?.formulaSlotAlignment ??
        null,
      firstLevel:
        mapping.skillLevelBridge?.firstLevel ??
        actionLevelCandidate.skillLevelBridge?.firstLevel ??
        null,
      lastLevel:
        mapping.skillLevelBridge?.lastLevel ??
        actionLevelCandidate.skillLevelBridge?.lastLevel ??
        null,
    },
  };
}

function summarizeHitCandidateHpDamage(mappings) {
  const hpMappings = mappings.filter(mapping => mapping.hpDamage);
  return {
    status:
      hpMappings.length > 0
        ? 'candidate-fields-found-formula-unmapped'
        : 'candidate-fields-missing',
    candidateCount: hpMappings.length,
    formulaFunctionIds: uniqueNumbers(
      hpMappings.flatMap(mapping =>
        Object.values(mapping.hpDamage?.formulaFunctionIds ?? {})
      )
    ),
    formulaFunctionStatuses: uniqueStrings(
      hpMappings.map(mapping => mapping.hpDamage?.formulaFunctionStatus)
    ),
    formulaFunctionMatchedIds: uniqueNumbers(
      hpMappings.flatMap(
        mapping => mapping.hpDamage?.formulaFunctionMatchedIds ?? []
      )
    ),
    rawFormulaParamValueSamples: uniqueNumbers(
      hpMappings.flatMap(mapping => mapping.hpDamage?.rawFormulaParamValues)
    ).slice(0, 12),
    applied: false,
  };
}

function summarizeHitCandidateToughnessDamage(mappings) {
  const toughnessMappings = mappings.filter(mapping => mapping.toughnessDamage);
  return {
    status:
      toughnessMappings.length > 0
        ? 'candidate-fields-found-formula-unmapped'
        : 'candidate-fields-missing',
    candidateCount: toughnessMappings.length,
    weakBreakDamageRates: uniqueNumbers(
      toughnessMappings.map(
        mapping => mapping.toughnessDamage?.weakBreakDamageRate
      )
    ),
    hitTypes: uniqueNumbers(
      toughnessMappings.map(mapping => mapping.toughnessDamage?.hitType)
    ),
    interruptPriorities: uniqueNumbers(
      toughnessMappings.map(
        mapping => mapping.toughnessDamage?.interruptPriority
      )
    ),
    useOneBreakValues: uniqueNumbers(
      toughnessMappings.map(mapping => mapping.toughnessDamage?.useOneBreak)
    ),
    applied: false,
  };
}

function summarizeHitCandidateSelfEnergyChange(mappings) {
  const energyMappings = mappings.filter(mapping => mapping.selfEnergyChange);
  return {
    status:
      energyMappings.length > 0
        ? 'candidate-fields-found-formula-unmapped'
        : 'candidate-fields-missing',
    candidateCount: energyMappings.length,
    recoverSPValues: uniqueNumbers(
      energyMappings.map(mapping => mapping.selfEnergyChange?.recoverSP)
    ),
    petRecoverSPValues: uniqueNumbers(
      energyMappings.map(mapping => mapping.selfEnergyChange?.petRecoverSP)
    ),
    recoverIntervals: uniqueNumbers(
      energyMappings.map(mapping => mapping.selfEnergyChange?.recoverInterval)
    ),
    ownerScopes: uniqueStrings(
      energyMappings.map(mapping => mapping.selfEnergyChange?.ownerScope)
    ),
    applied: false,
  };
}

function compactHitCandidateDamageElementMapping(mapping) {
  return {
    elementConfigId: numberOrNull(mapping.elementConfigId),
    pathId: mapping.pathId ?? null,
    elementName: mapping.elementName ?? null,
    hpDamage: mapping.hpDamage
      ? {
          status: mapping.hpDamage.status ?? null,
          formulaFunctionIds: mapping.hpDamage.formulaFunctionIds ?? {},
          formulaFunctionStatus: mapping.hpDamage.formulaFunctionStatus ?? null,
          formulaFunctionMatchedIds:
            mapping.hpDamage.formulaFunctionMatchedIds ?? [],
          formulaFunctionEvidence: compactFormulaFunctionEvidence(
            mapping.hpDamage.formulaFunctionEvidence
          ),
          rawFormulaParamValues: mapping.hpDamage.rawFormulaParamValues ?? [],
          damageFields: compactDamageFieldPatternValues(
            mapping.hpDamage.damageFields
          ),
        }
      : null,
    toughnessDamage: mapping.toughnessDamage
      ? {
          status: mapping.toughnessDamage.status ?? null,
          weakBreakDamageRate: numberOrNull(
            mapping.toughnessDamage.weakBreakDamageRate
          ),
          hitType: numberOrNull(mapping.toughnessDamage.hitType),
          interruptPriority: numberOrNull(
            mapping.toughnessDamage.interruptPriority
          ),
          useOneBreak: numberOrNull(mapping.toughnessDamage.useOneBreak),
        }
      : null,
    selfEnergyChange: mapping.selfEnergyChange
      ? {
          status: mapping.selfEnergyChange.status ?? null,
          recoverSP: numberOrNull(mapping.selfEnergyChange.recoverSP),
          petRecoverSP: numberOrNull(mapping.selfEnergyChange.petRecoverSP),
          recoverInterval: numberOrNull(
            mapping.selfEnergyChange.recoverInterval
          ),
          ownerScope: mapping.selfEnergyChange.ownerScope ?? null,
        }
      : null,
    skillLevelBridge: {
      status: mapping.skillLevelBridge?.status ?? null,
      levelRows: numberOrNull(mapping.skillLevelBridge?.levelRows) ?? 0,
      parameterIds: mapping.skillLevelBridge?.parameterIds ?? [],
      varyingParameterIds: mapping.skillLevelBridge?.varyingParameterIds ?? [],
      formulaSlotAlignment:
        mapping.skillLevelBridge?.formulaSlotAlignment ??
        compactFormulaSlotAlignment(
          mapping.skillLevelBridge?.formulaParamAlignment
        ),
      firstLevel: mapping.skillLevelBridge?.firstLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.firstLevel.level),
            valueParam: mapping.skillLevelBridge.firstLevel.valueParam ?? null,
          }
        : null,
      lastLevel: mapping.skillLevelBridge?.lastLevel
        ? {
            level: numberOrNull(mapping.skillLevelBridge.lastLevel.level),
            valueParam: mapping.skillLevelBridge.lastLevel.valueParam ?? null,
          }
        : null,
    },
    applied: false,
  };
}

function summarizeActionHitCandidates(hitCandidates, sequenceTimingEvidence) {
  if (hitCandidates.length === 0) {
    return {
      status: 'no-per-hit-candidates',
      hitCandidateCount: 0,
      damageElementFieldMappingCount: 0,
      mappedHitCandidateCount: 0,
      sequenceTimingStatus:
        sequenceTimingEvidence?.status ??
        'normal-attack-sequence-timing-not-applicable',
      applied: false,
    };
  }

  const mappedHitCandidates = hitCandidates.filter(
    candidate => candidate.damageElementFieldMappingCount > 0
  );

  return {
    status:
      mappedHitCandidates.length === hitCandidates.length
        ? 'all-hit-candidates-have-damage-element-fields'
        : mappedHitCandidates.length > 0
          ? 'partial-hit-candidates-have-damage-element-fields'
          : 'hit-candidates-missing-damage-element-fields',
    hitCandidateCount: hitCandidates.length,
    mappedHitCandidateCount: mappedHitCandidates.length,
    damageElementFieldMappingCount: hitCandidates.reduce(
      (sum, candidate) => sum + candidate.damageElementFieldMappingCount,
      0
    ),
    frameRate: AZPR_TIMELINE_FRAME_RATE,
    primaryFrames: hitCandidates
      .map(candidate => numberOrNull(candidate.primaryFrame))
      .filter(Number.isFinite),
    absolutePrimaryFrames: uniqueNumbers(
      hitCandidates
        .map(candidate => numberOrNull(candidate.absolutePrimaryFrame))
        .filter(Number.isFinite)
    ),
    sequenceChainStartFrames: uniqueNumbers(
      hitCandidates
        .map(candidate => numberOrNull(candidate.chainStartFrame))
        .filter(Number.isFinite)
    ),
    sequenceTimingStatus:
      sequenceTimingEvidence?.status ?? 'normal-attack-sequence-timing-missing',
    sequenceTimingSourceKind: sequenceTimingEvidence?.sourceKind ?? null,
    sequenceTimingTransitionCount:
      numberOrNull(sequenceTimingEvidence?.transitionCount) ?? 0,
    sequenceTimingResolvedTransitionCount:
      numberOrNull(sequenceTimingEvidence?.resolvedTransitionCount) ?? 0,
    sequenceTimingAbsoluteFrameStatus:
      sequenceTimingEvidence?.absoluteFrameStatus ?? null,
    sequenceTimingTransitions: (sequenceTimingEvidence?.transitions ?? []).map(
      transition => ({
        fromSkillId: numberOrNull(transition.fromSkillId),
        toSkillId: numberOrNull(transition.toSkillId),
        status: transition.status ?? null,
        bridgeStartFrame: numberOrNull(transition.bridgeStartFrame),
        bridgeFrameIndex: numberOrNull(transition.bridgeFrameIndex),
        bridgeEndFrame: numberOrNull(transition.bridgeEndFrame),
        chainStartFrame: numberOrNull(transition.chainStartFrame),
        allowedInputs: transition.allowedInputs ?? [],
        applied: false,
      })
    ),
    candidateElementConfigIds: uniqueNumbers(
      hitCandidates.flatMap(
        candidate => candidate.damageElementElementConfigIds
      )
    ),
    hpFormulaFunctionIds: uniqueNumbers(
      hitCandidates.flatMap(candidate => candidate.hpDamage.formulaFunctionIds)
    ),
    toughnessWeakBreakDamageRates: uniqueNumbers(
      hitCandidates.flatMap(
        candidate => candidate.toughnessDamage.weakBreakDamageRates
      )
    ),
    selfEnergyRecoverSPValues: uniqueNumbers(
      hitCandidates.flatMap(
        candidate => candidate.selfEnergyChange.recoverSPValues
      )
    ),
    applied: false,
  };
}

function frameToTimelineMs(frame) {
  return (Number(frame) * 1000) / AZPR_TIMELINE_FRAME_RATE;
}

function roundTimelineMs(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}

function roundChartPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Number(Math.min(100, Math.max(0, number)).toFixed(4));
}

function formatTimelineFrame(frameIndex) {
  const frame = Math.max(0, Math.round(Number(frameIndex) || 0));
  const seconds = Math.floor(frame / AZPR_TIMELINE_FRAME_RATE);
  const remainFrames = frame % AZPR_TIMELINE_FRAME_RATE;
  return `${seconds}s${remainFrames}f`;
}

function createHpDamageResult(action, damageEvent, damageElementSource) {
  if (!damageEvent) {
    const sourceEvidence = createDamageElementChainSource(
      damageElementSource,
      'hpDamage'
    );
    return {
      value: 0,
      applied: false,
      status: isSkillAction(action)
        ? 'no-parseable-hp-damage'
        : 'not-applicable',
      formulaBreakdown: createNotApplicableBreakdown({
        kind: 'hp-damage',
        status: isSkillAction(action)
          ? 'no-parseable-hp-damage'
          : 'not-applicable',
        reason: isSkillAction(action)
          ? 'Skill action has no parseable damage multiplier.'
          : 'Non-skill action does not project HP damage.',
      }),
      sourceEvidence,
    };
  }

  const sourceEvidence = attachFormulaCandidatePreview(
    createDamageElementChainSource(damageElementSource, 'hpDamage'),
    damageEvent.payload
  );

  return {
    value: damageEvent.payload.rawDamage,
    applied: true,
    status: 'raw-hp-projection',
    precision: damageEvent.payload.precision,
    confidence: damageEvent.payload.confidence,
    formulaBreakdown: attachDamageElementSourceToHpBreakdown(
      damageEvent.payload.formulaBreakdown,
      damageElementSource,
      damageEvent.payload
    ),
    sourceEvidence,
  };
}

function createToughnessDamageResult(action, damageEvent, damageElementSource) {
  const hasSkillDamage = isSkillAction(action) && Boolean(damageEvent);
  const sourceEvidence = createDamageElementChainSource(
    damageElementSource,
    'toughnessDamage'
  );
  const hasCandidateFields =
    sourceEvidence?.status === 'candidate-fields-found';

  return {
    value: 0,
    applied: false,
    status: hasSkillDamage
      ? hasCandidateFields
        ? 'candidate-fields-found-formula-unmapped'
        : 'formula-unmapped'
      : 'not-applicable',
    precision: 'unmapped',
    confidence: hasCandidateFields ? 'source-evidence' : 'unknown',
    sourceEvidence,
    formulaBreakdown: {
      version: 'stage5-toughness-breakdown-placeholder-v1',
      status: hasSkillDamage
        ? hasCandidateFields
          ? 'candidate-fields-found-formula-unmapped'
          : 'formula-unmapped'
        : 'not-applicable',
      expression: null,
      result: 0,
      appliedLayerKeys: [],
      unappliedLayerKeys: hasSkillDamage
        ? [
            'actionToughnessValue',
            'enemyToughnessState',
            'weaknessOrBreakModifier',
          ]
        : [],
      layers: {
        actionToughnessValue: {
          label: '动作削韧值',
          applied: false,
          status: hasSkillDamage
            ? hasCandidateFields
              ? 'candidate-fields-found-formula-unmapped'
              : 'skill-effect-node-unmapped'
            : 'not-applicable',
          source: sourceEvidence ?? {
            status: 'pending-skill-control-effect-node-mapping',
            note: 'pending skill_control/effect node mapping for toughness damage',
          },
        },
        enemyToughnessState: {
          label: '敌人韧性状态',
          applied: false,
          status: hasSkillDamage
            ? 'enemy-toughness-fields-unmapped'
            : 'not-applicable',
          source: 'pending enemy toughness table/effect evidence',
        },
      },
      limitations: hasSkillDamage
        ? [
            'Toughness damage must be mapped independently from HP damage.',
            hasCandidateFields
              ? 'TDamageElementParams toughness candidate fields are linked, but unit scale and target state rules are still unmapped.'
              : 'Current skill_control evidence is not yet resolved to toughness effect nodes.',
          ]
        : [],
    },
  };
}

function createSelfEnergyChangeResult(
  action,
  resourceEvents,
  damageElementSource
) {
  const energyEvents = resourceEvents.filter(event =>
    ['sp', 'energy'].includes(String(event.payload.resource))
  );
  const explicitDelta = energyEvents.reduce(
    (sum, event) => sum + (Number(event.payload.change) || 0),
    0
  );
  const hasExplicitDelta = energyEvents.length > 0;
  const skillAction = isSkillAction(action);
  const sourceEvidence = createDamageElementChainSource(
    damageElementSource,
    'selfEnergyChange'
  );
  const hasCandidateFields =
    sourceEvidence?.status === 'candidate-fields-found';

  return {
    value: explicitDelta,
    applied: hasExplicitDelta,
    status: hasExplicitDelta
      ? skillAction
        ? 'explicit-cost-applied-charge-formula-unmapped'
        : 'explicit-resource-delta-applied'
      : skillAction
        ? hasCandidateFields
          ? 'candidate-fields-found-charge-formula-unmapped'
          : 'charge-formula-unmapped'
        : 'not-applicable',
    resource: energyEvents[0]?.payload.resource ?? 'sp',
    precision: hasExplicitDelta ? 'explicit-delta' : 'unmapped',
    confidence: hasExplicitDelta
      ? energyEvents[0].payload.confidence
      : hasCandidateFields
        ? 'source-evidence'
        : 'unknown',
    sourceEvidence,
    formulaBreakdown: {
      version: 'stage5-self-energy-breakdown-placeholder-v1',
      status: hasExplicitDelta
        ? skillAction
          ? 'explicit-cost-applied-charge-formula-unmapped'
          : 'explicit-resource-delta-applied'
        : skillAction
          ? hasCandidateFields
            ? 'candidate-fields-found-charge-formula-unmapped'
            : 'charge-formula-unmapped'
          : 'not-applicable',
      expression: hasExplicitDelta
        ? 'sum(explicit self resource deltas)'
        : null,
      result: explicitDelta,
      appliedLayerKeys: hasExplicitDelta ? ['explicitResourceDelta'] : [],
      unappliedLayerKeys: skillAction
        ? ['actionChargeGain', 'hitEnergyGain', 'passiveEnergyModifiers']
        : [],
      layers: {
        explicitResourceDelta: {
          label: '显式资源变化',
          value: explicitDelta,
          applied: hasExplicitDelta,
          events: energyEvents.map(event => ({
            resource: event.payload.resource,
            change: event.payload.change,
            reason: event.payload.reason,
            confidence: event.payload.confidence,
          })),
        },
        actionChargeGain: {
          label: '动作充能',
          applied: false,
          status: skillAction
            ? hasCandidateFields
              ? 'candidate-fields-found-formula-unmapped'
              : 'formula-unmapped'
            : 'not-applicable',
          source: sourceEvidence ?? {
            status:
              'pending-skill-control-effect-node-and-skillsub-logic-mapping',
            note: 'pending skill_control/effect node and skillsub_logic energy mapping',
          },
        },
      },
      limitations: skillAction
        ? [
            'Current result applies explicit skill cost when present.',
            hasCandidateFields
              ? 'TDamageElementParams recoverSP candidate fields are linked, but owner, sharing and interval trigger rules are still unmapped.'
              : 'Energy gain/charge formula is still unmapped and must be tracked separately from HP damage.',
          ]
        : [],
    },
  };
}

function createActionDamageElementSource(action) {
  if (!isSkillAction(action)) {
    return null;
  }

  const skillId = Number(action.skillId);
  const skillMapping = DAMAGE_ELEMENT_FIELD_MAPPING_BY_SKILL_ID.get(skillId);
  const logicElementRows = action.logicModel?.elementValues ?? [];
  const logicElementIds = uniqueNumbers(
    logicElementRows.map(row => row.elementId)
  );
  const logicElementRowByElementId = new Map(
    logicElementRows
      .map(row => [Number(row.elementId), row])
      .filter(([elementId]) => Number.isFinite(elementId))
  );

  if (!skillMapping) {
    return {
      kind: DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE_KIND,
      file: SKILL_ASSET_EVIDENCE_PATH,
      status: 'no-damage-element-field-mapping-for-skill',
      skillId,
      actionVariantIndex: Number(
        action.actionVariantIndex ?? action.damageSegmentIndex ?? 0
      ),
      actionVariantLabel:
        action.selectedActionVariant?.label ??
        action.selectedDamageSegment?.label ??
        null,
      logicElementIds,
      matchedElementConfigIds: [],
      unbridgedElementConfigIds: [],
      candidates: [],
    };
  }

  const fieldMappings = skillMapping.fieldMappings ?? [];
  const matchedMappings = fieldMappings
    .filter(mapping =>
      logicElementIds.includes(Number(mapping.elementConfigId))
    )
    .sort(
      (left, right) =>
        Number(left.elementConfigId) - Number(right.elementConfigId)
    );
  const unbridgedElementConfigIds = fieldMappings
    .filter(
      mapping =>
        mapping.skillLevelBridge?.status ===
        'skillsub-element-level-bridge-missing'
    )
    .map(mapping => Number(mapping.elementConfigId))
    .filter(Number.isFinite);

  return {
    kind: DAMAGE_ELEMENT_FIELD_MAPPING_EVIDENCE_KIND,
    file: SKILL_ASSET_EVIDENCE_PATH,
    status:
      matchedMappings.length > 0
        ? 'candidate-fields-bridged-to-action-element-values'
        : 'candidate-fields-found-no-action-element-bridge',
    skillId,
    actionVariantIndex: Number(
      action.actionVariantIndex ?? action.damageSegmentIndex ?? 0
    ),
    actionVariantLabel:
      action.selectedActionVariant?.label ??
      action.selectedDamageSegment?.label ??
      null,
    logicElementIds,
    matchedElementConfigIds: matchedMappings.map(mapping =>
      Number(mapping.elementConfigId)
    ),
    unbridgedElementConfigIds,
    totalDamageElementCandidates: fieldMappings.length,
    bridgeMatchedLevelRows: matchedMappings.reduce(
      (sum, mapping) => sum + (mapping.skillLevelBridge?.levelRows ?? 0),
      0
    ),
    candidates: matchedMappings.map(mapping =>
      compactDamageElementMapping(
        mapping,
        logicElementRowByElementId.get(Number(mapping.elementConfigId))
      )
    ),
    note: 'TDamageElementParams fields are linked as candidate source evidence only; final HP/toughness/energy formulas remain unmapped.',
  };
}

function compactDamageElementMapping(mapping, currentLogicElementValue = null) {
  return {
    elementConfigId: Number(mapping.elementConfigId),
    pathId: mapping.pathId,
    containerPath: mapping.containerPath,
    mediaPackNames: mapping.mediaPackNames ?? [],
    currentLogicElementValue: compactCurrentLogicElementValue(
      currentLogicElementValue
    ),
    hpDamage: mapping.hpDamage
      ? {
          status: mapping.hpDamage.status,
          formulaFunctionIds: mapping.hpDamage.formulaFunctionIds,
          formulaFunctionEvidence: compactFormulaFunctionEvidence(
            mapping.hpDamage.formulaFunctionEvidence
          ),
          formulaSlotCandidates: mapping.hpDamage.formulaSlotCandidates,
          damageFields: mapping.hpDamage.damageFields,
        }
      : null,
    toughnessDamage: mapping.toughnessDamage
      ? {
          status: mapping.toughnessDamage.status,
          weakBreakDamageRate: mapping.toughnessDamage.weakBreakDamageRate,
          hitType: mapping.toughnessDamage.hitType,
          knockBackId: mapping.toughnessDamage.knockBackId,
          knockBackForce: mapping.toughnessDamage.knockBackForce,
          interruptPriority: mapping.toughnessDamage.interruptPriority,
          useOneBreak: mapping.toughnessDamage.useOneBreak,
        }
      : null,
    selfEnergyChange: mapping.selfEnergyChange
      ? {
          status: mapping.selfEnergyChange.status,
          recoverSP: mapping.selfEnergyChange.recoverSP,
          petRecoverSP: mapping.selfEnergyChange.petRecoverSP,
          recoverInterval: mapping.selfEnergyChange.recoverInterval,
          ownerScope: mapping.selfEnergyChange.ownerScope,
        }
      : null,
    skillLevelBridge: {
      status: mapping.skillLevelBridge?.status ?? 'unknown',
      levelRows: mapping.skillLevelBridge?.levelRows ?? 0,
      parameterIds: mapping.skillLevelBridge?.parameterIds ?? [],
      varyingParameterIds: mapping.skillLevelBridge?.varyingParameterIds ?? [],
      formulaSlotAlignment: compactFormulaSlotAlignment(
        mapping.skillLevelBridge?.formulaParamAlignment
      ),
      firstLevel: mapping.skillLevelBridge?.firstLevel
        ? {
            level: mapping.skillLevelBridge.firstLevel.level,
            valueParam: mapping.skillLevelBridge.firstLevel.valueParam,
          }
        : null,
      lastLevel: mapping.skillLevelBridge?.lastLevel
        ? {
            level: mapping.skillLevelBridge.lastLevel.level,
            valueParam: mapping.skillLevelBridge.lastLevel.valueParam,
          }
        : null,
    },
  };
}

function createDamageElementChainSource(damageElementSource, chainKey) {
  if (!damageElementSource) {
    return null;
  }

  const candidates = damageElementSource.candidates
    .map(candidate => ({
      elementConfigId: candidate.elementConfigId,
      pathId: candidate.pathId,
      mediaPackNames: candidate.mediaPackNames,
      currentLogicElementValue: candidate.currentLogicElementValue,
      fieldCandidate: candidate[chainKey],
      skillLevelBridge: candidate.skillLevelBridge,
    }))
    .filter(candidate => candidate.fieldCandidate);

  return {
    kind: damageElementSource.kind,
    file: damageElementSource.file,
    status:
      candidates.length > 0
        ? 'candidate-fields-found'
        : damageElementSource.status,
    skillId: damageElementSource.skillId,
    actionVariantIndex: damageElementSource.actionVariantIndex,
    actionVariantLabel: damageElementSource.actionVariantLabel,
    logicElementIds: damageElementSource.logicElementIds,
    matchedElementConfigIds: damageElementSource.matchedElementConfigIds,
    unbridgedElementConfigIds: damageElementSource.unbridgedElementConfigIds,
    candidateCount: candidates.length,
    bridgeMatchedLevelRows: damageElementSource.bridgeMatchedLevelRows ?? 0,
    formulaSlotAlignmentSummary: createFormulaSlotAlignmentSummary(candidates),
    formulaFunctionSummary:
      chainKey === 'hpDamage' ? createFormulaFunctionSummary(candidates) : [],
    formulaCandidatePreview: null,
    candidates,
    note: damageElementSource.note,
  };
}

function compactCurrentLogicElementValue(row) {
  if (!row) {
    return null;
  }

  return {
    rowId: row.rowId ?? null,
    elementId: Number(row.elementId),
    valueParam: row.valueParam ?? '',
    paramPairs: parseValueParamPairs(row.valueParam),
  };
}

function compactFormulaFunctionEvidence(evidence) {
  if (!evidence) {
    return null;
  }

  return {
    status: evidence.status ?? 'unknown',
    relationStatus: evidence.relationStatus ?? 'unknown',
    applied: evidence.applied === true,
    matchedFunctionIds: evidence.matchedFunctionIds ?? [],
    unmatchedFunctionIds: evidence.unmatchedFunctionIds ?? [],
    functionRefs: (evidence.functionRefs ?? []).map(ref => ({
      field: ref.field,
      functionId: ref.functionId,
      status: ref.status,
      relationStatus: ref.relationStatus,
      elementFormulaRow: ref.elementFormulaRow
        ? {
            id: ref.elementFormulaRow.id,
            functionOutput: ref.elementFormulaRow.functionOutput,
            variables: ref.elementFormulaRow.variables ?? [],
          }
        : null,
      variableInputs: (ref.variableInputs ?? []).map(input => ({
        variable: input.variable,
        paramId: input.paramId,
        formulaParamSlot: input.formulaParamSlot,
        formulaParamValue: input.formulaParamValue,
        slotStatus: input.slotStatus,
      })),
      applied: ref.applied === true,
    })),
  };
}

function compactFormulaSlotAlignment(alignment) {
  if (!alignment) {
    return null;
  }

  return {
    status: alignment.status ?? 'unknown',
    conclusion: alignment.conclusion ?? 'unknown',
    directSlotMatchParamIds: alignment.directSlotMatchParamIds ?? [],
    overrideCandidateParamIds: alignment.overrideCandidateParamIds ?? [],
    parameterSummaries: (alignment.parameterSummaries ?? []).map(parameter => ({
      id: parameter.id,
      variable: parameter.variable,
      relationStatus: parameter.relationStatus,
      formulaParamValue: parameter.formulaParamValue,
      firstLevelValue: parameter.firstLevelValue,
      lastLevelValue: parameter.lastLevelValue,
      minValue: parameter.minValue,
      maxValue: parameter.maxValue,
      isConstantAcrossLevels: parameter.isConstantAcrossLevels,
      levelRows: parameter.levelRows,
      progression: parameter.progression
        ? {
            status: parameter.progression.status,
            step: parameter.progression.step,
            isArithmetic: parameter.progression.isArithmetic,
          }
        : null,
    })),
  };
}

function createFormulaSlotAlignmentSummary(candidates) {
  const summaries = candidates.flatMap(
    candidate =>
      candidate.skillLevelBridge?.formulaSlotAlignment?.parameterSummaries ?? []
  );
  const byParam = new Map();

  for (const summary of summaries) {
    const key = `${summary.id}:${summary.relationStatus}`;
    if (!byParam.has(key)) {
      byParam.set(key, {
        ...summary,
        candidateCount: 0,
      });
    }
    byParam.get(key).candidateCount += 1;
  }

  return [...byParam.values()].sort(
    (left, right) => Number(left.id) - Number(right.id)
  );
}

function createFormulaFunctionSummary(candidates) {
  const refs = candidates.flatMap(candidate =>
    (candidate.fieldCandidate?.formulaFunctionEvidence?.functionRefs ?? []).map(
      ref => ({
        ...ref,
        elementConfigId: candidate.elementConfigId,
      })
    )
  );
  const byRef = new Map();

  for (const ref of refs) {
    const key = [
      ref.field,
      ref.functionId,
      ref.elementFormulaRow?.functionOutput ?? '',
    ].join(':');
    if (!byRef.has(key)) {
      byRef.set(key, {
        field: ref.field,
        functionId: ref.functionId,
        status: ref.status,
        relationStatus: ref.relationStatus,
        functionOutput: ref.elementFormulaRow?.functionOutput ?? null,
        variables: ref.elementFormulaRow?.variables ?? [],
        variableInputs: [],
        candidateElementConfigIds: [],
        candidateCount: 0,
        applied: false,
      });
    }

    const summary = byRef.get(key);
    summary.candidateCount += 1;
    summary.candidateElementConfigIds.push(ref.elementConfigId);
    summary.variableInputs = mergeFormulaFunctionVariableInputs(
      summary.variableInputs,
      ref.variableInputs ?? []
    );
  }

  return [...byRef.values()]
    .map(summary => ({
      ...summary,
      candidateElementConfigIds: uniqueNumbers(
        summary.candidateElementConfigIds
      ),
      variableInputs: summary.variableInputs.sort(
        (left, right) => Number(left.paramId) - Number(right.paramId)
      ),
    }))
    .sort(
      (left, right) =>
        Number(left.functionId) - Number(right.functionId) ||
        String(left.field).localeCompare(String(right.field))
    );
}

function mergeFormulaFunctionVariableInputs(existingInputs, nextInputs) {
  const byVariable = new Map(
    existingInputs.map(input => [
      `${input.variable}:${input.paramId}:${input.formulaParamValue}`,
      { ...input },
    ])
  );

  for (const input of nextInputs) {
    const key = `${input.variable}:${input.paramId}:${input.formulaParamValue}`;
    if (!byVariable.has(key)) {
      byVariable.set(key, {
        variable: input.variable,
        paramId: input.paramId,
        formulaParamSlot: input.formulaParamSlot,
        formulaParamValue: input.formulaParamValue,
        slotStatus: input.slotStatus,
        candidateCount: 0,
      });
    }
    byVariable.get(key).candidateCount += 1;
  }

  return [...byVariable.values()];
}

function attachFormulaCandidatePreview(sourceEvidence, damagePayload) {
  if (!sourceEvidence || !damagePayload) {
    return sourceEvidence;
  }

  const formulaCandidatePreview = createFormulaCandidatePreview(
    sourceEvidence,
    damagePayload
  );
  return {
    ...sourceEvidence,
    formulaCandidatePreview,
  };
}

function createFormulaCandidatePreview(sourceEvidence, damagePayload) {
  const candidates = sourceEvidence.candidates ?? [];
  const functionPreviews = candidates.flatMap(candidate =>
    createCandidateFormulaFunctionPreviews(candidate, damagePayload)
  );
  const comparablePreviews = functionPreviews.filter(
    item => item.comparison?.status === 'compared-to-raw-projection'
  );
  const largeDifferencePreviews = comparablePreviews.filter(
    item => item.comparison?.differenceStatus === 'large-difference'
  );
  const combinationPreviews = createFormulaCombinationPreviews({
    functionPreviews,
    damagePayload,
  });

  return {
    status:
      functionPreviews.length > 0
        ? 'candidate-preview-computed-combination-unconfirmed'
        : 'no-formula-function-preview',
    applied: false,
    baseAttack: {
      key: 'self.ATK[0]',
      value: numberOrNull(damagePayload.attack),
      source: damagePayload.attackSource ?? null,
    },
    rawProjection: {
      value: numberOrNull(damagePayload.rawDamage),
      expression:
        damagePayload.formulaBreakdown?.expression ??
        'round(baseAttack.value * actionMultiplier.value)',
      actionMultiplier: numberOrNull(damagePayload.segment?.multiplier),
      rawMultiplier: damagePayload.segment?.rawValue ?? null,
      source: 'current-skill-level-description-raw-projection',
    },
    functionPreviews,
    combinationPreviews,
    diagnostics: {
      comparablePreviewCount: comparablePreviews.length,
      largeDifferenceCount: largeDifferencePreviews.length,
      combinationPreviewCount: combinationPreviews.length,
      combinationLargeDifferenceCount: combinationPreviews.filter(
        item => item.comparison?.differenceStatus === 'large-difference'
      ).length,
      statuses: uniqueStrings(
        [
          ...functionPreviews.map(
            item =>
              item.comparison?.differenceStatus ??
              item.comparison?.status ??
              item.status
          ),
          ...combinationPreviews.map(
            item =>
              item.comparison?.differenceStatus ??
              item.comparison?.status ??
              item.status
          ),
        ].filter(Boolean)
      ),
      note: 'Preview values are evidence diagnostics only. They do not define DamageElement function combination order or final damage.',
    },
  };
}

function createFormulaCombinationPreviews({ functionPreviews, damagePayload }) {
  const byElement = new Map();
  for (const preview of functionPreviews) {
    if (!byElement.has(preview.elementConfigId)) {
      byElement.set(preview.elementConfigId, []);
    }
    byElement.get(preview.elementConfigId).push(preview);
  }

  return [...byElement.entries()].flatMap(([elementConfigId, previews]) =>
    createFormulaCombinationPreviewsForElement({
      elementConfigId,
      previews,
      damagePayload,
    })
  );
}

function createFormulaCombinationPreviewsForElement({
  elementConfigId,
  previews,
  damagePayload,
}) {
  const f1 = previews.find(item => item.field === 'function_1');
  const f2 = previews.find(item => item.field === 'function_2');
  const hitCount = numberOrNull(damagePayload.segment?.hitModel?.hitCount);
  const variants = [];

  for (const source of ['formulaParamPreview', 'currentLevelPreview']) {
    const sourceLabel =
      source === 'currentLevelPreview'
        ? 'current-level-value-param'
        : 'formula-param-values';
    const f1Value = numberOrNull(f1?.[source]?.value);
    const f2Value = numberOrNull(f2?.[source]?.value);

    if (Number.isFinite(f2Value)) {
      variants.push(
        createFormulaCombinationPreview({
          elementConfigId,
          strategy: `function_2-${sourceLabel}`,
          expression: 'function_2',
          value: f2Value,
          source,
          functionValues: { function_2: f2Value },
          hitCount,
          rawProjectionValue: damagePayload.rawDamage,
        })
      );
    }

    if (Number.isFinite(f1Value) && Number.isFinite(f2Value)) {
      variants.push(
        createFormulaCombinationPreview({
          elementConfigId,
          strategy: `function_1-times-function_2-${sourceLabel}`,
          expression: 'function_1 * function_2',
          value: f1Value * f2Value,
          source,
          functionValues: {
            function_1: f1Value,
            function_2: f2Value,
          },
          hitCount,
          rawProjectionValue: damagePayload.rawDamage,
        }),
        createFormulaCombinationPreview({
          elementConfigId,
          strategy: `function_1-plus-function_2-${sourceLabel}`,
          expression: 'function_1 + function_2',
          value: f1Value + f2Value,
          source,
          functionValues: {
            function_1: f1Value,
            function_2: f2Value,
          },
          hitCount,
          rawProjectionValue: damagePayload.rawDamage,
        })
      );
    }
  }

  return variants;
}

function createFormulaCombinationPreview({
  elementConfigId,
  strategy,
  expression,
  value,
  source,
  functionValues,
  hitCount,
  rawProjectionValue,
}) {
  const roundedValue = Math.round(value);
  const comparison = createCombinationPreviewComparison({
    rawProjectionValue,
    roundedValue,
    hitCount,
  });

  return {
    elementConfigId,
    strategy,
    expression,
    inputSource:
      source === 'currentLevelPreview'
        ? 'skill_logic.currentLevel.valueParam'
        : 'TDamageElementParams.formulaParamValues',
    functionValues,
    value,
    roundedValue,
    hitCount,
    comparison,
    status: 'combination-preview-computed',
    applied: false,
  };
}

function createCombinationPreviewComparison({
  rawProjectionValue,
  roundedValue,
  hitCount,
}) {
  const rawValue = numberOrNull(rawProjectionValue);
  if (!Number.isFinite(rawValue) || !Number.isFinite(roundedValue)) {
    return {
      status: 'not-compared',
      reason: 'missing-raw-or-preview-value',
    };
  }

  const delta = roundedValue - rawValue;
  const ratioToRawProjection = rawValue === 0 ? null : roundedValue / rawValue;
  const requiredScaleToRaw =
    roundedValue === 0 ? null : rawValue / roundedValue;
  const requiredPerHitScaleToRaw =
    Number.isFinite(hitCount) &&
    hitCount > 0 &&
    Number.isFinite(requiredScaleToRaw)
      ? requiredScaleToRaw / hitCount
      : null;
  const absoluteRatio =
    ratioToRawProjection == null ? null : Math.abs(1 - ratioToRawProjection);

  return {
    status: 'compared-to-raw-projection',
    rawProjectionValue: rawValue,
    previewRoundedValue: roundedValue,
    delta,
    ratioToRawProjection,
    requiredScaleToRaw,
    requiredPerHitScaleToRaw,
    differenceStatus:
      absoluteRatio != null && absoluteRatio > 0.1
        ? 'large-difference'
        : 'close-to-raw-projection',
  };
}

function createCandidateFormulaFunctionPreviews(candidate, damagePayload) {
  const refs =
    candidate.fieldCandidate?.formulaFunctionEvidence?.functionRefs ?? [];
  return refs.map(ref =>
    createFormulaFunctionPreview({
      ref,
      candidate,
      damagePayload,
    })
  );
}

function createFormulaFunctionPreview({ ref, candidate, damagePayload }) {
  const functionOutput = ref.elementFormulaRow?.functionOutput ?? null;
  const formulaParamInputs = buildFormulaPreviewInputs({
    ref,
    candidate,
    damagePayload,
    mode: 'formula-param-values',
  });
  const currentLevelInputs = buildFormulaPreviewInputs({
    ref,
    candidate,
    damagePayload,
    mode: 'current-level-value-param',
  });
  const formulaParamEvaluation = evaluateFormulaOutput(
    functionOutput,
    formulaParamInputs.values
  );
  const currentLevelEvaluation = evaluateFormulaOutput(
    functionOutput,
    currentLevelInputs.values
  );
  const preferredEvaluation =
    currentLevelEvaluation.status === 'computed'
      ? currentLevelEvaluation
      : formulaParamEvaluation;
  const comparison = createFormulaPreviewComparison({
    functionOutput,
    rawProjectionValue: damagePayload.rawDamage,
    evaluation: preferredEvaluation,
  });

  return {
    elementConfigId: candidate.elementConfigId,
    field: ref.field,
    functionId: ref.functionId,
    functionOutput,
    status:
      formulaParamEvaluation.status === 'computed' ||
      currentLevelEvaluation.status === 'computed'
        ? 'preview-computed'
        : 'preview-unsupported',
    applied: false,
    formulaParamPreview: {
      inputSource: 'TDamageElementParams.formulaParamValues',
      inputs: formulaParamInputs.publicInputs,
      value: formulaParamEvaluation.value,
      roundedValue: formulaParamEvaluation.roundedValue,
      status: formulaParamEvaluation.status,
      reason: formulaParamEvaluation.reason ?? null,
    },
    currentLevelPreview: {
      inputSource: 'skill_logic.currentLevel.valueParam',
      valueParam: candidate.currentLogicElementValue?.valueParam ?? null,
      rowId: candidate.currentLogicElementValue?.rowId ?? null,
      inputs: currentLevelInputs.publicInputs,
      value: currentLevelEvaluation.value,
      roundedValue: currentLevelEvaluation.roundedValue,
      status: currentLevelEvaluation.status,
      reason: currentLevelEvaluation.reason ?? null,
    },
    comparison,
    unresolved: [
      'function-combination-order',
      'value-param-override-rule',
      'hit-count-and-segment-binding',
      'enemy-defense-and-resistance-application',
    ],
  };
}

function buildFormulaPreviewInputs({ ref, candidate, damagePayload, mode }) {
  const values = {
    SELF_ATK_0: numberOrNull(damagePayload.attack),
  };
  const publicInputs = [
    {
      key: 'self.ATK[0]',
      value: values.SELF_ATK_0,
      source: damagePayload.attackSource ?? null,
    },
  ];
  const currentParamPairs = new Map(
    (candidate.currentLogicElementValue?.paramPairs ?? []).map(pair => [
      Number(pair.id),
      pair,
    ])
  );

  for (const input of ref.variableInputs ?? []) {
    const paramId = Number(input.paramId);
    const currentPair = currentParamPairs.get(paramId);
    const selectedValue =
      mode === 'current-level-value-param' &&
      Number.isFinite(currentPair?.value)
        ? currentPair.value
        : input.formulaParamValue;

    values[input.variable] = numberOrNull(selectedValue);
    publicInputs.push({
      key: input.variable,
      paramId,
      value: numberOrNull(selectedValue),
      source:
        mode === 'current-level-value-param' &&
        Number.isFinite(currentPair?.value)
          ? 'skill_logic.currentLevel.valueParam'
          : 'TDamageElementParams.formulaParamValues',
      fallbackUsed:
        mode === 'current-level-value-param' &&
        !Number.isFinite(currentPair?.value),
      formulaParamValue: numberOrNull(input.formulaParamValue),
      currentLevelValue: Number.isFinite(currentPair?.value)
        ? currentPair.value
        : null,
    });
  }

  return {
    values,
    publicInputs,
  };
}

function evaluateFormulaOutput(functionOutput, inputValues) {
  if (!functionOutput) {
    return {
      status: 'unsupported',
      value: null,
      roundedValue: null,
      reason: 'missing-function-output',
    };
  }

  const expression = normalizeFormulaExpression(functionOutput);
  if (!expression) {
    return {
      status: 'unsupported',
      value: null,
      roundedValue: null,
      reason: 'unsupported-formula-expression',
    };
  }

  const missingInput = [...expression.matchAll(/\b[A-Z][A-Z0-9_]*\b/g)]
    .map(match => match[0])
    .find(name => !Number.isFinite(inputValues[name]));
  if (missingInput) {
    return {
      status: 'unsupported',
      value: null,
      roundedValue: null,
      reason: `missing-input-${missingInput}`,
    };
  }

  const substituted = expression.replace(/\b[A-Z][A-Z0-9_]*\b/g, name =>
    String(inputValues[name])
  );
  const value = evaluateArithmeticExpression(substituted);
  if (!Number.isFinite(value)) {
    return {
      status: 'unsupported',
      value: null,
      roundedValue: null,
      reason: 'evaluation-failed',
    };
  }

  return {
    status: 'computed',
    value,
    roundedValue: Math.round(value),
    reason: null,
  };
}

function normalizeFormulaExpression(functionOutput) {
  const expression = String(functionOutput)
    .replaceAll('self.ATK[0]', 'SELF_ATK_0')
    .replace(/\s+/g, '');
  return /^[0-9A-Z_+\-*/().]+$/.test(expression) ? expression : '';
}

function evaluateArithmeticExpression(expression) {
  let index = 0;

  function parseExpression() {
    let value = parseTerm();
    while (index < expression.length) {
      const operator = expression[index];
      if (operator !== '+' && operator !== '-') {
        break;
      }
      index += 1;
      const next = parseTerm();
      value = operator === '+' ? value + next : value - next;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (index < expression.length) {
      const operator = expression[index];
      if (operator !== '*' && operator !== '/') {
        break;
      }
      index += 1;
      const next = parseFactor();
      value = operator === '*' ? value * next : value / next;
    }
    return value;
  }

  function parseFactor() {
    if (expression[index] === '(') {
      index += 1;
      const value = parseExpression();
      if (expression[index] !== ')') {
        return NaN;
      }
      index += 1;
      return value;
    }

    const start = index;
    if (expression[index] === '-') {
      index += 1;
    }
    while (/[0-9.]/.test(expression[index] ?? '')) {
      index += 1;
    }
    if (start === index) {
      return NaN;
    }
    return Number(expression.slice(start, index));
  }

  const value = parseExpression();
  return index === expression.length ? value : NaN;
}

function createFormulaPreviewComparison({
  functionOutput,
  rawProjectionValue,
  evaluation,
}) {
  const rawValue = numberOrNull(rawProjectionValue);
  const usesAttack = String(functionOutput ?? '').includes('self.ATK[0]');
  if (!usesAttack) {
    return {
      status: 'not-compared-scalar-candidate',
      reason: 'formula-output-does-not-reference-self-attack',
    };
  }
  if (evaluation.status !== 'computed' || !Number.isFinite(rawValue)) {
    return {
      status: 'not-compared',
      reason: evaluation.reason ?? 'missing-raw-projection',
    };
  }

  const roundedValue = evaluation.roundedValue;
  const delta = roundedValue - rawValue;
  const ratioToRawProjection = rawValue === 0 ? null : roundedValue / rawValue;
  const absoluteRatio =
    ratioToRawProjection == null ? null : Math.abs(1 - ratioToRawProjection);

  return {
    status: 'compared-to-raw-projection',
    rawProjectionValue: rawValue,
    previewRoundedValue: roundedValue,
    delta,
    ratioToRawProjection,
    differenceStatus:
      absoluteRatio != null && absoluteRatio > 0.1
        ? 'large-difference'
        : 'close-to-raw-projection',
  };
}

function parseValueParamPairs(rawValue) {
  if (!rawValue) {
    return [];
  }
  return String(rawValue)
    .split('|')
    .map(part => {
      const [idText, valueText] = part.split('#');
      return {
        id: Number(idText),
        value: Number(valueText),
      };
    })
    .filter(item => Number.isFinite(item.id) && Number.isFinite(item.value));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function attachDamageElementSourceToHpBreakdown(
  formulaBreakdown,
  damageElementSource,
  damagePayload = null
) {
  const sourceEvidence = attachFormulaCandidatePreview(
    createDamageElementChainSource(damageElementSource, 'hpDamage'),
    damagePayload
  );
  if (!formulaBreakdown || !sourceEvidence) {
    return formulaBreakdown;
  }

  return {
    ...formulaBreakdown,
    unappliedLayerKeys: uniqueStrings([
      ...(formulaBreakdown.unappliedLayerKeys ?? []),
      'damageElementFields',
    ]),
    layers: {
      ...(formulaBreakdown.layers ?? {}),
      damageElementFields: {
        label: '伤害元素字段',
        applied: false,
        status:
          sourceEvidence.status === 'candidate-fields-found'
            ? 'candidate-fields-found-formula-unmapped'
            : sourceEvidence.status,
        source: sourceEvidence,
      },
    },
    limitations: uniqueStrings([
      ...(formulaBreakdown.limitations ?? []),
      'TDamageElementParams HP candidate fields are linked, but formula scaling and hit-to-action mapping are still unmapped.',
    ]),
  };
}

function createNotApplicableBreakdown({ kind, status, reason }) {
  return {
    version: `stage5-${kind}-not-applicable-v1`,
    status,
    expression: null,
    result: 0,
    appliedLayerKeys: [],
    unappliedLayerKeys: [],
    layers: {},
    limitations: [reason],
  };
}

function groupEventsByActionId(events) {
  const groups = new Map();
  for (const event of events) {
    const group = groups.get(event.actionId) ?? [];
    group.push(event);
    groups.set(event.actionId, group);
  }
  return groups;
}

function isSkillAction(action) {
  return action.type === 'skill';
}

function uniqueNumbers(values) {
  return [
    ...new Set(values.map(value => Number(value)).filter(Number.isFinite)),
  ].sort((left, right) => left - right);
}

function uniqueStrings(values) {
  return [...new Set(values.map(value => String(value)).filter(Boolean))];
}
