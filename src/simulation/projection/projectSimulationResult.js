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
      hpDamage: createHpDamageResult(action, primaryDamageEvent),
      toughnessDamage: createToughnessDamageResult(action, primaryDamageEvent),
      selfEnergyChange: createSelfEnergyChangeResult(action, actionResourceEvents),
      sourceEventTypes: [
        ...actionDamageEvents.map(event => event.type),
        ...actionResourceEvents.map(event => event.type),
      ],
    };
  });
}

function createHpDamageResult(action, damageEvent) {
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
    };
  }

  return {
    value: damageEvent.payload.rawDamage,
    applied: true,
    status: 'raw-hp-projection',
    precision: damageEvent.payload.precision,
    confidence: damageEvent.payload.confidence,
    formulaBreakdown: damageEvent.payload.formulaBreakdown,
  };
}

function createToughnessDamageResult(action, damageEvent) {
  const hasSkillDamage = isSkillAction(action) && Boolean(damageEvent);

  return {
    value: 0,
    applied: false,
    status: hasSkillDamage ? 'formula-unmapped' : 'not-applicable',
    precision: 'unmapped',
    confidence: 'unknown',
    formulaBreakdown: {
      version: 'stage5-toughness-breakdown-placeholder-v1',
      status: hasSkillDamage ? 'formula-unmapped' : 'not-applicable',
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
            ? 'skill-effect-node-unmapped'
            : 'not-applicable',
          source:
            'pending skill_control/effect node mapping for toughness damage',
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
            'Current skill_control evidence is not yet resolved to toughness effect nodes.',
          ]
        : [],
    },
  };
}

function createSelfEnergyChangeResult(action, resourceEvents) {
  const energyEvents = resourceEvents.filter(event =>
    ['sp', 'energy'].includes(String(event.payload.resource))
  );
  const explicitDelta = energyEvents.reduce(
    (sum, event) => sum + (Number(event.payload.change) || 0),
    0
  );
  const hasExplicitDelta = energyEvents.length > 0;
  const skillAction = isSkillAction(action);

  return {
    value: explicitDelta,
    applied: hasExplicitDelta,
    status: hasExplicitDelta
      ? skillAction
        ? 'explicit-cost-applied-charge-formula-unmapped'
        : 'explicit-resource-delta-applied'
      : skillAction
        ? 'charge-formula-unmapped'
        : 'not-applicable',
    resource: energyEvents[0]?.payload.resource ?? 'sp',
    precision: hasExplicitDelta ? 'explicit-delta' : 'unmapped',
    confidence: hasExplicitDelta ? energyEvents[0].payload.confidence : 'unknown',
    formulaBreakdown: {
      version: 'stage5-self-energy-breakdown-placeholder-v1',
      status: hasExplicitDelta
        ? skillAction
          ? 'explicit-cost-applied-charge-formula-unmapped'
          : 'explicit-resource-delta-applied'
        : skillAction
          ? 'charge-formula-unmapped'
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
          status: skillAction ? 'formula-unmapped' : 'not-applicable',
          source:
            'pending skill_control/effect node and skillsub_logic energy mapping',
        },
      },
      limitations: skillAction
        ? [
            'Current result applies explicit skill cost when present.',
            'Energy gain/charge formula is still unmapped and must be tracked separately from HP damage.',
          ]
        : [],
    },
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
