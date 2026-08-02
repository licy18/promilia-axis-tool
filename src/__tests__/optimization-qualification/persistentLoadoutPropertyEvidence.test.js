import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertPersistentLoadoutPropertyRuntimeEvidenceReference,
  PERSISTENT_LOADOUT_PROPERTY_EVIDENCE_RELATIVE_PATH,
  readPersistentLoadoutPropertyRuntimeEvidenceSource,
  validatePersistentLoadoutPropertyRuntimeEvidence,
} from '../../../scripts/optimization-qualification/persistent-loadout-property-evidence.mjs';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  ...PERSISTENT_LOADOUT_PROPERTY_EVIDENCE_RELATIVE_PATH.split('/')
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';

describe('persistent loadout PropertyElement evidence closure', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readPersistentLoadoutPropertyRuntimeEvidenceSource({
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

  it('binds frame-zero self installation, persistent lifetime and explicit unload', () => {
    expect(source.value).toMatchObject({
      contractName: 'AzPrPersistentLoadoutPropertyRuntimeEvidence',
      semantics: {
        installSource:
          'skill-control-timeline-inject-to-own-element-behavior-at-frame-zero',
        installTarget: 'direct-inject-self-actor',
        timelineEndRemovalGate: 'removeElementOnEnd',
        persistentLifetime:
          'time-minus-one-and-no-timeline-end-removal-until-explicit-unload-skill',
        duplicateInitialization: 'cover-by-source-identity',
        unloadEventId: 36,
        inheritance: 'none',
      },
      conclusion: { status: 'applied' },
    });
    expect(() =>
      assertPersistentLoadoutPropertyRuntimeEvidenceReference(
        report.sourceClosure.persistentLoadoutPropertyRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('rejects missing methods, fields, ranges, enum semantics and binary identity', () => {
    const mutations = [
      value => value.dumpBindings.methods.splice(0, 1),
      value => value.dumpBindings.fields.splice(0, 1),
      value => value.dumpBindings.enums.splice(0, 1),
      value => {
        value.binaryRanges[0].sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedBinary.sha256 = '0'.repeat(64);
      },
      value => {
        value.semantics.installTarget = 'all-heroes';
      },
      value => {
        value.semantics.unloadEventId = 35;
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validatePersistentLoadoutPropertyRuntimeEvidence(
          value,
          source.observations
        )
      ).toThrow(
        /optimization-qualification-persistent-loadout-property-evidence-/u
      );
    }
  });

  it('makes assert-clean reject a stale acceptance-report reference', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'azpr-persistent-loadout-report-')
    );
    const tamperedReport = structuredClone(report);
    tamperedReport.sourceClosure.persistentLoadoutPropertyRuntimeEvidence.sha256 =
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
        /persistent-loadout-property-evidence-report-reference-drift/u
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
