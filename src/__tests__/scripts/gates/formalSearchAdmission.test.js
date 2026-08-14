import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as scopePolicyModule from '../../../domain/kiboAxisActionScopePolicy.js';
import {
  createKiboAxisActionScopeEvidence,
  evaluateFormalSearchAdmission,
  loadFormalSearchAdmissionEvidence,
} from '../../../../scripts/gates/formal-search-admission.mjs';
import { getGateDefinition } from '../../../../scripts/gates/gate-definitions.mjs';

let currentEvidence;

beforeAll(async () => {
  currentEvidence = await loadFormalSearchAdmissionEvidence({
    repositoryRoot: process.cwd(),
    releaseProof: {
      status: 'pass',
      mode: 'executed',
      exitCode: 0,
      head: 'test-head',
    },
    deterministicProof: {
      status: 'pass',
      mode: 'executed',
      coverage: getGateDefinition('determinism').formalCoverage,
    },
  });
});

describe('formal search admission', () => {
  it('loads the scope policy through native Node ESM', () => {
    const moduleUrl = pathToFileURL(
      resolve('src/domain/kiboAxisActionScopePolicy.js')
    ).href;
    const imported = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `const policy = await import(${JSON.stringify(
          moduleUrl
        )}); process.stdout.write(JSON.stringify(policy.getKiboAxisActionScopePolicy()));`,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );

    expect(imported.status, imported.stderr).toBe(0);
    expect(JSON.parse(imported.stdout)).toMatchObject({
      policyId: 'm12c-kibo-axis-action-scope-v1',
      policyVersion: '1.0.0',
    });
  });

  it('loads the normal attack input authority through native Node ESM', () => {
    const moduleUrl = pathToFileURL(
      resolve('src/domain/verifiedNormalAttackInputAuthority.js')
    ).href;
    const imported = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `const authority = await import(${JSON.stringify(
          moduleUrl
        )}); process.stdout.write(JSON.stringify(authority.getVerifiedNormalAttackInputAuthorityDescriptor()));`,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );

    expect(imported.status, imported.stderr).toBe(0);
    expect(JSON.parse(imported.stdout)).toMatchObject({
      contractName: 'AzPrVerifiedNormalAttackInputAuthority',
      policyVersion: 2,
      contractHash: expect.stringMatching(/^[a-f0-9]{16}$/),
    });
  });

  it('binds all admitted Kibo autonomous surfaces to the product-deferred scope', async () => {
    const result = await evaluateFormalSearchAdmission(currentEvidence);

    expect(result.status).toBe('ready');
    expect(result.blockers).not.toContain('database-content-hash-recorded');
    expect(currentEvidence.databaseContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.blockers).not.toContain('kibo-axis-action-scope-applied');
    expect(result.blockers).not.toContain('normal-attack-combo-authority');
    expect(currentEvidence.normalAttackInputAuthority).toMatchObject({
      schemaVersion: 1,
      contractName: 'AzPrVerifiedNormalAttackInputAuthority',
      policyVersion: 2,
      structuralFallbackPolicy:
        'verified-graph-then-unique-mapping-reachable-prefix',
      reachablePrefixPolicy:
        'unique-a1-exact-control-subskill-contiguous-adjacency',
      contractHash: expect.stringMatching(/^[a-f0-9]{16}$/),
    });
    expect(currentEvidence.kiboAxisActionScope).toMatchObject({
      ready: true,
      status: 'kibo-axis-action-scope-ready',
      policyValidation: { valid: true, issues: [] },
      policy: {
        includedAxisActionKinds: ['signature', 'break'],
        deferredAutonomousActionKinds: ['normal-attack', 'active'],
        retainedCalculationSurfaces: ['signature', 'joint-attack', 'passive'],
      },
      census: {
        admittedKiboCount: 43,
        deferredAutonomousSurfaceCount: 71,
        normalAttackSurfaceCount: 43,
        activeSurfaceCount: 28,
        signatureSurfaceCount: 43,
        jointAttackSurfaceCount: 43,
        missingCatalogKiboIds: [],
        unexpectedSurfaceKeys: [],
      },
    });
    expect(result.clientParity).toMatchObject({
      ready: false,
      blockingForCurrentFormalScore: false,
    });
  });

  it('still requires an executed clean release proof', async () => {
    const evidence = structuredClone(currentEvidence);
    evidence.releaseProof = {
      ...evidence.releaseProof,
      status: 'fail',
      exitCode: 1,
    };
    const blocked = await evaluateFormalSearchAdmission(evidence);

    expect(blocked.status).toBe('blocked');
    expect(blocked.blockers).toContain('release-verify-executed-pass');
  });

  it('fails closed when combo authority coverage or its descriptor hash is missing', async () => {
    const missingCoverage = structuredClone(currentEvidence);
    missingCoverage.deterministicProof.coverage.comboContinuationPreScore = false;
    expect(
      (await evaluateFormalSearchAdmission(missingCoverage)).blockers
    ).toContain('normal-attack-combo-authority');

    const missingHash = structuredClone(currentEvidence);
    delete missingHash.normalAttackInputAuthority.contractHash;
    expect(
      (await evaluateFormalSearchAdmission(missingHash)).blockers
    ).toContain('normal-attack-combo-authority');

    const stalePolicy = structuredClone(currentEvidence);
    stalePolicy.normalAttackInputAuthority = {
      ...stalePolicy.normalAttackInputAuthority,
      policyVersion: 1,
      contractHash: '780cb44a08c522eb',
    };
    delete stalePolicy.normalAttackInputAuthority.structuralFallbackPolicy;
    delete stalePolicy.normalAttackInputAuthority.reachablePrefixPolicy;
    expect(
      (await evaluateFormalSearchAdmission(stalePolicy)).blockers
    ).toContain('normal-attack-combo-authority');

    const forgedHash = structuredClone(currentEvidence);
    forgedHash.normalAttackInputAuthority.contractHash = '0000000000000000';
    expect(
      (await evaluateFormalSearchAdmission(forgedHash)).blockers
    ).toContain('normal-attack-combo-authority');

    const sameShapeChangedField = structuredClone(currentEvidence);
    sameShapeChangedField.normalAttackInputAuthority.intervalPolicy =
      'closed-interval-forgery';
    expect(
      (await evaluateFormalSearchAdmission(sameShapeChangedField)).blockers
    ).toContain('normal-attack-combo-authority');
  });

  it('does not confuse clientParityReady=false with qualification readiness', async () => {
    const evidence = structuredClone(currentEvidence);
    evidence.formalRuntimeBaseline.clientParityReady = false;
    const result = await evaluateFormalSearchAdmission(evidence);

    expect(result.ready).toBe(true);
    expect(result.clientParity.status).toBe('pending');
  });

  it('accepts only complete catalog coverage under the versioned policy', () => {
    const ready = createKiboAxisActionScopeEvidence({
      ...createKiboScopeFixture(),
      scopePolicyModule,
    });
    expect(ready).toMatchObject({
      ready: true,
      status: 'kibo-axis-action-scope-ready',
      expectedCensus: {
        admittedKiboCount: 43,
        catalogKiboCount: 43,
        deferredAutonomousSurfaceCount: 71,
        normalAttackSurfaceCount: 43,
        activeSurfaceCount: 28,
        includedActionSurfaceCount: 86,
        signatureSurfaceCount: 43,
        jointAttackSurfaceCount: 43,
      },
      census: {
        admittedKiboCount: 43,
        deferredAutonomousSurfaceCount: 71,
        includedActionSurfaceCount: 86,
      },
      denominatorMismatches: [],
    });

    const missingBreakFixture = createKiboScopeFixture();
    missingBreakFixture.kiboActionCatalog.items[0].actions =
      missingBreakFixture.kiboActionCatalog.items[0].actions.filter(
        action => action.kind !== 'break'
      );
    const missingBreak = createKiboAxisActionScopeEvidence({
      ...missingBreakFixture,
      scopePolicyModule,
    });
    expect(missingBreak.ready).toBe(false);
    expect(missingBreak.issues).toContain(
      'kibo-axis-action-scope-included-coverage-incomplete'
    );

    const missingActiveFixture = createKiboScopeFixture();
    missingActiveFixture.kiboActionCatalog.items[0].actions =
      missingActiveFixture.kiboActionCatalog.items[0].actions.filter(
        action => action.kind !== 'active'
      );
    const missingActive = createKiboAxisActionScopeEvidence({
      ...missingActiveFixture,
      scopePolicyModule,
    });
    expect(missingActive.ready).toBe(false);
    expect(missingActive.issues).toEqual(
      expect.arrayContaining([
        'kibo-axis-action-scope-denominator-mismatch',
        'kibo-axis-action-scope-denominator-mismatch:deferredAutonomousSurfaceCount',
        'kibo-axis-action-scope-denominator-mismatch:activeSurfaceCount',
      ])
    );
  });

  it('fails closed when the scope policy validator or action kind drifts', () => {
    const invalidPolicy = createKiboAxisActionScopeEvidence({
      ...createKiboScopeFixture(),
      scopePolicyModule: {
        ...scopePolicyModule,
        validateKiboAxisActionScopePolicy: () => ({
          valid: false,
          issues: ['test-policy-invalid'],
        }),
      },
    });
    expect(invalidPolicy).toMatchObject({
      ready: false,
      issues: expect.arrayContaining(['test-policy-invalid']),
    });

    const unexpectedFixture = createKiboScopeFixture();
    unexpectedFixture.kiboActionCatalog.items[0].actions.push({
      skillId: 599999,
      kind: 'unknown-autonomous-kind',
      petSkillLogicTag: '0',
    });
    const unexpected = createKiboAxisActionScopeEvidence({
      ...unexpectedFixture,
      scopePolicyModule,
    });
    expect(unexpected.ready).toBe(false);
    expect(unexpected.issues).toContain(
      'kibo-axis-action-scope-unexpected-kind'
    );
  });
});

function createKiboScopeFixture() {
  const kiboIds = Array.from({ length: 43 }, (_, index) => 500001 + index);
  return {
    qualificationCatalog: {
      catalogHash: 'qualification-hash',
      admission: { kibos: kiboIds },
    },
    kiboActionCatalog: {
      items: kiboIds.map((kiboId, index) => ({
        kiboId,
        actions: [
          { skillId: kiboId * 100 + 2, kind: 'signature' },
          { skillId: kiboId * 100 + 12, kind: 'break' },
          {
            skillId: kiboId * 100 + 3,
            kind: 'normal-attack',
            petSkillLogicTag: '0',
          },
          ...(index < 28
            ? [
                {
                  skillId: kiboId * 100 + 4,
                  kind: 'active',
                  petSkillLogicTag: '0',
                },
              ]
            : []),
        ],
      })),
    },
    actionCatalogSource: Buffer.from('catalog-v1'),
    schedulerSource: Buffer.from('scheduler-v1'),
    searchGeneratorSource: Buffer.from('search-generator-v1'),
    machineAxisServiceSource: Buffer.from('machine-axis-service-v1'),
  };
}
