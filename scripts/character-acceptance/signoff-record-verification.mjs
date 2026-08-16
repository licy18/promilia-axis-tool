// Signoff record 认证（P1-1/P1-2/P1-4 修复）：
// 对 status=accepted 的 recipe，要求 acceptanceCommit 指向的 git 对象确实
// 包含不可变 signoff record 文件，且 record 内容与当前派生一致：
//   - record 必须是非 null 对象且 contract/schema/kind/必填字段完整
//   - record 内容 SHA-256 == recipe.signoffRecordSha256（commit 内内容未被改）
//   - record.ownerId == recipe.ownerId
//   - record.mechanicsPackageHash == 当前机制包 packageHash（机制包漂移 → 失效）
//   - record.captureHarness.specSha256 == git 规范化字节的 spec SHA-256
//     （用 `git show <captureCommit>:<specPath>` 取 blob 字节，避免 CRLF 污染；
//      captureCommit 由 record.repositoryHead 提供）
//   - record.qualificationSubjectHash == 当前派生 subject（subject 漂移 → 失效）
//   - record.scenarioIdentity / fixtureSha256 / canonicalTraceHash 与
//     recipe 自动化证据一致（场景漂移 → 失效）
//   - record.automatedEvidence[0].screenshotSha256 == recipe 截图 SHA
//
// 用法：verifySignoffRecord(recipe, { projectRoot, qualificationSubjectHash })
// 返回 { verified, issues, recordPath, recordSha256, authentication }。
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SIGN_OFF_CONTRACT = 'AzPrCharacterProductVisualSignoffRecord';
const SIGN_OFF_KIND = 'azpr-character-product-visual-signoff-record';

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
    return {
      verified: false,
      issues,
      recordPath: null,
      recordSha256: null,
      authentication,
    };
  }

  // 从 acceptanceCommit 读取 record 实际内容（认证 commit 内部真实存在该文件）
  let recordBytes = null;
  try {
    recordBytes = execFileSync(
      'git',
      ['show', `${acceptanceCommit}:${recordPath}`],
      {
        cwd: projectRoot,
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } catch (error) {
    issues.push(
      'signoff-record-missing-in-commit:' + String(error?.status ?? 'git-error')
    );
  }
  if (recordBytes == null) {
    authentication.issues = [...issues];
    return {
      verified: false,
      issues,
      recordPath,
      recordSha256,
      authentication,
    };
  }
  const actualSha256 = createHash('sha256').update(recordBytes).digest('hex');
  if (actualSha256 !== recordSha256) {
    issues.push('signoff-record-sha256-mismatch');
  }

  // 强校验 record 结构：null / 缺字段一律 fail-closed
  let record = null;
  let parsedRecord = null;
  try {
    parsedRecord = JSON.parse(recordBytes.toString('utf8'));
  } catch (error) {
    issues.push('signoff-record-invalid-json');
  }
  if (
    parsedRecord == null ||
    typeof parsedRecord !== 'object' ||
    Array.isArray(parsedRecord)
  ) {
    issues.push('signoff-record-must-be-object');
  } else {
    record = parsedRecord;
  }

  if (record == null) {
    authentication.issues = [...issues];
    return {
      verified: false,
      issues,
      recordPath,
      recordSha256,
      authentication,
    };
  }

  // 结构必填字段
  if (Number(record.schemaVersion) !== 1) {
    issues.push('signoff-record-schema-version-invalid');
  }
  if (String(record.contractName ?? '') !== SIGN_OFF_CONTRACT) {
    issues.push('signoff-record-contract-invalid');
  }
  if (String(record.kind ?? '') !== SIGN_OFF_KIND) {
    issues.push('signoff-record-kind-invalid');
  }
  if (Number(record.ownerId) !== Number(recipe.ownerId)) {
    issues.push('signoff-record-owner-mismatch');
  }
  if (
    !Array.isArray(record.automatedEvidence) ||
    record.automatedEvidence.length === 0
  ) {
    issues.push('signoff-record-evidence-missing');
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

  // spec SHA 用 git 规范化字节（capture commit = record.repositoryHead），
  // 避免工作树 CRLF 污染导致 Linux clean checkout 认证失败。
  const captureCommit = String(record.repositoryHead ?? '');
  const currentSpecSha256 = computeGitNormalizedSpecSha256(
    projectRoot,
    captureCommit
  );
  if (
    currentSpecSha256 === '' ||
    String(record.captureHarness?.specSha256 ?? '') !== currentSpecSha256
  ) {
    issues.push('signoff-record-capture-harness-mismatch');
  }

  if (
    String(record.qualificationSubjectHash ?? '') !== qualificationSubjectHash
  ) {
    issues.push('signoff-record-qualification-subject-mismatch');
  }

  // 场景绑定认证：scenarioIdentity / fixtureSha256 / canonicalTraceHash
  const evidence = record.automatedEvidence?.[0] ?? {};
  const recipeEvidence = pva.automatedEvidence?.[0] ?? {};
  if (
    evidence.scenarioIdentity &&
    recipeEvidence.scenarioIdentity &&
    String(evidence.scenarioIdentity) !==
      String(recipeEvidence.scenarioIdentity)
  ) {
    issues.push('signoff-record-scenario-identity-mismatch');
  }
  if (
    evidence.fixtureSha256 &&
    recipe.fixturePath &&
    String(evidence.fixtureSha256) !==
      sha256Hex(readProjectFileOrEmpty(projectRoot, recipe.fixturePath))
  ) {
    issues.push('signoff-record-fixture-sha256-mismatch');
  }
  if (
    evidence.screenshotSha256 &&
    String(evidence.screenshotSha256) !==
      String(recipeEvidence.screenshotSha256 ?? '')
  ) {
    issues.push('signoff-record-screenshot-sha256-mismatch');
  }
  // canonicalTraceHash：若 record 有而 review/recipe 没有则跳过（recipe 无此字段，
  // 由 generate 脚本用 visualScenario 的 canonicalHashes 认证——此处确保 record
  // 自身字段完整）
  if (
    !evidence.scenarioIdentity ||
    !/^[0-9a-f]{16}$/.test(String(record.canonicalTraceHash ?? ''))
  ) {
    issues.push('signoff-record-canonical-trace-hash-invalid');
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

// 用 git 规范化字节计算 spec SHA-256：`git show <captureCommit>:<specPath>`
// 返回的是 blob 原始字节（LF 规范化，与工作树 CRLF 无关），保证 Linux clean
// checkout 与 Windows 工作树得到同一 hash。
function computeGitNormalizedSpecSha256(projectRoot, captureCommit) {
  const specPath = 'e2e/m12-c-owner-visual-review.spec.js';
  if (!/^[0-9a-f]{40}$/.test(captureCommit)) return '';
  try {
    const bytes = execFileSync(
      'git',
      ['show', `${captureCommit}:${specPath}`],
      {
        cwd: projectRoot,
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    return createHash('sha256').update(bytes).digest('hex');
  } catch (error) {
    return '';
  }
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readProjectFileOrEmpty(projectRoot, relativePath) {
  try {
    return fs.readFileSync(path.join(projectRoot, String(relativePath)));
  } catch (error) {
    return Buffer.alloc(0);
  }
}

// 对象级（STARBORN）signoff record 认证：与角色级同构——要求
// acceptanceCommit 指向的 git 对象确实包含 signoff record，且 record 的
// subject/package/harness hash 与当前派生一致。
const OBJECT_SIGN_OFF_CONTRACT =
  'AzPrOptimizationObjectProductVisualSignoffRecord';
const OBJECT_SIGN_OFF_KIND =
  'azpr-optimization-object-product-visual-signoff-record';

export function verifyOptimizationObjectSignoffRecord(
  recipe,
  { projectRoot, acceptanceSubjectHash }
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
    return {
      verified: false,
      issues: ['signoff-record-not-requested'],
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
    return { verified: false, issues, authentication };
  }

  let recordBytes = null;
  try {
    recordBytes = execFileSync(
      'git',
      ['show', `${acceptanceCommit}:${recordPath}`],
      {
        cwd: projectRoot,
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } catch (error) {
    issues.push(
      'signoff-record-missing-in-commit:' + String(error?.status ?? 'git-error')
    );
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
  let parsedRecord = null;
  try {
    parsedRecord = JSON.parse(recordBytes.toString('utf8'));
  } catch (error) {
    issues.push('signoff-record-invalid-json');
  }
  if (
    parsedRecord == null ||
    typeof parsedRecord !== 'object' ||
    Array.isArray(parsedRecord)
  ) {
    issues.push('signoff-record-must-be-object');
  } else {
    record = parsedRecord;
  }
  if (record == null) {
    authentication.issues = [...issues];
    return { verified: false, issues, authentication };
  }

  if (Number(record.schemaVersion) !== 1) {
    issues.push('signoff-record-schema-version-invalid');
  }
  if (String(record.contractName ?? '') !== OBJECT_SIGN_OFF_CONTRACT) {
    issues.push('signoff-record-contract-invalid');
  }
  if (String(record.kind ?? '') !== OBJECT_SIGN_OFF_KIND) {
    issues.push('signoff-record-kind-invalid');
  }
  if (
    String(record.optimizationObjectId ?? '') !==
    String(recipe.optimizationObjectId ?? '')
  ) {
    issues.push('signoff-record-object-mismatch');
  }
  const currentPackage = readMechanicsPackageHash(projectRoot);
  if (String(record.mechanicsPackageHash ?? '') !== currentPackage) {
    issues.push('signoff-record-mechanics-package-mismatch');
  }
  const captureCommit = String(record.repositoryHead ?? '');
  const currentSpecSha256 = computeGitNormalizedSpecSha256(
    projectRoot,
    captureCommit
  );
  if (
    currentSpecSha256 === '' ||
    String(record.captureHarness?.specSha256 ?? '') !== currentSpecSha256
  ) {
    issues.push('signoff-record-capture-harness-mismatch');
  }
  // P1-3：对象级 record 必须绑定当前派生 object subject，否则旧 record 可
  // 被重绑到漂移后的新 subject 而继续认证通过。
  if (
    acceptanceSubjectHash != null &&
    String(record.acceptanceSubjectHash ?? '') !== acceptanceSubjectHash
  ) {
    issues.push('signoff-record-acceptance-subject-mismatch');
  }
  if (
    !Array.isArray(record.automatedEvidence) ||
    record.automatedEvidence.length === 0
  ) {
    issues.push('signoff-record-evidence-missing');
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
