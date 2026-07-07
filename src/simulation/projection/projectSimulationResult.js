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
      formulaVersion: damageEvents[0]?.payload.formulaVersion ?? null,
      formulaCandidatePatternSummary,
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
    targetSkillIds: evidence.targetSkillIds ?? [],
    targetSkillControlCount:
      numberOrNull(evidence.targetSkillControlCount) ?? 0,
    foundTargetSkillControlCount:
      numberOrNull(evidence.foundTargetSkillControlCount) ?? 0,
    missingTargetSkillControlCount:
      numberOrNull(evidence.missingTargetSkillControlCount) ?? 0,
    childSkillTargetIds: evidence.childSkillTargetIds ?? [],
    targetAnimationStateNames: evidence.targetAnimationStateNames ?? [],
    targetHpTrackNames: evidence.targetHpTrackNames ?? [],
    targetSkillControls: (evidence.targetSkillControls ?? [])
      .slice(0, 4)
      .map(item => ({
        skillId: numberOrNull(item.skillId),
        status: item.status ?? null,
        skillTableStatus: item.skillTableStatus ?? null,
        parentSkill: numberOrNull(item.parentSkill),
        relationToSourceSkill: item.relationToSourceSkill ?? null,
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
      hpDamage: createHpDamageResult(
        action,
        primaryDamageEvent,
        damageElementSource
      ),
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
      sourceEventTypes: [
        ...actionDamageEvents.map(event => event.type),
        ...actionResourceEvents.map(event => event.type),
      ],
    };
  });
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
