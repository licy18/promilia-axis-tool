import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND } from '../../src/character-acceptance/characterAcceptanceProtocol.js';

export async function verifyProductVisualEvidenceFiles(
  recipe,
  { projectRoot, readFile = fs.readFile } = {}
) {
  if (!projectRoot) {
    throw new Error('Character acceptance project root missing');
  }

  // 显式 pending 的角色（从未签收 / 不在搜索域，如 101003）的视觉证据
  // 是记录性质的，不得以截图 SHA 硬校验阻断全量验收/资格生成。只有
  // 显式声明 pending 才跳过；status 缺失或为 accepted 等其他值一律
  // fail-closed 强制校验（保持旧契约与既有测试语义）。
  const acceptanceStatus = recipe.productVisualAcceptance?.status;
  if (acceptanceStatus === 'pending') {
    return {
      skipped: true,
      reason: 'product-visual-acceptance-not-requested',
      ownerId: recipe.ownerId,
    };
  }

  for (const evidence of recipe.productVisualAcceptance?.automatedEvidence ??
    []) {
    const identity = String(evidence?.scenarioIdentity ?? 'unknown');
    const prefix =
      'Character acceptance visual evidence invalid for ' +
      recipe.ownerId +
      ':' +
      identity +
      ': ';

    if (
      evidence?.evidenceKind != null &&
      evidence.evidenceKind !== PRODUCT_VISUAL_SCREENSHOT_EVIDENCE_KIND
    ) {
      throw new Error(prefix + 'evidence-kind-must-be-screenshot');
    }
    if (evidence?.status !== 'automated-workbench-import-passed') {
      throw new Error(prefix + 'status-must-be-workbench-import-passed');
    }
    if (!evidence?.screenshotPath) {
      throw new Error(prefix + 'screenshot-path-missing');
    }
    if (!/^[0-9a-f]{64}$/.test(String(evidence?.screenshotSha256 ?? ''))) {
      throw new Error(prefix + 'screenshot-sha256-invalid');
    }

    const screenshotPath = resolveEvidencePath({
      projectRoot,
      relativePath: evidence.screenshotPath,
      prefix,
    });
    const screenshotBytes = await readEvidenceFile({
      readFile,
      filePath: screenshotPath,
      prefix,
      missingReason: 'screenshot-file-missing',
    });
    const actualScreenshotHash = sha256(screenshotBytes);
    if (actualScreenshotHash !== evidence.screenshotSha256) {
      throw new Error(prefix + 'screenshot-sha256-mismatch');
    }

    const fixtureBindingProvided =
      evidence.fixturePath != null || evidence.fixtureSha256 != null;
    if (!fixtureBindingProvided) continue;
    if (!evidence.fixturePath) {
      throw new Error(prefix + 'fixture-path-missing');
    }
    if (!/^[0-9a-f]{64}$/.test(String(evidence.fixtureSha256 ?? ''))) {
      throw new Error(prefix + 'fixture-sha256-invalid');
    }
    const fixturePath = resolveEvidencePath({
      projectRoot,
      relativePath: evidence.fixturePath,
      prefix,
    });
    const fixtureBytes = await readEvidenceFile({
      readFile,
      filePath: fixturePath,
      prefix,
      missingReason: 'fixture-file-missing',
    });
    if (sha256(fixtureBytes) !== evidence.fixtureSha256) {
      throw new Error(prefix + 'fixture-sha256-mismatch');
    }
  }
}

function resolveEvidencePath({ projectRoot, relativePath, prefix }) {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(prefix + 'path-outside-project-root');
  }
  return resolved;
}

async function readEvidenceFile({ readFile, filePath, prefix, missingReason }) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(prefix + missingReason);
    }
    throw error;
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
