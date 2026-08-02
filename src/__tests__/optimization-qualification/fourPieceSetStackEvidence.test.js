import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertFourPieceSetStackRuntimeEvidenceReference,
  FOUR_PIECE_SET_STACK_EVIDENCE_RELATIVE_PATH,
  readFourPieceSetStackRuntimeEvidenceSource,
  validateFourPieceSetStackRuntimeEvidence,
} from '../../../scripts/optimization-qualification/four-piece-set-stack-evidence.mjs';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  ...FOUR_PIECE_SET_STACK_EVIDENCE_RELATIVE_PATH.split('/')
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';

describe('four-piece BeforeDamage stack native evidence', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readFourPieceSetStackRuntimeEvidenceSource({
        sourcePath: evidencePath,
        gameAssemblyPath,
        il2CppDumpPath,
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

  it('binds capped aggregate layers to a shared refreshed absolute expiry', () => {
    expect(source.value).toMatchObject({
      contractName: 'AzPrFourPieceSetBeforeDamageStackRuntimeEvidence',
      semantics: {
        triggerPhase: 'before-damage-dispatch-before-current-packet-settlement',
        conditionSelector: 'event-final-control-binding-skill-tags',
        combineType: 'overlying-capped-single-aggregate-layer',
        stackCapSource: 'property-combine-number',
        stackLifetime: 'shared-absolute-end-time-refreshed-to-later-expiry',
        expiryInterval: 'right-open',
        inheritance: 'none',
      },
      conclusion: { status: 'applied' },
    });
    expect(source.value.binaryRanges).toHaveLength(5);
    expect(() =>
      assertFourPieceSetStackRuntimeEvidenceReference(
        report.sourceClosure.fourPieceSetStackRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('locks the two reviewed source definitions without turning IDs into runtime branches', () => {
    expect(source.value.reviewedDefinitions).toEqual([
      expect.objectContaining({
        setId: 2,
        pieces: 4,
        skillId: 19998004,
        triggerElementId: 199999020,
        propertyElementId: 199999021,
        combineType: 4,
        combineNumber: 5,
      }),
      expect.objectContaining({
        setId: 4,
        pieces: 4,
        skillId: 19998003,
        conditions: [
          { conditionType: 11, conditionValue: 1, conditionExtra: 0 },
        ],
        propertyElementId: 199999019,
        combineType: 4,
        combineNumber: 7,
      }),
    ]);
  });

  it('rejects drift in native ranges, enums, semantics, definitions, and binary identity', () => {
    const mutations = [
      value => value.dumpBindings.methods.splice(0, 1),
      value => value.dumpBindings.fields.splice(0, 1),
      value => value.dumpBindings.enums.splice(0, 1),
      value => {
        value.binaryRanges[1].sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedDefinitions[0].combineNumber = 6;
      },
      value => {
        value.reviewedBinary.sha256 = '0'.repeat(64);
      },
      value => {
        value.semantics.stackLifetime = 'independent-per-layer';
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateFourPieceSetStackRuntimeEvidence(value, source.observations)
      ).toThrow(/optimization-qualification-four-piece-set-stack-evidence-/u);
    }
  });

  it('makes generation reject a stale acceptance-report reference', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'azpr-four-piece-stack-report-')
    );
    const tamperedReport = structuredClone(report);
    tamperedReport.sourceClosure.fourPieceSetStackRuntimeEvidence.sha256 =
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
      ).rejects.toThrow(/four-piece-set-stack-evidence-report-reference-drift/u);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
