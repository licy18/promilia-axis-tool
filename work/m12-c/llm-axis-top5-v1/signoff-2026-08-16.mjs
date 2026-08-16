// 2026-08-16 真实签收落账（认证链版，三阶段）：
//   stage1: 生成不可变 signoff record 骨架（review 证据 + package/harness hash）
//   stage2: 回填 record qualificationSubjectHash/scenarioSetHash/recordIdentity
//           （来自生成器 bindingExpectation），落账 recipe
//           （acceptanceCommit=evidence commit、signoffRecordPath、截图 SHA），
//           signoffRecordSha256 暂用占位——提交后由 stage3 用 git show 精确回填
//   stage3: 用 `git show <evidenceCommit>:<recordPath>` 计算 record 内容 SHA，
//           回填 recipe.signoffRecordSha256，重新生成验证 binding=verified
//
// 用法：
//   M12C_SIGNOFF_EVIDENCE_COMMIT=<commit> node signoff-2026-08-16.mjs --stage1|--stage2|--stage3 [--owner <id>]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_COMMIT = process.env.M12C_SIGNOFF_EVIDENCE_COMMIT ?? '';
const EVIDENCE_DIR = 'work/m12-c/product-review/visual-evidence/2026-08-16';
const RECORD_DIR = 'work/m12-c/product-review/signoff-records/2026-08-16';
const PREFIX = process.env.M12C_SIGNOFF_PREFIX ?? '20260816-fd9e3fad';
const RECIPE_DIR = 'scripts/character-acceptance/acceptance-recipes';
const args = process.argv.slice(2);
const stage1 = args.includes('--stage1');
const stage2 = args.includes('--stage2');
const stage3 = args.includes('--stage3');
const ownerIndex = args.indexOf('--owner');
const requestedOwner = ownerIndex >= 0 ? Number(args[ownerIndex + 1]) : null;
const allOwners = [101010, 102001, 103002, 107001, 107002, 108003, 109001, 112001, 199001, 199002];
const owners = requestedOwner ? [requestedOwner] : allOwners;

if (!EVIDENCE_COMMIT || !/^[0-9a-f]{40}$/.test(EVIDENCE_COMMIT)) {
  console.error('M12C_SIGNOFF_EVIDENCE_COMMIT required (40-hex evidence commit)');
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, value) {
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

const specBytes = fs.readFileSync('e2e/m12-c-owner-visual-review.spec.js');
const specSha256 = createHash('sha256').update(specBytes).digest('hex');
const pkg = readJson('src/data/generated/verified-combat-mechanics-package.json');
const repositoryHead = git(['rev-parse', 'HEAD']);

// ---------- 阶段 1：生成不可变 signoff record 骨架 ----------
if (stage1) {
  fs.mkdirSync(RECORD_DIR, { recursive: true });
  for (const ownerId of owners) {
    const reviewPath = path.join(EVIDENCE_DIR, `${PREFIX}-${ownerId}-review.json`);
    if (!fs.existsSync(reviewPath)) {
      console.log(`${ownerId} SKIP: review missing`);
      continue;
    }
    const review = readJson(reviewPath);
    const traceShot = `${EVIDENCE_DIR}/${PREFIX}-${ownerId}-canonical-trace.png`;
    const importShot = `${EVIDENCE_DIR}/${PREFIX}-${ownerId}-import-dialog.png`;
    const recipe = readJson(`${RECIPE_DIR}/${ownerId}.json`);
    const scenarioIdentity = String(
      recipe.productVisualAcceptance?.scenarioIdentities?.[0] ??
        'm11-d-' + ownerId + '-visual-acceptance'
    );
    const fixture = readJson(
      String(recipe.fixturePath ?? `fixtures/character-acceptance/${ownerId}-visual.json`)
    );
    const record = {
      schemaVersion: 1,
      contractName: 'AzPrCharacterProductVisualSignoffRecord',
      kind: 'azpr-character-product-visual-signoff-record',
      ownerId,
      scenarioIdentity,
      signoffTime: new Date().toISOString(),
      signoffInstruction: process.env.M12C_SIGNOFF_INSTRUCTION ?? '继续签收',
      repositoryHead,
      mechanicsPackageHash: pkg.packageHash,
      captureHarness: {
        specPath: 'e2e/m12-c-owner-visual-review.spec.js',
        specSha256,
        specGitBlobSha1: review.captureHarness?.specGitBlobSha1 ?? null,
      },
      canonicalTraceHash: review.canonicalTraceHash,
      automatedEvidence: [
        {
          scenarioIdentity,
          evidenceKind: 'workbench-playwright-screenshot',
          status: 'automated-workbench-import-passed',
          screenshotPath: traceShot.replaceAll('\\', '/'),
          screenshotSha256: sha256Hex(fs.readFileSync(traceShot)),
          importScreenshotPath: importShot.replaceAll('\\', '/'),
          importScreenshotSha256: sha256Hex(fs.readFileSync(importShot)),
          fixturePath: String(recipe.fixturePath ?? ''),
          fixtureSha256: sha256Hex(fs.readFileSync(String(recipe.fixturePath))),
        },
      ],
      qualificationSubjectHash: null,
      scenarioSetHash: null,
      recordIdentity: null,
    };
    const recordPath = path.join(RECORD_DIR, `${ownerId}.json`);
    writeJson(recordPath, record);
    console.log(`${ownerId} stage1 record: ${recordPath}`);
  }
  console.log('STAGE1 DONE — 运行 --stage2（回填 subject + 落账 recipe）');
}

// ---------- 阶段 2：回填 record subject + 落账 recipe ----------
if (stage2) {
  for (const ownerId of owners) {
    const recordPath = path.join(RECORD_DIR, `${ownerId}.json`);
    const recipePath = `${RECIPE_DIR}/${ownerId}.json`;
    if (!fs.existsSync(recordPath)) {
      console.log(`${ownerId} SKIP: record missing (run --stage1 first)`);
      continue;
    }
    const recipe = readJson(recipePath);
    const pva = recipe.productVisualAcceptance ?? {};

    // 证据 commit + 截图（保留 superseded 历史）
    pva.status = 'accepted';
    pva.acceptanceCommit = EVIDENCE_COMMIT;
    pva.signoffRecordPath = recordPath.replaceAll('\\', '/');
    pva.signoffRecordSha256 = 'PENDING-STAGE3'; // 提交后由 stage3 精确回填
    pva.recordIdentity = null;
    pva.qualificationSubjectHash = null;
    pva.scenarioSetHash = null;
    pva.scenarioIdentities = pva.scenarioIdentities ?? [];
    const traceShot = `${EVIDENCE_DIR}/${PREFIX}-${ownerId}-canonical-trace.png`;
    const priorEvidence = pva.automatedEvidence ?? [];
    const existingSuperseded = pva.supersededAutomatedEvidence ?? [];
    const knownHashes = new Set(existingSuperseded.map(e => e.screenshotSha256 ?? '').filter(Boolean));
    for (const evidence of priorEvidence) {
      if (!knownHashes.has(evidence.screenshotSha256 ?? '')) existingSuperseded.push({ ...evidence });
    }
    pva.automatedEvidence = [
      {
        scenarioIdentity: String(pva.scenarioIdentities?.[0] ?? 'm11-d-' + ownerId + '-visual-acceptance'),
        evidenceKind: 'workbench-playwright-screenshot',
        status: 'automated-workbench-import-passed',
        screenshotPath: traceShot.replaceAll('\\', '/'),
        screenshotSha256: sha256Hex(fs.readFileSync(traceShot)),
      },
    ];
    pva.supersededAutomatedEvidence = existingSuperseded;
    writeJson(recipePath, recipe);

    // 生成器取 binding expectation（subject 不依赖 acceptanceCommit）
    execFileSync('node', ['scripts/generate-character-acceptance.mjs', '--owner', String(ownerId), '--write'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const manifest = readJson(`reports/m11/character-acceptance/${ownerId}/manifest.json`);
    const expectation = manifest.evidence?.productVisualAcceptance?.bindingExpectation ?? null;
    if (!expectation) {
      console.log(`${ownerId} FAIL: no bindingExpectation`);
      continue;
    }

    // 回填 record（subject/scenarioSetHash/recordIdentity）
    const record2 = readJson(recordPath);
    record2.qualificationSubjectHash = expectation.qualificationSubjectHash;
    record2.scenarioSetHash = expectation.scenarioSetHash;
    record2.recordIdentity = expectation.recordIdentity;
    writeJson(recordPath, record2);

    // 回填 recipe
    const recipe2 = readJson(recipePath);
    const pva2 = recipe2.productVisualAcceptance;
    pva2.recordIdentity = expectation.recordIdentity;
    pva2.qualificationSubjectHash = expectation.qualificationSubjectHash;
    pva2.scenarioSetHash = expectation.scenarioSetHash;
    pva2.scenarioIdentities = expectation.scenarioIdentities;
    writeJson(recipePath, recipe2);

    console.log(`${ownerId} stage2: subject=${expectation.qualificationSubjectHash} recordIdentity=${expectation.recordIdentity.slice(0, 44)}...`);
  }
  console.log('STAGE2 DONE — 提交 record + recipe 后运行 --stage3 回填 record SHA');
}

// ---------- 阶段 3：用 git show 计算 record 真实 SHA 回填 recipe ----------
if (stage3) {
  const recordCommit = process.env.M12C_SIGNOFF_RECORD_COMMIT ?? EVIDENCE_COMMIT;
  if (!/^[0-9a-f]{40}$/.test(recordCommit)) {
    console.error('M12C_SIGNOFF_RECORD_COMMIT required (40-hex record commit)');
    process.exit(1);
  }
  for (const ownerId of owners) {
    const recordPath = path.join(RECORD_DIR, `${ownerId}.json`);
    const recipePath = `${RECIPE_DIR}/${ownerId}.json`;
    const recordRelative = recordPath.replaceAll('\\', '/');
    let recordBytes = null;
    try {
      recordBytes = execFileSync('git', ['show', `${recordCommit}:${recordRelative}`], {
        encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      console.log(`${ownerId} FAIL: record not found in ${recordCommit.slice(0, 8)}:${recordRelative}`);
      continue;
    }
    const recordSha256 = createHash('sha256').update(recordBytes).digest('hex');
    const recipe = readJson(recipePath);
    recipe.productVisualAcceptance.acceptanceCommit = recordCommit;
    recipe.productVisualAcceptance.signoffRecordSha256 = recordSha256;
    // recordIdentity 含 commit 段 → 用 recordCommit 重算
    const record = readJson(recordPath);
    recipe.productVisualAcceptance.recordIdentity =
      'character-product-acceptance:' +
      ownerId +
      ':' +
      recordCommit +
      ':' +
      record.qualificationSubjectHash;
    writeJson(recipePath, recipe);
    // 重新生成验证
    execFileSync('node', ['scripts/generate-character-acceptance.mjs', '--owner', String(ownerId), '--write'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finalManifest = readJson(`reports/m11/character-acceptance/${ownerId}/manifest.json`);
    const finalPva = finalManifest.evidence?.productVisualAcceptance ?? {};
    console.log(
      `${ownerId} stage3: commit=${recordCommit.slice(0, 8)} recordSha=${recordSha256.slice(0, 12)} binding=${finalPva.bindingStatus} optReady=${finalManifest.maturity?.optimizationReady} auth=${finalPva.signoffRecordAuthentication?.status ?? 'n/a'}`
    );
  }
  console.log('STAGE3 DONE');
}
console.log('DONE');
