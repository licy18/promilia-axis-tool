import {
  getInstalledVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  ACTION_TYPES,
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
} from '../../domain/projectSchema';
import { getActionSourceSequencePath } from '../../domain/actionSourceSequence';
import { resolveControlledActorAt } from '../runtime/controlledActorTimeline';
import { evaluateVerifiedBattleEffectFormula } from './verifiedBattleEffectFormulaRuntime';

export const VERIFIED_PICKUP_ENTITY_GENERATION_CONTRACT_NAME =
  'AzPrVerifiedPickupEntityGeneration';

const DEFAULT_FRAME_RATE = 60;

export function createPickupEntityLedger({ profiles = [] } = {}) {
  const profileByIdentity = new Map(
    profiles.map(profile => [String(profile.pickupIdentity), profile])
  );
  const entityById = new Map();
  const events = [];
  let eventSequence = 0;
  let spawnAttemptSequence = 0;

  const emit = event => {
    const row = { ...event, ledgerSequence: eventSequence++ };
    events.push(row);
    return row;
  };

  const expireThrough = frame => {
    const expired = [...entityById.values()]
      .filter(
        entity =>
          !entity.destroyed &&
          Number(entity.expiresFrameExclusive) <= Number(frame)
      )
      .sort(comparePickupEntities);
    return expired.map(entity => {
      entity.destroyed = true;
      entity.destroyReason = 'natural-expiry';
      return emit({
        kind: 'pickup-expired',
        status: 'pickup-entity-expired',
        frame: entity.expiresFrameExclusive,
        entityId: entity.entityId,
        pickupIdentity: entity.pickupIdentity,
        poolKey: entity.poolKey,
        applied: true,
      });
    });
  };

  const spawn = ({
    pickupIdentity,
    ownerActorId,
    sourceActionId,
    spawnFrame,
    sourceOrder = 0,
    requestIdentity = null,
    count = 1,
  }) => {
    const profile = profileByIdentity.get(String(pickupIdentity));
    if (!profile) {
      return {
        entities: [],
        rejected: [
          emit({
            kind: 'pickup-spawn-rejected',
            status: 'pickup-profile-missing',
            frame: spawnFrame,
            pickupIdentity,
            applied: false,
          }),
        ],
      };
    }
    expireThrough(spawnFrame);
    const entities = [];
    const rejected = [];
    for (let index = 0; index < Math.max(0, Number(count) || 0); index += 1) {
      const attemptSequence = spawnAttemptSequence++;
      const poolKey = createRuntimePoolKey({ profile, ownerActorId });
      const activeCount = [...entityById.values()].filter(
        entity => entity.poolKey === poolKey && !entity.destroyed
      ).length;
      if (activeCount >= Number(profile.maxCount)) {
        rejected.push(
          emit({
            kind: 'pickup-spawn-rejected',
            status: 'pickup-capacity-rejected-conservative-policy',
            frame: spawnFrame,
            pickupIdentity: profile.pickupIdentity,
            poolKey,
            sourceActionId,
            requestIdentity,
            requestIndex: index,
            applied: false,
          })
        );
        continue;
      }
      const entityId = [
        'pickup',
        profile.pickupIdentity,
        sourceActionId ?? 'no-action',
        Number(spawnFrame),
        Number(sourceOrder),
        attemptSequence,
        index + 1,
      ].join('|');
      const entity = {
        entityId,
        pickupIdentity: profile.pickupIdentity,
        ownerActorId: String(ownerActorId),
        sourceActionId: sourceActionId ?? null,
        unitId: Number(profile.unitId),
        poolKey,
        countType: profile.countType,
        spawnFrame: Number(spawnFrame),
        collisionOpenFrame:
          Number(spawnFrame) + Number(profile.collisionDelayFrames),
        expiresFrameExclusive:
          Number(spawnFrame) + Number(profile.lifetimeFrames),
        collected: false,
        collectedByActorId: null,
        destroyed: false,
        destroyReason: null,
        rewardCount: 0,
        sourceOrder: Number(sourceOrder) + index / 1000,
        requestIdentity,
      };
      entityById.set(entityId, entity);
      entities.push(entity);
      emit({
        kind: 'pickup-spawned',
        status: 'pickup-entity-spawned',
        frame: entity.spawnFrame,
        entityId,
        pickupIdentity: profile.pickupIdentity,
        poolKey,
        sourceActionId,
        applied: true,
      });
    }
    return { entities, rejected };
  };

  const collect = ({
    frame,
    entityId,
    collectorActorId,
    distance = 0,
    allied = true,
  }) => {
    expireThrough(frame);
    const entity = entityById.get(String(entityId));
    const profile = entity
      ? profileByIdentity.get(String(entity.pickupIdentity))
      : null;
    const reject = status => ({
      collected: false,
      entity: entity ?? null,
      profile: profile ?? null,
      event: emit({
        kind: 'pickup-collection-rejected',
        status,
        frame: Number(frame),
        entityId: String(entityId),
        collectorActorId: String(collectorActorId),
        applied: false,
      }),
    });
    if (!entity || !profile) return reject('pickup-entity-not-found');
    if (entity.collected || entity.rewardCount >= 1) {
      return reject('pickup-entity-already-collected');
    }
    if (entity.destroyed) {
      return reject(
        entity.destroyReason === 'natural-expiry'
          ? 'pickup-entity-expired'
          : 'pickup-entity-destroyed'
      );
    }
    if (Number(frame) < entity.collisionOpenFrame) {
      return reject('pickup-collision-window-not-open');
    }
    if (Number(frame) >= entity.expiresFrameExclusive) {
      return reject('pickup-entity-expired');
    }
    if (!allied) return reject('pickup-collector-not-allied');
    if (Number(distance) > Number(profile.collisionRadius)) {
      return reject('pickup-collector-outside-radius');
    }
    entity.collected = true;
    entity.collectedByActorId = String(collectorActorId);
    entity.rewardCount = 1;
    entity.destroyed = true;
    entity.destroyReason = 'collected';
    return {
      collected: true,
      entity,
      profile,
      event: emit({
        kind: 'pickup-collected',
        status: 'pickup-entity-collected',
        frame: Number(frame),
        entityId: entity.entityId,
        collectorActorId: String(collectorActorId),
        rewardCount: entity.rewardCount,
        applied: true,
      }),
    };
  };

  return {
    spawn,
    collect,
    expireThrough,
    snapshot() {
      return {
        entities: [...entityById.values()].sort(comparePickupEntities),
        events: [...events],
      };
    },
  };
}

export function createVerifiedPickupEntityGeneration({
  scenario = {},
  actionExecutionPlan = null,
  actionResolutionById = null,
  controlledActorTimeline = null,
} = {}) {
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const graph = mechanicsPackage?.actionVariantGraph;
  const profiles = (graph?.pickupProfiles ?? []).filter(
    profile => profile.applied === true
  );
  const bindings = (graph?.pickupSpawnBindings ?? []).filter(
    binding => binding.applied === true
  );
  if (!mechanicsPackage || profiles.length === 0 || bindings.length === 0) {
    return createEmptyGeneration(mechanicsPackage);
  }
  const frameRate = positiveNumber(scenario?.time?.fps, DEFAULT_FRAME_RATE);
  const durationFrames = Math.round(
    (nonNegativeNumber(scenario?.time?.durationMs) * frameRate) / 1000
  );
  const executionByActionId = new Map(
    (actionExecutionPlan?.actions ?? []).map(entry => [entry.actionId, entry])
  );
  const profileByIdentity = new Map(
    profiles.map(profile => [String(profile.pickupIdentity), profile])
  );
  const ledger = createPickupEntityLedger({ profiles });
  const descriptors = [];
  const events = [];
  const directHpEvents = [];
  const directSpEvents = [];
  const effectCommands = [];
  const unresolved = [];
  let queueSequence = 0;

  const enqueue = descriptor => {
    descriptors.push({ ...descriptor, queueSequence: queueSequence++ });
    descriptors.sort(compareDescriptors);
  };

  for (const action of scenario.actions ?? []) {
    if (
      action.type !== ACTION_TYPES.SKILL ||
      executionByActionId.get(action.id)?.execute === false
    ) {
      continue;
    }
    const resolution =
      actionResolutionById?.get(action.id) ??
      resolveVerifiedCombatActionMechanics(action, {
        combatScenario: scenario.combatScenario,
      });
    if (!resolution?.ready) continue;
    const controlSkillId = Number(resolution.actionBinding?.controlSkillId);
    const subSkillIndex = Number(
      resolution.actionBinding?.selectedSubSkillIndex
    );
    for (const binding of bindings) {
      if (
        Number(binding.controlSkillId) !== controlSkillId ||
        Number(binding.subSkillIndex) !== subSkillIndex
      ) {
        continue;
      }
      const profile = profileByIdentity.get(String(binding.pickupIdentity));
      if (!profile) continue;
      const hit = binding.requiresHitElementId == null
        ? null
        : (resolution.allHits ?? resolution.hits ?? []).find(
            candidate =>
              Number(candidate.elementId) ===
                Number(binding.requiresHitElementId) &&
              Number(candidate.trigger?.startFrame) ===
                Number(binding.triggerFrame)
          );
      const landed =
        binding.requiresHitElementId == null ||
        (hit != null && (resolution.hits ?? []).includes(hit));
      const spawnTimeMs = roundValue(
        Number(action.startMs) +
          (Number(binding.triggerFrame) * 1000) /
            positiveNumber(binding.frameRate, frameRate)
      );
      const spawnFrame = Math.round((spawnTimeMs * frameRate) / 1000);
      if (!landed) {
        events.push({
          kind: 'pickup-spawn-suppressed',
          status: 'pickup-required-hit-missed',
          frame: spawnFrame,
          timeMs: spawnTimeMs,
          actionId: action.id,
          pickupIdentity: binding.pickupIdentity,
          requiresHitElementId: binding.requiresHitElementId,
          applied: false,
        });
        continue;
      }
      enqueue({
        kind: 'spawn',
        phase: 1,
        frame: spawnFrame,
        timeMs: spawnTimeMs,
        action,
        resolution,
        binding,
        profile,
        sourceSequencePath: createPickupSourceSequencePath({
          action,
          binding,
          phase: 10,
        }),
      });
    }
  }

  while (descriptors.length > 0) {
    const descriptor = descriptors.shift();
    if (descriptor.frame > durationFrames) continue;
    if (descriptor.kind === 'expiry') {
      const before = ledger.snapshot().events.length;
      ledger.expireThrough(descriptor.frame);
      events.push(
        ...ledger
          .snapshot()
          .events.slice(before)
          .map(event => publishLedgerEvent(event, frameRate))
      );
      continue;
    }
    if (descriptor.kind === 'spawn') {
      const before = ledger.snapshot().events.length;
      const result = ledger.spawn({
        pickupIdentity: descriptor.profile.pickupIdentity,
        ownerActorId: descriptor.action.actorId,
        sourceActionId: descriptor.action.id,
        spawnFrame: descriptor.frame,
        sourceOrder: descriptor.binding.sourceOrder,
        requestIdentity: descriptor.binding.bindingIdentity,
        count: descriptor.binding.count,
      });
      events.push(
        ...ledger
          .snapshot()
          .events.slice(before)
          .map(event => publishLedgerEvent(event, frameRate))
      );
      for (const [entityIndex, entity] of result.entities.entries()) {
        enqueue({
          kind: 'expiry',
          phase: 0,
          frame: entity.expiresFrameExclusive,
          timeMs: frameToMs(entity.expiresFrameExclusive, frameRate),
          entity,
          sourceSequencePath: [
            ...descriptor.sourceSequencePath,
            20,
            entityIndex,
          ],
        });
        if (resolveAutoCollectPolicy(scenario)) {
          enqueue({
            kind: 'collision',
            phase: 2,
            frame: entity.collisionOpenFrame,
            timeMs: frameToMs(entity.collisionOpenFrame, frameRate),
            entity,
            action: descriptor.action,
            resolution: descriptor.resolution,
            profile: descriptor.profile,
            sourceSequencePath: [
              ...descriptor.sourceSequencePath,
              30,
              entityIndex,
            ],
          });
        }
      }
      continue;
    }
    if (descriptor.kind !== 'collision') continue;
    const controlled = resolveControlledActorAt(
      controlledActorTimeline,
      descriptor.timeMs
    );
    if (!controlled?.actorId) {
      unresolved.push({
        kind: 'pickup-collector-unresolved',
        entityId: descriptor.entity.entityId,
        timeMs: descriptor.timeMs,
        applied: false,
      });
      continue;
    }
    const before = ledger.snapshot().events.length;
    const collection = ledger.collect({
      frame: descriptor.frame,
      entityId: descriptor.entity.entityId,
      collectorActorId: controlled.actorId,
      distance: resolvePickupDistance(scenario),
      allied: true,
    });
    events.push(
      ...ledger
        .snapshot()
        .events.slice(before)
        .map(event => publishLedgerEvent(event, frameRate))
    );
    if (!collection.collected) continue;
    const reward = createPickupRewardEvent({
      descriptor,
      collectorActorId: controlled.actorId,
      mechanicsPackage,
    });
    if (reward?.kind === 'direct-heal') directHpEvents.push(reward);
    if (reward?.kind === 'direct-sp') directSpEvents.push(reward);
    const tuningCommand = createPickupTuningEffectCommand({
      descriptor,
      collectorActorId: controlled.actorId,
      scenario,
      mechanicsPackage,
    });
    if (tuningCommand) effectCommands.push(tuningCommand);
  }

  events.sort(comparePublishedEvents);
  directHpEvents.sort(comparePublishedEvents);
  directSpEvents.sort(comparePublishedEvents);
  effectCommands.sort(comparePublishedEvents);
  const snapshot = ledger.snapshot();
  return {
    schemaVersion: 1,
    contractName: VERIFIED_PICKUP_ENTITY_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-pickup-entity-generation',
    status: 'verified-pickup-entity-generation-ready',
    packageId: mechanicsPackage.packageId,
    packageHash: mechanicsPackage.packageHash,
    profiles,
    bindings,
    events,
    entities: snapshot.entities,
    directHpEvents,
    directSpEvents,
    effectCommands,
    unresolved,
    summary: {
      profileCount: profiles.length,
      bindingCount: bindings.length,
      spawnedEntityCount: events.filter(event => event.kind === 'pickup-spawned')
        .length,
      collectedEntityCount: events.filter(
        event => event.kind === 'pickup-collected'
      ).length,
      capacityRejectedCount: events.filter(
        event =>
          event.status === 'pickup-capacity-rejected-conservative-policy'
      ).length,
      directHpEventCount: directHpEvents.length,
      directSpEventCount: directSpEvents.length,
      tuningEffectCommandCount: effectCommands.length,
      unresolvedCount: unresolved.length,
      applied: true,
    },
    applied: true,
  };
}

function createPickupRewardEvent({
  descriptor,
  collectorActorId,
  mechanicsPackage,
}) {
  const reward = descriptor.profile.reward;
  if (!reward) return null;
  const target = {
    kind: EFFECT_TARGET_KINDS.ACTOR,
    id: String(collectorActorId),
  };
  const effect = {
    elementId: Number(reward.elementId),
    semanticIdentity: `pickup-reward:${descriptor.entity.entityId}`,
    effectIdentity: `pickup-reward:${descriptor.entity.entityId}`,
    sourceIdentity: reward.sourceIdentity,
    sourceOrder: {
      sourceSequencePath: descriptor.sourceSequencePath,
      sourceIdentity: reward.sourceIdentity,
    },
    target: { kind: 'collision-target' },
    ...(reward.kind === 'direct-heal'
      ? { heal: { formula: reward.formula, valueByLevel: reward.valueByLevel } }
      : { directSp: reward.directSp }),
  };
  const formulaResult =
    reward.kind === 'direct-heal'
      ? evaluateVerifiedBattleEffectFormula({
          effect: { ...effect, formula: reward.formula },
          level: descriptor.action.level ?? 1,
          sourceActor: descriptor.action.actor,
        })
      : null;
  const value =
    reward.kind === 'direct-heal'
      ? formulaResult?.value
      : Number(reward.directSp?.value);
  if (!Number.isFinite(Number(value))) return null;
  const eventIdentity = `${reward.kind}|${descriptor.entity.entityId}|actor:${collectorActorId}`;
  return {
    schemaVersion: 1,
    sourceKind: 'azpr-verified-pickup-direct-effect',
    status: 'verified-pickup-direct-effect-ready',
    eventIdentity,
    kind: reward.kind,
    timeMs: descriptor.timeMs,
    action: descriptor.action,
    actionId: descriptor.action.id,
    actorId: descriptor.action.actorId,
    target,
    value: Number(value),
    formulaResult,
    effect,
    resolution: {
      ...descriptor.resolution,
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
    },
    sourceSequencePath: [...descriptor.sourceSequencePath, 40],
    sourceSequenceStatus: 'verified-direct-effect-source-sequence-ready',
    sourceIdentity: reward.sourceIdentity,
    appliedToCalculators: true,
    applied: true,
  };
}

function createPickupTuningEffectCommand({
  descriptor,
  collectorActorId,
  scenario,
  mechanicsPackage,
}) {
  const tuning = descriptor.profile.tuningEffect;
  if (!tuning) return null;
  if (
    !hasPickupPassiveMarker({
      scenario,
      collectorActorId,
      ownerActorId: descriptor.entity.ownerActorId,
      marker: descriptor.profile.passiveMarker,
    })
  ) {
    return null;
  }
  return {
    id: `pickup-tuning|${descriptor.entity.entityId}`,
    effectId: `battle-element:${tuning.elementId}`,
    effectName: tuning.name,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId: String(collectorActorId),
    timeMs: descriptor.timeMs,
    durationMs: Number(tuning.durationMs),
    stackMode: EFFECT_STACK_MODES.STACK,
    stackDelta: 1,
    maxStacks: Number(tuning.maxStacks),
    expiryMode: 'independent-layer',
    atCapacityPolicy: 'ignore-new-no-refresh',
    tags: [
      'verified-pickup-passive',
      'independent-layer-expiry',
      'conservative-cap-policy',
    ],
    sourceStatus: 'verified-battle-effect-generated',
    sourceActionId: descriptor.action.id,
    sourceActionName: descriptor.action.name,
    sourceActorId: descriptor.action.actorId,
    sourceActorName: descriptor.action.actor?.name ?? null,
    semanticTargetKind: 'collision-target',
    sourceIdentity: {
      packageId: mechanicsPackage.packageId,
      packageHash: mechanicsPackage.packageHash,
      actionBindingIdentity:
        descriptor.resolution.actionBinding?.identity ?? null,
      effectIdentity: `pickup-tuning:${descriptor.entity.entityId}`,
      elementId: Number(tuning.elementId),
      sourceIdentity: tuning.sourceIdentity,
      sourceSequencePath: [...descriptor.sourceSequencePath, 50],
    },
    sourceSequencePath: [...descriptor.sourceSequencePath, 50],
    modifiers: [
      {
        kind: 'battle-property',
        attributeId: Number(tuning.attributeId),
        bucket: tuning.bucket,
        valueRaw: Number(tuning.valueRaw),
        propertyTags: tuning.propertyTags ?? [],
        sourceIdentity: tuning.sourceIdentity,
      },
    ],
    appliedToCalculators: true,
    generatedVerified: true,
  };
}

function hasPickupPassiveMarker({
  scenario,
  collectorActorId,
  ownerActorId,
  marker,
}) {
  if (!marker) return true;
  if (
    marker.ownerActiveAtBattleEnter === true &&
    String(collectorActorId) === String(ownerActorId)
  ) {
    return true;
  }
  return (scenario?.initialRuntimeState?.activeEffects ?? []).some(
    effect =>
      String(effect.targetId) === String(collectorActorId) &&
      [
        String(marker.elementId),
        `battle-element:${marker.elementId}`,
      ].includes(String(effect.effectId ?? effect.elementId))
  );
}

function createPickupSourceSequencePath({ action, binding, phase }) {
  const actionPath = getActionSourceSequencePath(action);
  return [
    ...(Array.isArray(actionPath) ? actionPath : [0]),
    70,
    Number(binding.sourceOrder) || 0,
    Number(binding.triggerFrame) || 0,
    phase,
  ];
}

function createRuntimePoolKey({ profile, ownerActorId }) {
  return [
    String(ownerActorId),
    profile.countType,
    profile.poolKey,
    Number(profile.unitId),
  ].join('|');
}

function resolveAutoCollectPolicy(scenario) {
  return scenario?.combatScenario?.pickups?.autoCollect !== false;
}

function resolvePickupDistance(scenario) {
  const configured = Number(scenario?.combatScenario?.pickups?.distance);
  if (Number.isFinite(configured)) return configured;
  const projectileDistance = Number(
    scenario?.combatScenario?.projectile?.targetDistance
  );
  return Number.isFinite(projectileDistance) ? projectileDistance : 0;
}

function publishLedgerEvent(event, frameRate) {
  return {
    ...event,
    timeMs: frameToMs(event.frame, frameRate),
    absoluteFrame: Number(event.frame),
  };
}

function comparePickupEntities(left, right) {
  return (
    Number(left.sourceOrder) - Number(right.sourceOrder) ||
    String(left.entityId).localeCompare(String(right.entityId))
  );
}

function compareDescriptors(left, right) {
  return (
    Number(left.frame) - Number(right.frame) ||
    Number(left.phase) - Number(right.phase) ||
    compareSequencePaths(left.sourceSequencePath, right.sourceSequencePath) ||
    Number(left.queueSequence) - Number(right.queueSequence)
  );
}

function comparePublishedEvents(left, right) {
  return (
    Number(left.timeMs) - Number(right.timeMs) ||
    compareSequencePaths(left.sourceSequencePath, right.sourceSequencePath) ||
    Number(left.ledgerSequence ?? 0) - Number(right.ledgerSequence ?? 0) ||
    String(left.eventIdentity ?? left.entityId ?? left.id ?? '').localeCompare(
      String(right.eventIdentity ?? right.entityId ?? right.id ?? '')
    )
  );
}

function compareSequencePaths(left, right) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] == null) return -1;
    if (b[index] == null) return 1;
    const delta = Number(a[index]) - Number(b[index]);
    if (delta !== 0) return delta;
  }
  return 0;
}

function frameToMs(frame, frameRate) {
  return roundValue((Number(frame) * 1000) / positiveNumber(frameRate, 60));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function roundValue(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
}

function createEmptyGeneration(mechanicsPackage) {
  return {
    schemaVersion: 1,
    contractName: VERIFIED_PICKUP_ENTITY_GENERATION_CONTRACT_NAME,
    sourceKind: 'azpr-verified-pickup-entity-generation',
    status: 'verified-pickup-entity-generation-ready-no-contracts',
    packageId: mechanicsPackage?.packageId ?? null,
    packageHash: mechanicsPackage?.packageHash ?? null,
    profiles: [],
    bindings: [],
    events: [],
    entities: [],
    directHpEvents: [],
    directSpEvents: [],
    effectCommands: [],
    unresolved: [],
    summary: {
      profileCount: 0,
      bindingCount: 0,
      spawnedEntityCount: 0,
      collectedEntityCount: 0,
      capacityRejectedCount: 0,
      directHpEventCount: 0,
      directSpEventCount: 0,
      tuningEffectCommandCount: 0,
      unresolvedCount: 0,
      applied: true,
    },
    applied: true,
  };
}
