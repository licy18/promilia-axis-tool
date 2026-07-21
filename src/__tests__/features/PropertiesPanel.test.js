import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PropertiesPanel from '../../features/workbench/PropertiesPanel.vue';

describe('PropertiesPanel', () => {
  it('shows the verified action trace as one ordered source chain', () => {
    const wrapper = mount(PropertiesPanel, {
      props: {
        selection: { characterId: 101007, enemyId: 208001 },
        characters: [{ id: 101007, name: '芃芃' }],
        actors: [{ id: 'actor-a', characterId: 101007, name: '芃芃' }],
        skills: [{ id: 10100703, name: '星鸣技' }],
        enemies: [{ id: 208001, name: '训练敌人' }],
        selectedAction: {
          id: 'action-a',
          type: 'skill',
          name: '星鸣技',
          actorId: 'actor-a',
          skillId: 10100703,
          startMs: 0,
          durationMs: 1_000,
          effectCommands: [],
        },
        durationMs: 30_000,
        verifiedCombatRuntime: {
          enabled: true,
          packageHash: '1234567890abcdef',
          actionResolutionById: new Map([
            [
              'action-a',
              {
                status: 'verified-ready',
                actionBinding: {
                  identity: 'actor|101007|skill',
                  controlSkillId: 10100703,
                },
                hits: [{}, {}],
                effects: [{}],
                reasons: [],
                ready: true,
                complete: true,
                applied: true,
              },
            ],
          ]),
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
                operation: 'apply',
                appliedToCalculators: true,
              },
            ],
          },
          tuningMarkRuntime: {
            events: [
              {
                actionId: 'action-a',
                kind: 'acquire',
                sourceIdentity: 'Battle/fire-mark',
              },
            ],
            unresolved: [],
          },
        },
      },
    });

    const trace = wrapper.get(
      '[data-testid="workbench-verified-mechanics-trace"]'
    );
    expect(trace.attributes()).toMatchObject({
      'data-trace-status': 'applied',
      'data-runtime-hit-count': '2',
      'data-runtime-effect-count': '1',
      'data-runtime-tuning-count': '1',
    });
    expect(
      wrapper
        .findAll('[data-testid="workbench-verified-mechanics-trace-step"]')
        .map(item => item.attributes('data-trace-step'))
    ).toEqual([
      'action-variant',
      'action-binding',
      'effects',
      'property-snapshot',
      'hit-results',
      'runtime-state',
    ]);
    expect(trace.text()).toContain('HP -200 · 韧性 -30 · SP +5.2299');
    expect(trace.text()).toContain('包 1234567890');
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
      dynamicPropertyTrace: { source: [], target: [] },
    },
  };
}
