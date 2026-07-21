import { describe, expect, it } from 'vitest';
import { createVerifiedActionMechanicsTrace } from '../../features/workbench/verifiedActionMechanicsTrace';

describe('verified action mechanics trace', () => {
  it('links binding, property snapshot, hits, effects and tuning events', () => {
    const action = {
      id: 'action-a',
      actorId: 'actor-a',
      type: 'skill',
      name: '星鸣技',
    };
    const resolution = {
      status: 'verified-combat-action-mechanics-ready',
      packageId: 'package-v9',
      packageHash: 'abc123',
      actionBinding: {
        identity: 'actor|101007|skill',
        controlSkillId: 10100703,
      },
      hits: [{ hitIdentity: 'hit-a' }, { hitIdentity: 'hit-b' }],
      effects: [{ effectIdentity: 'effect-a' }],
      reasons: [],
      ready: true,
      complete: true,
      applied: true,
    };
    const trace = createVerifiedActionMechanicsTrace({
      action,
      scenario: {
        actors: [
          {
            id: 'actor-a',
            verifiedStaticProperties: {
              sourceIdentity: { characterId: 101007, revision: 'loadout-a' },
            },
          },
        ],
      },
      verifiedCombatRuntime: {
        enabled: true,
        packageId: 'package-v9',
        packageHash: 'abc123',
        actionResolutionById: new Map([['action-a', resolution]]),
        damageEvents: [
          createHit({ hp: 120, toughness: 20, attack: 300 }),
          createHit({ hp: 80, toughness: 10, attack: 300 }),
        ],
        resourceEvents: [{ actionId: 'action-a', payload: { change: 1.07 } }],
        kiboResourceEvents: [
          { actionId: 'action-a', payload: { change: 4.1599 } },
        ],
        effectTimeline: {
          events: [
            {
              actionId: 'action-a',
              eventType: 'EFFECT_APPLIED',
              operation: 'apply',
              appliedToCalculators: true,
              sourceIdentity: { effectIdentity: 'effect-a' },
            },
          ],
        },
        tuningMarkRuntime: {
          events: [
            {
              actionId: 'action-a',
              kind: 'acquire',
              sourceIdentity: { path: 'Battle/fire-mark' },
            },
          ],
          unresolved: [],
        },
      },
    });

    expect(trace).toMatchObject({
      status: 'applied',
      statusLabel: '已验证',
      bindingIdentity: 'actor|101007|skill',
      controlSkillId: 10100703,
      hitBindingCount: 2,
      effectBindingCount: 1,
      runtimeHitCount: 2,
      runtimeEffectEventCount: 1,
      runtimeTuningEventCount: 1,
      dynamicPropertyCount: 1,
    });
    expect(trace.steps.map(step => step.key)).toEqual([
      'action-variant',
      'action-binding',
      'effects',
      'property-snapshot',
      'hit-results',
      'runtime-state',
    ]);
    expect(trace.steps[4].detail).toBe('HP -200 · 韧性 -30 · SP +5.2299');
    expect(trace.sourceRows.some(row => row.label === '角色装配')).toBe(true);
    expect(trace.sourceRows.some(row => row.label === '印记 1')).toBe(true);
  });

  it('keeps incomplete action mechanics visibly unresolved', () => {
    const trace = createVerifiedActionMechanicsTrace({
      action: {
        id: 'action-b',
        actorId: 'actor-b',
        type: 'skill',
        name: '技能',
      },
      verifiedCombatRuntime: {
        enabled: true,
        actionResolutionById: new Map([
          [
            'action-b',
            {
              status: 'verified-action-binding-missing',
              reasons: ['control-binding-missing'],
              ready: false,
              complete: false,
              applied: false,
            },
          ],
        ]),
        damageEvents: [],
        resourceEvents: [],
        kiboResourceEvents: [],
        effectTimeline: { events: [] },
        tuningMarkRuntime: { events: [], unresolved: [] },
      },
    });

    expect(trace).toMatchObject({
      status: 'unresolved',
      statusLabel: '未解析',
      runtimeHitCount: 0,
      unresolved: ['control-binding-missing'],
    });
  });

  it('keeps character special resources separate from SP in the trace', () => {
    const trace = createVerifiedActionMechanicsTrace({
      action: {
        id: 'ruby-ultimate',
        actorId: 'actor-103002',
        type: 'skill',
        name: '星决技',
      },
      verifiedCombatRuntime: {
        enabled: true,
        actionResolutionById: new Map([
          [
            'ruby-ultimate',
            {
              status: 'verified-ready',
              actionBinding: {
                identity: 'actor|103002|10300213|0|10300213',
                controlSkillId: 10300213,
              },
              hits: [],
              effects: [],
              reasons: [],
              ready: true,
              complete: true,
              applied: true,
            },
          ],
        ]),
        damageEvents: [],
        resourceEvents: [{ actionId: 'ruby-ultimate', payload: { change: 1 } }],
        kiboResourceEvents: [],
        specialResourceRuntime: {
          selectionByActionId: new Map([
            [
              'ruby-ultimate',
              {
                selectedSubSkillIndex: 0,
                sourceKind: 'verified-client-default-subskill-index',
                status: 'verified-action-variant-selection-ready',
              },
            ],
          ]),
          resourceEvents: [
            {
              actionId: 'ruby-ultimate',
              payload: {
                resourceName: '子弹',
                change: 12,
                sourceIdentity: 'Battle/103002047',
              },
            },
          ],
        },
        effectTimeline: { events: [] },
        tuningMarkRuntime: { events: [], unresolved: [] },
      },
    });

    expect(trace.steps.find(step => step.key === 'hit-results')?.detail).toBe(
      'HP -0 · 韧性 -0 · SP +1'
    );
    expect(
      trace.steps.find(step => step.key === 'special-resource')
    ).toMatchObject({
      label: '子弹',
      value: '+12 · 1 个事件',
      applied: true,
    });
    expect(trace.specialResourceDelta).toBe(12);
    expect(trace.sourceRows).toContainEqual({
      label: '角色资源 1',
      identity: 'Battle/103002047',
    });
  });
});

function createHit({ hp, toughness, attack }) {
  return {
    type: 'VERIFIED_COMBAT_HIT',
    actionId: 'action-a',
    payload: {
      rawDamage: hp,
      toughnessDamage: toughness,
      attack,
      bindingIdentity: 'actor|101007|skill',
      attackSource: { characterId: 101007 },
      enemyProfileSourceIdentity: { enemyId: 208001 },
      dynamicPropertyTrace: {
        source: [
          {
            attributeId: 1,
            baseRaw: 280,
            dynamicPercentRaw: 0,
            dynamicExtraRaw: 20,
            dynamicForceRaw: null,
            value: attack,
          },
        ],
        target: [],
      },
    },
  };
}
