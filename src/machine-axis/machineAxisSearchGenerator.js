import { msToFrame } from '../domain/timebase';
import { getVerifiedCombatActionMapping } from '../data/verifiedCombatMechanicsPackage';
import { ACTION_TYPES } from '../domain/projectSchema';
import {
  JOINT_ATTACK_TRIGGER_UNRESOLVED_CODE,
  resolveVerifiedKiboJointAttackBinding,
} from '../domain/verifiedJointAttackContract';
import { createSearchAttackChainProjection } from './machineAxisSearchState';
import {
  isOptimizationCandidateCharacterInScope,
  isOptimizationScenarioActionKindInScope,
} from '../optimization-scenario/optimizationScenarioPolicy';

export const MACHINE_AXIS_SEARCH_GENERATOR_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_GENERATOR_CONTRACT =
  'AzPrMachineAxisSearchGenerator';

const KIBO_ACTION_KINDS = new Set(['signature', 'break']);
const CHARACTER_ACTION_KINDS = new Set([
  'normal-attack',
  'charged-attack',
  'dodge-attack',
  'plunging-attack',
  'star-skill',
  'star-combo',
  'star-carry',
  'limit-counter',
  'perfect-parry',
  'skill',
  'signature',
  'ultimate',
  'break',
]);

export function createMachineAxisSearchGenerator({
  service,
  catalog = service?.catalog(),
} = {}) {
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('Machine Axis search generator requires a catalog');
  }
  const publicActionsByCharacter = new Map();
  for (const entry of catalog.publicActions ?? []) {
    const characterId = Number(entry.ownerId);
    const rows = publicActionsByCharacter.get(characterId) ?? [];
    rows.push(entry);
    publicActionsByCharacter.set(characterId, rows);
  }
  const kibosByKiboId = new Map(
    (catalog.kibos ?? []).map(kibo => [Number(kibo.id), kibo])
  );

  function getCharacterActionCandidates(
    characterId,
    { includeNormalAttacks = true, enforceCandidateRoster = false } = {}
  ) {
    if (
      enforceCandidateRoster &&
      !isOptimizationCandidateCharacterInScope(characterId)
    ) {
      return [];
    }
    return (publicActionsByCharacter.get(Number(characterId)) ?? [])
      .filter(entry => entry.schedulable === true)
      .filter(entry =>
        isOptimizationScenarioActionKindInScope(entry.actionKind)
      )
      .filter(
        entry =>
          includeNormalAttacks || String(entry.actionKind) !== 'normal-attack'
      )
      .filter(entry => CHARACTER_ACTION_KINDS.has(String(entry.actionKind)))
      .sort((left, right) => {
        const kindOrder = String(left.actionKind).localeCompare(
          String(right.actionKind),
          'en'
        );
        if (kindOrder !== 0) return kindOrder;
        const idOrder =
          Number(left.publicActionId) - Number(right.publicActionId);
        if (idOrder !== 0) return idOrder;
        return (
          Number(left.publicVariantIndex ?? 0) -
          Number(right.publicVariantIndex ?? 0)
        );
      });
  }

  function getKiboActionCandidates(kiboId, characterId) {
    const kibo = kibosByKiboId.get(Number(kiboId));
    if (!kibo) return [];
    return (kibo.actions ?? [])
      .filter(entry => KIBO_ACTION_KINDS.has(String(entry.actionKind)))
      .filter(entry => hasVerifiedKiboDuration(entry, kiboId, characterId))
      .sort((left, right) => {
        const kindOrder = String(left.actionKind).localeCompare(
          String(right.actionKind),
          'en'
        );
        if (kindOrder !== 0) return kindOrder;
        return Number(left.publicActionId) - Number(right.publicActionId);
      });
  }

  function generateNextActions({
    axis,
    run,
    nextStartFrameByActor = {},
    options = {},
  }) {
    const scenario = axis.scenario ?? {};
    const team = scenario.team ?? [];
    const slotsByCharacterId = new Map(
      team.map(slot => [Number(slot.characterId), slot])
    );
    const activeActorId =
      options.activeActorId ??
      (run?.trace?.controlledActors?.initialActorId
        ? String(run.trace.controlledActors.initialActorId)
        : team.length > 0
          ? `actor-${team[0].characterId}`
          : '');
    const slotByActorId = new Map(
      team.map(slot => [`actor-${slot.characterId}`, String(slot.slotId)])
    );
    const characterIdByActorId = new Map(
      team.map(slot => [`actor-${slot.characterId}`, Number(slot.characterId)])
    );
    const candidates = [];
    let sequence = 0;
    const actionOrdinalBase = (axis.actions ?? []).length;
    const allocatedActionIds = new Set(
      (axis.actions ?? []).map(action => String(action.id ?? ''))
    );
    let actionIdentityOrdinal = 1;
    const add = entry => {
      candidates.push({ ...entry, sequence: (sequence += 1) });
    };
    const nextActionId = () => {
      let candidate;
      do {
        candidate = `search-action-${actionIdentityOrdinal}`;
        actionIdentityOrdinal += 1;
      } while (allocatedActionIds.has(candidate));
      allocatedActionIds.add(candidate);
      return candidate;
    };

    const activeCharacterId = characterIdByActorId.get(String(activeActorId));
    if (activeCharacterId != null) {
      const baseStartFrame =
        positiveIntegerOrNull(nextStartFrameByActor[String(activeActorId)]) ??
        0;
      const activeAttackChain = createSearchAttackChainProjection({
        trace: run?.trace ?? {},
        currentFrame: baseStartFrame,
        fps: Number(scenario.fps) || 60,
      }).find(state => String(state.actorId) === String(activeActorId));
      const slotId = slotByActorId.get(String(activeActorId));
      const characterCandidates = getCharacterActionCandidates(
        activeCharacterId,
        {
          includeNormalAttacks: options.includeNormalAttacks !== false,
          enforceCandidateRoster:
            scenario.optimizationQualification?.mode === 'formal',
        }
      );
      const maxActorActions = positiveIntegerOrNull(options.maxActionsPerOwner);
      const limited = maxActorActions
        ? characterCandidates.slice(0, maxActorActions)
        : characterCandidates;
      for (const entry of limited) {
        const attackInputs = entry.attackInputs ?? [];
        if (String(entry.actionKind) === 'normal-attack') {
          const segment = selectNextAttackInputSegment({
            entry,
            attackInputs,
            activeAttackChain,
          });
          if (!segment) continue;
          if (
            activeAttackChain &&
            activeAttackChain.linkWindowStatus !== 'applied'
          ) {
            rejectFormalSurface(options, {
              code: 'attack-input-link-timing-unresolved',
              path: 'actions',
              message: `Normal-chain continuation is unresolved for ${activeActorId}`,
              actorId: activeActorId,
              predecessorActionId:
                activeAttackChain.predecessorAcceptedIdentity,
            });
            continue;
          }
          const continuesChain =
            activeAttackChain != null &&
            Number(segment.sequenceIndex) ===
              Number(activeAttackChain.nextSequenceIndex) &&
            Number(segment.sequenceIndex) > 1;
          const startFrame = activeAttackChain
            ? Math.max(
                baseStartFrame,
                Number(activeAttackChain.linkWindowStartFrame) || 0
              )
            : baseStartFrame;
          if (
            activeAttackChain?.linkWindowEndFrame != null &&
            startFrame >= activeAttackChain.linkWindowEndFrame
          ) {
            continue;
          }
          const groupId = continuesChain
            ? activeAttackChain.groupId
            : createSearchAttackGroupId({
                activeActorId,
                entry,
                actionOrdinalBase,
              });
          add({
            action: createMachineAxisSearchAction({
              id: nextActionId(),
              ownerKind: 'actor',
              slotId,
              publicActionId: entry.publicActionId,
              actionKind: entry.actionKind,
              attackInput: {
                sequenceIndex: segment.sequenceIndex,
                groupId,
                ...(segment.chainIdentity
                  ? { chainIdentity: segment.chainIdentity }
                  : {}),
                ...(activeAttackChain?.predecessorAcceptedIdentity
                  ? {
                      contextActionId:
                        activeAttackChain.predecessorAcceptedIdentity,
                    }
                  : {}),
              },
              level: 1,
              startFrame,
            }),
            ownerId: `actor:${activeCharacterId}`,
            ownerKind: 'actor',
            slotId,
            startFrame,
            label: `${entry.name ?? entry.actionKind} A${segment.sequenceIndex}`,
            source: 'catalog:character-public-action',
            sourceIdentity: entry.mappingIdentity ?? null,
          });
        } else {
          if (
            options.requireFormalLegality === true &&
            String(entry.actionKind) === 'star-combo'
          ) {
            rejectFormalSurface(options, {
              code: JOINT_ATTACK_TRIGGER_UNRESOLVED_CODE,
              path: 'actions',
              message:
                'Joint attacks are excluded from the formal surface until existPetBreakTarget is authoritative',
              actorId: activeActorId,
              publicActionId: entry.publicActionId,
              sourceIdentity: entry.mappingIdentity ?? null,
            });
            continue;
          }
          add({
            action: createMachineAxisSearchAction({
              id: nextActionId(),
              ownerKind: 'actor',
              slotId,
              publicActionId: entry.publicActionId,
              actionKind: entry.actionKind,
              level: 1,
              startFrame: baseStartFrame,
            }),
            ownerId: `actor:${activeCharacterId}`,
            ownerKind: 'actor',
            slotId,
            startFrame: baseStartFrame,
            label: entry.name ?? entry.actionKind,
            source: 'catalog:character-public-action',
            sourceIdentity: entry.mappingIdentity ?? null,
          });
        }
      }

      if (options.includeKibo !== false) {
        const activeSlot = slotsByCharacterId.get(activeCharacterId);
        const kiboId = Number(activeSlot?.loadout?.kiboId);
        const kiboCandidates = getKiboActionCandidates(
          kiboId,
          activeCharacterId
        );
        const maxKiboActions = positiveIntegerOrNull(options.maxKiboActions);
        const limitedKibo = maxKiboActions
          ? kiboCandidates.slice(0, maxKiboActions)
          : kiboCandidates;
        for (const entry of limitedKibo) {
          const jointBinding = resolveVerifiedKiboJointAttackBinding({
            type: ACTION_TYPES.KIBO_EVENT,
            kiboId,
            skillId: entry.publicActionId,
            actionKind: entry.actionKind,
            eventType: entry.actionKind,
            actor: {
              characterId: activeCharacterId,
              loadout: { kiboId },
            },
          });
          if (options.requireFormalLegality === true && jointBinding != null) {
            rejectFormalSurface(options, {
              code: JOINT_ATTACK_TRIGGER_UNRESOLVED_CODE,
              path: 'actions',
              message:
                'Kibo joint attacks are excluded from the formal surface until existPetBreakTarget is authoritative',
              actorId: activeActorId,
              kiboId,
              publicActionId: entry.publicActionId,
              mappingIdentity: jointBinding.mappingIdentity,
              mechanicsPackageHash: jointBinding.mechanicsPackageHash,
            });
            continue;
          }
          add({
            action: createMachineAxisSearchAction({
              id: nextActionId(),
              ownerKind: 'kibo',
              slotId,
              publicActionId: entry.publicActionId,
              actionKind: entry.actionKind,
              level: 1,
              startFrame: baseStartFrame,
            }),
            ownerId: `kibo:${kiboId}`,
            ownerKind: 'kibo',
            slotId,
            startFrame: baseStartFrame,
            label: entry.name ?? entry.actionKind,
            source: 'catalog:kibo-action',
            sourceIdentity: null,
          });
        }
      }
    }

    if (options.includeSwitch !== false) {
      const activeStartFrame =
        positiveIntegerOrNull(nextStartFrameByActor[String(activeActorId)]) ??
        0;
      for (const slot of team) {
        const targetActorId = `actor-${slot.characterId}`;
        if (String(targetActorId) === String(activeActorId)) continue;
        add({
          action: createMachineAxisSearchAction({
            id: nextActionId(),
            ownerKind: 'actor',
            slotId: slotByActorId.get(String(activeActorId)) ?? slot.slotId,
            actionKind: 'switch',
            targetSlotId: slot.slotId,
            level: 1,
            startFrame: activeStartFrame,
          }),
          ownerId: `actor:${characterIdByActorId.get(String(activeActorId))}`,
          ownerKind: 'actor',
          slotId: slotByActorId.get(String(activeActorId)),
          startFrame: activeStartFrame,
          label: `switch-to-${slot.slotId}`,
          source: 'catalog:switch',
          sourceIdentity: null,
        });
      }
    }

    return candidates.sort((left, right) => {
      if (left.sequence !== right.sequence)
        return left.sequence - right.sequence;
      return String(left.label).localeCompare(String(right.label), 'en');
    });
  }

  return Object.freeze({
    schemaVersion: MACHINE_AXIS_SEARCH_GENERATOR_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_GENERATOR_CONTRACT,
    catalog,
    getCharacterActionCandidates,
    getKiboActionCandidates,
    generateNextActions,
  });
}

function selectNextAttackInputSegment({
  entry,
  attackInputs,
  activeAttackChain,
}) {
  if (!activeAttackChain) {
    return attackInputs.find(
      segment =>
        Number(segment.sequenceIndex) === 1 &&
        positiveIntegerOrNull(segment.durationFrames) != null
    );
  }
  if (
    Number(entry.publicActionId) !== Number(activeAttackChain.publicActionId)
  ) {
    return null;
  }
  return attackInputs.find(
    segment =>
      positiveIntegerOrNull(segment.durationFrames) != null &&
      Number(segment.sequenceIndex) ===
        Number(activeAttackChain.nextSequenceIndex) &&
      (activeAttackChain.chainIdentity == null ||
        segment.chainIdentity == null ||
        String(segment.chainIdentity) ===
          String(activeAttackChain.chainIdentity))
  );
}

function createSearchAttackGroupId({
  activeActorId,
  entry,
  actionOrdinalBase,
}) {
  return [
    'search-chain',
    String(activeActorId),
    String(entry.mappingIdentity ?? entry.publicActionId),
    String(actionOrdinalBase + 1),
  ].join('|');
}

function rejectFormalSurface(options, issue) {
  if (typeof options?.onFormalRejection === 'function') {
    options.onFormalRejection(Object.freeze({ ...issue }));
  }
}

export function createMachineAxisSearchAction({
  id,
  ownerKind,
  slotId,
  publicActionId = null,
  actionKind = null,
  attackInput = null,
  semanticVariant = null,
  targetSlotId = null,
  durationFrames = null,
  level = 1,
  startFrame = 0,
} = {}) {
  const base = {
    id: String(id ?? `search-action-${startFrame}`),
    owner: { kind: ownerKind, slotId: slotId ?? null },
    schedule: {
      mode: 'absolute',
      frame: Math.max(0, Number(startFrame) || 0),
      offsetFrames: 0,
    },
    note: 'machine-axis-search-generated',
  };
  if (actionKind === 'switch') {
    return {
      ...base,
      intent: { kind: 'switch', targetSlotId },
    };
  }
  if (actionKind === 'wait') {
    return {
      ...base,
      owner: { kind: 'system', slotId: null },
      intent: {
        kind: 'wait',
        durationFrames: Math.max(1, Number(durationFrames) || 1),
      },
    };
  }
  return {
    ...base,
    intent: {
      kind: 'public-action',
      publicActionId,
      actionKind,
      level: Math.max(1, Number(level) || 1),
      ...(attackInput ? { attackInput } : {}),
      ...(semanticVariant ? { semanticVariant } : {}),
    },
  };
}

export function deriveNextStartFrameByActor(run) {
  const trace = run?.trace ?? {};
  const actionById = new Map(
    (trace.actions ?? []).map(action => [String(action.id), action])
  );
  const latestByActor = new Map();
  for (const entry of trace.executionPlan?.actions ?? []) {
    if (entry.execute === false) continue;
    const start = Number(entry.startMs);
    const span = Number(entry.durationMs);
    if (!Number.isFinite(start) || !Number.isFinite(span)) continue;
    const action = actionById.get(String(entry.actionId)) ?? null;
    // Autonomous Kibo actions retain their owner actor for attribution, but
    // occupy the Kibo lane and must not delay the Hero's next input frame.
    if (action?.type === ACTION_TYPES.KIBO_EVENT) continue;
    const actorId = action?.actorId ?? null;
    if (!actorId) continue;
    const endFrame = msToFrame(start + span);
    latestByActor.set(
      actorId,
      Math.max(latestByActor.get(actorId) ?? 0, endFrame)
    );
  }
  return Object.fromEntries(
    [...latestByActor.entries()].sort(([left], [right]) =>
      left.localeCompare(right, 'en')
    )
  );
}

function hasVerifiedKiboDuration(entry, kiboId, characterId) {
  const mapping = getVerifiedCombatActionMapping({
    type: ACTION_TYPES.KIBO_EVENT,
    skillId: entry.publicActionId,
    actionKind: entry.actionKind,
    actionVariantIndex: 0,
    kiboId,
    actor: { characterId, loadout: { kiboId } },
  });
  const durationFrames = Number(
    mapping?.actionTiming?.occupancy?.durationFrames
  );
  return Number.isInteger(durationFrames) && durationFrames > 0;
}

function positiveIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
