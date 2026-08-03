import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertBeforeSkillCompositeRuntimeEvidenceReference,
  BEFORE_SKILL_COMPOSITE_EVIDENCE_RELATIVE_PATH,
  readBeforeSkillCompositeRuntimeEvidenceSource,
  validateBeforeSkillCompositeRuntimeEvidence,
} from '../../../scripts/optimization-qualification/before-skill-composite-evidence.mjs';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  ...BEFORE_SKILL_COMPOSITE_EVIDENCE_RELATIVE_PATH.split('/')
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';
const elementFormulaPath =
  'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/element_formula.json';

describe('BeforeSkill composite SP and team-heal native evidence', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readBeforeSkillCompositeRuntimeEvidenceSource({
        sourcePath: evidencePath,
        gameAssemblyPath,
        il2CppDumpPath,
        elementFormulaPath,
        projectRoot,
      }),
      fs
        .readFile(
          path.join(
            projectRoot,
            'reports',
            'm12',
            'm12-b3-c-dynamic-loadout-effect-acceptance.json'
          ),
          'utf8'
        )
        .then(JSON.parse),
    ]);
  }, 30_000);

  it('locks BeforeSkill condition, interval, ShareAll, AllHero, and heal-formula consumers', () => {
    expect(source.value).toMatchObject({
      contractName: 'AzPrBeforeSkillCompositeImmediateRuntimeEvidence',
      reviewedDefinition: {
        setId: 1,
        pieces: 4,
        skillId: 19998006,
        intervalMs: 12000,
        triggerCounter: -1,
        effects: [
          expect.objectContaining({
            kind: 'direct-sp',
            shareType: 2,
            petShareType: 0,
            mainPetShareType: 0,
            sourceRawValue: 16,
          }),
          expect.objectContaining({
            kind: 'direct-heal',
            targetType: 15,
            baseFunctionId: 108,
            sourceRawA: 400,
            baseExpression: '(target.MAXHP[0]*A)/10000',
          }),
        ],
      },
      semantics: {
        conditionFailureConsumesInterval: false,
        intervalBoundary: 'right-open-suppression-exact-boundary-admitted',
        petShare: 'independent-fields-no-share-when-zero',
      },
      conclusion: { status: 'applied' },
    });
    expect(source.value.binaryRanges).toHaveLength(14);
    expect(() =>
      assertBeforeSkillCompositeRuntimeEvidenceReference(
        report.sourceClosure.beforeSkillCompositeRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('rejects binary, dump, formula, interval, target, and semantic drift', () => {
    const mutations = [
      value => value.dumpBindings.methods.splice(0, 1),
      value => value.dumpBindings.fields.splice(0, 1),
      value => value.dumpBindings.enums.splice(0, 1),
      value => {
        value.binaryRanges[4].sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedBinary.sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedElementFormula.sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedDefinition.intervalMs = 11999;
      },
      value => {
        value.reviewedDefinition.effects[1].targetType = 0;
      },
      value => {
        value.semantics.conditionFailureConsumesInterval = true;
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateBeforeSkillCompositeRuntimeEvidence(value, source.observations)
      ).toThrow(/optimization-qualification-before-skill-composite-evidence-/u);
    }
  });

  it('rejects a stale acceptance-report evidence reference before generation', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'azpr-before-skill-composite-report-')
    );
    const tamperedReport = structuredClone(report);
    tamperedReport.sourceClosure.beforeSkillCompositeRuntimeEvidence.sha256 =
      '0'.repeat(64);
    const reportPath = path.join(tempRoot, 'acceptance.json');
    try {
      await fs.writeFile(
        reportPath,
        `${JSON.stringify(tamperedReport, null, 2)}\n`,
        'utf8'
      );
      await expect(
        createOptimizationQualificationArtifacts({
          projectRoot,
          dynamicLoadoutAcceptanceReportPath: reportPath,
        })
      ).rejects.toThrow(
        /before-skill-composite-evidence-report-reference-drift/u
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);

  it('keeps the C12-R1 acceptance report synchronized with generated qualification artifacts', async () => {
    const [summary, dynamicCensus, soulCatalog] = await Promise.all(
      [
        'reports/m12/m12-b3-optimization-qualification-summary.json',
        'reports/m12/m12-b3-dynamic-loadout-effect-census.json',
        'src/data/generated/soulessence-effect-mechanics.json',
      ].map(relativePath =>
        fs
          .readFile(path.join(projectRoot, ...relativePath.split('/')), 'utf8')
          .then(JSON.parse)
      )
    );

    expect(report).toMatchObject({
      phase: 'M12-B3-C12-R1',
      status: 'verification-complete-awaiting-product-acceptance',
      baseCommit: '8f01dba447106b03783582d58e80badb8a571b8e',
      reviewedC12Commit: 'a432467d4322ee0dae58e3d47df3b5c2eb55447a',
      batchResults: {
        runtimeAppliedSoulEssenceCount: 39,
        runtimeAppliedSetSkillCount: 10,
        remainingBlockedFourPieceSetSkillIds: [
          'set-skill:3:4',
          'set-skill:6:4',
        ],
      },
      qualification: {
        blockingUniqueGapCount: summary.gapCounts.blockingUniqueGapCount,
        blockingByCategory: summary.gapCounts.byCategory,
      },
      hashes: {
        sourceSnapshotHash: summary.sourceSnapshotHash,
        rosterHash: summary.rosterHash,
        manifestsHash: summary.manifestsHash,
        ledgerHash: summary.ledgerHash,
        bindingMatrixHash: summary.bindingMatrixHash,
        qualificationCatalogHash: summary.catalogHash,
        dynamicLoadoutEffectCensusHash: dynamicCensus.censusHash,
        soulEssenceEffectCatalogHash: soulCatalog.catalogHash,
        soulEssenceSourceSnapshotHash:
          soulCatalog.sourceSnapshot.sourceSnapshotHash,
        battlePropertyTagContractHash:
          soulCatalog.propertyTagContract.contractHash,
        soulEssenceTriggerContractHash:
          soulCatalog.triggerContract.contractHash,
      },
    });
  });
});
