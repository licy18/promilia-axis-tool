// Signoff record 认证（P1-1/P1-2/P1-4 + 二次审查修复）：
// 对 status=accepted 的 recipe，要求 acceptanceCommit 指向的 git 对象确实
// 包含不可变 signoff record 文件，且 record 内容与【独立派生值】一致——
// 所有比对值必须由调用方（生成器 preview manifest）派生传入，而非来自
// recipe 声明（recipe 是可被篡改的待验证对象）：
//   - record 必须是非 null 对象且 schema/contract/kind/必填字段完整
//   - record 内容 SHA-256 == recipe.signoffRecordSha256（commit 内内容未被改）
//   - record.ownerId == recipe.ownerId
//   - record.mechanicsPackageHash == 当前机制包 packageHash（机制包漂移 → 失效）
//   - record.captureHarness.specSha256 == git 规范化字节的 spec SHA-256
//   - record.qualificationSubjectHash == 当前派生 subject
//   - record.scenarioSetHash == 当前派生 scenarioSetHash
//   - record.scenarioIdentity == 当前派生场景（须与 evidence fixture 一致）
//   - record.canonicalTraceHash == 当前派生 canonical trace hash
//   - record.automatedEvidence 每条：fixtureSha256 与当前 fixture 一致、
//     screenshotSha256 与 recipe 证据一致、fixture.scenario.id == 场景
//   - 以上全部为强校验：缺失/不匹配一律 fail-closed
//
// 用法：verifySignoffRecord(recipe, { projectRoot, derived }) 其中
// derived = { qualificationSubjectHash, scenarioSetHash,
//             scenarioIdentities, canonicalTraceHash }。
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SIGN_OFF_CONTRACT = 'AzPrCharacterProductVisualSignoffRecord';
const SIGN_OFF_KIND = 'azpr-character-product-visual-signoff-record';

export function verifySignoffRecord(recipe, { projectRoot, derived = {} }) {
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
  // 派生值必须存在（缺失 → fail-closed，不能跳过认证）
  const derivedSubject = String(derived.qualificationSubjectHash ?? '');
  const derivedScenarioSet = String(derived.scenarioSetHash ?? '');
  const derivedScenarioIdentities = Array.isArray(derived.scenarioIdentities)
    ? derived.scenarioIdentities.map(String)
    : [];
  const derivedTrace = String(derived.canonicalTraceHash ?? '');
  if (!/^[0-9a-f]{16}$/.test(derivedSubject)) {
    issues.push('signoff-record-derived-subject-unavailable');
  }
  if (!/^[0-9a-f]{16}$/.test(derivedScenarioSet)) {
    issues.push('signoff-record-derived-scenario-set-unavailable');
  }
  if (derivedScenarioIdentities.length === 0) {
    issues.push('signoff-record-derived-scenario-unavailable');
  }
  if (!/^[0-9a-f]{16}$/.test(derivedTrace)) {
    issues.push('signoff-record-derived-trace-unavailable');
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
    record.automatedEvidence.length === 0 ||
    record.automatedEvidence.some(
      e => e == null || typeof e !== 'object' || Array.isArray(e)
    )
  ) {
    issues.push('signoff-record-evidence-invalid');
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

  // 与独立派生值强比对（非条件式）
  if (String(record.qualificationSubjectHash ?? '') !== derivedSubject) {
    issues.push('signoff-record-qualification-subject-mismatch');
  }
  if (String(record.scenarioSetHash ?? '') !== derivedScenarioSet) {
    issues.push('signoff-record-scenario-set-mismatch');
  }
  if (
    !derivedScenarioIdentities.includes(String(record.scenarioIdentity ?? ''))
  ) {
    issues.push('signoff-record-scenario-identity-mismatch');
  }
  if (String(record.canonicalTraceHash ?? '') !== derivedTrace) {
    issues.push('signoff-record-canonical-trace-mismatch');
  }

  // 逐条 evidence 强校验：fixture 场景一致 + fixture SHA + 截图 SHA
  const recipeEvidence = pva.automatedEvidence ?? [];
  for (const [index, evidence] of record.automatedEvidence.entries()) {
    const scenarioIdentity = String(evidence.scenarioIdentity ?? '');
    if (!derivedScenarioIdentities.includes(scenarioIdentity)) {
      issues.push('signoff-record-evidence-scenario-mismatch:' + index);
    }
    const fixturePath = String(evidence.fixturePath ?? '');
    const fixtureSha256 = String(evidence.fixtureSha256 ?? '');
    if (!fixturePath || !/^[0-9a-f]{64}$/.test(fixtureSha256)) {
      issues.push('signoff-record-evidence-fixture-invalid:' + index);
    } else {
      const fixtureBytes = readProjectFileOrEmpty(projectRoot, fixturePath);
      if (sha256Hex(fixtureBytes) !== fixtureSha256) {
        issues.push('signoff-record-evidence-fixture-sha-mismatch:' + index);
      } else {
        let fixture = null;
        try {
          fixture = JSON.parse(fixtureBytes.toString('utf8'));
        } catch (error) {
          fixture = null;
        }
        if (
          fixture == null ||
          String(fixture.scenario?.id ?? '') !== scenarioIdentity
        ) {
          issues.push(
            'signoff-record-evidence-fixture-scene-mismatch:' + index
          );
        }
      }
    }
    const screenshotSha256 = String(evidence.screenshotSha256 ?? '');
    const recipeMatch = recipeEvidence[index];
    if (
      !/^[0-9a-f]{64}$/.test(screenshotSha256) ||
      String(recipeMatch?.screenshotSha256 ?? '') !== screenshotSha256
    ) {
      issues.push('signoff-record-evidence-screenshot-mismatch:' + index);
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
// subject/package/harness hash 与当前派生一致。所有比对值必须由调用方
// （对象生成器 preview 派生）传入，缺失即 fail-closed。
const OBJECT_SIGN_OFF_CONTRACT =
  'AzPrOptimizationObjectProductVisualSignoffRecord';
const OBJECT_SIGN_OFF_KIND =
  'azpr-optimization-object-product-visual-signoff-record';

export function verifyOptimizationObjectSignoffRecord(
  recipe,
  { projectRoot, derived = {} }
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
  // 派生 subject 必须存在（null/缺失 → fail-closed）
  const derivedSubject = String(derived.acceptanceSubjectHash ?? '');
  if (!/^[0-9a-f]{16}$/.test(derivedSubject)) {
    issues.push('signoff-record-derived-subject-unavailable');
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
  // 对象级 record 必须绑定当前派生 object subject（漂移后旧 record 失效）
  if (String(record.acceptanceSubjectHash ?? '') !== derivedSubject) {
    issues.push('signoff-record-acceptance-subject-mismatch');
  }
  if (
    !Array.isArray(record.automatedEvidence) ||
    record.automatedEvidence.length === 0 ||
    record.automatedEvidence.some(
      e => e == null || typeof e !== 'object' || Array.isArray(e)
    )
  ) {
    issues.push('signoff-record-evidence-invalid');
  } else {
    // 逐条 evidence 强校验：fixture 场景一致 + fixture SHA
    const requiredAliases = (recipe.requiredSourceCharacterIds ?? []).map(
      Number
    );
    for (const [index, evidence] of record.automatedEvidence.entries()) {
      const sourceCharacterId = Number(evidence.sourceCharacterId);
      if (!requiredAliases.includes(sourceCharacterId)) {
        issues.push('signoff-record-evidence-alias-mismatch:' + index);
      }
      const fixturePath = String(evidence.fixturePath ?? '');
      const fixtureSha256 = String(evidence.fixtureSha256 ?? '');
      if (!fixturePath || !/^[0-9a-f]{64}$/.test(fixtureSha256)) {
        issues.push('signoff-record-evidence-fixture-invalid:' + index);
      } else {
        const fixtureBytes = readProjectFileOrEmpty(projectRoot, fixturePath);
        if (sha256Hex(fixtureBytes) !== fixtureSha256) {
          issues.push('signoff-record-evidence-fixture-sha-mismatch:' + index);
        } else {
          let fixture = null;
          try {
            fixture = JSON.parse(fixtureBytes.toString('utf8'));
          } catch (error) {
            fixture = null;
          }
          if (
            fixture == null ||
            String(fixture.scenario?.id ?? '') !==
              String(evidence.scenarioIdentity ?? '')
          ) {
            issues.push(
              'signoff-record-evidence-fixture-scene-mismatch:' + index
            );
          }
        }
      }
      if (!/^[0-9a-f]{64}$/.test(String(evidence.screenshotSha256 ?? ''))) {
        issues.push('signoff-record-evidence-screenshot-invalid:' + index);
      }
      if (!/^[0-9a-f]{16}$/.test(String(evidence.canonicalTraceHash ?? ''))) {
        issues.push('signoff-record-evidence-trace-invalid:' + index);
      }
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
