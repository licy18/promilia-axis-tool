import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

const BROWSER_GLOBALS = ['window', 'document', 'localStorage', 'self'];

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
    expect(collectBrowserGlobalViolations(source)).toEqual([]);
    expect(source).not.toMatch(/\b(pixel|pointer|drag|drop)\b/i);
  });

  it('distinguishes local window data from actual browser-global access', () => {
    expect(
      collectBrowserGlobalViolations(
        'const window = { startFrame: 1 }; window.startFrame;'
      )
    ).toEqual([]);
    expect(collectBrowserGlobalViolations('window.location.href;')).not.toEqual(
      []
    );
    expect(
      collectBrowserGlobalViolations('globalThis.document.body;')
    ).not.toEqual([]);
  });

  it('keeps Workbench and Machine Axis production consumers behind the canonical core', () => {
    const productionFiles = [
      ...collectProductionFiles(
        resolve(process.cwd(), 'src/features/workbench')
      ),
      ...collectProductionFiles(resolve(process.cwd(), 'src/machine-axis')),
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
  it('keeps Machine Axis contracts and CLI free from browser globals', () => {
    const violations = collectProductionFiles(
      resolve(process.cwd(), 'src/machine-axis')
    ).flatMap(file => {
      const source = readFileSync(file, 'utf8');
      return [
        ...(/\bVue\b/.test(source) ? [`${file}:Vue`] : []),
        ...collectBrowserGlobalViolations(source).map(
          violation => `${file}:${violation}`
        ),
      ];
    });

    expect(violations).toEqual([]);
  });
});

function collectBrowserGlobalViolations(source) {
  const linter = new Linter();
  return linter
    .verify(source, {
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      rules: {
        'no-restricted-globals': ['error', ...BROWSER_GLOBALS],
        'no-restricted-properties': [
          'error',
          ...BROWSER_GLOBALS.filter(name => name !== 'self').map(property => ({
            object: 'globalThis',
            property,
          })),
        ],
      },
    })
    .map(message => `${message.line}:${message.column}:${message.message}`);
}

function collectProductionFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return collectProductionFiles(path);
    return ['.js', '.vue'].includes(extname(entry.name)) ? [path] : [];
  });
}
