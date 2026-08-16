// 2026-08-16 证据增强（P1-4 修复版）：给 review JSON 附加可复现性/认证字段
//  - repositoryHead: 捕获时 HEAD（证据捕获 commit）
//  - captureHarness: spec 文件 git 规范化 blob SHA-256（`git show <captureCommit>:<spec>`）
//                    + git blob SHA-1（`git hash-object`）——避免 CRLF 污染
//  - trackedCleanAtCapture: 真实 `git status --porcelain` 捕获输入的 clean 检查结果
//  - mechanicsPackageHash: 捕获时机制包 hash
// 只读增强，不改动已有证据字段。
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_DIR = 'work/m12-c/product-review/visual-evidence/2026-08-16';
const PREFIX = '20260816-fd9e3fad';
const HEAD = 'fd9e3fad';
const SPEC_PATH = 'e2e/m12-c-owner-visual-review.spec.js';
const CAPTURE_INPUTS = [
  'fixtures/character-acceptance/',
  'src/data/generated/verified-combat-mechanics-package.json',
  'src/data/generated/character-combat-profiles/',
  'e2e/m12-c-owner-visual-review.spec.js',
];

// spec SHA-256 必须基于 git blob 字节（LF 规范化），不能用工作树字节
// （Windows CRLF 会污染哈希，Linux clean checkout 将认证失败）。
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const specBlobBytes = execFileSync(
  'git',
  ['show', `${HEAD}:${SPEC_PATH}`],
  { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] }
);
const specSha256 = createHash('sha256').update(specBlobBytes).digest('hex');
const specGitBlob = git(['hash-object', SPEC_PATH]);
const pkg = JSON.parse(
  fs.readFileSync(
    'src/data/generated/verified-combat-mechanics-package.json',
    'utf8'
  )
);

// 真实捕获输入 clean 检查
const dirtyCaptureInputs = git(['status', '--porcelain', '--', ...CAPTURE_INPUTS])
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean);

const owners = [
  101010, 102001, 103002, 107001, 107002, 108003, 109001, 112001, 199001,
  199002,
];
for (const ownerId of owners) {
  const reviewPath = path.join(
    EVIDENCE_DIR,
    `${PREFIX}-${ownerId}-review.json`
  );
  if (!fs.existsSync(reviewPath)) {
    console.log(`${ownerId} SKIP: missing review`);
    continue;
  }
  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
  review.repositoryHead = HEAD;
  review.trackedCleanAtCapture = {
    captureInputs: CAPTURE_INPUTS,
    clean: dirtyCaptureInputs.length === 0,
    dirtyCaptureInputs,
    note: '捕获输入（fixtures/mechanism package/profiles/spec）在捕获时的真实 git status 检查结果；recipe 落账等非捕获输入允许存在未提交修改',
  };
  review.captureHarness = {
    specPath: SPEC_PATH,
    specSha256,
    specGitBlobSha1: specGitBlob,
    specSource: `git show ${HEAD}:${SPEC_PATH} (LF-normalized blob bytes)`,
  };
  review.mechanicsPackageHash = pkg.packageHash;
  fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2) + '\n', 'utf8');
  console.log(
    `${ownerId} enhanced: head=${HEAD} spec=${specSha256.slice(0, 12)} clean=${dirtyCaptureInputs.length === 0} pkg=${pkg.packageHash.slice(0, 12)}`
  );
}
console.log('DONE');
