import { describe, expect, it } from 'vitest';
import {
  ACTION_RULE_CODES,
  ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';
import { frameToMs } from '../../domain/timebase';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  createVerifiedKiboAutoCastDerivation,
  VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
} from '../../domain/verifiedBackgroundActionDerivation';
import { createVerifiedJointAttackRuntimeBinding } from '../../domain/verifiedJointAttackRuntimeContract';

describe('action rule diagnostics', () => {
  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('reports actor-lane overlap without consuming cooldown and keeps unapplied preview SP costs unresolved', () => {
    const scenario = {
      actors: [createActor()],
      actions: [
        createSkillAction({
          id: 'action-1',
          skillId: 1001,
          name: '星鸣技',
          startMs: 0,
          durationMs: 1000,
          cooldownMs: 5000,
        }),
        createSkillAction({
          id: 'action-2',
          skillId: 1001,
          name: '星鸣技',
          startMs: 500,
          durationMs: 1000,
          cooldownMs: 5000,
        }),
        createSkillAction({
          id: 'action-3',
          skillId: 1002,
          name: '星决技',
          startMs: 2000,
          durationMs: 800,
          spCost: 100,
        }),
      ],
    };

    const result = createActionRuleDiagnostics({ scenario });

    expect(result).toMatchObject({
      contractName: ACTION_RULE_DIAGNOSTICS_CONTRACT_NAME,
      status: 'action-rules-violated',
      executable: false,
      summary: {
        diagnosticCount: 2,
        violationCount: 1,
        unresolvedCount: 1,
        laneOverlapCount: 1,
        cooldownViolationCount: 0,
        unresolvedSpPreconditionCount: 1,
        appliedToSimulationResults: false,
      },
      appliedToSimulationResults: false,
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.LANE_OVERLAP,
          actionId: 'action-2',
          blockingActionId: 'action-1',
          suggestedStartMs: 1000,
          editFieldKey: 'startMs',
          severity: 'error',
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED,
          actionId: 'action-3',
          requiredSp: 100,
          actorInitialSp: 50,
          actorMaxSp: 100,
          severity: 'warning',
          unresolved: ['skill-sp-cost-not-applied-by-selected-profile'],
          message: '星决技 需要 SP 100，当前 50/100；当前机制配置未应用该消耗',
        }),
      ])
    );
    expect(result.readinessTimeline).toMatchObject({
      contractName: 'AzPrActionReadinessTimeline',
      status: 'action-readiness-timeline-ready-with-blocked-actions',
      summary: {
        actionCount: 3,
        readyActionCount: 1,
        blockedActionCount: 1,
        unresolvedActionCount: 1,
        cooldownTrackedActionCount: 1,
        cooldownWindowCount: 1,
        appliedToSimulationResults: false,
      },
      cooldownWindows: [
        {
          actionId: 'action-1',
          chargeIndex: 0,
          startMs: 0,
          endMs: 5000,
        },
      ],
    });
    expect(result.readinessTimeline.actions).toEqual([
      expect.objectContaining({
        actionId: 'action-1',
        status: 'ready',
        executable: true,
        cooldown: expect.objectContaining({
          availableBefore: 1,
          availableAfter: 0,
          nextReadyAtMs: 5000,
        }),
      }),
      expect.objectContaining({
        actionId: 'action-2',
        status: 'blocked',
        executable: false,
        violationCodes: [ACTION_RULE_CODES.LANE_OVERLAP],
        cooldown: null,
      }),
      expect.objectContaining({
        actionId: 'action-3',
        status: 'ready-with-unresolved-conditions',
        executable: true,
        unresolvedCodes: [ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED],
      }),
    ]);
  });

  it('does not let an invalid cooldown cast restart the cooldown window', () => {
    const scenario = {
      actors: [createActor()],
      actions: [
        createSkillAction({ id: 'action-1', startMs: 0, cooldownMs: 5000 }),
        createSkillAction({ id: 'action-2', startMs: 1000, cooldownMs: 5000 }),
        createSkillAction({ id: 'action-3', startMs: 4000, cooldownMs: 5000 }),
        {
          id: 'annotation-1',
          type: 'annotation',
          startMs: 0,
          durationMs: 10000,
          name: '说明',
        },
      ],
    };

    const result = createActionRuleDiagnostics({ scenario });
    const cooldownRows = result.diagnostics.filter(
      item => item.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE
    );

    expect(cooldownRows).toHaveLength(2);
    expect(cooldownRows.map(item => item.readyAtMs)).toEqual([5000, 5000]);
    expect(
      result.diagnostics.some(item => item.actionId === 'annotation-1')
    ).toBe(false);
  });

  it('blocks before a cooldown boundary and admits the exact right-open boundary', () => {
    const scenario = {
      actors: [createActor()],
      actions: [
        createSkillAction({
          id: 'cooldown-source',
          startMs: 0,
          cooldownMs: 5000,
        }),
        createSkillAction({
          id: 'before-boundary',
          startMs: 1000,
          cooldownMs: 5000,
        }),
        createSkillAction({
          id: 'exact-boundary',
          startMs: 5000,
          cooldownMs: 5000,
        }),
      ],
    };

    const result = createActionRuleDiagnostics({ scenario });
    const cooldownRows = result.diagnostics.filter(
      item => item.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE
    );

    expect(cooldownRows).toEqual([
      expect.objectContaining({
        actionId: 'before-boundary',
        readyAtMs: 5000,
      }),
    ]);
    expect(
      result.diagnostics.some(item => item.actionId === 'exact-boundary')
    ).toBe(false);
  });

  it('keeps exact-frame switches out of occupancy and resolves same-frame conflicts stably', () => {
    const actor = createActor();
    const createSwitch = (id, targetActorId) => ({
      id,
      type: 'switch',
      name: `切人 ${id}`,
      actorId: actor.id,
      actor,
      targetActorId,
      startMs: 1000,
      startFrame: 60,
      endFrame: 60,
      durationMs: 0,
      durationFrames: 0,
      sourceSequencePath: [id === 'switch-z' ? 0 : 2],
    });
    const result = createActionRuleDiagnostics({
      scenario: {
        formalActionLegality: true,
        time: { fps: 60 },
        actors: [actor],
        actions: [
          createSwitch('switch-z', 'actor-3'),
          createSkillAction({
            id: 'skill-at-switch-frame',
            startMs: 1000,
            durationMs: 1000,
            sourceSequencePath: [1],
          }),
          createSwitch('switch-a', 'actor-2'),
        ],
      },
    });

    expect(result.summary).toMatchObject({
      laneOverlapCount: 0,
      switchFrameConflictCount: 1,
    });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: ACTION_RULE_CODES.SWITCH_FRAME_CONFLICT,
        actionId: 'switch-a',
        blockingActionId: 'switch-z',
        frameIndex: 60,
        suggestedStartMs: frameToMs(61),
      }),
    ]);
    expect(
      result.readinessTimeline.actions.find(
        action => action.actionId === 'switch-z'
      )
    ).toMatchObject({ executable: true, status: 'ready' });
    expect(
      result.readinessTimeline.actions.find(
        action => action.actionId === 'switch-a'
      )
    ).toMatchObject({ executable: false, status: 'blocked' });
  });

  it('requires the current controlled actor and applies same-frame switch source order', () => {
    const first = createActor();
    const second = {
      ...createActor(),
      id: 'actor-2',
      name: '第二角色',
    };
    const offField = createSkillAction({
      id: 'off-field-before-switch',
      actorId: second.id,
      actor: second,
      startMs: frameToMs(30),
      sourceSequencePath: [0],
    });
    const switchAction = {
      id: 'switch-to-second',
      type: 'switch',
      name: '切换至第二角色',
      actorId: first.id,
      actor: first,
      targetActorId: second.id,
      startMs: frameToMs(60),
      durationMs: 0,
      sourceSequencePath: [1],
    };
    const secondAfterSwitch = createSkillAction({
      id: 'second-after-switch',
      actorId: second.id,
      actor: second,
      startMs: frameToMs(60),
      sourceSequencePath: [2],
    });
    const formerControlled = createSkillAction({
      id: 'former-controlled-after-switch',
      startMs: frameToMs(90),
      sourceSequencePath: [3],
    });

    const result = createActionRuleDiagnostics({
      scenario: {
        formalActionLegality: true,
        time: { fps: 60 },
        actors: [first, second],
        actions: [offField, switchAction, secondAfterSwitch, formerControlled],
      },
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.CONTROLLED_ACTOR_UNAVAILABLE,
          actionId: 'off-field-before-switch',
          controlledActorId: first.id,
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.CONTROLLED_ACTOR_UNAVAILABLE,
          actionId: 'former-controlled-after-switch',
          controlledActorId: second.id,
        }),
      ])
    );
    expect(
      result.readinessTimeline.actions.find(
        action => action.actionId === 'second-after-switch'
      )
    ).toMatchObject({ executable: true, status: 'ready' });
  });

  it('fails closed for reversed or missing same-frame switch/input order and keeps wait from reviving background input', () => {
    const first = createActor();
    const second = { ...createActor(), id: 'actor-2', name: '第二角色' };
    const reverse = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [first, second],
        actions: [
          createSkillAction({
            id: 'second-before-switch',
            actorId: second.id,
            actor: second,
            startMs: frameToMs(60),
            sourceSequencePath: [1],
          }),
          {
            id: 'late-switch',
            type: 'switch',
            actorId: first.id,
            targetActorId: second.id,
            startMs: frameToMs(60),
            durationMs: 0,
            sourceSequencePath: [2],
          },
          {
            id: 'wait-only',
            type: 'wait',
            startMs: frameToMs(70),
            durationMs: frameToMs(20),
            sourceSequencePath: [3],
          },
          createSkillAction({
            id: 'first-after-wait',
            startMs: frameToMs(100),
            sourceSequencePath: [4],
          }),
        ],
      },
    });
    expect(reverse.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.CONTROLLED_ACTOR_UNAVAILABLE,
          actionId: 'second-before-switch',
          controlledActorId: first.id,
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.CONTROLLED_ACTOR_UNAVAILABLE,
          actionId: 'first-after-wait',
          controlledActorId: second.id,
        }),
      ])
    );

    const unordered = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [first, second],
        actions: [
          {
            id: 'unordered-switch',
            type: 'switch',
            actorId: first.id,
            targetActorId: second.id,
            startMs: frameToMs(60),
            durationMs: 0,
          },
          createSkillAction({
            id: 'unordered-input',
            actorId: second.id,
            actor: second,
            startMs: frameToMs(60),
          }),
        ],
      },
    });
    expect(
      unordered.diagnostics.filter(
        diagnostic =>
          diagnostic.code ===
          ACTION_RULE_CODES.CONTROLLED_ACTOR_SOURCE_ORDER_UNRESOLVED
      )
    ).toHaveLength(2);
    expect(
      unordered.readinessTimeline.actions.filter(action =>
        ['unordered-switch', 'unordered-input'].includes(action.actionId)
      )
    ).toEqual([
      expect.objectContaining({ executable: false }),
      expect.objectContaining({ executable: false }),
    ]);

    const crossActorSameFrame = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [first, second],
        actions: [
          createSkillAction({
            id: 'first-input-before-switch',
            actorId: first.id,
            actor: first,
            startMs: frameToMs(120),
            durationMs: 0,
            sourceSequencePath: [0],
          }),
          {
            id: 'switch-between-inputs',
            type: 'switch',
            actorId: first.id,
            targetActorId: second.id,
            startMs: frameToMs(120),
            durationMs: 0,
            sourceSequencePath: [1],
          },
          createSkillAction({
            id: 'second-input-after-switch',
            actorId: second.id,
            actor: second,
            startMs: frameToMs(120),
            durationMs: 0,
            sourceSequencePath: [2],
          }),
        ],
      },
    });
    expect(
      crossActorSameFrame.diagnostics.filter(
        diagnostic =>
          diagnostic.code ===
          ACTION_RULE_CODES.CONTROLLED_ACTOR_FRAME_INPUT_CONFLICT
      )
    ).toEqual([
      expect.objectContaining({ actionId: 'first-input-before-switch' }),
      expect.objectContaining({ actionId: 'second-input-after-switch' }),
    ]);
    expect(
      crossActorSameFrame.readinessTimeline.actions.filter(action =>
        ['first-input-before-switch', 'second-input-after-switch'].includes(
          action.actionId
        )
      )
    ).toEqual([
      expect.objectContaining({ executable: false }),
      expect.objectContaining({ executable: false }),
    ]);
  });

  it('uses a right-open switch occupancy gate and rejects an injected derived generation before settlement', () => {
    const first = createActor();
    const second = { ...createActor(), id: 'actor-2', name: '第二角色' };
    const occupying = createSkillAction({
      id: 'occupying-input',
      actorId: first.id,
      actor: first,
      startMs: 0,
      durationMs: 1000,
      sourceSequencePath: [0],
    });
    const blockedSwitch = {
      id: 'switch-inside-occupancy',
      type: 'switch',
      name: '占用中切人',
      actorId: first.id,
      actor: first,
      targetActorId: second.id,
      startMs: 500,
      durationMs: 0,
      sourceSequencePath: [1],
    };
    const binding = {
      schemaVersion: 1,
      contractName: 'AzPrSwitchTriggerBinding',
      bindingId: 'switch-inside-occupancy|on-enter|actor-2|star-carry-binding',
      switchEventId: blockedSwitch.id,
      sourceOwnerId: first.id,
      starCarryOwnerId: second.id,
      applied: true,
      resolutionStatus: 'applied',
      materializationStatus: 'materialized',
    };
    const derived = createSkillAction({
      id: 'derived-from-blocked-switch',
      actorId: second.id,
      actor: second,
      skillId: 2002,
      actionKind: 'star-carry',
      startMs: 500,
      durationMs: 300,
      sourceSequencePath: [1, 1],
      sourceSequenceSource: 'switch-trigger-parent-local-order',
      parentSourceSequencePath: [1],
      localSourceSequenceIndex: 1,
      parentActionId: blockedSwitch.id,
      switchTriggerBinding: binding,
      derivedAction: {
        schemaVersion: 1,
        kind: 'switch-triggered-star-carry',
        parentActionId: blockedSwitch.id,
        bindingId: binding.bindingId,
        readOnly: true,
      },
      readOnly: true,
    });
    const actions = [occupying, blockedSwitch, derived];
    const result = createActionRuleDiagnostics({
      scenario: {
        formalActionLegality: true,
        time: { fps: 60 },
        actors: [first, second],
        actions,
        switchTriggerGeneration: {
          actions: [derived],
          bindings: [binding],
        },
      },
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.SWITCH_OCCUPANCY_UNRESOLVED,
          actionId: blockedSwitch.id,
          blockingActionId: occupying.id,
          status: 'violated',
          suggestedStartMs: 1000,
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
          actionId: derived.id,
          reason: 'compiled-generation-not-authoritative',
          status: 'violated',
        }),
      ])
    );
    expect(
      result.readinessTimeline.actions.filter(action =>
        [blockedSwitch.id, derived.id].includes(action.actionId)
      )
    ).toEqual([
      expect.objectContaining({ executable: false }),
      expect.objectContaining({ executable: false }),
    ]);
    expect(
      result.acceptedSkillStartTransitions.some(
        transition => transition.actionId === derived.id
      )
    ).toBe(false);

    const exactEnd = createActionRuleDiagnostics({
      scenario: {
        formalActionLegality: true,
        time: { fps: 60 },
        actors: [first, second],
        actions: [
          occupying,
          {
            ...blockedSwitch,
            id: 'switch-at-exact-end',
            startMs: 1000,
            sourceSequencePath: [2],
          },
        ],
      },
    });
    expect(
      exactEnd.diagnostics.some(
        diagnostic =>
          diagnostic.code === ACTION_RULE_CODES.SWITCH_OCCUPANCY_UNRESOLVED
      )
    ).toBe(false);
    expect(
      exactEnd.readinessTimeline.actions.find(
        action => action.actionId === 'switch-at-exact-end'
      )
    ).toMatchObject({ executable: true });
  });

  it('rejects forged labels and a self-signed autonomous Kibo rule without compiler authority', () => {
    const first = createActor();
    const second = {
      ...createActor(),
      id: 'actor-2',
      characterId: 101007,
      loadout: { kiboId: 500001 },
    };
    const autoRule = createVerifiedKiboAutoCastDerivation({
      actionId: 'verified-auto',
      slotId: 'slot-2',
      ownerCharacterId: 101007,
      kiboId: 500001,
      publicActionId: 504003,
      actionKind: 'normal-attack',
      scheduledFrame: 30,
      sequenceIndex: 1,
      sourceSequencePath: [1],
      sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
      trigger: 'unconditional',
      triggerTag: '0',
      evidenceStatus: 'static-evidence-closed',
    });
    const conflictingAutoRule = createVerifiedKiboAutoCastDerivation({
      actionId: 'conflicting-auto',
      slotId: 'slot-2',
      ownerCharacterId: 101007,
      kiboId: 500001,
      publicActionId: 504003,
      actionKind: 'normal-attack',
      scheduledFrame: 50,
      sequenceIndex: 2,
      sourceSequencePath: [2],
      sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
      trigger: 'unconditional',
      triggerTag: '0',
      evidenceStatus: 'static-evidence-closed',
    });
    const result = createActionRuleDiagnostics({
      scenario: {
        formalActionLegality: true,
        time: { fps: 60 },
        actors: [first, second],
        team: {
          slots: [
            { slotId: 'slot-1', actorId: first.id },
            { slotId: 'slot-2', actorId: second.id },
          ],
        },
        actions: [
          createSkillAction({
            id: 'forged-derived',
            actorId: second.id,
            actor: second,
            startMs: frameToMs(10),
            sourceSequencePath: [0],
            sourceSequenceSource: 'manual-input',
            derivedAction: {
              schemaVersion: 1,
              kind: 'switch-triggered-star-carry',
              parentActionId: 'missing-switch',
              bindingId: 'missing-binding',
              readOnly: true,
            },
            readOnly: true,
          }),
          {
            id: 'verified-auto',
            type: 'kiboEvent',
            actorId: second.id,
            actor: second,
            kiboId: 500001,
            skillId: 504003,
            eventType: 'normal-attack',
            startMs: frameToMs(30),
            durationMs: frameToMs(5),
            autoCast: true,
            autoCastRule: autoRule,
            sourceSequencePath: [1],
            sourceSequenceSource:
              VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
          },
          {
            id: 'conflicting-auto',
            type: 'kiboEvent',
            actorId: second.id,
            actor: second,
            kiboId: 500001,
            skillId: 504003,
            eventType: 'normal-attack',
            startMs: frameToMs(50),
            durationMs: frameToMs(5),
            autoCast: true,
            autoCastRule: conflictingAutoRule,
            derivedAction: {
              schemaVersion: 1,
              kind: 'switch-triggered-star-carry',
              parentActionId: 'missing-switch',
              bindingId: 'missing-binding',
              readOnly: true,
            },
            readOnly: true,
            sourceSequencePath: [2],
            sourceSequenceSource:
              VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
          },
        ],
      },
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
          actionId: 'forged-derived',
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
          actionId: 'verified-auto',
          reason: expect.stringContaining(
            'authoritative-derivation-registry-missing'
          ),
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
          actionId: 'conflicting-auto',
          reason: expect.stringContaining('derived-action-origin-conflict'),
        }),
      ])
    );
    expect(
      result.readinessTimeline.actions.find(
        action => action.actionId === 'verified-auto'
      )
    ).toMatchObject({ executable: false });
  });

  it.each([
    ['self-signed-normal', 'normal-attack', 504003, {}],
    ['self-signed-signature', 'signature', 50000102, {}],
    ['self-signed-break', 'break', 50000112, {}],
    ['self-signed-arbitrary-skill', 'active', 999999, {}],
    ['self-signed-frame', 'normal-attack', 504003, { frame: 91 }],
    ['self-signed-sequence', 'normal-attack', 504003, { sequence: 99 }],
    ['self-signed-slot', 'normal-attack', 504003, { slotId: 'slot-x' }],
    [
      'self-signed-owner',
      'normal-attack',
      504003,
      { ownerCharacterId: 999999 },
    ],
    [
      'self-signed-package-hash',
      'normal-attack',
      504003,
      { mechanicsPackageHash: 'forged-package-hash' },
    ],
  ])(
    'rejects %s without an authoritative compiler derivation registry',
    (id, actionKind, skillId, mutation) => {
      const frame = mutation.frame ?? 90;
      const slotId = mutation.slotId ?? 'slot-2';
      const ownerCharacterId = mutation.ownerCharacterId ?? 101007;
      const second = {
        ...createActor(),
        id: 'actor-2',
        characterId: ownerCharacterId,
        loadout: { kiboId: 500001 },
      };
      const rule = {
        ...createVerifiedKiboAutoCastDerivation({
          actionId: id,
          slotId,
          ownerCharacterId,
          kiboId: 500001,
          publicActionId: skillId,
          actionKind,
          scheduledFrame: frame,
          sequenceIndex: mutation.sequence ?? 1,
          sourceSequencePath: [mutation.sequence ?? 1],
          sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
          trigger: 'unconditional',
          triggerTag: '0',
          evidenceStatus: 'static-evidence-closed',
        }),
        ...(mutation.mechanicsPackageHash
          ? { mechanicsPackageHash: mutation.mechanicsPackageHash }
          : {}),
      };
      const action = {
        id,
        type: 'kiboEvent',
        actorId: second.id,
        actor: second,
        kiboId: 500001,
        skillId,
        eventType: actionKind,
        startMs: frameToMs(frame),
        durationMs: frameToMs(5),
        autoCast: true,
        autoCastRule: rule,
        sourceSequencePath: [mutation.sequence ?? 1],
        sourceSequenceSource: VERIFIED_KIBO_AUTO_CAST_SOURCE_SEQUENCE_SOURCE,
      };
      const result = createActionRuleDiagnostics({
        scenario: {
          formalActionLegality: true,
          time: { fps: 60 },
          actors: [createActor(), second],
          team: {
            slots: [
              { slotId: 'slot-1', actorId: 'actor-1' },
              { slotId, actorId: second.id },
            ],
          },
          actions: [action],
        },
      });

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: ACTION_RULE_CODES.BACKGROUND_DERIVATION_INVALID,
            actionId: id,
            reason: expect.stringContaining(
              'authoritative-derivation-registry-missing'
            ),
          }),
        ])
      );
      expect(result.readinessTimeline.actions[0]).toMatchObject({
        actionId: id,
        executable: false,
      });
    }
  );

  it('rejects a manually scheduled star-carry even when its public mapping declaration is valid', () => {
    const mapping = mechanicsPackage.actionMappings.find(
      entry =>
        entry.actionKind === 'star-carry' &&
        entry.schedulable === true &&
        entry.catalogDeclaration
    );
    expect(mapping).toBeTruthy();
    const actor = {
      ...createActor(),
      characterId: Number(mapping.ownerId),
    };
    const action = createSkillAction({
      id: 'manually-scheduled-star-carry',
      actor,
      actorId: actor.id,
      skillId: Number(mapping.sourceSkillId),
      actionKind: 'star-carry',
      startMs: frameToMs(30),
      verifiedDeclaredPublicActionIntent: {
        schemaVersion: 1,
        contractName: 'AzPrVerifiedDeclaredPublicAction',
        actionId: 'manually-scheduled-star-carry',
        mappingIdentity: mapping.identity,
        ownerId: Number(mapping.ownerId),
      },
    });

    const result = createActionRuleDiagnostics({
      scenario: {
        formalActionLegality: true,
        time: { fps: 60 },
        actors: [actor],
        actions: [action],
      },
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: ACTION_RULE_CODES.STAR_CARRY_SWITCH_TRIGGER_REQUIRED,
        actionId: action.id,
        status: 'violated',
      })
    );
    expect(result.readinessTimeline.actions[0]).toMatchObject({
      actionId: action.id,
      executable: false,
    });
  });

  it('requires an equipped kibo and a same-frame joint attack pair', () => {
    const actor = {
      ...createActor(),
      loadout: { kiboId: 500001 },
    };
    const createActorCombo = startMs =>
      createSkillAction({
        id: 'actor-combo',
        skillId: 10100712,
        name: '星结合击',
        actionKind: 'star-combo',
        actor,
        startMs,
      });
    const createKiboCombo = startMs => ({
      id: 'kibo-combo',
      type: 'kiboEvent',
      skillId: 50000112,
      name: '迅狼-合击',
      eventType: 'break',
      actorId: actor.id,
      actor,
      kiboId: 500001,
      startMs,
      durationMs: 500,
    });

    const valid = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        jointAttackRuntime: createVerifiedJointAttackRuntimeBinding(),
        actions: [
          createActorCombo(frameToMs(120)),
          createKiboCombo(frameToMs(120)),
        ],
      },
    });
    expect(valid.summary.jointAttackViolationCount).toBe(0);
    expect(valid.summary.jointAttackTriggerUnresolvedCount).toBe(0);
    expect(valid.summary.jointAttackRuntimeReadyCount).toBe(1);
    expect(valid.diagnostics).toEqual([
      expect.objectContaining({
        code: ACTION_RULE_CODES.JOINT_ATTACK_RUNTIME_READY,
        status: 'verified',
        actionIds: ['actor-combo', 'kibo-combo'],
        evidence: expect.objectContaining({
          formalEligible: true,
          clientParityReady: false,
          status: 'resolved-by-product-assumption',
          runtimeContractId: 'm12-joint-attack-runtime-v1',
          leavesOpen: expect.arrayContaining([
            'client-server-parity-for-product-fallback-gates',
            'client-server-parity-for-kibo-hit-anchored-post-damage-toughness-clear-order',
          ]),
        }),
      }),
    ]);
    expect(
      valid.readinessTimeline.actions.every(action => action.executable)
    ).toBe(true);

    const missingRuntimeContract = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        actions: [
          createActorCombo(frameToMs(120)),
          createKiboCombo(frameToMs(120)),
        ],
      },
    });
    expect(missingRuntimeContract.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.JOINT_ATTACK_RUNTIME_CONTRACT_REQUIRED,
          actionIds: ['actor-combo', 'kibo-combo'],
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.JOINT_ATTACK_COUNTERPART_BLOCKED,
          actionId: 'kibo-combo',
        }),
      ])
    );
    expect(
      missingRuntimeContract.readinessTimeline.actions.every(
        action => action.executable === false
      )
    ).toBe(true);

    const mismatched = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        actions: [
          createActorCombo(frameToMs(120)),
          createKiboCombo(frameToMs(121)),
        ],
      },
    });
    expect(
      mismatched.diagnostics.filter(
        item => item.code === ACTION_RULE_CODES.JOINT_ATTACK_FRAME_MISMATCH
      )
    ).toHaveLength(2);
    expect(
      mismatched.readinessTimeline.actions.every(
        action => action.executable === false
      )
    ).toBe(true);

    const actorWithoutKibo = { ...actor, loadout: { kiboId: null } };
    const missingKibo = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actorWithoutKibo],
        actions: [
          createSkillAction({
            id: 'actor-combo-without-kibo',
            skillId: 10100712,
            name: '星结合击',
            actionKind: 'star-combo',
            actor: actorWithoutKibo,
            startMs: frameToMs(120),
          }),
        ],
      },
    });
    expect(missingKibo.diagnostics).toEqual([
      expect.objectContaining({
        code: ACTION_RULE_CODES.JOINT_ATTACK_KIBO_REQUIRED,
        actionId: 'actor-combo-without-kibo',
      }),
    ]);
    expect(missingKibo.readinessTimeline.actions[0]).toMatchObject({
      executable: false,
      status: 'blocked',
    });

    const crossTarget = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        actions: [
          { ...createActorCombo(frameToMs(120)), targetId: 'enemy-a' },
          { ...createKiboCombo(frameToMs(120)), targetId: 'enemy-b' },
        ],
      },
    });
    expect(crossTarget.diagnostics).toHaveLength(2);
    expect(
      crossTarget.diagnostics.every(
        item => item.code === ACTION_RULE_CODES.JOINT_ATTACK_TARGET_MISMATCH
      )
    ).toBe(true);
    expect(
      crossTarget.readinessTimeline.actions.every(
        action => action.executable === false
      )
    ).toBe(true);

    const duplicateSide = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        actions: [
          createActorCombo(frameToMs(120)),
          {
            ...createActorCombo(frameToMs(120)),
            id: 'actor-combo-duplicate',
          },
          createKiboCombo(frameToMs(120)),
        ],
      },
    });
    expect(duplicateSide.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.JOINT_ATTACK_DUPLICATE_SIDE,
          actionId: 'actor-combo',
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.JOINT_ATTACK_DUPLICATE_SIDE,
          actionId: 'actor-combo-duplicate',
        }),
      ])
    );
    expect(
      duplicateSide.readinessTimeline.actions
        .filter(action => action.actionType === 'skill')
        .every(action => action.executable === false)
    ).toBe(true);

    const atomicRollback = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        jointAttackRuntime: createVerifiedJointAttackRuntimeBinding(),
        actions: [
          createActorCombo(frameToMs(120)),
          createKiboCombo(frameToMs(120)),
        ],
      },
      externallyBlockedActionIds: ['kibo-combo'],
    });
    expect(
      atomicRollback.readinessTimeline.actions.find(
        action => action.actionId === 'actor-combo'
      )
    ).toMatchObject({
      executable: false,
      violationCodes: expect.arrayContaining([
        ACTION_RULE_CODES.JOINT_ATTACK_COUNTERPART_BLOCKED,
      ]),
    });

    const firstActor = {
      ...createActorCombo(frameToMs(120)),
      id: 'actor-combo-first',
    };
    const firstKibo = {
      ...createKiboCombo(frameToMs(120)),
      id: 'kibo-combo-first',
    };
    const secondActor = {
      ...createActorCombo(frameToMs(180)),
      id: 'actor-combo-second',
    };
    const secondKibo = {
      ...createKiboCombo(frameToMs(180)),
      id: 'kibo-combo-second',
    };
    const cooldownRollback = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        jointAttackRuntime: createVerifiedJointAttackRuntimeBinding(),
        actions: [firstActor, firstKibo, secondActor, secondKibo],
      },
    });
    expect(
      cooldownRollback.readinessTimeline.actions.find(
        action => action.actionId === 'kibo-combo-second'
      )
    ).toMatchObject({
      executable: false,
      violationCodes: expect.arrayContaining([
        ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
      ]),
    });
    expect(
      cooldownRollback.readinessTimeline.actions.find(
        action => action.actionId === 'actor-combo-second'
      )
    ).toMatchObject({
      executable: false,
      violationCodes: expect.arrayContaining([
        ACTION_RULE_CODES.JOINT_ATTACK_COUNTERPART_BLOCKED,
      ]),
    });
  });

  it('consumes configured cooldown charges before reporting a violation', () => {
    const scenario = {
      actors: [createActor()],
      actions: [
        createSkillAction({
          id: 'action-1',
          startMs: 0,
          durationMs: 100,
          cooldownMs: 5000,
          cooldownCount: 2,
        }),
        createSkillAction({
          id: 'action-2',
          startMs: 1000,
          durationMs: 100,
          cooldownMs: 5000,
          cooldownCount: 2,
        }),
        createSkillAction({
          id: 'action-3',
          startMs: 2000,
          durationMs: 100,
          cooldownMs: 5000,
          cooldownCount: 2,
        }),
        createSkillAction({
          id: 'action-4',
          startMs: 5000,
          durationMs: 100,
          cooldownMs: 5000,
          cooldownCount: 2,
        }),
      ],
    };

    const result = createActionRuleDiagnostics({ scenario });
    const cooldownRows = result.diagnostics.filter(
      item => item.code === ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE
    );

    expect(cooldownRows).toEqual([
      expect.objectContaining({
        actionId: 'action-3',
        blockingActionId: 'action-1',
        cooldownCount: 2,
        readyAtMs: 5000,
      }),
    ]);
    expect(result.readinessTimeline.cooldownWindows).toEqual([
      expect.objectContaining({
        actionId: 'action-1',
        chargeIndex: null,
        cooldownType: 'charge',
        startMs: 0,
        endMs: 5000,
        status: 'skill-charge-cooldown-cycle-completed-naturally',
      }),
      expect.objectContaining({
        actionId: 'action-2',
        chargeIndex: null,
        cooldownType: 'charge',
        startMs: 5000,
        endMs: 10000,
        status: 'skill-charge-cooldown-cycle-active',
      }),
    ]);
    const readinessById = new Map(
      result.readinessTimeline.actions.map(action => [action.actionId, action])
    );
    expect(readinessById.get('action-1').cooldown).toMatchObject({
      availableBefore: 2,
      availableAfter: 1,
      nextReadyAtMs: 5000,
      chargeStateAfter: {
        currentChargeCount: 1,
        coolTimeMs: 5000,
        sharedTimerRunning: true,
      },
    });
    expect(readinessById.get('action-2').cooldown).toMatchObject({
      availableBefore: 1,
      availableAfter: 0,
      nextReadyAtMs: 5000,
      chargeStateBefore: {
        currentChargeCount: 1,
        coolTimeMs: 4000,
      },
      chargeStateAfter: {
        currentChargeCount: 0,
        coolTimeMs: 4000,
      },
    });
    expect(readinessById.get('action-4').cooldown).toMatchObject({
      availableBefore: 1,
      availableAfter: 0,
      nextReadyAtMs: 10000,
      chargeStateBefore: {
        currentChargeCount: 1,
        coolTimeMs: 5000,
      },
      chargeStateAfter: {
        currentChargeCount: 0,
        coolTimeMs: 5000,
      },
    });
    expect(
      result.readinessTimeline.actions.find(
        action => action.actionId === 'action-3'
      )
    ).toMatchObject({
      status: 'blocked',
      cooldown: {
        status: 'blocked-no-charge-ready',
        availableBefore: 0,
        availableAfter: 0,
        nextReadyAtMs: 5000,
      },
    });
  });

  it('recovers charge cooldowns sequentially on one shared timer', () => {
    const result = createActionRuleDiagnostics({
      scenario: {
        time: { durationMs: 30_000, fps: 60 },
        actors: [createActor()],
        actions: [
          createSkillAction({
            id: 'shared-charge-1',
            startMs: 0,
            durationMs: 100,
            cooldownMs: 15_000,
            cooldownCount: 2,
          }),
          createSkillAction({
            id: 'shared-charge-2',
            startMs: 1_000,
            durationMs: 100,
            cooldownMs: 15_000,
            cooldownCount: 2,
          }),
        ],
      },
    });

    const readinessById = new Map(
      result.readinessTimeline.actions.map(action => [action.actionId, action])
    );
    expect(readinessById.get('shared-charge-1').cooldown).toMatchObject({
      availableBefore: 2,
      availableAfter: 1,
      nextReadyAtMs: 15_000,
      chargeStateAfter: {
        currentChargeCount: 1,
        coolTimeMs: 15_000,
        sharedTimerRunning: true,
      },
    });
    expect(readinessById.get('shared-charge-2').cooldown).toMatchObject({
      availableBefore: 1,
      availableAfter: 0,
      nextReadyAtMs: 15_000,
      chargeStateBefore: {
        currentChargeCount: 1,
        coolTimeMs: 14_000,
      },
      chargeStateAfter: {
        currentChargeCount: 0,
        coolTimeMs: 14_000,
      },
    });
    expect(result.readinessTimeline.cooldownWindows).toEqual([
      expect.objectContaining({
        actionId: 'shared-charge-1',
        startMs: 0,
        endMs: 15_000,
        status: 'skill-charge-cooldown-cycle-completed-naturally',
      }),
      expect.objectContaining({
        actionId: 'shared-charge-2',
        startMs: 15_000,
        endMs: 30_000,
        status: 'skill-charge-cooldown-cycle-completed-naturally',
      }),
    ]);
    expect(result.cooldownState).toEqual([
      expect.objectContaining({
        cooldownType: 'charge',
        fullCooldownMs: 15_000,
        chargeMaxCount: 2,
        currentChargeCount: 2,
        coolTimeMs: 15_000,
        sharedTimerRunning: false,
        nextReadyAtMs: null,
        missingChargeSourceActionIds: [],
      }),
    ]);
  });

  it('returns an executable ready contract when no checked rule is violated', () => {
    const result = createActionRuleDiagnostics({
      scenario: {
        actors: [createActor()],
        actions: [
          createSkillAction({ id: 'action-1', startMs: 0, cooldownMs: 5000 }),
          createSkillAction({
            id: 'action-2',
            startMs: 5000,
            cooldownMs: 5000,
          }),
        ],
      },
    });

    expect(result).toMatchObject({
      status: 'action-rules-ready',
      executable: true,
      diagnostics: [],
      summary: {
        violationCount: 0,
        unresolvedCount: 0,
      },
    });
  });

  it('diagnoses deleted and reordered normal attack inputs without repairing the chain', () => {
    const result = createActionRuleDiagnostics({
      scenario: {
        actors: [createActor()],
        actions: [
          createSkillAction({
            id: 'attack-a1',
            name: 'A1',
            startMs: 0,
            attackGroupId: 'attack-group-1',
            attackSequenceIndex: 1,
            attackSequenceTotal: 4,
          }),
          createSkillAction({
            id: 'attack-a2',
            name: 'A2',
            startMs: 2000,
            attackGroupId: 'attack-group-1',
            attackSequenceIndex: 2,
            attackSequenceTotal: 4,
          }),
          createSkillAction({
            id: 'attack-a4',
            name: 'A4',
            startMs: 1000,
            attackGroupId: 'attack-group-1',
            attackSequenceIndex: 4,
            attackSequenceTotal: 4,
          }),
        ],
      },
    });

    expect(result.executable).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
          missingSequenceIndexes: [3],
          actionIds: ['attack-a1', 'attack-a2', 'attack-a4'],
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_ORDER_INVALID,
          actionId: 'attack-a4',
        }),
      ])
    );
    expect(result.readinessTimeline.actions).toHaveLength(3);
  });

  it('hard-blocks a standalone successor while keeping an A1-only prefix legal', () => {
    const a1 = createSkillAction({
      id: 'legal-prefix-a1',
      name: 'A1',
      startMs: 0,
      attackGroupId: 'legal-prefix',
      attackInputChainIdentity: 'source-chain',
      attackSequenceIndex: 1,
      attackSequenceTotal: 3,
      attackInput: {
        linkTimingStatus: 'applied',
        linkWindow: { startFrame: 20, endFrame: 40 },
      },
    });
    const prefix = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        objectiveContract: { classification: 'primary' },
        actors: [createActor()],
        actions: [a1],
      },
    });
    expect(prefix.executable).toBe(true);
    expect(prefix.diagnostics).toEqual([]);

    const standaloneA2 = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        objectiveContract: { classification: 'primary' },
        actors: [createActor()],
        actions: [
          createSkillAction({
            id: 'standalone-a2',
            name: 'A2',
            startMs: frameToMs(20),
            attackGroupId: 'orphan-chain',
            attackInputChainIdentity: 'source-chain',
            attackSequenceIndex: 2,
            attackSequenceTotal: 3,
          }),
        ],
      },
    });
    expect(standaloneA2.executable).toBe(false);
    expect(standaloneA2.diagnostics).toEqual([
      expect.objectContaining({
        code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
        status: 'violated',
        actionId: 'standalone-a2',
        missingSequenceIndexes: [1],
      }),
    ]);
    expect(standaloneA2.readinessTimeline.actions[0]).toMatchObject({
      executable: false,
      status: 'blocked',
    });
  });

  it('enforces the sourced normal-chain window as a right-open interval', () => {
    const createBoundary = nextFrame =>
      createActionRuleDiagnostics({
        scenario: {
          time: { fps: 60 },
          objectiveContract: { classification: 'primary' },
          actors: [createActor()],
          actions: [
            createSkillAction({
              id: `boundary-a1-${nextFrame}`,
              name: 'A1',
              startMs: 0,
              durationMs: frameToMs(5),
              attackGroupId: `boundary-${nextFrame}`,
              attackInputChainIdentity: 'source-chain',
              attackSequenceIndex: 1,
              attackSequenceTotal: 2,
              attackInput: {
                linkTimingStatus: 'applied',
                linkWindow: { startFrame: 20, endFrame: 40 },
              },
            }),
            createSkillAction({
              id: `boundary-a2-${nextFrame}`,
              name: 'A2',
              startMs: frameToMs(nextFrame),
              durationMs: frameToMs(5),
              attackGroupId: `boundary-${nextFrame}`,
              attackInputChainIdentity: 'source-chain',
              attackSequenceIndex: 2,
              attackSequenceTotal: 2,
            }),
          ],
        },
      });

    expect(createBoundary(20).executable).toBe(true);
    expect(createBoundary(39).executable).toBe(true);
    expect(createBoundary(19).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_EARLY,
          status: 'violated',
        }),
      ])
    );
    expect(createBoundary(40).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_LATE,
          status: 'violated',
        }),
      ])
    );
  });

  it('rejects skipped, repeated, cross-owner, interrupted, and mismatched chain predecessors', () => {
    const actorA = createActor();
    const actorB = { ...createActor(), id: 'actor-2', name: '第二角色' };
    const segment = ({
      id,
      actor = actorA,
      groupId,
      sequenceIndex,
      startFrame,
      chainIdentity = 'chain-a',
      contextActionId = null,
    }) =>
      createSkillAction({
        id,
        name: `A${sequenceIndex}`,
        actor,
        actorId: actor.id,
        startMs: frameToMs(startFrame),
        durationMs: 1,
        attackGroupId: groupId,
        attackInputChainIdentity: chainIdentity,
        attackSequenceIndex: sequenceIndex,
        attackSequenceTotal: 3,
        ...(contextActionId ? { contextActionId } : {}),
        ...(sequenceIndex === 1
          ? {
              attackInput: {
                linkTimingStatus: 'applied',
                linkWindow: { startFrame: 10, endFrame: 30 },
              },
            }
          : {}),
      });
    const diagnose = (actions, actors = [actorA, actorB]) =>
      createActionRuleDiagnostics({
        scenario: {
          time: { fps: 60 },
          objectiveContract: { classification: 'primary' },
          actors,
          actions,
        },
      });

    const skipped = diagnose([
      segment({
        id: 'skip-a1',
        groupId: 'skip',
        sequenceIndex: 1,
        startFrame: 0,
      }),
      segment({
        id: 'skip-a3',
        groupId: 'skip',
        sequenceIndex: 3,
        startFrame: 20,
      }),
    ]);
    expect(skipped.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'skip-a3',
          reason: 'attack-input-predecessor-required',
          missingSequenceIndexes: [2],
        }),
      ])
    );

    const repeated = diagnose([
      segment({
        id: 'repeat-a1',
        groupId: 'repeat',
        sequenceIndex: 1,
        startFrame: 0,
      }),
      segment({
        id: 'repeat-a2-first',
        groupId: 'repeat',
        sequenceIndex: 2,
        startFrame: 10,
      }),
      segment({
        id: 'repeat-a2-second',
        groupId: 'repeat',
        sequenceIndex: 2,
        startFrame: 11,
      }),
    ]);
    expect(repeated.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'repeat-a2-second',
          reason: 'attack-input-predecessor-already-consumed',
        }),
      ])
    );

    const crossActor = diagnose([
      segment({
        id: 'cross-a1',
        groupId: 'cross',
        sequenceIndex: 1,
        startFrame: 0,
      }),
      segment({
        id: 'cross-a2',
        actor: actorB,
        groupId: 'cross',
        sequenceIndex: 2,
        startFrame: 10,
      }),
    ]);
    expect(crossActor.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'cross-a2',
          reason: 'attack-input-cross-actor-predecessor',
        }),
      ])
    );

    const interrupted = diagnose([
      segment({
        id: 'interrupt-a1',
        groupId: 'interrupt',
        sequenceIndex: 1,
        startFrame: 0,
      }),
      {
        id: 'interrupt-switch',
        type: 'switch',
        name: '切人',
        actorId: actorA.id,
        targetActorId: actorB.id,
        startMs: frameToMs(5),
        durationMs: 0,
      },
      segment({
        id: 'interrupt-a2',
        groupId: 'interrupt',
        sequenceIndex: 2,
        startFrame: 10,
      }),
    ]);
    expect(interrupted.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'interrupt-a2',
          reason: 'attack-input-chain-interrupted',
          blockingActionId: 'interrupt-switch',
        }),
      ])
    );

    const ordinarySkillReset = diagnose([
      segment({
        id: 'reset-a1',
        groupId: 'reset-chain',
        sequenceIndex: 1,
        startFrame: 0,
      }),
      createSkillAction({
        id: 'reset-unknown-skill',
        name: '未知取消规则技能',
        actor: actorA,
        actorId: actorA.id,
        actionKind: 'star-skill',
        startMs: frameToMs(15),
        durationMs: 1,
      }),
      segment({
        id: 'reset-a2',
        groupId: 'reset-chain',
        sequenceIndex: 2,
        startFrame: 20,
      }),
    ]);
    expect(ordinarySkillReset.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'reset-a2',
          reason: 'attack-input-chain-interrupted',
          blockingActionId: 'reset-unknown-skill',
          status: 'violated',
        }),
      ])
    );

    const continuityRules =
      mechanicsPackage.actionVariantGraph.attackInputChains
        .flatMap(chain =>
          (chain.continuityRules ?? []).map(rule => ({ chain, rule }))
        )
        .filter(entry => entry.rule.applied === true);
    expect(continuityRules).toHaveLength(1);
    expect(continuityRules[0]).toMatchObject({
      chain: {
        ownerId: 103002,
        chainIdentity: 'ruby-enhanced-twelve-inputs',
      },
      rule: {
        intermediaryControlSkillId: 10300215,
        inputCommand: 'normal-attack',
        resumePolicy: 'next-segment',
        inputWindow: { startFrame: 30, endFrame: 246 },
        applied: true,
      },
    });
    const rubyActor = {
      ...createActor(),
      id: 'actor-103002',
      characterId: 103002,
      name: '红宝石',
    };
    const createRubyContinuity = resumeFrame => [
      createSkillAction({
        id: `ruby-e1-${resumeFrame}`,
        actor: rubyActor,
        actorId: rubyActor.id,
        skillId: 10300201,
        actionKind: 'normal-attack',
        startMs: 0,
        durationMs: 1,
        attackGroupId: `ruby-chain-${resumeFrame}`,
        attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
        attackSequenceIndex: 1,
        attackSequenceTotal: 12,
      }),
      createSkillAction({
        id: `ruby-counter-${resumeFrame}`,
        actor: rubyActor,
        actorId: rubyActor.id,
        skillId: 10300201,
        actionVariantIndex: 2,
        actionKind: 'dodge-attack',
        startMs: frameToMs(24),
        durationMs: 1,
      }),
      createSkillAction({
        id: `ruby-e2-${resumeFrame}`,
        actor: rubyActor,
        actorId: rubyActor.id,
        skillId: 10300201,
        actionKind: 'normal-attack',
        startMs: frameToMs(24 + resumeFrame),
        durationMs: 1,
        attackGroupId: `ruby-chain-${resumeFrame}`,
        attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
        attackSequenceIndex: 2,
        attackSequenceTotal: 12,
      }),
    ];
    const rubyExactStart = diagnose(createRubyContinuity(30), [rubyActor]);
    expect(
      rubyExactStart.diagnostics.filter(
        diagnostic =>
          diagnostic.actionId === 'ruby-e2-30' &&
          diagnostic.ruleKey === 'normal-attack-input-chain'
      )
    ).toEqual([]);
    const rubyExactEnd = diagnose(createRubyContinuity(246), [rubyActor]);
    expect(rubyExactEnd.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'ruby-e2-246',
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_LATE,
          relativeStartFrame: 246,
          continuityRuleIdentity: 'ruby-enhanced-dodge-chain-continuity',
        }),
      ])
    );

    const mismatched = diagnose([
      segment({
        id: 'mismatch-a1',
        groupId: 'mismatch',
        sequenceIndex: 1,
        startFrame: 0,
      }),
      segment({
        id: 'mismatch-a2',
        groupId: 'mismatch',
        sequenceIndex: 2,
        startFrame: 10,
        chainIdentity: 'chain-b',
        contextActionId: 'not-mismatch-a1',
      }),
    ]);
    expect(mismatched.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'mismatch-a2',
          reason: 'attack-input-predecessor-identity-mismatch',
          expectedContextActionId: 'mismatch-a1',
        }),
      ])
    );

    const contextualConflictAction = segment({
      id: 'context-conflict-a1',
      groupId: 'context-conflict',
      sequenceIndex: 1,
      startFrame: 0,
      chainIdentity: 'explicit-chain',
    });
    contextualConflictAction.attackInput.attackInputChainIdentity =
      'context-derived-chain';
    const contextualConflict = diagnose([contextualConflictAction]);
    expect(contextualConflict.diagnostics).toEqual([
      expect.objectContaining({
        actionId: 'context-conflict-a1',
        code: ACTION_RULE_CODES.ATTACK_INPUT_CONTEXT_CONFLICT,
        reason: 'attack-input-explicit-context-chain-conflict',
        status: 'violated',
      }),
    ]);

    const restarted = diagnose([
      {
        ...segment({
          id: 'complete-a1',
          groupId: 'complete',
          sequenceIndex: 1,
          startFrame: 0,
        }),
        attackSequenceTotal: 2,
      },
      {
        ...segment({
          id: 'complete-a2',
          groupId: 'complete',
          sequenceIndex: 2,
          startFrame: 10,
        }),
        attackSequenceTotal: 2,
      },
      segment({
        id: 'restart-a1',
        groupId: 'restart',
        sequenceIndex: 1,
        startFrame: 40,
      }),
    ]);
    expect(restarted.executable).toBe(true);
    expect(restarted.diagnostics).toEqual([]);
  });

  it('does not classify an arbitrary Kibo break packet as a joint attack', () => {
    const actor = { ...createActor(), loadout: { kiboId: 500001 } };
    const result = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [actor],
        actions: [
          {
            id: 'ordinary-break',
            type: 'kiboEvent',
            skillId: 50000102,
            eventType: 'break',
            actionKind: 'break',
            actorId: actor.id,
            actor,
            kiboId: 500001,
            startMs: 0,
            durationMs: 100,
          },
        ],
      },
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.summary.jointAttackViolationCount).toBe(0);
  });

  it('rolls back a successor when its predecessor was rule-blocked', () => {
    const blocker = createSkillAction({
      id: 'lane-blocker',
      startMs: 0,
      durationMs: frameToMs(30),
    });
    const a1 = createSkillAction({
      id: 'blocked-a1',
      name: 'A1',
      startMs: frameToMs(10),
      durationMs: frameToMs(5),
      attackGroupId: 'blocked-chain',
      attackSequenceIndex: 1,
      attackSequenceTotal: 2,
      attackInput: {
        linkTimingStatus: 'applied',
        linkWindow: { startFrame: 20, endFrame: 40 },
      },
    });
    const a2 = createSkillAction({
      id: 'dependent-a2',
      name: 'A2',
      startMs: frameToMs(30),
      durationMs: frameToMs(5),
      attackGroupId: 'blocked-chain',
      attackSequenceIndex: 2,
      attackSequenceTotal: 2,
    });
    const result = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [createActor()],
        actions: [blocker, a1, a2],
      },
    });
    expect(result.readinessTimeline.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'blocked-a1',
          executable: false,
        }),
        expect.objectContaining({
          actionId: 'dependent-a2',
          executable: false,
          violationCodes: expect.arrayContaining([
            ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
          ]),
        }),
      ])
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'dependent-a2',
          blockingActionId: 'blocked-a1',
          reason: 'attack-input-predecessor-not-accepted',
        }),
      ])
    );
  });

  it('keeps free placement while diagnosing real normal-attack input windows', () => {
    const createPair = ({
      groupId,
      baseFrame,
      nextFrame,
      status = 'applied',
    }) => [
      createSkillAction({
        id: `${groupId}-a1`,
        name: 'A1',
        startMs: frameToMs(baseFrame),
        durationMs: frameToMs(5),
        attackGroupId: groupId,
        attackSequenceIndex: 1,
        attackSequenceTotal: 2,
        attackInput: {
          linkTimingStatus: status,
          linkTimingReasons:
            status === 'applied'
              ? []
              : ['next-control-event-bridge-window-unavailable'],
          linkWindow:
            status === 'applied' ? { startFrame: 19, endFrame: 46 } : null,
        },
      }),
      createSkillAction({
        id: `${groupId}-a2`,
        name: 'A2',
        startMs: frameToMs(baseFrame + nextFrame),
        durationMs: frameToMs(5),
        attackGroupId: groupId,
        attackSequenceIndex: 2,
        attackSequenceTotal: 2,
      }),
    ];
    const result = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [createActor()],
        actions: [
          ...createPair({ groupId: 'early', baseFrame: 0, nextFrame: 10 }),
          ...createPair({ groupId: 'valid', baseFrame: 100, nextFrame: 19 }),
          ...createPair({ groupId: 'late', baseFrame: 200, nextFrame: 50 }),
          ...createPair({
            groupId: 'unknown',
            baseFrame: 300,
            nextFrame: 20,
            status: 'unresolved',
          }),
        ],
      },
    });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_EARLY,
          actionId: 'early-a2',
          relativeStartFrame: 10,
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_LATE,
          actionId: 'late-a2',
          relativeStartFrame: 50,
        }),
        expect.objectContaining({
          code: ACTION_RULE_CODES.ATTACK_INPUT_LINK_TIMING_UNRESOLVED,
          actionId: 'unknown-a2',
        }),
      ])
    );
    expect(result.diagnostics.some(item => item.actionId === 'valid-a2')).toBe(
      false
    );
    expect(result.executable).toBe(true);
  });
});

function createActor() {
  return {
    id: 'actor-1',
    name: '测试角色',
    initialSp: 50,
    stats: { maxSp: 100 },
  };
}

function createSkillAction({
  id,
  skillId = 1001,
  name = '星鸣技',
  startMs,
  durationMs = 500,
  cooldownMs = 0,
  cooldownCount = 1,
  spCost = 0,
  ...extra
}) {
  return {
    id,
    type: 'skill',
    skillId,
    name,
    actorId: 'actor-1',
    actor: createActor(),
    startMs,
    durationMs,
    logicModel: {
      status: 'mapped',
      logic: {
        sourceKind: 'azpr-newtable-skill-logic-index',
        subSkillId: skillId,
        cooldownMs,
        cooldownCount,
        spCost,
        fieldPaths: {
          cooldownMs: `skillsub_logic.rows[skillId=${skillId}].coolDown`,
          spCost: `skillsub_logic.rows[skillId=${skillId}].spCost`,
        },
      },
    },
    ...extra,
  };
}
