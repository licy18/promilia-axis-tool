import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import PropertiesPanel from '../../features/workbench/PropertiesPanel.vue';

describe('PropertiesPanel', () => {
  it('shows the runtime-selected variant duration instead of the base draft duration', () => {
    const selectedAction = {
      id: 'jade-special-charged',
      type: 'skill',
      name: '重击',
      actorId: 'actor-jade',
      skillId: 10101001,
      startMs: 0,
      durationMs: (310 * 1000) / 60,
      effectCommands: [],
    };
    const selectedResolution = {
      status: 'verified-ready',
      actionBinding: {
        identity: 'actor|101010|charged|subskill:1',
        controlSkillId: 10101010,
        actualDurationFrames: 230,
        actualDurationMs: (230 * 1000) / 60,
      },
      hits: [],
      effects: [],
      reasons: [],
      ready: true,
      complete: true,
      applied: true,
    };
    const wrapper = mount(PropertiesPanel, {
      props: {
        selection: { characterId: 101010, enemyId: 208001 },
        characters: [{ id: 101010, name: '涂山小玉' }],
        actors: [{ id: 'actor-jade', characterId: 101010, name: '涂山小玉' }],
        skills: [{ id: 10101001, name: '画扇春' }],
        enemies: [{ id: 208001, name: '训练敌人' }],
        selectedAction,
        durationMs: 30_000,
        verifiedCombatRuntime: {
          enabled: true,
          actionResolutionById: new Map([
            [
              selectedAction.id,
              {
                ...selectedResolution,
                actionBinding: {
                  ...selectedResolution.actionBinding,
                  actualDurationFrames: 310,
                  actualDurationMs: (310 * 1000) / 60,
                },
              },
            ],
          ]),
          specialResourceRuntime: {
            actionResolutionById: new Map([
              [selectedAction.id, selectedResolution],
            ]),
            selectionByActionId: new Map(),
            resourceEvents: [],
          },
          damageEvents: [],
          resourceEvents: [],
          kiboResourceEvents: [],
          effectTimeline: { events: [] },
          tuningMarkRuntime: { events: [], unresolved: [] },
        },
      },
    });

    expect(
      wrapper.get('[data-testid="workbench-action-identity"]').text()
    ).toContain('230F');
  });

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
        name: '普攻1 子弹hit1',
        rawSourceName: '普攻1 子弹hit1',
        sourceNameStatus: 'source-name-ready',
        displayLabel: '普攻1 子弹hit1',
        referenceKind: 'bulletElements',
        sourceEvidenceStatus: 'runtime-dependent',
        scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        trigger: { launchFrame: 13, impactFrame: 13 },
      },
      {
        hitIdentity: 'control:10100303|hit:2',
        name: '普攻2|第1段伤害',
        rawSourceName: '普攻2|第1段伤害',
        sourceNameStatus: 'source-name-ready',
        displayLabel: '普攻2|第1段伤害',
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
          effectCommands: [
            {
              id: 'effect-600014',
              effectId: '600014',
              effectName: '【正式】宠物通用技能震屏（弱）',
              sourceStatus: 'generated-from-azpr-action-status-catalog',
              trackingStatus: 'unapplied',
              appliedToCalculators: false,
              offsetMs: 0,
              durationMs: null,
              targetKind: 'enemy',
              sourceIdentity: {},
            },
          ],
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
    expect(rows[0].text()).toContain('普攻1 子弹hit1');
    expect(rows[0].text()).toContain('13F');
    expect(rows[0].text()).toContain('零距离');
    expect(rows[1].text()).toContain('普攻2|第1段伤害');
    expect(rows[1].get('input').element.checked).toBe(false);
    expect(
      wrapper.get('[data-testid="workbench-effect-command-row"]').text()
    ).toContain('【正式】宠物通用技能震屏（弱）');
    expect(wrapper.text()).not.toContain('\uFFFD');

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

  it('shows switch trigger bindings while keeping generated star-carry children read-only', () => {
    const binding = {
      contractName: 'AzPrSwitchTriggerBinding',
      bindingId: 'switch-1|on-enter|actor-b',
      switchEventId: 'switch-1',
      triggerPhase: 'on-enter',
      sourceOwnerId: 'actor-a',
      targetOwnerId: 'actor-b',
      starCarryOwnerId: 'actor-b',
      starCarryOwnerName: '苃苃',
      sourceSkillId: 10100721,
      triggerFrame: 90,
      conditions: [],
      sourceIdentity: 'hero:101007|slot:203|skill:10100721',
      resolutionStatus: 'applied',
    };
    const baseProps = {
      selection: { characterId: 101003, enemyId: 208001 },
      characters: [
        { id: 101003, name: '寒悠悠' },
        { id: 101007, name: '苃苃' },
      ],
      actors: [
        { id: 'actor-a', characterId: 101003, name: '寒悠悠' },
        { id: 'actor-b', characterId: 101007, name: '苃苃' },
      ],
      skills: [{ id: 10100721, name: '入场星携技' }],
      enemies: [{ id: 208001, name: '训练敌人' }],
      durationMs: 30_000,
    };
    const parent = mount(PropertiesPanel, {
      props: {
        ...baseProps,
        selectedAction: {
          id: 'switch-1',
          type: 'switch',
          name: '切人',
          actorId: 'actor-a',
          targetActorId: 'actor-b',
          startMs: 1500,
          durationMs: 0,
          switchTriggerBindings: [binding],
        },
      },
    });
    const parentBinding = parent.get(
      '[data-testid="workbench-switch-trigger-binding"]'
    );
    expect(parentBinding.attributes()).toMatchObject({
      'data-trigger-phase': 'on-enter',
      'data-resolution-status': 'applied',
      'data-source-skill-id': '10100721',
    });
    expect(parentBinding.text()).toContain('入场触发');
    expect(parentBinding.text()).toContain('寒悠悠 -> 苃苃 · 90F');

    const child = mount(PropertiesPanel, {
      props: {
        ...baseProps,
        selectedAction: {
          id: 'switch-1-on-enter-actor-b',
          type: 'skill',
          name: '入场星携技',
          actorId: 'actor-b',
          skillId: 10100721,
          startMs: 1500,
          durationMs: 1200,
          parentActionId: 'switch-1',
          readOnly: true,
          derivedAction: {
            kind: 'switch-triggered-star-carry',
            parentActionId: 'switch-1',
            readOnly: true,
          },
          switchTriggerBinding: binding,
          effectCommands: [],
        },
      },
    });

    expect(
      child.get('[data-testid="workbench-switch-trigger-bindings"]').text()
    ).toContain('自动子动作');
    expect(child.find('[data-testid="workbench-skill-select"]').exists()).toBe(
      false
    );
    expect(
      child.find('[data-testid="workbench-action-frame-controls"]').exists()
    ).toBe(false);
    expect(child.find('[data-testid="workbench-note-input"]').exists()).toBe(
      false
    );
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
