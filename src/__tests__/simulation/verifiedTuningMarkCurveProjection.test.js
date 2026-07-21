import { describe, expect, it } from 'vitest';
import { projectVerifiedTuningMarkCurves } from '../../simulation/projection/projectVerifiedTuningMarkCurves';

describe('verified tuning mark curve projection', () => {
  it('projects sparse per-element steps from runtime value events', () => {
    const projection = projectVerifiedTuningMarkCurves({
      durationMs: 30_000,
      tuningMarkRuntime: {
        initialState: createInitialStates({ wind: 2 }),
        events: [
          createEvent({
            identity: 'fire-acquire',
            kind: 'acquire',
            markId: 150,
            actionId: 'fire-action',
            timeMs: 1_000,
            frameIndex: 60,
            before: 0,
            after: 1,
          }),
          createEvent({
            identity: 'fire-held',
            kind: 'held-trigger',
            markId: 150,
            actionId: 'fire-action',
            timeMs: 3_000,
            frameIndex: 180,
            before: 1,
            after: 1,
          }),
          createEvent({
            identity: 'wind-consume',
            kind: 'consume',
            markId: 750,
            actionId: 'wind-action',
            timeMs: 5_000,
            frameIndex: 300,
            before: 2,
            after: 0,
          }),
          createEvent({
            identity: 'fire-expire',
            kind: 'expire',
            markId: 150,
            actionId: 'fire-action',
            timeMs: 21_000,
            frameIndex: 1_260,
            before: 1,
            after: 0,
          }),
        ],
      },
    });

    expect(projection).toMatchObject({
      status: 'verified-tuning-mark-curves-ready',
      summary: {
        profileCount: 9,
        visibleTrackCount: 2,
        markEventCount: 4,
        valueEventCount: 3,
        semanticNodeCount: 3,
      },
    });

    const fire = projection.tracks.find(track => track.profileKey === 'fire');
    expect(fire).toMatchObject({
      initialValue: 0,
      currentValue: 0,
      maxValue: 5,
      involved: true,
      simulationPointCount: 2,
      semanticNodeCount: 2,
    });
    expect(fire.linePoints.map(point => [point.timeMs, point.value])).toEqual([
      [0, 0],
      [1_000, 0],
      [1_000, 1],
      [21_000, 1],
      [21_000, 0],
      [30_000, 0],
    ]);
    expect(fire.semanticNodes.map(node => node.eventKinds)).toEqual([
      ['acquire'],
      ['expire'],
    ]);
    expect(fire.semanticNodes[0]).toMatchObject({
      actionId: 'fire-action',
      sourceIdentity: { path: 'Battle/fire' },
      eventIdentities: ['fire-acquire'],
    });
    expect(fire.valueAtTime(999)).toBe(0);
    expect(fire.valueAtTime(1_000)).toBe(1);
    expect(fire.valueAtTime(20_999)).toBe(1);
    expect(fire.valueAtTime(21_000)).toBe(0);
  });

  it('keeps uninvolved elements out of the visible resource group', () => {
    const projection = projectVerifiedTuningMarkCurves({
      durationMs: 30_000,
      tuningMarkRuntime: {
        initialState: createInitialStates(),
        events: [],
      },
    });

    expect(projection.tracks).toHaveLength(9);
    expect(projection.visibleTracks).toEqual([]);
    expect(
      projection.tracks.every(track => track.linePoints.length === 2)
    ).toBe(true);
  });
});

function createInitialStates(initialValues = {}) {
  return [
    [150, 'fire', '火'],
    [850, 'water', '水'],
    [350, 'ice', '冰'],
    [750, 'wind', '风'],
    [550, 'wood', '木'],
    [650, 'earth', '地'],
    [250, 'thunder', '雷'],
    [950, 'light', '光'],
    [450, 'dark', '暗'],
  ].map(([markId, profileKey, elementName]) => ({
    markId,
    profileKey,
    elementName,
    currentValue: initialValues[profileKey] ?? 0,
    maxValue: 5,
    valueUnit: 'mark-stacks',
  }));
}

function createEvent({
  identity,
  kind,
  markId,
  actionId,
  timeMs,
  frameIndex,
  before,
  after,
}) {
  return {
    eventIdentity: identity,
    kind,
    markId,
    actionId,
    timeMs,
    frameIndex,
    before,
    delta: after - before,
    after,
    sourceIdentity: { path: `Battle/${String(identity).split('-')[0]}` },
  };
}
