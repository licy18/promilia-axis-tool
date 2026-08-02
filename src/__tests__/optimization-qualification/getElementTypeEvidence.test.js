import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertGetElementTypeRuntimeEvidenceReference,
  GET_ELEMENT_TYPE_EVIDENCE_RELATIVE_PATH,
  readGetElementTypeRuntimeEvidenceSource,
  validateGetElementTypeRuntimeEvidence,
} from '../../../scripts/optimization-qualification/get-element-type-evidence.mjs';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  ...GET_ELEMENT_TYPE_EVIDENCE_RELATIVE_PATH.split('/')
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';

describe('native GetElement element-type evidence closure', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readGetElementTypeRuntimeEvidenceSource({
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

  it('binds type 8 to the event elementParams.types consumer', () => {
    expect(source.value).toMatchObject({
      contractName: 'AzPrGetElementTypeRuntimeEvidence',
      conditionConsumer: {
        identity:
          'Lens.Gameplay.Modules.BigWorld.TriggerElement.CheckTriggerCondition',
        rva: '0x13B6A50',
        dispatch: {
          conditionTypeFieldOffset: '0x0',
          conditionTypeIndex: 8,
          conditionTypeTargetRva: '0x13B6ED6',
        },
        type8Branch: {
          eventElementParamsFieldOffset: '0x30',
          elementTypesFieldOffset: '0x30',
          conditionValueFieldOffset: '0x4',
          listContainsTargetRva: '0x60E9EB0',
        },
      },
      semantics: {
        selector: 'current-event-element-params-types-contains-condition-value',
        heldElementCollectionRead: false,
        damageTemplateSubstitution: false,
        linkedLeafSyntheticDispatch: false,
      },
      conclusion: { status: 'applied' },
    });
    expect(() =>
      assertGetElementTypeRuntimeEvidenceReference(
        report.sourceClosure.getElementTypeRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('rejects drift in the dispatch, type branch, ranges, dump and semantics', () => {
    const mutations = [
      value => {
        value.conditionConsumer.dispatch.conditionTypeIndex = 9;
      },
      value => {
        value.conditionConsumer.type8Branch.listContainsTargetRva = '0x0';
      },
      value => {
        value.binaryRanges[1].sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedBinary.sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedIl2CppDump.sha256 = '0'.repeat(64);
      },
      value => {
        value.dumpBindings.fields.splice(0, 1);
      },
      value => {
        value.semantics.linkedLeafSyntheticDispatch = true;
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateGetElementTypeRuntimeEvidence(value, source.observations)
      ).toThrow(/optimization-qualification-get-element-type-evidence-/u);
    }
  });

  it('makes assert-clean reject a stale acceptance-report reference', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'azpr-get-element-type-report-')
    );
    const tamperedReport = structuredClone(report);
    tamperedReport.sourceClosure.getElementTypeRuntimeEvidence.sha256 =
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
      ).rejects.toThrow(/get-element-type-evidence-report-reference-drift/u);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
