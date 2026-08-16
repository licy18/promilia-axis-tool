import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  verifyOptimizationObjectSignoffRecord,
  verifySignoffRecord,
} from '../../../scripts/character-acceptance/signoff-record-verification.mjs';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
  );
}

function deriveFromManifest(ownerId) {
  const manifest = readJson(
    `reports/m11/character-acceptance/${ownerId}/manifest.json`
  );
  const pva = manifest.evidence?.productVisualAcceptance ?? {};
  return {
    qualificationSubjectHash:
      pva.bindingExpectation?.qualificationSubjectHash ??
      manifest.qualificationSubjectHash,
    scenarioSetHash:
      pva.bindingExpectation?.scenarioSetHash ?? pva.scenarioSetHash,
    scenarioIdentities:
      pva.bindingExpectation?.scenarioIdentities ??
      pva.scenarioIdentities ??
      [],
    canonicalTraceHash:
      manifest.evidence?.machineScenarios?.[0]?.canonicalHashes?.trace ?? null,
  };
}

describe('signoff record verification (P1-1/P1-2/P1-4 + review2)', () => {
  it('verifies the committed 101010 signoff record end-to-end', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    const result = verifySignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: deriveFromManifest(101010),
    });
    expect(result.verified).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.authentication.status).toBe('verified');
  });

  it('fails closed when derived values are unavailable (cannot skip auth)', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    const result = verifySignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: {},
    });
    expect(result.verified).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'signoff-record-derived-subject-unavailable',
        'signoff-record-derived-scenario-set-unavailable',
        'signoff-record-derived-scenario-unavailable',
        'signoff-record-derived-trace-unavailable',
      ])
    );
  });

  it('rejects subject drift (mechanism package rebuild invalidates old signoff)', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    const derived = deriveFromManifest(101010);
    const result = verifySignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: { ...derived, qualificationSubjectHash: 'deadbeefdeadbeef' },
    });
    expect(result.verified).toBe(false);
    expect(result.issues).toContain(
      'signoff-record-qualification-subject-mismatch'
    );
  });

  it('rejects scenario drift (record scene not in derived identities)', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    const derived = deriveFromManifest(101010);
    const result = verifySignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: {
        ...derived,
        scenarioIdentities: ['some-other-scene'],
      },
    });
    expect(result.verified).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'signoff-record-scenario-identity-mismatch',
        'signoff-record-evidence-scenario-mismatch:0',
      ])
    );
  });

  it('rejects canonical trace drift', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    const derived = deriveFromManifest(101010);
    const result = verifySignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: { ...derived, canonicalTraceHash: 'deadbeefdeadbeef' },
    });
    expect(result.verified).toBe(false);
    expect(result.issues).toContain('signoff-record-canonical-trace-mismatch');
  });

  it('rejects scenario set drift', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    const derived = deriveFromManifest(101010);
    const result = verifySignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: { ...derived, scenarioSetHash: 'deadbeefdeadbeef' },
    });
    expect(result.verified).toBe(false);
    expect(result.issues).toContain('signoff-record-scenario-set-mismatch');
  });

  it('rejects tampered record SHA (forged rebinding of old evidence)', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    const forged = structuredClone(recipe);
    forged.productVisualAcceptance.signoffRecordSha256 = '0'.repeat(64);
    const result = verifySignoffRecord(forged, {
      projectRoot: REPO_ROOT,
      derived: deriveFromManifest(101010),
    });
    expect(result.verified).toBe(false);
    expect(
      result.issues.some(i => i.startsWith('signoff-record-sha256-mismatch'))
    ).toBe(true);
  });

  it('rejects an invalid record commit (missing record in commit)', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    const forged = structuredClone(recipe);
    forged.productVisualAcceptance.acceptanceCommit = '0'.repeat(40);
    const result = verifySignoffRecord(forged, {
      projectRoot: REPO_ROOT,
      derived: deriveFromManifest(101010),
    });
    expect(result.verified).toBe(false);
    expect(
      result.issues.some(i => i.startsWith('signoff-record-missing-in-commit'))
    ).toBe(true);
  });

  it('rejects an empty evidence record (fail-closed structure)', () => {
    const recipe = readJson(
      'scripts/character-acceptance/acceptance-recipes/101010.json'
    );
    // 通过改 recipe 的 evidence 与 record 不匹配来触发截图 mismatch：
    const forged = structuredClone(recipe);
    forged.productVisualAcceptance.automatedEvidence = [
      { screenshotSha256: '0'.repeat(64), scenarioIdentity: 'x' },
    ];
    const result = verifySignoffRecord(forged, {
      projectRoot: REPO_ROOT,
      derived: deriveFromManifest(101010),
    });
    expect(result.verified).toBe(false);
    expect(
      result.issues.some(i => i.startsWith('signoff-record-evidence-'))
    ).toBe(true);
  });

  it('verifies the STARBORN object-level signoff record with subject binding (P1-3)', () => {
    const recipe = readJson(
      'scripts/character-acceptance/optimization-object-recipes/STARBORN.json'
    );
    const manifest = readJson(
      'reports/m11/character-acceptance/optimization-objects/STARBORN/manifest.json'
    );
    const subject = manifest.productAcceptanceBinding?.acceptanceSubjectHash;
    expect(subject).toMatch(/^[0-9a-f]{16}$/);
    const result = verifyOptimizationObjectSignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: { acceptanceSubjectHash: subject },
    });
    expect(result.verified).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.authentication.status).toBe('verified');

    // subject 漂移 → 拒绝
    const drifted = verifyOptimizationObjectSignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: { acceptanceSubjectHash: 'deadbeefdeadbeef' },
    });
    expect(drifted.verified).toBe(false);
    expect(drifted.issues).toContain(
      'signoff-record-acceptance-subject-mismatch'
    );

    // null subject → fail-closed（不能跳过认证）
    const missing = verifyOptimizationObjectSignoffRecord(recipe, {
      projectRoot: REPO_ROOT,
      derived: {},
    });
    expect(missing.verified).toBe(false);
    expect(missing.issues).toContain(
      'signoff-record-derived-subject-unavailable'
    );
  });
});
