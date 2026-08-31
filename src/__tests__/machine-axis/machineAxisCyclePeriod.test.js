import { describe, expect, it } from 'vitest';
import { normalizeCycleDamagePerCycle } from '../../machine-axis/machineAxisCycleEvaluator';
import { findEventualPeriodicSequenceCandidates } from '../../machine-axis/machineAxisCyclePeriod';
import { normalizeMachineAxisOptimizationDiagnosticsPerCycle } from '../../machine-axis/machineAxisOptimizationDiagnostics';

describe('machineAxisCyclePeriod', () => {
  it('drops transient cycles and finds a stable one-cycle period', () => {
    expect(
      findEventualPeriodicSequenceCandidates([1, 2, 3, 3, 3], {
        minimumRepeats: 3,
        maxPeriodCycles: 2,
      })[0]
    ).toMatchObject({
      transientCycleCount: 2,
      periodCycles: 1,
      repeatedCycleCount: 3,
      periodValues: [3],
    });
  });

  it('finds an alternating two-cycle steady period', () => {
    expect(
      findEventualPeriodicSequenceCandidates([1, 2, 3, 2, 3, 2, 3], {
        minimumRepeats: 3,
        maxPeriodCycles: 3,
      })[0]
    ).toMatchObject({
      transientCycleCount: 1,
      periodCycles: 2,
      repeatedCycleCount: 3,
      periodValues: [2, 3],
    });
  });

  it('does not mistake a drifting tail for a stable period', () => {
    expect(
      findEventualPeriodicSequenceCandidates([10, 9, 8, 7, 6, 5], {
        minimumRepeats: 3,
        maxPeriodCycles: 3,
      })
    ).toEqual([]);
  });

  it('requires the candidate period to remain stable through the observed tail', () => {
    expect(
      findEventualPeriodicSequenceCandidates([1, 1, 1, 2], {
        minimumRepeats: 3,
        maxPeriodCycles: 2,
      })
    ).toEqual([]);
  });

  it('uses a caller-supplied canonical signature for structured metrics', () => {
    const rows = [
      { damage: 1, provenance: 'warmup' },
      { damage: 2, provenance: 'cycle-1' },
      { damage: 2, provenance: 'cycle-2' },
      { damage: 2, provenance: 'cycle-3' },
    ];
    expect(
      findEventualPeriodicSequenceCandidates(rows, {
        minimumRepeats: 3,
        maxPeriodCycles: 1,
        signature: row => String(row.damage),
      })[0]
    ).toMatchObject({
      transientCycleCount: 1,
      periodCycles: 1,
      periodValues: [{ damage: 2, provenance: 'cycle-1' }],
    });
  });

  it('averages additive diagnostics per cycle without averaging ratios', () => {
    const normalized = normalizeMachineAxisOptimizationDiagnosticsPerCycle(
      {
        schemaVersion: 1,
        kind: 'azpr-machine-axis-optimization-diagnostics',
        scope: { startTimeMs: 1000, endTimeMs: 5000 },
        damage: {
          totalRawDamage: 120,
          totalEffectiveHpDamage: 100,
          totalToughnessDamage: 20,
          hitCount: 10,
          byActor: [],
          byAction: [],
          bySourceKind: [],
          byElement: [],
          tuning: {
            overlimitDamage: 40,
            overlimitShare: 0.4,
            heldTuningDamage: 0,
            heldTuningShare: 0,
            totalTuningDamage: 40,
            totalTuningShare: 0.4,
            damageOverTime: 20,
            damageOverTimeShare: 0.2,
          },
        },
        energy: {
          overall: {
            recoveredAmount: 30,
            spentAmount: 20,
            utilizationRatio: 0.5,
            insufficientActionCount: 0,
          },
          actors: [],
          kibos: [],
          insufficientActions: [],
        },
        tuningMarks: {
          overall: {
            availableStacks: 8,
            acquiredStacks: 6,
            consumedStacks: 4,
            expiredStacks: 2,
            consumptionRatio: 0.5,
            anyMarkCoverageMs: 3000,
            anyMarkCoverageRatio: 0.75,
            overlimitDamage: 40,
          },
          profiles: [],
        },
      },
      2
    );

    expect(normalized).toMatchObject({
      damage: {
        totalEffectiveHpDamage: 50,
        tuning: { overlimitDamage: 20, overlimitShare: 0.4 },
      },
      energy: {
        overall: {
          recoveredAmount: 15,
          spentAmount: 10,
          utilizationRatio: 0.5,
        },
      },
      tuningMarks: {
        overall: {
          availableStacks: 4,
          consumedStacks: 2,
          consumptionRatio: 0.5,
          anyMarkCoverageMs: 1500,
          anyMarkCoverageRatio: 0.75,
        },
      },
    });
  });

  it('averages an alternating stable damage period per authored loop', () => {
    expect(
      normalizeCycleDamagePerCycle(
        {
          hpDamage: 5,
          combatHitCount: 4,
          byActor: [
            {
              identity: 'actor-1',
              hpDamage: 5,
              combatHitCount: 4,
            },
          ],
          byAction: [],
          byHit: [],
          healing: {
            requestedHealing: 6,
            effectiveHealing: 4,
            overhealing: 2,
            effectiveHps: 1,
            settlementCount: 2,
          },
        },
        2
      )
    ).toMatchObject({
      periodCycleCount: 2,
      hpDamage: 2.5,
      combatHitCount: 2,
      byActor: [{ hpDamage: 2.5, combatHitCount: 2 }],
      healing: {
        requestedHealing: 3,
        effectiveHealing: 2,
        overhealing: 1,
        effectiveHps: 1,
        settlementCount: 1,
      },
    });
  });
});
