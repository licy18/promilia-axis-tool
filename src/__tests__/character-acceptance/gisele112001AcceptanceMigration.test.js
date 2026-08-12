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
