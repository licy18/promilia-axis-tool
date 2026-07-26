import fs from 'node:fs';
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
  compileCharacterCombatRecipeContracts,
  createCharacterCombatOwnerRuntimeContracts,
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
  it('derives honest maturity and coverage against the fixed 20-character denominator', () => {
    expect(schema).toMatchObject({
      $id: 'azpr://schemas/character-combat-profile/v1',
      title: 'Azur Promilia Character Combat Profile',
    });
    expect(catalog).toMatchObject({
      status: 'character-combat-profile-catalog-ready',
      summary: {
        publicCharacterCount: 20,
        compiledProfileCount: 1,
        runtimeAppliedProfileCount: 1,
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

  it('publishes explicit form status and a deduplicated unresolved ledger', () => {
    expect(profile.denominator).toMatchObject({
      publicActionCount: 10,
      executionFormCount: 21,
      reachableControlCount: 20,
      verifiedWindowCount: 86,
      hitCount: 108,
    });
    expect(profile.contracts.actionForms).toHaveLength(21);
    expect(
      profile.contracts.actionForms.filter(item => item.status === 'applied')
    ).toHaveLength(19);
    expect(
      profile.contracts.actionForms.filter(
        item => item.status === 'static-evidence-gap'
      )
    ).toHaveLength(2);
    expect(
      profile.contracts.actionForms.every(
        item => PROFILE_STATUSES.has(item.status) && item.applied === (item.status === 'applied')
      )
    ).toBe(true);
    expect(unresolvedLedger.summary).toMatchObject({
      semanticRecordCount: 225,
      rawRecordCount: 410,
      impactClassificationCounts: {
        'gameplay-impacting': 99,
        'not-applicable': 36,
        unreachable: 22,
        'wrapper-or-duplicate': 68,
      },
    });
    expect(unresolvedLedger.records).toHaveLength(225);
    expect(unresolvedLedger.rawRecords).toHaveLength(410);
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
      compilerPath: 'src/simulation/compiler/compileProject.js',
      simulatorPath: 'src/simulation/engine/simulateScenario.js',
      validation: {
        status: 'authoritative-golden-runtime-expectation-passed',
        passed: true,
        assertionCount: 69,
        failedCount: 0,
      },
    });
    expect(goldenTrace.actual).toMatchObject({
      project: { durationMs: 120000, actionCount: 25 },
      actions: { blockedActionIds: [] },
      combat: {
        damageEventCount: 403,
        ownerDamageEventCount: 227,
        ownerHitEventCount: 111,
        ownerTotalHpDamage: 131213,
        ownerTotalToughnessDamage: 3704,
        enemy: { initialHp: 862800, finalHp: 547396 },
      },
      resources: {
        thresholdClearCount: 1,
        transformCount: 1,
        refreshCount: 1,
      },
      effects: {
        passiveMaxStacks: 4,
        firstPassiveMaxStackFrame: 761,
      },
      dynamicProperties: {
        maxPercentRawByAttributeId: {
          1: 1500,
          229: 9600,
        },
      },
      comparison: {
        primaryDamage: 248,
        baselineDamage: 52,
        damageDelta: 196,
      },
    });
    expect(
      goldenTrace.actual.resources.actorSpByActorId['actor-101010']
    ).toMatchObject({
      initialValue: 100,
      currentValue: 31.856216,
      autoRecovery: [
        {
          reason: 'verified-auto-sp-background',
          totalChange: 1.904298,
        },
        {
          reason: 'verified-auto-sp-foreground',
          totalChange: 19.953224,
        },
      ],
    });
    expect(
      goldenTrace.actual.resources.kiboSpBySlotId['team-slot-3']
    ).toMatchObject({
      kiboId: 500039,
      initialValue: 100,
      currentValue: 31.908417,
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
    expect(tamperedValidation.assertions.find(item => !item.passed)).toMatchObject(
      {
        jsonPath: 'combat.ownerTotalHpDamage',
        expected: 131214,
        actual: 131213,
      }
    );
  });

  it(
    'keeps owner-only audits deterministic without overwriting the full package',
    () => {
      const packageHashBefore = hashFile(VERIFIED_PACKAGE_PATH);
      const scriptPath = path.join(
        REPO_ROOT,
        'scripts',
        'sync-character-combat-profile.mjs'
      );
      const cleanRun = spawnSync(
        process.execPath,
        [scriptPath, '--owner', '101010', '--assert-clean'],
        { cwd: REPO_ROOT, encoding: 'utf8' }
      );
      expect(cleanRun.status, cleanRun.stderr).toBe(0);
      expect(cleanRun.stdout).toContain('"status": "clean"');
      expect(cleanRun.stdout).toContain('"mode": "owner"');
      expect(cleanRun.stdout).not.toContain(
        'character-combat-profile-catalog.json'
      );
      expect(hashFile(VERIFIED_PACKAGE_PATH)).toBe(packageHashBefore);

      const rejectedRun = spawnSync(
        process.execPath,
        [scriptPath, '--owner', '999999', '--write'],
        { cwd: REPO_ROOT, encoding: 'utf8' }
      );
      expect(rejectedRun.status).not.toBe(0);
      expect(rejectedRun.stderr).toContain('invalid public character owner');
      expect(hashFile(VERIFIED_PACKAGE_PATH)).toBe(packageHashBefore);
    },
    30000
  );

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
      runtimeReadyActionCount: 7,
      executionFormCount: 21,
      controlCount: 20,
      hitCount: 108,
      resourceProfileCount: 1,
      thresholdTransitionCount: 1,
      passiveCount: 1,
      switchTriggerCount: 1,
    });
    expect(
      descriptionCoverage.entries.find(entry => entry.skillId === 10101062)
    ).toMatchObject({
      status: 'not-applicable',
      reasons: ['client-passive-not-implemented'],
    });
  });

  it('has no Xiaoyu contract attachment call in the production sync path', () => {
    const syncSource = fs.readFileSync(
      path.join(REPO_ROOT, 'scripts', 'sync-verified-combat-mechanics.mjs'),
      'utf8'
    );
    const callSites = syncSource
      .split(/\r?\n/)
      .filter(
        line =>
          line.includes('attachXiaoyuMechanicsContracts(') &&
          !line.trimStart().startsWith('function attachXiaoyuMechanicsContracts')
      );
    expect(callSites).toEqual([]);
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
          /101010|xiaoyu|涂山小玉/i.test(fs.readFileSync(filePath, 'utf8'))
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
