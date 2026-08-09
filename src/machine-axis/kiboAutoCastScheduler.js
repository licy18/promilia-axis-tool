import generatedWorkbenchKiboActionCatalog from '../data/generated/workbench-kibo-action-catalog.json';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
} from '../data/verifiedCombatMechanicsPackage';
import { projectWorkbenchKiboActionCatalog } from '../data/workbenchKiboActionCatalog';
import { getActionSourceSequencePath } from '../domain/actionSourceSequence';
import { ACTION_TYPES } from '../domain/projectSchema';
import {
  createVerifiedKiboAutoCastDerivation,
  VERIFIED_KIBO_AUTO_CAST_GENERATION_CONTRACT,
  VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
} from '../domain/verifiedBackgroundActionDerivation';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';
import { createVerifiedSwitchExitTailPolicy } from '../simulation/generation/verifiedSwitchExitTailPolicy';

const AUTO_CAST_KINDS = new Set(['normal-attack', 'active']);
const USER_KIBO_ACTION_KINDS = new Set(['signature', 'break']);
const UNCONDITIONAL_TRIGGER_TAG = '0';
const VERIFIED_CATALOG_SOURCE_ID = 'public-kibo-action-catalog';
const VERIFIED_CATALOG = projectWorkbenchKiboActionCatalog(
  generatedWorkbenchKiboActionCatalog
);
const VERIFIED_CATALOG_BY_ID = new Map(
  VERIFIED_CATALOG.items.map(item => [Number(item.kiboId), item])
);
const VERIFIED_CATALOG_HASH = hashKiboCatalogById(VERIFIED_CATALOG_BY_ID);
const authoritativeGenerations = new WeakSet();

export function isAuthoritativeKiboAutoCastGeneration(value) {
  return (
    value != null &&
    authoritativeGenerations.has(value) &&
    value.contractName === VERIFIED_KIBO_AUTO_CAST_GENERATION_CONTRACT &&
    value.generationHash ===
      hashCanonicalValue(projectKiboAutoCastGeneration(value))
  );
}

/**
 * Backwards-compatible action-only facade.  Compilation authority lives on
 * createKiboAutoCastGeneration().derivationGeneration and is intentionally
 * not recoverable from the returned action JSON alone.
 */
export function expandKiboAutoCastActions(contract, options = {}) {
  return createKiboAutoCastGeneration(contract, options).actions;
}

/**
 * Canonical compiler entry point. Persisted projects contain only player
 * inputs; autonomous Kibo casts are regenerated here from the compiled
 * controlled-actor timeline and never trusted from project JSON.
 */
export function createCompiledProjectKiboAutoCastGeneration({
  actions = [],
  actors = [],
  team = null,
  initialRuntimeState = null,
  time = null,
} = {}) {
  const fps = positiveNumber(time?.fps, 60);
  const actorById = new Map(
    (actors ?? []).map(actor => [String(actor.id ?? ''), actor])
  );
  const slotByActorId = new Map(
    (team?.slots ?? []).map(slot => [String(slot.actorId ?? ''), slot])
  );
  const machineTeam = (team?.slots ?? []).map((slot, position) => {
    const actor = actorById.get(String(slot.actorId ?? ''));
    return {
      slotId: String(slot.slotId ?? `team-slot-${position + 1}`),
      actorId: actor?.id == null ? null : String(actor.id),
      characterId: Number(actor?.characterId ?? slot.characterId),
      loadout: structuredClone(actor?.loadout ?? {}),
    };
  });
  const machineActions = (actions ?? []).map((action, index) => {
    const ownerSlot = slotByActorId.get(String(action.actorId ?? ''));
    const sourceSequencePath = getActionSourceSequencePath(action, index) ?? [
      index,
    ];
    return {
      id: String(action.id),
      owner: {
        kind: action.type === ACTION_TYPES.KIBO_EVENT ? 'kibo' : 'actor',
        slotId: ownerSlot?.slotId == null ? null : String(ownerSlot.slotId),
      },
      intent:
        action.type === ACTION_TYPES.SWITCH
          ? {
              kind: 'switch',
              targetSlotId:
                slotByActorId.get(String(action.targetActorId ?? ''))?.slotId ??
                null,
            }
          : {
              kind: 'public-action',
              publicActionId: Number(action.skillId) || null,
              actionKind:
                action.eventType ?? action.actionKind ?? action.type ?? null,
            },
      schedule: {
        mode: 'absolute',
        frame: msToFrame(action.startMs, fps),
        offsetFrames: 0,
      },
      sourceSequencePath,
      sourceSequenceSource:
        action.sourceSequenceSource == null
          ? null
          : String(action.sourceSequenceSource),
    };
  });
  const generation = createKiboAutoCastGeneration(
    {
      scenario: {
        team: machineTeam,
        durationFrames: msToFrame(time?.durationMs, fps),
        initialRuntimeState,
      },
      actions: machineActions,
    },
    {
      kiboCatalogById: VERIFIED_CATALOG_BY_ID,
      resolvedSchedulesByActionId: new Map(
        machineActions.map(action => [
          String(action.id),
          Number(action.schedule.frame),
        ])
      ),
      canonicalSlotIdByMachineSlotId: new Map(
        machineTeam.map(slot => [String(slot.slotId), String(slot.slotId)])
      ),
      fps,
    }
  );
  const projectActions = generation.generatedActions.map(machineAction => {
    const sourceRule = machineAction.autoCastRule;
    const catalogAction = VERIFIED_CATALOG_BY_ID.get(
      Number(sourceRule.kiboId)
    )?.actions?.find(
      item =>
        Number(item.skillId) === Number(sourceRule.publicActionId) &&
        String(item.kind) === String(sourceRule.actionKind)
    );
    return {
      id: String(machineAction.id),
      type: ACTION_TYPES.KIBO_EVENT,
      actorId: sourceRule.ownerActorId ?? null,
      kiboId: Number(sourceRule.kiboId),
      skillId: Number(sourceRule.publicActionId),
      eventType: String(sourceRule.actionKind),
      actionKind: String(sourceRule.actionKind),
      name: catalogAction?.name ?? `Kibo ${sourceRule.publicActionId}`,
      startMs: (Number(sourceRule.scheduledFrame) * 1000) / fps,
      durationMs:
        ((positiveInteger(catalogAction?.durationFrames) ?? 1) * 1000) / fps,
      durationFrames: positiveInteger(catalogAction?.durationFrames) ?? 1,
      sourceSequenceIndex: sourceRule.sourceSequencePath?.[0] ?? null,
      sourceSequencePath: structuredClone(sourceRule.sourceSequencePath),
      sourceSequenceSource: sourceRule.sourceSequenceSource,
      autoCast: true,
      autoCastRule: structuredClone(sourceRule),
      hitOverrides: {},
      note: machineAction.note,
      readOnly: true,
    };
  });
  return {
    ...generation,
    projectActions,
  };
}

/**
 * Generates Kibo normal/active casts only while the owning actor is the
 * controlled actor.  Source actions and switches use their resolved Machine
 * Axis frames plus input-array source order; generated casts are appended and
 * therefore observe every source switch at the same frame.
 */
export function createKiboAutoCastGeneration(
  contract,
  {
    kiboCatalogById,
    resolvedSchedulesByActionId = null,
    canonicalSlotIdByMachineSlotId = null,
    fps = 60,
  } = {}
) {
  const sourceActions = Array.isArray(contract?.actions)
    ? contract.actions
    : [];
  const team = contract?.scenario?.team ?? [];
  const horizonFrames = Number(contract?.scenario?.durationFrames) || 0;
  const resolvedCatalogById =
    kiboCatalogById instanceof Map ? kiboCatalogById : VERIFIED_CATALOG_BY_ID;
  const mechanicsPackage = getInstalledVerifiedCombatMechanicsPackage();
  const catalog = createCatalogAuthority({
    kiboCatalogById: resolvedCatalogById,
    mechanicsPackage,
  });
  const scheduleByActionId = normalizeScheduleMap(
    sourceActions,
    resolvedSchedulesByActionId
  );
  const controlled = createControlledKiboTimeline({
    contract,
    scheduleByActionId,
  });
  const issues = [...controlled.issues];
  const generatedSequenceRoot = resolveGeneratedSequenceRoot(sourceActions);
  if (generatedSequenceRoot == null) {
    issues.push(
      schedulerIssue(
        'kibo-auto-cast-source-sequence-space-exhausted',
        'actions[*].sourceSequencePath',
        'Compiler cannot append an unambiguous autonomous Kibo source sequence'
      )
    );
  }
  const schedulerInputHash = hashCanonicalValue({
    schemaVersion: 1,
    horizonFrames,
    fps,
    team: team.map(slot => ({
      slotId: String(slot.slotId),
      actorId: slot.actorId == null ? null : String(slot.actorId),
      characterId: Number(slot.characterId),
      kiboId: Number(slot.loadout?.kiboId) || null,
      canonicalSlotId:
        canonicalSlotIdByMachineSlotId?.get?.(String(slot.slotId)) ??
        String(slot.slotId),
    })),
    initialActorId: controlled.initialActorId,
    sourceActions: sourceActions.map((action, index) => ({
      id: String(action.id),
      index,
      owner: action.owner,
      intent: action.intent,
      frame: scheduleByActionId.get(String(action.id)) ?? null,
      sourceSequencePath: normalizeSourceSequencePath(
        action.sourceSequencePath,
        index
      ),
      sourceSequenceSource: action.sourceSequenceSource ?? null,
    })),
    generatedSequenceRoot,
    mechanicsPackage: mechanicsPackage
      ? {
          packageId: mechanicsPackage.packageId,
          packageHash: mechanicsPackage.packageHash,
        }
      : null,
    catalog,
  });

  if (!(horizonFrames > 0)) {
    const derivationGeneration = createGeneration({
      mechanicsPackage,
      catalog,
      schedulerInputHash,
      controlled,
      entries: [],
      issues,
      triggerExclusions: [],
    });
    return {
      actions: sourceActions,
      generatedActions: [],
      derivationGeneration,
      controlledTimeline: controlled.projection,
      triggerExclusions: [],
      issues,
    };
  }

  const controlledUserActionsBySlot = new Map();
  for (const [index, action] of sourceActions.entries()) {
    if (action?.owner?.kind !== 'kibo') continue;
    if (!USER_KIBO_ACTION_KINDS.has(String(action.intent?.actionKind ?? ''))) {
      continue;
    }
    const slotId = String(action.owner.slotId ?? '');
    const frame = scheduleByActionId.get(String(action.id));
    if (!slotId || frame == null) continue;
    if (controlled.slotBeforeActionId[String(action.id)] !== slotId) continue;
    const rows = controlledUserActionsBySlot.get(slotId) ?? [];
    rows.push({ ...action, resolvedFrame: frame, sourceIndex: index });
    controlledUserActionsBySlot.set(slotId, rows);
  }

  const generated = [];
  const entries = [];
  const triggerExclusions = [];
  const schedulerStateBySlot = new Map();
  const slotById = new Map(team.map(slot => [String(slot.slotId), slot]));
  for (const interval of controlled.intervals) {
    if (!(interval.endFrame > interval.startFrame)) continue;
    const slot = slotById.get(interval.slotId);
    const kiboId = Number(slot?.loadout?.kiboId);
    if (!Number.isInteger(kiboId) || kiboId <= 0) continue;
    const kibo = resolvedCatalogById.get(kiboId);
    if (!kibo) continue;
    const userActions = controlledUserActionsBySlot.get(interval.slotId) ?? [];
    const declaredAutoSkills = (kibo.actions ?? []).filter(action =>
      AUTO_CAST_KINDS.has(String(action.kind))
    );
    const autoSkills = declaredAutoSkills.filter(
      action =>
        String(action.petSkillLogicTag ?? '') === UNCONDITIONAL_TRIGGER_TAG
    );
    for (const action of declaredAutoSkills) {
      if (autoSkills.includes(action)) continue;
      triggerExclusions.push({
        code: 'kibo-auto-cast-trigger-unresolved',
        ownerActorId: interval.actorId,
        ownerSlotId: interval.slotId,
        kiboId,
        publicActionId: Number(action.skillId),
        actionKind: String(action.kind),
        triggerTag: String(action.petSkillLogicTag ?? ''),
        controlledIntervalIdentity: interval.identity,
        controlledIntervalStartFrame: interval.startFrame,
        controlledIntervalEndFrame: interval.endFrame,
        disposition: 'not-generated-without-closed-trigger',
      });
    }
    if (autoSkills.length === 0) continue;
    const skillByAction = new Map(
      (kibo.actions ?? []).map(action => [
        `${Number(action.skillId)}|${action.kind}`,
        action,
      ])
    );
    const state =
      schedulerStateBySlot.get(interval.slotId) ?? createSchedulerState();
    schedulerStateBySlot.set(interval.slotId, state);
    scheduleKiboAutoCastsInInterval({
      kiboId,
      slot,
      canonicalSlotId:
        canonicalSlotIdByMachineSlotId?.get?.(String(slot.slotId)) ??
        String(slot.slotId),
      interval,
      autoSkills,
      userActions,
      skillByAction,
      fps,
      mechanicsPackage,
      catalog,
      state,
      generatedSequenceRoot,
      generated,
      entries,
    });
  }

  const evidenceClosed =
    catalog.evidenceClosed === true &&
    mechanicsPackage != null &&
    triggerExclusions.length === 0 &&
    entries.every(entry => entry.evidenceStatus === 'static-evidence-closed');
  const derivationGeneration = createGeneration({
    mechanicsPackage,
    catalog,
    schedulerInputHash,
    controlled,
    entries,
    issues,
    triggerExclusions,
    evidenceClosed,
  });
  return {
    actions: generated.length
      ? [...sourceActions, ...generated]
      : sourceActions,
    generatedActions: generated,
    derivationGeneration,
    controlledTimeline: controlled.projection,
    triggerExclusions,
    issues,
  };
}

function createGeneration({
  mechanicsPackage,
  catalog,
  schedulerInputHash,
  controlled,
  entries,
  issues,
  triggerExclusions = [],
  evidenceClosed = false,
}) {
  const value = {
    status: issues.length
      ? 'kibo-auto-cast-generation-invalid'
      : evidenceClosed
        ? 'kibo-auto-cast-generation-ready'
        : 'kibo-auto-cast-generation-ready-with-open-evidence',
    evidenceStatus: evidenceClosed
      ? 'static-evidence-closed'
      : 'scheduler-evidence-open',
    mechanicsPackage: mechanicsPackage
      ? {
          packageId: mechanicsPackage.packageId,
          packageHash: mechanicsPackage.packageHash,
        }
      : { packageId: null, packageHash: null },
    catalog,
    schedulerInputHash,
    controlledTimeline: controlled.projection,
    entries,
    triggerExclusions,
    issues,
    summary: {
      generatedActionCount: entries.length,
      controlledIntervalCount: controlled.intervals.length,
      controlledTransitionCount: controlled.transitions.length,
      controlledRejectedActionCount: controlled.rejections?.length ?? 0,
      triggerExclusionCount: triggerExclusions.length,
      issueCount: issues.length,
    },
  };
  const projection = {
    schemaVersion: 1,
    contractName: VERIFIED_KIBO_AUTO_CAST_GENERATION_CONTRACT,
    sourceKind: 'azpr-controlled-kibo-auto-cast-scheduler',
    status: String(value.status),
    evidenceStatus: String(value.evidenceStatus),
    mechanicsPackage: structuredClone(value.mechanicsPackage),
    catalog: structuredClone(value.catalog),
    schedulerInputHash: String(value.schedulerInputHash),
    controlledTimeline: structuredClone(value.controlledTimeline),
    entries: value.entries.map(entry => structuredClone(entry)),
    triggerExclusions: value.triggerExclusions.map(entry =>
      structuredClone(entry)
    ),
    issues: value.issues.map(issue => structuredClone(issue)),
    summary: structuredClone(value.summary),
  };
  const generation = deepFreeze({
    ...projection,
    generationHash: hashCanonicalValue(projection),
  });
  authoritativeGenerations.add(generation);
  return generation;
}

function scheduleKiboAutoCastsInInterval({
  kiboId,
  slot,
  canonicalSlotId,
  interval,
  autoSkills,
  userActions,
  skillByAction,
  fps,
  mechanicsPackage,
  catalog,
  state,
  generatedSequenceRoot,
  generated,
  entries,
}) {
  const busyWindows = userActions
    .map(action => {
      const skill = skillByAction.get(
        `${Number(action.intent?.publicActionId)}|${action.intent?.actionKind}`
      );
      return {
        start: Math.max(0, Number(action.resolvedFrame) || 0),
        duration: positiveInteger(skill?.durationFrames) ?? 0,
        catalog: skill,
      };
    })
    .filter(
      window =>
        window.duration > 0 &&
        window.start >= interval.startFrame &&
        window.start < interval.endFrame
    )
    .sort(
      (left, right) =>
        left.start - right.start || right.duration - left.duration
    );
  const skills = [...autoSkills]
    .sort((left, right) => {
      const priority = { active: 0, 'normal-attack': 1 };
      return (priority[left.kind] ?? 2) - (priority[right.kind] ?? 2);
    })
    .map(skill => ({
      kind: String(skill.kind),
      skillId: Number(skill.skillId),
      mapping: getVerifiedCombatActionMapping({
        type: 'kiboEvent',
        kiboId,
        skillId: Number(skill.skillId),
        actionKind: String(skill.kind),
        actor: {
          characterId: Number(slot.characterId),
          loadout: { kiboId },
        },
      }),
      durationFrames: positiveInteger(skill.durationFrames) ?? 1,
      cooldownFrames: msToFrames(skill.cooldownMs, fps),
      selfCooldownFrames: msToFrames(skill.selfCooldownMs, fps),
      selfCooldownGroup: positiveInteger(skill.selfCooldownGroup) ?? null,
      gcdFrames: msToFrames(skill.gcdMs, fps),
      triggerTag: String(skill.petSkillLogicTag ?? ''),
    }))
    .map(skill => ({
      ...skill,
      durationFrames:
        positiveInteger(
          skill.mapping?.actionTiming?.occupancy?.durationFrames
        ) ?? skill.durationFrames,
    }));

  let frame = interval.startFrame;
  while (frame < interval.endFrame) {
    const busy = busyWindows.find(
      window => frame >= window.start && frame < window.start + window.duration
    );
    if (busy) {
      const locks = applyCastLocks(busy.catalog, busy.start, {
        nextReadyBySkillId: state.nextReadyBySkillId,
        selfGroupLockUntil: state.selfGroupLockUntil,
        fps,
      });
      state.gcdLockUntil = Math.max(state.gcdLockUntil, locks.gcdLockUntil);
      frame = Math.min(interval.endFrame, busy.start + busy.duration);
      continue;
    }
    const nextBusyStart =
      busyWindows
        .map(window => window.start)
        .filter(start => start > frame)
        .sort((left, right) => left - right)[0] ??
      (interval.endReason === 'switch'
        ? Number.POSITIVE_INFINITY
        : interval.endFrame);
    const candidate = skills.find(skill => {
      const ready =
        frame >= (state.nextReadyBySkillId.get(skill.skillId) ?? 0) &&
        (skill.selfCooldownGroup == null ||
          frame >=
            (state.selfGroupLockUntil.get(skill.selfCooldownGroup) ?? 0)) &&
        frame >= state.gcdLockUntil;
      return (
        ready &&
        frame + skill.durationFrames <= nextBusyStart &&
        (interval.endReason === 'switch'
          ? frame < interval.endFrame
          : frame + skill.durationFrames <= interval.endFrame)
      );
    });
    if (!candidate) {
      frame += 1;
      continue;
    }

    state.sequence += 1;
    const actionId = `kibo-${kiboId}-${slot.slotId}-auto-${candidate.kind}-${state.sequence}`;
    const trigger =
      candidate.triggerTag === UNCONDITIONAL_TRIGGER_TAG
        ? 'unconditional'
        : 'event-triggered';
    const mapping = candidate.mapping;
    const mappingClosed =
      mapping != null &&
      mapping.ownerKind === 'kibo' &&
      Number(mapping.ownerId) === kiboId &&
      AUTO_CAST_KINDS.has(String(mapping.actionKind));
    if (generatedSequenceRoot == null) break;
    const sourceSequencePath = [generatedSequenceRoot, generated.length];
    const tailPolicy =
      interval.endReason === 'switch'
        ? createVerifiedSwitchExitTailPolicy({
            ownerKind: 'kibo',
            actionId,
            ownerActorId: interval.actorId,
            actionStartFrame: frame,
            actionDurationFrames: candidate.durationFrames,
            actionSourceSequencePath: sourceSequencePath,
            mapping,
            mechanicsPackage,
            switchActionId: interval.exitTransitionId,
            switchBoundaryFrame: interval.endFrame,
            switchBoundarySourceSequencePath:
              interval.exitTransitionSourceSequencePath,
            switchToActorId: interval.exitTransitionToActorId,
          })
        : {
            status: 'not-crossing-switch-boundary',
            evidenceClosed: true,
            switchBoundaryFrame: null,
            packetEvidence: [],
            policyHash: null,
          };
    const evidenceStatus =
      candidate.triggerTag === UNCONDITIONAL_TRIGGER_TAG &&
      catalog.evidenceClosed === true &&
      mappingClosed &&
      mechanicsPackage != null &&
      tailPolicy.evidenceClosed === true
        ? 'static-evidence-closed'
        : 'planner-simplified';
    const ownerActorId = interval.actorId;
    const autoCastRule = createVerifiedKiboAutoCastDerivation({
      actionId,
      slotId: String(slot.slotId),
      canonicalSlotId,
      ownerActorId,
      ownerCharacterId: Number(slot.characterId),
      kiboId,
      publicActionId: candidate.skillId,
      actionKind: candidate.kind,
      scheduledFrame: frame,
      sequenceIndex: state.sequence,
      sourceSequencePath,
      sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
      controlledIntervalIdentity: interval.identity,
      controlledIntervalStartFrame: interval.startFrame,
      controlledIntervalEndFrame: interval.endFrame,
      switchExitTailStatus: tailPolicy.status,
      switchBoundaryFrame: tailPolicy.switchBoundaryFrame,
      switchTransitionId: interval.exitTransitionId,
      switchBoundarySourceSequencePath:
        interval.exitTransitionSourceSequencePath,
      switchExitTailPolicyHash: tailPolicy.policyHash,
      mappingIdentity: mapping?.identity ?? null,
      mechanicsPackageId: mechanicsPackage?.packageId ?? null,
      mechanicsPackageHash: mechanicsPackage?.packageHash ?? null,
      catalogHash: catalog.catalogHash,
      trigger,
      triggerTag: candidate.triggerTag || null,
      evidenceStatus,
    });
    const generatedAction = {
      id: actionId,
      owner: { kind: 'kibo', slotId: String(slot.slotId) },
      intent: {
        kind: 'public-action',
        publicActionId: candidate.skillId,
        actionKind: candidate.kind,
        level: 1,
        autoCast: true,
      },
      schedule: { mode: 'absolute', frame, offsetFrames: 0 },
      note: 'kibo-auto-cast',
      autoCast: true,
      autoCastRule,
      hitOverrides: {},
    };
    generated.push(generatedAction);
    entries.push({
      actionId,
      sourceIdentity: autoCastRule.sourceIdentity,
      derivationHash: autoCastRule.derivationHash,
      ownerSlotId: String(slot.slotId),
      canonicalOwnerSlotId: String(canonicalSlotId),
      ownerActorId,
      ownerCharacterId: Number(slot.characterId),
      kiboId,
      publicActionId: candidate.skillId,
      actionKind: candidate.kind,
      scheduledFrame: frame,
      sequenceIndex: state.sequence,
      sourceSequencePath,
      sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
      controlledIntervalIdentity: interval.identity,
      controlledIntervalStartFrame: interval.startFrame,
      controlledIntervalEndFrame: interval.endFrame,
      switchExitTailStatus: tailPolicy.status,
      switchBoundaryFrame: tailPolicy.switchBoundaryFrame,
      switchTransitionId: interval.exitTransitionId,
      switchBoundarySourceSequencePath:
        interval.exitTransitionSourceSequencePath,
      switchExitTailPolicyHash: tailPolicy.policyHash,
      tailPacketEvidence: tailPolicy.packetEvidence,
      mappingIdentity: mapping?.identity ?? null,
      mechanicsPackageId: mechanicsPackage?.packageId ?? null,
      mechanicsPackageHash: mechanicsPackage?.packageHash ?? null,
      catalogHash: catalog.catalogHash,
      trigger,
      triggerTag: candidate.triggerTag || null,
      evidenceStatus,
    });
    state.nextReadyBySkillId.set(
      candidate.skillId,
      frame + candidate.cooldownFrames
    );
    if (candidate.selfCooldownGroup != null) {
      state.selfGroupLockUntil.set(
        candidate.selfCooldownGroup,
        frame + candidate.selfCooldownFrames
      );
    }
    state.gcdLockUntil = Math.max(
      state.gcdLockUntil,
      frame + candidate.gcdFrames
    );
    frame += candidate.durationFrames;
  }
}

function createControlledKiboTimeline({ contract, scheduleByActionId }) {
  const team = contract?.scenario?.team ?? [];
  const horizonFrames = Number(contract?.scenario?.durationFrames) || 0;
  const sourceActions = contract?.actions ?? [];
  const slotById = new Map(team.map(slot => [String(slot.slotId), slot]));
  const slotByCharacterId = new Map(
    team.map(slot => [Number(slot.characterId), slot])
  );
  const actorIdBySlotId = new Map(
    team.map(slot => [
      String(slot.slotId),
      slot.actorId == null
        ? `actor-${Number(slot.characterId)}`
        : String(slot.actorId),
    ])
  );
  const initial = contract?.scenario?.initialRuntimeState?.controlledActor;
  let controlledSlot =
    (initial?.characterId != null
      ? slotByCharacterId.get(Number(initial.characterId))
      : null) ??
    (initial?.actorId != null
      ? team.find(
          slot =>
            actorIdBySlotId.get(String(slot.slotId)) === String(initial.actorId)
        )
      : null) ??
    team[0] ??
    null;
  const initialActorId = controlledSlot
    ? actorIdBySlotId.get(String(controlledSlot.slotId))
    : null;
  const slotBeforeActionId = {};
  const transitions = [];
  const rejections = [];
  const acceptedSwitchFrames = new Set();
  const ordered = sourceActions
    .map((action, index) => ({
      action,
      index,
      frame: scheduleByActionId.get(String(action.id)),
      sourceSequencePath: normalizeSourceSequencePath(
        action.sourceSequencePath,
        index
      ),
    }))
    .filter(row => row.frame != null)
    .sort(
      (left, right) =>
        left.frame - right.frame ||
        compareSourceSequencePaths(
          left.sourceSequencePath,
          right.sourceSequencePath
        )
    );
  for (const row of ordered) {
    const actionId = String(row.action.id);
    slotBeforeActionId[actionId] = controlledSlot?.slotId ?? null;
    if (row.action.intent?.kind !== 'switch') continue;
    if (acceptedSwitchFrames.has(row.frame)) {
      rejections.push(
        schedulerIssue(
          'kibo-controlled-timeline-switch-frame-conflict',
          `actions.${row.index}`,
          `Multiple switch inputs share frame ${row.frame}`,
          { actionId, frame: row.frame }
        )
      );
      continue;
    }
    acceptedSwitchFrames.add(row.frame);
    if (
      String(row.action.owner?.slotId ?? '') !==
      String(controlledSlot?.slotId ?? '')
    ) {
      rejections.push(
        schedulerIssue(
          'kibo-controlled-timeline-switch-source-not-controlled',
          `actions.${row.index}.owner.slotId`,
          `Switch ${actionId} is not owned by the controlled slot`,
          { actionId, frame: row.frame }
        )
      );
      continue;
    }
    const targetSlot = slotById.get(String(row.action.intent.targetSlotId));
    if (!targetSlot || targetSlot === controlledSlot) {
      rejections.push(
        schedulerIssue(
          'kibo-controlled-timeline-switch-target-invalid',
          `actions.${row.index}.intent.targetSlotId`,
          `Switch ${actionId} has no valid target slot`,
          { actionId, frame: row.frame }
        )
      );
      continue;
    }
    const transition = {
      switchActionId: actionId,
      frame: row.frame,
      sourceSequencePath: row.sourceSequencePath,
      fromActorId: actorIdBySlotId.get(String(controlledSlot.slotId)),
      toActorId: actorIdBySlotId.get(String(targetSlot.slotId)),
      fromSlotId: String(controlledSlot.slotId),
      toSlotId: String(targetSlot.slotId),
    };
    transitions.push(transition);
    controlledSlot = targetSlot;
  }
  const intervals = createControlledIntervals({
    initialSlot: team.find(
      slot => actorIdBySlotId.get(String(slot.slotId)) === initialActorId
    ),
    transitions,
    horizonFrames,
    actorIdBySlotId,
  });
  const projectedTransitions = transitions.map(transition => ({
    switchActionId: transition.switchActionId,
    frame: transition.frame,
    sourceSequencePath: transition.sourceSequencePath,
    fromActorId: transition.fromActorId,
    toActorId: transition.toActorId,
  }));
  return {
    initialActorId,
    slotBeforeActionId,
    transitions: projectedTransitions,
    intervals,
    issues: [],
    rejections,
    projection: {
      initialActorId,
      transitions: projectedTransitions,
      intervals: intervals.map(interval => ({ ...interval })),
      rejections: rejections.map(rejection => ({ ...rejection })),
      timelineHash: hashCanonicalValue({
        initialActorId,
        transitions: projectedTransitions,
        rejections,
      }),
    },
  };
}

function createControlledIntervals({
  initialSlot,
  transitions,
  horizonFrames,
  actorIdBySlotId,
}) {
  if (!initialSlot) return [];
  const intervals = [];
  let currentSlotId = String(initialSlot.slotId);
  let startFrame = 0;
  let sourceTransitionId = 'initial-controlled-actor';
  for (const transition of transitions) {
    if (transition.frame > startFrame) {
      intervals.push(
        controlledInterval({
          slotId: currentSlotId,
          actorId: actorIdBySlotId.get(currentSlotId),
          startFrame,
          endFrame: transition.frame,
          sourceTransitionId,
          endReason: 'switch',
          exitTransitionId: transition.switchActionId,
          exitTransitionSourceSequencePath: transition.sourceSequencePath,
          exitTransitionToActorId: transition.toActorId,
        })
      );
    }
    currentSlotId = transition.toSlotId;
    startFrame = transition.frame;
    sourceTransitionId = transition.switchActionId;
  }
  if (horizonFrames > startFrame) {
    intervals.push(
      controlledInterval({
        slotId: currentSlotId,
        actorId: actorIdBySlotId.get(currentSlotId),
        startFrame,
        endFrame: horizonFrames,
        sourceTransitionId,
        endReason: 'horizon',
        exitTransitionId: null,
        exitTransitionSourceSequencePath: null,
        exitTransitionToActorId: null,
      })
    );
  }
  return intervals;
}

function controlledInterval({
  slotId,
  actorId,
  startFrame,
  endFrame,
  sourceTransitionId,
  endReason,
  exitTransitionId,
  exitTransitionSourceSequencePath,
  exitTransitionToActorId,
}) {
  return {
    identity: [
      'controlled-kibo-interval-v1',
      slotId,
      actorId,
      startFrame,
      endFrame,
      sourceTransitionId,
    ].join(':'),
    slotId,
    actorId,
    startFrame,
    endFrame,
    interval: '[startFrame,endFrame)',
    sourceTransitionId,
    endReason,
    exitTransitionId,
    exitTransitionSourceSequencePath,
    exitTransitionToActorId,
  };
}

function createCatalogAuthority({ kiboCatalogById, mechanicsPackage }) {
  const sourceFile = (mechanicsPackage?.sourceFiles ?? []).find(
    file => file.id === VERIFIED_CATALOG_SOURCE_ID
  );
  const catalogHash = hashKiboCatalogById(kiboCatalogById);
  const evidenceClosed =
    mechanicsPackage != null &&
    sourceFile != null &&
    catalogHash === VERIFIED_CATALOG_HASH;
  return {
    status: evidenceClosed
      ? 'installed-verified-kibo-catalog-bound'
      : 'kibo-catalog-authority-open',
    evidenceClosed,
    catalogHash,
    expectedCatalogHash: VERIFIED_CATALOG_HASH,
    sourceFileId: sourceFile?.id ?? VERIFIED_CATALOG_SOURCE_ID,
    sourceIdentity: sourceFile?.sourceIdentity ?? null,
    sourceSha256: sourceFile?.sha256 ?? null,
    sourceBytes: sourceFile?.bytes ?? null,
  };
}

function hashKiboCatalogById(value) {
  if (!(value instanceof Map)) return null;
  return hashCanonicalValue(
    [...value.values()]
      .map(item => structuredClone(item))
      .sort((left, right) => Number(left.kiboId) - Number(right.kiboId))
  );
}

function normalizeScheduleMap(sourceActions, value) {
  const result = new Map();
  for (const action of sourceActions) {
    const external =
      value instanceof Map
        ? (value.get(String(action.id)) ?? value.get(action.id))
        : value?.[action.id];
    const externalFrame = Number(external?.startFrame ?? external);
    const absoluteFrame = Number(action.schedule?.frame);
    if (Number.isInteger(externalFrame) && externalFrame >= 0) {
      result.set(String(action.id), externalFrame);
    } else if (
      action.schedule?.mode === 'absolute' &&
      Number.isInteger(absoluteFrame) &&
      absoluteFrame >= 0
    ) {
      result.set(String(action.id), absoluteFrame);
    }
  }
  return result;
}

function createSchedulerState() {
  return {
    nextReadyBySkillId: new Map(),
    selfGroupLockUntil: new Map(),
    gcdLockUntil: 0,
    sequence: 0,
  };
}

function applyCastLocks(
  catalog,
  castFrame,
  { nextReadyBySkillId, selfGroupLockUntil, fps }
) {
  const skillId = Number(catalog?.skillId);
  if (Number.isInteger(skillId) && skillId > 0) {
    nextReadyBySkillId.set(
      skillId,
      Math.max(
        nextReadyBySkillId.get(skillId) ?? 0,
        castFrame + msToFrames(catalog.cooldownMs, fps)
      )
    );
  }
  const group = positiveInteger(catalog?.selfCooldownGroup);
  if (group != null) {
    selfGroupLockUntil.set(
      group,
      Math.max(
        selfGroupLockUntil.get(group) ?? 0,
        castFrame + msToFrames(catalog.selfCooldownMs, fps)
      )
    );
  }
  return { gcdLockUntil: castFrame + msToFrames(catalog?.gcdMs, fps) };
}

function msToFrames(ms, fps) {
  const normalized = Number(ms);
  return Number.isFinite(normalized) && normalized > 0
    ? Math.ceil((normalized / 1000) * fps)
    : 0;
}

function msToFrame(ms, fps) {
  const normalized = Number(ms);
  return Number.isFinite(normalized) && normalized >= 0
    ? Math.round((normalized / 1000) * fps)
    : 0;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeSourceSequencePath(value, fallbackIndex) {
  const source =
    Array.isArray(value) && value.length > 0 ? value : [fallbackIndex];
  const normalized = source.map(Number);
  return normalized.every(entry => Number.isInteger(entry) && entry >= 0)
    ? normalized
    : [fallbackIndex];
}

function resolveGeneratedSequenceRoot(sourceActions) {
  const maximumRoot = (sourceActions ?? []).reduce((maximum, action, index) => {
    const path = normalizeSourceSequencePath(action?.sourceSequencePath, index);
    return Math.max(maximum, path[0]);
  }, -1);
  return maximumRoot < Number.MAX_SAFE_INTEGER ? maximumRoot + 1 : null;
}

function compareSourceSequencePaths(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function schedulerIssue(code, path, message, details = {}) {
  return { code, path, message, severity: 'error', ...details };
}

function projectKiboAutoCastGeneration(value) {
  return {
    schemaVersion: value.schemaVersion ?? null,
    contractName: value.contractName ?? null,
    sourceKind: value.sourceKind ?? null,
    status: value.status ?? null,
    evidenceStatus: value.evidenceStatus ?? null,
    mechanicsPackage: value.mechanicsPackage ?? null,
    catalog: value.catalog ?? null,
    schedulerInputHash: value.schedulerInputHash ?? null,
    controlledTimeline: value.controlledTimeline ?? null,
    entries: value.entries ?? [],
    triggerExclusions: value.triggerExclusions ?? [],
    issues: value.issues ?? [],
    summary: value.summary ?? null,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
