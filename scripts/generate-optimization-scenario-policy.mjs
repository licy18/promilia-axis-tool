import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOptimizationScenarioPolicy } from './optimization-scenario/optimization-scenario-policy-source.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(
  root,
  'src',
  'data',
  'generated',
  'optimization-scenario-policy.json'
);
const expected = JSON.stringify(createOptimizationScenarioPolicy(), null, 2) + '\n';
const write = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');

if (write) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, expected, 'utf8');
}

if (assertClean) {
  const actual = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, 'utf8')
    : null;
  if (actual !== expected) {
    throw new Error('optimization-scenario-policy-output-drift');
  }
}

const policy = createOptimizationScenarioPolicy();
console.log(
  JSON.stringify({
    policyId: policy.policyId,
    policyHash: policy.policyHash,
    outputPath: path.relative(root, outputPath).replaceAll('\\', '/'),
    status: write ? 'written' : assertClean ? 'clean' : 'generated',
  })
);
