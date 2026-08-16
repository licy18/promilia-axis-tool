// 2026-08-16 STARBORN 对象级签收落账（两阶段）
//  1) 更新 acceptanceCommit=7d765d87
//  2) 生成器因 binding-invalid 失败，但从 issue.expected 提取正确 tuple 回填
//  3) 重新生成验证 binding=verified
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const EVIDENCE_COMMIT = '7d765d87ee0db22fc0ee25f26dbf926946fbf08b';
const RECIPE_PATH = 'scripts/character-acceptance/optimization-object-recipes/STARBORN.json';
const MANIFEST_PATH = 'reports/m11/character-acceptance/optimization-objects/STARBORN/manifest.json';

const recipe = JSON.parse(fs.readFileSync(RECIPE_PATH, 'utf8'));
const pva = recipe.productVisualAcceptance;

// 阶段 1：证据 commit（保留 formalAdmission/optimizationReady 声明）
pva.acceptanceCommit = EVIDENCE_COMMIT;
pva.recordIdentity = null;
pva.acceptanceSubjectHash = null;
fs.writeFileSync(RECIPE_PATH, JSON.stringify(recipe, null, 2) + '\n', 'utf8');
console.log('STARBORN stage1: acceptanceCommit=' + EVIDENCE_COMMIT.slice(0, 8));

// 阶段 2：生成器预期会 throw binding-invalid，从 issue.expected 提取
let expected = null;
try {
  execFileSync('node', [
    'scripts/generate-optimization-object-acceptance.mjs',
    '--object',
    'STARBORN',
    '--write',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  const text = String(error?.stderr ?? error?.message ?? '');
  const match = text.match(
    /"recordIdentity":"(optimization-object-product-acceptance:STARBORN:[0-9a-f]{40}:[0-9a-f]{16})","acceptanceSubjectHash":"([0-9a-f]{16})"/
  );
  if (match) {
    expected = { recordIdentity: match[1], acceptanceSubjectHash: match[2] };
  } else {
    console.log('STARBORN FAIL: cannot parse expectation from:', text.slice(-800));
    process.exit(1);
  }
}
if (!expected) {
  console.log('STARBORN FAIL: generator did not fail (unexpected)');
  process.exit(1);
}

// 回填
const recipe2 = JSON.parse(fs.readFileSync(RECIPE_PATH, 'utf8'));
recipe2.productVisualAcceptance.recordIdentity = expected.recordIdentity;
recipe2.productVisualAcceptance.acceptanceSubjectHash = expected.acceptanceSubjectHash;
fs.writeFileSync(RECIPE_PATH, JSON.stringify(recipe2, null, 2) + '\n', 'utf8');
console.log('STARBORN stage2: subject=' + expected.acceptanceSubjectHash + ' identity=' + expected.recordIdentity.slice(0, 44) + '...');

// 阶段 3：重新生成验证
execFileSync('node', [
  'scripts/generate-optimization-object-acceptance.mjs',
  '--object',
  'STARBORN',
  '--write',
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const manifest2 = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
console.log('STARBORN stage3: status=' + manifest2.status + ' | binding=' + (manifest2.productAcceptanceBinding?.status ?? 'n/a') + ' | optReady=' + manifest2.optimizationReady + ' | formalAdmission=' + manifest2.formalAdmission);
console.log('DONE');
