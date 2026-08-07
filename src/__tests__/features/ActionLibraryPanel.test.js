import { mount } from '@vue/test-utils';
import { afterEach, beforeEach } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { getSkillsForCharacter } from '../../domain/workbenchProjectFactory';
import ActionLibraryPanel from '../../features/workbench/ActionLibraryPanel.vue';

describe('ActionLibraryPanel', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  afterEach(() => {
    clearInstalledVerifiedCombatMechanicsPackage();
  });

  it('starts pointer drags for skills, resources, bound kibo events, and enemy events', async () => {
    const wrapper = mount(ActionLibraryPanel, {
      props: createActionLibraryProps(),
    });
    const sources = [
      {
        selector: '[data-testid="workbench-skill-entry"]',
        expected: {
          type: 'skill',
          skillId: 10900101,
          actionVariantIndex: 0,
          icon: 'tex_icon_skill_109001_00.png',
          label: '普通攻击',
        },
      },
      {
        selector: '[data-testid="workbench-add-resource-action"]',
        expected: { type: 'resource', label: '资源' },
      },
      {
        selector: '[data-testid="workbench-add-kibo-event-action"]',
        expected: {
          type: 'kiboEvent',
          skillId: 50000102,
          eventType: 'signature',
          icon: 'tex_icon_petskill_500001_02.png',
          label: '迅风刃',
          durationMs: 1416.666667,
        },
      },
      {
        selector: '[data-testid="workbench-add-enemy-event-action"]',
        expected: {
          type: 'enemyEvent',
          eventType: 'phase',
          label: '敌人事件',
        },
      },
    ];

    for (const [index, source] of sources.entries()) {
      await dispatchPointerDown(wrapper, source.selector, {
        button: 0,
        pointerId: index + 1,
        clientX: 12,
        clientY: 24,
      });
      expect(
        wrapper.emitted('begin-timeline-entry-drag')?.at(-1)?.[0]
      ).toMatchObject({
        entry: source.expected,
        pointerId: index + 1,
        clientX: 12,
        clientY: 24,
      });
    }
  });

  it('exposes all confirmed actions for the bound kibo', async () => {
    const wrapper = mount(ActionLibraryPanel, {
      props: createActionLibraryProps(),
    });
    const entries = wrapper.findAll(
      '[data-testid="workbench-kibo-action-entry"]'
    );
    expect(
      wrapper.get('[data-testid="workbench-skill-entry"] img').attributes('src')
    ).toBe('/assets/actions/tex_icon_skill_109001_00.png');

    expect(
      entries.map(entry => ({
        skillId: Number(entry.attributes('data-skill-id')),
        kind: entry.attributes('data-action-kind'),
      }))
    ).toEqual([
      { skillId: 50000102, kind: 'signature' },
      { skillId: 50000112, kind: 'break' },
    ]);
    expect(entries.map(entry => entry.text())).toEqual([
      expect.stringContaining('迅风刃'),
      expect.stringContaining('迅狼-合击'),
    ]);
    expect(entries.map(entry => entry.find('img').attributes('src'))).toEqual([
      '/assets/actions/tex_icon_petskill_500001_02.png',
      '/assets/actions/tex_icon_skill_petbreakatk.png',
    ]);
    expect(
      wrapper
        .get('[data-testid="workbench-kibo-auto-cast-note"]')
        .text()
    ).toContain('自动释放');
  });

  it('keeps an unbound kibo entry out of the pointer drag flow', async () => {
    const props = createActionLibraryProps();
    props.actor = {
      ...props.actor,
      loadout: { ...props.actor.loadout, kiboId: null },
    };
    props.actors = [props.actor];
    const wrapper = mount(ActionLibraryPanel, { props });
    const source = wrapper.find(
      '[data-testid="workbench-add-kibo-event-action"]'
    );
    expect(source.attributes('data-drag-enabled')).toBe('false');
    await dispatchPointerDown(wrapper, source, {
      button: 0,
      pointerId: 1,
      clientX: 12,
      clientY: 24,
    });
    expect(wrapper.emitted('begin-timeline-entry-drag')).toBeUndefined();
  });

  it('keeps verified attack input chains available when hit evidence is incomplete', async () => {
    const props = createActionLibraryProps();
    props.actor = {
      ...props.actor,
      id: 'actor-101010',
      characterId: 101010,
      name: '涂山小玉',
      loadout: { kiboId: null },
    };
    props.actors = [props.actor];
    props.activeActorCharacterId = 101010;
    props.skills = getSkillsForCharacter(101010);
    props.kibos = [];
    const wrapper = mount(ActionLibraryPanel, { props });
    const normal = wrapper.get(
      '[data-testid="workbench-skill-entry"][data-action-kind="normal-attack"]'
    );
    const charged = wrapper.get(
      '[data-testid="workbench-skill-entry"][data-action-kind="charged-attack"]'
    );

    expect(normal.attributes('data-timing-status')).toBe('applied');
    expect(normal.attributes('data-scheduling-status')).toBe('verified');
    expect(normal.attributes('data-attack-input-count')).toBe('5');
    expect(normal.attributes('disabled')).toBeUndefined();
    expect(normal.attributes('data-drag-enabled')).toBe('true');
    expect(normal.text()).toContain('212f');

    expect(charged.attributes('data-timing-status')).toBe('applied');
    expect(charged.attributes('data-scheduling-status')).toBe('verified');
    expect(charged.attributes('disabled')).toBeUndefined();
    expect(charged.attributes('data-drag-enabled')).toBe('true');
    expect(charged.text()).toContain('75f');
    expect(charged.attributes('title')).toContain('变体条件已部分解析');

    await dispatchPointerDown(wrapper, normal, {
      button: 0,
      pointerId: 31,
      clientX: 12,
      clientY: 24,
    });
    expect(
      wrapper.emitted('begin-timeline-entry-drag')?.at(-1)?.[0]
    ).toMatchObject({
      entry: {
        type: 'skill',
        timingStatus: 'applied',
        schedulingStatus: 'verified',
        schedulingKind: 'exact-selected-variant-occupancy',
        planningDurationFrames: null,
        attackInputSegments: expect.arrayContaining([
          expect.objectContaining({
            sequenceIndex: 1,
            sequenceTotal: 5,
            durationFrames: 20,
          }),
          expect.objectContaining({
            sequenceIndex: 5,
            sequenceTotal: 5,
            durationFrames: 80,
          }),
        ]),
      },
    });
  });

  it('keeps Ruby default inputs separate from the enhanced source pool during drag', async () => {
    const props = createActionLibraryProps();
    props.actor = {
      ...props.actor,
      id: 'actor-103002',
      characterId: 103002,
      name: '红宝石',
      loadout: { kiboId: null },
    };
    props.actors = [props.actor];
    props.activeActorCharacterId = 103002;
    props.skills = getSkillsForCharacter(103002);
    props.kibos = [];
    const wrapper = mount(ActionLibraryPanel, { props });
    const normal = wrapper.get(
      '[data-testid="workbench-skill-entry"][data-action-kind="normal-attack"]'
    );

    expect(normal.attributes('data-attack-input-count')).toBe('3');
    await dispatchPointerDown(wrapper, normal, {
      button: 0,
      pointerId: 32,
      clientX: 12,
      clientY: 24,
    });
    const entry =
      wrapper.emitted('begin-timeline-entry-drag')?.at(-1)?.[0]?.entry;
    expect(entry.attackInputSegments).toHaveLength(3);
    expect(entry.attackInputSourceSegments).toHaveLength(5);
    expect(
      new Set(
        entry.attackInputSourceSegments.map(segment => segment.controlSkillId)
      )
    ).toEqual(
      new Set([10300201, 10300202, 10300203, 10300204, 10300205])
    );
  });

  it('saves and reuses compatible fragments through the compact library view', async () => {
    const props = createActionLibraryProps();
    props.selectedActionIds = ['action-0001', 'action-0002'];
    props.timelineFragments = [
      {
        id: 'fragment-alpha',
        name: '角色奇波连携',
        description: '',
        tags: ['连携'],
        durationMs: 2500,
        summary: {
          actionCount: 3,
          laneKinds: ['actor-action', 'actor-kibo'],
        },
        compatibility: {
          status: 'valid',
          issues: [],
        },
      },
      {
        id: 'fragment-blocked',
        name: '不兼容片段',
        description: '',
        tags: [],
        durationMs: 1000,
        summary: {
          actionCount: 1,
          laneKinds: ['actor-action'],
        },
        compatibility: {
          status: 'blocked',
          issues: [{ message: '固定槽位角色不匹配' }],
        },
      },
    ];
    const wrapper = mount(ActionLibraryPanel, { props });

    await wrapper
      .get('[data-testid="workbench-fragment-library-tab"]')
      .trigger('click');
    expect(wrapper.attributes('data-library-view')).toBe('fragments');
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-fragment"]')
    ).toHaveLength(2);

    await wrapper
      .get('[data-testid="workbench-fragment-name-input"]')
      .setValue('新的连携');
    await wrapper
      .get('[data-testid="workbench-fragment-tags-input"]')
      .setValue('连携, 起手');
    await wrapper
      .get('[data-testid="workbench-save-timeline-fragment"]')
      .trigger('submit');
    expect(wrapper.emitted('save-timeline-fragment')?.[0]?.[0]).toEqual({
      name: '新的连携',
      tags: '连携, 起手',
    });

    const compatible = wrapper.get(
      '[data-testid="workbench-insert-timeline-fragment"][data-fragment-id="fragment-alpha"]'
    );
    await dispatchPointerDown(wrapper, compatible, {
      button: 0,
      pointerId: 17,
      clientX: 18,
      clientY: 26,
    });
    expect(wrapper.emitted('begin-timeline-fragment-drag')?.[0]?.[0]).toEqual({
      fragmentId: 'fragment-alpha',
      pointerId: 17,
      clientX: 18,
      clientY: 26,
    });
    await compatible.trigger('click');
    expect(wrapper.emitted('insert-timeline-fragment')?.[0]).toEqual([
      'fragment-alpha',
    ]);

    const blocked = wrapper.get(
      '[data-testid="workbench-insert-timeline-fragment"][data-fragment-id="fragment-blocked"]'
    );
    expect(blocked.attributes('disabled')).toBeDefined();
    expect(blocked.attributes('title')).toBe('固定槽位角色不匹配');

    await wrapper
      .get('[data-testid="workbench-fragment-search"]')
      .setValue('不兼容');
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-fragment"]')
    ).toHaveLength(1);
    await wrapper
      .get('[data-testid="workbench-fragment-search"]')
      .setValue('没有结果');
    expect(wrapper.get('[data-testid="workbench-fragment-empty"]').text()).toBe(
      '没有匹配的片段'
    );
    await wrapper.get('[data-testid="workbench-fragment-search"]').setValue('');

    await wrapper
      .get(
        '[data-testid="workbench-duplicate-timeline-fragment"][data-fragment-id="fragment-alpha"]'
      )
      .trigger('click');
    expect(wrapper.emitted('duplicate-timeline-fragment')?.[0]).toEqual([
      'fragment-alpha',
    ]);
    await wrapper
      .get(
        '[data-testid="workbench-delete-timeline-fragment"][data-fragment-id="fragment-alpha"]'
      )
      .trigger('click');
    expect(wrapper.emitted('delete-timeline-fragment')?.[0]).toEqual([
      'fragment-alpha',
    ]);
    await wrapper
      .get('[data-testid="workbench-export-fragment-library"]')
      .trigger('click');
    expect(wrapper.emitted('export-timeline-fragment-library')).toHaveLength(1);

    const importInput = wrapper.get(
      '[data-testid="workbench-import-fragment-library-file"]'
    );
    const importedFile = new File(['{}'], 'timeline-fragments.json', {
      type: 'application/json',
    });
    Object.defineProperty(importInput.element, 'files', {
      configurable: true,
      value: [importedFile],
    });
    await importInput.trigger('change');
    expect(wrapper.emitted('import-timeline-fragment-library')?.[0]).toEqual([
      importedFile,
    ]);
  });

  it('selects derived star-carry actions without exposing independent mutation commands', async () => {
    const props = createActionLibraryProps();
    props.actions = [
      {
        id: 'manual-action',
        type: 'skill',
        name: '星鸣技',
        startMs: 0,
        durationMs: 1000,
      },
      {
        id: 'derived-star-carry',
        type: 'skill',
        name: '入场星携技',
        startMs: 1000,
        durationMs: 2000,
        readOnly: true,
        parentActionId: 'switch-1',
        derivedAction: {
          kind: 'switch-triggered-star-carry',
          parentActionId: 'switch-1',
          readOnly: true,
        },
      },
    ];
    const wrapper = mount(ActionLibraryPanel, { props });
    const manual = wrapper.get('.action-item[data-action-id="manual-action"]');
    const derived = wrapper.get(
      '.action-item[data-action-id="derived-star-carry"]'
    );

    expect(manual.find('[data-testid="workbench-copy-action"]').exists()).toBe(
      true
    );
    expect(derived.attributes('data-read-only')).toBe('true');
    expect(derived.find('[data-testid="workbench-copy-action"]').exists()).toBe(
      false
    );
    expect(
      derived.find('[data-testid="workbench-delete-action"]').exists()
    ).toBe(false);

    await derived.trigger('click');
    expect(wrapper.emitted('select-action')?.at(-1)?.[0]).toMatchObject({
      actionId: 'derived-star-carry',
      mode: 'replace',
    });
    await derived.trigger('keydown', { key: 'Delete' });
    await derived.trigger('contextmenu', { clientX: 20, clientY: 20 });
    expect(wrapper.emitted('delete-selected-actions')).toBeUndefined();
    expect(wrapper.emitted('open-action-context-menu')).toBeUndefined();
  });
});

function createActionLibraryProps() {
  const actor = {
    id: 'actor-109001',
    characterId: 109001,
    name: '末音',
    role: '猛攻',
    loadout: { kiboId: 500001 },
  };
  return {
    actor,
    actors: [actor],
    kibos: [
      {
        id: 500001,
        name: '迅狼',
        actions: [
          {
            skillId: 50000102,
            kind: 'signature',
            icon: 'tex_icon_petskill_500001_02.png',
            name: '迅风刃',
            durationFrames: 85,
          },
          {
            skillId: 504004,
            kind: 'active',
            icon: 'tex_icon_petskill_504004.png',
            name: '狂风冲击',
            durationFrames: 220,
          },
          {
            skillId: 50000112,
            kind: 'break',
            icon: 'tex_icon_skill_petbreakatk.png',
            name: '迅狼-合击',
            durationFrames: 90,
          },
        ],
      },
    ],
    activeActorCharacterId: 109001,
    actions: [],
    skills: [
      {
        id: 10900101,
        characterId: 109001,
        name: '普通攻击',
        displayName: '普通攻击',
        icon: 'tex_icon_skill_109001_00.png',
        source: { heroModule: 'fixture/109001.js' },
        level: {
          labels: ['普攻'],
          values: [['100%']],
        },
      },
    ],
    selectedActionId: '',
    selectedActionIds: [],
  };
}

async function dispatchPointerDown(wrapper, target, init) {
  const element =
    typeof target === 'string' ? wrapper.find(target).element : target.element;
  const event = new MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    button: init.button,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperty(event, 'pointerId', {
    configurable: true,
    value: init.pointerId,
  });
  element.dispatchEvent(event);
  await wrapper.vm.$nextTick();
}
