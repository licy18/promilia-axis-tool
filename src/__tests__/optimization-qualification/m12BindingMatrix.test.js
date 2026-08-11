import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createM12B3BindingMatrix } from '../../../scripts/generate-m12-b3-binding-matrix.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const committedReport = JSON.parse(
  fs.readFileSync(
    path.join(projectRoot, 'reports', 'm12', 'm12-b3-binding-matrix.json'),
    'utf8'
  )
);

describe('M12-B3-E22 binding matrix and formal admission', () => {
  let generatedReport;

  beforeAll(async () => {
    const { report } = await createM12B3BindingMatrix({ projectRoot });
    generatedReport = report;
  }, 30_000);

  it('regenerates the committed binding matrix with every dimension green', async () => {
    const report = structuredClone(generatedReport);
    delete report.generatedAt;
    const committed = structuredClone(committedReport);
    delete committed.generatedAt;

    expect(report.summary).toEqual({
      checkCount: 22,
      passedCount: 22,
      blockedCount: 0,
      allPassed: true,
    });
    expect(report.bindingMatrixHash).toBe(committedReport.bindingMatrixHash);
    expect(report).toEqual(committed);
  }, 30_000);

  it('locks the frozen denominators, artifact hashes, and the eight binding dimensions', async () => {
    const report = generatedReport;

    expect(report.denominators).toEqual({
      characterOptimizationObjects: 9,
      sourceCharacterAliases: 10,
      kibos: 43,
      soulEssences: 62,
      equipment: 137,
      setSkills: 12,
    });
    expect(report.staticMatrix.status).toBe('passed');
    expect(report.reLock.status).toBe('passed');
    for (const dimension of [
      'loadout-to-character',
      'character-to-kibo-inheritance',
      'effect-source-target',
      'foreground-background-switch',
      'cross-owner-kibo-isolation',
      'same-frame-ordering',
      'save-replay',
      'continuous-cycle',
    ]) {
      expect(report.scenarioMatrix[dimension].status).toBe('passed');
    }
    expect(report.hashes.verifiedMechanicsPackageHash).toBe(
      'fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58'
    );
  });
});
