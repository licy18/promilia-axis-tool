import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_RUNTIME_FLOW_PLAN_KINDS,
  WORKBENCH_RUNTIME_FLOW_PLAN_MODES,
  createRuntimeEntryFlowPlan,
  createRuntimePointFocusFlowPlan,
} from '../../features/workbench/workbenchRuntimeFlowPlan';

describe('workbench runtime flow plan', () => {
  it('opens the selected action runtime result when a point exists', () => {
    const plan = createRuntimeEntryFlowPlan({
      runtimeProjection: createRuntimeProjectionFixture(),
      actionId: 'action-0002',
    });

    expect(plan).toMatchObject({
      kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_ENTRY,
      mode: WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_RESULT,
      actionId: 'action-0002',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      calculatorScope: 'runtime',
      pulseCalculatorFocus: true,
      selectFirstRuntimePoint: false,
      selectRuntimeStatePoint: true,
      clearRuntimeSelection: false,
      stateCurveFocusMode: 'selected',
      stateCurveLayerFilters: {
        applied: true,
        candidate: false,
        sampled: false,
        placeholder: false,
      },
      stateCurveTrackFilters: {},
    });
  });

  it('opens runtime overview when the selected action has no runtime point', () => {
    const plan = createRuntimeEntryFlowPlan({
      runtimeProjection: createRuntimeProjectionFixture(),
      actionId: 'action-missing',
    });

    expect(plan).toMatchObject({
      kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_ENTRY,
      mode: WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_OVERVIEW,
      actionId: 'action-missing',
      statePointId: '',
      calculatorScope: 'runtime',
      pulseCalculatorFocus: true,
      selectRuntimeStatePoint: false,
      clearRuntimeSelection: true,
      stateCurveFocusMode: 'all',
    });
  });

  it('focuses a runtime point without pulsing the calculator diagnostic', () => {
    const plan = createRuntimePointFocusFlowPlan({
      statePointId: 'hp-delta:enemyHpDamage:applied',
      source: 'action-result',
    });

    expect(plan).toMatchObject({
      kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_POINT_FOCUS,
      mode: WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_RESULT,
      statePointId: 'hp-delta:enemyHpDamage:applied',
      calculatorScope: 'runtime',
      pulseCalculatorFocus: false,
      selectRuntimeStatePoint: true,
      clearRuntimeSelection: false,
      stateCurveFocusMode: 'selected',
      runtimeLogFocusSource: 'action-result',
      stateCurveLayerFilters: {
        applied: true,
        candidate: false,
        sampled: false,
        placeholder: false,
      },
      stateCurveTrackFilters: {},
    });
  });

  it('clears runtime point focus when no state point is available', () => {
    const plan = createRuntimePointFocusFlowPlan({
      statePointId: '',
      source: 'action-result',
    });

    expect(plan).toMatchObject({
      kind: WORKBENCH_RUNTIME_FLOW_PLAN_KINDS.RUNTIME_POINT_FOCUS,
      mode: WORKBENCH_RUNTIME_FLOW_PLAN_MODES.RUNTIME_POINT_EMPTY,
      statePointId: '',
      calculatorScope: '',
      selectRuntimeStatePoint: true,
      clearRuntimeSelection: true,
      stateCurveFocusMode: 'all',
      stateCurveLayerFilters: null,
      stateCurveTrackFilters: null,
      runtimeLogFocusSource: '',
    });
  });
});

function createRuntimeProjectionFixture() {
  return {
    outputContract: {
      outputs: {
        simLog: {
          rowCount: 2,
        },
      },
      summary: {
        simLogCount: 2,
      },
    },
    summary: {
      simLogCount: 2,
    },
    simLog: [
      {
        sourceDeltaId: 'hp-delta',
        actionId: 'action-0001',
        frameIndex: 12,
        sequenceIndex: 0,
        stateCurveSequenceIndex: 0,
        trackKey: 'enemyHpDamage',
        layerKey: 'applied',
      },
      {
        sourceDeltaId: 'energy-delta',
        actionId: 'action-0002',
        frameIndex: 30,
        sequenceIndex: 1,
        stateCurveSequenceIndex: 1,
        trackKey: 'selfEnergyChange',
        layerKey: 'applied',
      },
    ],
    stateCurves: {
      enemy: {
        points: [
          {
            sourceDeltaId: 'hp-delta',
            actionId: 'action-0001',
            frameIndex: 12,
            sequenceIndex: 0,
            stateCurveSequenceIndex: 0,
            trackKey: 'enemyHpDamage',
            layerKey: 'applied',
          },
        ],
      },
    },
    resourceCurves: {
      curvesByActor: [
        {
          actorId: 'actor-001',
          actorName: '末音',
          points: [
            {
              sourceDeltaId: 'energy-delta',
              actionId: 'action-0002',
              frameIndex: 30,
              sequenceIndex: 1,
              stateCurveSequenceIndex: 1,
              trackKey: 'selfEnergyChange',
              layerKey: 'applied',
            },
          ],
        },
      ],
    },
  };
}
