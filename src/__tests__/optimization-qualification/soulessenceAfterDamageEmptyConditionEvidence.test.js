import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AFTER_DAMAGE_EMPTY_CONDITION_EVIDENCE_RELATIVE_PATH,
  assertAfterDamageEmptyConditionRuntimeEvidenceReference,
  readAfterDamageEmptyConditionRuntimeEvidenceSource,
} from '../../../scripts/optimization-qualification/soulessence-after-damage-empty-condition-evidence.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

describe('soulessence after-damage empty-condition evidence', () => {
  it('reads the reviewed evidence and validates binary and dump identity', async () => {
    const source = await readAfterDamageEmptyConditionRuntimeEvidenceSource({
      sourcePath: path.join(
        projectRoot,
        ...AFTER_DAMAGE_EMPTY_CONDITION_EVIDENCE_RELATIVE_PATH.split('/')
      ),
      gameAssemblyPath: 'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
      il2CppDumpPath:
        'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs',
      projectRoot,
    });
    expect(source.value.contractName).toBe(
      'AzPrSoulEssenceAfterDamageEmptyConditionRuntimeEvidence'
    );
    expect(source.value.emptyConditionSemantics).toMatchObject({
      rva: '0x13B58F0',
      emptyOrResult: true,
      emptyAndResult: true,
      supportedEventIds: [2],
    });
    expect(source.value.conclusion.status).toBe('applied');
    expect(source.bytes).toBeGreaterThan(0);
    expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts an exact report reference', async () => {
    const source = await readAfterDamageEmptyConditionRuntimeEvidenceSource({
      sourcePath: path.join(
        projectRoot,
        ...AFTER_DAMAGE_EMPTY_CONDITION_EVIDENCE_RELATIVE_PATH.split('/')
      ),
      gameAssemblyPath: 'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
      il2CppDumpPath:
        'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs',
      projectRoot,
    });
    expect(
      assertAfterDamageEmptyConditionRuntimeEvidenceReference(
        {
          path: source.path,
          bytes: source.bytes,
          sha256: source.sha256,
          binaryPath: source.value.reviewedBinary.path,
          binaryBytes: source.value.reviewedBinary.bytes,
          binarySha256: source.value.reviewedBinary.sha256,
          il2CppDumpPath: source.value.reviewedIl2CppDump.path,
          il2CppDumpBytes: source.value.reviewedIl2CppDump.bytes,
          il2CppDumpSha256: source.value.reviewedIl2CppDump.sha256,
          conditionRange: source.value.emptyConditionSemantics.range,
          conditionRangeSha256: source.value.emptyConditionSemantics.sha256,
          conclusionStatus: source.value.conclusion.status,
        },
        source
      )
    ).toBe(true);
  });

  it('rejects a drifted report reference', async () => {
    const source = await readAfterDamageEmptyConditionRuntimeEvidenceSource({
      sourcePath: path.join(
        projectRoot,
        ...AFTER_DAMAGE_EMPTY_CONDITION_EVIDENCE_RELATIVE_PATH.split('/')
      ),
      gameAssemblyPath: 'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
      il2CppDumpPath:
        'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs',
      projectRoot,
    });
    expect(() =>
      assertAfterDamageEmptyConditionRuntimeEvidenceReference(
        {
          path: source.path,
          bytes: source.bytes,
          sha256: '0'.repeat(64),
          binaryPath: source.value.reviewedBinary.path,
          binaryBytes: source.value.reviewedBinary.bytes,
          binarySha256: source.value.reviewedBinary.sha256,
          il2CppDumpPath: source.value.reviewedIl2CppDump.path,
          il2CppDumpBytes: source.value.reviewedIl2CppDump.bytes,
          il2CppDumpSha256: source.value.reviewedIl2CppDump.sha256,
          conditionRange: source.value.emptyConditionSemantics.range,
          conditionRangeSha256: source.value.emptyConditionSemantics.sha256,
          conclusionStatus: source.value.conclusion.status,
        },
        source
      )
    ).toThrow(/report-reference-drift/);
  });
});
