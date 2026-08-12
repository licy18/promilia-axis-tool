import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-authority.json';
import xiaoyuVisualFixture from '../../../fixtures/character-acceptance/101010-visual.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  resolveMachineAxisSchedules,
  validateMachineAxisContract,
} from '../../machine-axis/machineAxisContract';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createActionEffectRuntimeInput,
  createEffectRuntimeTimeline,
} from '../../simulation/runtime/effectRuntimeTimeline';
import { createCanonicalCombatEvaluation } from '../../simulation/headless/canonicalHeadlessCombatCore';

const PANGPANG_PLUNGING_HIT = '10100711|0|elements|0|-6537565703316603243|35|1';

describe('Machine Axis external audit boundaries', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  describe('M11-01 captured critical roll units', () => {
    it.each([
      [0, true],
      [1, true],
      [2, true],
      [499, true],
      [500, false],
      [9999, false],
    ])(
      'interprets captured roll %i as basis points',
      (criticalRoll, critical) => {
        const service = createMachineAxisService();
        const axis = createPangpangPlungingAxis({ criticalRoll });
        expect(service.validate(axis).issues).toEqual([]);
        const run = service.simulate(axis);
        const branch = run.trace.damage.find(
          event => event.actionId === 'boundary-plunging'
        )?.formula?.randomBranch;

        expect(branch).toMatchObject({
          policy: 'captured-critical-roll',
          criticalRoll,
          criticalRollUnit: 'basis-points',
          normalizedCriticalRoll: criticalRoll / 10_000,
          critical,
        });
      },
      15_000
    );
  });

  describe('M11-02 raw JSON Schema boundary', () => {
    it('rejects missing required fields before defaults are applied', () => {
      const axis = cloneFixture();
      delete axis.scenario.projectile.defaultWillHit;

      const result = validateMachineAxisContract(axis);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-schema-required',
          path: 'scenario.projectile.defaultWillHit',
        })
      );
    });

    it('rejects additional properties and string booleans without coercion', () => {
      const axis = cloneFixture();
      axis.scenario.unpublishedFlag = true;
      axis.scenario.projectile.defaultWillHit = 'false';

      const result = validateMachineAxisContract(axis);

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'machine-axis-schema-additional-property',
            path: 'scenario.unpublishedFlag',
          }),
          expect.objectContaining({
            code: 'machine-axis-schema-type',
            path: 'scenario.projectile.defaultWillHit',
          }),
        ])
      );
      expect(result.normalized).toBeNull();
    });
  });

  describe('M11-03 schedule boundaries', () => {
    it('rejects absolute and relative schedules before frame zero', () => {
      const absolute = resolveMachineAxisSchedules(
        [createWaitAction('negative', -1, 1)],
        {
          scenarioDurationFrames: 60,
          resolveDurationFrames: action => action.intent.durationFrames,
        }
      );
      const relative = resolveMachineAxisSchedules(
        [
          createWaitAction('first', 0, 10),
          {
            ...createWaitAction('second', null, 1),
            schedule: {
              mode: 'after-previous-end',
              actionId: null,
              frame: null,
              offsetFrames: -11,
            },
          },
        ],
        {
          scenarioDurationFrames: 60,
          resolveDurationFrames: action => action.intent.durationFrames,
        }
      );

      expect(absolute.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-schedule-start-before-zero',
          actionId: 'negative',
          startFrame: -1,
        })
      );
      expect(relative.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-schedule-start-before-zero',
          actionId: 'second',
          startFrame: -1,
        })
      );
    });

    it('allows frame zero and rejects starts beyond the scenario horizon', () => {
      const atZero = resolveMachineAxisSchedules(
        [createWaitAction('at-zero', 0, 1)],
        {
          scenarioDurationFrames: 60,
          resolveDurationFrames: action => action.intent.durationFrames,
        }
      );
      const beyond = resolveMachineAxisSchedules(
        [createWaitAction('beyond', 61, 1)],
        {
          scenarioDurationFrames: 60,
          resolveDurationFrames: action => action.intent.durationFrames,
        }
      );

      expect(atZero.valid).toBe(true);
      expect(atZero.byActionId['at-zero'].startFrame).toBe(0);
      expect(beyond.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-schedule-start-after-horizon',
          actionId: 'beyond',
          startFrame: 61,
          scenarioDurationFrames: 60,
        })
      );
    });
  });

  describe('M11-04 context-resolved durations', () => {
    it('uses Ruby plunging actual occupancy for after-action-end', () => {
      const axis = cloneFixture();
      axis.actions.push({
        ...createWaitAction('after-ruby-e1', null, 1),
        schedule: {
          mode: 'after-action-end',
          actionId: 'ruby-plunging',
          frame: null,
          offsetFrames: 0,
        },
      });

      const prepared = createMachineAxisService().prepare(axis);
      const ruby = prepared.actionResolutions.find(
        action => action.actionId === 'ruby-plunging'
      );
      const after = prepared.actionResolutions.find(
        action => action.actionId === 'after-ruby-e1'
      );

      expect(prepared.valid).toBe(true);
      expect(ruby).toMatchObject({
        publicActionId: 10300201,
        actionKind: 'plunging-attack',
        durationFrames: 55,
      });
      expect(after.startFrame).toBe(ruby.startFrame + ruby.durationFrames);
    }, 30_000);

    it('uses a state-selected Xiaoyu charged form before resolving the next action', () => {
      const axis = structuredClone(xiaoyuVisualFixture);
      axis.actions.push({
        ...createWaitAction('after-xiaoyu-enhanced-charged', null, 1),
        schedule: {
          mode: 'after-action-end',
          actionId: 'xiaoyu-enhanced-charged',
          frame: null,
          offsetFrames: 0,
        },
      });

      const prepared = createMachineAxisService().prepare(axis);
      const burst = prepared.actionResolutions.find(
        action => action.actionId === 'xiaoyu-enhanced-charged'
      );
      const after = prepared.actionResolutions.find(
        action => action.actionId === 'after-xiaoyu-enhanced-charged'
      );

      expect(prepared.valid).toBe(true);
      expect(burst).toMatchObject({
        resolvedControlSkillId: 10101010,
        resolvedSubSkillIndex: 2,
        durationFrames: 64,
      });
      expect(after.startFrame).toBe(burst.startFrame + burst.durationFrames);
    }, 30_000);
  });

  describe('M11-05 scenario horizon', () => {
    it('rejects actions that cross the inclusive scenario endpoint', () => {
      const axis = cloneFixture();
      axis.scenario.durationFrames = 60;
      axis.actions = [createWaitAction('crossing', 59, 2)];

      const validation = createMachineAxisService().validate(axis);

      expect(validation.valid).toBe(false);
      expect(validation.classification).toMatchObject({
        schemaStatus: 'schema-valid',
        runnabilityStatus: 'not-runnable',
      });
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-action-crosses-horizon',
          actionId: 'crossing',
          startFrame: 59,
          endFrame: 61,
          scenarioDurationFrames: 60,
        })
      );
    });

    it('applies effects before and at T, but never after T', () => {
      const scenario = {
        time: { durationMs: 1000, fps: 60 },
        actors: [{ id: 'actor-1', name: 'Actor 1' }],
        actions: [],
        initialRuntimeState: { activeEffects: [] },
      };
      const generatedCommands = [
        createGeneratedEffect('before-t', 59),
        createGeneratedEffect('at-t', 60),
        createGeneratedEffect('after-t', 61),
      ];
      const effectInput = createActionEffectRuntimeInput({
        scenario,
        generatedCommands,
      });
      const timeline = createEffectRuntimeTimeline({ scenario, effectInput });

      expect(effectInput.commands.map(command => command.effectId)).toEqual([
        'before-t',
        'at-t',
      ]);
      expect(effectInput.summary).toMatchObject({
        commandCount: 2,
        afterHorizonCommandCount: 1,
      });
      expect(
        timeline.events
          .filter(event => event.type === 'EFFECT_APPLIED')
          .map(event => [event.effectId, event.frameIndex])
      ).toEqual([
        ['before-t', 59],
        ['at-t', 60],
      ]);
      expect(timeline.activeEffects.map(effect => effect.effectId)).toEqual([
        'before-t',
        'at-t',
      ]);
    });
  });

  describe('M11-06 validation evidence states', () => {
    it('reports runnable assumptions without claiming evidence closure', () => {
      const validation = createMachineAxisService().validate(cloneFixture());

      expect(validation.valid).toBe(true);
      expect(validation.classification).toEqual({
        schemaStatus: 'schema-valid',
        runnabilityStatus: 'runnable-with-assumptions',
        evidenceStatus: 'evidence-open',
      });
      expect(validation.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'warning',
            code: 'machine-axis-scenario-assumption',
            actionId: 'xunlang-signature',
            scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
          }),
          expect.objectContaining({
            severity: 'warning',
            code: 'machine-axis-action-conditions-unresolved',
            actionId: 'switch-to-xiaoyu--on-enter--actor-101010--star-carry',
            unresolvedCodes: ['actor-switch-exit-tail-order-unresolved'],
          }),
        ])
      );
    }, 30_000);
  });

  describe('M11-07 evaluation conservation', () => {
    it('separates combat hits from toughness recovery state events', () => {
      const evaluation = createCanonicalCombatEvaluation({
        scenario: { durationMs: 1000 },
        summary: {
          totalSelfEnergyDelta: 4,
          executedActionCount: 1,
          skippedActionCount: 0,
        },
        damageTimeline: [
          {
            actionId: 'combat-action',
            actorId: 'actor-1',
            rawDamage: 10,
            toughnessDamage: 3,
          },
          {
            actionId: 'toughness-runtime',
            actorId: 'enemy',
            rawDamage: 0,
            toughnessDamage: -2,
            stateEventKind: 'normal-toughness-recovery',
          },
        ],
      });

      expect(evaluation.totals).toMatchObject({
        hpDamage: 10,
        combatHitCount: 1,
        projectedHitCount: 1,
        stateEventCount: 1,
        inflictedToughnessDamage: 3,
        recoveredToughness: 2,
        netToughnessDamage: 1,
      });
      expect(evaluation.byAction).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            identity: 'combat-action',
            combatHitCount: 1,
            stateEventCount: 0,
            inflictedToughnessDamage: 3,
            recoveredToughness: 0,
          }),
          expect.objectContaining({
            identity: 'toughness-runtime',
            combatHitCount: 0,
            stateEventCount: 1,
            inflictedToughnessDamage: 0,
            recoveredToughness: 2,
          }),
        ])
      );
      expect(
        evaluation.byAction.reduce((sum, row) => sum + row.combatHitCount, 0)
      ).toBe(evaluation.totals.combatHitCount);
      expect(
        evaluation.byActor.reduce((sum, row) => sum + row.recoveredToughness, 0)
      ).toBe(evaluation.totals.recoveredToughness);
    });

    it('conserves the merged 120 second fixture across totals and groups', () => {
      const evaluation =
        createMachineAxisService().simulate(cloneFixture()).evaluation;
      const ruby = evaluation.byAction.find(
        row => row.identity === 'ruby-plunging'
      );

      expect(evaluation.totals).toMatchObject({
        combatHitCount: 28,
        projectedHitCount: 28,
        stateEventCount: 0,
        hpDamage: 4064,
        inflictedToughnessDamage: 0,
        recoveredToughness: 0,
      });
      expect(ruby).toMatchObject({
        combatHitCount: 1,
        hitCount: 1,
        stateEventCount: 0,
        hpDamage: 133,
        inflictedToughnessDamage: 0,
        recoveredToughness: 0,
      });
      expect(
        evaluation.byAction.reduce((sum, row) => sum + row.combatHitCount, 0)
      ).toBe(evaluation.totals.combatHitCount);
      expect(
        evaluation.byActor.reduce(
          (sum, row) => sum + row.inflictedToughnessDamage,
          0
        )
      ).toBe(evaluation.totals.inflictedToughnessDamage);
    }, 30_000);
  });

  describe('M11-08 duplicate kibo runtime owners', () => {
    it('allows the same species on different actors and isolates cooldown by runtime entity', () => {
      const axis = cloneFixture();
      axis.scenario.team[1].loadout.kiboId = 500001;
      axis.scenario.initialRuntimeState.kiboEnergyBySlot[1] = {
        slotId: 'slot-2',
        actorId: 'actor-101010',
        characterId: 101010,
        kiboId: 500001,
        kiboName: '迅狼',
        currentValue: 100,
        maxValue: 100,
      };
      const first = axis.actions.find(
        action => action.id === 'xunlang-signature'
      );
      axis.actions = [
        first,
        {
          id: 'switch-to-slot-2',
          owner: { kind: 'actor', slotId: 'slot-1' },
          intent: { kind: 'switch', targetSlotId: 'slot-2' },
          schedule: {
            mode: 'after-action-end',
            actionId: first.id,
            offsetFrames: 0,
          },
        },
        {
          ...structuredClone(first),
          id: 'xunlang-signature-slot-2',
          owner: { kind: 'kibo', slotId: 'slot-2' },
          schedule: {
            mode: 'after-action-end',
            actionId: 'switch-to-slot-2',
            offsetFrames: 0,
          },
        },
      ];

      const service = createMachineAxisService();
      const validation = service.validate(axis);
      const run = service.simulate(axis);
      const resolutions = run.actionResolutions.filter(
        action => action.publicActionId === 50000102
      );
      const cooldownStarts = run.trace.events.filter(
        event =>
          event.type === 'COOLDOWN_START' &&
          event.payload.runtimeOwnerIdentity?.endsWith('|kibo:500001')
      );

      expect(validation.valid).toBe(true);
      expect(resolutions).toHaveLength(2);
      expect(
        run.trace.executionPlan.actions
          .filter(action => action.actionId.startsWith('xunlang-signature'))
          .map(action => [action.actionId, action.execute])
      ).toEqual([
        ['xunlang-signature', true],
        ['xunlang-signature-slot-2', true],
      ]);
      expect(
        cooldownStarts.map(event => event.payload.runtimeOwnerIdentity)
      ).toEqual(['actor-101007|kibo:500001', 'actor-101010|kibo:500001']);
      expect(
        new Set(cooldownStarts.map(event => event.payload.runtimeOwnerIdentity))
      ).toEqual(
        new Set(['actor-101007|kibo:500001', 'actor-101010|kibo:500001'])
      );
      expect(
        run.trace.resources.kibos.filter(
          event => event.kiboId === 500001 && event.change === -100
        )
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actionId: 'xunlang-signature',
            actorId: 'actor-101007',
            beforeValue: 100,
            afterValue: 0,
          }),
          expect.objectContaining({
            actionId: 'xunlang-signature-slot-2',
            actorId: 'actor-101010',
            beforeValue: 100,
            afterValue: 0,
          }),
        ])
      );
    }, 30_000);
  });

  describe('M11-09 same-frame ordering', () => {
    it('uses integer frame and explicit source sequence instead of identities', () => {
      const scenario = {
        time: { durationMs: 1000, fps: 60 },
        actors: [{ id: 'actor-1', name: 'Actor 1' }],
        actions: [],
        initialRuntimeState: { activeEffects: [] },
      };
      const generatedCommands = [
        createGeneratedEffect('z-first-by-sequence', 30),
        createGeneratedEffect('a-second-by-sequence', 30),
      ];
      const effectInput = createActionEffectRuntimeInput({
        scenario,
        generatedCommands,
      });
      const timeline = createEffectRuntimeTimeline({ scenario, effectInput });
      const applied = timeline.events.filter(
        event => event.type === 'EFFECT_APPLIED'
      );

      expect(applied.map(event => event.effectId)).toEqual([
        'z-first-by-sequence',
        'a-second-by-sequence',
      ]);
      expect(applied.map(event => event.absoluteFrame)).toEqual([30, 30]);
    });

    it('marks simultaneous actor and kibo input ordering as unresolved', () => {
      const axis = cloneFixture();
      axis.actions = [
        {
          ...axis.actions.find(action => action.id === 'xunlang-signature'),
          schedule: { mode: 'absolute', frame: 60 },
        },
        {
          ...axis.actions.find(action => action.id === 'plunging-inherit'),
          schedule: { mode: 'absolute', frame: 60 },
        },
      ];

      const validation = createMachineAxisService().validate(axis);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-same-frame-order-unresolved',
          absoluteFrame: 60,
          actionIds: ['xunlang-signature', 'plunging-inherit'],
          ownerKinds: ['kibo', 'actor'],
        })
      );
      expect(validation.classification.evidenceStatus).toBe('evidence-open');
    }, 30_000);

    it('orders same-frame kibo and actor hits by source sequence', () => {
      const run = createMachineAxisService().simulate(
        createSameFrameCombatAxis({
          kiboActionId: 'z-kibo-source-first',
          actorActionId: 'a-actor-source-second',
        })
      );
      const sameFrame = run.trace.damage.filter(
        event => event.absoluteFrame === 80
      );

      expect(sameFrame).toHaveLength(4);
      expect(sameFrame.map(event => event.actionId)).toEqual([
        'z-kibo-source-first',
        'z-kibo-source-first',
        'z-kibo-source-first',
        'a-actor-source-second',
      ]);
      expect(sameFrame.map(event => event.runtimeSequenceIndex)).toEqual(
        [...sameFrame]
          .map(event => event.runtimeSequenceIndex)
          .sort((left, right) => left - right)
      );
    }, 30_000);

    it('keeps same-frame combat semantics stable when action identities change', () => {
      const service = createMachineAxisService();
      const actorIdSortsFirst = service.simulate(
        createSameFrameCombatAxis({
          kiboActionId: 'z-kibo-input-first',
          actorActionId: 'a-actor-input-second',
        })
      );
      const kiboIdSortsFirst = service.simulate(
        createSameFrameCombatAxis({
          kiboActionId: 'a-kibo-input-first',
          actorActionId: 'z-actor-input-second',
        })
      );

      expect(projectSameFrameCombatSemantics(actorIdSortsFirst)).toEqual(
        projectSameFrameCombatSemantics(kiboIdSortsFirst)
      );
      expect(
        projectSameFrameCombatSemantics(actorIdSortsFirst).executionOwnerOrder
      ).toEqual(['kibo', 'actor']);
      expect(
        actorIdSortsFirst.trace.executionPlan.actions.map(action => ({
          sourceSequenceIndex: action.sourceSequenceIndex,
          sourceSequencePath: action.sourceSequencePath,
        }))
      ).toEqual([
        { sourceSequenceIndex: 0, sourceSequencePath: [0] },
        { sourceSequenceIndex: 1, sourceSequencePath: [1] },
      ]);
      expect(actorIdSortsFirst.evaluation.totals.hpDamage).toBe(2252);
      expect(kiboIdSortsFirst.evaluation.totals.hpDamage).toBe(2252);
    }, 30_000);

    it('points unresolved warnings at canonical indices without inventing closed warnings', () => {
      const validation = createMachineAxisService().validate(cloneFixture());
      const warningsByActionId = new Map(
        validation.warnings
          .filter(
            warning =>
              warning.code === 'machine-axis-action-conditions-unresolved'
          )
          .map(warning => [warning.actionId, warning])
      );

      expect(warningsByActionId.has('plunging-inherit')).toBe(false);
      expect(warningsByActionId.has('ruby-plunging')).toBe(false);
    }, 30_000);
  });
});

function createPangpangPlungingAxis({ criticalRoll }) {
  const axis = cloneFixture();
  const source = axis.actions.find(action => action.id === 'plunging-inherit');
  axis.actions = [
    {
      ...source,
      id: 'boundary-plunging',
      schedule: { mode: 'absolute', frame: 60 },
      hitOverrides: {
        [PANGPANG_PLUNGING_HIT]: {
          landed: 'hit',
          criticalMode: 'sampled',
          criticalRoll,
        },
      },
    },
  ];
  axis.scenario.critical = { policy: 'non-critical', seed: 'boundary-seed' };
  return axis;
}

function createWaitAction(id, frame, durationFrames) {
  return {
    id,
    owner: { kind: 'system', slotId: null },
    intent: {
      kind: 'wait',
      durationFrames,
      publicActionId: null,
      actionKind: null,
      targetSlotId: null,
      level: null,
      semanticVariant: null,
      attackInput: null,
    },
    schedule: {
      mode: 'absolute',
      frame,
      actionId: null,
      offsetFrames: 0,
    },
    hitOverrides: {},
    note: null,
  };
}

function createGeneratedEffect(effectId, absoluteFrame) {
  return {
    id: `command-${effectId}`,
    effectId,
    effectName: effectId,
    operation: 'apply',
    targetKind: 'actor',
    targetId: 'actor-1',
    timeMs: (absoluteFrame * 1000) / 60,
    durationMs: 1000,
    stackMode: 'refresh',
    stackDelta: 1,
    maxStacks: 1,
    sourceActionId: `source-${effectId}`,
  };
}

function createSameFrameCombatAxis({ kiboActionId, actorActionId }) {
  const axis = cloneFixture();
  const originalSlot1 = structuredClone(axis.scenario.team[0]);
  const originalSlot3 = structuredClone(axis.scenario.team[2]);
  axis.scenario.team[0] = {
    ...originalSlot3,
    slotId: 'slot-1',
    loadout: { kiboId: 500001 },
  };
  axis.scenario.team[2] = {
    ...originalSlot1,
    slotId: 'slot-3',
    loadout: { kiboId: 500003 },
  };
  axis.scenario.initialRuntimeState.kiboEnergyBySlot[0] = {
    slotId: 'slot-1',
    actorId: 'actor-103002',
    characterId: 103002,
    kiboId: 500001,
    kiboName: '迅狼',
    currentValue: 100,
    maxValue: 100,
  };
  axis.scenario.initialRuntimeState.kiboEnergyBySlot[2] = {
    slotId: 'slot-3',
    actorId: 'actor-101007',
    characterId: 101007,
    kiboId: 500003,
    kiboName: '水灵偶',
    currentValue: 60,
    maxValue: 100,
  };
  axis.scenario.enemy.initialToughnessRatio = 0.0001;
  axis.scenario.critical = {
    policy: 'non-critical',
    seed: 'same-frame-order-probe',
  };
  const kiboAction = structuredClone(
    axis.actions.find(action => action.id === 'xunlang-signature')
  );
  axis.actions = [
    {
      ...kiboAction,
      id: kiboActionId,
      owner: { kind: 'kibo', slotId: 'slot-1' },
      schedule: { mode: 'absolute', frame: 60 },
    },
    {
      id: actorActionId,
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10300221,
        actionKind: 'perfect-parry',
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 60 },
      hitOverrides: {
        '10300249|1|elements|0|1782654438459948567|15|1': {
          landed: 'miss',
        },
      },
      note: null,
    },
  ];
  return axis;
}

function projectSameFrameCombatSemantics(run) {
  const ownerKindByActionId = new Map(
    run.actionResolutions.map(resolution => [
      resolution.actionId,
      resolution.ownerKind,
    ])
  );
  return {
    executionOwnerOrder: run.trace.executionPlan.actions.map(action =>
      ownerKindByActionId.get(action.actionId)
    ),
    frame80Damage: run.trace.damage
      .filter(event => event.absoluteFrame === 80)
      .map(event => ({
        ownerKind: ownerKindByActionId.get(event.actionId),
        hitIndex: event.hitIndex,
        rawDamage: event.rawDamage,
        toughnessDamage: event.toughnessDamage,
      })),
    totals: {
      hpDamage: run.evaluation.totals.hpDamage,
      inflictedToughnessDamage: run.evaluation.totals.inflictedToughnessDamage,
      recoveredToughness: run.evaluation.totals.recoveredToughness,
    },
    resourceEvents: {
      actorSp: run.trace.resources.actors.map(event => ({
        ownerKind: ownerKindByActionId.get(event.actionId),
        absoluteFrame: event.absoluteFrame,
        change: event.change,
        beforeValue: event.beforeValue,
        afterValue: event.afterValue,
      })),
      kiboSp: run.trace.resources.kibos.map(event => ({
        ownerKind: ownerKindByActionId.get(event.actionId),
        absoluteFrame: event.absoluteFrame,
        change: event.change,
        beforeValue: event.beforeValue,
        afterValue: event.afterValue,
      })),
    },
  };
}

function cloneFixture() {
  return structuredClone(fixture);
}
