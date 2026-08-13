import femaleFixture from '../../../fixtures/character-acceptance/199001-starborn-visual.json';
import maleFixture from '../../../fixtures/character-acceptance/199002-starborn-visual.json';
import femaleRecipe from '../../../scripts/character-acceptance/acceptance-recipes/199001.json';
import maleRecipe from '../../../scripts/character-acceptance/acceptance-recipes/199002.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';

const aliases = [
  {
    ownerId: 199001,
    prefix: 'starborn-f',
    fixture: femaleFixture,
    recipe: femaleRecipe,
    acceptance: {
      recordIdentity:
        'character-product-acceptance:199001:829d628bff9476c489d03e152e9377fd8c8e9e3c:e43c78ab47c7a985',
      qualificationSubjectHash: 'e43c78ab47c7a985',
      scenarioSetHash: 'b8eeecaa1e107312',
      screenshotSha256:
        '8f18d4a83242598d8f9ca37c91a2e1b84cc09dd9172f8bf98c989eb1de86148d',
      supersededFixtureSha256:
        '2b7c00a9c2f78fda7b8321eccc960dddc3ce3bdacecea8dd5de8f22ef15d4b32',
    },
  },
  {
    ownerId: 199002,
    prefix: 'starborn-m',
    fixture: maleFixture,
    recipe: maleRecipe,
    acceptance: {
      recordIdentity:
        'character-product-acceptance:199002:829d628bff9476c489d03e152e9377fd8c8e9e3c:e157122b6c07855a',
      qualificationSubjectHash: 'e157122b6c07855a',
      scenarioSetHash: 'e2122b9dbfb19d2f',
      screenshotSha256:
        'ccd5e509a8347e1b4f87e080627f46fa158a898ac7c63868c6216d615ce3447d',
      supersededFixtureSha256:
        'a1b9741e3cdbc22852d19bc96e953c70372717209962e8092ff1b700e60693ab',
    },
  },
];

describe('STARBORN acceptance technical migration', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it.each(aliases)(
    'replays genuine $ownerId context continuations through service and Workbench',
    ({ ownerId, prefix, fixture }) => {
      const service = createMachineAxisService();
      const adapter = createWorkbenchMachineAxisAdapter({ service });

      expect(fixture.dataIdentity.verifiedMechanicsPackageHash).toBe(
        mechanicsPackage.packageHash
      );
      expect(fixture.scenario.team.map(member => member.characterId)).toEqual([
        ownerId,
        103002,
        101010,
      ]);
      expect(fixture.scenario.team[0].slotId).toBe('slot-1');
      expect(service.validate(fixture).issues).toEqual([]);

      const first = service.simulate(fixture);
      const second = service.simulate(fixture);
      const imported = adapter.importContract(fixture);
      const exported = adapter.exportProject(imported.project, {
        metadata: fixture.metadata,
      });
      const roundTrip = service.simulate(exported);

      expect(second.hashes).toEqual(first.hashes);
      expect(roundTrip.hashes).toEqual(first.hashes);
      expect(imported.canonicalRun.hashes).toEqual(first.hashes);

      const selections = new Map(
        first.trace.variants.selections.map(selection => [
          selection.actionId,
          selection,
        ])
      );
      for (const sequenceIndex of [1, 2, 3, 4, 5]) {
        expect(selections.get(`${prefix}-a${sequenceIndex}`)).toMatchObject({
          controlSkillId: ownerId * 100 + sequenceIndex,
          subSkillIndex: 0,
        });
      }
      expect(selections.get(`${prefix}-charged-derived`)).toMatchObject({
        controlSkillId: ownerId * 100 + 10,
        subSkillIndex: 1,
        sourceKind: 'verified-input-context-variant',
      });
      expect(selections.get(`${prefix}-derived-thrust`)).toMatchObject({
        controlSkillId: ownerId * 100 + 1,
        subSkillIndex: 1,
        sourceKind: 'verified-input-context-variant',
        edgeIdentity: expect.stringContaining(
          `|public-control:${ownerId * 100 + 3}|execution-control:${ownerId * 100 + 1}|`
        ),
      });
      expect(selections.get(`${prefix}-thrust-a3`)).toMatchObject({
        controlSkillId: ownerId * 100 + 3,
        subSkillIndex: 0,
      });
      expect(selections.get(`${prefix}-star-thrust`)).toMatchObject({
        controlSkillId: ownerId * 100 + 1,
        subSkillIndex: 1,
        sourceKind: 'verified-input-context-variant',
        edgeIdentity: expect.stringContaining(
          `|public-control:${ownerId * 100 + 3}|execution-control:${ownerId * 100 + 1}|`
        ),
      });
      expect(selections.get(`${prefix}-star-thrust-a3`)).toMatchObject({
        controlSkillId: ownerId * 100 + 3,
        subSkillIndex: 0,
      });
    },
    60_000
  );

  it.each(aliases)(
    'binds $ownerId visual evidence to the jointly accepted STARBORN object',
    ({ fixture, recipe, acceptance }) => {
      const evidence = recipe.productVisualAcceptance.automatedEvidence[0];
      const supersededEvidence =
        recipe.productVisualAcceptance.supersededAutomatedEvidence[0];

      expect(recipe.productVisualAcceptance).toMatchObject({
        status: 'accepted',
        acceptanceCommit: '829d628bff9476c489d03e152e9377fd8c8e9e3c',
        recordIdentity: acceptance.recordIdentity,
        qualificationSubjectHash: acceptance.qualificationSubjectHash,
        scenarioSetHash: acceptance.scenarioSetHash,
      });
      expect(evidence.screenshotSha256).toBe(acceptance.screenshotSha256);
      expect(supersededEvidence.fixtureSha256).toBe(
        acceptance.supersededFixtureSha256
      );
      expect(fixture.metadata.optimizationObjectSourceAliasSelection).toEqual(
        expect.objectContaining({
          optimizationObjectId: 'STARBORN',
        })
      );
      expect(recipe.existingTuningMarkAcceptance).toMatchObject({
        ultimate: { stackDelta: 1 },
        starCarry: { stackDelta: 1 },
      });
      expect(recipe.optimizationObjectAcceptance).toMatchObject({
        optimizationObjectId: 'STARBORN',
        requiredSourceCharacterIds: [199001, 199002],
        sourceCharacterId: recipe.ownerId,
      });
    }
  );

  it.each(aliases)(
    'rejects $ownerId charged continuation at start minus one',
    ({ ownerId, prefix, fixture }) => {
      const startMinusOne = structuredClone(fixture);
      startMinusOne.actions.push({
        id: `${prefix}-charged-start-minus-one`,
        owner: { kind: 'actor', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId: ownerId * 100 + 1,
          actionKind: 'charged-attack',
          semanticVariant: {
            selectorIdentity: `starborn-${ownerId}-derived-charged`,
            selectorKind: 'input-context',
            publicVariantIndex: 1,
            mode: 'press',
          },
          attackInput: {
            sequenceIndex: 1,
            groupId: `${prefix}-start-minus-one`,
            contextActionId: 'window-before-source',
          },
          level: 1,
        },
        schedule: { mode: 'absolute', frame: 3031 },
      });

      const validation = createMachineAxisService().validate(startMinusOne);
      expect(validation.valid).toBe(false);
      expect(validation.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actionId: `${prefix}-charged-start-minus-one`,
            code: 'machine-axis-action-not-executable',
            reason: 'verified-context-window-input-missing',
            violationCodes: ['VERIFIED_ACTION_CONTEXT_WINDOW_MISSING'],
          }),
        ])
      );
    }
  );
});
