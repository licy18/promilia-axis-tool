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

function createLimitCounter(id, frame) {
  return createPublicAction({
    id,
    publicActionId: 10900121,
    actionKind: 'limit-counter',
    frame,
  });
}

const NORMAL_CHAIN_OFFSETS = [0, 16, 51, 116, 180];

function createNormalChain(id, targetSequenceIndex, targetFrame) {
  const chainStart =
    targetFrame - NORMAL_CHAIN_OFFSETS[targetSequenceIndex - 1];
  return Array.from({ length: targetSequenceIndex }, (_, index) => {
    const sequenceIndex = index + 1;
    const action = createNormal(
      sequenceIndex === targetSequenceIndex ? id : `${id}-a${sequenceIndex}`,
      sequenceIndex,
      chainStart + NORMAL_CHAIN_OFFSETS[index]
    );
    action.intent.attackInput.groupId = id;
    return action;
  });
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
          Number(effect.controlSkillId) === 10900143 && effect.tuningOverlimit
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
    const actionIds = new Set(
      fixture.actions
        .filter(action =>
          /^(moyin-thunder-preseed-signature|moyin-limit-|moyin-round-|moyin-expiry-boundary-a1)/.test(
            action.id
          )
        )
        .map(action => action.id)
    );
    const execution = run.trace.executionPlan.actions.filter(row =>
      actionIds.has(row.actionId)
    );
    expect(execution).toHaveLength(actionIds.size);
    expect(execution.every(row => row.execute)).toBe(true);

    const marks = run.trace.resources.tuningMarks.filter(
      event => Number(event.markId) === 250
    );
    expect(
      marks.find(
        event =>
          event.actionId === 'moyin-thunder-preseed-signature' &&
          event.kind === 'acquire'
      )
    ).toMatchObject({ before: 0, after: 1, delta: 1, frameIndex: 3215 });
    expect(
      marks
        .filter(
          event =>
            event.kind === 'acquire' &&
            /^moyin-round-\d-a5$/.test(event.actionId)
        )
        .map(event => [
          event.actionId,
          event.frameIndex,
          event.before,
          event.after,
          event.delta,
          event.maximum,
          event.sourceIdentity.includes('thunder-tuning-mark-x2') ? 2 : null,
          event.sourceIdentity.includes('thunder-tuning-mark-x2'),
        ])
    ).toEqual([
      ['moyin-round-1-a5', 3765, 0, 2, 2, 5, 2, true],
      ['moyin-round-2-a5', 4295, 1, 3, 2, 5, 2, true],
      ['moyin-round-3-a5', 4606, 2, 4, 2, 5, 2, true],
      ['moyin-round-4-a5', 4917, 3, 5, 2, 5, 2, true],
      ['moyin-round-5-a5', 5228, 4, 5, 1, 5, 2, true],
    ]);

    expect(
      marks
        .filter(event => event.kind === 'consume')
        .map(event => [event.actionId, event.before, event.after, event.delta])
    ).toEqual([
      ['moyin-round-1-a4', 1, 0, -1],
      ['moyin-round-2-a4', 2, 1, -1],
      ['moyin-round-3-a4', 3, 2, -1],
      ['moyin-round-4-a4', 4, 3, -1],
      ['moyin-round-5-a4', 5, 4, -1],
    ]);

    const heldThunder = run.trace.damage.filter(
      event =>
        event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
        Number(event.elementId) === 251
    );
    const limitHeldThunder = heldThunder.filter(event =>
      /^moyin-limit-[1-5]$/.test(event.actionId)
    );
    expect(
      limitHeldThunder.map(event => [
        event.actionId,
        event.absoluteFrame,
        event.rawDamage,
      ])
    ).toEqual([
      ['moyin-limit-1', 3515, 158],
      ['moyin-limit-2', 4045, 316],
      ['moyin-limit-3', 4356, 473],
      ['moyin-limit-4', 4667, 631],
      ['moyin-limit-5', 4978, 789],
    ]);
    expect(
      limitHeldThunder.every(
        event => event.formula?.status === 'verified-tuning-formula-applied'
      )
    ).toBe(true);
    expect(
      heldThunder
        .filter(event => actionIds.has(event.actionId))
        .map(event => [event.actionId, event.absoluteFrame])
    ).toEqual([
      ['moyin-thunder-preseed-signature', 3215],
      ['moyin-limit-1', 3515],
      ['moyin-limit-2', 4045],
      ['moyin-limit-3', 4356],
      ['moyin-limit-4', 4667],
      ['moyin-limit-5', 4978],
      ['moyin-expiry-boundary-a1', 6428],
    ]);
    const signatureHeld = heldThunder.find(
      event => event.actionId === 'moyin-thunder-preseed-signature'
    );
    expect(signatureHeld?.absoluteFrame).toBe(3215);
    expect(
      limitHeldThunder[0]?.absoluteFrame - signatureHeld?.absoluteFrame
    ).toBe(300);
    expect(limitHeldThunder[0]?.timeMs - signatureHeld?.timeMs).toBeCloseTo(
      5000,
      6
    );
    expect(
      marks.find(event => event.kind === 'expire' && event.frameIndex === 6428)
    ).toMatchObject({ before: 5, after: 4, delta: -1 });
    expect(
      marks
        .filter(event => !Array.isArray(event.sourceSequencePath))
        .map(event => [event.actionId, event.kind, event.frameIndex])
    ).toEqual([]);
    const persistent = run.trace.effects.events.find(
      event =>
        event.actionId === 'moyin-round-1-a5' &&
        event.effectId === 'tuning-mark:250:persistent' &&
        event.operation === 'apply'
    );
    expect(
      (persistent?.modifiers ?? []).map(modifier => [
        modifier.attributeId,
        modifier.valueRaw,
      ])
    ).toEqual(
      expect.arrayContaining([
        [7, 43],
        [8, 86],
      ])
    );

    const findCriticalHit = actionId =>
      run.trace.damage.find(
        event =>
          event.actionId === actionId &&
          event.eventType === 'VERIFIED_COMBAT_HIT'
      );
    expect(
      findCriticalHit('109001-critical-sampled-low')?.formula?.randomBranch
    ).toMatchObject({
      criticalRoll: 499,
      criticalThreshold: 500,
      critical: true,
    });
    expect(
      findCriticalHit('109001-critical-sampled-boundary')?.formula?.randomBranch
    ).toMatchObject({
      criticalRoll: 500,
      criticalThreshold: 500,
      critical: false,
    });
    const findRoundOneA5Hit = suffix =>
      run.trace.damage.find(
        event =>
          event.actionId === 'moyin-round-1-a5' &&
          event.eventType === 'VERIFIED_COMBAT_HIT' &&
          String(event.hitIdentity ?? '').endsWith(suffix)
      );
    const preHitBefore = findRoundOneA5Hit('|20|5')?.formula?.randomBranch;
    const preHitAfter = findRoundOneA5Hit('|56|7')?.formula?.randomBranch;
    expect(preHitBefore).toMatchObject({
      sourceCriticalRateBasisPoints: 500,
      sourceCriticalDamageBasisPoints: 15000,
    });
    expect(preHitAfter).toMatchObject({
      sourceCriticalRateBasisPoints: 586,
      sourceCriticalDamageBasisPoints: 15172,
    });
    expect(
      preHitAfter.sourceCriticalRateBasisPoints -
        preHitBefore.sourceCriticalRateBasisPoints
    ).toBe(2 * 43);
    expect(
      preHitAfter.sourceCriticalDamageBasisPoints -
        preHitBefore.sourceCriticalDamageBasisPoints
    ).toBe(2 * 86);
  });

  it('settles the A5 off/on and A4 state-plus-mark counterexample matrix', () => {
    const service = createMachineAxisService();
    const a5Off = service.simulate(
      createQualificationAxis({
        id: 'moyin-a5-off-matrix',
        actions: createNormalChain('a5-off', 5, 180),
      })
    );
    const a5On = service.simulate(
      createQualificationAxis({
        id: 'moyin-a5-on-matrix',
        actions: [
          createLimitCounter('a5-on-brilliant', 0),
          ...createNormalChain('a5-on', 5, 233),
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
        frameIndex: 280,
        sourceSequencePath: expect.any(Array),
      }),
    ]);

    const matrix = [
      {
        id: 'a4-off-mark-1',
        initialThunderCount: 1,
        actions: createNormalChain('a4-off-mark-1', 4, 116),
        before: 1,
        consumeCount: 0,
      },
      {
        id: 'a4-on-mark-0',
        actions: [
          createLimitCounter('a4-on-zero-brilliant', 0),
          ...createNormalChain('a4-on-mark-0', 4, 169),
        ],
        before: 0,
        consumeCount: 0,
      },
      {
        id: 'a4-on-mark-2',
        actions: [
          createLimitCounter('a4-on-two-brilliant', 0),
          ...createNormalChain('a4-on-mark-2', 4, 169),
        ],
        initialThunderCount: 2,
        before: 2,
        consumeCount: 1,
      },
      {
        id: 'a4-on-mark-1',
        actions: [
          createLimitCounter('a4-on-one-brilliant', 0),
          ...createNormalChain('a4-on-mark-1', 4, 169),
        ],
        initialThunderCount: 1,
        before: 1,
        consumeCount: 1,
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
    }
  });

  it('keeps Brilliant while two A4 packets consume two marks and rejects the insufficient third A4', () => {
    const result = createMachineAxisService().simulate(
      createQualificationAxis({
        id: 'moyin-repeated-a4-matrix',
        actions: [
          createLimitCounter('repeat-brilliant-1', 0),
          ...createNormalChain('repeat-a4-1', 4, 169),
          createLimitCounter('repeat-brilliant-2', 300),
          ...createNormalChain('repeat-a4-2', 4, 469),
          createLimitCounter('repeat-brilliant-3', 600),
          ...createNormalChain('repeat-a4-insufficient', 4, 769),
        ],
        initialThunderCount: 2,
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
            createLimitCounter(`${id}-brilliant-1`, 0),
            ...(refresh ? [createLimitCounter(`${id}-brilliant-2`, 271)] : []),
            ...createNormalChain(`${id}-a5`, 5, a5Frame),
          ],
        })
      );
    const acquireCount = (result, actionId) =>
      result.trace.resources.tuningMarks.filter(
        event => event.actionId === actionId && event.kind === 'acquire'
      ).length;
    expect(
      acquireCount(
        runBoundary({ id: 'brilliant-inside', a5Frame: 463 }),
        'brilliant-inside-a5'
      )
    ).toBe(1);
    const exact = runBoundary({ id: 'brilliant-exact', a5Frame: 464 });
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
    expect(exactExpire.timeMs).toBe(8516.666667);
    expect(exactCondition).toMatchObject({
      timeMs: 8516.666667,
      payload: { applied: false },
    });
    expect(exact.trace.state.targetEvents.indexOf(exactExpire)).toBeLessThan(
      exact.trace.state.targetEvents.indexOf(exactCondition)
    );

    expect(
      acquireCount(
        runBoundary({
          id: 'brilliant-refresh-inside',
          a5Frame: 734,
          refresh: true,
        }),
        'brilliant-refresh-inside-a5'
      )
    ).toBe(1);
    const refreshedExact = runBoundary({
      id: 'brilliant-refresh-exact',
      a5Frame: 735,
      refresh: true,
    });
    expect(acquireCount(refreshedExact, 'brilliant-refresh-exact-a5')).toBe(0);
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
      ['gain', 31],
      ['refresh', 302],
      ['expire', 782],
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
    const transaction = result.trace.readiness.cooldownReductionTransactions[0];
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
        status: 'cooldown-reduction-transaction-consumed-no-active-target',
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
