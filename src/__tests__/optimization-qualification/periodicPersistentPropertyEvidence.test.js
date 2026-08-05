import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertPeriodicPersistentPropertyRuntimeEvidenceReference,
  PERIODIC_PERSISTENT_PROPERTY_EVIDENCE_RELATIVE_PATH,
  readPeriodicPersistentPropertyRuntimeEvidenceSource,
  validatePeriodicPersistentPropertyRuntimeEvidence,
} from '../../../scripts/optimization-qualification/periodic-persistent-property-evidence.mjs';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  ...PERIODIC_PERSISTENT_PROPERTY_EVIDENCE_RELATIVE_PATH.split('/')
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';
const battleElementAssetsPath =
  'C:/PC2/Codex/AzPr/work/combat-formulas/battle-element-assets.jsonl';
const elementFormulaPath =
  'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/element_formula.json';

function createReadOptions(overrides = {}) {
  return {
    sourcePath: evidencePath,
    gameAssemblyPath,
    il2CppDumpPath,
    battleElementAssetsPath,
    elementFormulaPath,
    projectRoot,
    ...overrides,
  };
}

describe('periodic persistent PropertyElement root native evidence', () => {
  let source;
  let report;
  let appliedSourceAudit;

  beforeAll(async () => {
    [source, report, appliedSourceAudit] = await Promise.all([
      readPeriodicPersistentPropertyRuntimeEvidenceSource(createReadOptions()),
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
      fs
        .readFile(
          path.join(projectRoot, 'reports', 'applied-source-binding-audit.json'),
          'utf8'
        )
        .then(JSON.parse),
    ]);
  }, 30_000);

  it('locks periodic cadence, finite Cover leaves, native targets, and source dispositions', () => {
    expect(source.value).toMatchObject({
      contractName: 'AzPrPeriodicPersistentPropertyRuntimeEvidence',
      semantics: {
        timeLoop:
          'first-positive-update-when-timeExeFirstFrame-then-strict-elapsed-greater-than-ordinal-times-interval',
        conditionCadence:
          'period-counter-advances-before-condition-check-so-failed-condition-consumes-that-period',
        leafLifetime:
          'finite-property-leaf-duration-is-independent-from-persistent-root-lifetime',
        cover: 'same-source-property-leaf-refreshes-without-stacking',
        rightOpenLifetime: 'active-from-apply-inclusive-until-expiry-exclusive',
        multiPropertyTagMatch: 'any-overlap-event-driven',
      },
      conclusion: {
        status: 'applied',
        runtimeAppliedRootElementIds: [
          19004600, 19004901, 19006000, 19007701,
        ],
        evidenceInsufficientRootElementIds: [],
      },
    });
    expect(source.value.binaryRanges).toHaveLength(8);
    expect(source.value.rootContracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rootElementId: 19006000,
          intervalMs: 1000,
          leafElementId: 19006001,
          leafDurationMs: 1100,
          disposition: 'runtime-applied',
        }),
        expect.objectContaining({
          rootElementId: 19004901,
          intervalMs: 1000,
          leafElementId: 19004902,
          leafDurationMs: 1200,
          disposition: 'runtime-applied',
        }),
        expect.objectContaining({
          rootElementId: 19007701,
          intervalMs: 2000,
          targetType: 13,
          leafElementId: 19007702,
          leafDurationMs: 2300,
          disposition: 'runtime-applied',
        }),
        expect.objectContaining({
          rootElementId: 19004600,
          propertyTags: [302, 303],
          disposition: 'runtime-applied',
          multiPropertyTagSemantics: expect.objectContaining({
            contractName: 'AzPrBattlePropertyTagMatchingRuntimeEvidence',
            matchMode: 'any-overlap-event-driven',
          }),
        }),
      ])
    );
    expect(() =>
      assertPeriodicPersistentPropertyRuntimeEvidenceReference(
        report.sourceClosure.periodicPersistentPropertyRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('keeps periodic roots distinct from frame-zero permanent roots in the applied-source audit', () => {
    expect(
      appliedSourceAudit.loadoutPropertyTags.summary
        .periodicPersistentSourceCount
    ).toBe(4);
    const records = appliedSourceAudit.loadoutPropertyTags.records.filter(
      record =>
        record.nativeLifecycleMode ===
        'persistent-root-periodic-finite-property-leaf'
    );
    expect(
      records.map(record => ({
        ownerId: record.ownerId,
        effectElementId: record.effectElementId,
        intervalMs: record.periodicActivation.intervalMs,
        targetType: record.periodicActivation.target.targetType,
        status: record.status,
        issueCodes: record.issueCodes,
      }))
    ).toEqual([
      {
        ownerId: 10078,
        effectElementId: 19004601,
        intervalMs: 1000,
        targetType: 0,
        status: 'applied-source-periodic-persistent-property-ready',
        issueCodes: [],
      },
      {
        ownerId: 10084,
        effectElementId: 19006001,
        intervalMs: 1000,
        targetType: 0,
        status: 'applied-source-periodic-persistent-property-ready',
        issueCodes: [],
      },
      {
        ownerId: 10152,
        effectElementId: 19004902,
        intervalMs: 1000,
        targetType: 0,
        status: 'applied-source-periodic-persistent-property-ready',
        issueCodes: [],
      },
      {
        ownerId: 10197,
        effectElementId: 19007702,
        intervalMs: 2000,
        targetType: 13,
        status: 'applied-source-periodic-persistent-property-ready',
        issueCodes: [],
      },
    ]);
  });

  it('rejects binary, cadence, formula, target, leaf, unload, tag, and disposition drift', () => {
    const mutations = [
      value => {
        value.reviewedBinary.sha256 = '0'.repeat(64);
      },
      value => value.binaryRanges.pop(),
      value => {
        value.formulaContract.comparison = 'greater-than-or-equal';
      },
      value => {
        value.semantics.conditionCadence = 'retry-without-consuming-period';
      },
      value => {
        value.rootContracts[1].targetType = 13;
      },
      value => {
        value.rootContracts[2].leafDurationMs = -1;
      },
      value => {
        value.rootContracts[0].propertyTags = [];
      },
      value => {
        value.rootContracts[1].deleteChildElementOnUnload = false;
      },
      value => {
        value.conclusion.evidenceInsufficientRootElementIds = [19004600];
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validatePeriodicPersistentPropertyRuntimeEvidence(
          value,
          source.observations
        )
      ).toThrow(/periodic-persistent-property-evidence-/u);
    }
  });

  it('makes generation reject a stale acceptance-report reference', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'azpr-periodic-root-report-')
    );
    const tamperedReport = structuredClone(report);
    tamperedReport.sourceClosure.periodicPersistentPropertyRuntimeEvidence.sha256 =
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
        /periodic-persistent-property-evidence-report-reference-drift/u
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
