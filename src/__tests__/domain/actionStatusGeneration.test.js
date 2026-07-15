import { describe, expect, it } from 'vitest';
import { getWorkbenchActionStatusCatalog } from '../../data/workbenchActionStatusCatalog';
import {
  GENERATED_ACTION_STATUS_SOURCE,
  createKiboActionStatusGeneration,
} from '../../domain/actionStatusGeneration';
import {
  createWorkbenchActionClipboard,
  pasteWorkbenchActionClipboard,
} from '../../domain/workbenchActionClipboard';
import {
  createWorkbenchActionDraft,
  getWorkbenchGameData,
  normalizeWorkbenchActionDrafts,
} from '../../domain/workbenchProjectFactory';

describe('action status generation', () => {
  it('audits confirmed cooldowns separately from lifecycle and tracking-only effects', () => {
    const catalog = getWorkbenchActionStatusCatalog();

    expect(catalog).toMatchObject({
      sourceKind: 'azpr-workbench-action-status-catalog',
      status: 'action-status-catalog-ready',
      policy: {
        descriptionTextInferenceAllowed: false,
        lifecycleRequiresDirectBehaviorBinding: true,
        unsupportedCandidatesRemainTrackingOnly: true,
        unconfirmedStackingUsesSingleInstanceRuntimeProjection: true,
        appliedToCalculators: false,
      },
      summary: {
        skillCount: 120,
        cooldownSkillCount: 52,
        logicCooldownSkillCount: 40,
        displayCooldownFallbackSkillCount: 12,
        ultimateDisplayCooldownFallbackSkillCount: 12,
        effectCandidateCount: 6,
        lifecycleBoundEffectCount: 1,
        trackingOnlyEffectCount: 5,
        kiboActionCount: 366,
        kiboConfirmedCooldownActionCount: 366,
        kiboConfirmedStatusActionCount: 0,
        calculatorAppliedEffectCount: 0,
      },
    });
  });

  it('generates a sourced lifecycle only for the structurally bound action variant', () => {
    const draft = createWorkbenchActionDraft({
      id: 'action-status-bound',
      skillId: 10100322,
      actorCharacterId: 101003,
      actionVariantIndex: 0,
      startMs: 0,
    });

    expect(draft.statusGeneration).toMatchObject({
      contractName: 'AzPrActionStatusGeneration',
      status: 'action-status-generation-ready-with-lifecycle',
      skillId: 10100322,
      actionVariantIndex: 0,
      actionKind: 'star-carry',
      cooldown: {
        status: 'confirmed-cooldown',
        durationMs: 24000,
        chargeCount: 1,
      },
      summary: {
        generatedEffectCount: 1,
        trackingOnlyEffectCount: 0,
        calculatorAppliedEffectCount: 0,
      },
    });
    expect(draft.effectCommands).toEqual([
      expect.objectContaining({
        id: 'action-status-bound-generated-status-buff-101003141-57-0',
        effectId: 'buff-101003141',
        effectName: '防御力降低',
        icon: 'tex_icon_buff_defdown.png',
        operation: 'apply',
        targetKind: 'enemy',
        targetId: null,
        offsetMs: 950,
        durationMs: 8000,
        stackMode: 'replace',
        sourceStatus: GENERATED_ACTION_STATUS_SOURCE,
        confidence: 'medium',
        trackingStatus: 'unapplied',
        sourceIdentity: expect.objectContaining({
          skillId: 10100322,
          elementConfigId: 101003141,
          behaviorClassName: 'InjectToTargetKeyFrameBehaviorData',
          triggerFrameField: 'SkillBehaviorData.startFrame',
          durationField: 'TBuffElementParams.time',
          stackingStatus: 'unconfirmed-single-instance-runtime-projection',
        }),
        appliedToCalculators: false,
      }),
    ]);

    const otherVariant = createWorkbenchActionDraft({
      id: draft.id,
      skillId: draft.skillId,
      actorCharacterId: draft.actorCharacterId,
      actionVariantIndex: 1,
      effectCommands: draft.effectCommands,
    });
    expect(otherVariant.statusGeneration).toMatchObject({
      status: 'action-status-generation-ready-with-cooldown',
      effects: [
        expect.objectContaining({
          status: 'tracking-only-action-variant-not-bound',
        }),
      ],
      summary: {
        generatedEffectCount: 0,
        trackingOnlyEffectCount: 1,
      },
    });
    expect(otherVariant.effectCommands).toEqual([]);
  });

  it('keeps unbound buff evidence tracking-only while sourcing kibo cooldowns', () => {
    const trackingDraft = createWorkbenchActionDraft({
      id: 'action-status-tracking',
      skillId: 10100312,
      actorCharacterId: 101003,
      actionVariantIndex: 0,
    });
    expect(trackingDraft.statusGeneration).toMatchObject({
      status: 'action-status-generation-ready-with-cooldown',
      effects: [
        expect.objectContaining({
          effectName: '焰火',
          status: 'tracking-only-behavior-binding-unconfirmed',
          triggerFrame: null,
          durationMs: 10000,
          appliedToCalculators: false,
        }),
      ],
      summary: {
        generatedEffectCount: 0,
        trackingOnlyEffectCount: 1,
      },
    });
    expect(trackingDraft.effectCommands).toEqual([]);

    const kiboDraft = createWorkbenchActionDraft({
      id: 'action-status-kibo',
      type: 'kiboEvent',
      kiboId: 500001,
      skillId: 50000102,
      actorCharacterId: 109001,
      timingSource: 'azpr-unity-skill-control-root',
    });
    expect(kiboDraft.statusGeneration).toMatchObject({
      sourceKind: 'azpr-kibo-action-status-generation',
      status: 'action-status-generation-ready-with-cooldown',
      kiboId: 500001,
      skillId: 50000102,
      cooldown: {
        status: 'confirmed-cooldown',
        durationMs: 18000,
        chargeCount: 1,
        sourceIdentity: {
          sourceKind: 'azpr-newtable-kibo-standard-battle-cooldown',
          sourceStatus: 'confirmed-structured-data',
          subSkillId: 50000102,
          cooldownMode: 'standard-battle',
          durationFieldPath: 'skillsub_logic.rows[skillId=50000102].coolDown',
        },
        applied: true,
      },
      summary: {
        confirmedCooldownCount: 1,
        generatedEffectCount: 0,
        calculatorAppliedEffectCount: 0,
      },
    });
    expect(kiboDraft.effectCommands).toEqual([]);

    const mismatchedGeneration = createKiboActionStatusGeneration({
      actionId: 'action-status-kibo-mismatched',
      kiboId: 500002,
      skillId: 50000102,
      timingSource: 'azpr-unity-skill-control-root',
    });
    expect(mismatchedGeneration).toMatchObject({
      status: 'tracking-only-no-confirmed-status-source',
      kiboId: 500002,
      skillId: 50000102,
      cooldown: {
        status: 'no-confirmed-cooldown',
        durationMs: null,
      },
    });

    const ambiguousOwnerGeneration = createKiboActionStatusGeneration({
      actionId: 'action-status-kibo-ambiguous-owner',
      skillId: 501016,
      timingSource: 'azpr-unity-skill-control-root',
    });
    expect(ambiguousOwnerGeneration).toMatchObject({
      status: 'tracking-only-no-confirmed-status-source',
      kiboId: null,
      skillId: 501016,
      cooldown: {
        status: 'no-confirmed-cooldown',
        durationMs: null,
      },
    });

    const legacyKiboDraft = normalizeWorkbenchActionDrafts(
      [
        {
          id: 'legacy-kibo-event-without-skill',
          type: 'kiboEvent',
          actorCharacterId: 109001,
          startMs: 0,
          durationMs: 600,
        },
      ],
      {
        characterId: 109001,
        secondaryCharacterId: 101003,
        skillId: 10900101,
        enemyId: 300032,
      }
    )[0];
    expect(legacyKiboDraft).toMatchObject({
      type: 'kiboEvent',
      skillId: null,
      statusGeneration: {
        status: 'tracking-only-no-confirmed-status-source',
        skillId: null,
      },
    });
  });

  it('uses a positive skill-level cooldown for ultimates whose logic row is zero', () => {
    const confirmedUltimate = createWorkbenchActionDraft({
      id: 'action-status-ultimate-confirmed',
      skillId: 10100713,
      actorCharacterId: 101007,
    });
    expect(confirmedUltimate.statusGeneration).toMatchObject({
      actionKind: 'ultimate',
      cooldown: {
        status: 'confirmed-cooldown',
        durationMs: 20000,
        chargeCount: 1,
        sourceIdentity: {
          sourceKind: 'azpr-newtable-skill-level-display',
          sourceStatus: 'confirmed-display-cooldown-logic-zero',
          durationFieldPath: 'skill_level.rows[id=340].coolDown',
        },
      },
    });

    const unavailableUltimate = createWorkbenchActionDraft({
      id: 'action-status-ultimate-unavailable',
      skillId: 10100313,
      actorCharacterId: 101003,
    });
    expect(unavailableUltimate.statusGeneration).toMatchObject({
      actionKind: 'ultimate',
      cooldown: {
        status: 'no-confirmed-cooldown',
        durationMs: null,
        applied: false,
      },
    });
  });

  it('regenerates stable commands after replay normalization', () => {
    const source = createWorkbenchActionDraft({
      id: 'action-status-replay',
      skillId: 10100322,
      actorCharacterId: 101003,
      actionVariantIndex: 0,
    });
    const normalized = normalizeWorkbenchActionDrafts(
      [JSON.parse(JSON.stringify(source))],
      {
        characterId: 109001,
        secondaryCharacterId: 101003,
        skillId: 10900101,
        enemyId: 300032,
      }
    );

    expect(normalized).toHaveLength(1);
    expect(normalized[0].statusGeneration).toEqual(source.statusGeneration);
    expect(normalized[0].effectCommands).toEqual(source.effectCommands);
    expect(getWorkbenchGameData().skills).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 10100322 })])
    );
  });

  it('rebinds generated command identity when a real action is copied', () => {
    const source = createWorkbenchActionDraft({
      id: 'action-status-copy-source',
      skillId: 10100322,
      actorCharacterId: 101003,
      actionVariantIndex: 0,
      startMs: 1000,
    });
    const clipboard = createWorkbenchActionClipboard([source], [source.id]);
    const pasted = pasteWorkbenchActionClipboard(clipboard, {
      existingActions: [source],
      timelineDurationMs: 30000,
      targetStartMs: 5000,
      createActionId: () => 'action-status-copy-target',
    }).pastedActions[0];

    expect(pasted.statusGeneration).toEqual({
      ...source.statusGeneration,
      actionId: 'action-status-copy-target',
    });
    expect(pasted.effectCommands).toEqual([
      expect.objectContaining({
        id: 'action-status-copy-target-generated-status-buff-101003141-57-0',
        effectId: 'buff-101003141',
      }),
    ]);
    expect(pasted.effectCommands[0].id).not.toBe(source.effectCommands[0].id);
  });
});
