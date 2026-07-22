import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
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
                hits: [
                  {
                    hitIdentity: 'hit-1',
                    referenceKind: 'elements',
                    trigger: { startFrame: 10 },
                  },
                  {
                    hitIdentity: 'hit-2',
                    referenceKind: 'elements',
                    trigger: { startFrame: 20 },
                  },
                ],
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

  it('edits each stable hit identity without collapsing the whole action', async () => {
    const hits = [
      {
        hitIdentity: 'control:10100303|hit:1',
        name: '弹体 1',
        referenceKind: 'bulletElements',
        sourceEvidenceStatus: 'runtime-dependent',
        scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        trigger: { launchFrame: 13, impactFrame: 13 },
      },
      {
        hitIdentity: 'control:10100303|hit:2',
        name: '弹体 2',
        referenceKind: 'bulletElements',
        sourceEvidenceStatus: 'runtime-dependent',
        scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        trigger: { launchFrame: 16, impactFrame: 16 },
      },
    ];
    const wrapper = mount(PropertiesPanel, {
      props: {
        selection: { characterId: 101003, enemyId: 208001 },
        characters: [{ id: 101003, name: '寒悠悠' }],
        actors: [{ id: 'actor-han', characterId: 101003, name: '寒悠悠' }],
        skills: [{ id: 10100301, name: '普通攻击' }],
        enemies: [{ id: 208001, name: '训练敌人' }],
        selectedAction: {
          id: 'action-han-a3',
          type: 'skill',
          name: 'A3',
          actorId: 'actor-han',
          skillId: 10100301,
          startMs: 0,
          durationMs: 1_000,
          hitOverrides: {
            'control:10100303|hit:2': { willHit: false },
          },
          effectCommands: [],
        },
        durationMs: 30_000,
        verifiedCombatRuntime: {
          enabled: true,
          actionResolutionById: new Map([
            [
              'action-han-a3',
              {
                status: 'verified-ready',
                actionBinding: {
                  identity: 'actor|101003|normal-a3',
                  controlSkillId: 10100303,
                },
                hits: [hits[0]],
                allHits: hits,
                disabledHitIdentities: ['control:10100303|hit:2'],
                effects: [],
                reasons: ['projectile-impact-frame-runtime-dependent'],
                ready: true,
                complete: false,
                applied: true,
              },
            ],
          ]),
          damageEvents: [],
          resourceEvents: [],
          kiboResourceEvents: [],
          effectTimeline: { events: [] },
          tuningMarkRuntime: { events: [], unresolved: [] },
        },
      },
    });

    await vi.dynamicImportSettled();
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="workbench-hit-override-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('13F');
    expect(rows[0].text()).toContain('零距离');
    expect(rows[1].get('input').element.checked).toBe(false);

    await rows[0].get('input').setValue(false);
    expect(wrapper.emitted('update-action')?.at(-1)?.[0]).toEqual({
      hitOverrides: {
        'control:10100303|hit:1': { willHit: false },
        'control:10100303|hit:2': { willHit: false },
      },
    });
  });

  it('changes an input-controlled charge tier as one semantic action edit', async () => {
    const actionId = 'charged-action';
    const options = [
      {
        selectorIdentity: 'actor:107003|control:10700310|public-variant:1',
        label: '重击1',
        publicVariantIndex: 1,
        subSkillIndex: 0,
        durationFrames: 160,
        chargeTier: 1,
        sourceIdentity: 'Battle/control:10700310/player:0',
        resolutionStatus: 'applied',
      },
      {
        selectorIdentity: 'actor:107003|control:10700310|public-variant:3',
        label: '重击3一段',
        publicVariantIndex: 3,
        subSkillIndex: 2,
        durationFrames: 416,
        chargeTier: 3,
        sourceIdentity: 'Battle/control:10700310/player:2',
        resolutionStatus: 'applied',
      },
    ];
    const wrapper = mount(PropertiesPanel, {
      props: {
        selection: { characterId: 107003, enemyId: 208001 },
        characters: [{ id: 107003, name: '测试角色' }],
        actors: [{ id: 'actor-107003', characterId: 107003, name: '测试角色' }],
        skills: [{ id: 10700301, name: '普通攻击' }],
        enemies: [{ id: 208001, name: '训练敌人' }],
        selectedAction: {
          id: actionId,
          type: 'skill',
          name: '重击1',
          actorId: 'actor-107003',
          skillId: 10700301,
          actionVariantIndex: 1,
          startMs: 0,
          durationMs: (160 * 1000) / 60,
          effectCommands: [],
        },
        durationMs: 30_000,
        verifiedCombatRuntime: {
          enabled: true,
          actionResolutionById: new Map([
            [
              actionId,
              {
                status: 'verified-ready',
                actionBinding: {
                  identity: 'actor|107003|charged',
                  controlSkillId: 10700310,
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
          resourceEvents: [],
          kiboResourceEvents: [],
          effectTimeline: { events: [] },
          tuningMarkRuntime: { events: [], unresolved: [] },
          specialResourceRuntime: {
            resourceEvents: [],
            selectionByActionId: new Map([
              [
                actionId,
                {
                  actionId,
                  actorId: 'actor-107003',
                  ownerId: 107003,
                  controlSkillId: 10700310,
                  selectedSubSkillIndex: 0,
                  controlSource: 'input-controlled',
                  contractIdentity:
                    'actor:107003|control:10700310|derived-control',
                  contractResolutionStatus: 'applied',
                  inputSelector: {
                    kind: 'charge-tier',
                    mode: 'hold',
                    holdRange: { minimumHoldMs: 250 },
                    resolutionStatus: 'applied',
                    options,
                  },
                  inputSelectionStatus: 'selected',
                  selectedInputIdentity: options[0].selectorIdentity,
                  sourceKind: 'workbench-semantic-input-variant',
                  status: 'verified-action-variant-selection-ready',
                },
              ],
            ]),
          },
        },
      },
    });

    const buttons = wrapper.findAll(
      '[data-testid="workbench-action-variant-option"]'
    );
    expect(buttons).toHaveLength(2);
    expect(buttons[0].attributes('aria-pressed')).toBe('true');
    await buttons[1].trigger('click');

    const patch = wrapper.emitted('update-action')?.at(-1)?.[0];
    expect(patch).toMatchObject({
      variantInputSelection: {
        selectorIdentity: options[1].selectorIdentity,
        selectorKind: 'charge-tier',
        publicVariantIndex: 3,
        chargeTier: 3,
        mode: 'hold',
      },
      controlSubSkillIndex: 2,
      actionVariantIndex: 3,
      damageSegmentIndex: 3,
      durationFrames: 416,
      timingStatus: 'applied',
      needsTimingData: false,
    });
    expect(patch.durationMs).toBeCloseTo((416 * 1000) / 60, 5);
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
