export function createToughnessRuntimeSampleFixture({
  captureSessionId = 'fixture-toughness-109001081-v1',
  actionId = 'action-0001',
  actorId = 'actor-109001',
  targetId = 'enemy-300032',
  targetEntityId = 'runtime-enemy-300032',
  sourceElementConfigId = 109001081,
  pathId = '3476557355496561381',
  frameIndex = 12,
  timeMs = 200,
  toughnessBefore = 6667,
  toughnessDeltaApplied = 70,
} = {}) {
  return {
    schemaVersion: 1,
    captureSessionId,
    clientRegion: 'manual-fixture',
    clientBuild: 'stage-p7-a',
    source: 'manual-toughness-runtime-sample-fixture',
    events: [
      {
        captureSessionId,
        eventType: 'toughness-damage-applied',
        actionId,
        actorId,
        targetId,
        targetEntityId,
        sourceElementConfigId,
        pathId,
        frameIndex,
        timeMs,
        toughnessBefore,
        toughnessAfter: roundFixtureNumber(
          toughnessBefore - toughnessDeltaApplied
        ),
        toughnessDeltaApplied,
      },
    ],
  };
}

function roundFixtureNumber(value) {
  return Number(Number(value).toFixed(6));
}
