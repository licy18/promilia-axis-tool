import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createM12B3BindingMatrix } from '../../../scripts/generate-m12-b3-binding-matrix.mjs';
import { getVerifiedNormalAttackInputAuthorityDescriptor } from '../../domain/verifiedNormalAttackInputAuthority';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
describe('M12-B3-E22 binding matrix and formal admission', () => {
  let generatedReport;

  beforeAll(async () => {
    const { report } = await createM12B3BindingMatrix({ projectRoot });
    generatedReport = report;
  }, 120_000);

  it('generates a deterministic binding matrix with every dimension green', async () => {
    const report = structuredClone(generatedReport);
    delete report.generatedAt;
    const regenerated = structuredClone(
      (await createM12B3BindingMatrix({ projectRoot })).report
    );
    delete regenerated.generatedAt;

    expect(report.summary).toEqual({
      checkCount: 22,
      passedCount: 22,
      blockedCount: 0,
      allPassed: true,
    });
    // 生成器确定性自检（不再与磁盘镜像全等死绑；镜像由生成器刷新）
    expect(report).toEqual(regenerated);
    expect(report.bindingMatrixHash).toMatch(/^[a-f0-9]{16}$/);
  }, 120_000);

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
    const layerHashes = JSON.parse(
      fs.readFileSync(
        path.join(
          projectRoot,
          'src/data/generated/verified-combat-mechanics-layer-hashes.json'
        ),
        'utf8'
      )
    );
    expect(report.hashes.verifiedMechanicsPackageHash).toBe(
      layerHashes.packageHash
    );
  });

  it('binds the Ruby cycle probe to the verified normal-input chain and contexts', () => {
    const detail = generatedReport.scenarioMatrix[
      'continuous-cycle'
    ].checks.find(
      check => check.identity === 'cycle-closed-with-stable-hashes'
    ).detail;

    expect(detail.normalAttackInputAuthorityHash).toBe(
      getVerifiedNormalAttackInputAuthorityDescriptor().contractHash
    );
    expect(detail.rubyChainIdentity).toBe('ruby-normal-default-three-inputs');
    expect(detail.rubyContractInputs).toEqual([
      {
        actionId: 'cycle-ruby-a1',
        sequenceIndex: 1,
        contextActionId: null,
        frame: 60,
      },
      {
        actionId: 'cycle-ruby-a2',
        sequenceIndex: 2,
        contextActionId: 'cycle-ruby-a1',
        frame: 75,
      },
      {
        actionId: 'cycle-ruby-a3',
        sequenceIndex: 3,
        contextActionId: 'cycle-ruby-a2',
        frame: 98,
      },
    ]);
    expect(detail.rubyInputDecisions).toEqual([
      {
        actionId: 'cycle-ruby-a1',
        phase: 'idle',
        sourceActionId: null,
        sequenceIndex: 1,
        accepted: true,
      },
      {
        actionId: 'cycle-ruby-a2',
        phase: 'successor-window',
        sourceActionId: 'cycle-ruby-a1',
        sequenceIndex: 2,
        accepted: true,
      },
      {
        actionId: 'cycle-ruby-a3',
        phase: 'successor-window',
        sourceActionId: 'cycle-ruby-a2',
        sequenceIndex: 3,
        accepted: true,
      },
    ]);
  });
});
