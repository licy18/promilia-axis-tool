import { describe, expect, it } from 'vitest';
import { createKiboEnergyRuntimeCurves } from '../../simulation/runtime/kiboEnergyRuntimeCurves';

function createScenario(events = []) {
  return {
    time: { durationMs: 30000 },
    sourceProject: {
      metadata: {
        timelineTopology: {
          actorGroups: [
            {
              slotId: 'team-slot-1',
              position: 0,
              actorId: 'actor-109001',
              characterId: 109001,
              kiboLane: { kiboId: 500001, kiboName: '测试奇波' },
            },
          ],
        },
      },
    },
    actors: [
      {
        id: 'actor-109001',
        name: '末音',
        characterId: 109001,
        loadout: { kiboId: 500001 },
      },
    ],
    runtimeSampleCaptures: [
      {
        captureSessionId: 'controlled-kibo-session-1',
        events,
      },
    ],
  };
}

function createObservation(patch = {}) {
  return {
    captureSessionId: 'controlled-kibo-session-1',
    eventType: 'pet-ultimate-cooldown-observed',
    actionId: 'action-kibo-1',
    actorId: 'actor-109001',
    slotId: 'team-slot-1',
    kiboId: 500001,
    petEntityId: 70001,
    petEntityPointer: '0x12345678',
    api: 'PetUltimateCdTime',
    frameIndex: 0,
    timeMs: 0,
    cdTime: 12,
    totalTime: 20,
    ready: false,
    ...patch,
  };
}

describe('kibo energy runtime curves', () => {
  it('tracks validated PetUltimateCdTime observations on the exact kibo owner', () => {
    const [curve] = createKiboEnergyRuntimeCurves({
      scenario: createScenario([
        createObservation(),
        createObservation({
          eventIndex: 1,
          frameIndex: 60,
          timeMs: 1000,
          cdTime: 0,
          ready: true,
        }),
      ]),
    });

    expect(curve).toMatchObject({
      contractVersion: 3,
      slotId: 'team-slot-1',
      actorId: 'actor-109001',
      kiboId: 500001,
      semanticResource: 'pet-ultimate-readiness',
      pointCount: 2,
      applied: true,
      trackingOnly: true,
      appliedToCalculators: false,
      baseline: {
        initialValue: 8,
        currentValue: 20,
        maxValue: 20,
        confirmed: true,
      },
      stateMetric: {
        initialValue: 8,
        currentValue: 20,
        maxValue: 20,
        delta: 12,
        baselineConfirmed: true,
      },
      sourceSemantics: {
        status: 'runtime-pet-ultimate-cooldown-observations-validated',
        valueSourceStatus: 'runtime-observed-at-frame-zero',
      },
    });
    expect(curve.points).toEqual([
      expect.objectContaining({
        trackKey: 'kiboEnergyChange',
        frameIndex: 0,
        cdTime: 12,
        totalTime: 20,
        stateSnapshot: {
          after: { kiboEnergy: { currentValue: 8, maxValue: 20 } },
        },
      }),
      expect.objectContaining({
        trackKey: 'kiboEnergyChange',
        frameIndex: 60,
        cdTime: 0,
        totalTime: 20,
        ready: true,
        stateSnapshot: {
          after: { kiboEnergy: { currentValue: 20, maxValue: 20 } },
        },
      }),
    ]);
  });

  it('uses the verified SP unit contract when no valid owner observation exists', () => {
    const [curve] = createKiboEnergyRuntimeCurves({
      scenario: createScenario([
        {
          eventType: 'recover-sp-applied',
          actorId: 'actor-109001',
          args: { petDelta: 12 },
          frameIndex: 1,
        },
        createObservation({ slotId: 'team-slot-2' }),
        createObservation({ ready: true }),
        createObservation({ petEntityPointer: null }),
      ]),
    });

    expect(curve).toMatchObject({
      pointCount: 0,
      applied: false,
      trackingOnly: true,
      appliedToCalculators: false,
      stateMetric: {
        valueUnit: 'sp',
        initialValue: 0,
        currentValue: 0,
        maxValue: 100,
      },
      sourceSemantics: {
        semanticResource: 'kibo-sp',
        status: 'verified-kibo-sp-unit-contract-baseline',
        valueSourceStatus: 'verified-kibo-growth-contract',
      },
    });
  });

  it('uses configured project initial energy as the tracking baseline without observations', () => {
    const scenario = createScenario();
    scenario.initialRuntimeState = {
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-1',
          actorId: 'actor-109001',
          characterId: 109001,
          kiboId: 500001,
          kiboName: '测试奇波',
          currentValue: 50,
          maxValue: 100,
        },
      ],
    };

    const [curve] = createKiboEnergyRuntimeCurves({ scenario });

    expect(curve).toMatchObject({
      slotId: 'team-slot-1',
      kiboId: 500001,
      baseline: {
        sourceKind: 'azpr-project-initial-kibo-sp',
        status: 'workbench-initial-kibo-energy-baseline',
        initialValue: 50,
        currentValue: 50,
        maxValue: 100,
        confirmed: true,
      },
      stateMetric: {
        valueUnit: 'sp',
        observedSourceValueUnit: 'sp',
        initialValue: 50,
        currentValue: 50,
        maxValue: 100,
      },
      sourceSemantics: {
        semanticResource: 'kibo-sp',
        status: 'project-initial-kibo-sp-tracking-baseline',
        valueSourceStatus: 'project-initial-runtime-state',
        observation: null,
      },
      trackingOnly: true,
      appliedToCalculators: false,
    });
  });

  it('does not mix cooldown readiness observations into a configured SP baseline', () => {
    const scenario = createScenario([
      createObservation(),
      createObservation({
        eventIndex: 1,
        frameIndex: 60,
        timeMs: 1000,
        cdTime: 0,
        ready: true,
      }),
    ]);
    scenario.initialRuntimeState = {
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-1',
          actorId: 'actor-109001',
          characterId: 109001,
          kiboId: 500001,
          currentValue: 50,
          maxValue: 100,
        },
      ],
    };

    const [curve] = createKiboEnergyRuntimeCurves({ scenario });

    expect(curve).toMatchObject({
      semanticResource: 'kibo-sp',
      pointCount: 0,
      stateMetric: {
        valueUnit: 'sp',
        initialValue: 50,
        currentValue: 50,
        maxValue: 100,
      },
      sourceSemantics: {
        status: 'project-initial-kibo-sp-tracking-baseline',
        observation: null,
      },
    });
  });
});
