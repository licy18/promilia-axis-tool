import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const AFTER_DAMAGE_EMPTY_CONDITION_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/soulessence-after-damage-empty-condition-runtime-evidence.json';

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
  throw new Error(
    `soulessence-after-damage-empty-condition-evidence: ${message}`
  );
}

function readPortableExecutableRvaRange(binary, range) {
  const match = String(range).match(/^0x([0-9a-f]+)-0x([0-9a-f]+)$/iu);
  if (!match) fail('range-format-invalid', range);
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
  if (endOffset <= startOffset) fail('range-order-invalid', range);
  return binary.subarray(startOffset, endOffset);
}

export async function readAfterDamageEmptyConditionRuntimeEvidenceSource({
  sourcePath,
  gameAssemblyPath,
  il2CppDumpPath,
  projectRoot,
}) {
  const [sourceBytes, binary, dumpBytes] = await Promise.all([
    fs.readFile(sourcePath),
    fs.readFile(gameAssemblyPath),
    fs.readFile(il2CppDumpPath),
  ]);
  const value = JSON.parse(sourceBytes.toString('utf8'));
  const binaryIdentity = createFileIdentity(gameAssemblyPath, binary);
  const dumpIdentity = createFileIdentity(il2CppDumpPath, dumpBytes);
  const semantics = value.emptyConditionSemantics;
  if (!semantics || semantics.status === 'blocked') {
    fail('empty-condition-semantics-not-applied');
  }
  if (!Array.isArray(semantics.supportedEventIds) ||
      !semantics.supportedEventIds.includes(2)) {
    fail('event-2-not-supported');
  }
  if (semantics.emptyOrResult !== true || semantics.emptyAndResult !== true) {
    fail('empty-list-result-drift');
  }
  if (
    value.conclusion?.status !== 'applied' ||
    !value.conclusion?.sourceIdentity
  ) {
    fail('conclusion-not-applied');
  }
  const rangeSha256 = hashBytes(
    readPortableExecutableRvaRange(binary, semantics.range)
  );
  if (rangeSha256 !== semantics.sha256) {
    fail('condition-check-range-drift');
  }
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
  return {
    value,
    path: path
      .relative(projectRoot, sourcePath)
      .replaceAll('\\', '/'),
    bytes: sourceBytes.byteLength,
    sha256: hashBytes(sourceBytes),
  };
}

export function assertAfterDamageEmptyConditionRuntimeEvidenceReference(
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
    conditionRange: source?.value?.emptyConditionSemantics?.range,
    conditionRangeSha256: source?.value?.emptyConditionSemantics?.sha256,
    conclusionStatus: source?.value?.conclusion?.status,
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (reference?.[key] !== expectedValue) {
      fail(`report-reference-drift:${key}`);
    }
  }
  return true;
}
