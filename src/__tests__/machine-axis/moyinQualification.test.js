import { beforeAll, describe, expect, it } from 'vitest';
import fixture from '../../../fixtures/character-acceptance/109001-visual.json';
import moyinProfile from '../../data/generated/character-combat-profiles/109001.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';

function createPublicAction({
  id,
  publicActionId,
  actionKind,
  frame,
  sequenceIndex = null,
  contextActionId = null,
}) {
  return {
    id,
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId,
      actionKind,
      level: 1,
      ...(sequenceIndex == null
        ? {}
        : {
            attackInput: {
              sequenceIndex,
              groupId: id,
              ...(contextActionId ? { contextActionId } : {}),
            },
          }),
    },
    schedule: { mode: 'absolute', frame },
  };
}

function createStar(id, frame) {
  return createPublicAction({
    id,
    publicActionId: 10900112,
    actionKind: 'star-skill',
    frame,
  });
}

function createUltimate(id, frame) {
  return createPublicAction({
    id,
    publicActionId: 10900113,
    actionKind: 'ultimate',
    frame,
  });
}

function createNormal(id, sequenceIndex, frame, contextActionId = null) {
  return createPublicAction({
    id,
    publicActionId: 10900101,
    actionKind: 'normal-attack',
    frame,
    sequenceIndex,
    contextActionId,
  });
}

function createBrilliantPair(prefix, starFrame) {
  const starId = `${prefix}-star`;
  return [
    createStar(starId, starFrame),
    createNormal(`${prefix}-chase`, 1, starFrame + 41, starId),
  ];
}

function createInheritedThunder(count) {
  return {
    markId: 250,
    currentValue: count,
    maxValue: 5,
    decayRemainingMs: 20_000,
    heldReadyRemainingMs: 0,
    layers: Array.from({ length: count }, (_, index) => ({
      sourceActionId: `inherited-thunder-${index + 1}`,
      sourceActorId: 'actor-109001',
      sourceIdentity: {
        sourceKind: 'moyin-qualification-inherited-thunder',
        layer: index + 1,
      },
    })),
  };
}

function createQualificationAxis({
  id,
  actions,
  durationFrames = 1_200,
  initialThunderCount = 0,
  initialSp = 100,
}) {
  const contract = structuredClone(fixture);
  contract.scenario.id = id;
  contract.scenario.name = `Moyin qualification ${id}`;
  contract.scenario.durationFrames = durationFrames;
  contract.scenario.team[0].initialSp = initialSp;
  contract.scenario.initialRuntimeState = {
    ...(contract.scenario.initialRuntimeState ?? {}),
    tuningMarks:
      initialThunderCount > 0
        ? [createInheritedThunder(initialThunderCount)]
        : [],
  };
  contract.actions = actions;
  contract.metadata = {
    phase: 'M12-B3-E20-2-109001-S3-R1',
    probeContract: 'canonical-machine-axis-counterexample-matrix',
  };
  return contract;
}

describe('Moyin Machine Axis qualification', () => {
  let run;

  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    run = createMachineAxisService().simulate(structuredClone(fixture));
  });

  it('publishes nested overlimit damage through the verified tuning runtime', () => {
    const overlimitDamage = moyinProfile.contracts.effects.semantic.filter(
      effect =>
        Number(effect.elementId) === 296 &&
        [10900104, 10900113].includes(Number(effect.controlSkillId))
    );
    expect(overlimitDamage).toHaveLength(2);
    expect(overlimitDamage).toEqual(
      expect.arrayContaining(
        [10900104, 10900113].map(controlSkillId =>
          expect.objectContaining({
            controlSkillId,
            classification: 'applied',
            formulaRuntime: expect.objectContaining({
              family: 'verified-tuning-state-formula',
              evaluator: 'verified-tuning-mark-runtime',
              status: 'delegated-applied',
              applied: false,
              delegatedApplied: true,
              delegation: expect.objectContaining({
                kind: 'verified-tuning-overlimit-consumption-runtime',
                markId: 250,
                packetElementId: 299,
                applied: true,
              }),
            }),
            dimensions: expect.objectContaining({
              damage: {
                status: 'applied',
                sourceField: 'verified-tuning-mark-runtime',
              },
            }),
            reasons: [],
          })
        )
      )
    );
    expect(
      moyinProfile.contracts.effects.raw.find(
        effect =>
          Number(effect.controlSkillId) === 10900143 &&
          effect.tuningOverlimit
      )
    ).toMatchObject({
      classification: 'applied',
      tuningOverlimit: {
        markId: 250,
        packetElementId: 299,
      },
    });
  });

  it('gates A5 on Brilliant and replays the thunder lifecycle on applied transactions only', () => {
    const actionIds = new Set([
      'moyin-a5-brilliant-off',
      'moyin-lifecycle-brilliant-source-1',
      'moyin-lifecycle-brilliant-chase-1',
      'moyin-lifecycle-a5-1',
      'moyin-lifecycle-a5-2',
      'moyin-held-boundary-hit',
      'moyin-lifecycle-brilliant-source-2',
      'moyin-lifecycle-brilliant-chase-2',
      'moyin-lifecycle-a5-3',
      'moyin-lifecycle-a5-4-refresh',
      'moyin-expiry-boundary-hit',
    ]);
    const execution = run.trace.executionPlan.actions.filter(row =>
      actionIds.has(row.actionId)
    );
    expect(execution).toHaveLength(actionIds.size);
    expect(execution.every(row => row.execute)).toBe(true);

    const marks = run.trace.resources.tuningMarks.filter(
      event => Number(event.markId) === 250
    );
    expect(
      marks.filter(
        event =>
          event.actionId === 'moyin-a5-brilliant-off' &&
          event.kind === 'acquire'
      )
    ).toHaveLength(0);
    expect(
      run.trace.state.targetEvents.find(
        event =>
          event.actionId === 'moyin-a5-brilliant-off' &&
          event.type === 'VERIFIED_ACTION_EFFECT_STATE_CONDITION_EVALUATED' &&
          event.payload?.stateIdentity === 'moyin-brilliant' &&
          event.payload?.applied === false
      )
    ).toBeTruthy();
    expect(
      marks
        .filter(event => event.kind === 'acquire')
        .map(event => [event.actionId, event.before, event.after, event.delta])
    ).toEqual([
      ['moyin-lifecycle-a5-1', 0, 2, 2],
      ['moyin-lifecycle-a5-2', 2, 4, 2],
      ['moyin-lifecycle-a5-3', 3, 5, 2],
      ['moyin-lifecycle-a5-4-refresh', 5, 5, 0],
    ]);

    const heldThunder = run.trace.damage.filter(
      event =>
        event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
        Number(event.elementId) === 251
    );
    expect(
      heldThunder
        .filter(event => actionIds.has(event.actionId))
        .map(event => [event.actionId, event.absoluteFrame])
    ).toEqual([
      ['moyin-lifecycle-a5-1', 1936],
      ['moyin-held-boundary-hit', 2236],
      ['moyin-lifecycle-a5-3', 2558],
    ]);
    expect(
      heldThunder.find(event => event.actionId === 'moyin-lifecycle-a5-2')
    ).toBeUndefined();
    expect(
      heldThunder.find(event => event.actionId === 'moyin-held-boundary-hit')
        ?.absoluteFrame -
        heldThunder.find(event => event.actionId === 'moyin-lifecycle-a5-1')
          ?.absoluteFrame
    ).toBe(300);
    expect(
      marks
        .filter(event => !Array.isArray(event.sourceSequencePath))
        .map(event => [event.actionId, event.kind, event.frameIndex])
    ).toEqual([]);
    expect(
      run.trace.state.targetEvents.filter(
        event =>
          event.payload?.stateIdentity === 'moyin-brilliant' &&
          event.payload?.operation === 'consume'
      )
    ).toEqual([]);
  });

  it('settles the A5 off/on and A4 state-plus-mark counterexample matrix', () => {
    const service = createMachineAxisService();
    const a5Off = service.simulate(
      createQualificationAxis({
        id: 'moyin-a5-off-matrix',
        actions: [createNormal('a5-off', 5, 0)],
      })
    );
    const a5On = service.simulate(
      createQualificationAxis({
        id: 'moyin-a5-on-matrix',
        actions: [
          ...createBrilliantPair('a5-on-brilliant', 0),
          createNormal('a5-on', 5, 271),
        ],
      })
    );
    expect(
      a5Off.trace.resources.tuningMarks.filter(
        event => event.actionId === 'a5-off' && event.kind === 'acquire'
      )
    ).toEqual([]);
    expect(
      a5On.trace.resources.tuningMarks.filter(
        event => event.actionId === 'a5-on' && event.kind === 'acquire'
      )
    ).toEqual([
      expect.objectContaining({
        markId: 250,
        before: 0,
        after: 2,
        delta: 2,
        frameIndex: 318,
        sourceSequencePath: expect.any(Array),
      }),
    ]);

    const matrix = [
      {
        id: 'a4-off-mark-1',
        initialThunderCount: 1,
        actions: [createNormal('a4-off-mark-1', 4, 0)],
        before: 1,
        consumeCount: 0,
      },
      {
        id: 'a4-on-mark-0',
        actions: [
          ...createBrilliantPair('a4-on-zero-brilliant', 0),
          createNormal('a4-on-mark-0', 4, 271),
        ],
        before: 0,
        consumeCount: 0,
      },
      {
        id: 'a4-on-mark-2',
        actions: [
          ...createBrilliantPair('a4-on-two-brilliant', 0),
          createNormal('a4-on-two-a5', 5, 271),
          createNormal('a4-on-mark-2', 4, 349),
        ],
        before: 2,
        consumeCount: 1,
      },
      {
        id: 'a4-on-mark-1',
        actions: [
          ...createBrilliantPair('a4-on-one-brilliant-1', 0),
          createNormal('a4-on-one-a5', 5, 271),
          ...createBrilliantPair('a4-on-one-brilliant-2', 349),
          createNormal('a4-on-mark-1', 4, 620),
        ],
        before: 1,
        consumeCount: 1,
        chaseConsumeActionId: 'a4-on-one-brilliant-2-chase',
      },
    ];
    for (const expected of matrix) {
      const result = service.simulate(
        createQualificationAxis({
          id: `moyin-${expected.id}-matrix`,
          actions: expected.actions,
          initialThunderCount: expected.initialThunderCount ?? 0,
        })
      );
      const consumes = result.trace.resources.tuningMarks.filter(
        event => event.actionId === expected.id && event.kind === 'consume'
      );
      const packets = result.trace.damage.filter(
        event =>
          event.actionId === expected.id &&
          event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
          String(event.hitKey).startsWith('verified-overlimit-damage|')
      );
      expect(consumes).toHaveLength(expected.consumeCount);
      expect(packets).toHaveLength(expected.consumeCount);
      if (expected.consumeCount) {
        expect(packets[0]).toMatchObject({
          elementId: 296,
          sourceSequencePath: expect.any(Array),
        });
        expect(consumes[0]).toMatchObject({
          markId: 250,
          before: expected.before,
          after: expected.before - 1,
          delta: -1,
          sourceSequencePath: expect.any(Array),
        });
      }
      expect(
        result.trace.state.targetEvents.filter(
          event =>
            event.payload?.stateIdentity === 'moyin-brilliant' &&
            event.payload?.operation === 'consume'
        )
      ).toEqual([]);
      if (expected.chaseConsumeActionId) {
        expect(
          result.trace.resources.tuningMarks.find(
            event =>
              event.actionId === expected.chaseConsumeActionId &&
              event.kind === 'consume'
          )
        ).toMatchObject({ before: 2, after: 1, delta: -1 });
      }
    }
  });

  it('keeps Brilliant while two A4 packets consume two marks and rejects the insufficient third A4', () => {
    const result = createMachineAxisService().simulate(
      createQualificationAxis({
        id: 'moyin-repeated-a4-matrix',
        actions: [
          ...createBrilliantPair('repeat-brilliant', 0),
          createNormal('repeat-a5', 5, 271),
          createNormal('repeat-a4-1', 4, 349),
          createNormal('repeat-a4-2', 4, 413),
          createNormal('repeat-a4-insufficient', 4, 477),
        ],
      })
    );
    expect(
      result.trace.resources.tuningMarks
        .filter(event => event.kind === 'consume')
        .map(event => [event.actionId, event.before, event.after, event.delta])
    ).toEqual([
      ['repeat-a4-1', 2, 1, -1],
      ['repeat-a4-2', 1, 0, -1],
    ]);
    expect(
      result.trace.damage
        .filter(
          event =>
            event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
            String(event.hitKey).startsWith('verified-overlimit-damage|')
        )
        .map(event => event.actionId)
    ).toEqual(['repeat-a4-1', 'repeat-a4-2']);
    expect(
      result.trace.state.targetEvents.filter(
        event =>
          event.payload?.stateIdentity === 'moyin-brilliant' &&
          event.payload?.operation === 'consume'
      )
    ).toEqual([]);
  });

  it('uses a right-open eight-second Brilliant boundary and refreshes it in source order', () => {
    const service = createMachineAxisService();
    const runBoundary = ({ id, a5Frame, refresh = false }) =>
      service.simulate(
        createQualificationAxis({
          id,
          durationFrames: 900,
          actions: [
            ...createBrilliantPair(`${id}-brilliant-1`, 0),
            ...(refresh
              ? createBrilliantPair(`${id}-brilliant-2`, 271)
              : []),
            createNormal(`${id}-a5`, 5, a5Frame),
          ],
        })
      );
    const acquireCount = (result, actionId) =>
      result.trace.resources.tuningMarks.filter(
        event => event.actionId === actionId && event.kind === 'acquire'
      ).length;
    expect(
      acquireCount(
        runBoundary({ id: 'brilliant-inside', a5Frame: 483 }),
        'brilliant-inside-a5'
      )
    ).toBe(1);
    const exact = runBoundary({ id: 'brilliant-exact', a5Frame: 484 });
    expect(acquireCount(exact, 'brilliant-exact-a5')).toBe(0);
    const exactExpire = exact.trace.state.targetEvents.find(
      event =>
        event.payload?.stateIdentity === 'moyin-brilliant' &&
        event.payload?.operation === 'expire'
    );
    const exactCondition = exact.trace.state.targetEvents.find(
      event =>
        event.actionId === 'brilliant-exact-a5' &&
        event.type === 'VERIFIED_ACTION_EFFECT_STATE_CONDITION_EVALUATED'
    );
    expect(exactExpire.timeMs).toBe(8850);
    expect(exactCondition).toMatchObject({
      timeMs: 8850,
      payload: { applied: false },
    });
    expect(exact.trace.state.targetEvents.indexOf(exactExpire)).toBeLessThan(
      exact.trace.state.targetEvents.indexOf(exactCondition)
    );

    expect(
      acquireCount(
        runBoundary({
          id: 'brilliant-refresh-inside',
          a5Frame: 754,
          refresh: true,
        }),
        'brilliant-refresh-inside-a5'
      )
    ).toBe(1);
    const refreshedExact = runBoundary({
      id: 'brilliant-refresh-exact',
      a5Frame: 755,
      refresh: true,
    });
    expect(
      acquireCount(refreshedExact, 'brilliant-refresh-exact-a5')
    ).toBe(0);
    expect(
      refreshedExact.trace.state.targetEvents
        .filter(
          event =>
            event.payload?.stateIdentity === 'moyin-brilliant' &&
            ['gain', 'refresh', 'expire'].includes(event.payload?.operation)
        )
        .map(event => [
          event.payload.operation,
          Math.round((event.timeMs * 60) / 1000),
        ])
    ).toEqual([
      ['gain', 51],
      ['refresh', 322],
      ['expire', 802],
    ]);
  });

  it('runs the native shared charge timer and consumes one ultimate reset exactly once', () => {
    const contract = createQualificationAxis({
      id: 'moyin-shared-charge-machine-axis',
      durationFrames: 1_080,
      actions: [
        createStar('charge-star-1', 0),
        createStar('charge-star-2', 60),
        createUltimate('charge-ultimate', 120),
        createStar('charge-star-3', 360),
        createStar('charge-star-4', 420),
      ],
    });
    const service = createMachineAxisService();
    const blockedContract = structuredClone(contract);
    contract.actions = contract.actions.filter(
      action => action.id !== 'charge-star-4'
    );
    const result = service.simulate(contract);
    const replay = service.simulate(structuredClone(contract));
    const readinessById = new Map(
      result.trace.readiness.actions.map(row => [row.actionId, row])
    );

    expect(readinessById.get('charge-star-1').cooldown).toMatchObject({
      cooldownType: 'charge',
      availableBefore: 2,
      availableAfter: 1,
      nextReadyAtMs: 15000,
      chargeStateAfter: {
        currentChargeCount: 1,
        coolTimeMs: 15000,
        sharedTimerRunning: true,
      },
    });
    expect(readinessById.get('charge-star-2').cooldown).toMatchObject({
      availableBefore: 1,
      availableAfter: 0,
      nextReadyAtMs: 15000,
      chargeStateBefore: {
        currentChargeCount: 1,
        coolTimeMs: 14000,
      },
      chargeStateAfter: {
        currentChargeCount: 0,
        coolTimeMs: 14000,
      },
    });
    expect(result.trace.readiness.cooldownReductionTransactions).toEqual([
      expect.objectContaining({
        sourceActionId: 'charge-ultimate',
        sourceElementId: 109001171,
        timeMs: 2000,
        sourceSequencePath: expect.any(Array),
        beforeChargeCount: 0,
        afterChargeCount: 1,
        beforeCoolTimeMs: 13000,
        afterCoolTimeMs: 15000,
        restoredChargeCount: 1,
        nextReadyAtMs: 17000,
        consumed: true,
        appliedToSimulationResults: true,
      }),
    ]);
    const transaction =
      result.trace.readiness.cooldownReductionTransactions[0];
    expect(readinessById.get('charge-star-3')).toMatchObject({
      status: 'ready',
      executable: true,
      cooldown: {
        availableBefore: 1,
        availableAfter: 0,
        nextReadyAtMs: 17000,
        chargeStateAfter: {
          currentChargeCount: 0,
          coolTimeMs: 11000,
          lastCooldownReductionTransactionId: transaction.eventIdentity,
        },
      },
    });
    expect(service.validate(blockedContract)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          actionId: 'charge-star-4',
          code: 'machine-axis-action-not-executable',
        }),
      ]),
    });
    expect(result.hashes).toEqual(replay.hashes);
  });

  it('rejects the third pre-ultimate charge, does not bank an idle reset, and honors the natural boundary', () => {
    const service = createMachineAxisService();
    const depleted = service.validate(
      createQualificationAxis({
        id: 'moyin-charge-depleted-before-ultimate',
        durationFrames: 300,
        actions: [
          createStar('depleted-star-1', 0),
          createStar('depleted-star-2', 60),
          createStar('depleted-star-3', 120),
        ],
      })
    );
    expect(
      depleted.issues.find(issue => issue.actionId === 'depleted-star-3')
    ).toMatchObject({
      code: 'machine-axis-action-not-executable',
    });

    const noBankContract = createQualificationAxis({
      id: 'moyin-charge-reset-no-bank',
      durationFrames: 600,
      actions: [
        createUltimate('no-bank-ultimate', 0),
        createStar('no-bank-star-1', 235),
        createStar('no-bank-star-2', 295),
      ],
    });
    const noBank = service.simulate(noBankContract);
    expect(noBank.trace.readiness.cooldownReductionTransactions).toEqual([
      expect.objectContaining({
        sourceActionId: 'no-bank-ultimate',
        status:
          'cooldown-reduction-transaction-consumed-no-active-target',
        consumed: true,
        appliedToSimulationResults: false,
      }),
    ]);
    noBankContract.actions.push(createStar('no-bank-star-3', 355));
    expect(
      service
        .validate(noBankContract)
        .issues.find(issue => issue.actionId === 'no-bank-star-3')
    ).toMatchObject({ code: 'machine-axis-action-not-executable' });

    const runNaturalBoundary = frame =>
      service.validate(
        createQualificationAxis({
          id: `moyin-charge-natural-${frame}`,
          durationFrames: 1_000,
          actions: [
            createStar(`natural-${frame}-star-1`, 0),
            createStar(`natural-${frame}-star-2`, 60),
            createStar(`natural-${frame}-star-3`, frame),
          ],
        })
      );
    expect(runNaturalBoundary(899).valid).toBe(false);
    expect(
      service
        .simulate(
          createQualificationAxis({
            id: 'moyin-charge-natural-900',
            durationFrames: 1_000,
            actions: [
              createStar('natural-900-star-1', 0),
              createStar('natural-900-star-2', 60),
              createStar('natural-900-star-3', 900),
            ],
          })
        )
        .trace.readiness.actions.at(-1)
    ).toMatchObject({
      status: 'ready',
      executable: true,
      cooldown: {
        availableBefore: 1,
        availableAfter: 0,
        chargeStateBefore: {
          currentChargeCount: 1,
          coolTimeMs: 15000,
          lastSettlementIdentity: 'cooldown-natural-recovery|10900112',
        },
      },
    });
  });
});
