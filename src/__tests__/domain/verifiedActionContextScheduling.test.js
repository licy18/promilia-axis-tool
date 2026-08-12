import { describe, expect, it } from 'vitest';

import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  resolveVerifiedAttackInputChainEntry,
  resolveVerifiedContextInputScheduling,
  resolveVerifiedContextActionStartMs,
  resolveVerifiedNormalAttackInputEntry,
} from '../../domain/verifiedActionContextScheduling';
import { frameToMs } from '../../domain/timebase';
import {
  ACTION_RULE_CODES,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';

describe('verified action context scheduling', () => {
  it('materializes the complete mapping-backed input phase without reopening A1 during recovery', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 112001 && item.actionKind === 'normal-attack'
    );
    const entry = { ...mapping, skillId: mapping.sourceSkillId };
    const source = {
      id: 'melania-a1',
      type: 'skill',
      actorId: 'actor-melania',
      actorCharacterId: 112001,
      skillId: mapping.sourceSkillId,
      startMs: 0,
      attackGroupId: 'melania-chain',
      attackSequenceIndex: 1,
      attackSequenceTotal: 5,
      attackInput: mapping.attackInputSegments[0],
    };
    const selection = {
      actionId: source.id,
      actorId: source.actorId,
      ready: true,
      attackGroupId: source.attackGroupId,
      attackSequenceIndex: 1,
      attackSequenceTotal: 5,
      executionControlSkillId: 11200101,
      selectedSubSkillIndex: 0,
    };
    expect(mapping).toMatchObject({
      identity: expect.any(String),
      sourceSkillId: 11200101,
    });
    for (const segment of mapping.attackInputSegments) {
      expect(segment.actionTiming.animation).toMatchObject({
        endFrame: expect.any(Number),
        sourceIdentity: expect.any(String),
      });
    }
    const at = frame =>
      resolveVerifiedNormalAttackInputEntry({
        entry,
        graph: verifiedCombatMechanicsPackage.actionVariantGraph,
        ownerId: 112001,
        actorId: source.actorId,
        timeMs: frameToMs(frame),
        actions: [source],
        runtimeSelections: [selection],
      });

    for (const frame of [17, 73, 229]) {
      expect(at(frame)).toMatchObject({
        status: 'blocked',
        entry: null,
      });
    }
    for (const frame of [18, 72]) {
      expect(at(frame)).toMatchObject({
        status: 'selected',
        phase: {
          formIdentity: expect.stringMatching(/^normal-attack-form:/),
          mappingIdentity: mapping.identity,
          sourceSkillId: mapping.sourceSkillId,
          reasons: [],
        },
        entry: {
          attackInputExpansionMode: 'single-input',
          attackInputGroupId: 'melania-chain',
          attackInputContextActionId: source.id,
          attackInputSegments: [
            {
              sequenceIndex: 2,
              sequenceTotal: 5,
              controlSkillId: 11200102,
            },
          ],
        },
      });
    }
    expect(at(230)).toMatchObject({
      status: 'selected',
      phase: { phase: 'idle' },
      entry: {
        attackInputExpansionMode: 'single-input',
        attackInputSegments: [
          {
            sequenceIndex: 1,
            sequenceTotal: 5,
            controlSkillId: 11200101,
          },
        ],
      },
    });
    expect(at(230).entry).not.toHaveProperty('attackInputGroupId');
  });

  it('gives a sourced special continuation priority over the direct successor', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 112001 && item.actionKind === 'normal-attack'
    );
    const source = {
      id: 'melania-a1',
      type: 'skill',
      actorId: 'actor-melania',
      actorCharacterId: 112001,
      skillId: mapping.sourceSkillId,
      startMs: 0,
      attackGroupId: 'melania-chain',
      attackSequenceIndex: 1,
      attackSequenceTotal: 5,
      attackInput: mapping.attackInputSegments[0],
    };
    const specialSource = {
      id: 'melania-special-skill',
      type: 'skill',
      actionKind: 'star-skill',
      actorId: source.actorId,
      actorCharacterId: 112001,
      skillId: 11200111,
      startMs: frameToMs(20),
    };
    const resolved = resolveVerifiedNormalAttackInputEntry({
      entry: { ...mapping, skillId: mapping.sourceSkillId },
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 112001,
      actorId: source.actorId,
      timeMs: frameToMs(30),
      actions: [source, specialSource],
      runtimeSelections: [
        {
          actionId: source.id,
          actorId: source.actorId,
          ready: true,
          attackGroupId: source.attackGroupId,
          attackSequenceIndex: 1,
          executionControlSkillId: 11200101,
          selectedSubSkillIndex: 0,
        },
        {
          actionId: specialSource.id,
          actorId: specialSource.actorId,
          ready: true,
          status: 'ready',
        },
      ],
      variantRuntime: {
        activeSwitchWindows: [
          {
            applied: true,
            compilerBindingIdentity: 'melania-special-continuation',
            relationType: 'input-derived',
            inputCommand: 'normal-attack',
            actorId: source.actorId,
            sourceActionId: 'melania-special-skill',
            sourceIdentity: 'verified:melania:special-continuation',
            targetControlSkillId: 11200104,
            targetSubSkillIndex: 0,
            startsAtMs: frameToMs(20),
            endsAtMs: frameToMs(40),
          },
        ],
      },
    });

    expect(resolved).toMatchObject({
      status: 'selected',
      phase: {
        sourceKind: 'input-derived',
        sourceActionId: 'melania-special-skill',
      },
      entry: {
        attackInputGroupId: 'melania-chain',
        attackInputContextActionId: 'melania-special-skill',
        attackInputSegments: [
          {
            sequenceIndex: 4,
            controlSkillId: 11200104,
          },
        ],
      },
    });
  });

  it('ignores a continuation window whose source action is missing or still in the future', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 112001 && item.actionKind === 'normal-attack'
    );
    const source = {
      id: 'melania-a1',
      type: 'skill',
      actorId: 'actor-melania',
      actorCharacterId: 112001,
      skillId: mapping.sourceSkillId,
      startMs: 0,
      attackGroupId: 'melania-chain',
      attackSequenceIndex: 1,
      attackSequenceTotal: 5,
      attackInput: mapping.attackInputSegments[0],
    };
    const selection = {
      actionId: source.id,
      actorId: source.actorId,
      ready: true,
      attackGroupId: source.attackGroupId,
      attackSequenceIndex: 1,
      executionControlSkillId: 11200101,
      selectedSubSkillIndex: 0,
    };
    const window = sourceActionId => ({
      applied: true,
      compilerBindingIdentity: `fake:${sourceActionId}`,
      relationType: 'input-derived',
      inputCommand: 'normal-attack',
      actorId: source.actorId,
      sourceActionId,
      sourceIdentity: `verified:${sourceActionId}`,
      targetControlSkillId: 11200104,
      targetSubSkillIndex: 0,
      startsAtMs: frameToMs(20),
      endsAtMs: frameToMs(40),
    });
    const resolve = ({ sourceActionId, extraActions = [] }) =>
      resolveVerifiedNormalAttackInputEntry({
        entry: { ...mapping, skillId: mapping.sourceSkillId },
        graph: verifiedCombatMechanicsPackage.actionVariantGraph,
        ownerId: 112001,
        actorId: source.actorId,
        timeMs: frameToMs(30),
        actions: [source, ...extraActions],
        runtimeSelections: [selection],
        variantRuntime: { activeSwitchWindows: [window(sourceActionId)] },
      });

    for (const resolved of [
      resolve({ sourceActionId: 'missing-source' }),
      resolve({
        sourceActionId: 'future-source',
        extraActions: [
          {
            id: 'future-source',
            type: 'skill',
            actorId: source.actorId,
            actorCharacterId: 112001,
            startMs: frameToMs(31),
          },
        ],
      }),
    ]) {
      expect(resolved).toMatchObject({
        status: 'selected',
        phase: {
          sourceKind: 'verified-normal-attack-direct-successor',
          sourceActionId: source.id,
        },
        entry: {
          attackInputSegments: [
            {
              sequenceIndex: 2,
              controlSkillId: 11200102,
            },
          ],
        },
      });
    }
  });

  it('blocks an active sourced continuation whose target is not uniquely verified', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 112001 && item.actionKind === 'normal-attack'
    );
    const source = {
      id: 'melania-a1',
      type: 'skill',
      actorId: 'actor-melania',
      actorCharacterId: 112001,
      skillId: mapping.sourceSkillId,
      startMs: 0,
      attackGroupId: 'melania-chain',
      attackSequenceIndex: 1,
      attackSequenceTotal: 5,
      attackInput: mapping.attackInputSegments[0],
    };
    const resolved = resolveVerifiedNormalAttackInputEntry({
      entry: { ...mapping, skillId: mapping.sourceSkillId },
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 112001,
      actorId: source.actorId,
      timeMs: frameToMs(30),
      actions: [source],
      runtimeSelections: [
        {
          actionId: source.id,
          actorId: source.actorId,
          ready: true,
          status: 'ready',
          attackGroupId: source.attackGroupId,
          attackSequenceIndex: 1,
          executionControlSkillId: 11200101,
          selectedSubSkillIndex: 0,
        },
      ],
      variantRuntime: {
        activeSwitchWindows: [
          {
            applied: true,
            compilerBindingIdentity: 'unverified-target',
            relationType: 'input-derived',
            inputCommand: 'normal-attack',
            actorId: source.actorId,
            sourceActionId: source.id,
            sourceIdentity: 'verified:missing-target',
            targetControlSkillId: 99999999,
            targetSubSkillIndex: 0,
            startsAtMs: frameToMs(20),
            endsAtMs: frameToMs(40),
          },
        ],
      },
    });

    expect(resolved).toMatchObject({
      status: 'blocked',
      reason: 'verified-normal-attack-input-active-window-unresolved',
      reasons: ['verified-normal-attack-input-active-window-target-unresolved'],
      entry: null,
    });
  });

  it('fails closed when mapping identity or segment recovery evidence is absent', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 112001 && item.actionKind === 'normal-attack'
    );
    const unresolved = resolveVerifiedNormalAttackInputEntry({
      entry: {
        ...mapping,
        identity: null,
        skillId: mapping.sourceSkillId,
        attackInputSegments: mapping.attackInputSegments.map(
          (segment, index) =>
            index === 0
              ? {
                  ...segment,
                  animationDurationSourceIdentity: null,
                  actionTiming: {
                    ...segment.actionTiming,
                    animation: {
                      ...segment.actionTiming.animation,
                      sourceIdentity: null,
                    },
                  },
                }
              : segment
        ),
      },
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 112001,
      actorId: 'actor-melania',
      timeMs: 0,
    });

    expect(unresolved).toMatchObject({
      status: 'blocked',
      entry: null,
      phase: {
        formIdentity: null,
        mappingIdentity: null,
        sourceSkillId: mapping.sourceSkillId,
        reasons: expect.arrayContaining([
          'normal-attack-mapping-identity-required',
          'normal-attack-segment-recovery-evidence-required',
        ]),
      },
    });
  });

  it('selects exactly one live normal-attack input inside a continuation window', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 103002 &&
        Number(item.sourceSkillId) === 10300201 &&
        Number(item.actionVariantIndex) === 0
    );
    const entry = { ...mapping, skillId: mapping.sourceSkillId };
    const baseRuntime = {
      initialState: [
        {
          actorId: 'actor-ruby',
          characterId: 103002,
          resourceIdentity: 'actor:103002:element:103002047',
          currentValue: 9,
          maxValue: 12,
        },
      ],
      resourceEvents: [],
      activeSwitchWindows: [],
    };

    const outside = resolveVerifiedAttackInputChainEntry({
      entry,
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 103002,
      actorId: 'actor-ruby',
      timeMs: frameToMs(10),
      variantRuntime: baseRuntime,
      selectionMode: 'single-input',
    });
    expect(outside).toMatchObject({
      status: 'selected',
      entry: {
        attackInputExpansionMode: 'single-input',
        attackInputSegments: [
          {
            sequenceIndex: 1,
            sequenceTotal: 3,
            chainSequenceIndex: 1,
            semanticName: '普通攻击 A1',
          },
        ],
      },
    });

    const window = {
      edgeIdentity:
        'attack-chain-continuity:ruby-dodge:ruby-enhanced-dodge-chain-continuity:4',
      relationType: 'attack-chain-continuity-window',
      inputCommand: 'normal-attack',
      actorId: 'actor-ruby',
      ownerId: 103002,
      targetControlSkillId: 10300202,
      targetSubSkillIndex: 1,
      targetChainIdentity: 'ruby-enhanced-twelve-inputs',
      targetSequenceIndex: 4,
      startsAtMs: frameToMs(90),
      endsAtMs: frameToMs(306),
    };
    const inside = resolveVerifiedAttackInputChainEntry({
      entry,
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 103002,
      actorId: 'actor-ruby',
      timeMs: frameToMs(305),
      variantRuntime: { ...baseRuntime, activeSwitchWindows: [window] },
      selectionMode: 'single-input',
    });
    expect(inside.entry.attackInputSegments).toEqual([
      expect.objectContaining({
        sequenceIndex: 4,
        sequenceTotal: 12,
        chainSequenceIndex: 4,
        semanticName: '强化普攻 E4',
      }),
    ]);
  });

  it('projects graph-chain animation evidence into the authority structural form', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 101010 && item.actionKind === 'normal-attack'
    );
    const resolved = resolveVerifiedNormalAttackInputEntry({
      entry: { ...mapping, skillId: mapping.sourceSkillId },
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 101010,
      actorId: 'actor-jade',
      timeMs: frameToMs(30),
      effectIntervals: [
        {
          effectId: 'battle-element:101010129',
          targetId: 'actor-jade',
          startMs: 0,
          endMs: frameToMs(600),
        },
      ],
    });

    expect(resolved).toMatchObject({
      status: 'selected',
      phase: {
        formIdentity: expect.stringMatching(/^normal-attack-form:/),
        mappingIdentity: mapping.identity,
        sourceSkillId: mapping.sourceSkillId,
        reasons: [],
      },
      chain: { chainIdentity: 'xiaoyu-burst-three-inputs' },
      entry: {
        attackInputExpansionMode: 'single-input',
        attackInputChainIdentity: 'xiaoyu-burst-three-inputs',
        attackInputSegments: [
          {
            sequenceIndex: 1,
            sequenceTotal: 3,
            controlSkillId: 10101001,
            selectedSubSkillIndex: 1,
          },
        ],
      },
    });
  });

  it('blocks a live derived input when its source resource cannot fund one segment', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 103002 &&
        Number(item.sourceSkillId) === 10300201 &&
        Number(item.actionVariantIndex) === 0
    );
    const resolved = resolveVerifiedAttackInputChainEntry({
      entry: { ...mapping, skillId: mapping.sourceSkillId },
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 103002,
      actorId: 'actor-ruby',
      timeMs: frameToMs(100),
      variantRuntime: {
        initialState: [
          {
            actorId: 'actor-ruby',
            characterId: 103002,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 0,
            maxValue: 12,
          },
        ],
        resourceEvents: [],
        activeSwitchWindows: [
          {
            actorId: 'actor-ruby',
            compilerBindingIdentity: 'ruby-star-skill-quick-enhanced-entry',
            inputCommand: 'normal-attack',
            targetControlSkillId: 10300201,
            targetSubSkillIndex: 1,
            startsAtMs: frameToMs(40),
            endsAtMs: frameToMs(280),
          },
        ],
      },
      selectionMode: 'single-input',
    });

    expect(resolved).toMatchObject({
      status: 'blocked',
      reason: 'verified-normal-attack-input-resource-unavailable',
      entry: null,
    });
  });

  it('projects the state-selected normal attack chain without persisting runtime state', () => {
    const entry = createNormalAttackEntry();
    const graph = createVariantGraph();

    const normal = resolveVerifiedAttackInputChainEntry({
      entry,
      graph,
      ownerId: 101010,
      actorId: 'actor-jade',
      timeMs: 1000,
      effectIntervals: [],
    });
    expect(normal.status).toBe('selected');
    expect(normal.entry.attackInputSegments).toHaveLength(5);
    expect(
      normal.entry.attackInputSegments.map(segment => [
        segment.controlSkillId,
        segment.selectedSubSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [10101001, 0, 20],
      [10101002, 0, 35],
      [10101003, 0, 47],
      [10101004, 0, 30],
      [10101005, 0, 80],
    ]);

    const burst = resolveVerifiedAttackInputChainEntry({
      entry,
      graph,
      ownerId: 101010,
      actorId: 'actor-jade',
      timeMs: 1000,
      effectIntervals: [
        {
          effectId: 'battle-element:101010129',
          targetId: 'actor-jade',
          startMs: 500,
          endMs: 10_500,
        },
      ],
    });
    expect(burst.status).toBe('selected');
    expect(
      burst.entry.attackInputSegments.map(segment => [
        segment.sequenceIndex,
        segment.sequenceTotal,
        segment.controlSkillId,
        segment.selectedSubSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [1, 3, 10101001, 1, 72],
      [2, 3, 10101004, 1, 75],
      [3, 3, 10101005, 1, 72],
    ]);
    expect(entry.attackInputSegments).toHaveLength(5);
  });

  it('projects the verified burst chain link contract into ready A1-A3 drafts', () => {
    const entry = verifiedCombatMechanicsPackage.actionMappings.find(
      mapping =>
        Number(mapping.ownerId) === 101010 &&
        Number(mapping.sourceSkillId) === 10101001 &&
        Number(mapping.actionVariantIndex) === 0
    );
    const resolved = resolveVerifiedAttackInputChainEntry({
      entry: { ...entry, skillId: entry.sourceSkillId },
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 101010,
      actorId: 'actor-jade',
      timeMs: 1000,
      effectIntervals: [
        {
          effectId: 'battle-element:101010129',
          targetId: 'actor-jade',
          startMs: 500,
          endMs: 10_500,
        },
      ],
    });

    expect(resolved.status).toBe('selected');
    expect(
      resolved.entry.attackInputSegments.map(segment => ({
        sequenceIndex: segment.sequenceIndex,
        controlSkillId: segment.controlSkillId,
        selectedSubSkillIndex: segment.selectedSubSkillIndex,
        linkTimingStatus: segment.linkTimingStatus,
        linkTimingBasis: segment.linkTimingBasis,
        linkTargetControlSkillId: segment.linkWindow?.targetControlSkillId,
        linkTargetSubSkillIndex: segment.linkWindow?.targetSubSkillIndex,
        linkStartFrame: segment.linkWindow?.startFrame,
        linkEndFrame: segment.linkWindow?.endFrame,
      }))
    ).toEqual([
      {
        sequenceIndex: 1,
        controlSkillId: 10101001,
        selectedSubSkillIndex: 1,
        linkTimingStatus: 'applied',
        linkTimingBasis: 'next-control-input-window',
        linkTargetControlSkillId: 10101004,
        linkTargetSubSkillIndex: 1,
        linkStartFrame: 72,
        linkEndFrame: 108,
      },
      {
        sequenceIndex: 2,
        controlSkillId: 10101004,
        selectedSubSkillIndex: 1,
        linkTimingStatus: 'applied',
        linkTimingBasis: 'next-control-input-window',
        linkTargetControlSkillId: 10101005,
        linkTargetSubSkillIndex: 1,
        linkStartFrame: 75,
        linkEndFrame: 120,
      },
      {
        sequenceIndex: 3,
        controlSkillId: 10101005,
        selectedSubSkillIndex: 1,
        linkTimingStatus: 'applied',
        linkTimingBasis: 'attack-reopen-window',
        linkTargetControlSkillId: 80102,
        linkTargetSubSkillIndex: 0,
        linkStartFrame: 72,
        linkEndFrame: 319,
      },
    ]);

    let cursorFrame = 0;
    const actions = resolved.entry.attackInputSegments.map(segment => {
      const action = {
        id: `burst-a${segment.sequenceIndex}`,
        type: 'skill',
        name: `A${segment.sequenceIndex}`,
        actorId: 'actor-jade',
        actorCharacterId: 101010,
        skillId: 10101001,
        startMs: frameToMs(cursorFrame),
        durationMs: frameToMs(segment.durationFrames),
        attackGroupId: 'burst-chain',
        attackSequenceIndex: segment.sequenceIndex,
        attackSequenceTotal: segment.sequenceTotal,
        attackInput: segment,
      };
      cursorFrame += segment.durationFrames;
      return action;
    });
    const diagnostics = createActionRuleDiagnostics({
      scenario: {
        time: { fps: 60 },
        actors: [{ id: 'actor-jade', characterId: 101010, name: '涂山小玉' }],
        actions,
      },
    });

    expect(
      diagnostics.diagnostics.filter(
        diagnostic =>
          diagnostic.code ===
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TIMING_UNRESOLVED
      )
    ).toEqual([]);
    expect(
      diagnostics.diagnostics.filter(diagnostic =>
        [
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_EARLY,
          ACTION_RULE_CODES.ATTACK_INPUT_LINK_TOO_LATE,
        ].includes(diagnostic.code)
      )
    ).toEqual([]);
    expect(
      diagnostics.readinessTimeline.actions.map(action => action.status)
    ).toEqual(['ready', 'ready', 'ready']);
  });

  it('keeps Ruby normal attack at three inputs until a verified enhanced entry is active', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item =>
        Number(item.ownerId) === 103002 &&
        Number(item.sourceSkillId) === 10300201 &&
        Number(item.actionVariantIndex) === 0
    );
    const entry = { ...mapping, skillId: mapping.sourceSkillId };
    const baseRuntime = {
      initialState: [
        {
          actorId: 'actor-ruby',
          characterId: 103002,
          resourceIdentity: 'actor:103002:element:103002047',
          currentValue: 6,
          maxValue: 12,
        },
      ],
      resourceEvents: [],
      activeSwitchWindows: [],
    };

    const defaultSelection = resolveVerifiedAttackInputChainEntry({
      entry,
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 103002,
      actorId: 'actor-ruby',
      timeMs: 1000,
      effectIntervals: [],
      variantRuntime: baseRuntime,
    });
    expect(defaultSelection.status).toBe('selected');
    expect(defaultSelection.chain.chainIdentity).toBe(
      'ruby-normal-default-three-inputs'
    );
    expect(defaultSelection.entry.attackInputSegments).toHaveLength(3);

    const quickEntry = resolveVerifiedAttackInputChainEntry({
      entry,
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 103002,
      actorId: 'actor-ruby',
      timeMs: 1000,
      effectIntervals: [],
      variantRuntime: {
        ...baseRuntime,
        activeSwitchWindows: [
          {
            actorId: 'actor-ruby',
            ownerId: 103002,
            compilerBindingIdentity: 'ruby-star-skill-quick-enhanced-entry',
            sourceActionId: 'ruby-star-skill',
            targetControlSkillId: 10300201,
            targetSubSkillIndex: 1,
            startsAtMs: frameToMs(40),
            endsAtMs: frameToMs(40) + 4000,
          },
        ],
      },
    });
    expect(quickEntry.status).toBe('selected');
    expect(quickEntry.chain.chainIdentity).toBe('ruby-enhanced-twelve-inputs');
    expect(quickEntry.entry.attackInputSegments).toHaveLength(6);
    expect(
      quickEntry.entry.attackInputSegments.map(segment => [
        segment.controlSkillId,
        segment.selectedSubSkillIndex,
      ])
    ).toEqual([
      [10300201, 1],
      [10300201, 2],
      [10300201, 3],
      [10300202, 1],
      [10300202, 2],
      [10300202, 3],
    ]);

    const phaseEntry = resolveVerifiedAttackInputChainEntry({
      entry,
      graph: verifiedCombatMechanicsPackage.actionVariantGraph,
      ownerId: 103002,
      actorId: 'actor-ruby',
      timeMs: frameToMs(34),
      effectIntervals: [],
      variantRuntime: baseRuntime,
      actions: [
        {
          id: 'ruby-normal-a3',
          actorCharacterId: 103002,
          startMs: 0,
          attackInput: {
            controlSkillId: 10300203,
            selectedSubSkillIndex: 0,
          },
        },
      ],
      runtimeSelections: [
        {
          actionId: 'ruby-normal-a3',
          executionControlSkillId: 10300203,
          selectedSubSkillIndex: 0,
        },
      ],
    });
    expect(phaseEntry.status).toBe('selected');
    expect(phaseEntry.chain.chainIdentity).toBe('ruby-enhanced-twelve-inputs');
    expect(phaseEntry.entry.attackInputSegments).toHaveLength(6);
  });

  it('snaps a derived heavy input to the sourced A5 context window', () => {
    const graph = createVariantGraph();
    const normalA5 = {
      id: 'jade-a5',
      actorCharacterId: 101010,
      startMs: 2000,
    };
    expect(
      resolveVerifiedContextActionStartMs({
        actions: [normalA5],
        selections: [
          {
            actionId: normalA5.id,
            controlSkillId: 10101005,
            selectedSubSkillIndex: 0,
            actualDurationFrames: 80,
          },
        ],
        graph,
        ownerId: 101010,
        actorId: 'actor-jade',
        targetControlSkillId: 10101010,
        effectIntervals: [],
        timelineDurationMs: 30_000,
      })
    ).toMatchObject({
      actionId: normalA5.id,
      startMs: 2000 + frameToMs(80),
      endMs: 2000 + frameToMs(102),
    });

    const burstA5 = {
      id: 'jade-burst-a5',
      actorCharacterId: 101010,
      startMs: 5000,
    };
    const burstContext = resolveVerifiedContextActionStartMs({
      actions: [burstA5],
      selections: [
        {
          actionId: burstA5.id,
          controlSkillId: 10101005,
          selectedSubSkillIndex: 1,
          actualDurationFrames: 72,
        },
      ],
      graph,
      ownerId: 101010,
      actorId: 'actor-jade',
      targetControlSkillId: 10101010,
      effectIntervals: [
        {
          effectId: 'battle-element:101010129',
          targetId: 'actor-jade',
          startMs: 4500,
          endMs: 15_000,
        },
      ],
      timelineDurationMs: 30_000,
    });
    expect(burstContext).toMatchObject({ actionId: burstA5.id });
    expect(burstContext.startMs).toBeCloseTo(5000 + frameToMs(71), 5);
    expect(burstContext.endMs).toBeCloseTo(5000 + frameToMs(72), 5);

    const ordinaryCharged = {
      id: 'jade-ordinary-charged',
      actorCharacterId: 101010,
      startMs: 8000,
    };
    expect(
      resolveVerifiedContextActionStartMs({
        actions: [ordinaryCharged],
        selections: [
          {
            actionId: ordinaryCharged.id,
            controlSkillId: 10101010,
            selectedSubSkillIndex: 0,
            actualDurationFrames: 75,
          },
        ],
        graph,
        ownerId: 101010,
        actorId: 'actor-jade',
        targetControlSkillId: 10101010,
        effectIntervals: [],
        timelineDurationMs: 30_000,
      })
    ).toMatchObject({
      actionId: ordinaryCharged.id,
      startMs: 8000 + frameToMs(75),
      endMs: 8000 + frameToMs(105),
      edge: {
        semanticName: '连续重击',
        executionControlSkillId: 10101010,
        targetSubSkillIndex: 1,
      },
    });
  });

  it.each([
    {
      label: '星鸣技',
      controlSkillId: 10101012,
      startFrame: 86,
      endFrame: 120,
      expectedPlacementFrame: 119,
      executionSubSkillIndex: 0,
    },
    {
      label: '星决技',
      controlSkillId: 10101013,
      startFrame: 295,
      endFrame: 329,
      expectedPlacementFrame: 328,
      executionSubSkillIndex: 1,
    },
    {
      label: '极限反击',
      controlSkillId: 10101025,
      startFrame: 60,
      endFrame: 96,
      expectedPlacementFrame: 60,
      executionSubSkillIndex: 0,
    },
  ])(
    'snaps a heavy input to the generated $label hidden-input window',
    ({
      label,
      controlSkillId,
      startFrame,
      endFrame,
      expectedPlacementFrame,
      executionSubSkillIndex,
    }) => {
      const source = {
        id: `jade-${label}`,
        actorCharacterId: 101010,
        startMs: 3000,
      };
      const result = resolveVerifiedContextActionStartMs({
        actions: [source],
        selections: [
          {
            actionId: source.id,
            controlSkillId,
            selectedSubSkillIndex: 0,
          },
        ],
        graph: verifiedCombatMechanicsPackage.actionVariantGraph,
        ownerId: 101010,
        actorId: 'actor-jade',
        targetControlSkillId: 10101010,
        effectIntervals: [],
        timelineDurationMs: 30_000,
      });

      expect(result).toMatchObject({
        actionId: source.id,
        edge: {
          sourceControlSkillId: controlSkillId,
          executionControlSkillId: 10101042,
          targetSubSkillIndex: executionSubSkillIndex,
        },
      });
      expect(result.startMs).toBeCloseTo(
        3000 + frameToMs(expectedPlacementFrame),
        5
      );
      expect(result.endMs).toBeCloseTo(3000 + frameToMs(endFrame), 5);
    }
  );

  it('keeps buffered input acceptance separate from successor execution', () => {
    const edge = {
      edgeIdentity: 'fixture-buffered-context-edge',
      applied: true,
      inputWindow: {
        startFrame: 86,
        endFrame: 120,
        bridgeType: 0,
        continuousAttackType: 0,
        sourceIdentity: 'fixture:event-bridge-buffer',
      },
      inputScheduling: {
        status: 'applied',
        inputSemantics: 'buffered-until-frame',
        predecessorGenericEndFrame: 120,
        bufferUntilFrame: 120,
        edgeIntent: {
          status: 'applied',
          predecessorGenericEndFrame: 120,
          canonicalInputFrame: 119,
          canonicalExecutionStartFrame: 120,
          canonicalPredecessorEndFrame: 120,
        },
        sourceIdentity: 'fixture:buffered-scheduling',
      },
    };

    const result = resolveVerifiedContextInputScheduling({
      edges: [edge],
      predecessorStartMs: frameToMs(300),
      predecessorEffectiveEndFrame: 120,
      requestedExecutionStartMs: frameToMs(420),
    });

    expect(result).toMatchObject({
      resolutionKind: 'edge-intent-contextual-transition',
      inputSemantics: 'buffered-until-frame',
      inputFrame: 419,
      inputOffsetFrame: 119,
      executionStartFrame: 420,
      executionStartOffsetFrame: 120,
      predecessorEffectiveEndFrame: 420,
      predecessorEffectiveEndOffsetFrame: 120,
    });
  });

  it.each([
    {
      label: '星鸣技',
      sourceControlSkillId: 10101012,
      sourceSubSkillIndex: 0,
      predecessorEffectiveEndFrame: 120,
      requestedFrame: 120,
      expectedInputFrame: 119,
      expectedWindow: [86, 120],
    },
    {
      label: '星决技',
      sourceControlSkillId: 10101013,
      sourceSubSkillIndex: 0,
      predecessorEffectiveEndFrame: 329,
      requestedFrame: 329,
      expectedInputFrame: 328,
      expectedWindow: [295, 329],
    },
    {
      label: '爆发 A3',
      sourceControlSkillId: 10101005,
      sourceSubSkillIndex: 1,
      predecessorEffectiveEndFrame: 72,
      requestedFrame: 72,
      expectedInputFrame: 71,
      expectedWindow: [40, 72],
    },
    {
      label: '极限反击',
      sourceControlSkillId: 10101025,
      sourceSubSkillIndex: 0,
      predecessorEffectiveEndFrame: 60,
      requestedFrame: 60,
      expectedInputFrame: 60,
      expectedWindow: [60, 96],
    },
    {
      label: '普通 A5',
      sourceControlSkillId: 10101005,
      sourceSubSkillIndex: 0,
      predecessorEffectiveEndFrame: 80,
      requestedFrame: 80,
      expectedInputFrame: 80,
      expectedWindow: [37, 102],
    },
  ])(
    'maps edge-to-edge $label intent to a verified input and execution frame',
    ({
      sourceControlSkillId,
      sourceSubSkillIndex,
      predecessorEffectiveEndFrame,
      requestedFrame,
      expectedInputFrame,
      expectedWindow,
    }) => {
      const edges =
        verifiedCombatMechanicsPackage.actionVariantGraph.contextEdges.filter(
          edge =>
            Number(edge.sourceControlSkillId) === sourceControlSkillId &&
            Number(edge.sourceSubSkillIndex) === sourceSubSkillIndex &&
            Number(edge.targetControlSkillId) === 10101010
        );
      const result = resolveVerifiedContextInputScheduling({
        edges,
        predecessorStartMs: 0,
        predecessorEffectiveEndFrame,
        requestedExecutionStartMs: frameToMs(requestedFrame),
      });

      expect(result).toMatchObject({
        resolutionKind:
          requestedFrame === expectedInputFrame
            ? 'direct-input-window'
            : 'edge-intent-contextual-transition',
        inputOffsetFrame: expectedInputFrame,
        executionStartFrame: expectedInputFrame,
        predecessorEffectiveEndFrame: expectedInputFrame,
        inputWindow: {
          startFrame: expectedWindow[0],
          endFrame: expectedWindow[1],
          interval: '[start,end)',
        },
        inputSemantics: 'immediate-interrupt',
      });
    }
  );

  it.each([
    {
      label: '星鸣技',
      sourceControlSkillId: 10101012,
      sourceSubSkillIndex: 0,
      predecessorEffectiveEndFrame: 120,
      frames: [
        [85, false, null],
        [86, true, 86],
        [119, true, 119],
        [120, true, 119],
      ],
    },
    {
      label: '星决技',
      sourceControlSkillId: 10101013,
      sourceSubSkillIndex: 0,
      predecessorEffectiveEndFrame: 329,
      frames: [
        [294, false, null],
        [295, true, 295],
        [328, true, 328],
        [329, true, 328],
      ],
    },
    {
      label: '爆发 A3',
      sourceControlSkillId: 10101005,
      sourceSubSkillIndex: 1,
      predecessorEffectiveEndFrame: 72,
      frames: [
        [0, true, 0],
        [19, true, 19],
        [20, false, null],
        [39, false, null],
        [40, true, 40],
        [71, true, 71],
        [72, true, 71],
      ],
    },
    {
      label: '极限反击',
      sourceControlSkillId: 10101025,
      sourceSubSkillIndex: 0,
      predecessorEffectiveEndFrame: 60,
      frames: [
        [59, false, null],
        [60, true, 60],
        [95, true, 95],
        [96, false, null],
      ],
    },
    {
      label: '普通 A5',
      sourceControlSkillId: 10101005,
      sourceSubSkillIndex: 0,
      predecessorEffectiveEndFrame: 80,
      frames: [
        [36, false, null],
        [37, true, 37],
        [79, true, 79],
        [80, true, 80],
        [101, true, 101],
        [102, false, null],
      ],
    },
  ])(
    'keeps $label source windows half-open while resolving edge intent',
    ({
      sourceControlSkillId,
      sourceSubSkillIndex,
      predecessorEffectiveEndFrame,
      frames,
    }) => {
      const edges =
        verifiedCombatMechanicsPackage.actionVariantGraph.contextEdges.filter(
          edge =>
            Number(edge.sourceControlSkillId) === sourceControlSkillId &&
            Number(edge.sourceSubSkillIndex) === sourceSubSkillIndex &&
            Number(edge.targetControlSkillId) === 10101010
        );

      for (const [
        requestedFrame,
        expectedSelected,
        expectedInputFrame,
      ] of frames) {
        const result = resolveVerifiedContextInputScheduling({
          edges,
          predecessorStartMs: 0,
          predecessorEffectiveEndFrame,
          requestedExecutionStartMs: frameToMs(requestedFrame),
        });
        expect(Boolean(result), `${requestedFrame}F`).toBe(expectedSelected);
        expect(result?.inputOffsetFrame ?? null, `${requestedFrame}F`).toBe(
          expectedInputFrame
        );
      }
    }
  );
});

function createNormalAttackEntry() {
  return {
    skillId: 10101001,
    attackInputSegments: [10101001, 10101002, 10101003, 10101004, 10101005].map(
      (controlSkillId, index) => ({
        identity: `jade-a${index + 1}`,
        sequenceIndex: index + 1,
        sequenceTotal: 5,
        label: `A${index + 1}`,
        controlSkillId,
        selectedSubSkillIndex: 0,
        effectiveDurationFrames: 100 + index,
        durationFrames: 100 + index,
        durationStatus: 'applied',
        durationBasis: 'fixture',
        durationSourceIdentity: `fixture:${controlSkillId}`,
        sourceIdentity: `fixture:${controlSkillId}`,
      })
    ),
  };
}

function createVariantGraph() {
  const stateElementId = 101010129;
  return {
    attackInputChains: [
      {
        chainIdentity: 'jade-default',
        ownerId: 101010,
        sourceSkillId: 10101001,
        stateCondition: {
          kind: 'resource-state-inactive',
          stateElementId,
        },
        segments: [
          [10101001, 0, 20],
          [10101002, 0, 35],
          [10101003, 0, 47],
          [10101004, 0, 30],
          [10101005, 0, 80],
        ].map(([controlSkillId, subSkillIndex, durationFrames], index) => ({
          sequenceIndex: index + 1,
          sequenceTotal: 5,
          controlSkillId,
          subSkillIndex,
          durationFrames,
          sourceIdentity: `fixture:default:${controlSkillId}`,
        })),
        applied: true,
      },
      {
        chainIdentity: 'jade-burst',
        ownerId: 101010,
        sourceSkillId: 10101001,
        stateCondition: {
          kind: 'resource-state-active',
          stateElementId,
        },
        segments: [
          [10101001, 1, 72],
          [10101004, 1, 75],
          [10101005, 1, 72],
        ].map(([controlSkillId, subSkillIndex, durationFrames], index) => ({
          sequenceIndex: index + 1,
          sequenceTotal: 3,
          controlSkillId,
          subSkillIndex,
          durationFrames,
          sourceIdentity: `fixture:burst:${controlSkillId}`,
        })),
        applied: true,
      },
    ],
    contextEdges: [
      {
        edgeIdentity: 'jade-default-a5-heavy',
        ownerId: 101010,
        sourceControlSkillId: 10101005,
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 0,
        inputWindow: {
          startFrame: 37,
          endFrame: 102,
          frameRate: 60,
          bridgeType: 3,
          interruptBehavior: 1,
        },
        condition: {
          kind: 'resource-state-inactive',
          stateElementId,
        },
        applied: true,
      },
      {
        edgeIdentity: 'jade-burst-a5-heavy',
        ownerId: 101010,
        sourceControlSkillId: 10101005,
        sourceSubSkillIndex: 1,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 1,
        inputWindow: {
          startFrame: 0,
          endFrame: 20,
          frameRate: 60,
          bridgeType: 3,
          interruptBehavior: 0,
        },
        condition: {
          kind: 'resource-state-active',
          stateElementId,
        },
        applied: true,
      },
      {
        edgeIdentity: 'jade-burst-a5-heavy-late',
        ownerId: 101010,
        sourceControlSkillId: 10101005,
        sourceSubSkillIndex: 1,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101042,
        targetSubSkillIndex: 1,
        inputWindow: {
          startFrame: 40,
          endFrame: 72,
          frameRate: 60,
          bridgeType: 3,
          interruptBehavior: 1,
        },
        condition: {
          kind: 'resource-state-active',
          stateElementId,
        },
        applied: true,
      },
      {
        edgeIdentity: 'jade-charged-continuation',
        ownerId: 101010,
        sourceControlSkillId: 10101010,
        sourceSubSkillIndex: 0,
        targetControlSkillId: 10101010,
        executionControlSkillId: 10101010,
        targetSubSkillIndex: 1,
        semanticName: '连续重击',
        inputWindow: {
          startFrame: 75,
          endFrame: 105,
          frameRate: 60,
          bridgeType: 3,
          interruptBehavior: 1,
        },
        condition: { kind: 'always' },
        applied: true,
      },
    ],
  };
}
