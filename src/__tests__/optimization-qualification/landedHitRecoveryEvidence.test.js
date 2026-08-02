import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertLandedHitRecoveryRuntimeEvidenceReference,
  LANDED_HIT_RECOVERY_EVIDENCE_RELATIVE_PATH,
  readLandedHitRecoveryRuntimeEvidenceSource,
  validateLandedHitRecoveryRuntimeEvidence,
} from '../../../scripts/optimization-qualification/landed-hit-recovery-evidence.mjs';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  ...LANDED_HIT_RECOVERY_EVIDENCE_RELATIVE_PATH.split('/')
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';

describe('landed-hit recovery evidence closure', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readLandedHitRecoveryRuntimeEvidenceSource({
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

  it('binds the acceptance report to a dedicated recomputable evidence artifact', async () => {
    expect(report.sourceClosure.landedHitRecoveryRuntimeEvidence).toEqual(
      expect.objectContaining({
        path: LANDED_HIT_RECOVERY_EVIDENCE_RELATIVE_PATH,
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
    expect(() =>
      assertLandedHitRecoveryRuntimeEvidenceReference(
        report.sourceClosure.landedHitRecoveryRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('rejects drift in every bound callsite group', () => {
    const mutations = [
      value => {
        value.callGraph.parseCopies[0].callSiteRva = '0x0';
      },
      value => {
        delete value.callGraph.localBranch.sourceMainControlCallRva;
      },
      value => {
        value.callGraph.remoteBranch.recoveryCallRva = '0x0';
      },
      value => {
        value.callGraph.spSystem.actorRecoverDispatchCallRva = '0x0';
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateLandedHitRecoveryRuntimeEvidence(value, source.observations)
      ).toThrow(/evidence-callsite-drift/u);
    }
  });

  it('rejects range, binary, dump, method and gate semantic drift', () => {
    const mutations = [
      value => {
        value.binaryRanges[0].sha256 = '0'.repeat(64);
      },
      value => {
        delete value.binaryRanges[0].sha256;
      },
      value => {
        value.reviewedBinary.sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedBinary.path = 'C:/wrong/GameAssembly.dll';
      },
      value => {
        value.reviewedIl2CppDump.sha256 = '0'.repeat(64);
      },
      value => {
        value.dumpBindings.methods.splice(1, 1);
      },
      value => {
        value.runtimeSemantics.localSourceGateRequired = false;
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateLandedHitRecoveryRuntimeEvidence(value, source.observations)
      ).toThrow(/optimization-qualification-landed-hit-recovery-evidence-/u);
    }
  });

  it('rejects a stale or tampered acceptance report reference', () => {
    for (const mutate of [
      reference => {
        reference.sha256 = '0'.repeat(64);
      },
      reference => {
        delete reference.sha256;
      },
    ]) {
      const reference = structuredClone(
        report.sourceClosure.landedHitRecoveryRuntimeEvidence
      );
      mutate(reference);
      expect(() =>
        assertLandedHitRecoveryRuntimeEvidenceReference(reference, source)
      ).toThrow(/evidence-report-reference-drift/u);
    }
  });

  it('makes the assert-clean generation path reject a tampered report reference', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'azpr-landed-recovery-report-')
    );
    const tamperedReport = structuredClone(report);
    tamperedReport.sourceClosure.landedHitRecoveryRuntimeEvidence.sha256 =
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
      ).rejects.toThrow(/evidence-report-reference-drift/u);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
