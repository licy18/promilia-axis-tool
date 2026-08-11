import { describe, expect, it } from 'vitest';
import {
  classifyChangedFile,
  classifyChangedFiles,
} from '../../../../scripts/gates/git-change-classifier.mjs';

describe('gate change classifier', () => {
  it.each([
    ['src/simulation/engine.js', 'runtime'],
    ['src/machine-axis/machineAxisSearchState.js', 'machine-axis'],
    ['src/features/workbench/TimelineGridPreview.vue', 'workbench'],
    ['acceptance-recipes/109001.json', 'acceptance'],
    ['src/data/generated/verified-combat-mechanics-package.json', 'generated'],
    ['vite.config.js', 'config'],
    ['README.md', 'docs'],
    ['work/m12-c/notes/output.json', 'evidence'],
  ])('classifies %s as %s', (file, expected) => {
    expect(classifyChangedFile(file).domains).toContain(expected);
  });

  it('marks an unmatched file as unknown and escalates fail closed', () => {
    const result = classifyChangedFiles(['mystery/new-authority.bin']);
    expect(result.unknownFiles).toEqual(['mystery/new-authority.bin']);
    expect(result.failClosedEscalation).toBe(true);
  });

  it('treats authoritative reports as generated contracts, not disposable evidence', () => {
    const result = classifyChangedFile(
      'reports/m12/m12-b3-binding-matrix.json'
    );
    expect(result.domains).toContain('generated');
    expect(result.domains).toContain('binding');
    expect(result.domains).not.toContain('evidence');
  });
});
