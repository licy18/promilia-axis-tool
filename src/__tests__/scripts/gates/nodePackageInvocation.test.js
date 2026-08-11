import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveCommandInvocation } from '../../../../scripts/gates/node-package-invocation.mjs';

describe('Windows npm/npx invocation', () => {
  it('starts npm through node without a cmd shell', () => {
    const npmCli = path.join(
      'C:\\node',
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    );
    const invocation = resolveCommandInvocation('npm', ['run', 'test:full'], {
      platform: 'win32',
      environment: {
        npm_execpath: npmCli,
        npm_node_execpath: 'C:\\node\\node.exe',
      },
      nodeExecutable: 'C:\\node\\node.exe',
      exists: candidate => candidate === npmCli,
    });

    expect(invocation).toEqual({
      file: 'C:\\node\\node.exe',
      args: [npmCli, 'run', 'test:full'],
    });
  });

  it('uses the sibling npx CLI and preserves arguments', () => {
    const npmCli = path.join('C:\\node', 'npm', 'bin', 'npm-cli.js');
    const npxCli = path.join('C:\\node', 'npm', 'bin', 'npx-cli.js');
    const invocation = resolveCommandInvocation(
      'npx',
      ['vitest', 'run', 'src/__tests__/scripts/gates'],
      {
        platform: 'win32',
        environment: { npm_execpath: npmCli },
        nodeExecutable: 'C:\\node\\node.exe',
        exists: candidate => candidate === npmCli || candidate === npxCli,
      }
    );

    expect(invocation).toEqual({
      file: 'C:\\node\\node.exe',
      args: [npxCli, 'vitest', 'run', 'src/__tests__/scripts/gates'],
    });
  });

  it('leaves native commands unchanged', () => {
    expect(
      resolveCommandInvocation('git', ['diff', '--check'], {
        platform: 'win32',
      })
    ).toEqual({ file: 'git', args: ['diff', '--check'] });
  });
});
