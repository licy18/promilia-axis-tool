import { describe, expect, it } from 'vitest';
import {
  createSearchFingerprint,
  extractEmbeddedFingerprint,
  verifyArtifactFingerprint,
} from '../../../scripts/search-fingerprint.mjs';

describe('search run fingerprint contract', () => {
  it('produces the five input fingerprints', () => {
    const fp = createSearchFingerprint();
    expect(fp.authorityHead).toMatch(/^[0-9a-f]{40}$/);
    expect(fp.databaseContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fp.mechanismHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fp.dataVersionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fp.packageHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('accepts an artifact embedding the exact current fingerprint', () => {
    const fp = createSearchFingerprint();
    const artifact = { inputFingerprint: fp, shards: 105 };
    const result = verifyArtifactFingerprint(artifact);
    expect(result).toMatchObject({ valid: true, mismatches: [] });
  });

  it('fails closed when a fingerprint field is missing or differs', () => {
    const fp = createSearchFingerprint();
    const missing = verifyArtifactFingerprint({
      inputFingerprint: { ...fp, databaseContentHash: undefined },
    });
    expect(missing.valid).toBe(false);
    expect(missing.mismatches).toContain('missing:databaseContentHash');

    const stale = verifyArtifactFingerprint({
      inputFingerprint: { ...fp, authorityHead: '0'.repeat(40) },
    });
    expect(stale.valid).toBe(false);
    expect(stale.mismatches[0]).toContain('authorityHead');
  });

  it('extracts fingerprints from nested or top-level shapes', () => {
    const fp = createSearchFingerprint();
    expect(
      extractEmbeddedFingerprint({ inputFingerprint: fp }).databaseContentHash
    ).toBe(fp.databaseContentHash);
    expect(extractEmbeddedFingerprint(fp).packageHash).toBe(fp.packageHash);
    expect(extractEmbeddedFingerprint({ noFingerprint: true })).toBeNull();
  });
});
