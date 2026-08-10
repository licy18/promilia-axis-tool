import {
  ACTION_RELATION_ANCHORS,
  ACTION_RELATION_KINDS,
  ACTION_TYPES,
} from './projectSchema';
import {
  resolveVerifiedKiboJointAttackBinding,
} from './verifiedJointAttackContract';
import {
  createVerifiedJointAttackRuntimeBinding,
  validateVerifiedJointAttackRuntimeBinding,
} from './verifiedJointAttackRuntimeContract';
import {
  createVerifiedJointAttackRuntimeEvidence,
  createVerifiedJointAttackRuntimePair,
} from './verifiedJointAttackRuntimePair';

export function isWorkbenchJointAttackTimelineEntry(
  entry = {},
  actorActionEntries = []
) {
  return (
    isKiboJointAttackEntry(entry) ||
    resolveActorActionEntry(entry, actorActionEntries)?.kind === 'star-combo'
  );
}

export function createWorkbenchJointAttackInsertion({
  entry = {},
  actorCharacterId = null,
  actorActionEntries = [],
  kiboActionEntries = [],
  equippedKiboId = null,
  baseDraftPatches = [],
  startMs = 0,
  companionActionId = '',
  relationId = '',
  jointAttackRuntime = null,
} = {}) {
  const actorEntry = resolveActorActionEntry(entry, actorActionEntries);
  const insertsActor =
    entry.type === ACTION_TYPES.SKILL && actorEntry?.kind === 'star-combo';
  const insertsKibo = isKiboJointAttackEntry(entry);
  if (!insertsActor && !insertsKibo) {
    return { status: 'not-joint-attack', draftPatches: baseDraftPatches };
  }

  const kiboId = positiveIntegerOrNull(equippedKiboId);
  if (!kiboId) {
    return blocked('该角色未装备奇波，不能加入星结合击');
  }
  if (insertsKibo && positiveIntegerOrNull(entry.kiboId) !== kiboId) {
    return blocked('拖入的合击不属于该角色当前装备的奇波');
  }

  const starComboEntry = insertsActor
    ? actorEntry
    : actorActionEntries.find(candidate => candidate.kind === 'star-combo');
  const kiboComboEntry = insertsKibo
    ? entry
    : kiboActionEntries.find(candidate =>
        isVerifiedKiboJointCatalogEntry(candidate, kiboId)
      );
  if (!starComboEntry) {
    return blocked('当前角色目录中没有可确认的星结合击');
  }
  if (!kiboComboEntry) {
    return blocked('当前奇波目录中没有可确认的合击动作');
  }
  if (!hasAppliedTiming(starComboEntry)) {
    return blocked('角色星结合击占轴时长未解析，不能加入时间轴');
  }
  if (!hasAppliedTiming(kiboComboEntry)) {
    return blocked('奇波合击占轴时长未解析，不能加入时间轴');
  }

  const baseDraft = baseDraftPatches[0];
  const actorDraft = insertsActor
    ? baseDraft
    : {
        id: companionActionId,
        type: ACTION_TYPES.SKILL,
        skillId: starComboEntry.skillId,
        actorCharacterId,
        startMs,
        durationMs: starComboEntry.durationMs,
        level: 1,
        actionVariantIndex: starComboEntry.actionVariantIndex ?? 0,
        damageSegmentIndex: starComboEntry.actionVariantIndex ?? 0,
        note: `${starComboEntry.label}：${starComboEntry.rawValue ?? '倍率待补'}。`,
      };
  const kiboDraft = insertsKibo
    ? baseDraft
    : {
        id: companionActionId,
        type: ACTION_TYPES.KIBO_EVENT,
        kiboId,
        skillId: kiboComboEntry.skillId,
        actorCharacterId,
        startMs,
        durationMs: kiboComboEntry.durationMs,
        level: 1,
        eventType: 'break',
        name: kiboComboEntry.name,
        icon: kiboComboEntry.icon ?? null,
        timingSource: kiboComboEntry.timingSource,
        needsTimingData: false,
        note: 'Skill Control 时长已确认；与角色星结合击同时发动。',
      };
  const kiboBinding = resolveVerifiedKiboJointAttackBinding({
    ...kiboDraft,
    actor: {
      characterId: actorCharacterId,
      loadout: { kiboId },
    },
  });
  if (!kiboBinding) {
    return blocked(
      '奇波动作缺少 breakSkillList 与 skillTag=15/PetJointStrikeSkill 的一致映射'
    );
  }
  const runtimeBinding =
    jointAttackRuntime == null
      ? createVerifiedJointAttackRuntimeBinding()
      : validateVerifiedJointAttackRuntimeBinding(jointAttackRuntime).binding;
  if (!runtimeBinding) {
    return blocked(
      '现有合击产品 assumption 合同无效，不能静默覆盖或加入合击'
    );
  }
  const runtimeActorId = `actor-${actorCharacterId}`;
  const pair = createVerifiedJointAttackRuntimePair({
    actorAction: {
      ...actorDraft,
      actorId: runtimeActorId,
      actor: { characterId: actorCharacterId, loadout: { kiboId } },
      actionKind: 'star-combo',
      sourceSequencePath: [0],
    },
    kiboAction: {
      ...kiboDraft,
      actorId: runtimeActorId,
      actor: { characterId: actorCharacterId, loadout: { kiboId } },
      actionKind: 'break',
      sourceSequencePath: [1],
    },
    actor: { loadout: { kiboId } },
    scenario: { combatScenario: { jointAttackRuntime: runtimeBinding } },
    actorActionIndex: 0,
    kiboActionIndex: 1,
  });
  if (!pair.ready) return blocked(`合击产品合同绑定失败：${pair.code}`);
  const triggerEvidence = createVerifiedJointAttackRuntimeEvidence(pair);

  return {
    status: 'paired',
    formalEligible: true,
    jointAttackRuntime: runtimeBinding,
    triggerEvidence,
    draftPatches: [
      { ...actorDraft, startMs },
      { ...kiboDraft, startMs },
    ],
    actionRelations: [
      {
        id: relationId,
        kind: ACTION_RELATION_KINDS.SIMULTANEOUS,
        fromActionId: actorDraft.id,
        toActionId: kiboDraft.id,
        sourceAnchor: ACTION_RELATION_ANCHORS.SOURCE_START,
        targetAnchor: ACTION_RELATION_ANCHORS.TARGET_START,
        gapMs: 0,
      },
    ],
  };
}

function resolveActorActionEntry(entry, actorActionEntries) {
  if (entry.type !== ACTION_TYPES.SKILL) return null;
  return (
    actorActionEntries.find(
      candidate =>
        Number(candidate.skillId) === Number(entry.skillId) &&
        Number(candidate.actionVariantIndex) ===
          Number(entry.actionVariantIndex ?? 0)
    ) ?? null
  );
}

function isKiboJointAttackEntry(entry) {
  return resolveVerifiedKiboJointAttackBinding(entry) != null;
}

function isVerifiedKiboJointCatalogEntry(entry, kiboId) {
  return (
    resolveVerifiedKiboJointAttackBinding({
      type: ACTION_TYPES.KIBO_EVENT,
      kiboId,
      skillId: entry?.skillId,
      eventType: entry?.kind,
      actionKind: entry?.kind,
      actor: { loadout: { kiboId } },
    }) != null
  );
}

function blocked(message) {
  return { status: 'blocked', message, draftPatches: [], actionRelations: [] };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function hasAppliedTiming(entry) {
  return (
    (entry?.timingStatus === 'applied' || entry?.timingStatus == null) &&
    positiveNumberOrNull(entry.durationMs) != null
  );
}
