import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  aggregateMachineAxisOptimizationDiagnostics,
  createMachineAxisOptimizationDiagnostics,
} from '../../machine-axis/machineAxisOptimizationDiagnostics';

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('Machine Axis optimization diagnostics', () => {
  it('projects damage composition, energy utilization, and tuning-mark coverage', () => {
    const diagnostics = createMachineAxisOptimizationDiagnostics(
      createSyntheticRun(),
      createSyntheticContract()
    );

    expect(diagnostics.damage).toMatchObject({
      totalEffectiveHpDamage: 1100,
      hitCount: 4,
      tuning: {
        overlimitDamage: 300,
        overlimitShare: 0.272727,
        heldTuningDamage: 100,
        heldTuningShare: 0.090909,
        damageOverTime: 100,
        damageOverTimeShare: 0.090909,
      },
    });
    expect(diagnostics.damage.byElement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: 1,
          elementAbbrName: '火',
          effectiveHpDamage: 600,
          shareOfEffectiveHpDamage: 0.545455,
        }),
        expect.objectContaining({
          elementId: 7,
          elementAbbrName: '雷',
          effectiveHpDamage: 300,
        }),
      ])
    );
    expect(diagnostics.damage.bySourceKind).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'actor-action',
          effectiveHpDamage: 600,
        }),
        expect.objectContaining({
          sourceKind: 'tuning-overlimit',
          effectiveHpDamage: 300,
        }),
        expect.objectContaining({
          sourceKind: 'tuning-held',
          effectiveHpDamage: 100,
        }),
        expect.objectContaining({
          sourceKind: 'battle-effect-dot',
          effectiveHpDamage: 100,
        }),
      ])
    );

    expect(diagnostics.energy.actors[0]).toMatchObject({
      startValue: 50,
      recoveredAmount: 110,
      spentAmount: 160,
      endValue: 0,
      utilizationRatio: 1,
      capUptimeRatio: 0.4,
    });
    expect(diagnostics.energy.kibos[0]).toMatchObject({
      startValue: 100,
      recoveredAmount: 50,
      spentAmount: 100,
      endValue: 50,
      utilizationRatio: 0.666667,
      capUptimeRatio: 0.3,
    });
    expect(diagnostics.energy).toMatchObject({
      insufficientActions: ['resource-blocked-action'],
      overall: { insufficientActionCount: 1 },
    });

    const thunder = diagnostics.tuningMarks.profiles.find(
      profile => profile.profileKey === 'thunder'
    );
    expect(thunder).toMatchObject({
      startStacks: 1,
      acquiredStacks: 2,
      consumedStacks: 1,
      expiredStacks: 2,
      endStacks: 0,
      consumptionRatio: 0.333333,
      expiryWasteRatio: 0.666667,
      coverageRatio: 0.8,
      averageStacks: 1.3,
      maxStacksObserved: 3,
    });
    expect(diagnostics.tuningMarks.overall).toMatchObject({
      anyMarkCoverageRatio: 0.8,
      consumedStacks: 1,
      expiredStacks: 2,
      overlimitDamage: 300,
      overlimitDamagePerConsumedStack: 300,
    });
    expect(diagnostics.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'resource-cap-uptime-high' }),
        expect.objectContaining({ code: 'resource-insufficient-actions' }),
        expect.objectContaining({ code: 'tuning-mark-expiry-waste-high' }),
      ])
    );
    expect(diagnostics.diagnosticsHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('aggregates sampled diagnostics by stable identities', () => {
    const first = createMachineAxisOptimizationDiagnostics(
      createSyntheticRun(),
      createSyntheticContract()
    );
    const secondRun = createSyntheticRun();
    secondRun.trace.damage[0].effectiveHpDamage = 800;
    secondRun.trace.damage[0].rawDamage = 800;
    const second = createMachineAxisOptimizationDiagnostics(
      secondRun,
      createSyntheticContract()
    );
    const aggregate = aggregateMachineAxisOptimizationDiagnostics([
      first,
      second,
    ]);

    expect(aggregate).toMatchObject({
      sampleCount: 2,
      damage: { totalEffectiveHpDamage: 1200 },
    });
    expect(
      aggregate.damage.byElement.find(row => row.elementId === 1)
    ).toMatchObject({ effectiveHpDamage: 700 });
    expect(aggregate.sampleDiagnosticsHashes).toHaveLength(2);
  });
});

function createSyntheticContract() {
  return {
    scenario: {
      team: [{ slotId: 'actor-109001', characterId: 109001, initialSp: 50 }],
      initialRuntimeState: {
        kiboEnergyBySlot: [
          {
            actorId: 'actor-109001',
            slotId: 'actor-109001',
            kiboId: 500001,
            currentValue: 100,
          },
        ],
        tuningMarks: [
          {
            markId: 250,
            layers: [{ sourceIdentity: 'synthetic-thunder-layer' }],
          },
        ],
      },
    },
  };
}

function createSyntheticRun() {
  return {
    trace: {
      scenario: { durationMs: 10_000, frameRate: 60 },
      actions: [
        {
          id: 'actor-hit',
          type: 'skill',
          actionKind: 'normal-attack',
          actorId: 'actor-109001',
          name: 'synthetic hit',
        },
      ],
      executionPlan: {
        actions: [
          {
            actionId: 'resource-blocked-action',
            startMs: 7000,
            execute: false,
            skipReason: 'verified-actor-resource-insufficient',
          },
        ],
      },
      damage: [
        damageEvent({
          timeMs: 1000,
          actionId: 'actor-hit',
          actorId: 'actor-109001',
          elementId: 1,
          damage: 600,
        }),
        damageEvent({
          timeMs: 2000,
          actionId: 'actor-hit',
          actorId: 'actor-109001',
          elementId: 7,
          damage: 300,
          tuningKind: 'overlimit-damage',
        }),
        damageEvent({
          timeMs: 3000,
          actionId: 'actor-hit',
          actorId: 'actor-109001',
          elementId: 8,
          damage: 100,
          tuningKind: 'held-true-damage',
        }),
        damageEvent({
          timeMs: 4000,
          actionId: null,
          actorId: 'actor-109001',
          elementId: 9,
          damage: 100,
          battleEffectDot: true,
        }),
      ],
      resources: {
        actors: [
          resourceEvent(1000, 30, 50, 80, 'verified-auto-sp-foreground'),
          resourceEvent(2000, -60, 80, 20, 'verified-skill-cost'),
          resourceEvent(5000, 80, 20, 100, 'verified-hit-sp-recovery'),
          resourceEvent(9000, -100, 100, 0, 'verified-skill-cost'),
        ],
        kibos: [
          kiboResourceEvent(3000, -100, 100, 0, 'verified-skill-cost'),
          kiboResourceEvent(
            8000,
            50,
            0,
            50,
            'verified-hit-pet-sp-shared-recovery'
          ),
        ],
        tuningMarks: [
          markEvent(1000, 'acquire', 1, 2, 3),
          markEvent(2000, 'consume', 3, -1, 2),
          markEvent(5000, 'expire', 2, -1, 1),
          markEvent(8000, 'expire', 1, -1, 0),
        ],
      },
      state: {
        initial: {
          actorEnergy: [
            { actorId: 'actor-109001', currentValue: 50, maxValue: 100 },
          ],
          kiboEnergy: [
            {
              actorId: 'actor-109001',
              slotId: 'actor-109001',
              kiboId: 500001,
              currentValue: 100,
              maxValue: 100,
            },
          ],
        },
        final: {
          actorEnergy: [
            { actorId: 'actor-109001', currentValue: 0, maxValue: 100 },
          ],
          kiboEnergy: [
            {
              actorId: 'actor-109001',
              slotId: 'actor-109001',
              kiboId: 500001,
              currentValue: 50,
              maxValue: 100,
            },
          ],
        },
      },
    },
  };
}

function damageEvent({
  timeMs,
  actionId,
  actorId,
  elementId,
  damage,
  tuningKind = null,
  battleEffectDot = false,
}) {
  return {
    timeMs,
    actionId,
    actorId,
    elementId,
    elementalType: elementId,
    rawDamage: damage,
    effectiveHpDamage: damage,
    toughnessDamage: 0,
    tuningKind,
    battleEffectDot,
  };
}

function resourceEvent(timeMs, change, beforeValue, afterValue, reason) {
  return {
    timeMs,
    actorId: 'actor-109001',
    resource: 'sp',
    change,
    beforeValue,
    afterValue,
    currentValue: afterValue,
    maxValue: 100,
    reason,
  };
}

function kiboResourceEvent(timeMs, change, beforeValue, afterValue, reason) {
  return {
    timeMs,
    actorId: 'actor-109001',
    resource: 'kibo-energy',
    kiboId: 500001,
    slotId: 'actor-109001',
    change,
    beforeValue,
    afterValue,
    currentValue: afterValue,
    maxValue: 100,
    reason,
  };
}

function markEvent(timeMs, kind, before, delta, after) {
  return {
    timeMs,
    kind,
    profileKey: 'thunder',
    markId: 250,
    before,
    delta,
    after,
    maximum: 5,
  };
}
