import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import femaleFixture from '../../../fixtures/character-acceptance/199001-starborn-visual.json';
import maleFixture from '../../../fixtures/character-acceptance/199002-starborn-visual.json';
import femaleManifest from '../../../reports/m11/character-acceptance/199001/manifest.json';
import femaleScenarioCases from '../../../reports/m11/character-acceptance/199001/scenario-cases.json';
import maleManifest from '../../../reports/m11/character-acceptance/199002/manifest.json';
import maleScenarioCases from '../../../reports/m11/character-acceptance/199002/scenario-cases.json';
import maleScenarioMatrix from '../../../reports/m11/character-acceptance/199002/scenario-matrix.json';
import objectManifest from '../../../reports/m11/character-acceptance/optimization-objects/STARBORN/manifest.json';
import objectRecipe from '../../../scripts/character-acceptance/optimization-object-recipes/STARBORN.json';
import femaleProfile from '../../data/generated/character-combat-profiles/199001.json';
import maleProfile from '../../data/generated/character-combat-profiles/199002.json';
import {
  inspectOptimizationObjectSourceAliasSelection,
  validateOptimizationObjectAliasAcceptanceBundle,
} from '../../character-acceptance/optimizationObjectAliasProtocol.js';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);

function createSources() {
  return [
    {
      sourceCharacterId: 199001,
      profile: structuredClone(femaleProfile),
      fixture: structuredClone(femaleFixture),
      manifest: structuredClone(femaleManifest),
      scenarioCases: structuredClone(femaleScenarioCases),
    },
    {
      sourceCharacterId: 199002,
      profile: structuredClone(maleProfile),
      fixture: structuredClone(maleFixture),
      manifest: structuredClone(maleManifest),
      scenarioCases: structuredClone(maleScenarioCases),
    },
  ];
}

describe('STARBORN optimization-object alias acceptance closure', () => {
  it('counts one optimization object while retaining and closing both source aliases', () => {
    const validation = validateOptimizationObjectAliasAcceptanceBundle({
      recipe: objectRecipe,
      sources: createSources(),
    });

    expect(validation.valid).toBe(true);
    expect(validation.bundle).toEqual(objectManifest);
    expect(validation.bundle.summary).toEqual({
      optimizationObjectCount: 1,
      sourceAliasCount: 2,
      requirementCount: 607,
      requiredCount: 354,
      passedCount: 354,
      notApplicableCount: 253,
      blockedCount: 0,
      sourceGapCount: 0,
      acceptanceGapCount: 0,
      scenarioCount: 4,
      scenarioPassedCount: 4,
      assertionCount: 1569,
      assertionPassedCount: 1569,
    });
    expect(validation.bundle).toMatchObject({
      status: 'runtime-integrated-product-visual-pending',
      formalAdmission: false,
      optimizationReady: false,
      productVisualAcceptance: 'pending',
    });
  });

  it('rejects a single-alias bundle instead of closing the unified object', () => {
    const validation = validateOptimizationObjectAliasAcceptanceBundle({
      recipe: objectRecipe,
      sources: createSources().slice(0, 1),
    });

    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'optimization-object-source-alias-coverage-incomplete',
        }),
      ])
    );
  });

  it('rejects selecting both aliases on one axis and any cross-alias action', () => {
    const bothAliases = structuredClone(femaleFixture);
    bothAliases.scenario.team[1].characterId = 199002;
    const bothInspection = inspectOptimizationObjectSourceAliasSelection({
      configuration: {
        optimizationObjectId: 'STARBORN',
        requiredSourceCharacterIds: [199001, 199002],
        sourceCharacterId: 199001,
        sourceAliasIdentity: 'STARBORN:source-alias:199001',
      },
      fixture: bothAliases,
      profile: femaleProfile,
    });
    expect(bothInspection.passed).toBe(false);
    expect(bothInspection.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'optimization-object-axis-source-alias-cardinality-invalid',
        }),
      ])
    );

    const crossAliasAction = structuredClone(femaleFixture);
    crossAliasAction.actions[0].intent.publicActionId = 19900222;
    const actionInspection = inspectOptimizationObjectSourceAliasSelection({
      configuration: {
        optimizationObjectId: 'STARBORN',
        requiredSourceCharacterIds: [199001, 199002],
        sourceCharacterId: 199001,
        sourceAliasIdentity: 'STARBORN:source-alias:199001',
      },
      fixture: crossAliasAction,
      profile: femaleProfile,
    });
    expect(actionInspection.passed).toBe(false);
    expect(actionInspection.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'optimization-object-axis-cross-alias-action-contamination',
        }),
      ])
    );
  });

  it('rejects cross-alias trace continuation and merged alias hashes', () => {
    const contaminated = createSources();
    const femaleMachineScenario = contaminated[0].scenarioCases.records.find(
      record => record.runnerKind === 'machine-axis'
    );
    femaleMachineScenario.traceProjection.attackInputChains[0].ownerId = 199002;
    expect(
      validateOptimizationObjectAliasAcceptanceBundle({
        recipe: objectRecipe,
        sources: contaminated,
      }).issues
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'optimization-object-cross-alias-trace-contamination',
        }),
      ])
    );

    const merged = createSources();
    merged[1].profile.profileHash = merged[0].profile.profileHash;
    merged[1].fixture.metadata.optimizationObjectSourceAliasSelection.profileHash =
      merged[0].profile.profileHash;
    expect(
      validateOptimizationObjectAliasAcceptanceBundle({
        recipe: objectRecipe,
        sources: merged,
      }).issues
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'optimization-object-alias-hash-merge',
          path: 'sourceAliases.profileHash',
        }),
      ])
    );
  });

  it('keeps profile, input, data, trace, and build identities distinct by selected alias', () => {
    const aliases = objectManifest.sourceAliases;
    for (const pathKey of [
      'profileHash',
      'sourceContractHash',
      'selectionHash',
      'traceProjectionHash',
    ]) {
      expect(new Set(aliases.map(alias => alias[pathKey])).size).toBe(2);
    }
    for (const hashKey of ['input', 'data', 'trace', 'build']) {
      expect(
        new Set(aliases.map(alias => alias.canonicalHashes[hashKey])).size
      ).toBe(2);
    }
  });

  it('keeps miss, blocked, interruption, resource, cooldown, and right-open boundaries machine-backed', () => {
    for (const scenarioCases of [femaleScenarioCases, maleScenarioCases]) {
      const scenario = scenarioCases.records.find(
        record => record.runnerKind === 'machine-axis'
      );
      expect(scenario.execution).toMatchObject({
        status: 'passed',
        stableReplay: true,
        workbenchRoundTrip: 'passed',
      });
      for (const factIdentity of [
        'blocked-hit-suppresses-damage',
        'buff-apply-refresh-stack-expire',
        'condition-insufficient-negative',
        'critical:missSuppressesHit',
        'interruption-boundary-late-hit-suppressed',
        'resource-exact-and-insufficient',
        'star-carry-cooldown-before-expiry-rejected',
        'star-carry-cooldown-exact-right-open',
      ]) {
        expect(scenario.traceProjection.facts[factIdentity]).toBe(true);
      }
      const buffLifecycle = scenario.assertions.find(
        assertion =>
          assertion.assertionIdentity === 'buff-apply-refresh-stack-expire'
      );
      expect(buffLifecycle.status).toBe('passed');
      expect(buffLifecycle.actual.rightOpenMatches).toEqual([
        expect.objectContaining({ passed: true, duration: 1440 }),
      ]);
      const exactCooldown = scenario.assertions.find(
        assertion =>
          assertion.assertionIdentity === 'star-carry-cooldown-exact-right-open'
      );
      expect(exactCooldown.status).toBe('passed');
      expect(
        exactCooldown.actual.probeResults.every(probe => probe.passed)
      ).toBe(true);
    }
  });

  it('does not carry actions, resources, states, chains, or switches across aliases', () => {
    const runtimeIsolationKeys = [
      'publicActions',
      'actionForms',
      'attackInputChains',
      'variantEdges',
      'inputVariantSelectors',
      'runtimeEffectBindings',
      'resourceProfiles',
      'resourceTransactions',
      'stateMachines',
      'targetStateProfiles',
      'targetStateTransactions',
      'conditionalHitGroups',
      'tuningMarkConditionalDamageGroups',
      'passives',
      'switchTriggers',
    ];
    const femaleRuntime = JSON.stringify(
      Object.fromEntries(
        runtimeIsolationKeys.map(key => [key, femaleProfile.contracts[key]])
      )
    );
    const maleRuntime = JSON.stringify(
      Object.fromEntries(
        runtimeIsolationKeys.map(key => [key, maleProfile.contracts[key]])
      )
    );
    expect(femaleRuntime).not.toContain('199002');
    expect(maleRuntime).not.toContain('199001');

    const dormantCrossAliasWindow = maleScenarioMatrix.requirements.find(
      requirement =>
        requirement.dimension === 'control-window' &&
        requirement.scenarioScope?.targetControlSkillId === 19900115
    );
    expect(dormantCrossAliasWindow).toMatchObject({
      required: false,
      status: 'not-applicable',
      sourceDisposition: 'not-applicable',
      scenarioScope: {
        disposition: 'not-applicable',
        policyIdentity: 'm12c-zero-distance-passive-boss-v1',
        controlSkillId: 19900224,
        targetControlSkillId: 19900115,
      },
    });
  });

  it('keeps shared production primitives free of source-alias id or name special cases', () => {
    const sharedPaths = [
      'scripts/character-combat/character-combat-contract-compiler.mjs',
      'scripts/generate-character-acceptance.mjs',
      'src/character-acceptance/optimizationObjectAliasProtocol.js',
      'src/simulation/mechanics/verifiedTargetStateRuntime.js',
    ];
    for (const relativePath of sharedPaths) {
      const contents = fs.readFileSync(
        path.join(REPO_ROOT, relativePath),
        'utf8'
      );
      expect(contents).not.toMatch(/199001|199002|STARBORN|女主角|男主角/);
    }
    const pipelineContents = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'scripts/character-combat/character-combat-profile-pipeline.mjs'
      ),
      'utf8'
    );
    const aliasPipelineLines = pipelineContents
      .split(/\r?\n/)
      .filter(line => /optimizationObject|sourceAliasIdentity/.test(line))
      .join('\n');
    expect(aliasPipelineLines).not.toMatch(
      /199001|199002|STARBORN|女主角|男主角/
    );
  });
});
