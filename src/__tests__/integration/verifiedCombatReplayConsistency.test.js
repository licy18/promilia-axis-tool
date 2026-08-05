import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionInputMapping,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchDraftSnapshot,
  createWorkbenchProjectShareCode,
  loadWorkbenchDraft,
  parseWorkbenchProjectFile,
  parseWorkbenchProjectShareCode,
  saveWorkbenchDraft,
  serializeWorkbenchProjectFile,
} from '../../domain/workbenchDraftStorage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import { createWorkbenchAttackInputChainDrafts } from '../../domain/workbenchAttackInputChain';
import {
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import {
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
  parseWorkbenchProjectPng,
} from '../../domain/workbenchPngProject';
import { duplicateWorkbenchScenario } from '../../domain/workbenchScenarioWorkspace';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { projectTimelineStateDisplaySeries } from '../../simulation/projection/projectTimelineStateDisplaySeries';
import { projectTimelineOperationInputs } from '../../simulation/projection/projectTimelineOperationInputs';
import { frameToMs } from '../../domain/timebase';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const EXPORTED_AT = '2026-07-18T08:00:00.000Z';
const PANGPANG_ATTACK_INPUT = verifiedCombatMechanicsPackage.actionMappings
  .find(
    mapping =>
      mapping.ownerId === 101007 && mapping.actionKind === 'normal-attack'
  )
  .attackInputSegments.find(segment => segment.sequenceIndex === 3);

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified combat project replay consistency', () => {
  it('rebuilds the same verified eight-curve result from scenario copy, local draft, JSON, share link and PNG', async () => {
    const source = createVerifiedReplayDraft();
    const duplicated = duplicateWorkbenchScenario(
      source.scenarioWorkspace,
      source.scenarioWorkspace.activeScenarioId,
      source
    );
    const storage = createMemoryStorage();
    saveWorkbenchDraft(storage, source);
    const local = loadWorkbenchDraft(storage);
    const json = parseWorkbenchProjectFile(
      serializeWorkbenchProjectFile(source, EXPORTED_AT)
    );
    const share = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(source, EXPORTED_AT)
    );
    const png = await embedWorkbenchProjectInPng(
      new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')),
      createWorkbenchProjectPngMetadata(source, EXPORTED_AT)
    );
    const pngDraft = await parseWorkbenchProjectPng(png);
    const signatures = [
      createVerifiedReplaySignature(duplicated.scenario.draft),
      createVerifiedReplaySignature(local),
      createVerifiedReplaySignature(json),
      createVerifiedReplaySignature(share),
      createVerifiedReplaySignature(pngDraft),
    ];

    expect(duplicated.changed).toBe(true);
    expect(signatures[0]).toMatchObject({
      profileId: 'azpr-three-value-verified-tc-20260718',
      topology: {
        actorActionLaneCount: 3,
        kiboLaneCount: 3,
        stateCurveCount: 8,
      },
      bindingIdentities: [
        'actor|101007|10100701|0|10100703|attack-input-3|execution-control:10100703|sub:0',
        'kibo|500469|50046903|0|50046903|execution-control:50046903|sub:0',
      ],
      hitEventCount: 6,
      breakTriggerCount: 1,
      breakExitCount: 1,
      actorCurveCount: 3,
      kiboCurveCount: 3,
      appliedKiboIds: [500469],
      spUnitSignature: {
        actorMaximums: [100, 100, 100],
        kiboMaximums: [100],
        heavyCost: [100, -100, 0],
      },
      operationInputSignature: [
        ['verified-replay-pangpang', 'normal-attack', 'press', 'LMB', 0, null],
        ['verified-replay-kibo', 'kibo-skill', 'press', 'Q', 1000, null],
      ],
    });
    expect(signatures[0].damageEventCount).toBeGreaterThan(6);
    expect(signatures[0].stateEventKinds).toEqual(
      expect.arrayContaining([
        'break-linear-recovery',
        'break-end-wait',
        'break-exit',
      ])
    );
    for (const signature of signatures.slice(1)) {
      expect(signature).toEqual(signatures[0]);
    }
  });

  it('preserves cross-catalog actor, action-kind, and kibo bindings across all project carriers', async () => {
    const source = createCrossCatalogReplayDraft();
    const duplicated = duplicateWorkbenchScenario(
      source.scenarioWorkspace,
      source.scenarioWorkspace.activeScenarioId,
      source
    );
    const storage = createMemoryStorage();
    saveWorkbenchDraft(storage, source);
    const local = loadWorkbenchDraft(storage);
    const json = parseWorkbenchProjectFile(
      serializeWorkbenchProjectFile(source, EXPORTED_AT)
    );
    const share = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(source, EXPORTED_AT)
    );
    const png = await embedWorkbenchProjectInPng(
      new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')),
      createWorkbenchProjectPngMetadata(source, EXPORTED_AT)
    );
    const pngDraft = await parseWorkbenchProjectPng(png);
    const signatures = [
      createVerifiedReplaySignature(duplicated.scenario.draft),
      createVerifiedReplaySignature(local),
      createVerifiedReplaySignature(json),
      createVerifiedReplaySignature(share),
      createVerifiedReplaySignature(pngDraft),
    ];

    expect(signatures[0].bindingIdentities).toEqual([
      'actor|101003|10100312|0|10100312|execution-control:10100312|sub:0',
      'actor|101007|10100712|2|10100726|execution-control:10100726|sub:0',
      'actor|109001|10900101|1|10900110|execution-control:10900110|sub:0',
      'kibo|500001|50000112|0|50000112|execution-control:50000112|sub:0',
      'kibo|500001|504004|0|504004|execution-control:504004|sub:0',
    ]);
    expect(
      Object.fromEntries(
        [
          'verified-replay-han-star',
          'verified-replay-pangpang-combo',
          'verified-replay-muyin-charged',
          'verified-replay-wind-kibo',
          'verified-replay-wind-kibo-combo',
        ].map(actionId => [
          actionId,
          signatures[0].damageSignature.filter(event => event[0] === actionId)
            .length,
        ])
      )
    ).toEqual({
      'verified-replay-han-star': 8,
      'verified-replay-pangpang-combo': 2,
      'verified-replay-muyin-charged': 3,
      'verified-replay-wind-kibo': 1,
      'verified-replay-wind-kibo-combo': 1,
    });
    expect(signatures[0]).toMatchObject({
      actorCurveCount: 3,
      kiboCurveCount: 3,
      appliedKiboIds: [500001],
      topology: {
        actorActionLaneCount: 3,
        kiboLaneCount: 3,
        stateCurveCount: 8,
      },
      actionRelationSignature: [
        [
          'simultaneous',
          'verified-replay-pangpang-combo',
          'verified-replay-wind-kibo-combo',
          0,
        ],
      ],
      operationInputSignature: [
        ['verified-replay-han-star', 'skill', 'press', 'E', 0, null],
        [
          'verified-replay-muyin-charged',
          'charged-attack',
          'hold',
          'LMB',
          2800,
          3050,
        ],
        [
          'verified-replay-pangpang-combo',
          'joint-attack',
          'press',
          'F',
          7400,
          null,
        ],
      ],
      tuningMarkEventCount: expect.any(Number),
      tuningMarkCurveCount: expect.any(Number),
    });
    expect(signatures[0].tuningMarkEventCount).toBeGreaterThan(0);
    expect(signatures[0].tuningMarkCurveCount).toBeGreaterThan(0);
    for (const signature of signatures.slice(1)) {
      expect(signature).toEqual(signatures[0]);
    }
  });

  it('preserves every independent A block and edit across all five project carriers', async () => {
    const source = createAttackInputReplayDraft();
    const duplicated = duplicateWorkbenchScenario(
      source.scenarioWorkspace,
      source.scenarioWorkspace.activeScenarioId,
      source
    );
    const storage = createMemoryStorage();
    saveWorkbenchDraft(storage, source);
    const local = loadWorkbenchDraft(storage);
    const json = parseWorkbenchProjectFile(
      serializeWorkbenchProjectFile(source, EXPORTED_AT)
    );
    const share = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(source, EXPORTED_AT)
    );
    const png = await embedWorkbenchProjectInPng(
      new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')),
      createWorkbenchProjectPngMetadata(source, EXPORTED_AT)
    );
    const pngDraft = await parseWorkbenchProjectPng(png);
    const drafts = [duplicated.scenario.draft, local, json, share, pngDraft];
    const actionSignatures = drafts.map(createAttackInputActionSignature);
    const runtimeSignatures = drafts.map(createVerifiedReplaySignature);

    expect(actionSignatures[0]).toHaveLength(5);
    expect(actionSignatures[0].map(action => action.sequenceIndex)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(actionSignatures[0][1].startMs).not.toBe(
      actionSignatures[0][0].startMs + actionSignatures[0][0].durationMs
    );
    expect(actionSignatures[0][2].durationMs).toBe(frameToMs(90));
    expect(runtimeSignatures[0].operationInputSignature).toEqual(
      actionSignatures[0].map(action => [
        action.id,
        'normal-attack',
        'press',
        'LMB',
        action.startMs,
        null,
      ])
    );
    for (const signature of actionSignatures.slice(1)) {
      expect(signature).toEqual(actionSignatures[0]);
    }
    for (const signature of runtimeSignatures.slice(1)) {
      expect(signature).toEqual(runtimeSignatures[0]);
    }
  });

  it('rebuilds the selected variant and special resource curve across all five project carriers', async () => {
    const source = createSpecialResourceReplayDraft();
    const duplicated = duplicateWorkbenchScenario(
      source.scenarioWorkspace,
      source.scenarioWorkspace.activeScenarioId,
      source
    );
    const storage = createMemoryStorage();
    saveWorkbenchDraft(storage, source);
    const local = loadWorkbenchDraft(storage);
    const json = parseWorkbenchProjectFile(
      serializeWorkbenchProjectFile(source, EXPORTED_AT)
    );
    const share = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(source, EXPORTED_AT)
    );
    const png = await embedWorkbenchProjectInPng(
      new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')),
      createWorkbenchProjectPngMetadata(source, EXPORTED_AT)
    );
    const pngDraft = await parseWorkbenchProjectPng(png);
    const signatures = [
      duplicated.scenario.draft,
      local,
      json,
      share,
      pngDraft,
    ].map(createVerifiedReplaySignature);

    expect(signatures[0].variantSelectionSignature).toContainEqual([
      'verified-replay-jade-charged',
      10101010,
      2,
      'verified-active-switch-skill-index-window',
    ]);
    expect(signatures[0].specialResourceEventSignature).toEqual([
      ['verified-replay-jade-ultimate', (264 * 1000) / 60, 'clear', 24, 0],
      ['verified-replay-jade-ultimate', (272 * 1000) / 60, 'transform', 0, 0],
      [
        'verified-replay-jade-ultimate',
        (272 * 1000) / 60 + 10_000,
        'expire',
        0,
        0,
      ],
    ]);
    expect(signatures[0].specialResourceCurveSignature).toEqual([
      [
        'actor-101010',
        'actor:101010:element:101010115',
        24,
        0,
        100,
        1,
        true,
      ],
    ]);
    expect(signatures[0].jadeEffectSignature).toEqual(
      expect.arrayContaining([
        [
          'battle-element:101010129',
          'verified-replay-jade-ultimate',
          4533.333,
          1,
        ],
        [
          'battle-element:101010206',
          'verified-replay-jade-ultimate',
          16.667,
          1,
        ],
        [
          'battle-element:101010206',
          'verified-replay-jade-charged',
          6016.667,
          2,
        ],
      ])
    );
    expect(
      signatures[0].damageSignature.filter(
        event => event[0] === 'verified-replay-jade-charged'
      ).length
    ).toBeGreaterThan(0);
    for (const signature of signatures.slice(1)) {
      expect(signature).toEqual(signatures[0]);
    }
  });

  it('restores scenario-configured Ruby ammo across all five project carriers', async () => {
    const source = createRubyInitialAmmoReplayDraft();
    const duplicated = duplicateWorkbenchScenario(
      source.scenarioWorkspace,
      source.scenarioWorkspace.activeScenarioId,
      source
    );
    const storage = createMemoryStorage();
    saveWorkbenchDraft(storage, source);
    const local = loadWorkbenchDraft(storage);
    const json = parseWorkbenchProjectFile(
      serializeWorkbenchProjectFile(source, EXPORTED_AT)
    );
    const share = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(source, EXPORTED_AT)
    );
    const png = await embedWorkbenchProjectInPng(
      new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')),
      createWorkbenchProjectPngMetadata(source, EXPORTED_AT)
    );
    const pngDraft = await parseWorkbenchProjectPng(png);
    const drafts = [duplicated.scenario.draft, local, json, share, pngDraft];

    for (const draft of drafts) {
      expect(draft.initialRuntimeState.specialResourcesByActor).toEqual([
        expect.objectContaining({
          actorId: 'actor-103002',
          characterId: 103002,
          resourceIdentity: 'actor:103002:element:103002047',
          currentValue: 6,
          maxValue: 12,
          inputStep: 1,
          scenarioConfigurable: true,
          baselineStatus: 'scenario-configurable-initial-state',
        }),
      ]);
    }
    const signatures = drafts.map(createVerifiedReplaySignature);
    expect(signatures[0].specialResourceCurveSignature).toEqual([
      [
        'actor-103002',
        'actor:103002:element:103002047',
        6,
        6,
        12,
        1,
        true,
      ],
    ]);
    for (const signature of signatures.slice(1)) {
      expect(signature).toEqual(signatures[0]);
    }
  }, 30_000);
});

function createAttackInputReplayDraft() {
  const base = createDefaultWorkbenchDraftState();
  base.durationMs = 30_000;
  const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
    item => item.ownerId === 109001 && item.actionKind === 'normal-attack'
  );
  let actionIndex = 0;
  const chain = createWorkbenchAttackInputChainDrafts({
    entry: mapping,
    actorCharacterId: 109001,
    skillId: mapping.sourceSkillId,
    level: 1,
    startMs: 0,
    createActionId: () => `replay-a${++actionIndex}`,
  });
  chain[1] = { ...chain[1], startMs: chain[1].startMs + frameToMs(30) };
  chain[2] = { ...chain[2], durationMs: frameToMs(90) };
  return createWorkbenchDraftSnapshot(
    {
      ...base,
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
      actionDrafts: chain,
      selectedActionId: chain[1].id,
    },
    null
  );
}

function createAttackInputActionSignature(draft) {
  return draft.actionDrafts.map(action => ({
    id: action.id,
    attackGroupId: action.attackGroupId,
    sequenceIndex: action.attackSequenceIndex,
    sequenceTotal: action.attackSequenceTotal,
    segmentIdentity: action.attackInput.identity,
    controlSkillId: action.attackInput.controlSkillId,
    effectiveDurationFrames: action.attackInput.effectiveDurationFrames,
    animationDurationFrames: action.attackInput.animationDurationFrames,
    hitEndFrame: action.attackInput.hitEndFrame,
    linkWindow: action.attackInput.linkWindow,
    hitIdentities: action.attackInput.selectedHitIdentities,
    startMs: action.startMs,
    durationMs: action.durationMs,
  }));
}

function createVerifiedReplayDraft() {
  const base = createDefaultWorkbenchDraftState();
  base.durationMs = 30_000;
  const actorConfigs = base.actorConfigs.map(config =>
    Number(config.characterId) === 101007
      ? {
          ...config,
          initialSp: 0,
          loadout: { ...config.loadout, kiboId: 500469 },
        }
      : { ...config, initialSp: 0 }
  );
  return createWorkbenchDraftSnapshot(
    {
      ...base,
      actorConfigs,
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
      actionDrafts: [
        createWorkbenchActionDraft({
          id: 'verified-replay-pangpang',
          type: 'skill',
          actorCharacterId: 101007,
          skillId: 10100701,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: frameToMs(PANGPANG_ATTACK_INPUT.durationFrames),
          ...createAttackInputFields(PANGPANG_ATTACK_INPUT),
        }),
        createWorkbenchActionDraft({
          id: 'verified-replay-kibo',
          type: 'kiboEvent',
          actorCharacterId: 101007,
          skillId: 50046903,
          startMs: 1000,
          durationMs: 2600,
          eventType: 'signature',
        }),
      ],
      initialRuntimeState: {
        enemy: {
          enemyId: String(base.selection.enemyId),
          hp: { currentValue: 8628, maxValue: 8628 },
          toughness: { currentValue: 1, maxValue: 6667 },
        },
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-3',
            actorId: 'actor-101007',
            characterId: 101007,
            kiboId: 500469,
            currentValue: 100,
            maxValue: 100,
          },
        ],
      },
      runtimeSampleCaptures: [],
      selectedActionId: 'verified-replay-pangpang',
    },
    EXPORTED_AT
  );
}

function createAttackInputFields(segment) {
  return {
    attackGroupId: 'verified-replay-pangpang-chain',
    attackSequenceIndex: segment.sequenceIndex,
    attackSequenceTotal: segment.sequenceTotal,
    attackInput: segment,
  };
}

function createCrossCatalogReplayDraft() {
  const base = createDefaultWorkbenchDraftState();
  base.durationMs = 30_000;
  const actorConfigs = base.actorConfigs.map(config => ({
    ...config,
    initialSp: 0,
    loadout:
      Number(config.characterId) === 101007
        ? { ...config.loadout, kiboId: 500001 }
        : config.loadout,
  }));
  return createWorkbenchDraftSnapshot(
    {
      ...base,
      actorConfigs,
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
      actionDrafts: [
        createWorkbenchActionDraft({
          id: 'verified-replay-han-star',
          type: 'skill',
          actorCharacterId: 101003,
          skillId: 10100312,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 1400,
        }),
        createWorkbenchActionDraft({
          id: 'verified-replay-muyin-charged',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900101,
          actionVariantIndex: 1,
          startMs: 2800,
          durationMs: 1000,
        }),
        createWorkbenchActionDraft({
          id: 'verified-replay-wind-kibo',
          type: 'kiboEvent',
          actorCharacterId: 101007,
          skillId: 504004,
          kiboId: 500001,
          actionVariantIndex: 0,
          startMs: 4200,
          durationMs: 3000,
          eventType: 'active',
        }),
        createWorkbenchActionDraft({
          id: 'verified-replay-pangpang-combo',
          type: 'skill',
          actorCharacterId: 101007,
          skillId: 10100712,
          actionVariantIndex: 2,
          startMs: 7400,
          durationMs: 1000,
        }),
        createWorkbenchActionDraft({
          id: 'verified-replay-wind-kibo-combo',
          type: 'kiboEvent',
          actorCharacterId: 101007,
          skillId: 50000112,
          kiboId: 500001,
          actionVariantIndex: 0,
          startMs: 7400,
          durationMs: 1500,
          eventType: 'break',
        }),
      ],
      actionRelations: [
        {
          id: 'verified-replay-joint-relation',
          kind: 'simultaneous',
          fromActionId: 'verified-replay-pangpang-combo',
          toActionId: 'verified-replay-wind-kibo-combo',
          sourceAnchor: 'start',
          targetAnchor: 'start',
          gapMs: 0,
        },
      ],
      initialRuntimeState: {
        enemy: {
          enemyId: String(base.selection.enemyId),
          hp: { currentValue: 8628, maxValue: 8628 },
          toughness: { currentValue: 6667, maxValue: 6667 },
        },
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-3',
            actorId: 'actor-101007',
            characterId: 101007,
            kiboId: 500001,
            currentValue: 0,
            maxValue: 100,
          },
        ],
      },
      runtimeSampleCaptures: [],
      selectedActionId: 'verified-replay-han-star',
    },
    EXPORTED_AT
  );
}

function createSpecialResourceReplayDraft() {
  const base = createDefaultWorkbenchDraftState();
  base.durationMs = 30_000;
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 101010 },
    { slotId: 'team-slot-2', position: 1, characterId: 101007 },
    { slotId: 'team-slot-3', position: 2, characterId: 101003 },
  ];
  const selection = {
    ...base.selection,
    characterId: 101010,
    secondaryCharacterId: 101007,
  };
  return createWorkbenchDraftSnapshot(
    {
      ...base,
      selection,
      teamSlots,
      actorConfigs: normalizeWorkbenchActorConfigs(
        [],
        selection,
        teamSlots
      ).map(config =>
        config.characterId === 101010 ? { ...config, initialSp: 100 } : config
      ),
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
      actionDrafts: [
        createWorkbenchActionDraft({
          id: 'verified-replay-jade-ultimate',
          type: 'skill',
          actorCharacterId: 101010,
          skillId: 10101013,
          startMs: 0,
          durationMs: frameToMs(327),
        }),
        createWorkbenchActionDraft({
          id: 'verified-replay-jade-charged',
          type: 'skill',
          actorCharacterId: 101010,
          skillId: 10101001,
          actionVariantIndex: 2,
          startMs: 6000,
          durationMs: frameToMs(250),
        }),
      ],
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: 'actor-101010',
            characterId: 101010,
            actorName: '涂山小玉',
            resourceIdentity: 'actor:101010:element:101010115',
          resourceName: '爆发状态叠层',
          currentValue: 24,
          maxValue: 100,
          inputStep: 1,
          scenarioConfigurable: true,
          baselineStatus: 'scenario-configurable-initial-state',
          activeStates: [],
        },
        ],
      },
      runtimeSampleCaptures: [],
      selectedActionId: 'verified-replay-jade-charged',
    },
    EXPORTED_AT
  );
}

function createRubyInitialAmmoReplayDraft() {
  const base = createDefaultWorkbenchDraftState();
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 103002 },
    { slotId: 'team-slot-2', position: 1, characterId: 101003 },
    { slotId: 'team-slot-3', position: 2, characterId: 101007 },
  ];
  const selection = {
    ...base.selection,
    characterId: 103002,
    secondaryCharacterId: 101003,
  };
  return createWorkbenchDraftSnapshot(
    {
      ...base,
      selection,
      teamSlots,
      actorConfigs: normalizeWorkbenchActorConfigs([], selection, teamSlots),
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
      actionDrafts: [],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-103002',
          characterId: 103002,
          actorName: '红宝石',
        },
        specialResourcesByActor: [
          {
            actorId: 'actor-103002',
            characterId: 103002,
            actorName: '红宝石',
            resourceIdentity: 'actor:103002:element:103002047',
            resourceName: '子弹',
            currentValue: 6,
            maxValue: 12,
            inputStep: 1,
            scenarioConfigurable: true,
            baselineStatus: 'scenario-configurable-initial-state',
          },
        ],
      },
      runtimeSampleCaptures: [],
      selectedActionId: null,
    },
    EXPORTED_AT
  );
}

function createVerifiedReplaySignature(draft) {
  const project = createWorkbenchProject(draft.selection, {
    durationMs: draft.durationMs,
    teamSlots: draft.teamSlots,
    actorConfigs: draft.actorConfigs,
    enemyConfig: draft.enemyConfig,
    configurationLibrary: draft.configurationLibrary,
    configurationSelection: draft.configurationSelection,
    gameDataBinding: draft.gameDataBinding,
    mechanicsProfileSelection: draft.mechanicsProfileSelection,
    actions: draft.actionDrafts,
    actionRelations: draft.actionRelations,
    cycleBoundaries: draft.cycleBoundaries,
    initialRuntimeState: draft.initialRuntimeState,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
  });
  const scenario = compileProject(project, getWorkbenchGameData());
  const result = simulateScenario(scenario);
  const resources = result.runtimeOutputs.resourceCurves;
  const actorsById = new Map(
    scenario.actors.map(actor => [String(actor.id), actor])
  );
  const operationInputs = projectTimelineOperationInputs({
    actions: scenario.actions,
    actors: scenario.actors,
    controlledActorTimeline: result.runtimeOutputs.controlledActorTimeline,
    durationMs: scenario.time.durationMs,
    resolveActionMapping(action) {
      return getVerifiedCombatActionInputMapping({
        ...action,
        actor: actorsById.get(String(action.actorId ?? '')) ?? null,
      });
    },
  });
  return {
    profileId: scenario.mechanicsProfile.profileId,
    topology: scenario.sourceProject.metadata.timelineTopology.summary,
    actionRelationSignature: scenario.actionRelations.map(relation => [
      relation.kind,
      relation.fromActionId,
      relation.toActionId,
      relation.gapMs,
    ]),
    bindingIdentities: result.verifiedCombatRuntime.actionResolutions
      .filter(resolution => resolution.ready)
      .map(resolution => resolution.actionBinding.identity)
      .sort(),
    damageEventCount: result.verifiedCombatRuntime.damageEvents.length,
    hitEventCount: result.verifiedCombatRuntime.summary.hitEventCount,
    breakTriggerCount: result.verifiedCombatRuntime.summary.breakTriggerCount,
    breakExitCount: result.verifiedCombatRuntime.summary.breakExitCount,
    stateEventKinds: [
      ...new Set(
        result.verifiedCombatRuntime.damageEvents
          .map(event => event.payload.stateEventKind)
          .filter(Boolean)
      ),
    ],
    damageSignature: result.verifiedCombatRuntime.damageEvents.map(event => [
      event.actionId,
      event.timeMs,
      event.payload.elementId,
      event.payload.rawDamage,
      event.payload.toughnessDamage,
    ]),
    tuningMarkEventCount:
      result.verifiedCombatRuntime.tuningMarkRuntime?.events?.length ?? 0,
    tuningMarkSignature: (
      result.verifiedCombatRuntime.tuningMarkRuntime?.events ?? []
    ).map(event => [
      event.kind,
      event.timeMs,
      event.markId,
      event.before,
      event.delta,
      event.after,
      event.actionId,
    ]),
    finalTuningMarkState:
      result.verifiedCombatRuntime.tuningMarkRuntime?.finalState ?? [],
    tuningMarkCurveCount:
      result.tuningMarkCurveProjection?.visibleTracks?.length ?? 0,
    tuningMarkCurveSignature: (
      result.tuningMarkCurveProjection?.visibleTracks ?? []
    ).map(track => [
      track.markId,
      track.initialValue,
      track.currentValue,
      track.linePoints.map(point => [point.timeMs, point.value]),
      track.semanticNodes.map(node => [
        node.frameIndex,
        node.beforeValue,
        node.afterValue,
        node.actionId,
        node.eventKinds,
      ]),
    ]),
    variantSelectionSignature: (
      result.verifiedCombatRuntime.specialResourceRuntime?.selections ?? []
    ).map(selection => [
      selection.actionId,
      selection.controlSkillId,
      selection.selectedSubSkillIndex,
      selection.sourceKind,
    ]),
    specialResourceEventSignature: (
      result.verifiedCombatRuntime.specialResourceRuntime?.resourceEvents ?? []
    ).map(event => [
      event.actionId,
      event.timeMs,
      event.payload.operation,
      event.payload.beforeValue,
      event.payload.afterValue,
    ]),
    specialResourceCurveSignature: (
      resources.curvesBySpecialResource ?? []
    ).map(curve => [
      curve.actorId,
      curve.resourceIdentity,
      curve.initialValue,
      curve.currentValue,
      curve.maxValue,
      curve.inputStep,
      curve.scenarioConfigurable,
    ]),
    jadeEffectSignature: (result.effectTimeline?.events ?? [])
      .filter(event =>
        ['battle-element:101010129', 'battle-element:101010206'].includes(
          event.effectId
        )
      )
      .map(event => [
        event.effectId,
        event.actionId,
        event.timeMs,
        event.after?.stacks ?? 0,
      ]),
    finalState: result.verifiedCombatRuntime.finalState,
    spUnitSignature: {
      actorMaximums: result.verifiedCombatRuntime.finalState.actorEnergy
        .map(entry => entry.maxValue)
        .sort((left, right) => left - right),
      kiboMaximums: result.verifiedCombatRuntime.finalState.kiboEnergy
        .map(entry => entry.maxValue)
        .sort((left, right) => left - right),
      heavyCost: (() => {
        const event = result.verifiedCombatRuntime.kiboResourceEvents.find(
          item =>
            item.actionId === 'verified-replay-kibo' &&
            item.payload.reason === 'verified-skill-cost'
        );
        return event
          ? [
              event.payload.beforeValue,
              event.payload.change,
              event.payload.afterValue,
            ]
          : null;
      })(),
    },
    actorCurveCount: resources.curvesByActor.length,
    kiboCurveCount: resources.curvesByKibo.length,
    actorCurveSignature: resources.curvesByActor.map(curve => [
      curve.actorId,
      curve.stateMetric.currentValue,
      curve.pointCount,
    ]),
    kiboCurveSignature: resources.curvesByKibo.map(curve => [
      curve.slotId,
      curve.kiboId,
      curve.stateMetric.currentValue,
      curve.pointCount,
      curve.appliedToCalculators,
    ]),
    sparseDisplaySignature: createSparseDisplaySignature(result, scenario),
    operationInputSignature: operationInputs.markers.map(marker => [
      marker.actionId,
      marker.command,
      marker.mode,
      marker.keyLabel,
      marker.startMs,
      marker.endMs,
    ]),
    appliedKiboIds: resources.curvesByKibo
      .filter(curve => curve.appliedToCalculators)
      .map(curve => curve.kiboId),
  };
}

function createSparseDisplaySignature(result, scenario) {
  const stateCurves = result.runtimeOutputs.stateCurves;
  const curveInputs = [
    ...stateCurves.resources.curvesByActor.map(curve => ({
      id: `actor:${curve.actorId}`,
      trackKey: 'selfEnergyChange',
      curve,
    })),
    ...stateCurves.resources.curvesByKibo.map(curve => ({
      id: `kibo:${curve.slotId}:${curve.kiboId}`,
      trackKey: 'kiboEnergyChange',
      curve,
    })),
    {
      id: 'enemy:hp',
      trackKey: 'enemyHpDamage',
      curve: {
        stateMetric: stateCurves.enemy.stateMetrics.hp,
        points: stateCurves.enemy.points,
      },
    },
    {
      id: 'enemy:toughness',
      trackKey: 'enemyToughnessDamage',
      curve: {
        stateMetric: stateCurves.enemy.stateMetrics.toughness,
        points: stateCurves.enemy.points,
      },
    },
  ];

  return curveInputs.map(({ id, trackKey, curve }) => {
    const projection = projectTimelineStateDisplaySeries({
      trackKey,
      points: curve.points,
      initialValue: curve.stateMetric.initialValue,
      maxValue: curve.stateMetric.maxValue,
      durationMs: scenario.time.durationMs,
      resolveStatePointId: point => point.sourceDeltaId,
    });
    return {
      id,
      displayPointCount: projection.displayPointCount,
      nodes: projection.semanticNodes.map(node => [
        node.actionId,
        node.frameIndex,
        node.eventCount,
        node.beforeValue,
        node.afterValue,
        node.statePointIds,
      ]),
    };
  });
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}
