import { describe, expect, it } from 'vitest';
import { GENERATED_ACTION_STATUS_SOURCE } from '../../domain/actionStatusGeneration';
import { ACTION_TYPES } from '../../domain/projectSchema';
import { frameToMs } from '../../domain/timebase';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchProjectFileSnapshot,
  parseWorkbenchProjectFile,
} from '../../domain/workbenchDraftStorage';
import {
  createWorkbenchTimelineFragment,
  evaluateWorkbenchTimelineFragmentCompatibility,
  instantiateWorkbenchTimelineFragment,
  parseWorkbenchTimelineFragment,
} from '../../domain/workbenchTimelineFragment';
import {
  createDefaultWorkbenchActorConfigs,
  createDefaultWorkbenchTeamSlots,
  createWorkbenchActionDraft,
  getSkillsForCharacter,
  getWorkbenchLoadoutOptions,
} from '../../domain/workbenchProjectFactory';

describe('workbench timeline fragment', () => {
  it('captures a complete relation group with fixed-slot identities and no old runtime state', () => {
    const context = createFragmentContext();
    const fragment = createWorkbenchTimelineFragment({
      ...context,
      selectedActionIds: ['action-0002'],
      metadata: {
        id: 'fragment-chain',
        name: '跨角色连携',
        tags: ['连携', '测试'],
      },
      now: '2026-07-17T08:00:00.000Z',
    });

    expect(fragment).toMatchObject({
      id: 'fragment-chain',
      name: '跨角色连携',
      tags: ['连携', '测试'],
      source: {
        sourceActionIds: ['action-0001', 'action-0002', 'action-0003'],
        expandedFromSelection: true,
        runtimeOutputsIncluded: false,
      },
      summary: {
        actionCount: 3,
        relationCount: 2,
        requiredTeamSlotCount: 2,
        generatedStatusSnapshotCount: 0,
        runtimeOutputCount: 0,
      },
    });
    expect(fragment.actions.map(action => action.relativeStartMs)).toEqual([
      0,
      frameToMs(45),
      frameToMs(90),
    ]);
    expect(fragment.actions.map(action => action.lane.kind)).toEqual([
      'actor-action',
      'actor-kibo',
      'actor-action',
    ]);
    expect(fragment.relations).toEqual([
      expect.objectContaining({
        fromFragmentActionId: 'fragment-action-0001',
        toFragmentActionId: 'fragment-action-0002',
      }),
      expect.objectContaining({
        fromFragmentActionId: 'fragment-action-0002',
        toFragmentActionId: 'fragment-action-0003',
      }),
    ]);
    expect(fragment.requirements.teamSlots).toEqual([
      expect.objectContaining({
        slotId: context.teamSlots[0].slotId,
        characterId: context.teamSlots[0].characterId,
        kiboId: context.kiboId,
      }),
      expect.objectContaining({
        slotId: context.teamSlots[1].slotId,
        characterId: context.teamSlots[1].characterId,
      }),
    ]);

    const skillSource = fragment.actions[0].source;
    expect(skillSource).not.toHaveProperty('id');
    expect(skillSource).not.toHaveProperty('startMs');
    expect(skillSource).not.toHaveProperty('insertion');
    expect(skillSource).not.toHaveProperty('generationBatch');
    expect(skillSource).not.toHaveProperty('statusGeneration');
    expect(skillSource.note).toBe('保留作者备注');
    expect(skillSource.variantInputSelection).toMatchObject({
      selectorIdentity: 'actor:test|control:test|public-variant:2',
      publicVariantIndex: 2,
      chargeTier: 2,
    });
    expect(skillSource.effectCommands).toEqual([
      expect.objectContaining({ effectId: 'manual-fragment-effect' }),
    ]);
    expect(skillSource.effectCommands[0]).not.toHaveProperty('id');
  });

  it('validates exact team and Kibo ownership while keeping unloaded catalogs unresolved', () => {
    const context = createFragmentContext();
    const fragment = createWorkbenchTimelineFragment({
      ...context,
      selectedActionIds: context.actions.map(action => action.id),
      metadata: { id: 'fragment-compatibility' },
      now: '2026-07-17T08:00:00.000Z',
    });
    const kiboActionsById = new Map([
      [context.kiboId, [{ skillId: context.kiboSkillId }]],
    ]);

    expect(
      evaluateWorkbenchTimelineFragmentCompatibility(fragment, {
        teamSlots: context.teamSlots,
        actorConfigs: context.actorConfigs,
        kiboActionsById,
      })
    ).toMatchObject({ status: 'valid', compatible: true, issues: [] });

    expect(
      evaluateWorkbenchTimelineFragmentCompatibility(fragment, {
        teamSlots: context.teamSlots,
        actorConfigs: context.actorConfigs,
      })
    ).toMatchObject({
      status: 'unresolved',
      compatible: true,
      unresolvedIssues: [
        expect.objectContaining({ code: 'fragment-kibo-catalog-unavailable' }),
      ],
    });

    const mismatchedSlots = context.teamSlots.map((slot, index) =>
      index === 0
        ? { ...slot, characterId: context.teamSlots[2].characterId }
        : slot
    );
    expect(
      evaluateWorkbenchTimelineFragmentCompatibility(fragment, {
        teamSlots: mismatchedSlots,
        actorConfigs: context.actorConfigs,
        kiboActionsById,
      })
    ).toMatchObject({
      status: 'blocked',
      compatible: false,
      blockingIssues: [
        expect.objectContaining({
          code: 'fragment-team-slot-character-mismatch',
        }),
      ],
    });
  });

  it('rejects unsupported versions instead of silently migrating identities', () => {
    const context = createFragmentContext();
    const fragment = createWorkbenchTimelineFragment({
      ...context,
      selectedActionIds: ['action-0001'],
      metadata: { id: 'fragment-versioned' },
    });

    expect(
      parseWorkbenchTimelineFragment(JSON.stringify(fragment))
    ).not.toBeNull();
    expect(
      parseWorkbenchTimelineFragment({ ...fragment, schemaVersion: 99 })
    ).toBeNull();
  });

  it('instantiates one atomic action and relation group with regenerated identities', () => {
    const context = createFragmentContext();
    const fragment = createWorkbenchTimelineFragment({
      ...context,
      selectedActionIds: ['action-0002'],
      metadata: { id: 'fragment-instantiation' },
      now: '2026-07-17T08:00:00.000Z',
    });
    let nextActionIndex = 101;
    let nextRelationIndex = 101;
    const result = instantiateWorkbenchTimelineFragment(fragment, {
      targetStartMs: frameToMs(360),
      teamSlots: context.teamSlots,
      actorConfigs: context.actorConfigs,
      kiboActionsById: new Map([
        [context.kiboId, [{ skillId: context.kiboSkillId }]],
      ]),
      existingActions: [{ id: 'action-0100' }],
      existingRelations: [{ id: 'relation-0100' }],
      createActionId: () =>
        `action-${String(nextActionIndex++).padStart(4, '0')}`,
      createRelationId: () =>
        `relation-${String(nextRelationIndex++).padStart(4, '0')}`,
    });

    expect(result).toMatchObject({
      status: 'valid',
      committable: true,
      selectedActionIds: ['action-0101', 'action-0102', 'action-0103'],
      primaryActionId: 'action-0101',
    });
    expect(result.actions.map(action => action.startMs)).toEqual([
      frameToMs(360),
      frameToMs(405),
      frameToMs(450),
    ]);
    expect(result.actions[0]).toMatchObject({
      id: 'action-0101',
      insertion: null,
      generationBatch: null,
      statusGeneration: {
        actionId: 'action-0101',
        sourceKind: 'azpr-action-status-generation',
      },
    });
    expect(
      result.actions[0].effectCommands.find(
        command => command.effectId === 'manual-fragment-effect'
      )
    ).toMatchObject({ id: 'action-0101-effect-01' });
    expect(result.actions[1]).toMatchObject({
      id: 'action-0102',
      type: ACTION_TYPES.KIBO_EVENT,
      kiboId: context.kiboId,
      statusGeneration: {
        actionId: 'action-0102',
        sourceKind: 'azpr-kibo-action-status-generation',
      },
    });
    expect(result.relations).toEqual([
      expect.objectContaining({
        id: 'relation-0101',
        fromActionId: 'action-0101',
        toActionId: 'action-0102',
      }),
      expect.objectContaining({
        id: 'relation-0102',
        fromActionId: 'action-0102',
        toActionId: 'action-0103',
      }),
    ]);
  });

  it('refuses owner mismatches and damaged relation groups without partial drafts', () => {
    const context = createFragmentContext();
    const fragment = createWorkbenchTimelineFragment({
      ...context,
      selectedActionIds: context.actions.map(action => action.id),
      metadata: { id: 'fragment-atomic-block' },
    });
    const mismatchedSlots = context.teamSlots.map((slot, index) =>
      index === 0
        ? { ...slot, characterId: context.teamSlots[2].characterId }
        : slot
    );
    const blocked = instantiateWorkbenchTimelineFragment(fragment, {
      teamSlots: mismatchedSlots,
      actorConfigs: context.actorConfigs,
      kiboActionsById: new Map([
        [context.kiboId, [{ skillId: context.kiboSkillId }]],
      ]),
    });

    expect(blocked).toMatchObject({
      status: 'blocked',
      committable: false,
      actions: [],
      relations: [],
    });

    const damaged = structuredClone(fragment);
    damaged.relations[0].toFragmentActionId = 'missing-fragment-action';
    expect(parseWorkbenchTimelineFragment(damaged)).toBeNull();
    expect(instantiateWorkbenchTimelineFragment(damaged)).toMatchObject({
      status: 'blocked',
      committable: false,
      actions: [],
      relations: [],
    });
  });

  it('round-trips instantiated actions through the standard project carrier', () => {
    const context = createFragmentContext();
    const fragment = createWorkbenchTimelineFragment({
      ...context,
      selectedActionIds: context.actions.map(action => action.id),
      metadata: { id: 'fragment-project-round-trip' },
    });
    const instantiated = instantiateWorkbenchTimelineFragment(fragment, {
      targetStartMs: frameToMs(240),
      teamSlots: context.teamSlots,
      actorConfigs: context.actorConfigs,
      kiboActionsById: new Map([
        [context.kiboId, [{ skillId: context.kiboSkillId }]],
      ]),
    });
    const draft = createDefaultWorkbenchDraftState();
    const restored = parseWorkbenchProjectFile(
      createWorkbenchProjectFileSnapshot({
        ...draft,
        teamSlots: context.teamSlots,
        actorConfigs: context.actorConfigs,
        actionDrafts: instantiated.actions,
        actionRelations: instantiated.relations,
        selectedActionId: instantiated.primaryActionId,
      })
    );

    expect(restored.actionDrafts.map(action => action.id)).toEqual(
      instantiated.selectedActionIds
    );
    expect(restored.actionRelations).toEqual(
      instantiated.relations.map(relation => expect.objectContaining(relation))
    );
    expect(restored.actionDrafts[0].statusGeneration).toMatchObject({
      actionId: instantiated.primaryActionId,
      sourceKind: 'azpr-action-status-generation',
    });
  });

  it('keeps switch events at zero duration through fragment instantiation', () => {
    const context = createFragmentContext();
    const switchAction = createWorkbenchActionDraft({
      id: 'switch-fragment',
      type: ACTION_TYPES.SWITCH,
      actorCharacterId: context.teamSlots[0].characterId,
      targetCharacterId: context.teamSlots[1].characterId,
      startMs: frameToMs(90),
      durationMs: 600,
    });
    const fragment = createWorkbenchTimelineFragment({
      teamSlots: context.teamSlots,
      actorConfigs: context.actorConfigs,
      actions: [switchAction],
      actionRelations: [],
      selectedActionIds: [switchAction.id],
      metadata: { id: 'fragment-switch-event', name: '切人事件' },
    });
    const instantiated = instantiateWorkbenchTimelineFragment(fragment, {
      targetStartMs: frameToMs(180),
      teamSlots: context.teamSlots,
      actorConfigs: context.actorConfigs,
      existingActions: [],
      existingRelations: [],
    });

    expect(fragment.actions[0].source.durationMs).toBe(0);
    expect(instantiated.actions[0]).toMatchObject({
      type: ACTION_TYPES.SWITCH,
      startMs: frameToMs(180),
      durationMs: 0,
      durationFrames: 0,
    });
  });
});

function createFragmentContext() {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const baseActorConfigs = createDefaultWorkbenchActorConfigs();
  const firstSkill = getSkillsForCharacter(teamSlots[0].characterId)[0];
  const secondSkill = getSkillsForCharacter(teamSlots[1].characterId)[0];
  const kiboId =
    Number(baseActorConfigs[0].loadout.kiboId) ||
    Number(getWorkbenchLoadoutOptions().kibos[0].id);
  const actorConfigs = baseActorConfigs.map((config, index) =>
    index === 0 ? { ...config, loadout: { ...config.loadout, kiboId } } : config
  );
  const kiboSkillId = 990001;
  const actions = [
    createWorkbenchActionDraft({
      id: 'action-0001',
      type: ACTION_TYPES.SKILL,
      actorCharacterId: teamSlots[0].characterId,
      skillId: firstSkill.id,
      startMs: frameToMs(30),
      durationMs: frameToMs(30),
      note: ['保留作者备注', '约束辅助：已从 0ms 调整到 500ms。'].join('\n'),
      insertion: { autoDelayed: true, requestedStartMs: 0 },
      generationBatch: { batchId: 'old-batch' },
      variantInputSelection: {
        selectorIdentity: 'actor:test|control:test|public-variant:2',
        selectorKind: 'charge-tier',
        publicVariantIndex: 2,
        chargeTier: 2,
        mode: 'hold',
      },
      effectCommands: [
        {
          id: 'manual-old-id',
          effectId: 'manual-fragment-effect',
          effectName: '手工效果',
          operation: 'apply',
          targetKind: 'actor',
          durationMs: 1000,
        },
        {
          id: 'generated-old-id',
          effectId: 'generated-fragment-effect',
          effectName: '旧自动效果',
          operation: 'apply',
          targetKind: 'actor',
          durationMs: 1000,
          sourceStatus: GENERATED_ACTION_STATUS_SOURCE,
        },
      ],
    }),
    createWorkbenchActionDraft({
      id: 'action-0002',
      type: ACTION_TYPES.KIBO_EVENT,
      actorCharacterId: teamSlots[0].characterId,
      kiboId,
      skillId: kiboSkillId,
      name: '测试奇波动作',
      startMs: frameToMs(75),
      durationMs: frameToMs(30),
      needsTimingData: false,
    }),
    createWorkbenchActionDraft({
      id: 'action-0003',
      type: ACTION_TYPES.SKILL,
      actorCharacterId: teamSlots[1].characterId,
      skillId: secondSkill.id,
      startMs: frameToMs(120),
      durationMs: frameToMs(30),
    }),
  ];
  const actionRelations = [
    {
      id: 'relation-0001',
      fromActionId: 'action-0001',
      toActionId: 'action-0002',
    },
    {
      id: 'relation-0002',
      fromActionId: 'action-0002',
      toActionId: 'action-0003',
    },
  ];
  return {
    teamSlots,
    actorConfigs,
    actions,
    actionRelations,
    kiboId,
    kiboSkillId,
  };
}
