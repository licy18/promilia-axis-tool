import { msToFrame } from '../domain/timebase';
import {
  getVerifiedCombatActionMapping,
  getVerifiedCombatActionMappingByIdentity,
  getVerifiedActionVariantGraph,
} from '../data/verifiedCombatMechanicsPackage';
import { ACTION_TYPES } from '../domain/projectSchema';
import { isKiboAxisActionKindIncluded } from '../domain/kiboAxisActionScopePolicy';
import { resolveVerifiedKiboJointAttackBinding } from '../domain/verifiedJointAttackContract';
import {
  VERIFIED_NORMAL_ATTACK_INPUT_PHASES,
  matchVerifiedNormalAttackInput,
  resolveVerifiedNormalAttackInputPhase,
} from '../domain/verifiedNormalAttackInputAuthority';
import {
  VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED_CODE,
  validateVerifiedJointAttackRuntimeBinding,
} from '../domain/verifiedJointAttackRuntimeContract';
import { createSearchAttackChainProjection } from './machineAxisSearchState';
import {
  createVerifiedChargedInputScheduling,
  getConservativeChargedInputDelayFrames,
} from '../domain/verifiedChargedInputAuthority';
import {
  isOptimizationCandidateCharacterInScope,
  isOptimizationScenarioActionKindInScope,
} from '../optimization-scenario/optimizationScenarioPolicy';

export const MACHINE_AXIS_SEARCH_GENERATOR_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_GENERATOR_CONTRACT =
  'AzPrMachineAxisSearchGenerator';

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
      .filter(entry => isKiboAxisActionKindIncluded(entry.actionKind))
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
      const filtered = options.actionFilter
        ? characterCandidates.filter(entry =>
            options.actionFilter.character(entry, activeCharacterId)
          )
        : characterCandidates;
      const activeSlot = slotsByCharacterId.get(activeCharacterId);
      const kiboId = Number(activeSlot?.loadout?.kiboId);
      const kiboCandidates =
        options.includeKibo === false
          ? []
          : getKiboActionCandidates(kiboId, activeCharacterId);
      const maxKiboActions = positiveIntegerOrNull(options.maxKiboActions);
      const limitedKibo = maxKiboActions
        ? kiboCandidates.slice(0, maxKiboActions)
        : kiboCandidates;
      const filteredKibo = options.actionFilter
        ? limitedKibo.filter(entry => options.actionFilter.kibo(entry, kiboId))
        : limitedKibo;
      const verifiedJointKiboEntries = filteredKibo.filter(entry =>
        resolveGeneratorJointAttackBinding({
          entry,
          kiboId,
          activeCharacterId,
        })
      );
      const jointRuntimeValidation = validateVerifiedJointAttackRuntimeBinding(
        scenario.jointAttackRuntime
      );
      let addedActorCandidateCount = 0;
      for (const entry of filtered) {
        if (
          maxActorActions != null &&
          addedActorCandidateCount >= maxActorActions
        ) {
          break;
        }
        const attackInputs = entry.attackInputs ?? [];
        if (String(entry.actionKind) === 'normal-attack') {
          const selection = selectNextAttackInputSegment({
            entry,
            attackInputs,
            activeAttackChain,
            activeActorId,
          });
          if (!selection.ready) {
            rejectFormalSurface(options, {
              code: selection.code,
              path: 'actions',
              message: selection.message,
              actorId: activeActorId,
              predecessorActionId:
                activeAttackChain?.predecessorAcceptedIdentity ?? null,
              authorityPhase:
                activeAttackChain?.authorityPhase ??
                selection.phase?.phase ??
                null,
              authoritySourceKind:
                activeAttackChain?.authoritySourceKind ??
                selection.phase?.sourceKind ??
                null,
              reason: selection.reason ?? null,
            });
            continue;
          }
          const { expected, phase } = selection;
          const continuesChain =
            phase.phase ===
            VERIFIED_NORMAL_ATTACK_INPUT_PHASES.SUCCESSOR_WINDOW;
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
            ? (expected.groupId ?? activeAttackChain.groupId)
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
                sequenceIndex: expected.sequenceIndex,
                groupId,
                ...(expected.chainIdentity
                  ? { chainIdentity: expected.chainIdentity }
                  : {}),
                ...(expected.contextActionId
                  ? {
                      contextActionId: expected.contextActionId,
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
            label: `${entry.name ?? entry.actionKind} A${expected.sequenceIndex}`,
            source: 'catalog:character-public-action',
            sourceIdentity: entry.mappingIdentity ?? null,
          });
          addedActorCandidateCount += 1;
        } else {
          if (String(entry.actionKind) === 'star-combo') {
            const jointKiboEntry = verifiedJointKiboEntries[0] ?? null;
            if (!jointRuntimeValidation.valid || !jointKiboEntry) {
              rejectFormalSurface(options, {
                code: !jointRuntimeValidation.valid
                  ? VERIFIED_JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED_CODE
                  : 'joint-attack-kibo-required',
                path: 'actions',
                message: !jointRuntimeValidation.valid
                  ? 'Joint attack search requires m12-joint-attack-runtime-v1'
                  : 'Joint attack search requires the equipped verified Kibo JointStrikeSkill',
                actorId: activeActorId,
                kiboId: Number.isInteger(kiboId) ? kiboId : null,
                publicActionId: entry.publicActionId,
                sourceIdentity: entry.mappingIdentity ?? null,
              });
              continue;
            }
            const actorAction = createMachineAxisSearchAction({
              id: nextActionId(),
              ownerKind: 'actor',
              slotId,
              publicActionId: entry.publicActionId,
              actionKind: entry.actionKind,
              level: 1,
              startFrame: baseStartFrame,
            });
            const kiboAction = createMachineAxisSearchAction({
              id: nextActionId(),
              ownerKind: 'kibo',
              slotId,
              publicActionId: jointKiboEntry.publicActionId,
              actionKind: jointKiboEntry.actionKind,
              level: 1,
              startFrame: baseStartFrame,
            });
            add({
              action: actorAction,
              actions: [actorAction, kiboAction],
              compoundKind: 'joint-attack',
              ownerId: `actor:${activeCharacterId}`,
              ownerKind: 'compound',
              slotId,
              startFrame: baseStartFrame,
              label: `${entry.name ?? entry.actionKind} + ${jointKiboEntry.name ?? jointKiboEntry.actionKind}`,
              source: 'catalog:verified-joint-attack-compound',
              sourceIdentity: entry.mappingIdentity ?? null,
              runtimeBindingHash:
                jointRuntimeValidation.binding?.bindingHash ?? null,
            });
            addedActorCandidateCount += 1;
            continue;
          }
          const chargedInput = resolveGeneratedChargedInput({
            axis,
            entry,
            slotId,
            baseStartFrame,
            frameRate: Number(scenario.fps) || 60,
          });
          if (!chargedInput.ready) {
            rejectFormalSurface(options, {
              code: chargedInput.reason,
              path: 'actions',
              message: `Charged input authority rejected ${entry.name ?? entry.actionKind}`,
              actorId: activeActorId,
              publicActionId: entry.publicActionId,
              sourceIdentity:
                entry.chargedInputAuthority?.sourceIdentity ??
                entry.mappingIdentity ??
                null,
            });
            continue;
          }
          for (const semanticVariant of chargedInput.semanticVariants) {
            if (
              maxActorActions != null &&
              addedActorCandidateCount >= maxActorActions
            ) {
              break;
            }
            add({
              action: createMachineAxisSearchAction({
                id: nextActionId(),
                ownerKind: 'actor',
                slotId,
                publicActionId: entry.publicActionId,
                actionKind: entry.actionKind,
                level: 1,
                startFrame: chargedInput.startFrame,
                physicalInput: chargedInput.physicalInput,
                semanticVariant:
                  projectGeneratedActionSemanticVariant(semanticVariant),
              }),
              ownerId: `actor:${activeCharacterId}`,
              ownerKind: 'actor',
              slotId,
              startFrame: chargedInput.startFrame,
              label: semanticVariant?.semanticName
                ? `${entry.name ?? entry.actionKind} · ${semanticVariant.semanticName}`
                : (entry.name ?? entry.actionKind),
              source: 'catalog:character-public-action',
              sourceIdentity:
                semanticVariant?.sourceIdentity ??
                entry.mappingIdentity ??
                null,
            });
            addedActorCandidateCount += 1;
          }
        }
      }

      if (options.includeKibo !== false) {
        for (const entry of filteredKibo) {
          const jointBinding = resolveGeneratorJointAttackBinding({
            entry,
            kiboId,
            activeCharacterId,
          });
          if (jointBinding != null) continue;
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

function resolveGeneratorJointAttackBinding({
  entry,
  kiboId,
  activeCharacterId,
}) {
  return resolveVerifiedKiboJointAttackBinding({
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
}

function selectNextAttackInputSegment({
  entry,
  attackInputs,
  activeAttackChain,
  activeActorId,
}) {
  const mapping = getVerifiedCombatActionMappingByIdentity(
    entry.mappingIdentity
  );
  if (!mapping || mapping.actionKind !== 'normal-attack') {
    return rejectedNormalAttackSelection({
      code: 'normal-attack-authority-mapping-unresolved',
      message: `Normal-attack authority mapping is unresolved for ${activeActorId}`,
      reason: 'normal-attack-authority-mapping-unresolved',
    });
  }
  if (
    activeAttackChain?.mappingIdentity != null &&
    String(mapping.identity) !== String(activeAttackChain.mappingIdentity)
  ) {
    return rejectedNormalAttackSelection({
      code: 'normal-attack-authority-mapping-conflict',
      message: `Normal-attack authority mapping conflicts with the active continuation for ${activeActorId}`,
      reason: 'normal-attack-authority-mapping-conflict',
    });
  }
  const phase = activeAttackChain
    ? activeAttackChain.authorityPhaseProof
    : resolveVerifiedNormalAttackInputPhase({
        mapping,
        actorId: activeActorId,
      });
  if (!phase) {
    return rejectedNormalAttackSelection({
      code: 'normal-attack-input-phase-unresolved',
      message: `Normal-attack input phase is unresolved for ${activeActorId}`,
      reason: 'normal-attack-input-phase-unresolved',
    });
  }
  if (phase.phase === VERIFIED_NORMAL_ATTACK_INPUT_PHASES.RECOVERY_LOCKED) {
    return rejectedNormalAttackSelection({
      code: 'normal-attack-input-recovery-locked',
      message: `Normal-attack input is recovery-locked for ${activeActorId}`,
      reason: phase.reasons?.[0] ?? 'normal-attack-input-recovery-locked',
      phase,
    });
  }
  const expected = phase.expected;
  if (!expected) {
    return rejectedNormalAttackSelection({
      code: 'normal-attack-input-target-unresolved',
      message: `Normal-attack input target is unresolved for ${activeActorId}`,
      reason: 'normal-attack-input-target-unresolved',
      phase,
    });
  }
  const authoritySegments = resolveVerifiedAttackInputAuthoritySegments({
    mapping,
    expected,
  }).filter(
    segment =>
      Number(segment.sequenceIndex) === Number(expected.sequenceIndex) &&
      Number(segment.controlSkillId) === Number(expected.controlSkillId) &&
      Number(segment.subSkillIndex ?? segment.selectedSubSkillIndex) ===
        Number(expected.subSkillIndex) &&
      (expected.chainIdentity == null ||
        segment.attackInputChainIdentity == null ||
        String(segment.attackInputChainIdentity) ===
          String(expected.chainIdentity))
  );
  const catalogSegment =
    attackInputs.find(
      segment =>
        Number(segment.sequenceIndex) === Number(expected.sequenceIndex) &&
        Number(segment.controlSkillId) === Number(expected.controlSkillId) &&
        Number(segment.subSkillIndex ?? segment.selectedSubSkillIndex) ===
          Number(expected.subSkillIndex) &&
        (expected.chainIdentity == null ||
          segment.attackInputChainIdentity == null ||
          String(segment.attackInputChainIdentity) ===
            String(expected.chainIdentity)) &&
        positiveIntegerOrNull(segment.durationFrames) != null
    ) ??
    authoritySegments.find(
      segment => positiveIntegerOrNull(segment.durationFrames) != null
    );
  if (authoritySegments.length !== 1 || !catalogSegment) {
    const special =
      phase.sourceKind !== 'verified-normal-attack-idle' &&
      phase.sourceKind !== 'verified-normal-attack-direct-successor';
    return rejectedNormalAttackSelection({
      code: special
        ? 'normal-attack-special-continuation-target-unresolved'
        : 'normal-attack-input-target-unresolved',
      message: special
        ? `Verified special normal-attack continuation target cannot be constructed for ${activeActorId}`
        : `Verified normal-attack input target cannot be constructed for ${activeActorId}`,
      reason: 'normal-attack-input-target-not-unique',
      phase,
    });
  }
  const authoritySegment = authoritySegments[0];
  const match = matchVerifiedNormalAttackInput({
    action: {
      actionKind: 'normal-attack',
      actorId: activeActorId,
      attackGroupId:
        expected.groupId ??
        activeAttackChain?.groupId ??
        'search-normal-attack-opener',
      attackSequenceIndex: expected.sequenceIndex,
      runtimeContextActionId: expected.contextActionId ?? null,
      attackInput: {
        sequenceIndex: expected.sequenceIndex,
        controlSkillId: authoritySegment.controlSkillId,
        subSkillIndex:
          authoritySegment.subSkillIndex ??
          authoritySegment.selectedSubSkillIndex,
        attackInputChainIdentity:
          expected.chainIdentity ??
          authoritySegment.attackInputChainIdentity ??
          null,
      },
    },
    mapping,
    phase,
  });
  if (match.accepted !== true) {
    return rejectedNormalAttackSelection({
      code: 'normal-attack-input-authority-rejected',
      message: `Normal-attack input authority rejected the generated target for ${activeActorId}`,
      reason: match.reason ?? 'normal-attack-input-authority-rejected',
      phase,
    });
  }
  return {
    ready: true,
    segment: catalogSegment,
    authoritySegment,
    expected,
    phase,
    match,
  };
}

function resolveVerifiedAttackInputAuthoritySegments({ mapping, expected }) {
  const mappingSegments = [
    ...new Map(
      [
        ...(mapping?.attackInputSegments ?? []),
        ...(mapping?.profileAttackInputSegments ?? []),
      ].map(segment => [
        [
          segment.attackInputChainIdentity ?? '',
          segment.sequenceIndex ?? '',
          segment.controlSkillId ?? '',
          segment.subSkillIndex ?? segment.selectedSubSkillIndex ?? '',
        ].join('|'),
        segment,
      ])
    ).values(),
  ];
  if (expected?.chainIdentity == null) return mappingSegments;
  const graphSegments = (
    getVerifiedActionVariantGraph()?.attackInputChains ?? []
  ).flatMap(chain => {
    if (
      chain?.applied !== true ||
      Number(chain.ownerId) !== Number(mapping?.ownerId) ||
      Number(chain.sourceSkillId) !== Number(mapping?.sourceSkillId) ||
      (expected?.chainIdentity != null &&
        String(chain.chainIdentity) !== String(expected.chainIdentity))
    ) {
      return [];
    }
    return (chain.segments ?? [])
      .filter(segment => segment?.applied === true)
      .map(segment => ({
        ...segment,
        attackInputChainIdentity: chain.chainIdentity,
      }));
  });
  if (graphSegments.length > 0) {
    return [
      ...new Map(
        graphSegments.map(segment => [
          [
            segment.attackInputChainIdentity ?? '',
            segment.sequenceIndex ?? '',
            segment.controlSkillId ?? '',
            segment.subSkillIndex ?? segment.selectedSubSkillIndex ?? '',
          ].join('|'),
          segment,
        ])
      ).values(),
    ];
  }
  return [
    ...new Map(
      mappingSegments.map(segment => [
        [
          segment.attackInputChainIdentity ?? '',
          segment.sequenceIndex ?? '',
          segment.controlSkillId ?? '',
          segment.subSkillIndex ?? segment.selectedSubSkillIndex ?? '',
        ].join('|'),
        segment,
      ])
    ).values(),
  ];
}

function rejectedNormalAttackSelection({
  code,
  message,
  reason,
  phase = null,
}) {
  return { ready: false, code, message, reason, phase };
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
  physicalInput = null,
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
      ...(physicalInput ? { physicalInput } : {}),
    },
  };
}

function resolveGeneratedChargedInput({
  axis,
  entry,
  slotId,
  baseStartFrame,
  frameRate,
}) {
  if (String(entry?.actionKind) !== 'charged-attack') {
    return {
      ready: true,
      startFrame: baseStartFrame,
      physicalInput: null,
      semanticVariants: [null],
    };
  }
  const authority = entry.chargedInputAuthority;
  if (!authority || authority.applied !== true) {
    return {
      ready: false,
      reason: authority
        ? 'charged-input-authority-unresolved'
        : 'charged-input-authority-missing',
    };
  }
  const previous = (axis?.actions ?? [])
    .filter(
      action =>
        action?.owner?.kind === 'actor' &&
        String(action.owner.slotId ?? '') === String(slotId ?? '') &&
        ['public-action', 'switch'].includes(action?.intent?.kind) &&
        action?.schedule?.mode === 'absolute' &&
        Number.isInteger(Number(action.schedule.frame))
    )
    .sort(
      (left, right) =>
        Number(left.schedule.frame) - Number(right.schedule.frame) ||
        String(left.id).localeCompare(String(right.id), 'en')
    )
    .at(-1);
  const previousBoundary = resolveGeneratedPreviousInputBoundary({
    previous,
    authority,
  });
  if (previousBoundary.reason) {
    return { ready: false, reason: previousBoundary.reason };
  }
  const earliestPressFrame =
    previousBoundary.releaseFrame == null
      ? 0
      : previousBoundary.releaseFrame + 1;
  const minimumExecutionFrame =
    earliestPressFrame + getConservativeChargedInputDelayFrames(frameRate);
  const startFrame = Math.max(
    Number(baseStartFrame) + (previous ? 1 : 0),
    minimumExecutionFrame,
    previousBoundary.gateFrame ?? 0
  );
  const scheduling = createVerifiedChargedInputScheduling({
    executionFrame: startFrame,
    earliestPressFrame,
    frameRate,
  });
  if (!scheduling.ready) {
    return { ready: false, reason: scheduling.reasons[0] };
  }
  return {
    ready: true,
    startFrame,
    physicalInput: {
      mode: 'hold',
      pressFrame: scheduling.pressFrame,
      releaseFrame: previousBoundary.releaseFrame,
      executionFrame: startFrame,
      authorityHash: authority.authorityHash,
      sourceKind: 'canonical-generated-charged-prehold',
    },
    semanticVariants: createGeneratedChargedSemanticVariants(authority),
  };
}

function createGeneratedChargedSemanticVariants(authority) {
  const composite = authority?.compositeChargingRelease;
  if (!composite) return [null];
  return (composite.effectiveTiers ?? []).map(tier => ({
    selectorIdentity: tier.tierIdentity,
    selectorKind: 'charging-release-frame',
    chargeTier: tier.chargeTier,
    mode: 'release',
    inputFrame: tier.representativeReleaseFrame,
    semanticName: tier.semanticName ?? tier.tierIdentity,
    sourceIdentity: authority.sourceIdentity,
  }));
}

function projectGeneratedActionSemanticVariant(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const publishedKeys = [
    'selectorIdentity',
    'selectorKind',
    'publicVariantIndex',
    'chargeTier',
    'inputFrame',
    'mode',
  ];
  return Object.fromEntries(
    publishedKeys
      .filter(key => Object.prototype.hasOwnProperty.call(value, key))
      .map(key => [key, value[key]])
  );
}

function resolveGeneratedPreviousInputBoundary({ previous, authority }) {
  if (!previous) {
    return { releaseFrame: null, gateFrame: null, reason: null };
  }
  const executionFrame = Number(previous.schedule?.frame);
  if (previous.intent?.actionKind !== 'charged-attack') {
    return {
      releaseFrame: executionFrame + 1,
      gateFrame: null,
      reason: null,
    };
  }
  const composite = authority?.compositeChargingRelease;
  if (composite) {
    const releaseInputFrame = Number(
      previous.intent?.semanticVariant?.inputFrame
    );
    const [startFrame, endFrame] = composite.sourceWrapperFrameDomain ?? [];
    if (
      previous.intent?.semanticVariant?.mode !== 'release' ||
      !Number.isInteger(releaseInputFrame) ||
      releaseInputFrame < Number(startFrame) ||
      releaseInputFrame >= Number(endFrame)
    ) {
      return {
        releaseFrame: null,
        gateFrame: null,
        reason: 'charged-input-previous-release-frame-unresolved',
      };
    }
    const releaseFrame = executionFrame + releaseInputFrame;
    return {
      releaseFrame,
      gateFrame: releaseFrame + Number(authority.staticReopenFrame),
      reason: null,
    };
  }
  return {
    releaseFrame: executionFrame + 1,
    gateFrame: executionFrame + Number(authority.staticReopenFrame),
    reason: null,
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
