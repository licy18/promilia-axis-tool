import fs from 'node:fs';
import path from 'node:path';

export function selectCharacterCombatPublicationRecords({
  records,
  ownerId = null,
}) {
  if (ownerId == null) return [...records];
  const normalizedOwnerId = Number(ownerId);
  if (!Number.isInteger(normalizedOwnerId) || normalizedOwnerId <= 0) {
    throw new Error(`invalid character combat publication owner: ${ownerId}`);
  }
  const ownerPaths = new Set([
    `src/data/generated/character-combat-owner-contracts/${normalizedOwnerId}.json`,
    `src/data/generated/character-combat-profiles/${normalizedOwnerId}.json`,
  ]);
  return records.filter(
    record =>
      ownerPaths.has(record.relativePath) ||
      record.relativePath.startsWith(`reports/m10/${normalizedOwnerId}/`)
  );
}

export function createCharacterCombatPublicationPlan({
  records,
  outputRoot,
}) {
  const normalizedRoot = path.resolve(outputRoot);
  return records.map(record => [
    path.resolve(normalizedRoot, record.relativePath),
    record.content,
  ]);
}

export function detectCharacterCombatPublicationDrift(outputs) {
  return outputs.filter(
    ([filePath, content]) =>
      !fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== content
  );
}

export function writeCharacterCombatOutputsAtomically(
  outputs,
  { beforeCommit } = {}
) {
  const staged = [];
  const committed = [];
  try {
    for (const [filePath, content] of outputs) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporaryPath = createTemporaryPath(filePath, staged.length);
      fs.writeFileSync(temporaryPath, content, 'utf8');
      staged.push({
        temporaryPath,
        filePath,
        backupPath: null,
        existed: fs.existsSync(filePath),
      });
    }
    beforeCommit?.(staged);
    for (const entry of staged) {
      if (entry.existed) {
        entry.backupPath = createBackupPath(entry.filePath, committed.length);
        fs.copyFileSync(entry.filePath, entry.backupPath);
      }
      fs.renameSync(entry.temporaryPath, entry.filePath);
      committed.push(entry);
    }
    for (const entry of committed) {
      if (entry.backupPath && fs.existsSync(entry.backupPath)) {
        fs.rmSync(entry.backupPath);
      }
    }
  } catch (error) {
    for (const entry of [...committed].reverse()) {
      if (entry.backupPath && fs.existsSync(entry.backupPath)) {
        fs.copyFileSync(entry.backupPath, entry.filePath);
      } else if (!entry.existed && fs.existsSync(entry.filePath)) {
        fs.rmSync(entry.filePath);
      }
    }
    for (const entry of staged) {
      if (fs.existsSync(entry.temporaryPath)) fs.rmSync(entry.temporaryPath);
      if (entry.backupPath && fs.existsSync(entry.backupPath)) {
        fs.rmSync(entry.backupPath);
      }
    }
    throw error;
  }
}

function createTemporaryPath(filePath, index) {
  return `${filePath}.tmp-${process.pid}-${index}`;
}

function createBackupPath(filePath, index) {
  return `${filePath}.bak-${process.pid}-${index}`;
}
