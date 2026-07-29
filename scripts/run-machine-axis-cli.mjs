import { spawnSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';

const root = process.cwd();
const outDir = resolve(root, 'work', 'machine-axis-cli-dist');
const bundlePath = resolve(outDir, 'machine-axis-cli.mjs');
if (await shouldBuild(bundlePath)) {
  await build({
    configFile: resolve(root, 'vite.machine-axis-cli.config.js'),
    logLevel: 'silent',
  });
}
const result = spawnSync(
  process.execPath,
  [bundlePath, ...process.argv.slice(2)],
  {
    cwd: root,
    env: { ...process.env, AZPR_AXIS_ROOT: root },
    stdio: 'inherit',
  }
);
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exitCode = 5;
} else {
  process.exitCode = result.status ?? 5;
}

async function shouldBuild(targetPath) {
  if (process.env.AZPR_MACHINE_AXIS_REBUILD === '1') return true;
  let bundleMtime = 0;
  try {
    bundleMtime = (await stat(targetPath)).mtimeMs;
  } catch {
    return true;
  }
  const sourceRoots = [
    resolve(root, 'src'),
    resolve(root, 'scripts', 'machine-axis-cli-entry.mjs'),
    resolve(root, 'vite.machine-axis-cli.config.js'),
  ];
  for (const sourcePath of sourceRoots) {
    if ((await newestRelevantMtime(sourcePath)) > bundleMtime) return true;
  }
  return false;
}

async function newestRelevantMtime(sourcePath) {
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isDirectory()) return sourceStat.mtimeMs;
  let newest = sourceStat.mtimeMs;
  for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
    if (
      entry.name === 'verified-combat-mechanics-package.json' ||
      entry.name === 'node_modules'
    ) {
      continue;
    }
    const entryPath = resolve(sourcePath, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, await newestRelevantMtime(entryPath));
    } else if (/\.(?:js|mjs|json)$/.test(entry.name)) {
      newest = Math.max(newest, (await stat(entryPath)).mtimeMs);
    }
  }
  return newest;
}
