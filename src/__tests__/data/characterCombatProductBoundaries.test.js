import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  UNNAMED_SECONDARY_PASSIVE_REASON,
  applyCharacterCombatProductBoundaries,
  assertUnnamedSecondaryPassiveRuntimeIsolation,
  discoverUnnamedSecondaryPassiveBoundaries,
} from '../../../scripts/character-combat/character-combat-product-boundaries.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const characters = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'data', 'generated', 'characters.json'),
    'utf8'
  )
);
const workbenchSeed = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'data', 'generated', 'workbench-seed.json'),
    'utf8'
  )
);

describe('character combat product boundaries', () => {
  it('identifies every current-client unnamed second passive by slot order and missing localization', () => {
    const report = discoverUnnamedSecondaryPassiveBoundaries({
      characterCatalog: characters,
      skills: workbenchSeed.gameData.skills,
    });

    expect(report).toMatchObject({
      status: 'unnamed-secondary-passive-boundary-ready',
      policy: {
        numericSuffixIsNotEvidence: true,
        descriptionRemainsAuditable: true,
        reason: UNNAMED_SECONDARY_PASSIVE_REASON,
      },
      summary: {
        publicCharacterCount: 20,
        matchedCharacterCount: 20,
        implementedCharacterCount: 0,
        notApplicableCharacterCount: 20,
        unresolvedCharacterCount: 0,
      },
    });
    expect(report.summary.matchedSkillIds).toEqual([
      10100362, 10100762, 10101062, 10200162, 10300262, 10700162, 10700262,
      10700362, 10800162, 10800262, 10800362, 10800562, 10900162, 10900262,
      11100162, 11200162, 11200262, 19900162, 19900262, 19900362,
    ]);
    expect(
      report.entries.every(
        entry =>
          entry.passiveSlotIndex === 1 &&
          entry.name == null &&
          entry.displayName == null &&
          Object.hasOwn(entry.description, 'plain') &&
          entry.primaryPassive.name &&
          entry.runtimeContractPolicy.passiveProfile === false &&
          entry.runtimeContractPolicy.listener === false &&
          entry.runtimeContractPolicy.effectBinding === false &&
          entry.runtimeContractPolicy.captureRequirement === false
      )
    ).toBe(true);
  });

  it('retains a source-closed secondary passive as an auditable runtime contract', () => {
    const report = discoverUnnamedSecondaryPassiveBoundaries({
      characterCatalog: characters,
      skills: workbenchSeed.gameData.skills,
      implementedPassiveSkillIds: new Set([10800362]),
    });
    const implemented = report.entries.find(entry => entry.skillId === 10800362);

    expect(report.summary).toMatchObject({
      implementedCharacterCount: 1,
      notApplicableCharacterCount: 19,
    });
    expect(implemented).toMatchObject({
      ownerId: 108003,
      classification: 'implemented',
      reason: null,
      runtimeContractPolicy: {
        passiveProfile: true,
        listener: false,
        effectBinding: true,
        captureRequirement: true,
        gameplayImpactingGap: false,
      },
    });
    expect(() =>
      assertUnnamedSecondaryPassiveRuntimeIsolation({
        recipes: [
          {
            ownerId: 108003,
            compiler: { passiveEffects: [{ skillId: 10800362 }] },
          },
        ],
        ownerCompilations: [
          {
            ownerId: 108003,
            contracts: {
              passiveEffects: [{ skillId: 10800362 }],
              targetStateTransactions: [],
            },
          },
        ],
        mechanicsPackage: {
          specialResourceCatalog: {
            passiveEffects: [{ ownerId: 108003, skillId: 10800362 }],
          },
        },
        boundaryReport: report,
      })
    ).not.toThrow();
  });

  it('removes an unnamed secondary passive from compilation and gap inputs while retaining its audit record', () => {
    const report = discoverUnnamedSecondaryPassiveBoundaries({
      characterCatalog: characters,
      skills: workbenchSeed.gameData.skills,
    });
    const [recipe] = applyCharacterCombatProductBoundaries({
      boundaryReport: report,
      recipes: [
        {
          ownerId: 103002,
          mechanicsDiscovery: {
            passiveSkillIds: [10300261, 10300262],
          },
          compiler: {
            reachableControlSkillIds: [10300201, 10300261, 10300262],
            passiveEffects: [{ skillId: 10300261 }, { skillId: 10300262 }],
            targetStateTransactions: [
              { transactionIdentity: 'implemented', passiveSkillId: 10300261 },
              {
                transactionIdentity: 'not-implemented',
                passiveSkillId: 10300262,
              },
            ],
          },
          runtimePolicies: {
            controlPolicies: [
              { controlSkillId: 10300261 },
              { controlSkillId: 10300262 },
            ],
          },
          unresolvedRecords: [
            {
              identity: 'actor:103002:passive:10300262',
              status: 'static-evidence-gap',
            },
          ],
        },
      ],
    });

    expect(recipe.mechanicsDiscovery.passiveSkillIds).toEqual([10300261]);
    expect(recipe.compiler.reachableControlSkillIds).toEqual([
      10300201, 10300261,
    ]);
    expect(recipe.compiler.passiveEffects).toEqual([{ skillId: 10300261 }]);
    expect(recipe.compiler.targetStateTransactions).toEqual([
      { transactionIdentity: 'implemented', passiveSkillId: 10300261 },
    ]);
    expect(recipe.runtimePolicies.controlPolicies).toEqual([
      { controlSkillId: 10300261 },
    ]);
    expect(recipe.unresolvedRecords).toEqual([]);
    expect(recipe.notApplicableSkills).toEqual([
      expect.objectContaining({
        skillId: 10300262,
        reason: UNNAMED_SECONDARY_PASSIVE_REASON,
      }),
    ]);
    expect(recipe.productBoundaries[0].description.plain).toContain('暴击率');
  });

  it('rejects any compiled or published runtime contract for a matched passive', () => {
    const boundaryReport = {
      entries: [{ ownerId: 103002, skillId: 10300262 }],
    };
    expect(() =>
      assertUnnamedSecondaryPassiveRuntimeIsolation({
        recipes: [],
        ownerCompilations: [
          {
            ownerId: 103002,
            contracts: {
              passiveEffects: [{ skillId: 10300262 }],
              targetStateTransactions: [],
            },
          },
        ],
        mechanicsPackage: {},
        boundaryReport,
      })
    ).toThrow('unnamed secondary passive runtime isolation failed');
  });

  it('allows an explicitly implemented unnamed secondary passive while retaining isolation for excluded entries', () => {
    const boundaryReport = {
      entries: [
        {
          ownerId: 102001,
          skillId: 10200162,
          classification: 'implemented',
        },
        {
          ownerId: 103002,
          skillId: 10300262,
          classification: 'not-applicable',
        },
      ],
    };

    expect(() =>
      assertUnnamedSecondaryPassiveRuntimeIsolation({
        recipes: [
          {
            ownerId: 102001,
            compiler: { passiveEffects: [{ skillId: 10200162 }] },
          },
        ],
        ownerCompilations: [
          {
            ownerId: 102001,
            contracts: {
              passiveEffects: [{ skillId: 10200162 }],
              targetStateTransactions: [],
            },
          },
        ],
        mechanicsPackage: {
          specialResourceCatalog: {
            passiveEffects: [{ ownerId: 102001, skillId: 10200162 }],
          },
        },
        boundaryReport,
      })
    ).not.toThrow();
  });
});
