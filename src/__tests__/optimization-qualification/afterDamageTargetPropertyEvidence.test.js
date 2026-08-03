import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  AFTER_DAMAGE_TARGET_PROPERTY_EVIDENCE_RELATIVE_PATH,
  assertAfterDamageTargetPropertyRuntimeEvidenceReference,
  readAfterDamageTargetPropertyRuntimeEvidenceSource,
  validateAfterDamageTargetPropertyRuntimeEvidence,
} from '../../../scripts/optimization-qualification/after-damage-target-property-evidence.mjs';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  ...AFTER_DAMAGE_TARGET_PROPERTY_EVIDENCE_RELATIVE_PATH.split('/')
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';
const localizationPath =
  'C:/PC2/Codex/AzPr/Assets/ResourcesLang/chs/Table/lang_skill.json';
const battleElementAssetsPath =
  'C:/PC2/Codex/AzPr/work/combat-formulas/battle-element-assets.jsonl';
const skillControlPath =
  'C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_19998008.asset/MonoBehaviour/skill_control_19998008__3385592889625444843.json';

describe('AfterDamage target weakness-absorption native evidence', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readAfterDamageTargetPropertyRuntimeEvidenceSource({
        sourcePath: evidencePath,
        gameAssemblyPath,
        il2CppDumpPath,
        localizationPath,
        battleElementAssetsPath,
        skillControlPath,
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

  it('locks the executable AfterDamage target wrapper and its two property leaves', () => {
    expect(source.value).toMatchObject({
      contractName: 'AzPrAfterDamageTargetPropertyRuntimeEvidence',
      reviewedDefinition: {
        setId: 6,
        pieces: 4,
        skillId: 19998008,
        triggerType: 1,
        eventId: 2,
        triggerTargetType: 0,
        conditionLogicValue: 1,
        conditions: [
          { conditionType: 11, conditionValue: 1, conditionExtra: 0 },
          { conditionType: 11, conditionValue: 2, conditionExtra: 0 },
        ],
        triggerCounter: 999999,
        effectTargetType: 1,
        wrapperElementId: 199999071,
        wrapperDurationMs: 24000,
        wrapperCombineType: 3,
        properties: [
          expect.objectContaining({
            elementId: 199999064,
            attributeId: 202,
            sourceRawA: 2000,
          }),
          expect.objectContaining({
            elementId: 199999070,
            attributeId: 203,
            sourceRawA: 2000,
          }),
        ],
        removedElementIds: [199999065, 199999063],
      },
      sourceConflict: {
        resolution:
          'executable-wrapper-and-property-leaves-control-value-and-duration',
        resolvedValueBasisPoints: 2000,
        resolvedDurationMs: 24000,
      },
      semantics: {
        triggerPhase: 'after-damage-dispatch-after-current-packet-settlement',
        effectTarget: 'native-damage-event-target-entity',
        currentPacketVisibility: 'not-visible-to-triggering-packet',
        triggerCounterMode: 'event-trigger-type-uses-configured-counter',
        triggerCounterCommit:
          'increment-on-accepted-trigger-and-free-source-at-positive-limit',
        triggerCounterLifetime: 'finite-positive-999999-not-unlimited-sentinel',
        unload:
          'remove-source-trigger-roots-only-existing-target-wrapper-expires-at-original-end',
      },
      conclusion: { status: 'applied' },
    });
    expect(source.value.binaryRanges).toHaveLength(9);
    expect(() =>
      assertAfterDamageTargetPropertyRuntimeEvidenceReference(
        report.sourceClosure.afterDamageTargetPropertyRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('rejects binary, source asset, graph, enum, conflict, and semantic drift', () => {
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
        value.reviewedIl2CppDump.sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedLocalization.sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedBattleElementAssets.sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedSkillControl.sha256 = '0'.repeat(64);
      },
      value => {
        value.reviewedDefinition.conditions.reverse();
      },
      value => {
        value.reviewedDefinition.triggerType = 0;
      },
      value => {
        value.reviewedDefinition.properties[1].attributeId = 202;
      },
      value => {
        value.reviewedDefinition.removedElementIds.push(199999071);
      },
      value => {
        value.sourceConflict.resolvedDurationMs = 8000;
      },
      value => {
        value.semantics.currentPacketVisibility = 'visible';
      },
      value => {
        value.semantics.triggerCounterLifetime = 'unlimited';
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateAfterDamageTargetPropertyRuntimeEvidence(
          value,
          source.observations
        )
      ).toThrow(
        /optimization-qualification-after-damage-target-property-evidence-/u
      );
    }
  });

  it('rejects a stale acceptance-report evidence reference before generation', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'azpr-after-damage-target-report-')
    );
    const tamperedReport = structuredClone(report);
    tamperedReport.sourceClosure.afterDamageTargetPropertyRuntimeEvidence.sha256 =
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
        /after-damage-target-property-evidence-report-reference-drift/u
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
