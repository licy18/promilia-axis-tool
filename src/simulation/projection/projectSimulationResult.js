export function projectSimulationResult({
  scenario,
  eventLog,
  damageEvents,
  resourceEvents,
}) {
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
    damageTimeline,
    resourceTimeline,
    summary: {
      totalRawDamage,
      projectedHitCount: damageTimeline.length,
      resourceEventCount: resourceTimeline.length,
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
        'Formula breakdown exposes unapplied layers before they are confirmed.',
        'Skill timing is placeholder when timingMissingActionCount is greater than 0.',
      ],
    },
  };
}
