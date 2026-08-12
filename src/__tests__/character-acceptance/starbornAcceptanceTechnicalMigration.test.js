import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import femaleFixture from '../../../fixtures/character-acceptance/199001-starborn-visual.json';
import maleFixture from '../../../fixtures/character-acceptance/199002-starborn-visual.json';
import femaleRecipe from '../../../scripts/character-acceptance/acceptance-recipes/199001.json';
import maleRecipe from '../../../scripts/character-acceptance/acceptance-recipes/199002.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);

const aliases = [
  {
    ownerId: 199001,
    prefix: 'starborn-f',
    fixture: femaleFixture,
    recipe: femaleRecipe,
    historicalFixtureHash:
      '1bf2cd38db3f23c1a7de28c2e9084ae45d743f11db64166d27721902706c273e',
  },
  {
    ownerId: 199002,
    prefix: 'starborn-m',
    fixture: maleFixture,
    recipe: maleRecipe,
    historicalFixtureHash:
      'e3c2efb7aa997b30cf9a17eabf1dfde3f6db4661415d871fc03687f238e88e20',
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
    'keeps $ownerId visual evidence stale and product signoff pending',
    ({ fixture, recipe, historicalFixtureHash }) => {
      const evidence = recipe.productVisualAcceptance.automatedEvidence[0];
      const actualFixtureHash = createHash('sha256')
        .update(fs.readFileSync(path.join(REPO_ROOT, evidence.fixturePath)))
        .digest('hex');

      expect(recipe.productVisualAcceptance).toMatchObject({
        status: 'pending',
        acceptanceCommit: null,
        recordIdentity: null,
        qualificationSubjectHash: null,
      });
      expect(evidence.fixtureSha256).toBe(historicalFixtureHash);
      expect(evidence.fixtureSha256).not.toBe(actualFixtureHash);
      expect(fixture.metadata.optimizationObjectSourceAliasSelection).toEqual(
        expect.objectContaining({
          optimizationObjectId: 'STARBORN',
        })
      );
      expect(recipe.existingTuningMarkAcceptance).toMatchObject({
        ultimate: { stackDelta: 1 },
        starCarry: { stackDelta: 1 },
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
