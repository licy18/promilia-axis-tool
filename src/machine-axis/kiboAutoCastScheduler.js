import generatedWorkbenchKiboActionCatalog from '../data/generated/workbench-kibo-action-catalog.json';
import { getInstalledVerifiedCombatMechanicsPackage } from '../data/verifiedCombatMechanicsPackage';
import { projectWorkbenchKiboActionCatalog } from '../data/workbenchKiboActionCatalog';
import { getActionSourceSequencePath } from '../domain/actionSourceSequence';
import { ACTION_TYPES } from '../domain/projectSchema';
import { VERIFIED_KIBO_AUTO_CAST_GENERATION_CONTRACT } from '../domain/verifiedBackgroundActionDerivation';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

const AUTO_CAST_KINDS = new Set(['normal-attack', 'active']);
const UNCONDITIONAL_TRIGGER_TAG = '0';
const KIBO_FOREGROUND_ELIGIBILITY_CONTRACT =
  'AzPrKiboForegroundAutoCastEligibility';
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
 * inputs. Compilation regenerates the controlled-owner eligibility evidence,
 * but it does not invent autonomous casts while the NodeCanvas schedule is
 * unresolved.
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
 * Projects foreground Kibo eligibility over the controlled-actor timeline.
 * Tag-0 proves that a skill belongs to the normal AI/behavior-tree surface; it
 * does not prove an initial frame, arbitration priority, or recast cadence.
 * Until those NodeCanvas inputs are sourced, no autonomous action is emitted.
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
  const eligibilityContract = createForegroundEligibilityContract({
    controlled,
    mechanicsPackage,
    catalog,
  });
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
    initialKiboVitals: projectInitialKiboVitals(
      contract?.scenario?.initialRuntimeState
    ),
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
    eligibilityContract,
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
      eligibilityContract,
      entries: [],
      issues,
      triggerExclusions: [],
      scheduleExclusions: [],
      evidenceClosed: eligibilityContract.evidenceClosed === true,
    });
    return {
      actions: sourceActions,
      generatedActions: [],
      derivationGeneration,
      controlledTimeline: controlled.projection,
      triggerExclusions: [],
      scheduleExclusions: [],
      issues,
    };
  }

  const triggerExclusions = [];
  const scheduleExclusions = [];
  const slotById = new Map(team.map(slot => [String(slot.slotId), slot]));
  for (const interval of controlled.intervals) {
    if (!(interval.endFrame > interval.startFrame)) continue;
    const slot = slotById.get(interval.slotId);
    const kiboId = Number(slot?.loadout?.kiboId);
    if (!Number.isInteger(kiboId) || kiboId <= 0) continue;
    if (
      !isInitiallyAliveKibo(
        contract?.scenario?.initialRuntimeState,
        interval.slotId,
        kiboId
      )
    ) {
      continue;
    }
    const kibo = resolvedCatalogById.get(kiboId);
    if (!kibo) continue;
    const declaredAutoSkills = (kibo.actions ?? []).filter(action =>
      AUTO_CAST_KINDS.has(String(action.kind))
    );
    for (const action of declaredAutoSkills) {
      const triggerTag = String(action.petSkillLogicTag ?? '');
      const exclusion = {
        ownerActorId: interval.actorId,
        ownerSlotId: interval.slotId,
        canonicalOwnerSlotId:
          canonicalSlotIdByMachineSlotId?.get?.(String(slot.slotId)) ??
          String(slot.slotId),
        ownerCharacterId: Number(slot.characterId),
        kiboId,
        publicActionId: Number(action.skillId),
        actionKind: String(action.kind),
        triggerTag,
        controlledIntervalIdentity: interval.identity,
        controlledIntervalStartFrame: interval.startFrame,
        controlledIntervalEndFrame: interval.endFrame,
        eligibilityContractHash: eligibilityContract.contractHash,
        eligibilityStatus: 'foreground-owner-eligibility-closed',
        requiresEquippedKibo: true,
        requiresKiboAlive: true,
      };
      if (triggerTag === UNCONDITIONAL_TRIGGER_TAG) {
        scheduleExclusions.push({
          code: 'kibo-auto-cast-schedule-unresolved',
          ...exclusion,
          scheduleEvidenceStatus:
            'nodecanvas-token-priority-cadence-source-open',
          disposition: 'not-generated-without-nodecanvas-schedule',
          leavesOpen: [
            'nodecanvas-behavior-tree-graph',
            'attack-and-skill-token-arbitration',
            'normal-vs-active-priority',
            'initial-delay-and-recast-cadence',
          ],
        });
      } else {
        triggerExclusions.push({
          code: 'kibo-auto-cast-trigger-unresolved',
          ...exclusion,
          disposition: 'not-generated-without-closed-trigger',
        });
      }
    }
  }
  triggerExclusions.sort(compareExclusions);
  scheduleExclusions.sort(compareExclusions);

  const evidenceClosed =
    eligibilityContract.evidenceClosed === true &&
    catalog.evidenceClosed === true &&
    mechanicsPackage != null &&
    triggerExclusions.length === 0 &&
    scheduleExclusions.length === 0;
  const derivationGeneration = createGeneration({
    mechanicsPackage,
    catalog,
    schedulerInputHash,
    controlled,
    eligibilityContract,
    entries: [],
    issues,
    triggerExclusions,
    scheduleExclusions,
    evidenceClosed,
  });
  return {
    actions: sourceActions,
    generatedActions: [],
    derivationGeneration,
    controlledTimeline: controlled.projection,
    triggerExclusions,
    scheduleExclusions,
    issues,
  };
}

function createGeneration({
  mechanicsPackage,
  catalog,
  schedulerInputHash,
  controlled,
  eligibilityContract,
  entries,
  issues,
  triggerExclusions = [],
  scheduleExclusions = [],
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
    eligibilityContract,
    entries,
    triggerExclusions,
    scheduleExclusions,
    issues,
    summary: {
      generatedActionCount: entries.length,
      controlledIntervalCount: controlled.intervals.length,
      controlledTransitionCount: controlled.transitions.length,
      controlledRejectedActionCount: controlled.rejections?.length ?? 0,
      triggerExclusionCount: triggerExclusions.length,
      scheduleExclusionCount: scheduleExclusions.length,
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
    eligibilityContract: structuredClone(value.eligibilityContract),
    entries: value.entries.map(entry => structuredClone(entry)),
    triggerExclusions: value.triggerExclusions.map(entry =>
      structuredClone(entry)
    ),
    scheduleExclusions: value.scheduleExclusions.map(entry =>
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

function createForegroundEligibilityContract({
  controlled,
  mechanicsPackage,
  catalog,
}) {
  const evidenceClosed =
    mechanicsPackage != null &&
    catalog?.evidenceClosed === true &&
    controlled?.issues?.length === 0;
  const projection = {
    schemaVersion: 1,
    contractName: KIBO_FOREGROUND_ELIGIBILITY_CONTRACT,
    sourceKind: 'azpr-controlled-kibo-ai-eligibility',
    status: evidenceClosed
      ? 'foreground-kibo-eligibility-closed'
      : 'foreground-kibo-eligibility-open',
    evidenceClosed,
    requirements: {
      ownerActorMustBeControlled: true,
      kiboMustMatchEquippedOwnerSlot: true,
      kiboMustExistAndBeAlive: true,
      rebornStateRejectsNewCast: true,
      controlledInterval: '[startFrame,endFrame)',
      switchBoundaryPolicy: 'old-owner-before-new-owner-after',
    },
    sourceEvidence: {
      targetRoute: 'controlled-hero-lock-target',
      ownerBinding: 'kibo-bound-hero-must-equal-controlled-hero',
      aiActivation: 'operate-hero-pet-ai-normal-pet-ai',
      scheduleScope: 'eligibility-only-nodecanvas-schedule-open',
    },
    mechanicsPackage: mechanicsPackage
      ? {
          packageId: mechanicsPackage.packageId,
          packageHash: mechanicsPackage.packageHash,
        }
      : { packageId: null, packageHash: null },
    catalogHash: catalog?.catalogHash ?? null,
    controlledTimelineHash: controlled?.projection?.timelineHash ?? null,
  };
  return deepFreeze({
    ...projection,
    contractHash: hashCanonicalValue(projection),
  });
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

function compareExclusions(left, right) {
  return (
    Number(left.controlledIntervalStartFrame) -
      Number(right.controlledIntervalStartFrame) ||
    String(left.ownerActorId ?? '').localeCompare(
      String(right.ownerActorId ?? '')
    ) ||
    String(left.ownerSlotId ?? '').localeCompare(
      String(right.ownerSlotId ?? '')
    ) ||
    Number(left.kiboId) - Number(right.kiboId) ||
    String(left.actionKind ?? '').localeCompare(
      String(right.actionKind ?? '')
    ) ||
    Number(left.publicActionId) - Number(right.publicActionId)
  );
}

function projectInitialKiboVitals(initialRuntimeState) {
  return (initialRuntimeState?.kiboVitalsBySlot ?? [])
    .map(value => ({
      slotId: value?.slotId == null ? null : String(value.slotId),
      kiboId: Number(value?.kiboId) || null,
      currentValue: finiteNumberOrNull(value?.currentValue ?? value?.currentHp),
      maxValue: finiteNumberOrNull(value?.maxValue ?? value?.maximumHp),
    }))
    .sort(
      (left, right) =>
        String(left.slotId ?? '').localeCompare(String(right.slotId ?? '')) ||
        Number(left.kiboId ?? 0) - Number(right.kiboId ?? 0)
    );
}

function isInitiallyAliveKibo(initialRuntimeState, slotId, kiboId) {
  const vital = (initialRuntimeState?.kiboVitalsBySlot ?? []).find(
    value =>
      String(value?.slotId ?? '') === String(slotId) &&
      Number(value?.kiboId) === Number(kiboId)
  );
  if (!vital) return true;
  const currentHp = finiteNumberOrNull(vital.currentValue ?? vital.currentHp);
  return currentHp == null || currentHp > 0;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
    eligibilityContract: value.eligibilityContract ?? null,
    entries: value.entries ?? [],
    triggerExclusions: value.triggerExclusions ?? [],
    scheduleExclusions: value.scheduleExclusions ?? [],
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
