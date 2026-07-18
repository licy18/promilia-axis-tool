import { describe, expect, it } from 'vitest';
import { projectTimelineStateDisplaySeries } from '../../simulation/projection/projectTimelineStateDisplaySeries';

describe('timeline state display series', () => {
  it('compresses 30 seconds of 100ms auto recovery into a duration-independent line', () => {
    const long = projectTimelineStateDisplaySeries({
      trackKey: 'selfEnergyChange',
      initialValue: 0,
      maxValue: 100,
      durationMs: 30000,
      points: createContinuousPoints({ count: 300, change: 0.1 }),
    });
    const short = projectTimelineStateDisplaySeries({
      trackKey: 'selfEnergyChange',
      initialValue: 0,
      maxValue: 100,
      durationMs: 5000,
      points: createContinuousPoints({ count: 50, change: 0.1 }),
    });

    expect(long.simulationPointCount).toBe(300);
    expect(long.displayPointCount).toBeLessThanOrEqual(3);
    expect(long.semanticNodeCount).toBe(0);
    expect(short.displayPointCount).toBe(long.displayPointCount);
  });

  it('keeps foreground/background slope boundaries and the exact full point', () => {
    const points = [];
    let currentValue = 0;
    for (let index = 1; index <= 10; index += 1) {
      currentValue += 0.02;
      points.push(
        createPoint({
          timeMs: index * 100,
          frameIndex: index * 6,
          currentValue,
          hitKey: `auto-sp-actor-1-${index * 6}`,
        })
      );
    }
    for (let index = 11; index <= 18; index += 1) {
      currentValue = Math.min(0.24, currentValue + 0.005);
      points.push(
        createPoint({
          timeMs: index * 100,
          frameIndex: index * 6,
          currentValue,
          hitKey: `auto-sp-actor-1-${index * 6}`,
        })
      );
    }

    const series = projectTimelineStateDisplaySeries({
      trackKey: 'selfEnergyChange',
      initialValue: 0,
      maxValue: 0.24,
      durationMs: 3000,
      points,
    });

    expect(
      series.linePoints.find(point => point.timeMs === 1000)?.value
    ).toBeCloseTo(0.2, 8);
    expect(series.linePoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ timeMs: 1800, value: 0.24 }),
        expect.objectContaining({ timeMs: 3000, value: 0.24 }),
      ])
    );
    expect(series.displayPointCount).toBeLessThan(8);
  });

  it('projects same-frame discrete changes as one semantic step with full identities', () => {
    const points = [
      createPoint({
        trackKey: 'enemyHpDamage',
        sourceDeltaId: 'hit-1',
        statePointId: 'state-1',
        actionId: 'action-1',
        timeMs: 1000,
        frameIndex: 60,
        currentValue: 8,
        delta: 2,
        hitKey: 'verified-hit-1-a',
      }),
      createPoint({
        trackKey: 'enemyHpDamage',
        sourceDeltaId: 'hit-2',
        statePointId: 'state-2',
        actionId: 'action-1',
        timeMs: 1000,
        frameIndex: 60,
        currentValue: 5,
        delta: 3,
        hitKey: 'verified-hit-2-b',
      }),
    ];
    const statePointIds = new Map(
      points.map(point => [point.sourceDeltaId, point.statePointId])
    );
    const series = projectTimelineStateDisplaySeries({
      trackKey: 'enemyHpDamage',
      initialValue: 10,
      maxValue: 10,
      durationMs: 2000,
      points,
      resolveStatePointId: point => statePointIds.get(point.sourceDeltaId),
    });

    expect(
      series.linePoints.filter(point => point.timeMs === 1000).map(point => point.value)
    ).toEqual([10, 8, 5]);
    expect(series.semanticNodes).toEqual([
      expect.objectContaining({
        actionId: 'action-1',
        frameIndex: 60,
        beforeValue: 10,
        afterValue: 5,
        delta: -5,
        eventCount: 2,
        statePointIds: ['state-1', 'state-2'],
      }),
    ]);
  });

  it('keeps simultaneous changes from different actions as separate source nodes', () => {
    const series = projectTimelineStateDisplaySeries({
      trackKey: 'enemyHpDamage',
      initialValue: 10,
      maxValue: 10,
      durationMs: 2000,
      points: [
        createPoint({
          trackKey: 'enemyHpDamage',
          actionId: 'action-1',
          timeMs: 1000,
          frameIndex: 60,
          currentValue: 8,
          delta: 2,
          hitKey: 'verified-hit-action-1',
        }),
        createPoint({
          trackKey: 'enemyHpDamage',
          actionId: 'action-2',
          timeMs: 1000,
          frameIndex: 60,
          currentValue: 5,
          delta: 3,
          hitKey: 'verified-hit-action-2',
        }),
      ],
    });

    expect(series.semanticNodes.map(node => node.actionId)).toEqual([
      'action-1',
      'action-2',
    ]);
  });

  it('compresses normal and Break recovery while retaining a zero-delta exit node', () => {
    const points = [
      createPoint({
        trackKey: 'enemyToughnessDamage',
        actionId: 'break-source',
        timeMs: 200,
        frameIndex: 12,
        currentValue: 0,
        delta: 6000,
        hitKey: 'verified-hit-1-break',
      }),
    ];
    for (let index = 3; index <= 12; index += 1) {
      points.push(
        createPoint({
          trackKey: 'enemyToughnessDamage',
          actionId: 'break-source',
          timeMs: index * 100,
          frameIndex: index * 6,
          currentValue: (index - 2) * 60,
          delta: -60,
          hitKey: `verified-break-linear-recovery-${index * 6}`,
        })
      );
    }
    points.push(
      createPoint({
        trackKey: 'enemyToughnessDamage',
        actionId: 'break-source',
        timeMs: 1300,
        frameIndex: 78,
        currentValue: 600,
        delta: 0,
        hitKey: 'verified-break-exit-78',
      })
    );

    const series = projectTimelineStateDisplaySeries({
      trackKey: 'enemyToughnessDamage',
      initialValue: 6000,
      maxValue: 6000,
      durationMs: 2000,
      points,
    });

    expect(series.simulationPointCount).toBe(12);
    expect(series.displayPointCount).toBeLessThan(8);
    expect(series.semanticNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hitKey: 'verified-hit-1-break' }),
        expect.objectContaining({ hitKey: 'verified-break-exit-78' }),
      ])
    );
  });

  it('normalizes each series strictly against its own maximum', () => {
    const hp = projectTimelineStateDisplaySeries({
      trackKey: 'enemyHpDamage',
      initialValue: 10000,
      maxValue: 10000,
      durationMs: 1000,
      points: [
        createPoint({
          trackKey: 'enemyHpDamage',
          timeMs: 500,
          frameIndex: 30,
          currentValue: 9000,
          delta: 1000,
          hitKey: 'verified-hit-hp',
        }),
      ],
    });
    const toughness = projectTimelineStateDisplaySeries({
      trackKey: 'enemyToughnessDamage',
      initialValue: 100,
      maxValue: 100,
      durationMs: 1000,
      points: [
        createPoint({
          trackKey: 'enemyToughnessDamage',
          timeMs: 500,
          frameIndex: 30,
          currentValue: 80,
          delta: 20,
          hitKey: 'verified-hit-toughness',
        }),
      ],
    });

    expect(hp.semanticNodes[0].ratio).toBe(0.9);
    expect(toughness.semanticNodes[0].ratio).toBe(0.8);
  });
});

function createContinuousPoints({ count, change }) {
  let currentValue = 0;
  return Array.from({ length: count }, (_, index) => {
    currentValue += change;
    return createPoint({
      timeMs: (index + 1) * 100,
      frameIndex: (index + 1) * 6,
      currentValue,
      hitKey: `auto-sp-actor-1-${(index + 1) * 6}`,
    });
  });
}

function createPoint({
  trackKey = 'selfEnergyChange',
  sourceDeltaId = null,
  statePointId = null,
  actionId = '',
  timeMs,
  frameIndex,
  currentValue,
  delta = null,
  hitKey,
}) {
  const metricKey =
    trackKey === 'enemyHpDamage'
      ? 'enemyHp'
      : trackKey === 'enemyToughnessDamage'
        ? 'enemyToughness'
        : trackKey === 'kiboEnergyChange'
          ? 'kiboEnergy'
          : 'selfEnergy';
  return {
    trackKey,
    sourceDeltaId: sourceDeltaId ?? `${hitKey}-${timeMs}`,
    statePointId,
    actionId,
    timeMs,
    frameIndex,
    delta: delta ?? currentValue,
    hitKey,
    stateSnapshot: {
      after: {
        [metricKey]: { currentValue },
      },
    },
  };
}
