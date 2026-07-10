import { describe, expect, it } from 'vitest';
import { projectCycleSections } from '../../simulation/projection/projectCycleSections';

describe('projectCycleSections', () => {
  it('splits standard runtime outputs at boundaries without recalculating deltas', () => {
    const projection = projectCycleSections({
      scenario: {
        time: { durationMs: 3000, fps: 60 },
        cycleBoundaries: [
          { id: 'cycle-boundary-0001', timeMs: 1000 },
          { id: 'cycle-boundary-0002', timeMs: 2000 },
        ],
        actors: [
          { id: 'actor-1', characterId: 1, name: '末音' },
          { id: 'actor-2', characterId: 2, name: '寒悠悠' },
        ],
        actions: [
          createAction('action-1', '普通攻击', 'actor-1', '末音', 0),
          createAction('action-2', '星鸣技', 'actor-2', '寒悠悠', 1000),
          createAction('action-3', '星决技', 'actor-1', '末音', 2100),
        ],
      },
      runtimeOutputs: {
        hitTransactions: {
          transactions: [
            createTransaction('action-1', 'actor-1', 500, 100, 10, 4),
            createTransaction('action-2', 'actor-2', 1000, 200, 20, 6),
            createTransaction('action-2', 'actor-2', 1900, 50, 5, -2),
            createTransaction('action-3', 'actor-1', 2500, 300, 30, 8),
          ],
        },
        effectTimeline: {
          events: [
            { eventId: 'event-1', actionId: 'action-1', timeMs: 900 },
            { eventId: 'event-2', actionId: 'action-2', timeMs: 1000 },
          ],
        },
      },
      effectIntervals: {
        intervals: [
          {
            intervalId: 'effect-1',
            effectId: 'star-flow',
            effectName: '星流',
            targetKind: 'enemy',
            targetId: 'enemy-1',
            targetName: '迅狼',
            startMs: 500,
            endMs: 1500,
          },
        ],
      },
    });

    expect(projection).toMatchObject({
      contractName: 'AzPrCycleSectionProjection',
      status: 'cycle-section-projection-ready',
      appliedToCalculators: false,
      summary: {
        boundaryCount: 2,
        sectionCount: 3,
        hitTransactionCount: 4,
        enemyHpDelta: 650,
        enemyToughnessDelta: 65,
        selfEnergyDelta: 16,
        effectCoverageMs: 1000,
        readsRuntimeOutputsOnly: true,
        appliedToCalculators: false,
      },
    });
    expect(projection.sections[0]).toMatchObject({
      sectionId: 'cycle-section-01',
      startMs: 0,
      endMs: 1000,
      endBoundaryId: 'cycle-boundary-0001',
      metrics: {
        enemyHpDelta: 100,
        enemyToughnessDelta: 10,
        selfEnergyDelta: 4,
        effectCoverageMs: 500,
      },
      actors: [
        expect.objectContaining({ actorId: 'actor-1', selfEnergyDelta: 4 }),
        expect.objectContaining({ actorId: 'actor-2', selfEnergyDelta: 0 }),
      ],
    });
    expect(projection.sections[1]).toMatchObject({
      startBoundaryId: 'cycle-boundary-0001',
      endBoundaryId: 'cycle-boundary-0002',
      metrics: {
        enemyHpDelta: 250,
        enemyToughnessDelta: 25,
        selfEnergyDelta: 4,
        effectCoverageMs: 500,
      },
      summary: { hitTransactionCount: 2, effectEventCount: 1 },
    });
    expect(projection.sections[1].actions).toEqual([
      expect.objectContaining({
        actionId: 'action-2',
        enemyHpDelta: 250,
        selfEnergyDelta: 4,
        hitCount: 2,
        effectEventCount: 1,
      }),
    ]);
    expect(projection.sections[2]).toMatchObject({
      startBoundaryId: 'cycle-boundary-0002',
      endBoundaryId: null,
      metrics: {
        enemyHpDelta: 300,
        enemyToughnessDelta: 30,
        selfEnergyDelta: 8,
      },
    });
  });

  it('returns one complete section when no boundary exists', () => {
    const projection = projectCycleSections({
      scenario: {
        time: { durationMs: 3000, fps: 60 },
        cycleBoundaries: [],
        actors: [],
        actions: [],
      },
      runtimeOutputs: {},
      effectIntervals: {},
    });

    expect(projection).toMatchObject({
      status: 'cycle-section-projection-ready-no-boundaries',
      summary: { boundaryCount: 0, sectionCount: 1 },
      sections: [
        {
          sectionId: 'cycle-section-01',
          startMs: 0,
          endMs: 3000,
          durationMs: 3000,
        },
      ],
    });
  });
});

function createAction(id, name, actorId, actorName, startMs) {
  return {
    id,
    name,
    actorId,
    actor: { id: actorId, name: actorName },
    startMs,
    durationMs: 600,
  };
}

function createTransaction(
  actionId,
  actorId,
  timeMs,
  enemyHp,
  enemyToughness,
  selfEnergy
) {
  return {
    transactionId: `${actionId}-${timeMs}`,
    actionId,
    actorId,
    energyOwnerActorId: actorId,
    timeMs,
    delta: { enemyHp, enemyToughness, selfEnergy },
  };
}
