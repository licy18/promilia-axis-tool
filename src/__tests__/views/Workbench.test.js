import { readFileSync } from 'node:fs';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import machineAxisFixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import workbenchSkillDiagnostics from '../../data/generated/workbench-skill-diagnostics.json';
import workbenchSeed from '../../data/generated/workbench-seed.json';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  WORKBENCH_DRAFT_SCHEMA_VERSION,
  WORKBENCH_DRAFT_STORAGE_KEY,
  createWorkbenchDraftSnapshot,
} from '../../domain/workbenchDraftStorage';
import {
  createWorkbenchActionDraft,
  getSkillActionCatalog,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import { WORKBENCH_LAYOUT_STORAGE_KEY } from '../../domain/workbenchLayout';
import { frameToMs, msToFrame } from '../../domain/timebase';
import AnalysisPanel from '../../features/workbench/AnalysisPanel.vue';
import ActionLibraryPanel from '../../features/workbench/ActionLibraryPanel.vue';
import EventLogPanel from '../../features/workbench/EventLogPanel.vue';
import ResourceMonitorPanel from '../../features/workbench/ResourceMonitorPanel.vue';
import RuntimeSelectedDetailPanel from '../../features/workbench/RuntimeSelectedDetailPanel.vue';
import TeamLoadoutPanel from '../../features/workbench/TeamLoadoutPanel.vue';
import PropertiesPanel from '../../features/workbench/PropertiesPanel.vue';
import TimelineGridPreview from '../../features/workbench/TimelineGridPreview.vue';
import WorkbenchLoadoutPicker from '../../features/workbench/WorkbenchLoadoutPicker.vue';
import WorkbenchFlowPanel from '../../features/workbench/WorkbenchFlowPanel.vue';
import {
  getWorkbenchPerformanceCounters,
  resetWorkbenchPerformanceCounters,
} from '../../features/workbench/workbenchPerformanceInstrumentation';
import {
  installProjectSimulationSkillDiagnostics,
  resetProjectSimulationSkillDiagnostics,
} from '../../simulation/projection/projectSimulationResult';
import Workbench from '../../views/Workbench.vue';

enableAutoUnmount(afterEach);

const workbenchMechanicsProfileMockState = vi.hoisted(() => ({
  useVerifiedProfile: false,
  durationMs: null,
}));

vi.mock('../../domain/workbenchDraftStorage', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    createDefaultWorkbenchDemoDraftState: () => ({
      ...actual.createDefaultWorkbenchDraftState(),
      ...(workbenchMechanicsProfileMockState.durationMs
        ? { durationMs: workbenchMechanicsProfileMockState.durationMs }
        : {}),
    }),
  };
});

vi.mock(
  '../../domain/workbenchMechanicsProfileSelection',
  async importOriginal => {
    const actual = await importOriginal();
    return {
      ...actual,
      createVerifiedWorkbenchMechanicsProfileSelection: () =>
        actual.normalizeWorkbenchMechanicsProfileSelection(
          workbenchMechanicsProfileMockState.useVerifiedProfile
            ? {
                profileId: actual.VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID,
                profileVersion:
                  actual.VERIFIED_WORKBENCH_MECHANICS_PROFILE_VERSION,
              }
            : undefined
        ),
    };
  }
);

vi.mock('../../data/workbenchKiboActionCatalog', () => ({
  projectWorkbenchKiboActionCatalog: catalog => catalog,
  loadWorkbenchKiboActionCatalog: async () => ({
    schemaVersion: 1,
    kind: 'workbench-kibo-action-catalog',
    items: [
      {
        kiboId: 500001,
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
  }),
}));

beforeAll(() => {
  installProjectSimulationSkillDiagnostics(workbenchSkillDiagnostics);
});

afterAll(() => {
  resetProjectSimulationSkillDiagnostics();
});

function readTestSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function compactSource(source) {
  return source.replace(/\s+/g, '');
}

async function settleWorkbenchAsyncPanels() {
  await vi.dynamicImportSettled();
  await flushPromises();
  await nextTick();
}

async function selectRuntimeReviewTab(wrapper, tabKey) {
  await wrapper
    .get(
      `[data-testid="workbench-runtime-review-tab"][data-review-tab="${tabKey}"]`
    )
    .trigger('click');
  await settleWorkbenchAsyncPanels();
}

async function selectSideInspectorPanel(wrapper, panelKey) {
  await wrapper
    .get(
      `[data-testid="workbench-side-inspector-tab"][data-inspector-panel="${panelKey}"]`
    )
    .trigger('click');
  await settleWorkbenchAsyncPanels();
}

async function addSkillActionFromLibrary(wrapper, actionKind = 'dodge-attack') {
  const activeActor = wrapper.get(
    '[data-testid="workbench-action-library-actor"][data-active="true"]'
  );
  const characterId = Number(activeActor.attributes('data-character-id'));
  const entry = getSkillActionCatalog(
    workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === characterId
    ),
    1
  ).find(item => item.kind === actionKind);
  expect(entry).toBeTruthy();
  const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
    action =>
      action.ownerKind === 'actor' &&
      action.ownerId === characterId &&
      action.sourceSkillId === Number(entry.skillId) &&
      action.actionVariantIndex === Number(entry.actionVariantIndex)
  );
  expect(mapping?.actionTiming?.status).toBe('applied');
  const durationFrames = mapping.actionTiming.occupancy.durationFrames;
  wrapper.findComponent(ActionLibraryPanel).vm.$emit('add-skill-action', {
    ...entry,
    durationFrames,
    durationMs: frameToMs(durationFrames),
    timingStatus: 'applied',
    timingReasons: [],
    timingSource: mapping.actionTiming.occupancy.sourceKind,
    timingSourceIdentity: mapping.actionTiming.occupancy.sourceIdentity,
    attackInputSegments: mapping.attackInputSegments ?? [],
  });
  await nextTick();
  return entry;
}

async function addSingleSkillActionFromLibrary(wrapper) {
  return addSkillActionFromLibrary(wrapper);
}

async function selectCharacterFromTimeline(wrapper, slotIndex, characterId) {
  await settleWorkbenchAsyncPanels();
  const actorLanes = wrapper.findAll(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"]'
  );
  await actorLanes[slotIndex]
    .get('[data-testid="workbench-direct-character-picker"]')
    .trigger('click');
  await settleWorkbenchAsyncPanels();
  wrapper.findComponent(WorkbenchLoadoutPicker).vm.$emit('select', characterId);
  await nextTick();
  await nextTick();
}

async function selectLoadoutFromTimeline(
  wrapper,
  characterId,
  slotKey,
  selectedId
) {
  await settleWorkbenchAsyncPanels();
  const picker =
    slotKey === 'kiboId'
      ? wrapper.get(
          `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-kibo"][data-character-id="${characterId}"] [data-testid="workbench-direct-kibo-picker"]`
        )
      : wrapper.get(
          `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-character-id="${characterId}"] [data-testid="workbench-direct-loadout-slot"][data-loadout-slot="${slotKey}"]`
        );
  await picker.trigger('click');
  await settleWorkbenchAsyncPanels();
  wrapper.findComponent(WorkbenchLoadoutPicker).vm.$emit('select', selectedId);
  await nextTick();
  await nextTick();
}

async function selectEnemyInspector(wrapper) {
  const enemy = workbenchSeed.gameData.enemies.find(
    item => Number(item.id) === Number(workbenchSeed.defaults.enemyId)
  );
  wrapper.findComponent(TimelineGridPreview).vm.$emit('select-identity', {
    kind: 'enemy',
    enemyId: enemy.id,
    label: enemy.name,
  });
  await nextTick();
  await settleWorkbenchAsyncPanels();
  await selectSideInspectorPanel(wrapper, 'enemy');
}

async function selectActorInspector(wrapper, characterId) {
  const actor = workbenchSeed.gameData.characters.find(
    item => Number(item.id) === Number(characterId)
  );
  wrapper.findComponent(TimelineGridPreview).vm.$emit('select-identity', {
    kind: 'actor',
    characterId: actor.id,
    label: actor.name,
  });
  await nextTick();
  await settleWorkbenchAsyncPanels();
  await selectSideInspectorPanel(wrapper, 'team-loadout');
}

function getTimelineTeamSlot(wrapper, slotIndex) {
  return wrapper.get(
    `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-team-slot-id="team-slot-${slotIndex + 1}"]`
  );
}

function getTimelineLoadoutSlot(wrapper, characterId, slotKey) {
  if (slotKey === 'kiboId') {
    return wrapper.get(
      `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-kibo"][data-character-id="${characterId}"] [data-testid="workbench-direct-kibo-picker"]`
    );
  }
  return wrapper.get(
    `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-character-id="${characterId}"] [data-testid="workbench-direct-loadout-slot"][data-loadout-slot="${slotKey}"]`
  );
}

describe('Workbench view', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    clearInstalledVerifiedCombatMechanicsPackage();
    workbenchMechanicsProfileMockState.useVerifiedProfile = false;
    workbenchMechanicsProfileMockState.durationMs = null;
  });

  it('renders the first real-data simulation slice', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const actionIdentity = wrapper.get(
      '[data-testid="workbench-action-identity"]'
    );
    expect(actionIdentity.get('img').attributes('src')).toMatch(
      /^\/assets\/actions\/tex_icon_skill_/
    );
    await selectSideInspectorPanel(wrapper, 'analysis');
    const text = wrapper.text();

    expect(text).toContain('工作台：末音 / 哈库茵剑舞 / 迅狼');
    expect(text).toContain('末音');
    expect(text).toContain('迅狼');
    expect(text).toContain('哈库茵剑舞');
    expect(text).toContain('stage5-damage-layer-breakdown-v1');
    expect(text).toContain('三值来源');
    expect(text).toContain(
      '三值框架 3轨 · 曲线 3条/15点 · 状态 16点 · 细节后补'
    );
    expect(text).toContain(
      '生成合同 1动作/6命中 · Delta 16 · 候选 15 · 已用 1'
    );
    expect(text).toContain('运行投影 HP 12,461 · 韧性 0 · 能量 0 · 日志 1');
    expect(
      wrapper
        .find('[data-testid="workbench-three-value-generation-layer-summary"]')
        .text()
    ).toBe('生成合同 1动作/6命中 · Delta 16 · 候选 15 · 已用 1');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-three-value-runtime-projection-summary"]'
        )
        .text()
    ).toBe('运行投影 HP 12,461 · 韧性 0 · 能量 0 · 日志 1');
    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.exists()).toBe(true);
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-flow-phase')).toBe('action-edit');
    expect(flowPanel.attributes('data-flow-primary-kind')).toBe(
      'open-runtime-results'
    );
    expect(flowPanel.attributes('data-flow-primary-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-flow-primary-state-point-id')).toBe('');
    expect(flowPanel.attributes('data-main-flow-next-target-kind')).toBe(
      'runtime-results'
    );
    expect(
      flowPanel.attributes('data-main-flow-action-edit-state-point-id')
    ).toBe('');
    expect(flowPanel.attributes('data-main-flow-return-state-point-id')).toBe(
      ''
    );
    const mainFlowWorkspace = wrapper.find(
      '[data-testid="workbench-main-flow-workspace"]'
    );
    expect(mainFlowWorkspace.exists()).toBe(true);
    expect(mainFlowWorkspace.attributes('data-flow-phase')).toBe('action-edit');
    expect(mainFlowWorkspace.attributes('data-main-flow-current-region')).toBe(
      'action-edit'
    );
    expect(
      mainFlowWorkspace.attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-results');
    expect(mainFlowWorkspace.attributes('data-main-flow-next-region')).toBe(
      'runtime-review'
    );
    expect(
      mainFlowWorkspace.attributes(
        'data-main-flow-pending-runtime-state-point-id'
      )
    ).toBe('');
    expect(
      mainFlowWorkspace.attributes('data-main-flow-selected-action-id')
    ).toBe('action-0001');
    expect(
      mainFlowWorkspace.attributes(
        'data-main-flow-selected-runtime-state-point-id'
      )
    ).toBe('');
    expect(mainFlowWorkspace.attributes()).toMatchObject({
      'data-main-flow-dispatch-sequence': '0',
      'data-main-flow-dispatch-status': 'idle',
      'data-main-flow-dispatch-handled': 'false',
      'data-main-flow-dispatch-has-result': 'false',
      'data-main-flow-dispatch-kind': '',
      'data-main-flow-dispatch-source': '',
      'data-main-flow-dispatch-handler-key': '',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-loop-step': 'action-edit',
      'data-main-flow-loop-status': 'ready',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'open-runtime-results',
      'data-main-flow-loop-next-target-kind': 'runtime-results',
      'data-main-flow-loop-current-region': 'action-edit',
      'data-main-flow-loop-next-region': 'runtime-review',
      'data-runtime-review-selection-status': 'empty',
      'data-runtime-review-selected-action-id': '',
      'data-runtime-review-selected-state-point-id': '',
      'data-runtime-review-pending-state-point-id': '',
      'data-runtime-review-source': '',
      'data-runtime-review-source-kind': 'none',
      'data-runtime-review-last-action-kind': '',
      'data-runtime-review-last-action-source': '',
    });
    expect(flowPanel.attributes()).toMatchObject({
      'data-main-flow-dispatch-sequence': '0',
      'data-main-flow-dispatch-status': 'idle',
      'data-main-flow-dispatch-handled': 'false',
      'data-main-flow-dispatch-kind': '',
      'data-main-flow-loop-step': 'action-edit',
      'data-main-flow-loop-status': 'ready',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'open-runtime-results',
      'data-main-flow-loop-next-target-kind': 'runtime-results',
    });
    const primaryFlow = wrapper.find('[data-testid="workbench-primary-flow"]');
    expect(primaryFlow.exists()).toBe(true);
    expect(primaryFlow.attributes('data-flow-phase')).toBe('action-edit');
    expect(primaryFlow.attributes('data-main-flow-current-region')).toBe(
      'action-edit'
    );
    expect(primaryFlow.attributes('data-main-flow-next-target-kind')).toBe(
      'runtime-results'
    );
    expect(primaryFlow.attributes('data-main-flow-next-region')).toBe(
      'runtime-review'
    );
    expect(primaryFlow.find('.timeline-area').exists()).toBe(true);
    expect(
      primaryFlow
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes()
    ).toMatchObject({
      'data-flow-selected-action-id': 'action-0001',
      'data-flow-selected-state-curve-point-id': '',
    });
    const runtimeReviewStack = wrapper.find(
      '[data-testid="workbench-runtime-review-stack"]'
    );
    expect(runtimeReviewStack.exists()).toBe(true);
    expect(runtimeReviewStack.attributes('data-main-flow-current-region')).toBe(
      'action-edit'
    );
    expect(
      runtimeReviewStack.attributes(
        'data-main-flow-selected-runtime-state-point-id'
      )
    ).toBe('');
    expect(runtimeReviewStack.attributes()).toMatchObject({
      'data-runtime-review-layout': 'overview',
      'data-runtime-review-selection-status': 'empty',
      'data-runtime-review-selected-action-id': '',
      'data-runtime-review-selected-state-point-id': '',
      'data-runtime-review-source': '',
      'data-runtime-review-source-kind': 'none',
    });
    expect(
      runtimeReviewStack.findComponent(ResourceMonitorPanel).exists()
    ).toBe(true);
    expect(runtimeReviewStack.findComponent(EventLogPanel).exists()).toBe(
      false
    );
    const runtimeOutputs =
      runtimeReviewStack
        .findComponent(ResourceMonitorPanel)
        .props('runtimeProjection') ?? null;
    expect(runtimeOutputs).toMatchObject({
      sourceKind: 'azpr-three-value-runtime-outputs',
      outputNames: [
        'simLog',
        'hitTransactions',
        'effectTimeline',
        'stateCurves',
        'resourceCurves',
        'summary',
      ],
      outputAliases: {
        resources: 'resourceCurves',
      },
    });
    expect(
      wrapper.findComponent(AnalysisPanel).props('runtimeProjection')
    ).toBe(runtimeOutputs);
    expect(
      wrapper.findComponent(WorkbenchFlowPanel).props('runtimeProjection')
        .runtimeOutputs
    ).toBe(runtimeOutputs);
    expect(
      wrapper.findComponent(WorkbenchFlowPanel).props('runtimeOutputs')
    ).toBe(runtimeOutputs);
    expect(
      wrapper.findComponent(WorkbenchFlowPanel).props('flowModel')
        .runtimeOutputs
    ).toBe(runtimeOutputs);
    expect(
      wrapper
        .find('[data-testid="workbench-resource-area"]')
        .attributes('data-runtime-review-role')
    ).toBe('overview');
    const overviewPrimaryOperation = runtimeReviewStack.find(
      '[data-testid="workbench-runtime-review-primary-operation"]'
    );
    expect(overviewPrimaryOperation.exists()).toBe(true);
    expect(overviewPrimaryOperation.attributes()).toMatchObject({
      'data-action-id': 'action-0001',
      'data-operation-kind': 'open-runtime-results',
      'data-state-point-id': '',
    });
    expect(overviewPrimaryOperation.attributes('disabled')).toBeUndefined();
    expect(overviewPrimaryOperation.text()).toBe('运行模拟');
    const sideInspector = wrapper.find(
      '[data-testid="workbench-side-inspector"]'
    );
    expect(sideInspector.exists()).toBe(true);
    expect(sideInspector.attributes('data-flow-phase')).toBe('action-edit');
    expect(sideInspector.attributes('data-main-flow-inspector-mode')).toBe(
      'action-properties'
    );
    expect(sideInspector.attributes('data-active-inspector-panel')).toBe(
      'analysis'
    );
    expect(sideInspector.findComponent(PropertiesPanel).exists()).toBe(false);
    expect(sideInspector.find('.analysis-panel').exists()).toBe(true);
    expect(flowPanel.attributes('data-runtime-sim-log-count')).toBe('1');
    expect(flowPanel.attributes('data-contract-name')).toBe(
      'Action -> Hit -> ThreeValueDelta'
    );
    expect(flowPanel.attributes('data-generation-entry-status')).toBe(
      'generation-outputs-ready'
    );
    expect(flowPanel.attributes('data-runtime-input-source')).toBe(
      'threeValueRuntimeInput.appliedDeltas'
    );
    expect(flowPanel.attributes('data-runtime-output-status')).toBe(
      'runtime-output-contract-ready'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('-1');
    expect(
      flowPanel.find('[data-testid="workbench-flow-selected-action"]').text()
    ).toBe('普通攻击');
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-count"]').text()
    ).toBe('1 日志');
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-detail"]').text()
    ).toBe('未选中');
    expect(
      flowPanel.find('[data-testid="workbench-flow-edit-result"]').text()
    ).toBe('无刷新结果');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-navigation-index"]')
        .text()
    ).toBe('-/1');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-previous"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-next"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-open-runtime"]')
        .attributes('disabled')
    ).toBeUndefined();
    expect(
      flowPanel.find('[data-testid="workbench-flow-open-runtime"]').text()
    ).toBe('运行模拟');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-open-runtime"]')
        .attributes('data-primary-action')
    ).toBe('true');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-edit-runtime-action"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-edit-runtime-action"]')
        .attributes('data-primary-action')
    ).toBe('false');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-return-edit-result"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-return-edit-result"]')
        .attributes('data-primary-action')
    ).toBe('false');
    expect(
      wrapper
        .findAll(
          '[data-testid="workbench-three-value-calculator-diagnostic-row"]'
        )
        .map(row => [
          row.attributes('data-calculator-scope'),
          row.find('span').text(),
          row.find('strong').text(),
          row.find('small').text(),
        ])
    ).toEqual([
      [
        'generation',
        '生成适配器',
        '3类/16条 · 可替换 16',
        '适配器 HP适配器 6 / 能量适配器 5 / 削韧适配器 5 · 来源 HP候选 5 / 能量候选 5 / 削韧候选 5 / +1 · 状态 候选未确认 15 / 公式未确认 1 · 缺口 最终公式 16 / 防御抗性顺序 6 / 命中绑定 6 / +4',
      ],
      [
        'runtime',
        '运行适配器',
        '1类/1条 · 可替换 1',
        '适配器 HP适配器 1 · 来源 HP预览 1 · 状态 公式未确认 1 · 缺口 最终公式 1 / 防御抗性顺序 1 / 命中绑定 1',
      ],
    ]);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-monitor"]')
        .exists()
    ).toBe(true);
    const resourceArea = wrapper.find(
      '[data-testid="workbench-resource-area"]'
    );
    expect(resourceArea.exists()).toBe(true);
    expect(
      resourceArea
        .find('[data-testid="workbench-runtime-resource-monitor"]')
        .exists()
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="workbench-runtime-enemy-hp-delta"]').text()
    ).toBe('12,461');
    expect(
      wrapper.find('[data-testid="workbench-runtime-enemy-hp-state"]').text()
    ).toBe('剩余 0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-enemy-toughness-delta"]')
        .text()
    ).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-enemy-toughness-state"]')
        .text()
    ).toBe('剩余 6,667 / 6,667');
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-count"]').text()
    ).toBe('1 日志');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      runtimeReviewStack.findComponent(EventLogPanel).props('runtimeProjection')
    ).toBe(runtimeOutputs);
    expect(wrapper.text()).toContain('DAMAGE_PROJECTED');
    expect(
      wrapper.find('.event-area').attributes('data-runtime-review-role')
    ).toBe('overview');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/1');
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-track-filter"]')
        .map(button => [
          button.attributes('data-track-filter'),
          button.text(),
          button.attributes('data-active'),
        ])
    ).toEqual([
      ['all', '全部1', 'true'],
      ['enemyHpDamage', 'HP1', 'false'],
      ['enemyToughnessDamage', '韧性0', 'false'],
      ['selfEnergyChange', '能量0', 'false'],
    ]);
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-energy-actor-row"]')
        .map(row => row.text())
    ).toEqual(expect.arrayContaining([expect.stringContaining('末音')]));
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-energy-actor-state"]')
        .map(row => row.text())
    ).toEqual(expect.arrayContaining([expect.stringContaining('当前待确认')]));
    expect(
      wrapper.find('[data-testid="workbench-runtime-resource-chart"]').exists()
    ).toBe(true);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-resource-chart-mode"]')
        .map(button => [
          button.attributes('data-mode'),
          button.attributes('data-active'),
          button.text(),
        ])
    ).toEqual([
      ['delta', 'true', '累计变化'],
      ['state', 'false', '状态值'],
    ]);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-resource-chart-series"]')
        .map(row => [
          row.attributes('data-series-key'),
          row.attributes('data-track-key'),
          row.attributes('data-point-count'),
        ])
    ).toEqual(
      expect.arrayContaining([
        ['enemy-hp', 'enemyHpDamage', '1'],
        ['enemy-toughness', 'enemyToughnessDamage', '0'],
        expect.arrayContaining([
          expect.stringContaining('self-energy-'),
          'selfEnergyChange',
          expect.any(String),
        ]),
      ])
    );
    let runtimeCurvePoints = wrapper.findAll(
      '[data-testid="workbench-runtime-resource-chart-point"]'
    );
    expect(runtimeCurvePoints).toHaveLength(1);
    expect(runtimeCurvePoints[0].attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(runtimeCurvePoints[0].attributes('data-value')).toBe('12461');
    expect(runtimeCurvePoints[0].attributes('data-curve-mode')).toBe('delta');
    expect(runtimeCurvePoints[0].attributes('data-state-value')).toBe('0');
    expect(runtimeCurvePoints[0].attributes('data-overrun')).toBe('3833');

    await wrapper
      .find(
        '[data-testid="workbench-runtime-resource-chart-mode"][data-mode="state"]'
      )
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-resource-chart-mode"][data-mode="state"]'
        )
        .attributes('data-active')
    ).toBe('true');
    const stateModeHpPoint = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-point"][data-track-key="enemyHpDamage"]'
    );
    expect(stateModeHpPoint.attributes('data-curve-mode')).toBe('state');
    expect(stateModeHpPoint.attributes('data-value')).toBe('0');
    expect(stateModeHpPoint.attributes('data-cumulative')).toBe('12461');
    expect(stateModeHpPoint.attributes('data-state-value')).toBe('0');
    expect(stateModeHpPoint.attributes('data-overrun')).toBe('3833');
    const stateModeSeriesRows = wrapper.findAll(
      '[data-testid="workbench-runtime-resource-chart-series"]'
    );
    expect(
      stateModeSeriesRows
        .find(row => row.attributes('data-series-key') === 'enemy-hp')
        ?.text()
    ).toContain('剩余 0 / 溢出 3,833');
    expect(
      stateModeSeriesRows
        .filter(row => row.attributes('data-track-key') === 'selfEnergyChange')
        .map(row => row.text())
    ).toEqual(expect.arrayContaining([expect.stringContaining('当前待确认')]));

    await wrapper
      .find(
        '[data-testid="workbench-runtime-resource-chart-mode"][data-mode="delta"]'
      )
      .trigger('click');
    await nextTick();
    runtimeCurvePoints = wrapper.findAll(
      '[data-testid="workbench-runtime-resource-chart-point"]'
    );
    expect(runtimeCurvePoints[0].attributes('data-value')).toBe('12461');
    const runtimeCurveStatePointId = runtimeCurvePoints[0].attributes(
      'data-state-point-id'
    );
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log"]').exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-runtime-sim-log-row"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-row"]').text()
    ).toContain('普通攻击 · HP -8,628 · 韧性 0 · SP 0');
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-detail"]').text()
    ).toContain('action-0001|applied-frame-0-point-0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-log-fallback');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-layout')
    ).toBe('full');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-placement')
    ).toBe('inline');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail-handoff"]')
        .exists()
    ).toBe(false);
    expect(runtimeCurveStatePointId).toBe(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-state-point"]')
        .text()
    );
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-contribution-row"]')
        .map(row => row.text())
    ).toEqual(['敌人 HP12,461', '敌人韧性0', '自身能量0']);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-source-row"]')
        .map(row => row.text())
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Skill10900101'),
        expect.stringContaining('Element109001081'),
      ])
    );
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-calculator-row"]')
        .map(row => [row.attributes('data-calculator-key'), row.text()])
    ).toEqual([
      ['calculator', '适配器HP适配器'],
      ['kind', '来源HP预览'],
      ['replaceable', '替换可替换'],
      ['status', '公式公式未确认'],
      ['unresolved', '缺口最终公式、防御抗性顺序、命中绑定'],
    ]);
    expect(text).toContain(
      'HP 2 个候选 (109001081, 109001306) / 削韧 2 个候选 (109001081, 109001306) / 充能 2 个候选 (109001081, 109001306)'
    );
    expect(text).toContain(
      '公式候选 A 覆盖候选 1,600-3,360 / G 常量匹配 10,000'
    );
    expect(text).toContain('公式函数候选 f1 G/10000 / f2 self.ATK[0]*A/10000');
    expect(text).toContain('候选预览 f2 等级值 307 vs raw 12,461，约 2.5%');
    expect(text).toContain('组合诊断 f2 需 ×40.6 才接近 raw / 每 hit ×8.1');
    expect(text).toContain('执行矩阵摘要 1 动作 · 2 行 · 2 element');
    expect(text).toContain('缩放 ×40.6 / 每 hit ×8.1 · hit绑定 2/2');
    expect(text).toContain('执行矩阵 2 element');
    expect(text).toContain('function未确认 · A覆盖候选 2');
    expect(text).toContain('缩放 ×40.6 / 每 hit ×8.1 · 差异 2/2');
    expect(text).toContain(
      '逐hit候选 5/5段 · 三值字段 12 · 帧 12f/6f/12f/7f/4f · 绝对帧 0s12f/0s22f/1s3f/2s3f/3s4f · 连段桥 4/4'
    );
    expect(text).toContain('候选曲线');
    expect(text).toContain('HP参数候选');
    expect(text).toContain('5点 · 2,500-13,000 · raw-param');
    expect(text).toContain('削韧候选');
    expect(text).toContain('5点 · 7,000 · raw-field');
    expect(text).toContain('能量候选');
    expect(text).toContain('5点 · 2,399-3,000 · raw-field');
    expect(text).toContain('候选时间曲线');
    expect(text).toContain('60fps · 120s0f');
    expect(text).toContain('0s12f-3s4f · 2,500-13,000 · raw-param');
    expect(text).toContain('0s12f-3s4f · 7,000 · raw-field');
    expect(text).toContain('0s12f-3s4f · 2,399-3,000 · raw-field');
    expect(text).toContain('状态曲线');
    expect(text).toContain('敌人HP伤害');
    expect(text).toContain('已用 1点 Δ12,461 Σ12,461');
    expect(text).toContain('候选 5点 Δ2,500-13,000 Σ28,700');
    expect(text).toContain('敌人韧性削减');
    expect(text).toContain('自身能量变化');
    expect(
      wrapper.find('[data-testid="workbench-candidate-value-series"]').exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-candidate-value-series-row"]')
    ).toHaveLength(3);
    expect(
      wrapper.find('[data-testid="workbench-candidate-value-chart"]').exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-candidate-value-chart-row"]')
    ).toHaveLength(3);
    expect(
      wrapper.find('[data-testid="workbench-state-curves"]').exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-state-curve-row"]')
    ).toHaveLength(3);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('16');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-view-summary"]').text()
    ).toBe('全部视角16/16点已用/候选 · 全部轨道 · 全部三值点');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('日志筛选1/1条全部 · 全部角色 · 全部动作');
    expect(
      wrapper
        .findAll('[data-testid="workbench-state-curve-layer-toggle"]')
        .map(toggle => toggle.attributes('data-layer-key'))
    ).toEqual(['applied', 'candidate', 'sampled', 'placeholder']);
    const stateCurveLayerToggles = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-state-curve-layer-toggle"]')
        .map(toggle => [toggle.attributes('data-layer-key'), toggle])
    );
    const getStateCurveLayerToggleText = key =>
      stateCurveLayerToggles[key].element.closest('label')?.textContent ?? '';
    expect(getStateCurveLayerToggleText('applied')).toContain('已用 1');
    expect(stateCurveLayerToggles.applied.attributes('data-point-count')).toBe(
      '1'
    );
    expect(getStateCurveLayerToggleText('candidate')).toContain('候选 15');
    expect(
      stateCurveLayerToggles.candidate.attributes('data-point-count')
    ).toBe('15');
    expect(getStateCurveLayerToggleText('sampled')).toContain('采样 0');
    expect(getStateCurveLayerToggleText('placeholder')).toContain('占位 0');
    expect(
      wrapper
        .findAll('[data-testid="workbench-state-curve-layer-role"]')
        .map(role => role.text())
    ).toEqual(['进曲线/日志', '不进结果', '不进结果', '不进结果']);
    const stateCurveTrackToggles = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-state-curve-track-toggle"]')
        .map(toggle => [toggle.attributes('data-track-key'), toggle])
    );
    expect(Object.keys(stateCurveTrackToggles)).toEqual([
      'enemyHpDamage',
      'enemyToughnessDamage',
      'selfEnergyChange',
    ]);
    expect(
      stateCurveTrackToggles.enemyHpDamage.attributes('data-point-count')
    ).toBe('6');
    expect(
      stateCurveTrackToggles.enemyToughnessDamage.attributes('data-point-count')
    ).toBe('5');
    expect(
      stateCurveTrackToggles.selfEnergyChange.attributes('data-point-count')
    ).toBe('5');
    const hpStateCurveRow = wrapper.find(
      '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpStateCurveRow.text()).toContain('raw-damage · 2/2层 · 6点');
    expect(hpStateCurveRow.text()).toContain('已用 1点 Δ12,461 Σ12,461');
    expect(hpStateCurveRow.text()).toContain('候选 5点 Δ2,500-13,000 Σ28,700');
    const hpStateCurvePoints = hpStateCurveRow.findAll(
      '[data-testid="workbench-state-curve-point"]'
    );
    expect(hpStateCurvePoints).toHaveLength(6);
    expect(hpStateCurvePoints[0].attributes('data-layer-key')).toBe('applied');
    expect(hpStateCurvePoints[0].attributes('data-participation')).toBe(
      '已应用'
    );
    expect(hpStateCurvePoints[0].attributes('data-frame-label')).toBe('0s0f');
    expect(hpStateCurvePoints[0].text()).toContain('已用 Δ12,461 Σ12,461');
    expect(
      hpStateCurvePoints[0]
        .find('[data-testid="workbench-state-curve-point-participation"]')
        .text()
    ).toBe('参与当前三值曲线和模拟日志');
    expect(hpStateCurvePoints[0].text()).toContain('普通攻击');
    const firstCandidatePoint = hpStateCurvePoints.find(
      point =>
        point.attributes('data-layer-key') === 'candidate' &&
        point.attributes('data-frame-label') === '0s12f'
    );
    expect(firstCandidatePoint).toBeTruthy();
    expect(firstCandidatePoint.attributes('data-participation')).toBe(
      '候选诊断'
    );
    expect(firstCandidatePoint.text()).toContain('候选 Δ2,500 Σ2,500');
    expect(
      firstCandidatePoint
        .find('[data-testid="workbench-state-curve-point-participation"]')
        .text()
    ).toBe('候选诊断，不参与当前结果');
    expect(firstCandidatePoint.text()).toContain('hit1');
    expect(firstCandidatePoint.text()).toContain('109001306');
    expect(firstCandidatePoint.text()).toContain('109001081');
    const firstCandidateStatePointId = firstCandidatePoint.attributes(
      'data-state-point-id'
    );
    expect(firstCandidateStatePointId).toBeTruthy();
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(0);
    const appliedStatePointId = hpStateCurvePoints[0].attributes(
      'data-state-point-id'
    );
    expect(appliedStatePointId).toBeTruthy();
    const runtimeCurveNode = wrapper.find(
      `[data-testid="workbench-timeline-state-curve-node"][data-state-point-id="${appliedStatePointId}"]`
    );
    expect(runtimeCurveNode.exists()).toBe(true);
    let actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-has-runtime-trace')).toBe('true');
    expect(actionResultRow.attributes('data-runtime-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(actionResultRow.attributes('data-source-delta-ids')).toContain(
      'action-0001|applied-frame-0-point-0'
    );
    expect(actionResultRow.attributes()).toMatchObject({
      'data-flow-action-kind': 'select-runtime-result',
      'data-flow-action-source': 'analysis-action-result',
      'data-flow-action-state-point-id': appliedStatePointId,
    });
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-runtime-trace"]')
        .text()
    ).toContain(
      '定位 1条运行结果 · HP 12,461 · Delta action-0001|applied-frame-0-point-0'
    );
    await firstCandidatePoint.trigger('click');
    await nextTick();
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.findComponent(AnalysisPanel).props('selectedStateCurvePointId')
    ).toBe(firstCandidateStatePointId);
    expect(runtimeCurveNode.classes()).not.toContain('selected');
    await runtimeCurveNode.trigger('click');
    await nextTick();
    expect(
      getLastDispatchedFlowAction(wrapper, TimelineGridPreview)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'timeline-runtime-curve',
      statePointId: appliedStatePointId,
      payload: {
        statePointIds: [appliedStatePointId],
        preserveStateCurveFilters: true,
      },
    });
    expect(runtimeCurveNode.classes()).toContain('selected');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-state-curve-point"][data-state-point-id="${appliedStatePointId}"]`
        )
        .classes()
    ).toContain('selected');
    wrapper
      .findComponent(AnalysisPanel)
      .vm.$emit('select-state-curve-point', appliedStatePointId);
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-kind': 'select-runtime-state-point',
      'data-main-flow-dispatch-source': 'state-curve-point',
      'data-main-flow-dispatch-state-point-id': appliedStatePointId,
      'data-runtime-review-selected-state-point-id': appliedStatePointId,
      'data-runtime-review-source': 'state-curve-point',
    });
    await selectSideInspectorPanel(wrapper, 'analysis');
    const focusAllButton = wrapper.find(
      '[data-testid="workbench-state-curve-focus-all"]'
    );
    const focusSelectedButton = wrapper.find(
      '[data-testid="workbench-state-curve-focus-selected"]'
    );
    expect(focusAllButton.classes()).not.toContain('active');
    expect(focusSelectedButton.attributes('disabled')).toBeUndefined();
    expect(focusSelectedButton.classes()).toContain('active');
    expect(runtimeCurveNode.attributes('data-runtime-focus-source')).toBe(
      'state-curve-point'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    expect(
      wrapper.findAll('[data-testid="workbench-state-curve-point"]')
    ).toHaveLength(1);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(appliedStatePointId);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
        )
        .text()
    ).toContain('raw-damage · 1/1层 · 1点');
    expect(runtimeCurveNode.exists()).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('1/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-nav-prev"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-nav-next"]')
        .attributes('disabled')
    ).toBeUndefined();
    await wrapper
      .find('[data-testid="workbench-state-curve-nav-next"]')
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('2/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(firstCandidateStatePointId);
    expect(runtimeCurveNode.classes()).not.toContain('selected');
    const frameGroupOptions = wrapper.findAll(
      '[data-testid="workbench-state-curve-frame-group-option"]'
    );
    expect(frameGroupOptions).toHaveLength(3);
    expect(
      frameGroupOptions.map(option => option.attributes('data-track-key'))
    ).toEqual(['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange']);
    expect(frameGroupOptions[0].attributes('data-state-point-id')).toBe(
      firstCandidateStatePointId
    );
    const toughnessFrameGroupOption = frameGroupOptions.find(
      option => option.attributes('data-track-key') === 'enemyToughnessDamage'
    );
    expect(toughnessFrameGroupOption).toBeTruthy();
    await toughnessFrameGroupOption.trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('3/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-track-key')
    ).toBe('enemyToughnessDamage');
    expect(toughnessFrameGroupOption.text()).toContain('韧性');
    const hpFrameGroupOption = wrapper
      .findAll('[data-testid="workbench-state-curve-frame-group-option"]')
      .find(option => option.attributes('data-track-key') === 'enemyHpDamage');
    expect(hpFrameGroupOption).toBeTruthy();
    await hpFrameGroupOption.trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('2/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(firstCandidateStatePointId);
    await wrapper
      .find('[data-testid="workbench-state-curve-nav-prev"]')
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('1/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(appliedStatePointId);
    expect(runtimeCurveNode.classes()).toContain('selected');
    await focusAllButton.trigger('click');
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('16');
    expect(
      wrapper.findAll('[data-testid="workbench-state-curve-point"]')
    ).toHaveLength(16);
    expect(
      wrapper.find('[data-testid="workbench-state-curve-focus-all"]').classes()
    ).toContain('active');
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-track-toggle"]')
    ).toHaveLength(0);
    await stateCurveTrackToggles.enemyHpDamage.setValue(false);
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('10');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
        )
        .exists()
    ).toBe(false);
    expect(runtimeCurveNode.exists()).toBe(true);
    await stateCurveTrackToggles.enemyHpDamage.setValue(true);
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('16');
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-track-toggle"][data-track-key="enemyHpDamage"]'
      ).element.checked
    ).toBe(true);
    expect(runtimeCurveNode.exists()).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-layer-toggle"]')
    ).toHaveLength(0);
    await wrapper
      .find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      )
      .setValue(false);
    await nextTick();
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      ).element.checked
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('15');
    await wrapper
      .find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      )
      .setValue(true);
    await nextTick();
    expect(runtimeCurveNode.exists()).toBe(true);
    await wrapper
      .find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="candidate"]'
      )
      .setValue(false);
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
        )
        .text()
    ).toContain('raw-damage · 1/1层 · 1点');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
        )
        .findAll('[data-testid="workbench-state-curve-point"]')
    ).toHaveLength(1);
    await wrapper
      .find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="candidate"]'
      )
      .setValue(true);
    await nextTick();
    expect(
      wrapper.findAll('[data-testid="workbench-candidate-value-chart-row"]')
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(0);
    await wrapper
      .find(
        '[data-testid="workbench-three-value-calculator-diagnostic-row"][data-calculator-scope="generation"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-three-value-calculator-diagnostic-row"][data-calculator-scope="generation"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      ).element.checked
    ).toBe(false);
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="candidate"]'
      ).element.checked
    ).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('15');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-view-summary"]').text()
    ).toBe('生成视角15/16点候选/采样/占位 · 全部轨道 · 全部三值点');
    await selectRuntimeReviewTab(wrapper, 'event');
    await wrapper
      .find(
        '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="selfEnergyChange"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('0/1');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('日志筛选0/1条能量 · 全部角色 · 全部动作');
    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    await actionResultRow.trigger('click');
    await nextTick();
    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-selected')).toBe('true');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-view-summary"]').text()
    ).toBe('运行视角1/16点已用 · 全部轨道 · 选中三值点');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('结果定位1/1条全部 · 全部角色 · 全部动作');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/1');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="all"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-row"]')
        .attributes('data-selected')
    ).toBe('true');
    await selectRuntimeReviewTab(wrapper, 'resource');
    const actionResultCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(actionResultCurveSelection.exists()).toBe(true);
    expect(actionResultCurveSelection.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(actionResultCurveSelection.attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(
      actionResultCurveSelection.attributes('data-runtime-focus-source')
    ).toBe('analysis-action-result');
    expect(actionResultCurveSelection.text()).toContain('动作结果定位');
    const actionResultDetailPanel = wrapper.find(
      '[data-testid="workbench-action-result-detail-panel"]'
    );
    expect(actionResultDetailPanel.exists()).toBe(true);
    expect(actionResultDetailPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(actionResultDetailPanel.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(actionResultDetailPanel.attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(actionResultDetailPanel.attributes('data-detail-mode')).toBe(
      'compact'
    );
    expect(actionResultDetailPanel.attributes('data-full-detail-source')).toBe(
      'workbench-runtime-selected-detail'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-action-result-detail-action"]')
        .text()
    ).toContain('普通攻击');
    const actionResultDetailRows = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-action-result-detail-row"]')
        .map(row => [row.attributes('data-detail-key'), row])
    );
    expect(Object.keys(actionResultDetailRows)).toEqual([
      'point',
      'delta',
      'cumulative',
      'state-status',
    ]);
    expect(actionResultDetailRows.point.text()).toContain('敌人HP伤害');
    expect(actionResultDetailRows.delta.text()).toBe('Delta12,461');
    expect(actionResultDetailRows.cumulative.text()).toBe('累计12,461');
    expect(actionResultDetailRows['state-status'].text()).toBe(
      '剩余 / 状态0 · raw-hp-projection'
    );
    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.exists()).toBe(true);
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(actionContributionPanel.attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': appliedStatePointId,
    });
    expect(wrapper.find('.analysis-panel').attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': appliedStatePointId,
    });
    expect(actionContributionPanel.text()).toContain('动作贡献拆分');
    expect(actionContributionPanel.text()).toContain('普通攻击');
    const actionContributionRows = wrapper.findAll(
      '[data-testid="workbench-action-contribution-row"]'
    );
    expect(actionContributionRows[0].attributes()).toMatchObject({
      'data-flow-action-kind': 'select-contribution-point',
      'data-flow-action-source': 'analysis-action-contribution',
      'data-flow-action-state-point-id': appliedStatePointId,
    });
    expect(
      actionContributionRows.map(row => [
        row.attributes('data-track-key'),
        row.attributes('data-active'),
        row.attributes('data-count'),
        row.attributes('data-delta'),
        row.text(),
      ])
    ).toEqual([
      [
        'enemyHpDamage',
        'true',
        '1',
        '12461',
        expect.stringContaining(
          '敌人 HP12,461详情已同步 · 已应用 1条 · action-0001|applied-frame-0-point-0'
        ),
      ],
      [
        'enemyToughnessDamage',
        'false',
        '0',
        '0',
        expect.stringContaining('敌人韧性0暂无已应用结果'),
      ],
      [
        'selfEnergyChange',
        'false',
        '0',
        '0',
        expect.stringContaining('自身能量0暂无已应用结果'),
      ],
    ]);
    const actionContributionDetail = wrapper.find(
      '[data-testid="workbench-action-contribution-detail"]'
    );
    expect(actionContributionDetail.exists()).toBe(true);
    expect(actionContributionDetail.attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(actionContributionDetail.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    const actionContributionDetailRows = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-action-contribution-detail-row"]')
        .map(row => [row.attributes('data-detail-key'), row])
    );
    expect(actionContributionDetailRows.statePoint.text()).toContain(
      appliedStatePointId
    );
    expect(actionContributionDetailRows.sourceDelta.text()).toContain(
      'action-0001|applied-frame-0-point-0'
    );
    expect(actionContributionDetailRows.sourceIds.text()).toContain(
      'Skill 10900101'
    );
    expect(actionContributionDetailRows.sourceIds.text()).toContain(
      'Element 109001081'
    );
    expect(actionContributionDetailRows.calculator.text()).toBe(
      '适配器HP适配器'
    );
    expect(actionContributionDetailRows.kind.text()).toBe('来源类型HP预览');
    expect(actionContributionDetailRows.status.text()).toBe(
      '公式状态公式未确认'
    );
    expect(actionContributionDetailRows.unresolved.text()).toContain(
      '最终公式、防御抗性顺序、命中绑定'
    );
    await actionContributionRows[0].trigger('click');
    await nextTick();
    await selectRuntimeReviewTab(wrapper, 'event');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('贡献定位1/1条全部 · 全部角色 · 全部动作');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(appliedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-state-point"]')
        .text()
    ).toBe(appliedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    await selectSideInspectorPanel(wrapper, 'analysis');
    await selectRuntimeReviewTab(wrapper, 'resource');
    const contributionFocusedCurvePoint = wrapper.find(
      `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${appliedStatePointId}"]`
    );
    expect(contributionFocusedCurvePoint.exists()).toBe(true);
    expect(contributionFocusedCurvePoint.attributes('data-selected')).toBe(
      'true'
    );
    expect(
      contributionFocusedCurvePoint.attributes('data-runtime-focus-source')
    ).toBe('action-contribution');
    const contributionFocusedTimelineMarker = wrapper.find(
      `[data-testid="workbench-timeline-state-curve-node"][data-state-point-id="${appliedStatePointId}"]`
    );
    expect(contributionFocusedTimelineMarker.exists()).toBe(true);
    expect(contributionFocusedTimelineMarker.classes()).toContain('selected');
    expect(
      contributionFocusedTimelineMarker.attributes('data-runtime-focus-source')
    ).toBe('action-contribution');
    await wrapper
      .find(
        '[data-testid="workbench-three-value-calculator-diagnostic-row"][data-calculator-scope="runtime"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-three-value-calculator-diagnostic-row"][data-calculator-scope="runtime"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      ).element.checked
    ).toBe(true);
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="candidate"]'
      ).element.checked
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/1');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-view-summary"]').text()
    ).toBe('运行视角1/16点已用 · 全部轨道 · 选中三值点');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('运行视角1/1条全部 · 全部角色 · 全部动作');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="all"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-runtime-event-marker"]')
        .exists()
    ).toBe(false);
    expect(text).toContain(
      '候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f · 状态证据 Skill0_1 动画+命中 / Skill0_6 动画+命中 · 普攻链 10900102->Skill0_2 / 10900103->Skill0_3 / +2 · 命中候选 5/5段 · 三值候选 5/5段 · 目标缺失 80102'
    );
    expect(text).toContain('伤害 12,461 · 韧性 0 · 能量 0');
    expect(text).toContain('low');
  }, 30_000);

  it('unmounts heavy inspector and review panels when they are inactive', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    expect(wrapper.findComponent(ResourceMonitorPanel).exists()).toBe(true);
    expect(wrapper.findComponent(EventLogPanel).exists()).toBe(false);
    expect(wrapper.findComponent(AnalysisPanel).exists()).toBe(false);

    await wrapper
      .get(
        '[data-testid="workbench-runtime-review-tab"][data-review-tab="event"]'
      )
      .trigger('click');
    expect(wrapper.findComponent(ResourceMonitorPanel).exists()).toBe(false);
    expect(wrapper.findComponent(EventLogPanel).exists()).toBe(true);

    await wrapper
      .get('[data-testid="workbench-timeline-action"]')
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-side-inspector"]').exists()
    ).toBe(true);
    expect(wrapper.findComponent(PropertiesPanel).exists()).toBe(true);
    expect(wrapper.findComponent(AnalysisPanel).exists()).toBe(false);

    await wrapper
      .get('[data-testid="workbench-close-side-inspector"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="workbench-side-inspector"]').exists()
    ).toBe(false);
    expect(wrapper.findComponent(AnalysisPanel).exists()).toBe(false);

    wrapper.unmount();
  });

  it('does not compile or simulate while navigating runtime review surfaces', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await vi.waitFor(() => {
      expect(
        Number(
          wrapper
            .get('main.workbench')
            .attributes('data-runtime-diagnostics-revision')
        )
      ).toBeGreaterThan(0);
    });
    await nextTick();
    resetWorkbenchPerformanceCounters();
    const expectNoAuthoritativeRecompute = () =>
      expect(getWorkbenchPerformanceCounters()).toMatchObject({
        authoritativeCompile: 0,
        authoritativeSimulation: 0,
      });

    const timeline = wrapper.findComponent(TimelineGridPreview);
    for (let frameIndex = 1; frameIndex <= 300; frameIndex += 1) {
      timeline.vm.$emit('select-timeline-frame', {
        frameIndex,
        source: 'timeline-playback',
      });
    }
    await nextTick();
    expectNoAuthoritativeRecompute();
    await selectRuntimeReviewTab(wrapper, 'event');
    expectNoAuthoritativeRecompute();
    await wrapper
      .get(
        '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="all"]'
      )
      .trigger('click');
    expectNoAuthoritativeRecompute();
    await selectSideInspectorPanel(wrapper, 'analysis');
    expectNoAuthoritativeRecompute();
    await selectRuntimeReviewTab(wrapper, 'resource');
    expectNoAuthoritativeRecompute();
    wrapper
      .get('[data-testid="workbench-timeline-viewport"]')
      .element.dispatchEvent(new Event('scroll', { bubbles: true }));
    await nextTick();

    expectNoAuthoritativeRecompute();
    wrapper.unmount();
  });

  it('coalesces repeated library pointer previews and simulates once on commit', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await vi.waitFor(() => {
      expect(
        Number(
          wrapper
            .get('main.workbench')
            .attributes('data-runtime-diagnostics-revision')
        )
      ).toBeGreaterThan(0);
    });

    const actorLane = wrapper.get(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-109001"]'
    ).element;
    actorLane.getBoundingClientRect = () => ({
      width: 7200,
      height: 96,
      left: 0,
      right: 7200,
      top: 0,
      bottom: 96,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn(() => actorLane);
    const animationFrames = [];
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = vi.fn(callback => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    window.cancelAnimationFrame = vi.fn();

    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 100,
      clientY: 24,
    });
    Object.defineProperty(pointerDown, 'pointerId', { value: 77 });
    wrapper
      .get('[data-testid="workbench-add-switch-action"]')
      .element.dispatchEvent(pointerDown);

    resetWorkbenchPerformanceCounters();
    for (let index = 0; index < 60; index += 1) {
      const pointerMove = new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 160 + (index % 2) * 0.1,
        clientY: 24,
      });
      Object.defineProperty(pointerMove, 'pointerId', { value: 77 });
      window.dispatchEvent(pointerMove);
    }
    expect(animationFrames).toHaveLength(1);
    expect(getWorkbenchPerformanceCounters().placementPreviewEvaluation).toBe(
      0
    );
    animationFrames.shift()(0);
    await flushPromises();
    await nextTick();
    expect(getWorkbenchPerformanceCounters().placementPreviewEvaluation).toBe(
      1
    );

    for (let index = 0; index < 10; index += 1) {
      const duplicateMove = new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 160,
        clientY: 24,
      });
      Object.defineProperty(duplicateMove, 'pointerId', { value: 77 });
      window.dispatchEvent(duplicateMove);
    }
    expect(animationFrames).toHaveLength(0);
    expect(getWorkbenchPerformanceCounters().placementPreviewEvaluation).toBe(
      1
    );

    resetWorkbenchPerformanceCounters();
    const pointerUp = new MouseEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      clientX: 160,
      clientY: 24,
    });
    Object.defineProperty(pointerUp, 'pointerId', { value: 77 });
    window.dispatchEvent(pointerUp);
    await flushPromises();
    await nextTick();
    await vi.waitFor(() => {
      expect(getWorkbenchPerformanceCounters()).toMatchObject({
        authoritativeCompile: 1,
        authoritativeSimulation: 1,
      });
    });

    document.elementFromPoint = originalElementFromPoint;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    wrapper.unmount();
  });

  it('configures and reviews a tracking-only effect from the Workbench', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await selectRuntimeReviewTab(wrapper, 'effect');

    expect(
      wrapper.find('[data-testid="workbench-effect-timeline-empty"]').exists()
    ).toBe(true);
    await wrapper.find('[data-testid="workbench-effect-add"]').trigger('click');
    await nextTick();

    expect(
      wrapper.findAll('[data-testid="workbench-effect-command-row"]')
    ).toHaveLength(1);
    expect(
      wrapper.findAll('[data-testid="workbench-effect-event-row"]')
    ).toHaveLength(2);
    expect(
      wrapper
        .find('[data-testid="workbench-effect-timeline-panel"]')
        .attributes('data-effect-event-count')
    ).toBe('2');
    expect(
      wrapper.find('main.workbench').attributes('data-effect-interval-count')
    ).toBe('1');
    const timelineEffectInterval = wrapper.get(
      '[data-testid="workbench-timeline-effect-interval"]'
    );
    expect(timelineEffectInterval.attributes()).toMatchObject({
      'data-target-kind': 'actor',
      'data-source-action-id': 'action-0001',
      'data-lifecycle-event-count': '2',
    });
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.get(
        '[data-testid="workbench-action-relation"][data-relation-kind="effect-trigger"]'
      )
    ).toBeTruthy();
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .get(
          '[data-testid="workbench-event-log-row"][data-effect-relation-kind="effect-trigger"]'
        )
        .text()
    ).toContain('触发');

    await selectRuntimeReviewTab(wrapper, 'effect');
    const effectRelation = wrapper.get(
      '[data-testid="workbench-effect-relation-row"]'
    );
    expect(effectRelation.attributes()).toMatchObject({
      'data-relation-kind': 'effect-trigger',
      'data-relation-status': 'satisfied',
    });
    await effectRelation.trigger('click');
    await nextTick();
    const selectedEffectRelationId =
      effectRelation.attributes('data-relation-id');
    expect(effectRelation.attributes('data-selected')).toBe('true');
    expect(wrapper.find('main.workbench').attributes()).toMatchObject({
      'data-energy-curve-count': '6',
    });
    await wrapper
      .find('[data-testid="workbench-start-frame-input"]')
      .setValue('30');
    await nextTick();
    expect(
      wrapper
        .get(
          `[data-testid="workbench-effect-relation-row"][data-relation-id="${selectedEffectRelationId}"]`
        )
        .text()
    ).toContain('30F');
    expect(
      wrapper
        .get('[data-testid="workbench-timeline-grid-preview"]')
        .attributes('data-cursor-frame-index')
    ).toBe('30');

    await wrapper
      .find('[data-testid="workbench-effect-name-input"]')
      .setValue('测试增益');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-effect-event-row"]').text()
    ).toContain('测试增益');

    await timelineEffectInterval.trigger('click');
    await nextTick();
    const selectedIntervalEndFrame = timelineEffectInterval.attributes(
      'data-end-frame-index'
    );
    expect(
      wrapper
        .find('main.workbench')
        .attributes('data-selected-effect-interval-id')
    ).toContain('interval-1');
    expect(
      wrapper.find('[data-testid="workbench-effect-selected-interval"]').text()
    ).toContain('测试增益');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes('data-cursor-frame-index')
    ).toBe(selectedIntervalEndFrame);
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes('data-flow-selected-action-id')
    ).toBe('action-0001');
    expect(
      wrapper.findAll(
        '[data-testid="workbench-effect-interval-lifecycle-event"]'
      )
    ).toHaveLength(2);
    await wrapper
      .findAll('[data-testid="workbench-effect-interval-lifecycle-event"]')[0]
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes('data-cursor-frame-index')
    ).toBe(timelineEffectInterval.attributes('data-start-frame-index'));
    expect(
      wrapper.findAll('[data-testid="workbench-effect-active-row"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="workbench-effect-active-row"]').text()
    ).toContain('测试增益');
    expect(
      wrapper
        .find('[data-testid="workbench-effect-timeline-panel"]')
        .attributes('data-active-effect-count')
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-effect-edit-source-action"]')
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find('main.workbench')
        .attributes('data-selected-effect-interval-id')
    ).toBe('');
    await wrapper
      .find('[data-testid="workbench-effect-duration-frame-input"]')
      .setValue('180');
    await nextTick();
    const refreshedInterval = wrapper.get(
      '[data-testid="workbench-timeline-effect-interval"]'
    );
    expect(Number(refreshedInterval.attributes('data-end-ms'))).toBeCloseTo(
      frameToMs(210),
      4
    );
    await refreshedInterval.trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-effect-selected-interval"]').text()
    ).toContain('30F-210F');
  });

  it('locates and fixes a confirmed skill cooldown rule violation', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    const addCooldownSkill = async () => {
      await addSkillActionFromLibrary(wrapper, 'star-skill');
    };
    await addCooldownSkill();
    await addCooldownSkill();
    await addCooldownSkill();

    const blockedActionItem = wrapper.find(
      '.action-item[data-action-id="action-0004"]'
    );
    const blockedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
    );
    expect(blockedActionItem.attributes()).toMatchObject({
      'data-readiness-status': 'blocked',
      'data-readiness-executable': 'false',
    });
    expect(blockedTimelineAction.attributes()).toMatchObject({
      'data-readiness-status': 'blocked',
      'data-readiness-executable': 'false',
    });
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-cooldown-window"]')
    ).toHaveLength(2);
    expect(
      wrapper.find('[data-testid="scenario-action-count"]').attributes()
    ).toMatchObject({
      'data-executed-action-count': '3',
      'data-skipped-action-count': '1',
    });
    expect(
      wrapper.find('[data-testid="scenario-action-count"]').text()
    ).toContain('3/4 action');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.findAll('[data-testid="workbench-action-result-source-row"]')
    ).toHaveLength(3);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-result-source-row"][data-action-id="action-0004"]'
        )
        .exists()
    ).toBe(false);

    await selectSideInspectorPanel(wrapper, 'action-rules');
    const rulePanel = wrapper.find(
      '[data-testid="workbench-action-rule-panel"]'
    );
    const cooldownRule = wrapper.find(
      '[data-testid="workbench-action-rule-row"][data-rule-code="skill-cooldown-active"]'
    );
    expect(rulePanel.attributes('data-violation-count')).toBe('1');
    expect(cooldownRule.attributes('data-action-id')).toBe('action-0004');
    expect(cooldownRule.text()).toContain('技能冷却');

    const suggestedStartMs = cooldownRule
      .find('[data-testid="workbench-action-rule-apply-start"]')
      .attributes('data-suggested-start-ms');
    await cooldownRule
      .find('[data-testid="workbench-action-rule-apply-start"]')
      .trigger('click');
    await selectSideInspectorPanel(wrapper, 'action-rules');
    expect(
      wrapper
        .get('[data-testid="workbench-action-rule-panel"]')
        .attributes('data-violation-count')
    ).toBe('0');
    await selectSideInspectorPanel(wrapper, 'properties');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe(suggestedStartMs);
    expect(
      wrapper.find('[data-testid="workbench-start-frame-input"]').element.value
    ).toBe(String(Math.round((Number(suggestedStartMs) * 60) / 1000)));
    expect(blockedActionItem.attributes()).toMatchObject({
      'data-readiness-status': 'ready',
      'data-readiness-executable': 'true',
    });
    expect(blockedTimelineAction.attributes()).toMatchObject({
      'data-readiness-status': 'ready',
      'data-readiness-executable': 'true',
    });
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-cooldown-window"]')
    ).toHaveLength(3);
    expect(
      wrapper.find('[data-testid="scenario-action-count"]').attributes()
    ).toMatchObject({
      'data-executed-action-count': '4',
      'data-skipped-action-count': '0',
    });
    expect(
      wrapper.find('[data-testid="scenario-action-count"]').text()
    ).toContain('4 action');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.findAll('[data-testid="workbench-action-result-source-row"]')
    ).toHaveLength(4);
  });

  it('commits a cooldown suggestion atomically in constraint-assisted mode', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await wrapper
      .find(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .trigger('click');

    const addCooldownSkill = async () => {
      await addSkillActionFromLibrary(wrapper, 'star-skill');
    };
    await addCooldownSkill();
    await addCooldownSkill();
    const historyCountBeforeSuggestion = Number(
      wrapper
        .find('[data-testid="workbench-undo-edit"]')
        .attributes('data-history-count')
    );
    await addCooldownSkill();

    const assistedAction = wrapper.get(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
    );
    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-action-placement-mode': 'assisted',
      'data-action-placement-status': 'adjustable',
    });
    expect(assistedAction.attributes()).toMatchObject({
      'data-readiness-status': 'ready',
      'data-readiness-executable': 'true',
    });
    expect(
      Number(
        wrapper
          .find('[data-testid="workbench-undo-edit"]')
          .attributes('data-history-count')
      )
    ).toBe(historyCountBeforeSuggestion + 1);

    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
        )
        .exists()
    ).toBe(false);
  });

  it('rejects an assisted move beyond the axis without creating history', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await wrapper
      .find(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .trigger('click');
    const timeline = wrapper.getComponent(TimelineGridPreview);
    const action = () =>
      wrapper.get(
        '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
      );
    const initialStartMs = action().attributes('data-start-ms');

    timeline.vm.$emit('update-action-time', {
      actionId: 'action-0001',
      startMs: Number(timeline.props('durationMs')),
    });
    await nextTick();

    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-action-placement-status': 'blocked',
    });
    expect(action().attributes('data-start-ms')).toBe(initialStartMs);
    expect(
      wrapper
        .find('[data-testid="workbench-undo-edit"]')
        .attributes('data-history-count')
    ).toBe('0');
  });

  it('shows the unified requested and suggested preview without mutating actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await addSingleSkillActionFromLibrary(wrapper);
    await wrapper
      .find(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .trigger('click');
    await nextTick();
    const secondAction = () =>
      wrapper.get(
        '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
      );
    const originalStartMs = Number(secondAction().attributes('data-start-ms'));
    const timeline = wrapper.getComponent(TimelineGridPreview);

    timeline.vm.$emit('preview-action-placement', {
      kind: 'move',
      actionIds: ['action-0002'],
      primaryActionId: 'action-0002',
      offsetMs: -originalStartMs,
      targetLaneId: null,
    });
    await nextTick();

    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-action-placement-preview-active': 'true',
      'data-action-placement-status': 'adjustable',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-action-placement-request-guide"]')
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-action-placement-suggested-guide"]')
        .exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-action-placement-ghost"]')
    ).toHaveLength(1);
    expect(Number(secondAction().attributes('data-start-ms'))).toBe(
      originalStartMs
    );

    timeline.vm.$emit('clear-action-placement-preview');
    await nextTick();
    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-action-placement-preview-active': 'false',
    });
    expect(
      wrapper.find('[data-testid="workbench-action-placement-ghost"]').exists()
    ).toBe(false);
  });

  it('prioritizes runtime detail in the side inspector while reviewing results', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const sideInspector = wrapper.find(
      '[data-testid="workbench-side-inspector"]'
    );
    expect(sideInspector.attributes('data-main-flow-inspector-mode')).toBe(
      'action-properties'
    );
    expect(
      sideInspector
        .find('[data-inspector-panel-key="properties"]')
        .attributes('data-inspector-panel-order')
    ).toBe('0');
    expect(
      sideInspector.find('[data-inspector-panel-key="runtime-detail"]').exists()
    ).toBe(false);
    expect(
      sideInspector.find('[data-inspector-panel-key="action-rules"]').exists()
    ).toBe(false);
    await selectSideInspectorPanel(wrapper, 'action-rules');
    expect(
      sideInspector
        .find('[data-inspector-panel-key="action-rules"]')
        .attributes('data-inspector-panel-order')
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    expect(sideInspector.attributes('data-main-flow-inspector-mode')).toBe(
      'runtime-detail'
    );
    expect(
      sideInspector
        .find('[data-inspector-panel-key="runtime-detail"]')
        .attributes('data-inspector-panel-order')
    ).toBe('0');
    expect(
      sideInspector.find('[data-inspector-panel-key="properties"]').exists()
    ).toBe(false);
    expect(
      sideInspector.find('[data-inspector-panel-key="action-rules"]').exists()
    ).toBe(false);
  });

  it('undoes and redoes action edits from the workbench nav', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const undoButton = () =>
      wrapper.find('[data-testid="workbench-undo-edit"]');
    const redoButton = () =>
      wrapper.find('[data-testid="workbench-redo-edit"]');
    const levelInput = () =>
      wrapper.find('[data-testid="workbench-level-input"]');

    expect(levelInput().element.value).toBe('1');
    expect(undoButton().attributes('disabled')).toBeDefined();
    expect(redoButton().attributes('disabled')).toBeDefined();
    expect(undoButton().attributes('data-history-count')).toBe('0');
    expect(redoButton().attributes('data-history-count')).toBe('0');

    await levelInput().setValue('2');
    await nextTick();

    expect(levelInput().element.value).toBe('2');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
    expect(undoButton().attributes('disabled')).toBeUndefined();
    expect(redoButton().attributes('disabled')).toBeDefined();
    expect(undoButton().attributes('data-history-count')).toBe('1');

    await undoButton().trigger('click');
    await nextTick();

    expect(levelInput().element.value).toBe('1');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已撤销编辑'
    );
    expect(undoButton().attributes('disabled')).toBeDefined();
    expect(redoButton().attributes('disabled')).toBeUndefined();
    expect(redoButton().attributes('data-history-count')).toBe('1');

    await redoButton().trigger('click');
    await nextTick();

    expect(levelInput().element.value).toBe('2');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已重做编辑'
    );
    expect(undoButton().attributes('disabled')).toBeUndefined();
    expect(redoButton().attributes('disabled')).toBeDefined();
  });

  it('uses keyboard shortcuts for action copy and edit history', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const actionItems = () => wrapper.findAll('.action-item');
    const undoButton = () =>
      wrapper.find('[data-testid="workbench-undo-edit"]');
    const redoButton = () =>
      wrapper.find('[data-testid="workbench-redo-edit"]');
    const flowPanel = () =>
      wrapper.find('[data-testid="workbench-flow-panel"]');

    expect(actionItems()).toHaveLength(1);
    expect(flowPanel().attributes('data-action-id')).toBe('action-0001');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await nextTick();

    expect(actionItems()).toHaveLength(2);
    expect(flowPanel().attributes('data-action-id')).toBe('action-0002');
    expect(undoButton().attributes('disabled')).toBeUndefined();
    expect(redoButton().attributes('disabled')).toBeDefined();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await nextTick();

    expect(actionItems()).toHaveLength(1);
    expect(flowPanel().attributes('data-action-id')).toBe('action-0001');
    expect(undoButton().attributes('disabled')).toBeDefined();
    expect(redoButton().attributes('disabled')).toBeUndefined();

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await nextTick();

    expect(actionItems()).toHaveLength(2);
    expect(flowPanel().attributes('data-action-id')).toBe('action-0002');
    expect(undoButton().attributes('disabled')).toBeUndefined();
    expect(redoButton().attributes('disabled')).toBeDefined();

    wrapper.find('[data-testid="workbench-level-input"]').element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await nextTick();

    expect(actionItems()).toHaveLength(2);
  });

  it('edits an arbitrary action group through clipboard, history, move, and delete', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await addSingleSkillActionFromLibrary(wrapper);
    await addSingleSkillActionFromLibrary(wrapper);
    await nextTick();

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await wrapper
      .find('.action-item[data-action-id="action-0003"]')
      .trigger('click', { ctrlKey: true });
    await nextTick();

    expect(
      wrapper.find('main.workbench').attributes('data-selected-action-count')
    ).toBe('2');
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0001"]')
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0002"]')
        .attributes('data-selected')
    ).toBe('false');
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0003"]')
        .attributes('data-selected')
    ).toBe('true');

    await wrapper
      .find('[data-testid="workbench-timeline-create-relations"]')
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('1');
    expect(
      wrapper
        .find('[data-testid="workbench-action-relation"]')
        .attributes('data-relation-id')
    ).toBe('relation-0001');

    dispatchWorkbenchKeyboardShortcut('c', { ctrlKey: true });
    dispatchWorkbenchKeyboardShortcut('v', { ctrlKey: true });
    await nextTick();

    expect(wrapper.findAll('.action-item')).toHaveLength(5);
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('2');
    expect(
      wrapper.find('main.workbench').attributes('data-selected-action-count')
    ).toBe('2');
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0004"]')
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0005"]')
        .attributes('data-selected')
    ).toBe('true');

    dispatchWorkbenchKeyboardShortcut('z', { ctrlKey: true });
    await nextTick();
    expect(wrapper.findAll('.action-item')).toHaveLength(3);
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('1');
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0001"]')
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0003"]')
        .attributes('data-selected')
    ).toBe('true');

    dispatchWorkbenchKeyboardShortcut('y', { ctrlKey: true });
    await nextTick();
    expect(wrapper.findAll('.action-item')).toHaveLength(5);
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('2');

    const pastedStartMs = Number(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
        )
        .attributes('data-start-ms')
    );
    dispatchWorkbenchKeyboardShortcut('ArrowRight');
    await nextTick();
    expect(
      Number(
        wrapper
          .find(
            '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
          )
          .attributes('data-start-ms')
      )
    ).toBeCloseTo(pastedStartMs + frameToMs(1), 4);

    dispatchWorkbenchKeyboardShortcut('Delete');
    await nextTick();
    expect(wrapper.findAll('.action-item')).toHaveLength(3);
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('1');

    dispatchWorkbenchKeyboardShortcut('z', { ctrlKey: true });
    await nextTick();
    expect(wrapper.findAll('.action-item')).toHaveLength(5);
    expect(
      wrapper.find('main.workbench').attributes('data-selected-action-count')
    ).toBe('2');
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('2');

    await wrapper
      .find(
        '[data-testid="workbench-action-relation"][data-relation-id="relation-0002"]'
      )
      .trigger('click');
    dispatchWorkbenchKeyboardShortcut('Delete');
    await nextTick();
    expect(wrapper.findAll('.action-item')).toHaveLength(5);
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('1');
    dispatchWorkbenchKeyboardShortcut('z', { ctrlKey: true });
    await nextTick();
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('2');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts).toHaveLength(5);
    expect(savedDraft.schemaVersion).toBe(WORKBENCH_DRAFT_SCHEMA_VERSION);
    expect(savedDraft.actionRelations).toHaveLength(2);
    expect(savedDraft).not.toHaveProperty('selectedActionIds');
    expect(savedDraft).not.toHaveProperty('actionClipboard');

    await wrapper
      .find('[data-testid="workbench-reset-draft"]')
      .trigger('click');
    dispatchWorkbenchKeyboardShortcut('v', { ctrlKey: true });
    await nextTick();
    expect(wrapper.findAll('.action-item')).toHaveLength(1);

    wrapper.unmount();
  }, 10_000);

  it('drives the edit-runtime-return loop from the main flow panel', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const openRuntimeButton = wrapper.find(
      '[data-testid="workbench-flow-open-runtime"]'
    );
    expect(openRuntimeButton.attributes('disabled')).toBeUndefined();
    expect(openRuntimeButton.attributes('data-primary-action')).toBe('true');
    expect(openRuntimeButton.text()).toBe('运行模拟');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-primary-kind')
    ).toBe('open-runtime-results');

    const originalRuntimeLogScrollIntoView = Element.prototype.scrollIntoView;
    const runtimeLogScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = runtimeLogScrollIntoView;

    try {
      await openRuntimeButton.trigger('click');
      await nextTick();
      await nextTick();
      await Promise.resolve();
    } finally {
      if (originalRuntimeLogScrollIntoView) {
        Element.prototype.scrollIntoView = originalRuntimeLogScrollIntoView;
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      canRun: true,
    });
    const selectedRuntimePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(runtimeLogScrollIntoView).not.toHaveBeenCalled();
    const focusedFlowPanel = wrapper.find(
      '[data-testid="workbench-flow-panel"]'
    );
    expect(focusedFlowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(focusedFlowPanel.attributes('data-flow-phase')).toBe(
      'runtime-result'
    );
    expect(
      focusedFlowPanel.attributes('data-runtime-detail-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(focusedFlowPanel.attributes('data-flow-primary-kind')).toBe(
      'focus-runtime-action'
    );
    expect(focusedFlowPanel.attributes('data-flow-primary-action-id')).toBe(
      'action-0001'
    );
    expect(
      focusedFlowPanel.attributes('data-flow-primary-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(focusedFlowPanel.attributes('data-main-flow-next-target-kind')).toBe(
      'runtime-action-edit'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-flow-phase')
    ).toBe('runtime-result');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-current-region')
    ).toBe('runtime-review');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-selected-runtime-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-sequence': '1',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-handled': 'true',
      'data-main-flow-dispatch-has-result': 'true',
      'data-main-flow-dispatch-kind': 'open-runtime-results',
      'data-main-flow-dispatch-source': 'workbench-flow-panel',
      'data-main-flow-dispatch-handler-key': 'openRuntimeResults',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-dispatch-action-id': 'action-0001',
      'data-main-flow-dispatch-state-point-id': '',
      'data-main-flow-loop-step': 'runtime-review',
      'data-main-flow-loop-status': 'advanced',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'focus-runtime-action',
      'data-main-flow-loop-next-target-kind': 'runtime-action-edit',
      'data-main-flow-loop-current-region': 'runtime-review',
      'data-main-flow-loop-next-region': 'action-edit',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-action-id': 'action-0001',
      'data-runtime-review-selected-state-point-id': selectedRuntimePointId,
      'data-runtime-review-pending-state-point-id': '',
      'data-runtime-review-source': '',
      'data-runtime-review-source-kind': 'none',
      'data-runtime-review-last-action-kind': '',
      'data-runtime-review-last-action-source': '',
    });
    expect(focusedFlowPanel.attributes()).toMatchObject({
      'data-main-flow-dispatch-sequence': '1',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-handled': 'true',
      'data-main-flow-dispatch-kind': 'open-runtime-results',
      'data-main-flow-dispatch-source': 'workbench-flow-panel',
      'data-main-flow-dispatch-handler-key': 'openRuntimeResults',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-loop-step': 'runtime-review',
      'data-main-flow-loop-status': 'advanced',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'focus-runtime-action',
      'data-main-flow-loop-next-target-kind': 'runtime-action-edit',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-primary-flow"]')
        .attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-action-edit');
    expect(
      wrapper
        .find('[data-testid="workbench-side-inspector"]')
        .attributes('data-main-flow-inspector-mode')
    ).toBe('runtime-detail');
    expect(
      focusedFlowPanel.attributes('data-main-flow-action-edit-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(
      focusedFlowPanel.attributes('data-main-flow-return-state-point-id')
    ).toBe('');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes()
    ).toMatchObject({
      'data-flow-selected-action-id': 'action-0001',
      'data-flow-selected-state-curve-point-id': selectedRuntimePointId,
    });
    expect(wrapper.find('.resource-monitor-panel').attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': selectedRuntimePointId,
    });
    expect(wrapper.find('.event-log-panel').exists()).toBe(false);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(wrapper.find('.analysis-panel').attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': selectedRuntimePointId,
    });
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.find('.event-log-panel').attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': selectedRuntimePointId,
    });
    expect(wrapper.find('.resource-monitor-panel').exists()).toBe(false);
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail"]')
        .attributes('data-flow-phase')
    ).toBe('runtime-result');
    expect(
      focusedFlowPanel
        .find('[data-testid="workbench-flow-runtime-detail"]')
        .text()
    ).toContain('敌人HP伤害');

    const editRuntimeActionButton = focusedFlowPanel.find(
      '[data-testid="workbench-flow-edit-runtime-action"]'
    );
    expect(editRuntimeActionButton.attributes('disabled')).toBeUndefined();
    expect(editRuntimeActionButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(editRuntimeActionButton.attributes('data-state-point-id')).toBe(
      selectedRuntimePointId
    );
    expect(editRuntimeActionButton.attributes('data-primary-action')).toBe(
      'true'
    );

    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      await editRuntimeActionButton.trigger('click');
      await nextTick();
      await nextTick();
      await Promise.resolve();

      const scrolledElement = scrollIntoView.mock.contexts.at(-1);
      expect(scrolledElement?.getAttribute('data-testid')).toBe(
        'workbench-action-frame-control'
      );
      expect(scrolledElement?.getAttribute('data-edit-field')).toBe('startMs');
    } finally {
      if (originalScrollIntoView) {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      statePointId: selectedRuntimePointId,
      canRun: true,
      payload: {
        trackKey: 'enemyHpDamage',
        trackLabel: '敌人HP伤害',
      },
    });
    const focusedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'workbench-flow-panel'
    );
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-source')
    ).toBe('workbench-flow-panel');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('100');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    const refreshedFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    const refreshedStatePointId = refreshedFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(selectedRuntimePointId);
    const editResultFlowPanel = wrapper.find(
      '[data-testid="workbench-flow-panel"]'
    );
    expect(editResultFlowPanel.attributes('data-flow-phase')).toBe(
      'edit-result-ready'
    );
    expect(wrapper.find('.event-log-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-ready',
    });
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(wrapper.find('.analysis-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-ready',
    });
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(wrapper.find('.resource-monitor-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-ready',
    });
    const returnEditResultButton = editResultFlowPanel.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(
      editResultFlowPanel.attributes('data-edit-result-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(editResultFlowPanel.attributes('data-flow-primary-kind')).toBe(
      'return-runtime-result'
    );
    expect(editResultFlowPanel.attributes('data-flow-primary-action-id')).toBe(
      'action-0001'
    );
    expect(
      editResultFlowPanel.attributes('data-flow-primary-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      editResultFlowPanel.attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-result-return');
    expect(
      editResultFlowPanel.attributes(
        'data-main-flow-action-edit-state-point-id'
      )
    ).toBe('');
    expect(
      editResultFlowPanel.attributes('data-main-flow-return-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-flow-phase')
    ).toBe('edit-result-ready');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-current-region')
    ).toBe('action-edit');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-pending-runtime-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-primary-flow"]')
        .attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-result-return');
    expect(
      wrapper
        .find('[data-testid="workbench-side-inspector"]')
        .attributes('data-main-flow-inspector-mode')
    ).toBe('edit-result');
    expect(returnEditResultButton.attributes('disabled')).toBeUndefined();
    expect(returnEditResultButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(returnEditResultButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(returnEditResultButton.attributes('data-primary-action')).toBe(
      'true'
    );
    await selectSideInspectorPanel(wrapper, 'properties');
    const propertiesResultReturn = wrapper.find(
      '[data-testid="workbench-action-edit-result-return"]'
    );
    expect(propertiesResultReturn.exists()).toBe(true);
    expect(propertiesResultReturn.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(propertiesResultReturn.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(
      propertiesResultReturn.attributes('data-origin-state-point-id')
    ).toBe(selectedRuntimePointId);
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    const detailResultReturn = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-return-result"]'
    );
    expect(detailResultReturn.exists()).toBe(true);
    expect(detailResultReturn.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(detailResultReturn.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await returnEditResultButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'return-runtime-result',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      statePointId: refreshedStatePointId,
      canRun: true,
      payload: {
        originStatePointId: selectedRuntimePointId,
        status: 'refreshed-edit-result',
      },
    });
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-phase')
    ).toBe('edit-result-review');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-primary-kind')
    ).toBe('focus-runtime-action');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-action-edit');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-main-flow-action-edit-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-main-flow-return-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-flow-phase')
    ).toBe('edit-result-review');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-current-region')
    ).toBe('runtime-review');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-selected-runtime-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-pending-runtime-state-point-id')
    ).toBe('');
    expect(
      wrapper
        .find('[data-testid="workbench-primary-flow"]')
        .attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-action-edit');
    expect(
      wrapper
        .find('[data-testid="workbench-side-inspector"]')
        .attributes('data-main-flow-inspector-mode')
    ).toBe('runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes()
    ).toMatchObject({
      'data-flow-selected-action-id': 'action-0001',
      'data-flow-selected-state-curve-point-id': refreshedStatePointId,
    });
    expect(wrapper.find('.resource-monitor-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-flow-state-point-id': refreshedStatePointId,
    });
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(wrapper.find('.analysis-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-flow-state-point-id': refreshedStatePointId,
    });
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
        )
        .attributes('data-selected-state-point-id')
    ).toBe(refreshedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.find('.event-log-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-flow-state-point-id': refreshedStatePointId,
    });
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail"]')
        .attributes()
    ).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-flow-edit-result-state-point-id': refreshedStatePointId,
    });
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-result-context-status')
    ).toBe('refreshed-edit-result');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-result-context-origin-state-point-id')
    ).toBe(selectedRuntimePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-return-result"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('supports the visible workbench loop across curve, log, detail, edit, and refreshed result', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const runSimulationButton = wrapper.find(
      '[data-testid="workbench-flow-open-runtime"]'
    );
    expect(runSimulationButton.text()).toBe('运行模拟');

    await runSimulationButton.trigger('click');
    await nextTick();

    const openedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(openedStatePointId).toBeTruthy();
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-phase')
    ).toBe('runtime-result');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-review-stack"]')
        .attributes('data-runtime-review-layout')
    ).toBe('result-check');
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(
      wrapper
        .find('[data-testid="workbench-resource-area"]')
        .attributes('data-runtime-review-role')
    ).toBe('primary');
    expect(wrapper.find('.event-area').exists()).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(openedStatePointId);

    const runtimeCurvePoint = wrapper.find(
      `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${openedStatePointId}"]`
    );
    expect(runtimeCurvePoint.exists()).toBe(true);

    await runtimeCurvePoint.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, ResourceMonitorPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      statePointId: openedStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${openedStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-resource-chart-selection-action-focus"]'
        )
        .text()
    ).toBe('编辑结果动作');

    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-action-focus"]')
        .text()
    ).toBe('编辑结果动作');

    const runtimeLogRow = wrapper.find(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedStatePointId}"]`
    );
    expect(runtimeLogRow.exists()).toBe(true);

    await runtimeLogRow.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper, EventLogPanel)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'event-log-runtime-row',
      statePointId: openedStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail"]')
        .attributes()
    ).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-state-point-id': openedStatePointId,
      'data-runtime-review-source': 'event-log-runtime-row',
      'data-runtime-review-source-kind': 'log',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-action"]')
        .text()
    ).toContain('普通攻击');

    const detailActionFocus = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-action-focus"]'
    );
    const runtimeDetailPanel = wrapper.findComponent(
      RuntimeSelectedDetailPanel
    );
    expect(detailActionFocus.attributes('disabled')).toBeUndefined();
    expect(detailActionFocus.text()).toBe('编辑结果动作');

    await detailActionFocus.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, runtimeDetailPanel)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
      actionId: 'action-0001',
      statePointId: openedStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-frame-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');

    await wrapper
      .find(
        '[data-testid="workbench-start-frame-step"][data-step-direction="increase"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-start-frame-input"]').element.value
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-start-frame-input"]')
      .setValue('6');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('100');

    await selectSideInspectorPanel(wrapper, 'analysis');
    const editFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    const refreshedStatePointId = editFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(openedStatePointId);
    expect(editFeedback.attributes('data-origin-state-point-id')).toBe(
      openedStatePointId
    );

    const returnButton = wrapper.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(returnButton.attributes('disabled')).toBeUndefined();
    expect(returnButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(returnButton.text()).toBe('查看刷新结果');

    await returnButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'return-runtime-result',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      statePointId: refreshedStatePointId,
      canRun: true,
      payload: {
        originStatePointId: openedStatePointId,
        status: 'refreshed-edit-result',
      },
    });
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    await vi.waitFor(() => {
      expect(
        wrapper.findComponent(RuntimeSelectedDetailPanel).props('detail')
          ?.statePointId
      ).toBe(refreshedStatePointId);
      expect(
        wrapper
          .get('[data-testid="workbench-runtime-selected-detail-state-point"]')
          .text()
      ).toBe(refreshedStatePointId);
    });
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-phase')
    ).toBe('edit-result-review');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-review-stack"]')
        .attributes('data-runtime-review-layout')
    ).toBe('result-check');
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(
      wrapper
        .find('[data-testid="workbench-resource-area"]')
        .attributes('data-runtime-review-role')
    ).toBe('primary');
    expect(wrapper.find('.event-area').exists()).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-result-context-status')
    ).toBe('refreshed-edit-result');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-return-result"]')
        .text()
    ).toBe('查看刷新结果');
  });

  it('guards the desktop result loop layout contract', () => {
    const appSource = compactSource(readTestSource('../../App.vue'));
    const workbenchSource = compactSource(
      readTestSource('../../views/Workbench.vue')
    );
    const resourcePanelSource = compactSource(
      readTestSource('../../features/workbench/ResourceMonitorPanel.vue')
    );
    const eventPanelSource = compactSource(
      readTestSource('../../features/workbench/EventLogPanel.vue')
    );
    const resultPhaseSelector =
      ':is([data-flow-phase=\x27runtime-result\x27],[data-flow-phase=\x27edit-result-review\x27])';

    expect(appSource).toContain(
      '.app{width:100%;min-width:0;min-height:100vh;'
    );
    expect(appSource).not.toContain('width:100vw');
    expect(workbenchSource).toContain(
      'grid-template-columns:minmax(0,var(--workbench-left-panel-width,260px))10pxminmax(0,1fr);'
    );
    expect(workbenchSource).toContain(
      'grid-template-areas:\x27actionsleft-resizermainflow\x27\x27actionsleft-resizerreview\x27;'
    );
    expect(workbenchSource).toContain(
      '.action-library{position:sticky;top:58px;grid-area:actions;min-width:0;max-height:calc(100vh-70px);'
    );
    expect(workbenchSource).toContain(
      '.side-stack{position:fixed;top:108px;right:10px;bottom:10px;z-index:70;'
    );
    expect(workbenchSource).toContain(
      '.primary-flow{display:grid;grid-area:mainflow;align-content:start;gap:14px;min-width:0;}'
    );
    expect(workbenchSource).toContain(
      '.review-workspace{display:grid;grid-area:review;align-content:start;gap:14px;min-width:0;}'
    );
    expect(workbenchSource).toContain(
      '.runtime-review-stack{display:grid;grid-template-columns:minmax(0,1fr);align-items:start;gap:14px;min-width:0;}'
    );
    expect(workbenchSource).not.toContain(
      `.primary-flow${resultPhaseSelector}.runtime-review-stack{order:-1;}`
    );
    expect(workbenchSource).not.toContain(
      `.primary-flow${resultPhaseSelector}:is(.timeline-area,.cycle-review-area){order:1;}`
    );
    expect(workbenchSource).toContain(
      '.runtime-review-stack[data-runtime-review-layout=\x27result-check\x27]{grid-template-columns:minmax(0,1fr);align-items:stretch;gap:10px;}'
    );
    expect(workbenchSource).toContain(
      '.timeline-area,.cycle-review-area,.resource-area,.event-area,.effect-area{min-width:0;}'
    );
    expect(resourcePanelSource).toContain(
      `.resource-monitor-panel${resultPhaseSelector}.runtime-curve-panel{`
    );
    expect(resourcePanelSource).toContain(
      `.resource-monitor-panel${resultPhaseSelector}.runtime-curve-chart{min-height:96px;}`
    );
    expect(eventPanelSource).toContain(
      `.event-log-panel${resultPhaseSelector}.runtime-log-list{max-height:132px;}`
    );
    expect(eventPanelSource).toContain(
      `.event-log-panel${resultPhaseSelector}.runtime-log-row{grid-template-columns:52px46pxminmax(0,1fr);gap:6px;padding:6px8px;}`
    );
    expect(workbenchSource).not.toContain(
      '.primary-flow[data-flow-phase=\x27runtime-result\x27].runtime-review-stack'
    );
    expect(resourcePanelSource).not.toContain(
      '.resource-monitor-panel[data-flow-phase=\x27runtime-result\x27]'
    );
    expect(eventPanelSource).not.toContain(
      '.event-log-panel[data-flow-phase=\x27runtime-result\x27]'
    );
  });

  it('guards the narrow result loop layout contract', () => {
    const workbenchSource = compactSource(
      readTestSource('../../views/Workbench.vue')
    );
    const resourcePanelSource = compactSource(
      readTestSource('../../features/workbench/ResourceMonitorPanel.vue')
    );
    const eventPanelSource = compactSource(
      readTestSource('../../features/workbench/EventLogPanel.vue')
    );
    const runtimeDetailPanelSource = compactSource(
      readTestSource('../../features/workbench/RuntimeSelectedDetailPanel.vue')
    );

    expect(workbenchSource).toContain(
      '.runtime-review-stack[data-runtime-review-layout=\x27result-check\x27]{grid-template-columns:1fr;}'
    );
    expect(resourcePanelSource).toContain(
      '@media(max-width:760px){.runtime-state-grid,.runtime-curve-selection-primary,.runtime-curve-selection-grid{grid-template-columns:1fr;}'
    );
    expect(resourcePanelSource).toContain(
      '.runtime-curve-selection-heading{grid-template-columns:minmax(0,1fr);align-items:stretch;}'
    );
    expect(resourcePanelSource).toContain(
      '.runtime-curve-action-focus{width:100%;}'
    );
    expect(resourcePanelSource).toContain(
      '.runtime-curve-selection-nav{grid-template-columns:28pxminmax(0,1fr)28px;}'
    );
    expect(resourcePanelSource).toContain(
      '.runtime-curve-legend-row{grid-template-columns:9pxminmax(0,1fr);}'
    );
    expect(eventPanelSource).toContain(
      '@media(max-width:760px){.event-log-row,.runtime-log-row,.runtime-log-detail,.runtime-select-filters{grid-template-columns:1fr;gap:4px;}'
    );
    expect(eventPanelSource).toContain(
      '.runtime-track-filters{grid-template-columns:repeat(2,minmax(0,1fr));}'
    );
    expect(eventPanelSource).toContain(
      '.runtime-log-filter-summary,.runtime-log-navigation,.runtime-log-detail[data-detail-layout=\x27compact\x27],.runtime-log-detail.runtime-log-edit-context,.runtime-log-detail.runtime-log-detail-handoff{grid-template-columns:1fr;}'
    );
    expect(eventPanelSource).toContain(
      '.runtime-log-selection-note{align-items:stretch;flex-direction:column;}'
    );
    expect(eventPanelSource).toContain(
      '.runtime-log-selection-notebutton,.runtime-log-action-focus,.runtime-log-result-return{width:100%;}'
    );
    expect(runtimeDetailPanelSource).toContain(
      '.runtime-detail-edit-context,.runtime-detail-return-context,.runtime-detail-contribution-summary{grid-template-columns:1fr;}'
    );
    expect(runtimeDetailPanelSource).toContain(
      '.runtime-detail-summarystrong,.runtime-detail-valuesstrong,.runtime-detail-metastrong{overflow-wrap:anywhere;text-align:left;text-overflow:clip;white-space:normal;}'
    );
    expect(runtimeDetailPanelSource).toContain(
      '.runtime-detail-contribution-row,.runtime-detail-calculator-row,.runtime-detail-source-row{align-items:flex-start;flex-direction:column;gap:3px;}'
    );
    expect(runtimeDetailPanelSource).toContain(
      '.runtime-detail-contribution-rowstrong,.runtime-detail-calculator-rowstrong,.runtime-detail-source-rowstrong{overflow-wrap:anywhere;text-align:left;white-space:normal;}'
    );
  });

  it('edits selected action timing with 60fps frame controls', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(
      wrapper
        .find('[data-testid="workbench-action-frame-controls"]')
        .attributes('data-frame-rate')
    ).toBe('60');
    expect(
      wrapper.find('[data-testid="workbench-start-frame-input"]').element.value
    ).toBe('0');
    expect(
      wrapper.find('[data-testid="workbench-duration-frame-input"]').element
        .value
    ).toBe('60');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-start-frame-step"][data-step-direction="decrease"]'
        )
        .attributes('disabled')
    ).toBeDefined();

    await wrapper
      .find(
        '[data-testid="workbench-start-frame-step"][data-step-direction="increase"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-start-frame-input"]').element.value
    ).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('16.666667');

    await wrapper
      .find(
        '[data-testid="workbench-start-frame-step"][data-step-direction="decrease"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-start-frame-input"]').element.value
    ).toBe('0');

    await wrapper
      .find('[data-testid="workbench-start-frame-input"]')
      .setValue('30');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('500');

    await wrapper
      .find(
        '[data-testid="workbench-duration-frame-step"][data-step-direction="decrease"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-duration-frame-input"]').element
        .value
    ).toBe('59');

    await wrapper
      .find('[data-testid="workbench-duration-frame-input"]')
      .setValue('45');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-duration-frame-input"]').element
        .value
    ).toBe('45');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[0]).toMatchObject({
      id: 'action-0001',
      startMs: 500,
      durationMs: 750,
    });
  });

  it('records failed main flow dispatch results at the workbench layer', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    wrapper
      .findComponent(TimelineGridPreview)
      .vm.$emit('dispatch-flow-action', {
        kind: 'unsupported-flow-action',
        source: 'test-flow-source',
        statePointId: 'runtime-point-for-failure',
      });
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-sequence': '1',
      'data-main-flow-dispatch-status': 'failed',
      'data-main-flow-dispatch-handled': 'false',
      'data-main-flow-dispatch-has-result': 'true',
      'data-main-flow-dispatch-kind': 'unsupported-flow-action',
      'data-main-flow-dispatch-source': 'test-flow-source',
      'data-main-flow-dispatch-handler-key': '',
      'data-main-flow-dispatch-reason': 'unsupported-flow-action-kind',
      'data-main-flow-dispatch-action-id': '',
      'data-main-flow-dispatch-state-point-id': 'runtime-point-for-failure',
      'data-main-flow-loop-step': 'action-edit',
      'data-main-flow-loop-status': 'blocked',
      'data-main-flow-loop-recovery-needed': 'true',
      'data-main-flow-loop-next-action-kind': 'open-runtime-results',
      'data-main-flow-loop-next-target-kind': 'runtime-results',
      'data-runtime-review-selection-status': 'empty',
      'data-runtime-review-selected-action-id': '',
      'data-runtime-review-selected-state-point-id': '',
      'data-runtime-review-source-kind': 'none',
    });

    const recoveryButton = wrapper.find(
      '[data-testid="workbench-flow-open-runtime"]'
    );
    expect(recoveryButton.attributes('disabled')).toBeUndefined();

    await recoveryButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-recovery',
      actionId: 'action-0001',
      canRun: true,
    });
    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-main-flow-dispatch-sequence': '2',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-handled': 'true',
      'data-main-flow-dispatch-has-result': 'true',
      'data-main-flow-dispatch-kind': 'open-runtime-results',
      'data-main-flow-dispatch-source': 'workbench-flow-recovery',
      'data-main-flow-dispatch-handler-key': 'openRuntimeResults',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-dispatch-action-id': 'action-0001',
      'data-main-flow-loop-step': 'runtime-review',
      'data-main-flow-loop-status': 'advanced',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'focus-runtime-action',
      'data-main-flow-loop-next-target-kind': 'runtime-action-edit',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-action-id': 'action-0001',
      'data-runtime-review-source-kind': 'none',
    });
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(true);
  });

  it('opens the refreshed runtime result after a direct action edit from the main flow panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-edit-result-state-point-id')).toBe('');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-return-edit-result"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(false);

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    const refreshedStatePointId = flowPanel.attributes(
      'data-edit-result-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();
    await selectSideInspectorPanel(wrapper, 'analysis');
    const actionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(actionEditFeedback.attributes('data-runtime-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionEditFeedback.attributes('data-edit-origin')).toBe('');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    const pendingRuntimeDetailPanel = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail"]'
    );
    expect(pendingRuntimeDetailPanel.exists()).toBe(true);
    expect(pendingRuntimeDetailPanel.attributes()).toMatchObject({
      'data-runtime-review-selection-status': 'pending-result',
      'data-runtime-review-selected-state-point-id': '',
      'data-runtime-review-primary-operation-kind': 'return-runtime-result',
      'data-runtime-review-primary-operation-enabled': 'true',
      'data-runtime-review-focus-action-enabled': 'false',
      'data-runtime-review-return-result-enabled': 'true',
    });
    expect(
      pendingRuntimeDetailPanel
        .find(
          '[data-testid="workbench-runtime-selected-detail-return-context"]'
        )
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
    const returnEditResultButton = flowPanel.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(returnEditResultButton.attributes('disabled')).toBeUndefined();
    expect(returnEditResultButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(returnEditResultButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await returnEditResultButton.trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
        )
        .attributes('data-selected-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('runs the selected runtime review primary operation from the workbench stack', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await selectRuntimeReviewTab(wrapper, 'event');
    const firstLogRow = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-row"]'
    );
    const statePointId = firstLogRow.attributes('data-state-point-id');
    expect(statePointId).toBeTruthy();

    await firstLogRow.trigger('click');
    await nextTick();

    const runtimeReviewStack = wrapper.find(
      '[data-testid="workbench-runtime-review-stack"]'
    );
    expect(runtimeReviewStack.attributes()).toMatchObject({
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-primary-operation-kind': 'focus-runtime-action',
      'data-runtime-review-primary-operation-enabled': 'true',
    });
    expect(
      runtimeReviewStack
        .find('[data-testid="workbench-runtime-review-primary-bar"]')
        .attributes()
    ).toMatchObject({
      'data-primary-operation-action-id': 'action-0001',
      'data-primary-operation-kind': 'focus-runtime-action',
      'data-primary-operation-state-point-id': statePointId,
    });
    const primaryOperation = runtimeReviewStack.find(
      '[data-testid="workbench-runtime-review-primary-operation"]'
    );
    expect(primaryOperation.exists()).toBe(true);
    expect(primaryOperation.attributes()).toMatchObject({
      'data-action-id': 'action-0001',
      'data-operation-kind': 'focus-runtime-action',
      'data-state-point-id': statePointId,
    });
    expect(primaryOperation.attributes('disabled')).toBeUndefined();
    expect(primaryOperation.text()).toBe('编辑结果动作');

    await primaryOperation.trigger('click');
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-kind': 'focus-runtime-action',
      'data-main-flow-dispatch-source': 'runtime-review-primary',
      'data-main-flow-dispatch-action-id': 'action-0001',
      'data-main-flow-dispatch-state-point-id': statePointId,
    });
    const focusedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'runtime-review-primary'
    );
  });

  it('returns to the refreshed runtime result from the workbench review primary operation', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    await nextTick();

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    const refreshedStatePointId = flowPanel.attributes(
      'data-edit-result-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();

    const runtimeReviewStack = wrapper.find(
      '[data-testid="workbench-runtime-review-stack"]'
    );
    expect(runtimeReviewStack.attributes()).toMatchObject({
      'data-runtime-review-selection-status': 'pending-result',
      'data-runtime-review-primary-operation-kind': 'return-runtime-result',
      'data-runtime-review-primary-operation-enabled': 'true',
    });
    expect(
      runtimeReviewStack
        .find('[data-testid="workbench-runtime-review-primary-bar"]')
        .attributes()
    ).toMatchObject({
      'data-primary-operation-action-id': 'action-0001',
      'data-primary-operation-kind': 'return-runtime-result',
      'data-primary-operation-state-point-id': refreshedStatePointId,
    });
    const primaryOperation = runtimeReviewStack.find(
      '[data-testid="workbench-runtime-review-primary-operation"]'
    );
    expect(primaryOperation.exists()).toBe(true);
    expect(primaryOperation.attributes()).toMatchObject({
      'data-action-id': 'action-0001',
      'data-operation-kind': 'return-runtime-result',
      'data-state-point-id': refreshedStatePointId,
    });
    expect(primaryOperation.text()).toBe('查看刷新结果');

    await primaryOperation.trigger('click');
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-kind': 'return-runtime-result',
      'data-main-flow-dispatch-source': 'runtime-review-primary',
      'data-main-flow-dispatch-action-id': 'action-0001',
      'data-main-flow-dispatch-state-point-id': refreshedStatePointId,
      'data-runtime-review-selection-status': 'selected',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
  });

  it('returns to the refreshed resource result from the main flow panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();
    await selectRuntimeReviewTab(wrapper, 'event');

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    const selectedRuntimePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-detail"]').text()
    ).toContain('自身能量');

    const editRuntimeActionButton = flowPanel.find(
      '[data-testid="workbench-flow-edit-runtime-action"]'
    );
    expect(editRuntimeActionButton.attributes('disabled')).toBeUndefined();

    await editRuntimeActionButton.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('1500');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    const refreshedStatePointId = wrapper
      .find('[data-testid="workbench-action-edit-feedback"]')
      .attributes('data-runtime-state-point-id');
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(selectedRuntimePointId);

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    const returnEditResultButton = flowPanel.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(returnEditResultButton.attributes('data-action-id')).toBe(
      'action-0002'
    );
    expect(returnEditResultButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await returnEditResultButton.trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-detail"]').text()
    ).toContain('自身能量');
  });

  it('refreshes runtime navigation order after editing a result action time', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    const previousRuntimePointButton = flowPanel.find(
      '[data-testid="workbench-flow-runtime-previous"]'
    );
    const firstActionRuntimePointId = previousRuntimePointButton.attributes(
      'data-state-point-id'
    );

    await previousRuntimePointButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'workbench-flow-navigation',
      statePointId: firstActionRuntimePointId,
      canRun: true,
    });
    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(firstActionRuntimePointId);

    await flowPanel
      .find('[data-testid="workbench-flow-edit-runtime-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('6000');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    const refreshedStatePointId = wrapper
      .find('[data-testid="workbench-action-edit-feedback"]')
      .attributes('data-runtime-state-point-id');
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(firstActionRuntimePointId);

    await wrapper
      .find('[data-testid="workbench-flow-return-edit-result"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-navigation-index"]')
        .text()
    ).toBe('2/2');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-previous"]')
        .attributes('disabled')
    ).toBeUndefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-next"]')
        .attributes('disabled')
    ).toBeDefined();
  });

  it('navigates runtime result points from the main flow panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0002');

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-navigation-index"]')
        .text()
    ).toBe('2/2');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-next"]')
        .attributes('disabled')
    ).toBeDefined();
    const previousRuntimePointButton = flowPanel.find(
      '[data-testid="workbench-flow-runtime-previous"]'
    );
    const previousRuntimePointId = previousRuntimePointButton.attributes(
      'data-state-point-id'
    );
    expect(previousRuntimePointButton.attributes('disabled')).toBeUndefined();
    expect(previousRuntimePointId).toBeTruthy();

    await previousRuntimePointButton.trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(previousRuntimePointId);
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-navigation-index"]')
        .text()
    ).toBe('1/2');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-previous"]')
        .attributes('disabled')
    ).toBeDefined();
    const nextRuntimePointButton = flowPanel.find(
      '[data-testid="workbench-flow-runtime-next"]'
    );
    const nextRuntimePointId = nextRuntimePointButton.attributes(
      'data-state-point-id'
    );
    expect(nextRuntimePointButton.attributes('disabled')).toBeUndefined();
    expect(nextRuntimePointId).toBeTruthy();

    await nextRuntimePointButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'workbench-flow-navigation',
      statePointId: nextRuntimePointId,
      canRun: true,
    });
    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(nextRuntimePointId);
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
  });

  it('navigates runtime result points from keyboard review shortcuts', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    const previousRuntimePointId = flowPanel
      .find('[data-testid="workbench-flow-runtime-previous"]')
      .attributes('data-state-point-id');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-main-flow-dispatch-kind')).toBe(
      'select-runtime-state-point'
    );
    expect(flowPanel.attributes('data-main-flow-dispatch-source')).toBe(
      'workbench-keyboard-runtime-navigation'
    );
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(previousRuntimePointId);

    const nextRuntimePointId = flowPanel
      .find('[data-testid="workbench-flow-runtime-next"]')
      .attributes('data-state-point-id');
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(nextRuntimePointId);

    wrapper.unmount();
  });

  it('navigates runtime result points from the runtime detail panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let detailNavigation = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-navigation"]'
    );
    expect(detailNavigation.attributes()).toMatchObject({
      'data-navigation-count': '2',
      'data-navigation-index': '1',
    });
    expect(
      detailNavigation
        .find(
          '[data-testid="workbench-runtime-selected-detail-navigation-index"]'
        )
        .text()
    ).toBe('2/2');
    const previousButton = detailNavigation.find(
      '[data-testid="workbench-runtime-selected-detail-navigation-prev"]'
    );
    const previousStatePointId = previousButton.attributes(
      'data-state-point-id'
    );
    expect(previousButton.attributes('disabled')).toBeUndefined();
    expect(previousStatePointId).toBeTruthy();

    await previousButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, RuntimeSelectedDetailPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'runtime-detail-navigation',
      statePointId: previousStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(previousStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0001');

    detailNavigation = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-navigation"]'
    );
    expect(detailNavigation.attributes('data-navigation-index')).toBe('0');
    expect(
      detailNavigation
        .find(
          '[data-testid="workbench-runtime-selected-detail-navigation-prev"]'
        )
        .attributes('disabled')
    ).toBeDefined();
    const nextButton = detailNavigation.find(
      '[data-testid="workbench-runtime-selected-detail-navigation-next"]'
    );
    const nextStatePointId = nextButton.attributes('data-state-point-id');
    expect(nextButton.attributes('disabled')).toBeUndefined();
    expect(nextStatePointId).toBeTruthy();

    await nextButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, RuntimeSelectedDetailPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'runtime-detail-navigation',
      statePointId: nextStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(nextStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0002');
  });

  it('syncs runtime detail when selecting another action in the runtime view', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    const firstActionStatePointId = flowPanel
      .find('[data-testid="workbench-flow-runtime-previous"]')
      .attributes('data-state-point-id');
    expect(firstActionStatePointId).toBeTruthy();

    await wrapper
      .find(
        '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
      )
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(firstActionStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(firstActionStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(firstActionStatePointId);
  });

  it('clears stale runtime detail when inserting a no-result action in the runtime view', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const initialStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(initialStatePointId).toBeTruthy();

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    await nextTick();

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-overview-active')).toBe('true');
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('-1');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe('');
    expect(flowPanel.attributes('data-runtime-detail-state-point-id')).toBe('');
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).toContain('selected');
  });

  it('opens the first runtime result from a selected no-result action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe('');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('-1');

    await flowPanel
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-panel',
      actionId: 'action-0002',
      payload: {
        fallbackToFirstRuntimePoint: true,
      },
      canRun: true,
    });
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBeTruthy();
  });

  it('syncs runtime detail after deleting the selected runtime action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    const firstActionStatePointId = flowPanel
      .find('[data-testid="workbench-flow-runtime-previous"]')
      .attributes('data-state-point-id');
    expect(firstActionStatePointId).toBeTruthy();

    await wrapper
      .findAll('[data-testid="workbench-delete-action"]')[1]
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(firstActionStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(firstActionStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(firstActionStatePointId);
  });

  it('opens the copied action result and contribution split in the runtime view', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toBeTruthy();

    await wrapper
      .find('[data-testid="workbench-copy-action"]')
      .trigger('click');
    await nextTick();

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');

    const copiedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(copiedStatePointId).toBeTruthy();
    expect(copiedStatePointId).not.toBe(originalStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    await selectSideInspectorPanel(wrapper, 'analysis');
    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      copiedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );

    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0002'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      copiedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
  });

  it('opens the inserted action result and contribution split when adding an action in the runtime view', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toContain('action-0001');

    await addSingleSkillActionFromLibrary(wrapper);
    await nextTick();

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');

    const insertedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(insertedStatePointId).toContain('action-0002');
    expect(insertedStatePointId).not.toBe(originalStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(insertedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(insertedStatePointId);

    await selectSideInspectorPanel(wrapper, 'analysis');
    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      insertedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );

    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0002'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      insertedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(insertedStatePointId);
  });

  it('keeps the result loop usable across adding, copying, editing, and reviewing a refreshed result', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    stubTimelineGeometry(wrapper);

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toContain('action-0001');

    await addSingleSkillActionFromLibrary(wrapper);
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    const insertedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(insertedStatePointId).toContain('action-0002');

    await wrapper
      .find(
        '.action-item[data-action-id="action-0002"] [data-testid="workbench-copy-action"]'
      )
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0003');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0003'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('3');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('2');
    const copiedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(copiedStatePointId).toContain('action-0003');
    expect(copiedStatePointId).not.toBe(insertedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0003');

    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    await wrapper
      .find('[data-testid="workbench-runtime-selected-detail-action-focus"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');

    await dragTimelineAction(wrapper, 'action-0003', {
      fromX: 220,
      toX: 286,
      fromY: 20,
      toY: 20,
    });

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-flow-phase')).toBe('edit-result-ready');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0003');

    await selectSideInspectorPanel(wrapper, 'analysis');
    const dragEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(dragEditFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(dragEditFeedback.attributes('data-origin-state-point-id')).toBe(
      copiedStatePointId
    );
    const refreshedStatePointId = dragEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toContain('action-0003');
    expect(refreshedStatePointId).not.toBe(copiedStatePointId);

    await wrapper
      .find('[data-testid="workbench-flow-return-edit-result"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-flow-phase')).toBe('edit-result-review');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);

    await selectSideInspectorPanel(wrapper, 'analysis');
    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0003"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('syncs runtime detail after shifting a generated action batch in the runtime view', async () => {
    const secondaryCharacterId =
      workbenchSeed.defaults.secondaryCharacterId ??
      workbenchSeed.gameData.characters.find(
        character => character.id !== workbenchSeed.defaults.characterId
      ).id;
    const generationBatch = {
      batchId: 'segment-batch-0001',
      source: 'skill-action-variant-split',
      skillId: workbenchSeed.defaults.skillId,
      actorCharacterId: workbenchSeed.defaults.characterId,
      level: 1,
      variantCount: 2,
      segmentCount: 2,
      createdAt: '2026-07-08T00:00:00.000Z',
    };
    const draft = createWorkbenchDraftSnapshot(
      {
        selection: {
          characterId: workbenchSeed.defaults.characterId,
          secondaryCharacterId,
          skillId: workbenchSeed.defaults.skillId,
          enemyId: workbenchSeed.defaults.enemyId,
        },
        actionDrafts: [
          createWorkbenchActionDraft({
            id: 'action-0001',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 0,
            generationBatch,
          }),
          createWorkbenchActionDraft({
            id: 'action-0002',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 2000,
            generationBatch,
          }),
        ],
        selectedActionId: 'action-0001',
      },
      '2026-07-08T00:00:00.000Z'
    );
    window.localStorage.setItem(
      WORKBENCH_DRAFT_STORAGE_KEY,
      JSON.stringify(draft)
    );

    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-action-batch-summary-count"]')
        .text()
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toBeTruthy();

    await wrapper
      .find('[data-testid="workbench-summary-shift-action-batch-later"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    await selectSideInspectorPanel(wrapper, 'properties');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('500');

    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    const shiftedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(shiftedStatePointId).toBeTruthy();
    expect(shiftedStatePointId).not.toBe(originalStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(shiftedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(shiftedStatePointId);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
        )
        .attributes('data-selected-state-point-id')
    ).toBe(shiftedStatePointId);
  });

  it('copies a generated action batch and focuses the copied runtime result', async () => {
    const secondaryCharacterId =
      workbenchSeed.defaults.secondaryCharacterId ??
      workbenchSeed.gameData.characters.find(
        character => character.id !== workbenchSeed.defaults.characterId
      ).id;
    const generationBatch = {
      batchId: 'segment-batch-0001',
      source: 'skill-action-variant-split',
      skillId: workbenchSeed.defaults.skillId,
      actorCharacterId: workbenchSeed.defaults.characterId,
      level: 1,
      variantCount: 2,
      segmentCount: 2,
      createdAt: '2026-07-08T00:00:00.000Z',
    };
    const draft = createWorkbenchDraftSnapshot(
      {
        selection: {
          characterId: workbenchSeed.defaults.characterId,
          secondaryCharacterId,
          skillId: workbenchSeed.defaults.skillId,
          enemyId: workbenchSeed.defaults.enemyId,
        },
        actionDrafts: [
          createWorkbenchActionDraft({
            id: 'action-0001',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 0,
          }),
          createWorkbenchActionDraft({
            id: 'action-0002',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 1000,
            generationBatch,
          }),
          createWorkbenchActionDraft({
            id: 'action-0003',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 2000,
            generationBatch,
          }),
        ],
        selectedActionId: 'action-0002',
      },
      '2026-07-08T00:00:00.000Z'
    );
    window.localStorage.setItem(
      WORKBENCH_DRAFT_STORAGE_KEY,
      JSON.stringify(draft)
    );

    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toContain('action-0002');

    await wrapper
      .find('[data-testid="workbench-summary-copy-action-batch"]')
      .trigger('click');
    await nextTick();

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '5 action'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-action-batch-summary-count"]')
        .text()
    ).toBe('2');
    const copiedBatch = wrapper.find(
      '[data-testid="workbench-action-batch-summary"][data-batch-id="segment-batch-0002"]'
    );
    expect(copiedBatch.exists()).toBe(true);
    expect(copiedBatch.attributes('data-selected')).toBe('true');
    expect(copiedBatch.attributes('data-first-action-id')).toBe('action-0004');
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0004"]')
        .attributes('data-batch-id')
    ).toBe('segment-batch-0002');
    expect(
      wrapper.find('.action-item[data-action-id="action-0004"]').classes()
    ).toContain('selected');
    await selectSideInspectorPanel(wrapper, 'properties');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('4000');

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0004');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0004'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('5');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('3');

    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    const copiedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(copiedStatePointId).toContain('action-0004');
    expect(copiedStatePointId).not.toBe(originalStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-result-source-row"][data-action-id="action-0004"]'
        )
        .attributes('data-selected-state-point-id')
    ).toBe(copiedStatePointId);
  });

  it('keeps result detail and contribution split usable after deleting a generated action batch in the runtime view', async () => {
    const secondaryCharacterId =
      workbenchSeed.defaults.secondaryCharacterId ??
      workbenchSeed.gameData.characters.find(
        character => character.id !== workbenchSeed.defaults.characterId
      ).id;
    const generationBatch = {
      batchId: 'segment-batch-0001',
      source: 'skill-action-variant-split',
      skillId: workbenchSeed.defaults.skillId,
      actorCharacterId: workbenchSeed.defaults.characterId,
      level: 1,
      variantCount: 2,
      segmentCount: 2,
      createdAt: '2026-07-08T00:00:00.000Z',
    };
    const draft = createWorkbenchDraftSnapshot(
      {
        selection: {
          characterId: workbenchSeed.defaults.characterId,
          secondaryCharacterId,
          skillId: workbenchSeed.defaults.skillId,
          enemyId: workbenchSeed.defaults.enemyId,
        },
        actionDrafts: [
          createWorkbenchActionDraft({
            id: 'action-0001',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 0,
          }),
          createWorkbenchActionDraft({
            id: 'action-0002',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 1000,
            generationBatch,
          }),
          createWorkbenchActionDraft({
            id: 'action-0003',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 2000,
            generationBatch,
          }),
        ],
        selectedActionId: 'action-0002',
      },
      '2026-07-08T00:00:00.000Z'
    );
    window.localStorage.setItem(
      WORKBENCH_DRAFT_STORAGE_KEY,
      JSON.stringify(draft)
    );

    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-action-batch-summary-count"]')
        .text()
    ).toBe('1');

    const batchResultButton = wrapper.find(
      '[data-testid="workbench-summary-view-action-batch-result"]'
    );
    expect(batchResultButton.attributes('data-action-id')).toBe('action-0002');
    expect(batchResultButton.attributes('data-state-point-id')).toContain(
      'action-0002'
    );
    await wrapper
      .find('[data-testid="workbench-summary-view-action-batch-result"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    const batchStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(batchStatePointId).toContain('action-0002');
    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-kind': 'select-runtime-result',
      'data-main-flow-dispatch-source': 'action-batch-summary-result',
      'data-main-flow-dispatch-action-id': 'action-0002',
      'data-main-flow-dispatch-state-point-id': batchStatePointId,
    });

    await wrapper
      .find('[data-testid="workbench-summary-delete-action-batch"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '1 action'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-action-batch-summary-count"]')
        .text()
    ).toBe('0');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');

    const fallbackStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(fallbackStatePointId).toContain('action-0001');
    expect(fallbackStatePointId).not.toBe(batchStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(fallbackStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(fallbackStatePointId);

    await selectSideInspectorPanel(wrapper, 'analysis');
    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      fallbackStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );
    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      fallbackStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
  });

  it('falls back to the first runtime result when opening without a matching action point', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).toContain('selected');

    await flowPanel
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-overview-active')).toBe('false');
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(
      flowPanel.attributes('data-runtime-detail-state-point-id')
    ).toBeTruthy();
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-detail"]').text()
    ).toContain('敌人HP伤害');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-edit-runtime-action"]')
        .attributes('disabled')
    ).toBeUndefined();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(true);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
  });

  it('selects the source action when an action result is focused', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('等待动作');
    await selectSideInspectorPanel(wrapper, 'analysis');
    let actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-current-action')).toBe('false');
    expect(actionResultRow.attributes('data-draft-status')).toBe('dirty');
    expect(actionResultRow.attributes('data-draft-dirty')).toBe('true');
    expect(actionResultRow.attributes('data-result-refresh-status')).toBe(
      'current-draft'
    );
    expect(actionResultRow.attributes('data-edit-source-field')).toBe('');

    await actionResultRow.trigger('click');
    await nextTick();

    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-current-action')).toBe('true');
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-current-action"]')
        .text()
    ).toBe('正在编辑');
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-draft-status"]')
        .text()
    ).toBe('草稿已变更');
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-refresh-status"]')
        .text()
    ).toBe('结果已随当前草稿刷新');
    const actionResultDetailPanel = wrapper.find(
      '[data-testid="workbench-action-result-detail-panel"]'
    );
    expect(actionResultDetailPanel.attributes('data-current-action')).toBe(
      'true'
    );
    expect(actionResultDetailPanel.attributes('data-draft-status')).toBe(
      'dirty'
    );
    expect(actionResultDetailPanel.attributes('data-draft-dirty')).toBe('true');
    expect(
      actionResultDetailPanel.attributes('data-result-refresh-status')
    ).toBe('current-draft');
    expect(actionResultDetailPanel.attributes('data-edit-source-field')).toBe(
      ''
    );
    expect(actionResultDetailPanel.text()).toContain('正在编辑');
    expect(actionResultDetailPanel.text()).toContain('草稿已变更');
    expect(actionResultDetailPanel.text()).toContain('结果已随当前草稿刷新');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).not.toContain('selected');
    await selectSideInspectorPanel(wrapper, 'properties');
    expect(wrapper.find('[data-testid="workbench-level-input"]').exists()).toBe(
      true
    );
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('0');

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-edit-source-field')).toBe('level');
    expect(actionResultRow.attributes('data-edit-source-label')).toBe(
      '等级变更'
    );
    expect(actionResultRow.attributes('data-edit-source-summary')).toBe(
      '1 -> 2'
    );
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-edit-source"]')
        .exists()
    ).toBe(false);
    const editedActionResultDetailPanel = wrapper.find(
      '[data-testid="workbench-action-result-detail-panel"]'
    );
    expect(
      editedActionResultDetailPanel.attributes('data-edit-source-field')
    ).toBe('level');
    expect(
      editedActionResultDetailPanel.attributes('data-edit-source-summary')
    ).toBe('1 -> 2');
    expect(editedActionResultDetailPanel.text()).not.toContain(
      '等级变更 1 -> 2'
    );
    const actionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(actionEditFeedback.exists()).toBe(true);
    expect(actionEditFeedback.attributes('data-action-id')).toBe('action-0001');
    expect(actionEditFeedback.attributes('data-edit-source-field')).toBe(
      'level'
    );
    expect(actionEditFeedback.attributes('data-edit-source-summary')).toBe(
      '1 -> 2'
    );
    const feedbackStatePointId = actionEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(feedbackStatePointId).toBeTruthy();
    expect(actionEditFeedback.attributes('data-runtime-delta-count')).toBe('1');
    expect(actionEditFeedback.attributes('data-result-focused')).toBe('true');
    expect(actionEditFeedback.attributes('data-result-focus-status')).toBe(
      'focused'
    );
    expect(feedbackStatePointId).toBe(
      actionResultRow.attributes('data-runtime-state-point-id')
    );
    expect(actionEditFeedback.text()).toContain('最近编辑');
    expect(actionEditFeedback.text()).toContain('等级变更 1 -> 2');
    expect(
      actionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-status"]')
        .text()
    ).toBe('结果已定位');

    await selectSideInspectorPanel(wrapper, 'properties');
    const levelEditControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="level"]'
    );
    expect(levelEditControl.exists()).toBe(true);
    expect(levelEditControl.attributes('data-edit-focused')).toBe('false');
    expect(levelEditControl.attributes('data-edit-focus-summary')).toBe('');
    let sourceTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(sourceTimelineAction.attributes('data-edit-focused')).toBe('false');
    expect(sourceTimelineAction.attributes('data-edit-focus-field')).toBe('');
    expect(sourceTimelineAction.attributes('data-edit-focus-summary')).toBe('');

    await selectSideInspectorPanel(wrapper, 'analysis');
    const focusSourceButton = wrapper.find(
      '[data-testid="workbench-action-edit-feedback-focus"]'
    );
    expect(focusSourceButton.attributes()).toMatchObject({
      'data-flow-action-kind': 'focus-edit-source',
      'data-flow-action-source': 'analysis-edit-source',
      'data-flow-action-field': 'level',
    });

    const sourceAnalysisPanel = wrapper.findComponent(AnalysisPanel);
    await focusSourceButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, sourceAnalysisPanel)
    ).toMatchObject({
      kind: 'focus-edit-source',
      source: 'analysis-edit-source',
      actionId: 'action-0001',
      fieldKey: 'level',
      canRun: true,
    });

    const focusedLevelEditControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="level"]'
    );
    expect(focusedLevelEditControl.attributes('data-edit-focused')).toBe(
      'true'
    );
    expect(focusedLevelEditControl.attributes('data-edit-focus-summary')).toBe(
      '1 -> 2'
    );
    expect(focusedLevelEditControl.classes()).toContain('edit-focused');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focused')
    ).toBe('false');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    sourceTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(sourceTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(sourceTimelineAction.attributes('data-edit-focus-field')).toBe(
      'level'
    );
    expect(sourceTimelineAction.attributes('data-edit-focus-label')).toBe(
      '等级变更'
    );
    expect(sourceTimelineAction.attributes('data-edit-focus-summary')).toBe(
      '1 -> 2'
    );
    expect(sourceTimelineAction.classes()).toContain('edit-focused');

    await selectSideInspectorPanel(wrapper, 'analysis');
    const resultFocusButton = wrapper.find(
      '[data-testid="workbench-action-edit-feedback-result-focus"]'
    );
    expect(resultFocusButton.attributes('data-runtime-state-point-id')).toBe(
      feedbackStatePointId
    );
    expect(resultFocusButton.attributes()).toMatchObject({
      'data-flow-action-kind': 'select-runtime-result',
      'data-flow-action-source': 'analysis-edit-result',
      'data-flow-action-state-point-id': feedbackStatePointId,
    });
    expect(resultFocusButton.attributes('disabled')).toBeDefined();
    expect(resultFocusButton.text()).toBe('结果已定位');

    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0001');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(feedbackStatePointId);
    await selectSideInspectorPanel(wrapper, 'analysis');
    const focusedActionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(focusedActionEditFeedback.attributes('data-result-focused')).toBe(
      'true'
    );
    expect(
      focusedActionEditFeedback.attributes('data-result-focus-status')
    ).toBe('focused');
    expect(
      focusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-status"]')
        .text()
    ).toBe('结果已定位');
    expect(
      focusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-focus"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      focusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-focus"]')
        .text()
    ).toBe('结果已定位');

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await selectRuntimeReviewTab(wrapper, 'resource');
    const alternateRuntimePoint = wrapper
      .findAll('[data-testid="workbench-runtime-resource-chart-point"]')
      .find(
        point =>
          point.attributes('data-state-point-id') &&
          point.attributes('data-state-point-id') !== feedbackStatePointId
      );
    expect(alternateRuntimePoint).toBeTruthy();
    const alternateStatePointId = alternateRuntimePoint.attributes(
      'data-state-point-id'
    );

    await alternateRuntimePoint.trigger('click');
    await nextTick();

    const unfocusedActionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(unfocusedActionEditFeedback.attributes('data-result-focused')).toBe(
      'false'
    );
    expect(
      unfocusedActionEditFeedback.attributes('data-result-focus-status')
    ).toBe('available');
    expect(
      unfocusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-status"]')
        .text()
    ).toBe('结果未定位');
    const jumpBackButton = unfocusedActionEditFeedback.find(
      '[data-testid="workbench-action-edit-feedback-result-focus"]'
    );
    expect(jumpBackButton.attributes()).toMatchObject({
      'data-primary-action': 'true',
      'data-result-focus-status': 'available',
      'data-flow-action-kind': 'select-runtime-result',
      'data-flow-action-source': 'analysis-edit-result',
      'data-flow-action-state-point-id': feedbackStatePointId,
    });
    expect(jumpBackButton.attributes('disabled')).toBeUndefined();
    expect(jumpBackButton.text()).toBe('查看刷新结果');
    expect(
      unfocusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-focus"]')
        .attributes('data-primary-action')
    ).toBe('false');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${alternateStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');

    await jumpBackButton.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'select-runtime-result',
      source: 'analysis-edit-result',
      actionId: 'action-0001',
      statePointId: feedbackStatePointId,
      canRun: true,
    });

    const jumpedBackActionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(jumpedBackActionEditFeedback.attributes('data-result-focused')).toBe(
      'true'
    );
    expect(
      jumpedBackActionEditFeedback.attributes('data-result-focus-status')
    ).toBe('focused');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(feedbackStatePointId);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-draft-status')).toBe('saved');
    expect(actionResultRow.attributes('data-draft-dirty')).toBe('false');
    expect(actionResultRow.attributes('data-result-refresh-status')).toBe(
      'saved-draft'
    );
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-draft-status"]')
        .text()
    ).toBe('草稿已保存');
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-refresh-status"]')
        .text()
    ).toBe('结果来自已保存草稿');
    expect(
      wrapper
        .find('[data-testid="workbench-action-result-detail-panel"]')
        .attributes('data-draft-status')
    ).toBe('saved');
    expect(
      wrapper
        .find('[data-testid="workbench-action-result-detail-panel"]')
        .attributes('data-result-refresh-status')
    ).toBe('saved-draft');
  });

  it('links runtime sim log selection to the focused state curve point', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const appliedMarker = wrapper.find(
      '[data-testid="workbench-timeline-state-curve-node"]'
    );
    const appliedStatePointId = appliedMarker.attributes('data-state-point-id');

    expect(appliedStatePointId).toBeTruthy();
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-focus-all"]').classes()
    ).toContain('active');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-state-point"]')
        .text()
    ).toBe(appliedStatePointId);
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(false);

    await wrapper
      .find('[data-testid="workbench-runtime-sim-log-row"]')
      .trigger('click');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(appliedStatePointId);
    expect(
      wrapper
        .find(
          `[data-testid="workbench-timeline-state-curve-node"][data-state-point-id="${appliedStatePointId}"]`
        )
        .classes()
    ).toContain('selected');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(appliedStatePointId);
    const logFocusedEventPanel = wrapper.find('.event-log-panel');
    const logFocusedDetailPanel = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail"]'
    );
    for (const panel of [logFocusedEventPanel, logFocusedDetailPanel]) {
      expect(panel.attributes()).toMatchObject({
        'data-runtime-review-selection-status': 'selected',
        'data-runtime-review-selected-action-id': 'action-0001',
        'data-runtime-review-selected-state-point-id': appliedStatePointId,
        'data-runtime-review-source': 'event-log-runtime-row',
        'data-runtime-review-source-kind': 'log',
      });
    }
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(wrapper.find('.resource-monitor-panel').attributes()).toMatchObject({
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-action-id': 'action-0001',
      'data-runtime-review-selected-state-point-id': appliedStatePointId,
      'data-runtime-review-source': 'event-log-runtime-row',
      'data-runtime-review-source-kind': 'log',
    });
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      logFocusedDetailPanel.attributes('data-runtime-review-detail-synced')
    ).toBe('true');
    expect(logFocusedDetailPanel.attributes()).toMatchObject({
      'data-runtime-review-primary-operation-kind': 'focus-runtime-action',
      'data-runtime-review-primary-operation-enabled': 'true',
      'data-runtime-review-focus-action-enabled': 'true',
      'data-runtime-review-return-result-enabled': 'false',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-layout')
    ).toBe('compact');
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-detail-row"]')
        .map(row => [row.attributes('data-detail-key'), row.text()])
    ).toEqual([
      ['action', '动作普通攻击'],
      ['state-point', `状态点${appliedStatePointId}`],
    ]);
    const selectedLogDetailHandoff = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-detail-handoff"]'
    );
    expect(selectedLogDetailHandoff.exists()).toBe(true);
    expect(selectedLogDetailHandoff.attributes('data-detail-source')).toBe(
      'runtime-selected-detail'
    );
    expect(selectedLogDetailHandoff.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(selectedLogDetailHandoff.text()).toContain('三值详情面板');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-contribution"]')
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-contribution-row"]')
        .map(row => [
          row.attributes('data-contribution-key'),
          row.attributes('data-contribution-source'),
          row.attributes('data-value'),
          row.text(),
        ])
    ).toEqual([
      ['hp', 'hit-transaction', '12461', '敌人 HP12,461'],
      ['toughness', 'hit-transaction', '0', '敌人韧性0'],
      ['energy', 'hit-transaction', '0', '自身能量0'],
    ]);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-source"]').exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-calculator"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-action"]')
        .text()
    ).toContain('普通攻击');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-delta"]')
        .text()
    ).toBe('12,461');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-cumulative"]')
        .text()
    ).toBe('12,461');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-value"]')
        .text()
    ).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-overrun"]')
        .text()
    ).toBe('3,833');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-selected-detail-baseline-status"]'
        )
        .text()
    ).toBe('敌人面板');
    expect(
      wrapper
        .findAll(
          '[data-testid="workbench-runtime-selected-detail-calculator-row"]'
        )
        .map(row => [row.attributes('data-calculator-key'), row.text()])
    ).toEqual([
      ['calculator', '适配器HP适配器'],
      ['kind', '来源HP预览'],
      ['replaceable', '替换可替换'],
      ['status', '公式公式未确认'],
      ['unresolved', '缺口最终公式、防御抗性顺序、命中绑定'],
    ]);
    expect(
      wrapper
        .findAll(
          '[data-testid="workbench-runtime-selected-detail-contribution-row"]'
        )
        .map(row => [
          row.attributes('data-contribution-key'),
          row.attributes('data-active'),
          row.text(),
        ])
    ).toEqual([
      ['hp', 'true', '敌人 HP12,461'],
      ['toughness', 'false', '敌人韧性0'],
      ['energy', 'false', '自身能量0'],
    ]);
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').text()
    ).toContain('109001081');

    const runtimeDetailActionFocus = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-action-focus"]'
    );
    expect(runtimeDetailActionFocus.exists()).toBe(true);
    expect(runtimeDetailActionFocus.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(runtimeDetailActionFocus.attributes('data-focus-field')).toBe(
      'startMs'
    );
    expect(runtimeDetailActionFocus.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(runtimeDetailActionFocus.attributes('disabled')).toBeUndefined();
    expect(runtimeDetailActionFocus.text()).toBe('编辑结果动作');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-edit-context"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-action-edit-result-return"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-return-result"]')
        .exists()
    ).toBe(false);

    const runtimeDetailComponent = wrapper.findComponent(
      RuntimeSelectedDetailPanel
    );
    await runtimeDetailActionFocus.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, runtimeDetailComponent)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
      actionId: 'action-0001',
      statePointId: appliedStatePointId,
      canRun: true,
    });
    const focusedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-field')).toBe(
      'startMs'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'runtime-detail'
    );
    const runtimeDetailStartControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    );
    expect(runtimeDetailStartControl.attributes('data-edit-focused')).toBe(
      'true'
    );
    expect(runtimeDetailStartControl.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(runtimeDetailStartControl.attributes('data-edit-focus-origin')).toBe(
      'runtime-focus'
    );
    expect(runtimeDetailStartControl.attributes('data-edit-focus-source')).toBe(
      'runtime-detail'
    );
    expect(
      runtimeDetailStartControl.attributes('data-edit-focus-summary')
    ).toContain('敌人 HP');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    const runtimeDetailEditContext = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-edit-context"]'
    );
    expect(runtimeDetailEditContext.exists()).toBe(true);
    expect(
      runtimeDetailEditContext.attributes('data-edit-context-status')
    ).toBe('edit-focus-synced');
    expect(runtimeDetailEditContext.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(runtimeDetailEditContext.attributes('data-edit-focus-field')).toBe(
      'startMs'
    );
    expect(runtimeDetailEditContext.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(runtimeDetailEditContext.text()).toContain('编辑焦点已同步');
    expect(runtimeDetailEditContext.text()).toContain('结果定位');
    await selectSideInspectorPanel(wrapper, 'properties');
    const originResultReturn = wrapper.find(
      '[data-testid="workbench-action-edit-result-return"]'
    );
    expect(originResultReturn.exists()).toBe(true);
    expect(originResultReturn.attributes('data-return-status')).toBe(
      'origin-result'
    );
    expect(originResultReturn.attributes('data-action-id')).toBe('action-0001');
    expect(originResultReturn.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(originResultReturn.attributes('data-origin-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(originResultReturn.text()).toContain('回到来源结果');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('100');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    const runtimeDetailEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(runtimeDetailEditFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(runtimeDetailEditFeedback.attributes('data-edit-focus-source')).toBe(
      'runtime-detail'
    );
    expect(
      runtimeDetailEditFeedback.attributes('data-origin-state-point-id')
    ).toBe(appliedStatePointId);
    expect(runtimeDetailEditFeedback.attributes('data-origin-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(
      runtimeDetailEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-origin"]')
        .text()
    ).toBe('来自结果定位');
    const refreshedRuntimeStatePointId = runtimeDetailEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedRuntimeStatePointId).toBeTruthy();
    expect(refreshedRuntimeStatePointId).not.toBe(appliedStatePointId);
    await selectSideInspectorPanel(wrapper, 'properties');
    const refreshedResultReturn = wrapper.find(
      '[data-testid="workbench-action-edit-result-return"]'
    );
    expect(refreshedResultReturn.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(refreshedResultReturn.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    expect(refreshedResultReturn.attributes('data-origin-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(refreshedResultReturn.text()).toContain('回到刷新后结果');
    const refreshedResultReturnButton = refreshedResultReturn.find(
      '[data-testid="workbench-action-edit-result-return-button"]'
    );
    expect(refreshedResultReturnButton.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    const runtimeDetailReturnButton = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-return-result"]'
    );
    expect(runtimeDetailReturnButton.exists()).toBe(true);
    expect(runtimeDetailReturnButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(
      runtimeDetailReturnButton.attributes('data-origin-state-point-id')
    ).toBe(appliedStatePointId);
    expect(runtimeDetailReturnButton.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(runtimeDetailReturnButton.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    expect(runtimeDetailReturnButton.text()).toBe('查看刷新结果');

    await selectSideInspectorPanel(wrapper, 'properties');
    const propertiesPanel = wrapper.findComponent(PropertiesPanel);
    const activeRefreshedResultReturnButton = wrapper.find(
      '[data-testid="workbench-action-edit-result-return-button"]'
    );
    await activeRefreshedResultReturnButton.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper, propertiesPanel)).toMatchObject(
      {
        kind: 'return-runtime-result',
        source: 'properties-panel',
        actionId: 'action-0001',
        statePointId: refreshedRuntimeStatePointId,
        canRun: true,
      }
    );
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedRuntimeStatePointId);
    await selectSideInspectorPanel(wrapper, 'analysis');
    const syncedActionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(syncedActionResultRow.attributes('data-selected')).toBe('true');
    expect(
      syncedActionResultRow.attributes('data-result-location-status')
    ).toBe('selected-result');
    expect(
      syncedActionResultRow.attributes('data-selected-state-point-id')
    ).toBe(refreshedRuntimeStatePointId);
    expect(
      syncedActionResultRow
        .find('[data-testid="workbench-action-result-location-status"]')
        .text()
    ).toBe('当前位置已同步');
    const syncedActionResultDetail = wrapper.find(
      '[data-testid="workbench-action-result-detail-panel"]'
    );
    expect(
      syncedActionResultDetail.attributes('data-result-location-status')
    ).toBe('selected-result');
    expect(
      syncedActionResultDetail.attributes('data-selected-state-point-id')
    ).toBe(refreshedRuntimeStatePointId);
    expect(
      syncedActionResultDetail
        .find('[data-testid="workbench-action-result-detail-location-status"]')
        .text()
    ).toBe('当前位置已同步');
    await selectRuntimeReviewTab(wrapper, 'event');
    const syncedRuntimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(
      syncedRuntimeLogNavigation.attributes('data-navigation-status')
    ).toBe('synced');
    expect(syncedRuntimeLogNavigation.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    expect(syncedRuntimeLogNavigation.text()).toContain('日志已同步');
    await selectSideInspectorPanel(wrapper, 'analysis');
    const feedbackLocationChain = wrapper.find(
      '[data-testid="workbench-action-edit-feedback-location-chain"]'
    );
    expect(feedbackLocationChain.exists()).toBe(true);
    expect(feedbackLocationChain.attributes('data-chain-status')).toBe(
      'synced'
    );
    expect(feedbackLocationChain.attributes('data-chain-synced-count')).toBe(
      '3'
    );
    expect(feedbackLocationChain.attributes('data-chain-total-count')).toBe(
      '3'
    );
    expect(feedbackLocationChain.attributes('data-action-synced')).toBe('true');
    expect(feedbackLocationChain.attributes('data-result-synced')).toBe('true');
    expect(feedbackLocationChain.attributes('data-detail-synced')).toBe('true');
    expect(feedbackLocationChain.text()).toContain('3/3已同步');
    expect(feedbackLocationChain.text()).toContain('动作已选中');
    expect(feedbackLocationChain.text()).toContain('结果已定位');
    expect(feedbackLocationChain.text()).toContain('详情已同步');
  });

  it('keeps runtime detail return synced after a result edit reorders points', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();
    await selectRuntimeReviewTab(wrapper, 'event');

    const firstLogRow = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-row"]'
    );
    const originStatePointId = firstLogRow.attributes('data-state-point-id');
    expect(originStatePointId).toBeTruthy();

    await firstLogRow.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-action"]')
        .text()
    ).toContain('普通攻击');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(originStatePointId);

    await wrapper
      .find('[data-testid="workbench-runtime-selected-detail-action-focus"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('6000');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    const refreshedStatePointId = wrapper
      .find('[data-testid="workbench-action-edit-feedback"]')
      .attributes('data-runtime-state-point-id');
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(originStatePointId);

    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    const detailReturnButton = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-return-result"]'
    );
    expect(detailReturnButton.exists()).toBe(true);
    expect(detailReturnButton.attributes('data-action-id')).toBe('action-0001');
    expect(detailReturnButton.attributes('data-origin-state-point-id')).toBe(
      originStatePointId
    );
    expect(detailReturnButton.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(detailReturnButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    const runtimeDetailComponent = wrapper.findComponent(
      RuntimeSelectedDetailPanel
    );
    await detailReturnButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, runtimeDetailComponent)
    ).toMatchObject({
      kind: 'return-runtime-result',
      source: 'runtime-detail',
      actionId: 'action-0001',
      statePointId: refreshedStatePointId,
      canRun: true,
    });

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);

    await selectRuntimeReviewTab(wrapper, 'event');
    const logNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(logNavigation.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(logNavigation.attributes('data-navigation-count')).toBe('2');
    expect(logNavigation.attributes('data-navigation-index')).toBe('1');

    await selectRuntimeReviewTab(wrapper, 'resource');
    const curveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(curveSelection.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(curveSelection.attributes('data-navigation-count')).toBe('2');
    expect(curveSelection.attributes('data-navigation-index')).toBe('1');

    await selectSideInspectorPanel(wrapper, 'analysis');
    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );
  });

  it('links runtime sim log detail to the action edit focus', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await selectRuntimeReviewTab(wrapper, 'event');
    await wrapper
      .find('[data-testid="workbench-runtime-sim-log-row"]')
      .trigger('click');
    await nextTick();

    const statePointId = wrapper
      .find('[data-testid="workbench-runtime-sim-log-state-point"]')
      .text();
    expect(getLastDispatchedFlowAction(wrapper, EventLogPanel)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'event-log-runtime-row',
      statePointId,
      canRun: true,
    });
    const logActionFocus = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-action-focus"]'
    );

    expect(logActionFocus.exists()).toBe(true);
    expect(logActionFocus.attributes('data-action-id')).toBe('action-0001');
    expect(logActionFocus.attributes('data-focus-field')).toBe('startMs');
    expect(logActionFocus.attributes('data-state-point-id')).toBe(statePointId);
    expect(logActionFocus.attributes('disabled')).toBeUndefined();
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-edit-context"]')
        .exists()
    ).toBe(false);

    await logActionFocus.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper, EventLogPanel)).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'event-log-runtime-detail',
      actionId: 'action-0001',
      statePointId,
      canRun: true,
      payload: {
        trackKey: 'enemyHpDamage',
        trackLabel: '敌人HP伤害',
      },
    });
    const focusedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-field')).toBe(
      'startMs'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'event-log-runtime-detail'
    );
    const logStartControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    );
    expect(logStartControl.attributes('data-edit-focused')).toBe('true');
    expect(logStartControl.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(logStartControl.attributes('data-edit-focus-origin')).toBe(
      'runtime-focus'
    );
    expect(logStartControl.attributes('data-edit-focus-source')).toBe(
      'event-log-runtime-detail'
    );
    expect(logStartControl.attributes('data-edit-focus-summary')).toContain(
      '敌人 HP'
    );
    const logEditContext = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-edit-context"]'
    );
    expect(logEditContext.exists()).toBe(true);
    expect(logEditContext.attributes('data-edit-context-status')).toBe(
      'edit-focus-synced'
    );
    expect(logEditContext.attributes('data-action-id')).toBe('action-0001');
    expect(logEditContext.attributes('data-edit-focus-field')).toBe('startMs');
    expect(logEditContext.attributes('data-state-point-id')).toBe(statePointId);
    expect(logEditContext.text()).toContain('编辑焦点已同步');
    expect(logEditContext.text()).toContain('结果定位');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('100');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    const logEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(logEditFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(logEditFeedback.attributes('data-edit-focus-source')).toBe(
      'event-log-runtime-detail'
    );
    expect(logEditFeedback.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(logEditFeedback.attributes('data-origin-track-key')).toBe(
      'enemyHpDamage'
    );
    const refreshedStatePointId = logEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(statePointId);
    expect(
      logEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-origin"]')
        .text()
    ).toBe('来自结果定位');

    const logResultReturnButton = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-return-result"]'
    );
    expect(logResultReturnButton.exists()).toBe(true);
    expect(logResultReturnButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(logResultReturnButton.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(logResultReturnButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(logResultReturnButton.text()).toBe('查看刷新结果');

    await logResultReturnButton.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper, EventLogPanel)).toMatchObject({
      kind: 'return-runtime-result',
      source: 'event-log-runtime-detail',
      actionId: 'action-0001',
      statePointId: refreshedStatePointId,
      canRun: true,
      payload: {
        originStatePointId: statePointId,
        status: 'refreshed-edit-result',
      },
    });
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    const returnedLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(returnedLogNavigation.attributes('data-navigation-status')).toBe(
      'synced'
    );
    expect(returnedLogNavigation.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
  });

  it('keeps log and resource curve navigation synced after editing from a log result', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();
    await selectRuntimeReviewTab(wrapper, 'event');

    const firstLogRow = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-row"]'
    );
    const originStatePointId = firstLogRow.attributes('data-state-point-id');
    expect(originStatePointId).toBeTruthy();

    await firstLogRow.trigger('click');
    await nextTick();

    let runtimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(runtimeLogNavigation.attributes('data-navigation-index')).toBe('0');
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-navigation-index')
    ).toBe('0');
    await selectRuntimeReviewTab(wrapper, 'event');

    await wrapper
      .find('[data-testid="workbench-runtime-sim-log-action-focus"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('6000');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    const refreshedStatePointId = wrapper
      .find('[data-testid="workbench-action-edit-feedback"]')
      .attributes('data-runtime-state-point-id');
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(originStatePointId);

    const originalLogReturnScrollIntoView = Element.prototype.scrollIntoView;
    const logReturnScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = logReturnScrollIntoView;

    try {
      await wrapper
        .find('[data-testid="workbench-runtime-sim-log-return-result"]')
        .trigger('click');
      await nextTick();
      await nextTick();
      await nextTick();
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      if (originalLogReturnScrollIntoView) {
        Element.prototype.scrollIntoView = originalLogReturnScrollIntoView;
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }

    runtimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(runtimeLogNavigation.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(runtimeLogNavigation.attributes('data-navigation-count')).toBe('2');
    expect(runtimeLogNavigation.attributes('data-navigation-index')).toBe('1');
    const returnedRuntimeLogRow = wrapper.find(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${refreshedStatePointId}"]`
    );
    expect(returnedRuntimeLogRow.exists()).toBe(true);
    expect(returnedRuntimeLogRow.attributes('data-selected')).toBe('true');
    expect(logReturnScrollIntoView).not.toHaveBeenCalled();

    await selectRuntimeReviewTab(wrapper, 'resource');
    const curveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(curveSelection.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(curveSelection.attributes('data-navigation-count')).toBe('2');
    expect(curveSelection.attributes('data-navigation-index')).toBe('1');
    expect(curveSelection.attributes('data-runtime-focus-source')).toBe(
      'event-log-runtime-detail'
    );

    await selectSideInspectorPanel(wrapper, 'analysis');
    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-runtime-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );

    const actionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(actionEditFeedback.attributes('data-runtime-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionEditFeedback.attributes('data-result-focused')).toBe('true');

    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('returns to the refreshed result and contribution split after dragging a runtime-focused action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    stubTimelineGeometry(wrapper);

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originStatePointId).toContain('action-0001');

    await wrapper
      .find('[data-testid="workbench-runtime-selected-detail-action-focus"]')
      .trigger('click');
    await nextTick();

    await dragTimelineAction(wrapper, 'action-0001', {
      fromX: 100,
      toX: 169,
      fromY: 20,
      toY: 20,
    });

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).not.toBe('0');

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-flow-phase')).toBe('edit-result-ready');
    await selectSideInspectorPanel(wrapper, 'analysis');
    const dragEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(dragEditFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(dragEditFeedback.attributes('data-edit-focus-source')).toBe(
      'runtime-detail'
    );
    expect(dragEditFeedback.attributes('data-origin-state-point-id')).toBe(
      originStatePointId
    );
    expect(dragEditFeedback.attributes('data-result-focused')).toBe('false');
    const refreshedStatePointId = dragEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toContain('action-0001');
    expect(refreshedStatePointId).not.toBe(originStatePointId);

    const returnButton = wrapper.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(returnButton.exists()).toBe(true);
    expect(returnButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await returnButton.trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-flow-phase')).toBe('edit-result-review');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'resource');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);

    await selectSideInspectorPanel(wrapper, 'analysis');
    const returnedEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(returnedEditFeedback.attributes('data-runtime-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(returnedEditFeedback.attributes('data-result-focused')).toBe('true');

    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );
    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('links runtime resource curve points to the focused state curve point', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    const runtimeCurvePoints = wrapper
      .findAll('[data-testid="workbench-runtime-resource-chart-point"]')
      .filter(point => point.attributes('data-state-point-id'));
    expect(runtimeCurvePoints.length).toBeGreaterThan(1);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0002');
    const runtimeCurvePoint = runtimeCurvePoints[0];
    const statePointId = runtimeCurvePoint.attributes('data-state-point-id');

    expect(statePointId).toBeTruthy();

    const originalRuntimeCurveScrollIntoView = Element.prototype.scrollIntoView;
    const runtimeCurveScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = runtimeCurveScrollIntoView;

    try {
      await runtimeCurvePoint.trigger('click');
      await nextTick();
      await nextTick();
      await Promise.resolve();
    } finally {
      if (originalRuntimeCurveScrollIntoView) {
        Element.prototype.scrollIntoView = originalRuntimeCurveScrollIntoView;
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }

    const runtimeReviewStack = wrapper.find(
      '[data-testid="workbench-runtime-review-stack"]'
    );
    expect(runtimeReviewStack.attributes()).toMatchObject({
      'data-runtime-review-layout': 'result-check',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-state-point-id': statePointId,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-resource-area"]')
        .attributes('data-runtime-review-role')
    ).toBe('primary');
    expect(wrapper.find('.event-area').exists()).toBe(false);

    expect(
      getLastDispatchedFlowAction(wrapper, ResourceMonitorPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      statePointId,
      canRun: true,
    });
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${statePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0001');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(statePointId);
    expect(
      wrapper
        .find(
          `[data-testid="workbench-timeline-state-curve-node"][data-state-point-id="${statePointId}"]`
        )
        .classes()
    ).toContain('selected');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(statePointId);
    const curveFocusedResourcePanel = wrapper.find('.resource-monitor-panel');
    const curveFocusedDetailPanel = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail"]'
    );
    for (const panel of [curveFocusedResourcePanel, curveFocusedDetailPanel]) {
      expect(panel.attributes()).toMatchObject({
        'data-runtime-review-selection-status': 'selected',
        'data-runtime-review-selected-action-id': 'action-0001',
        'data-runtime-review-selected-state-point-id': statePointId,
        'data-runtime-review-source': 'resource-runtime-curve',
        'data-runtime-review-source-kind': 'curve',
      });
    }
    expect(
      curveFocusedDetailPanel.attributes('data-runtime-review-detail-synced')
    ).toBe('true');
    expect(curveFocusedDetailPanel.attributes()).toMatchObject({
      'data-runtime-review-primary-operation-kind': 'focus-runtime-action',
      'data-runtime-review-primary-operation-enabled': 'true',
      'data-runtime-review-focus-action-enabled': 'true',
      'data-runtime-review-return-result-enabled': 'false',
    });
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.find('.event-area').attributes()).toMatchObject({
      'data-runtime-review-role': 'secondary',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-action-id': 'action-0001',
      'data-runtime-review-selected-state-point-id': statePointId,
      'data-runtime-review-source': 'resource-runtime-curve',
      'data-runtime-review-source-kind': 'curve',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-placement')
    ).toBe('selected-first');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${statePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(runtimeCurveScrollIntoView).not.toHaveBeenCalled();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-selected-detail-contribution-row"][data-active="true"]'
        )
        .text()
    ).toBe('敌人 HP12,461');
    const runtimeContributionSummary = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-contribution-summary"]'
    );
    expect(runtimeContributionSummary.attributes()).toMatchObject({
      'data-active-count': '1',
      'data-total-count': '3',
      'data-primary-contribution-key': 'hp',
    });
    expect(
      runtimeContributionSummary
        .find(
          '[data-testid="workbench-runtime-selected-detail-contribution-summary-primary"]'
        )
        .text()
    ).toBe('敌人 HP 12,461');
    await selectRuntimeReviewTab(wrapper, 'resource');
    const runtimeCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(runtimeCurveSelection.exists()).toBe(true);
    expect(runtimeCurveSelection.attributes('data-state-point-id')).toBe(
      statePointId
    );
    expect(runtimeCurveSelection.attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(runtimeCurveSelection.attributes('data-curve-mode')).toBe('delta');
    expect(runtimeCurveSelection.attributes('data-runtime-focus-source')).toBe(
      'resource-runtime-curve'
    );
    expect(
      Number(runtimeCurveSelection.attributes('data-navigation-count'))
    ).toBeGreaterThan(1);
    expect(runtimeCurveSelection.attributes('data-navigation-index')).toBe('0');
    const runtimeCurveSelectionSource = runtimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-source"]'
    );
    expect(runtimeCurveSelectionSource.text()).toBe('手动选择');
    expect(
      runtimeCurveSelectionSource.attributes('data-result-context-active')
    ).toBe('false');
    const runtimeCurveSelectionPrimary = runtimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-primary"]'
    );
    expect(runtimeCurveSelectionPrimary.attributes()).toMatchObject({
      'data-track-key': 'enemyHpDamage',
      'data-state-point-id': statePointId,
    });
    expect(
      runtimeCurveSelectionPrimary
        .find(
          '[data-testid="workbench-runtime-resource-chart-selection-primary-delta"]'
        )
        .text()
    ).toBe('12,461');
    expect(
      runtimeCurveSelectionPrimary
        .find(
          '[data-testid="workbench-runtime-resource-chart-selection-primary-state"]'
        )
        .text()
    ).toBe('累计 12,461 · 剩余 0 · 溢出 3,833');
    const runtimeCurveSelectionRows = Object.fromEntries(
      runtimeCurveSelection
        .findAll(
          '[data-testid="workbench-runtime-resource-chart-selection-row"]'
        )
        .map(row => [row.attributes('data-detail-key'), row])
    );
    expect(Object.keys(runtimeCurveSelectionRows)).toEqual(['point', 'action']);
    expect(runtimeCurveSelectionRows.point.text()).toContain('敌人 HP');
    expect(runtimeCurveSelectionRows.action.text()).toContain('普通攻击');

    const nextButton = runtimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-next"]'
    );
    const nextStatePointId = nextButton.attributes('data-state-point-id');
    expect(nextStatePointId).toBeTruthy();
    expect(nextButton.attributes('disabled')).toBeUndefined();

    await nextButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, ResourceMonitorPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      statePointId: nextStatePointId,
      canRun: true,
    });
    const nextRuntimeCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(nextRuntimeCurveSelection.attributes('data-state-point-id')).toBe(
      nextStatePointId
    );
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${nextStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(nextStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0002');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).toContain('selected');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${nextStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    await selectRuntimeReviewTab(wrapper, 'resource');

    const currentNextRuntimeCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    const previousButton = currentNextRuntimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-prev"]'
    );
    expect(previousButton.attributes('data-state-point-id')).toBe(statePointId);
    expect(previousButton.attributes('disabled')).toBeUndefined();

    await previousButton.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(statePointId);

    const actionFocusButton = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection-action-focus"]'
    );
    const focusedActionId = actionFocusButton.attributes('data-action-id');
    expect(focusedActionId).toBeTruthy();
    expect(actionFocusButton.attributes('data-focus-field')).toBe('startMs');
    expect(actionFocusButton.attributes('disabled')).toBeUndefined();

    await actionFocusButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, ResourceMonitorPanel)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'resource-runtime-curve',
      actionId: focusedActionId,
      statePointId,
      canRun: true,
      payload: {
        trackKey: 'enemyHpDamage',
        trackLabel: '敌人HP伤害',
      },
    });
    const focusedTimelineAction = wrapper.find(
      `[data-testid="workbench-timeline-action"][data-action-id="${focusedActionId}"]`
    );
    expect(focusedTimelineAction.exists()).toBe(true);
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-field')).toBe(
      'startMs'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'resource-runtime-curve'
    );
    expect(
      focusedTimelineAction.attributes('data-edit-focus-summary')
    ).toContain('三值点');
    const resourceStartControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    );
    expect(resourceStartControl.attributes('data-edit-focused')).toBe('true');
    expect(resourceStartControl.attributes('data-edit-focus-source')).toBe(
      'resource-runtime-curve'
    );
    expect(
      resourceStartControl.attributes('data-edit-focus-summary')
    ).toContain('敌人 HP');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('100');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'analysis');
    const runtimeOriginFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(runtimeOriginFeedback.exists()).toBe(true);
    expect(runtimeOriginFeedback.attributes('data-action-id')).toBe(
      focusedActionId
    );
    expect(runtimeOriginFeedback.attributes('data-edit-source-field')).toBe(
      'startMs'
    );
    expect(runtimeOriginFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(runtimeOriginFeedback.attributes('data-edit-focus-source')).toBe(
      'resource-runtime-curve'
    );
    expect(runtimeOriginFeedback.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(runtimeOriginFeedback.attributes('data-origin-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(
      runtimeOriginFeedback
        .find('[data-testid="workbench-action-edit-feedback-origin"]')
        .text()
    ).toBe('来自结果定位');
    const refreshedRuntimeStatePointId = runtimeOriginFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedRuntimeStatePointId).toBeTruthy();
    expect(refreshedRuntimeStatePointId).not.toBe(statePointId);
    const resultPointMap = runtimeOriginFeedback.find(
      '[data-testid="workbench-action-edit-feedback-result-map"]'
    );
    expect(resultPointMap.exists()).toBe(true);
    expect(resultPointMap.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(resultPointMap.attributes('data-runtime-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    const resultPointMapRows = Object.fromEntries(
      resultPointMap
        .findAll(
          '[data-testid="workbench-action-edit-feedback-result-map-row"]'
        )
        .map(row => [row.attributes('data-result-point-key'), row])
    );
    expect(resultPointMapRows.origin.text()).toContain('原结果');
    expect(resultPointMapRows.origin.text()).toContain('敌人 HP');
    expect(resultPointMapRows.runtime.text()).toContain('刷新后');
    expect(resultPointMapRows.runtime.text()).toContain('结果未定位');
    const resultFocusButton = runtimeOriginFeedback.find(
      '[data-testid="workbench-action-edit-feedback-result-focus"]'
    );
    expect(resultFocusButton.attributes()).toMatchObject({
      'data-flow-action-kind': 'select-runtime-result',
      'data-flow-action-source': 'analysis-edit-result',
      'data-flow-action-state-point-id': refreshedRuntimeStatePointId,
    });
    expect(resultFocusButton.attributes('disabled')).toBeUndefined();

    await resultFocusButton.trigger('click');
    await nextTick();

    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedRuntimeStatePointId);
    const refreshedCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(refreshedCurveSelection.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    expect(
      refreshedCurveSelection.attributes('data-runtime-focus-source')
    ).toBe('analysis-edit-result');
    expect(
      refreshedCurveSelection.attributes('data-result-context-status')
    ).toBe('refreshed-edit-result');
    expect(
      refreshedCurveSelection.attributes(
        'data-result-context-origin-state-point-id'
      )
    ).toBe(statePointId);
    expect(
      refreshedCurveSelection.attributes('data-result-context-action-id')
    ).toBe(focusedActionId);
    const refreshedCurveSelectionSource = refreshedCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-source"]'
    );
    expect(refreshedCurveSelectionSource.text()).toBe('刷新后结果');
    expect(
      refreshedCurveSelectionSource.attributes('data-result-context-active')
    ).toBe('true');

    const refreshedFlowPanel = wrapper.find(
      '[data-testid="workbench-flow-panel"]'
    );
    expect(refreshedFlowPanel.attributes('data-flow-phase')).toBe(
      'edit-result-review'
    );
    const continueEditButton = refreshedFlowPanel.find(
      '[data-testid="workbench-flow-edit-runtime-action"]'
    );
    expect(continueEditButton.text()).toBe('继续修改动作');
    expect(continueEditButton.attributes()).toMatchObject({
      'data-action-id': focusedActionId,
      'data-primary-action': 'true',
      'data-state-point-id': refreshedRuntimeStatePointId,
    });
    expect(continueEditButton.attributes('disabled')).toBeUndefined();

    await continueEditButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'workbench-flow-panel',
      actionId: focusedActionId,
      statePointId: refreshedRuntimeStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes()
    ).toMatchObject({
      'data-edit-focused': 'true',
      'data-edit-focus-origin': 'runtime-focus',
      'data-edit-focus-source': 'workbench-flow-panel',
    });
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper
        .find('[data-testid="workbench-action-edit-feedback"]')
        .attributes()
    ).toMatchObject({
      'data-runtime-state-point-id': refreshedRuntimeStatePointId,
      'data-result-focused': 'true',
    });
  });

  it('links applied state curve points to the shared runtime detail', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await selectSideInspectorPanel(wrapper, 'analysis');
    const appliedStatePoint = wrapper.find(
      '[data-testid="workbench-state-curve-point"][data-layer-key="applied"]'
    );
    const statePointId = appliedStatePoint.attributes('data-state-point-id');

    expect(statePointId).toBeTruthy();

    await appliedStatePoint.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          `[data-testid="workbench-state-curve-point"][data-state-point-id="${statePointId}"]`
        )
        .classes()
    ).toContain('selected');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(statePointId);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${statePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    await selectSideInspectorPanel(wrapper, 'runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-track"]')
        .text()
    ).toContain('applied-frame-0-point-0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-source-delta"]')
        .text()
    ).toContain('action-0001|applied-frame-0-point-0');
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').text()
    ).toContain('10900101');
  });

  it('exposes sampled and placeholder state curve layers before values are applied', async () => {
    let stateCurveLayerFilters = {
      applied: true,
      candidate: true,
      sampled: false,
      placeholder: false,
    };
    let wrapper;
    const updateStateCurveLayerFilters = event => {
      stateCurveLayerFilters = {
        ...stateCurveLayerFilters,
        [event.layerKey]: event.visible,
      };
      void wrapper.setProps({ stateCurveLayerFilters });
    };
    wrapper = mount(AnalysisPanel, {
      props: {
        ...createStateCurvePanelProps(),
        stateCurveLayerFilters,
        onUpdateStateCurveLayerFilter: updateStateCurveLayerFilters,
      },
    });
    const findLayerToggle = key =>
      wrapper.find(
        `[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="${key}"]`
      );
    const getLayerToggleText = key =>
      findLayerToggle(key).element.closest('label')?.textContent ?? '';

    expect(
      wrapper.find('[data-testid="workbench-state-curves"]').exists()
    ).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('0');
    expect(getLayerToggleText('sampled')).toContain('采样 1');
    expect(getLayerToggleText('sampled')).toContain('不进结果');
    expect(findLayerToggle('sampled').attributes('data-point-count')).toBe('1');
    expect(findLayerToggle('sampled').attributes('data-track-count')).toBe('1');
    expect(getLayerToggleText('placeholder')).toContain('占位 1');
    expect(getLayerToggleText('placeholder')).toContain('不进结果');
    expect(findLayerToggle('placeholder').attributes('data-point-count')).toBe(
      '1'
    );
    expect(
      wrapper.findAll('[data-testid="workbench-state-curve-row"]')
    ).toHaveLength(0);

    await findLayerToggle('sampled').setValue(true);
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    const sampledRow = wrapper.find(
      '[data-testid="workbench-state-curve-row"][data-track-key="selfEnergyChange"]'
    );
    expect(sampledRow.exists()).toBe(true);
    expect(sampledRow.text()).toContain('sp · 1/1层 · 1点');
    expect(sampledRow.text()).toContain('采样 1点 Δ0.3375 Σ0.3375');
    const sampledPoints = sampledRow.findAll(
      '[data-testid="workbench-state-curve-point"]'
    );
    expect(sampledPoints).toHaveLength(1);
    expect(sampledPoints[0].attributes('data-layer-key')).toBe('sampled');
    expect(sampledPoints[0].attributes('data-participation')).toBe('采样诊断');
    expect(sampledPoints[0].attributes('data-frame-label')).toBe('0s12f');
    expect(sampledPoints[0].text()).toContain('采样 Δ0.3375 Σ0.3375');
    expect(
      sampledPoints[0]
        .find('[data-testid="workbench-state-curve-point-participation"]')
        .text()
    ).toBe('采样诊断，不参与当前结果');
    expect(sampledPoints[0].text()).toContain('recover-sp-applied');
    expect(sampledPoints[0].text()).toContain('element 109001081');
    expect(sampledPoints[0].text()).toContain('SP 10->10.3375');

    await findLayerToggle('placeholder').setValue(true);
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('2');
    const placeholderRow = wrapper.find(
      '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
    );
    expect(placeholderRow.exists()).toBe(true);
    expect(placeholderRow.text()).toContain('raw-damage · 1/1层 · 1点');
    expect(placeholderRow.text()).toContain('占位 1点 Δ0 Σ0');
    const placeholderPoints = placeholderRow.findAll(
      '[data-testid="workbench-state-curve-point"]'
    );
    expect(placeholderPoints).toHaveLength(1);
    expect(placeholderPoints[0].attributes('data-layer-key')).toBe(
      'placeholder'
    );
    expect(placeholderPoints[0].attributes('data-participation')).toBe(
      '缺口占位'
    );
    expect(placeholderPoints[0].attributes('data-frame-label')).toBe('1s0f');
    expect(placeholderPoints[0].text()).toContain('占位 Δ0 Σ0');
    expect(
      placeholderPoints[0]
        .find('[data-testid="workbench-state-curve-point-participation"]')
        .text()
    ).toBe('缺口占位，不参与当前结果');
    expect(placeholderPoints[0].text()).toContain('资源动作');
    expect(placeholderPoints[0].text()).toContain('action-result-placeholder');
  });

  it('keeps Hanyouyou summon target candidates in secondary analysis evidence', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    await selectCharacterFromTimeline(wrapper, 0, 101003);
    await selectSideInspectorPanel(wrapper, 'analysis');

    const text = wrapper.text();
    expect(text).toContain('寒悠悠');
    expect(text).toContain(
      '逐hit候选 4/4段 · 三值字段 6 · 召唤目标 2/4段/4元素 · 触发候选 0f/1f/4f/5f/20f/25f/29f/34f'
    );
    expect(text).toContain(
      '三值框架 3轨 · 曲线 3条/12点 · 状态 13点 · 细节后补'
    );
    expect(text).toContain('状态曲线');
    expect(text).toContain('候选 4点 Δ6,400-18,000 Σ44,300');
    expect(
      wrapper.findAll('[data-testid="workbench-candidate-value-chart-row"]')
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(0);
  });

  it('shows the selected actor current-rank attribute panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    expect(
      wrapper
        .find('[data-testid="workbench-character-attribute-panel"]')
        .attributes('data-character-id')
    ).toBe('109001');
    expect(
      wrapper
        .find('[data-testid="workbench-character-attribute-policy"]')
        .text()
    ).toBe('80级 / 临阶 7');
    expect(
      wrapper
        .find('[data-testid="workbench-character-attribute-source"]')
        .text()
    ).toContain('role-attribute-dynamic-current-rank');
    const rows = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-character-attribute-row"]')
        .map(row => [row.attributes('data-attribute-key'), row.text()])
    );
    expect(rows.attack).toContain('攻击');
    expect(rows.attack).toContain('1920');
    expect(rows.maxHp).toContain('生命');
    expect(rows.maxHp).toContain('10748');
    expect(rows.critRate).toContain('6.1%');

    await selectCharacterFromTimeline(wrapper, 1, 101003);
    await wrapper
      .find('[data-testid="workbench-add-switch-action"]')
      .trigger('click');
    await flushPromises();
    await nextTick();
    await wrapper
      .find('.action-item[data-action-id="action-0002"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-character-attribute-panel"]')
        .attributes('data-character-id')
    ).toBe('109001');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-character-attribute-row"][data-attribute-key="attack"]'
        )
        .text()
    ).toContain('攻击');
  });

  it('updates simulation output when editable controls change', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondEnemy = workbenchSeed.gameData.enemies.find(
      enemy => enemy.id !== workbenchSeed.defaults.enemyId
    );

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    expect(wrapper.text()).toContain('714%');

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('1200');
    expect(wrapper.text()).toContain('1200ms');

    await wrapper
      .find('[data-testid="workbench-enemy-select"]')
      .setValue(String(secondEnemy.id));
    expect(wrapper.text()).toContain(secondEnemy.name);
  });

  it('applies real enemy toughness configuration to the runtime state curve', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await selectEnemyInspector(wrapper);

    const toughnessStat = wrapper.find(
      '[data-testid="workbench-enemy-toughness-stat"]'
    );
    expect(toughnessStat.text()).toContain('6,667 / 6,667');
    expect(toughnessStat.attributes('data-toughness-source-status')).toBe(
      'toughness-config-derived-from-enemy-base-attribute'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-enemy-toughness-state"]')
        .text()
    ).toBe('剩余 6,667 / 6,667');

    await wrapper
      .find('[data-testid="workbench-enemy-toughness-multiplier-input"]')
      .setValue('2');
    await wrapper
      .find('[data-testid="workbench-enemy-initial-toughness-input"]')
      .setValue('50');
    await nextTick();

    expect(toughnessStat.text()).toContain('6,667 / 13,334');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-enemy-toughness-state"]')
        .text()
    ).toBe('剩余 6,667 / 13,334');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    expect(
      JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY))
        .enemyConfig
    ).toMatchObject({
      toughnessMultiplier: 2,
      initialToughnessRatio: 0.5,
    });
  });

  it('edits and saves enemy element defense overrides without applying a damage formula', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await selectEnemyInspector(wrapper);
    const editor = wrapper.find(
      '[data-testid="workbench-enemy-element-defense-editor"]'
    );
    const fireRow = () =>
      wrapper.find(
        '[data-testid="workbench-enemy-element-defense-FIRE_DEFENSE"]'
      );
    const fireInput = () =>
      wrapper.find(
        '[data-testid="workbench-enemy-element-defense-input-FIRE_DEFENSE"]'
      );

    expect(editor.attributes('data-formula-status')).toBe(
      'project-config-only'
    );
    expect(fireRow().text()).toContain('火');
    expect(fireRow().text()).toContain('0%');
    expect(fireRow().attributes('data-source-status')).toBe(
      'azpr-enemy-base-attribute'
    );
    expect(fireInput().element.value).toBe('');

    await fireInput().setValue('25');
    await nextTick();

    expect(fireInput().element.value).toBe('25');
    expect(fireRow().attributes('data-source-status')).toBe('user-override');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    expect(
      JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY))
        .enemyConfig.elementDefenseOverrides
    ).toEqual({
      FIRE_DEFENSE: 0.25,
    });
  });

  it('shows skill logic sources and display-versus-logic timing differences', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    expect(
      wrapper
        .find('[data-testid="workbench-skill-logic-source"]')
        .attributes('data-logic-status')
    ).toBe('mapped');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-status"]').text()
    ).toBe('已映射');
    expect(
      wrapper.find('[data-testid="workbench-skill-display-timing"]').text()
    ).toContain('CD 0ms / SP 0');
    expect(
      wrapper.find('[data-testid="workbench-skill-display-timing"]').text()
    ).toContain('#1657');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-timing"]').text()
    ).toContain('selfCD 0ms / GCD 0ms');
    expect(
      wrapper
        .findAll('[data-testid="workbench-skill-element-value-row"]')
        .map(row => row.text())
    ).toEqual([
      '#973 · 109001081 · 1#1600|7#10000',
      '#985 · 109001306 · 1#1600|7#10000',
    ]);
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('参数 1 / A：公式槽位，语义未确认');
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('参数 7 / G：恒定公式槽位，语义未确认');
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-link"]')
        .attributes('data-link-status')
    ).toBe('unmatched');
    expect(
      wrapper.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('动作形态倍率 普攻 / 649%');
    expect(
      wrapper.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('未解释参数 1, 7');

    await selectCharacterFromTimeline(wrapper, 0, 101007);
    await wrapper
      .find('[data-testid="workbench-skill-select"]')
      .setValue('10100712');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-skill-logic-source"]')
        .attributes('data-logic-status')
    ).toBe('mismatch');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-status"]').text()
    ).toBe('来源差异');
    expect(
      wrapper.find('[data-testid="workbench-skill-display-timing"]').text()
    ).toContain('CD 13000ms / SP 0');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-timing"]').text()
    ).toContain('CD 20000ms / SP 0');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-mismatch"]').text()
    ).toContain('显示 CD 13000ms / SP 0，逻辑 CD 20000ms / SP 0');
    expect(
      wrapper.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('动作形态倍率 星鸣技 / 180%');
    expect(
      wrapper.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('未解释参数 1, 7');
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('参数 1 / A');
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('参数 7 / G');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    wrapper.unmount();

    const restored = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已恢复草稿'
    );
    expect(
      restored
        .find('[data-testid="workbench-skill-logic-source"]')
        .attributes('data-logic-status')
    ).toBe('mismatch');
    expect(
      restored.find('[data-testid="workbench-skill-logic-mismatch"]').text()
    ).toContain('逻辑 CD 20000ms');
    expect(
      restored.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('未解释参数 1, 7');
    expect(
      restored
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('语义未确认');
  });

  it('selects a skill action variant and saves the projection choice', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const segmentSelect = wrapper.find(
      '[data-testid="workbench-damage-segment-select"]'
    );
    const segmentOptions = Array.from(segmentSelect.element.options).map(
      option => option.textContent
    );

    expect(segmentSelect.element.value).toBe('0');
    expect(segmentOptions).toEqual(
      expect.arrayContaining(['普通攻击 / 649% / 普攻5段总值', '重击 / 190%'])
    );

    await segmentSelect.setValue('1');

    expect(
      wrapper.find('[data-testid="workbench-damage-segment-select"]').element
        .value
    ).toBe('1');
    expect(wrapper.find('.selection-note').text()).toContain('190%');
    expect(
      wrapper.find('.action-item[data-action-id="action-0001"]').text()
    ).toContain('190%');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(wrapper.text()).toContain('hit绑定 0/2 · 缺口候选 1/1');
    expect(wrapper.text()).toContain('伤害元素候选 1/1');
    expect(wrapper.text()).toContain('关联等级链 1/1');
    expect(wrapper.text()).toContain('参数来源候选 1/1');
    expect(wrapper.text()).toContain('应用入口候选 1/1');
    expect(wrapper.text()).toContain('原生入口 1/1');
    expect(wrapper.text()).toContain('反汇编片段 1/1');
    expect(wrapper.text()).toContain('充能探针 1/1');
    expect(wrapper.text()).toContain('构造探针 1/1');
    expect(wrapper.text()).toContain('修正探针 1/1');
    expect(wrapper.text()).toContain('归属探针 1/1');
    expect(wrapper.text()).toContain('采样契约 1/1');
    expect(wrapper.text()).toContain('来源差异 1/1');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[0]).toMatchObject({
      id: 'action-0001',
      skillId: workbenchSeed.defaults.skillId,
      actionVariantIndex: 1,
      damageSegmentIndex: 1,
    });
  });

  it('lists manually releasable combat actions without switch-triggered star-carry', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const entries = wrapper.findAll('[data-testid="workbench-skill-entry"]');
    expect(
      entries.map(entry => entry.find('.skill-entry-name').text())
    ).toEqual([
      '普通攻击',
      '重击',
      '闪击',
      '跃击',
      '星鸣技',
      '星结合击',
      '星决技',
      '极限反击',
      '完美招架',
    ]);
    expect(entries.map(entry => entry.attributes('data-action-kind'))).toEqual([
      'normal-attack',
      'charged-attack',
      'dodge-attack',
      'plunging-attack',
      'star-skill',
      'star-combo',
      'ultimate',
      'limit-counter',
      'perfect-parry',
    ]);
    expect(entries.map(entry => entry.text()).join(' ')).not.toContain(
      '哈库茵剑舞'
    );
    expect(entries.map(entry => entry.text()).join(' ')).not.toContain(
      '暴击率'
    );
    expect(
      entries
        .find(entry => entry.attributes('data-action-kind') === 'star-skill')
        ?.attributes('data-skill-id')
    ).toBe('10900112');
  });

  it('adds a selected combat action directly from the action library', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await addSkillActionFromLibrary(wrapper, 'star-skill');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(
      wrapper.find('.action-item[data-action-id="action-0002"]').text()
    ).toContain('星鸣技');
    expect(
      wrapper.find('.action-item[data-action-id="action-0002"]').text()
    ).toContain('2000ms');
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      skillId: 10900112,
      actorCharacterId: workbenchSeed.defaults.characterId,
      level: 1,
      actionVariantIndex: 0,
      damageSegmentIndex: 0,
      durationMs: 1000,
    });
    expect(savedDraft.actionDrafts[1].note).toContain('星鸣技：160%');
  });

  it('uses verified action occupancy durations for direct combat actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await addSkillActionFromLibrary(wrapper, 'charged-attack');
    await addSkillActionFromLibrary(wrapper, 'dodge-attack');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '3 action'
    );
    expect(
      wrapper
        .findAll('.action-item')
        .map(action => action.find('.action-name').text())
    ).toEqual(['普通攻击', '重击', '闪击']);
    expect(
      wrapper.find('.action-item[data-action-id="action-0002"]').text()
    ).toContain('2000ms');
    expect(
      wrapper.find('.action-item[data-action-id="action-0003"]').text()
    ).toContain('4383.333333ms');
  });

  it('persists a generated star-carry hit edit on its parent switch action', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    workbenchMechanicsProfileMockState.useVerifiedProfile = true;
    workbenchMechanicsProfileMockState.durationMs = 10_000;
    const selection = {
      characterId: 103002,
      secondaryCharacterId: 101010,
      tertiaryCharacterId: 101003,
      skillId: 10300201,
      enemyId: workbenchSeed.defaults.enemyId,
    };
    const teamSlots = [
      { slotId: 'team-slot-1', position: 0, characterId: 103002 },
      { slotId: 'team-slot-2', position: 1, characterId: 101010 },
      { slotId: 'team-slot-3', position: 2, characterId: 101003 },
    ];
    const draft = createWorkbenchDraftSnapshot(
      {
        selection,
        teamSlots,
        actorConfigs: normalizeWorkbenchActorConfigs(
          [],
          selection,
          teamSlots
        ),
        mechanicsProfileSelection:
          createVerifiedWorkbenchMechanicsProfileSelection(),
        actionDrafts: [
          createWorkbenchActionDraft({
            id: 'switch-to-xiaoyu-hit-edit',
            type: 'switch',
            actorCharacterId: 103002,
            targetCharacterId: 101010,
            startMs: 1000,
            durationMs: 0,
          }),
        ],
        initialRuntimeState: {
          controlledActor: {
            actorId: 'actor-103002',
            characterId: 103002,
          },
        },
        selectedActionId: 'switch-to-xiaoyu-hit-edit',
      },
      '2026-07-28T00:00:00.000Z'
    );
    window.localStorage.setItem(
      WORKBENCH_DRAFT_STORAGE_KEY,
      JSON.stringify(draft)
    );

    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    const childId =
      'switch-to-xiaoyu-hit-edit--on-enter--actor-101010--star-carry';
    await wrapper
      .get(`.action-block[data-action-id="${childId}"]`)
      .trigger('click');
    await settleWorkbenchAsyncPanels();
    if (
      wrapper.find(
        '[data-testid="workbench-side-inspector-tab"][data-inspector-panel="properties"]'
      ).exists()
    ) {
      await selectSideInspectorPanel(wrapper, 'properties');
    }
    const hitRows = wrapper.findAll(
      '[data-testid="workbench-hit-override-row"]'
    );
    expect(hitRows).toHaveLength(2);
    await hitRows[1].get('input').setValue(false);
    await settleWorkbenchAsyncPanels();
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');

    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    const savedSwitch = savedDraft.actionDrafts.find(
      action => action.id === 'switch-to-xiaoyu-hit-edit'
    );
    const terminalHitIdentity =
      verifiedCombatMechanicsPackage.controlBindings
        .find(binding => Number(binding.controlSkillId) === 10101021)
        .hits.find(hit => Number(hit.elementId) === 101010177).hitIdentity;
    expect(savedSwitch.hitOverrides).toEqual({
      [terminalHitIdentity]: { willHit: false },
    });
    expect(
      savedDraft.actionDrafts.some(action => action.id === childId)
    ).toBe(false);
  }, 30000);

  it('keeps the Jade charged intent while projecting the A5-derived special form and occupancy', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    workbenchMechanicsProfileMockState.useVerifiedProfile = true;
    workbenchMechanicsProfileMockState.durationMs = 10_000;
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await selectCharacterFromTimeline(wrapper, 2, 101010);
    await findActionLibraryActorButton(wrapper, 101010).trigger('click');
    await settleWorkbenchAsyncPanels();

    const normal = findActionLibraryEntry(wrapper, 'normal-attack');
    const charged = findActionLibraryEntry(wrapper, 'charged-attack');
    expect(normal.attributes('disabled')).toBeUndefined();
    expect(charged.attributes('disabled')).toBeUndefined();
    expect(normal.attributes('data-scheduling-status')).toBe('verified');
    expect(charged.attributes('data-scheduling-status')).toBe('verified');

    await wrapper
      .get(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .trigger('click');
    await normal.trigger('click');
    await nextTick();
    await charged.trigger('click');
    await nextTick();

    const jadeActionNames = () =>
      wrapper.findAll('.action-item .action-name').map(action => action.text());
    const actionCountWithCharged = wrapper.findAll('.action-item').length;
    expect(jadeActionNames()).toContain('特殊重击');
    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(jadeActionNames()).not.toContain('特殊重击');
    expect(wrapper.findAll('.action-item')).toHaveLength(
      actionCountWithCharged - 1
    );
    await wrapper.find('[data-testid="workbench-redo-edit"]').trigger('click');
    await flushPromises();
    await nextTick();
    expect(jadeActionNames()).toContain('特殊重击');
    expect(wrapper.findAll('.action-item')).toHaveLength(
      actionCountWithCharged
    );

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    const actorDrafts = savedDraft.actionDrafts.filter(
      action => Number(action.actorCharacterId) === 101010
    );
    const normalDrafts = actorDrafts
      .filter(action => action.attackGroupId)
      .sort(
        (left, right) => left.attackSequenceIndex - right.attackSequenceIndex
      );
    const chargedDraft = actorDrafts.find(
      action => Number(action.actionVariantIndex) === 2
    );

    expect(normalDrafts).toHaveLength(5);
    expect(normalDrafts.map(action => action.attackSequenceIndex)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(normalDrafts.map(action => msToFrame(action.durationMs))).toEqual([
      20, 35, 47, 30, 80,
    ]);
    expect(
      normalDrafts.every(action => action.timingStatus === 'applied')
    ).toBe(true);
    expect(msToFrame(chargedDraft.startMs - normalDrafts[4].startMs)).toBe(80);
    expect(chargedDraft).toMatchObject({
      durationFrames: 75,
      timingStatus: 'applied',
      needsTimingData: false,
      actionScheduling: {
        kind: 'exact-selected-variant-occupancy',
        selectedSubSkillIndex: 0,
        variantModelStatus: 'partially-resolved',
      },
    });
    expect(msToFrame(chargedDraft.durationMs)).toBe(75);
    const setupSimulationResult =
      wrapper.vm.$.setupState.simulationResult?.value ??
      wrapper.vm.$.setupState.simulationResult;
    const runtimeResolution =
      setupSimulationResult?.verifiedActionVariantRuntime?.actionResolutionById?.get?.(
        chargedDraft.id
      );
    expect([
      ...(setupSimulationResult?.verifiedActionVariantRuntime?.actionResolutionById?.keys?.() ??
        []),
    ]).toContain(chargedDraft.id);
    expect(runtimeResolution?.actionBinding).toMatchObject({
      semanticName: '特殊重击',
      publicControlSkillId: 10101010,
      executionControlSkillId: 10101042,
      selectedSubSkillIndex: 0,
      effectiveOccupancyFrames: 90,
    });
    const chargedBlock = wrapper.get(
      `[data-testid="workbench-timeline-action"][data-action-id="${chargedDraft.id}"]`
    );
    expect(chargedBlock.attributes('title')).toContain('特殊重击');
    expect(chargedBlock.text()).toContain('特殊重击');
    expect(chargedBlock.text()).toContain('90F');
    expect(chargedBlock.text()).toContain('control 10101042/sub0');
  }, 30000);

  it('re-resolves the verified Jade burst chain and enhanced special charged form through real action-library clicks', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    workbenchMechanicsProfileMockState.useVerifiedProfile = true;
    workbenchMechanicsProfileMockState.durationMs = 20_000;
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await selectCharacterFromTimeline(wrapper, 2, 101010);
    await findActionLibraryActorButton(wrapper, 101010).trigger('click');
    await settleWorkbenchAsyncPanels();
    const jadeInitialSp = wrapper.get(
      '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="101010"]'
    );
    await jadeInitialSp.setValue('100');
    await jadeInitialSp.trigger('blur');
    await nextTick();
    await wrapper
      .get(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .trigger('click');

    await findActionLibraryEntry(wrapper, 'ultimate').trigger('click');
    await flushPromises();
    await nextTick();
    await findActionLibraryEntry(wrapper, 'normal-attack').trigger('click');
    await flushPromises();
    await nextTick();

    const setupState = wrapper.vm.$.setupState;
    const readSetupValue = value => value?.value ?? value;
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedAfterBurstChain = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    const burstDrafts = savedAfterBurstChain.actionDrafts
      .filter(
        action =>
          Number(action.actorCharacterId) === 101010 && action.attackGroupId
      )
      .sort(
        (left, right) => left.attackSequenceIndex - right.attackSequenceIndex
      );
    expect(burstDrafts).toHaveLength(3);
    expect(
      burstDrafts.map(action => [
        action.attackSequenceIndex,
        action.attackInput.controlSkillId,
        action.attackInput.selectedSubSkillIndex,
        msToFrame(action.durationMs),
        action.attackInput.linkTimingStatus,
      ])
    ).toEqual([
      [1, 10101001, 1, 72, 'applied'],
      [2, 10101004, 1, 75, 'applied'],
      [3, 10101005, 1, 72, 'applied'],
    ]);
    const burstReadiness = readSetupValue(
      setupState.simulationResult
    ).actionReadinessTimeline.actions.filter(action =>
      burstDrafts.some(draft => draft.id === action.actionId)
    );
    expect(burstReadiness.map(action => action.status)).toEqual([
      'ready',
      'ready',
      'ready',
    ]);
    for (const draft of burstDrafts) {
      expect(
        wrapper
          .get(
            `[data-testid="workbench-timeline-action"][data-action-id="${draft.id}"]`
          )
          .text()
      ).not.toContain('条件待确认');
    }

    await findActionLibraryEntry(wrapper, 'charged-attack').trigger('click');
    await flushPromises();
    await nextTick();

    const refreshedSimulation = readSetupValue(setupState.simulationResult);
    const chargedSelection =
      refreshedSimulation.verifiedActionVariantRuntime.selections.find(
        selection =>
          selection.semanticName === '强化特殊重击' &&
          selection.contextActionId === burstDrafts[2].id
      );
    expect(chargedSelection).toMatchObject({
      publicControlSkillId: 10101010,
      executionControlSkillId: 10101042,
      selectedSubSkillIndex: 1,
      actualDurationFrames: 60,
      status: 'verified-action-variant-selection-ready',
    });
    const chargedBlock = wrapper.get(
      `[data-testid="workbench-timeline-action"][data-action-id="${chargedSelection.actionId}"]`
    );
    expect(chargedBlock.text()).toContain('强化特殊重击');
    expect(chargedBlock.text()).toContain('60F');
    expect(chargedBlock.text()).toContain('control 10101042/sub1');
  }, 30000);

  it('uses the generated Xiaoyu hidden-input windows for real assisted action-library clicks', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    workbenchMechanicsProfileMockState.useVerifiedProfile = true;
    workbenchMechanicsProfileMockState.durationMs = 20_000;
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await selectCharacterFromTimeline(wrapper, 2, 101010);
    await findActionLibraryActorButton(wrapper, 101010).trigger('click');
    await settleWorkbenchAsyncPanels();
    const jadeInitialSp = wrapper.get(
      '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="101010"]'
    );
    await jadeInitialSp.setValue('100');
    await jadeInitialSp.trigger('blur');
    await wrapper
      .get(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .trigger('click');
    const setupState = wrapper.vm.$.setupState;
    const readSetupValue = value => value?.value ?? value;
    const cases = [
      {
        kind: 'star-skill',
        sourceSkillId: 10101012,
        sourceControlSkillId: 10101012,
        expectedStartFrame: 119,
        semanticName: '特殊重击',
        executionSubSkillIndex: 0,
        occupancyFrames: 90,
      },
      {
        kind: 'ultimate',
        sourceSkillId: 10101013,
        sourceControlSkillId: 10101013,
        expectedStartFrame: 328,
        semanticName: '强化特殊重击',
        executionSubSkillIndex: 1,
        occupancyFrames: 60,
      },
      {
        kind: 'limit-counter',
        sourceSkillId: 10101021,
        sourceControlSkillId: 10101025,
        expectedStartFrame: 60,
        semanticName: '特殊重击',
        executionSubSkillIndex: 0,
        occupancyFrames: 90,
      },
    ];

    for (const testCase of cases) {
      await findActionLibraryActorButton(wrapper, 101010).trigger('click');
      await settleWorkbenchAsyncPanels();
      const actionIdsBeforeSourceClick = new Set(
        readSetupValue(setupState.actionDrafts).map(action => action.id)
      );
      await findActionLibraryEntry(wrapper, testCase.kind).trigger('click');
      await settleWorkbenchAsyncPanels();
      const sourceAction = readSetupValue(setupState.actionDrafts)
        .filter(action => !actionIdsBeforeSourceClick.has(action.id))
        .sort((left, right) => right.startMs - left.startMs)[0];
      expect(
        Number(sourceAction?.skillId),
        `${testCase.kind}: source action`
      ).toBe(testCase.sourceSkillId);
      await findActionLibraryEntry(wrapper, 'charged-attack').trigger('click');
      await settleWorkbenchAsyncPanels();
      const simulation = readSetupValue(setupState.simulationResult);
      const sourceSelection =
        simulation.verifiedActionVariantRuntime.selections.find(
          selection => selection.actionId === sourceAction?.id
        );
      const chargedSelection =
        simulation.verifiedActionVariantRuntime.selections.find(
          selection =>
            selection.contextActionId === sourceSelection?.actionId &&
            selection.semanticName === testCase.semanticName
        );
      expect(sourceSelection, testCase.kind).toBeTruthy();
      expect(sourceSelection, testCase.kind).toMatchObject({
        executionControlSkillId: testCase.sourceControlSkillId,
        selectedSubSkillIndex: 0,
      });
      expect(chargedSelection, testCase.kind).toMatchObject({
        publicControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        selectedSubSkillIndex: testCase.executionSubSkillIndex,
        actualDurationFrames: testCase.occupancyFrames,
        status: 'verified-action-variant-selection-ready',
      });
      const chargedAction = readSetupValue(setupState.actionDrafts).find(
        action => action.id === chargedSelection.actionId
      );
      expect(
        msToFrame(chargedAction.startMs - sourceAction.startMs),
        testCase.kind
      ).toBe(testCase.expectedStartFrame);
      const chargedBlock = wrapper.get(
        `[data-testid="workbench-timeline-action"][data-action-id="${chargedAction.id}"]`
      );
      expect(chargedBlock.text()).toContain(testCase.semanticName);
      expect(chargedBlock.text()).toContain(
        `control 10101042/sub${testCase.executionSubSkillIndex}`
      );

      await wrapper
        .find('[data-testid="workbench-undo-edit"]')
        .trigger('click');
      await settleWorkbenchAsyncPanels();
      await wrapper
        .find('[data-testid="workbench-undo-edit"]')
        .trigger('click');
      await settleWorkbenchAsyncPanels();
    }
  }, 60000);

  it('projects a free-mode edge-to-edge Jade star-skill input without persisting overlap', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    workbenchMechanicsProfileMockState.useVerifiedProfile = true;
    workbenchMechanicsProfileMockState.durationMs = 20_000;
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await selectCharacterFromTimeline(wrapper, 2, 101010);
    await findActionLibraryActorButton(wrapper, 101010).trigger('click');
    await settleWorkbenchAsyncPanels();

    await findActionLibraryEntry(wrapper, 'star-skill').trigger('click');
    await settleWorkbenchAsyncPanels();
    const sourceBeforeCharged = (
      wrapper.vm.$.setupState.actionDrafts?.value ??
      wrapper.vm.$.setupState.actionDrafts
    ).find(
      action =>
        Number(action.actorCharacterId) === 101010 &&
        Number(action.skillId) === 10101012
    );
    const simulationBeforeCharged =
      wrapper.vm.$.setupState.simulationResult?.value ??
      wrapper.vm.$.setupState.simulationResult;
    const effectiveSourceBeforeCharged =
      simulationBeforeCharged.effectiveActionTimeline.scenario.actions.find(
        action => action.id === sourceBeforeCharged.id
      );
    expect(
      msToFrame(effectiveSourceBeforeCharged.durationMs),
      JSON.stringify(
        simulationBeforeCharged.verifiedActionVariantRuntime.selectionByActionId.get(
          sourceBeforeCharged.id
        )
      )
    ).toBe(120);
    const chargedEntry = getSkillActionCatalog(
      workbenchSeed.gameData.skills.filter(
        skill => Number(skill.characterId) === 101010
      ),
      1
    ).find(entry => entry.kind === 'charged-attack');
    const jadeActionLane = wrapper
      .findAll(
        '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"]'
      )
      .find(lane => lane.text().includes('涂山小玉'));
    expect(chargedEntry).toBeTruthy();
    expect(jadeActionLane).toBeTruthy();
    wrapper
      .findComponent(TimelineGridPreview)
      .vm.$emit('insert-timeline-entry', {
        entry: { ...chargedEntry, type: 'skill' },
        laneId: jadeActionLane.attributes('data-lane-id'),
        startMs: sourceBeforeCharged.startMs + frameToMs(120),
      });
    await settleWorkbenchAsyncPanels();
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');

    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    const sourceAction = savedDraft.actionDrafts.find(
      action =>
        Number(action.actorCharacterId) === 101010 &&
        Number(action.skillId) === 10101012
    );
    const chargedAction = savedDraft.actionDrafts.find(
      action =>
        Number(action.actorCharacterId) === 101010 &&
        Number(action.actionVariantIndex) === 2
    );
    expect(sourceAction).toBeTruthy();
    expect(chargedAction).toBeTruthy();
    expect(
      msToFrame(chargedAction.startMs - sourceAction.startMs)
    ).toBe(120);

    const setupState = wrapper.vm.$.setupState;
    const readSetupValue = value => value?.value ?? value;
    const simulation = readSetupValue(setupState.simulationResult);
    const effectiveById = new Map(
      simulation.effectiveActionTimeline.scenario.actions.map(action => [
        action.id,
        action,
      ])
    );
    const chargedSelection =
      simulation.verifiedActionVariantRuntime.selectionByActionId.get(
        chargedAction.id
      );
    expect(chargedSelection).toMatchObject({
      semanticName: '特殊重击',
      executionControlSkillId: 10101042,
      selectedSubSkillIndex: 0,
      contextualInputScheduling: {
        resolutionKind: 'edge-intent-contextual-transition',
        inputOffsetFrame: 119,
        executionStartOffsetFrame: 119,
        predecessorEffectiveEndOffsetFrame: 119,
        inputWindow: {
          startFrame: 86,
          endFrame: 120,
          interval: '[start,end)',
        },
      },
    });
    expect(msToFrame(effectiveById.get(sourceAction.id).durationMs)).toBe(119);
    expect(
      msToFrame(
        effectiveById.get(chargedAction.id).startMs - sourceAction.startMs
      )
    ).toBe(119);
    expect(
      simulation.actionRuleDiagnostics.diagnostics.filter(
        diagnostic =>
          diagnostic.code === 'action-lane-overlap' &&
          diagnostic.actionIds?.includes(chargedAction.id)
      )
    ).toEqual([]);

    const operationMarker = wrapper.get(
      `[data-testid="workbench-timeline-operation-marker"][data-action-id="${chargedAction.id}"]`
    );
    expect(
      msToFrame(Number(operationMarker.attributes('data-start-ms')))
    ).toBe(msToFrame(sourceAction.startMs) + 119);
    expect(
      msToFrame(Number(operationMarker.attributes('data-execution-start-ms')))
    ).toBe(msToFrame(sourceAction.startMs) + 119);

    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    await settleWorkbenchAsyncPanels();
    expect(
      wrapper.find(
        `[data-testid="workbench-timeline-action"][data-action-id="${chargedAction.id}"]`
      ).exists()
    ).toBe(false);
    await wrapper.find('[data-testid="workbench-redo-edit"]').trigger('click');
    await settleWorkbenchAsyncPanels();
    expect(
      wrapper
        .get(
          `[data-testid="workbench-timeline-action"][data-action-id="${chargedAction.id}"]`
        )
        .text()
    ).toContain('特殊重击');
  }, 30000);

  it('rebuilds a stale normal-chain drag preview after assisted placement crosses the Jade burst frame', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    workbenchMechanicsProfileMockState.useVerifiedProfile = true;
    workbenchMechanicsProfileMockState.durationMs = 20_000;
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await selectCharacterFromTimeline(wrapper, 2, 101010);
    await findActionLibraryActorButton(wrapper, 101010).trigger('click');
    await settleWorkbenchAsyncPanels();
    const jadeInitialSp = wrapper.get(
      '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="101010"]'
    );
    await jadeInitialSp.setValue('100');
    await jadeInitialSp.trigger('blur');
    await wrapper
      .get(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .trigger('click');
    await findActionLibraryEntry(wrapper, 'ultimate').trigger('click');
    await flushPromises();
    await nextTick();
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedWithUltimate = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    const ultimateDraft = savedWithUltimate.actionDrafts.find(
      action =>
        Number(action.actorCharacterId) === 101010 &&
        Number(action.skillId) === 10101013
    );
    expect(ultimateDraft).toBeTruthy();

    const normalEntry = getSkillActionCatalog(
      workbenchSeed.gameData.skills.filter(
        skill => Number(skill.characterId) === 101010
      ),
      1
    ).find(entry => entry.kind === 'normal-attack');
    const jadeActionLane = wrapper
      .findAll(
        '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"]'
      )
      .find(lane => lane.text().includes('涂山小玉'));
    expect(jadeActionLane).toBeTruthy();
    wrapper
      .findComponent(TimelineGridPreview)
      .vm.$emit('insert-timeline-entry', {
        entry: { ...normalEntry, type: 'skill' },
        laneId: jadeActionLane.attributes('data-lane-id'),
        startMs: ultimateDraft.startMs + frameToMs(100),
      });
    await settleWorkbenchAsyncPanels();
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedAfterDrop = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    const burstDrafts = savedAfterDrop.actionDrafts
      .filter(
        action =>
          Number(action.actorCharacterId) === 101010 && action.attackGroupId
      )
      .sort(
        (left, right) => left.attackSequenceIndex - right.attackSequenceIndex
      );

    expect(burstDrafts).toHaveLength(3);
    expect(burstDrafts[0].startMs).toBeGreaterThanOrEqual(
      ultimateDraft.startMs + frameToMs(329)
    );
    expect(
      burstDrafts.map(action => [
        action.attackSequenceIndex,
        action.attackInput.controlSkillId,
        action.attackInput.selectedSubSkillIndex,
      ])
    ).toEqual([
      [1, 10101001, 1],
      [2, 10101004, 1],
      [3, 10101005, 1],
    ]);
  }, 30000);

  it('rebuilds the workbench project when the selected character changes', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    const nextCharacter = workbenchSeed.gameData.characters.find(
      character => character.id !== workbenchSeed.defaults.characterId
    );
    const nextSkill = workbenchSeed.gameData.skills.find(
      skill => skill.characterId === nextCharacter.id
    );

    await selectCharacterFromTimeline(wrapper, 0, nextCharacter.id);

    expect(wrapper.text()).toContain(
      `工作台：${nextCharacter.name} / ${nextSkill.name}`
    );
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.text()).toContain('DAMAGE_PROJECTED');
    expect(
      getTimelineTeamSlot(wrapper, 0).attributes('data-team-slot-id')
    ).toBe('team-slot-1');
    expect(
      getTimelineTeamSlot(wrapper, 1).attributes('data-character-id')
    ).toBe(String(workbenchSeed.defaults.characterId));
    await selectSideInspectorPanel(wrapper, 'properties');
    expect(
      wrapper.find('[data-testid="workbench-action-actor-select"]').element
        .value
    ).toBe(String(nextCharacter.id));

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.teamSlots).toEqual([
      { slotId: 'team-slot-1', position: 0, characterId: nextCharacter.id },
      {
        slotId: 'team-slot-2',
        position: 1,
        characterId: workbenchSeed.defaults.characterId,
      },
      { slotId: 'team-slot-3', position: 2, characterId: 101007 },
    ]);
    expect(savedDraft.selection).toMatchObject({
      characterId: nextCharacter.id,
      secondaryCharacterId: workbenchSeed.defaults.characterId,
    });
  });

  it('keeps populated tertiary-slot actions with the slot when its character changes', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-action-actor-select"]')
      .setValue('101007');
    await nextTick();
    expect(
      wrapper
        .find('.action-block[data-action-id="action-0002"]')
        .attributes('data-lane-id')
    ).toBe('actor-101007');
    await selectCharacterFromTimeline(wrapper, 2, 101010);

    const migratedAction = wrapper.find(
      '.action-block[data-action-id="action-0002"]'
    );
    expect(migratedAction.attributes('data-lane-id')).toBe('actor-101010');
    await migratedAction.trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-action-actor-select"]').element
        .value
    ).toBe('101010');
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
      )
    ).toHaveLength(3);
  });

  it('clears a pending direct loadout target on close, scenario change, and draft replacement', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    const openCharacterPicker = async () => {
      await getTimelineTeamSlot(wrapper, 2)
        .get('[data-testid="workbench-direct-character-picker"]')
        .trigger('click');
      await settleWorkbenchAsyncPanels();
      expect(wrapper.findComponent(WorkbenchLoadoutPicker).exists()).toBe(true);
    };

    await openCharacterPicker();
    wrapper.findComponent(WorkbenchLoadoutPicker).vm.$emit('close');
    await nextTick();
    expect(wrapper.findComponent(WorkbenchLoadoutPicker).exists()).toBe(false);

    await openCharacterPicker();
    await wrapper
      .get('[data-testid="workbench-scenario-add"]')
      .trigger('click');
    await nextTick();
    expect(wrapper.findComponent(WorkbenchLoadoutPicker).exists()).toBe(false);

    await openCharacterPicker();
    await wrapper.get('[data-testid="workbench-reset-draft"]').trigger('click');
    await nextTick();
    expect(wrapper.findComponent(WorkbenchLoadoutPicker).exists()).toBe(false);
  });

  it('adds, selects, edits, and deletes timeline actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await addSingleSkillActionFromLibrary(wrapper);

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('2');
    expect(
      wrapper.findAll('[data-testid="workbench-delete-action"]')
    ).toHaveLength(2);

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('2400');
    expect(wrapper.text()).toContain('2400ms');

    await wrapper
      .findAll('[data-testid="workbench-delete-action"]')[1]
      .trigger('click');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '1 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
  });

  it('copies the selected action and tracks unsaved draft changes', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '未保存草稿'
    );

    await wrapper
      .find('[data-testid="workbench-copy-action"]')
      .trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已保存草稿'
    );

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
  });

  it('nudges and deletes timeline actions with keyboard shortcuts', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-copy-action"]')
      .trigger('click');
    let timelineActions = wrapper.findAll(
      '[data-testid="workbench-timeline-action"]'
    );

    await timelineActions[1].trigger('keydown', { key: 'ArrowRight' });
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2016.666667');

    timelineActions = wrapper.findAll(
      '[data-testid="workbench-timeline-action"]'
    );
    await timelineActions[1].trigger('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
    });
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('1950');

    timelineActions = wrapper.findAll(
      '[data-testid="workbench-timeline-action"]'
    );
    await timelineActions[1].trigger('keydown', { key: 'Delete' });

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '1 action'
    );
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
  });

  it('adds wait and annotation actions without projecting extra damage', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('等待动作');
    expect(
      wrapper.find('[data-testid="workbench-duration-input"]').element.value
    ).toBe('1000');

    await wrapper
      .find('[data-testid="workbench-duration-input"]')
      .setValue('1500');
    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('等技能冷却');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.text()).toContain('WAIT');
    expect(wrapper.text()).toContain('1500ms / 等技能冷却');

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    await selectSideInspectorPanel(wrapper, 'properties');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '3 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('注释动作');

    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('准备爆发');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.text()).toContain('ANNOTATION');
    expect(wrapper.text()).toContain('准备爆发');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');
  });

  it('edits enemy parameters and reads resource events from simulation', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await selectEnemyInspector(wrapper);
    const spSkill = workbenchSeed.gameData.skills.find(
      skill => Number(skill.spCost) > 0
    );

    expect(wrapper.find('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.80'
    );
    expect(
      wrapper.find('[data-testid="workbench-resource-event-count"]').text()
    ).toBe('0');
    expect(
      wrapper.find('[data-testid="workbench-resource-empty"]').text()
    ).toBe('暂无资源事件');

    await wrapper
      .find('[data-testid="workbench-enemy-level-input"]')
      .setValue('95');
    await wrapper
      .find('[data-testid="workbench-enemy-hp-multiplier-input"]')
      .setValue('2');
    await wrapper
      .find('[data-testid="workbench-enemy-defense-multiplier-input"]')
      .setValue('1.5');

    expect(wrapper.find('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.95'
    );
    expect(wrapper.text()).toContain('2x / 1.5x');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );

    await selectCharacterFromTimeline(wrapper, 0, spSkill.characterId);
    await wrapper
      .find('[data-testid="workbench-skill-select"]')
      .setValue(String(spSkill.id));

    expect(
      wrapper.find('[data-testid="workbench-resource-event-count"]').text()
    ).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-resource-sp-total"]').text()
    ).toBe(`-${spSkill.spCost}`);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-count"]').text()
    ).toBe('2 日志');
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-energy-actor-row"]')
        .map(row => row.text())
        .some(text => text.includes(`SP -${spSkill.spCost}`))
    ).toBe(true);
    const runtimeCurvePointTracks = wrapper
      .findAll('[data-testid="workbench-runtime-resource-chart-point"]')
      .map(point => point.attributes('data-track-key'));
    expect(runtimeCurvePointTracks).toEqual(
      expect.arrayContaining(['selfEnergyChange'])
    );
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-resource-chart-point"][data-track-key="selfEnergyChange"]'
        )
        .attributes('data-delta')
    ).toBe(`-${spSkill.spCost}`);
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log"]').text()
    ).toContain(`SP -${spSkill.spCost}`);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/1');
    expect(
      wrapper
        .find('[data-testid="workbench-event-log-panel"]')
        .attributes('data-runtime-log-review-mode')
    ).toBe('hit');

    await wrapper
      .find(
        '[data-testid="workbench-runtime-sim-log-mode-option"][data-review-mode="delta"]'
      )
      .trigger('click');

    expect(
      wrapper
        .find('[data-testid="workbench-event-log-panel"]')
        .attributes('data-runtime-log-review-mode')
    ).toBe('delta');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('2/2');

    await wrapper
      .find(
        '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="selfEnergyChange"]'
      )
      .trigger('click');

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/2');
    expect(
      wrapper.findAll('[data-testid="workbench-runtime-sim-log-row"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-row"]').text()
    ).toContain(`SP -${spSkill.spCost}`);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-contribution-row"]')
        .map(row => [
          row.attributes('data-contribution-key'),
          row.attributes('data-contribution-source'),
          row.attributes('data-value'),
          row.text(),
        ])
    ).toEqual([
      [
        'hp',
        'hit-aggregate',
        expect.stringMatching(/^\d+$/),
        expect.stringMatching(/^敌人 HP[1-9][\d,]*$/),
      ],
      ['toughness', 'hit-aggregate', '0', '敌人韧性0'],
      [
        'energy',
        'hit-aggregate',
        `-${spSkill.spCost}`,
        `自身能量-${spSkill.spCost}`,
      ],
    ]);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-source"]').text()
    ).toContain(String(spSkill.id));

    const hpRuntimeCurvePoint = wrapper.find(
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"] [data-testid="workbench-timeline-state-curve-node"]'
    );
    const hpRuntimeStatePointId = hpRuntimeCurvePoint.attributes(
      'data-state-point-id'
    );
    await hpRuntimeCurvePoint.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/2');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-selection-filtered"]')
        .text()
    ).toContain('选中三值点不在当前日志筛选内');
    const filteredRuntimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(
      filteredRuntimeLogNavigation.attributes('data-navigation-status')
    ).toBe('filtered-out');
    expect(filteredRuntimeLogNavigation.attributes('data-state-point-id')).toBe(
      hpRuntimeStatePointId
    );
    expect(
      filteredRuntimeLogNavigation.attributes('data-navigation-index')
    ).toBe('-1');
    expect(filteredRuntimeLogNavigation.text()).toContain('筛选外');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-row"]')
        .attributes('data-selected')
    ).toBe('false');

    await wrapper
      .find('[data-testid="workbench-runtime-sim-log-show-selected"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/2');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="enemyHpDamage"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-selection-filtered"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${hpRuntimeStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    const syncedRuntimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(
      syncedRuntimeLogNavigation.attributes('data-navigation-status')
    ).toBe('synced');
    expect(syncedRuntimeLogNavigation.attributes('data-state-point-id')).toBe(
      hpRuntimeStatePointId
    );
    expect(syncedRuntimeLogNavigation.attributes('data-navigation-index')).toBe(
      '0'
    );
    expect(syncedRuntimeLogNavigation.text()).toContain('日志已同步');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    expect(wrapper.text()).toContain('RESOURCE_CHANGE');
  });

  it('adds resource and enemy event actions without projecting extra damage', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('资源动作');
    expect(
      wrapper.find('[data-testid="workbench-resource-change-input"]').element
        .value
    ).toBe('50');

    await wrapper
      .find('[data-testid="workbench-resource-change-input"]')
      .setValue('-35');
    await wrapper
      .find('[data-testid="workbench-resource-reason-input"]')
      .setValue('manual-test');
    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('扣除测试资源');

    expect(
      wrapper.find('[data-testid="workbench-resource-event-count"]').text()
    ).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-resource-sp-total"]').text()
    ).toBe('-35');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.text()).toContain('RESOURCE_CHANGE');
    expect(wrapper.text()).toContain('SP -35 / manual-test');

    await wrapper
      .find('[data-testid="workbench-add-enemy-event-action"]')
      .trigger('click');
    await selectSideInspectorPanel(wrapper, 'properties');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '3 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('敌人事件');

    await wrapper
      .find('[data-testid="workbench-enemy-event-type-input"]')
      .setValue('phase-2');
    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('进入二阶段');

    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.text()).toContain('ENEMY_EVENT');
    expect(wrapper.text()).toContain('phase-2 / 进入二阶段');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');
    await selectSideInspectorPanel(wrapper, 'analysis');
    const placeholderStateLayerToggle = wrapper.find(
      '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="placeholder"]'
    );
    expect(placeholderStateLayerToggle.exists()).toBe(true);
    await placeholderStateLayerToggle.setValue(true);
    await nextTick();
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(0);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-state-curve-node"][data-action-id="action-0002"]'
      )
    ).toHaveLength(1);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-state-curve-node"][data-action-id="action-0003"]'
      )
    ).toHaveLength(0);
    expect(wrapper.text()).toContain('action-result-placeholder');
  });

  it('adds a switch action targeting a secondary actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    expect(wrapper.text()).toContain('3 actor');
    expect(
      getTimelineTeamSlot(wrapper, 1).attributes('data-character-id')
    ).toBe('101003');

    await wrapper
      .find('[data-testid="workbench-add-switch-action"]')
      .trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('切人动作');
    expect(
      wrapper.find('[data-testid="workbench-switch-target-select"]').element
        .value
    ).toBe('101003');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.text()).toContain('SWITCH');
    expect(wrapper.text()).toContain('末音 -> 寒悠悠');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');
    await selectSideInspectorPanel(wrapper, 'properties');
    const controlledActorTimeline = () =>
      wrapper
        .getComponent(TimelineGridPreview)
        .props('controlledActorTimeline');
    const switchBlock = () =>
      wrapper.get(
        '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
      );
    expect(switchBlock().classes()).toContain('switch-event-marker');
    expect(switchBlock().attributes()).toMatchObject({
      'data-switch-event': 'true',
      'data-duration-ms': '0',
      'data-duration-frames': '0',
    });
    expect(switchBlock().find('.duration-handle').exists()).toBe(false);
    expect(
      wrapper.get('[data-testid="workbench-switch-event-frame"]').text()
    ).toContain('0F');
    expect(controlledActorTimeline()).toMatchObject({
      initialActor: { characterId: 109001 },
      finalActor: { characterId: 101003 },
      summary: { transitionCount: 1, intervalCount: 2 },
    });
    const initialSwitchFrame =
      controlledActorTimeline().transitions[0].frameIndex;

    await switchBlock().trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    expect(controlledActorTimeline().transitions[0].frameIndex).toBe(
      initialSwitchFrame + 1
    );

    await switchBlock().trigger('keydown', { key: 'Delete' });
    await nextTick();
    expect(controlledActorTimeline().summary).toMatchObject({
      transitionCount: 0,
      intervalCount: 1,
    });
    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(controlledActorTimeline().transitions[0].frameIndex).toBe(
      initialSwitchFrame + 1
    );

    const nextSecondary = workbenchSeed.gameData.characters.find(
      character =>
        character.id !== workbenchSeed.defaults.characterId &&
        character.id !== 101003
    );
    await selectCharacterFromTimeline(wrapper, 1, nextSecondary.id);

    await wrapper
      .find(
        '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
      )
      .trigger('click');
    await selectSideInspectorPanel(wrapper, 'properties');
    expect(
      wrapper.find('[data-testid="workbench-switch-target-select"]').element
        .value
    ).toBe(String(nextSecondary.id));
    expect(wrapper.text()).toContain(`末音 -> ${nextSecondary.name}`);

    const tertiaryCharacterId = Number(
      getTimelineTeamSlot(wrapper, 2).attributes('data-character-id')
    );
    await selectActorInspector(wrapper, workbenchSeed.defaults.characterId);
    await wrapper
      .find('[data-testid="workbench-initial-controlled-actor-select"]')
      .setValue(String(tertiaryCharacterId));
    await nextTick();
    expect(controlledActorTimeline().initialActor.characterId).toBe(
      tertiaryCharacterId
    );
    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(controlledActorTimeline().initialActor.characterId).toBe(109001);
    await wrapper.find('[data-testid="workbench-redo-edit"]').trigger('click');
    await nextTick();
    expect(controlledActorTimeline().initialActor.characterId).toBe(
      tertiaryCharacterId
    );
  });

  it('keeps a zero-duration switch at its requested frame inside another action range', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await addSingleSkillActionFromLibrary(wrapper);
    await wrapper.find('[data-testid="workbench-start-input"]').setValue('0');
    await wrapper
      .find('[data-testid="workbench-duration-frame-input"]')
      .setValue('600');
    await wrapper
      .get(
        '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
      )
      .trigger('click');

    const anchorAction = wrapper
      .getComponent(TimelineGridPreview)
      .props('actions')
      .find(action => action.id === 'action-0001');
    const requestedFrame =
      msToFrame(anchorAction.startMs + anchorAction.durationMs) + 60;
    await wrapper
      .find('[data-testid="workbench-add-switch-action"]')
      .trigger('click');
    await settleWorkbenchAsyncPanels();

    const marker = wrapper.get(
      '[data-testid="workbench-timeline-action"][data-switch-event="true"]'
    );
    expect(marker.attributes('data-start-frame')).toBe(String(requestedFrame));
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).not.toContain('自动推迟');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');
  });

  it('renders the fixed team topology and keeps annotations on a system lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind="actor-action"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind="actor-kibo"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind$="curve"]'
      )
    ).toHaveLength(8);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-row"][data-lane-id="actor-101007"]'
        )
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-row"][data-lane-id="actor-109001"]'
        )
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
        )
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-runtime-event-marker"]')
        .exists()
    ).toBe(false);

    await wrapper
      .find('[data-testid="workbench-add-switch-action"]')
      .trigger('click');
    await flushPromises();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('title')
    ).toContain('切换至 寒悠悠');

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-row"][data-lane-id="system"]')
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-row"][data-lane-id="system"]')
        .exists()
    ).toBe(true);
  });

  it('flags overlapping actions on the same timeline lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe(
      '0'
    );
    expect(wrapper.find('[data-testid="workbench-overlap-empty"]').text()).toBe(
      '暂无轨道重叠'
    );

    await addSingleSkillActionFromLibrary(wrapper);
    expect(
      wrapper.findAll('[data-testid="workbench-action-overlap-warning"]')
    ).toHaveLength(0);

    await selectSideInspectorPanel(wrapper, 'properties');
    await wrapper.find('[data-testid="workbench-start-input"]').setValue('500');

    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe(
      '1'
    );
    expect(
      wrapper.findAll('[data-testid="workbench-action-overlap-warning"]')
    ).toHaveLength(2);
    expect(
      wrapper.find('[data-testid="workbench-overlap-item"]').text()
    ).toContain('末音');
    expect(
      wrapper.find('[data-testid="workbench-overlap-item"]').text()
    ).toContain('普通攻击 / 闪击');
    expect(
      wrapper.find('[data-testid="workbench-overlap-item"]').text()
    ).toContain('500-883ms');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
  });

  it('drags actor-bound actions between actor lanes without moving system events', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    stubTimelineGeometry(wrapper);

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');

    await dragTimelineAction(wrapper, 'action-0002', {
      fromY: 20,
      toY: 110,
    });

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: 101003,
    });

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    stubTimelineGeometry(wrapper);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');

    await dragTimelineAction(wrapper, 'action-0003', {
      fromY: 200,
      toY: 110,
    });

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');
  });

  it('edits action ownership from the properties panel and filters skill choices by actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === secondaryCharacterId
    );

    expect(
      wrapper.find('[data-testid="workbench-action-actor-select"]').element
        .value
    ).toBe('109001');

    await wrapper
      .find('[data-testid="workbench-action-actor-select"]')
      .setValue(String(secondaryCharacterId));

    expect(
      wrapper.find('[data-testid="workbench-action-actor-select"]').element
        .value
    ).toBe(String(secondaryCharacterId));
    expect(
      wrapper.find('[data-testid="workbench-skill-select"]').element.value
    ).toBe(String(secondarySkills[0].id));
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-runtime-event-marker"]')
        .exists()
    ).toBe(false);

    const optionValues = Array.from(
      wrapper.find('[data-testid="workbench-skill-select"]').element.options
    ).map(option => Number(option.value));
    expect(optionValues).toEqual(secondarySkills.map(skill => skill.id));

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[0]).toMatchObject({
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="workbench-action-actor-readonly"]').element
        .value
    ).toBe('系统 / 事件轨');
  });

  it('uses the action library actor context for new and copied actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === secondaryCharacterId
    );

    expect(
      findActionLibraryActorButton(wrapper, 109001).attributes('data-active')
    ).toBe('true');

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger(
      'click'
    );
    expect(
      findActionLibraryActorButton(wrapper, secondaryCharacterId).attributes(
        'data-active'
      )
    ).toBe('true');

    await addSingleSkillActionFromLibrary(wrapper);

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      wrapper.find('[data-testid="workbench-skill-select"]').element.value
    ).toBe(String(secondarySkills[0].id));

    await wrapper
      .findAll('[data-testid="workbench-copy-action"]')[1]
      .trigger('click');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      findActionLibraryActorButton(wrapper, secondaryCharacterId).attributes(
        'data-active'
      )
    ).toBe('true');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    expect(
      findActionLibraryActorButton(wrapper, 109001).attributes('data-active')
    ).toBe('true');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0003',
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });
  });

  it('adds a selected combat action from the action library for the active actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const primarySkills = workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === workbenchSeed.defaults.characterId
    );
    const primaryEntries = getSkillActionCatalog(primarySkills, 1);
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === secondaryCharacterId
    );
    const secondaryEntries = getSkillActionCatalog(secondarySkills, 1);
    const selectedSecondaryEntry =
      secondaryEntries.find(entry => entry.kind === 'star-skill') ??
      secondaryEntries[0];

    expect(
      wrapper
        .findAll('[data-testid="workbench-skill-entry"]')
        .map(entry => entry.attributes('data-action-kind'))
    ).toEqual(primaryEntries.map(entry => entry.kind));

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger(
      'click'
    );

    expect(
      wrapper
        .findAll('[data-testid="workbench-skill-entry"]')
        .map(entry => entry.attributes('data-action-kind'))
    ).toEqual(secondaryEntries.map(entry => entry.kind));
    expect(
      findActionLibraryEntry(wrapper, selectedSecondaryEntry.kind).exists()
    ).toBe(true);

    await addSkillActionFromLibrary(wrapper, selectedSecondaryEntry.kind);

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      wrapper.find('[data-testid="workbench-skill-select"]').element.value
    ).toBe(String(selectedSecondaryEntry.skillId));
    expect(
      wrapper.find('[data-testid="workbench-level-input"]').element.value
    ).toBe('1');
    expect(wrapper.text()).toContain(selectedSecondaryEntry.label);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: selectedSecondaryEntry.skillId,
      level: 1,
    });
  });

  it('inserts new actions after the selected action instead of the global tail', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger(
      'click'
    );
    const secondaryEntry = await addSkillActionFromLibrary(wrapper);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts.map(action => action.id)).toEqual([
      'action-0001',
      'action-0003',
      'action-0002',
    ]);
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0003',
      type: 'annotation',
      startMs: 2000,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: secondaryEntry.skillId,
      startMs: 2000,
    });
  });

  it('pushes actor actions to the next same-lane slot while allowing cross-lane time sharing', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;

    await addSingleSkillActionFromLibrary(wrapper);
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger(
      'click'
    );
    await addSkillActionFromLibrary(wrapper);

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await findActionLibraryActorButton(
      wrapper,
      workbenchSeed.defaults.characterId
    ).trigger('click');
    await addSingleSkillActionFromLibrary(wrapper);

    await selectSideInspectorPanel(wrapper, 'properties');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('3383.333333');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).toContain('自动推迟：同轨已有动作占用，已从 2000ms 调整到 3383.333333ms。');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');
    expect(
      wrapper.findAll('[data-testid="workbench-action-insert-delay-badge"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="workbench-action-insert-delay-note"]').text()
    ).toContain('自动推迟 2000ms -> 3383.333333ms');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('末音');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('闪击');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('2000ms -> 3383ms');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts.map(action => action.id)).toEqual([
      'action-0001',
      'action-0003',
      'action-0002',
      'action-0004',
    ]);
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      actorCharacterId: secondaryCharacterId,
      startMs: 2000,
      insertion: null,
    });
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0004')
    ).toMatchObject({
      actorCharacterId: workbenchSeed.defaults.characterId,
      startMs: 3383.333333,
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 3383.333333,
        delayedByMs: 1383.333333,
        laneId: 'actor-109001',
        reason: 'same-lane-conflict',
        conflictActionIds: ['action-0002'],
      },
    });
  });

  it('keeps annotations and enemy events on separate timeline lanes', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-add-enemy-event-action"]')
      .trigger('click');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('enemy-events');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts.map(action => action.id)).toEqual([
      'action-0001',
      'action-0003',
      'action-0002',
    ]);
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0003',
      type: 'enemyEvent',
      startMs: 2000,
      insertion: null,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0002',
      type: 'annotation',
      startMs: 2000,
    });
  });

  it('adds, rebinds, logs, and persists tracking-only kibo events', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    await selectLoadoutFromTimeline(wrapper, 109001, 'kiboId', 500001);

    await wrapper
      .find('[data-testid="workbench-add-kibo-event-action"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('奇波事件');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('kibo-team-slot-1');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .text()
    ).toContain('迅风刃');

    await wrapper
      .find('[data-testid="workbench-enemy-event-type-input"]')
      .setValue('awakening');
    await wrapper
      .find('[data-testid="workbench-action-actor-select"]')
      .setValue('101003');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('kibo-team-slot-2');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.text()).toContain('KIBO_EVENT');
    expect(wrapper.text()).toContain('awakening');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft).toMatchObject({ schemaVersion: 17 });
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0002')
    ).toMatchObject({
      type: 'kiboEvent',
      actorCharacterId: 101003,
      skillId: 50000102,
      durationMs: 1416.666667,
      eventType: 'awakening',
      name: '迅风刃',
      timingSource: 'skill-control-player-action-range',
      needsTimingData: false,
    });
  });

  it('moves one actor action and kibo group as an atomic cross-lane edit', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    await selectLoadoutFromTimeline(wrapper, 109001, 'kiboId', 500001);

    await wrapper
      .find('[data-testid="workbench-add-kibo-event-action"]')
      .trigger('click');
    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await wrapper
      .find('.action-item[data-action-id="action-0002"]')
      .trigger('click', { ctrlKey: true });
    await wrapper
      .find('[data-testid="workbench-timeline-create-relations"]')
      .trigger('click');
    await wrapper
      .find(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .trigger('click');
    await nextTick();

    const firstStartMs = Number(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .attributes('data-start-ms')
    );
    wrapper
      .findComponent(TimelineGridPreview)
      .vm.$emit('move-selected-actions', {
        actionIds: ['action-0001'],
        primaryActionId: 'action-0001',
        offsetMs: frameToMs(12),
        targetLaneId: 'actor-101003',
      });
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .attributes()
    ).toMatchObject({
      'data-lane-id': 'actor-101003',
      'data-selected': 'true',
    });
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes()
    ).toMatchObject({
      'data-lane-id': 'kibo-team-slot-2',
      'data-selected': 'true',
    });
    expect(
      Number(
        wrapper
          .find(
            '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
          )
          .attributes('data-start-ms')
      )
    ).toBeCloseTo(firstStartMs + frameToMs(12), 4);
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('1');

    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('kibo-team-slot-1');
    expect(
      Number(
        wrapper
          .find(
            '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
          )
          .attributes('data-start-ms')
      )
    ).toBe(firstStartMs);

    await wrapper.find('[data-testid="workbench-redo-edit"]').trigger('click');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('kibo-team-slot-2');
    expect(
      wrapper.find('main.workbench').attributes('data-action-relation-count')
    ).toBe('1');
  });

  it('keeps the timeline frame cursor synchronized with runtime curves and logs', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const hpBreakpoint = wrapper.get(
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"] [data-testid="workbench-timeline-state-curve-node"]'
    );
    const runtimeStatePointId = hpBreakpoint.attributes('data-state-point-id');
    const runtimeFrameIndex = hpBreakpoint.attributes('data-frame-index');
    expect(runtimeStatePointId).toBeTruthy();

    await hpBreakpoint.trigger('click');
    await nextTick();
    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-timeline-cursor-frame-index': runtimeFrameIndex,
    });
    expect(
      wrapper
        .get('[data-testid="workbench-timeline-grid-preview"]')
        .attributes('data-flow-selected-state-curve-point-id')
    ).toBe(runtimeStatePointId);

    const timelineLane = wrapper.get('[data-testid="workbench-timeline-lane"]');
    timelineLane.element.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 2880,
      bottom: 600,
      width: 2880,
      height: 600,
      toJSON: () => ({}),
    });
    timelineLane.element.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: 360,
        clientY: 300,
      })
    );
    await nextTick();
    expect(
      wrapper
        .get('main.workbench')
        .attributes('data-timeline-cursor-frame-index')
    ).toBe('900');
    expect(
      wrapper
        .get('[data-testid="workbench-timeline-grid-preview"]')
        .attributes('data-flow-selected-state-curve-point-id')
    ).toBe('');

    await selectRuntimeReviewTab(wrapper, 'event');
    const runtimeLogRow = wrapper.find(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${runtimeStatePointId}"]`
    );
    expect(runtimeLogRow.exists()).toBe(true);
    await runtimeLogRow.trigger('click');
    await nextTick();
    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-timeline-cursor-frame-index': runtimeFrameIndex,
    });
    wrapper.unmount();
  });

  it('plays, pauses, and steps the controlled 60fps timeline cursor', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const workbench = wrapper.get('main.workbench');
    const stepForward = wrapper.get(
      '[data-testid="workbench-timeline-step-forward"]'
    );
    const stepBackward = wrapper.get(
      '[data-testid="workbench-timeline-step-backward"]'
    );
    const playbackToggle = wrapper.get(
      '[data-testid="workbench-timeline-playback-toggle"]'
    );

    await stepForward.trigger('click');
    expect(workbench.attributes('data-timeline-cursor-frame-index')).toBe('1');
    await stepBackward.trigger('click');
    expect(workbench.attributes('data-timeline-cursor-frame-index')).toBe('0');

    await wrapper
      .get('[data-testid="workbench-timeline-playback-rate"]')
      .setValue('2');
    expect(workbench.attributes('data-timeline-playback-rate')).toBe('2');

    await playbackToggle.trigger('click');
    expect(workbench.attributes('data-timeline-playback-running')).toBe('true');
    await playbackToggle.trigger('click');
    expect(workbench.attributes('data-timeline-playback-running')).toBe(
      'false'
    );
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.findComponent(EventLogPanel).props('cursorFrameIndex')).toBe(
      0
    );
    wrapper.unmount();
  });

  it('cleans the auto-delay note line when the note is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await selectSideInspectorPanel(wrapper, 'properties');
    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue(
        '手写备注\n自动推迟：同轨已有动作占用，已从 2000ms 调整到 3383.333333ms。'
      );

    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).toBe('手写备注');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      note: '手写备注',
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 3383.333333,
      },
    });
  });

  it('clears stale auto-delay metadata when the delayed start time is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await selectSideInspectorPanel(wrapper, 'properties');
    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('4500');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('4500');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).not.toContain('自动推迟');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');
    expect(
      wrapper.findAll('[data-testid="workbench-action-insert-delay-badge"]')
    ).toHaveLength(0);
    expect(
      wrapper
        .find('[data-testid="workbench-action-insert-delay-note"]')
        .exists()
    ).toBe(false);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      startMs: 4500,
      note: expect.stringContaining('闪击：'),
      insertion: null,
    });
  });

  it('clears stale auto-delay metadata when the delayed duration is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('3600');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await selectSideInspectorPanel(wrapper, 'properties');
    await wrapper
      .find('[data-testid="workbench-duration-input"]')
      .setValue('1200');

    expect(
      wrapper.find('[data-testid="workbench-duration-input"]').element.value
    ).toBe('1200');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).not.toContain('自动推迟');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      type: 'wait',
      durationMs: 1200,
      note: '等待窗口',
      insertion: null,
    });
  });

  it('clears stale auto-delay metadata when the delayed action is dragged to another lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    stubTimelineGeometry(wrapper);
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await dragTimelineAction(wrapper, 'action-0003', {
      fromY: 20,
      toY: 110,
    });

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    await selectSideInspectorPanel(wrapper, 'properties');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).not.toContain('自动推迟');
    await selectSideInspectorPanel(wrapper, 'analysis');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      actorCharacterId: 101003,
      note: expect.stringContaining('闪击：'),
      insertion: null,
    });
  });

  it('keeps generated action ids unique after deleting the first action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await addSingleSkillActionFromLibrary(wrapper);
    await wrapper
      .findAll('[data-testid="workbench-delete-action"]')[0]
      .trigger('click');
    await addSingleSkillActionFromLibrary(wrapper);

    const actionIds = wrapper
      .findAll('.action-item')
      .map(action => action.attributes('data-action-id'));
    expect(actionIds).toEqual(['action-0002', 'action-0003']);
    expect(new Set(actionIds).size).toBe(actionIds.length);
  });

  it('drags a timeline action and snaps its start time', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const lane = wrapper.find(
      '[data-testid="workbench-timeline-lane"]'
    ).element;
    lane.getBoundingClientRect = () => ({
      width: 2880,
      height: 210,
      left: 0,
      right: 2880,
      top: 0,
      bottom: 210,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
    });
    Object.defineProperty(pointerDown, 'pointerId', { value: 1 });
    wrapper
      .find('[data-testid="workbench-timeline-action"]')
      .element.dispatchEvent(pointerDown);
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 182.8 }));
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 182.8 }));
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('3450');
    expect(wrapper.text()).toContain('3450ms');
    await selectRuntimeReviewTab(wrapper, 'event');
    expect(wrapper.text()).toContain('DAMAGE_PROJECTED');
  });

  it('zooms the timeline and resizes an action duration from the timeline', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const lane = wrapper.find(
      '[data-testid="workbench-timeline-lane"]'
    ).element;
    lane.getBoundingClientRect = () => ({
      width: 5760,
      height: 210,
      left: 0,
      right: 5760,
      top: 0,
      bottom: 210,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    await wrapper
      .find('[data-testid="workbench-timeline-zoom-input"]')
      .setValue('2');
    expect(
      wrapper.find('[data-testid="workbench-timeline-zoom-value"]').text()
    ).toBe('2x');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-lane"]')
        .attributes('style')
    ).toContain('width: 5760px');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-scale-track"]')
        .attributes('style')
    ).toContain('width: 5760px');

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    const handle = wrapper.find(
      '[data-testid="workbench-action-duration-handle"][data-action-id="action-0002"]'
    ).element;
    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
    });
    Object.defineProperty(pointerDown, 'pointerId', { value: 2 });
    handle.dispatchEvent(pointerDown);
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 196 }));
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 196 }));
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('等待动作');
    expect(
      wrapper.find('[data-testid="workbench-duration-input"]').element.value
    ).toBe('3000');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
  });

  it('edits a character special-resource baseline through history and draft restore', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    workbenchMechanicsProfileMockState.useVerifiedProfile = true;
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await selectCharacterFromTimeline(wrapper, 0, 103002);
    await settleWorkbenchAsyncPanels();

    const resourceIdentity = 'actor:103002:element:103002047';
    const specialResourceInput = () =>
      wrapper.get(
        `[data-testid="workbench-timeline-initial-special-resource-input"][data-character-id="103002"][data-resource-identity="${resourceIdentity}"]`
      );
    const runtimeCurve = () =>
      wrapper
        .findComponent(TimelineGridPreview)
        .props('runtimeStateCurves')
        .resources.curvesBySpecialResource.find(
          curve =>
            curve.actorId === 'actor-103002' &&
            curve.resourceIdentity === resourceIdentity
        );

    expect(specialResourceInput().attributes()).toMatchObject({
      min: '0',
      max: '12',
      step: '1',
    });
    expect(specialResourceInput().element.value).toBe('0');
    expect(runtimeCurve()).toMatchObject({
      initialValue: 0,
      maxValue: 12,
      inputStep: 1,
      scenarioConfigurable: true,
    });

    const historyCountBeforeEdit = Number(
      wrapper
        .get('[data-testid="workbench-undo-edit"]')
        .attributes('data-history-count')
    );
    await specialResourceInput().setValue('6');
    await specialResourceInput().trigger('blur');
    await nextTick();
    expect(specialResourceInput().element.value).toBe('6');
    expect(runtimeCurve().initialValue).toBe(6);
    expect(
      Number(
        wrapper
          .get('[data-testid="workbench-undo-edit"]')
          .attributes('data-history-count')
      )
    ).toBe(historyCountBeforeEdit + 1);
    expect(
      wrapper
        .findComponent(TimelineGridPreview)
        .emitted('update-initial-energy')
        ?.at(-1)?.[0]
    ).toMatchObject({
      ownerKind: 'special-resource',
      actorId: 'actor-103002',
      characterId: 103002,
      resourceIdentity,
      currentValue: 6,
      maxValue: 12,
      inputStep: 1,
    });

    await specialResourceInput().setValue('6.5');
    await specialResourceInput().trigger('blur');
    expect(specialResourceInput().element.value).toBe('6');
    expect(runtimeCurve().initialValue).toBe(6);

    await specialResourceInput().setValue('20');
    await specialResourceInput().trigger('blur');
    await nextTick();
    expect(specialResourceInput().element.value).toBe('12');
    expect(runtimeCurve().initialValue).toBe(12);
    await wrapper.get('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(specialResourceInput().element.value).toBe('6');
    await wrapper.get('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(specialResourceInput().element.value).toBe('0');
    await wrapper.get('[data-testid="workbench-redo-edit"]').trigger('click');
    await nextTick();
    expect(specialResourceInput().element.value).toBe('6');

    await wrapper.get('[data-testid="workbench-save-draft"]').trigger('click');
    const saved = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(saved.initialRuntimeState.specialResourcesByActor).toEqual([
      expect.objectContaining({
        actorId: 'actor-103002',
        characterId: 103002,
        resourceIdentity,
        currentValue: 6,
        maxValue: 12,
        inputStep: 1,
        scenarioConfigurable: true,
        baselineStatus: 'scenario-configurable-initial-state',
      }),
    ]);
    wrapper.unmount();

    const restored = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    expect(
      restored
        .get(
          `[data-testid="workbench-timeline-initial-special-resource-input"][data-character-id="103002"][data-resource-identity="${resourceIdentity}"]`
        )
        .element.value
    ).toBe('6');
    expect(
      restored
        .findComponent(TimelineGridPreview)
        .props('runtimeStateCurves')
        .resources.curvesBySpecialResource.find(
          curve => curve.resourceIdentity === resourceIdentity
        ).initialValue
    ).toBe(6);
  }, 30000);

  it('saves, restores, and resets a versioned workbench draft', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    await addSingleSkillActionFromLibrary(wrapper);
    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('2400');
    await selectEnemyInspector(wrapper);
    await wrapper
      .find('[data-testid="workbench-enemy-level-input"]')
      .setValue('95');
    await selectLoadoutFromTimeline(wrapper, 109001, 'kiboId', 500001);
    await selectLoadoutFromTimeline(wrapper, 109001, 'weapon', 1010111);
    await selectLoadoutFromTimeline(wrapper, 109001, 'soulessenceId', 10001);
    await selectActorInspector(wrapper, 109001);
    const teamLoadoutPanel = wrapper.findComponent(TeamLoadoutPanel);
    const initialSpInput = teamLoadoutPanel.find(
      '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
    );
    expect(initialSpInput.attributes()).toMatchObject({
      min: '0',
      max: '100',
      step: '1',
    });
    const timelineActorEnergyInput = () =>
      wrapper.get(
        '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="109001"]'
      );
    const timelineKiboEnergyInput = () =>
      wrapper.get(
        '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="kibo"][data-team-slot-id="team-slot-1"][data-kibo-id="500001"]'
      );
    expect(timelineActorEnergyInput().element.value).toBe('0');
    expect(timelineKiboEnergyInput().element.value).toBe('0');
    await timelineActorEnergyInput().setValue('50');
    await timelineActorEnergyInput().trigger('blur');
    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    expect(timelineActorEnergyInput().element.value).toBe('0');
    await wrapper.find('[data-testid="workbench-redo-edit"]').trigger('click');
    expect(timelineActorEnergyInput().element.value).toBe('50');
    const historyCountBeforeKiboEdit = Number(
      wrapper
        .find('[data-testid="workbench-undo-edit"]')
        .attributes('data-history-count')
    );
    await timelineKiboEnergyInput().setValue('50');
    await timelineKiboEnergyInput().trigger('blur');
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    expect(
      JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY))
        .initialRuntimeState.kiboEnergyBySlot
    ).toEqual([
      expect.objectContaining({
        slotId: 'team-slot-1',
        kiboId: 500001,
        currentValue: 50,
        maxValue: 100,
      }),
    ]);
    expect(timelineKiboEnergyInput().element.value).toBe('50');
    expect(
      Number(
        wrapper
          .find('[data-testid="workbench-undo-edit"]')
          .attributes('data-history-count')
      )
    ).toBe(historyCountBeforeKiboEdit + 1);
    expect(
      wrapper
        .findComponent(TimelineGridPreview)
        .emitted('update-initial-energy')
        ?.at(-1)?.[0]
    ).toMatchObject({
      ownerKind: 'kibo',
      slotId: 'team-slot-1',
      kiboId: 500001,
      currentValue: 50,
      maxValue: 100,
    });
    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    expect(
      wrapper
        .findComponent(TimelineGridPreview)
        .props('runtimeStateCurves')
        .resources.curvesByKibo.find(
          curve =>
            curve.slotId === 'team-slot-1' && Number(curve.kiboId) === 500001
        ).stateMetric.initialValue
    ).toBe(0);
    expect(timelineKiboEnergyInput().element.value).toBe('0');
    expect(timelineActorEnergyInput().element.value).toBe('50');
    await wrapper.find('[data-testid="workbench-redo-edit"]').trigger('click');
    expect(timelineKiboEnergyInput().element.value).toBe('50');
    await wrapper
      .find(
        '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
      )
      .trigger('click');
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');

    const rawDraft = window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY);
    const draft = JSON.parse(rawDraft);
    expect(rawDraft).not.toContain('skillBlocks');
    expect(draft).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      game: 'azur-promilia',
      type: 'workbench-draft',
      enemyConfig: {
        level: 95,
      },
      selectedActionId: 'action-0002',
      actorConfigs: [
        {
          characterId: 109001,
          initialSp: 50,
          loadout: {
            kiboId: 500001,
            equipment: {
              weapon: 1010111,
            },
            soulessenceId: 10001,
          },
        },
        {
          characterId: 101003,
        },
        {
          characterId: 101007,
        },
      ],
      initialRuntimeState: {
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
      },
    });
    expect(draft.actionDrafts).toHaveLength(2);
    expect(draft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      startMs: 2400,
    });
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已保存草稿'
    );
    wrapper.unmount();

    const restored = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已恢复草稿'
    );
    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    await selectSideInspectorPanel(restored, 'properties');
    expect(
      restored.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2400');
    await selectEnemyInspector(restored);
    expect(restored.find('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.95'
    );
    await selectActorInspector(restored, 109001);
    expect(
      restored.find(
        '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
      ).element.value
    ).toBe('50');
    expect(
      restored.get(
        '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="109001"]'
      ).element.value
    ).toBe('50');
    expect(
      restored.get(
        '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="kibo"][data-team-slot-id="team-slot-1"][data-kibo-id="500001"]'
      ).element.value
    ).toBe('50');
    expect(
      getTimelineLoadoutSlot(restored, 109001, 'kiboId').attributes(
        'data-selected-id'
      )
    ).toBe('500001');
    expect(
      getTimelineLoadoutSlot(restored, 109001, 'weapon').attributes(
        'data-selected-id'
      )
    ).toBe('1010111');
    expect(
      getTimelineLoadoutSlot(restored, 109001, 'soulessenceId').attributes(
        'data-selected-id'
      )
    ).toBe('10001');

    await restored
      .find('[data-testid="workbench-reset-draft"]')
      .trigger('click');

    expect(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)).toBeNull();
    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已重置草稿'
    );
    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe(
      '1 action'
    );
    await selectSideInspectorPanel(restored, 'properties');
    expect(
      restored.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('0');
    await selectEnemyInspector(restored);
    expect(restored.find('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.80'
    );
    expect(
      getTimelineLoadoutSlot(restored, 109001, 'kiboId').attributes(
        'data-selected-id'
      )
    ).toBe('');
    const unconfiguredKiboEnergyLane = restored.get(
      '[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-energy-team-slot-1"]'
    );
    expect(unconfiguredKiboEnergyLane.text()).toContain('槽位 1 · 0 / 1');
    expect(
      unconfiguredKiboEnergyLane
        .find('[data-testid="workbench-timeline-initial-energy-input"]')
        .exists()
    ).toBe(false);
    await selectActorInspector(restored, 109001);
    expect(
      restored.find(
        '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
      ).element.value
    ).toBe('');
  });

  it('binds reusable actor and enemy configurations to independent scenarios', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    await selectActorInspector(wrapper, 109001);
    await selectSideInspectorPanel(wrapper, 'configuration');

    const actorSelect = () =>
      wrapper.get(
        '[data-testid="workbench-actor-configuration-select"][data-character-id="109001"]'
      );
    const actorName = () =>
      wrapper.get(
        '[data-testid="workbench-actor-configuration-name"][data-character-id="109001"]'
      );
    const initialSpInput = () =>
      wrapper.get(
        '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
      );
    const enemySelect = () =>
      wrapper.get('[data-testid="workbench-enemy-configuration-select"]');
    const originalActorInstanceId = actorSelect().element.value;
    const originalEnemyInstanceId = enemySelect().element.value;

    await wrapper
      .get(
        '[data-testid="workbench-actor-configuration-duplicate"][data-character-id="109001"]'
      )
      .trigger('click');
    await nextTick();
    const burstActorInstanceId = actorSelect().element.value;
    expect(burstActorInstanceId).not.toBe(originalActorInstanceId);
    expect(actorSelect().findAll('option')).toHaveLength(2);

    await wrapper.get('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    await selectActorInspector(wrapper, 109001);
    await selectSideInspectorPanel(wrapper, 'configuration');
    expect(actorSelect().element.value).toBe(originalActorInstanceId);
    expect(actorSelect().findAll('option')).toHaveLength(1);
    await wrapper.get('[data-testid="workbench-redo-edit"]').trigger('click');
    await nextTick();
    await selectActorInspector(wrapper, 109001);
    await selectSideInspectorPanel(wrapper, 'configuration');
    expect(actorSelect().element.value).toBe(burstActorInstanceId);

    await actorName().setValue('末音爆发配置');
    await selectSideInspectorPanel(wrapper, 'team-loadout');
    await initialSpInput().setValue('0.75');
    await selectSideInspectorPanel(wrapper, 'configuration');
    await wrapper
      .get('[data-testid="workbench-enemy-configuration-duplicate"]')
      .trigger('click');
    await nextTick();
    const challengeEnemyInstanceId = enemySelect().element.value;
    expect(challengeEnemyInstanceId).not.toBe(originalEnemyInstanceId);
    await wrapper
      .get('[data-testid="workbench-enemy-configuration-name"]')
      .setValue('高压敌人配置');
    await selectEnemyInspector(wrapper);
    await wrapper
      .get('[data-testid="workbench-enemy-level-input"]')
      .setValue('95');

    await wrapper
      .get('[data-testid="workbench-scenario-duplicate"]')
      .trigger('click');
    await nextTick();
    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-workspace-scenario-count': '2',
      'data-active-workspace-scenario-id': 'scenario-0002',
    });

    await selectActorInspector(wrapper, 109001);
    await selectSideInspectorPanel(wrapper, 'configuration');
    await actorSelect().setValue(originalActorInstanceId);
    await enemySelect().setValue(originalEnemyInstanceId);
    await nextTick();
    await selectSideInspectorPanel(wrapper, 'team-loadout');
    expect(initialSpInput().element.value).toBe('');
    await selectEnemyInspector(wrapper);
    expect(wrapper.get('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.80'
    );

    await wrapper.get('[data-scenario-id="scenario-0001"]').trigger('click');
    await nextTick();
    await selectActorInspector(wrapper, 109001);
    await selectSideInspectorPanel(wrapper, 'configuration');
    expect(actorSelect().element.value).toBe(burstActorInstanceId);
    expect(enemySelect().element.value).toBe(challengeEnemyInstanceId);
    await selectSideInspectorPanel(wrapper, 'team-loadout');
    expect(initialSpInput().element.value).toBe('0.75');
    await selectEnemyInspector(wrapper);
    expect(wrapper.get('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.95'
    );

    await wrapper.get('[data-testid="workbench-save-draft"]').trigger('click');
    const saved = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(saved.schemaVersion).toBe(WORKBENCH_DRAFT_SCHEMA_VERSION);
    expect(saved.configurationLibrary.schemaVersion).toBe(1);
    expect(
      saved.configurationLibrary.actorInstances.find(
        instance => instance.id === burstActorInstanceId
      )
    ).toMatchObject({
      name: '末音爆发配置',
      characterId: 109001,
      actorConfig: { initialSp: 0.75 },
    });
    expect(
      saved.configurationLibrary.enemyInstances.find(
        instance => instance.id === challengeEnemyInstanceId
      )
    ).toMatchObject({
      name: '高压敌人配置',
      enemyConfig: { level: 95 },
    });
    expect(saved.scenarioWorkspace.activeScenarioId).toBe('scenario-0001');
    const savedScenarioOne = saved.scenarioWorkspace.scenarios.find(
      scenario => scenario.id === 'scenario-0001'
    );
    const savedScenarioTwo = saved.scenarioWorkspace.scenarios.find(
      scenario => scenario.id === 'scenario-0002'
    );
    expect(savedScenarioOne.draft.configurationSelection).toMatchObject({
      actorInstanceIds: expect.arrayContaining([
        { characterId: 109001, instanceId: burstActorInstanceId },
      ]),
      enemyInstanceId: challengeEnemyInstanceId,
    });
    expect(savedScenarioTwo.draft.configurationSelection).toMatchObject({
      actorInstanceIds: expect.arrayContaining([
        { characterId: 109001, instanceId: originalActorInstanceId },
      ]),
      enemyInstanceId: originalEnemyInstanceId,
    });
    wrapper.unmount();
  });

  it('compares a current snapshot and returns from an action difference to editing', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-open-comparison"]')
      .trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    await nextTick();
    document
      .querySelector('[data-testid="workbench-comparison-capture-current"]')
      .click();
    await nextTick();
    expect(
      document.querySelector(
        '[data-testid="workbench-comparison-baseline-source"]'
      ).textContent
    ).toContain('当前快照');

    document
      .querySelector('[data-testid="workbench-comparison-close"]')
      .click();
    await nextTick();
    await wrapper
      .find('[data-testid="workbench-start-frame-input"]')
      .setValue('36');
    await wrapper
      .find('[data-testid="workbench-open-comparison"]')
      .trigger('click');
    await flushPromises();

    const actionRow = document.querySelector(
      '[data-testid="workbench-comparison-action-row"][data-current-action-id="action-0001"]'
    );
    expect(actionRow.dataset.changed).toBe('true');
    actionRow
      .querySelector('[data-testid="workbench-comparison-locate-action"]')
      .click();
    await nextTick();

    expect(
      document.querySelector('[data-testid="workbench-scenario-comparison"]')
    ).toBeNull();
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0001"]')
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-source')
    ).toBe('scenario-comparison');

    wrapper.unmount();
  });

  it('opens a snapshot baseline as an editable workspace scenario', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-open-comparison"]')
      .trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    document
      .querySelector('[data-testid="workbench-comparison-capture-current"]')
      .click();
    document
      .querySelector('[data-testid="workbench-comparison-close"]')
      .click();
    await wrapper
      .find('[data-testid="workbench-start-frame-input"]')
      .setValue('36');
    await wrapper
      .find('[data-testid="workbench-open-comparison"]')
      .trigger('click');
    await flushPromises();

    const actionRow = document.querySelector(
      '[data-testid="workbench-comparison-action-row"][data-baseline-action-id="action-0001"]'
    );
    actionRow
      .querySelector(
        '[data-testid="workbench-comparison-locate-baseline-action"]'
      )
      .click();
    await nextTick();

    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-workspace-scenario-count': '2',
      'data-active-workspace-scenario-id': 'scenario-0002',
    });
    expect(
      wrapper.get('[data-testid="workbench-start-frame-input"]').element.value
    ).toBe('0');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-source')
    ).toBe('scenario-comparison-baseline');

    wrapper.unmount();
  });

  it('manages independent workspace scenarios and compares them without leaving the Workbench', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await vi.dynamicImportSettled();
    await flushPromises();
    await nextTick();

    const workbench = wrapper.get('main.workbench');
    expect(workbench.attributes()).toMatchObject({
      'data-workspace-scenario-count': '1',
      'data-active-workspace-scenario-id': 'scenario-0001',
    });
    await addSingleSkillActionFromLibrary(wrapper);
    await wrapper
      .find('[data-testid="workbench-scenario-rename"]')
      .trigger('click');
    await nextTick();
    const renameInput = wrapper.get(
      '[data-testid="workbench-scenario-rename-input"]'
    );
    await renameInput.setValue('爆发轴');
    await renameInput.trigger('keydown.enter');
    expect(wrapper.get('[data-testid="workbench-scenario-name"]').text()).toBe(
      '爆发轴'
    );

    await wrapper
      .find('[data-testid="workbench-scenario-duplicate"]')
      .trigger('click');
    await nextTick();
    expect(workbench.attributes()).toMatchObject({
      'data-workspace-scenario-count': '2',
      'data-active-workspace-scenario-id': 'scenario-0002',
    });
    expect(wrapper.get('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    await addSingleSkillActionFromLibrary(wrapper);
    expect(wrapper.get('[data-testid="scenario-action-count"]').text()).toBe(
      '3 action'
    );

    await wrapper.get('[data-scenario-id="scenario-0001"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    await wrapper.get('[data-scenario-id="scenario-0002"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-testid="scenario-action-count"]').text()).toBe(
      '3 action'
    );

    await wrapper
      .find('[data-testid="workbench-open-comparison"]')
      .trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    const workspaceBaseline = document.querySelector(
      '[data-testid="workbench-comparison-workspace-scenario"]'
    );
    workspaceBaseline.value = 'scenario-0001';
    workspaceBaseline.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(
      document.querySelector(
        '[data-testid="workbench-comparison-baseline-source"]'
      ).textContent
    ).toContain('爆发轴');
    expect(
      document.querySelectorAll(
        '[data-testid="workbench-comparison-action-row"]'
      ).length
    ).toBe(3);
    document
      .querySelector('[data-testid="workbench-comparison-close"]')
      .click();
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-scenario-delete"]')
      .trigger('click');
    await nextTick();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(workbench.attributes()).toMatchObject({
      'data-workspace-scenario-count': '1',
      'data-active-workspace-scenario-id': 'scenario-0001',
    });
    expect(wrapper.get('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    const saved = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(saved).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      scenarioWorkspace: {
        activeScenarioId: 'scenario-0001',
        scenarios: [{ id: 'scenario-0001', name: '爆发轴' }],
      },
    });

    confirmSpy.mockRestore();
    wrapper.unmount();
  });

  it('creates a truly empty scenario with all six energy axes intact', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    await wrapper
      .get('[data-testid="workbench-scenario-add"]')
      .trigger('click');
    await nextTick();

    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-workspace-scenario-count': '2',
      'data-active-workspace-scenario-id': 'scenario-0002',
    });
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-action"]')
    ).toHaveLength(0);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-runtime-event-marker"]')
    ).toHaveLength(0);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
      )
    ).toHaveLength(3);
    const curves = wrapper.findAll(
      '[data-testid="workbench-timeline-state-curve"]'
    );
    expect(curves).toHaveLength(8);
    curves.forEach(curve => {
      expect(curve.attributes('data-point-count')).toBe('0');
      const points = curve
        .get('[data-testid="workbench-timeline-state-curve-line"]')
        .attributes('points')
        .split(' ')
        .map(point => point.split(',').map(Number));
      expect(points).toHaveLength(2);
      expect(points[0][1]).toBe(points[1][1]);
    });

    await wrapper
      .get('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-action"]')
    ).toHaveLength(1);
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-109001"] [data-testid="workbench-timeline-state-curve"]'
        )
        .attributes('data-point-count')
    ).toBe('1');
  });

  it('returns all state curves to flat lines after deleting the final action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    await wrapper
      .get('[data-testid="workbench-delete-action"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper.findAll('[data-testid="workbench-timeline-action"]')
    ).toHaveLength(0);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-runtime-event-marker"]')
    ).toHaveLength(0);
    const curves = wrapper.findAll(
      '[data-testid="workbench-timeline-state-curve"]'
    );
    expect(curves).toHaveLength(8);
    curves.forEach(curve => {
      expect(curve.attributes('data-point-count')).toBe('0');
      const points = curve
        .get('[data-testid="workbench-timeline-state-curve-line"]')
        .attributes('points')
        .split(' ')
        .map(point => point.split(',').map(Number));
      expect(points[0][1]).toBe(points[1][1]);
    });
  });

  it('switches to a workspace baseline and locates its runtime contribution', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await vi.dynamicImportSettled();
    await flushPromises();
    await nextTick();
    await wrapper
      .find('[data-testid="workbench-scenario-duplicate"]')
      .trigger('click');
    await addSingleSkillActionFromLibrary(wrapper);
    await wrapper
      .find('[data-testid="workbench-open-comparison"]')
      .trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();

    const baselineSelect = document.querySelector(
      '[data-testid="workbench-comparison-workspace-scenario"]'
    );
    baselineSelect.value = 'scenario-0001';
    baselineSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    const baselineAction = document.querySelector(
      '[data-testid="workbench-comparison-action-row"][data-baseline-action-id="action-0001"]'
    );
    baselineAction
      .querySelector(
        '[data-testid="workbench-comparison-locate-baseline-action"]'
      )
      .click();
    await nextTick();

    expect(
      document.querySelector('[data-testid="workbench-scenario-comparison"]')
    ).toBeNull();
    expect(wrapper.get('main.workbench').attributes()).toMatchObject({
      'data-active-workspace-scenario-id': 'scenario-0001',
    });
    expect(
      wrapper
        .find('.action-item[data-action-id="action-0001"]')
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-source')
    ).toBe('scenario-comparison-baseline');

    wrapper.unmount();
  });

  it('adds a cycle boundary, reviews its section, and returns to a contributing action', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await addSingleSkillActionFromLibrary(wrapper);
    const lane = wrapper.get('[data-testid="workbench-timeline-lane"]');
    lane.element.getBoundingClientRect = () => ({
      width: 2880,
      height: 240,
      left: 0,
      right: 2880,
      top: 0,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    await lane.trigger('contextmenu', { clientX: 24, clientY: 80 });
    document
      .querySelector(
        '[data-testid="workbench-action-context-add-cycle-boundary"]'
      )
      .click();
    await vi.dynamicImportSettled();
    await nextTick();

    const workbench = wrapper.get('main.workbench');
    expect(workbench.attributes()).toMatchObject({
      'data-cycle-boundary-count': '1',
      'data-selected-cycle-boundary-id': 'cycle-boundary-0001',
      'data-selected-cycle-section-id': 'cycle-section-02',
    });
    expect(
      wrapper.findAll('[data-testid="workbench-cycle-section-tab"]')
    ).toHaveLength(2);
    expect(
      wrapper
        .get(
          '[data-testid="workbench-cycle-boundary"][data-boundary-id="cycle-boundary-0001"]'
        )
        .attributes('data-time-ms')
    ).toBe('1000');

    const secondActionRow = wrapper.get(
      '[data-testid="workbench-cycle-section-action-row"][data-action-id="action-0002"]'
    );
    await secondActionRow
      .get('[data-testid="workbench-cycle-section-locate-action"]')
      .trigger('click');
    expect(
      wrapper
        .get('.action-item[data-action-id="action-0002"]')
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .get(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-source')
    ).toBe('contribution-window');

    await wrapper.find('[data-testid="workbench-undo-edit"]').trigger('click');
    expect(workbench.attributes('data-cycle-boundary-count')).toBe('0');
    await wrapper.find('[data-testid="workbench-redo-edit"]').trigger('click');
    expect(workbench.attributes('data-cycle-boundary-count')).toBe('1');
    wrapper.unmount();
  });

  it('creates a downstream scenario from a cycle boundary with inherited runtime state', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await addSingleSkillActionFromLibrary(wrapper);
    const originalSecondActionStartMs = Number(
      wrapper
        .get(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-start-ms')
    );
    const lane = wrapper.get('[data-testid="workbench-timeline-lane"]');
    lane.element.getBoundingClientRect = () => ({
      width: 2880,
      height: 240,
      left: 0,
      right: 2880,
      top: 0,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    await lane.trigger('contextmenu', { clientX: 24, clientY: 80 });
    document
      .querySelector(
        '[data-testid="workbench-action-context-add-cycle-boundary"]'
      )
      .click();
    await vi.dynamicImportSettled();
    await nextTick();

    await wrapper
      .get('[data-testid="workbench-create-inherited-scenario"]')
      .trigger('click');
    await vi.dynamicImportSettled();
    await nextTick();
    await nextTick();

    const workbench = wrapper.get('main.workbench');
    expect(workbench.attributes()).toMatchObject({
      'data-workspace-scenario-count': '2',
      'data-active-workspace-scenario-id': 'scenario-0002',
      'data-cycle-boundary-count': '0',
    });
    expect(wrapper.findAll('.action-item')).toHaveLength(1);
    const saved = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(saved.actionDrafts).toEqual([
      expect.objectContaining({
        id: 'action-0002',
        startMs: originalSecondActionStartMs - 1000,
      }),
    ]);
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-start-ms')
    ).toBe(String(originalSecondActionStartMs - 1000));
    expect(
      wrapper.get('[data-testid="workbench-draft-status"]').text()
    ).toContain('已从循环边界创建继承方案');

    expect(saved).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      initialRuntimeState: {
        source: {
          sourceScenarioId: 'scenario-0001',
          boundaryId: 'cycle-boundary-0001',
          boundaryTimeMs: 1000,
        },
        enemy: {
          hp: { baselineStatus: 'baseline-inherited-from-cycle-boundary' },
          toughness: {
            baselineStatus: 'baseline-inherited-from-cycle-boundary',
          },
        },
      },
      scenarioWorkspace: {
        activeScenarioId: 'scenario-0002',
        scenarios: [
          { id: 'scenario-0001' },
          {
            id: 'scenario-0002',
            name: expect.stringContaining('继承'),
            draft: {
              actionDrafts: [
                {
                  id: 'action-0002',
                  startMs: originalSecondActionStartMs - 1000,
                },
              ],
              initialRuntimeState: {
                source: { boundaryId: 'cycle-boundary-0001' },
              },
            },
          },
        ],
      },
    });
    wrapper.unmount();
  });

  it('switches, resizes, resets, and restores the independent Workbench layout', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await vi.dynamicImportSettled();
    await flushPromises();
    await nextTick();

    const workbench = wrapper.get('main.workbench');
    expect(workbench.attributes()).toMatchObject({
      'data-workbench-layout-mode': 'balanced',
      'data-workbench-left-panel-width': '260',
      'data-workbench-right-panel-width': '300',
      'data-workbench-left-panel-collapsed': 'false',
      'data-workbench-right-panel-collapsed': 'false',
    });

    await wrapper
      .get('[data-testid="workbench-layout-mode"][data-layout-mode="edit"]')
      .trigger('click');
    await flushPromises();
    expect(workbench.attributes()).toMatchObject({
      'data-workbench-layout-mode': 'edit',
      'data-workbench-left-panel-collapsed': 'false',
      'data-workbench-right-panel-collapsed': 'true',
    });

    await wrapper
      .get('[data-testid="workbench-layout-mode"][data-layout-mode="review"]')
      .trigger('click');
    await flushPromises();
    expect(workbench.attributes()).toMatchObject({
      'data-workbench-layout-mode': 'review',
      'data-workbench-left-panel-collapsed': 'true',
      'data-workbench-right-panel-collapsed': 'false',
    });

    await wrapper
      .get('[data-testid="workbench-reset-layout"]')
      .trigger('click');
    await flushPromises();
    const grid = wrapper.get('[data-testid="workbench-main-flow-workspace"]');
    grid.element.getBoundingClientRect = () => ({
      width: 1440,
      height: 900,
      left: 0,
      right: 1440,
      top: 0,
      bottom: 900,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    wrapper.get('[data-testid="workbench-left-resizer"]').element.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 260,
      })
    );
    window.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: 324 })
    );
    window.dispatchEvent(
      new MouseEvent('pointerup', { bubbles: true, clientX: 324 })
    );
    await flushPromises();

    expect(workbench.attributes()).toMatchObject({
      'data-workbench-layout-mode': 'balanced',
      'data-workbench-left-panel-width': '324',
      'data-workbench-right-panel-width': '300',
    });
    expect(
      JSON.parse(window.localStorage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY))
    ).toMatchObject({
      schemaVersion: 1,
      leftPanelWidth: 324,
      rightPanelWidth: 300,
    });
    expect(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)).toBeNull();
    wrapper.unmount();

    const restored = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await vi.dynamicImportSettled();
    await flushPromises();
    await nextTick();
    expect(restored.get('main.workbench').attributes()).toMatchObject({
      'data-workbench-layout-mode': 'balanced',
      'data-workbench-left-panel-width': '324',
      'data-workbench-right-panel-width': '300',
    });
    restored.unmount();
  });

  it('inserts a normal attack chain in one transaction and edits sibling inputs independently', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });
    await settleWorkbenchAsyncPanels();

    await findActionLibraryEntry(wrapper, 'normal-attack').trigger('click');
    await nextTick();

    const insertedGroupId = wrapper
      .findAll(
        '[data-testid="workbench-timeline-action"][data-attack-sequence-index="1"]'
      )
      .map(row => row.attributes('data-attack-group-id'))
      .find(groupId => groupId && !groupId.startsWith('legacy-'));
    const groupRows = () =>
      wrapper.findAll(
        `[data-testid="workbench-timeline-action"][data-attack-group-id="${insertedGroupId}"]`
      );

    expect(insertedGroupId).toBeTruthy();
    expect(groupRows()).toHaveLength(5);
    expect(groupRows().map(row => row.get('strong').text())).toEqual([
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
    ]);
    expect(
      wrapper
        .get('[data-testid="workbench-undo-edit"]')
        .attributes('data-history-count')
    ).toBe('1');

    await wrapper.get('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(groupRows()).toHaveLength(0);
    await wrapper.get('[data-testid="workbench-redo-edit"]').trigger('click');
    await nextTick();
    expect(groupRows()).toHaveLength(5);

    const rowsBeforeMove = groupRows();
    const actionIds = Object.fromEntries(
      rowsBeforeMove.map(row => [
        Number(row.attributes('data-attack-sequence-index')),
        row.attributes('data-action-id'),
      ])
    );
    const startsBeforeMove = Object.fromEntries(
      rowsBeforeMove.map(row => [
        row.attributes('data-action-id'),
        Number(row.attributes('data-start-ms')),
      ])
    );
    wrapper.findComponent(TimelineGridPreview).vm.$emit('update-action-time', {
      actionId: actionIds[2],
      startMs: startsBeforeMove[actionIds[2]] + frameToMs(30),
    });
    await nextTick();
    const startsAfterMove = Object.fromEntries(
      groupRows().map(row => [
        row.attributes('data-action-id'),
        Number(row.attributes('data-start-ms')),
      ])
    );
    expect(startsAfterMove[actionIds[2]]).not.toBe(
      startsBeforeMove[actionIds[2]]
    );
    for (const actionId of [
      actionIds[1],
      actionIds[3],
      actionIds[4],
      actionIds[5],
    ]) {
      expect(startsAfterMove[actionId]).toBe(startsBeforeMove[actionId]);
    }

    wrapper
      .findComponent(TimelineGridPreview)
      .vm.$emit('delete-action', actionIds[3]);
    await nextTick();
    expect(groupRows()).toHaveLength(4);
    await selectSideInspectorPanel(wrapper, 'action-rules');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-rule-row"][data-rule-code="attack-input-chain-incomplete"]'
        )
        .exists()
    ).toBe(true);

    await wrapper.get('[data-testid="workbench-undo-edit"]').trigger('click');
    await nextTick();
    expect(groupRows()).toHaveLength(5);
    wrapper.unmount();
    clearInstalledVerifiedCombatMechanicsPackage();
  });

  it('imports, inspects, edits, and rejects Machine Axis through the real Workbench surface', async () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    workbenchMechanicsProfileMockState.useVerifiedProfile = true;
    await import('../../machine-axis/workbenchMachineAxisAdapter');
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await settleWorkbenchAsyncPanels();
    resetWorkbenchPerformanceCounters();

    await wrapper.get('[data-testid="workbench-open-machine-axis"]').trigger('click');
    await settleWorkbenchAsyncPanels();
    expect(getWorkbenchPerformanceCounters()).toMatchObject({
      authoritativeCompile: 0,
      authoritativeSimulation: 0,
    });

    await wrapper
      .get('[data-testid="workbench-machine-axis-load-fixture"]')
      .trigger('click');

    await vi.waitFor(
      () => {
        expect(wrapper.get('main.workbench').attributes()).toMatchObject({
          'data-canonical-trace-hash': '48fbae6c42e7f13d',
          'data-canonical-trace-action-count': '44',
          'data-machine-axis-import-active': 'true',
        });
      },
      { timeout: 30_000 }
    );
    await settleWorkbenchAsyncPanels();

    expect(wrapper.get('[data-testid="machine-axis-summary"]').text()).toContain(
      '机器输入 42'
    );
    expect(wrapper.get('[data-testid="machine-axis-summary"]').text()).toContain(
      '实际执行 44'
    );
    expect(wrapper.get('[data-testid="machine-axis-status"]').text()).toContain(
      '已载入 M11-B 120 秒验收轴'
    );
    expect(
      wrapper.find(
        '[data-testid="workbench-timeline-action"][data-action-id="xunlang-signature"]'
      ).exists()
    ).toBe(true);
    expect(
      wrapper.find(
        '[data-testid="workbench-timeline-action"][data-action-id="ruby-enhanced-e1-intent"]'
      ).exists()
    ).toBe(true);

    await wrapper
      .get('[data-testid="workbench-close-machine-axis"]')
      .trigger('click');
    await wrapper
      .get(
        '[data-testid="workbench-timeline-action"][data-action-id="a3-sampled"]'
      )
      .trigger('click');
    await settleWorkbenchAsyncPanels();
    resetWorkbenchPerformanceCounters();
    await selectSideInspectorPanel(wrapper, 'canonical-trace');
    expect(getWorkbenchPerformanceCounters()).toMatchObject({
      authoritativeCompile: 0,
      authoritativeSimulation: 0,
    });

    const inspector = wrapper.get(
      '[data-testid="workbench-canonical-trace-inspector"]'
    );
    expect(inspector.attributes('data-trace-hash')).toBe('48fbae6c42e7f13d');
    expect(inspector.text()).toContain('control 10100703 / sub 0');
    const hitRow = inspector.get('[data-testid="canonical-trace-hit-row"]');
    const landedSelect = hitRow.get(
      '[data-testid="canonical-trace-hit-landed"]'
    );
    const criticalSelect = hitRow.get(
      '[data-testid="canonical-trace-hit-critical-mode"]'
    );
    expect(landedSelect.element.value).toBe('hit');
    expect(criticalSelect.element.value).toBe('sampled');
    expect(hitRow.text()).toContain('Roll');
    expect(hitRow.text()).toContain('2345');

    resetWorkbenchPerformanceCounters();
    await landedSelect.setValue('miss');
    await vi.waitFor(
      () => {
        expect(
          wrapper
            .get('[data-testid="canonical-trace-hit-landed"]')
            .element.value
        ).toBe('miss');
        expect(
          wrapper.get('main.workbench').attributes('data-canonical-trace-hash')
        ).not.toBe('0d2c57b109dab9ed');
      },
      { timeout: 30_000 }
    );
    expect(getWorkbenchPerformanceCounters()).toMatchObject({
      authoritativeCompile: 1,
      authoritativeSimulation: 1,
    });

    await wrapper.get('[data-testid="workbench-undo-edit"]').trigger('click');
    await vi.waitFor(
      () => {
        expect(
          wrapper.get('main.workbench').attributes('data-canonical-trace-hash')
        ).toBe('48fbae6c42e7f13d');
        expect(
          wrapper.get('[data-testid="canonical-trace-hit-landed"]').element.value
        ).toBe('hit');
      },
      { timeout: 30_000 }
    );

    const projectHashBeforeInvalidImport = wrapper
      .get('main.workbench')
      .attributes('data-canonical-trace-hash');
    const actionIdsBeforeInvalidImport = wrapper
      .findAll('[data-testid="workbench-timeline-action"]')
      .map(action => action.attributes('data-action-id'));
    const invalidContract = structuredClone(machineAxisFixture);
    invalidContract.actions[1].intent.publicActionId = 99999999;
    const invalidFile = new File(
      [JSON.stringify(invalidContract)],
      'invalid-machine-axis.json',
      { type: 'application/json' }
    );
    const fileInput = wrapper.get(
      '[data-testid="workbench-import-project-file"]'
    );
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [invalidFile],
    });
    await fileInput.trigger('change');
    await settleWorkbenchAsyncPanels();

    expect(wrapper.get('[data-testid="machine-axis-status"]').text()).toContain(
      '当前项目保持不变'
    );
    expect(
      wrapper
        .get('[data-testid="machine-axis-import-diagnostics"]')
        .find('[data-diagnostic-code="machine-axis-public-action-unknown"]')
        .exists()
    ).toBe(true);
    expect(
      wrapper.get('main.workbench').attributes('data-canonical-trace-hash')
    ).toBe(projectHashBeforeInvalidImport);
    expect(
      wrapper
        .findAll('[data-testid="workbench-timeline-action"]')
        .map(action => action.attributes('data-action-id'))
    ).toEqual(actionIdsBeforeInvalidImport);
  }, 120_000);
});

function createStateCurvePanelProps() {
  return {
    summary: {
      totalRawDamage: 0,
      formulaVersion: 'test',
      confidence: 'medium',
      projectedHitCount: 0,
      threeValueCurveFrameworkSummary: {
        trackCount: 3,
        candidateTrackCount: 0,
        chartPointCount: 0,
        stateCurvePointCount: 2,
        detailsDeferred: true,
      },
    },
    diagnostics: {
      limitations: [],
    },
    damageTimeline: [],
    actionResultTimeline: [],
    candidateValueSeries: {
      summary: {
        pointCount: 0,
      },
      series: [],
      chart: {
        summary: {
          pointCount: 0,
          displayFrameAdjustmentCount: 0,
        },
        series: [],
      },
    },
    threeValueCurveFramework: {
      stateCurves: {
        summary: {
          pointCount: 2,
        },
        tracks: [
          {
            trackKey: 'selfEnergyChange',
            label: '自身能量变化',
            valueUnit: 'sp',
            pointCount: 1,
            layers: [
              createStateCurveLayer('applied'),
              createStateCurveLayer('candidate'),
              createStateCurveLayer('sampled', {
                pointCount: 1,
                deltaMin: 0.3375,
                deltaMax: 0.3375,
                finalCumulative: 0.3375,
                points: [
                  {
                    sourceKind: 'runtime-recover-sp-applied-sample',
                    eventType: 'recover-sp-applied',
                    actionId: 'action-sample',
                    sourceElementConfigId: 109001081,
                    frameIndex: 12,
                    frameLabel: '0s12f',
                    delta: 0.3375,
                    cumulative: 0.3375,
                    spBefore: 10,
                    spAfter: 10.3375,
                  },
                ],
              }),
              createStateCurveLayer('placeholder'),
            ],
          },
          {
            trackKey: 'enemyHpDamage',
            label: '敌人HP伤害',
            valueUnit: 'raw-damage',
            pointCount: 1,
            layers: [
              createStateCurveLayer('applied'),
              createStateCurveLayer('candidate'),
              createStateCurveLayer('sampled'),
              createStateCurveLayer('placeholder', {
                pointCount: 1,
                deltaMin: 0,
                deltaMax: 0,
                finalCumulative: 0,
                points: [
                  {
                    sourceKind: 'action-result-placeholder',
                    actionId: 'action-placeholder',
                    actionName: '资源动作',
                    frameIndex: 60,
                    frameLabel: '1s0f',
                    delta: 0,
                    cumulative: 0,
                  },
                ],
              }),
            ],
          },
        ],
      },
    },
    insertionDiagnostics: {
      autoDelayedCount: 0,
      autoDelayedItems: [],
    },
    timelineDiagnostics: {
      overlapCount: 0,
      overlaps: [],
    },
  };
}

function getLastDispatchedFlowAction(wrapper, component = AnalysisPanel) {
  const componentWrapper =
    typeof component?.emitted === 'function'
      ? component
      : wrapper.findComponent(component);
  const events = componentWrapper.emitted('dispatch-flow-action') ?? [];
  const lastEvent = events[events.length - 1];
  return lastEvent?.[0] ?? null;
}

function createStateCurveLayer(key, overrides = {}) {
  return {
    key,
    pointCount: 0,
    deltaMin: null,
    deltaMax: null,
    finalCumulative: 0,
    points: [],
    ...overrides,
  };
}

function stubTimelineGeometry(wrapper) {
  const lane = wrapper.find('[data-testid="workbench-timeline-lane"]').element;
  lane.getBoundingClientRect = () => ({
    width: 600,
    height: 240,
    left: 0,
    right: 600,
    top: 0,
    bottom: 240,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  stubLaneRow(wrapper, 'actor-109001', 0, 72);
  stubLaneRow(wrapper, 'actor-101003', 84, 156);
  stubLaneRow(wrapper, 'system', 168, 240);
}

function dispatchWorkbenchKeyboardShortcut(key, options = {}) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    })
  );
}

function stubLaneRow(wrapper, laneId, top, bottom) {
  const row = wrapper.find(
    `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"]`
  );
  if (!row.exists()) {
    return;
  }

  row.element.getBoundingClientRect = () => ({
    width: 600,
    height: bottom - top,
    left: 0,
    right: 600,
    top,
    bottom,
    x: 0,
    y: top,
    toJSON: () => {},
  });
}

async function dragTimelineAction(
  wrapper,
  actionId,
  { fromX = 100, toX = 100, fromY, toY }
) {
  const action = wrapper.find(
    `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
  ).element;
  const pointerDown = new MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: fromX,
    clientY: fromY,
  });
  Object.defineProperty(pointerDown, 'pointerId', {
    value: Number(actionId.replace(/\D/g, '')) || 1,
  });
  action.dispatchEvent(pointerDown);
  await nextTick();
  window.dispatchEvent(
    new MouseEvent('pointermove', { clientX: toX, clientY: toY })
  );
  await nextTick();
  window.dispatchEvent(
    new MouseEvent('pointerup', { clientX: toX, clientY: toY })
  );
  await nextTick();
}

async function createAutoDelayedPrimarySkillAction(wrapper) {
  await addSingleSkillActionFromLibrary(wrapper);
  await wrapper
    .find('.action-item[data-action-id="action-0001"]')
    .trigger('click');
  await addSingleSkillActionFromLibrary(wrapper);
}

function findActionLibraryActorButton(wrapper, characterId) {
  return wrapper.find(
    `[data-testid="workbench-action-library-actor"][data-character-id="${Number(characterId)}"]`
  );
}

function findActionLibrarySkillEntry(wrapper, skillId) {
  return wrapper.find(
    `[data-testid="workbench-skill-entry"][data-skill-id="${Number(skillId)}"]`
  );
}

function findActionLibraryEntry(wrapper, actionKind) {
  return wrapper.find(
    `[data-testid="workbench-skill-entry"][data-action-kind="${actionKind}"]`
  );
}
