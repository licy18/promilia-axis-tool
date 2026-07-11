import { createThreeValueMechanismConfigurationContext } from './threeValueMechanismConfiguration';

export const THREE_VALUE_MECHANISM_CONTEXT_CONTRACT_NAME =
  'AzPrThreeValueMechanismContext';

export function createThreeValueMechanismContext({
  scenario,
  action,
  point,
  trackKey,
  hitKey,
  frameIndex,
  timeMs,
  sourceIds,
} = {}) {
  const sourceActor = resolveSourceActor(scenario, action, point);
  const targetEnemy = resolveTargetEnemy(scenario, action, point);
  const teamSlot = (scenario?.team?.slots ?? []).find(
    slot => Number(slot.characterId) === Number(sourceActor?.characterId)
  );
  const valueTargetKind =
    trackKey === 'selfEnergyChange' ? 'source-actor' : 'target-enemy';
  const valueTargetReady =
    valueTargetKind === 'source-actor'
      ? Boolean(sourceActor)
      : Boolean(targetEnemy);
  const ready = Boolean(sourceActor) && valueTargetReady;
  const configuration = createThreeValueMechanismConfigurationContext({
    scenario,
    sourceActor,
    targetEnemy,
    valueTargetKind,
  });

  return {
    schemaVersion: 2,
    sourceKind: 'azpr-three-value-mechanism-context',
    contractName: THREE_VALUE_MECHANISM_CONTEXT_CONTRACT_NAME,
    status: createMechanismContextStatus({
      sourceActor,
      targetEnemy,
      valueTargetKind,
    }),
    ready,
    formulaStatus: ready
      ? 'context-ready-formula-unconfirmed'
      : 'context-missing-formula-not-invocable',
    action: {
      actionId: point?.actionId ?? action?.id ?? null,
      actionType: action?.type ?? point?.actionType ?? null,
      skillId: numberOrNull(point?.skillId ?? action?.skillId),
      actorId: sourceActor?.id ?? point?.actorId ?? action?.actorId ?? null,
      targetId: targetEnemy?.id ?? point?.targetId ?? action?.targetId ?? null,
    },
    hit: {
      hitKey: hitKey ?? null,
      hitIndex: numberOrNull(point?.hitIndex),
      hitSkillId: numberOrNull(point?.hitSkillId),
      frameIndex: numberOrNull(frameIndex),
      timeMs: numberOrNull(timeMs),
      elementConfigIds: uniqueNumbers(sourceIds?.elementConfigIds),
    },
    timing: createMechanismTimingContext(action, point),
    sourceActor: createSourceActorContext(sourceActor, teamSlot),
    targetEnemy: createTargetEnemyContext(targetEnemy),
    configuration,
    configurationReady: configuration.ready,
    configurationStatus: configuration.status,
    ownership: {
      valueTargetKind,
      valueTargetId:
        valueTargetKind === 'source-actor'
          ? (sourceActor?.id ?? null)
          : (targetEnemy?.id ?? null),
      energyOwnerActorId: sourceActor?.id ?? null,
      targetEnemyId: targetEnemy?.id ?? null,
    },
    sourcePaths: {
      team: 'scenario.team.slots',
      sourceActor: 'scenario.actions[].actor',
      sourceActorStats: 'scenario.actions[].actor.stats',
      targetEnemy: 'scenario.enemy',
      targetEnemyStats: 'scenario.enemy.stats',
      targetEnemyElementDefenses: 'scenario.enemy.elementDefenses',
      targetEnemyToughness: 'scenario.enemy.toughness',
      mechanismConfiguration: 'scenario.mechanismConfiguration',
      timing: 'scenario.actions[].timing',
    },
  };
}

function resolveSourceActor(scenario, action, point) {
  const actorId = point?.actorId ?? action?.actorId;
  return (
    action?.actor ??
    (scenario?.actors ?? []).find(actor => actor.id === actorId) ??
    null
  );
}

function resolveTargetEnemy(scenario, action, point) {
  const enemy = scenario?.enemy ?? action?.target ?? null;
  const requestedTargetId = point?.targetId ?? action?.targetId;
  if (!enemy || (requestedTargetId && requestedTargetId !== enemy.id)) {
    return null;
  }
  return enemy;
}

function createMechanismContextStatus({
  sourceActor,
  targetEnemy,
  valueTargetKind,
}) {
  if (!sourceActor) {
    return 'mechanism-context-missing-source-actor';
  }
  if (valueTargetKind === 'target-enemy' && !targetEnemy) {
    return 'mechanism-context-missing-target-enemy';
  }
  return 'mechanism-context-ready';
}

function createMechanismTimingContext(action, point) {
  const needsTimingData = Boolean(action?.timing?.needsTimingData);
  return {
    source: point?.timingSource ?? action?.timing?.source ?? 'unknown',
    needsTimingData,
    accuracy: needsTimingData ? 'placeholder' : 'authoritative',
    animationTimeMs: numberOrNull(action?.timing?.animationTimeMs),
    pointFrameSource:
      point?.sourceKind ?? point?.triggerTimingStatus ?? 'generation-point',
  };
}

function createSourceActorContext(actor, teamSlot) {
  if (!actor) {
    return null;
  }
  const initialSp = numberOrNull(actor.initialSp);
  return {
    actorId: actor.id,
    characterId: numberOrNull(actor.characterId),
    teamSlotId: teamSlot?.slotId ?? null,
    teamPosition: numberOrNull(teamSlot?.position),
    level: numberOrNull(actor.level),
    stats: copyFiniteFields(actor.stats, [
      'attack',
      'maxHp',
      'physicalDefense',
      'magicalDefense',
      'tuningStrength',
      'critRate',
      'critDamage',
      'damageAmplification',
      'damageReduction',
      'maxSp',
    ]),
    statsSource: actor.stats?.source ?? null,
    energy: {
      resource: 'sp',
      maxValue: numberOrNull(actor.stats?.maxSp),
      initialValue: initialSp,
      currentValue: null,
      status: Number.isFinite(initialSp)
        ? 'initial-sp-project-configured-runtime-current-pending'
        : 'initial-current-sp-baseline-pending',
    },
  };
}

function createTargetEnemyContext(enemy) {
  if (!enemy) {
    return null;
  }
  return {
    targetId: enemy.id,
    enemyId: numberOrNull(enemy.enemyId),
    level: numberOrNull(enemy.level),
    stats: copyFiniteFields(enemy.stats, [
      'attack',
      'maxHp',
      'physicalDefense',
      'magicalDefense',
      'maxToughness',
      'initialToughness',
    ]),
    toughness: {
      sourceStatus: enemy.toughness?.sourceStatus ?? null,
      baseMax: numberOrNull(enemy.toughness?.baseMax),
      maxValue: numberOrNull(enemy.toughness?.maxValue),
      initialValue: numberOrNull(enemy.toughness?.initialValue),
    },
    elementDefenses: (enemy.elementDefenses ?? []).map(row => ({
      elementId: numberOrNull(row.elementId),
      attributeKey: row.attributeKey ?? null,
      baseValue: numberOrNull(row.baseValue),
      overrideValue: numberOrNull(row.overrideValue),
      effectiveValue: numberOrNull(row.effectiveValue),
      sourceStatus: row.sourceStatus ?? null,
      appliedToDamage: Boolean(row.appliedToDamage),
    })),
    elementDefenseFormulaStatus:
      enemy.elementDefenseConfig?.formulaStatus ?? null,
  };
}

function copyFiniteFields(source, fields) {
  return Object.fromEntries(
    fields.map(field => [field, numberOrNull(source?.[field])])
  );
}

function numberOrNull(value) {
  if (value == null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function uniqueNumbers(values = []) {
  return [
    ...new Set(
      (values ?? []).map(value => Number(value)).filter(Number.isFinite)
    ),
  ].sort((left, right) => left - right);
}
