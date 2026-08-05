import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertSoulEffectNonDamageRuntimeEvidenceReference,
  readSoulEffectNonDamageRuntimeEvidenceSource,
  validateSoulEffectNonDamageRuntimeEvidence,
} from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  'scripts',
  'optimization-qualification',
  'evidence',
  'soulessence-non-damage-runtime-evidence.json'
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';

describe('non-damage Source/Target and Block native evidence', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readSoulEffectNonDamageRuntimeEvidenceSource({
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

  it('binds Self, Target and Source to native trigger-data fields', () => {
    expect(source.value).toMatchObject({
      schemaVersion: 2,
      triggerTargetRouting: {
        consumer: 'Lens.Gameplay.Modules.BigWorld.TriggerElement.GetTriggerTarget',
        rva: '0x13BBF50',
        bindings: [
          expect.objectContaining({ value: 0, enumName: 'Self', fieldOffset: '0x28' }),
          expect.objectContaining({ value: 1, enumName: 'Target', fieldOffset: '0x20' }),
          expect.objectContaining({ value: 2, enumName: 'Source', fieldOffset: '0x18' }),
        ],
      },
      sourceVisibility: {
        triggerTargetType: 0,
        runtimeSourceKind: 'native-event-subject-matches-equipped-actor',
      },
      sourceObserver: {
        triggerTargetType: 2,
        runtimeSourceKind: 'event-source-actor-events',
      },
    });
  });

  it('proves empty OR and native Block without converting Block into refresh', () => {
    expect(source.value).toMatchObject({
      emptyConditionSemantics: {
        emptyOrResult: true,
        supportedEventIds: expect.arrayContaining([44]),
      },
      combineSemantics: {
        block: {
          combineType: 5,
          runtimeMode: 'block-while-active-same-config',
          activeDuplicateRefreshes: false,
          activeDuplicateStacks: false,
          reapplyAfterRemovalOrExpiry: true,
        },
      },
      emptyConditionEvents: expect.arrayContaining([44]),
    });
    expect(() =>
      assertSoulEffectNonDamageRuntimeEvidenceReference(
        report.sourceClosure.nonDamageRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('rejects drift in routing, empty conditions, Block, ranges and source identities', () => {
    const mutations = [
      value => {
        value.consumer.triggerTargetRouting.sha256 = '0'.repeat(64);
      },
      value => {
        value.triggerTargetRouting.bindings[2].fieldOffset = '0x20';
      },
      value => {
        value.emptyConditionSemantics.emptyOrResult = false;
      },
      value => {
        value.combineSemantics.block.activeDuplicateRefreshes = true;
      },
      value => {
        value.onGotShield.emptyShieldListGate.fieldOffset = '0x90';
      },
      value => {
        value.onGotShield.refreshReplacementSemantics = 'evidence-insufficient';
      },
      value => {
        value.reviewedIl2CppDump.sha256 = '0'.repeat(64);
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateSoulEffectNonDamageRuntimeEvidence(value, source.observations)
      ).toThrow(/optimization-qualification-non-damage-evidence-/u);
    }
  });
});
