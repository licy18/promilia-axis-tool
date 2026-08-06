import { describe, expect, it } from 'vitest';
import visualAcceptanceCatalog from '../../data/generated/m12-b3-visual-acceptance-catalog.json';
import { createVisualAcceptanceArtifacts } from '../../../scripts/generate-m12-b3-visual-acceptance.mjs';

describe('M12-B3 visual acceptance pipeline', () => {
  it('publishes 211 manifests and reaches 210 optimization-ready objects', async () => {
    const artifacts = await createVisualAcceptanceArtifacts();

    expect(artifacts.catalog.summary).toMatchObject({
      total: 254,
      published: 254,
      accepted: 227,
      optimizationReady: 227,
    });
    expect(artifacts.catalog.summary.byObjectKind).toEqual({
      'soul-essence': {
        total: 62,
        accepted: 62,
        optimizationReady: 62,
      },
      equipment: {
        total: 137,
        accepted: 137,
        optimizationReady: 137,
      },
      kibo: {
        total: 43,
        accepted: 17,
        optimizationReady: 17,
      },
      'set-skill': {
        total: 12,
        accepted: 11,
        optimizationReady: 11,
      },
    });
  });

  it('publishes Kibo manifests with maturity-gated ledgers and pending signoff', async () => {
    const artifacts = await createVisualAcceptanceArtifacts();
    const kiboManifests = artifacts.manifests.filter(
      manifest => manifest.owner.objectKind === 'kibo'
    );

    expect(kiboManifests).toHaveLength(43);
    expect(
      kiboManifests.every(manifest => manifest.evidence.icon?.status === 'verified')
    ).toBe(true);
    expect(
      kiboManifests.every(manifest =>
        manifest.evidence.productVisualAcceptance.status === 'pending'
          ? manifest.ledger.blockingCount > 0 &&
            manifest.maturity.optimizationReady === false
          : manifest.maturity.optimizationReady === true
      )
    ).toBe(true);
    expect(
      kiboManifests.filter(
        manifest => manifest.maturity.optimizationReady === true
      )
    ).toHaveLength(17);
    expect(
      kiboManifests.every(manifest =>
        manifest.matrix.requirements.some(
          entry =>
            entry.requirementIdentity ===
              'kibo-static-attribute-inheritance-audit' && entry.passed
        )
      )
    ).toBe(true);
  });

  it('keeps set-skill 3:4 blocked by its dynamic-unapplied ledger', async () => {
    const artifacts = await createVisualAcceptanceArtifacts();
    const entry = artifacts.catalog.entries.find(
      item => item.objectKind === 'set-skill' && item.objectId === '3:4'
    );
    expect(entry.optimizationReady).toBe(false);
    expect(entry.blockers).toEqual(
      expect.arrayContaining([
        'acceptance-required-matrix-incomplete',
        'acceptance-blocking-ledger-not-empty',
        'acceptance-product-visual-signoff-pending',
      ])
    );
    const manifest = artifacts.manifests.find(
      item => item.owner.objectKind === 'set-skill' && item.owner.objectId === '3:4'
    );
    expect(manifest.ledger.blockingCount).toBe(1);
    expect(manifest.ledger.records[0]).toMatchObject({
      uniqueGapIdentity: 'set-skill-dynamic-unapplied',
      blocking: true,
    });
  });

  it('verifies icon assets and effect binding for every soul essence', async () => {
    const artifacts = await createVisualAcceptanceArtifacts();
    const soulManifests = artifacts.manifests.filter(
      manifest => manifest.owner.objectKind === 'soul-essence'
    );

    expect(soulManifests).toHaveLength(62);
    expect(
      soulManifests.every(manifest => manifest.evidence.icon?.status === 'verified')
    ).toBe(true);
    expect(
      soulManifests.every(
        manifest =>
          manifest.evidence.binding?.runtimeStatus === 'runtime-applied' &&
          manifest.evidence.binding?.starLevelCount === 4
      )
    ).toBe(true);
    expect(
      soulManifests.every(
        manifest =>
          manifest.evidence.productVisualAcceptance.status === 'accepted' &&
          manifest.evidence.productVisualAcceptance.bindingStatus === 'verified'
      )
    ).toBe(true);
  });

  it('matches the committed catalog deterministically', async () => {
    const first = await createVisualAcceptanceArtifacts();
    const second = await createVisualAcceptanceArtifacts();

    expect(first.catalog.catalogHash).toBe(second.catalog.catalogHash);
    expect(first.catalog.catalogHash).toBe(
      visualAcceptanceCatalog.catalogHash
    );
  });
});
