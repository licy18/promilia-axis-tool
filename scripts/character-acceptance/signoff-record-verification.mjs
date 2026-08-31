// Signoff record 认证（P1-1/P1-2/P1-4 + 二次审查修复）：
// 对 status=accepted 的 recipe，要求 acceptanceCommit 指向的 git 对象确实
// 包含不可变 signoff record 文件，且 record 内容与【独立派生值】一致——
// 所有比对值必须由调用方（生成器 preview manifest）派生传入，而非来自
// recipe 声明（recipe 是可被篡改的待验证对象）：
//   - record 必须是非 null 对象且 schema/contract/kind/必填字段完整
//   - record 内容 SHA-256 == recipe.signoffRecordSha256（commit 内内容未被改）
//   - record.ownerId == recipe.ownerId
//   - record.captureHarness.specSha256 == git 规范化字节的 spec SHA-256
//   - record.scenarioIdentity == 当前派生场景（须与 evidence fixture 一致）
//   - record.automatedEvidence 每条：fixtureSha256 与签收 commit 中 fixture 一致、
//     当前 fixture 去除 dataIdentity 后仍与签收 fixture 视觉轴语义一致、
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
  // 视觉签收只消费场景身份。qualification subject、机制包 hash 与 canonical
  // trace 由当前 machine acceptance 独立认证，不能重复绑死历史截图签收。
  const derivedScenarioIdentities = Array.isArray(derived.scenarioIdentities)
    ? derived.scenarioIdentities.map(String)
    : [];
  if (derivedScenarioIdentities.length === 0) {
    issues.push('signoff-record-derived-scenario-unavailable');
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
  } catch {
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
    !derivedScenarioIdentities.includes(String(record.scenarioIdentity ?? ''))
  ) {
    issues.push('signoff-record-scenario-identity-mismatch');
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
      const signedFixtureBytes = readGitFileOrEmpty(
        projectRoot,
        acceptanceCommit,
        fixturePath
      );
      const currentFixtureBytes = readProjectFileOrEmpty(
        projectRoot,
        fixturePath
      );
      if (sha256Hex(signedFixtureBytes) !== fixtureSha256) {
        issues.push('signoff-record-evidence-fixture-sha-mismatch:' + index);
      } else {
        const fixture = parseJsonOrNull(currentFixtureBytes);
        const signedFixture = parseJsonOrNull(signedFixtureBytes);
        if (
          fixture == null ||
          signedFixture == null ||
          String(fixture.scenario?.id ?? '') !== scenarioIdentity
        ) {
          issues.push(
            'signoff-record-evidence-fixture-scene-mismatch:' + index
          );
        } else if (!hasSameVisualFixtureSemantics(signedFixture, fixture)) {
          issues.push('signoff-record-evidence-visual-fixture-drift:' + index);
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
  } catch {
    return '';
  }
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readProjectFileOrEmpty(projectRoot, relativePath) {
  try {
    return fs.readFileSync(path.join(projectRoot, String(relativePath)));
  } catch {
    return Buffer.alloc(0);
  }
}

function readGitFileOrEmpty(projectRoot, commit, relativePath) {
  try {
    return execFileSync('git', ['show', `${commit}:${relativePath}`], {
      cwd: projectRoot,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return Buffer.alloc(0);
  }
}

function parseJsonOrNull(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
}

function hasSameVisualFixtureSemantics(signedFixture, currentFixture) {
  return (
    canonicalJson(projectVisualFixture(signedFixture)) ===
    canonicalJson(projectVisualFixture(currentFixture))
  );
}

function projectVisualFixture(fixture) {
  const projected = structuredClone(fixture ?? {});
  delete projected.dataIdentity;
  if (projected.metadata && typeof projected.metadata === 'object') {
    delete projected.metadata.optimizationObjectSourceAliasSelection;
  }
  return projected;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

// 对象级（STARBORN）signoff record 认证：与角色级同构——要求
// acceptanceCommit 指向的 git 对象确实包含不可变 signoff record，并认证
// 场景、fixture 与截图。当前 subject/package/alias 由独立机器 gate 重算，
// 非视觉漂移不要求重新截图签收。
const OBJECT_SIGN_OFF_CONTRACT =
  'AzPrOptimizationObjectProductVisualSignoffRecord';
const OBJECT_SIGN_OFF_KIND =
  'azpr-optimization-object-product-visual-signoff-record';

export function verifyOptimizationObjectSignoffRecord(recipe, { projectRoot }) {
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
  } catch {
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
        const signedFixtureBytes = readGitFileOrEmpty(
          projectRoot,
          acceptanceCommit,
          fixturePath
        );
        const currentFixtureBytes = readProjectFileOrEmpty(
          projectRoot,
          fixturePath
        );
        if (sha256Hex(signedFixtureBytes) !== fixtureSha256) {
          issues.push('signoff-record-evidence-fixture-sha-mismatch:' + index);
        } else {
          const fixture = parseJsonOrNull(currentFixtureBytes);
          const signedFixture = parseJsonOrNull(signedFixtureBytes);
          if (
            fixture == null ||
            signedFixture == null ||
            String(fixture.scenario?.id ?? '') !==
              String(evidence.scenarioIdentity ?? '')
          ) {
            issues.push(
              'signoff-record-evidence-fixture-scene-mismatch:' + index
            );
          } else if (!hasSameVisualFixtureSemantics(signedFixture, fixture)) {
            issues.push(
              'signoff-record-evidence-visual-fixture-drift:' + index
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
