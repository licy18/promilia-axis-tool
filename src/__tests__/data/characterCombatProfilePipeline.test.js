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
import catalog from '../../data/generated/character-combat-profile-catalog.json';
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
  it('publishes a versioned Xiaoyu profile against the fixed 20-character denominator', () => {
    expect(schema).toMatchObject({
      $id: 'azpr://schemas/character-combat-profile/v1',
      title: 'Azur Promilia Character Combat Profile',
    });
    expect(catalog).toMatchObject({
      status: 'character-combat-profile-catalog-ready',
      summary: {
        publicCharacterCount: 20,
        compiledProfileCount: 1,
        uiVerifiedProfileCount: 1,
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
      progressState: 'ui-verified',
      publicActionCount: 10,
      profileIdentity: profile.profileIdentity,
      profileHash: profile.profileHash,
    });
    expect(
      coverageManifest.rows.filter(row => row.progressState === 'ui-verified')
    ).toHaveLength(1);
    expect(
      coverageManifest.rows
        .filter(row => row.ownerId !== 101010)
        .every(row => row.progressState === 'evidence-indexed')
    ).toBe(true);
  });

  it('keeps owner-only audits deterministic without overwriting the valid full package', () => {
    const packageHashBefore = hashFile(VERIFIED_PACKAGE_PATH);
    const scriptPath = path.join(
      REPO_ROOT,
      'scripts',
      'sync-character-combat-profile.mjs'
    );
    const cleanRun = spawnSync(
      process.execPath,
      [scriptPath, '--owner', '101010', '--assert-clean'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }
    );
    expect(cleanRun.status, cleanRun.stderr).toBe(0);
    expect(cleanRun.stdout).toContain('"status": "clean"');
    expect(hashFile(VERIFIED_PACKAGE_PATH)).toBe(packageHashBefore);

    const rejectedRun = spawnSync(
      process.execPath,
      [scriptPath, '--owner', '999999', '--write'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }
    );
    expect(rejectedRun.status).not.toBe(0);
    expect(rejectedRun.stderr).toContain('invalid public character owner');
    expect(hashFile(VERIFIED_PACKAGE_PATH)).toBe(packageHashBefore);
  });

  it('closes the Xiaoyu discovery denominator without hiding unresolved evidence', () => {
    expect(profile).toMatchObject({
      kind: 'azpr-character-combat-profile',
      completionState: 'ui-verified',
      owner: {
        ownerKind: 'actor',
        ownerId: 101010,
        ownerName: '涂山小玉',
      },
      denominator: {
        publicActionCount: 10,
        executionFormCount: 21,
        reachableControlCount: 20,
        verifiedWindowCount: 86,
        hitCount: 108,
      },
      validation: {
        status: 'character-combat-profile-valid',
        issues: [],
      },
    });
    expect(profile.profileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(profile.contracts.timingInputEdges).toHaveLength(7);
    expect(profile.contracts.attackInputChains).toHaveLength(2);
    expect(profile.contracts.resourceProfiles).toHaveLength(1);
    expect(profile.contracts.stateMachines).toHaveLength(1);
    expect(profile.contracts.passives).toHaveLength(1);
    expect(profile.contracts.switchTriggers).toHaveLength(1);
    expect(profile.contracts.resourceTransactions).toHaveLength(30);
    expect(
      profile.coverage.every(item => PROFILE_STATUSES.has(item.status))
    ).toBe(true);
    expect(unresolvedLedger.records.length).toBeGreaterThan(0);
    expect(
      unresolvedLedger.records.every(
        record =>
          PROFILE_STATUSES.has(record.status) &&
          record.status !== 'applied' &&
          record.recordIdentity &&
          Array.isArray(record.reasons) &&
          record.reasons.length > 0
      )
    ).toBe(true);
  });

  it('binds the normalized profile to generic runtime operators and package metadata', () => {
    expect(profile.runtimeCompilation).toMatchObject({
      status: 'character-combat-runtime-contract-compiled',
      ownerId: 101010,
      operatorContractVersion: 1,
    });
    expect(profile.runtimeCompilation.contractHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      profile.runtimeCompilation.outputBindings.map(
        binding => binding.packagePath
      )
    ).toEqual(
      expect.arrayContaining([
        'actionMappings',
        'actionVariantGraph.publicActionForms',
        'actionVariantGraph.contextEdges',
        'actionVariantGraph.attackInputChains',
        'controlBindings.hits',
        'specialResourceCatalog.operationBindings',
        'specialResourceCatalog.thresholdTransitions',
        'specialResourceCatalog.passiveEffects',
        'switchTriggerCatalog.profiles',
      ])
    );
    expect(
      profile.runtimeCompilation.outputBindings.every(
        binding =>
          binding.operator &&
          Number.isInteger(binding.recordCount) &&
          /^[a-f0-9]{64}$/.test(binding.recordsHash)
      )
    ).toBe(true);

    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const metadata = getVerifiedCharacterCombatProfileMetadata(101010);
    expect(metadata).toEqual(
      expect.objectContaining({
        profileIdentity: profile.profileIdentity,
        profileHash: profile.profileHash,
        runtimeContractHash: profile.runtimeCompilation.contractHash,
        completionState: 'ui-verified',
      })
    );
    expect(profile).toMatchObject({
      profileIdentity: metadata.profileIdentity,
      profileHash: metadata.profileHash,
      validation: { status: metadata.status },
      runtimeCompilation: {
        contractHash: metadata.runtimeContractHash,
      },
    });
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

  it('keeps source, graph, description, runtime, and capture artifacts traceable', () => {
    expect(sourceManifest.summary.identityCount).toBeGreaterThan(800);
    expect(sourceManifest.entries.every(entry => entry.sourceIdentity)).toBe(
      true
    );
    expect(reachableGraph.summary).toMatchObject({
      controlCount: 20,
      nodeCount: expect.any(Number),
      edgeCount: expect.any(Number),
    });
    expect(reachableGraph.summary.nodeCount).toBeGreaterThan(150);
    expect(reachableGraph.summary.edgeCount).toBeGreaterThan(200);
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
      descriptionCoverage.entries.every(
        entry =>
          PROFILE_STATUSES.has(entry.status) &&
          entry.coverageReferences.every(
            reference => !String(reference).includes('undefined')
          )
      )
    ).toBe(true);
    expect(
      descriptionCoverage.entries.find(entry => entry.skillId === 10101062)
    ).toMatchObject({
      status: 'not-applicable',
      reasons: ['client-passive-not-implemented'],
    });
  });

  it('ships the 120-second three-actor golden trace with exact state and context events', () => {
    expect(goldenTrace).toMatchObject({
      ownerId: 101010,
      durationFrames: 7200,
      durationMs: 120000,
      frameRate: 60,
      teamCharacterIds: [101010, 101007, 101003],
      switchEvents: [
        {
          startFrame: 300,
          sourceCharacterId: 101010,
          targetCharacterId: 101007,
        },
        {
          startFrame: 420,
          sourceCharacterId: 101007,
          targetCharacterId: 101010,
        },
      ],
      assertions: {
        thresholdStateEntered: true,
        ultimateRefreshPresent: true,
        burstChainControls: [10101001, 10101004, 10101005],
        enhancedSpecialChargedControl: {
          controlSkillId: 10101042,
          subSkillIndex: 1,
        },
        passiveMaxStacks: 4,
        frontBackSpIntervalsPresent: true,
        teamStatPropagationRequired: true,
      },
    });
    expect(
      goldenTrace.expectedTrace.find(
        event => event.eventIdentity === 'golden:threshold-state-enter'
      )
    ).toMatchObject({
      frame: 43,
      before: 95,
      delta: 5,
      threshold: 100,
      after: 0,
      stateElementId: 101010129,
      stateDurationMs: 10000,
    });
    expect(
      goldenTrace.expectedTrace.find(
        event =>
          event.eventIdentity ===
          'golden:ultimate-refresh:resource:transform:272'
      )
    ).toMatchObject({
      frame: 872,
      stateElementId: 101010129,
    });
    expect(
      goldenTrace.expectedTrace.find(
        event =>
          event.eventIdentity ===
          'golden:burst-derived-charged:context-selection'
      )
    ).toMatchObject({
      frame: 1118,
      semanticName: '强化特殊重击',
      executionControlSkillId: 10101042,
      executionSubSkillIndex: 1,
    });
    expect(
      goldenTrace.expectedTrace.find(
        event => event.eventIdentity === 'golden:passive-max-stack-snapshot'
      )
    ).toMatchObject({
      stackCount: 4,
      modifiers: expect.arrayContaining([
        expect.objectContaining({ attributeId: 1, totalRaw: 2000 }),
        expect.objectContaining({ attributeId: 229, totalRaw: 12800 }),
      ]),
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
          /101010|xiaoyu|涂山小玉/i.test(fs.readFileSync(filePath, 'utf8'))
        )
        .map(filePath => path.relative(REPO_ROOT, filePath))
    );
    expect(offenders).toEqual([]);
  });
});

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
