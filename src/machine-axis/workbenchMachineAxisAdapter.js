import { ACTION_TYPES } from '../domain/projectSchema';
import { getInstalledVerifiedCombatMechanicsPackage } from '../data/verifiedCombatMechanicsPackage';
import { WORKBENCH_HEADLESS_COMBAT_CORE } from '../features/workbench/workbenchHeadlessCombatCore';
import {
  MACHINE_AXIS_CONTRACT_NAME,
  MACHINE_AXIS_SCHEMA_VERSION,
  MACHINE_AXIS_TRANSPORT_METADATA_KEY,
  normalizeMachineAxisContract,
  validateMachineAxisContract,
} from './machineAxisContract';
import {
  MachineAxisValidationError,
  createMachineAxisService,
} from './machineAxisService';

export const WORKBENCH_MACHINE_AXIS_ADAPTER_SCHEMA_VERSION = 1;
export const WORKBENCH_MACHINE_AXIS_ADAPTER_CONTRACT_NAME =
  'AzPrWorkbenchMachineAxisAdapter';

export function createWorkbenchMachineAxisAdapter({
  service = createMachineAxisService(),
  core = WORKBENCH_HEADLESS_COMBAT_CORE,
} = {}) {
  function importContract(machineAxis) {
    const prepared = service.prepare(machineAxis);
    if (!prepared.valid) throw new MachineAxisValidationError(prepared.issues);
    return {
      schemaVersion: WORKBENCH_MACHINE_AXIS_ADAPTER_SCHEMA_VERSION,
      contractName: WORKBENCH_MACHINE_AXIS_ADAPTER_CONTRACT_NAME,
      kind: 'azpr-machine-axis-workbench-import',
      contract: prepared.contract,
      project: prepared.project,
      actionResolutions: prepared.actionResolutions,
    };
  }

  function exportProject(project, options = {}) {
    const contract = createContractFromProject(project, {
      service,
      metadata: options.metadata,
    });
    const validation = validateMachineAxisContract(contract);
    if (!validation.valid) {
      throw new MachineAxisValidationError(validation.issues);
    }
    return validation.normalized;
  }

  function simulate(machineAxis, options = {}) {
    const imported = importContract(machineAxis);
    return core.simulate(
      { schemaVersion: 1, project: imported.project },
      options
    );
  }

  return Object.freeze({
    schemaVersion: WORKBENCH_MACHINE_AXIS_ADAPTER_SCHEMA_VERSION,
    contractName: WORKBENCH_MACHINE_AXIS_ADAPTER_CONTRACT_NAME,
    importContract,
    exportProject,
    simulate,
  });
}

export function importMachineAxisToWorkbenchProject(machineAxis, options = {}) {
  return createWorkbenchMachineAxisAdapter(options).importContract(machineAxis);
}

export function exportWorkbenchProjectToMachineAxis(project, options = {}) {
  return createWorkbenchMachineAxisAdapter(options).exportProject(
    project,
    options
  );
}

function createContractFromProject(project, { service, metadata } = {}) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new MachineAxisValidationError([
      diagnostic(
        'machine-axis-workbench-project-required',
        'project',
        'A Workbench project is required for Machine Axis export'
      ),
    ]);
  }
  const catalogIdentity = service.catalog().dataIdentity;
  const profileSelection = project.metadata?.mechanicsProfileSelection ?? {};
  const teamSlots = [...(project.team?.slots ?? [])].sort(
    (left, right) => Number(left.position ?? 0) - Number(right.position ?? 0)
  );
  const actorsByCharacterId = new Map(
    (project.actors ?? []).map(actor => [Number(actor.characterId), actor])
  );
  const slotsByActorId = new Map();
  const slotsByCharacterId = new Map();
  const team = teamSlots.map((slot, index) => {
    const actor = actorsByCharacterId.get(Number(slot.characterId));
    if (!actor) {
      throw new MachineAxisValidationError([
        diagnostic(
          'machine-axis-workbench-team-actor-missing',
          `project.team.slots.${index}`,
          `Workbench actor is missing for character ${slot.characterId}`
        ),
      ]);
    }
    slotsByActorId.set(String(actor.id), slot);
    slotsByCharacterId.set(Number(actor.characterId), slot);
    return {
      slotId: String(slot.slotId),
      characterId: Number(actor.characterId),
      level: positiveIntegerOrNull(actor.level),
      initialSp: finiteNumberOrNull(actor.initialSp),
      loadout: copyLoadout(actor.loadout),
      cultivation: copyPlainRecord(actor.cultivation),
    };
  });
  const fps = positiveIntegerOrNull(project.time?.fps) ?? 60;
  const preservedSchedules = resolvePreservedMachineAxisSchedules(project, fps);
  const actions = (project.actions ?? []).map((action, index) =>
    createMachineActionFromProject({
      action,
      index,
      fps,
      preservedSchedules,
      slotsByActorId,
      slotsByCharacterId,
    })
  );
  const enemy = project.enemy ?? {};
  return normalizeMachineAxisContract({
    schemaVersion: MACHINE_AXIS_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_CONTRACT_NAME,
    dataIdentity: {
      ...catalogIdentity,
      mechanicsProfileId:
        profileSelection.profileId ?? catalogIdentity.mechanicsProfileId,
      mechanicsProfileVersion:
        profileSelection.profileVersion ??
        catalogIdentity.mechanicsProfileVersion,
    },
    scenario: {
      id: String(project.id ?? 'workbench-machine-axis'),
      name: String(project.name ?? 'Workbench Machine Axis'),
      fps,
      durationFrames: frameFromMs(project.time?.durationMs, fps),
      team,
      enemy: {
        enemyId: positiveIntegerOrNull(enemy.enemyId),
        level: positiveIntegerOrNull(enemy.level),
        hpMultiplier: positiveNumberOrNull(enemy.hpMultiplier),
        defenseMultiplier: positiveNumberOrNull(enemy.defenseMultiplier),
        toughnessMultiplier: positiveNumberOrNull(enemy.toughnessMultiplier),
        initialToughnessRatio: finiteNumberOrNull(enemy.initialToughnessRatio),
        elementDefenseOverrides: copyPlainRecord(enemy.elementDefenseOverrides),
      },
      initialRuntimeState: copyPlainRecord(project.initialRuntimeState),
      projectile: {
        targetDistance:
          nonNegativeNumberOrNull(
            project.combatScenario?.projectile?.targetDistance
          ) ?? 0,
        defaultWillHit:
          project.combatScenario?.projectile?.defaultWillHit == null
            ? true
            : Boolean(project.combatScenario.projectile.defaultWillHit),
      },
      critical: {
        policy: project.combatScenario?.critical?.policy ?? 'non-critical',
        seed: project.combatScenario?.critical?.seed ?? null,
      },
    },
    actions,
    metadata: {
      source: 'workbench-project-export',
      sourceProjectId: String(project.id ?? ''),
      ...(copyPlainRecord(metadata) ?? {}),
    },
  });
}

function createMachineActionFromProject({
  action,
  index,
  fps,
  preservedSchedules,
  slotsByActorId,
  slotsByCharacterId,
}) {
  const startFrame =
    nonNegativeIntegerOrNull(action.startFrame) ??
    frameFromMs(action.startMs, fps, { allowZero: true });
  const base = {
    id: String(action.id ?? `machine-action-${index + 1}`),
    schedule: preservedSchedules?.[String(action.id)] ?? {
      mode: 'absolute',
      frame: startFrame,
    },
    hitOverrides: createMachineHitOverrides(action.hitOverrides),
    note: textOrNull(action.note),
  };
  if (action.type === ACTION_TYPES.WAIT) {
    return {
      ...base,
      owner: { kind: 'system', slotId: null },
      intent: {
        kind: 'wait',
        durationFrames: Math.max(1, frameFromMs(action.durationMs, fps)),
      },
    };
  }
  if (action.type === ACTION_TYPES.SWITCH) {
    const sourceSlot = resolveActionSlot(
      action,
      slotsByActorId,
      slotsByCharacterId
    );
    const targetSlot =
      slotsByActorId.get(String(action.targetActorId ?? '')) ??
      slotsByCharacterId.get(Number(action.targetCharacterId));
    if (!sourceSlot || !targetSlot) {
      throw new MachineAxisValidationError([
        diagnostic(
          'machine-axis-workbench-switch-slot-unresolved',
          `project.actions.${index}`,
          `Unable to resolve switch slots for ${base.id}`,
          { actionId: base.id }
        ),
      ]);
    }
    return {
      ...base,
      owner: { kind: 'actor', slotId: sourceSlot.slotId },
      intent: { kind: 'switch', targetSlotId: targetSlot.slotId },
    };
  }
  if (
    action.type !== ACTION_TYPES.SKILL &&
    action.type !== ACTION_TYPES.KIBO_EVENT
  ) {
    throw new MachineAxisValidationError([
      diagnostic(
        'machine-axis-workbench-action-unsupported',
        `project.actions.${index}.type`,
        `Workbench action type cannot be exported to Machine Axis: ${action.type}`,
        { actionId: base.id }
      ),
    ]);
  }
  const ownerSlot = resolveActionSlot(
    action,
    slotsByActorId,
    slotsByCharacterId
  );
  if (!ownerSlot) {
    throw new MachineAxisValidationError([
      diagnostic(
        'machine-axis-workbench-action-owner-unresolved',
        `project.actions.${index}.actorId`,
        `Unable to resolve owner slot for ${base.id}`,
        { actionId: base.id }
      ),
    ]);
  }
  const attackInputIndex = positiveIntegerOrNull(
    action.attackSequenceIndex ?? action.attackInput?.sequenceIndex
  );
  return {
    ...base,
    owner: {
      kind: action.type === ACTION_TYPES.KIBO_EVENT ? 'kibo' : 'actor',
      slotId: ownerSlot.slotId,
    },
    intent: {
      kind: 'public-action',
      publicActionId: positiveIntegerOrNull(action.skillId),
      actionKind: textOrNull(action.actionKind) ?? textOrNull(action.eventType),
      level: positiveIntegerOrNull(action.level),
      semanticVariant: action.variantInputSelection
        ? {
            selectorIdentity: action.variantInputSelection.selectorIdentity,
            selectorKind: action.variantInputSelection.selectorKind,
            publicVariantIndex: action.variantInputSelection.publicVariantIndex,
            chargeTier: action.variantInputSelection.chargeTier,
            mode: action.variantInputSelection.mode,
          }
        : null,
      attackInput: attackInputIndex
        ? {
            sequenceIndex: attackInputIndex,
            groupId: textOrNull(action.attackGroupId),
          }
        : null,
    },
  };
}

function resolvePreservedMachineAxisSchedules(project, fps) {
  const transport =
    project.metadata?.transport?.[MACHINE_AXIS_TRANSPORT_METADATA_KEY];
  if (
    !transport ||
    transport.schemaVersion !== WORKBENCH_MACHINE_AXIS_ADAPTER_SCHEMA_VERSION ||
    !transport.schedulesByActionId ||
    !Array.isArray(transport.actionSnapshot)
  ) {
    return null;
  }
  const actions = project.actions ?? [];
  if (actions.length !== transport.actionSnapshot.length) return null;
  const snapshotById = new Map(
    transport.actionSnapshot.map(entry => [String(entry.id), entry])
  );
  const unchanged = actions.every(action => {
    const snapshot = snapshotById.get(String(action.id));
    if (!snapshot) return false;
    const startFrame =
      nonNegativeIntegerOrNull(action.startFrame) ??
      frameFromMs(action.startMs, fps, { allowZero: true });
    const durationFrames =
      nonNegativeIntegerOrNull(action.durationFrames) ??
      frameFromMs(action.durationMs, fps, { allowZero: true });
    return (
      startFrame === snapshot.startFrame &&
      durationFrames === snapshot.durationFrames
    );
  });
  return unchanged ? transport.schedulesByActionId : null;
}

function resolveActionSlot(action, slotsByActorId, slotsByCharacterId) {
  return (
    slotsByActorId.get(String(action.actorId ?? '')) ??
    slotsByCharacterId.get(Number(action.actorCharacterId)) ??
    null
  );
}

function createMachineHitOverrides(value = {}) {
  return Object.fromEntries(
    Object.entries(value ?? {})
      .map(([hitIdentity, override]) => [
        hitIdentity,
        {
          landed:
            override?.willHit === false
              ? 'miss'
              : override?.willHit === true
                ? 'hit'
                : 'inherit',
          criticalMode: override?.criticalPolicy ?? 'inherit',
          criticalRoll:
            nonNegativeIntegerOrNull(override?.criticalRoll) ?? null,
        },
      ])
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}

function copyLoadout(loadout = {}) {
  const source = copyPlainRecord(loadout);
  delete source.actorId;
  delete source.characterId;
  return source;
}

function copyPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return structuredClone(value);
}

function frameFromMs(value, fps, { allowZero = false } = {}) {
  const milliseconds = Number(value);
  const frame = Math.round((Math.max(0, milliseconds || 0) * fps) / 1000);
  return allowZero ? frame : Math.max(1, frame);
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegativeNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function diagnostic(code, path, message, details = {}) {
  return {
    severity: 'error',
    code,
    path,
    message,
    actionId: details.actionId ?? null,
    hitIdentity: details.hitIdentity ?? null,
    relatedActionId: details.relatedActionId ?? null,
  };
}
