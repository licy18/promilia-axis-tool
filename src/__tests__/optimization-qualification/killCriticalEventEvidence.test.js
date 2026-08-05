import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertSoulEffectKillCriticalEventRuntimeEvidenceReference,
  readSoulEffectKillCriticalEventRuntimeEvidenceSource,
  validateSoulEffectKillCriticalEventRuntimeEvidence,
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
  'soulessence-kill-critical-event-runtime-evidence.json'
);
const gameAssemblyPath =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const il2CppDumpPath =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';

describe('kill and before-critical-damage trigger dispatch native evidence', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readSoulEffectKillCriticalEventRuntimeEvidenceSource({
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

  it('binds KillEvent and BeforeCriticalDamage to native dispatch consumers', () => {
    expect(source.value).toMatchObject({
      schemaVersion: 1,
      contractName: 'AzPrSoulEssenceKillCriticalEventRuntimeEvidence',
      semantics: {
        beforeCriticalDamage: {
          eventId: 25,
          frameAnchor: 'hit-before-critical-damage',
          consumer: 'FormulaUtility.GetOutputDamage',
          rva: '0x187F360',
          dispatchCallRva: '0x1880199',
        },
        killEvent: {
          eventId: 32,
          frameAnchor: 'kill-event',
          consumer: 'DamageService.TriggerKillEvent',
          rva: '0x306E6E0',
          dispatchCallRva: '0x306EC49',
        },
        emptyConditionEvents: expect.arrayContaining([25, 32]),
      },
      conclusion: { status: 'applied' },
    });
    expect(source.value.binaryRanges).toHaveLength(2);
    expect(() =>
      assertSoulEffectKillCriticalEventRuntimeEvidenceReference(
        report.sourceClosure.killCriticalEventRuntimeEvidence,
        source
      )
    ).not.toThrow();
  });

  it('rejects binary, dump, method, semantics, and range drift', () => {
    const mutations = [
      value => {
        value.reviewedBinary.sha256 = '0'.repeat(64);
      },
      value => {
        value.binaryRanges[0].sha256 = '0'.repeat(64);
      },
      value => {
        value.dumpBindings.methods[0].rva = '0x1880000';
      },
      value => {
        value.semantics.killEvent.frameAnchor = 'kill-after-settlement';
      },
      value => {
        value.semantics.emptyConditionEvents = [25];
      },
      value => {
        value.reviewedIl2CppDump.sha256 = '0'.repeat(64);
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateSoulEffectKillCriticalEventRuntimeEvidence(
          value,
          source.observations
        )
      ).toThrow(/optimization-qualification-kill-critical-event-evidence-/u);
    }
  });
});
