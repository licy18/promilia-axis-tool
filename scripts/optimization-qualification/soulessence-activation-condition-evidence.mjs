import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const ACTIVATION_CONDITION_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/soulessence-activation-element-formula-condition-runtime-evidence.json';

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function createFileIdentity(sourcePath, bytes) {
  return {
    path: sourcePath.replaceAll('\\', '/'),
    bytes: bytes.byteLength,
    sha256: hashBytes(bytes),
  };
}

function fail(message) {
  throw new Error(`soulessence-activation-condition-evidence: ${message}`);
}

function readPortableExecutableRvaRange(binary, range) {
  const match = String(range).match(/^0x([0-9a-f]+)-0x([0-9a-f]+)$/iu);
  if (!match) fail('range-format-invalid');
  const startRva = Number.parseInt(match[1], 16);
  const endRva = Number.parseInt(match[2], 16);
  const peOffset = binary.readUInt32LE(0x3c);
  const sectionCount = binary.readUInt16LE(peOffset + 6);
  const optionalHeaderSize = binary.readUInt16LE(peOffset + 20);
  const sectionTableOffset = peOffset + 24 + optionalHeaderSize;
  const resolveOffset = rva => {
    for (let index = 0; index < sectionCount; index += 1) {
      const offset = sectionTableOffset + index * 40;
      const virtualSize = binary.readUInt32LE(offset + 8);
      const virtualAddress = binary.readUInt32LE(offset + 12);
      const rawSize = binary.readUInt32LE(offset + 16);
      const rawOffset = binary.readUInt32LE(offset + 20);
      if (
        rva >= virtualAddress &&
        rva < virtualAddress + Math.max(virtualSize, rawSize)
      ) {
        return rawOffset + (rva - virtualAddress);
      }
    }
    fail(`rva-out-of-sections:${rva}`);
    return null;
  };
  const startOffset = resolveOffset(startRva);
  const endOffset = resolveOffset(endRva);
  if (endOffset <= startOffset) fail('range-order-invalid');
  return binary.subarray(startOffset, endOffset);
}

export async function readActivationConditionRuntimeEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  elementFormulaPath,
  projectRoot,
}) {
  const [sourceBytes, binary, dumpBytes, formulaBytes] = await Promise.all([
    fs.readFile(sourcePath),
    fs.readFile(gameAssemblyPath),
    fs.readFile(il2CppDumpPath),
    fs.readFile(elementFormulaPath),
  ]);
  const value = JSON.parse(sourceBytes.toString('utf8'));
  const binaryIdentity = createFileIdentity(gameAssemblyPath, binary);
  const dumpIdentity = createFileIdentity(il2CppDumpPath, dumpBytes);
  const formulaIdentity = createFileIdentity(elementFormulaPath, formulaBytes);
  if (value.conclusion?.status !== 'applied') fail('conclusion-not-applied');
  if (value.conditionContract?.kind !== 'element-formula-condition') {
    fail('condition-contract-kind-drift');
  }
  if (value.routing?.extendedThreshold !== 5000) fail('routing-threshold-drift');
  if (
    value.reviewedBinary?.bytes !== binaryIdentity.bytes ||
    value.reviewedBinary?.sha256 !== binaryIdentity.sha256
  ) {
    fail('reviewed-binary-drift');
  }
  if (
    value.reviewedIl2CppDump?.bytes !== dumpIdentity.bytes ||
    value.reviewedIl2CppDump?.sha256 !== dumpIdentity.sha256
  ) {
    fail('reviewed-il2cpp-dump-drift');
  }
  if (
    value.reviewedElementFormula?.bytes !== formulaIdentity.bytes ||
    value.reviewedElementFormula?.sha256 !== formulaIdentity.sha256
  ) {
    fail('reviewed-element-formula-drift');
  }
  const formulaRows = new Map(
    (value.elementFormulaRows ?? []).map(row => [Number(row.id), row])
  );
  const activation = value.activationExample;
  const exampleFormula = formulaRows.get(Number(activation?.conditionParam2));
  if (
    exampleFormula?.functionOutput !== activation?.formula ||
    activation?.semantics === null
  ) {
    fail('activation-example-formula-drift');
  }
  for (const range of value.binaryRanges ?? []) {
    const observed = hashBytes(
      readPortableExecutableRvaRange(binary, range.range)
    );
    if (observed !== range.sha256) {
      fail(`binary-range-drift:${range.identity}`);
    }
  }
  return {
    value,
    path: path.relative(projectRoot, sourcePath).replaceAll('\\', '/'),
    bytes: sourceBytes.byteLength,
    sha256: hashBytes(sourceBytes),
  };
}

export function assertActivationConditionRuntimeEvidenceReference(
  reference,
  source
) {
  const expected = {
    path: source?.path,
    bytes: source?.bytes,
    sha256: source?.sha256,
    binaryPath: source?.value?.reviewedBinary?.path,
    binaryBytes: source?.value?.reviewedBinary?.bytes,
    binarySha256: source?.value?.reviewedBinary?.sha256,
    il2CppDumpPath: source?.value?.reviewedIl2CppDump?.path,
    il2CppDumpBytes: source?.value?.reviewedIl2CppDump?.bytes,
    il2CppDumpSha256: source?.value?.reviewedIl2CppDump?.sha256,
    elementFormulaPath: source?.value?.reviewedElementFormula?.path,
    elementFormulaBytes: source?.value?.reviewedElementFormula?.bytes,
    elementFormulaSha256: source?.value?.reviewedElementFormula?.sha256,
    conditionKind: source?.value?.conditionContract?.kind,
    conclusionStatus: source?.value?.conclusion?.status,
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (reference?.[key] !== expectedValue) {
      fail(`report-reference-drift:${key}`);
    }
  }
  return true;
}
