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
    return {
      value: 0,
      applied: false,
      status: isSkillAction(action) ? 'no-parseable-hp-damage' : 'not-applicable',
      formulaBreakdown: createNotApplicableBreakdown({
        kind: 'hp-damage',
        status: isSkillAction(action)
          ? 'no-parseable-hp-damage'
          : 'not-applicable',
        reason: isSkillAction(action)
          ? 'Skill action has no parseable damage multiplier.'
          : 'Non-skill action does not project HP damage.',
      }),
      sourceEvidence: createDamageElementChainSource(
        damageElementSource,
        'hpDamage'
      ),
    };
  }

  return {
    value: damageEvent.payload.rawDamage,
    applied: true,
    status: 'raw-hp-projection',
    precision: damageEvent.payload.precision,
    confidence: damageEvent.payload.confidence,
    formulaBreakdown: attachDamageElementSourceToHpBreakdown(
      damageEvent.payload.formulaBreakdown,
      damageElementSource
    ),
    sourceEvidence: createDamageElementChainSource(
      damageElementSource,
      'hpDamage'
    ),
  };
}

function createToughnessDamageResult(action, damageEvent, damageElementSource) {
  const hasSkillDamage = isSkillAction(action) && Boolean(damageEvent);
  const sourceEvidence = createDamageElementChainSource(
    damageElementSource,
    'toughnessDamage'
  );
  const hasCandidateFields = sourceEvidence?.status === 'candidate-fields-found';

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
  const hasCandidateFields = sourceEvidence?.status === 'candidate-fields-found';

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
            status: 'pending-skill-control-effect-node-and-skillsub-logic-mapping',
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
    .filter(mapping => logicElementIds.includes(Number(mapping.elementConfigId)))
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
    candidates: matchedMappings.map(compactDamageElementMapping),
    note:
      'TDamageElementParams fields are linked as candidate source evidence only; final HP/toughness/energy formulas remain unmapped.',
  };
}

function compactDamageElementMapping(mapping) {
  return {
    elementConfigId: Number(mapping.elementConfigId),
    pathId: mapping.pathId,
    containerPath: mapping.containerPath,
    mediaPackNames: mapping.mediaPackNames ?? [],
    hpDamage: mapping.hpDamage
      ? {
          status: mapping.hpDamage.status,
          formulaFunctionIds: mapping.hpDamage.formulaFunctionIds,
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
    formulaSlotAlignmentSummary:
      createFormulaSlotAlignmentSummary(candidates),
    candidates,
    note: damageElementSource.note,
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

function attachDamageElementSourceToHpBreakdown(
  formulaBreakdown,
  damageElementSource
) {
  const sourceEvidence = createDamageElementChainSource(
    damageElementSource,
    'hpDamage'
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
