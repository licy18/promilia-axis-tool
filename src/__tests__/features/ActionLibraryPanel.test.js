import { mount } from '@vue/test-utils';
import ActionLibraryPanel from '../../features/workbench/ActionLibraryPanel.vue';

describe('ActionLibraryPanel', () => {
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
      entries.map(entry => ({
        skillId: Number(entry.attributes('data-skill-id')),
        kind: entry.attributes('data-action-kind'),
      }))
    ).toEqual([
      { skillId: 50000102, kind: 'signature' },
      { skillId: 504004, kind: 'active' },
      { skillId: 50000112, kind: 'break' },
    ]);
    expect(entries.map(entry => entry.text())).toEqual([
      expect.stringContaining('迅风刃'),
      expect.stringContaining('狂风冲击'),
      expect.stringContaining('迅狼-合击'),
    ]);

    await entries[1].trigger('click');
    expect(wrapper.emitted('add-kibo-event-action')?.at(-1)?.[0]).toMatchObject(
      {
        type: 'kiboEvent',
        skillId: 504004,
        eventType: 'active',
        durationMs: 3666.666667,
      }
    );
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
            name: '迅风刃',
            durationFrames: 85,
          },
          {
            skillId: 504004,
            kind: 'active',
            name: '狂风冲击',
            durationFrames: 220,
          },
          {
            skillId: 50000112,
            kind: 'break',
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
