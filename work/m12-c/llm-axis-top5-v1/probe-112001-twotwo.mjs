// 诊断 112001 的 isolated:ultimate-consumer-two-two 失败
// 复用 generate-character-acceptance 的 inspectIsolatedActionCase
// 用法：node work/m12-c/llm-axis-top5-v1/probe-112001-twotwo.mjs
import { createServer } from 'vite';

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const genModule = await vite.ssrLoadModule(
    '/scripts/generate-character-acceptance.mjs'
  );
  const serviceModule = await vite.ssrLoadModule('/src/machine-axis/machineAxisService.js');
  const pkgModule = await vite.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js');
  const fs = await import('node:fs');
  const pkg = JSON.parse(
    fs.readFileSync('src/data/generated/verified-combat-mechanics-package.json', 'utf8')
  );
  pkgModule.installVerifiedCombatMechanicsPackage(pkg);

  const fixture = JSON.parse(
    fs.readFileSync('fixtures/character-acceptance/112001-visual.json', 'utf8')
  );
  const profile = JSON.parse(
    fs.readFileSync('src/data/generated/character-combat-profiles/112001.json', 'utf8')
  );
  const recipe = JSON.parse(
    fs.readFileSync('scripts/character-acceptance/acceptance-recipes/112001.json', 'utf8')
  );
  const service = serviceModule.createMachineAxisService();

  // 找 twoTwo isolated case
  const twoTwoCase = (recipe.isolatedActionCases ?? []).find(
    c => c.identity === 'ultimate-consumer-two-two-prefers-thunder-and-settles-order'
  );
  if (!twoTwoCase) {
    console.log('twoTwo case NOT FOUND');
  } else {
    const result = genModule.inspectIsolatedActionCase(
      service,
      fixture,
      twoTwoCase,
      profile
    );
    console.log('twoTwo passed:', result.passed);
    const probes = result.actual?.probeResults ?? [];
    for (const p of probes) {
      console.log('probe:', p.identity, 'passed:', p.passed);
      if (!p.passed) {
        console.log('  actual:', JSON.stringify(p.actual ?? p.details ?? p, null, 1).slice(0, 900));
      }
    }
  }
} finally {
  await vite.close();
}
