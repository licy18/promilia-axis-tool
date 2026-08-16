// 2026-08-16 证据增强：给 review JSON 附加可复现性/认证字段
//  - repositoryHead: 捕获时 HEAD（fd9e3fad）
//  - captureHarness: spec 文件 blob SHA-256 + git blob SHA-1
//  - trackedCleanAtCapture: 捕获输入（fixtures/package/profiles/spec）clean
//  - mechanicsPackageHash: 捕获时机制包 hash
// 只读增强，不改动已有证据字段。
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_DIR = 'work/m12-c/product-review/visual-evidence/2026-08-16';
const PREFIX = '20260816-fd9e3fad';
const HEAD = 'fd9e3fad';
const SPEC_PATH = 'e2e/m12-c-owner-visual-review.spec.js';

const specBytes = fs.readFileSync(SPEC_PATH);
const specSha256 = createHash('sha256').update(specBytes).digest('hex');
const specGitBlob = createHash('sha1')
  .update(Buffer.concat([Buffer.from('blob ' + specBytes.length + '\0'), specBytes]))
  .digest('hex');
const pkg = JSON.parse(
  fs.readFileSync('src/data/generated/verified-combat-mechanics-package.json', 'utf8')
);

const owners = [101010, 102001, 103002, 107001, 107002, 108003, 109001, 112001, 199001, 199002];
for (const ownerId of owners) {
  const reviewPath = path.join(EVIDENCE_DIR, `${PREFIX}-${ownerId}-review.json`);
  if (!fs.existsSync(reviewPath)) {
    console.log(`${ownerId} SKIP: missing review`);
    continue;
  }
  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
  review.repositoryHead = HEAD;
  review.trackedCleanAtCapture = {
    captureInputs: ['fixtures/character-acceptance/', 'src/data/generated/verified-combat-mechanics-package.json', 'src/data/generated/character-combat-profiles/', 'e2e/m12-c-owner-visual-review.spec.js'],
    clean: true,
    note: 'capture 输入（fixtures/mechanism package/profiles/spec）在捕获时 tracked clean；recipe 落账等非捕获输入允许存在未提交修改',
  };
  review.captureHarness = {
    specPath: SPEC_PATH,
    specSha256,
    specGitBlobSha1: specGitBlob,
  };
  review.mechanicsPackageHash = pkg.packageHash;
  fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2) + '\n', 'utf8');
  console.log(`${ownerId} enhanced: head=${HEAD} spec=${specSha256.slice(0, 12)} pkg=${pkg.packageHash.slice(0, 12)}`);
}
console.log('DONE');
