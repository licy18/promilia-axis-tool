import { describe, expect, it } from 'vitest';
import {
  createEmptyWorkbenchActionEditFocus,
  createEmptyWorkbenchActionEditSource,
  createWorkbenchActionEditResultContext,
  createWorkbenchActionEditSource,
  resolveWorkbenchActionEditSourceField,
} from '../../features/workbench/workbenchActionEditSource';

describe('workbench action edit source', () => {
  it('describes frame-based action timing edits', () => {
    const source = createWorkbenchActionEditSource({
      actionId: 'action-0001',
      patch: {
        startMs: 1000,
      },
      previousAction: {
        id: 'action-0001',
        startMs: 0,
      },
      nextAction: {
        id: 'action-0001',
        startMs: 1000,
      },
      previousSource: createEmptyWorkbenchActionEditSource(6),
    });

    expect(source).toMatchObject({
      actionId: 'action-0001',
      fieldKey: 'startMs',
      label: '开始时间变更',
      previousValue: '0s0f',
      nextValue: '1s0f',
      changeSummary: '0s0f -> 1s0f',
      editOrigin: '',
      sequence: 7,
    });
  });

  it('normalizes lane edits through actor character names and carries runtime focus origin', () => {
    const source = createWorkbenchActionEditSource({
      actionId: 'action-0002',
      patch: {
        laneId: 'actor-b',
      },
      previousAction: {
        id: 'action-0002',
        actorCharacterId: 1001,
      },
      nextAction: {
        id: 'action-0002',
        actorCharacterId: 1002,
      },
      previousSource: createEmptyWorkbenchActionEditSource(2),
      focus: {
        ...createEmptyWorkbenchActionEditFocus(),
        actionId: 'action-0002',
        editOrigin: 'runtime-focus',
        focusSource: 'runtime-detail',
        originStatePointId: 'enemyHpDamage|applied|action-0002|12|0',
        originTrackKey: 'enemyHpDamage',
        originFrameLabel: '0s12f',
      },
      resolveCharacterName: characterId =>
        ({
          1001: '末音',
          1002: '寒悠悠',
        })[characterId] ?? String(characterId),
    });

    expect(source).toMatchObject({
      actionId: 'action-0002',
      fieldKey: 'laneId',
      label: '轨道变更',
      previousValue: '末音',
      nextValue: '寒悠悠',
      changeSummary: '末音 -> 寒悠悠',
      editOrigin: 'runtime-focus',
      focusSource: 'runtime-detail',
      originLabel: '来自结果定位',
      originStatePointId: 'enemyHpDamage|applied|action-0002|12|0',
      originTrackKey: 'enemyHpDamage',
      originFrameLabel: '0s12f',
      sequence: 3,
    });
  });

  it('keeps the shared field priority stable for mixed patches', () => {
    expect(
      resolveWorkbenchActionEditSourceField({
        note: '手动修正',
        startMs: 500,
      })
    ).toBe('startMs');
  });

  it('does not create incomplete edit sources', () => {
    expect(
      createWorkbenchActionEditSource({
        patch: {
          startMs: 1000,
        },
      })
    ).toBeNull();

    expect(
      createWorkbenchActionEditSource({
        actionId: 'action-0003',
        patch: {
          untrackedField: true,
        },
      })
    ).toBeNull();
  });

  it('resolves refreshed result context from the preferred runtime track', () => {
    const context = createWorkbenchActionEditResultContext({
      source: {
        actionId: 'action-0004',
        fieldKey: 'startMs',
        label: '开始时间变更',
        changeSummary: '0s0f -> 1s0f',
        originStatePointId: 'enemyHpDamage|applied|action-0004|10|0',
        originTrackKey: 'selfEnergyChange',
        originFrameLabel: '0s10f',
        focusSource: 'runtime-detail',
      },
      runtimeProjection: createRuntimeProjectionFixture(),
    });

    expect(context).toMatchObject({
      status: 'refreshed-edit-result',
      actionId: 'action-0004',
      fieldKey: 'startMs',
      label: '开始时间变更',
      changeSummary: '0s0f -> 1s0f',
      originStatePointId: 'enemyHpDamage|applied|action-0004|10|0',
      originTrackKey: 'selfEnergyChange',
      originFrameLabel: '0s10f',
      focusSource: 'runtime-detail',
      runtimeStatePointId: 'selfEnergyChange|applied|action-0004|11|1',
      runtimeTrackKey: 'selfEnergyChange',
    });
  });

  it('returns no refreshed context when the action has no runtime point', () => {
    expect(
      createWorkbenchActionEditResultContext({
        source: {
          actionId: 'missing-action',
        },
        runtimeProjection: createRuntimeProjectionFixture(),
      })
    ).toBeNull();
  });
});

function createRuntimeProjectionFixture() {
  return {
    simLog: [
      {
        sourceDeltaId: 'hp-delta',
        actionId: 'action-0004',
        trackKey: 'enemyHpDamage',
        layerKey: 'applied',
        frameIndex: 10,
        sequenceIndex: 0,
        stateCurveSequenceIndex: 0,
      },
      {
        sourceDeltaId: 'energy-delta',
        actionId: 'action-0004',
        trackKey: 'selfEnergyChange',
        layerKey: 'applied',
        frameIndex: 11,
        sequenceIndex: 1,
        stateCurveSequenceIndex: 1,
      },
    ],
    stateCurves: {
      enemy: {
        points: [
          {
            sourceDeltaId: 'hp-delta',
            actionId: 'action-0004',
            trackKey: 'enemyHpDamage',
            layerKey: 'applied',
            frameIndex: 10,
            sequenceIndex: 0,
            stateCurveSequenceIndex: 0,
          },
        ],
      },
    },
    resourceCurves: {
      curvesByActor: [
        {
          points: [
            {
              sourceDeltaId: 'energy-delta',
              actionId: 'action-0004',
              trackKey: 'selfEnergyChange',
              layerKey: 'applied',
              frameIndex: 11,
              sequenceIndex: 1,
              stateCurveSequenceIndex: 1,
            },
          ],
        },
      ],
    },
  };
}
