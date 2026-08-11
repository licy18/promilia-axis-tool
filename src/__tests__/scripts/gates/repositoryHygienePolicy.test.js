import { describe, expect, it } from 'vitest';

import {
  GENERATOR_OWNED_OUTPUT_PREFIXES,
  isGeneratorOwnedOutput,
} from '../../../../scripts/gates/repository-hygiene-policy.mjs';

describe('repository hygiene policy', () => {
  it('keeps the generator-owned roots explicit and narrow', () => {
    expect(GENERATOR_OWNED_OUTPUT_PREFIXES).toEqual([
      'reports/',
      'src/data/generated/',
    ]);
  });

  it.each([
    'reports/m10/101003/golden-trace.json',
    'reports\\m12\\m12-b3-binding-matrix.md',
    './src/data/generated/character-acceptance-catalog.json',
    'src/data/generated/verified-sp-unit-runtime.js',
  ])('recognizes generator-owned output %s', file => {
    expect(isGeneratorOwnedOutput(file)).toBe(true);
  });

  it.each([
    'scripts/character-acceptance/acceptance-recipes/101003.json',
    'src/data/azprGenerated.js',
    'src/data/generated-adapter.js',
    'work/m12-c/STATE.md',
  ])('does not exempt authored input %s', file => {
    expect(isGeneratorOwnedOutput(file)).toBe(false);
  });
});
