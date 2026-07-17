import { GENERATED_ACTION_STATUS_SOURCE } from './actionStatusGeneration';
import { ACTION_TYPES } from './projectSchema';
import { WORKBENCH_FRAME_MS, snapMsToFrame } from './timebase';
import {
  expandWorkbenchPlacementActionIds,
  WORKBENCH_ACTION_PLACEMENT_STATUSES,
} from './workbenchActionPlacement';
import {
  createNextWorkbenchActionRelationIdFromUsedIds,
  normalizeWorkbenchActionRelations,
} from './workbenchActionRelations';
import {
  createWorkbenchActionDraft,
  getSkillsForCharacter,
} from './workbenchProjectFactory';
import {
  resolveWorkbenchTimelineLaneKind,
  WORKBENCH_TIMELINE_LANE_KINDS,
} from './workbenchTimelineEntry';

export const WORKBENCH_TIMELINE_FRAGMENT_CONTRACT_NAME =
  'AzPrWorkbenchTimelineFragment';
export const WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION = 1;
export const WORKBENCH_TIMELINE_FRAGMENT_KIND =
  'promilia-workbench-timeline-fragment';

const SYSTEM_LANE_KIND = 'system';
const AUTO_PLACEMENT_NOTE_PATTERN =
  /^(?:自动推迟：同轨已有动作占用，已从|约束辅助：已从) \d+(?:\.\d+)?ms 调整到 \d+(?:\.\d+)?ms。$/;

export function createWorkbenchTimelineFragment({
  actions = [],
  selectedActionIds = [],
  actionRelations = [],
  teamSlots = [],
  actorConfigs = [],
  metadata = {},
  now = new Date().toISOString(),
} = {}) {
  const normalizedRelations = normalizeWorkbenchActionRelations(
    actionRelations,
    actions
  );
  const expandedActionIds = expandWorkbenchPlacementActionIds({
    actions,
    actionIds: selectedActionIds,
    actionRelations: normalizedRelations,
  });
  const expandedActionIdSet = new Set(expandedActionIds);
  const sourceActions = actions.filter(action =>
    expandedActionIdSet.has(action.id)
  );
  if (!sourceActions.length) {
    return null;
  }

  const baseStartMs = Math.min(
    ...sourceActions.map(action => normalizeStartMs(action.startMs))
  );
  const sourceOrder = new Map(
    actions.map((action, index) => [action.id, index])
  );
  const sortedActions = [...sourceActions].sort(
    (left, right) =>
      normalizeStartMs(left.startMs) - normalizeStartMs(right.startMs) ||
      (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0)
  );
  const fragmentActionIdBySourceId = new Map();
  const fragmentActions = sortedActions.map((action, index) => {
    const fragmentActionId = `fragment-action-${String(index + 1).padStart(4, '0')}`;
    fragmentActionIdBySourceId.set(action.id, fragmentActionId);
    return createFragmentAction({
      action,
      fragmentActionId,
      baseStartMs,
      teamSlots,
      actorConfigs,
    });
  });
  const fragmentRelations = normalizedRelations
    .filter(
      relation =>
        expandedActionIdSet.has(relation.fromActionId) &&
        expandedActionIdSet.has(relation.toActionId)
    )
    .map((relation, index) => ({
      fragmentRelationId: `fragment-relation-${String(index + 1).padStart(4, '0')}`,
      kind: relation.kind,
      fromFragmentActionId: fragmentActionIdBySourceId.get(
        relation.fromActionId
      ),
      toFragmentActionId: fragmentActionIdBySourceId.get(relation.toActionId),
      sourceAnchor: relation.sourceAnchor,
      targetAnchor: relation.targetAnchor,
      gapMs: snapMsToFrame(Number(relation.gapMs) || 0),
    }));
  const requirements = createFragmentRequirements({
    fragmentActions,
    teamSlots,
    actorConfigs,
  });
  const durationMs = Math.max(
    WORKBENCH_FRAME_MS,
    ...fragmentActions.map(
      item => item.relativeStartMs + item.source.durationMs
    )
  );
  const id =
    normalizeText(metadata.id) ??
    createWorkbenchTimelineFragmentId(now, metadata.randomSuffix);

  return normalizeWorkbenchTimelineFragment({
    schemaVersion: WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION,
    contractName: WORKBENCH_TIMELINE_FRAGMENT_CONTRACT_NAME,
    kind: WORKBENCH_TIMELINE_FRAGMENT_KIND,
    id,
    name:
      normalizeText(metadata.name) ?? `动作片段 ${String(now).slice(0, 10)}`,
    description: normalizeText(metadata.description) ?? '',
    tags: normalizeTags(metadata.tags),
    createdAt: normalizeIsoDate(metadata.createdAt) ?? now,
    updatedAt: now,
    source: {
      sourceKind: 'workbench-selected-action-group',
      sourceActionIds: sortedActions.map(action => action.id),
      expandedFromSelection:
        expandedActionIds.length > selectedActionIds.length,
      runtimeOutputsIncluded: false,
    },
    durationMs,
    actions: fragmentActions,
    relations: fragmentRelations,
    requirements,
  });
}

export function parseWorkbenchTimelineFragment(rawFragment) {
  const value = parseJsonValue(rawFragment);
  return normalizeWorkbenchTimelineFragment(value);
}

export function normalizeWorkbenchTimelineFragment(fragment) {
  if (
    !fragment ||
    typeof fragment !== 'object' ||
    fragment.schemaVersion !== WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION ||
    fragment.contractName !== WORKBENCH_TIMELINE_FRAGMENT_CONTRACT_NAME ||
    fragment.kind !== WORKBENCH_TIMELINE_FRAGMENT_KIND
  ) {
    return null;
  }

  const usedActionIds = new Set();
  const actions = arrayOrEmpty(fragment.actions)
    .map((action, index) => normalizeFragmentAction(action, index))
    .filter(action => {
      if (!action || usedActionIds.has(action.fragmentActionId)) {
        return false;
      }
      usedActionIds.add(action.fragmentActionId);
      return true;
    })
    .sort(
      (left, right) =>
        left.relativeStartMs - right.relativeStartMs ||
        left.fragmentActionId.localeCompare(right.fragmentActionId)
    );
  if (!actions.length) {
    return null;
  }

  const relations = normalizeFragmentRelations(fragment.relations, actions);
  if (relations.length !== arrayOrEmpty(fragment.relations).length) {
    return null;
  }
  const requirements = normalizeFragmentRequirements(
    fragment.requirements,
    actions
  );
  if (!hasCompleteFragmentRequirements(actions, requirements)) {
    return null;
  }
  const durationMs = Math.max(
    WORKBENCH_FRAME_MS,
    ...actions.map(action => action.relativeStartMs + action.source.durationMs)
  );
  const createdAt =
    normalizeIsoDate(fragment.createdAt) ?? new Date(0).toISOString();
  const updatedAt = normalizeIsoDate(fragment.updatedAt) ?? createdAt;

  return {
    schemaVersion: WORKBENCH_TIMELINE_FRAGMENT_SCHEMA_VERSION,
    contractName: WORKBENCH_TIMELINE_FRAGMENT_CONTRACT_NAME,
    kind: WORKBENCH_TIMELINE_FRAGMENT_KIND,
    id: normalizeText(fragment.id) ?? 'timeline-fragment',
    name: normalizeText(fragment.name) ?? '未命名动作片段',
    description: normalizeText(fragment.description) ?? '',
    tags: normalizeTags(fragment.tags),
    createdAt,
    updatedAt,
    source: normalizeFragmentSource(fragment.source),
    durationMs,
    actions,
    relations,
    requirements,
    summary: createFragmentSummary(
      actions,
      relations,
      requirements,
      durationMs
    ),
  };
}

export function evaluateWorkbenchTimelineFragmentCompatibility(
  fragment,
  { teamSlots = [], actorConfigs = [], kiboActionsById = null } = {}
) {
  const normalizedFragment = normalizeWorkbenchTimelineFragment(fragment);
  if (!normalizedFragment) {
    return createCompatibilityResult({
      status: WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
      issues: [
        createCompatibilityIssue(
          'fragment-contract-invalid',
          '片段合同无效或版本不受支持',
          WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED
        ),
      ],
    });
  }

  const slotsById = new Map(teamSlots.map(slot => [slot.slotId, slot]));
  const configsByCharacterId = new Map(
    actorConfigs.map(config => [Number(config?.characterId), config])
  );
  const issues = [];
  for (const requirement of normalizedFragment.requirements.teamSlots) {
    const currentSlot = slotsById.get(requirement.slotId);
    if (!currentSlot) {
      issues.push(
        createCompatibilityIssue(
          'fragment-team-slot-missing',
          `缺少固定队伍槽 ${requirement.slotId}`,
          WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
          requirement
        )
      );
      continue;
    }
    if (Number(currentSlot.characterId) !== requirement.characterId) {
      issues.push(
        createCompatibilityIssue(
          'fragment-team-slot-character-mismatch',
          `队伍槽 ${requirement.position + 1} 需要角色 ${requirement.characterId}`,
          WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
          requirement
        )
      );
      continue;
    }
    if (requirement.kiboId) {
      const currentKiboId = positiveIntegerOrNull(
        configsByCharacterId.get(requirement.characterId)?.loadout?.kiboId
      );
      if (currentKiboId !== requirement.kiboId) {
        issues.push(
          createCompatibilityIssue(
            'fragment-team-slot-kibo-mismatch',
            `队伍槽 ${requirement.position + 1} 需要奇波 ${requirement.kiboId}`,
            WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
            requirement
          )
        );
      }
    }
  }

  for (const action of normalizedFragment.actions) {
    if (action.source.type === ACTION_TYPES.SKILL) {
      const skillExists = getSkillsForCharacter(
        action.source.actorCharacterId
      ).some(skill => Number(skill.id) === Number(action.source.skillId));
      if (!skillExists) {
        issues.push(
          createCompatibilityIssue(
            'fragment-skill-source-missing',
            `角色 ${action.source.actorCharacterId} 缺少技能 ${action.source.skillId}`,
            WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
            action.sourceIdentity
          )
        );
      }
    }
    if (action.source.type === ACTION_TYPES.KIBO_EVENT) {
      if (!(kiboActionsById instanceof Map)) {
        issues.push(
          createCompatibilityIssue(
            'fragment-kibo-catalog-unavailable',
            '奇波动作目录尚未加载，无法确认来源动作',
            WORKBENCH_ACTION_PLACEMENT_STATUSES.UNRESOLVED,
            action.sourceIdentity
          )
        );
      } else {
        const sourceExists = arrayOrEmpty(
          kiboActionsById.get(Number(action.source.kiboId))
        ).some(item => Number(item.skillId) === Number(action.source.skillId));
        if (!sourceExists) {
          issues.push(
            createCompatibilityIssue(
              'fragment-kibo-action-source-missing',
              `奇波 ${action.source.kiboId} 缺少动作 ${action.source.skillId}`,
              WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
              action.sourceIdentity
            )
          );
        }
      }
    }
  }

  const status = issues.some(
    issue => issue.status === WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED
  )
    ? WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED
    : issues.length
      ? WORKBENCH_ACTION_PLACEMENT_STATUSES.UNRESOLVED
      : WORKBENCH_ACTION_PLACEMENT_STATUSES.VALID;
  return createCompatibilityResult({
    status,
    issues,
    fragment: normalizedFragment,
  });
}

export function instantiateWorkbenchTimelineFragment(
  fragment,
  {
    targetStartMs = 0,
    teamSlots = [],
    actorConfigs = [],
    kiboActionsById = null,
    existingActions = [],
    existingRelations = [],
    createActionId = createNextFragmentActionId,
    createRelationId = createNextWorkbenchActionRelationIdFromUsedIds,
  } = {}
) {
  const normalizedFragment = normalizeWorkbenchTimelineFragment(fragment);
  const compatibility = evaluateWorkbenchTimelineFragmentCompatibility(
    normalizedFragment,
    { teamSlots, actorConfigs, kiboActionsById }
  );
  if (
    !normalizedFragment ||
    compatibility.status !== WORKBENCH_ACTION_PLACEMENT_STATUSES.VALID ||
    typeof createActionId !== 'function' ||
    typeof createRelationId !== 'function'
  ) {
    return createFragmentInstantiationResult({
      status: compatibility.status,
      compatibility,
    });
  }

  const slotsById = new Map(teamSlots.map(slot => [slot.slotId, slot]));
  const configsByCharacterId = new Map(
    actorConfigs.map(config => [Number(config?.characterId), config])
  );
  const usedActionIds = new Set(existingActions.map(action => action.id));
  const usedRelationIds = new Set(
    existingRelations.map(relation => relation.id)
  );
  const actionIdByFragmentId = new Map();
  const insertStartMs = Math.max(0, snapMsToFrame(Number(targetStartMs) || 0));
  const actions = normalizedFragment.actions.map(fragmentAction => {
    const id = createActionId(usedActionIds);
    usedActionIds.add(id);
    actionIdByFragmentId.set(fragmentAction.fragmentActionId, id);
    const source = cloneValue(fragmentAction.source);
    const slot = fragmentAction.lane.slotId
      ? slotsById.get(fragmentAction.lane.slotId)
      : null;
    if (slot) {
      source.actorCharacterId = Number(slot.characterId);
    }
    if (source.type === ACTION_TYPES.SWITCH) {
      const targetRequirement = normalizedFragment.requirements.teamSlots.find(
        requirement => requirement.characterId === source.targetCharacterId
      );
      const targetSlot = targetRequirement
        ? slotsById.get(targetRequirement.slotId)
        : null;
      source.targetCharacterId = Number(targetSlot?.characterId) || null;
    }
    if (source.type === ACTION_TYPES.KIBO_EVENT) {
      source.kiboId = positiveIntegerOrNull(
        configsByCharacterId.get(source.actorCharacterId)?.loadout?.kiboId
      );
    }
    return createWorkbenchActionDraft({
      ...source,
      id,
      startMs: insertStartMs + fragmentAction.relativeStartMs,
      insertion: null,
      generationBatch: null,
    });
  });
  const relations = normalizeWorkbenchActionRelations(
    normalizedFragment.relations.map(relation => ({
      id: createRelationId(usedRelationIds),
      kind: relation.kind,
      fromActionId: actionIdByFragmentId.get(relation.fromFragmentActionId),
      toActionId: actionIdByFragmentId.get(relation.toFragmentActionId),
      sourceAnchor: relation.sourceAnchor,
      targetAnchor: relation.targetAnchor,
      gapMs: relation.gapMs,
    })),
    actions
  );
  if (relations.length !== normalizedFragment.relations.length) {
    return createFragmentInstantiationResult({
      status: WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
      compatibility,
      issues: [
        createCompatibilityIssue(
          'fragment-relation-instantiation-incomplete',
          '片段关系无法完整重建',
          WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED
        ),
      ],
    });
  }

  return createFragmentInstantiationResult({
    status: WORKBENCH_ACTION_PLACEMENT_STATUSES.VALID,
    compatibility,
    fragment: normalizedFragment,
    actions,
    relations,
  });
}

function createFragmentAction({
  action,
  fragmentActionId,
  baseStartMs,
  teamSlots,
  actorConfigs,
}) {
  const lane = createFragmentLane(action, teamSlots);
  const actorConfig = actorConfigs.find(
    config => Number(config?.characterId) === Number(action.actorCharacterId)
  );
  const source = createFragmentActionSource(action, actorConfig);
  return {
    fragmentActionId,
    relativeStartMs: snapMsToFrame(
      normalizeStartMs(action.startMs) - baseStartMs
    ),
    lane,
    sourceIdentity: {
      sourceActionId: String(action.id ?? ''),
      actionType: source.type,
      actorCharacterId: source.actorCharacterId,
      skillId: source.skillId,
      kiboId: source.kiboId ?? null,
      actionVariantIndex: source.actionVariantIndex,
    },
    source,
  };
}

function createFragmentActionSource(action, actorConfig) {
  const type = Object.values(ACTION_TYPES).includes(action?.type)
    ? action.type
    : ACTION_TYPES.SKILL;
  const source = {
    type,
    skillId:
      type === ACTION_TYPES.KIBO_EVENT
        ? positiveIntegerOrNull(action.skillId)
        : Number(action.skillId) || null,
    actorCharacterId: Number(action.actorCharacterId) || null,
    durationMs: Math.max(
      WORKBENCH_FRAME_MS,
      snapMsToFrame(Number(action.durationMs) || WORKBENCH_FRAME_MS)
    ),
    level: Math.max(1, Number(action.level) || 1),
    actionVariantIndex: Math.max(
      0,
      Number(action.actionVariantIndex ?? action.damageSegmentIndex) || 0
    ),
    targetCharacterId: Number(action.targetCharacterId) || null,
    resource: normalizeText(action.resource) ?? 'sp',
    change: Number(action.change) || 0,
    reason: normalizeText(action.reason) ?? 'manual-axis-resource',
    eventType: normalizeText(action.eventType) ?? 'phase',
    note: stripAutoPlacementNote(action.note),
    effectCommands: cloneManualEffectCommands(action.effectCommands),
  };
  if (type === ACTION_TYPES.KIBO_EVENT) {
    source.kiboId =
      positiveIntegerOrNull(action.kiboId) ??
      positiveIntegerOrNull(actorConfig?.loadout?.kiboId);
    source.name = normalizeText(action.name) ?? '';
    source.icon = normalizeText(action.icon);
    source.timingSource = normalizeText(action.timingSource);
    source.needsTimingData = Boolean(action.needsTimingData);
  }
  return source;
}

function createFragmentLane(action, teamSlots) {
  const laneKind = resolveWorkbenchTimelineLaneKind(action) ?? SYSTEM_LANE_KIND;
  if (laneKind === WORKBENCH_TIMELINE_LANE_KINDS.ENEMY_EVENT) {
    return { kind: laneKind, slotId: null, position: null };
  }
  if (laneKind === SYSTEM_LANE_KIND) {
    return { kind: laneKind, slotId: null, position: null };
  }
  const slot = teamSlots.find(
    item => Number(item?.characterId) === Number(action.actorCharacterId)
  );
  return {
    kind: laneKind,
    slotId: slot?.slotId ?? null,
    position: Number.isInteger(Number(slot?.position))
      ? Number(slot.position)
      : null,
  };
}

function createFragmentRequirements({
  fragmentActions,
  teamSlots,
  actorConfigs,
}) {
  const slotsById = new Map(teamSlots.map(slot => [slot.slotId, slot]));
  const configsByCharacterId = new Map(
    actorConfigs.map(config => [Number(config?.characterId), config])
  );
  const requiredSlotIds = new Set();
  for (const item of fragmentActions) {
    if (item.lane.slotId) {
      requiredSlotIds.add(item.lane.slotId);
    }
    if (item.source.type === ACTION_TYPES.SWITCH) {
      const targetSlot = teamSlots.find(
        slot =>
          Number(slot?.characterId) === Number(item.source.targetCharacterId)
      );
      if (targetSlot?.slotId) requiredSlotIds.add(targetSlot.slotId);
    }
  }
  return {
    fixedTeamSlots: true,
    teamSlots: [...requiredSlotIds]
      .map(slotId => slotsById.get(slotId))
      .filter(Boolean)
      .sort((left, right) => left.position - right.position)
      .map(slot => {
        const characterId = Number(slot.characterId);
        const needsKibo = fragmentActions.some(
          item =>
            item.lane.slotId === slot.slotId &&
            item.source.type === ACTION_TYPES.KIBO_EVENT
        );
        const requiredKiboId = needsKibo
          ? (positiveIntegerOrNull(
              fragmentActions.find(
                item =>
                  item.lane.slotId === slot.slotId &&
                  item.source.type === ACTION_TYPES.KIBO_EVENT
              )?.source?.kiboId
            ) ??
            positiveIntegerOrNull(
              configsByCharacterId.get(characterId)?.loadout?.kiboId
            ))
          : null;
        return {
          slotId: slot.slotId,
          position: Number(slot.position),
          characterId,
          kiboId: requiredKiboId,
        };
      }),
  };
}

function normalizeFragmentAction(action, index) {
  if (!action || typeof action !== 'object') return null;
  const source = normalizeFragmentActionSource(action.source);
  if (!source) return null;
  return {
    fragmentActionId:
      normalizeText(action.fragmentActionId) ??
      `fragment-action-${String(index + 1).padStart(4, '0')}`,
    relativeStartMs: Math.max(
      0,
      snapMsToFrame(Number(action.relativeStartMs) || 0)
    ),
    lane: normalizeFragmentLane(action.lane, source),
    sourceIdentity: normalizeSourceIdentity(action.sourceIdentity, source),
    source,
  };
}

function normalizeFragmentActionSource(source) {
  if (!source || !Object.values(ACTION_TYPES).includes(source.type)) {
    return null;
  }
  const normalized = {
    type: source.type,
    skillId:
      source.type === ACTION_TYPES.KIBO_EVENT
        ? positiveIntegerOrNull(source.skillId)
        : Number(source.skillId) || null,
    actorCharacterId: positiveIntegerOrNull(source.actorCharacterId),
    durationMs: Math.max(
      WORKBENCH_FRAME_MS,
      snapMsToFrame(Number(source.durationMs) || WORKBENCH_FRAME_MS)
    ),
    level: Math.max(1, Number(source.level) || 1),
    actionVariantIndex: Math.max(0, Number(source.actionVariantIndex) || 0),
    targetCharacterId: positiveIntegerOrNull(source.targetCharacterId),
    resource: normalizeText(source.resource) ?? 'sp',
    change: Number(source.change) || 0,
    reason: normalizeText(source.reason) ?? 'manual-axis-resource',
    eventType: normalizeText(source.eventType) ?? 'phase',
    note: stripAutoPlacementNote(source.note),
    effectCommands: cloneManualEffectCommands(source.effectCommands),
  };
  if (source.type === ACTION_TYPES.KIBO_EVENT) {
    normalized.kiboId = positiveIntegerOrNull(source.kiboId);
    normalized.name = normalizeText(source.name) ?? '';
    normalized.icon = normalizeText(source.icon);
    normalized.timingSource = normalizeText(source.timingSource);
    normalized.needsTimingData = Boolean(source.needsTimingData);
  }
  return normalized;
}

function normalizeFragmentLane(lane, source) {
  const expectedKind =
    resolveWorkbenchTimelineLaneKind(source) ?? SYSTEM_LANE_KIND;
  return {
    kind: lane?.kind === expectedKind ? lane.kind : expectedKind,
    slotId: normalizeText(lane?.slotId),
    position: Number.isInteger(Number(lane?.position))
      ? Number(lane.position)
      : null,
  };
}

function normalizeFragmentRelations(relations, actions) {
  const actionIdSet = new Set(actions.map(action => action.fragmentActionId));
  const pseudoActions = actions.map(action => ({
    id: action.fragmentActionId,
    startMs: action.relativeStartMs,
    durationMs: action.source.durationMs,
  }));
  const normalized = normalizeWorkbenchActionRelations(
    arrayOrEmpty(relations)
      .filter(
        relation =>
          actionIdSet.has(relation?.fromFragmentActionId) &&
          actionIdSet.has(relation?.toFragmentActionId)
      )
      .map((relation, index) => ({
        id:
          normalizeText(relation.fragmentRelationId) ??
          `fragment-relation-${String(index + 1).padStart(4, '0')}`,
        kind: relation.kind,
        fromActionId: relation.fromFragmentActionId,
        toActionId: relation.toFragmentActionId,
        sourceAnchor: relation.sourceAnchor,
        targetAnchor: relation.targetAnchor,
        gapMs: relation.gapMs,
      })),
    pseudoActions
  );
  return normalized.map((relation, index) => ({
    fragmentRelationId: `fragment-relation-${String(index + 1).padStart(4, '0')}`,
    kind: relation.kind,
    fromFragmentActionId: relation.fromActionId,
    toFragmentActionId: relation.toActionId,
    sourceAnchor: relation.sourceAnchor,
    targetAnchor: relation.targetAnchor,
    gapMs: relation.gapMs,
  }));
}

function normalizeFragmentRequirements(requirements, actions) {
  const requiredSlotIds = new Set(
    actions.map(action => action.lane.slotId).filter(Boolean)
  );
  const teamSlots = arrayOrEmpty(requirements?.teamSlots)
    .filter(
      requirement =>
        requiredSlotIds.has(requirement?.slotId) ||
        actions.some(
          action =>
            action.source.type === ACTION_TYPES.SWITCH &&
            Number(action.source.targetCharacterId) ===
              Number(requirement?.characterId)
        )
    )
    .map(requirement => ({
      slotId: normalizeText(requirement.slotId),
      position: Math.max(0, Number(requirement.position) || 0),
      characterId: positiveIntegerOrNull(requirement.characterId),
      kiboId: positiveIntegerOrNull(requirement.kiboId),
    }))
    .filter(requirement => requirement.slotId && requirement.characterId)
    .sort((left, right) => left.position - right.position);
  return { fixedTeamSlots: true, teamSlots };
}

function hasCompleteFragmentRequirements(actions, requirements) {
  const requirementsBySlotId = new Map(
    requirements.teamSlots.map(requirement => [requirement.slotId, requirement])
  );
  for (const action of actions) {
    if (
      [
        WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_ACTION,
        WORKBENCH_TIMELINE_LANE_KINDS.ACTOR_KIBO,
      ].includes(action.lane.kind)
    ) {
      const requirement = requirementsBySlotId.get(action.lane.slotId);
      if (
        !requirement ||
        requirement.characterId !== action.source.actorCharacterId
      ) {
        return false;
      }
      if (
        action.source.type === ACTION_TYPES.KIBO_EVENT &&
        requirement.kiboId !== action.source.kiboId
      ) {
        return false;
      }
    }
    if (
      action.source.type === ACTION_TYPES.SWITCH &&
      !requirements.teamSlots.some(
        requirement =>
          requirement.characterId === action.source.targetCharacterId
      )
    ) {
      return false;
    }
  }
  return true;
}

function normalizeFragmentSource(source) {
  return {
    sourceKind:
      normalizeText(source?.sourceKind) ?? 'workbench-selected-action-group',
    sourceActionIds: arrayOrEmpty(source?.sourceActionIds)
      .map(normalizeText)
      .filter(Boolean),
    expandedFromSelection: Boolean(source?.expandedFromSelection),
    runtimeOutputsIncluded: false,
  };
}

function normalizeSourceIdentity(identity, source) {
  return {
    sourceActionId: normalizeText(identity?.sourceActionId),
    actionType: source.type,
    actorCharacterId: source.actorCharacterId,
    skillId: source.skillId,
    kiboId: source.kiboId ?? null,
    actionVariantIndex: source.actionVariantIndex,
  };
}

function createFragmentSummary(actions, relations, requirements, durationMs) {
  return {
    actionCount: actions.length,
    relationCount: relations.length,
    durationMs,
    laneKinds: [...new Set(actions.map(action => action.lane.kind))],
    requiredTeamSlotCount: requirements.teamSlots.length,
    generatedStatusSnapshotCount: 0,
    runtimeOutputCount: 0,
  };
}

function cloneManualEffectCommands(commands) {
  return arrayOrEmpty(commands)
    .filter(command => command?.sourceStatus !== GENERATED_ACTION_STATUS_SOURCE)
    .map(command => {
      const cloned = cloneValue(command);
      delete cloned.id;
      return cloned;
    });
}

function stripAutoPlacementNote(note) {
  return String(note ?? '')
    .split(/\r?\n/)
    .filter(line => !AUTO_PLACEMENT_NOTE_PATTERN.test(line.trim()))
    .join('\n')
    .trimEnd();
}

function createCompatibilityIssue(code, message, status, context = null) {
  return {
    code,
    message,
    status,
    source: { sourceKind: 'workbench-timeline-fragment-compatibility' },
    context: context ? cloneValue(context) : null,
  };
}

function createCompatibilityResult({ status, issues, fragment = null }) {
  return {
    schemaVersion: 1,
    sourceKind: 'workbench-timeline-fragment-compatibility',
    status,
    compatible: status !== WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED,
    issues,
    blockingIssues: issues.filter(
      issue => issue.status === WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED
    ),
    unresolvedIssues: issues.filter(
      issue => issue.status === WORKBENCH_ACTION_PLACEMENT_STATUSES.UNRESOLVED
    ),
    fragmentId: fragment?.id ?? null,
  };
}

function createFragmentInstantiationResult({
  status,
  compatibility,
  fragment = null,
  actions = [],
  relations = [],
  issues = [],
}) {
  const allIssues = [...(compatibility?.issues ?? []), ...issues];
  return {
    schemaVersion: 1,
    sourceKind: 'workbench-timeline-fragment-instantiation',
    status,
    committable:
      status === WORKBENCH_ACTION_PLACEMENT_STATUSES.VALID &&
      actions.length > 0 &&
      relations.length === (fragment?.relations?.length ?? 0),
    fragmentId: fragment?.id ?? compatibility?.fragmentId ?? null,
    actions,
    relations,
    selectedActionIds: actions.map(action => action.id),
    primaryActionId: actions[0]?.id ?? '',
    compatibility,
    issues: allIssues,
  };
}

function createNextFragmentActionId(usedActionIds) {
  const usedIds = usedActionIds ?? new Set();
  const maxIndex = [...usedIds].reduce((maximum, actionId) => {
    const match = String(actionId).match(/^action-(\d+)$/);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  let nextIndex = maxIndex + 1;
  let actionId = `action-${String(nextIndex).padStart(4, '0')}`;
  while (usedIds.has(actionId)) {
    nextIndex += 1;
    actionId = `action-${String(nextIndex).padStart(4, '0')}`;
  }
  usedIds.add(actionId);
  return actionId;
}

function createWorkbenchTimelineFragmentId(now, randomSuffix = '') {
  const timestamp = String(now)
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  const suffix =
    normalizeText(randomSuffix)?.replace(/[^a-zA-Z0-9_-]/g, '') ||
    Math.random().toString(36).slice(2, 8);
  return `timeline-fragment-${timestamp || 'local'}-${suffix}`;
}

function normalizeTags(tags) {
  const values =
    typeof tags === 'string' ? tags.split(/[,，]/) : arrayOrEmpty(tags);
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeIsoDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeStartMs(value) {
  return Math.max(0, snapMsToFrame(Number(value) || 0));
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function parseJsonValue(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}
