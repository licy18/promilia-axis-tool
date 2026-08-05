import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTIVATION_CONDITION_EVIDENCE_RELATIVE_PATH,
  assertActivationConditionRuntimeEvidenceReference,
  readActivationConditionRuntimeEvidenceSource,
} from '../../../scripts/optimization-qualification/soulessence-activation-condition-evidence.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

describe('soulessence activation element-formula condition evidence', () => {
  it('reads the reviewed evidence and validates binary, dump, and formula identity', async () => {
    const source = await readActivationConditionRuntimeEvidenceSource({
      sourcePath: path.join(
        projectRoot,
        ...ACTIVATION_CONDITION_EVIDENCE_RELATIVE_PATH.split('/')
      ),
      gameAssemblyPath:
        'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
      il2CppDumpPath:
        'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs',
      elementFormulaPath:
        'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/element_formula.json',
      projectRoot,
    });
    expect(source.value.contractName).toBe(
      'AzPrSoulEssenceActivationElementFormulaConditionRuntimeEvidence'
    );
    expect(source.value.conditionContract).toMatchObject({
      kind: 'element-formula-condition',
      truthSemantics: 'formula-result-nonzero',
    });
    expect(source.value.activationExample).toMatchObject({
      soulEssenceId: 10018,
      formula: 'IF(self.ELEMENT_LAYERS[J]>K,G,0)',
      variableBindings: { J: 250, K: 1, G: 10000 },
    });
    expect(source.value.conclusion.status).toBe('applied');
  });

  it('accepts an exact report reference and rejects drift', async () => {
    const source = await readActivationConditionRuntimeEvidenceSource({
      sourcePath: path.join(
        projectRoot,
        ...ACTIVATION_CONDITION_EVIDENCE_RELATIVE_PATH.split('/')
      ),
      gameAssemblyPath:
        'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
      il2CppDumpPath:
        'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs',
      elementFormulaPath:
        'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/element_formula.json',
      projectRoot,
    });
    const reference = {
      path: source.path,
      bytes: source.bytes,
      sha256: source.sha256,
      binaryPath: source.value.reviewedBinary.path,
      binaryBytes: source.value.reviewedBinary.bytes,
      binarySha256: source.value.reviewedBinary.sha256,
      il2CppDumpPath: source.value.reviewedIl2CppDump.path,
      il2CppDumpBytes: source.value.reviewedIl2CppDump.bytes,
      il2CppDumpSha256: source.value.reviewedIl2CppDump.sha256,
      elementFormulaPath: source.value.reviewedElementFormula.path,
      elementFormulaBytes: source.value.reviewedElementFormula.bytes,
      elementFormulaSha256: source.value.reviewedElementFormula.sha256,
      conditionKind: source.value.conditionContract.kind,
      conclusionStatus: source.value.conclusion.status,
    };
    expect(
      assertActivationConditionRuntimeEvidenceReference(reference, source)
    ).toBe(true);
    expect(() =>
      assertActivationConditionRuntimeEvidenceReference(
        { ...reference, sha256: '0'.repeat(64) },
        source
      )
    ).toThrow(/report-reference-drift/);
  });
});
