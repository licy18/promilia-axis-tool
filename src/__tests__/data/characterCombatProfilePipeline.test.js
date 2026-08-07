import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import coverageManifest from '../../../reports/m10/all-character-coverage-manifest.json';
import descriptionCoverage from '../../../reports/m10/101010/description-coverage.json';
import goldenTrace from '../../../reports/m10/101010/golden-trace.json';
import reachableGraph from '../../../reports/m10/101010/reachable-graph.json';
import runtimeCoverage from '../../../reports/m10/101010/runtime-coverage.json';
import sourceManifest from '../../../reports/m10/101010/source-manifest.json';
import unresolvedLedger from '../../../reports/m10/101010/unresolved-ledger.json';
import {
  applyCharacterCombatActionHitBindings,
  compileElementInheritance,
  compileCharacterCombatRecipeContracts,
  createCharacterCombatOwnerRuntimeContracts,
  mergeCharacterCombatOwnerCompilations,
} from '../../../scripts/character-combat/character-combat-contract-compiler.mjs';
import { validateCharacterCombatGoldenRuntime } from '../../../scripts/character-combat/character-combat-golden-validation.mjs';
import catalog from '../../data/generated/character-combat-profile-catalog.json';
import ownerContract from '../../data/generated/character-combat-owner-contracts/101010.json';
import profile from '../../data/generated/character-combat-profiles/101010.json';
import schema from '../../data/generated/character-combat-profile-schema.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCharacterCombatProfileMetadata,
  installVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
} from '../../data/verifiedCombatMechanicsPackage';

const CURRENT_PUBLIC_CHARACTER_IDS = [
  101010, 103002, 101003, 101007, 102001, 107001, 107002, 107003, 108001,
  108002, 108003, 108005, 109001, 109002, 111001, 112001, 112002, 199001,
  199002, 199003,
];
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);
const VERIFIED_PACKAGE_PATH = path.join(
  REPO_ROOT,
  'src',
  'data',
  'generated',
  'verified-combat-mechanics-package.json'
);
const PROFILE_STATUSES = new Set([
  'applied',
  'runtime-evidence-required',
  'static-evidence-gap',
  'not-applicable',
]);

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('M10 character combat profile pipeline', () => {
  it('uses inheritType rather than the team-element flag for controlled-actor transfer', () => {
    const createAsset = ({ teamElement, inheritType }) => ({
      elementId: 424200 + inheritType + (teamElement ? 10 : 0),
      pathId: `fixture-${teamElement}-${inheritType}`,
      sourceIdentity: `fixture:element:${teamElement}:${inheritType}`,
      tree: {
        inherit: teamElement ? 1 : 0,
        inheritType,
      },
    });

    expect(
      compileElementInheritance(
        createAsset({ teamElement: true, inheritType: 0 })
      )
    ).toMatchObject({
      inheritOnControlledActorSwitch: false,
      inheritType: null,
      isTeamElement: true,
      status: 'verified-element-no-controlled-actor-inheritance',
    });
    expect(
      compileElementInheritance(
        createAsset({ teamElement: false, inheritType: 1 })
      )
    ).toMatchObject({
      inheritOnControlledActorSwitch: true,
      inheritType: 'self',
      isTeamElement: false,
      status: 'verified-element-inheritance-ready',
    });
    expect(
      compileElementInheritance(
        createAsset({ teamElement: true, inheritType: 1 })
      )
    ).toMatchObject({
      inheritOnControlledActorSwitch: true,
      inheritType: 'self',
      isTeamElement: true,
    });
    expect(
      compileElementInheritance(
        createAsset({ teamElement: false, inheritType: 2 })
      )
    ).toMatchObject({
      inheritOnControlledActorSwitch: true,
      inheritType: 'source',
      isTeamElement: false,
    });
    expect(
      compileElementInheritance(
        createAsset({ teamElement: true, inheritType: 2 })
      )
    ).toMatchObject({
      inheritOnControlledActorSwitch: true,
      inheritType: 'source',
      isTeamElement: true,
    });
    expect(() =>
      compileElementInheritance(
        createAsset({ teamElement: true, inheritType: 3 })
      )
    ).toThrow(/inheritance type unsupported/);
  });

  it('derives honest maturity and coverage against the fixed 20-character denominator', () => {
    expect(schema).toMatchObject({
      $id: 'azpr://schemas/character-combat-profile/v1',
      title: 'Azur Promilia Character Combat Profile',
    });
    expect(catalog).toMatchObject({
      status: 'character-combat-profile-catalog-ready',
      summary: {
        publicCharacterCount: 20,
        compiledProfileCount: 4,
        runtimeAppliedProfileCount: 4,
        uiVerifiedProfileCount: 0,
        characterCompleteCount: 0,
      },
    });
    expect(profile).toMatchObject({
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
      completionState: 'runtime-applied',
      targetPipelineMaturity: 'ui-verified',
      validation: {
        status: 'character-combat-profile-valid',
        issues: [],
      },
    });
    expect(coverageManifest.denominator.publicCharacterCount).toBe(20);
    expect(coverageManifest.rows.map(row => row.ownerId)).toEqual(
      CURRENT_PUBLIC_CHARACTER_IDS
    );
    expect(
      coverageManifest.rows.find(row => row.ownerId === 101010)
    ).toMatchObject({
      ownerName: '涂山小玉',
      progressState: 'runtime-applied',
      targetPipelineMaturity: 'ui-verified',
      combatCoverageState: 'partial',
      characterComplete: false,
      profileIdentity: profile.profileIdentity,
      profileHash: profile.profileHash,
    });
  });

  it('compiles a second synthetic owner without character-specific compiler code', () => {
    const syntheticRecipe = {
      schemaVersion: 1,
      ownerId: 424242,
      compiler: {
        timingPolicy: 'standalone-animation',
        reachableControlSkillIds: [],
        contextInputEdges: [],
        publicActionForms: [],
        attackInputChains: [],
        thresholdTransitions: [],
        passiveEffects: [],
      },
    };
    const compilation = compileCharacterCombatRecipeContracts({
      recipe: syntheticRecipe,
      character: {
        id: 424242,
        name: 'Synthetic Owner',
        sourceIdentity: 'fixture:character:424242',
      },
      evidence: {
        controls: [],
        skills: [],
        specialResourceProfiles: [],
        specialResourceOperations: [],
      },
      operators: createNoopCompilerOperators(),
    });
    const runtimeContract = createCharacterCombatOwnerRuntimeContracts({
      compilation,
      publicActions: [
        {
          identity: 'actor:424242:star-skill',
          ownerId: 424242,
          actionKind: 'star-skill',
          sourceSkillId: 42424201,
          controlSkillId: 42424212,
          selectedSubSkillIndex: 0,
          sourceSkillName: 'Synthetic Skill',
          classification: 'applied',
          schedulable: true,
          sourceIdentity: 'fixture:action:42424212',
        },
      ],
      controls: [],
      variantEdges: [],
      hits: [],
      resourceProfiles: [],
      resourceTransactions: [],
      rawEffects: [],
      semanticEffects: [],
      switchTriggers: [],
      statDependencies: { static: [], dynamic: [] },
    });

    expect(compilation).toMatchObject({
      ownerId: 424242,
      ownerName: 'Synthetic Owner',
      status: 'character-combat-owner-contracts-compiled',
      summary: {
        contextEdgeCount: 0,
        publicActionFormCount: 0,
        attackInputChainCount: 0,
        thresholdTransitionCount: 0,
        passiveEffectCount: 0,
      },
    });
    expect(runtimeContract.contracts.actionForms).toEqual([
      expect.objectContaining({
        ownerId: 424242,
        publicActionKind: 'star-skill',
        executionControlSkillId: 42424212,
        status: 'applied',
        applied: true,
      }),
    ]);
    expect(compilation.contractHash).toMatch(/^[a-f0-9]{64}$/);
    expect(runtimeContract.contractHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('compiles target-state transactions and conditional runtime effects for a synthetic owner', () => {
    const ownerId = 424244;
    const controlSkillId = 42424401;
    const elementAssets = new Map([
      [
        9001,
        {
          elementId: 9001,
          sourceIdentity: 'fixture:element:9001',
          tree: { time: 10000 },
        },
      ],
      [
        9002,
        {
          elementId: 9002,
          sourceIdentity: 'fixture:element:9002',
          tree: { combineNumber: 3 },
        },
      ],
      [
        9003,
        {
          elementId: 9003,
          sourceIdentity: 'fixture:element:9003',
          tree: {},
        },
      ],
      [
        9004,
        {
          elementId: 9004,
          sourceIdentity: 'fixture:element:9004',
          tree: { functionParams: [20000] },
        },
      ],
    ]);
    const compilation = compileCharacterCombatRecipeContracts({
      recipe: {
        schemaVersion: 1,
        ownerId,
        compiler: {
          timingPolicy: 'standalone-animation',
          reachableControlSkillIds: [controlSkillId],
          contextInputEdges: [],
          publicActionForms: [],
          attackInputChains: [],
          thresholdTransitions: [],
          passiveEffects: [],
          targetStateProfiles: [
            {
              stateIdentity: 'enemy:synthetic-firework',
              name: 'Synthetic Firework',
              targetKind: 'enemy',
              elementId: 9001,
              capacityElementId: 9002,
              expectedDurationMs: 10000,
              expectedMaxStacks: 3,
              sourceIdentity: 'fixture:target-state-profile',
            },
          ],
          targetStateTransactions: [
            {
              transactionIdentity: 'synthetic-firework-gain',
              stateIdentity: 'enemy:synthetic-firework',
              controlSkillId,
              subSkillIndex: 0,
              triggerFrame: 5,
              amount: 1,
              requiresHitElementId: 9001,
              sourceIdentity: 'fixture:target-state-transaction',
            },
          ],
          conditionalHitGroups: [
            {
              groupIdentity: 'synthetic-firework-burst',
              controlSkillId,
              subSkillIndex: 0,
              sourceControlSkillId: controlSkillId,
              sourceSubSkillIndex: 0,
              elementId: 9001,
              triggerFrames: [5],
              decisionFrame: 5,
              stateIdentity: 'enemy:synthetic-firework',
              minimumStacks: 1,
              consumeBands: [
                {
                  minimumStacks: 1,
                  amount: 1,
                  sourceElementId: 9003,
                  sourceIdentity: 'fixture:target-state-consume',
                },
              ],
              sourceIdentity: 'fixture:conditional-hit-group',
            },
          ],
          runtimeEffectBindings: [
            {
              bindingIdentity: 'synthetic-firework-sp',
              triggerKind: 'conditional-hit-group-applied',
              conditionalGroupIdentity: 'synthetic-firework-burst',
              triggerFrame: 5,
              targetKind: 'source-actor',
              directSpElementId: 9004,
              expectedDirectSpValue: 2,
              sourceIdentity: 'fixture:runtime-direct-sp',
            },
          ],
        },
      },
      character: {
        id: ownerId,
        name: 'Synthetic Target State Owner',
        sourceIdentity: `fixture:character:${ownerId}`,
      },
      evidence: {
        controls: [
          {
            controlSkillId,
            frameRate: 60,
            elements: [
              {
                mapIndex: 0,
                elementId: 9001,
                pathId: 'fixture-path-9001',
                triggers: [{ startFrame: 5 }],
                dimensions: {
                  hp: { status: 'applied' },
                },
                formula: {
                  commonFunctionId: 1,
                },
                damage: {
                  damageType: 1,
                },
                sourceIdentity: 'fixture:control-element:9001',
              },
            ],
          },
        ],
        skills: [],
        specialResourceProfiles: [],
        specialResourceOperations: [],
      },
      operators: {
        ...createNoopCompilerOperators(),
        readElementAsset: elementId => elementAssets.get(Number(elementId)),
      },
    });

    expect(compilation.summary).toMatchObject({
      targetStateProfileCount: 1,
      targetStateTransactionCount: 1,
      conditionalHitGroupCount: 1,
      runtimeEffectBindingCount: 1,
      actionHitBindingCount: 1,
    });
    expect(compilation.contracts.targetStateProfiles[0]).toMatchObject({
      ownerId,
      stateIdentity: 'enemy:synthetic-firework',
      durationMs: 10000,
      maxStacks: 3,
      applied: true,
    });
    expect(compilation.contracts.actionHitBindings[0]).toMatchObject({
      ownerId,
      controlSkillId,
      conditionalGroupIdentity: 'synthetic-firework-burst',
      runtimeCondition: {
        kind: 'target-state-at-least',
        stateIdentity: 'enemy:synthetic-firework',
        minimumStacks: 1,
      },
    });
    expect(compilation.contracts.runtimeEffectBindings[0]).toMatchObject({
      ownerId,
      conditionalGroupIdentity: 'synthetic-firework-burst',
      directSp: {
        elementId: 9004,
        value: 2,
      },
      applied: true,
    });
  });

  it('compiles reusable resource conditions and transaction classifications', () => {
    const ownerId = 424243;
    const resourceIdentity = `actor:${ownerId}:element:424243047`;
    const controls = [
      { controlSkillId: 42424301 },
      { controlSkillId: 42424302 },
    ];
    const compilation = compileCharacterCombatRecipeContracts({
      recipe: {
        schemaVersion: 1,
        ownerId,
        compiler: {
          timingPolicy: 'verified-input-reopen',
          reachableControlSkillIds: controls.map(item => item.controlSkillId),
          contextInputEdges: [],
          publicActionForms: [],
          attackInputChains: [
            {
              chainIdentity: 'synthetic-empty-chain',
              sourceSkillId: 42424301,
              condition: {
                kind: 'resource-below',
                resourceElementId: 424243047,
                value: 1,
              },
              segments: [
                {
                  controlSkillId: 42424301,
                  subSkillIndex: 0,
                  nextControlSkillId: null,
                },
              ],
            },
            {
              chainIdentity: 'synthetic-loaded-chain',
              sourceSkillId: 42424301,
              condition: {
                kind: 'resource-at-least',
                resourceElementId: 424243047,
                value: 1,
              },
              segments: [
                {
                  controlSkillId: 42424302,
                  subSkillIndex: 1,
                  nextControlSkillId: null,
                },
              ],
            },
          ],
          specialResources: [
            {
              resourceElementId: 424243047,
              expectedCapacity: 3,
              operationRules: [
                {
                  match: {
                    operation: 'gain',
                    sourceElementId: 424243047,
                    triggerFrameStatus: 'missing',
                  },
                  status: 'not-applicable',
                  reason: 'synthetic-root-wrapper',
                },
              ],
              expectedOperationCounts: {
                total: 2,
                applied: 1,
                notApplicable: 1,
                unresolved: 0,
              },
            },
          ],
          thresholdTransitions: [],
          passiveEffects: [],
        },
      },
      character: {
        id: ownerId,
        name: 'Synthetic Resource Owner',
        sourceIdentity: `fixture:character:${ownerId}`,
      },
      evidence: {
        controls,
        skills: [],
        specialResourceProfiles: [
          {
            ownerId,
            elementId: 424243047,
            resourceIdentity,
            capacity: 3,
            sourceIdentity: 'fixture:resource-profile',
            status: 'verified-special-resource-profile-ready',
            applied: true,
          },
        ],
        specialResourceOperations: [
          {
            operationIdentity: 'synthetic-consume',
            ownerId,
            resourceIdentity,
            operation: 'consume',
            controlSkillId: 42424302,
            subSkillIndex: 1,
            sourceElementId: 424243049,
            triggerFrame: 0,
            sourceIdentity: 'fixture:consume',
            status: 'verified-special-resource-operation-ready',
            applied: true,
          },
          {
            operationIdentity: 'synthetic-wrapper',
            ownerId,
            resourceIdentity,
            operation: 'gain',
            controlSkillId: 42424301,
            subSkillIndex: 0,
            sourceElementId: 424243047,
            triggerFrame: null,
            sourceIdentity: 'fixture:wrapper',
            status: 'unresolved-special-resource-operation',
            reasons: ['effect-trigger-frame-static-evidence-gap'],
            applied: false,
          },
        ],
      },
      operators: {
        ...createNoopCompilerOperators(),
        resolveNormalAttackTiming: ({ subSkillIndex }) => ({
          occupancy: {
            status: 'applied',
            durationFrames: subSkillIndex === 0 ? 20 : 30,
            sourceIdentity: `fixture:timing:${subSkillIndex}`,
          },
        }),
      },
    });

    expect(compilation.contracts.attackInputChains).toEqual([
      expect.objectContaining({
        chainIdentity: 'synthetic-empty-chain',
        stateCondition: expect.objectContaining({
          kind: 'resource-below',
          resourceIdentity,
          value: 1,
        }),
        segments: [
          expect.objectContaining({
            controlSkillId: 42424301,
            subSkillIndex: 0,
            durationFrames: 20,
          }),
        ],
      }),
      expect.objectContaining({
        chainIdentity: 'synthetic-loaded-chain',
        stateCondition: expect.objectContaining({
          kind: 'resource-at-least',
          resourceIdentity,
          value: 1,
        }),
        segments: [
          expect.objectContaining({
            controlSkillId: 42424302,
            subSkillIndex: 1,
            durationFrames: 30,
          }),
        ],
      }),
    ]);
    expect(compilation.contracts.resourceTransactions).toEqual([
      expect.objectContaining({
        operationIdentity: 'synthetic-consume',
        applied: true,
      }),
      expect.objectContaining({
        operationIdentity: 'synthetic-wrapper',
        status: 'not-applicable',
        impactClassification: 'wrapper-or-duplicate',
        reasons: ['synthetic-root-wrapper'],
      }),
    ]);
  });

  it('compiles a sourced control-transition input window without an element wrapper', () => {
    const ownerId = 424244;
    const sourceControlSkillId = 42424421;
    const targetControlSkillId = 42424401;
    const sourceIdentity =
      'fixture:skill_control_42424421#control-transition[80,112)->42424401/sub1';
    const controls = [
      {
        controlSkillId: sourceControlSkillId,
        variants: [{ subSkillIndex: 0 }],
      },
      {
        controlSkillId: targetControlSkillId,
        variants: [{ subSkillIndex: 1 }],
      },
    ];
    const compilation = compileCharacterCombatRecipeContracts({
      recipe: {
        schemaVersion: 1,
        ownerId,
        compiler: {
          timingPolicy: 'verified-input-reopen',
          reachableControlSkillIds: controls.map(item => item.controlSkillId),
          contextInputEdges: [],
          publicActionForms: [],
          attackInputChains: [],
          variantWindowBindings: [
            {
              bindingIdentity: 'synthetic-direct-enhanced-entry',
              evidenceKind: 'control-transition-window',
              sourceControlSkillId,
              sourceSubSkillIndex: 0,
              targetControlSkillId,
              targetSubSkillIndex: 1,
              inputWindow: { startFrame: 80, endFrame: 112 },
              inputCommand: 'normal-attack',
              condition: { kind: 'always' },
              sourceIdentity,
            },
          ],
          thresholdTransitions: [],
          passiveEffects: [],
        },
      },
      character: {
        id: ownerId,
        name: 'Synthetic Transition Owner',
        sourceIdentity: `fixture:character:${ownerId}`,
      },
      evidence: {
        controls,
        skills: [],
        specialResourceProfiles: [],
        specialResourceOperations: [],
      },
      operators: {
        ...createNoopCompilerOperators(),
        normalizeControlWindows: (control, subSkillIndex) =>
          Number(control.controlSkillId) === sourceControlSkillId &&
          Number(subSkillIndex) === 0
            ? [
                {
                  kind: 'control-transition-window',
                  startFrame: 80,
                  endFrame: 112,
                  targetControlSkillId,
                  targetSubSkillIndex: 1,
                  sourceIdentity,
                },
              ]
            : [],
      },
    });

    expect(compilation.contracts.variantWindowBindings).toEqual([
      expect.objectContaining({
        bindingIdentity: 'synthetic-direct-enhanced-entry',
        evidenceKind: 'control-transition-window',
        ownerId,
        sourceControlSkillId,
        sourceSubSkillIndex: 0,
        targetControlSkillId,
        targetSubSkillIndex: 1,
        activationFrame: 80,
        inputWindow: {
          startFrame: 80,
          endFrame: 112,
          durationFrames: 32,
        },
        relationType: 'input-derived',
        inputCommand: 'normal-attack',
        sourceIdentity: expect.stringContaining(sourceIdentity),
        status: 'applied',
        applied: true,
      }),
    ]);
  });

  it('compiles reusable declared execution, hit, effect, and resource contracts', () => {
    const ownerId = 424246;
    const executionControlSkillId = 42424649;
    const resourceElementId = 424246047;
    const hitElementId = 424246147;
    const effectElementId = 424246276;
    const compilation = compileCharacterCombatRecipeContracts({
      recipe: {
        schemaVersion: 1,
        ownerId,
        compiler: {
          timingPolicy: 'verified-input-reopen',
          reachableControlSkillIds: [executionControlSkillId],
          contextInputEdges: [],
          publicActionForms: [
            {
              publicActionKind: 'perfect-parry',
              publicControlSkillId: 42424627,
              semanticIdentity: 'synthetic-focus-counter',
              semanticName: 'Synthetic Focus Counter',
              executionControlSkillId,
              executionSubSkillIndex: 1,
              selectionKind: 'wrapper-derived-execution',
              condition: { kind: 'always' },
              executionOccupancy: {
                durationFrames: 35,
                frameRate: 60,
                sourceIdentity: 'fixture:focus-counter-occupancy',
              },
            },
          ],
          attackInputChains: [],
          variantWindowBindings: [],
          actionHitBindings: [
            {
              bindingIdentity: 'synthetic-focus-counter-hits',
              controlSkillId: executionControlSkillId,
              subSkillIndex: 1,
              elementId: hitElementId,
              triggerFrames: [15, 20, 25],
              frameCount: 1,
              targetKind: 'enemy',
              sourceIdentity: 'fixture:focus-counter-hit-frames',
            },
          ],
          actionEffectBindings: [
            {
              bindingIdentity: 'synthetic-six-stack-effect',
              controlSkillId: executionControlSkillId,
              subSkillIndex: 1,
              mapIndex: 1,
              elementId: effectElementId,
              triggerFrame: 10,
              lifecycleStackDelta: 6,
              lifecycleMaxStacks: 6,
              sourceIdentity: 'fixture:six-stack-effect',
            },
          ],
          specialResources: [
            {
              resourceElementId,
              expectedCapacity: 12,
              operationDeclarations: [
                {
                  operationIdentity: 'synthetic-focus-counter-gain',
                  controlSkillId: executionControlSkillId,
                  subSkillIndex: 1,
                  operation: 'gain',
                  triggerFrame: 15,
                  frameRate: 60,
                  amount: 1,
                  sourceIdentity: 'fixture:focus-counter-resource-gain',
                },
              ],
              expectedOperationCounts: {
                total: 1,
                applied: 1,
                notApplicable: 0,
                unresolved: 0,
              },
            },
          ],
          thresholdTransitions: [],
          passiveEffects: [],
        },
      },
      character: {
        id: ownerId,
        name: 'Synthetic Declared Contract Owner',
        sourceIdentity: `fixture:character:${ownerId}`,
      },
      evidence: {
        controls: [
          {
            controlSkillId: executionControlSkillId,
            frameRate: 60,
            variants: [
              {
                subSkillIndex: 1,
                sourceIdentity: 'fixture:focus-counter-variant',
              },
            ],
            elements: [
              {
                mapIndex: 1,
                elementId: hitElementId,
                pathId: 'fixture-focus-hit',
                sourceIdentity: 'fixture:focus-hit-element',
                dimensions: {
                  damage: { status: 'applied' },
                },
              },
            ],
          },
        ],
        skills: [],
        tuningMarkProfiles: [],
        specialResourceProfiles: [
          {
            ownerId,
            elementId: resourceElementId,
            resourceIdentity: `actor:${ownerId}:element:${resourceElementId}`,
            capacity: 12,
            sourceIdentity: 'fixture:focus-ammo-profile',
          },
        ],
        specialResourceOperations: [],
      },
      operators: {
        ...createNoopCompilerOperators(),
        resolveControlVariantTiming: () => ({
          frameRate: 60,
          animation: {
            durationFrames: 140,
            status: 'applied',
            sourceIdentity: 'fixture:focus-animation',
          },
          occupancy: {
            durationFrames: 140,
            status: 'applied',
            sourceIdentity: 'fixture:focus-animation',
          },
          sourceIdentity: 'fixture:focus-animation',
        }),
        readElementAsset: elementId =>
          Number(elementId) === effectElementId
            ? {
                pathId: 'fixture-focus-effect',
                sourceIdentity: 'fixture:focus-effect-element',
              }
            : null,
      },
    });

    expect(compilation.contracts.publicActionForms).toEqual([
      expect.objectContaining({
        selectionKind: 'wrapper-derived-execution',
        executionControlSkillId,
        executionSubSkillIndex: 1,
        executionTiming: expect.objectContaining({
          occupancy: expect.objectContaining({ durationFrames: 35 }),
          animation: expect.objectContaining({ durationFrames: 140 }),
        }),
        applied: true,
      }),
    ]);
    expect(compilation.contracts.actionHitBindings).toEqual([
      expect.objectContaining({
        bindingIdentity: 'synthetic-focus-counter-hits',
        triggerFrames: [15, 20, 25],
        applied: true,
      }),
    ]);
    expect(compilation.contracts.actionEffectBindings).toEqual([
      expect.objectContaining({
        bindingKind: 'lifecycle-override',
        lifecycleStackDelta: 6,
        lifecycleMaxStacks: 6,
        applied: true,
      }),
    ]);
    expect(compilation.contracts.resourceTransactions).toEqual([
      expect.objectContaining({
        operationIdentity: 'synthetic-focus-counter-gain',
        operation: 'gain',
        triggerFrame: 15,
        amountByLevel: { 1: 1 },
        applied: true,
      }),
    ]);
  });

  it('compiles cross-control input variants and projects child-control hits onto the public action', () => {
    const ownerId = 424247;
    const publicControlSkillId = 42424710;
    const secondStageControlSkillId = 42424741;
    const childControlSkillId = 48042401;
    const childElementId = 424247147;
    const controls = [
      {
        controlSkillId: publicControlSkillId,
        frameRate: 60,
        variants: [
          {
            subSkillIndex: 0,
            sourceIdentity: 'fixture:first-stage-variant',
          },
        ],
        elements: [],
      },
      {
        controlSkillId: secondStageControlSkillId,
        frameRate: 60,
        variants: [
          {
            subSkillIndex: 0,
            sourceIdentity: 'fixture:second-stage-variant',
          },
        ],
        elements: [],
      },
      {
        controlSkillId: childControlSkillId,
        frameRate: 60,
        variants: [
          {
            subSkillIndex: 0,
            sourceIdentity: 'fixture:child-hit-variant',
          },
        ],
        elements: [
          {
            mapIndex: 0,
            elementId: childElementId,
            pathId: 'fixture-child-hit',
            sourceIdentity: 'fixture:child-hit-element',
            triggers: [],
            dimensions: {
              damage: { status: 'applied' },
            },
          },
        ],
      },
    ];
    const compilation = compileCharacterCombatRecipeContracts({
      recipe: {
        schemaVersion: 1,
        ownerId,
        compiler: {
          timingPolicy: 'verified-input-reopen',
          reachableControlSkillIds: controls.map(item => item.controlSkillId),
          contextInputEdges: [],
          publicActionForms: [],
          attackInputChains: [],
          inputVariantSelectors: [
            {
              selectorIdentity: 'synthetic-two-stage-charge',
              publicControlSkillId,
              actionKinds: ['charged-attack'],
              kind: 'charge-tier',
              mode: 'hold',
              options: [
                {
                  selectorIdentity: 'synthetic-charge-stage-1',
                  label: 'Stage 1',
                  publicVariantIndex: 1,
                  executionControlSkillId: publicControlSkillId,
                  executionSubSkillIndex: 0,
                  chargeTier: 1,
                },
                {
                  selectorIdentity: 'synthetic-charge-stage-2',
                  label: 'Stage 2',
                  publicVariantIndex: 2,
                  executionControlSkillId: secondStageControlSkillId,
                  executionSubSkillIndex: 0,
                  chargeTier: 2,
                },
              ],
              sourceIdentity: 'fixture:two-stage-charge-selector',
            },
          ],
          variantWindowBindings: [],
          actionHitBindings: [
            {
              bindingIdentity: 'synthetic-child-control-hit',
              controlSkillId: publicControlSkillId,
              subSkillIndex: 0,
              sourceControlSkillId: childControlSkillId,
              sourceSubSkillIndex: 0,
              elementId: childElementId,
              triggerFrames: [38, 59],
              frameCount: 1,
              targetKind: 'enemy',
              sourceIdentity: 'fixture:child-control-launch-offset',
            },
          ],
          actionEffectBindings: [],
          thresholdTransitions: [],
          passiveEffects: [],
        },
      },
      character: {
        id: ownerId,
        name: 'Synthetic Cross Control Owner',
        sourceIdentity: `fixture:character:${ownerId}`,
      },
      evidence: {
        controls,
        skills: [],
        tuningMarkProfiles: [],
        specialResourceProfiles: [],
        specialResourceOperations: [],
      },
      operators: {
        ...createNoopCompilerOperators(),
        resolveControlVariantTiming: ({ control }) => ({
          frameRate: 60,
          animation: {
            durationFrames:
              control.controlSkillId === secondStageControlSkillId ? 211 : 248,
            status: 'applied',
            sourceIdentity: `fixture:${control.controlSkillId}:animation`,
          },
          occupancy: {
            durationFrames:
              control.controlSkillId === secondStageControlSkillId ? 71 : 61,
            status: 'applied',
            sourceIdentity: `fixture:${control.controlSkillId}:occupancy`,
          },
          sourceIdentity: `fixture:${control.controlSkillId}:timing`,
        }),
      },
    });

    expect(compilation.contracts.inputVariantSelectors).toEqual([
      expect.objectContaining({
        selectorIdentity: 'synthetic-two-stage-charge',
        publicControlSkillId,
        resolutionStatus: 'applied',
        options: [
          expect.objectContaining({
            executionControlSkillId: publicControlSkillId,
            executionSubSkillIndex: 0,
            durationFrames: 61,
          }),
          expect.objectContaining({
            executionControlSkillId: secondStageControlSkillId,
            executionSubSkillIndex: 0,
            durationFrames: 71,
          }),
        ],
      }),
    ]);
    expect(compilation.contracts.actionHitBindings).toEqual([
      expect.objectContaining({
        controlSkillId: publicControlSkillId,
        sourceControlSkillId: childControlSkillId,
        sourceSubSkillIndex: 0,
        triggerFrames: [38, 59],
      }),
    ]);

    const actionVariantGraph = {
      contextEdges: [],
      publicActionForms: [],
      attackInputChains: [],
      derivedControlContracts: [],
      edges: [],
      summary: {},
    };
    mergeCharacterCombatOwnerCompilations({
      actionVariantGraph,
      specialResourceCatalog: {
        profiles: [],
        operationBindings: [],
        thresholdTransitions: [],
        passiveEffects: [],
        summary: {},
      },
      compilations: [compilation],
    });
    expect(actionVariantGraph.derivedControlContracts).toEqual([
      expect.objectContaining({
        ownerId,
        controlSkillId: publicControlSkillId,
        inputSelector: expect.objectContaining({
          selectorIdentity: 'synthetic-two-stage-charge',
        }),
      }),
    ]);

    applyCharacterCombatActionHitBindings({
      controls,
      compilations: [compilation],
    });
    expect(controls[0].elements).toEqual([
      expect.objectContaining({
        elementId: childElementId,
        mapIndex: 0,
        projectedFromControlSkillId: childControlSkillId,
        triggers: [
          expect.objectContaining({ startFrame: 38 }),
          expect.objectContaining({ startFrame: 59 }),
        ],
      }),
    ]);
  });

  it('compiles a reusable attack-chain continuity rule from sourced control windows', () => {
    const ownerId = 424245;
    const sourceSkillId = 42424501;
    const enhancedControlSkillId = 42424502;
    const intermediaryControlSkillId = 42424515;
    const activeWindowTargetControlSkillId = 42424514;
    const sourceIdentity =
      'fixture:skill_control_42424515#attack-reopen[30,246)';
    const controls = [
      {
        controlSkillId: enhancedControlSkillId,
        variants: [{ subSkillIndex: 1 }],
      },
      {
        controlSkillId: intermediaryControlSkillId,
        variants: [{ subSkillIndex: 0 }],
      },
      {
        controlSkillId: activeWindowTargetControlSkillId,
        variants: [{ subSkillIndex: 1 }],
      },
    ];
    const compilation = compileCharacterCombatRecipeContracts({
      recipe: {
        schemaVersion: 1,
        ownerId,
        compiler: {
          timingPolicy: 'verified-input-reopen',
          reachableControlSkillIds: controls.map(item => item.controlSkillId),
          contextInputEdges: [],
          publicActionForms: [],
          attackInputChains: [
            {
              chainIdentity: 'synthetic-enhanced-chain',
              sourceSkillId,
              entryPolicy: { kind: 'derived-or-quick-entry' },
              condition: { kind: 'always' },
              continuityRules: [
                {
                  ruleIdentity: 'synthetic-dodge-chain-continuity',
                  intermediaryControlSkillId,
                  intermediarySubSkillIndex: 0,
                  requiredActiveTargetControlSkillId:
                    activeWindowTargetControlSkillId,
                  requiredActiveTargetSubSkillIndex: 1,
                  inputCommand: 'normal-attack',
                  inputWindow: { startFrame: 30, endFrame: 246 },
                  resumePolicy: 'next-segment',
                  condition: { kind: 'always' },
                  sourceIdentity,
                },
              ],
              segments: [
                {
                  controlSkillId: enhancedControlSkillId,
                  subSkillIndex: 1,
                  nextControlSkillId: enhancedControlSkillId,
                },
              ],
            },
          ],
          thresholdTransitions: [],
          passiveEffects: [],
        },
      },
      character: {
        id: ownerId,
        name: 'Synthetic Continuity Owner',
        sourceIdentity: `fixture:character:${ownerId}`,
      },
      evidence: {
        controls,
        skills: [],
        specialResourceProfiles: [],
        specialResourceOperations: [],
      },
      operators: {
        ...createNoopCompilerOperators(),
        resolveNormalAttackTiming: () => ({
          occupancy: {
            status: 'applied',
            durationFrames: 24,
            sourceIdentity: 'fixture:enhanced-segment-timing',
          },
        }),
        normalizeControlWindows: (control, subSkillIndex) =>
          Number(control.controlSkillId) === intermediaryControlSkillId &&
          Number(subSkillIndex) === 0
            ? [
                {
                  kind: 'attack-reopen-window',
                  startFrame: 30,
                  endFrame: 246,
                  allowAttack: true,
                  allowedInputCommands: ['normal-attack'],
                  sourceIdentity,
                },
              ]
            : [],
      },
    });

    expect(compilation.contracts.attackInputChains).toEqual([
      expect.objectContaining({
        chainIdentity: 'synthetic-enhanced-chain',
        continuityRules: [
          expect.objectContaining({
            ruleIdentity: 'synthetic-dodge-chain-continuity',
            intermediaryControlSkillId,
            intermediarySubSkillIndex: 0,
            requiredActiveTargetControlSkillId:
              activeWindowTargetControlSkillId,
            requiredActiveTargetSubSkillIndex: 1,
            inputWindow: {
              startFrame: 30,
              endFrame: 246,
              durationFrames: 216,
            },
            resumePolicy: 'next-segment',
            status: 'applied',
            applied: true,
            sourceIdentity: expect.stringContaining(sourceIdentity),
          }),
        ],
      }),
    ]);
  });

  it('publishes explicit form status and a deduplicated unresolved ledger', () => {
    expect(profile.denominator).toMatchObject({
      publicActionCount: 10,
      executionFormCount: 21,
      reachableControlCount: 20,
      verifiedWindowCount: 89,
      hitCount: 107,
    });
    expect(profile.contracts.actionForms).toHaveLength(21);
    expect(
      profile.contracts.actionForms.filter(item => item.status === 'applied')
    ).toHaveLength(21);
    expect(
      profile.contracts.actionForms.filter(
        item => item.status === 'static-evidence-gap'
      )
    ).toHaveLength(0);
    expect(
      profile.contracts.actionForms.every(
        item =>
          PROFILE_STATUSES.has(item.status) &&
          item.applied === (item.status === 'applied')
      )
    ).toBe(true);
    expect(unresolvedLedger.summary).toMatchObject({
      semanticRecordCount: 209,
      rawRecordCount: 301,
      impactClassificationCounts: {
        'gameplay-impacting': 119,
        'not-applicable': 37,
        unreachable: 22,
        'wrapper-or-duplicate': 31,
      },
    });
    expect(unresolvedLedger.records).toHaveLength(209);
    expect(unresolvedLedger.rawRecords).toHaveLength(301);
    expect(
      unresolvedLedger.records.every(
        record =>
          PROFILE_STATUSES.has(record.status) &&
          record.status !== 'applied' &&
          record.recordIdentity &&
          record.impactClassification &&
          Array.isArray(record.reasons) &&
          record.reasons.length > 0
      )
    ).toBe(true);
  });

  it('binds profile and verified package to the same owner compilation', () => {
    expect(ownerContract).toMatchObject({
      kind: 'azpr-character-combat-owner-compilation',
      status: 'character-combat-owner-contracts-compiled',
      ownerId: 101010,
    });
    expect(profile.runtimeCompilation).toMatchObject({
      status: 'character-combat-runtime-contract-compiled',
      ownerId: 101010,
      sourceCompilation: {
        compilerVersion: ownerContract.compilerVersion,
        recipeIdentity: ownerContract.recipeIdentity,
        recipeHash: ownerContract.recipeHash,
        compilerInputHash: ownerContract.compilerInputHash,
        recipeContractHash: ownerContract.recipeContractHash,
        ownerContractHash: ownerContract.contractHash,
      },
    });
    expect(
      mechanicsPackage.actionVariantGraph.contextEdges.filter(
        edge => Number(edge.ownerId) === 101010
      )
    ).toEqual(ownerContract.contracts.timingInputEdges);
    expect(
      mechanicsPackage.actionVariantGraph.attackInputChains.filter(
        chain => Number(chain.ownerId) === 101010
      )
    ).toEqual(ownerContract.contracts.attackInputChains);
    expect(
      mechanicsPackage.specialResourceCatalog.thresholdTransitions.filter(
        item => Number(item.ownerId) === 101010
      )
    ).toEqual(ownerContract.contracts.stateMachines);
    expect(
      mechanicsPackage.specialResourceCatalog.passiveEffects.filter(
        item => Number(item.ownerId) === 101010
      )
    ).toEqual(ownerContract.contracts.passives);
    expect(ownerContract.contracts.effects.semantic).toHaveLength(125);
    expect(ownerContract.contracts.statDependencies.dynamic).toHaveLength(9);

    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const metadata = getVerifiedCharacterCombatProfileMetadata(101010);
    expect(metadata).toEqual(
      expect.objectContaining({
        profileIdentity: profile.profileIdentity,
        profileHash: profile.profileHash,
        runtimeContractHash: profile.runtimeCompilation.contractHash,
        pipelineMaturity: 'runtime-applied',
        combatCoverageState: 'partial',
        characterComplete: false,
      })
    );
    expect(
      resolveVerifiedCombatActionMechanics({
        id: 'profile-linked-xiaoyu-charged',
        type: 'skill',
        actorCharacterId: 101010,
        skillId: 10101001,
        actionVariantIndex: 2,
      }).characterCombatProfile
    ).toEqual(metadata);
  });

  it('uses an authoritative 120-second replay with independently checked numeric outcomes', () => {
    expect(goldenTrace).toMatchObject({
      kind: 'azpr-character-combat-authoritative-golden-runtime',
      status: 'authoritative-golden-runtime-verified',
      ownerId: 101010,
      durationMs: 120000,
      compilerPath:
        'src/simulation/headless/canonicalHeadlessCombatCore.js#compile',
      simulatorPath:
        'src/simulation/headless/canonicalHeadlessCombatCore.js#simulate',
      validation: {
        status: 'authoritative-golden-runtime-expectation-passed',
        passed: true,
        assertionCount: 118,
        failedCount: 0,
      },
    });
    expect(goldenTrace.actual).toMatchObject({
      project: { durationMs: 120000, actionCount: 27 },
      actions: { blockedActionIds: [] },
      combat: {
        damageEventCount: 522,
        ownerDamageEventCount: 345,
        ownerHitEventCount: 115,
        ownerHitTotalHpDamage: 9822,
        ownerHitTotalToughnessDamage: 1093,
        ownerTotalHpDamage: 648551,
        ownerTotalToughnessDamage: 0,
        enemy: { initialHp: 862800, finalHp: 0 },
      },
      resources: {
        thresholdClearCount: 1,
        transformCount: 1,
        refreshCount: 1,
        tuningMarkAcquireByActionId: {
          'threshold-charged': {
            eventCount: 1,
            totalDelta: 2,
          },
        },
      },
      effects: {
        passiveMaxStacks: 4,
        firstPassiveMaxStackFrame: 3001,
        passiveApplyCountByActionId: expect.objectContaining({
          'jade-limit-counter': 0,
          'switch-back-to-xiaoyu--on-enter--actor-101010--star-carry': 1,
          'jade-perfect-parry': 1,
        }),
        inheritanceTransferCountByEffectId: {
          'battle-element:101010206': 0,
        },
      },
      dynamicProperties: {
        maxPercentRawByAttributeId: {
          1: 1500,
          229: 9600,
        },
      },
      comparison: {
        primaryDamage: 5613,
        baselineDamage: 2366,
        damageDelta: 3247,
      },
    });
    expect(
      goldenTrace.actual.resources.actorSpByActorId['actor-101010']
    ).toMatchObject({
      initialValue: 100,
      currentValue: 35.418732,
      autoRecovery: [
        {
          reason: 'verified-auto-sp-background',
          totalChange: 1.904298,
        },
        {
          reason: 'verified-auto-sp-foreground',
          totalChange: 20.015864,
        },
      ],
    });
    expect(
      goldenTrace.actual.resources.kiboSpBySlotId['team-slot-1']
    ).toMatchObject({
      kiboId: 500003,
      initialValue: 0,
      currentValue: 81.026352,
    });
    expect(goldenTrace.replayHash).toMatch(/^[a-f0-9]{64}$/);

    const tamperedExpected = structuredClone(goldenTrace.expected);
    tamperedExpected.exact['combat.ownerTotalHpDamage'] += 1;
    const tamperedValidation = validateCharacterCombatGoldenRuntime({
      actual: goldenTrace.actual,
      expected: tamperedExpected,
    });
    expect(tamperedValidation).toMatchObject({
      passed: false,
      failedCount: 1,
    });
    expect(
      tamperedValidation.assertions.find(item => !item.passed)
    ).toMatchObject({
      jsonPath: 'combat.ownerTotalHpDamage',
      expected: 648552,
      actual: 648551,
    });
  });

  it('rebuilds owner-only contracts into isolated staging without overwriting the full package', () => {
    const packageHashBefore = hashFile(VERIFIED_PACKAGE_PATH);
    const scriptPath = path.join(
      REPO_ROOT,
      'scripts',
      'sync-character-combat-profile.mjs'
    );
    const outputRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'azpr-character-combat-owner-cli-')
    );
    try {
      const ownerRun = spawnSync(
        process.execPath,
        [
          scriptPath,
          '--owner',
          '101010',
          '--write',
          '--output-root',
          outputRoot,
        ],
        { cwd: REPO_ROOT, encoding: 'utf8' }
      );
      expect(ownerRun.status, ownerRun.stderr).toBe(0);
      expect(ownerRun.stdout).toContain('"status": "written"');
      expect(ownerRun.stdout).toContain('"mode": "owner"');
      expect(ownerRun.stdout).not.toContain(
        'character-combat-profile-catalog.json'
      );
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(
              outputRoot,
              'src',
              'data',
              'generated',
              'character-combat-owner-contracts',
              '101010.json'
            ),
            'utf8'
          )
        ).contractHash
      ).toBe(ownerContract.contractHash);
      expect(hashFile(VERIFIED_PACKAGE_PATH)).toBe(packageHashBefore);
    } finally {
      fs.rmSync(outputRoot, { recursive: true, force: true });
    }

    const rejectedRun = spawnSync(
      process.execPath,
      [scriptPath, '--owner', '999999', '--write'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    expect(rejectedRun.status).not.toBe(0);
    expect(rejectedRun.stderr).toContain('invalid public character owner');
    expect(hashFile(VERIFIED_PACKAGE_PATH)).toBe(packageHashBefore);
  }, 180000);

  it('keeps source, graph, runtime, and runtime-capture artifacts traceable', () => {
    expect(sourceManifest.summary.identityCount).toBeGreaterThan(800);
    expect(sourceManifest.entries.every(entry => entry.sourceIdentity)).toBe(
      true
    );
    expect(reachableGraph.summary).toMatchObject({
      controlCount: 20,
      nodeCount: expect.any(Number),
      edgeCount: expect.any(Number),
    });
    expect(runtimeCoverage.summary).toMatchObject({
      actionCount: 10,
      runtimeReadyActionCount: 10,
      executionFormCount: 21,
      controlCount: 20,
      hitCount: 107,
      resourceProfileCount: 1,
      thresholdTransitionCount: 1,
      passiveCount: 1,
      switchTriggerCount: 1,
    });
    expect(
      descriptionCoverage.entries.find(entry => entry.skillId === 10101062)
    ).toMatchObject({
      status: 'not-applicable',
      reasons: ['unnamed-secondary-passive-not-implemented-current-client'],
    });
  });

  it('compiles the missing Xiaoyu projectile hits and keeps passive triggers materialization-aware', () => {
    const controls = [
      ...(mechanicsPackage.controlBindings ?? []),
      ...(mechanicsPackage.actionVariantControlBindings ?? []),
    ];
    const hitRows = (controlSkillId, subSkillIndex) =>
      controls
        .find(control => Number(control.controlSkillId) === controlSkillId)
        ?.hits.filter(hit => Number(hit.mapIndex) === subSkillIndex)
        .map(hit => [
          Number(hit.elementId),
          Number(hit.trigger?.startFrame),
          Number(hit.damage?.weakBreakDamageRateBasisPoints),
          Number(hit.energy?.recoverSp),
          Number(hit.energy?.petRecoverSp),
        ]) ?? [];

    const chargedControl = controls.find(
      control => Number(control.controlSkillId) === 10101010
    );
    const chargedRows = subSkillIndex =>
      chargedControl.hits
        .filter(hit => Number(hit.mapIndex) === subSkillIndex)
        .map(hit => [
          Number(hit.trigger.startFrame),
          String(hit.trigger.behaviorPathId),
        ]);
    expect(chargedRows(0)).toEqual([
      [43, '-7087146377509109421'],
      [48, '3159062773038481747'],
      [53, '-6642754396445245101'],
      [58, '-3998789852959243949'],
      [63, '3369248819098059091'],
    ]);
    expect(chargedRows(1)).toEqual([
      [43, '5616861838181937694'],
      [48, '6305672671372980766'],
      [53, '5364022371415306782'],
      [58, '-7487986393461280226'],
      [63, '-7430536628355255778'],
    ]);
    expect(chargedRows(2)).toEqual([
      [20, '583489754312209092'],
      [31, '757619108977373892'],
      [36, '-3644096868183838012'],
      [41, '-3418413001291009340'],
      [46, '7192528456660021956'],
    ]);
    expect(
      sourceManifest.entries.some(entry =>
        entry.sourceIdentity.includes(
          'Hero/101010/SubSkill/ast_17351310762410000.asset'
        )
      )
    ).toBe(true);

    expect(hitRows(10101003, 0)).toEqual([[101010091, 18, 7000, 1599, 6100]]);
    expect(hitRows(10101004, 0)).toEqual([
      [101010107, 10, 7000, 2500, 9800],
      [101010107, 14, 7000, 2500, 9800],
      [101010107, 18, 7000, 2500, 9800],
      [101010107, 22, 7000, 2500, 9800],
    ]);
    expect(hitRows(10101004, 1)).toHaveLength(12);
    expect(hitRows(10101021, 0).map(row => row.slice(0, 2))).toEqual([
      [101010178, 55],
      [101010177, 109],
    ]);
    expect(hitRows(10101049, 1).map(row => row.slice(0, 2))).toEqual([
      [101010176, 31],
      [101010175, 96],
    ]);

    const perfectParry =
      mechanicsPackage.actionVariantGraph.publicActionForms.find(
        form =>
          Number(form.ownerId) === 101010 &&
          form.publicActionKind === 'perfect-parry'
      );
    expect(perfectParry).toMatchObject({
      publicControlSkillId: 10101027,
      executionControlSkillId: 10101049,
      executionSubSkillIndex: 1,
      selectionKind: 'wrapper-derived-execution',
      executionPrerequisite: {
        kind: 'scenario-event-at-action-frame',
        eventType: 'successful-parry',
      },
      applied: true,
    });

    const threshold =
      mechanicsPackage.specialResourceCatalog.thresholdTransitions.find(
        transition => Number(transition.ownerId) === 101010
      );
    expect(threshold?.tuningMarkGrants).toEqual([
      expect.objectContaining({
        profileKey: 'wind',
        markId: 750,
        stackDelta: 2,
        sourceField: 'notDelElementDataList',
        status: 'verified-threshold-tuning-mark-grant-ready',
        applied: true,
      }),
    ]);

    const passive = mechanicsPackage.specialResourceCatalog.passiveEffects.find(
      effect => Number(effect.ownerId) === 101010
    );
    expect(
      passive.triggerBindings.filter(
        trigger => Number(trigger.controlSkillId) === 10101025
      )
    ).toEqual([]);
    expect(
      passive.triggerBindings.map(trigger => Number(trigger.controlSkillId))
    ).toEqual(expect.arrayContaining([10101021, 10101049]));
  });

  it('keeps Xiaoyu policy declarative and removes the old contract generator', () => {
    const syncSource = fs.readFileSync(
      path.join(REPO_ROOT, 'scripts', 'sync-verified-combat-mechanics.mjs'),
      'utf8'
    );
    const ownerCliSource = fs.readFileSync(
      path.join(REPO_ROOT, 'scripts', 'sync-character-combat-profile.mjs'),
      'utf8'
    );
    expect(syncSource).not.toContain('attachXiaoyuMechanicsContracts');
    expect(syncSource).not.toContain('recipes: [XIAOYU_PROFILE_RECIPE]');
    expect(syncSource).not.toContain('compilations: [xiaoyuOwnerCompilation]');
    expect(syncSource).toContain('createCharacterCombatProductionBuild({');
    for (const functionName of [
      'findSkillControl',
      'collectBulletLaunchContracts',
      'createControlBinding',
      'createControlRuntimeEffects',
    ]) {
      expect(readFunctionSource(syncSource, functionName)).not.toMatch(
        /XIAOYU_MECHANICS|10101042/
      );
    }
    expect(ownerCliSource).toContain('createVerifiedCombatMechanicsBuild()');
    expect(ownerCliSource).not.toContain('character-combat-owner-contracts');
    expect(
      mechanicsPackage.actionVariantControlBindings.find(
        control => Number(control.controlSkillId) === 10101042
      )?.runtimePolicy
    ).toMatchObject({
      controlSkillId: 10101042,
      bulletInjectionMode: 'recursive-immediate',
      allowRuntimeTargetZeroDistance: true,
      runtimeEffectsUseScenarioTriggers: true,
    });
  });

  it('keeps character identities out of production runtime and UI branches', () => {
    const productionRoots = [
      'src/simulation',
      'src/views',
      'src/features',
      'src/domain',
    ];
    const offenders = productionRoots.flatMap(relativeRoot =>
      collectSourceFiles(path.join(REPO_ROOT, relativeRoot))
        .filter(
          filePath => !filePath.includes(`${path.sep}__tests__${path.sep}`)
        )
        .filter(filePath =>
          /101010|xiaoyu|涂山小玉|101003|han[ -]?youyou|寒悠悠/i.test(
            fs.readFileSync(filePath, 'utf8')
          )
        )
        .map(filePath => path.relative(REPO_ROOT, filePath))
    );
    expect(offenders).toEqual([]);
  });
});

function createNoopCompilerOperators() {
  return {
    normalizeControlWindows: () => [],
    resolveControlVariantTiming: () => null,
    resolveNormalAttackTiming: () => null,
    readElementAsset: () => null,
    createSemanticRootTriggers: () => [],
    resolveControlOwnerId: () => null,
  };
}

function collectSourceFiles(root) {
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.join(entry.parentPath, entry.name))
    .filter(filePath => /\.(?:js|mjs|vue)$/.test(filePath));
}

function hashFile(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  expect(start, `${functionName} source missing`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}
