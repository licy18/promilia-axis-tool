import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import characterCatalog from '../../data/generated/characters.json';
import { applyCharacterCombatAttackInputPhaseMappings } from '../../../scripts/character-combat/character-combat-contract-compiler.mjs';
import {
  createCharacterCombatProductionBuild,
  discoverCharacterCombatRecipes,
} from '../../../scripts/character-combat/character-combat-production-orchestrator.mjs';

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('character combat production orchestration', () => {
  it('publishes a declarative default attack phase without owner-specific compiler branches', () => {
    const mechanicsPackage = {
      actionMappings: [
        {
          ownerId: 990001,
          sourceSkillId: 99000101,
          actionKind: 'normal-attack',
          attackInputSegments: [
            {
              controlSkillId: 99000101,
              selectedSubSkillIndex: 0,
              durationFrames: 20,
            },
            {
              controlSkillId: 99000102,
              selectedSubSkillIndex: 0,
              durationFrames: 30,
            },
            {
              controlSkillId: 99000103,
              selectedSubSkillIndex: 0,
              durationFrames: 40,
            },
          ],
        },
      ],
    };
    applyCharacterCombatAttackInputPhaseMappings({
      mechanicsPackage,
      compilations: [
        {
          ownerId: 990001,
          contracts: {
            attackInputChains: [
              {
                chainIdentity: 'fixture-default-two-inputs',
                sourceSkillId: 99000101,
                entryPolicy: { kind: 'default' },
                sourceIdentity: 'fixture:default-phase',
                segments: [
                  {
                    sequenceIndex: 1,
                    controlSkillId: 99000101,
                    subSkillIndex: 0,
                    durationFrames: 20,
                    semanticName: 'Fixture A1',
                    sourceIdentity: 'fixture:a1',
                    status: 'applied',
                  },
                  {
                    sequenceIndex: 2,
                    controlSkillId: 99000102,
                    subSkillIndex: 0,
                    durationFrames: 30,
                    semanticName: 'Fixture A2',
                    sourceIdentity: 'fixture:a2',
                    status: 'applied',
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(mechanicsPackage.actionMappings[0]).toMatchObject({
      attackInputChainIdentity: 'fixture-default-two-inputs',
      attackInputPhaseStatus:
        'character-combat-default-attack-phase-applied',
    });
    expect(
      mechanicsPackage.actionMappings[0].attackInputSegments.map(segment => [
        segment.semanticName,
        segment.controlSkillId,
        segment.durationFrames,
      ])
    ).toEqual([
      ['Fixture A1', 99000101, 20],
      ['Fixture A2', 99000102, 30],
    ]);
    expect(
      mechanicsPackage.actionMappings[0].attackInputSourceSegments
    ).toHaveLength(3);
  });

  it('discovers and compiles two non-empty recipes through package, runtime, profile, and catalog', async () => {
    const recipeRoot = createTemporaryRoot();
    const ownerA = 101010;
    const ownerB = 103002;
    writeRecipe(recipeRoot, createSyntheticRecipe(ownerA, 10101012));
    writeRecipe(recipeRoot, createSyntheticRecipe(ownerB, 10300212));
    const recipes = discoverCharacterCombatRecipes({ recipeRoot });
    const controls = [
      createSyntheticControl(ownerA, 10101012),
      createSyntheticControl(ownerB, 10300212),
    ];
    const semanticEffects = [
      createSyntheticSemanticEffect(ownerA),
      createSyntheticSemanticEffect(ownerB),
    ];

    const build = await createCharacterCombatProductionBuild({
      recipes,
      characterCatalog,
      skills: [],
      compilerEvidence: {
        controls,
        specialResourceProfiles: [],
        specialResourceOperations: [],
        skills: [],
      },
      compilerOperators: createSyntheticCompilerOperators(),
      actionVariantGraph: createEmptyVariantGraph(),
      specialResourceCatalog: createEmptyResourceCatalog(),
      createMechanicsPackage: ({ ownerCompilations }) => ({
        mechanicsPackage: createSyntheticMechanicsPackage({
          ownerCompilations,
          controls,
        }),
        sharedContext: {
          semanticEffectCatalog: { semanticEffects },
        },
      }),
      createGoldenRuntimeForOwner: async ({ ownerId }) =>
        createSyntheticGoldenRuntime(ownerId),
      createReportsForOwner: () => ({}),
      createStatDependenciesForOwner: () => ({ static: [], dynamic: [] }),
    });

    expect(build.recipes.map(recipe => Number(recipe.ownerId))).toEqual([
      ownerA,
      ownerB,
    ]);
    expect(build.ownerCompilations.map(item => item.ownerId)).toEqual([
      ownerA,
      ownerB,
    ]);
    expect(build.ownerRuntimeContracts.map(item => item.ownerId)).toEqual([
      ownerA,
      ownerB,
    ]);
    expect(
      build.mechanicsPackage.actionVariantGraph.publicActionForms.map(
        item => item.ownerId
      )
    ).toEqual([ownerA, ownerB]);
    expect(build.pipelineArtifacts.profiles.map(item => item.owner.ownerId)).toEqual([
      ownerA,
      ownerB,
    ]);
    expect(
      build.pipelineArtifacts.catalog.profiles.map(item => item.ownerId)
    ).toEqual([ownerA, ownerB]);
    expect(
      build.ownerRuntimeContracts.find(item => item.ownerId === ownerB)
        .contracts.actionForms
    ).toEqual([
      expect.objectContaining({
        ownerId: ownerB,
        executionControlSkillId: 10300212,
        status: 'applied',
      }),
    ]);
    expect(
      build.ownerRuntimeContracts.find(item => item.ownerId === ownerB)
        .contracts.effects.semantic
    ).toEqual([createSyntheticSemanticEffect(ownerB)]);
  });

  it('rebuilds the same owner contract without reading an existing generated contract file', async () => {
    const recipeRoot = createTemporaryRoot();
    const ownerId = 101010;
    const recipe = createSyntheticRecipe(ownerId, 10101012);
    writeRecipe(recipeRoot, recipe);
    const controls = [createSyntheticControl(ownerId, 10101012)];
    const generatedRoot = createTemporaryRoot();
    const compile = () =>
      createCharacterCombatProductionBuild({
        recipes: discoverCharacterCombatRecipes({ recipeRoot }),
        characterCatalog,
        skills: [],
        compilerEvidence: {
          controls,
          specialResourceProfiles: [],
          specialResourceOperations: [],
          skills: [],
        },
        compilerOperators: createSyntheticCompilerOperators(),
        actionVariantGraph: createEmptyVariantGraph(),
        specialResourceCatalog: createEmptyResourceCatalog(),
        createMechanicsPackage: ({ ownerCompilations }) =>
          createSyntheticMechanicsPackage({ ownerCompilations, controls }),
        createGoldenRuntimeForOwner: async ({ ownerId }) =>
          createSyntheticGoldenRuntime(ownerId),
        createReportsForOwner: () => ({}),
        createStatDependenciesForOwner: () => ({ static: [], dynamic: [] }),
      });

    const first = await compile();
    const staleContractPath = path.join(
      generatedRoot,
      `${ownerId}-stale-owner-contract.json`
    );
    fs.writeFileSync(staleContractPath, '{"contractHash":"tampered"}\n', 'utf8');
    const second = await compile();

    expect(second.ownerCompilations[0].contractHash).toBe(
      first.ownerCompilations[0].contractHash
    );
    expect(second.ownerRuntimeContracts[0].contractHash).toBe(
      first.ownerRuntimeContracts[0].contractHash
    );
    expect(
      JSON.parse(fs.readFileSync(staleContractPath, 'utf8')).contractHash
    ).toBe('tampered');
  });
});

function createTemporaryRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'azpr-character-combat-orchestration-')
  );
  temporaryRoots.push(root);
  return root;
}

function writeRecipe(recipeRoot, recipe) {
  fs.writeFileSync(
    path.join(recipeRoot, `${recipe.ownerId}.json`),
    `${JSON.stringify(recipe, null, 2)}\n`,
    'utf8'
  );
}

function createSyntheticRecipe(ownerId, controlSkillId) {
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-profile-recipe',
    ownerId,
    targetPipelineMaturity: 'profile-compiled',
    compiler: {
      timingPolicy: 'verified-input-reopen',
      reachableControlSkillIds: [controlSkillId],
      contextInputEdges: [],
      publicActionForms: [
        {
          publicActionKind: 'star-skill',
          publicControlSkillId: controlSkillId,
          executionControlSkillId: controlSkillId,
          executionSubSkillIndex: 0,
          semanticIdentity: `synthetic-${ownerId}-star-skill`,
          semanticName: `Synthetic ${ownerId}`,
          selectionKind: 'default',
          condition: { kind: 'always' },
        },
      ],
      attackInputChains: [],
      thresholdTransitions: [],
      passiveEffects: [],
    },
  };
}

function createSyntheticControl(ownerId, controlSkillId) {
  return {
    ownerId,
    controlSkillId,
    frameRate: 60,
    sourceIdentity: `fixture:control:${controlSkillId}`,
    variants: [
      {
        subSkillIndex: 0,
        sourceIdentity: `fixture:control:${controlSkillId}:sub:0`,
      },
    ],
    hits: [],
    effects: [],
  };
}

function createSyntheticSemanticEffect(ownerId) {
  return {
    semanticIdentity: `fixture:semantic-effect:${ownerId}`,
    displayLabel: `Synthetic effect ${ownerId}`,
    role: 'gameplay-effect',
    classification: 'applied',
    owners: [{ ownerKind: 'actor', ownerId }],
    publicActions: [],
    dimensions: {},
    sourceIdentity: `fixture:semantic-effect:${ownerId}:source`,
  };
}

function createSyntheticCompilerOperators() {
  return {
    normalizeControlWindows: () => [],
    resolveControlVariantTiming: ({ control, subSkillIndex }) => ({
      frameRate: 60,
      sourceIdentity: `${control.sourceIdentity}:sub:${subSkillIndex}:timing`,
      occupancy: {
        status: 'applied',
        durationFrames: 30,
        sourceIdentity: `${control.sourceIdentity}:sub:${subSkillIndex}:occupancy`,
      },
    }),
    resolveNormalAttackTiming: () => null,
    readElementAsset: () => null,
    createSemanticRootTriggers: () => [],
    resolveControlOwnerId: control => Number(control?.ownerId),
  };
}

function createEmptyVariantGraph() {
  return {
    edges: [],
    contextEdges: [],
    publicActionForms: [],
    attackInputChains: [],
    summary: {},
  };
}

function createEmptyResourceCatalog() {
  return {
    profiles: [],
    operationBindings: [],
    thresholdTransitions: [],
    passiveEffects: [],
    summary: {},
  };
}

function createSyntheticMechanicsPackage({ ownerCompilations, controls }) {
  const actionMappings = ownerCompilations.map(compilation => {
    const controlSkillId = compilation.reachableControlSkillIds[0];
    return {
      identity: `actor:${compilation.ownerId}:star-skill`,
      ownerKind: 'actor',
      ownerId: compilation.ownerId,
      actionKind: 'star-skill',
      sourceSkillId: controlSkillId,
      controlSkillId,
      selectedSubSkillIndex: 0,
      sourceSkillName: `Synthetic ${compilation.ownerId}`,
      classification: 'applied',
      schedulable: true,
      sourceIdentity: `fixture:action:${controlSkillId}`,
    };
  });
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-mechanics-package',
    status: 'verified-combat-mechanics-package-ready',
    packageId: 'synthetic-character-combat-production',
    packageHash: 'a'.repeat(64),
    region: 'fixture',
    clientBuild: 'fixture',
    sourceFiles: [],
    actionMappings,
    actionVariantGraph: createEmptyVariantGraph(),
    specialResourceCatalog: createEmptyResourceCatalog(),
    controlBindings: controls,
    actionVariantControlBindings: [],
    semanticEffectCatalog: { semanticEffects: [] },
    switchTriggerCatalog: { profiles: [] },
    staticPropertyCatalog: { actorProfiles: [], kiboProfiles: [] },
    ownerProfiles: { actor: [] },
    tuningMechanicsCatalog: { status: 'fixture' },
    spUnitContract: { status: 'verified-sp-unit-contract-ready' },
  };
}

function createSyntheticGoldenRuntime(ownerId) {
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-authoritative-golden-runtime',
    status: 'authoritative-golden-runtime-verified',
    ownerId,
    durationMs: 120000,
    actual: {},
    expected: {},
    validation: {
      status: 'authoritative-golden-runtime-expectation-passed',
      passed: true,
      assertionCount: 1,
      failedCount: 0,
      assertions: [
        {
          jsonPath: 'ownerId',
          operator: 'exact',
          expected: ownerId,
          actual: ownerId,
          passed: true,
        },
      ],
    },
    replayHash: String(ownerId).padStart(64, '0'),
  };
}
