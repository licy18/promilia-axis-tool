import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
});
