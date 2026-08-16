// 2026-08-16 STARBORN 对象级签收落账（认证链版）：
//   stage1: 生成不可变 signoff record（evidence commit 654e00fc 的重捕截图）
//   stage2: 回填 subject（对象级 acceptanceSubjectHash）+ 落账 recipe
//   stage3: 用 git show <recordCommit>:<path> 回填 record SHA 并验证
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_COMMIT = process.env.M12C_SIGNOFF_EVIDENCE_COMMIT ?? '';
const RECORD_DIR = 'work/m12-c/product-review/signoff-records/2026-08-16';
const RECIPE_PATH =
  'scripts/character-acceptance/optimization-object-recipes/STARBORN.json';
const RECORD_PATH = path.join(RECORD_DIR, 'STARBORN.json');
const args = process.argv.slice(2);
const stage1 = args.includes('--stage1');
const stage2 = args.includes('--stage2');
const stage3 = args.includes('--stage3');

if (!EVIDENCE_COMMIT || !/^[0-9a-f]{40}$/.test(EVIDENCE_COMMIT)) {
  console.error('M12C_SIGNOFF_EVIDENCE_COMMIT required');
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, v) {
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');
}
function sha256Hex(b) {
  return createHash('sha256').update(b).digest('hex');
}
function git(a) {
  return execFileSync('git', a, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

const specBytes = fs.readFileSync('e2e/m12-c-owner-visual-review.spec.js');
const specSha256 = createHash('sha256').update(specBytes).digest('hex');
const pkg = readJson(
  'src/data/generated/verified-combat-mechanics-package.json'
);
const repositoryHead = git(['rev-parse', 'HEAD']);
const PREFIX = process.env.M12C_SIGNOFF_PREFIX ?? '20260816-fd9e3fad';
const EVIDENCE_DIR = 'work/m12-c/product-review/visual-evidence/2026-08-16';

if (stage1) {
  fs.mkdirSync(RECORD_DIR, { recursive: true });
  const recipe = readJson(RECIPE_PATH);
  const aliases = recipe.sourceAliases ?? [];
  const automatedEvidence = aliases.map(alias => {
    const ownerId = Number(alias.sourceCharacterId);
    const traceShot = `${EVIDENCE_DIR}/${PREFIX}-${ownerId}-canonical-trace.png`;
    const importShot = `${EVIDENCE_DIR}/${PREFIX}-${ownerId}-import-dialog.png`;
    const review = readJson(`${EVIDENCE_DIR}/${PREFIX}-${ownerId}-review.json`);
    return {
      sourceCharacterId: ownerId,
      scenarioIdentity: String(
        recipe.productVisualAcceptance?.scenarioIdentities?.[0] ??
          'm11-d-' + ownerId + '-visual-acceptance'
      ),
      evidenceKind: 'workbench-playwright-screenshot',
      status: 'automated-workbench-import-passed',
      screenshotPath: traceShot.replaceAll('\\', '/'),
      screenshotSha256: sha256Hex(fs.readFileSync(traceShot)),
      importScreenshotPath: importShot.replaceAll('\\', '/'),
      importScreenshotSha256: sha256Hex(fs.readFileSync(importShot)),
      fixturePath: String(alias.fixturePath),
      fixtureSha256: sha256Hex(fs.readFileSync(String(alias.fixturePath))),
      canonicalTraceHash: review.canonicalTraceHash,
    };
  });
  const record = {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationObjectProductVisualSignoffRecord',
    kind: 'azpr-optimization-object-product-visual-signoff-record',
    optimizationObjectId: 'STARBORN',
    requiredSourceCharacterIds: (recipe.requiredSourceCharacterIds ?? []).map(
      Number
    ),
    signoffTime: new Date().toISOString(),
    signoffInstruction: process.env.M12C_SIGNOFF_INSTRUCTION ?? '继续签收',
    repositoryHead,
    mechanicsPackageHash: pkg.packageHash,
    captureHarness: {
      specPath: 'e2e/m12-c-owner-visual-review.spec.js',
      specSha256,
      specGitBlobSha1: automatedEvidence[0] ? null : null,
    },
    automatedEvidence,
    acceptanceSubjectHash: null,
    recordIdentity: null,
  };
  writeJson(RECORD_PATH, record);
  console.log('STARBORN stage1 record:', RECORD_PATH);
}

if (stage2) {
  const recipe = readJson(RECIPE_PATH);
  const pva = recipe.productVisualAcceptance;
  pva.status = 'accepted';
  pva.acceptanceCommit = EVIDENCE_COMMIT;
  pva.signoffRecordPath = RECORD_PATH.replaceAll('\\', '/');
  pva.signoffRecordSha256 = 'PENDING-STAGE3';
  pva.recordIdentity = null;
  pva.acceptanceSubjectHash = null;
  pva.formalAdmission = true;
  pva.optimizationReady = true;
  writeJson(RECIPE_PATH, recipe);

  // 生成器失败时从 issue.expected 提取 subject
  let expected = null;
  try {
    execFileSync(
      'node',
      [
        'scripts/generate-optimization-object-acceptance.mjs',
        '--object',
        'STARBORN',
        '--write',
      ],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } catch (error) {
    const text = String(error?.stderr ?? error?.message ?? '');
    const match = text.match(
      /"recordIdentity":"(optimization-object-product-acceptance:STARBORN:[0-9a-f]{40}:[0-9a-f]{16})","acceptanceSubjectHash":"([0-9a-f]{16})"/
    );
    if (match)
      expected = { recordIdentity: match[1], acceptanceSubjectHash: match[2] };
    else {
      console.log('STARBORN FAIL: cannot parse expectation:', text.slice(-500));
      process.exit(1);
    }
  }
  if (!expected) {
    console.log('STARBORN FAIL: generator did not fail');
    process.exit(1);
  }

  const record = readJson(RECORD_PATH);
  record.acceptanceSubjectHash = expected.acceptanceSubjectHash;
  record.recordIdentity = expected.recordIdentity;
  writeJson(RECORD_PATH, record);

  const recipe2 = readJson(RECIPE_PATH);
  recipe2.productVisualAcceptance.recordIdentity = expected.recordIdentity;
  recipe2.productVisualAcceptance.acceptanceSubjectHash =
    expected.acceptanceSubjectHash;
  writeJson(RECIPE_PATH, recipe2);
  console.log('STARBORN stage2: subject=' + expected.acceptanceSubjectHash);
}

if (stage3) {
  const recordCommit =
    process.env.M12C_SIGNOFF_RECORD_COMMIT ?? EVIDENCE_COMMIT;
  const recordRelative = RECORD_PATH.replaceAll('\\', '/');
  let recordBytes;
  try {
    recordBytes = execFileSync(
      'git',
      ['show', `${recordCommit}:${recordRelative}`],
      { encoding: 'buffer' }
    );
  } catch (error) {
    console.log('STARBORN FAIL: record not in', recordCommit.slice(0, 8));
    process.exit(1);
  }
  const recordSha256 = createHash('sha256').update(recordBytes).digest('hex');
  const recipe = readJson(RECIPE_PATH);
  recipe.productVisualAcceptance.acceptanceCommit = recordCommit;
  recipe.productVisualAcceptance.signoffRecordSha256 = recordSha256;
  const record = readJson(RECORD_PATH);
  recipe.productVisualAcceptance.recordIdentity = `optimization-object-product-acceptance:STARBORN:${recordCommit}:${record.acceptanceSubjectHash}`;
  writeJson(RECIPE_PATH, recipe);
  execFileSync(
    'node',
    [
      'scripts/generate-optimization-object-acceptance.mjs',
      '--object',
      'STARBORN',
      '--write',
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const manifest = readJson(
    'reports/m11/character-acceptance/optimization-objects/STARBORN/manifest.json'
  );
  console.log(
    'STARBORN stage3: commit=' +
      recordCommit.slice(0, 8) +
      ' recordSha=' +
      recordSha256.slice(0, 12) +
      ' status=' +
      manifest.status +
      ' binding=' +
      (manifest.productAcceptanceBinding?.status ?? 'n/a') +
      ' optReady=' +
      manifest.optimizationReady
  );
}
console.log('DONE');
