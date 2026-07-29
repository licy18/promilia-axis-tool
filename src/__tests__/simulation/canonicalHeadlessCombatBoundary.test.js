import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('canonical headless combat boundary', () => {
  it('does not depend on UI, DOM, drag geometry, or browser storage', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/simulation/headless/canonicalHeadlessCombatCore.js'
      ),
      'utf8'
    );

    expect(source).not.toMatch(/from ['"][^'"]*(views|features|components)/);
    expect(source).not.toMatch(/\bVue\b/);
    expect(source).not.toMatch(/\b(window|document|localStorage)\s*[.[]/);
    expect(source).not.toMatch(/\b(pixel|pointer|drag|drop)\b/i);
  });

  it('keeps Workbench production consumers behind the canonical core', () => {
    const productionFiles = [
      ...collectProductionFiles(
        resolve(process.cwd(), 'src/features/workbench')
      ),
      resolve(process.cwd(), 'src/views/Workbench.vue'),
    ];
    const violations = productionFiles.flatMap(file => {
      const source = readFileSync(file, 'utf8');
      const directImports = [
        /from ['"][^'"]*simulation\/compiler\/compileProject['"]/,
        /from ['"][^'"]*simulation\/engine\/simulateScenario['"]/,
      ];
      return directImports
        .filter(pattern => pattern.test(source))
        .map(pattern => `${file}:${pattern.source}`);
    });

    expect(violations).toEqual([]);
  });
});

function collectProductionFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return collectProductionFiles(path);
    return ['.js', '.vue'].includes(extname(entry.name)) ? [path] : [];
  });
}
