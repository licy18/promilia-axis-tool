import { existsSync } from 'node:fs';
import path from 'node:path';

export function resolveCommandInvocation(
  file,
  args,
  {
    platform = process.platform,
    environment = process.env,
    nodeExecutable = environment.npm_node_execpath || process.execPath,
    exists = existsSync,
  } = {}
) {
  if (platform !== 'win32' || (file !== 'npm' && file !== 'npx')) {
    return { file, args: [...args] };
  }

  const npmCli = findNpmCli({ environment, nodeExecutable, exists });
  const packageCli =
    file === 'npm' ? npmCli : path.join(path.dirname(npmCli), 'npx-cli.js');
  if (!exists(packageCli)) {
    throw new Error(`Unable to locate ${file} CLI entry: ${packageCli}`);
  }
  return {
    file: nodeExecutable,
    args: [packageCli, ...args],
  };
}

function findNpmCli({ environment, nodeExecutable, exists }) {
  const candidates = [
    environment.npm_execpath,
    path.join(
      path.dirname(nodeExecutable),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    ),
    environment.APPDATA
      ? path.join(
          environment.APPDATA,
          'npm',
          'node_modules',
          'npm',
          'bin',
          'npm-cli.js'
        )
      : null,
  ].filter(Boolean);
  const found = candidates.find(candidate => exists(candidate));
  if (!found) {
    throw new Error(
      `Unable to locate npm CLI entry; checked: ${candidates.join(', ')}`
    );
  }
  return found;
}
