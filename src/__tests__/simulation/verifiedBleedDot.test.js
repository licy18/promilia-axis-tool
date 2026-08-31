// 500360 血噬暗影（奇波大招）流血 DoT 回归：
// 派生管线（sync 系数槽修复）→ generation dotCommands → runtime tick 结算。
// 用户规格：每层每 tick 倍率 Lv1-5=520/730/930/1140/1350 基点（5.2%…13.5% 奇波
// 攻击）；公式=层数×奇波ATK×等级倍率/10000；最大 3 层；20000ms；tick 1000ms；
// 首帧执行（timeExeFirstFrame=1）；施加于大招 206 帧；damageType=7；元素 9（暗）；
// ignoreDamageEvent=1。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createDefaultWorkbenchActorConfigs,
  createDefaultWorkbenchTeamSlots,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { createActionExecutionPlan } from '../../simulation/engine/actionExecutionPlan';
import { createActionRuleDiagnostics } from '../../simulation/runtime/actionRuleDiagnostics';
import { createControlledActorTimeline } from '../../simulation/runtime/controlledActorTimeline';
import { createEffectRuntimeTimeline } from '../../simulation/runtime/effectRuntimeTimeline';
import { createVerifiedBattleEffectGeneration } from '../../simulation/mechanics/verifiedBattleEffectGeneration';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';

const BLEED_KIBO_ID = 500360;
const BLEED_SIGNATURE_SKILL_ID = 50036001;
const BLEED_DOT_ELEMENT_ID = 500360303;
const BLEED_ROOT_ELEMENT_ID = 500360301;
const OWNER_CHARACTER_ID = 101003;

function createBleedScenario({ startMs = 0, durationMs = 25000 } = {}) {
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: OWNER_CHARACTER_ID,
    secondaryCharacterId: 101010,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection);
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    [],
    selection,
    teamSlots
  ).map(config =>
    Number(config.characterId) === OWNER_CHARACTER_ID
      ? { ...config, loadout: { ...config.loadout, kiboId: BLEED_KIBO_ID } }
      : config
  );
  const action = createWorkbenchActionDraft({
    id: 'kibo-500360-signature',
    type: 'kiboEvent',
    actorCharacterId: OWNER_CHARACTER_ID,
    kiboId: BLEED_KIBO_ID,
    skillId: BLEED_SIGNATURE_SKILL_ID,
    eventType: 'signature',
    actionVariantIndex: 0,
    controlSubSkillIndex: 0,
    startMs,
    durationMs: 1000,
    needsTimingData: false,
  });
  const project = createWorkbenchProject(selection, {
    durationMs,
    teamSlots,
    actorConfigs,
    actions: [action],
    enemyConfig: {
      level: 80,
      hpMultiplier: 100,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
    },
    combatScenario: {
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical: { policy: 'non-critical' },
    },
    initialRuntimeState: {
      controlledActor: {
        actorId: `actor-${OWNER_CHARACTER_ID}`,
        characterId: OWNER_CHARACTER_ID,
      },
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function runBleedScenario(scenario, { cinematicTimeScaleRuntime = null } = {}) {
  const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
  const actionExecutionPlan = createActionExecutionPlan({
    scenario,
    actionRuleDiagnostics,
  });
  const controlledActorTimeline = createControlledActorTimeline({
    scenario,
    actionExecutionPlan,
  });
  const effectTimeline = createEffectRuntimeTimeline({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    generatedCommands: [],
  });
  const generation = createVerifiedBattleEffectGeneration({
    scenario,
    actionExecutionPlan,
    mechanicsPackage: verifiedCombatMechanicsPackage,
    controlledActorTimeline,
  });
  const runtime = createVerifiedCombatRuntime({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    effectTimeline,
    effectGeneration: generation,
    actionVariantRuntime: cinematicTimeScaleRuntime
      ? { cinematicTimeScaleRuntime }
      : null,
    runtimeMode: 'full',
  });
  return { scenario, generation, runtime };
}

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('500360 血噬暗影 流血 DoT（派生管线 + runtime 结算）', () => {
  it('机制包：500360303 流血系数按等级派生（Lv1-5=520/730/930/1140/1350）', () => {
    const node = verifiedCombatMechanicsPackage.battleEffectCatalog.nodes.find(
      candidate => String(candidate.elementId) === String(BLEED_DOT_ELEMENT_ID)
    );
    expect(node).toMatchObject({
      name: '【正式】流血伤害',
      kind: 'damage',
      damage: { damageType: 7, elementalType: 9 },
    });
    expect(node.formula.baseFunctionId).toBe(116);
    expect(node.formula.baseExpression).toBe(
      'target.ELEMENT_LAYERS[H]*source.ATK[0]*I/10000'
    );
    expect(node.formula.valueByLevel).toMatchObject({
      1: 520,
      2: 730,
      3: 930,
      4: 1140,
      5: 1350,
    });
    expect(node.formula.valueByLevel[1]).not.toBe(0);
    // 根叠层：500360301 combineNumber=3（最大 3 层）
    const rootNode =
      verifiedCombatMechanicsPackage.battleEffectCatalog.nodes.find(
        candidate =>
          String(candidate.elementId) === String(BLEED_ROOT_ELEMENT_ID)
      );
    expect(rootNode.lifecycle.combineNumber).toBe(3);
  });

  it('generation：大招 206 帧产出流血 DoT 命令（1 层、Lv1 倍率 520、20s、tick 1s、首帧执行）', () => {
    const { generation } = runBleedScenario(createBleedScenario());
    expect(generation.dotCommands).toHaveLength(1);
    const dot = generation.dotCommands[0];
    expect(dot).toMatchObject({
      kind: 'verified-battle-effect-dot',
      sourceKiboId: BLEED_KIBO_ID,
      elementId: BLEED_DOT_ELEMENT_ID,
      rootElementId: BLEED_ROOT_ELEMENT_ID,
      damageType: 7,
      elementalType: 9,
      ignoreDamageEvent: true,
      durationMs: 20000,
      tickIntervalMs: 1000,
      timeExeFirstFrame: true,
      maxStacks: 3,
      level: 1,
      ratioAtLevel: 520,
      target: { kind: 'enemy' },
    });
    expect(dot.trigger.startFrame).toBe(206);
    expect(generation.knownGaps).not.toContainEqual(
      expect.objectContaining({ reason: 'periodic-damage-not-implemented' })
    );
  });

  it('runtime：每 1000ms tick 一次（首帧执行），20s 共 20 tick，伤害=层数×奇波ATK×520/10000', () => {
    const { runtime } = runBleedScenario(createBleedScenario());
    const dotEvents = (runtime.damageEvents ?? []).filter(
      event => event.payload?.battleEffectDot === true
    );
    expect(dotEvents).toHaveLength(20);
    // tick 间隔 1000ms（60fps 帧对齐）
    const frames = dotEvents.map(event => event.payload.absoluteFrame);
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index] - frames[index - 1]).toBe(60);
    }
    // 伤害 = 1 层 × 奇波ATK × 520/10000；系数一致且 > 0
    for (const event of dotEvents) {
      expect(event.payload).toMatchObject({
        layers: 1,
        coefficientRaw: 520,
        applied: true,
        appliedToCalculators: true,
        reason: 'battle-effect-dot-applied',
        toughnessDamage: 0,
      });
      expect(event.payload.appliedDamage).toBeGreaterThan(0);
    }
    // 全部 tick 伤害一致（1 层、固定倍率）
    const damages = new Set(
      dotEvents.map(event => event.payload.appliedDamage)
    );
    expect(damages.size).toBe(1);
    // ignoreDamageEvent 标记
    expect(dotEvents[0].payload.ignoreDamageEvent).toBe(true);
  });

  it('runtime：末音大招只暂停敌方流血时钟，不缩短场景墙钟或 DoT 有效 tick 数', () => {
    const { scenario, runtime } = runBleedScenario(
      createBleedScenario({ durationMs: 30000 }),
      {
        cinematicTimeScaleRuntime: {
          scoreClockPolicy: 'wall-time-includes-cinematic-window',
          actionOccupancyPolicy: 'unchanged',
          enemyPauseWindows: [
            {
              startMs: 5000,
              endMs: 7083.333333,
              durationMs: 2083.333333,
            },
          ],
          summary: {
            enemyPauseWindowCount: 1,
            enemyPausedDurationMs: 2083.333333,
          },
        },
      }
    );
    const dotEvents = (runtime.damageEvents ?? []).filter(
      event => event.payload?.battleEffectDot === true
    );
    expect(scenario.time.durationMs).toBe(30000);
    expect(dotEvents).toHaveLength(20);
    const frames = dotEvents.map(event => event.absoluteFrame);
    expect(frames[1] - frames[0]).toBe(60);
    expect(frames[2] - frames[1]).toBe(185);
    expect(
      frames.slice(3).every((frame, index) => frame - frames[index + 2] === 60)
    ).toBe(true);
  });

  it('runtime：3 角色轮切（同奇波各自放招）聚合叠层，层数=累计施加数（cap 3），伤害=层数×首个施加者系数', () => {
    // 3 只角色都装备 500360，各自放奇波大招（间隔 5s）。原生单实例聚合
    // （IsSameElement 只比较 elementConfigId）：层数=累计施加数（cap 3），
    // 首个施加者持有等级系数，共享到期刷新为 max(旧到期, 施加+20s)。
    const baseDot = {
      kind: 'verified-battle-effect-dot',
      sourceActorId: 'actor-101003',
      sourceKiboId: BLEED_KIBO_ID,
      elementId: BLEED_DOT_ELEMENT_ID,
      rootElementId: BLEED_ROOT_ELEMENT_ID,
      damageType: 7,
      elementalType: 9,
      ignoreDamageEvent: true,
      durationMs: 20000,
      tickIntervalMs: 1000,
      timeExeFirstFrame: true,
      maxStacks: 3,
      level: 1,
      ratioAtLevel: 520,
      valueByLevel: { 1: 520 },
      target: { kind: 'enemy', id: 'enemy-1' },
    };
    const mk = (actionId, timeMs) => ({ ...baseDot, actionId, timeMs });
    const scenario = createBleedScenario({ durationMs: 40000 });
    const generation = {
      schemaVersion: 1,
      contractName: 'probe-3-role-rotation',
      status: 'ready',
      applied: true,
      actionResolutionById: new Map(),
      effectCommands: [],
      directSpEvents: [],
      directHpEvents: [],
      shieldEvents: [],
      cooldownReductionEvents: [],
      knownGaps: [],
      unresolved: [],
      dotCommands: [
        mk('kibo-a', 3433.33),
        mk('kibo-b', 8433.33),
        mk('kibo-c', 13433.33),
      ],
      summary: { dotCommandCount: 3, generatedCount: 3, applied: true },
    };
    const runtime = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan: {
        actions: [{ actionId: 'kibo-a', execute: true }],
      },
      effectGeneration: generation,
      runtimeMode: 'full',
    });
    const dotEvents = (runtime.damageEvents ?? []).filter(
      event => event.payload?.battleEffectDot === true
    );
    // 单层伤害基线（与单角色测试一致）
    const singleLayerDamage = dotEvents.find(
      event => event.payload.layers === 1
    )?.payload.appliedDamage;
    expect(singleLayerDamage).toBeGreaterThan(0);
    // 聚合叠层：层数=该时刻前累计施加数（cap 3），伤害按层数线性放大
    const byLayer = new Map();
    for (const event of dotEvents) {
      const layers = event.payload.layers;
      byLayer.set(layers, (byLayer.get(layers) ?? 0) + 1);
      expect(event.payload.appliedDamage).toBe(layers * singleLayerDamage);
    }
    expect([...byLayer.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    // 共享到期：整组持续到 max(施加+20s)=13433+20000=33433ms；
    // 首帧执行 + 每 1000ms → 从 3433ms 到 ~32433ms 共 30 tick。
    expect(dotEvents).toHaveLength(30);
    // 层数单调不减（聚合实例，不按独立窗口衰减）
    const layerSequence = dotEvents.map(event => event.payload.layers);
    for (let index = 1; index < layerSequence.length; index += 1) {
      expect(layerSequence[index]).toBeGreaterThanOrEqual(
        layerSequence[index - 1]
      );
    }
    expect(layerSequence[layerSequence.length - 1]).toBe(3);
  });

  it('runtime：首个施加者持有等级系数（Lv1 先施加、Lv5 后施加 → 2 层仍按 5.2%）', () => {
    const baseDot = {
      kind: 'verified-battle-effect-dot',
      sourceActorId: 'actor-101003',
      sourceKiboId: BLEED_KIBO_ID,
      elementId: BLEED_DOT_ELEMENT_ID,
      rootElementId: BLEED_ROOT_ELEMENT_ID,
      damageType: 7,
      elementalType: 9,
      ignoreDamageEvent: true,
      durationMs: 20000,
      tickIntervalMs: 1000,
      timeExeFirstFrame: true,
      maxStacks: 3,
      target: { kind: 'enemy', id: 'enemy-1' },
    };
    // 首次施加 Lv1（520），5s 后第二次施加 Lv5（1350）：层数 2 但系数
    // 仍取首个施加者 Lv1 的 520。
    const scenario = createBleedScenario({ durationMs: 40000 });
    const generation = {
      schemaVersion: 1,
      contractName: 'probe-owner-level',
      status: 'ready',
      applied: true,
      actionResolutionById: new Map(),
      effectCommands: [],
      directSpEvents: [],
      directHpEvents: [],
      shieldEvents: [],
      cooldownReductionEvents: [],
      knownGaps: [],
      unresolved: [],
      dotCommands: [
        {
          ...baseDot,
          actionId: 'kibo-a',
          timeMs: 3433.33,
          level: 1,
          ratioAtLevel: 520,
          valueByLevel: { 1: 520, 5: 1350 },
        },
        {
          ...baseDot,
          actionId: 'kibo-b',
          timeMs: 8433.33,
          level: 5,
          ratioAtLevel: 1350,
          valueByLevel: { 1: 520, 5: 1350 },
        },
      ],
      summary: { dotCommandCount: 2, generatedCount: 2, applied: true },
    };
    const runtime = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan: {
        actions: [{ actionId: 'kibo-a', execute: true }],
      },
      effectGeneration: generation,
      runtimeMode: 'full',
    });
    const dotEvents = (runtime.damageEvents ?? []).filter(
      event => event.payload?.battleEffectDot === true
    );
    const twoLayer = dotEvents.filter(event => event.payload.layers === 2);
    expect(twoLayer.length).toBeGreaterThan(0);
    for (const event of twoLayer) {
      // 系数固定为首个施加者 Lv1 的 520（而非后施加 Lv5 的 1350）
      expect(event.payload.coefficientRaw).toBe(520);
    }
    const singleLayer = dotEvents.find(event => event.payload.layers === 1);
    expect(singleLayer.payload.coefficientRaw).toBe(520);
  });

  it('runtime：实例到期后再次施加开启新实例（新 owner、层数重置、窗口断裂无伤害间隙）', () => {
    // 0s 施加（窗口到 20s），25s 再施加（窗口断裂 → 新实例）。
    // 20s~25s 之间应无 DoT tick（第一实例已到期）。
    const baseDot = {
      kind: 'verified-battle-effect-dot',
      sourceActorId: 'actor-101003',
      sourceKiboId: BLEED_KIBO_ID,
      elementId: BLEED_DOT_ELEMENT_ID,
      rootElementId: BLEED_ROOT_ELEMENT_ID,
      damageType: 7,
      elementalType: 9,
      ignoreDamageEvent: true,
      durationMs: 20000,
      tickIntervalMs: 1000,
      timeExeFirstFrame: true,
      maxStacks: 3,
      level: 1,
      ratioAtLevel: 520,
      valueByLevel: { 1: 520 },
      target: { kind: 'enemy', id: 'enemy-1' },
    };
    const scenario = createBleedScenario({ durationMs: 50000 });
    const generation = {
      schemaVersion: 1,
      contractName: 'probe-instance-split',
      status: 'ready',
      applied: true,
      actionResolutionById: new Map(),
      effectCommands: [],
      directSpEvents: [],
      directHpEvents: [],
      shieldEvents: [],
      cooldownReductionEvents: [],
      knownGaps: [],
      unresolved: [],
      dotCommands: [
        { ...baseDot, actionId: 'kibo-a', timeMs: 3433.33 },
        { ...baseDot, actionId: 'kibo-b', timeMs: 28433.33 },
      ],
      summary: { dotCommandCount: 2, generatedCount: 2, applied: true },
    };
    const runtime = createVerifiedCombatRuntime({
      scenario,
      actionExecutionPlan: {
        actions: [{ actionId: 'kibo-a', execute: true }],
      },
      effectGeneration: generation,
      runtimeMode: 'full',
    });
    const dotEvents = (runtime.damageEvents ?? []).filter(
      event => event.payload?.battleEffectDot === true
    );
    // 第一实例：3433ms 起 20 tick（到 ~22433ms）；第二实例：28433ms 起 20 tick。
    // 中间 ~22433ms 到 ~28433ms 无 tick。
    expect(dotEvents).toHaveLength(40);
    const firstInstanceFrames = dotEvents
      .filter(event => event.timeMs < 28433.33)
      .map(event => event.timeMs);
    expect(firstInstanceFrames).toHaveLength(20);
    // 第一实例末 tick 约 22433ms，第二实例首 tick 约 28433ms —— 无重叠
    const gapStart = Math.max(...firstInstanceFrames);
    const secondStart = Math.min(
      ...dotEvents
        .filter(event => event.timeMs >= 28433.33)
        .map(event => event.timeMs)
    );
    expect(secondStart - gapStart).toBeGreaterThan(5000);
    // 两实例各自从 1 层开始（新实例 owner/层数重置）
    const firstLayers = new Set(
      dotEvents
        .filter(event => event.timeMs < 28433.33)
        .map(event => event.payload.layers)
    );
    expect(firstLayers).toEqual(new Set([1]));
  });
});
