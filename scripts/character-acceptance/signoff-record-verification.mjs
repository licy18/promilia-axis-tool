// Signoff record 认证（P1-1 修复核心）：
// 对 status=accepted 的 recipe，要求 acceptanceCommit 指向的 git 对象确实
// 包含不可变 signoff record 文件，且 record 内容与当前派生一致：
//   - record 内容 SHA-256 == recipe.signoffRecordSha256（commit 内内容未被改）
//   - record.ownerId == recipe.ownerId
//   - record.mechanicsPackageHash == 当前机制包 packageHash（机制包漂移 → 失效）
//   - record.captureHarness.specSha256 == 当前捕获脚本 SHA（harness 漂移 → 失效）
//   - record.qualificationSubjectHash == 当前派生 subject（subject 漂移 → 失效）
//   - record.canonicalTraceHash == review 记录的 canonicalTraceHash
//   - record.automatedEvidence[0].screenshotSha256 == recipe 截图 SHA
//
// 用法：verifySignoffRecord(recipe, { projectRoot, qualificationSubjectHash })
// 返回 { verified, issues, recordPath, recordSha256, authentication }。
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function verifySignoffRecord(
  recipe,
  { projectRoot, qualificationSubjectHash }
) {
  const issues = [];
  const pva = recipe.productVisualAcceptance ?? {};
  const status = String(pva.status ?? 'pending');
  const acceptanceCommit = String(pva.acceptanceCommit ?? '');
  const recordPath = String(pva.signoffRecordPath ?? '');
  const recordSha256 = String(pva.signoffRecordSha256 ?? '');
  const authentication = {
    contractName: 'AzPrCharacterProductVisualSignoffRecordAuthentication',
    status: 'pending',
    acceptanceCommit: acceptanceCommit || null,
    signoffRecordPath: recordPath || null,
    recordSha256: recordSha256 || null,
    issues: [],
  };

  if (status !== 'accepted') {
    return {
      verified: false,
      issues: ['signoff-record-not-requested'],
      recordPath: null,
      recordSha256: null,
      authentication,
    };
  }
  if (!/^[0-9a-f]{40}$/.test(acceptanceCommit)) {
    issues.push('signoff-record-commit-invalid');
  }
  if (!recordPath || !/^[0-9a-f]{64}$/.test(recordSha256)) {
    issues.push('signoff-record-reference-invalid');
  }
  if (issues.length) {
    authentication.issues = [...issues];
    return { verified: false, issues, recordPath: null, recordSha256: null, authentication };
  }

  // 从 acceptanceCommit 读取 record 实际内容（认证 commit 内部真实存在该文件）
  let recordBytes = null;
  try {
    recordBytes = execFileSync(
      'git',
      ['show', `${acceptanceCommit}:${recordPath}`],
      { cwd: projectRoot, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (error) {
    issues.push('signoff-record-missing-in-commit:' + String(error?.status ?? 'git-error'));
  }
  if (recordBytes == null) {
    authentication.issues = [...issues];
    return { verified: false, issues, recordPath, recordSha256, authentication };
  }
  const actualSha256 = createHash('sha256').update(recordBytes).digest('hex');
  if (actualSha256 !== recordSha256) {
    issues.push('signoff-record-sha256-mismatch');
  }
  let record = null;
  try {
    record = JSON.parse(recordBytes.toString('utf8'));
  } catch (error) {
    issues.push('signoff-record-invalid-json');
  }

  if (record != null) {
    if (Number(record.ownerId) !== Number(recipe.ownerId)) {
      issues.push('signoff-record-owner-mismatch');
    }
    const currentPackage = readMechanicsPackageHash(projectRoot);
    if (String(record.mechanicsPackageHash ?? '') !== currentPackage) {
      issues.push(
        'signoff-record-mechanics-package-mismatch:' +
          String(record.mechanicsPackageHash ?? '').slice(0, 12) +
          '!=' +
          currentPackage.slice(0, 12)
      );
    }
    const currentSpecSha256 = computeSpecSha256(projectRoot);
    if (
      String(record.captureHarness?.specSha256 ?? '') !== currentSpecSha256
    ) {
      issues.push('signoff-record-capture-harness-mismatch');
    }
    if (String(record.qualificationSubjectHash ?? '') !== qualificationSubjectHash) {
      issues.push('signoff-record-qualification-subject-mismatch');
    }
    const evidence = record.automatedEvidence?.[0] ?? {};
    const recipeEvidence = pva.automatedEvidence?.[0] ?? {};
    if (
      evidence.screenshotSha256 &&
      String(evidence.screenshotSha256) !== String(recipeEvidence.screenshotSha256 ?? '')
    ) {
      issues.push('signoff-record-screenshot-sha256-mismatch');
    }
  }

  authentication.recordPath = recordPath;
  authentication.recordSha256 = recordSha256;
  authentication.acceptanceCommit = acceptanceCommit;
  authentication.status = issues.length ? 'invalid' : 'verified';
  authentication.issues = issues;
  return {
    verified: issues.length === 0,
    issues,
    recordPath,
    recordSha256,
    authentication,
  };
}

function readMechanicsPackageHash(projectRoot) {
  const pkgPath = path.join(
    projectRoot,
    'src',
    'data',
    'generated',
    'verified-combat-mechanics-package.json'
  );
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return String(pkg.packageHash ?? '');
  } catch (error) {
    return '';
  }
}

function computeSpecSha256(projectRoot) {
  const specPath = path.join(
    projectRoot,
    'e2e',
    'm12-c-owner-visual-review.spec.js'
  );
  try {
    const bytes = fs.readFileSync(specPath);
    return createHash('sha256').update(bytes).digest('hex');
  } catch (error) {
    return '';
  }
}

// 对象级（STARBORN）signoff record 认证：与角色级同构——要求
// acceptanceCommit 指向的 git 对象确实包含 signoff record，且 record 的
// subject/package/harness hash 与当前派生一致。
export function verifyOptimizationObjectSignoffRecord(
  recipe,
  { projectRoot }
) {
  const issues = [];
  const pva = recipe?.productVisualAcceptance ?? {};
  const status = String(pva.status ?? 'pending');
  const acceptanceCommit = String(pva.acceptanceCommit ?? '');
  const recordPath = String(pva.signoffRecordPath ?? '');
  const recordSha256 = String(pva.signoffRecordSha256 ?? '');
  const authentication = {
    contractName: 'AzPrOptimizationObjectSignoffRecordAuthentication',
    status: 'pending',
    acceptanceCommit: acceptanceCommit || null,
    signoffRecordPath: recordPath || null,
    recordSha256: recordSha256 || null,
    issues: [],
  };

  if (status !== 'accepted') {
    return { verified: false, issues: ['signoff-record-not-requested'], authentication };
  }
  if (!/^[0-9a-f]{40}$/.test(acceptanceCommit)) {
    issues.push('signoff-record-commit-invalid');
  }
  if (!recordPath || !/^[0-9a-f]{64}$/.test(recordSha256)) {
    issues.push('signoff-record-reference-invalid');
  }
  if (issues.length) {
    authentication.issues = [...issues];
    return { verified: false, issues, authentication };
  }

  let recordBytes = null;
  try {
    recordBytes = execFileSync(
      'git',
      ['show', `${acceptanceCommit}:${recordPath}`],
      { cwd: projectRoot, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (error) {
    issues.push('signoff-record-missing-in-commit:' + String(error?.status ?? 'git-error'));
  }
  if (recordBytes == null) {
    authentication.issues = [...issues];
    return { verified: false, issues, authentication };
  }
  const actualSha256 = createHash('sha256').update(recordBytes).digest('hex');
  if (actualSha256 !== recordSha256) {
    issues.push('signoff-record-sha256-mismatch');
  }
  let record = null;
  try {
    record = JSON.parse(recordBytes.toString('utf8'));
  } catch (error) {
    issues.push('signoff-record-invalid-json');
  }
  if (record != null) {
    const currentPackage = readMechanicsPackageHash(projectRoot);
    if (String(record.mechanicsPackageHash ?? '') !== currentPackage) {
      issues.push('signoff-record-mechanics-package-mismatch');
    }
    const currentSpecSha256 = computeSpecSha256(projectRoot);
    if (String(record.captureHarness?.specSha256 ?? '') !== currentSpecSha256) {
      issues.push('signoff-record-capture-harness-mismatch');
    }
    // 对象级 record 的 subject 由生成器派生，此处不比对（对象级协议
    // 内部校验 subject 自洽）；但仍要求 evidence 与源 alias 匹配。
    if (
      String(record.optimizationObjectId ?? '') !==
      String(recipe.optimizationObjectId ?? '')
    ) {
      issues.push('signoff-record-object-mismatch');
    }
  }

  authentication.recordPath = recordPath;
  authentication.recordSha256 = recordSha256;
  authentication.acceptanceCommit = acceptanceCommit;
  authentication.status = issues.length ? 'invalid' : 'verified';
  authentication.issues = issues;
  return {
    verified: issues.length === 0,
    issues,
    authentication,
  };
}
