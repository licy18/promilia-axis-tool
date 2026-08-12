import giseleFixture from '../../../fixtures/character-acceptance/112001-visual.json';
import giseleRecipe from '../../../scripts/character-acceptance/acceptance-recipes/112001.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';

const MAIN_CHAIN_ACTION_IDS = [
  'gisele-heavy3-a1',
  'gisele-heavy3-a2',
  'gisele-heavy3-a3',
  'gisele-a4',
];

function findSelection(run, actionId) {
  return (run.trace?.variants?.selections ?? []).find(
    selection => selection.actionId === actionId
  );
}

function createIsolatedContract(isolatedCase) {
  const contract = structuredClone(giseleFixture);
  contract.actions = structuredClone(isolatedCase.actions);
  contract.scenario.id += '--isolated--' + isolatedCase.identity;
  contract.scenario.durationFrames = isolatedCase.durationFrames;
  return contract;
}

describe('M12-C 112001 acceptance normal-input migration', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('replaces the direct A4 shortcut with a complete A1-A4 chain without moving heavy3', () => {
    const actions = [...MAIN_CHAIN_ACTION_IDS, 'gisele-heavy3-threshold67'].map(
      actionId => giseleFixture.actions.find(action => action.id === actionId)
    );

    expect(
      actions.map(action => ({
        actionId: action.id,
        frame: action.schedule.frame,
        sequenceIndex: action.intent.attackInput.sequenceIndex,
        groupId: action.intent.attackInput.groupId,
        contextActionId: action.intent.attackInput.contextActionId ?? null,
      }))
    ).toEqual([
      {
        actionId: 'gisele-heavy3-a1',
        frame: 364,
        sequenceIndex: 1,
        groupId: 'gisele-heavy3-chain',
        contextActionId: null,
      },
      {
        actionId: 'gisele-heavy3-a2',
        frame: 382,
        sequenceIndex: 2,
        groupId: 'gisele-heavy3-chain',
        contextActionId: 'gisele-heavy3-a1',
      },
      {
        actionId: 'gisele-heavy3-a3',
        frame: 437,
        sequenceIndex: 3,
        groupId: 'gisele-heavy3-chain',
        contextActionId: 'gisele-heavy3-a2',
      },
      {
        actionId: 'gisele-a4',
        frame: 500,
        sequenceIndex: 4,
        groupId: 'gisele-heavy3-chain',
        contextActionId: 'gisele-heavy3-a3',
      },
      {
        actionId: 'gisele-heavy3-threshold67',
        frame: 536,
        sequenceIndex: 1,
        groupId: 'gisele-heavy3-threshold67',
        contextActionId: 'gisele-a4',
      },
    ]);

    const service = createMachineAxisService();
    expect(service.validate(giseleFixture)).toMatchObject({
      valid: true,
      issues: [],
    });
    const run = service.simulate(giseleFixture);

    expect(
      MAIN_CHAIN_ACTION_IDS.map(actionId => findSelection(run, actionId))
    ).toEqual([
      expect.objectContaining({ controlSkillId: 11200101, subSkillIndex: 0 }),
      expect.objectContaining({ controlSkillId: 11200102, subSkillIndex: 0 }),
      expect.objectContaining({ controlSkillId: 11200103, subSkillIndex: 0 }),
      expect.objectContaining({ controlSkillId: 11200104, subSkillIndex: 0 }),
    ]);
    expect(findSelection(run, 'gisele-heavy3-threshold67')).toMatchObject({
      controlSkillId: 11200141,
      subSkillIndex: 3,
      semanticName: '特殊重击3完全释放',
    });
  }, 60_000);

  it.each([
    ['heavy3-release-66f-old-tier', 66, 2, '特殊重击3提前释放'],
    ['heavy3-release-68f-unique-new-tier', 68, 3, '特殊重击3完全释放'],
  ])(
    'keeps %s on its verified release tier behind a complete A1-A4 chain',
    (identity, suffix, expectedSubSkillIndex, semanticName) => {
      const isolatedCase = giseleRecipe.isolatedActionCases.find(
        candidate => candidate.identity === identity
      );
      const actionIds = [1, 2, 3, 4].map(
        sequenceIndex => `isolated-heavy3-context-a${sequenceIndex}-${suffix}`
      );

      expect(
        actionIds.map(actionId => {
          const action = isolatedCase.actions.find(
            candidate => candidate.id === actionId
          );
          return [
            action.schedule.frame,
            action.intent.attackInput.sequenceIndex,
            action.intent.attackInput.contextActionId ?? null,
          ];
        })
      ).toEqual([
        [0, 1, null],
        [18, 2, actionIds[0]],
        [73, 3, actionIds[1]],
        [136, 4, actionIds[2]],
      ]);

      const heavyActionId = `isolated-heavy3-release-${suffix}`;
      const heavyAction = isolatedCase.actions.find(
        action => action.id === heavyActionId
      );
      expect(heavyAction).toMatchObject({
        schedule: { mode: 'absolute', frame: 172 },
        intent: {
          semanticVariant: { inputFrame: suffix },
          attackInput: { contextActionId: actionIds[3] },
        },
      });

      const contract = createIsolatedContract(isolatedCase);
      const service = createMachineAxisService();
      expect(service.validate(contract)).toMatchObject({
        valid: true,
        issues: [],
      });
      const run = service.simulate(contract);
      expect(findSelection(run, heavyActionId)).toMatchObject({
        controlSkillId: 11200141,
        subSkillIndex: expectedSubSkillIndex,
        semanticName,
      });
    },
    60_000
  );

  it('keeps every critical mode on the same legal A1 hit after exact recovery boundaries', () => {
    const isolatedCase = giseleRecipe.isolatedActionCases.find(
      candidate =>
        candidate.identity ===
        'critical-five-percent-integer-boundary-and-hit-modes'
    );
    const actionIds = [
      'isolated-critical-sampled-low',
      'isolated-critical-sampled-boundary',
      'isolated-critical-expected',
      'isolated-critical-forced-critical',
      'isolated-critical-forced-non-critical',
      'isolated-critical-miss',
    ];

    expect(isolatedCase.durationFrames).toBe(1400);
    expect(isolatedCase.initialRuntimeState).toMatchObject({
      specialResourcesByActor: [],
      kiboEnergyBySlot: [],
      tuningMarks: [],
      activeEffects: [
        {
          effectId: 'protocol:112001:critical-five-percent',
          sourceActorId: 'actor-112001',
          targetId: 'actor-112001',
          remainingDurationMs: 20000,
          stacks: 1,
          maxStacks: 1,
          modifiers: [],
          sourceStatus: 'product-assumption-acceptance-fixture',
          appliedToCalculators: true,
        },
      ],
    });
    expect(
      actionIds.map(actionId => {
        const action = isolatedCase.actions.find(
          candidate => candidate.id === actionId
        );
        return {
          actionId,
          frame: action.schedule.frame,
          sequenceIndex: action.intent.attackInput.sequenceIndex,
          hitOverride:
            action.hitOverrides[
              '11200101|0|elements|0|-7332396199243874878|8|1'
            ],
        };
      })
    ).toEqual([
      {
        actionId: 'isolated-critical-sampled-low',
        frame: 0,
        sequenceIndex: 1,
        hitOverride: {
          landed: 'hit',
          criticalMode: 'sampled',
          criticalRoll: 499,
        },
      },
      {
        actionId: 'isolated-critical-sampled-boundary',
        frame: 230,
        sequenceIndex: 1,
        hitOverride: {
          landed: 'hit',
          criticalMode: 'sampled',
          criticalRoll: 500,
        },
      },
      {
        actionId: 'isolated-critical-expected',
        frame: 460,
        sequenceIndex: 1,
        hitOverride: { landed: 'hit', criticalMode: 'expected' },
      },
      {
        actionId: 'isolated-critical-forced-critical',
        frame: 690,
        sequenceIndex: 1,
        hitOverride: { landed: 'hit', criticalMode: 'critical' },
      },
      {
        actionId: 'isolated-critical-forced-non-critical',
        frame: 920,
        sequenceIndex: 1,
        hitOverride: { landed: 'hit', criticalMode: 'non-critical' },
      },
      {
        actionId: 'isolated-critical-miss',
        frame: 1150,
        sequenceIndex: 1,
        hitOverride: { landed: 'miss', criticalMode: 'critical' },
      },
    ]);
    expect(
      isolatedCase.probes.map(probe => ({
        assertionIdentity: probe.assertionIdentity,
        where: probe.where,
        expectation: probe.expectation,
      }))
    ).toEqual([
      {
        assertionIdentity: 'critical-499-is-below-five-percent-threshold',
        where: expect.objectContaining({
          actionId: 'isolated-critical-sampled-low',
          'formula.randomBranch.criticalRoll': 499,
          'formula.randomBranch.criticalThreshold': 500,
          'formula.randomBranch.critical': true,
        }),
        expectation: { count: 1 },
      },
      {
        assertionIdentity: 'critical-500-is-right-open-threshold-boundary',
        where: expect.objectContaining({
          actionId: 'isolated-critical-sampled-boundary',
          'formula.randomBranch.criticalRoll': 500,
          'formula.randomBranch.criticalThreshold': 500,
          'formula.randomBranch.critical': false,
        }),
        expectation: { count: 1 },
      },
      {
        assertionIdentity: 'critical-expected-mode-does-not-materialize-event',
        where: expect.objectContaining({
          actionId: 'isolated-critical-expected',
          'formula.randomBranch.mode': 'expected',
          'formula.verifiedResult.expectedCritical.criticalEventMaterialized': false,
        }),
        expectation: { count: 1 },
      },
      {
        assertionIdentity: 'critical-forced-critical-mode-is-honored',
        where: expect.objectContaining({
          actionId: 'isolated-critical-forced-critical',
          'formula.randomBranch.mode': 'critical',
          'formula.randomBranch.critical': true,
        }),
        expectation: { count: 1 },
      },
      {
        assertionIdentity: 'critical-forced-non-critical-mode-is-honored',
        where: expect.objectContaining({
          actionId: 'isolated-critical-forced-non-critical',
          'formula.randomBranch.mode': 'non-critical',
          'formula.randomBranch.critical': false,
        }),
        expectation: { count: 1 },
      },
      {
        assertionIdentity: 'critical-miss-does-not-materialize-damage',
        where: expect.objectContaining({
          actionId: 'isolated-critical-miss',
          eventType: 'VERIFIED_COMBAT_HIT',
        }),
        expectation: { count: 0 },
      },
    ]);

    const contract = createIsolatedContract(isolatedCase);
    const service = createMachineAxisService();
    expect(service.validate(contract)).toMatchObject({
      valid: true,
      issues: [],
    });
    const first = service.simulate(contract);
    const second = service.simulate(contract);
    expect(second.hashes).toEqual(first.hashes);

    expect(actionIds.map(actionId => findSelection(first, actionId))).toEqual(
      actionIds.map(() =>
        expect.objectContaining({
          controlSkillId: 11200101,
          subSkillIndex: 0,
          sourceKind: 'verified-normal-attack-idle',
        })
      )
    );

    const criticalHits = (first.trace?.damage ?? []).filter(
      event =>
        actionIds.includes(event.actionId) &&
        event.eventType === 'VERIFIED_COMBAT_HIT'
    );
    expect(
      criticalHits.map(event => [
        event.actionId,
        event.absoluteFrame,
        event.hitIdentity,
        event.formula.randomBranch.mode,
        event.formula.randomBranch.criticalRoll,
      ])
    ).toEqual([
      [
        'isolated-critical-sampled-low',
        8,
        '11200101|0|elements|0|-7332396199243874878|8|1',
        'captured-critical-roll',
        499,
      ],
      [
        'isolated-critical-sampled-boundary',
        238,
        '11200101|0|elements|0|-7332396199243874878|8|1',
        'captured-critical-roll',
        500,
      ],
      [
        'isolated-critical-expected',
        468,
        '11200101|0|elements|0|-7332396199243874878|8|1',
        'expected',
        null,
      ],
      [
        'isolated-critical-forced-critical',
        698,
        '11200101|0|elements|0|-7332396199243874878|8|1',
        'critical',
        null,
      ],
      [
        'isolated-critical-forced-non-critical',
        928,
        '11200101|0|elements|0|-7332396199243874878|8|1',
        'non-critical',
        null,
      ],
    ]);
    expect(
      criticalHits.some(event => event.actionId === 'isolated-critical-miss')
    ).toBe(false);
    expect(
      (first.trace?.variants?.resourceEvents ?? []).filter(event =>
        actionIds.includes(event.actionId)
      )
    ).toEqual([]);
    expect(
      (first.trace?.effects?.events ?? []).filter(event =>
        actionIds.includes(event.actionId)
      )
    ).toEqual([]);
  }, 60_000);

  it('keeps product visual acceptance pending for a fresh evidence replay', () => {
    expect(giseleRecipe.productVisualAcceptance).toMatchObject({
      status: 'pending',
      acceptanceCommit: null,
      recordIdentity: null,
      qualificationSubjectHash: null,
      scenarioSetHash: null,
      automatedEvidence: [
        expect.objectContaining({
          fixtureSha256:
            'abab0b4b2e508611a2515612de1fd200f83320b8c81a6f47c46a42a3467f725b',
        }),
      ],
    });
  });
});
